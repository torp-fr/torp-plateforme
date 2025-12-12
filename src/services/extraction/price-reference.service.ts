/**
 * Service de référence des prix BTP
 * Fournit des données de marché pour comparaison et enrichissement
 */

export interface PriceReference {
  categorie: string;
  sousCategorie: string;
  designation: string;
  unite: string;
  prixBas: number;
  prixMoyen: number;
  prixHaut: number;
  source: 'batiprix' | 'artisans' | 'estimation' | 'custom';
  region?: string;
  dateReference: Date;
  notes?: string;
}

export interface PriceComparisonResult {
  lignOriginal: {
    designation: string;
    prixUnitaire?: number;
    total?: number;
    quantite?: number;
    unite?: string;
  };
  reference?: PriceReference;
  ecart: {
    pourcentage: number;
    position: 'bas' | 'moyen' | 'haut' | 'tres_haut' | 'inconnu';
    economieEstimee?: number;
  };
  fiabilite: 'haute' | 'moyenne' | 'basse';
  alertes: string[];
}

/**
 * Base de données locale de référence des prix BTP
 * Ces données sont des estimations moyennes France 2024
 */
const PRICE_DATABASE: PriceReference[] = [
  // === GROS OEUVRE ===
  {
    categorie: 'gros_oeuvre',
    sousCategorie: 'demolition',
    designation: 'Démolition mur porteur',
    unite: 'm²',
    prixBas: 80,
    prixMoyen: 120,
    prixHaut: 180,
    source: 'estimation',
    dateReference: new Date('2024-01-01'),
  },
  {
    categorie: 'gros_oeuvre',
    sousCategorie: 'demolition',
    designation: 'Démolition cloison',
    unite: 'm²',
    prixBas: 15,
    prixMoyen: 25,
    prixHaut: 40,
    source: 'estimation',
    dateReference: new Date('2024-01-01'),
  },
  {
    categorie: 'gros_oeuvre',
    sousCategorie: 'maconnerie',
    designation: 'Mur parpaing 20cm',
    unite: 'm²',
    prixBas: 55,
    prixMoyen: 75,
    prixHaut: 100,
    source: 'estimation',
    dateReference: new Date('2024-01-01'),
  },
  {
    categorie: 'gros_oeuvre',
    sousCategorie: 'maconnerie',
    designation: 'Dalle béton',
    unite: 'm²',
    prixBas: 70,
    prixMoyen: 100,
    prixHaut: 150,
    source: 'estimation',
    dateReference: new Date('2024-01-01'),
  },
  {
    categorie: 'gros_oeuvre',
    sousCategorie: 'maconnerie',
    designation: 'Chape de ragréage',
    unite: 'm²',
    prixBas: 20,
    prixMoyen: 35,
    prixHaut: 50,
    source: 'estimation',
    dateReference: new Date('2024-01-01'),
  },

  // === PLOMBERIE ===
  {
    categorie: 'plomberie',
    sousCategorie: 'sanitaire',
    designation: 'Installation WC suspendu',
    unite: 'u',
    prixBas: 800,
    prixMoyen: 1200,
    prixHaut: 1800,
    source: 'estimation',
    dateReference: new Date('2024-01-01'),
    notes: 'Fourniture + pose',
  },
  {
    categorie: 'plomberie',
    sousCategorie: 'sanitaire',
    designation: 'Installation WC standard',
    unite: 'u',
    prixBas: 300,
    prixMoyen: 450,
    prixHaut: 700,
    source: 'estimation',
    dateReference: new Date('2024-01-01'),
  },
  {
    categorie: 'plomberie',
    sousCategorie: 'sanitaire',
    designation: 'Lavabo + robinetterie',
    unite: 'u',
    prixBas: 400,
    prixMoyen: 650,
    prixHaut: 1000,
    source: 'estimation',
    dateReference: new Date('2024-01-01'),
  },
  {
    categorie: 'plomberie',
    sousCategorie: 'sanitaire',
    designation: 'Baignoire standard',
    unite: 'u',
    prixBas: 600,
    prixMoyen: 900,
    prixHaut: 1500,
    source: 'estimation',
    dateReference: new Date('2024-01-01'),
  },
  {
    categorie: 'plomberie',
    sousCategorie: 'sanitaire',
    designation: 'Douche italienne',
    unite: 'u',
    prixBas: 1500,
    prixMoyen: 2500,
    prixHaut: 4000,
    source: 'estimation',
    dateReference: new Date('2024-01-01'),
  },
  {
    categorie: 'plomberie',
    sousCategorie: 'chauffage',
    designation: 'Radiateur électrique',
    unite: 'u',
    prixBas: 200,
    prixMoyen: 400,
    prixHaut: 700,
    source: 'estimation',
    dateReference: new Date('2024-01-01'),
  },
  {
    categorie: 'plomberie',
    sousCategorie: 'chauffage',
    designation: 'Chaudière gaz condensation',
    unite: 'u',
    prixBas: 3500,
    prixMoyen: 5000,
    prixHaut: 8000,
    source: 'estimation',
    dateReference: new Date('2024-01-01'),
  },
  {
    categorie: 'plomberie',
    sousCategorie: 'chauffage',
    designation: 'Pompe à chaleur air/eau',
    unite: 'u',
    prixBas: 8000,
    prixMoyen: 12000,
    prixHaut: 18000,
    source: 'estimation',
    dateReference: new Date('2024-01-01'),
  },

  // === ELECTRICITE ===
  {
    categorie: 'electricite',
    sousCategorie: 'installation',
    designation: 'Point lumineux',
    unite: 'u',
    prixBas: 80,
    prixMoyen: 120,
    prixHaut: 180,
    source: 'estimation',
    dateReference: new Date('2024-01-01'),
  },
  {
    categorie: 'electricite',
    sousCategorie: 'installation',
    designation: 'Prise électrique',
    unite: 'u',
    prixBas: 50,
    prixMoyen: 80,
    prixHaut: 120,
    source: 'estimation',
    dateReference: new Date('2024-01-01'),
  },
  {
    categorie: 'electricite',
    sousCategorie: 'installation',
    designation: 'Tableau électrique',
    unite: 'u',
    prixBas: 800,
    prixMoyen: 1500,
    prixHaut: 2500,
    source: 'estimation',
    dateReference: new Date('2024-01-01'),
  },
  {
    categorie: 'electricite',
    sousCategorie: 'installation',
    designation: 'Rénovation complète électricité',
    unite: 'm²',
    prixBas: 80,
    prixMoyen: 120,
    prixHaut: 180,
    source: 'estimation',
    dateReference: new Date('2024-01-01'),
    notes: 'Par m² habitable',
  },

  // === MENUISERIE ===
  {
    categorie: 'menuiserie',
    sousCategorie: 'fenetre',
    designation: 'Fenêtre PVC double vitrage',
    unite: 'u',
    prixBas: 400,
    prixMoyen: 650,
    prixHaut: 1000,
    source: 'estimation',
    dateReference: new Date('2024-01-01'),
    notes: 'Dimension standard',
  },
  {
    categorie: 'menuiserie',
    sousCategorie: 'fenetre',
    designation: 'Fenêtre aluminium double vitrage',
    unite: 'u',
    prixBas: 600,
    prixMoyen: 900,
    prixHaut: 1400,
    source: 'estimation',
    dateReference: new Date('2024-01-01'),
  },
  {
    categorie: 'menuiserie',
    sousCategorie: 'porte',
    designation: 'Porte intérieure',
    unite: 'u',
    prixBas: 200,
    prixMoyen: 350,
    prixHaut: 600,
    source: 'estimation',
    dateReference: new Date('2024-01-01'),
  },
  {
    categorie: 'menuiserie',
    sousCategorie: 'porte',
    designation: 'Porte d\'entrée',
    unite: 'u',
    prixBas: 800,
    prixMoyen: 1500,
    prixHaut: 3000,
    source: 'estimation',
    dateReference: new Date('2024-01-01'),
  },
  {
    categorie: 'menuiserie',
    sousCategorie: 'porte',
    designation: 'Porte de garage sectionnelle',
    unite: 'u',
    prixBas: 1000,
    prixMoyen: 1800,
    prixHaut: 3500,
    source: 'estimation',
    dateReference: new Date('2024-01-01'),
  },

  // === ISOLATION ===
  {
    categorie: 'isolation',
    sousCategorie: 'murs',
    designation: 'Isolation murs par l\'intérieur',
    unite: 'm²',
    prixBas: 40,
    prixMoyen: 65,
    prixHaut: 100,
    source: 'estimation',
    dateReference: new Date('2024-01-01'),
  },
  {
    categorie: 'isolation',
    sousCategorie: 'murs',
    designation: 'Isolation murs par l\'extérieur (ITE)',
    unite: 'm²',
    prixBas: 100,
    prixMoyen: 160,
    prixHaut: 250,
    source: 'estimation',
    dateReference: new Date('2024-01-01'),
  },
  {
    categorie: 'isolation',
    sousCategorie: 'combles',
    designation: 'Isolation combles perdus',
    unite: 'm²',
    prixBas: 20,
    prixMoyen: 35,
    prixHaut: 55,
    source: 'estimation',
    dateReference: new Date('2024-01-01'),
  },
  {
    categorie: 'isolation',
    sousCategorie: 'combles',
    designation: 'Isolation combles aménagés',
    unite: 'm²',
    prixBas: 50,
    prixMoyen: 80,
    prixHaut: 120,
    source: 'estimation',
    dateReference: new Date('2024-01-01'),
  },

  // === REVETEMENTS ===
  {
    categorie: 'revetement',
    sousCategorie: 'sol',
    designation: 'Carrelage sol',
    unite: 'm²',
    prixBas: 40,
    prixMoyen: 70,
    prixHaut: 120,
    source: 'estimation',
    dateReference: new Date('2024-01-01'),
    notes: 'Fourniture + pose',
  },
  {
    categorie: 'revetement',
    sousCategorie: 'sol',
    designation: 'Parquet flottant',
    unite: 'm²',
    prixBas: 30,
    prixMoyen: 50,
    prixHaut: 90,
    source: 'estimation',
    dateReference: new Date('2024-01-01'),
  },
  {
    categorie: 'revetement',
    sousCategorie: 'sol',
    designation: 'Parquet massif',
    unite: 'm²',
    prixBas: 70,
    prixMoyen: 120,
    prixHaut: 200,
    source: 'estimation',
    dateReference: new Date('2024-01-01'),
  },
  {
    categorie: 'revetement',
    sousCategorie: 'mur',
    designation: 'Peinture mur',
    unite: 'm²',
    prixBas: 15,
    prixMoyen: 25,
    prixHaut: 40,
    source: 'estimation',
    dateReference: new Date('2024-01-01'),
  },
  {
    categorie: 'revetement',
    sousCategorie: 'mur',
    designation: 'Faïence murale',
    unite: 'm²',
    prixBas: 50,
    prixMoyen: 80,
    prixHaut: 130,
    source: 'estimation',
    dateReference: new Date('2024-01-01'),
  },
  {
    categorie: 'revetement',
    sousCategorie: 'plafond',
    designation: 'Faux plafond BA13',
    unite: 'm²',
    prixBas: 35,
    prixMoyen: 55,
    prixHaut: 85,
    source: 'estimation',
    dateReference: new Date('2024-01-01'),
  },

  // === COUVERTURE ===
  {
    categorie: 'couverture',
    sousCategorie: 'toiture',
    designation: 'Réfection toiture tuiles',
    unite: 'm²',
    prixBas: 80,
    prixMoyen: 130,
    prixHaut: 200,
    source: 'estimation',
    dateReference: new Date('2024-01-01'),
  },
  {
    categorie: 'couverture',
    sousCategorie: 'toiture',
    designation: 'Réfection toiture ardoise',
    unite: 'm²',
    prixBas: 120,
    prixMoyen: 180,
    prixHaut: 280,
    source: 'estimation',
    dateReference: new Date('2024-01-01'),
  },
  {
    categorie: 'couverture',
    sousCategorie: 'zinguerie',
    designation: 'Gouttière zinc',
    unite: 'ml',
    prixBas: 40,
    prixMoyen: 70,
    prixHaut: 110,
    source: 'estimation',
    dateReference: new Date('2024-01-01'),
  },

  // === MAIN D'OEUVRE ===
  {
    categorie: 'main_oeuvre',
    sousCategorie: 'tarif_horaire',
    designation: 'Heure maçon',
    unite: 'h',
    prixBas: 35,
    prixMoyen: 45,
    prixHaut: 60,
    source: 'estimation',
    dateReference: new Date('2024-01-01'),
  },
  {
    categorie: 'main_oeuvre',
    sousCategorie: 'tarif_horaire',
    designation: 'Heure plombier',
    unite: 'h',
    prixBas: 40,
    prixMoyen: 55,
    prixHaut: 75,
    source: 'estimation',
    dateReference: new Date('2024-01-01'),
  },
  {
    categorie: 'main_oeuvre',
    sousCategorie: 'tarif_horaire',
    designation: 'Heure électricien',
    unite: 'h',
    prixBas: 40,
    prixMoyen: 55,
    prixHaut: 75,
    source: 'estimation',
    dateReference: new Date('2024-01-01'),
  },
];

