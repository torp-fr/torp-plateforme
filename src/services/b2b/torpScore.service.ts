/**
 * TorpScoreService - Analyse TORP des propositions commerciales B2B
 * Permet à l'entreprise d'optimiser sa proposition avant envoi au client
 */

import {
  PropositionCommerciale,
  TorpScoreAnalysis,
  DimensionCompetitivite,
  DimensionCompletude,
  DimensionClarte,
  DimensionConformite,
  DimensionCoherencePhase0,
  DimensionAttractivite,
  RecommandationTorpScore,
  ActionSuggeree,
  ElementCompletude,
} from '@/types/torpScore.types';
import { Phase0Project } from '@/types/phase0.types';
import { PriceReferenceService } from '@/services/extraction/price-reference.service';

// Poids des dimensions (total = 100%)
const DIMENSION_WEIGHTS = {
  competitivite: 25,
  completude: 20,
  clarte: 15,
  conformite: 15,
  coherencePhase0: 15,
  attractivite: 10,
};

// Éléments obligatoires par catégorie
const ELEMENTS_OBLIGATOIRES: ElementCompletude[] = [
  // Administratif
  { categorie: 'administratif', element: 'SIRET entreprise', importance: 'obligatoire', present: false },
  { categorie: 'administratif', element: 'Raison sociale', importance: 'obligatoire', present: false },
  { categorie: 'administratif', element: 'Adresse entreprise', importance: 'obligatoire', present: false },
  { categorie: 'administratif', element: 'Attestation assurance RC', importance: 'obligatoire', present: false },
  { categorie: 'administratif', element: 'Attestation décennale', importance: 'obligatoire', present: false },
  { categorie: 'administratif', element: 'Certification RGE (si applicable)', importance: 'recommande', present: false },

  // Technique
  { categorie: 'technique', element: 'Description détaillée des travaux', importance: 'obligatoire', present: false },
  { categorie: 'technique', element: 'Méthodologie d\'intervention', importance: 'recommande', present: false },
  { categorie: 'technique', element: 'Références chantiers similaires', importance: 'recommande', present: false },
  { categorie: 'technique', element: 'Normes et DTU applicables', importance: 'recommande', present: false },

  // Financier
  { categorie: 'financier', element: 'Détail des prix unitaires', importance: 'obligatoire', present: false },
  { categorie: 'financier', element: 'Décomposition MO/Fournitures', importance: 'recommande', present: false },
  { categorie: 'financier', element: 'Total HT', importance: 'obligatoire', present: false },
  { categorie: 'financier', element: 'TVA détaillée', importance: 'obligatoire', present: false },
  { categorie: 'financier', element: 'Total TTC', importance: 'obligatoire', present: false },
  { categorie: 'financier', element: 'Échéancier de paiement', importance: 'obligatoire', present: false },

  // Planning
  { categorie: 'planning', element: 'Date début proposée', importance: 'obligatoire', present: false },
  { categorie: 'planning', element: 'Durée des travaux', importance: 'obligatoire', present: false },
  { categorie: 'planning', element: 'Jalons intermédiaires', importance: 'recommande', present: false },
  { categorie: 'planning', element: 'Planning détaillé', importance: 'recommande', present: false },

  // Garanties
  { categorie: 'garanties', element: 'Durée validité devis', importance: 'obligatoire', present: false },
  { categorie: 'garanties', element: 'Garantie parfait achèvement', importance: 'obligatoire', present: false },
  { categorie: 'garanties', element: 'Garantie biennale', importance: 'obligatoire', present: false },
  { categorie: 'garanties', element: 'Garantie décennale', importance: 'obligatoire', present: false },
  { categorie: 'garanties', element: 'CGV', importance: 'obligatoire', present: false },
];

export class TorpScoreService {
  /**
   * Analyse complète d'une proposition commerciale B2B
   */
  static async analyzeProposition(
    proposition: PropositionCommerciale,
    phase0Project: Phase0Project
  ): Promise<TorpScoreAnalysis> {
    // Analyser chaque dimension
    const competitivite = await this.analyzeCompetitivite(proposition, phase0Project);
    const completude = this.analyzeCompletude(proposition);
    const clarte = this.analyzeClarte(proposition);
    const conformite = this.analyzeConformite(proposition);
    const coherencePhase0 = this.analyzeCoherencePhase0(proposition, phase0Project);
    const attractivite = this.analyzeAttractivite(proposition);

    // Calculer le score global pondéré
    const scoreGlobal = Math.round(
      competitivite.score * (DIMENSION_WEIGHTS.competitivite / 100) +
      completude.score * (DIMENSION_WEIGHTS.completude / 100) +
      clarte.score * (DIMENSION_WEIGHTS.clarte / 100) +
      conformite.score * (DIMENSION_WEIGHTS.conformite / 100) +
      coherencePhase0.score * (DIMENSION_WEIGHTS.coherencePhase0 / 100) +
      attractivite.score * (DIMENSION_WEIGHTS.attractivite / 100)
    );

    // Déterminer le grade
    const grade = this.calculateGrade(scoreGlobal);

    // Générer les recommandations prioritaires
    const recommandations = this.generateRecommandations(
      competitivite,
      completude,
      clarte,
      conformite,
      coherencePhase0,
      attractivite
    );

    // Calculer la probabilité d'acceptation
    const probabiliteAcceptation = this.calculateProbabiliteAcceptation(
      scoreGlobal,
      competitivite,
      coherencePhase0
    );

    // Identifier points forts et faibles
    const { pointsForts, pointsFaibles } = this.identifyStrengthsWeaknesses(
      competitivite,
      completude,
      clarte,
      conformite,
      coherencePhase0,
      attractivite
    );

    // Générer les actions suggérées
    const actionsSuggerees = this.generateActionsSuggerees(recommandations);

    // Benchmark marché
    const benchmark = await this.generateBenchmark(proposition, phase0Project);

    return {
      id: `torp-score-${Date.now()}`,
      propositionId: proposition.id,
      dateAnalyse: new Date(),
      scoreGlobal,
      grade,
      dimensions: {
        competitivite,
        completude,
        clarte,
        conformite,
        coherencePhase0,
        attractivite,
      },
      probabiliteAcceptation,
      recommandations,
      pointsForts,
      pointsFaibles,
      actionsSuggerees,
      benchmark,
    };
  }

