/**
 * TORP Phase 1 - Service Contrat
 * Module 1.4 : Sélection et Contractualisation
 *
 * Gère la génération de contrats et la sécurisation juridique :
 * - Génération automatique de contrats B2C/B2B/B2G
 * - Vérification juridique des clauses
 * - Gestion de la négociation
 * - Simulateur financier (échéancier, trésorerie)
 */

import { supabase } from '@/lib/supabase';
import type { Phase0Project } from '@/types/phase0/project.types';
import type { WizardMode } from '@/types/phase0/wizard.types';

import type {
  Contrat,
  TypeContrat,
  StatutContrat,
  PartiesContrat,
  PartieMO,
  PartieEntreprise,
  ObjetContrat,
  ConditionsFinancieres,
  ModalitesPaiement,
  EcheancePaiement,
  DelaisContrat,
  GarantiesContrat,
  ClausesContrat,
  ClauseContrat,
  AnnexeContrat,
  SignatureContrat,
  Negociation,
  VerificationJuridique,
  VerificationClause,
  AlerteJuridique,
  ContratMetadata,
  CLAUSES_OBLIGATOIRES_B2C,
  CLAUSES_MARCHE_PUBLIC,
  ECHEANCIER_TYPE,
} from '@/types/phase1/contrat.types';
import type { Offre } from '@/types/phase1/offre.types';
import type { Entreprise } from '@/types/phase1/entreprise.types';

// =============================================================================
// TYPES INTERNES
// =============================================================================

export interface ContratGenerationInput {
  project: Phase0Project;
  offreSelectionnee: Offre;
  entreprise: Entreprise;
}

export interface ContratGenerationResult {
  success: boolean;
  contrat?: Contrat;
  erreurs?: string[];
  avertissements?: string[];
}

export interface SimulationTresorerieInput {
  contrat: Contrat;
  dateDebut: string;
}

export interface SimulationTresorerieResult {
  echeances: EcheanceSimulee[];
  totalDecaisse: number;
  retenueGarantie: number;
  soldeApresGarantie: number;
}

interface EcheanceSimulee {
  date: string;
  designation: string;
  montant: number;
  cumul: number;
  pourcentageAvancement: number;
}

// =============================================================================
// SERVICE
// =============================================================================

export class ContratService {
  /**
   * Génère un contrat à partir d'une offre sélectionnée
   */
  static async generateContrat(input: ContratGenerationInput): Promise<ContratGenerationResult> {
    const { project, offreSelectionnee, entreprise } = input;
    const erreurs: string[] = [];
    const avertissements: string[] = [];

    try {
      // Déterminer le type de contrat
      const typeContrat = this.determineTypeContrat(project.wizardMode);

      // Générer les parties
      const parties = this.generateParties(project, entreprise);

      // Générer l'objet du contrat
      const objet = this.generateObjet(project, offreSelectionnee);

      // Générer les conditions financières
      const conditionsFinancieres = this.generateConditionsFinancieres(
        offreSelectionnee,
        project.wizardMode
      );

      // Générer les délais
      const delais = this.generateDelais(offreSelectionnee);

      // Générer les garanties
      const garanties = this.generateGaranties(project.wizardMode, conditionsFinancieres);

      // Générer les clauses
      const clauses = this.generateClauses(project.wizardMode, project);

      // Générer les annexes
      const annexes = this.generateAnnexes(project, offreSelectionnee);

      // Initialiser la signature
      const signature: SignatureContrat = {
        entreprise: { signee: false, cachet: true, typeSignature: 'manuscrite' },
        maitreOuvrage: { signee: false, typeSignature: 'manuscrite' },
      };

      const now = new Date().toISOString();
      const contratId = crypto.randomUUID();

      const metadata: ContratMetadata = {
        version: 1,
        createdAt: now,
        updatedAt: now,
        createdBy: 'system',
        exportFormats: ['pdf', 'docx'],
      };

      const contrat: Contrat = {
        id: contratId,
        projectId: project.id,
        consultationId: offreSelectionnee.consultationId,
        offreId: offreSelectionnee.id,
        type: typeContrat,
        mode: project.wizardMode,
        parties,
        objet,
        conditionsFinancieres,
        delais,
        garanties,
        clauses,
        annexes,
        signature,
        statut: 'brouillon',
        metadata,
      };

      // Vérification juridique automatique
      const verification = this.verifyContrat(contrat);
      if (!verification.conforme) {
        verification.alertes
          .filter((a) => a.type === 'error')
          .forEach((a) => erreurs.push(a.message));
        verification.alertes
          .filter((a) => a.type === 'warning')
          .forEach((a) => avertissements.push(a.message));
      }

      // Sauvegarder
      await this.saveContrat(contrat);

      return {
        success: erreurs.length === 0,
        contrat,
        erreurs: erreurs.length > 0 ? erreurs : undefined,
        avertissements: avertissements.length > 0 ? avertissements : undefined,
      };
    } catch (error) {
      console.error('[Contrat] Generation error:', error);
      return {
        success: false,
        erreurs: [error instanceof Error ? error.message : 'Erreur inconnue'],
      };
    }
  }

