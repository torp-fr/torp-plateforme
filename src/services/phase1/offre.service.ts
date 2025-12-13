/**
 * TORP Phase 1 - Service Analyse des Offres
 * Module 1.3 : Réception et Analyse des Offres
 *
 * Gère la réception, l'analyse et la comparaison des offres :
 * - Contrôle de conformité (administrative, technique, financière)
 * - Analyse financière (comparaison estimation, détection anomalies)
 * - Analyse technique (notation mémoire, références)
 * - Génération tableau comparatif
 */

import { supabase } from '@/lib/supabase';
import type { Phase0Project } from '@/types/phase0/project.types';
import type { EstimationRange } from '@/types/phase0/common.types';
import { EstimationService } from '@/services/phase0/estimation.service';

import type {
  Offre,
  StatutOffre,
  ConformiteOffre,
  VerificationConformite,
  EcartTechnique,
  AnomalieFinanciere,
  ContenuOffre,
  AnalyseOffre,
  AnalyseFinanciere,
  AnalyseLot,
  AlertePrix,
  AnalyseTechnique,
  NotationSection,
  AnalysePlanning,
  SyntheseAnalyse,
  RecommandationOffre,
  ScoreOffre,
  ScoreCritereOffre,
  TableauComparatif,
  OffreComparee,
  BadgeOffre,
  StatistiquesComparaison,
  RecommandationComparatif,
  Consultation,
  PriseReference,
} from '@/types/phase1/offre.types';
import type { CriteresSelection, CritereSelection } from '@/types/phase1/dce.types';

// =============================================================================
// TYPES INTERNES
// =============================================================================

export interface OffreAnalysisInput {
  offre: Offre;
  project: Phase0Project;
  criteres: CriteresSelection;
  autresOffres?: Offre[];
}

export interface OffreAnalysisResult {
  success: boolean;
  offre: Offre;
  erreurs?: string[];
}

export interface TableauComparatifInput {
  consultation: Consultation;
  project: Phase0Project;
  criteres: CriteresSelection;
}

// =============================================================================
// SERVICE
// =============================================================================

export class OffreService {
  /**
   * Analyse complète d'une offre
   */
  static async analyzeOffre(input: OffreAnalysisInput): Promise<OffreAnalysisResult> {
    const { offre, project, criteres, autresOffres } = input;

    try {
      // 1. Contrôle de conformité
      const conformite = this.checkConformite(offre);

      // 2. Analyse financière
      const analyseFinanciere = this.analyzeFinanciere(offre, project, autresOffres);

      // 3. Analyse technique
      const analyseTechnique = this.analyzeTechnique(offre, criteres);

      // 4. Analyse planning
      const analysePlanning = this.analyzePlanning(offre, project);

      // 5. Synthèse
      const synthese = this.generateSynthese(
        conformite,
        analyseFinanciere,
        analyseTechnique,
        analysePlanning
      );

      // Construire l'analyse complète
      const analyse: AnalyseOffre = {
        dateAnalyse: new Date().toISOString(),
        financiere: analyseFinanciere,
        technique: analyseTechnique,
        planning: analysePlanning,
        synthese,
      };

      // 6. Calculer le score
      const scoreOffre = this.calculateScore(offre, criteres, analyse, autresOffres);

      // Mettre à jour l'offre
      const offreAnalysee: Offre = {
        ...offre,
        conformite,
        analyse,
        scoreOffre,
        statut: conformite.estConforme ? 'conforme' : 'non_conforme',
      };

      // Sauvegarder
      await this.saveOffre(offreAnalysee);

      return {
        success: true,
        offre: offreAnalysee,
      };
    } catch (error) {
      console.error('[Offre] Analysis error:', error);
      return {
        success: false,
        offre,
        erreurs: [error instanceof Error ? error.message : 'Erreur inconnue'],
      };
    }
  }

  /**
   * Génère le tableau comparatif des offres
   */
  static generateTableauComparatif(input: TableauComparatifInput): TableauComparatif {
    const { consultation, project, criteres } = input;
    const offres = consultation.offresRecues.filter((o) => o.statut !== 'rejetee');

    // Calculer les statistiques
    const statistiques = this.calculateStatistics(offres);

    // Comparer chaque offre
    const offresComparees: OffreComparee[] = offres
      .filter((o) => o.scoreOffre)
      .sort((a, b) => (b.scoreOffre?.scoreGlobal || 0) - (a.scoreOffre?.scoreGlobal || 0))
      .map((offre, index) => this.createOffreComparee(offre, index + 1, statistiques));

    // Générer la recommandation
    const recommandation = this.generateRecommandation(offresComparees, statistiques);

    return {
      consultationId: consultation.id,
      dateGeneration: new Date().toISOString(),
      offres: offresComparees,
      criteres: criteres.criteres.map((c) => ({
        id: c.id,
        nom: c.nom,
        poids: c.poids,
        type: this.getCritereType(c.id),
      })),
      statistiques,
      recommandation,
    };
  }

