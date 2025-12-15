/**
 * Service Garanties
 * Gestion des garanties légales : parfait achèvement, biennale, décennale
 * Suivi des désordres et mise en jeu des garanties
 */

import { supabase } from '@/lib/supabase';
import {
  Garantie,
  GarantieType,
  Desordre,
  DesordreStatut,
  RetenueGarantie,
} from '@/types/phase4.types';
import { emailService } from '@/services/email/email.service';
import { v4 as uuidv4 } from 'uuid';

// =====================================================
// CONSTANTES
// =====================================================

const GARANTIE_DUREES: Record<GarantieType, number> = {
  parfait_achevement: 1,
  biennale: 2,
  decennale: 10,
  vices_caches: 10, // Délai de prescription
};

const GARANTIE_DESCRIPTIONS: Record<GarantieType, { perimetre: string; exclusions: string[] }> = {
  parfait_achevement: {
    perimetre: 'Tous désordres signalés lors de la réception ou révélés dans l\'année suivante, relevant des réserves ou de malfaçons.',
    exclusions: [
      'Usure normale',
      'Défaut d\'entretien',
      'Usage anormal',
      'Travaux effectués par des tiers',
    ],
  },
  biennale: {
    perimetre: 'Éléments d\'équipement dissociables : robinetterie, volets, radiateurs, chauffe-eau, etc.',
    exclusions: [
      'Éléments inertes (carrelage, peinture)',
      'Gros œuvre',
      'Éléments d\'équipement indissociables',
      'Défaut d\'entretien',
    ],
  },
  decennale: {
    perimetre: 'Désordres compromettant la solidité de l\'ouvrage ou le rendant impropre à sa destination.',
    exclusions: [
      'Désordres esthétiques',
      'Éléments d\'équipement dissociables',
      'Usure normale',
      'Défaut d\'entretien caractérisé',
    ],
  },
  vices_caches: {
    perimetre: 'Vices cachés lors de la vente, rendant le bien impropre à l\'usage ou diminuant tellement cet usage que l\'acheteur ne l\'aurait pas acquis.',
    exclusions: [
      'Vices apparents',
      'Vices connus de l\'acheteur',
    ],
  },
};

// =====================================================
// SERVICE
// =====================================================

class GarantiesService {
  // =====================================================
  // GESTION DES GARANTIES
  // =====================================================

  /**
   * Récupère une garantie par ID
   */
  async getGarantie(garantieId: string): Promise<Garantie | null> {
    const { data, error } = await supabase
      .from('garanties')
      .select('*')
      .eq('id', garantieId)
      .single();

    if (error || !data) {
      return null;
    }

    return this.mapDbToGarantie(data);
  }

  /**
   * Liste les garanties d'un chantier
   */
  async getGarantiesByChantier(chantierId: string): Promise<Garantie[]> {
    const { data, error } = await supabase
      .from('garanties')
      .select('*')
      .eq('chantier_id', chantierId)
      .order('date_debut', { ascending: true });

    if (error || !data) {
      return [];
    }

    return data.map(this.mapDbToGarantie);
  }

  /**
   * Liste les garanties actives d'un chantier
   */
  async getGarantiesActives(chantierId: string): Promise<Garantie[]> {
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('garanties')
      .select('*')
      .eq('chantier_id', chantierId)
      .eq('active', true)
      .gt('date_fin', now);

    if (error || !data) {
      return [];
    }

    return data.map(this.mapDbToGarantie);
  }

  /**
   * Récupère une garantie par type pour un chantier
   */
  async getGarantieByType(
    chantierId: string,
    type: GarantieType
  ): Promise<Garantie | null> {
    const { data, error } = await supabase
      .from('garanties')
      .select('*')
      .eq('chantier_id', chantierId)
      .eq('type', type)
      .single();

    if (error || !data) {
      return null;
    }

    return this.mapDbToGarantie(data);
  }

