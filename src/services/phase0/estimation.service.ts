/**
 * Service d'estimation Phase 0
 * Calcule les estimations de budget et de durée pour les projets
 */

import { Phase0Project } from '@/types/phase0/project.types';
import { Property } from '@/types/phase0/property.types';
import { WorkProject } from '@/types/phase0/work-project.types';
import { SelectedLot, LotType, LOT_CATALOG, LotCategory } from '@/types/phase0/lots.types';
import { EstimationRange } from '@/types/phase0/common.types';

// Types pour les estimations
export interface ProjectEstimation {
  budget: BudgetEstimation;
  duration: DurationEstimation;
  confidence: number; // 0-100
  factors: EstimationFactor[];
  warnings: string[];
  lastUpdated: Date;
}

export interface BudgetEstimation {
  total: EstimationRange;
  byLot: LotBudgetEstimation[];
  byCategory: CategoryBudgetEstimation[];
  contingency: EstimationRange;
  fees: FeesEstimation;
}

export interface LotBudgetEstimation {
  lotType: LotType;
  lotName: string;
  estimate: EstimationRange;
  basis: 'catalog' | 'surface' | 'custom' | 'historical';
}

export interface CategoryBudgetEstimation {
  category: LotCategory;
  categoryName: string;
  estimate: EstimationRange;
  percentage: number;
}

export interface FeesEstimation {
  architect: EstimationRange;
  permits: EstimationRange;
  insurance: EstimationRange;
  coordination: EstimationRange;
  other: EstimationRange;
}

export interface DurationEstimation {
  totalDays: EstimationRange;
  totalWeeks: EstimationRange;
  phases: PhaseEstimation[];
  criticalPath: CriticalPathItem[];
  parallelization: number; // facteur de parallélisation 0.5-1
}

export interface PhaseEstimation {
  name: string;
  lots: LotType[];
  durationDays: EstimationRange;
  canParallelize: boolean;
}

export interface CriticalPathItem {
  lotType: LotType;
  durationDays: number;
  dependencies: LotType[];
}

export interface EstimationFactor {
  name: string;
  impact: 'increase' | 'decrease' | 'neutral';
  percentage: number;
  description: string;
}

// Coefficients régionaux (base 1.0 = Île-de-France)
const REGIONAL_COEFFICIENTS: Record<string, number> = {
  '75': 1.15, // Paris
  '92': 1.10, // Hauts-de-Seine
  '93': 1.05, // Seine-Saint-Denis
  '94': 1.05, // Val-de-Marne
  '78': 1.05, // Yvelines
  '91': 1.00, // Essonne
  '95': 1.00, // Val-d'Oise
  '77': 0.95, // Seine-et-Marne
  '69': 1.00, // Rhône (Lyon)
  '13': 0.95, // Bouches-du-Rhône (Marseille)
  '31': 0.90, // Haute-Garonne (Toulouse)
  '33': 0.90, // Gironde (Bordeaux)
  '06': 1.05, // Alpes-Maritimes (Nice)
  '44': 0.90, // Loire-Atlantique (Nantes)
  '67': 0.95, // Bas-Rhin (Strasbourg)
  'default': 0.90,
};

// Coefficients de complexité par type de bien
const PROPERTY_TYPE_COEFFICIENTS: Record<string, number> = {
  apartment: 1.0,
  house: 1.1,
  villa: 1.2,
  loft: 1.15,
  studio: 0.95,
  building: 1.3,
  commercial: 1.2,
  office: 1.1,
  warehouse: 0.9,
  land: 0.7,
  other: 1.0,
};

// Coefficients par niveau de finition
const FINISH_LEVEL_COEFFICIENTS: Record<string, number> = {
  basic: 0.8,
  standard: 1.0,
  premium: 1.3,
  luxury: 1.6,
};

// Coefficients d'ancienneté du bâtiment
const BUILDING_AGE_COEFFICIENTS: Record<string, number> = {
  'pre_1948': 1.25,
  '1948_1974': 1.15,
  '1975_1999': 1.05,
  '2000_2012': 1.0,
  'post_2012': 0.95,
};

