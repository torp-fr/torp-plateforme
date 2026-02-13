/**
 * Project Context Embeddings Service
 * Vectorizes project information (CCF - Cahier des Charges Fonctionnel)
 * to provide contextual analysis for quote evaluation
 */

export interface ProjectContextData {
  name: string;           // Nom du projet
  type: string;           // Type de travaux (plomberie, électricité, etc.)
  budget?: string;        // Budget en euros
  surface?: string;       // Surface en m²
  startDate?: string;     // Date de début
  endDate?: string;       // Date de fin
  urgency?: string;       // Urgence (basse, normale, haute, très haute)
  constraints?: string;   // Contraintes spécifiques
  description?: string;   // Description du projet
}

export interface ProjectContextEmbeddings {
  typeEmbedding: string[];      // Vectorized project type
  budgetRange: BudgetRange;     // Budget context (low/mid/high)
  surfaceRange: SurfaceRange;   // Surface context (small/medium/large)
  urgencyLevel: UrgencyLevel;   // Urgency level for analysis weight
  constraintKeywords: string[]; // Extracted constraint keywords
  contextualFactors: ContextualFactor[]; // Extracted contextual factors
}

export interface BudgetRange {
  min?: number;
  max?: number;
  category: 'very_low' | 'low' | 'medium' | 'high' | 'very_high';
}

export interface SurfaceRange {
  value?: number;
  category: 'very_small' | 'small' | 'medium' | 'large' | 'very_large';
}

export type UrgencyLevel = 'basse' | 'normale' | 'haute' | 'tres-haute';

export interface ContextualFactor {
  category: 'timeline' | 'budget' | 'scope' | 'constraint' | 'quality';
  value: string;
  impact: 'low' | 'medium' | 'high';
}

const PROJECT_TYPE_KEYWORDS: { [key: string]: string[] } = {
  plomberie: ['tuyauterie', 'robinetterie', 'eau', 'sanitaire', 'drain'],
  electricite: ['circuit', 'câblage', 'électrique', 'disjoncteur', 'installation'],
  peinture: ['peinture', 'revêtement', 'coloris', 'finition', 'surface'],
  renovation: ['restructuration', 'rénovation', 'amélioration', 'modernisation'],
  cuisine: ['cuisine', 'aménagement', 'équipement', 'plans de travail'],
  'salle-de-bain': ['salle de bain', 'sanitaires', 'carrelage', 'plomberie'],
};

const BUDGET_RANGES: { [key: string]: { min: number; max: number } } = {
  very_low: { min: 0, max: 2000 },
  low: { min: 2000, max: 5000 },
  medium: { min: 5000, max: 15000 },
  high: { min: 15000, max: 50000 },
  very_high: { min: 50000, max: Infinity },
};

const SURFACE_RANGES: { [key: string]: { min: number; max: number } } = {
  very_small: { min: 0, max: 10 },
  small: { min: 10, max: 25 },
  medium: { min: 25, max: 50 },
  large: { min: 50, max: 100 },
  very_large: { min: 100, max: Infinity },
};

export class ProjectContextEmbeddingsService {
  /**
   * Vectorize project context data for analysis
   */
  static vectorizeProjectContext(data: ProjectContextData): ProjectContextEmbeddings {
    return {
      typeEmbedding: this.vectorizeProjectType(data.type),
      budgetRange: this.extractBudgetRange(data.budget),
      surfaceRange: this.extractSurfaceRange(data.surface),
      urgencyLevel: (data.urgency as UrgencyLevel) || 'normale',
      constraintKeywords: this.extractConstraintKeywords(data.constraints),
      contextualFactors: this.extractContextualFactors(data),
    };
  }

  /**
   * Vectorize project type into relevant keywords
   */
  private static vectorizeProjectType(type: string): string[] {
    const lowerType = type.toLowerCase();
    return PROJECT_TYPE_KEYWORDS[lowerType] || [type];
  }

  /**
   * Extract budget range from string
   */
  private static extractBudgetRange(budgetStr?: string): BudgetRange {
    if (!budgetStr) {
      return { category: 'medium' };
    }

    const budget = parseFloat(budgetStr);
    if (isNaN(budget)) {
      return { category: 'medium' };
    }

    let category: 'very_low' | 'low' | 'medium' | 'high' | 'very_high';

    if (budget < 2000) category = 'very_low';
    else if (budget < 5000) category = 'low';
    else if (budget < 15000) category = 'medium';
    else if (budget < 50000) category = 'high';
    else category = 'very_high';

    return {
      min: budget,
      max: budget,
      category,
    };
  }

  /**
   * Extract surface range from string
   */
  private static extractSurfaceRange(surfaceStr?: string): SurfaceRange {
    if (!surfaceStr) {
      return { category: 'medium' };
    }

    const surface = parseFloat(surfaceStr);
    if (isNaN(surface)) {
      return { category: 'medium' };
    }

    let category: 'very_small' | 'small' | 'medium' | 'large' | 'very_large';

    if (surface < 10) category = 'very_small';
    else if (surface < 25) category = 'small';
    else if (surface < 50) category = 'medium';
    else if (surface < 100) category = 'large';
    else category = 'very_large';

    return {
      value: surface,
      category,
    };
  }

