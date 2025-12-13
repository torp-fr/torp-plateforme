/**
 * DisputeService - Gestion des litiges
 * Ouverture, médiation et résolution des litiges
 */

import { supabase } from '@/lib/supabase';
import {
  Dispute,
  DisputeStatus,
  DisputeReason,
  DisputeProof,
  DisputeEvent,
} from '@/types/payment.types';
import { PaymentService } from './payment.service';

// Configuration des délais
const DISPUTE_CONFIG = {
  // Délais de réponse (jours)
  reponseDelai: 7,
  mediationDelai: 14,
  resolutionMaxDelai: 30,

  // Seuils pour escalade automatique
  autoEscalateAfterDays: 21,
  minAmountForMediation: 500,
};

export class DisputeService {
  /**
   * Ouvre un nouveau litige
   */
  static async openDispute(
    openedBy: string,
    params: {
      contractId: string;
      paymentId?: string;
      milestoneId?: string;
      reason: DisputeReason;
      titre: string;
      description: string;
      montantConteste?: number;
      preuves?: Omit<DisputeProof, 'id' | 'dateAjout'>[];
    }
  ): Promise<{ dispute?: Dispute; error?: string }> {
    try {
      // Vérifier le contrat et les droits
      const { data: contract } = await supabase
        .from('project_contracts')
        .select('*')
        .eq('id', params.contractId)
        .single();

      if (!contract) {
        return { error: 'Contrat non trouvé' };
      }

      // Déterminer la partie adverse
      const against = openedBy === contract.client_id
        ? contract.entreprise_id
        : contract.client_id;

      if (openedBy !== contract.client_id && openedBy !== contract.entreprise_id) {
        return { error: 'Vous n\'êtes pas partie à ce contrat' };
      }

      // Vérifier qu'il n'y a pas déjà un litige ouvert pour le même objet
      const existingQuery = supabase
        .from('disputes')
        .select('id')
        .eq('contract_id', params.contractId)
        .in('status', ['opened', 'under_review', 'mediation']);

      if (params.paymentId) {
        existingQuery.eq('payment_id', params.paymentId);
      }
      if (params.milestoneId) {
        existingQuery.eq('milestone_id', params.milestoneId);
      }

      const { data: existingDisputes } = await existingQuery;
      if (existingDisputes && existingDisputes.length > 0) {
        return { error: 'Un litige est déjà en cours pour cet objet' };
      }

      // Générer la référence
      const reference = await this.generateReference();

      // Calculer les délais
      const deadlineReponse = new Date();
      deadlineReponse.setDate(deadlineReponse.getDate() + DISPUTE_CONFIG.reponseDelai);

      const deadlineResolution = new Date();
      deadlineResolution.setDate(deadlineResolution.getDate() + DISPUTE_CONFIG.resolutionMaxDelai);

      // Préparer les preuves avec IDs
      const preuvesDemandeur: DisputeProof[] = (params.preuves || []).map((p, index) => ({
        ...p,
        id: `proof-${Date.now()}-${index}`,
        dateAjout: new Date(),
      }));

      // Créer le litige
      const { data: dispute, error } = await supabase
        .from('disputes')
        .insert({
          reference,
          contract_id: params.contractId,
          payment_id: params.paymentId,
          milestone_id: params.milestoneId,
          opened_by: openedBy,
          against,
          reason: params.reason,
          titre: params.titre,
          description: params.description,
          montant_conteste: params.montantConteste,
          preuves_demandeur: preuvesDemandeur,
          preuves_defendeur: [],
          status: 'opened',
          deadline_reponse: deadlineReponse.toISOString(),
          deadline_resolution: deadlineResolution.toISOString(),
          historique: [{
            id: `event-${Date.now()}`,
            type: 'status_change',
            date: new Date().toISOString(),
            acteur: openedBy,
            description: 'Litige ouvert',
          }],
        })
        .select()
        .single();

      if (error) throw error;

      // Si un paiement est concerné, le mettre en litige
      if (params.paymentId) {
        await supabase
          .from('payments')
          .update({ status: 'disputed' })
          .eq('id', params.paymentId);
      }

      // Mettre le contrat en statut "disputed"
      await supabase
        .from('project_contracts')
        .update({ status: 'disputed' })
        .eq('id', params.contractId);

      // Notifier les parties
      await this.notifyDisputeOpened(dispute, contract);

      return { dispute: this.mapDisputeFromDB(dispute) };
    } catch (error) {
      console.error('Erreur ouverture litige:', error);
      return { error: (error as Error).message };
    }
  }