export class EstimationService {
  /**
   * Calcule l'estimation complète d'un projet
   */
  static estimateProject(project: Partial<Phase0Project>): ProjectEstimation {
    const warnings: string[] = [];
    const factors: EstimationFactor[] = [];

    // Vérifications préliminaires
    if (!project.property) {
      warnings.push('Aucune information sur le bien - estimation approximative');
    }
    if (!project.selectedLots || project.selectedLots.length === 0) {
      warnings.push('Aucun lot sélectionné - estimation impossible');
      return this.createEmptyEstimation(warnings);
    }

    // Calculer les coefficients
    const coefficients = this.calculateCoefficients(project, factors);

    // Estimer le budget
    const budget = this.estimateBudget(
      project.selectedLots,
      project.property,
      project.workProject,
      coefficients,
      factors
    );

    // Estimer la durée
    const duration = this.estimateDuration(
      project.selectedLots,
      project.property,
      project.workProject,
      coefficients,
      factors
    );

    // Calculer la confiance
    const confidence = this.calculateConfidence(project, factors);

    return {
      budget,
      duration,
      confidence,
      factors,
      warnings,
      lastUpdated: new Date(),
    };
  }

  /**
   * Estime le budget pour un ensemble de lots
   */
  static estimateBudget(
    lots: SelectedLot[],
    property?: Partial<Property>,
    workProject?: Partial<WorkProject>,
    coefficients?: Record<string, number>,
    factors?: EstimationFactor[]
  ): BudgetEstimation {
    const coefs = coefficients || { total: 1.0 };
    const totalCoef = coefs.total || 1.0;

    // Estimation par lot
    const byLot: LotBudgetEstimation[] = lots.map(lot => {
      const estimate = this.estimateLotBudget(lot, property, totalCoef);
      return {
        lotType: lot.type,
        lotName: lot.name,
        estimate,
        basis: lot.estimatedBudget ? 'custom' : 'catalog',
      };
    });

    // Agrégation par catégorie
    const byCategory = this.aggregateByCategory(byLot, lots);

    // Total
    const totalMin = byLot.reduce((sum, lot) => sum + lot.estimate.min, 0);
    const totalMax = byLot.reduce((sum, lot) => sum + lot.estimate.max, 0);

    // Provision pour imprévus (5-15% selon la complexité)
    const contingencyRate = this.getContingencyRate(lots, property);
    const contingency: EstimationRange = {
      min: Math.round(totalMin * contingencyRate.min),
      max: Math.round(totalMax * contingencyRate.max),
    };

    // Frais annexes
    const fees = this.estimateFees(totalMin, totalMax, property, workProject);

    return {
      total: {
        min: totalMin + contingency.min + this.sumFees(fees, 'min'),
        max: totalMax + contingency.max + this.sumFees(fees, 'max'),
      },
      byLot,
      byCategory,
      contingency,
      fees,
    };
  }

  /**
   * Estime la durée des travaux
   */
  static estimateDuration(
    lots: SelectedLot[],
    property?: Partial<Property>,
    workProject?: Partial<WorkProject>,
    coefficients?: Record<string, number>,
    factors?: EstimationFactor[]
  ): DurationEstimation {
    const coefs = coefficients || { total: 1.0 };

    // Organiser les lots par phase d'exécution
    const phases = this.organizePhasesFromLots(lots);

    // Calculer le chemin critique
    const criticalPath = this.calculateCriticalPath(lots);

    // Facteur de parallélisation
    const parallelization = this.calculateParallelization(lots, property);

    // Calculer la durée totale
    const totalDaysMin = phases.reduce((sum, phase) => {
      if (phase.canParallelize) {
        return sum + phase.durationDays.min * parallelization;
      }
      return sum + phase.durationDays.min;
    }, 0);

    const totalDaysMax = phases.reduce((sum, phase) => {
      if (phase.canParallelize) {
        return sum + phase.durationDays.max * parallelization;
      }
      return sum + phase.durationDays.max;
    }, 0);

    // Appliquer les coefficients de complexité
    const adjustedMin = Math.round(totalDaysMin * (coefs.duration || 1.0));
    const adjustedMax = Math.round(totalDaysMax * (coefs.duration || 1.0));

    return {
      totalDays: { min: adjustedMin, max: adjustedMax },
      totalWeeks: {
        min: Math.ceil(adjustedMin / 5), // 5 jours ouvrés
        max: Math.ceil(adjustedMax / 5),
      },
      phases,
      criticalPath,
      parallelization,
    };
  }