  /**
   * Extract constraint keywords
   */
  private static extractConstraintKeywords(constraints?: string): string[] {
    if (!constraints) return [];

    const keywords = constraints
      .toLowerCase()
      .split(/[,;.]/)
      .map(k => k.trim())
      .filter(k => k.length > 0);

    return keywords;
  }

  /**
   * Extract contextual factors for analysis
   */
  private static extractContextualFactors(data: ProjectContextData): ContextualFactor[] {
    const factors: ContextualFactor[] = [];

    // Timeline factors
    if (data.startDate && data.endDate) {
      const start = new Date(data.startDate);
      const end = new Date(data.endDate);
      const daysAvailable = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

      if (daysAvailable < 7) {
        factors.push({
          category: 'timeline',
          value: 'délai très court',
          impact: 'high',
        });
      } else if (daysAvailable < 30) {
        factors.push({
          category: 'timeline',
          value: 'délai court',
          impact: 'medium',
        });
      }
    }

    // Urgency factors
    if (data.urgency === 'tres-haute') {
      factors.push({
        category: 'timeline',
        value: 'projet très urgent',
        impact: 'high',
      });
    } else if (data.urgency === 'haute') {
      factors.push({
        category: 'timeline',
        value: 'projet urgent',
        impact: 'medium',
      });
    }

    // Budget factors
    if (data.budget) {
      const budget = parseFloat(data.budget);
      if (budget < 2000) {
        factors.push({
          category: 'budget',
          value: 'budget très limité',
          impact: 'high',
        });
      } else if (budget > 50000) {
        factors.push({
          category: 'budget',
          value: 'budget important',
          impact: 'medium',
        });
      }
    }

    // Surface factors
    if (data.surface) {
      const surface = parseFloat(data.surface);
      if (surface > 100) {
        factors.push({
          category: 'scope',
          value: 'grande surface',
          impact: 'medium',
        });
      }
    }

    // Constraint factors
    if (data.constraints) {
      const hasAccessIssues = /accès|difficile|limité/i.test(data.constraints);
      if (hasAccessIssues) {
        factors.push({
          category: 'constraint',
          value: 'accès difficile',
          impact: 'high',
        });
      }

      const hasScheduleConstraints = /horaire|fermé|hors service/i.test(data.constraints);
      if (hasScheduleConstraints) {
        factors.push({
          category: 'constraint',
          value: 'contraintes horaires',
          impact: 'medium',
        });
      }

      const hasQualityRequirements = /qualité|premium|haute qualité|haut de gamme/i.test(data.constraints);
      if (hasQualityRequirements) {
        factors.push({
          category: 'quality',
          value: 'exigences de qualité élevées',
          impact: 'medium',
        });
      }
    }

    return factors;
  }

  /**
   * Generate context summary for AI prompts
   */
  static generateContextSummary(data: ProjectContextData): string {
    const parts: string[] = [];

    parts.push(`Projet: ${data.name}`);
    parts.push(`Type: ${data.type}`);

    if (data.budget) parts.push(`Budget: ${data.budget}€`);
    if (data.surface) parts.push(`Surface: ${data.surface}m²`);
    if (data.urgency) parts.push(`Urgence: ${data.urgency}`);

    if (data.description) {
      parts.push(`Description: ${data.description}`);
    }

    if (data.constraints) {
      parts.push(`Contraintes: ${data.constraints}`);
    }

    return parts.join('\n');
  }

  /**
   * Get analysis weight multipliers based on context
   */
  static getAnalysisWeights(embeddings: ProjectContextEmbeddings): {
    prixWeight: number;
    delaisWeight: number;
    complexiteWeight: number;
  } {
    let prixWeight = 1;
    let delaisWeight = 1;
    let complexiteWeight = 1;

    // Budget influences price analysis weight
    if (embeddings.budgetRange.category === 'very_low' || embeddings.budgetRange.category === 'low') {
      prixWeight *= 1.3;
    }

    // Urgency influences timeline analysis weight
    if (embeddings.urgencyLevel === 'tres-haute' || embeddings.urgencyLevel === 'haute') {
      delaisWeight *= 1.3;
    }

    // Surface influences complexity weight
    if (embeddings.surfaceRange.category === 'large' || embeddings.surfaceRange.category === 'very_large') {
      complexiteWeight *= 1.2;
    }

    // Constraints influence all weights
    if (embeddings.contextualFactors.some(f => f.category === 'constraint' && f.impact === 'high')) {
      complexiteWeight *= 1.2;
      prixWeight *= 1.1;
    }

    return { prixWeight, delaisWeight, complexiteWeight };
  }
}

export const projectContextEmbeddingsService = ProjectContextEmbeddingsService;
