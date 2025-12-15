/**
 * Service de données de marché BTP
 * Coefficients régionaux, indices de prix et tendances
 */

export interface MarketPriceData {
  categorie: string;
  indiceBase: number;
  indiceCourant: number;
  variation12Mois: number;
  tendance: 'hausse' | 'stable' | 'baisse';
  dateReference: Date;
}

export interface RegionalCoefficient {
  codeRegion: string;
  nomRegion: string;
  coefficient: number;
  remarques?: string;
}

export interface SeasonalAdjustment {
  mois: number;
  coefficient: number;
  raison: string;
}

/**
 * Coefficients régionaux pour ajuster les prix
 * Base 1.0 = moyenne nationale
 */
const REGIONAL_COEFFICIENTS: RegionalCoefficient[] = [
  { codeRegion: '11', nomRegion: 'Île-de-France', coefficient: 1.25, remarques: 'Main d\'oeuvre et foncier élevés' },
  { codeRegion: '84', nomRegion: 'Auvergne-Rhône-Alpes', coefficient: 1.05 },
  { codeRegion: '93', nomRegion: 'Provence-Alpes-Côte d\'Azur', coefficient: 1.15, remarques: 'Littoral plus cher' },
  { codeRegion: '44', nomRegion: 'Grand Est', coefficient: 0.95 },
  { codeRegion: '32', nomRegion: 'Hauts-de-France', coefficient: 0.90 },
  { codeRegion: '28', nomRegion: 'Normandie', coefficient: 0.95 },
  { codeRegion: '75', nomRegion: 'Nouvelle-Aquitaine', coefficient: 1.00 },
  { codeRegion: '76', nomRegion: 'Occitanie', coefficient: 0.98 },
  { codeRegion: '52', nomRegion: 'Pays de la Loire', coefficient: 0.98 },
  { codeRegion: '53', nomRegion: 'Bretagne', coefficient: 0.95 },
  { codeRegion: '24', nomRegion: 'Centre-Val de Loire', coefficient: 0.92 },
  { codeRegion: '27', nomRegion: 'Bourgogne-Franche-Comté', coefficient: 0.93 },
  { codeRegion: '94', nomRegion: 'Corse', coefficient: 1.20, remarques: 'Surcoût insulaire' },
];

/**
 * Correspondance code postal -> code région
 */
const CP_TO_REGION: Record<string, string> = {
  '75': '11', '77': '11', '78': '11', '91': '11', '92': '11', '93': '11', '94': '11', '95': '11', // IDF
  '01': '84', '03': '84', '07': '84', '15': '84', '26': '84', '38': '84', '42': '84', '43': '84', '63': '84', '69': '84', '73': '84', '74': '84', // AURA
  '04': '93', '05': '93', '06': '93', '13': '93', '83': '93', '84': '93', // PACA
  '08': '44', '10': '44', '51': '44', '52': '44', '54': '44', '55': '44', '57': '44', '67': '44', '68': '44', '88': '44', // Grand Est
  '02': '32', '59': '32', '60': '32', '62': '32', '80': '32', // HdF
  '14': '28', '27': '28', '50': '28', '61': '28', '76': '28', // Normandie
  '16': '75', '17': '75', '19': '75', '23': '75', '24': '75', '33': '75', '40': '75', '47': '75', '64': '75', '79': '75', '86': '75', '87': '75', // Nouvelle-Aquitaine
  '09': '76', '11': '76', '12': '76', '30': '76', '31': '76', '32': '76', '34': '76', '46': '76', '48': '76', '65': '76', '66': '76', '81': '76', '82': '76', // Occitanie
  '44': '52', '49': '52', '53': '52', '72': '52', '85': '52', // Pays de la Loire
  '22': '53', '29': '53', '35': '53', '56': '53', // Bretagne
  '18': '24', '28': '24', '36': '24', '37': '24', '41': '24', '45': '24', // Centre-Val de Loire
  '21': '27', '25': '27', '39': '27', '58': '27', '70': '27', '71': '27', '89': '27', '90': '27', // Bourgogne-FC
  '20': '94', '2A': '94', '2B': '94', // Corse
};