  /**
   * Estime le budget pour un lot spécifique
   */
  static estimateLotBudget(
    lot: SelectedLot,
    property?: Partial<Property>,
    coefficient: number = 1.0
  ): EstimationRange {
    // Si le lot a déjà une estimation personnalisée
    if (lot.estimatedBudget) {
      return {
        min: Math.round(lot.estimatedBudget.min * coefficient),
        max: Math.round(lot.estimatedBudget.max * coefficient),
      };
    }

    // Récupérer les prix de référence du catalogue
    const catalogLot = LOT_CATALOG.find(l => l.type === lot.type);
    if (!catalogLot?.basePriceRange) {
      // Prix forfaitaire par défaut
      return { min: 5000, max: 15000 };
    }

    // Calculer en fonction de la surface si disponible
    const surface = property?.characteristics?.livingArea || 100; // défaut 100m²
    const priceMin = catalogLot.basePriceRange.min;
    const priceMax = catalogLot.basePriceRange.max;

    // Certains lots sont au forfait, d'autres au m²
    const surfaceBasedLots: LotType[] = [
      'demolition', 'gros_oeuvre', 'maconnerie', 'isolation_thermique',
      'cloisons_doublages', 'carrelage_faience', 'parquet_sols_souples',
      'peinture', 'facades', 'couverture', 'etancheite',
    ];

    if (surfaceBasedLots.includes(lot.type)) {
      return {
        min: Math.round(priceMin * surface * coefficient),
        max: Math.round(priceMax * surface * coefficient),
      };
    }

    // Lots au forfait ou par pièce
    const multiplier = this.getLotMultiplier(lot.type, property);
    return {
      min: Math.round(priceMin * multiplier * coefficient),
      max: Math.round(priceMax * multiplier * coefficient),
    };
  }

  /**
   * Calcule le ratio budget/m² d'un projet
   */
  static calculateBudgetPerSqm(
    budget: BudgetEstimation,
    property?: Partial<Property>
  ): EstimationRange {
    const surface = property?.characteristics?.livingArea || 100;
    return {
      min: Math.round(budget.total.min / surface),
      max: Math.round(budget.total.max / surface),
    };
  }

  /**
   * Compare l'estimation avec le budget prévu
   */
  static compareBudgetWithTarget(
    estimation: BudgetEstimation,
    targetBudget: EstimationRange
  ): {
    status: 'under' | 'within' | 'over';
    variance: number;
    recommendation: string;
  } {
    const estimatedMid = (estimation.total.min + estimation.total.max) / 2;
    const targetMid = (targetBudget.min + targetBudget.max) / 2;
    const variance = ((estimatedMid - targetMid) / targetMid) * 100;

    let status: 'under' | 'within' | 'over';
    let recommendation: string;

    if (variance < -15) {
      status = 'under';
      recommendation = 'Le budget est généreux. Vous pouvez envisager un niveau de finition supérieur ou des prestations additionnelles.';
    } else if (variance > 15) {
      status = 'over';
      recommendation = 'Le budget estimé dépasse l\'enveloppe prévue. Envisagez de prioriser les lots ou de revoir le niveau de finition.';
    } else {
      status = 'within';
      recommendation = 'L\'estimation est cohérente avec votre budget. Prévoyez une marge de sécurité de 10-15%.';
    }

    return { status, variance: Math.round(variance), recommendation };
  }

  // Méthodes privées

