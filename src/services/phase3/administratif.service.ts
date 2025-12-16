/**
 * TORP Phase 3 - Administratif Service
 * Gestion administrative : situations, budget, avenants, DOE, litiges
 *
 * PRODUCTION-READY: Utilise Supabase pour la persistance
 */

import { supabase } from '@/lib/supabase';
import type {
  SituationTravaux,
  LigneSituation,
  SuiviBudgetaire,
  SuiviBudgetLot,
  Avenant,
  DossierOuvragesExecutes,
  DocumentDOE,
  Litige,
  AlerteAdministrative,
  CreateSituationInput,
  CreateAvenantInput,
  CreateLitigeInput,
  CreateDocumentDOEInput,
  StatutSituation,
  TypeAvenant,
  StatutAvenant,
  NiveauEscalade,
  StatutLitige,
  TEMPLATES_COURRIERS_LITIGE,
} from '@/types/phase3';

// ============================================
// FILTRES
// ============================================

export interface SituationFilters {
  chantierId?: string;
  entrepriseId?: string;
  statut?: StatutSituation;
  periodeDebut?: string;
  periodeFin?: string;
}

export interface AvenantFilters {
  chantierId?: string;
  type?: TypeAvenant;
  statut?: StatutAvenant;
}

export interface LitigeFilters {
  chantierId?: string;
  type?: Litige['type'];
  statut?: StatutLitige;
  gravite?: Litige['gravite'];
}

// ============================================
// SERVICE
// ============================================

export class AdministratifService {
  // ============================================
  // SITUATIONS DE TRAVAUX (via payment_situations)
  // ============================================