  /**
   * Prend une référence auprès d'un ancien client
   */
  static async takePriseReference(
    offreId: string,
    referenceId: string,
    reponses: PriseReference['reponses']
  ): Promise<PriseReference> {
    // Calculer la note globale
    const notesNumeriques = reponses
      .filter((r) => typeof r.note === 'number')
      .map((r) => r.note as number);
    const noteGlobale = notesNumeriques.length > 0
      ? notesNumeriques.reduce((a, b) => a + b, 0) / notesNumeriques.length
      : 5;

    // Déterminer si recommandé
    const questionRecommande = reponses.find((r) =>
      r.question.toLowerCase().includes('recommand')
    );
    const recommande = questionRecommande?.reponse.toLowerCase() === 'oui' ||
      questionRecommande?.note ? questionRecommande.note >= 7 : noteGlobale >= 7;

    const priseReference: PriseReference = {
      id: crypto.randomUUID(),
      offreId,
      entrepriseId: '', // À remplir depuis l'offre
      referenceId,
      contact: {
        nom: '',
        telephone: '',
        dateContact: new Date().toISOString(),
      },
      reponses,
      noteGlobale,
      recommande,
      commentaireGlobal: reponses.find((r) =>
        r.question.toLowerCase().includes('commentaire')
      )?.reponse || '',
    };

    return priseReference;
  }

  // =============================================================================
  // MÉTHODES PRIVÉES - CONFORMITÉ
  // =============================================================================

  private static checkConformite(offre: Offre): ConformiteOffre {
    const administrative = this.checkConformiteAdministrative(offre);
    const technique = this.checkConformiteTechnique(offre);
    const financiere = this.checkConformiteFinanciere(offre);

    // Collecter les non-conformités éliminatoires
    const nonConformitesEliminatoires: string[] = [];
    const nonConformitesNonEliminatoires: string[] = [];

    [...administrative.verifications, ...technique.verifications, ...financiere.verifications]
      .filter((v) => !v.conforme)
      .forEach((v) => {
        if (v.eliminatoire) {
          nonConformitesEliminatoires.push(v.element);
        } else {
          nonConformitesNonEliminatoires.push(v.element);
        }
      });

    return {
      administrative,
      technique,
      financiere,
      estConforme: nonConformitesEliminatoires.length === 0,
      nonConformitesEliminatoires,
      nonConformitesNonEliminatoires,
    };
  }

  private static checkConformiteAdministrative(offre: Offre): ConformiteOffre['administrative'] {
    const verifications: VerificationConformite[] = [];
    const piecesManquantes: string[] = [];
    const piecesNonConformes: string[] = [];

    // Vérifier les documents
    const documentsRequis = [
      { type: 'acte_engagement', nom: 'Acte d\'engagement', eliminatoire: true },
      { type: 'dpgf', nom: 'DPGF', eliminatoire: true },
      { type: 'memoire_technique', nom: 'Mémoire technique', eliminatoire: true },
      { type: 'kbis', nom: 'Extrait Kbis', eliminatoire: true },
      { type: 'assurance_decennale', nom: 'Attestation RC décennale', eliminatoire: true },
      { type: 'attestation_urssaf', nom: 'Attestation Urssaf', eliminatoire: false },
      { type: 'attestation_fiscale', nom: 'Attestation fiscale', eliminatoire: false },
    ];

    documentsRequis.forEach((docReq) => {
      const doc = offre.documents.find((d) => d.type === docReq.type);
      const present = !!doc;
      const valide = doc?.valide ?? false;

      verifications.push({
        id: docReq.type,
        element: docReq.nom,
        attendu: 'Document présent et valide',
        constate: present ? (valide ? 'Présent et valide' : 'Présent mais non valide') : 'Absent',
        conforme: present && valide,
        eliminatoire: docReq.eliminatoire,
      });

      if (!present) piecesManquantes.push(docReq.nom);
      else if (!valide) piecesNonConformes.push(docReq.nom);
    });

    return {
      estConforme: verifications.filter((v) => v.eliminatoire && !v.conforme).length === 0,
      verifications,
      piecesManquantes,
      piecesNonConformes,
    };
  }