  private static calculateCoefficients(
    project: Partial<Phase0Project>,
    factors: EstimationFactor[]
  ): Record<string, number> {
    let totalCoef = 1.0;
    let durationCoef = 1.0;

    // Coefficient régional
    if (project.property?.address?.postalCode) {
      const dept = project.property.address.postalCode.substring(0, 2);
      const regionalCoef = REGIONAL_COEFFICIENTS[dept] || REGIONAL_COEFFICIENTS['default'];

      if (regionalCoef !== 1.0) {
        totalCoef *= regionalCoef;
        factors.push({
          name: 'Localisation géographique',
          impact: regionalCoef > 1 ? 'increase' : 'decrease',
          percentage: Math.round((regionalCoef - 1) * 100),
          description: regionalCoef > 1
            ? 'Zone à coût de main d\'œuvre élevé'
            : 'Zone à coût de main d\'œuvre modéré',
        });
      }
    }

    // Coefficient type de bien
    if (project.property?.characteristics?.type) {
      const typeCoef = PROPERTY_TYPE_COEFFICIENTS[project.property.characteristics.type] || 1.0;
      if (typeCoef !== 1.0) {
        totalCoef *= typeCoef;
        durationCoef *= typeCoef;
        factors.push({
          name: 'Type de bien',
          impact: typeCoef > 1 ? 'increase' : 'decrease',
          percentage: Math.round((typeCoef - 1) * 100),
          description: `Complexité liée au type ${project.property.characteristics.type}`,
        });
      }
    }

    // Coefficient niveau de finition
    if (project.workProject?.quality?.finishLevel) {
      const finishCoef = FINISH_LEVEL_COEFFICIENTS[project.workProject.quality.finishLevel] || 1.0;
      if (finishCoef !== 1.0) {
        totalCoef *= finishCoef;
        factors.push({
          name: 'Niveau de finition',
          impact: finishCoef > 1 ? 'increase' : 'decrease',
          percentage: Math.round((finishCoef - 1) * 100),
          description: `Finition ${project.workProject.quality.finishLevel}`,
        });
      }
    }

    // Coefficient ancienneté
    if (project.property?.construction?.yearBuilt) {
      const year = project.property.construction.yearBuilt;
      let ageCategory: string;

      if (year < 1948) ageCategory = 'pre_1948';
      else if (year < 1975) ageCategory = '1948_1974';
      else if (year < 2000) ageCategory = '1975_1999';
      else if (year < 2013) ageCategory = '2000_2012';
      else ageCategory = 'post_2012';

      const ageCoef = BUILDING_AGE_COEFFICIENTS[ageCategory];
      if (ageCoef !== 1.0) {
        totalCoef *= ageCoef;
        durationCoef *= ageCoef;
        factors.push({
          name: 'Ancienneté du bâtiment',
          impact: ageCoef > 1 ? 'increase' : 'decrease',
          percentage: Math.round((ageCoef - 1) * 100),
          description: `Bâtiment ${ageCategory} - ${ageCoef > 1 ? 'contraintes techniques possibles' : 'construction récente'}`,
        });
      }
    }

    // Coefficient monument historique
    if (project.property?.heritage?.isClassified || project.property?.heritage?.isRegistered) {
      totalCoef *= 1.4;
      durationCoef *= 1.3;
      factors.push({
        name: 'Monument historique',
        impact: 'increase',
        percentage: 40,
        description: 'Contraintes de restauration et validation ABF',
      });
    }

    // Coefficient copropriété
    if (project.property?.condo?.isInCondo) {
      durationCoef *= 1.15;
      factors.push({
        name: 'Copropriété',
        impact: 'increase',
        percentage: 15,
        description: 'Contraintes d\'accès et de nuisance',
      });
    }

    // Coefficient urgence
    if (project.workProject?.constraints?.temporal?.isUrgent) {
      totalCoef *= 1.15;
      factors.push({
        name: 'Urgence',
        impact: 'increase',
        percentage: 15,
        description: 'Majoration pour travaux urgents',
      });
    }

    return { total: totalCoef, duration: durationCoef };
  }

