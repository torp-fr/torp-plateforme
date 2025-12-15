/**
 * TORP Phase 0 - Service d'Estimation Tarifaire
 * Fournit des estimations de prix basées sur:
 * - Type de travaux
 * - Localisation géographique
 * - Surface et complexité
 * - Niveau de finition souhaité
 */

import type { WorkItemType, RoomDetail, RoomDetailsData } from '@/types/phase0/room-details.types';

// =============================================================================
// TYPES
// =============================================================================

export interface PriceRange {
  min: number;
  max: number;
  average: number;
  unit: 'per_sqm' | 'per_unit' | 'per_linear_meter' | 'fixed';
  confidence: 'high' | 'medium' | 'low';
}

export interface WorkEstimation {
  workType: WorkItemType;
  description: string;
  priceRange: PriceRange;
  estimatedTotal: {
    min: number;
    max: number;
  };
  quantity?: number;
  notes?: string;
}

export interface RoomEstimation {
  roomId: string;
  roomName: string;
  surface?: number;
  works: WorkEstimation[];
  totalEstimate: {
    min: number;
    max: number;
  };
}

export interface ProjectEstimation {
  rooms: RoomEstimation[];
  subtotal: {
    min: number;
    max: number;
  };
  contingency: {
    percentage: number;
    min: number;
    max: number;
  };
  total: {
    min: number;
    max: number;
    average: number;
  };
  pricePerSqm?: {
    min: number;
    max: number;
  };
  benchmarkComparison?: BenchmarkComparison;
  generatedAt: string;
  validUntil: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface BenchmarkComparison {
  marketPosition: 'below' | 'average' | 'above';
  percentileRange: [number, number]; // ex: [25, 75] = entre 25e et 75e percentile
  regionalAverage: number;
  nationalAverage: number;
  similarProjectsCount: number;
  message: string;
}

export interface LocationFactor {
  zone: 'paris' | 'idf' | 'grandes_villes' | 'moyennes_villes' | 'rural';
  factor: number;
  label: string;
}

// =============================================================================
// DONNÉES DE RÉFÉRENCE - TARIFS 2024/2025
// =============================================================================

/**
 * Tarifs de référence par type de travaux (prix HT)
 * Sources: Batiactu, Travaux.com, CAPEB, FFB
 * Mise à jour: 2024
 */
const WORK_REFERENCE_PRICES: Record<WorkItemType, PriceRange> = {
  // Revêtements
  painting: {
    min: 20,
    max: 45,
    average: 32,
    unit: 'per_sqm',
    confidence: 'high',
  },
  flooring: {
    min: 35,
    max: 120,
    average: 65,
    unit: 'per_sqm',
    confidence: 'high',
  },
  tiling: {
    min: 50,
    max: 150,
    average: 85,
    unit: 'per_sqm',
    confidence: 'high',
  },
  wallpaper: {
    min: 25,
    max: 60,
    average: 40,
    unit: 'per_sqm',
    confidence: 'medium',
  },

  // Menuiserie
  cabinets: {
    min: 300,
    max: 800,
    average: 500,
    unit: 'per_linear_meter',
    confidence: 'medium',
  },
  closet: {
    min: 400,
    max: 1200,
    average: 700,
    unit: 'per_linear_meter',
    confidence: 'medium',
  },
  door: {
    min: 250,
    max: 800,
    average: 450,
    unit: 'per_unit',
    confidence: 'high',
  },
  window: {
    min: 400,
    max: 1500,
    average: 800,
    unit: 'per_unit',
    confidence: 'high',
  },
  velux: {
    min: 800,
    max: 2500,
    average: 1500,
    unit: 'per_unit',
    confidence: 'medium',
  },

  // Plomberie
  plumbing: {
    min: 80,
    max: 200,
    average: 130,
    unit: 'per_sqm',
    confidence: 'medium',
  },
  sanitary: {
    min: 500,
    max: 3000,
    average: 1500,
    unit: 'per_unit',
    confidence: 'medium',
  },
  countertop: {
    min: 200,
    max: 800,
    average: 400,
    unit: 'per_linear_meter',
    confidence: 'medium',
  },

  // Électricité
  electrical: {
    min: 80,
    max: 150,
    average: 110,
    unit: 'per_sqm',
    confidence: 'high',
  },
  lighting: {
    min: 100,
    max: 400,
    average: 200,
    unit: 'per_unit',
    confidence: 'medium',
  },
  network: {
    min: 150,
    max: 400,
    average: 250,
    unit: 'per_unit',
    confidence: 'low',
  },

  // Chauffage/Ventilation
  heating: {
    min: 100,
    max: 250,
    average: 160,
    unit: 'per_sqm',
    confidence: 'medium',
  },
  ventilation: {
    min: 1500,
    max: 4000,
    average: 2500,
    unit: 'fixed',
    confidence: 'medium',
  },
  insulation: {
    min: 40,
    max: 120,
    average: 70,
    unit: 'per_sqm',
    confidence: 'high',
  },

  // Équipements
  appliances: {
    min: 2000,
    max: 8000,
    average: 4000,
    unit: 'fixed',
    confidence: 'low',
  },
  storage: {
    min: 200,
    max: 600,
    average: 350,
    unit: 'per_linear_meter',
    confidence: 'medium',
  },

  // Extérieur
  railing: {
    min: 150,
    max: 400,
    average: 250,
    unit: 'per_linear_meter',
    confidence: 'medium',
  },
  waterproofing: {
    min: 60,
    max: 150,
    average: 100,
    unit: 'per_sqm',
    confidence: 'medium',
  },
  landscaping: {
    min: 50,
    max: 200,
    average: 100,
    unit: 'per_sqm',
    confidence: 'low',
  },
  fencing: {
    min: 80,
    max: 250,
    average: 150,
    unit: 'per_linear_meter',
    confidence: 'medium',
  },
  irrigation: {
    min: 1500,
    max: 5000,
    average: 2500,
    unit: 'fixed',
    confidence: 'low',
  },

  // Structure
  conversion: {
    min: 800,
    max: 2000,
    average: 1300,
    unit: 'per_sqm',
    confidence: 'low',
  },
  demolition: {
    min: 30,
    max: 80,
    average: 50,
    unit: 'per_sqm',
    confidence: 'medium',
  },
  other: {
    min: 50,
    max: 150,
    average: 100,
    unit: 'per_sqm',
    confidence: 'low',
  },
};

/**
 * Facteurs de correction par zone géographique
 * Base 1.0 = moyenne nationale
 */
const LOCATION_FACTORS: Record<string, LocationFactor> = {
  // Paris intra-muros
  '75': { zone: 'paris', factor: 1.35, label: 'Paris' },

  // Île-de-France
  '77': { zone: 'idf', factor: 1.15, label: 'Seine-et-Marne' },
  '78': { zone: 'idf', factor: 1.25, label: 'Yvelines' },
  '91': { zone: 'idf', factor: 1.15, label: 'Essonne' },
  '92': { zone: 'idf', factor: 1.30, label: 'Hauts-de-Seine' },
  '93': { zone: 'idf', factor: 1.10, label: 'Seine-Saint-Denis' },
  '94': { zone: 'idf', factor: 1.20, label: 'Val-de-Marne' },
  '95': { zone: 'idf', factor: 1.15, label: 'Val-d\'Oise' },

  // Grandes métropoles
  '13': { zone: 'grandes_villes', factor: 1.10, label: 'Bouches-du-Rhône' },
  '31': { zone: 'grandes_villes', factor: 1.05, label: 'Haute-Garonne' },
  '33': { zone: 'grandes_villes', factor: 1.08, label: 'Gironde' },
  '34': { zone: 'grandes_villes', factor: 1.05, label: 'Hérault' },
  '44': { zone: 'grandes_villes', factor: 1.08, label: 'Loire-Atlantique' },
  '59': { zone: 'grandes_villes', factor: 1.00, label: 'Nord' },
  '67': { zone: 'grandes_villes', factor: 1.05, label: 'Bas-Rhin' },
  '69': { zone: 'grandes_villes', factor: 1.12, label: 'Rhône' },
  '06': { zone: 'grandes_villes', factor: 1.15, label: 'Alpes-Maritimes' },
};

/**
 * Facteur par défaut pour les zones non référencées
 */
const DEFAULT_LOCATION_FACTOR: LocationFactor = {
  zone: 'moyennes_villes',
  factor: 1.0,
  label: 'Moyenne nationale',
};

/**
 * Facteurs de complexité
 */
const COMPLEXITY_FACTORS = {
  simple: 0.85,      // Travaux simples, accès facile
  standard: 1.0,     // Complexité normale
  complex: 1.20,     // Contraintes techniques
  very_complex: 1.40, // Bâtiment ancien, accès difficile
};

/**
 * Facteurs de finition
 */
const FINISH_LEVEL_FACTORS = {
  basic: 0.80,       // Entrée de gamme
  standard: 1.0,     // Gamme moyenne
  premium: 1.35,     // Haut de gamme
  luxury: 1.80,      // Luxe
};

// =============================================================================
// SERVICE
// =============================================================================

export class PricingEstimationService {
  /**
   * Obtient le facteur de localisation basé sur le code postal
   */
  static getLocationFactor(postalCode?: string): LocationFactor {
    if (!postalCode || postalCode.length < 2) {
      return DEFAULT_LOCATION_FACTOR;
    }

    const department = postalCode.substring(0, 2);
    return LOCATION_FACTORS[department] || DEFAULT_LOCATION_FACTOR;
  }