  private static checkConformiteTechnique(offre: Offre): ConformiteOffre['technique'] {
    const verifications: VerificationConformite[] = [];
    const ecarts: EcartTechnique[] = [];

    // Vérifier la présence du mémoire technique
    const memoireTechnique = offre.contenu.technique;
    verifications.push({
      id: 'memoire_structure',
      element: 'Structure mémoire technique',
      attendu: 'Structure conforme au cadre imposé',
      constate: memoireTechnique.structureRespectee ? 'Conforme' : 'Non conforme',
      conforme: memoireTechnique.structureRespectee,
      eliminatoire: false,
    });

    // Vérifier les sections présentes
    const sectionsManquantes = memoireTechnique.sectionsPresentes
      .filter((s) => !s.presente)
      .map((s) => s.titre);

    if (sectionsManquantes.length > 0) {
      verifications.push({
        id: 'sections_manquantes',
        element: 'Sections du mémoire',
        attendu: 'Toutes les sections présentes',
        constate: `Sections manquantes: ${sectionsManquantes.join(', ')}`,
        conforme: false,
        eliminatoire: false,
      });
    }

    // Vérifier le planning
    const planning = offre.contenu.planning;
    verifications.push({
      id: 'planning_coherent',
      element: 'Planning d\'exécution',
      attendu: 'Planning cohérent et réaliste',
      constate: planning.coherent ? 'Cohérent' : 'Incohérent',
      conforme: planning.coherent,
      eliminatoire: false,
    });

    return {
      estConforme: verifications.filter((v) => v.eliminatoire && !v.conforme).length === 0,
      verifications,
      ecarts,
    };
  }

  private static checkConformiteFinanciere(offre: Offre): ConformiteOffre['financiere'] {
    const verifications: VerificationConformite[] = [];
    const anomalies: AnomalieFinanciere[] = [];

    const financier = offre.contenu.financier;

    // Vérifier que le DPGF est complet
    const dpgf = financier.dpgf;
    const postesVides = dpgf.lots.flatMap((l) =>
      l.postes.filter((p) => p.prixUnitaireHT === 0 || !p.prixUnitaireHT)
    );

    if (postesVides.length > 0) {
      anomalies.push({
        id: 'postes_vides',
        type: 'poste_vide',
        description: `${postesVides.length} poste(s) sans prix`,
        gravite: 'warning',
      });
    }

    // Vérifier les calculs arithmétiques
    let erreurCalcul = false;
    dpgf.lots.forEach((lot) => {
      const sommePosts = lot.postes.reduce((sum, p) => sum + (p.totalHT || 0), 0);
      if (Math.abs(sommePosts - lot.sousTotalHT) > 1) {
        erreurCalcul = true;
        anomalies.push({
          id: `erreur_lot_${lot.numero}`,
          type: 'erreur_arithmetique',
          description: `Erreur de calcul lot ${lot.numero}`,
          gravite: 'error',
          details: { calculé: sommePosts, déclaré: lot.sousTotalHT },
        });
      }
    });

    verifications.push({
      id: 'calculs_arithmetiques',
      element: 'Calculs arithmétiques',
      attendu: 'Totaux corrects',
      constate: erreurCalcul ? 'Erreurs détectées' : 'Corrects',
      conforme: !erreurCalcul,
      eliminatoire: false,
    });

    // Vérifier la TVA
    const tvaCalculee = financier.totalHT * financier.tauxTVA / 100;
    const tvaDiff = Math.abs(tvaCalculee - financier.montantTVA);
    if (tvaDiff > 1) {
      anomalies.push({
        id: 'tva_incorrecte',
        type: 'tva_incorrecte',
        description: 'Montant TVA incorrect',
        gravite: 'error',
        details: { calculée: tvaCalculee, déclarée: financier.montantTVA },
      });
    }

    return {
      estConforme: anomalies.filter((a) => a.gravite === 'error').length === 0,
      verifications,
      anomalies,
    };
  }

  // =============================================================================
  // MÉTHODES PRIVÉES - ANALYSE FINANCIÈRE
  // =============================================================================

  private static analyzeFinanciere(
    offre: Offre,
    project: Phase0Project,
    autresOffres?: Offre[]
  ): AnalyseFinanciere {
    const estimation = EstimationService.estimateProject(project);
    const montantOffre = offre.contenu.financier.totalHT;
    const estimationTORP: EstimationRange = estimation?.budget?.total || { min: 0, max: 0 };

    // Comparaison avec estimation TORP
    const ecartPourcentage = estimationTORP.max > 0
      ? ((montantOffre - ((estimationTORP.min + estimationTORP.max) / 2)) /
        ((estimationTORP.min + estimationTORP.max) / 2)) * 100
      : 0;

    const position: 'inferieur' | 'dans_fourchette' | 'superieur' =
      montantOffre < estimationTORP.min
        ? 'inferieur'
        : montantOffre > estimationTORP.max
          ? 'superieur'
          : 'dans_fourchette';

    // Comparaison avec autres offres
    let comparaisonOffres;
    if (autresOffres && autresOffres.length > 0) {
      const prixOffres = autresOffres
        .map((o) => o.contenu.financier.totalHT)
        .filter((p) => p > 0)
        .sort((a, b) => a - b);

      if (prixOffres.length > 0) {
        const medianeOffres = prixOffres[Math.floor(prixOffres.length / 2)];
        const rang = prixOffres.filter((p) => p < montantOffre).length + 1;

        comparaisonOffres = {
          medianeOffres,
          ecartMediane: ((montantOffre - medianeOffres) / medianeOffres) * 100,
          rang,
          totalOffres: prixOffres.length + 1,
        };
      }
    }

    // Analyse par lot
    const analyseParLot = this.analyzeLotsFinanciers(offre, project);

    // Détection des alertes
    const alertes = this.detectAlertesFinancieres(offre, estimationTORP, analyseParLot);

    // Note financière
    const noteFinanciere = this.calculateNoteFinanciere(
      ecartPourcentage,
      alertes,
      comparaisonOffres?.ecartMediane
    );

    return {
      comparaisonEstimation: {
        estimationTORP,
        montantOffre,
        ecartPourcentage,
        position,
      },
      comparaisonOffres,
      analyseParLot,
      ratios: this.calculateRatios(offre, project),
      alertes,
      noteFinanciere,
    };
  }

