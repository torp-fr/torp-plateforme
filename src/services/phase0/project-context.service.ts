/**
 * Service d'analyse contextuelle du projet
 * Génère des synthèses professionnelles et extrait les quantités
 */

import { WorkType } from '@/types/phase0/work-project.types';
import { RoomDetailsData, WorkItemType, WORK_ITEM_CONFIG, RoomType, ROOM_TYPE_CONFIG } from '@/types/phase0/room-details.types';

// =============================================================================
// TYPES
// =============================================================================

export interface ExtractedQuantity {
  item: string;           // ex: "fenêtre", "porte", "radiateur"
  quantity: number;       // ex: 3
  unit: string;           // ex: "unité", "m²", "ml"
  context?: string;       // ex: "cuisine", "salon"
  confidence: number;     // 0-1: niveau de confiance
}

export interface ProjectContextAnalysis {
  summary: string;                    // Synthèse professionnelle du projet
  extractedQuantities: ExtractedQuantity[];
  workCategories: string[];           // Catégories de travaux identifiées
  estimatedComplexity: 'simple' | 'moderate' | 'complex';
  keyObjectives: string[];            // Objectifs principaux identifiés
  warnings: string[];                 // Alertes ou recommandations
}

// =============================================================================
// PATTERNS D'EXTRACTION
// =============================================================================

