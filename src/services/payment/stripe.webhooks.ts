/**
 * Stripe Webhooks Handler
 * Gestion des événements Stripe pour mise à jour en temps réel
 */

import Stripe from 'stripe';
import { supabase } from '@/lib/supabase';
import { notificationService } from '@/services/notifications/notification.service';
import { emailService } from '@/services/email/email.service';

const stripe = new Stripe(import.meta.env.VITE_STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
});

const WEBHOOK_SECRET = import.meta.env.VITE_STRIPE_WEBHOOK_SECRET || '';

// =====================================================
// TYPES
// =====================================================

export interface WebhookResult {
  success: boolean;
  message?: string;
  error?: string;
}

type PaymentStatus = 'pending' | 'processing' | 'held' | 'released' | 'refunded' | 'failed' | 'cancelled';

// =====================================================
// WEBHOOK HANDLER
// =====================================================

export class StripeWebhookService {
  /**
   * Vérifie et parse un événement webhook Stripe
   */
  static verifyWebhook(
    payload: string | Buffer,
    signature: string
  ): Stripe.Event | null {
    if (!WEBHOOK_SECRET) {
      console.error('[StripeWebhook] Webhook secret non configuré');
      return null;
    }

    try {
      return stripe.webhooks.constructEvent(payload, signature, WEBHOOK_SECRET);
    } catch (error) {
      console.error('[StripeWebhook] Signature invalide:', error);
      return null;
    }
  }