  private static analyzeLotsFinanciers(offre: Offre, project: Phase0Project): AnalyseLot[] {
    const estimation = EstimationService.estimateProject(project);
    const dpgf = offre.contenu.financier.dpgf;
    const totalHT = offre.contenu.financier.totalHT;

    return dpgf.lots.map((lot) => {
      const lotEstimation = estimation?.budget?.byLot?.find((l) =>
        l.lotType.toLowerCase().includes(lot.designation.toLowerCase().substring(0, 5))
      );

      const montantEstimation: EstimationRange = lotEstimation?.estimate || { min: 0, max: 0 };
      const moyenneEstimation = (montantEstimation.min + montantEstimation.max) / 2;
      const ecart = moyenneEstimation > 0
        ? ((lot.sousTotalHT - moyenneEstimation) / moyenneEstimation) * 100
        : 0;

      return {
        lotId: lot.numero,
        designation: lot.designation,
        montantOffre: lot.sousTotalHT,
        montantEstimation,
        ecartPourcentage: Math.round(ecart),
        pourcentageTotal: totalHT > 0 ? Math.round((lot.sousTotalHT / totalHT) * 100) : 0,
        alerte: Math.abs(ecart) > 30,
        commentaire: Math.abs(ecart) > 30
          ? ecart > 0 ? 'Prix supérieur à l\'estimation' : 'Prix inférieur à l\'estimation'
          : undefined,
      };
    });
  }

  private static detectAlertesFinancieres(
    offre: Offre,
    estimation: EstimationRange,
    analyseParLot: AnalyseLot[]
  ): AlertePrix[] {
    const alertes: AlertePrix[] = [];
    const montantOffre = offre.contenu.financier.totalHT;
    const moyenneEstimation = (estimation.min + estimation.max) / 2;

    // Alerte prix global
    if (montantOffre < estimation.min * 0.7) {
      alertes.push({
        type: 'trop_bas',
        element: 'Prix global',
        description: 'Prix anormalement bas (< 70% estimation)',
        severite: 'warning',
        valeurConstatee: montantOffre,
        valeurAttendue: moyenneEstimation,
      });
    } else if (montantOffre > estimation.max * 1.3) {
      alertes.push({
        type: 'trop_haut',
        element: 'Prix global',
        description: 'Prix élevé (> 130% estimation)',
        severite: 'info',
        valeurConstatee: montantOffre,
        valeurAttendue: moyenneEstimation,
      });
    }

    // Alertes par lot
    analyseParLot
      .filter((l) => l.alerte)
      .forEach((lot) => {
        alertes.push({
          type: lot.ecartPourcentage < 0 ? 'trop_bas' : 'trop_haut',
          element: `Lot ${lot.designation}`,
          description: `Écart ${lot.ecartPourcentage > 0 ? '+' : ''}${lot.ecartPourcentage}% vs estimation`,
          severite: Math.abs(lot.ecartPourcentage) > 50 ? 'warning' : 'info',
          valeurConstatee: lot.montantOffre,
          valeurAttendue: (lot.montantEstimation.min + lot.montantEstimation.max) / 2,
        });
      });

    // Alerte déséquilibre lots
    const pourcentages = analyseParLot.map((l) => l.pourcentageTotal);
    const maxPourcentage = Math.max(...pourcentages);
    if (maxPourcentage > 50) {
      const lotMajoritaire = analyseParLot.find((l) => l.pourcentageTotal === maxPourcentage);
      alertes.push({
        type: 'desequilibre',
        element: `Lot ${lotMajoritaire?.designation}`,
        description: `Ce lot représente ${maxPourcentage}% du total`,
        severite: 'info',
        valeurConstatee: maxPourcentage,
      });
    }

    return alertes;
  }

  private static calculateRatios(
    offre: Offre,
    project: Phase0Project
  ): AnalyseFinanciere['ratios'] {
    const surface = project.property?.surface || 100;
    const totalHT = offre.contenu.financier.totalHT;

    return {
      prixM2: totalHT / surface,
    };
  }

