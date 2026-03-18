import { log, warn, error, time, timeEnd } from '@/lib/logger';

/**
 * Service d'analyse de la transparence et qualité de documentation du devis
 *
 * Évalue 8 critères de transparence :
 * 1. Mentions légales (SIRET, RCS, assurances, coordonnées)
 * 2. Détail des prestations (descriptions, quantités, unités)
 * 3. Décomposition des prix (MO/fournitures/TVA)
 * 4. Conditions générales (CGV, délais, garanties)
 * 5. Planning prévisionnel (dates, phases)
 * 6. Références techniques (normes, DTU, produits)
 * 7. Éléments visuels (photos, schémas, plans)
 * 8. Certification devis (signature, date, validité)
 */

// ============================================
// TYPES
// ============================================

export interface TransparencyAnalysis {
  // Score global
  scoreTotal: number;           // 0-100
  niveau: 'Excellent' | 'Bon' | 'Acceptable' | 'Insuffisant' | 'Critique';

  // Scores par critère
  criteres: {
    mentionsLegales: CritereScore;
    detailPrestations: CritereScore;
    decompositionPrix: CritereScore;
    conditionsGenerales: CritereScore;
    planningPrevisionnel: CritereScore;
    referencesTechniques: CritereScore;
    elementsVisuels: CritereScore;
    certificationDevis: CritereScore;
  };

  // Synthèse
  pointsForts: string[];
  pointsFaibles: string[];
  recommandations: string[];

  // Détails pour debug
  elementsDetectes: ElementDetecte[];
  elementsManquants: string[];
}

export interface CritereScore {
  nom: string;
  score: number;
  scoreMax: number;
  pourcentage: number;
  niveau: 'Complet' | 'Partiel' | 'Absent';
  details: string[];
  elementsPresents: string[];
  elementsManquants: string[];
}

export interface ElementDetecte {
  type: string;
  valeur: string;
  confiance: number;      // 0-1
  source: 'extraction' | 'inference' | 'pattern';
}

interface ElementConfig {
  poids: number;
  patterns?: RegExp[];
  detection?: string;
  minLength?: number;
}

interface CritereConfig {
  nom: string;
  scoreMax: number;
  elements: Record<string, ElementConfig>;
}