  private static aggregateByCategory(
    byLot: LotBudgetEstimation[],
    lots: SelectedLot[]
  ): CategoryBudgetEstimation[] {
    const categories: Record<LotCategory, { min: number; max: number }> = {
      gros_oeuvre: { min: 0, max: 0 },
      second_oeuvre: { min: 0, max: 0 },
      technique: { min: 0, max: 0 },
      finitions: { min: 0, max: 0 },
      exterieur: { min: 0, max: 0 },
      specifique: { min: 0, max: 0 },
    };

    const categoryNames: Record<LotCategory, string> = {
      gros_oeuvre: 'Gros œuvre',
      second_oeuvre: 'Second œuvre',
      technique: 'Technique',
      finitions: 'Finitions',
      exterieur: 'Extérieur',
      specifique: 'Spécifique',
    };

    // Agréger par catégorie
    byLot.forEach((lotEstimate, index) => {
      const lot = lots[index];
      if (lot && categories[lot.category]) {
        categories[lot.category].min += lotEstimate.estimate.min;
        categories[lot.category].max += lotEstimate.estimate.max;
      }
    });

    // Calculer le total
    const totalMin = Object.values(categories).reduce((sum, cat) => sum + cat.min, 0);
    const totalMax = Object.values(categories).reduce((sum, cat) => sum + cat.max, 0);

    // Convertir en tableau avec pourcentages
    return Object.entries(categories)
      .filter(([_, values]) => values.min > 0 || values.max > 0)
      .map(([category, values]) => ({
        category: category as LotCategory,
        categoryName: categoryNames[category as LotCategory],
        estimate: values,
        percentage: totalMax > 0 ? Math.round((values.max / totalMax) * 100) : 0,
      }));
  }

  private static getContingencyRate(
    lots: SelectedLot[],
    property?: Partial<Property>
  ): EstimationRange {
    let baseRate = 0.08; // 8% par défaut

    // Augmenter pour les bâtiments anciens
    if (property?.construction?.yearBuilt && property.construction.yearBuilt < 1975) {
      baseRate += 0.05;
    }

    // Augmenter pour les travaux de structure
    const structuralLots: LotType[] = ['gros_oeuvre', 'charpente', 'fondations', 'demolition'];
    const hasStructural = lots.some(lot => structuralLots.includes(lot.type));
    if (hasStructural) {
      baseRate += 0.03;
    }

    return {
      min: baseRate,
      max: baseRate + 0.05,
    };
  }

  private static estimateFees(
    budgetMin: number,
    budgetMax: number,
    property?: Partial<Property>,
    workProject?: Partial<WorkProject>
  ): FeesEstimation {
    const needsArchitect = workProject?.regulatory?.requiresArchitect ||
      (property?.characteristics?.livingArea && property.characteristics.livingArea > 150);

    const architectRate = needsArchitect ? 0.08 : 0;
    const permitsEstimate = workProject?.regulatory?.declarationType === 'building_permit' ? 2000 : 500;

    return {
      architect: {
        min: Math.round(budgetMin * architectRate),
        max: Math.round(budgetMax * (architectRate + 0.02)),
      },
      permits: { min: permitsEstimate, max: permitsEstimate * 2 },
      insurance: { min: 500, max: 1500 },
      coordination: {
        min: Math.round(budgetMin * 0.02),
        max: Math.round(budgetMax * 0.04),
      },
      other: { min: 500, max: 2000 },
    };
  }

  private static sumFees(fees: FeesEstimation, type: 'min' | 'max'): number {
    return (
      fees.architect[type] +
      fees.permits[type] +
      fees.insurance[type] +
      fees.coordination[type] +
      fees.other[type]
    );
  }

  private static getLotMultiplier(lotType: LotType, property?: Partial<Property>): number {
    const roomCount = property?.characteristics?.roomCount || 5;
    const bathroomCount = property?.characteristics?.bathroomCount || 1;

    const multipliers: Partial<Record<LotType, number>> = {
      plomberie: bathroomCount + 1, // +1 pour la cuisine
      electricite: roomCount,
      menuiseries_interieures: roomCount,
      menuiseries_exterieures: Math.ceil(roomCount * 0.5),
      salle_bains: bathroomCount,
      cuisine_equipee: 1,
      chauffage: Math.ceil(roomCount * 0.7),
      climatisation: Math.ceil(roomCount * 0.5),
    };

    return multipliers[lotType] || 1;
  }