  /**
   * Estime le coût d'un type de travail
   */
  static estimateWorkCost(
    workType: WorkItemType,
    options: {
      surface?: number;
      quantity?: number;
      linearMeters?: number;
      postalCode?: string;
      complexity?: keyof typeof COMPLEXITY_FACTORS;
      finishLevel?: keyof typeof FINISH_LEVEL_FACTORS;
    } = {}
  ): WorkEstimation {
    const basePrice = WORK_REFERENCE_PRICES[workType];
    const locationFactor = this.getLocationFactor(options.postalCode);
    const complexityFactor = COMPLEXITY_FACTORS[options.complexity || 'standard'];
    const finishFactor = FINISH_LEVEL_FACTORS[options.finishLevel || 'standard'];

    const totalFactor = locationFactor.factor * complexityFactor * finishFactor;

    // Calculer le prix ajusté
    const adjustedPrice: PriceRange = {
      min: Math.round(basePrice.min * totalFactor),
      max: Math.round(basePrice.max * totalFactor),
      average: Math.round(basePrice.average * totalFactor),
      unit: basePrice.unit,
      confidence: basePrice.confidence,
    };

    // Calculer le total en fonction de l'unité
    let quantity = 1;
    let estimatedTotal = { min: adjustedPrice.min, max: adjustedPrice.max };

    switch (basePrice.unit) {
      case 'per_sqm':
        quantity = options.surface || 10; // Surface par défaut si non spécifiée
        estimatedTotal = {
          min: Math.round(adjustedPrice.min * quantity),
          max: Math.round(adjustedPrice.max * quantity),
        };
        break;
      case 'per_linear_meter':
        quantity = options.linearMeters || 3; // Mètres linéaires par défaut
        estimatedTotal = {
          min: Math.round(adjustedPrice.min * quantity),
          max: Math.round(adjustedPrice.max * quantity),
        };
        break;
      case 'per_unit':
        quantity = options.quantity || 1;
        estimatedTotal = {
          min: Math.round(adjustedPrice.min * quantity),
          max: Math.round(adjustedPrice.max * quantity),
        };
        break;
      case 'fixed':
        estimatedTotal = {
          min: adjustedPrice.min,
          max: adjustedPrice.max,
        };
        break;
    }

    return {
      workType,
      description: this.getWorkDescription(workType),
      priceRange: adjustedPrice,
      estimatedTotal,
      quantity,
      notes: this.generateEstimationNotes(workType, locationFactor, options),
    };
  }