  /**
   * Vérifie si une garantie est applicable pour un désordre
   */
  async checkGarantieApplicable(
    chantierId: string,
    type: GarantieType,
    dateDesordre: Date
  ): Promise<{
    applicable: boolean;
    garantie: Garantie | null;
    raison?: string;
  }> {
    const garantie = await this.getGarantieByType(chantierId, type);

    if (!garantie) {
      return {
        applicable: false,
        garantie: null,
        raison: 'Aucune garantie de ce type trouvée pour ce chantier',
      };
    }

    const dateFin = new Date(garantie.dateFin);

    if (dateDesordre > dateFin) {
      return {
        applicable: false,
        garantie,
        raison: `La garantie ${this.translateType(type)} a expiré le ${dateFin.toLocaleDateString('fr-FR')}`,
      };
    }

    if (!garantie.active) {
      return {
        applicable: false,
        garantie,
        raison: 'Cette garantie n\'est plus active',
      };
    }

    return {
      applicable: true,
      garantie,
    };
  }

  /**
   * Met à jour les infos d'assurance d'une garantie
   */
  async updateAssurance(
    garantieId: string,
    assurance: {
      assuranceNom: string;
      numeroPolice: string;
    }
  ): Promise<Garantie | null> {
    const { data, error } = await supabase
      .from('garanties')
      .update({
        assurance_nom: assurance.assuranceNom,
        numero_police: assurance.numeroPolice,
        updated_at: new Date().toISOString(),
      })
      .eq('id', garantieId)
      .select()
      .single();

    if (error || !data) {
      return null;
    }

    return this.mapDbToGarantie(data);
  }

  /**
   * Vérifie et met à jour l'expiration des garanties
   */
  async checkExpirations(): Promise<number> {
    const now = new Date().toISOString();

    const { data: garantiesExpirees, error } = await supabase
      .from('garanties')
      .select('*')
      .eq('active', true)
      .lte('date_fin', now);

    if (error || !garantiesExpirees) return 0;

    for (const garantie of garantiesExpirees) {
      await supabase
        .from('garanties')
        .update({
          active: false,
          expiree: true,
          updated_at: now,
        })
        .eq('id', garantie.id);

      // Notifier le maître d'ouvrage
      await this.notifyExpirationGarantie(garantie.id);
    }

    return garantiesExpirees.length;
  }

  // =====================================================
  // GESTION DES DÉSORDRES
  // =====================================================

  /**
   * Signale un nouveau désordre
   */
  async signalerDesordre(
    chantierId: string,
    params: {
      nature: string;
      description: string;
      localisation: string;
      gravite: 'faible' | 'moyenne' | 'grave' | 'critique';
      dateDecouverte: string;
      photos?: string[];
      documents?: string[];
    }
  ): Promise<Desordre> {
    const desordreId = uuidv4();
    const now = new Date().toISOString();

    // Déterminer la garantie applicable
    const garantieType = await this.determineGarantieApplicable(
      chantierId,
      params.nature,
      params.gravite
    );

    const garantie = await this.getGarantieByType(chantierId, garantieType);

    const desordre: Desordre = {
      id: desordreId,
      garantieId: garantie?.id || '',
      chantierId,
      numero: await this.generateNumeroDesordre(chantierId),
      dateDecouverte: params.dateDecouverte,
      dateSignalement: now,
      nature: params.nature,
      description: params.description,
      localisation: params.localisation,
      gravite: params.gravite,
      garantieApplicable: garantieType,
      photos: params.photos || [],
      documents: params.documents || [],
      statut: 'signale',
      expertiseRequise: params.gravite === 'critique' || params.gravite === 'grave',
      createdAt: now,
      updatedAt: now,
    };

    const { error } = await supabase.from('desordres').insert({
      id: desordre.id,
      garantie_id: desordre.garantieId,
      chantier_id: desordre.chantierId,
      numero: desordre.numero,
      date_decouverte: desordre.dateDecouverte,
      date_signalement: desordre.dateSignalement,
      nature: desordre.nature,
      description: desordre.description,
      localisation: desordre.localisation,
      gravite: desordre.gravite,
      garantie_applicable: desordre.garantieApplicable,
      photos: desordre.photos,
      documents: desordre.documents,
      statut: desordre.statut,
      expertise_requise: desordre.expertiseRequise,
      created_at: desordre.createdAt,
      updated_at: desordre.updatedAt,
    });

    if (error) {
      throw new Error('Impossible de créer le désordre');
    }

    // Mettre à jour la garantie avec ce désordre
    if (garantie) {
      garantie.desordres.push(desordre);
      await supabase
        .from('garanties')
        .update({
          desordres: garantie.desordres,
          updated_at: now,
        })
        .eq('id', garantie.id);
    }

    return desordre;
  }