  /**
   * Analyse de la compétitivité prix
   */
  private static async analyzeCompetitivite(
    proposition: PropositionCommerciale,
    phase0Project: Phase0Project
  ): Promise<DimensionCompetitivite> {
    const totalTTC = proposition.chiffrage.totalTTC;

    // Récupérer les prix de référence du marché
    const workTypes = phase0Project.workTypes || [];
    let prixMarcheEstime = 0;
    let comparisons: { type: string; ecart: number }[] = [];

    for (const workType of workTypes) {
      const priceRef = PriceReferenceService.getPriceReference(workType);
      if (priceRef) {
        // Estimer le prix marché basé sur la surface/quantité
        const surface = phase0Project.property?.livingArea || 100;
        const prixMoyen = (priceRef.prixMin + priceRef.prixMax) / 2;
        prixMarcheEstime += prixMoyen * surface * 0.1; // Approximation
      }
    }

    // Si pas de référence, utiliser le budget Phase 0
    if (prixMarcheEstime === 0 && phase0Project.budget?.maxBudget) {
      prixMarcheEstime = phase0Project.budget.maxBudget;
    }

    // Calculer l'écart
    const ecartMarche = prixMarcheEstime > 0
      ? ((totalTTC - prixMarcheEstime) / prixMarcheEstime) * 100
      : 0;

    // Déterminer la position
    let position: 'tres_bas' | 'bas' | 'marche' | 'eleve' | 'tres_eleve';
    if (ecartMarche < -20) position = 'tres_bas';
    else if (ecartMarche < -5) position = 'bas';
    else if (ecartMarche <= 10) position = 'marche';
    else if (ecartMarche <= 25) position = 'eleve';
    else position = 'tres_eleve';

    // Score compétitivité (favorise les prix au marché ou légèrement en dessous)
    let scorePrix = 100;
    if (position === 'tres_bas') scorePrix = 60; // Trop bas = méfiance
    else if (position === 'bas') scorePrix = 90;
    else if (position === 'marche') scorePrix = 100;
    else if (position === 'eleve') scorePrix = 70;
    else scorePrix = 40;

    // Analyser le rapport qualité/prix
    const hasDetailedBreakdown = proposition.chiffrage.lots.some(lot =>
      lot.lignes.some(l => l.decomposition !== undefined)
    );
    const rapportQP = hasDetailedBreakdown ? 85 : 65;

    // Estimer la marge brute
    let totalMO = 0;
    let totalFournitures = 0;
    proposition.chiffrage.lots.forEach(lot => {
      totalMO += lot.totalMO;
      totalFournitures += lot.totalFournitures;
    });
    const margeBrute = ((proposition.chiffrage.totalHT - totalFournitures * 0.8) / proposition.chiffrage.totalHT) * 100;
    const margeAcceptable = margeBrute >= 15 && margeBrute <= 45;

    // Score final compétitivité
    const score = Math.round((scorePrix * 0.5) + (rapportQP * 0.3) + (margeAcceptable ? 100 : 60) * 0.2);

    const recommandations: string[] = [];
    if (position === 'tres_eleve') {
      recommandations.push('Votre prix est significativement au-dessus du marché. Justifiez cette différence ou ajustez.');
    }
    if (position === 'tres_bas') {
      recommandations.push('Prix très bas - risque de méfiance client. Assurez-vous que votre marge est viable.');
    }
    if (!hasDetailedBreakdown) {
      recommandations.push('Ajoutez une décomposition MO/Fournitures pour plus de transparence.');
    }

    return {
      score,
      poids: DIMENSION_WEIGHTS.competitivite,
      analyse: {
        prixVsMarche: {
          ecart: Math.round(ecartMarche * 10) / 10,
          position,
          detail: `Votre proposition à ${totalTTC.toLocaleString('fr-FR')}€ TTC est ${
            position === 'marche' ? 'dans la moyenne du marché' :
            position === 'bas' || position === 'tres_bas' ? 'en dessous du marché' :
            'au-dessus du marché'
          }.`,
        },
        rapportQualitePrix: {
          score: rapportQP,
          justification: hasDetailedBreakdown
            ? 'Bonne transparence avec décomposition détaillée'
            : 'Manque de détail sur la décomposition des prix',
        },
        margeBrute: {
          estimee: Math.round(margeBrute),
          acceptable: margeAcceptable,
          commentaire: margeAcceptable
            ? 'Marge raisonnable permettant un travail de qualité'
            : margeBrute < 15
              ? 'Marge faible - attention à la viabilité'
              : 'Marge élevée - le client pourrait négocier',
        },
      },
      recommandations,
    };
  }

