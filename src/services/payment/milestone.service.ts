/**
 * MilestoneService - Gestion des jalons de paiement
 * Validation, soumission et suivi des jalons
 */

import { supabase } from '@/lib/supabase';
import {
  PaymentMilestone,
  MilestoneStatus,
  MilestoneProof,
  MilestoneVerification,
  PaymentValidation,
  ProjectContract,
} from '@/types/payment.types';
import { PaymentService } from './payment.service';
import { FraudDetectionService } from './fraudDetection.service';

export class MilestoneService {
  /**
   * Crée les jalons pour un contrat basé sur l'échéancier
   */
  static async createMilestonesFromContract(
    contractId: string,
    echeancier: {
      numero: number;
      designation: string;
      pourcentage: number;
      conditions: string[];
      livrables?: string[];
      datePrevue?: Date;
    }[]
  ): Promise<PaymentMilestone[]> {
    // Récupérer le contrat
    const { data: contract } = await supabase
      .from('project_contracts')
      .select('*')
      .eq('id', contractId)
      .single();

    if (!contract) {
      throw new Error('Contrat non trouvé');
    }

    const milestones: PaymentMilestone[] = [];

    for (const echeance of echeancier) {
      const montantHT = contract.montant_total_ht * (echeance.pourcentage / 100);
      const montantTTC = contract.montant_total_ttc * (echeance.pourcentage / 100);

      const { data: milestone, error } = await supabase
        .from('payment_milestones')
        .insert({
          contract_id: contractId,
          numero: echeance.numero,
          designation: echeance.designation,
          montant_ht: montantHT,
          montant_ttc: montantTTC,
          pourcentage_contrat: echeance.pourcentage,
          date_prevue: echeance.datePrevue?.toISOString(),
          conditions_declenchement: echeance.conditions,
          livrables_attendus: echeance.livrables || [],
          status: 'pending',
          preuves: [],
          verification_auto: {},
          fraud_risk_level: 'low',
        })
        .select()
        .single();

      if (error) throw error;
      milestones.push(this.mapMilestoneFromDB(milestone));
    }

    return milestones;
  }