  /**
   * Vérifie la conformité juridique du contrat
   */
  static verifyContrat(contrat: Contrat): VerificationJuridique {
    const verifications: VerificationClause[] = [];
    const alertes: AlerteJuridique[] = [];
    let score = 100;

    // Obtenir les clauses obligatoires selon le mode
    const clausesObligatoires = contrat.mode === 'b2g_public'
      ? [...CLAUSES_OBLIGATOIRES_B2C, ...CLAUSES_MARCHE_PUBLIC]
      : CLAUSES_OBLIGATOIRES_B2C;

    // Vérifier chaque clause obligatoire
    clausesObligatoires.forEach((clauseObligatoire) => {
      const clausePresente = contrat.clauses.obligatoires.some(
        (c) => c.titre.toLowerCase().includes(clauseObligatoire.titre.toLowerCase()) ||
          clauseObligatoire.titre.toLowerCase().includes(c.titre.toLowerCase())
      );

      verifications.push({
        clauseId: clauseObligatoire.titre,
        clauseTitre: clauseObligatoire.titre,
        presente: clausePresente,
        conforme: clausePresente,
        referenceObligatoire: clauseObligatoire.reference,
      });

      if (!clausePresente) {
        alertes.push({
          type: 'error',
          clause: clauseObligatoire.titre,
          message: `Clause obligatoire manquante: ${clauseObligatoire.titre}`,
          consequence: 'Le contrat pourrait être considéré comme incomplet',
          correction: `Ajouter la clause: ${clauseObligatoire.titre}`,
        });
        score -= 10;
      }
    });

    // Vérifications spécifiques B2C
    if (contrat.mode === 'b2c_simple' || contrat.mode === 'b2c_detailed') {
      // Délai de rétractation
      const hasRetractation = contrat.clauses.obligatoires.some(
        (c) => c.titre.toLowerCase().includes('rétractation')
      );
      if (!hasRetractation) {
        alertes.push({
          type: 'warning',
          message: 'Mention du droit de rétractation recommandée pour les particuliers',
          correction: 'Ajouter une clause sur le droit de rétractation de 14 jours',
        });
        score -= 5;
      }

      // Acompte maximum 30%
      const acompte = contrat.conditionsFinancieres.paiement.acompte?.pourcentage || 0;
      if (acompte > 30) {
        alertes.push({
          type: 'error',
          message: `Acompte de ${acompte}% supérieur au maximum légal de 30%`,
          consequence: 'Non-conformité au Code de la consommation',
          correction: 'Réduire l\'acompte à 30% maximum',
        });
        score -= 15;
      }
    }

    // Vérification des assurances
    const hasAssuranceClause = contrat.clauses.obligatoires.some(
      (c) => c.titre.toLowerCase().includes('assurance')
    );
    if (!hasAssuranceClause) {
      alertes.push({
        type: 'warning',
        message: 'Clause sur les assurances obligatoires recommandée',
        correction: 'Ajouter une clause mentionnant les assurances RC décennale',
      });
      score -= 5;
    }

    // Vérification des pénalités
    const penalites = contrat.conditionsFinancieres.penalites;
    if (!penalites.retard.plafond || penalites.retard.plafond > 10) {
      alertes.push({
        type: 'info',
        message: 'Plafond de pénalités non défini ou élevé',
        correction: 'Définir un plafond de pénalités (généralement 5-10%)',
      });
    }

    return {
      contratId: contrat.id,
      dateVerification: new Date().toISOString(),
      conforme: alertes.filter((a) => a.type === 'error').length === 0,
      score: Math.max(0, score),
      verifications,
      alertes,
      recommandations: alertes.filter((a) => a.correction).map((a) => a.correction!),
    };
  }