  /**
   * Analyse de la complétude du dossier
   */
  private static analyzeCompletude(proposition: PropositionCommerciale): DimensionCompletude {
    const elements = [...ELEMENTS_OBLIGATOIRES];

    // Vérifier chaque élément
    // Administratif
    elements.find(e => e.element === 'SIRET entreprise')!.present = true; // Supposé présent
    elements.find(e => e.element === 'Raison sociale')!.present = true;
    elements.find(e => e.element === 'Adresse entreprise')!.present = true;

    const hasRCDoc = proposition.documentsJoints.some(d => d.type === 'assurance_rc');
    elements.find(e => e.element === 'Attestation assurance RC')!.present = hasRCDoc;

    const hasDecennaleDoc = proposition.documentsJoints.some(d => d.type === 'assurance_decennale');
    elements.find(e => e.element === 'Attestation décennale')!.present = hasDecennaleDoc;

    const hasRGE = proposition.documentsJoints.some(d => d.type === 'qualification');
    elements.find(e => e.element === 'Certification RGE (si applicable)')!.present = hasRGE;

    // Technique
    const hasDescriptionTravaux = proposition.chiffrage.lots.length > 0 &&
      proposition.chiffrage.lots.every(l => l.description || l.lignes.every(li => li.description));
    elements.find(e => e.element === 'Description détaillée des travaux')!.present = hasDescriptionTravaux;

    elements.find(e => e.element === 'Méthodologie d\'intervention')!.present =
      !!proposition.memoireTechnique?.methodologie?.description;

    elements.find(e => e.element === 'Références chantiers similaires')!.present =
      (proposition.memoireTechnique?.presentationEntreprise?.references?.length || 0) > 0;

    // Financier
    elements.find(e => e.element === 'Détail des prix unitaires')!.present =
      proposition.chiffrage.lots.some(l => l.lignes.some(li => li.prixUnitaireHT > 0));

    elements.find(e => e.element === 'Décomposition MO/Fournitures')!.present =
      proposition.chiffrage.lots.some(l => l.totalMO > 0 || l.totalFournitures > 0);

    elements.find(e => e.element === 'Total HT')!.present = proposition.chiffrage.totalHT > 0;
    elements.find(e => e.element === 'TVA détaillée')!.present = proposition.chiffrage.detailsTVA.length > 0;
    elements.find(e => e.element === 'Total TTC')!.present = proposition.chiffrage.totalTTC > 0;

    elements.find(e => e.element === 'Échéancier de paiement')!.present =
      (proposition.conditionsCommerciales?.modalitesPaiement?.echeancier?.length || 0) > 0;

    // Planning
    elements.find(e => e.element === 'Date début proposée')!.present =
      !!proposition.planningPrevisionnel?.dateDebutProposee;

    elements.find(e => e.element === 'Durée des travaux')!.present =
      (proposition.planningPrevisionnel?.dureeTotaleJours || 0) > 0;

    elements.find(e => e.element === 'Jalons intermédiaires')!.present =
      (proposition.planningPrevisionnel?.jalons?.length || 0) > 1;

    // Garanties
    elements.find(e => e.element === 'Durée validité devis')!.present =
      (proposition.conditionsCommerciales?.dureeValiditeJours || 0) > 0;

    elements.find(e => e.element === 'Garantie parfait achèvement')!.present =
      proposition.conditionsCommerciales?.garanties?.parfaitAchevement || false;

    elements.find(e => e.element === 'Garantie biennale')!.present =
      proposition.conditionsCommerciales?.garanties?.biennale || false;

    elements.find(e => e.element === 'Garantie décennale')!.present =
      proposition.conditionsCommerciales?.garanties?.decennale || false;

    elements.find(e => e.element === 'CGV')!.present =
      proposition.conditionsCommerciales?.conditionsParticulieres !== undefined;

    // Calculer le taux de complétude
    const obligatoires = elements.filter(e => e.importance === 'obligatoire');
    const obligatoiresPresents = obligatoires.filter(e => e.present).length;
    const tauxObligatoire = (obligatoiresPresents / obligatoires.length) * 100;

    const recommandes = elements.filter(e => e.importance === 'recommande');
    const recommandesPresents = recommandes.filter(e => e.present).length;
    const tauxRecommande = recommandes.length > 0 ? (recommandesPresents / recommandes.length) * 100 : 100;

    const tauxCompletude = Math.round((tauxObligatoire * 0.7) + (tauxRecommande * 0.3));

    // Score basé sur le taux de complétude
    const score = Math.round(tauxCompletude);

    const recommandations: string[] = [];
    const manquantsObligatoires = elements.filter(e => e.importance === 'obligatoire' && !e.present);
    if (manquantsObligatoires.length > 0) {
      recommandations.push(`Éléments obligatoires manquants : ${manquantsObligatoires.map(e => e.element).join(', ')}`);
    }

    const manquantsRecommandes = elements.filter(e => e.importance === 'recommande' && !e.present);
    if (manquantsRecommandes.length > 0) {
      recommandations.push(`Éléments recommandés manquants : ${manquantsRecommandes.map(e => e.element).join(', ')}`);
    }

    return {
      score,
      poids: DIMENSION_WEIGHTS.completude,
      analyse: {
        elementsPresents: elements.filter(e => e.present),
        elementsManquants: elements.filter(e => !e.present),
        tauxCompletude,
      },
      elementsObligatoires: obligatoires.map(e => ({
        element: e.element,
        present: e.present,
        critique: e.importance === 'obligatoire',
      })),
      recommandations,
    };
  }