// Configuration des critères
const CRITERES_CONFIG: Record<string, CritereConfig> = {
  mentionsLegales: {
    nom: 'Mentions légales',
    scoreMax: 15,
    elements: {
      siret: { poids: 3, patterns: [/siret\s*[:.]?\s*(\d{14}|\d{3}\s?\d{3}\s?\d{3}\s?\d{5})/i] },
      rcs: { poids: 2, patterns: [/rcs\s+[a-z]+\s*\d+/i, /registre.*commerce/i] },
      capital: { poids: 1, patterns: [/capital\s*(social)?\s*[:.]?\s*[\d\s]+\s*€?/i] },
      tvaIntracommunautaire: { poids: 2, patterns: [/tva\s*(intra|intracommunautaire)?\s*[:.]?\s*fr\s*\d{11}/i] },
      assuranceDecennale: { poids: 3, patterns: [/décennale/i, /assurance\s*(professionnelle|rc)/i] },
      adresseComplete: { poids: 2, patterns: [/\d{5}\s+[a-zéèêëàâäùûüôöîïç\-\s]+/i] },
      telephone: { poids: 1, patterns: [/(?:0|\+33)[1-9](?:[\s.-]?\d{2}){4}/] },
      email: { poids: 1, patterns: [/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i] },
    }
  },

  detailPrestations: {
    nom: 'Détail des prestations',
    scoreMax: 20,
    elements: {
      descriptionsClaires: { poids: 5, minLength: 50 },      // Descriptions > 50 caractères
      quantites: { poids: 4, patterns: [/\d+\s*(m²|ml|m³|u|unité|pièce|lot|forfait|h|jour)/i] },
      localisation: { poids: 3, patterns: [/cuisine|salon|chambre|sdb|salle\s*de\s*bain|wc|entrée|couloir|garage|cave|grenier|combles|terrasse|jardin|extérieur|étage|rdc|rez/i] },
      marquesProduits: { poids: 4, patterns: [/marque|modèle|référence|réf\.|type/i] },
      dimensionsTechniques: { poids: 4, patterns: [/\d+\s*[x×]\s*\d+/i, /épaisseur|largeur|hauteur|longueur|diamètre/i] },
    }
  },

  decompositionPrix: {
    nom: 'Décomposition des prix',
    scoreMax: 15,
    elements: {
      mainOeuvre: { poids: 4, patterns: [/main\s*d['']?\s*œuvre|mo\b|pose|installation|montage/i] },
      fournitures: { poids: 4, patterns: [/fourniture|matéri(aux|el)|produit/i] },
      tvaDetaillee: { poids: 3, patterns: [/tva\s*(\d{1,2}([.,]\d{1,2})?\s*%|à\s*\d)/i, /ht\b.*ttc\b/i] },
      prixUnitaires: { poids: 2, patterns: [/p\.?\s*u\.?|prix\s*unitaire|€\s*\/\s*(m²|ml|u|h)/i] },
      sousTotal: { poids: 2, patterns: [/sous[\s-]?total|total\s*(partiel|lot|poste)/i] },
    }
  },

  conditionsGenerales: {
    nom: 'Conditions générales',
    scoreMax: 10,
    elements: {
      cgv: { poids: 2, patterns: [/conditions?\s*générales?\s*(de\s*vente)?|cgv\b/i] },
      delaiValidite: { poids: 2, patterns: [/valid(e|ité)\s*(\d+\s*(jour|mois)|jusqu)/i, /offre\s*valable/i] },
      delaiExecution: { poids: 2, patterns: [/délai\s*(d['']?\s*exécution|réalisation|travaux)|durée\s*(estimée|prévue)/i] },
      modalitesPaiement: { poids: 2, patterns: [/paiement|acompte|solde|échéance|règlement/i] },
      garanties: { poids: 2, patterns: [/garantie|sav|service\s*après/i] },
    }
  },

  planningPrevisionnel: {
    nom: 'Planning prévisionnel',
    scoreMax: 10,
    elements: {
      dateDebut: { poids: 3, patterns: [/début\s*(des\s*travaux|prévu|chantier)|commenc/i] },
      dateFin: { poids: 3, patterns: [/fin\s*(des\s*travaux|prévue|chantier)|livraison|réception/i] },
      phasage: { poids: 2, patterns: [/phase|étape|tranche|lot\s*\d/i] },
      dureeEstimee: { poids: 2, patterns: [/durée|(\d+)\s*(jour|semaine|mois)/i] },
    }
  },

  referencesTechniques: {
    nom: 'Références techniques',
    scoreMax: 10,
    elements: {
      normesNF: { poids: 3, patterns: [/nf\s*[a-z]?\s*\d+|norme\s*(française|nf)/i] },
      dtu: { poids: 3, patterns: [/dtu\s*\d+/i, /document\s*technique\s*unifié/i] },
      certificationsProduits: { poids: 2, patterns: [/ce\b|acermi|cstb|avis\s*technique|at\s*\d/i] },
      classementFeu: { poids: 2, patterns: [/classement\s*(feu|m\d)|euroclasse|m[0-4]/i] },
    }
  },

  elementsVisuels: {
    nom: 'Éléments visuels',
    scoreMax: 10,
    elements: {
      photos: { poids: 3, detection: 'image' },
      plans: { poids: 4, patterns: [/plan|schéma|croquis|coupe|élévation|vue/i] },
      annexes: { poids: 3, patterns: [/annexe|pièce\s*jointe|document\s*joint|voir\s*ci-joint/i] },
    }
  },

  certificationDevis: {
    nom: 'Certification du devis',
    scoreMax: 10,
    elements: {
      numeroDevis: { poids: 2, patterns: [/devis\s*n[°o]?\s*[:.]?\s*[a-z0-9\-\/]+/i, /référence\s*[:.]?\s*[a-z0-9\-\/]+/i] },
      dateDevis: { poids: 2, patterns: [/(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})|le\s+\d{1,2}\s+(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)/i] },
      signatureZone: { poids: 2, patterns: [/signature|bon\s*pour\s*accord|lu\s*et\s*approuvé|cachet/i] },
      mentionManuscrite: { poids: 2, patterns: [/mention\s*manuscrite|bon\s*pour\s*accord/i] },
      validiteDevis: { poids: 2, patterns: [/valable|validité|expire/i] },
    }
  },
};