  /**
   * Simule la trésorerie (échéancier de paiement)
   */
  static simulateTresorerie(input: SimulationTresorerieInput): SimulationTresorerieResult {
    const { contrat, dateDebut } = input;
    const echeances: EcheanceSimulee[] = [];
    const montantTotal = contrat.conditionsFinancieres.prix.montantTTC;
    let cumul = 0;
    let dateActuelle = new Date(dateDebut);

    // Générer les échéances
    contrat.conditionsFinancieres.paiement.echeancier.forEach((echeance) => {
      const montant = (montantTotal * echeance.pourcentage) / 100;
      cumul += montant;

      echeances.push({
        date: dateActuelle.toISOString(),
        designation: echeance.designation,
        montant,
        cumul,
        pourcentageAvancement: Math.round((cumul / montantTotal) * 100),
      });

      // Avancer la date (estimé à 1 mois entre chaque étape)
      dateActuelle.setMonth(dateActuelle.getMonth() + 1);
    });

    // Calculer la retenue de garantie
    const retenueGarantie = contrat.conditionsFinancieres.retenueGarantie.applicable
      ? (montantTotal * contrat.conditionsFinancieres.retenueGarantie.pourcentage) / 100
      : 0;

    return {
      echeances,
      totalDecaisse: cumul,
      retenueGarantie,
      soldeApresGarantie: cumul - retenueGarantie,
    };
  }

  // =============================================================================
  // MÉTHODES PRIVÉES - GÉNÉRATION
  // =============================================================================

  private static determineTypeContrat(wizardMode: WizardMode): TypeContrat {
    switch (wizardMode) {
      case 'b2c_simple':
      case 'b2c_detailed':
        return 'marche_prive_b2c';
      case 'b2b_professional':
        return 'marche_prive_b2b';
      case 'b2g_public':
        return 'marche_public_mapa';
      default:
        return 'marche_prive_b2c';
    }
  }

  private static generateParties(project: Phase0Project, entreprise: Entreprise): PartiesContrat {
    const owner = project.ownerProfile;

    const maitreOuvrage: PartieMO = {
      type: project.wizardMode === 'b2c_simple' || project.wizardMode === 'b2c_detailed'
        ? 'particulier'
        : project.wizardMode === 'b2b_professional'
          ? 'entreprise'
          : 'collectivite',
      nom: this.getOwnerName(owner),
      adresse: owner?.contact?.address || project.property?.address || {
        street: '',
        postalCode: '',
        city: '',
        country: 'France',
      },
      email: owner?.contact?.email || '',
      telephone: owner?.contact?.phone || '',
    };

    const partieEntreprise: PartieEntreprise = {
      raisonSociale: entreprise.identification.raisonSociale,
      formeJuridique: entreprise.identification.formeJuridique || 'SARL',
      siret: entreprise.identification.siret,
      adresse: entreprise.identification.adresse,
      representant: {
        nom: entreprise.contact.nomContact,
        qualite: entreprise.contact.fonction,
      },
      email: entreprise.contact.email,
      telephone: entreprise.contact.telephone,
      assuranceDecennale: {
        compagnie: entreprise.assurances.find((a) => a.type === 'rc_decennale')?.compagnie || '',
        numeroPolice: entreprise.assurances.find((a) => a.type === 'rc_decennale')?.numeroContrat || '',
        validiteJusquau: entreprise.assurances.find((a) => a.type === 'rc_decennale')?.dateFin || '',
        montantGaranti: entreprise.assurances.find((a) => a.type === 'rc_decennale')?.montantGaranti || 0,
      },
      assuranceRC: {
        compagnie: entreprise.assurances.find((a) => a.type === 'rc_professionnelle')?.compagnie || '',
        numeroPolice: entreprise.assurances.find((a) => a.type === 'rc_professionnelle')?.numeroContrat || '',
        validiteJusquau: entreprise.assurances.find((a) => a.type === 'rc_professionnelle')?.dateFin || '',
        montantGaranti: entreprise.assurances.find((a) => a.type === 'rc_professionnelle')?.montantGaranti || 0,
      },
      qualifications: entreprise.qualifications.map((q) => ({
        type: q.designation,
        numero: q.numero || '',
        validiteJusquau: q.dateExpiration,
      })),
    };

    return {
      maitreOuvrage,
      entreprise: partieEntreprise,
    };
  }