  /**
   * Analyse de la clarté et lisibilité
   */
  private static analyzeClarte(proposition: PropositionCommerciale): DimensionClarte {
    let scoreLisibilite = 80;
    let scoreStructuration = 80;
    let scorePrecision = 80;
    let scoreProfessionnalisme = 80;

    const problemes: string[] = [];
    const elementsVagues: string[] = [];
    const pointsPro: string[] = [];

    // Vérifier la structuration des lots
    if (proposition.chiffrage.lots.length > 0) {
      scoreStructuration += 10;
      pointsPro.push('Découpage en lots clair');
    } else {
      scoreStructuration -= 20;
      problemes.push('Pas de découpage en lots');
    }

    // Vérifier les descriptions
    let lignesSansDescription = 0;
    proposition.chiffrage.lots.forEach(lot => {
      lot.lignes.forEach(ligne => {
        if (!ligne.description || ligne.description.length < 10) {
          lignesSansDescription++;
        }
      });
    });

    if (lignesSansDescription > 0) {
      scorePrecision -= lignesSansDescription * 5;
      elementsVagues.push(`${lignesSansDescription} ligne(s) sans description détaillée`);
    }

    // Vérifier le mémoire technique
    if (proposition.memoireTechnique?.methodologie?.phasage?.length > 0) {
      scoreStructuration += 10;
      scoreProfessionnalisme += 10;
      pointsPro.push('Phasage méthodologique détaillé');
    }

    // Vérifier les engagements
    if (proposition.memoireTechnique?.engagements) {
      const { qualite, environnement, securite } = proposition.memoireTechnique.engagements;
      if ((qualite?.length || 0) > 0) pointsPro.push('Engagements qualité formalisés');
      if ((environnement?.length || 0) > 0) pointsPro.push('Engagement environnemental');
      if ((securite?.length || 0) > 0) pointsPro.push('Engagement sécurité');
    }

    // Plafonner les scores
    scoreLisibilite = Math.min(100, Math.max(0, scoreLisibilite));
    scoreStructuration = Math.min(100, Math.max(0, scoreStructuration));
    scorePrecision = Math.min(100, Math.max(0, scorePrecision));
    scoreProfessionnalisme = Math.min(100, Math.max(0, scoreProfessionnalisme));

    const score = Math.round(
      (scoreLisibilite * 0.25) +
      (scoreStructuration * 0.25) +
      (scorePrecision * 0.25) +
      (scoreProfessionnalisme * 0.25)
    );

    const recommandations: string[] = [];
    if (problemes.length > 0) {
      recommandations.push(`Améliorer la lisibilité : ${problemes.join(', ')}`);
    }
    if (elementsVagues.length > 0) {
      recommandations.push('Préciser les descriptions des prestations');
    }
    if (scoreProfessionnalisme < 80) {
      recommandations.push('Renforcer l\'image professionnelle avec des engagements formalisés');
    }

    return {
      score,
      poids: DIMENSION_WEIGHTS.clarte,
      analyse: {
        lisibilite: { score: scoreLisibilite, problemes },
        structuration: {
          score: scoreStructuration,
          commentaire: scoreStructuration >= 80
            ? 'Bonne organisation du document'
            : 'Structure à améliorer',
        },
        precision: { score: scorePrecision, elementsVagues },
        professionnalisme: { score: scoreProfessionnalisme, points: pointsPro },
      },
      recommandations,
    };
  }