  /**
   * Estime le coût total d'une pièce
   */
  static estimateRoomCost(
    room: RoomDetail,
    options: {
      postalCode?: string;
      complexity?: keyof typeof COMPLEXITY_FACTORS;
      finishLevel?: keyof typeof FINISH_LEVEL_FACTORS;
    } = {}
  ): RoomEstimation {
    const workEstimations = room.works.map(work =>
      this.estimateWorkCost(work.type, {
        ...options,
        surface: room.surface,
      })
    );

    const totalMin = workEstimations.reduce((sum, w) => sum + w.estimatedTotal.min, 0);
    const totalMax = workEstimations.reduce((sum, w) => sum + w.estimatedTotal.max, 0);

    return {
      roomId: room.id,
      roomName: room.customName || room.type,
      surface: room.surface,
      works: workEstimations,
      totalEstimate: {
        min: totalMin,
        max: totalMax,
      },
    };
  }

  /**
   * Estime le coût total d'un projet
   */
  static estimateProjectCost(
    roomDetails: RoomDetailsData,
    options: {
      postalCode?: string;
      complexity?: keyof typeof COMPLEXITY_FACTORS;
      finishLevel?: keyof typeof FINISH_LEVEL_FACTORS;
      contingencyPercentage?: number;
    } = {}
  ): ProjectEstimation {
    const roomEstimations = roomDetails.rooms.map(room =>
      this.estimateRoomCost(room, options)
    );

    const subtotalMin = roomEstimations.reduce((sum, r) => sum + r.totalEstimate.min, 0);
    const subtotalMax = roomEstimations.reduce((sum, r) => sum + r.totalEstimate.max, 0);

    // Provision pour imprévus (10% par défaut)
    const contingencyPct = options.contingencyPercentage || 10;
    const contingencyMin = Math.round(subtotalMin * contingencyPct / 100);
    const contingencyMax = Math.round(subtotalMax * contingencyPct / 100);

    const totalMin = subtotalMin + contingencyMin;
    const totalMax = subtotalMax + contingencyMax;
    const totalAverage = Math.round((totalMin + totalMax) / 2);

    // Calculer surface totale
    const totalSurface = roomDetails.rooms.reduce((sum, r) => sum + (r.surface || 0), 0);

    // Générer le benchmark
    const benchmark = this.generateBenchmark(totalAverage, totalSurface, options.postalCode);

    // Déterminer le niveau de confiance global
    const confidence = this.calculateOverallConfidence(roomEstimations);

    // Dates de validité
    const now = new Date();
    const validUntil = new Date(now);
    validUntil.setMonth(validUntil.getMonth() + 3); // Valide 3 mois

    return {
      rooms: roomEstimations,
      subtotal: {
        min: subtotalMin,
        max: subtotalMax,
      },
      contingency: {
        percentage: contingencyPct,
        min: contingencyMin,
        max: contingencyMax,
      },
      total: {
        min: totalMin,
        max: totalMax,
        average: totalAverage,
      },
      pricePerSqm: totalSurface > 0 ? {
        min: Math.round(totalMin / totalSurface),
        max: Math.round(totalMax / totalSurface),
      } : undefined,
      benchmarkComparison: benchmark,
      generatedAt: now.toISOString(),
      validUntil: validUntil.toISOString(),
      confidence,
    };
  }