  /**
   * Récupère un désordre par ID
   */
  async getDesordre(desordreId: string): Promise<Desordre | null> {
    const { data, error } = await supabase
      .from('desordres')
      .select('*')
      .eq('id', desordreId)
      .single();

    if (error || !data) {
      return null;
    }

    return this.mapDbToDesordre(data);
  }

  /**
   * Liste les désordres d'un chantier
   */
  async getDesordresByChantier(chantierId: string): Promise<Desordre[]> {
    const { data, error } = await supabase
      .from('desordres')
      .select('*')
      .eq('chantier_id', chantierId)
      .order('date_signalement', { ascending: false });

    if (error || !data) {
      return [];
    }

    return data.map(this.mapDbToDesordre);
  }

  /**
   * Liste les désordres par garantie
   */
  async getDesordresByGarantie(garantieId: string): Promise<Desordre[]> {
    const { data, error } = await supabase
      .from('desordres')
      .select('*')
      .eq('garantie_id', garantieId)
      .order('date_signalement', { ascending: false });

    if (error || !data) {
      return [];
    }

    return data.map(this.mapDbToDesordre);
  }

  /**
   * Met à jour le statut d'un désordre
   */
  async updateDesordreStatut(
    desordreId: string,
    statut: DesordreStatut,
    commentaire?: string
  ): Promise<Desordre | null> {
    const { data, error } = await supabase
      .from('desordres')
      .update({
        statut,
        updated_at: new Date().toISOString(),
      })
      .eq('id', desordreId)
      .select()
      .single();

    if (error || !data) {
      return null;
    }

    return this.mapDbToDesordre(data);
  }

  /**
   * Signale un désordre à l'entreprise
   */
  async signalerEntreprise(
    desordreId: string,
    params: {
      mode: 'email' | 'lrar' | 'courrier';
      entrepriseId: string;
      referenceEnvoi?: string;
    }
  ): Promise<void> {
    const desordre = await this.getDesordre(desordreId);
    if (!desordre) {
      throw new Error('Désordre non trouvé');
    }

    const signalement = {
      date: new Date().toISOString(),
      mode: params.mode,
      referenceEnvoi: params.referenceEnvoi,
    };

    await supabase
      .from('desordres')
      .update({
        signalement_entreprise: signalement,
        updated_at: new Date().toISOString(),
      })
      .eq('id', desordreId);

    // Envoyer l'email si mode email
    if (params.mode === 'email') {
      const { data: entreprise } = await supabase
        .from('entreprises')
        .select('email, contact_email, nom')
        .eq('id', params.entrepriseId)
        .single();

      const email = entreprise?.contact_email || entreprise?.email;
      if (email) {
        await emailService.sendTemplatedEmail(
          email,
          'signalement_desordre',
          {
            entrepriseNom: entreprise.nom,
            desordreNumero: desordre.numero,
            desordreNature: desordre.nature,
            desordreLocalisation: desordre.localisation,
            garantieType: this.translateType(desordre.garantieApplicable),
          }
        );
      }
    }
  }

  /**
   * Enregistre le diagnostic d'un désordre
   */
  async enregistrerDiagnostic(
    desordreId: string,
    diagnostic: {
      resultat: string;
      responsabiliteAcceptee: boolean;
      motifContestation?: string;
    }
  ): Promise<Desordre | null> {
    const { data, error } = await supabase
      .from('desordres')
      .update({
        diagnostic_date: new Date().toISOString(),
        diagnostic_resultat: diagnostic.resultat,
        responsabilite_acceptee: diagnostic.responsabiliteAcceptee,
        motif_contestation: diagnostic.motifContestation,
        statut: diagnostic.responsabiliteAcceptee ? 'diagnostic' : 'conteste',
        updated_at: new Date().toISOString(),
      })
      .eq('id', desordreId)
      .select()
      .single();

    if (error || !data) {
      return null;
    }

    return this.mapDbToDesordre(data);
  }