  /**
   * Analyse de la conformité réglementaire
   */
  private static analyzeConformite(proposition: PropositionCommerciale): DimensionConformite {
    const mentionsPresentes: string[] = [];
    const mentionsManquantes: string[] = [];
    const alertes: { niveau: 'critique' | 'important' | 'mineur'; message: string }[] = [];

    // Vérifier les documents joints
    const docs = proposition.documentsJoints;
    const hasRC = docs.some(d => d.type === 'assurance_rc');
    const hasDecennale = docs.some(d => d.type === 'assurance_decennale');
    const hasKbis = docs.some(d => d.type === 'kbis');
    const hasQualification = docs.some(d => d.type === 'qualification');

    // Mentions légales
    mentionsPresentes.push('SIRET'); // Supposé présent dans l'entreprise
    if (hasKbis) mentionsPresentes.push('Kbis');
    else mentionsManquantes.push('Kbis');

    // Assurances
    if (!hasRC) {
      alertes.push({ niveau: 'critique', message: 'Attestation RC Pro manquante' });
    }
    if (!hasDecennale) {
      alertes.push({ niveau: 'critique', message: 'Attestation décennale manquante' });
    }

    // Vérifier validité des documents
    const docsExpires = docs.filter(d => d.dateValidite && new Date(d.dateValidite) < new Date());
    docsExpires.forEach(d => {
      alertes.push({ niveau: 'important', message: `Document expiré : ${d.nom}` });
    });

    // CGV
    const hasCGV = proposition.conditionsCommerciales?.conditionsParticulieres !== undefined;
    if (!hasCGV) {
      mentionsManquantes.push('CGV');
      alertes.push({ niveau: 'important', message: 'Conditions générales de vente manquantes' });
    }

    // Garanties légales
    const garanties = proposition.conditionsCommerciales?.garanties;
    if (!garanties?.parfaitAchevement) {
      alertes.push({ niveau: 'mineur', message: 'Garantie parfait achèvement non mentionnée' });
    }
    if (!garanties?.decennale) {
      alertes.push({ niveau: 'important', message: 'Garantie décennale non mentionnée' });
    }

    // Calculer le score
    const critiques = alertes.filter(a => a.niveau === 'critique').length;
    const importants = alertes.filter(a => a.niveau === 'important').length;
    const mineurs = alertes.filter(a => a.niveau === 'mineur').length;

    let score = 100 - (critiques * 25) - (importants * 10) - (mineurs * 5);
    score = Math.max(0, Math.min(100, score));

    const recommandations: string[] = [];
    if (critiques > 0) {
      recommandations.push('URGENT : Ajoutez les attestations d\'assurance obligatoires');
    }
    if (!hasCGV) {
      recommandations.push('Ajoutez vos conditions générales de vente');
    }
    if (docsExpires.length > 0) {
      recommandations.push('Mettez à jour vos documents expirés');
    }

    return {
      score,
      poids: DIMENSION_WEIGHTS.conformite,
      analyse: {
        mentionsLegales: {
          presentes: mentionsPresentes,
          manquantes: mentionsManquantes,
          conformes: mentionsManquantes.length === 0,
        },
        assurances: {
          rcPro: { present: hasRC, valide: hasRC },
          decennale: { present: hasDecennale, valide: hasDecennale, activitesCouvertes: hasDecennale },
        },
        certifications: {
          rge: { present: hasQualification, coherent: hasQualification },
          qualibat: { present: false },
          autres: [],
        },
        cgv: {
          presentes: hasCGV,
          conformesLoi: hasCGV,
          alertes: hasCGV ? [] : ['CGV non fournies'],
        },
      },
      alertes,
      recommandations,
    };
  }