/**
 * Service de référence des prix
 */
export class PriceReferenceService {
  private database: PriceReference[];
  private customReferences: PriceReference[] = [];

  constructor() {
    this.database = [...PRICE_DATABASE];
  }

  /**
   * Rechercher une référence de prix correspondant à une désignation
   */
  findReference(designation: string, categorie?: string): PriceReference | null {
    const normalizedDesignation = this.normalizeText(designation);

    // Filtrer par catégorie si fournie
    let candidates = this.database;
    if (categorie) {
      candidates = candidates.filter(ref => ref.categorie === categorie);
    }

    // Recherche par similarité
    let bestMatch: { ref: PriceReference; score: number } | null = null;

    for (const ref of candidates) {
      const refNormalized = this.normalizeText(ref.designation);
      const score = this.calculateSimilarity(normalizedDesignation, refNormalized);

      if (score > 0.5 && (!bestMatch || score > bestMatch.score)) {
        bestMatch = { ref, score };
      }
    }

    // Recherche par mots-clés si pas de match direct
    if (!bestMatch) {
      const keywords = this.extractKeywords(normalizedDesignation);
      for (const ref of candidates) {
        const refKeywords = this.extractKeywords(this.normalizeText(ref.designation));
        const commonKeywords = keywords.filter(k => refKeywords.includes(k));
        const score = commonKeywords.length / Math.max(keywords.length, refKeywords.length);

        if (score > 0.4 && (!bestMatch || score > bestMatch.score)) {
          bestMatch = { ref, score };
        }
      }
    }

    return bestMatch?.ref || null;
  }