  /**
   * Planifie une réparation
   */
  async planifierReparation(
    desordreId: string,
    dateReparation: string
  ): Promise<Desordre | null> {
    const { data, error } = await supabase
      .from('desordres')
      .update({
        reparation_planifiee: dateReparation,
        statut: 'en_reparation',
        updated_at: new Date().toISOString(),
      })
      .eq('id', desordreId)
      .select()
      .single();

    if (error || !data) {
      return null;
    }

    return this.mapDbToDesordre(data);
  }

  /**
   * Enregistre la réalisation d'une réparation
   */
  async enregistrerReparation(
    desordreId: string,
    params: {
      dateRealisation: string;
      cout?: number;
      conforme: boolean;
      photos?: string[];
    }
  ): Promise<Desordre | null> {
    const { data, error } = await supabase
      .from('desordres')
      .update({
        reparation_realisee: params.dateRealisation,
        cout_reparation: params.cout,
        reparation_conforme: params.conforme,
        statut: params.conforme ? 'repare' : 'en_reparation',
        updated_at: new Date().toISOString(),
      })
      .eq('id', desordreId)
      .select()
      .single();

    if (error || !data) {
      return null;
    }

    return this.mapDbToDesordre(data);
  }

  /**
   * Déclare un désordre à l'assurance
   */
  async declarerAssurance(
    desordreId: string,
    params: {
      numeroSinistre?: string;
    }
  ): Promise<void> {
    const declaration = {
      date: new Date().toISOString(),
      numeroSinistre: params.numeroSinistre,
      statut: 'en_cours' as const,
    };

    await supabase
      .from('desordres')
      .update({
        declaration_assurance: declaration,
        updated_at: new Date().toISOString(),
      })
      .eq('id', desordreId);
  }

  /**
   * Met à jour le statut assurance d'un désordre
   */
  async updateStatutAssurance(
    desordreId: string,
    params: {
      statut: 'en_cours' | 'accepte' | 'refuse' | 'expertise';
      numeroSinistre?: string;
      indemnisation?: number;
    }
  ): Promise<void> {
    const desordre = await this.getDesordre(desordreId);
    if (!desordre) {
      throw new Error('Désordre non trouvé');
    }

    const declaration = desordre.declarationAssurance || {
      date: new Date().toISOString(),
      statut: 'en_cours',
    };

    declaration.statut = params.statut;
    if (params.numeroSinistre) declaration.numeroSinistre = params.numeroSinistre;
    if (params.indemnisation) declaration.indemnisation = params.indemnisation;

    await supabase
      .from('desordres')
      .update({
        declaration_assurance: declaration,
        updated_at: new Date().toISOString(),
      })
      .eq('id', desordreId);
  }

  // =====================================================
  // RETENUE DE GARANTIE
  // =====================================================