  /**
   * Analyse de la cohérence avec la Phase 0
   */
  private static analyzeCoherencePhase0(
    proposition: PropositionCommerciale,
    phase0Project: Phase0Project
  ): DimensionCoherencePhase0 {
    const besoinsCouverts: string[] = [];
    const besoinsNonCouverts: string[] = [];
    const conformites: string[] = [];
    const ecarts: string[] = [];

    // Vérifier la couverture des types de travaux
    const workTypes = phase0Project.workTypes || [];
    const lotsDesignations = proposition.chiffrage.lots.map(l => l.designation.toLowerCase());

    workTypes.forEach(workType => {
      const workTypeLower = workType.toLowerCase();
      const covered = lotsDesignations.some(d =>
        d.includes(workTypeLower) ||
        workTypeLower.includes(d.split(' ')[0])
      );
      if (covered) {
        besoinsCouverts.push(workType);
      } else {
        besoinsNonCouverts.push(workType);
      }
    });

    const scoreCouverture = workTypes.length > 0
      ? (besoinsCouverts.length / workTypes.length) * 100
      : 80;

    // Cohérence budget
    const budgetMax = phase0Project.budget?.maxBudget || 0;
    const propositionTTC = proposition.chiffrage.totalTTC;
    const ecartBudget = budgetMax > 0
      ? ((propositionTTC - budgetMax) / budgetMax) * 100
      : 0;

    let scoreBudget = 100;
    if (ecartBudget > 30) scoreBudget = 40;
    else if (ecartBudget > 15) scoreBudget = 60;
    else if (ecartBudget > 0) scoreBudget = 80;
    else scoreBudget = 100;

    // Cohérence planning
    const delaiSouhaite = phase0Project.timeline?.desiredStartDate;
    const delaiPropose = proposition.planningPrevisionnel?.dateDebutProposee;
    const coherentPlanning = !delaiSouhaite || !delaiPropose ||
      new Date(delaiPropose) <= new Date(new Date(delaiSouhaite).getTime() + 30 * 24 * 60 * 60 * 1000);

    const scorePlanning = coherentPlanning ? 100 : 60;

    // Score global cohérence
    const score = Math.round(
      (scoreCouverture * 0.4) +
      (scoreBudget * 0.35) +
      (scorePlanning * 0.25)
    );

    const recommandations: string[] = [];
    if (besoinsNonCouverts.length > 0) {
      recommandations.push(`Travaux non couverts : ${besoinsNonCouverts.join(', ')}`);
    }
    if (ecartBudget > 15) {
      recommandations.push(`Votre proposition dépasse le budget client de ${Math.round(ecartBudget)}%`);
    }
    if (!coherentPlanning) {
      recommandations.push('Le délai proposé ne correspond pas aux attentes du client');
    }

    return {
      score,
      poids: DIMENSION_WEIGHTS.coherencePhase0,
      analyse: {
        couvertureBesoin: {
          score: Math.round(scoreCouverture),
          besoinsCouverts,
          besoinsNonCouverts,
        },
        respectCCTP: {
          score: Math.round(scoreCouverture),
          conformites,
          ecarts,
        },
        coherenceBudget: {
          budgetPhase0: budgetMax,
          propositionTTC,
          ecart: Math.round(ecartBudget),
          commentaire: ecartBudget > 15
            ? 'Proposition au-dessus du budget prévu'
            : ecartBudget < -10
              ? 'Proposition significativement sous le budget'
              : 'Dans la fourchette budgétaire',
        },
        coherencePlanning: {
          delaiPhase0: delaiSouhaite?.toString() || 'Non défini',
          delaiPropose: delaiPropose?.toString() || 'Non défini',
          coherent: coherentPlanning,
          commentaire: coherentPlanning
            ? 'Planning cohérent avec les attentes'
            : 'Délai à ajuster',
        },
      },
      recommandations,
    };
  }

  /**
   * Analyse de l'attractivité de la proposition
   */
  private static analyzeAttractivite(proposition: PropositionCommerciale): DimensionAttractivite {
    const differenciateurs: string[] = [];
    const valeursAjoutees: string[] = [];
    const pointsFortsEntreprise: string[] = [];
    const ameliorations: string[] = [];

    // Vérifier les références
    const references = proposition.memoireTechnique?.presentationEntreprise?.references || [];
    const refsPertinentes = references.filter(r => r.typeTravauxSimilaires).length;

    if (refsPertinentes >= 3) {
      differenciateurs.push('Nombreuses références similaires');
    } else if (refsPertinentes >= 1) {
      pointsFortsEntreprise.push('Références pertinentes');
    } else {
      ameliorations.push('Ajoutez des références de chantiers similaires');
    }

    // Vérifier les certifications
    const certifications = proposition.memoireTechnique?.presentationEntreprise?.certifications || [];
    if (certifications.includes('RGE')) {
      differenciateurs.push('Certification RGE');
    }
    if (certifications.some(c => c.toLowerCase().includes('qualibat'))) {
      differenciateurs.push('Qualification Qualibat');
    }

    // Vérifier les engagements
    if (proposition.memoireTechnique?.engagements?.environnement?.length) {
      valeursAjoutees.push('Engagement environnemental');
    }
    if (proposition.memoireTechnique?.engagements?.qualite?.length) {
      valeursAjoutees.push('Engagement qualité formalisé');
    }

    // Vérifier les points forts déclarés
    const pointsForts = proposition.memoireTechnique?.pointsForts || [];
    if (pointsForts.length > 0) {
      differenciateurs.push(...pointsForts.slice(0, 3));
    } else {
      ameliorations.push('Mettez en avant vos points forts');
    }

    // Options proposées
    if ((proposition.chiffrage.options?.length || 0) > 0) {
      valeursAjoutees.push('Options personnalisées proposées');
    }

    // Calculer les scores
    const scoreDiff = Math.min(100, 60 + differenciateurs.length * 10);
    const scoreVA = valeursAjoutees.length > 0 ? 'fort' : differenciateurs.length > 0 ? 'moyen' : 'faible';
    const scorePres = Math.min(100, 50 + pointsFortsEntreprise.length * 10 + differenciateurs.length * 5);
    const qualiteRef = refsPertinentes >= 3 ? 'excellente' :
      refsPertinentes >= 2 ? 'bonne' :
      refsPertinentes >= 1 ? 'moyenne' : 'faible';

    const score = Math.round(
      (scoreDiff * 0.3) +
      (scoreVA === 'fort' ? 100 : scoreVA === 'moyen' ? 70 : 40) * 0.25 +
      (scorePres * 0.25) +
      (refsPertinentes >= 2 ? 100 : refsPertinentes >= 1 ? 70 : 40) * 0.2
    );

    const recommandations: string[] = [];
    if (differenciateurs.length < 2) {
      recommandations.push('Identifiez et mettez en avant vos éléments différenciants');
    }
    if (refsPertinentes < 2) {
      recommandations.push('Ajoutez des références de chantiers similaires');
    }
    if (ameliorations.length > 0) {
      recommandations.push(...ameliorations);
    }

    return {
      score,
      poids: DIMENSION_WEIGHTS.attractivite,
      analyse: {
        differenciateurs: {
          identifies: differenciateurs,
          score: scoreDiff,
        },
        valeursAjoutees: {
          elements: valeursAjoutees,
          impact: scoreVA as 'fort' | 'moyen' | 'faible',
        },
        presentationEntreprise: {
          score: scorePres,
          pointsForts: pointsFortsEntreprise,
          ameliorations,
        },
        references: {
          pertinentes: refsPertinentes,
          qualite: qualiteRef,
        },
      },
      recommandations,
    };
  }