  /**
   * Comparer un prix avec la référence
   */
  comparePrix(
    designation: string,
    prixUnitaire: number | undefined,
    total: number | undefined,
    quantite: number | undefined,
    unite: string | undefined,
    categorie?: string
  ): PriceComparisonResult {
    const result: PriceComparisonResult = {
      lignOriginal: { designation, prixUnitaire, total, quantite, unite },
      ecart: { pourcentage: 0, position: 'inconnu' },
      fiabilite: 'basse',
      alertes: [],
    };

    // Trouver la référence
    const reference = this.findReference(designation, categorie);
    if (!reference) {
      result.alertes.push('Aucune référence de prix trouvée pour cette prestation');
      return result;
    }

    result.reference = reference;

    // Calculer le prix unitaire effectif
    let prixEffectif = prixUnitaire;
    if (!prixEffectif && total && quantite) {
      prixEffectif = total / quantite;
    }

    if (!prixEffectif) {
      result.alertes.push('Impossible de calculer le prix unitaire');
      return result;
    }

    // Vérifier la cohérence des unités
    if (unite && reference.unite && !this.unitsMatch(unite, reference.unite)) {
      result.alertes.push(`Unités différentes: devis (${unite}) vs référence (${reference.unite})`);
      result.fiabilite = 'basse';
      return result;
    }

    // Calculer l'écart
    const ecartBas = ((prixEffectif - reference.prixBas) / reference.prixBas) * 100;
    const ecartMoyen = ((prixEffectif - reference.prixMoyen) / reference.prixMoyen) * 100;
    const ecartHaut = ((prixEffectif - reference.prixHaut) / reference.prixHaut) * 100;

    result.ecart.pourcentage = ecartMoyen;

    // Déterminer la position
    if (prixEffectif <= reference.prixBas) {
      result.ecart.position = 'bas';
      result.fiabilite = 'haute';
    } else if (prixEffectif <= reference.prixMoyen) {
      result.ecart.position = 'moyen';
      result.fiabilite = 'haute';
    } else if (prixEffectif <= reference.prixHaut) {
      result.ecart.position = 'haut';
      result.fiabilite = 'moyenne';
    } else {
      result.ecart.position = 'tres_haut';
      result.fiabilite = 'moyenne';
      result.alertes.push(`Prix supérieur de ${ecartHaut.toFixed(0)}% au maximum de référence`);

      // Économie estimée
      if (quantite) {
        result.ecart.economieEstimee = (prixEffectif - reference.prixHaut) * quantite;
      }
    }

    // Alertes spécifiques
    if (result.ecart.position === 'bas' && ecartBas < -20) {
      result.alertes.push('Prix anormalement bas - vérifier la qualité/conformité');
    }

    return result;
  }