  /**
   * Répond à un litige (par la partie adverse)
   */
  static async respondToDispute(
    disputeId: string,
    userId: string,
    response: {
      description: string;
      preuves?: Omit<DisputeProof, 'id' | 'dateAjout'>[];
    }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: dispute } = await supabase
        .from('disputes')
        .select('*')
        .eq('id', disputeId)
        .single();

      if (!dispute) {
        return { success: false, error: 'Litige non trouvé' };
      }

      if (dispute.against !== userId) {
        return { success: false, error: 'Vous n\'êtes pas la partie adverse de ce litige' };
      }

      if (dispute.status !== 'opened') {
        return { success: false, error: 'Ce litige n\'est plus en attente de réponse' };
      }

      // Préparer les preuves
      const preuvesDefendeur: DisputeProof[] = (response.preuves || []).map((p, index) => ({
        ...p,
        id: `proof-def-${Date.now()}-${index}`,
        dateAjout: new Date(),
      }));

      // Ajouter l'événement
      const newEvent: DisputeEvent = {
        id: `event-${Date.now()}`,
        type: 'message',
        date: new Date(),
        acteur: userId,
        description: response.description,
      };

      await supabase
        .from('disputes')
        .update({
          status: 'under_review',
          preuves_defendeur: preuvesDefendeur,
          historique: [...dispute.historique, newEvent, {
            id: `event-${Date.now() + 1}`,
            type: 'status_change',
            date: new Date().toISOString(),
            acteur: userId,
            description: 'Réponse du défendeur - En cours d\'examen',
          }],
        })
        .eq('id', disputeId);

      // Notifier le demandeur
      await this.notifyDisputeResponse(dispute);

      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Assigne un médiateur TORP au litige
   */
  static async assignMediator(
    disputeId: string,
    mediatorId: string,
    assignedBy: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: dispute } = await supabase
        .from('disputes')
        .select('*')
        .eq('id', disputeId)
        .single();

      if (!dispute) {
        return { success: false, error: 'Litige non trouvé' };
      }

      // Vérifier le montant minimum pour médiation
      if (dispute.montant_conteste && dispute.montant_conteste < DISPUTE_CONFIG.minAmountForMediation) {
        // Résolution simplifiée pour petits montants
        return { success: false, error: 'Montant trop faible pour une médiation' };
      }

      const newEvent: DisputeEvent = {
        id: `event-${Date.now()}`,
        type: 'assignment',
        date: new Date(),
        acteur: assignedBy,
        description: `Médiateur assigné`,
        data: { mediatorId },
      };

      await supabase
        .from('disputes')
        .update({
          status: 'mediation',
          assigned_to: mediatorId,
          historique: [...dispute.historique, newEvent],
        })
        .eq('id', disputeId);

      // Notifier les parties
      await this.notifyMediatorAssigned(dispute, mediatorId);

      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Résout un litige
   */
  static async resolveDispute(
    disputeId: string,
    resolvedBy: string,
    resolution: {
      type: 'full_refund' | 'partial_refund' | 'work_completion' | 'compromise' | 'dismissed';
      description: string;
      montant?: number;
      inFavorOf: 'client' | 'enterprise';
    }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: dispute } = await supabase
        .from('disputes')
        .select('*, project_contracts(*)')
        .eq('id', disputeId)
        .single();

      if (!dispute) {
        return { success: false, error: 'Litige non trouvé' };
      }

      // Vérifier les droits (médiateur ou admin)
      if (dispute.assigned_to !== resolvedBy) {
        // Vérifier si admin
        const { data: user } = await supabase
          .from('users')
          .select('user_type')
          .eq('id', resolvedBy)
          .single();

        if (!user || !['admin', 'super_admin'].includes(user.user_type)) {
          return { success: false, error: 'Non autorisé à résoudre ce litige' };
        }
      }

      const status: DisputeStatus = resolution.inFavorOf === 'client'
        ? 'resolved_client'
        : 'resolved_enterprise';