  /**
   * Calcule le grade basé sur le score global
   */
  private static calculateGrade(score: number): 'A+' | 'A' | 'B' | 'C' | 'D' | 'F' {
    if (score >= 90) return 'A+';
    if (score >= 80) return 'A';
    if (score >= 70) return 'B';
    if (score >= 60) return 'C';
    if (score >= 50) return 'D';
    return 'F';
  }

  /**
   * Génère les recommandations prioritaires
   */
  private static generateRecommandations(
    competitivite: DimensionCompetitivite,
    completude: DimensionCompletude,
    clarte: DimensionClarte,
    conformite: DimensionConformite,
    coherencePhase0: DimensionCoherencePhase0,
    attractivite: DimensionAttractivite
  ): RecommandationTorpScore[] {
    const recommandations: RecommandationTorpScore[] = [];
    let id = 1;

    // Recommandations critiques (conformité)
    conformite.alertes
      .filter(a => a.niveau === 'critique')
      .forEach(alerte => {
        recommandations.push({
          id: `rec-${id++}`,
          priorite: 'critique',
          categorie: 'conformite',
          titre: 'Document obligatoire manquant',
          description: alerte.message,
          impact: { surScore: 15, surAcceptation: 20 },
          actionRequise: 'Ajoutez ce document immédiatement',
          effort: 'faible',
        });
      });

    // Recommandations prix
    if (competitivite.analyse.prixVsMarche.position === 'tres_eleve') {
      recommandations.push({
        id: `rec-${id++}`,
        priorite: 'haute',
        categorie: 'prix',
        titre: 'Prix au-dessus du marché',
        description: `Votre proposition est ${competitivite.analyse.prixVsMarche.ecart}% au-dessus du marché`,
        impact: { surScore: 10, surAcceptation: 25 },
        actionRequise: 'Ajustez vos prix ou justifiez la différence',
        effort: 'moyen',
      });
    }

    // Recommandations complétude
    const elementsManquantsCritiques = completude.elementsObligatoires.filter(e => !e.present && e.critique);
    if (elementsManquantsCritiques.length > 0) {
      recommandations.push({
        id: `rec-${id++}`,
        priorite: 'haute',
        categorie: 'completude',
        titre: 'Éléments obligatoires manquants',
        description: `${elementsManquantsCritiques.length} élément(s) obligatoire(s) manquant(s)`,
        impact: { surScore: 12, surAcceptation: 15 },
        actionRequise: 'Complétez les éléments manquants',
        effort: 'moyen',
      });
    }

    // Recommandations cohérence Phase 0
    if (coherencePhase0.analyse.coherenceBudget.ecart > 15) {
      recommandations.push({
        id: `rec-${id++}`,
        priorite: 'haute',
        categorie: 'coherence',
        titre: 'Dépassement budget client',
        description: `Votre proposition dépasse le budget de ${coherencePhase0.analyse.coherenceBudget.ecart}%`,
        impact: { surScore: 8, surAcceptation: 30 },
        actionRequise: 'Proposez des alternatives ou variantes',
        effort: 'eleve',
      });
    }

    // Recommandations attractivité
    if (attractivite.score < 60) {
      recommandations.push({
        id: `rec-${id++}`,
        priorite: 'moyenne',
        categorie: 'attractivite',
        titre: 'Proposition peu différenciante',
        description: 'Votre proposition manque d\'éléments distinctifs',
        impact: { surScore: 5, surAcceptation: 10 },
        actionRequise: 'Mettez en avant vos points forts et références',
        effort: 'moyen',
      });
    }

    // Trier par priorité
    const priorityOrder = { critique: 0, haute: 1, moyenne: 2, basse: 3 };
    recommandations.sort((a, b) => priorityOrder[a.priorite] - priorityOrder[b.priorite]);

    return recommandations.slice(0, 10); // Max 10 recommandations
  }