  /**
   * Traite un événement webhook Stripe
   */
  static async handleWebhook(event: Stripe.Event): Promise<WebhookResult> {
    console.log(`[StripeWebhook] Événement reçu: ${event.type}`);

    try {
      switch (event.type) {
        // ===== PAIEMENTS =====
        case 'payment_intent.succeeded':
          return this.handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);

        case 'payment_intent.payment_failed':
          return this.handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);

        case 'payment_intent.canceled':
          return this.handlePaymentIntentCanceled(event.data.object as Stripe.PaymentIntent);

        case 'charge.refunded':
          return this.handleChargeRefunded(event.data.object as Stripe.Charge);

        case 'charge.dispute.created':
          return this.handleDisputeCreated(event.data.object as Stripe.Dispute);

        case 'charge.dispute.closed':
          return this.handleDisputeClosed(event.data.object as Stripe.Dispute);

        // ===== CONNECT (ENTREPRISES) =====
        case 'account.updated':
          return this.handleAccountUpdated(event.data.object as Stripe.Account);

        case 'account.application.authorized':
          return this.handleAccountAuthorized(event.data.object as Stripe.Application);

        case 'account.application.deauthorized':
          return this.handleAccountDeauthorized(event.data.object as Stripe.Application);

        case 'capability.updated':
          return this.handleCapabilityUpdated(event.data.object as Stripe.Capability);

        // ===== TRANSFERTS =====
        case 'transfer.created':
          return this.handleTransferCreated(event.data.object as Stripe.Transfer);

        case 'transfer.failed':
          return this.handleTransferFailed(event.data.object as Stripe.Transfer);

        case 'payout.paid':
          return this.handlePayoutPaid(event.data.object as Stripe.Payout);

        case 'payout.failed':
          return this.handlePayoutFailed(event.data.object as Stripe.Payout);

        default:
          console.log(`[StripeWebhook] Événement non géré: ${event.type}`);
          return { success: true, message: 'Événement non géré' };
      }
    } catch (error) {
      console.error(`[StripeWebhook] Erreur traitement ${event.type}:`, error);
      return { success: false, error: (error as Error).message };
    }
  }

  // =====================================================
  // HANDLERS PAIEMENTS
  // =====================================================

  private static async handlePaymentIntentSucceeded(
    paymentIntent: Stripe.PaymentIntent
  ): Promise<WebhookResult> {
    const paymentId = paymentIntent.metadata.payment_id;
    if (!paymentId) {
      return { success: true, message: 'Pas de payment_id en metadata' };
    }

    // Récupérer le paiement
    const { data: payment, error } = await supabase
      .from('payments')
      .select('*, project_contracts(*)')
      .eq('stripe_payment_intent_id', paymentIntent.id)
      .single();

    if (error || !payment) {
      console.error('[StripeWebhook] Paiement non trouvé:', paymentIntent.id);
      return { success: false, error: 'Paiement non trouvé' };
    }

    // Si capture_method = manual, le paiement passe en "held" (séquestre)
    // Si auto, il passe directement en "released"
    const newStatus: PaymentStatus = paymentIntent.capture_method === 'manual'
      ? 'held'
      : 'released';

    const heldUntil = new Date();
    heldUntil.setDate(heldUntil.getDate() + 7); // 7 jours de séquestre

    // Mettre à jour le paiement
    await supabase
      .from('payments')
      .update({
        status: newStatus,
        paid_at: new Date().toISOString(),
        held_until: newStatus === 'held' ? heldUntil.toISOString() : null,
        stripe_charge_id: paymentIntent.latest_charge as string,
        status_history: [
          ...payment.status_history,
          {
            status: newStatus,
            changedAt: new Date().toISOString(),
            reason: 'Paiement réussi via Stripe',
          },
        ],
      })
      .eq('id', payment.id);

    // Notifier les parties
    await this.notifyPaymentSuccess(payment);

    return { success: true, message: `Paiement mis à jour: ${newStatus}` };
  }

  private static async handlePaymentIntentFailed(
    paymentIntent: Stripe.PaymentIntent
  ): Promise<WebhookResult> {
    const { data: payment } = await supabase
      .from('payments')
      .select('*')
      .eq('stripe_payment_intent_id', paymentIntent.id)
      .single();

    if (!payment) {
      return { success: true, message: 'Paiement non trouvé' };
    }

    const failureMessage = paymentIntent.last_payment_error?.message || 'Échec du paiement';

    await supabase
      .from('payments')
      .update({
        status: 'failed',
        status_history: [
          ...payment.status_history,
          {
            status: 'failed',
            changedAt: new Date().toISOString(),
            reason: failureMessage,
          },
        ],
      })
      .eq('id', payment.id);

    // Notifier le client
    await this.notifyPaymentFailed(payment, failureMessage);

    return { success: true, message: 'Paiement marqué comme échoué' };
  }

  private static async handlePaymentIntentCanceled(
    paymentIntent: Stripe.PaymentIntent
  ): Promise<WebhookResult> {
    const { data: payment } = await supabase
      .from('payments')
      .select('*')
      .eq('stripe_payment_intent_id', paymentIntent.id)
      .single();

    if (!payment) {
      return { success: true, message: 'Paiement non trouvé' };
    }

    await supabase
      .from('payments')
      .update({
        status: 'cancelled',
        status_history: [
          ...payment.status_history,
          {
            status: 'cancelled',
            changedAt: new Date().toISOString(),
            reason: 'Paiement annulé',
          },
        ],
      })
      .eq('id', payment.id);

    return { success: true, message: 'Paiement annulé' };
  }

  private static async handleChargeRefunded(
    charge: Stripe.Charge
  ): Promise<WebhookResult> {
    const paymentIntentId = charge.payment_intent as string;

    const { data: payment } = await supabase
      .from('payments')
      .select('*')
      .eq('stripe_payment_intent_id', paymentIntentId)
      .single();

    if (!payment) {
      return { success: true, message: 'Paiement non trouvé' };
    }

    const isFullRefund = charge.amount_refunded === charge.amount;

    await supabase
      .from('payments')
      .update({
        status: isFullRefund ? 'refunded' : payment.status,
        refunded_amount: charge.amount_refunded / 100,
        status_history: [
          ...payment.status_history,
          {
            status: isFullRefund ? 'refunded' : 'partial_refund',
            changedAt: new Date().toISOString(),
            reason: `Remboursement: ${charge.amount_refunded / 100}€`,
          },
        ],
      })
      .eq('id', payment.id);

    return { success: true, message: 'Remboursement enregistré' };
  }

  private static async handleDisputeCreated(
    dispute: Stripe.Dispute
  ): Promise<WebhookResult> {
    const chargeId = dispute.charge as string;

    const { data: payment } = await supabase
      .from('payments')
      .select('*')
      .eq('stripe_charge_id', chargeId)
      .single();

    if (!payment) {
      return { success: true, message: 'Paiement non trouvé' };
    }

    // Créer un litige dans notre système
    await supabase.from('disputes').insert({
      payment_id: payment.id,
      contract_id: payment.contract_id,
      stripe_dispute_id: dispute.id,
      amount: dispute.amount / 100,
      reason: dispute.reason,
      status: 'opened',
      evidence_due_by: new Date(dispute.evidence_details?.due_by || Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });

    // Notifier
    console.log('🚨 Litige Stripe créé:', dispute.id);

    return { success: true, message: 'Litige créé' };
  }

  private static async handleDisputeClosed(
    dispute: Stripe.Dispute
  ): Promise<WebhookResult> {
    await supabase
      .from('disputes')
      .update({
        status: dispute.status === 'won' ? 'won' : 'lost',
        closed_at: new Date().toISOString(),
      })
      .eq('stripe_dispute_id', dispute.id);

    return { success: true, message: 'Litige fermé' };
  }

  // =====================================================
  // HANDLERS CONNECT
  // =====================================================

  private static async handleAccountUpdated(
    account: Stripe.Account
  ): Promise<WebhookResult> {
    // Mettre à jour les capacités de l'entreprise
    await supabase
      .from('enterprise_payment_accounts')
      .update({
        stripe_charges_enabled: account.charges_enabled,
        stripe_payouts_enabled: account.payouts_enabled,
        stripe_details_submitted: account.details_submitted,
        stripe_capabilities: account.capabilities,
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_account_id', account.id);

    console.log(`[StripeWebhook] Compte mis à jour: ${account.id}, charges=${account.charges_enabled}`);

    return { success: true, message: 'Compte entreprise mis à jour' };
  }

  private static async handleAccountAuthorized(
    application: Stripe.Application
  ): Promise<WebhookResult> {
    console.log(`[StripeWebhook] Application autorisée: ${application.id}`);
    return { success: true };
  }

  private static async handleAccountDeauthorized(
    application: Stripe.Application
  ): Promise<WebhookResult> {
    console.log(`[StripeWebhook] Application désautorisée: ${application.id}`);

    // Désactiver le compte
    await supabase
      .from('enterprise_payment_accounts')
      .update({
        stripe_charges_enabled: false,
        stripe_payouts_enabled: false,
        deauthorized_at: new Date().toISOString(),
      })
      .eq('stripe_application_id', application.id);

    return { success: true };
  }

  private static async handleCapabilityUpdated(
    capability: Stripe.Capability
  ): Promise<WebhookResult> {
    const accountId = capability.account as string;

    console.log(`[StripeWebhook] Capacité ${capability.id} mise à jour: ${capability.status}`);

    // Mettre à jour si c'est la capacité transfers ou card_payments
    if (capability.id === 'transfers' || capability.id === 'card_payments') {
      const field = capability.id === 'transfers' ? 'stripe_payouts_enabled' : 'stripe_charges_enabled';
      await supabase
        .from('enterprise_payment_accounts')
        .update({
          [field]: capability.status === 'active',
          updated_at: new Date().toISOString(),
        })
        .eq('stripe_account_id', accountId);
    }

    return { success: true };
  }

  // =====================================================
  // HANDLERS TRANSFERTS
  // =====================================================

  private static async handleTransferCreated(
    transfer: Stripe.Transfer
  ): Promise<WebhookResult> {
    const paymentId = transfer.metadata?.payment_id;
    if (paymentId) {
      await supabase
        .from('payments')
        .update({
          stripe_transfer_id: transfer.id,
        })
        .eq('id', paymentId);
    }

    console.log(`[StripeWebhook] Transfert créé: ${transfer.id} -> ${transfer.destination}`);
    return { success: true };
  }

  private static async handleTransferFailed(
    transfer: Stripe.Transfer
  ): Promise<WebhookResult> {
    console.error(`[StripeWebhook] Transfert échoué: ${transfer.id}`);
    // Notifier les admins
    return { success: true };
  }

  private static async handlePayoutPaid(
    payout: Stripe.Payout
  ): Promise<WebhookResult> {
    console.log(`[StripeWebhook] Payout réussi: ${payout.id}, ${payout.amount / 100}€`);

    // Mettre à jour les stats de l'entreprise
    const accountId = payout.destination as string;
    const { data: account } = await supabase
      .from('enterprise_payment_accounts')
      .select('user_id')
      .eq('stripe_account_id', accountId)
      .single();

    if (account) {
      // Log du payout
      await supabase.from('enterprise_payouts').insert({
        user_id: account.user_id,
        stripe_payout_id: payout.id,
        amount: payout.amount / 100,
        arrival_date: new Date(payout.arrival_date * 1000).toISOString(),
        status: 'paid',
      });
    }

    return { success: true };
  }

  private static async handlePayoutFailed(
    payout: Stripe.Payout
  ): Promise<WebhookResult> {
    console.error(`[StripeWebhook] Payout échoué: ${payout.id}`);

    const accountId = payout.destination as string;
    const { data: account } = await supabase
      .from('enterprise_payment_accounts')
      .select('user_id')
      .eq('stripe_account_id', accountId)
      .single();

    if (account) {
      await supabase.from('enterprise_payouts').insert({
        user_id: account.user_id,
        stripe_payout_id: payout.id,
        amount: payout.amount / 100,
        status: 'failed',
        failure_message: payout.failure_message,
      });
    }

    return { success: true };
  }

  // =====================================================
  // NOTIFICATIONS
  // =====================================================

  private static async notifyPaymentSuccess(payment: any): Promise<void> {
    try {
      // Récupérer les infos utilisateur
      const { data: payer } = await supabase
        .from('users')
        .select('id, email, name')
        .eq('id', payment.payer_id)
        .single();

      const { data: payee } = await supabase
        .from('users')
        .select('id, email, name')
        .eq('id', payment.payee_id)
        .single();

      if (payer) {
        await emailService.sendPaymentReleased({
          to: payer.email,
          userName: payer.name,
          projectName: payment.project_contracts?.titre || 'Projet',
          montant: payment.montant_ttc,
          entrepriseName: payee?.name || 'Entreprise',
        });
      }
    } catch (error) {
      console.error('[StripeWebhook] Erreur notification:', error);
    }
  }

  private static async notifyPaymentFailed(payment: any, reason: string): Promise<void> {
    try {
      const { data: payer } = await supabase
        .from('users')
        .select('id, email, name')
        .eq('id', payment.payer_id)
        .single();

      if (payer) {
        await notificationService.create({
          userId: payer.id,
          type: 'general',
          title: 'Échec du paiement',
          message: `Le paiement de ${payment.montant_ttc.toLocaleString('fr-FR')}€ a échoué: ${reason}`,
          data: { paymentId: payment.id },
          sendEmail: true,
          emailParams: { to: payer.email, userName: payer.name },
        });
      }
    } catch (error) {
      console.error('[StripeWebhook] Erreur notification:', error);
    }
  }
}

export default StripeWebhookService;