/**
 * Indices de prix BT (Bâtiment Travaux) simulés
 * Basés sur la nomenclature INSEE
 */
const BT_INDICES: Record<string, MarketPriceData> = {
  'BT01': {
    categorie: 'Tous corps d\'état',
    indiceBase: 100,
    indiceCourant: 118.5,
    variation12Mois: 3.2,
    tendance: 'hausse',
    dateReference: new Date('2024-06-01'),
  },
  'BT02': {
    categorie: 'Gros oeuvre',
    indiceBase: 100,
    indiceCourant: 121.3,
    variation12Mois: 4.1,
    tendance: 'hausse',
    dateReference: new Date('2024-06-01'),
  },
  'BT40': {
    categorie: 'Plomberie sanitaire',
    indiceBase: 100,
    indiceCourant: 119.8,
    variation12Mois: 2.8,
    tendance: 'hausse',
    dateReference: new Date('2024-06-01'),
  },
  'BT41': {
    categorie: 'Chauffage central',
    indiceBase: 100,
    indiceCourant: 124.5,
    variation12Mois: 5.2,
    tendance: 'hausse',
    dateReference: new Date('2024-06-01'),
  },
  'BT42': {
    categorie: 'Ventilation climatisation',
    indiceBase: 100,
    indiceCourant: 117.2,
    variation12Mois: 2.1,
    tendance: 'stable',
    dateReference: new Date('2024-06-01'),
  },
  'BT43': {
    categorie: 'Électricité',
    indiceBase: 100,
    indiceCourant: 116.8,
    variation12Mois: 2.4,
    tendance: 'hausse',
    dateReference: new Date('2024-06-01'),
  },
  'BT50': {
    categorie: 'Menuiseries',
    indiceBase: 100,
    indiceCourant: 122.1,
    variation12Mois: 3.8,
    tendance: 'hausse',
    dateReference: new Date('2024-06-01'),
  },
  'BT52': {
    categorie: 'Couverture',
    indiceBase: 100,
    indiceCourant: 120.4,
    variation12Mois: 3.5,
    tendance: 'hausse',
    dateReference: new Date('2024-06-01'),
  },
  'BT53': {
    categorie: 'Étanchéité',
    indiceBase: 100,
    indiceCourant: 125.8,
    variation12Mois: 6.1,
    tendance: 'hausse',
    dateReference: new Date('2024-06-01'),
  },
  'BT57': {
    categorie: 'Peinture',
    indiceBase: 100,
    indiceCourant: 115.2,
    variation12Mois: 1.8,
    tendance: 'stable',
    dateReference: new Date('2024-06-01'),
  },
  'BT60': {
    categorie: 'Carrelage',
    indiceBase: 100,
    indiceCourant: 118.9,
    variation12Mois: 2.9,
    tendance: 'hausse',
    dateReference: new Date('2024-06-01'),
  },
};

/**
 * Ajustements saisonniers pour les travaux
 */
const SEASONAL_ADJUSTMENTS: SeasonalAdjustment[] = [
  { mois: 1, coefficient: 1.05, raison: 'Période creuse - majorations possibles' },
  { mois: 2, coefficient: 1.05, raison: 'Période creuse' },
  { mois: 3, coefficient: 1.00, raison: 'Reprise activité' },
  { mois: 4, coefficient: 0.98, raison: 'Haute saison' },
  { mois: 5, coefficient: 0.95, raison: 'Haute saison - concurrence' },
  { mois: 6, coefficient: 0.95, raison: 'Haute saison - concurrence' },
  { mois: 7, coefficient: 1.02, raison: 'Vacances - disponibilité réduite' },
  { mois: 8, coefficient: 1.08, raison: 'Vacances - majorations fréquentes' },
  { mois: 9, coefficient: 0.98, raison: 'Reprise activité' },
  { mois: 10, coefficient: 0.97, raison: 'Bonne disponibilité' },
  { mois: 11, coefficient: 1.00, raison: 'Fin de saison' },
  { mois: 12, coefficient: 1.05, raison: 'Période creuse' },
];