  /**
   * Soumet un jalon pour validation (par l'entreprise)
   */
  static async submitMilestone(
    milestoneId: string,
    preuves: Omit<MilestoneProof, 'id' | 'verifie'>[],
    compteRendu: string,
    userId: string
  ): Promise<{ success: boolean; milestone?: PaymentMilestone; error?: string }> {
    try {
      // Vérifier le jalon
      const { data: milestone, error: fetchError } = await supabase
        .from('payment_milestones')
        .select('*, project_contracts(*)')
        .eq('id', milestoneId)
        .single();

      if (fetchError || !milestone) {
        return { success: false, error: 'Jalon non trouvé' };
      }

      // Vérifier les droits (seule l'entreprise peut soumettre)
      if (milestone.project_contracts.entreprise_id !== userId) {
        return { success: false, error: 'Accès non autorisé' };
      }

      // Vérifier le statut
      if (!['pending', 'in_progress', 'rejected'].includes(milestone.status)) {
        return { success: false, error: 'Ce jalon ne peut pas être soumis' };
      }

      // Préparer les preuves avec IDs
      const preuvesAvecIds: MilestoneProof[] = preuves.map((p, index) => ({
        ...p,
        id: `proof-${milestoneId}-${index}-${Date.now()}`,
        verifie: false,
      }));

      // Effectuer les vérifications automatiques
      const verification = await this.runAutomaticVerifications(
        milestone,
        preuvesAvecIds,
        milestone.project_contracts
      );

      // Mettre à jour le jalon
      const { data: updatedMilestone, error: updateError } = await supabase
        .from('payment_milestones')
        .update({
          status: 'submitted',
          preuves: preuvesAvecIds,
          compte_rendu: compteRendu,
          date_soumission: new Date().toISOString(),
          verification_auto: verification,
          fraud_risk_level: verification.score >= 50 ? 'high' :
                           verification.score >= 25 ? 'medium' : 'low',
        })
        .eq('id', milestoneId)
        .select()
        .single();

      if (updateError) throw updateError;

      // Notifier le client
      await this.notifyClientMilestoneSubmitted(milestone, milestone.project_contracts);

      return {
        success: true,
        milestone: this.mapMilestoneFromDB(updatedMilestone),
      };
    } catch (error) {
      console.error('Erreur soumission jalon:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Valide un jalon (par le client)
   */
  static async validateMilestone(
    validation: PaymentValidation,
    userId: string
  ): Promise<{ success: boolean; milestone?: PaymentMilestone; paymentCreated?: boolean; error?: string }> {
    try {
      // Récupérer le jalon
      const { data: milestone } = await supabase
        .from('payment_milestones')
        .select('*, project_contracts(*)')
        .eq('id', validation.milestoneId)
        .single();

      if (!milestone) {
        return { success: false, error: 'Jalon non trouvé' };
      }

      // Vérifier les droits (seul le client peut valider)
      if (milestone.project_contracts.client_id !== userId) {
        return { success: false, error: 'Accès non autorisé' };
      }

      // Vérifier le statut
      if (milestone.status !== 'submitted') {
        return { success: false, error: 'Ce jalon n\'est pas en attente de validation' };
      }

      if (validation.approved) {
        // Valider le jalon
        const { data: updatedMilestone, error } = await supabase
          .from('payment_milestones')
          .update({
            status: 'validated',
            date_validation: new Date().toISOString(),
            validated_by: userId,
          })
          .eq('id', validation.milestoneId)
          .select()
          .single();

        if (error) throw error;

        // Créer automatiquement le paiement
        const paymentResult = await PaymentService.createPayment(
          {
            contractId: milestone.project_contracts.id,
            milestoneId: validation.milestoneId,
            paymentType: 'milestone',
            montantHT: milestone.montant_ht,
            tauxTVA: milestone.project_contracts.taux_tva,
            description: `Jalon ${milestone.numero}: ${milestone.designation}`,
          },
          userId
        );

        // Notifier l'entreprise
        await this.notifyEnterpriseMilestoneValidated(milestone, milestone.project_contracts);

        return {
          success: true,
          milestone: this.mapMilestoneFromDB(updatedMilestone),
          paymentCreated: !paymentResult.error,
        };
      } else {
        // Rejeter le jalon
        const { data: updatedMilestone, error } = await supabase
          .from('payment_milestones')
          .update({
            status: 'rejected',
            rejection_reason: validation.rejectionReason,
          })
          .eq('id', validation.milestoneId)
          .select()
          .single();

        if (error) throw error;

        // Notifier l'entreprise
        await this.notifyEnterpriseMilestoneRejected(
          milestone,
          milestone.project_contracts,
          validation.rejectionReason || ''
        );

        return {
          success: true,
          milestone: this.mapMilestoneFromDB(updatedMilestone),
          paymentCreated: false,
        };
      }
    } catch (error) {
      console.error('Erreur validation jalon:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Ajoute une preuve à un jalon
   */
  static async addProof(
    milestoneId: string,
    proof: Omit<MilestoneProof, 'id' | 'verifie'>,
    userId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: milestone } = await supabase
        .from('payment_milestones')
        .select('preuves, project_contracts!inner(entreprise_id)')
        .eq('id', milestoneId)
        .single();

      if (!milestone) {
        return { success: false, error: 'Jalon non trouvé' };
      }

      if (milestone.project_contracts.entreprise_id !== userId) {
        return { success: false, error: 'Accès non autorisé' };
      }

      const newProof: MilestoneProof = {
        ...proof,
        id: `proof-${milestoneId}-${Date.now()}`,
        verifie: false,
      };

      const updatedProofs = [...(milestone.preuves || []), newProof];

      await supabase
        .from('payment_milestones')
        .update({ preuves: updatedProofs })
        .eq('id', milestoneId);

      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Passe un jalon en "en cours"
   */
  static async startMilestone(
    milestoneId: string,
    userId: string
  ): Promise<{ success: boolean; error?: string }> {
    const { data: milestone } = await supabase
      .from('payment_milestones')
      .select('status, project_contracts!inner(entreprise_id)')
      .eq('id', milestoneId)
      .single();

    if (!milestone) {
      return { success: false, error: 'Jalon non trouvé' };
    }

    if (milestone.project_contracts.entreprise_id !== userId) {
      return { success: false, error: 'Accès non autorisé' };
    }

    if (milestone.status !== 'pending') {
      return { success: false, error: 'Ce jalon a déjà été démarré' };
    }

    await supabase
      .from('payment_milestones')
      .update({ status: 'in_progress' })
      .eq('id', milestoneId);

    return { success: true };
  }

  /**
   * Exécute les vérifications automatiques
   */
  private static async runAutomaticVerifications(
    milestone: Record<string, unknown>,
    preuves: MilestoneProof[],
    contract: Record<string, unknown>
  ): Promise<MilestoneVerification> {
    const alertes: string[] = [];
    let score = 0;

    // Vérifier le nombre de preuves
    const photos = preuves.filter(p => p.type === 'photo');
    const documents = preuves.filter(p => ['document', 'bon_commande', 'facture', 'pv'].includes(p.type));

    if (photos.length < 2 && (milestone.montant_ttc as number) > 3000) {
      alertes.push('Nombre de photos insuffisant pour ce montant');
      score += 15;
    }

    if (documents.length === 0 && (milestone.montant_ttc as number) > 5000) {
      alertes.push('Aucun document justificatif fourni');
      score += 20;
    }

    // Vérifier les métadonnées des photos
    const photosWithGeo = photos.filter(p => p.metadata?.geolocation).length;
    if (photos.length > 0 && photosWithGeo < photos.length / 2) {
      alertes.push('Plusieurs photos sans géolocalisation');
      score += 10;
    }

    // Vérifier le respect des délais
    const datePrevue = milestone.date_prevue ? new Date(milestone.date_prevue as string) : null;
    if (datePrevue && new Date() > datePrevue) {
      const joursRetard = Math.floor((Date.now() - datePrevue.getTime()) / (1000 * 60 * 60 * 24));
      if (joursRetard > 0) {
        alertes.push(`Soumission avec ${joursRetard} jour(s) de retard`);
        // Pas d'impact sur le score pour un simple retard
      }
    } else if (datePrevue) {
      const joursAvance = Math.floor((datePrevue.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      if (joursAvance > 14) {
        alertes.push(`Soumission ${joursAvance} jours avant la date prévue`);
        score += 10;
      }
    }

    // Vérifier la cohérence du compte-rendu
    const compteRendu = milestone.compte_rendu as string;
    if (!compteRendu || compteRendu.length < 50) {
      alertes.push('Compte-rendu trop succinct');
      score += 5;
    }

    return {
      dateVerification: new Date(),
      photosAnalysees: photos.length > 0,
      coherenceVerifiee: true,
      delaiRespected: !datePrevue || new Date() <= new Date(datePrevue.getTime() + 7 * 24 * 60 * 60 * 1000),
      alertes,
      score,
    };
  }

  /**
   * Récupère les jalons d'un contrat
   */
  static async getContractMilestones(contractId: string): Promise<PaymentMilestone[]> {
    const { data, error } = await supabase
      .from('payment_milestones')
      .select('*')
      .eq('contract_id', contractId)
      .order('numero', { ascending: true });

    if (error) throw error;
    return (data || []).map(row => this.mapMilestoneFromDB(row));
  }

  /**
   * Récupère un jalon par ID
   */
  static async getMilestoneById(milestoneId: string): Promise<PaymentMilestone | null> {
    const { data, error } = await supabase
      .from('payment_milestones')
      .select('*')
      .eq('id', milestoneId)
      .single();

    if (error || !data) return null;
    return this.mapMilestoneFromDB(data);
  }

  /**
   * Récupère les jalons en attente de validation pour un client
   */
  static async getPendingValidationMilestones(clientId: string): Promise<PaymentMilestone[]> {
    const { data, error } = await supabase
      .from('payment_milestones')
      .select('*, project_contracts!inner(*)')
      .eq('project_contracts.client_id', clientId)
      .eq('status', 'submitted')
      .order('date_soumission', { ascending: true });

    if (error) throw error;
    return (data || []).map(row => this.mapMilestoneFromDB(row));
  }

  /**
   * Notifications
   */
  private static async notifyClientMilestoneSubmitted(
    milestone: Record<string, unknown>,
    contract: Record<string, unknown>
  ): Promise<void> {
    console.log('📧 Notification client: jalon soumis', {
      milestoneId: milestone.id,
      contractId: contract.id,
      clientId: contract.client_id,
    });
    // TODO: Envoyer notification réelle
  }

  private static async notifyEnterpriseMilestoneValidated(
    milestone: Record<string, unknown>,
    contract: Record<string, unknown>
  ): Promise<void> {
    console.log('📧 Notification entreprise: jalon validé', {
      milestoneId: milestone.id,
      entrepriseId: contract.entreprise_id,
    });
  }

  private static async notifyEnterpriseMilestoneRejected(
    milestone: Record<string, unknown>,
    contract: Record<string, unknown>,
    reason: string
  ): Promise<void> {
    console.log('📧 Notification entreprise: jalon rejeté', {
      milestoneId: milestone.id,
      entrepriseId: contract.entreprise_id,
      reason,
    });
  }

  /**
   * Mappe un jalon depuis la base de données
   */
  private static mapMilestoneFromDB(row: Record<string, unknown>): PaymentMilestone {
    return {
      id: row.id as string,
      contractId: row.contract_id as string,
      numero: row.numero as number,
      designation: row.designation as string,
      description: row.description as string | undefined,
      montantHT: row.montant_ht as number,
      montantTTC: row.montant_ttc as number,
      pourcentageContrat: row.pourcentage_contrat as number,
      datePrevue: row.date_prevue ? new Date(row.date_prevue as string) : undefined,
      dateSoumission: row.date_soumission ? new Date(row.date_soumission as string) : undefined,
      dateValidation: row.date_validation ? new Date(row.date_validation as string) : undefined,
      datePaiement: row.date_paiement ? new Date(row.date_paiement as string) : undefined,
      conditionsDeclenchement: row.conditions_declenchement as string[],
      livrablesAttendus: row.livrables_attendus as string[],
      status: row.status as MilestoneStatus,
      validatedBy: row.validated_by as string | undefined,
      rejectionReason: row.rejection_reason as string | undefined,
      preuves: row.preuves as MilestoneProof[],
      compteRendu: row.compte_rendu as string | undefined,
      verificationAuto: row.verification_auto as MilestoneVerification,
      fraudCheckResult: row.fraud_check_result as PaymentMilestone['fraudCheckResult'],
      fraudRiskLevel: row.fraud_risk_level as PaymentMilestone['fraudRiskLevel'],
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }
}

export default MilestoneService;
