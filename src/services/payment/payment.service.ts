/**
 * PaymentService - Gestion des paiements jalonnés
 * Intégration Stripe Connect pour paiements marketplace
 */

import Stripe from 'stripe';
import { supabase } from '@/lib/supabase';
import {
  Payment,
  PaymentRequest,
  PaymentStatus,
  PaymentType,
  PaymentMilestone,
  ProjectContract,
  FraudCheckResult,
  EscrowRelease,
  PaymentNotification,
} from '@/types/payment.types';
import { FraudDetectionService } from './fraudDetection.service';
import { NotificationService } from '@/services/notification.service';

// Initialiser Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
});

// Configuration par défaut
const PAYMENT_CONFIG = {
  // Frais TORP (%)
  platformFeePercent: 3.5,

  // Séquestre
  defaultEscrowDays: 7,
  autoReleaseEnabled: true,

  // Retenue de garantie
  defaultRetentionPercent: 5,
  retentionDurationMonths: 12,

  // Limites
  maxDepositPercent: 30, // 30% max pour acompte
  maxSinglePayment: 50000, // 50k€ max par paiement

  // Devise
  currency: 'eur',
};

export class PaymentService {
  /**
   * Crée un paiement pour un jalon validé
   */
  static async createPayment(
    request: PaymentRequest,
    userId: string
  ): Promise<{ payment: Payment; clientSecret?: string; error?: string }> {
    try {
      // 1. Récupérer le contrat
      const { data: contract, error: contractError } = await supabase
        .from('project_contracts')
        .select('*')
        .eq('id', request.contractId)
        .single();

      if (contractError || !contract) {
        return { payment: null as unknown as Payment, error: 'Contrat non trouvé' };
      }

      // 2. Vérifier les droits
      if (contract.client_id !== userId && contract.entreprise_id !== userId) {
        return { payment: null as unknown as Payment, error: 'Accès non autorisé' };
      }

      // 3. Calculer les montants
      const montantTVA = request.montantHT * (request.tauxTVA / 100);
      const montantTTC = request.montantHT + montantTVA;

      // 4. Vérifications anti-fraude
      const fraudCheck = await FraudDetectionService.checkPayment({
        contractId: request.contractId,
        entrepriseId: contract.entreprise_id,
        montant: montantTTC,
        type: request.paymentType,
        milestoneId: request.milestoneId,
      });

      if (fraudCheck.shouldBlock) {
        // Logger et notifier les admins
        await this.logFraudBlock(request, fraudCheck);
        return {
          payment: null as unknown as Payment,
          error: `Paiement bloqué pour vérification de sécurité. Référence: ${fraudCheck.rulesTriggered.join(', ')}`,
        };
      }

      // 5. Vérifier les limites
      const limitCheck = await this.checkPaymentLimits(request, contract, montantTTC);
      if (!limitCheck.valid) {
        return { payment: null as unknown as Payment, error: limitCheck.error };
      }

      // 6. Générer la référence
      const reference = await this.generateReference();

      // 7. Récupérer le compte Stripe de l'entreprise
      const { data: enterpriseAccount } = await supabase
        .from('enterprise_payment_accounts')
        .select('stripe_account_id, stripe_charges_enabled')
        .eq('user_id', contract.entreprise_id)
        .single();

      if (!enterpriseAccount?.stripe_account_id || !enterpriseAccount.stripe_charges_enabled) {
        return {
          payment: null as unknown as Payment,
          error: 'L\'entreprise n\'a pas configuré son compte de paiement',
        };
      }

      // 8. Créer le PaymentIntent Stripe
      const platformFee = Math.round(montantTTC * (PAYMENT_CONFIG.platformFeePercent / 100) * 100);
      const amountInCents = Math.round(montantTTC * 100);

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amountInCents,
        currency: PAYMENT_CONFIG.currency,
        payment_method_types: ['card', 'sepa_debit'],
        metadata: {
          contract_id: request.contractId,
          milestone_id: request.milestoneId || '',
          payment_type: request.paymentType,
          reference: reference,
        },
        // Transfer vers le compte connecté avec frais TORP
        transfer_data: {
          destination: enterpriseAccount.stripe_account_id,
        },
        application_fee_amount: platformFee,
        // Capturer manuellement pour séquestre
        capture_method: 'manual',
      });