  private static calculateNoteFinanciere(
    ecartEstimation: number,
    alertes: AlertePrix[],
    ecartMediane?: number
  ): number {
    let note = 100;

    // Pénalité écart estimation
    if (Math.abs(ecartEstimation) > 30) note -= 20;
    else if (Math.abs(ecartEstimation) > 20) note -= 10;
    else if (Math.abs(ecartEstimation) > 10) note -= 5;

    // Pénalité alertes
    alertes.forEach((a) => {
      if (a.severite === 'error') note -= 15;
      else if (a.severite === 'warning') note -= 8;
      else note -= 3;
    });

    // Bonus si proche médiane
    if (ecartMediane !== undefined && Math.abs(ecartMediane) < 5) {
      note += 5;
    }

    return Math.max(0, Math.min(100, note));
  }

  // =============================================================================
  // MÉTHODES PRIVÉES - ANALYSE TECHNIQUE
  // =============================================================================

  private static analyzeTechnique(offre: Offre, criteres: CriteresSelection): AnalyseTechnique {
    const memoireTechnique = offre.contenu.technique;

    // Notation des sections
    const notationSections = this.noteSectionsMT(memoireTechnique);

    // Analyse équipe
    const analyseEquipe = this.analyzeEquipe(memoireTechnique);

    // Analyse méthodologie
    const analyseMethodologie = this.analyzeMethodologie(memoireTechnique);

    // Analyse moyens
    const analyseMoyens = this.analyzeMoyens(memoireTechnique);

    // Analyse références
    const analyseReferences = this.analyzeReferences(offre.entreprise);

    // Note technique globale
    const noteTechnique = this.calculateNoteTechnique(
      notationSections,
      analyseEquipe.noteEquipe,
      analyseMethodologie.noteMethodologie,
      analyseMoyens.noteMoyens
    );

    return {
      notationSections,
      analyseEquipe,
      analyseMethodologie,
      analyseMoyens,
      analyseReferences,
      noteTechnique,
    };
  }

  private static noteSectionsMT(memoireTechnique: ContenuOffre['technique']): NotationSection[] {
    return memoireTechnique.sectionsPresentes.map((section) => {
      let noteObtenue = 0;
      const noteMax = 100;
      const qualiteToNote: Record<string, number> = {
        excellent: 100,
        bon: 80,
        moyen: 60,
        insuffisant: 30,
      };

      if (section.presente && section.qualiteContenu) {
        noteObtenue = qualiteToNote[section.qualiteContenu] || 50;
      }

      return {
        sectionId: String(section.numero),
        titre: section.titre,
        noteObtenue,
        noteMax,
        poids: 12.5, // 8 sections = 12.5% chacune
        commentaire: section.presente
          ? `Qualité: ${section.qualiteContenu || 'non évaluée'}`
          : 'Section absente',
      };
    });
  }

  private static analyzeEquipe(
    memoireTechnique: ContenuOffre['technique']
  ): AnalyseTechnique['analyseEquipe'] {
    const equipe = memoireTechnique.extractionAuto?.equipeProposee || [];
    const points: string[] = [];
    const alertes: string[] = [];

    // Points positifs
    if (equipe.length >= 3) points.push('Équipe suffisante');
    const hasChef = equipe.some((p) =>
      p.fonction.toLowerCase().includes('chef') ||
      p.fonction.toLowerCase().includes('conducteur')
    );
    if (hasChef) points.push('Encadrement identifié');

    // Alertes
    if (equipe.length < 2) alertes.push('Équipe sous-dimensionnée');
    if (!hasChef) alertes.push('Pas d\'encadrement identifié');

    const noteEquipe = Math.max(0, Math.min(100, 50 + points.length * 15 - alertes.length * 20));

    return { noteEquipe, points, alertes };
  }

  private static analyzeMethodologie(
    memoireTechnique: ContenuOffre['technique']
  ): AnalyseTechnique['analyseMethodologie'] {
    const phases = memoireTechnique.extractionAuto?.phasesProposees || [];
    const points: string[] = [];
    const alertes: string[] = [];

    if (phases.length >= 4) points.push('Phasage détaillé');
    if (phases.some((p) => p.predecesseurs && p.predecesseurs.length > 0)) {
      points.push('Dépendances identifiées');
    }

    if (phases.length < 2) alertes.push('Phasage insuffisant');

    const noteMethodologie = Math.max(0, Math.min(100, 50 + points.length * 20 - alertes.length * 25));

    return { noteMethodologie, points, alertes };
  }

  private static analyzeMoyens(
    memoireTechnique: ContenuOffre['technique']
  ): AnalyseTechnique['analyseMoyens'] {
    const materiel = memoireTechnique.extractionAuto?.materielPropose || [];
    const points: string[] = [];
    const alertes: string[] = [];

    if (materiel.length >= 3) points.push('Moyens matériels suffisants');
    if (materiel.some((m) => m.toLowerCase().includes('echafaudage'))) {
      points.push('Échafaudage prévu');
    }

    if (materiel.length === 0) alertes.push('Aucun moyen matériel mentionné');

    const noteMoyens = Math.max(0, Math.min(100, 60 + points.length * 15 - alertes.length * 20));

    return { noteMoyens, points, alertes };
  }