  private static organizePhasesFromLots(lots: SelectedLot[]): PhaseEstimation[] {
    const phases: PhaseEstimation[] = [];

    // Phase 1: Préparation et démolition
    const prepLots = lots.filter(l =>
      ['demolition', 'evacuation_dechets', 'echafaudages'].includes(l.type)
    );
    if (prepLots.length > 0) {
      phases.push({
        name: 'Préparation et démolition',
        lots: prepLots.map(l => l.type),
        durationDays: this.sumLotDurations(prepLots),
        canParallelize: false,
      });
    }

    // Phase 2: Gros œuvre
    const grosOeuvreLots = lots.filter(l =>
      ['gros_oeuvre', 'maconnerie', 'terrassement', 'fondations', 'charpente', 'couverture'].includes(l.type)
    );
    if (grosOeuvreLots.length > 0) {
      phases.push({
        name: 'Gros œuvre',
        lots: grosOeuvreLots.map(l => l.type),
        durationDays: this.sumLotDurations(grosOeuvreLots),
        canParallelize: false,
      });
    }

    // Phase 3: Technique (peut être parallélisée)
    const techniqueLots = lots.filter(l =>
      ['plomberie', 'electricite', 'chauffage', 'ventilation', 'climatisation'].includes(l.type)
    );
    if (techniqueLots.length > 0) {
      phases.push({
        name: 'Lots techniques',
        lots: techniqueLots.map(l => l.type),
        durationDays: this.sumLotDurations(techniqueLots),
        canParallelize: true,
      });
    }

    // Phase 4: Second œuvre
    const secondOeuvreLots = lots.filter(l =>
      ['isolation_thermique', 'cloisons_doublages', 'menuiseries_interieures', 'menuiseries_exterieures'].includes(l.type)
    );
    if (secondOeuvreLots.length > 0) {
      phases.push({
        name: 'Second œuvre',
        lots: secondOeuvreLots.map(l => l.type),
        durationDays: this.sumLotDurations(secondOeuvreLots),
        canParallelize: true,
      });
    }

    // Phase 5: Finitions
    const finitionsLots = lots.filter(l =>
      ['carrelage_faience', 'parquet_sols_souples', 'peinture', 'revetements_muraux', 'plafonds'].includes(l.type)
    );
    if (finitionsLots.length > 0) {
      phases.push({
        name: 'Finitions',
        lots: finitionsLots.map(l => l.type),
        durationDays: this.sumLotDurations(finitionsLots),
        canParallelize: true,
      });
    }

    // Phase 6: Équipements et aménagements
    const equipementLots = lots.filter(l =>
      ['cuisine_equipee', 'salle_bains', 'domotique', 'securite'].includes(l.type)
    );
    if (equipementLots.length > 0) {
      phases.push({
        name: 'Équipements',
        lots: equipementLots.map(l => l.type),
        durationDays: this.sumLotDurations(equipementLots),
        canParallelize: true,
      });
    }

    // Phase 7: Extérieur
    const exterieurLots = lots.filter(l =>
      ['facades', 'espaces_verts', 'clotures', 'terrassement', 'piscine'].includes(l.type)
    );
    if (exterieurLots.length > 0) {
      phases.push({
        name: 'Extérieur',
        lots: exterieurLots.map(l => l.type),
        durationDays: this.sumLotDurations(exterieurLots),
        canParallelize: true,
      });
    }

    // Phase 8: Nettoyage final
    const nettoyageLots = lots.filter(l => l.type === 'nettoyage');
    if (nettoyageLots.length > 0) {
      phases.push({
        name: 'Nettoyage final',
        lots: ['nettoyage'],
        durationDays: this.sumLotDurations(nettoyageLots),
        canParallelize: false,
      });
    }

    return phases;
  }

  private static sumLotDurations(lots: SelectedLot[]): EstimationRange {
    let min = 0;
    let max = 0;

    lots.forEach(lot => {
      if (lot.estimatedDurationDays) {
        min += lot.estimatedDurationDays;
        max += lot.estimatedDurationDays * 1.5;
      } else {
        const catalogLot = LOT_CATALOG.find(l => l.type === lot.type);
        const duration = catalogLot?.typicalDurationDays || 5;
        min += duration;
        max += duration * 1.5;
      }
    });

    return { min: Math.round(min), max: Math.round(max) };
  }