// Mapping des noms d'éléments pour l'affichage
const ELEMENT_NAMES: Record<string, string> = {
  siret: 'SIRET',
  rcs: 'RCS',
  capital: 'Capital social',
  tvaIntracommunautaire: 'N° TVA intracommunautaire',
  assuranceDecennale: 'Assurance décennale',
  adresseComplete: 'Adresse complète',
  telephone: 'Téléphone',
  email: 'Email',
  descriptionsClaires: 'Descriptions détaillées',
  quantites: 'Quantités et unités',
  localisation: 'Localisation des travaux',
  marquesProduits: 'Marques/Références produits',
  dimensionsTechniques: 'Dimensions techniques',
  mainOeuvre: 'Main d\'œuvre',
  fournitures: 'Fournitures',
  tvaDetaillee: 'TVA détaillée',
  prixUnitaires: 'Prix unitaires',
  sousTotal: 'Sous-totaux',
  cgv: 'CGV',
  delaiValidite: 'Délai de validité',
  delaiExecution: 'Délai d\'exécution',
  modalitesPaiement: 'Modalités de paiement',
  garanties: 'Garanties',
  dateDebut: 'Date de début',
  dateFin: 'Date de fin',
  phasage: 'Phasage travaux',
  dureeEstimee: 'Durée estimée',
  normesNF: 'Normes NF',
  dtu: 'DTU',
  certificationsProduits: 'Certifications produits',
  classementFeu: 'Classement feu',
  photos: 'Photos',
  plans: 'Plans/Schémas',
  annexes: 'Annexes',
  numeroDevis: 'Numéro de devis',
  dateDevis: 'Date du devis',
  signatureZone: 'Zone signature',
  mentionManuscrite: 'Mention manuscrite',
  validiteDevis: 'Validité du devis',
};

// Recommandations par critère
const RECOMMANDATIONS: Record<string, string> = {
  mentionsLegales: 'Demander les informations légales manquantes',
  detailPrestations: 'Exiger des descriptions plus détaillées des prestations avec quantités et références',
  decompositionPrix: 'Demander une décomposition claire : main d\'œuvre, fournitures, TVA',
  conditionsGenerales: 'Vérifier les conditions de paiement, délais et garanties avant signature',
  planningPrevisionnel: 'Demander un planning prévisionnel avec dates de début et fin',
  referencesTechniques: 'Exiger les références des normes (DTU, NF) et certifications produits',
  elementsVisuels: 'Demander des photos/plans pour mieux visualiser le projet',
  certificationDevis: 'Vérifier que le devis est daté, numéroté et signé',
};

// ============================================
// SERVICE
// ============================================

export interface TransparencyInput {
  texteComplet: string;
  prestations?: Array<{
    description: string;
    quantite?: number;
    unite?: string;
    prixUnitaire?: number;
    prixTotal?: number;
  }>;
  entreprise?: {
    siret?: string;
    nom?: string;
    adresse?: string;
  };
  hasImages?: boolean;
  metadata?: Record<string, unknown>;
}

class TransparencyScoringService {

  /**
   * Analyse complète de la transparence d'un devis
   */
  analyzeTransparency(devisData: TransparencyInput): TransparencyAnalysis {
    const texte = devisData.texteComplet.toLowerCase();
    const elementsDetectes: ElementDetecte[] = [];
    const elementsManquants: string[] = [];

    // Analyser chaque critère
    const criteres: TransparencyAnalysis['criteres'] = {
      mentionsLegales: this.analyzeCritere('mentionsLegales', texte, devisData, elementsDetectes, elementsManquants),
      detailPrestations: this.analyzeCritere('detailPrestations', texte, devisData, elementsDetectes, elementsManquants),
      decompositionPrix: this.analyzeCritere('decompositionPrix', texte, devisData, elementsDetectes, elementsManquants),
      conditionsGenerales: this.analyzeCritere('conditionsGenerales', texte, devisData, elementsDetectes, elementsManquants),
      planningPrevisionnel: this.analyzeCritere('planningPrevisionnel', texte, devisData, elementsDetectes, elementsManquants),
      referencesTechniques: this.analyzeCritere('referencesTechniques', texte, devisData, elementsDetectes, elementsManquants),
      elementsVisuels: this.analyzeCritere('elementsVisuels', texte, devisData, elementsDetectes, elementsManquants),
      certificationDevis: this.analyzeCritere('certificationDevis', texte, devisData, elementsDetectes, elementsManquants),
    };

    // Calcul score total
    const scoreTotal = Object.values(criteres).reduce((sum, c) => sum + c.score, 0);

    // Déterminer le niveau
    const niveau = this.determinerNiveau(scoreTotal);

    // Générer points forts/faibles/recommandations
    const { pointsForts, pointsFaibles, recommandations } = this.genererSynthese(criteres);

    log(`[Transparency] Score: ${scoreTotal}/100 (${niveau})`);

    return {
      scoreTotal,
      niveau,
      criteres,
      pointsForts,
      pointsFaibles,
      recommandations,
      elementsDetectes,
      elementsManquants,
    };
  }