  private static generateObjet(project: Phase0Project, offre: Offre): ObjetContrat {
    return {
      titre: project.workProject?.general?.title || 'Travaux de rénovation',
      description: project.workProject?.general?.description || '',
      adresseChantier: project.property?.address || {
        street: '',
        postalCode: '',
        city: '',
        country: 'France',
      },
      natureTravaux: project.workProject?.scope?.workType || 'renovation',
      lots: offre.contenu.financier.dpgf.lots.map((lot) => ({
        numero: lot.numero,
        designation: lot.designation,
        montantHT: lot.sousTotalHT,
      })),
      surface: project.property?.surface,
    };
  }

  private static generateConditionsFinancieres(
    offre: Offre,
    wizardMode: WizardMode
  ): ConditionsFinancieres {
    const financier = offre.contenu.financier;

    // Générer l'échéancier
    const echeancier: EcheancePaiement[] = ECHEANCIER_TYPE.map((e) => ({
      ...e,
      montant: (financier.totalTTC * e.pourcentage) / 100,
    }));

    const paiement: ModalitesPaiement = {
      echeancier,
      delaiPaiement: 30,
      baseDelai: 'situation_validee',
      acompte: {
        pourcentage: wizardMode === 'b2c_simple' || wizardMode === 'b2c_detailed' ? 15 : 20,
        montant: 0, // Calculé
        conditions: 'À la signature du contrat',
      },
      interetsRetard: {
        applicable: true,
        taux: 8.16, // Taux légal
        calcul: 'Taux BCE + 10 points',
      },
    };

    // Calculer l'acompte
    if (paiement.acompte) {
      paiement.acompte.montant = (financier.totalTTC * paiement.acompte.pourcentage) / 100;
    }

    return {
      prix: {
        type: 'forfaitaire',
        montantHT: financier.totalHT,
        tauxTVA: financier.tauxTVA,
        montantTVA: financier.montantTVA,
        montantTTC: financier.totalTTC,
      },
      revision: {
        applicable: false, // À activer si travaux > 3 mois
      },
      paiement,
      retenueGarantie: {
        applicable: true,
        pourcentage: 5,
        duree: 12, // 12 mois (parfait achèvement)
        liberation: {
          automatique: true,
          conditions: ['Absence de réserves à la réception', 'Expiration du délai de parfait achèvement'],
        },
        substitution: {
          cautionBancaire: true,
          conditions: 'Sur demande de l\'entreprise',
        },
      },
      penalites: {
        retard: {
          montantParJour: '1/1000 du montant TTC',
          plafond: 10,
          debutDecompte: 'Lendemain de la date contractuelle de fin',
          causesSuspension: [
            'Intempéries exceptionnelles',
            'Fait du maître d\'ouvrage',
            'Force majeure',
          ],
        },
      },
    };
  }

  private static generateDelais(offre: Offre): DelaisContrat {
    const planning = offre.contenu.planning;

    return {
      preparation: {
        duree: 2,
        unite: 'semaines',
      },
      execution: {
        duree: planning.dureeJours,
        unite: 'jours_calendaires',
        dateDebutType: 'ordre_service',
      },
      reception: {
        delaiDemande: 15,
        delaiReponse: 20,
        delaiLeveeReserves: 30,
      },
      jalons: planning.jalons.map((j) => ({
        designation: j.nom,
        delaiJours: j.jourDepuisDebut,
        penalisable: false,
      })),
    };
  }