  /**
   * Crée une retenue de garantie
   */
  async createRetenueGarantie(
    chantierId: string,
    receptionId: string,
    entrepriseId: string,
    montantMarche: number
  ): Promise<RetenueGarantie> {
    const id = uuidv4();
    const now = new Date();
    const pourcentage = 5;
    const montant = Math.round(montantMarche * (pourcentage / 100) * 100) / 100;

    const dateLiberationPrevue = new Date(now);
    dateLiberationPrevue.setFullYear(dateLiberationPrevue.getFullYear() + 1);

    const retenue: RetenueGarantie = {
      id,
      chantierId,
      receptionId,
      entrepriseId,
      montantTotal: montant,
      pourcentage,
      dateConstitution: now.toISOString(),
      dateLiberationPrevue: dateLiberationPrevue.toISOString(),
      statut: 'retenue',
      montantConsomme: 0,
      motifsConsommation: [],
      montantLibere: 0,
      demandesLiberation: [],
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    await supabase.from('retenues_garantie').insert({
      id: retenue.id,
      chantier_id: retenue.chantierId,
      reception_id: retenue.receptionId,
      entreprise_id: retenue.entrepriseId,
      montant_total: retenue.montantTotal,
      pourcentage: retenue.pourcentage,
      date_constitution: retenue.dateConstitution,
      date_liberation_prevue: retenue.dateLiberationPrevue,
      statut: retenue.statut,
      montant_consomme: retenue.montantConsomme,
      motifs_consommation: retenue.motifsConsommation,
      montant_libere: retenue.montantLibere,
      demandes_liberation: retenue.demandesLiberation,
      created_at: retenue.createdAt,
      updated_at: retenue.updatedAt,
    });

    return retenue;
  }

  /**
   * Récupère une retenue de garantie
   */
  async getRetenueGarantie(retenueId: string): Promise<RetenueGarantie | null> {
    const { data, error } = await supabase
      .from('retenues_garantie')
      .select('*')
      .eq('id', retenueId)
      .single();

    if (error || !data) {
      return null;
    }

    return this.mapDbToRetenue(data);
  }

  /**
   * Consomme une partie de la retenue (pour payer des réparations)
   */
  async consommerRetenue(
    retenueId: string,
    params: {
      montant: number;
      motif: string;
      reserveId?: string;
      desordreId?: string;
    }
  ): Promise<RetenueGarantie | null> {
    const retenue = await this.getRetenueGarantie(retenueId);
    if (!retenue) {
      throw new Error('Retenue non trouvée');
    }

    const disponible = retenue.montantTotal - retenue.montantConsomme - retenue.montantLibere;
    if (params.montant > disponible) {
      throw new Error(`Montant insuffisant. Disponible: ${disponible}€`);
    }

    const nouveauMontantConsomme = retenue.montantConsomme + params.montant;
    const motifs = [...retenue.motifsConsommation, {
      date: new Date().toISOString(),
      montant: params.montant,
      motif: params.motif,
      reserveId: params.reserveId,
      desordreId: params.desordreId,
    }];

    // Déterminer le nouveau statut
    let statut = retenue.statut;
    if (nouveauMontantConsomme >= retenue.montantTotal) {
      statut = 'consommee';
    } else if (nouveauMontantConsomme > 0) {
      statut = 'partiellement_liberee';
    }

    const { data, error } = await supabase
      .from('retenues_garantie')
      .update({
        montant_consomme: nouveauMontantConsomme,
        motifs_consommation: motifs,
        statut,
        updated_at: new Date().toISOString(),
      })
      .eq('id', retenueId)
      .select()
      .single();

    if (error || !data) {
      return null;
    }

    return this.mapDbToRetenue(data);
  }

  /**
   * Demande la libération de la retenue
   */
  async demanderLiberation(
    retenueId: string,
    montant: number
  ): Promise<RetenueGarantie | null> {
    const retenue = await this.getRetenueGarantie(retenueId);
    if (!retenue) {
      throw new Error('Retenue non trouvée');
    }

    const demandes = [...retenue.demandesLiberation, {
      date: new Date().toISOString(),
      montant,
      statut: 'demandee' as const,
    }];

    const { data, error } = await supabase
      .from('retenues_garantie')
      .update({
        demandes_liberation: demandes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', retenueId)
      .select()
      .single();

    if (error || !data) {
      return null;
    }

    return this.mapDbToRetenue(data);
  }

  /**
   * Traite une demande de libération
   */
  async traiterDemandeLiberation(
    retenueId: string,
    demandeIndex: number,
    decision: {
      acceptee: boolean;
      motifRefus?: string;
    }
  ): Promise<RetenueGarantie | null> {
    const retenue = await this.getRetenueGarantie(retenueId);
    if (!retenue) {
      throw new Error('Retenue non trouvée');
    }

    const demandes = [...retenue.demandesLiberation];
    if (demandeIndex >= demandes.length) {
      throw new Error('Demande non trouvée');
    }

    demandes[demandeIndex].statut = decision.acceptee ? 'acceptee' : 'refusee';
    if (!decision.acceptee) {
      demandes[demandeIndex].motifRefus = decision.motifRefus;
    }

    let nouveauMontantLibere = retenue.montantLibere;
    if (decision.acceptee) {
      nouveauMontantLibere += demandes[demandeIndex].montant;
    }

    // Déterminer le nouveau statut
    let statut = retenue.statut;
    if (nouveauMontantLibere + retenue.montantConsomme >= retenue.montantTotal) {
      statut = 'liberee';
    } else if (nouveauMontantLibere > 0) {
      statut = 'partiellement_liberee';
    }

    const updateData: Record<string, unknown> = {
      demandes_liberation: demandes,
      montant_libere: nouveauMontantLibere,
      statut,
      updated_at: new Date().toISOString(),
    };

    if (statut === 'liberee') {
      updateData.date_liberation_effective = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('retenues_garantie')
      .update(updateData)
      .eq('id', retenueId)
      .select()
      .single();

    if (error || !data) {
      return null;
    }

    return this.mapDbToRetenue(data);
  }

  /**
   * Vérifie les retenues à libérer automatiquement (après 1 an)
   */
  async checkLiberationsAutomatiques(): Promise<number> {
    const now = new Date().toISOString();

    const { data: retenues, error } = await supabase
      .from('retenues_garantie')
      .select('*')
      .eq('statut', 'retenue')
      .lte('date_liberation_prevue', now);

    if (error || !retenues) return 0;

    let count = 0;

    for (const retenue of retenues) {
      // Vérifier qu'il n'y a pas de réserves non levées
      const { data: reserves } = await supabase
        .from('reserves')
        .select('id')
        .eq('chantier_id', retenue.chantier_id)
        .in('statut', ['ouverte', 'en_cours']);

      if (!reserves || reserves.length === 0) {
        // Libérer automatiquement
        await this.traiterDemandeLiberation(retenue.id, 0, { acceptee: true });
        count++;
      }
    }

    return count;
  }

  // =====================================================
  // STATISTIQUES
  // =====================================================

  /**
   * Statistiques des garanties d'un chantier
   */
  async getStatistiquesGaranties(chantierId: string): Promise<{
    garanties: {
      type: GarantieType;
      dateDebut: string;
      dateFin: string;
      active: boolean;
      joursRestants: number;
      nombreDesordres: number;
    }[];
    desordres: {
      total: number;
      parStatut: Record<DesordreStatut, number>;
      parGravite: Record<string, number>;
    };
    retenue: {
      montantTotal: number;
      montantConsomme: number;
      montantLibere: number;
      montantDisponible: number;
      statut: string;
    } | null;
  }> {
    const garanties = await this.getGarantiesByChantier(chantierId);
    const desordres = await this.getDesordresByChantier(chantierId);

    const now = new Date();

    const garantiesStats = garanties.map(g => {
      const dateFin = new Date(g.dateFin);
      const joursRestants = Math.max(
        0,
        Math.ceil((dateFin.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      );

      return {
        type: g.type,
        dateDebut: g.dateDebut,
        dateFin: g.dateFin,
        active: g.active,
        joursRestants,
        nombreDesordres: g.desordres.length,
      };
    });

    const desordresStats = {
      total: desordres.length,
      parStatut: {} as Record<DesordreStatut, number>,
      parGravite: {} as Record<string, number>,
    };

    for (const d of desordres) {
      desordresStats.parStatut[d.statut] = (desordresStats.parStatut[d.statut] || 0) + 1;
      desordresStats.parGravite[d.gravite] = (desordresStats.parGravite[d.gravite] || 0) + 1;
    }

    // Récupérer la retenue
    const { data: retenueData } = await supabase
      .from('retenues_garantie')
      .select('*')
      .eq('chantier_id', chantierId)
      .single();

    let retenueStats = null;
    if (retenueData) {
      const retenue = this.mapDbToRetenue(retenueData);
      retenueStats = {
        montantTotal: retenue.montantTotal,
        montantConsomme: retenue.montantConsomme,
        montantLibere: retenue.montantLibere,
        montantDisponible: retenue.montantTotal - retenue.montantConsomme - retenue.montantLibere,
        statut: retenue.statut,
      };
    }

    return {
      garanties: garantiesStats,
      desordres: desordresStats,
      retenue: retenueStats,
    };
  }

  // =====================================================
  // ALERTES
  // =====================================================

  /**
   * Envoie les alertes d'expiration proche des garanties
   */
  async sendAlertesExpirationProche(joursAvant: number = 30): Promise<number> {
    const dateLimit = new Date();
    dateLimit.setDate(dateLimit.getDate() + joursAvant);

    const { data: garanties, error } = await supabase
      .from('garanties')
      .select('*, chantier:chantiers(*)')
      .eq('active', true)
      .lte('date_fin', dateLimit.toISOString())
      .gt('date_fin', new Date().toISOString());

    if (error || !garanties) return 0;

    let count = 0;

    for (const garantieData of garanties) {
      const chantier = garantieData.chantier;
      if (chantier?.user_id) {
        const { data: user } = await supabase
          .from('users')
          .select('email, full_name')
          .eq('id', chantier.user_id)
          .single();

        if (user?.email) {
          const dateFin = new Date(garantieData.date_fin);
          const joursRestants = Math.ceil(
            (dateFin.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
          );

          await emailService.sendTemplatedEmail(
            user.email,
            'alerte_expiration_garantie',
            {
              userName: user.full_name || 'Maître d\'ouvrage',
              garantieType: this.translateType(garantieData.type),
              chantierReference: chantier.reference,
              dateFin: dateFin.toLocaleDateString('fr-FR'),
              joursRestants,
            }
          );
          count++;
        }
      }
    }

    return count;
  }

  // =====================================================
  // MÉTHODES PRIVÉES
  // =====================================================

  private async notifyExpirationGarantie(garantieId: string): Promise<void> {
    const garantie = await this.getGarantie(garantieId);
    if (!garantie) return;

    const { data: chantier } = await supabase
      .from('chantiers')
      .select('*, user:users(*)')
      .eq('id', garantie.chantierId)
      .single();

    if (chantier?.user?.email) {
      await emailService.sendTemplatedEmail(
        chantier.user.email,
        'garantie_expiree',
        {
          userName: chantier.user.full_name || 'Maître d\'ouvrage',
          garantieType: this.translateType(garantie.type),
          chantierReference: chantier.reference,
          dateFin: new Date(garantie.dateFin).toLocaleDateString('fr-FR'),
        }
      );
    }
  }

  private async determineGarantieApplicable(
    chantierId: string,
    nature: string,
    gravite: string
  ): Promise<GarantieType> {
    // Logique simplifiée de détermination
    // En réalité, cela nécessite une analyse plus fine

    if (gravite === 'critique') {
      return 'decennale';
    }

    const natureLC = nature.toLowerCase();

    // Mots-clés décennale
    if (
      natureLC.includes('structure') ||
      natureLC.includes('fondation') ||
      natureLC.includes('toiture') ||
      natureLC.includes('étanchéité') ||
      natureLC.includes('infiltration')
    ) {
      return 'decennale';
    }

    // Mots-clés biennale
    if (
      natureLC.includes('robinet') ||
      natureLC.includes('volet') ||
      natureLC.includes('radiateur') ||
      natureLC.includes('chauffe-eau') ||
      natureLC.includes('équipement')
    ) {
      return 'biennale';
    }

    // Par défaut, parfait achèvement si moins d'un an
    const garantiePA = await this.getGarantieByType(chantierId, 'parfait_achevement');
    if (garantiePA && garantiePA.active) {
      return 'parfait_achevement';
    }

    return 'decennale';
  }

  private async generateNumeroDesordre(chantierId: string): Promise<string> {
    const { count } = await supabase
      .from('desordres')
      .select('id', { count: 'exact', head: true })
      .eq('chantier_id', chantierId);

    return `DES-${(count || 0) + 1}`.padStart(7, '0');
  }

  private translateType(type: GarantieType): string {
    const translations: Record<GarantieType, string> = {
      parfait_achevement: 'Parfait achèvement (1 an)',
      biennale: 'Garantie biennale (2 ans)',
      decennale: 'Garantie décennale (10 ans)',
      vices_caches: 'Vices cachés',
    };
    return translations[type] || type;
  }

  private mapDbToGarantie(data: Record<string, unknown>): Garantie {
    return {
      id: data.id as string,
      chantierId: data.chantier_id as string,
      receptionId: data.reception_id as string,
      type: data.type as GarantieType,
      dureeAnnees: data.duree_annees as number,
      dateDebut: data.date_debut as string,
      dateFin: data.date_fin as string,
      perimetre: data.perimetre as string,
      exclusions: (data.exclusions as string[]) || [],
      entrepriseId: data.entreprise_id as string,
      entrepriseNom: data.entreprise_nom as string,
      assuranceId: data.assurance_id as string | undefined,
      assuranceNom: data.assurance_nom as string | undefined,
      numeroPolice: data.numero_police as string | undefined,
      active: data.active as boolean,
      expiree: data.expiree as boolean,
      desordres: (data.desordres as Desordre[]) || [],
      createdAt: data.created_at as string,
      updatedAt: data.updated_at as string,
    };
  }

  private mapDbToDesordre(data: Record<string, unknown>): Desordre {
    return {
      id: data.id as string,
      garantieId: data.garantie_id as string,
      chantierId: data.chantier_id as string,
      numero: data.numero as string,
      dateDecouverte: data.date_decouverte as string,
      dateSignalement: data.date_signalement as string,
      nature: data.nature as string,
      description: data.description as string,
      localisation: data.localisation as string,
      gravite: data.gravite as 'faible' | 'moyenne' | 'grave' | 'critique',
      garantieApplicable: data.garantie_applicable as GarantieType,
      photos: (data.photos as string[]) || [],
      documents: (data.documents as string[]) || [],
      statut: data.statut as DesordreStatut,
      signalementEntreprise: data.signalement_entreprise as Desordre['signalementEntreprise'],
      diagnosticDate: data.diagnostic_date as string | undefined,
      diagnosticResultat: data.diagnostic_resultat as string | undefined,
      responsabiliteAcceptee: data.responsabilite_acceptee as boolean | undefined,
      motifContestation: data.motif_contestation as string | undefined,
      expertiseRequise: data.expertise_requise as boolean,
      expertId: data.expert_id as string | undefined,
      rapportExpertise: data.rapport_expertise as string | undefined,
      reparationPlanifiee: data.reparation_planifiee as string | undefined,
      reparationRealisee: data.reparation_realisee as string | undefined,
      coutReparation: data.cout_reparation as number | undefined,
      reparationConforme: data.reparation_conforme as boolean | undefined,
      declarationAssurance: data.declaration_assurance as Desordre['declarationAssurance'],
      createdAt: data.created_at as string,
      updatedAt: data.updated_at as string,
    };
  }

  private mapDbToRetenue(data: Record<string, unknown>): RetenueGarantie {
    return {
      id: data.id as string,
      chantierId: data.chantier_id as string,
      receptionId: data.reception_id as string,
      entrepriseId: data.entreprise_id as string,
      montantTotal: data.montant_total as number,
      pourcentage: data.pourcentage as number,
      dateConstitution: data.date_constitution as string,
      dateLiberationPrevue: data.date_liberation_prevue as string,
      dateLiberationEffective: data.date_liberation_effective as string | undefined,
      statut: data.statut as RetenueGarantie['statut'],
      montantConsomme: data.montant_consomme as number,
      motifsConsommation: (data.motifs_consommation as RetenueGarantie['motifsConsommation']) || [],
      montantLibere: data.montant_libere as number,
      demandesLiberation: (data.demandes_liberation as RetenueGarantie['demandesLiberation']) || [],
      createdAt: data.created_at as string,
      updatedAt: data.updated_at as string,
    };
  }
}

export const garantiesService = new GarantiesService();
export default garantiesService;