  /**
   * Analyse un critère spécifique
   */
  private analyzeCritere(
    critereKey: string,
    texte: string,
    devisData: TransparencyInput,
    elementsDetectes: ElementDetecte[],
    elementsManquants: string[]
  ): CritereScore {
    const config = CRITERES_CONFIG[critereKey];
    const elementsPresents: string[] = [];
    const critereManquants: string[] = [];
    const details: string[] = [];
    let score = 0;

    for (const [elementKey, elementConfig] of Object.entries(config.elements)) {
      let found = false;

      // Détection par patterns
      if (elementConfig.patterns) {
        for (const pattern of elementConfig.patterns) {
          const match = texte.match(pattern);
          if (match) {
            found = true;
            elementsDetectes.push({
              type: elementKey,
              valeur: match[0],
              confiance: 0.9,
              source: 'pattern',
            });
            break;
          }
        }
      }

      // Détection spéciale pour les images
      if (elementConfig.detection === 'image') {
        if (devisData.hasImages) {
          found = true;
          elementsDetectes.push({
            type: elementKey,
            valeur: 'Images détectées',
            confiance: 1,
            source: 'inference',
          });
        }
      }

      // Détection par longueur minimale (descriptions)
      if (elementConfig.minLength) {
        const prestations = devisData.prestations || [];
        const hasLongDescriptions = prestations.some(
          (p) => p.description && p.description.length >= elementConfig.minLength!
        );
        if (hasLongDescriptions) {
          found = true;
          elementsDetectes.push({
            type: elementKey,
            valeur: `Descriptions détaillées (>${elementConfig.minLength} car.)`,
            confiance: 0.85,
            source: 'inference',
          });
        }
      }

      // Comptabiliser
      if (found) {
        score += elementConfig.poids;
        elementsPresents.push(this.formatElementName(elementKey));
        details.push(`✓ ${this.formatElementName(elementKey)}`);
      } else {
        critereManquants.push(this.formatElementName(elementKey));
        elementsManquants.push(`${config.nom} > ${this.formatElementName(elementKey)}`);
      }
    }

    // Niveau du critère
    const pourcentage = config.scoreMax > 0 ? (score / config.scoreMax) * 100 : 0;
    const niveau: CritereScore['niveau'] =
      pourcentage >= 80 ? 'Complet' :
      pourcentage >= 40 ? 'Partiel' : 'Absent';

    return {
      nom: config.nom,
      score,
      scoreMax: config.scoreMax,
      pourcentage,
      niveau,
      details,
      elementsPresents,
      elementsManquants: critereManquants,
    };
  }

  /**
   * Détermine le niveau global de transparence
   */
  private determinerNiveau(score: number): TransparencyAnalysis['niveau'] {
    if (score >= 85) return 'Excellent';
    if (score >= 70) return 'Bon';
    if (score >= 50) return 'Acceptable';
    if (score >= 30) return 'Insuffisant';
    return 'Critique';
  }

  /**
   * Génère la synthèse (points forts, faibles, recommandations)
   */
  private genererSynthese(criteres: TransparencyAnalysis['criteres']): {
    pointsForts: string[];
    pointsFaibles: string[];
    recommandations: string[];
  } {
    const pointsForts: string[] = [];
    const pointsFaibles: string[] = [];
    const recommandations: string[] = [];

    for (const [key, critere] of Object.entries(criteres)) {
      if (critere.niveau === 'Complet') {
        pointsForts.push(`${critere.nom} complet (${critere.score}/${critere.scoreMax})`);
      } else if (critere.niveau === 'Absent') {
        pointsFaibles.push(`${critere.nom} absent ou très incomplet`);
        recommandations.push(this.getRecommandation(key, critere));
      } else if (critere.pourcentage < 60) {
        pointsFaibles.push(`${critere.nom} insuffisant (${Math.round(critere.pourcentage)}%)`);
        recommandations.push(this.getRecommandation(key, critere));
      }
    }

    // Si peu de points faibles
    if (pointsFaibles.length === 0) {
      pointsForts.push('Documentation globalement complète et professionnelle');
    }

    return { pointsForts, pointsFaibles, recommandations };
  }

  /**
   * Génère une recommandation pour un critère faible
   */
  private getRecommandation(critereKey: string, critere: CritereScore): string {
    const baseReco = RECOMMANDATIONS[critereKey] || `Améliorer ${critere.nom}`;

    if (critere.elementsManquants.length > 0) {
      return `${baseReco} : ${critere.elementsManquants.slice(0, 3).join(', ')}`;
    }

    return baseReco;
  }

  /**
   * Formate le nom d'un élément pour l'affichage
   */
  private formatElementName(key: string): string {
    return ELEMENT_NAMES[key] || key;
  }

  /**
   * Calcul rapide du score de transparence (pour le scoring global)
   */
  quickScore(texteDevis: string, hasImages: boolean = false): number {
    const analysis = this.analyzeTransparency({
      texteComplet: texteDevis,
      hasImages,
    });
    return analysis.scoreTotal;
  }
}

export const transparencyScoringService = new TransparencyScoringService();
export default transparencyScoringService;