  /**
   * Analyser un devis complet et fournir des comparaisons
   */
  analyzeDevis(lignes: Array<{
    designation: string;
    prixUnitaire?: number;
    total?: number;
    quantite?: number;
    unite?: string;
    categorie?: string;
  }>): {
    comparaisons: PriceComparisonResult[];
    statistiques: {
      lignesAnalysees: number;
      lignesAvecReference: number;
      ecartMoyenPourcent: number;
      economieEstimeeTotale: number;
      positionGlobale: 'economique' | 'marche' | 'premium' | 'tres_premium';
    };
    alertes: string[];
  } {
    const comparaisons: PriceComparisonResult[] = [];
    const alertes: string[] = [];
    let totalEcart = 0;
    let lignesAvecEcart = 0;
    let economieEstimeeTotale = 0;

    for (const ligne of lignes) {
      const comparison = this.comparePrix(
        ligne.designation,
        ligne.prixUnitaire,
        ligne.total,
        ligne.quantite,
        ligne.unite,
        ligne.categorie
      );
      comparaisons.push(comparison);

      if (comparison.reference) {
        totalEcart += comparison.ecart.pourcentage;
        lignesAvecEcart++;
      }

      if (comparison.ecart.economieEstimee) {
        economieEstimeeTotale += comparison.ecart.economieEstimee;
      }

      alertes.push(...comparison.alertes);
    }

    // Calcul des statistiques globales
    const ecartMoyenPourcent = lignesAvecEcart > 0 ? totalEcart / lignesAvecEcart : 0;

    let positionGlobale: 'economique' | 'marche' | 'premium' | 'tres_premium';
    if (ecartMoyenPourcent < -10) {
      positionGlobale = 'economique';
    } else if (ecartMoyenPourcent <= 15) {
      positionGlobale = 'marche';
    } else if (ecartMoyenPourcent <= 40) {
      positionGlobale = 'premium';
    } else {
      positionGlobale = 'tres_premium';
    }

    return {
      comparaisons,
      statistiques: {
        lignesAnalysees: lignes.length,
        lignesAvecReference: lignesAvecEcart,
        ecartMoyenPourcent,
        economieEstimeeTotale,
        positionGlobale,
      },
      alertes: [...new Set(alertes)], // Dédupliquer
    };
  }