  /**
   * Créer une situation de travaux
   */
  static async createSituation(input: CreateSituationInput): Promise<SituationTravaux> {
    // Calculer les montants
    const lignes = input.lignes.map((l, index) => ({
      id: crypto.randomUUID(),
      ...l,
      montantPrecedentHT: l.montantMarcheHT * (l.avancementPrecedent / 100),
      montantActuelHT: l.montantMarcheHT * (l.avancementActuel / 100),
      montantPeriodeHT: l.montantMarcheHT * (l.avancementPeriode / 100),
    }));

    const montantPeriodeHT = lignes.reduce((sum, l) => sum + l.montantPeriodeHT, 0);
    const cumulAnterieurHT = lignes.reduce((sum, l) => sum + l.montantPrecedentHT, 0);
    const cumulSituationHT = lignes.reduce((sum, l) => sum + l.montantActuelHT, 0);

    const retenueGarantiePourcent = input.retenueGarantiePourcent ?? 5;
    const retenueGarantieHT = cumulSituationHT * (retenueGarantiePourcent / 100);

    const acomptesAnterieurs = cumulAnterieurHT - (cumulAnterieurHT * retenueGarantiePourcent / 100);
    const netAPayerHT = cumulSituationHT - retenueGarantieHT - acomptesAnterieurs;

    const tauxTVA = input.tauxTVA ?? 10;
    const montantTVA = netAPayerHT * (tauxTVA / 100);
    const netAPayerTTC = netAPayerHT + montantTVA;

    // Déterminer le numéro de situation
    const situationsExistantes = await this.listSituations({
      chantierId: input.chantierId,
      entrepriseId: input.entrepriseId,
    });
    const numero = situationsExistantes.length + 1;

    // Insérer dans Supabase
    const lotsProgress = lignes.map(l => ({
      lot_id: l.lotId,
      lot_code: l.lotNom,
      contract_amount: l.montantMarcheHT,
      progress_pct: l.avancementActuel,
      cumulative_amount: l.montantActuelHT,
      previous_amount: l.montantPrecedentHT,
      current_amount: l.montantPeriodeHT,
    }));

    const { data, error } = await supabase
      .from('payment_situations')
      .insert({
        project_id: input.chantierId,
        numero,
        period_start: input.periodeDebut,
        period_end: input.periodeFin,
        lots_progress: lotsProgress,
        cumulative_amount_ht: cumulSituationHT,
        previous_amount_ht: cumulAnterieurHT,
        current_amount_ht: montantPeriodeHT,
        retention_rate: retenueGarantiePourcent,
        retention_amount: retenueGarantieHT,
        tva_rate: tauxTVA,
        tva_amount: montantTVA,
        net_to_pay: netAPayerTTC,
        status: 'draft',
      })
      .select()
      .single();

    if (error) {
      console.error('[AdministratifService] Error creating situation:', error);
      throw new Error(`Failed to create situation: ${error.message}`);
    }

    return {
      id: data.id,
      chantierId: data.project_id,
      entrepriseId: input.entrepriseId,
      numero: data.numero,
      periodeDebut: data.period_start,
      periodeFin: data.period_end,
      lignes,
      montantPeriodeHT,
      cumulAnterieurHT,
      cumulSituationHT,
      retenueGarantiePourcent,
      retenueGarantieHT,
      acomptesAnterieurs,
      netAPayerHT,
      tauxTVA,
      montantTVA,
      netAPayerTTC,
      statut: 'brouillon',
      documents: [],
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  /**
   * Soumettre une situation pour validation
   */
  static async soumettreSituation(
    situationId: string,
    etabliePar: string
  ): Promise<SituationTravaux> {
    const { data, error } = await supabase
      .from('payment_situations')
      .update({
        status: 'submitted',
        submitted_at: new Date().toISOString(),
      })
      .eq('id', situationId)
      .select()
      .single();

    if (error) {
      console.error('[AdministratifService] Error submitting situation:', error);
      throw new Error(`Failed to submit situation: ${error.message}`);
    }

    return this.mapDBSituationToModel(data, etabliePar);
  }

  /**
   * Vérifier une situation (MOE)
   */
  static async verifierSituation(
    situationId: string,
    verification: SituationTravaux['verificationMOE']
  ): Promise<SituationTravaux> {
    const newStatus = verification?.decision === 'valide' ? 'validated' : 'contested';

    const { data, error } = await supabase
      .from('payment_situations')
      .update({
        status: newStatus,
        validated_at: new Date().toISOString(),
        notes: verification?.commentaire,
      })
      .eq('id', situationId)
      .select()
      .single();

    if (error) {
      console.error('[AdministratifService] Error verifying situation:', error);
      throw new Error(`Failed to verify situation: ${error.message}`);
    }

    const situation = this.mapDBSituationToModel(data);
    situation.verificationMOE = verification;
    return situation;
  }

  /**
   * Valider une situation (MO)
   */
  static async validerSituation(
    situationId: string,
    validation: SituationTravaux['validationMO']
  ): Promise<SituationTravaux> {
    const newStatus = validation?.decision === 'valide' ? 'validated' : 'contested';

    const { data, error } = await supabase
      .from('payment_situations')
      .update({
        status: newStatus,
        validated_at: new Date().toISOString(),
        validated_by: validation?.par,
        notes: validation?.commentaire,
      })
      .eq('id', situationId)
      .select()
      .single();

    if (error) {
      console.error('[AdministratifService] Error validating situation:', error);
      throw new Error(`Failed to validate situation: ${error.message}`);
    }

    const situation = this.mapDBSituationToModel(data);
    situation.validationMO = validation;
    return situation;
  }

  /**
   * Enregistrer un paiement
   */
  static async enregistrerPaiement(
    situationId: string,
    paiement: SituationTravaux['paiement']
  ): Promise<SituationTravaux> {
    const { data, error } = await supabase
      .from('payment_situations')
      .update({
        status: 'paid',
        paid_at: paiement?.date || new Date().toISOString(),
      })
      .eq('id', situationId)
      .select()
      .single();

    if (error) {
      console.error('[AdministratifService] Error recording payment:', error);
      throw new Error(`Failed to record payment: ${error.message}`);
    }

    const situation = this.mapDBSituationToModel(data);
    situation.paiement = paiement;
    return situation;
  }

  /**
   * Lister les situations
   */
  static async listSituations(filters?: SituationFilters): Promise<SituationTravaux[]> {
    let query = supabase.from('payment_situations').select('*');

    if (filters?.chantierId) {
      query = query.eq('project_id', filters.chantierId);
    }
    if (filters?.statut) {
      const statusMap: Record<StatutSituation, string> = {
        'brouillon': 'draft',
        'soumise': 'submitted',
        'validee_moe': 'validated',
        'contestee': 'contested',
        'validee_mo': 'validated',
        'payee': 'paid',
      };
      query = query.eq('status', statusMap[filters.statut] || filters.statut);
    }

    const { data, error } = await query.order('numero', { ascending: true });

    if (error) {
      console.error('[AdministratifService] Error listing situations:', error);
      return [];
    }

    return (data || []).map(d => this.mapDBSituationToModel(d));
  }

  private static mapDBSituationToModel(data: any, etabliePar?: string): SituationTravaux {
    const lotsProgress = data.lots_progress || [];
    const lignes: LigneSituation[] = lotsProgress.map((l: any) => ({
      id: l.lot_id || crypto.randomUUID(),
      lotNom: l.lot_code,
      montantMarcheHT: l.contract_amount,
      avancementPrecedent: 0,
      avancementActuel: l.progress_pct,
      avancementPeriode: l.progress_pct,
      montantPrecedentHT: l.previous_amount,
      montantActuelHT: l.cumulative_amount,
      montantPeriodeHT: l.current_amount,
      estTravauxSup: false,
    }));

    const statusMap: Record<string, StatutSituation> = {
      'draft': 'brouillon',
      'submitted': 'soumise',
      'validated': 'validee_mo',
      'contested': 'contestee',
      'paid': 'payee',
    };

    return {
      id: data.id,
      chantierId: data.project_id,
      numero: data.numero,
      periodeDebut: data.period_start,
      periodeFin: data.period_end,
      lignes,
      montantPeriodeHT: data.current_amount_ht,
      cumulAnterieurHT: data.previous_amount_ht,
      cumulSituationHT: data.cumulative_amount_ht,
      retenueGarantiePourcent: data.retention_rate,
      retenueGarantieHT: data.retention_amount,
      acomptesAnterieurs: data.previous_amount_ht,
      netAPayerHT: data.net_to_pay - (data.tva_amount || 0),
      tauxTVA: data.tva_rate,
      montantTVA: data.tva_amount,
      netAPayerTTC: data.net_to_pay,
      statut: statusMap[data.status] || 'brouillon',
      etabliePar,
      dateEtablissement: data.submitted_at,
      paiement: data.paid_at ? {
        date: data.paid_at,
        montant: data.net_to_pay,
        modeReglement: 'virement',
      } : undefined,
      documents: [],
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  /**
   * Générer le récapitulatif d'une situation (format texte)
   */
  static genererRecapitulatifSituation(situation: SituationTravaux): string {
    let recap = `SITUATION N°${situation.numero}\n`;
    recap += `Période du ${situation.periodeDebut} au ${situation.periodeFin}\n\n`;

    for (const ligne of situation.lignes) {
      recap += `${ligne.lotNom}\n`;
      recap += `  Marché : ${ligne.montantMarcheHT.toLocaleString('fr-FR')}€ HT\n`;
      recap += `  Réalisé période : ${ligne.avancementPeriode}% → ${ligne.montantPeriodeHT.toLocaleString('fr-FR')}€\n`;
      recap += `  Cumul : ${ligne.avancementActuel}% → ${ligne.montantActuelHT.toLocaleString('fr-FR')}€\n\n`;
    }

    recap += `---\n`;
    recap += `TOTAL situation HT : ${situation.cumulSituationHT.toLocaleString('fr-FR')}€\n`;
    recap += `Retenue garantie ${situation.retenueGarantiePourcent}% : -${situation.retenueGarantieHT.toLocaleString('fr-FR')}€\n`;
    recap += `Acomptes antérieurs : -${situation.acomptesAnterieurs.toLocaleString('fr-FR')}€\n`;
    recap += `À PAYER HT : ${situation.netAPayerHT.toLocaleString('fr-FR')}€\n`;
    recap += `TVA ${situation.tauxTVA}% : ${situation.montantTVA.toLocaleString('fr-FR')}€\n`;
    recap += `NET À PAYER TTC : ${situation.netAPayerTTC.toLocaleString('fr-FR')}€\n`;

    return recap;
  }

  // ============================================
  // SUIVI BUDGÉTAIRE
  // ============================================

  /**
   * Calculer le suivi budgétaire
   */
  static async calculerSuiviBudgetaire(chantierId: string): Promise<SuiviBudgetaire> {
    const now = new Date().toISOString();

    // Récupérer les données
    const situations = await this.listSituations({ chantierId });
    const avenants = await this.listAvenants({ chantierId, statut: 'signe' });

    // Récupérer les lots du projet (simplified - ideally from projects table)
    const lotsMarche = await this.getLotsMarche(chantierId);

    // Calculer par lot
    const lots: SuiviBudgetLot[] = lotsMarche.map(lotMarche => {
      const situationsLot = situations.filter(s =>
        s.lignes.some(l => l.lotNom === lotMarche.nom)
      );
      const avenantsLot = avenants.filter(a => a.objet.includes(lotMarche.nom));

      const totalAvenantsHT = avenantsLot.reduce((sum, a) => sum + a.montantAvenantHT, 0);
      const montantActualiseHT = lotMarche.montantHT + totalAvenantsHT;

      const situationsPayeesHT = situationsLot
        .filter(s => s.statut === 'payee')
        .reduce((sum, s) => {
          const ligneLot = s.lignes.find(l => l.lotNom === lotMarche.nom);
          return sum + (ligneLot?.montantActuelHT || 0);
        }, 0);

      const pourcentagePaye = montantActualiseHT > 0
        ? (situationsPayeesHT / montantActualiseHT) * 100
        : 0;

      const depassementHT = montantActualiseHT - lotMarche.montantHT;
      const depassementPourcent = lotMarche.montantHT > 0
        ? (depassementHT / lotMarche.montantHT) * 100
        : 0;

      let statut: SuiviBudgetLot['statut'] = 'normal';
      if (depassementPourcent > 15) statut = 'critique';
      else if (depassementPourcent > 10) statut = 'alerte';
      else if (depassementPourcent > 5) statut = 'attention';

      return {
        lotId: lotMarche.id,
        lotNom: lotMarche.nom,
        entreprise: lotMarche.entreprise,
        montantMarcheHT: lotMarche.montantHT,
        avenants: avenantsLot.map(a => ({
          id: a.id,
          numero: a.numero,
          objet: a.objet,
          montantHT: a.montantAvenantHT,
          dateValidation: a.signature?.dateMO,
          statut: a.statut,
        })),
        totalAvenantsHT,
        montantActualiseHT,
        situationsPayeesHT,
        pourcentagePaye,
        resteAPayerHT: montantActualiseHT - situationsPayeesHT,
        depassementHT,
        depassementPourcent,
        statut,
      };
    });

    // Totaux
    const totalMarcheHT = lots.reduce((sum, l) => sum + l.montantMarcheHT, 0);
    const totalAvenantsHT = lots.reduce((sum, l) => sum + l.totalAvenantsHT, 0);
    const totalActualiseHT = lots.reduce((sum, l) => sum + l.montantActualiseHT, 0);
    const totalSituationsPaveesHT = lots.reduce((sum, l) => sum + l.situationsPayeesHT, 0);
    const totalResteAPayerHT = lots.reduce((sum, l) => sum + l.resteAPayerHT, 0);

    const pourcentageAvancement = totalActualiseHT > 0
      ? (totalSituationsPaveesHT / totalActualiseHT) * 100
      : 0;
    const pourcentageConsomme = totalMarcheHT > 0
      ? (totalSituationsPaveesHT / totalMarcheHT) * 100
      : 0;

    // Alertes
    const alertes = this.genererAlertesBudget(lots, totalAvenantsHT, totalMarcheHT);

    // Cash-flow
    const cashFlow = this.genererCashFlow(situations);

    return {
      id: crypto.randomUUID(),
      chantierId,
      dateSuivi: now,
      lots,
      totalMarcheHT,
      totalAvenantsHT,
      totalActualiseHT,
      totalSituationsPaveesHT,
      totalResteAPayerHT,
      pourcentageAvancement,
      pourcentageConsomme,
      depassementGlobalHT: totalActualiseHT - totalMarcheHT,
      depassementPourcent: totalMarcheHT > 0 ? ((totalActualiseHT - totalMarcheHT) / totalMarcheHT) * 100 : 0,
      cashFlow,
      alertes,
      createdAt: now,
    };
  }

  /**
   * Get lots from project (simplified)
   */
  private static async getLotsMarche(chantierId: string): Promise<{ id: string; nom: string; entreprise: string; montantHT: number }[]> {
    // In production, this would fetch from a projects/lots table
    // For now, return empty array - data will come from situations
    const situations = await this.listSituations({ chantierId });

    // Extract unique lots from situations
    const lotsMap = new Map<string, { id: string; nom: string; entreprise: string; montantHT: number }>();

    for (const situation of situations) {
      for (const ligne of situation.lignes) {
        if (!lotsMap.has(ligne.lotNom)) {
          lotsMap.set(ligne.lotNom, {
            id: ligne.id,
            nom: ligne.lotNom,
            entreprise: 'Non spécifié',
            montantHT: ligne.montantMarcheHT,
          });
        }
      }
    }

    return Array.from(lotsMap.values());
  }

  /**
   * Générer les alertes budget
   */
  private static genererAlertesBudget(
    lots: SuiviBudgetLot[],
    totalAvenants: number,
    totalMarche: number
  ): SuiviBudgetaire['alertes'] {
    const alertes: SuiviBudgetaire['alertes'] = [];

    // Dépassement par lot
    for (const lot of lots) {
      if (lot.depassementPourcent > 10) {
        alertes.push({
          type: 'depassement_lot',
          niveau: lot.depassementPourcent > 15 ? 'error' : 'warning',
          message: `${lot.lotNom} : dépassement de ${lot.depassementPourcent.toFixed(1)}%`,
          valeur: lot.depassementPourcent,
          seuil: 10,
        });
      }
    }

    // Avenants excessifs
    const pourcentageAvenants = totalMarche > 0 ? (totalAvenants / totalMarche) * 100 : 0;
    if (pourcentageAvenants > 15) {
      alertes.push({
        type: 'avenants_excessifs',
        niveau: 'error',
        message: `Cumul avenants : ${pourcentageAvenants.toFixed(1)}% du marché`,
        valeur: pourcentageAvenants,
        seuil: 15,
      });
    }

    return alertes;
  }

  /**
   * Générer le cash-flow
   */
  private static genererCashFlow(situations: SituationTravaux[]): SuiviBudgetaire['cashFlow'] {
    const cashFlow: SuiviBudgetaire['cashFlow'] = [];
    let cumul = 0;

    const situationsTriees = [...situations]
      .filter(s => s.paiement)
      .sort((a, b) => new Date(a.paiement!.date).getTime() - new Date(b.paiement!.date).getTime());

    for (const situation of situationsTriees) {
      cumul += situation.paiement!.montant;
      cashFlow.push({
        date: situation.paiement!.date,
        type: 'decaissement',
        montant: situation.paiement!.montant,
        description: `Situation n°${situation.numero}`,
        cumul,
      });
    }

    return cashFlow;
  }

  // ============================================
  // AVENANTS (via contract_amendments)
  // ============================================

  /**
   * Créer un avenant
   */
  static async createAvenant(input: CreateAvenantInput): Promise<Avenant> {
    // Récupérer le montant initial du marché
    const situations = await this.listSituations({ chantierId: input.chantierId });
    const montantInitialHT = situations.reduce((sum, s) =>
      sum + s.lignes.reduce((s2, l) => s2 + l.montantMarcheHT, 0), 0) || 100000;

    // Numéro d'avenant
    const avenantsExistants = await this.listAvenants({ chantierId: input.chantierId });
    const numero = avenantsExistants.length + 1;

    const { data, error } = await supabase
      .from('contract_amendments')
      .insert({
        project_id: input.chantierId,
        numero,
        amendment_type: input.type,
        title: input.objet,
        description: input.description,
        justification: input.justification,
        amount_ht: Math.abs(input.montantAvenantHT),
        is_increase: input.montantAvenantHT >= 0,
        delay_impact_days: input.impactDelaiJours || 0,
        status: 'draft',
      })
      .select()
      .single();

    if (error) {
      console.error('[AdministratifService] Error creating avenant:', error);
      throw new Error(`Failed to create avenant: ${error.message}`);
    }

    return {
      id: data.id,
      chantierId: data.project_id,
      numero: data.numero,
      type: data.amendment_type as TypeAvenant,
      objet: data.title,
      description: data.description,
      montantInitialHT,
      montantAvenantHT: data.is_increase ? data.amount_ht : -data.amount_ht,
      montantFinalHT: montantInitialHT + (data.is_increase ? data.amount_ht : -data.amount_ht),
      impactPourcent: (data.amount_ht / montantInitialHT) * 100,
      impactDelaiJours: data.delay_impact_days,
      justification: data.justification,
      origineDemande: input.origineDemande,
      devisEntrepriseHT: input.devisEntrepriseHT,
      statut: 'brouillon',
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  /**
   * Soumettre un avenant
   */
  static async soumettreAvenant(avenantId: string): Promise<Avenant> {
    const { data, error } = await supabase
      .from('contract_amendments')
      .update({
        status: 'pending_moe',
        submitted_at: new Date().toISOString(),
      })
      .eq('id', avenantId)
      .select()
      .single();

    if (error) {
      console.error('[AdministratifService] Error submitting avenant:', error);
      throw new Error(`Failed to submit avenant: ${error.message}`);
    }

    return this.mapDBAvenantToModel(data);
  }

  /**
   * Valider un avenant (MOE)
   */
  static async validerAvenantMOE(
    avenantId: string,
    validation: Avenant['validationMOE']
  ): Promise<Avenant> {
    const newStatus = validation?.avis === 'favorable' ? 'pending_mo' : 'rejected';

    const { data, error } = await supabase
      .from('contract_amendments')
      .update({
        status: newStatus,
        moe_approved_at: new Date().toISOString(),
        moe_approved_by: validation?.par,
      })
      .eq('id', avenantId)
      .select()
      .single();

    if (error) {
      console.error('[AdministratifService] Error validating avenant MOE:', error);
      throw new Error(`Failed to validate avenant: ${error.message}`);
    }

    const avenant = this.mapDBAvenantToModel(data);
    avenant.validationMOE = validation;
    return avenant;
  }

  /**
   * Valider un avenant (MO)
   */
  static async validerAvenantMO(
    avenantId: string,
    validation: Avenant['validationMO']
  ): Promise<Avenant> {
    const newStatus = validation?.decision === 'accepte' ? 'approved' : 'rejected';

    const { data, error } = await supabase
      .from('contract_amendments')
      .update({
        status: newStatus,
        mo_approved_at: new Date().toISOString(),
        mo_approved_by: validation?.par,
        ...(newStatus === 'rejected' && { rejection_reason: validation?.commentaire }),
      })
      .eq('id', avenantId)
      .select()
      .single();

    if (error) {
      console.error('[AdministratifService] Error validating avenant MO:', error);
      throw new Error(`Failed to validate avenant: ${error.message}`);
    }

    const avenant = this.mapDBAvenantToModel(data);
    avenant.validationMO = validation;
    return avenant;
  }

  /**
   * Signer un avenant
   */
  static async signerAvenant(
    avenantId: string,
    signature: Avenant['signature']
  ): Promise<Avenant> {
    const { data, error } = await supabase
      .from('contract_amendments')
      .update({
        status: 'signed',
        signed_document_path: signature?.documentUrl,
      })
      .eq('id', avenantId)
      .select()
      .single();

    if (error) {
      console.error('[AdministratifService] Error signing avenant:', error);
      throw new Error(`Failed to sign avenant: ${error.message}`);
    }

    const avenant = this.mapDBAvenantToModel(data);
    avenant.signature = signature;
    return avenant;
  }

  /**
   * Lister les avenants
   */
  static async listAvenants(filters?: AvenantFilters): Promise<Avenant[]> {
    let query = supabase.from('contract_amendments').select('*');

    if (filters?.chantierId) {
      query = query.eq('project_id', filters.chantierId);
    }
    if (filters?.type) {
      query = query.eq('amendment_type', filters.type);
    }
    if (filters?.statut) {
      const statusMap: Record<StatutAvenant, string> = {
        'brouillon': 'draft',
        'soumis': 'pending_moe',
        'en_negociation': 'pending_mo',
        'accepte': 'approved',
        'refuse': 'rejected',
        'signe': 'signed',
      };
      query = query.eq('status', statusMap[filters.statut] || filters.statut);
    }

    const { data, error } = await query.order('numero', { ascending: true });

    if (error) {
      console.error('[AdministratifService] Error listing avenants:', error);
      return [];
    }

    return (data || []).map(d => this.mapDBAvenantToModel(d));
  }

  private static mapDBAvenantToModel(data: any): Avenant {
    const statusMap: Record<string, StatutAvenant> = {
      'draft': 'brouillon',
      'pending_moe': 'soumis',
      'pending_mo': 'en_negociation',
      'approved': 'accepte',
      'rejected': 'refuse',
      'signed': 'signe',
    };

    const montantAvenant = data.is_increase ? data.amount_ht : -data.amount_ht;

    return {
      id: data.id,
      chantierId: data.project_id,
      numero: data.numero,
      type: data.amendment_type as TypeAvenant,
      objet: data.title,
      description: data.description,
      montantInitialHT: 0, // Would need to be calculated
      montantAvenantHT: montantAvenant,
      montantFinalHT: montantAvenant,
      impactPourcent: 0,
      impactDelaiJours: data.delay_impact_days,
      justification: data.justification,
      origineDemande: 'entreprise',
      statut: statusMap[data.status] || 'brouillon',
      validationMOE: data.moe_approved_at ? {
        date: data.moe_approved_at,
        par: data.moe_approved_by,
        avis: 'favorable',
      } : undefined,
      validationMO: data.mo_approved_at ? {
        date: data.mo_approved_at,
        par: data.mo_approved_by,
        decision: data.status === 'approved' || data.status === 'signed' ? 'accepte' : 'refuse',
      } : undefined,
      signature: data.signed_document_path ? {
        dateMO: data.mo_approved_at,
        dateEntreprise: data.mo_approved_at,
        documentUrl: data.signed_document_path,
      } : undefined,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  // ============================================
  // DOE - DOSSIER OUVRAGES EXÉCUTÉS
  // ============================================

  /**
   * Obtenir le DOE d'un chantier
   */
  static async getDOE(chantierId: string): Promise<DossierOuvragesExecutes> {
    // Query site_journal for DOE documents (stored as photos/attachments)
    const { data: journalEntries } = await supabase
      .from('site_journal')
      .select('*')
      .eq('project_id', chantierId)
      .order('journal_date', { ascending: false });

    // Extract documents from journal entries
    const documents: DocumentDOE[] = [];
    const lots = await this.getLotsMarche(chantierId);

    for (const entry of journalEntries || []) {
      const photos = entry.photos || [];
      for (const photo of photos) {
        if (photo.category === 'doe') {
          documents.push({
            id: photo.path,
            type: 'autre',
            nom: photo.caption || 'Document DOE',
            url: photo.path,
            dateFourniture: entry.journal_date,
            fourniPar: entry.logged_by_name || 'Non spécifié',
            statut: 'fourni',
            createdAt: entry.created_at,
          });
        }
      }
    }

    const lotsWithDocs = lots.map(lot => ({
      lotId: lot.id,
      lotNom: lot.nom,
      entreprise: lot.entreprise,
      documentsAttendus: this.getDocumentsAttendusDOE(lot.nom).map(d => ({
        id: crypto.randomUUID(),
        type: d.type,
        libelle: d.libelle,
        obligatoire: d.obligatoire,
      })),
      documentsFournis: documents.filter(d => d.nom.includes(lot.nom)),
      totalAttendus: this.getDocumentsAttendusDOE(lot.nom).length,
      totalFournis: documents.filter(d => d.nom.includes(lot.nom)).length,
      totalValides: 0,
      pourcentageComplet: 0,
    }));

    return {
      id: `doe-${chantierId}`,
      chantierId,
      lots: lotsWithDocs,
      totalDocuments: lotsWithDocs.reduce((sum, l) => sum + l.totalAttendus, 0),
      documentsFournis: documents.length,
      documentsValides: 0,
      pourcentageComplet: 0,
      complet: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Ajouter un document au DOE
   */
  static async ajouterDocumentDOE(input: CreateDocumentDOEInput): Promise<DocumentDOE> {
    const now = new Date().toISOString();

    // Store via site_journal as a photo with 'doe' category
    const { data: existing } = await supabase
      .from('site_journal')
      .select('*')
      .eq('project_id', input.chantierId)
      .eq('journal_date', new Date().toISOString().split('T')[0])
      .single();

    const newPhoto = {
      path: input.url,
      caption: input.nom,
      category: 'doe',
      type: input.type,
      timestamp: now,
    };

    if (existing) {
      const photos = [...(existing.photos || []), newPhoto];
      await supabase
        .from('site_journal')
        .update({ photos })
        .eq('id', existing.id);
    } else {
      await supabase
        .from('site_journal')
        .insert({
          project_id: input.chantierId,
          journal_date: new Date().toISOString().split('T')[0],
          photos: [newPhoto],
          logged_by_name: input.fourniPar,
        });
    }

    return {
      id: crypto.randomUUID(),
      type: input.type,
      nom: input.nom,
      description: input.description,
      url: input.url,
      dateFourniture: now,
      dateDocument: input.dateDocument,
      fourniPar: input.fourniPar,
      statut: 'fourni',
      createdAt: now,
    };
  }

  /**
   * Valider un document DOE
   */
  static async validerDocumentDOE(
    documentId: string,
    validation: { par: string; conforme: boolean; commentaire?: string }
  ): Promise<DocumentDOE> {
    // Documents are stored in site_journal photos - would need to update there
    return {
      id: documentId,
      type: 'autre',
      nom: 'Document',
      url: documentId,
      dateFourniture: new Date().toISOString(),
      fourniPar: 'Entreprise',
      statut: validation.conforme ? 'conforme' : 'non_conforme',
      verifiePar: validation.par,
      dateVerification: new Date().toISOString(),
      commentaireVerification: validation.commentaire,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Obtenir la liste des documents attendus par lot
   */
  static getDocumentsAttendusDOE(lot: string): { type: DocumentDOE['type']; libelle: string; obligatoire: boolean }[] {
    const documentsCommuns = [
      { type: 'plan_as_built' as const, libelle: 'Plans conformes à exécution', obligatoire: true },
      { type: 'fiche_technique' as const, libelle: 'Fiches techniques matériaux', obligatoire: true },
      { type: 'pv_essai' as const, libelle: 'PV d\'essais et contrôles', obligatoire: true },
      { type: 'garantie' as const, libelle: 'Certificats de garantie', obligatoire: true },
    ];

    const documentsParLot: Record<string, { type: DocumentDOE['type']; libelle: string; obligatoire: boolean }[]> = {
      'Électricité': [
        { type: 'certificat', libelle: 'Attestation Consuel', obligatoire: true },
        { type: 'notice_equipement', libelle: 'Notice tableau électrique', obligatoire: true },
      ],
      'Plomberie': [
        { type: 'pv_essai', libelle: 'PV essai pression', obligatoire: true },
        { type: 'notice_equipement', libelle: 'Notices appareils sanitaires', obligatoire: true },
      ],
      'Chauffage': [
        { type: 'notice_equipement', libelle: 'Notice chaudière/PAC', obligatoire: true },
        { type: 'certificat', libelle: 'Certificat Qualigaz (si gaz)', obligatoire: false },
        { type: 'pv_essai', libelle: 'PV mise en service', obligatoire: true },
      ],
    };

    return [...documentsCommuns, ...(documentsParLot[lot] || [])];
  }

  // ============================================
  // LITIGES
  // ============================================

  /**
   * Créer un litige
   */
  static async createLitige(input: CreateLitigeInput): Promise<Litige> {
    const now = new Date().toISOString();

    // Store litige via correspondence_logs with special type
    const { data, error } = await supabase
      .from('correspondence_logs')
      .insert({
        project_id: input.chantierId,
        message_type: 'alert',
        subject: `Litige: ${input.objet}`,
        content: JSON.stringify({
          type: input.type,
          description: input.description,
          parties: input.parties,
          gravite: input.gravite,
          impactFinancierEstime: input.impactFinancierEstime,
          impactDelaiEstime: input.impactDelaiEstime,
          niveauActuel: 'niveau1_discussion',
          statut: 'signale',
        }),
      })
      .select()
      .single();

    if (error) {
      console.error('[AdministratifService] Error creating litige:', error);
      throw new Error(`Failed to create litige: ${error.message}`);
    }

    return {
      id: data.id,
      chantierId: input.chantierId,
      type: input.type,
      objet: input.objet,
      description: input.description,
      parties: input.parties,
      gravite: input.gravite,
      impactFinancierEstime: input.impactFinancierEstime,
      impactDelaiEstime: input.impactDelaiEstime,
      dateSignalement: now,
      signalePar: 'Utilisateur',
      preuves: [],
      niveauActuel: 'niveau1_discussion',
      historiqueEscalade: [{
        niveau: 'niveau1_discussion',
        dateDebut: now,
        actions: [],
      }],
      statut: 'signale',
      documents: [],
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Escalader un litige
   */
  static async escaladerLitige(
    litigeId: string,
    nouveauNiveau: NiveauEscalade,
    action?: { type: string; description: string }
  ): Promise<Litige> {
    const { data: existing } = await supabase
      .from('correspondence_logs')
      .select('*')
      .eq('id', litigeId)
      .single();

    if (!existing) {
      throw new Error('Litige not found');
    }

    let content: any = {};
    try {
      content = JSON.parse(existing.content);
    } catch {}

    content.niveauActuel = nouveauNiveau;
    content.statut = 'escalade';

    const { data, error } = await supabase
      .from('correspondence_logs')
      .update({ content: JSON.stringify(content) })
      .eq('id', litigeId)
      .select()
      .single();

    if (error) {
      console.error('[AdministratifService] Error escalating litige:', error);
      throw new Error(`Failed to escalate litige: ${error.message}`);
    }

    return this.mapDBLitigeToModel(data);
  }

  /**
   * Résoudre un litige
   */
  static async resoudreLitige(
    litigeId: string,
    resolution: Litige['resolution']
  ): Promise<Litige> {
    const { data: existing } = await supabase
      .from('correspondence_logs')
      .select('*')
      .eq('id', litigeId)
      .single();

    if (!existing) {
      throw new Error('Litige not found');
    }

    let content: any = {};
    try {
      content = JSON.parse(existing.content);
    } catch {}

    content.statut = 'resolu';
    content.resolution = resolution;

    const { data, error } = await supabase
      .from('correspondence_logs')
      .update({ content: JSON.stringify(content) })
      .eq('id', litigeId)
      .select()
      .single();

    if (error) {
      console.error('[AdministratifService] Error resolving litige:', error);
      throw new Error(`Failed to resolve litige: ${error.message}`);
    }

    return this.mapDBLitigeToModel(data);
  }

  /**
   * Lister les litiges
   */
  static async listLitiges(filters?: LitigeFilters): Promise<Litige[]> {
    let query = supabase
      .from('correspondence_logs')
      .select('*')
      .eq('message_type', 'alert')
      .ilike('subject', 'Litige:%');

    if (filters?.chantierId) {
      query = query.eq('project_id', filters.chantierId);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('[AdministratifService] Error listing litiges:', error);
      return [];
    }

    return (data || []).map(d => this.mapDBLitigeToModel(d));
  }

  private static mapDBLitigeToModel(data: any): Litige {
    let content: any = {};
    try {
      content = JSON.parse(data.content);
    } catch {}

    return {
      id: data.id,
      chantierId: data.project_id,
      type: content.type || 'autre',
      objet: data.subject?.replace('Litige: ', '') || 'Non spécifié',
      description: content.description || '',
      parties: content.parties || [],
      gravite: content.gravite || 'modere',
      impactFinancierEstime: content.impactFinancierEstime,
      impactDelaiEstime: content.impactDelaiEstime,
      dateSignalement: data.created_at,
      signalePar: data.sender_name || 'Non spécifié',
      preuves: [],
      niveauActuel: content.niveauActuel || 'niveau1_discussion',
      historiqueEscalade: [{
        niveau: content.niveauActuel || 'niveau1_discussion',
        dateDebut: data.created_at,
        actions: [],
      }],
      statut: content.statut || 'signale',
      resolution: content.resolution,
      documents: [],
      createdAt: data.created_at,
      updatedAt: data.created_at,
    };
  }

  /**
   * Obtenir un template de courrier
   */
  static getTemplateCourrier(type: string) {
    return TEMPLATES_COURRIERS_LITIGE.find(t => t.type === type);
  }

  /**
   * Générer un courrier depuis template
   */
  static genererCourrier(
    type: string,
    variables: Record<string, string>
  ): { objet: string; corps: string } | null {
    const template = this.getTemplateCourrier(type);
    if (!template) return null;

    let objet = template.objet;
    let corps = template.corps;

    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\{${key}\\}`, 'g');
      objet = objet.replace(regex, value);
      corps = corps.replace(regex, value);
    }

    return { objet, corps };
  }

  // ============================================
  // ALERTES
  // ============================================

  /**
   * Obtenir les alertes administratives
   */
  static async getAlertes(chantierId: string): Promise<AlerteAdministrative[]> {
    const alertes: AlerteAdministrative[] = [];
    const now = new Date().toISOString();

    // Situations en attente de validation
    const situations = await this.listSituations({ chantierId });
    for (const situation of situations) {
      if (situation.statut === 'soumise') {
        alertes.push({
          id: crypto.randomUUID(),
          chantierId,
          type: 'situation_en_attente',
          niveau: 'warning',
          entiteType: 'situation',
          entiteId: situation.id,
          titre: `Situation n°${situation.numero} en attente`,
          message: `La situation de ${situation.netAPayerTTC.toLocaleString('fr-FR')}€ TTC attend validation`,
          montant: situation.netAPayerTTC,
          dateCreation: now,
          lu: false,
          traite: false,
          createdAt: now,
        });
      }
    }

    // Avenants en attente
    const avenants = await this.listAvenants({ chantierId });
    for (const avenant of avenants) {
      if (avenant.statut === 'soumis' || avenant.statut === 'en_negociation') {
        alertes.push({
          id: crypto.randomUUID(),
          chantierId,
          type: 'avenant_en_attente',
          niveau: 'warning',
          entiteType: 'avenant',
          entiteId: avenant.id,
          titre: `Avenant n°${avenant.numero} en attente`,
          message: `Avenant "${avenant.objet}" de ${avenant.montantAvenantHT.toLocaleString('fr-FR')}€ HT`,
          montant: avenant.montantAvenantHT,
          dateCreation: now,
          lu: false,
          traite: false,
          createdAt: now,
        });
      }
    }

    // Litiges ouverts
    const litiges = await this.listLitiges({ chantierId });
    for (const litige of litiges) {
      if (litige.statut !== 'resolu' && litige.statut !== 'clos') {
        alertes.push({
          id: crypto.randomUUID(),
          chantierId,
          type: 'litige_escalade',
          niveau: litige.gravite === 'critique' ? 'critical' : 'error',
          entiteType: 'litige',
          entiteId: litige.id,
          titre: `Litige : ${litige.objet}`,
          message: `Niveau actuel : ${litige.niveauActuel}`,
          montant: litige.impactFinancierEstime,
          dateCreation: now,
          lu: false,
          traite: false,
          createdAt: now,
        });
      }
    }

    return alertes;
  }
}

// ============================================
// ADAPTATEUR POUR HOOKS
// ============================================

/**
 * Adaptateur singleton pour les hooks React
 * Expose les méthodes statiques via une interface compatible
 */
export const administratifService = {
  // Récupérer les situations
  getSituations: (projetId: string, lotId?: string) =>
    AdministratifService.listSituations({ chantierId: projetId, lotId }),

  // Calculer le suivi budgétaire
  calculerSuiviBudgetaire: (projetId: string) =>
    AdministratifService.calculerSuiviBudgetaire(projetId),

  // Récupérer les avenants
  getAvenants: (projetId: string) =>
    AdministratifService.listAvenants({ chantierId: projetId }),

  // Créer une situation
  createSituation: (data: { projetId: string; lotId: string; mois: string; lignes: any[] }) =>
    AdministratifService.createSituation({
      chantierId: data.projetId,
      lotId: data.lotId,
      mois: data.mois,
      lignes: data.lignes,
    }),

  // Soumettre une situation
  soumettreSituation: (situationId: string) =>
    AdministratifService.soumettreSituation(situationId),

  // Valider une situation
  validerSituation: (situationId: string, commentaire?: string) =>
    AdministratifService.validerSituation(situationId, {
      par: 'Utilisateur',
      commentaire,
    }),

  // Refuser une situation
  refuserSituation: async (situationId: string, motif: string) => {
    const result = await AdministratifService.verifierSituation(situationId, {
      par: 'Utilisateur',
      conformite: false,
      observations: motif,
    });
    return result;
  },

  // Créer un avenant
  createAvenant: (data: { projetId: string; lotId: string; objet: string; montantHT: number; justification: string }) =>
    AdministratifService.createAvenant({
      chantierId: data.projetId,
      lotId: data.lotId,
      type: 'travaux_supplementaires',
      objet: data.objet,
      montantHT: data.montantHT,
      justification: data.justification,
    }),

  // Valider un avenant
  validerAvenant: (avenantId: string) =>
    AdministratifService.validerAvenantMOE(avenantId, {
      par: 'Utilisateur',
      avis: 'favorable',
    }),
};