  /**
   * Calcule la probabilité d'acceptation
   */
  private static calculateProbabiliteAcceptation(
    scoreGlobal: number,
    competitivite: DimensionCompetitivite,
    coherencePhase0: DimensionCoherencePhase0
  ) {
    // Base sur le score global
    let proba = scoreGlobal * 0.7;

    // Ajustements
    const facteursFavorables: string[] = [];
    const facteursDefavorables: string[] = [];

    // Prix compétitif
    if (competitivite.analyse.prixVsMarche.position === 'marche' ||
        competitivite.analyse.prixVsMarche.position === 'bas') {
      proba += 10;
      facteursFavorables.push('Prix compétitif');
    } else if (competitivite.analyse.prixVsMarche.position === 'tres_eleve') {
      proba -= 15;
      facteursDefavorables.push('Prix très élevé');
    }

    // Cohérence budget
    if (coherencePhase0.analyse.coherenceBudget.ecart <= 0) {
      proba += 5;
      facteursFavorables.push('Dans le budget client');
    } else if (coherencePhase0.analyse.coherenceBudget.ecart > 20) {
      proba -= 20;
      facteursDefavorables.push('Dépassement budget significatif');
    }

    // Couverture des besoins
    if (coherencePhase0.analyse.couvertureBesoin.besoinsNonCouverts.length === 0) {
      proba += 5;
      facteursFavorables.push('Tous les besoins couverts');
    } else {
      proba -= coherencePhase0.analyse.couvertureBesoin.besoinsNonCouverts.length * 3;
      facteursDefavorables.push('Besoins non couverts');
    }

    proba = Math.min(95, Math.max(5, proba));

    return {
      pourcentage: Math.round(proba),
      facteursFavorables,
      facteursDefavorables,
      comparaisonMarche: competitivite.analyse.prixVsMarche.detail,
    };
  }

  /**
   * Identifie les points forts et faibles
   */
  private static identifyStrengthsWeaknesses(
    competitivite: DimensionCompetitivite,
    completude: DimensionCompletude,
    clarte: DimensionClarte,
    conformite: DimensionConformite,
    coherencePhase0: DimensionCoherencePhase0,
    attractivite: DimensionAttractivite
  ) {
    const pointsForts: string[] = [];
    const pointsFaibles: string[] = [];

    // Compétitivité
    if (competitivite.score >= 80) {
      pointsForts.push('Prix compétitif et transparent');
    } else if (competitivite.score < 60) {
      pointsFaibles.push('Positionnement prix à revoir');
    }

    // Complétude
    if (completude.score >= 90) {
      pointsForts.push('Dossier très complet');
    } else if (completude.score < 70) {
      pointsFaibles.push('Dossier incomplet');
    }

    // Clarté
    if (clarte.score >= 80) {
      pointsForts.push('Proposition claire et structurée');
    } else if (clarte.score < 60) {
      pointsFaibles.push('Manque de clarté');
    }

    // Conformité
    if (conformite.score >= 90) {
      pointsForts.push('Conformité réglementaire');
    } else if (conformite.score < 70) {
      pointsFaibles.push('Problèmes de conformité');
    }

    // Cohérence Phase 0
    if (coherencePhase0.score >= 85) {
      pointsForts.push('Parfaitement adapté au projet');
    } else if (coherencePhase0.score < 60) {
      pointsFaibles.push('Inadéquation avec le projet');
    }

    // Attractivité
    if (attractivite.score >= 80) {
      pointsForts.push('Proposition différenciante');
    } else if (attractivite.score < 50) {
      pointsFaibles.push('Manque de différenciation');
    }

    return { pointsForts, pointsFaibles };
  }

  /**
   * Génère les actions suggérées
   */
  private static generateActionsSuggerees(
    recommandations: RecommandationTorpScore[]
  ): ActionSuggeree[] {
    return recommandations.slice(0, 5).map((rec, index) => ({
      id: `action-${index + 1}`,
      type: rec.categorie === 'prix' ? 'modifier_prix' :
            rec.categorie === 'completude' ? 'ajouter_element' :
            rec.categorie === 'clarte' ? 'reformuler' :
            rec.categorie === 'conformite' ? 'ajouter_document' : 'corriger_erreur',
      cible: rec.titre,
      suggestion: rec.actionRequise,
      priorite: index + 1,
    }));
  }

  /**
   * Génère le benchmark marché
   */
  private static async generateBenchmark(
    proposition: PropositionCommerciale,
    phase0Project: Phase0Project
  ) {
    // Simulation de benchmark (à enrichir avec données réelles)
    const ecartMarche = Math.random() * 30 - 10; // -10% à +20%
    let position: 'tres_competitif' | 'competitif' | 'moyen' | 'eleve' | 'tres_eleve';

    if (ecartMarche < -5) position = 'tres_competitif';
    else if (ecartMarche < 5) position = 'competitif';
    else if (ecartMarche < 15) position = 'moyen';
    else if (ecartMarche < 25) position = 'eleve';
    else position = 'tres_eleve';

    return {
      positionMarche: position,
      ecartMoyenneMarche: Math.round(ecartMarche),
      propositionsSimilairesGagnantes: Math.floor(Math.random() * 100) + 50,
    };
  }
}

export default TorpScoreService;