  /**
   * Ajouter une référence personnalisée
   */
  addCustomReference(reference: Omit<PriceReference, 'source'>): void {
    this.customReferences.push({
      ...reference,
      source: 'custom',
    });
    this.database = [...PRICE_DATABASE, ...this.customReferences];
  }

  /**
   * Obtenir toutes les catégories disponibles
   */
  getCategories(): string[] {
    return [...new Set(this.database.map(ref => ref.categorie))];
  }

  /**
   * Obtenir les références par catégorie
   */
  getReferencesByCategory(categorie: string): PriceReference[] {
    return this.database.filter(ref => ref.categorie === categorie);
  }

  // === Méthodes utilitaires ===

  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Supprimer accents
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private extractKeywords(text: string): string[] {
    const stopWords = ['de', 'la', 'le', 'les', 'du', 'des', 'un', 'une', 'et', 'en', 'pour', 'avec'];
    return text
      .split(' ')
      .filter(word => word.length > 2 && !stopWords.includes(word));
  }

  private calculateSimilarity(str1: string, str2: string): number {
    // Algorithme de similarité de Jaccard sur les mots
    const words1 = new Set(this.extractKeywords(str1));
    const words2 = new Set(this.extractKeywords(str2));

    const intersection = new Set([...words1].filter(w => words2.has(w)));
    const union = new Set([...words1, ...words2]);

    return union.size > 0 ? intersection.size / union.size : 0;
  }

  private unitsMatch(unit1: string, unit2: string): boolean {
    const normalize = (u: string) => u.toLowerCase()
      .replace('m²', 'm2')
      .replace('m³', 'm3')
      .replace('unité', 'u')
      .replace('pièce', 'u')
      .replace('heures', 'h')
      .replace('heure', 'h')
      .trim();

    return normalize(unit1) === normalize(unit2);
  }
}

export const priceReferenceService = new PriceReferenceService();
export default priceReferenceService;