  private static analyzeReferences(
    entreprise: Offre['entreprise']
  ): AnalyseTechnique['analyseReferences'] {
    const references = entreprise.references || [];
    const referencesVerifiees = references.filter((r) => r.verifie).length;
    const referencesValidees = references.filter(
      (r) => r.verifie && (r.noteClient || 0) >= 4
    ).length;

    // Note basée sur les références
    let noteReferences = 50;
    noteReferences += referencesVerifiees * 10;
    noteReferences += referencesValidees * 5;
    noteReferences = Math.min(100, noteReferences);

    return {
      noteReferences,
      referencesVerifiees,
      referencesValidees,
    };
  }

  private static calculateNoteTechnique(
    notationSections: NotationSection[],
    noteEquipe: number,
    noteMethodologie: number,
    noteMoyens: number
  ): number {
    // Moyenne pondérée des sections
    const totalPoids = notationSections.reduce((sum, s) => sum + s.poids, 0);
    const noteSections = totalPoids > 0
      ? notationSections.reduce((sum, s) => sum + (s.noteObtenue * s.poids), 0) / totalPoids
      : 50;

    // Moyenne avec les autres critères
    return Math.round((noteSections * 0.4) + (noteEquipe * 0.25) + (noteMethodologie * 0.25) + (noteMoyens * 0.1));
  }

  // =============================================================================
  // MÉTHODES PRIVÉES - ANALYSE PLANNING
  // =============================================================================

  private static analyzePlanning(offre: Offre, project: Phase0Project): AnalysePlanning {
    const planning = offre.contenu.planning;
    const estimation = EstimationService.estimateProject(project);

    // Délai demandé vs proposé
    const delaiDemande = estimation?.duration?.totalWeeks?.max
      ? estimation.duration.totalWeeks.max * 7
      : 60;
    const delaiPropose = planning.dureeJours;
    const ecartJours = delaiPropose - delaiDemande;

    // Cohérence
    const coherence = {
      estCoherent: planning.coherent,
      observations: planning.observations || [],
    };

    // Analyse des phases
    const analysePhases = {
      nombrePhases: planning.phases.length,
      phasesCritiques: planning.phases
        .filter((p) => p.duree > delaiPropose * 0.3)
        .map((p) => p.nom),
      marges: Math.max(0, delaiDemande - delaiPropose),
    };

    // Note planning
    let notePlanning = 70;
    if (delaiPropose <= delaiDemande) notePlanning += 20;
    else if (ecartJours <= 7) notePlanning += 10;
    else notePlanning -= Math.min(30, ecartJours);

    if (planning.coherent) notePlanning += 10;
    if (planning.phases.length >= 4) notePlanning += 5;

    notePlanning = Math.max(0, Math.min(100, notePlanning));

    return {
      coherence,
      comparaisonDelai: {
        delaiDemande,
        delaiPropose,
        ecartJours,
        respect: delaiPropose <= delaiDemande,
      },
      analysePhases,
      notePlanning,
    };
  }

  // =============================================================================
  // MÉTHODES PRIVÉES - SYNTHÈSE ET SCORE
  // =============================================================================