/**
 * Service de données de marché
 */
export class MarketDataService {
  /**
   * Obtenir le coefficient régional pour un code postal
   */
  getRegionalCoefficient(codePostal: string): RegionalCoefficient {
    const dept = codePostal.substring(0, 2);
    const codeRegion = CP_TO_REGION[dept];

    if (codeRegion) {
      const regional = REGIONAL_COEFFICIENTS.find(r => r.codeRegion === codeRegion);
      if (regional) return regional;
    }

    // Valeur par défaut
    return {
      codeRegion: '00',
      nomRegion: 'France métropolitaine',
      coefficient: 1.0,
    };
  }

  /**
   * Obtenir tous les coefficients régionaux
   */
  getAllRegionalCoefficients(): RegionalCoefficient[] {
    return [...REGIONAL_COEFFICIENTS];
  }

  /**
   * Obtenir l'indice BT pour une catégorie
   */
  getBTIndex(categorie: string): MarketPriceData | null {
    // Recherche par code
    if (BT_INDICES[categorie]) {
      return BT_INDICES[categorie];
    }

    // Recherche par nom de catégorie
    const categorieNormalized = categorie.toLowerCase();
    for (const [code, data] of Object.entries(BT_INDICES)) {
      if (data.categorie.toLowerCase().includes(categorieNormalized)) {
        return data;
      }
    }

    // Retourner l'indice général si non trouvé
    return BT_INDICES['BT01'];
  }

  /**
   * Obtenir tous les indices BT disponibles
   */
  getAllBTIndices(): MarketPriceData[] {
    return Object.values(BT_INDICES);
  }

  /**
   * Obtenir l'ajustement saisonnier pour un mois donné
   */
  getSeasonalAdjustment(mois: number): SeasonalAdjustment {
    const adjustment = SEASONAL_ADJUSTMENTS.find(s => s.mois === mois);
    return adjustment || { mois, coefficient: 1.0, raison: 'Non défini' };
  }

  /**
   * Calculer un prix ajusté avec tous les facteurs
   */
  calculateAdjustedPrice(
    prixBase: number,
    options: {
      codePostal?: string;
      categorie?: string;
      dateDevis?: Date;
      ajusterInflation?: boolean;
    } = {}
  ): {
    prixAjuste: number;
    coefficientTotal: number;
    details: {
      prixBase: number;
      coefficientRegional: number;
      coefficientSaisonnier: number;
      coefficientInflation: number;
    };
  } {
    let coefficientTotal = 1.0;
    const details = {
      prixBase,
      coefficientRegional: 1.0,
      coefficientSaisonnier: 1.0,
      coefficientInflation: 1.0,
    };

    // Coefficient régional
    if (options.codePostal) {
      const regional = this.getRegionalCoefficient(options.codePostal);
      details.coefficientRegional = regional.coefficient;
      coefficientTotal *= regional.coefficient;
    }

    // Coefficient saisonnier
    if (options.dateDevis) {
      const mois = options.dateDevis.getMonth() + 1;
      const seasonal = this.getSeasonalAdjustment(mois);
      details.coefficientSaisonnier = seasonal.coefficient;
      coefficientTotal *= seasonal.coefficient;
    }

    // Ajustement inflation si demandé
    if (options.ajusterInflation && options.categorie) {
      const btIndex = this.getBTIndex(options.categorie);
      if (btIndex && btIndex.indiceBase > 0) {
        // Ajuster du prix base à l'indice courant
        const facteurInflation = btIndex.indiceCourant / btIndex.indiceBase;
        details.coefficientInflation = facteurInflation;
        coefficientTotal *= facteurInflation;
      }
    }

    return {
      prixAjuste: Math.round(prixBase * coefficientTotal * 100) / 100,
      coefficientTotal,
      details,
    };
  }