  private static generateGaranties(
    wizardMode: WizardMode,
    conditionsFinancieres: ConditionsFinancieres
  ): GarantiesContrat {
    const montantTravaux = conditionsFinancieres.prix.montantHT;

    return {
      legales: {
        parfaitAchevement: {
          duree: 1,
          couverture: 'Tous les désordres signalés durant l\'année suivant la réception',
        },
        biennale: {
          duree: 2,
          couverture: 'Éléments d\'équipement dissociables du bâtiment',
          elementsCouverts: [
            'Volets roulants',
            'Portes intérieures',
            'Équipements sanitaires',
            'Robinetterie',
          ],
        },
        decennale: {
          duree: 10,
          couverture: 'Dommages compromettant la solidité ou rendant l\'ouvrage impropre à sa destination',
        },
      },
      assurancesObligatoires: {
        rcDecennale: true,
        rcProfessionnelle: true,
        montantMinimum: montantTravaux,
      },
      assurancesFacultatives: {
        dommageOuvrage: {
          souscrit: montantTravaux > 50000,
          parQui: 'mo',
        },
        trc: {
          souscrit: montantTravaux > 100000,
          parQui: 'entreprise',
          couverture: ['Incendie', 'Vol', 'Dégâts des eaux'],
        },
      },
    };
  }

  private static generateClauses(wizardMode: WizardMode, project: Phase0Project): ClausesContrat {
    const clausesObligatoires: ClauseContrat[] = CLAUSES_OBLIGATOIRES_B2C.map((c, idx) => ({
      id: `oblig-${idx}`,
      ...c,
    }));

    // Ajouter les clauses marchés publics si B2G
    if (wizardMode === 'b2g_public') {
      CLAUSES_MARCHE_PUBLIC.forEach((c, idx) => {
        clausesObligatoires.push({
          id: `mp-${idx}`,
          ...c,
        });
      });
    }

    // Clauses particulières
    const clausesParticulieres: ClauseContrat[] = [];

    // Clause site occupé
    if (project.workProject?.constraints?.occupancy?.duringWorks) {
      clausesParticulieres.push({
        id: 'part-1',
        titre: 'Travaux en site occupé',
        contenu: 'Les travaux seront réalisés alors que les locaux sont occupés. L\'entreprise prendra toutes les dispositions nécessaires pour limiter les nuisances et maintenir l\'accès aux parties habitées.',
        obligatoire: true,
        modifiable: true,
      });
    }

    return {
      obligatoires: clausesObligatoires,
      particulieres: clausesParticulieres,
    };
  }

  private static generateAnnexes(project: Phase0Project, offre: Offre): AnnexeContrat[] {
    return [
      {
        id: 'annex-1',
        code: 'A1',
        titre: 'Cahier des Clauses Techniques Particulières (CCTP)',
        type: 'cctp',
        obligatoire: true,
      },
      {
        id: 'annex-2',
        code: 'A2',
        titre: 'Décomposition du Prix Global et Forfaitaire (DPGF)',
        type: 'dpgf',
        obligatoire: true,
      },
      {
        id: 'annex-3',
        code: 'A3',
        titre: 'Planning d\'exécution',
        type: 'planning',
        obligatoire: true,
      },
      {
        id: 'annex-4',
        code: 'A4',
        titre: 'Attestation d\'assurance RC décennale',
        type: 'attestation_assurance',
        obligatoire: true,
      },
      {
        id: 'annex-5',
        code: 'A5',
        titre: 'Extrait Kbis',
        type: 'kbis',
        obligatoire: true,
      },
    ];
  }

  private static getOwnerName(owner?: Phase0Project['ownerProfile']): string {
    if (!owner?.identity) return 'Maître d\'ouvrage';

    const identity = owner.identity;
    if (identity.type === 'B2C') {
      const individual = identity as { firstName?: string; lastName?: string };
      return `${individual.firstName || ''} ${individual.lastName || ''}`.trim() || 'Particulier';
    } else if (identity.type === 'B2B') {
      const company = identity as { companyName?: string };
      return company.companyName || 'Entreprise';
    } else {
      const entity = identity as { entityName?: string };
      return entity.entityName || 'Collectivité';
    }
  }

  // =============================================================================
  // PERSISTANCE
  // =============================================================================

  static async saveContrat(contrat: Contrat): Promise<void> {
    const { error } = await supabase.from('phase1_contrats').upsert({
      id: contrat.id,
      project_id: contrat.projectId,
      consultation_id: contrat.consultationId,
      offre_id: contrat.offreId,
      type: contrat.type,
      mode: contrat.mode,
      parties: contrat.parties,
      objet: contrat.objet,
      conditions_financieres: contrat.conditionsFinancieres,
      delais: contrat.delais,
      garanties: contrat.garanties,
      clauses: contrat.clauses,
      annexes: contrat.annexes,
      signature: contrat.signature,
      statut: contrat.statut,
      metadata: contrat.metadata,
    });

    if (error) {
      throw new Error(`Erreur lors de la sauvegarde du contrat: ${error.message}`);
    }
  }