  private static generateSynthese(
    conformite: ConformiteOffre,
    analyseFinanciere: AnalyseFinanciere,
    analyseTechnique: AnalyseTechnique,
    analysePlanning: AnalysePlanning
  ): SyntheseAnalyse {
    const pointsForts: string[] = [];
    const pointsFaibles: string[] = [];
    const pointsVigilance: string[] = [];
    const questionsAPoser: string[] = [];

    // Points forts
    if (analyseFinanciere.noteFinanciere >= 80) pointsForts.push('Prix compétitif');
    if (analyseTechnique.noteTechnique >= 80) pointsForts.push('Mémoire technique de qualité');
    if (analysePlanning.notePlanning >= 80) pointsForts.push('Planning réaliste');
    if (analyseTechnique.analyseReferences.referencesValidees >= 3) {
      pointsForts.push('Bonnes références');
    }

    // Points faibles
    if (analyseFinanciere.noteFinanciere < 50) pointsFaibles.push('Prix hors marché');
    if (analyseTechnique.noteTechnique < 50) pointsFaibles.push('Mémoire technique insuffisant');
    if (analysePlanning.notePlanning < 50) pointsFaibles.push('Planning peu réaliste');

    // Points de vigilance
    if (!conformite.estConforme) {
      pointsVigilance.push(...conformite.nonConformitesNonEliminatoires.slice(0, 3));
    }
    analyseFinanciere.alertes.forEach((a) => {
      if (a.severite === 'warning') pointsVigilance.push(a.description);
    });

    // Questions à poser
    if (analyseFinanciere.comparaisonEstimation.position === 'inferieur') {
      questionsAPoser.push('Justifier le prix bas - risque de sous-estimation ?');
    }
    if (analyseTechnique.analyseEquipe.alertes.length > 0) {
      questionsAPoser.push('Préciser l\'organisation de l\'équipe');
    }
    if (!analysePlanning.coherence.estCoherent) {
      questionsAPoser.push('Revoir le planning proposé');
    }

    // Recommandation
    const noteGlobale = (analyseFinanciere.noteFinanciere + analyseTechnique.noteTechnique + analysePlanning.notePlanning) / 3;
    let recommandation: RecommandationOffre;

    if (!conformite.estConforme) recommandation = 'defavorable';
    else if (noteGlobale >= 80) recommandation = 'tres_favorable';
    else if (noteGlobale >= 65) recommandation = 'favorable';
    else if (noteGlobale >= 50) recommandation = 'acceptable';
    else recommandation = 'defavorable';

    const commentaireGlobal = `Note globale: ${Math.round(noteGlobale)}/100. ${
      recommandation === 'tres_favorable'
        ? 'Offre très compétitive, à retenir.'
        : recommandation === 'favorable'
          ? 'Bonne offre, à considérer.'
          : recommandation === 'acceptable'
            ? 'Offre acceptable avec réserves.'
            : 'Offre à écarter ou à demander des compléments.'
    }`;

    return {
      pointsForts,
      pointsFaibles,
      pointsVigilance,
      questionsAPoser,
      recommandation,
      commentaireGlobal,
    };
  }

  private static calculateScore(
    offre: Offre,
    criteres: CriteresSelection,
    analyse: AnalyseOffre,
    autresOffres?: Offre[]
  ): ScoreOffre {
    const scores: ScoreCritereOffre[] = [];

    criteres.criteres.forEach((critere) => {
      const scoreObtenu = this.getScoreForCritere(critere.id, offre, analyse, autresOffres);
      scores.push({
        critereId: critere.id,
        critereName: critere.nom,
        poids: critere.poids,
        scoreObtenu,
        scorePondere: (scoreObtenu * critere.poids) / 100,
      });
    });

    const scoreGlobal = Math.round(scores.reduce((sum, s) => sum + s.scorePondere, 0));

    // Classement
    let classement;
    if (autresOffres && autresOffres.length > 0) {
      const scoresAutres = autresOffres
        .map((o) => o.scoreOffre?.scoreGlobal || 0)
        .filter((s) => s > 0);
      const rang = scoresAutres.filter((s) => s > scoreGlobal).length + 1;
      classement = {
        rang,
        totalOffres: scoresAutres.length + 1,
      };
    }

    return {
      scoreGlobal,
      scores,
      classement,
      dateCalcul: new Date().toISOString(),
    };
  }

  private static getScoreForCritere(
    critereId: string,
    offre: Offre,
    analyse: AnalyseOffre,
    autresOffres?: Offre[]
  ): number {
    switch (critereId) {
      case 'prix':
        return this.scorePrix(offre, autresOffres);
      case 'valeur_technique':
        return analyse.technique.noteTechnique;
      case 'references':
        return Math.min(100, analyse.technique.analyseReferences.noteReferences);
      case 'methodologie':
        return analyse.technique.analyseMethodologie.noteMethodologie;
      case 'delai':
        return analyse.planning.notePlanning;
      case 'moyens':
        return analyse.technique.analyseMoyens.noteMoyens;
      case 'environnement':
        return 70; // Valeur par défaut, à enrichir
      default:
        return 50;
    }
  }

  private static scorePrix(offre: Offre, autresOffres?: Offre[]): number {
    if (!autresOffres || autresOffres.length === 0) return 50;

    const prixOffre = offre.contenu.financier.totalHT;
    const prixMin = Math.min(
      prixOffre,
      ...autresOffres.map((o) => o.contenu.financier.totalHT)
    );

    // Formule: Note = (Prix min / Prix offre) * 100
    return Math.round((prixMin / prixOffre) * 100);
  }

  // =============================================================================
  // MÉTHODES PRIVÉES - TABLEAU COMPARATIF
  // =============================================================================

  private static calculateStatistics(offres: Offre[]): StatistiquesComparaison {
    const prix = offres.map((o) => o.contenu.financier.totalHT).sort((a, b) => a - b);
    const delais = offres.map((o) => o.contenu.planning.dureeJours);
    const notesTechniques = offres
      .map((o) => o.analyse?.technique.noteTechnique || 0)
      .filter((n) => n > 0);

    const mean = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
    const stdDev = (arr: number[]) => {
      const m = mean(arr);
      return Math.sqrt(arr.reduce((sum, x) => sum + Math.pow(x - m, 2), 0) / arr.length);
    };

    return {
      nombreOffres: offres.length,
      prixMoyen: Math.round(mean(prix)),
      prixMedian: prix[Math.floor(prix.length / 2)] || 0,
      prixMin: Math.min(...prix),
      prixMax: Math.max(...prix),
      delaiMoyen: Math.round(mean(delais)),
      noteTechniqueMoyenne: Math.round(mean(notesTechniques)),
      ecartTypesPrix: Math.round(stdDev(prix)),
    };
  }