      const newEvent: DisputeEvent = {
        id: `event-${Date.now()}`,
        type: 'resolution',
        date: new Date(),
        acteur: resolvedBy,
        description: resolution.description,
        data: {
          type: resolution.type,
          montant: resolution.montant,
          inFavorOf: resolution.inFavorOf,
        },
      };

      await supabase
        .from('disputes')
        .update({
          status,
          resolution_type: resolution.type,
          resolution_description: resolution.description,
          resolution_montant: resolution.montant,
          resolved_at: new Date().toISOString(),
          resolved_by: resolvedBy,
          historique: [...dispute.historique, newEvent],
        })
        .eq('id', disputeId);

      // Appliquer la résolution
      await this.applyResolution(dispute, resolution);

      // Remettre le contrat en statut actif (ou complété)
      await supabase
        .from('project_contracts')
        .update({ status: 'active' })
        .eq('id', dispute.contract_id);

      // Notifier les parties
      await this.notifyDisputeResolved(dispute, resolution);

      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Applique la résolution du litige
   */
  private static async applyResolution(
    dispute: Record<string, unknown>,
    resolution: {
      type: string;
      description: string;
      montant?: number;
      inFavorOf: 'client' | 'enterprise';
    }
  ): Promise<void> {
    const paymentId = dispute.payment_id as string | undefined;

    switch (resolution.type) {
      case 'full_refund':
        if (paymentId) {
          await PaymentService.refundPayment(
            paymentId,
            'system',
            `Litige ${dispute.reference}: Remboursement intégral`
          );
        }
        break;

      case 'partial_refund':
        if (paymentId && resolution.montant) {
          await PaymentService.refundPayment(
            paymentId,
            'system',
            `Litige ${dispute.reference}: Remboursement partiel`,
            resolution.montant
          );
        }
        break;

      case 'work_completion':
        // Remettre le jalon en statut "rejected" pour correction
        if (dispute.milestone_id) {
          await supabase
            .from('payment_milestones')
            .update({
              status: 'rejected',
              rejection_reason: `Litige: ${resolution.description}`,
            })
            .eq('id', dispute.milestone_id);
        }
        break;

      case 'dismissed':
        // Libérer le paiement si en séquestre
        if (paymentId) {
          await PaymentService.releasePayment(paymentId, 'system', true);
        }
        break;

      case 'compromise':
        // Gérer au cas par cas
        break;
    }
  }

  /**
   * Escalade un litige (vers juridique)
   */
  static async escalateDispute(
    disputeId: string,
    escalatedBy: string,
    reason: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: dispute } = await supabase
        .from('disputes')
        .select('*')
        .eq('id', disputeId)
        .single();

      if (!dispute) {
        return { success: false, error: 'Litige non trouvé' };
      }

      const newEvent: DisputeEvent = {
        id: `event-${Date.now()}`,
        type: 'status_change',
        date: new Date(),
        acteur: escalatedBy,
        description: `Escalade juridique: ${reason}`,
      };

      await supabase
        .from('disputes')
        .update({
          status: 'escalated',
          historique: [...dispute.historique, newEvent],
        })
        .eq('id', disputeId);

      // Notifier les admins TORP
      console.log('🚨 LITIGE ESCALADÉ:', disputeId, reason);

      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Ajoute une preuve à un litige
   */
  static async addProof(
    disputeId: string,
    userId: string,
    proof: Omit<DisputeProof, 'id' | 'dateAjout'>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: dispute } = await supabase
        .from('disputes')
        .select('*')
        .eq('id', disputeId)
        .single();

      if (!dispute) {
        return { success: false, error: 'Litige non trouvé' };
      }

      const newProof: DisputeProof = {
        ...proof,
        id: `proof-${Date.now()}`,
        dateAjout: new Date(),
      };

      const isOpener = dispute.opened_by === userId;
      const fieldToUpdate = isOpener ? 'preuves_demandeur' : 'preuves_defendeur';
      const currentProofs = isOpener ? dispute.preuves_demandeur : dispute.preuves_defendeur;

      const newEvent: DisputeEvent = {
        id: `event-${Date.now()}`,
        type: 'proof_added',
        date: new Date(),
        acteur: userId,
        description: `Nouvelle preuve ajoutée: ${proof.nom}`,
      };