      // 9. Créer l'enregistrement en base
      const paymentData = {
        reference,
        contract_id: request.contractId,
        milestone_id: request.milestoneId,
        payment_type: request.paymentType,
        montant_ht: request.montantHT,
        montant_tva: montantTVA,
        montant_ttc: montantTTC,
        stripe_payment_intent_id: paymentIntent.id,
        payer_id: contract.client_id,
        payee_id: contract.entreprise_id,
        status: 'pending' as PaymentStatus,
        status_history: [{
          status: 'pending',
          changedAt: new Date().toISOString(),
          reason: 'Paiement créé',
        }],
        fraud_checks: fraudCheck,
        fraud_score: fraudCheck.totalScore,
        fraud_alerts: fraudCheck.rulesTriggered,
        requires_manual_review: fraudCheck.riskLevel === 'high',
        due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // +7 jours
      };

      const { data: payment, error: insertError } = await supabase
        .from('payments')
        .insert(paymentData)
        .select()
        .single();

      if (insertError) {
        // Annuler le PaymentIntent Stripe
        await stripe.paymentIntents.cancel(paymentIntent.id);
        throw insertError;
      }

      // 10. Notifier le client
      await this.notifyPaymentCreated(payment, contract);

      return {
        payment: this.mapPaymentFromDB(payment),
        clientSecret: paymentIntent.client_secret || undefined,
      };
    } catch (error) {
      console.error('Erreur création paiement:', error);
      return {
        payment: null as unknown as Payment,
        error: `Erreur lors de la création du paiement: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Confirme un paiement (après paiement client)
   */
  static async confirmPayment(
    paymentId: string,
    paymentIntentId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // 1. Vérifier le PaymentIntent Stripe
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

      if (paymentIntent.status !== 'requires_capture') {
        return { success: false, error: 'Paiement non capturable' };
      }

      // 2. Récupérer le paiement
      const { data: payment } = await supabase
        .from('payments')
        .select('*, project_contracts(*)')
        .eq('id', paymentId)
        .single();

      if (!payment) {
        return { success: false, error: 'Paiement non trouvé' };
      }

      // 3. Capturer le paiement (mise en séquestre)
      await stripe.paymentIntents.capture(paymentIntentId);

      // 4. Calculer la date de libération du séquestre
      const heldUntil = new Date();
      heldUntil.setDate(heldUntil.getDate() + PAYMENT_CONFIG.defaultEscrowDays);

      // 5. Mettre à jour le statut
      const { error: updateError } = await supabase
        .from('payments')
        .update({
          status: 'held',
          paid_at: new Date().toISOString(),
          held_until: heldUntil.toISOString(),
          status_history: [
            ...payment.status_history,
            {
              status: 'held',
              changedAt: new Date().toISOString(),
              reason: `Paiement capturé, séquestre jusqu'au ${heldUntil.toLocaleDateString('fr-FR')}`,
            },
          ],
        })
        .eq('id', paymentId);

      if (updateError) throw updateError;

      // 6. Mettre à jour le jalon si applicable
      if (payment.milestone_id) {
        await supabase
          .from('payment_milestones')
          .update({
            status: 'completed',
            date_paiement: new Date().toISOString(),
          })
          .eq('id', payment.milestone_id);
      }

      // 7. Notifier les parties
      await this.notifyPaymentConfirmed(payment);

      return { success: true };
    } catch (error) {
      console.error('Erreur confirmation paiement:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Libère un paiement du séquestre vers l'entreprise
   */
  static async releasePayment(
    paymentId: string,
    releaseBy: string,
    force: boolean = false
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // 1. Récupérer le paiement
      const { data: payment } = await supabase
        .from('payments')
        .select('*, project_contracts(*)')
        .eq('id', paymentId)
        .single();

      if (!payment) {
        return { success: false, error: 'Paiement non trouvé' };
      }

      if (payment.status !== 'held') {
        return { success: false, error: 'Le paiement n\'est pas en séquestre' };
      }

      // 2. Vérifier si libération possible
      const heldUntil = new Date(payment.held_until);
      if (!force && new Date() < heldUntil) {
        return {
          success: false,
          error: `Séquestre actif jusqu'au ${heldUntil.toLocaleDateString('fr-FR')}`,
        };
      }

      // 3. Vérifier qu'il n'y a pas de litige en cours
      const { data: disputes } = await supabase
        .from('disputes')
        .select('id')
        .eq('payment_id', paymentId)
        .in('status', ['opened', 'under_review', 'mediation']);

      if (disputes && disputes.length > 0) {
        return { success: false, error: 'Un litige est en cours sur ce paiement' };
      }

      // 4. Effectuer le transfert Stripe vers l'entreprise
      const { data: enterpriseAccount } = await supabase
        .from('enterprise_payment_accounts')
        .select('stripe_account_id')
        .eq('user_id', payment.payee_id)
        .single();

      if (!enterpriseAccount?.stripe_account_id) {
        return { success: false, error: 'Compte entreprise non configuré' };
      }

      // Le transfert a déjà été fait lors de la capture avec transfer_data
      // On met juste à jour le statut

      // 5. Mettre à jour le paiement
      const { error: updateError } = await supabase
        .from('payments')
        .update({
          status: 'released',
          released_at: new Date().toISOString(),
          escrow_released_at: new Date().toISOString(),
          escrow_released_by: releaseBy,
          status_history: [
            ...payment.status_history,
            {
              status: 'released',
              changedAt: new Date().toISOString(),
              changedBy: releaseBy,
              reason: force ? 'Libération anticipée' : 'Libération automatique fin de séquestre',
            },
          ],
        })
        .eq('id', paymentId);

      if (updateError) throw updateError;

      // 6. Mettre à jour les statistiques de l'entreprise
      await this.updateEnterpriseStats(payment.payee_id, payment.montant_ttc, 'received');

      // 7. Notifier l'entreprise
      await this.notifyPaymentReleased(payment);

      return { success: true };
    } catch (error) {
      console.error('Erreur libération paiement:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Rembourse un paiement
   */
  static async refundPayment(
    paymentId: string,
    refundBy: string,
    reason: string,
    amount?: number
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: payment } = await supabase
        .from('payments')
        .select('*')
        .eq('id', paymentId)
        .single();

      if (!payment) {
        return { success: false, error: 'Paiement non trouvé' };
      }

      if (!['held', 'released'].includes(payment.status)) {
        return { success: false, error: 'Ce paiement ne peut pas être remboursé' };
      }

      // Effectuer le remboursement Stripe
      const refundAmount = amount ? Math.round(amount * 100) : undefined;
      const refund = await stripe.refunds.create({
        payment_intent: payment.stripe_payment_intent_id,
        amount: refundAmount,
        reason: 'requested_by_customer',
        metadata: {
          payment_id: paymentId,
          refund_reason: reason,
          refunded_by: refundBy,
        },
      });

      // Mettre à jour le paiement
      const newStatus: PaymentStatus = refundAmount && refundAmount < payment.montant_ttc * 100
        ? payment.status // Remboursement partiel
        : 'refunded';

      await supabase
        .from('payments')
        .update({
          status: newStatus,
          status_history: [
            ...payment.status_history,
            {
              status: newStatus,
              changedAt: new Date().toISOString(),
              changedBy: refundBy,
              reason: `Remboursement: ${reason}${refundAmount ? ` (${refundAmount / 100}€)` : ''}`,
            },
          ],
        })
        .eq('id', paymentId);

      // Notifier les parties
      await this.notifyPaymentRefunded(payment, reason, refundAmount ? refundAmount / 100 : undefined);

      return { success: true };
    } catch (error) {
      console.error('Erreur remboursement:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Crée un paiement d'acompte à la signature
   */
  static async createDepositPayment(
    contractId: string,
    depositPercent: number,
    userId: string
  ): Promise<{ payment: Payment; clientSecret?: string; error?: string }> {
    // Vérifier que l'acompte ne dépasse pas le maximum autorisé
    if (depositPercent > PAYMENT_CONFIG.maxDepositPercent) {
      return {
        payment: null as unknown as Payment,
        error: `L'acompte ne peut pas dépasser ${PAYMENT_CONFIG.maxDepositPercent}% du montant total`,
      };
    }

    // Récupérer le contrat
    const { data: contract } = await supabase
      .from('project_contracts')
      .select('*')
      .eq('id', contractId)
      .single();

    if (!contract) {
      return { payment: null as unknown as Payment, error: 'Contrat non trouvé' };
    }

    const montantHT = contract.montant_total_ht * (depositPercent / 100);

    return this.createPayment(
      {
        contractId,
        paymentType: 'deposit',
        montantHT,
        tauxTVA: contract.taux_tva,
        description: `Acompte ${depositPercent}% à la signature`,
      },
      userId
    );
  }

  /**
   * Vérifie les limites de paiement
   */
  private static async checkPaymentLimits(
    request: PaymentRequest,
    contract: Record<string, unknown>,
    montantTTC: number
  ): Promise<{ valid: boolean; error?: string }> {
    // Vérifier le montant maximum par paiement
    if (montantTTC > PAYMENT_CONFIG.maxSinglePayment) {
      return {
        valid: false,
        error: `Le montant dépasse la limite de ${PAYMENT_CONFIG.maxSinglePayment}€ par paiement`,
      };
    }

    // Vérifier le pourcentage d'acompte
    if (request.paymentType === 'deposit') {
      const depositPercent = (montantTTC / (contract.montant_total_ttc as number)) * 100;
      if (depositPercent > PAYMENT_CONFIG.maxDepositPercent) {
        return {
          valid: false,
          error: `L'acompte ne peut pas dépasser ${PAYMENT_CONFIG.maxDepositPercent}% (${depositPercent.toFixed(1)}% demandé)`,
        };
      }
    }

    // Vérifier le total des paiements
    const { data: existingPayments } = await supabase
      .from('payments')
      .select('montant_ttc')
      .eq('contract_id', request.contractId)
      .in('status', ['held', 'released', 'processing']);

    const totalPaid = existingPayments?.reduce((sum, p) => sum + p.montant_ttc, 0) || 0;
    const contractTotal = contract.montant_total_ttc as number;

    if (totalPaid + montantTTC > contractTotal * 1.05) { // 5% de marge pour ajustements
      return {
        valid: false,
        error: `Le total des paiements (${(totalPaid + montantTTC).toFixed(2)}€) dépasse le montant contractuel (${contractTotal}€)`,
      };
    }

    return { valid: true };
  }

  /**
   * Génère une référence unique
   */
  private static async generateReference(): Promise<string> {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `PAY-${date}-${random}`;
  }

  /**
   * Log un blocage fraude
   */
  private static async logFraudBlock(
    request: PaymentRequest,
    fraudCheck: FraudCheckResult
  ): Promise<void> {
    await supabase.from('fraud_checks_log').insert({
      contract_id: request.contractId,
      milestone_id: request.milestoneId,
      total_score: fraudCheck.totalScore,
      risk_level: fraudCheck.riskLevel,
      rules_triggered: fraudCheck.rulesTriggered,
      details: fraudCheck.details,
      action_taken: 'blocked',
      blocked: true,
    });

    // Notifier les admins
    console.log('🚨 Paiement bloqué pour fraude:', {
      contractId: request.contractId,
      score: fraudCheck.totalScore,
      rules: fraudCheck.rulesTriggered,
    });
  }

  /**
   * Met à jour les statistiques de l'entreprise
   */
  private static async updateEnterpriseStats(
    entrepriseId: string,
    montant: number,
    type: 'received' | 'pending' | 'dispute'
  ): Promise<void> {
    const field = type === 'received' ? 'total_received' :
                  type === 'pending' ? 'total_pending' : 'total_disputes';

    await supabase.rpc('increment_enterprise_stat', {
      p_user_id: entrepriseId,
      p_field: field,
      p_amount: montant,
    });
  }

  /**
   * Notifications
   */
  private static async notifyPaymentCreated(
    payment: Record<string, unknown>,
    contract: Record<string, unknown>
  ): Promise<void> {
    const notification: PaymentNotification = {
      type: 'payment_received',
      recipientId: payment.payer_id as string,
      title: 'Paiement en attente',
      message: `Un paiement de ${(payment.montant_ttc as number).toLocaleString('fr-FR')}€ est en attente pour le projet ${contract.titre}`,
      data: { paymentId: payment.id, contractId: contract.id },
      priority: 'high',
    };
    console.log('📧 Notification:', notification);
    // await NotificationService.send(notification);
  }

  private static async notifyPaymentConfirmed(payment: Record<string, unknown>): Promise<void> {
    console.log('📧 Paiement confirmé:', payment.id);
    // Notifier client et entreprise
  }

  private static async notifyPaymentReleased(payment: Record<string, unknown>): Promise<void> {
    console.log('📧 Paiement libéré:', payment.id);
    // Notifier l'entreprise
  }

  private static async notifyPaymentRefunded(
    payment: Record<string, unknown>,
    reason: string,
    amount?: number
  ): Promise<void> {
    console.log('📧 Paiement remboursé:', payment.id, reason, amount);
    // Notifier les deux parties
  }

  /**
   * Mappe un paiement depuis la base de données
   */
  private static mapPaymentFromDB(row: Record<string, unknown>): Payment {
    return {
      id: row.id as string,
      contractId: row.contract_id as string,
      milestoneId: row.milestone_id as string | undefined,
      reference: row.reference as string,
      paymentType: row.payment_type as PaymentType,
      montantHT: row.montant_ht as number,
      montantTVA: row.montant_tva as number,
      montantTTC: row.montant_ttc as number,
      stripePaymentIntentId: row.stripe_payment_intent_id as string | undefined,
      stripeChargeId: row.stripe_charge_id as string | undefined,
      stripeTransferId: row.stripe_transfer_id as string | undefined,
      providerData: row.provider_data as Record<string, unknown> | undefined,
      payerId: row.payer_id as string,
      payeeId: row.payee_id as string,
      heldUntil: row.held_until ? new Date(row.held_until as string) : undefined,
      escrowReleasedAt: row.escrow_released_at ? new Date(row.escrow_released_at as string) : undefined,
      escrowReleasedBy: row.escrow_released_by as string | undefined,
      status: row.status as PaymentStatus,
      statusHistory: row.status_history as Payment['statusHistory'],
      dueDate: row.due_date ? new Date(row.due_date as string) : undefined,
      paidAt: row.paid_at ? new Date(row.paid_at as string) : undefined,
      releasedAt: row.released_at ? new Date(row.released_at as string) : undefined,
      fraudChecks: row.fraud_checks as FraudCheckResult,
      fraudScore: row.fraud_score as number,
      fraudAlerts: row.fraud_alerts as string[],
      requiresManualReview: row.requires_manual_review as boolean,
      reviewedBy: row.reviewed_by as string | undefined,
      reviewedAt: row.reviewed_at ? new Date(row.reviewed_at as string) : undefined,
      reviewNotes: row.review_notes as string | undefined,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }

  /**
   * Récupère les paiements d'un contrat
   */
  static async getContractPayments(contractId: string): Promise<Payment[]> {
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('contract_id', contractId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return (data || []).map(row => this.mapPaymentFromDB(row));
  }

  /**
   * Récupère les paiements d'un utilisateur (client ou entreprise)
   */
  static async getUserPayments(userId: string): Promise<Payment[]> {
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .or(`payer_id.eq.${userId},payee_id.eq.${userId}`)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(row => this.mapPaymentFromDB(row));
  }
}

export default PaymentService;