  /**
   * Obtenir une analyse des tendances pour une catégorie
   */
  getTrendAnalysis(categorie: string): {
    tendance: 'hausse' | 'stable' | 'baisse';
    variation12Mois: number;
    prevision: string;
    conseils: string[];
  } {
    const btIndex = this.getBTIndex(categorie);

    if (!btIndex) {
      return {
        tendance: 'stable',
        variation12Mois: 2.5, // Moyenne générale
        prevision: 'Évolution conforme au marché',
        conseils: [],
      };
    }

    const conseils: string[] = [];

    if (btIndex.tendance === 'hausse' && btIndex.variation12Mois > 4) {
      conseils.push('Les prix sont en forte hausse, négocier un prix ferme peut être avantageux');
      conseils.push('Vérifier les clauses de révision de prix dans le devis');
    } else if (btIndex.tendance === 'hausse') {
      conseils.push('Tendance haussière modérée, prévoir une marge de sécurité de 3-5%');
    } else if (btIndex.tendance === 'baisse') {
      conseils.push('Les prix sont orientés à la baisse, possibilité de négocier');
    }

    // Prévision basée sur la tendance
    let prevision = 'Stabilité attendue';
    if (btIndex.variation12Mois > 5) {
      prevision = `Poursuite de la hausse probable (+${(btIndex.variation12Mois * 0.7).toFixed(1)}% attendu)`;
    } else if (btIndex.variation12Mois > 2) {
      prevision = `Légère hausse attendue (+2-3%)`;
    } else if (btIndex.variation12Mois < 0) {
      prevision = 'Stabilisation ou légère baisse possible';
    }

    return {
      tendance: btIndex.tendance,
      variation12Mois: btIndex.variation12Mois,
      prevision,
      conseils,
    };
  }

  /**
   * Comparer un prix avec les données de marché
   */
  compareToMarket(
    prix: number,
    prixReferenceMin: number,
    prixReferenceMax: number,
    codePostal?: string
  ): {
    position: 'tres_bas' | 'bas' | 'correct' | 'eleve' | 'tres_eleve';
    ecartPourcent: number;
    prixAjusteRegion: { min: number; max: number };
    interpretation: string;
  } {
    // Ajuster les prix de référence pour la région
    let coeffRegional = 1.0;
    if (codePostal) {
      const regional = this.getRegionalCoefficient(codePostal);
      coeffRegional = regional.coefficient;
    }

    const prixAjusteMin = prixReferenceMin * coeffRegional;
    const prixAjusteMax = prixReferenceMax * coeffRegional;
    const prixMoyenAjuste = (prixAjusteMin + prixAjusteMax) / 2;

    const ecartPourcent = ((prix - prixMoyenAjuste) / prixMoyenAjuste) * 100;

    let position: 'tres_bas' | 'bas' | 'correct' | 'eleve' | 'tres_eleve';
    let interpretation: string;

    if (prix < prixAjusteMin * 0.7) {
      position = 'tres_bas';
      interpretation = 'Prix anormalement bas - vérifier la qualité et les prestations incluses';
    } else if (prix < prixAjusteMin) {
      position = 'bas';
      interpretation = 'Prix compétitif, inférieur au marché';
    } else if (prix <= prixAjusteMax) {
      position = 'correct';
      interpretation = 'Prix conforme au marché de votre région';
    } else if (prix <= prixAjusteMax * 1.3) {
      position = 'eleve';
      interpretation = 'Prix supérieur à la moyenne - négociation possible';
    } else {
      position = 'tres_eleve';
      interpretation = 'Prix très élevé - demander une justification détaillée';
    }

    return {
      position,
      ecartPourcent: Math.round(ecartPourcent * 10) / 10,
      prixAjusteRegion: {
        min: Math.round(prixAjusteMin),
        max: Math.round(prixAjusteMax),
      },
      interpretation,
    };
  }
}

export const marketDataService = new MarketDataService();
export default marketDataService;