  private static createOffreComparee(
    offre: Offre,
    rang: number,
    stats: StatistiquesComparaison
  ): OffreComparee {
    const badges: BadgeOffre[] = [];

    // Badge meilleur prix
    if (offre.contenu.financier.totalHT === stats.prixMin) {
      badges.push({
        type: 'meilleur_prix',
        label: 'Moins-disant',
        couleur: 'green',
      });
    }

    // Badge meilleur technique
    if (offre.analyse?.technique.noteTechnique === Math.max(...[stats.noteTechniqueMoyenne])) {
      badges.push({
        type: 'meilleur_technique',
        label: 'Mieux-disant technique',
        couleur: 'blue',
      });
    }

    // Badge recommandé
    if (rang === 1) {
      badges.push({
        type: 'recommande',
        label: 'Recommandé',
        couleur: 'gold',
      });
    }

    return {
      offreId: offre.id,
      entreprise: {
        id: offre.entrepriseId,
        nom: offre.entreprise.identification.raisonSociale,
        scoreEntreprise: offre.entreprise.scoreTORP?.scoreGlobal,
      },
      montantHT: offre.contenu.financier.totalHT,
      delaiJours: offre.contenu.planning.dureeJours,
      noteTechnique: offre.analyse?.technique.noteTechnique || 0,
      scoreGlobal: offre.scoreOffre?.scoreGlobal || 0,
      scores: offre.scoreOffre?.scores.reduce(
        (acc, s) => ({ ...acc, [s.critereId]: s.scoreObtenu }),
        {}
      ) || {},
      rang,
      badges,
    };
  }

  private static generateRecommandation(
    offres: OffreComparee[],
    stats: StatistiquesComparaison
  ): RecommandationComparatif {
    const offreRecommandee = offres[0]; // La première (meilleur score)
    const alternativesViables = offres
      .slice(1, 3)
      .map((o) => o.offreId);

    const pointsVigilance: string[] = [];
    if (offreRecommandee.montantHT < stats.prixMoyen * 0.8) {
      pointsVigilance.push('Prix significativement inférieur à la moyenne');
    }
    if (offreRecommandee.delaiJours > stats.delaiMoyen * 1.2) {
      pointsVigilance.push('Délai supérieur à la moyenne');
    }

    return {
      offreRecommandeeId: offreRecommandee.offreId,
      justification: `Offre ${offreRecommandee.entreprise.nom} recommandée avec un score global de ${offreRecommandee.scoreGlobal}/100, combinant un prix de ${offreRecommandee.montantHT.toLocaleString('fr-FR')}€ HT et une note technique de ${offreRecommandee.noteTechnique}/100.`,
      alternativesViables,
      pointsVigilance,
    };
  }

  private static getCritereType(critereId: string): 'prix' | 'technique' | 'delai' | 'autre' {
    if (critereId === 'prix') return 'prix';
    if (critereId === 'delai') return 'delai';
    if (['valeur_technique', 'methodologie', 'references', 'moyens'].includes(critereId)) {
      return 'technique';
    }
    return 'autre';
  }

  // =============================================================================
  // PERSISTANCE
  // =============================================================================

  static async saveOffre(offre: Offre): Promise<void> {
    const { error } = await supabase.from('phase1_offres').upsert({
      id: offre.id,
      consultation_id: offre.consultationId,
      entreprise_id: offre.entrepriseId,
      entreprise: offre.entreprise,
      statut: offre.statut,
      date_reception: offre.dateReception,
      conformite: offre.conformite,
      contenu: offre.contenu,
      analyse: offre.analyse,
      score_offre: offre.scoreOffre,
      documents: offre.documents,
      historique: offre.historique,
    });

    if (error) {
      throw new Error(`Erreur lors de la sauvegarde de l'offre: ${error.message}`);
    }
  }

  static async getOffreById(id: string): Promise<Offre | null> {
    const { data, error } = await supabase
      .from('phase1_offres')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Erreur lors de la récupération de l'offre: ${error.message}`);
    }

    return data as unknown as Offre;
  }

  static async getOffresByConsultation(consultationId: string): Promise<Offre[]> {
    const { data, error } = await supabase
      .from('phase1_offres')
      .select('*')
      .eq('consultation_id', consultationId);

    if (error) {
      throw new Error(`Erreur lors de la récupération des offres: ${error.message}`);
    }

    return (data || []) as unknown as Offre[];
  }
}

export default OffreService;