  /**
   * Génère une comparaison avec le marché
   */
  private static generateBenchmark(
    estimatedCost: number,
    surface: number,
    postalCode?: string
  ): BenchmarkComparison {
    const locationFactor = this.getLocationFactor(postalCode);

    // Prix moyen de rénovation au m² (référence nationale)
    const nationalAvgPerSqm = 800; // €/m² pour une rénovation standard
    const regionalAvgPerSqm = nationalAvgPerSqm * locationFactor.factor;

    const regionalAverage = surface > 0 ? regionalAvgPerSqm * surface : 0;
    const nationalAverage = surface > 0 ? nationalAvgPerSqm * surface : 0;

    // Déterminer la position par rapport au marché
    let marketPosition: 'below' | 'average' | 'above';
    let percentileRange: [number, number];
    let message: string;

    const ratio = regionalAverage > 0 ? estimatedCost / regionalAverage : 1;

    if (ratio < 0.85) {
      marketPosition = 'below';
      percentileRange = [10, 30];
      message = 'Votre projet est estimé en dessous de la moyenne du marché. Vérifiez que tous les travaux nécessaires sont bien inclus.';
    } else if (ratio > 1.15) {
      marketPosition = 'above';
      percentileRange = [70, 90];
      message = 'Votre projet est estimé au-dessus de la moyenne du marché. Cela peut refléter un niveau de finition élevé ou des contraintes particulières.';
    } else {
      marketPosition = 'average';
      percentileRange = [35, 65];
      message = 'Votre projet est estimé dans la moyenne du marché pour votre région.';
    }

    return {
      marketPosition,
      percentileRange,
      regionalAverage: Math.round(regionalAverage),
      nationalAverage: Math.round(nationalAverage),
      similarProjectsCount: Math.floor(Math.random() * 50) + 20, // Simulation
      message,
    };
  }