  private static calculateCriticalPath(lots: SelectedLot[]): CriticalPathItem[] {
    // Définition des dépendances entre lots
    const dependencies: Partial<Record<LotType, LotType[]>> = {
      peinture: ['cloisons_doublages', 'electricite', 'plomberie'],
      carrelage_faience: ['cloisons_doublages', 'plomberie'],
      parquet_sols_souples: ['cloisons_doublages', 'peinture'],
      plomberie: ['gros_oeuvre', 'demolition'],
      electricite: ['gros_oeuvre', 'demolition'],
      cloisons_doublages: ['gros_oeuvre', 'plomberie', 'electricite'],
      isolation_thermique: ['gros_oeuvre', 'charpente'],
      couverture: ['charpente'],
      menuiseries_exterieures: ['gros_oeuvre', 'maconnerie'],
      menuiseries_interieures: ['cloisons_doublages'],
      cuisine_equipee: ['plomberie', 'electricite', 'carrelage_faience'],
      salle_bains: ['plomberie', 'electricite', 'carrelage_faience'],
    };

    return lots
      .filter(lot => dependencies[lot.type])
      .map(lot => {
        const catalogLot = LOT_CATALOG.find(l => l.type === lot.type);
        return {
          lotType: lot.type,
          durationDays: lot.estimatedDurationDays || catalogLot?.typicalDurationDays || 5,
          dependencies: (dependencies[lot.type] || []).filter(dep =>
            lots.some(l => l.type === dep)
          ),
        };
      })
      .filter(item => item.dependencies.length > 0);
  }

  private static calculateParallelization(
    lots: SelectedLot[],
    property?: Partial<Property>
  ): number {
    // Facteur de base
    let factor = 0.7;

    // Surface importante = plus de possibilités de parallélisation
    if (property?.characteristics?.livingArea && property.characteristics.livingArea > 150) {
      factor = 0.6;
    }
    if (property?.characteristics?.livingArea && property.characteristics.livingArea > 300) {
      factor = 0.5;
    }

    // Peu de lots = moins de parallélisation possible
    if (lots.length < 5) {
      factor = Math.min(factor + 0.2, 0.9);
    }

    return factor;
  }

  private static calculateConfidence(
    project: Partial<Phase0Project>,
    factors: EstimationFactor[]
  ): number {
    let confidence = 50; // Base

    // Informations sur le bien
    if (project.property?.characteristics?.livingArea) confidence += 10;
    if (project.property?.construction?.yearBuilt) confidence += 5;
    if (project.property?.address?.postalCode) confidence += 5;

    // Informations sur le projet
    if (project.workProject?.quality?.finishLevel) confidence += 5;
    if (project.workProject?.budget?.totalEnvelope) confidence += 5;

    // Lots bien définis
    if (project.selectedLots && project.selectedLots.length > 0) {
      const lotsWithBudget = project.selectedLots.filter(l => l.estimatedBudget).length;
      confidence += Math.min(lotsWithBudget * 2, 10);

      const lotsWithDescription = project.selectedLots.filter(l => l.description).length;
      confidence += Math.min(lotsWithDescription, 5);
    }

    // Pénalités pour incertitudes
    if (factors.some(f => f.name === 'Monument historique')) confidence -= 10;
    if (factors.some(f => f.name === 'Ancienneté du bâtiment' && f.percentage > 15)) confidence -= 5;

    return Math.min(Math.max(confidence, 20), 95);
  }

  private static createEmptyEstimation(warnings: string[]): ProjectEstimation {
    return {
      budget: {
        total: { min: 0, max: 0 },
        byLot: [],
        byCategory: [],
        contingency: { min: 0, max: 0 },
        fees: {
          architect: { min: 0, max: 0 },
          permits: { min: 0, max: 0 },
          insurance: { min: 0, max: 0 },
          coordination: { min: 0, max: 0 },
          other: { min: 0, max: 0 },
        },
      },
      duration: {
        totalDays: { min: 0, max: 0 },
        totalWeeks: { min: 0, max: 0 },
        phases: [],
        criticalPath: [],
        parallelization: 1,
      },
      confidence: 0,
      factors: [],
      warnings,
      lastUpdated: new Date(),
    };
  }
}

export default EstimationService;