  static async getContratById(id: string): Promise<Contrat | null> {
    const { data, error } = await supabase
      .from('phase1_contrats')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Erreur lors de la récupération du contrat: ${error.message}`);
    }

    return this.mapRowToContrat(data);
  }

  private static mapRowToContrat(row: Record<string, unknown>): Contrat {
    return {
      id: row.id as string,
      projectId: row.project_id as string,
      consultationId: row.consultation_id as string,
      offreId: row.offre_id as string,
      type: row.type as TypeContrat,
      mode: row.mode as WizardMode,
      parties: row.parties as PartiesContrat,
      objet: row.objet as ObjetContrat,
      conditionsFinancieres: row.conditions_financieres as ConditionsFinancieres,
      delais: row.delais as DelaisContrat,
      garanties: row.garanties as GarantiesContrat,
      clauses: row.clauses as ClausesContrat,
      annexes: row.annexes as AnnexeContrat[],
      signature: row.signature as SignatureContrat,
      statut: row.statut as StatutContrat,
      metadata: row.metadata as ContratMetadata,
    };
  }

  /**
   * Export du contrat en texte formaté
   */
  static exportContratToText(contrat: Contrat): string {
    const lines: string[] = [];

    lines.push('='.repeat(70));
    lines.push('CONTRAT DE TRAVAUX');
    lines.push('='.repeat(70));
    lines.push('');
    lines.push(`Entre les soussignés:`);
    lines.push('');
    lines.push(`LE MAÎTRE D'OUVRAGE:`);
    lines.push(`  ${contrat.parties.maitreOuvrage.nom}`);
    lines.push(`  ${contrat.parties.maitreOuvrage.adresse.street}`);
    lines.push(`  ${contrat.parties.maitreOuvrage.adresse.postalCode} ${contrat.parties.maitreOuvrage.adresse.city}`);
    lines.push('');
    lines.push(`L'ENTREPRISE:`);
    lines.push(`  ${contrat.parties.entreprise.raisonSociale}`);
    lines.push(`  SIRET: ${contrat.parties.entreprise.siret}`);
    lines.push(`  ${contrat.parties.entreprise.adresse.street}`);
    lines.push(`  ${contrat.parties.entreprise.adresse.postalCode} ${contrat.parties.entreprise.adresse.city}`);
    lines.push('');
    lines.push('-'.repeat(70));
    lines.push('');
    lines.push('ARTICLE 1 - OBJET');
    lines.push(`  ${contrat.objet.description}`);
    lines.push(`  Adresse chantier: ${contrat.objet.adresseChantier.street}, ${contrat.objet.adresseChantier.postalCode} ${contrat.objet.adresseChantier.city}`);
    lines.push('');
    lines.push('ARTICLE 2 - PRIX');
    lines.push(`  Montant HT: ${contrat.conditionsFinancieres.prix.montantHT.toLocaleString('fr-FR')} €`);
    lines.push(`  TVA (${contrat.conditionsFinancieres.prix.tauxTVA}%): ${contrat.conditionsFinancieres.prix.montantTVA.toLocaleString('fr-FR')} €`);
    lines.push(`  Montant TTC: ${contrat.conditionsFinancieres.prix.montantTTC.toLocaleString('fr-FR')} €`);
    lines.push('');
    lines.push('ARTICLE 3 - DÉLAI');
    lines.push(`  Durée d'exécution: ${contrat.delais.execution.duree} ${contrat.delais.execution.unite}`);
    lines.push('');
    lines.push('ARTICLE 4 - PÉNALITÉS DE RETARD');
    lines.push(`  ${contrat.conditionsFinancieres.penalites.retard.montantParJour} par jour de retard`);
    lines.push(`  Plafond: ${contrat.conditionsFinancieres.penalites.retard.plafond}%`);
    lines.push('');
    lines.push('='.repeat(70));
    lines.push(`Généré par TORP - ${new Date().toLocaleDateString('fr-FR')}`);

    return lines.join('\n');
  }
}

export default ContratService;