  /**
   * Calcule le niveau de confiance global
   */
  private static calculateOverallConfidence(
    rooms: RoomEstimation[]
  ): 'high' | 'medium' | 'low' {
    const allWorks = rooms.flatMap(r => r.works);
    if (allWorks.length === 0) return 'low';

    const highCount = allWorks.filter(w => w.priceRange.confidence === 'high').length;
    const mediumCount = allWorks.filter(w => w.priceRange.confidence === 'medium').length;

    const ratio = (highCount + mediumCount * 0.5) / allWorks.length;

    if (ratio >= 0.7) return 'high';
    if (ratio >= 0.4) return 'medium';
    return 'low';
  }

  /**
   * Obtient la description d'un type de travail
   */
  private static getWorkDescription(workType: WorkItemType): string {
    const descriptions: Record<WorkItemType, string> = {
      painting: 'Peinture (préparation + 2 couches)',
      flooring: 'Revêtement de sol (pose comprise)',
      tiling: 'Carrelage mural (pose comprise)',
      wallpaper: 'Papier peint (pose comprise)',
      cabinets: 'Meubles (fourniture + pose)',
      closet: 'Rangements/Dressing (fourniture + pose)',
      door: 'Porte (fourniture + pose)',
      window: 'Fenêtre (fourniture + pose)',
      velux: 'Fenêtre de toit (fourniture + pose)',
      plumbing: 'Plomberie (tuyauterie + raccordements)',
      sanitary: 'Sanitaire (fourniture + pose)',
      countertop: 'Plan de travail (fourniture + pose)',
      electrical: 'Électricité (câblage + appareillage)',
      lighting: 'Point lumineux (fourniture + pose)',
      network: 'Réseau/Domotique (câblage + équipement)',
      heating: 'Chauffage (radiateurs ou plancher)',
      ventilation: 'VMC (fourniture + pose)',
      insulation: 'Isolation (matériau + pose)',
      appliances: 'Électroménager (fourniture)',
      storage: 'Rangements (fourniture + pose)',
      railing: 'Garde-corps (fourniture + pose)',
      waterproofing: 'Étanchéité (traitement complet)',
      landscaping: 'Aménagement paysager',
      fencing: 'Clôture (fourniture + pose)',
      irrigation: 'Système d\'arrosage',
      conversion: 'Aménagement/Transformation complète',
      demolition: 'Démolition + évacuation',
      other: 'Autres travaux',
    };
    return descriptions[workType] || workType;
  }

  /**
   * Génère des notes sur l'estimation
   */
  private static generateEstimationNotes(
    workType: WorkItemType,
    locationFactor: LocationFactor,
    options: {
      complexity?: keyof typeof COMPLEXITY_FACTORS;
      finishLevel?: keyof typeof FINISH_LEVEL_FACTORS;
    }
  ): string {
    const notes: string[] = [];

    if (locationFactor.zone !== 'moyennes_villes') {
      notes.push(`Ajustement ${locationFactor.label} (${locationFactor.factor > 1 ? '+' : ''}${Math.round((locationFactor.factor - 1) * 100)}%)`);
    }

    if (options.complexity && options.complexity !== 'standard') {
      const factor = COMPLEXITY_FACTORS[options.complexity];
      notes.push(`Complexité ${options.complexity} (${factor > 1 ? '+' : ''}${Math.round((factor - 1) * 100)}%)`);
    }

    if (options.finishLevel && options.finishLevel !== 'standard') {
      const factor = FINISH_LEVEL_FACTORS[options.finishLevel];
      notes.push(`Finition ${options.finishLevel} (${factor > 1 ? '+' : ''}${Math.round((factor - 1) * 100)}%)`);
    }

    return notes.join(' • ');
  }

  /**
   * Formatte un prix pour l'affichage
   */
  static formatPrice(amount: number): string {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0,
    }).format(amount);
  }

  /**
   * Formatte une fourchette de prix
   */
  static formatPriceRange(min: number, max: number): string {
    return `${this.formatPrice(min)} - ${this.formatPrice(max)}`;
  }
}

// Export singleton
export const pricingEstimationService = new PricingEstimationService();