      await supabase
        .from('disputes')
        .update({
          [fieldToUpdate]: [...currentProofs, newProof],
          historique: [...dispute.historique, newEvent],
        })
        .eq('id', disputeId);

      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Ajoute un message/commentaire au litige
   */
  static async addMessage(
    disputeId: string,
    userId: string,
    message: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: dispute } = await supabase
        .from('disputes')
        .select('historique, opened_by, against, assigned_to')
        .eq('id', disputeId)
        .single();

      if (!dispute) {
        return { success: false, error: 'Litige non trouvé' };
      }

      // Vérifier que l'utilisateur est partie au litige
      const isParty = [dispute.opened_by, dispute.against, dispute.assigned_to].includes(userId);
      if (!isParty) {
        return { success: false, error: 'Non autorisé' };
      }

      const newEvent: DisputeEvent = {
        id: `event-${Date.now()}`,
        type: 'message',
        date: new Date(),
        acteur: userId,
        description: message,
      };

      await supabase
        .from('disputes')
        .update({
          historique: [...dispute.historique, newEvent],
        })
        .eq('id', disputeId);

      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Génère une référence unique
   */
  private static async generateReference(): Promise<string> {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `LIT-${date}-${random}`;
  }

  /**
   * Récupère les litiges d'un utilisateur
   */
  static async getUserDisputes(userId: string): Promise<Dispute[]> {
    const { data, error } = await supabase
      .from('disputes')
      .select('*')
      .or(`opened_by.eq.${userId},against.eq.${userId},assigned_to.eq.${userId}`)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(row => this.mapDisputeFromDB(row));
  }

  /**
   * Récupère les litiges en attente de médiation
   */
  static async getPendingMediationDisputes(): Promise<Dispute[]> {
    const { data, error } = await supabase
      .from('disputes')
      .select('*')
      .eq('status', 'under_review')
      .is('assigned_to', null)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return (data || []).map(row => this.mapDisputeFromDB(row));
  }

  /**
   * Notifications
   */
  private static async notifyDisputeOpened(
    dispute: Record<string, unknown>,
    contract: Record<string, unknown>
  ): Promise<void> {
    console.log('📧 Litige ouvert - notifications envoyées', {
      disputeId: dispute.id,
      reference: dispute.reference,
    });
  }

  private static async notifyDisputeResponse(dispute: Record<string, unknown>): Promise<void> {
    console.log('📧 Réponse au litige', { disputeId: dispute.id });
  }

  private static async notifyMediatorAssigned(
    dispute: Record<string, unknown>,
    mediatorId: string
  ): Promise<void> {
    console.log('📧 Médiateur assigné', { disputeId: dispute.id, mediatorId });
  }

  private static async notifyDisputeResolved(
    dispute: Record<string, unknown>,
    resolution: Record<string, unknown>
  ): Promise<void> {
    console.log('📧 Litige résolu', { disputeId: dispute.id, resolution });
  }

  /**
   * Mappe un litige depuis la base de données
   */
  private static mapDisputeFromDB(row: Record<string, unknown>): Dispute {
    return {
      id: row.id as string,
      contractId: row.contract_id as string,
      paymentId: row.payment_id as string | undefined,
      milestoneId: row.milestone_id as string | undefined,
      reference: row.reference as string,
      openedBy: row.opened_by as string,
      against: row.against as string,
      reason: row.reason as DisputeReason,
      titre: row.titre as string,
      description: row.description as string,
      montantConteste: row.montant_conteste as number | undefined,
      preuvesDemandeur: row.preuves_demandeur as DisputeProof[],
      preuvesDefendeur: row.preuves_defendeur as DisputeProof[],
      status: row.status as DisputeStatus,
      assignedTo: row.assigned_to as string | undefined,
      resolutionType: row.resolution_type as Dispute['resolutionType'],
      resolutionDescription: row.resolution_description as string | undefined,
      resolutionMontant: row.resolution_montant as number | undefined,
      resolvedAt: row.resolved_at ? new Date(row.resolved_at as string) : undefined,
      resolvedBy: row.resolved_by as string | undefined,
      deadlineReponse: row.deadline_reponse ? new Date(row.deadline_reponse as string) : undefined,
      deadlineResolution: row.deadline_resolution ? new Date(row.deadline_resolution as string) : undefined,
      historique: (row.historique as DisputeEvent[]).map(e => ({
        ...e,
        date: new Date(e.date as unknown as string),
      })),
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }
}

export default DisputeService;