// Patterns pour extraire les quantités du texte
const QUANTITY_PATTERNS: Array<{
  pattern: RegExp;
  item: string;
  unit: string;
  category: string;
}> = [
  // Fenêtres et menuiseries
  { pattern: /(\d+)\s*fenêtres?/gi, item: 'fenêtre', unit: 'unité', category: 'menuiserie' },
  { pattern: /(\d+)\s*portes?\s*(d[e']?\s*entrée|extérieure)?/gi, item: 'porte extérieure', unit: 'unité', category: 'menuiserie' },
  { pattern: /(\d+)\s*portes?\s*(intérieure)?/gi, item: 'porte intérieure', unit: 'unité', category: 'menuiserie' },
  { pattern: /(\d+)\s*velux/gi, item: 'velux', unit: 'unité', category: 'menuiserie' },
  { pattern: /(\d+)\s*baies?\s*vitrées?/gi, item: 'baie vitrée', unit: 'unité', category: 'menuiserie' },
  { pattern: /(\d+)\s*volets?/gi, item: 'volet', unit: 'unité', category: 'menuiserie' },

  // Plomberie
  { pattern: /(\d+)\s*WC/gi, item: 'WC', unit: 'unité', category: 'plomberie' },
  { pattern: /(\d+)\s*toilettes?/gi, item: 'WC', unit: 'unité', category: 'plomberie' },
  { pattern: /(\d+)\s*lavabos?/gi, item: 'lavabo', unit: 'unité', category: 'plomberie' },
  { pattern: /(\d+)\s*douches?/gi, item: 'douche', unit: 'unité', category: 'plomberie' },
  { pattern: /(\d+)\s*baignoires?/gi, item: 'baignoire', unit: 'unité', category: 'plomberie' },
  { pattern: /(\d+)\s*éviers?/gi, item: 'évier', unit: 'unité', category: 'plomberie' },
  { pattern: /(\d+)\s*robinets?/gi, item: 'robinet', unit: 'unité', category: 'plomberie' },
  { pattern: /(\d+)\s*chauffe-eau/gi, item: 'chauffe-eau', unit: 'unité', category: 'plomberie' },

  // Chauffage
  { pattern: /(\d+)\s*radiateurs?/gi, item: 'radiateur', unit: 'unité', category: 'chauffage' },
  { pattern: /(\d+)\s*convecteurs?/gi, item: 'convecteur', unit: 'unité', category: 'chauffage' },

  // Électricité
  { pattern: /(\d+)\s*prises?/gi, item: 'prise électrique', unit: 'unité', category: 'électricité' },
  { pattern: /(\d+)\s*interrupteurs?/gi, item: 'interrupteur', unit: 'unité', category: 'électricité' },
  { pattern: /(\d+)\s*points?\s*lumineux/gi, item: 'point lumineux', unit: 'unité', category: 'électricité' },

  // Surfaces
  { pattern: /(\d+)\s*m²?\s*(de\s*)?(carrelage|sol|parquet|moquette)/gi, item: 'revêtement sol', unit: 'm²', category: 'finitions' },
  { pattern: /(\d+)\s*m²?\s*(de\s*)?(peinture|mur)/gi, item: 'peinture', unit: 'm²', category: 'finitions' },

  // Pièces
  { pattern: /(\d+)\s*pièces?/gi, item: 'pièce', unit: 'pièce', category: 'général' },
  { pattern: /(\d+)\s*chambres?/gi, item: 'chambre', unit: 'pièce', category: 'général' },
  { pattern: /(\d+)\s*salles?\s*de\s*bains?/gi, item: 'salle de bain', unit: 'pièce', category: 'général' },
];

// Mots-clés pour identifier le type de travaux
const WORK_TYPE_KEYWORDS: Record<WorkType, string[]> = {
  renovation: ['rénover', 'rénovation', 'moderniser', 'rafraîchir', 'refaire', 'transformer'],
  refurbishment: ['réhabiliter', 'réhabilitation', 'remettre aux normes', 'mise aux normes', 'restaurer'],
  extension: ['agrandir', 'extension', 'surélévation', 'ajout', 'annexe'],
  improvement: ['améliorer', 'amélioration', 'optimiser', 'isolation', 'énergie', 'performance'],
  new_construction: ['construire', 'construction', 'neuf', 'créer', 'bâtir'],
  maintenance: ['entretenir', 'entretien', 'réparer', 'réparation', 'maintenance'],
  restoration: ['restaurer', 'restauration', 'patrimoine', 'ancien'],
  conversion: ['transformer', 'conversion', 'aménager', 'réaménager'],
  demolition: ['démolir', 'démolition', 'abattre', 'casser'],
};

// Labels pour les types de travaux
const WORK_TYPE_LABELS: Record<WorkType, string> = {
  renovation: 'rénovation',
  refurbishment: 'réhabilitation',
  extension: 'extension',
  improvement: 'amélioration énergétique',
  new_construction: 'construction neuve',
  maintenance: 'entretien',
  restoration: 'restauration',
  conversion: 'transformation',
  demolition: 'démolition',
};

// =============================================================================
// SERVICE
// =============================================================================

export class ProjectContextService {
  /**
   * Analyse complète du contexte du projet
   */
  static analyzeProject(
    description: string,
    workType: WorkType | undefined,
    roomDetails: RoomDetailsData | undefined,
    propertyType?: string,
    propertySurface?: number
  ): ProjectContextAnalysis {
    const extractedQuantities = this.extractQuantities(description);
    const roomQuantities = this.extractRoomQuantities(roomDetails);
    const allQuantities = [...extractedQuantities, ...roomQuantities];

    const workCategories = this.identifyWorkCategories(description, roomDetails);
    const keyObjectives = this.identifyObjectives(description, workType);
    const estimatedComplexity = this.estimateComplexity(allQuantities, roomDetails);
    const warnings = this.generateWarnings(description, allQuantities, roomDetails);

    const summary = this.generateProfessionalSummary(
      description,
      workType,
      allQuantities,
      workCategories,
      keyObjectives,
      propertyType,
      propertySurface,
      roomDetails
    );

    return {
      summary,
      extractedQuantities: allQuantities,
      workCategories,
      estimatedComplexity,
      keyObjectives,
      warnings,
    };
  }

  /**
   * Extrait les quantités mentionnées dans le texte
   */
  static extractQuantities(text: string): ExtractedQuantity[] {
    if (!text) return [];

    const quantities: ExtractedQuantity[] = [];
    const normalizedText = text.toLowerCase();

    for (const { pattern, item, unit, category } of QUANTITY_PATTERNS) {
      const matches = normalizedText.matchAll(new RegExp(pattern.source, pattern.flags));
      for (const match of matches) {
        const quantity = parseInt(match[1], 10);
        if (!isNaN(quantity) && quantity > 0 && quantity < 1000) {
          // Vérifier si cette quantité n'est pas déjà extraite
          const existing = quantities.find(q => q.item === item);
          if (!existing) {
            quantities.push({
              item,
              quantity,
              unit,
              context: category,
              confidence: 0.8,
            });
          }
        }
      }
    }

    return quantities;
  }

  /**
   * Extrait les quantités depuis les détails des pièces
   */
  static extractRoomQuantities(roomDetails: RoomDetailsData | undefined): ExtractedQuantity[] {
    if (!roomDetails?.rooms?.length) return [];

    const quantities: ExtractedQuantity[] = [];
    const workCounts: Record<string, number> = {};

    for (const room of roomDetails.rooms) {
      // Compter les types de travaux
      for (const work of room.works) {
        const config = WORK_ITEM_CONFIG[work.type];
        const label = config?.label || work.type;
        workCounts[label] = (workCounts[label] || 0) + 1;
      }
    }

    // Convertir en ExtractedQuantity
    for (const [item, quantity] of Object.entries(workCounts)) {
      quantities.push({
        item,
        quantity,
        unit: 'intervention',
        context: 'détails pièces',
        confidence: 1.0,
      });
    }

    // Ajouter le nombre de pièces
    if (roomDetails.rooms.length > 0) {
      quantities.push({
        item: 'pièce concernée',
        quantity: roomDetails.rooms.length,
        unit: 'pièce',
        context: 'périmètre travaux',
        confidence: 1.0,
      });
    }

    return quantities;
  }

  /**
   * Identifie les catégories de travaux
   */
  static identifyWorkCategories(text: string, roomDetails: RoomDetailsData | undefined): string[] {
    const categories = new Set<string>();
    const normalizedText = text?.toLowerCase() || '';

    // Depuis le texte
    const categoryKeywords: Record<string, string[]> = {
      'Menuiseries': ['fenêtre', 'porte', 'volet', 'velux', 'baie'],
      'Plomberie': ['plomberie', 'wc', 'douche', 'baignoire', 'lavabo', 'évier', 'robinet', 'tuyau'],
      'Électricité': ['électricité', 'prise', 'interrupteur', 'tableau', 'câblage'],
      'Chauffage': ['chauffage', 'radiateur', 'chaudière', 'pompe à chaleur', 'pac'],
      'Peinture': ['peinture', 'peindre', 'papier peint', 'enduit'],
      'Revêtement sol': ['carrelage', 'parquet', 'sol', 'moquette', 'lino'],
      'Isolation': ['isolation', 'isoler', 'thermique', 'phonique'],
      'Maçonnerie': ['mur', 'cloison', 'béton', 'maçonnerie', 'fondation'],
      'Toiture': ['toit', 'toiture', 'couverture', 'charpente', 'tuile'],
    };

    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      for (const keyword of keywords) {
        if (normalizedText.includes(keyword)) {
          categories.add(category);
          break;
        }
      }
    }

    // Depuis les détails des pièces
    if (roomDetails?.rooms) {
      for (const room of roomDetails.rooms) {
        for (const work of room.works) {
          const config = WORK_ITEM_CONFIG[work.type];
          if (config) {
            // Mapper le type de travail à une catégorie
            const workTypeCategories: Record<string, string> = {
              painting: 'Peinture',
              flooring: 'Revêtement sol',
              tiling: 'Revêtement sol',
              electrical: 'Électricité',
              plumbing: 'Plomberie',
              heating: 'Chauffage',
              insulation: 'Isolation',
              windows: 'Menuiseries',
              doors: 'Menuiseries',
              walls: 'Maçonnerie',
            };
            const category = workTypeCategories[work.type];
            if (category) categories.add(category);
          }
        }
      }
    }

    return Array.from(categories);
  }

  /**
   * Identifie les objectifs principaux du projet
   */
  static identifyObjectives(text: string, workType: WorkType | undefined): string[] {
    const objectives: string[] = [];
    const normalizedText = text?.toLowerCase() || '';

    // Objectifs courants
    const objectivePatterns: Array<{ pattern: RegExp; objective: string }> = [
      { pattern: /économie|énergie|consommation/i, objective: 'Réduire la consommation énergétique' },
      { pattern: /confort|thermique|chaleur|froid/i, objective: 'Améliorer le confort thermique' },
      { pattern: /esthétique|moderne|design|déco/i, objective: 'Moderniser l\'esthétique' },
      { pattern: /vétuste|ancien|usé|dégradé/i, objective: 'Remplacer des éléments vétustes' },
      { pattern: /sécurité|norme|conforme/i, objective: 'Mise en conformité / sécurité' },
      { pattern: /agrandir|espace|surface/i, objective: 'Gagner en espace' },
      { pattern: /luminosité|lumière|clair/i, objective: 'Améliorer la luminosité' },
      { pattern: /bruit|phonique|son/i, objective: 'Améliorer l\'isolation phonique' },
      { pattern: /valeur|plus-value|vendre/i, objective: 'Valoriser le bien' },
      { pattern: /fonctionnel|pratique|aménag/i, objective: 'Améliorer la fonctionnalité' },
    ];

    for (const { pattern, objective } of objectivePatterns) {
      if (pattern.test(normalizedText)) {
        objectives.push(objective);
      }
    }

    // Ajouter un objectif par défaut basé sur le type de travaux
    if (objectives.length === 0 && workType) {
      const defaultObjectives: Record<WorkType, string> = {
        renovation: 'Rénover et moderniser l\'habitat',
        refurbishment: 'Remettre le bien en état',
        extension: 'Agrandir la surface habitable',
        improvement: 'Améliorer les performances du logement',
        new_construction: 'Construire un nouveau bâtiment',
        maintenance: 'Maintenir le bien en bon état',
        restoration: 'Restaurer le patrimoine',
        conversion: 'Transformer l\'usage des espaces',
        demolition: 'Préparer le terrain',
      };
      objectives.push(defaultObjectives[workType]);
    }

    return objectives.slice(0, 4); // Maximum 4 objectifs
  }

  /**
   * Estime la complexité du projet
   */
  static estimateComplexity(
    quantities: ExtractedQuantity[],
    roomDetails: RoomDetailsData | undefined
  ): 'simple' | 'moderate' | 'complex' {
    let complexityScore = 0;

    // Nombre de types de travaux différents
    const uniqueCategories = new Set(quantities.map(q => q.context));
    complexityScore += uniqueCategories.size * 10;

    // Nombre total d'interventions
    const totalQuantity = quantities.reduce((sum, q) => sum + q.quantity, 0);
    complexityScore += Math.min(totalQuantity * 2, 30);

    // Nombre de pièces concernées
    const roomCount = roomDetails?.rooms?.length || 0;
    complexityScore += roomCount * 5;

    if (complexityScore < 20) return 'simple';
    if (complexityScore < 50) return 'moderate';
    return 'complex';
  }

  /**
   * Génère des avertissements et recommandations
   */
  static generateWarnings(
    text: string,
    quantities: ExtractedQuantity[],
    roomDetails: RoomDetailsData | undefined
  ): string[] {
    const warnings: string[] = [];

    // Si pas de quantités et pas de détails pièces
    if (quantities.length === 0 && (!roomDetails?.rooms?.length)) {
      warnings.push('Précisez les quantités pour une estimation plus précise');
    }

    // Si beaucoup de travaux différents
    const categories = new Set(quantities.map(q => q.context));
    if (categories.size > 4) {
      warnings.push('Projet multi-corps de métier : prévoyez une coordination');
    }

    return warnings;
  }

  /**
   * Génère une synthèse professionnelle du projet
   */
  static generateProfessionalSummary(
    description: string,
    workType: WorkType | undefined,
    quantities: ExtractedQuantity[],
    categories: string[],
    objectives: string[],
    propertyType?: string,
    propertySurface?: number,
    roomDetails?: RoomDetailsData
  ): string {
    const parts: string[] = [];

    // Introduction basée sur le type de projet
    const workTypeLabel = workType ? WORK_TYPE_LABELS[workType] : 'travaux';
    const propertyLabel = propertyType ? this.getPropertyLabel(propertyType) : 'bien';

    parts.push(`Projet de ${workTypeLabel} concernant votre ${propertyLabel}`);

    if (propertySurface && propertySurface > 0) {
      parts[0] += ` de ${propertySurface} m²`;
    }
    parts[0] += '.';

    // Périmètre des travaux
    if (roomDetails?.rooms?.length) {
      const roomCount = roomDetails.rooms.length;
      const roomTypes = roomDetails.rooms.map(r => {
        const config = ROOM_TYPE_CONFIG[r.type as RoomType];
        return config?.label || r.type;
      });
      const uniqueRoomTypes = [...new Set(roomTypes)];

      if (roomCount === 1) {
        parts.push(`L'intervention concerne ${uniqueRoomTypes[0]}.`);
      } else {
        parts.push(`L'intervention porte sur ${roomCount} pièces : ${uniqueRoomTypes.slice(0, 3).join(', ')}${uniqueRoomTypes.length > 3 ? '...' : ''}.`);
      }
    }

    // Quantités identifiées
    const significantQuantities = quantities.filter(q => q.confidence >= 0.7 && q.quantity > 0);
    if (significantQuantities.length > 0) {
      const quantityDescriptions = significantQuantities
        .slice(0, 4)
        .map(q => `${q.quantity} ${q.item}${q.quantity > 1 ? 's' : ''}`)
        .join(', ');
      parts.push(`Éléments identifiés : ${quantityDescriptions}.`);
    }

    // Catégories de travaux
    if (categories.length > 0) {
      parts.push(`Corps de métier concernés : ${categories.slice(0, 4).join(', ')}.`);
    }

    // Objectifs
    if (objectives.length > 0) {
      parts.push(`Objectif${objectives.length > 1 ? 's' : ''} : ${objectives.join(', ').toLowerCase()}.`);
    }

    return parts.join(' ');
  }

  /**
   * Retourne le label du type de propriété
   */
  private static getPropertyLabel(propertyType: string): string {
    const labels: Record<string, string> = {
      apartment: 'appartement',
      house: 'maison',
      villa: 'villa',
      loft: 'loft',
      studio: 'studio',
      building: 'immeuble',
      commercial: 'local commercial',
      office: 'bureau',
      warehouse: 'entrepôt',
      land: 'terrain',
    };
    return labels[propertyType] || 'bien';
  }
}

export default ProjectContextService;
