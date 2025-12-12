/**
 * Service de gestion des lots de travaux Phase 0
 * Gère le catalogue, la sélection et la configuration des lots
 */

import { supabase } from '@/lib/supabase';
import { LOT_CATALOG, LotType, LotCategory, LotDefinition, SelectedLot, LotConfiguration, LotPriority } from '@/types/phase0/lots.types';

// Interface pour les lignes de la table phase0_selected_lots
interface SelectedLotRow {
  id: string;
  project_id: string;
  lot_type: string;
  lot_number: string;
  category: string;
  name: string;
  description: string | null;
  priority: string;
  is_urgent: boolean;
  estimated_budget_min: number | null;
  estimated_budget_max: number | null;
  estimated_duration_days: number | null;
  custom_requirements: string | null;
  selected_prestations: string[] | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// Interface pour les lignes de la table phase0_lot_reference
interface LotReferenceRow {
  id: string;
  lot_type: string;
  lot_number: string;
  name: string;
  category: string;
  description: string | null;
  base_price_min: number | null;
  base_price_max: number | null;
  typical_duration_days: number | null;
  dtu_references: string[] | null;
  rge_eligible: boolean;
  common_prestations: string[] | null;
  required_diagnostics: string[] | null;
  is_active: boolean;
}

export class LotService {
  /**
   * Récupère le catalogue complet des lots depuis la référence
   */
  static async getLotCatalog(): Promise<LotDefinition[]> {
    const { data, error } = await supabase
      .from('phase0_lot_reference')
      .select('*')
      .eq('is_active', true)
      .order('lot_number', { ascending: true });

    if (error) {
      console.error('Erreur lors de la récupération du catalogue:', error);
      // Fallback sur le catalogue statique
      return LOT_CATALOG;
    }

    if (!data || data.length === 0) {
      return LOT_CATALOG;
    }

    return (data as LotReferenceRow[]).map(this.mapRowToLotDefinition);
  }

  /**
   * Récupère un lot spécifique du catalogue
   */
  static getLotDefinition(lotType: LotType): LotDefinition | undefined {
    return LOT_CATALOG.find(lot => lot.type === lotType);
  }

  /**
   * Récupère les lots par catégorie
   */
  static getLotsByCategory(category: LotCategory): LotDefinition[] {
    return LOT_CATALOG.filter(lot => lot.category === category);
  }

  /**
   * Récupère les lots sélectionnés pour un projet
   */
  static async getSelectedLots(projectId: string): Promise<SelectedLot[]> {
    const { data, error } = await supabase
      .from('phase0_selected_lots')
      .select('*')
      .eq('project_id', projectId)
      .order('lot_number', { ascending: true });

    if (error) {
      console.error('Erreur lors de la récupération des lots:', error);
      throw error;
    }

    return (data as SelectedLotRow[] || []).map(this.mapRowToSelectedLot);
  }

  /**
   * Ajoute un lot à un projet
   */
  static async addLotToProject(
    projectId: string,
    lotType: LotType,
    configuration?: Partial<LotConfiguration>
  ): Promise<SelectedLot> {
    const lotDefinition = this.getLotDefinition(lotType);

    if (!lotDefinition) {
      throw new Error(`Lot inconnu: ${lotType}`);
    }

    // Vérifie si le lot n'est pas déjà sélectionné
    const { data: existing } = await supabase
      .from('phase0_selected_lots')
      .select('id')
      .eq('project_id', projectId)
      .eq('lot_type', lotType)
      .single();

    if (existing) {
      throw new Error(`Le lot ${lotDefinition.name} est déjà sélectionné`);
    }

    const insertData = {
      project_id: projectId,
      lot_type: lotType,
      lot_number: lotDefinition.number,
      category: lotDefinition.category,
      name: lotDefinition.name,
      description: configuration?.description || lotDefinition.description,
      priority: configuration?.priority || 'medium',
      is_urgent: configuration?.isUrgent || false,
      estimated_budget_min: configuration?.estimatedBudget?.min || lotDefinition.basePriceRange?.min || null,
      estimated_budget_max: configuration?.estimatedBudget?.max || lotDefinition.basePriceRange?.max || null,
      estimated_duration_days: configuration?.estimatedDurationDays || lotDefinition.typicalDurationDays || null,
      custom_requirements: configuration?.customRequirements ? JSON.stringify(configuration.customRequirements) : null,
      selected_prestations: configuration?.selectedPrestations || [],
      notes: configuration?.notes || null,
    };

    const { data, error } = await supabase
      .from('phase0_selected_lots')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('Erreur lors de l\'ajout du lot:', error);
      throw error;
    }

    return this.mapRowToSelectedLot(data as SelectedLotRow);
  }

  /**
   * Ajoute plusieurs lots à un projet
   */
  static async addLotsToProject(
    projectId: string,
    lots: Array<{ type: LotType; configuration?: Partial<LotConfiguration> }>
  ): Promise<SelectedLot[]> {
    const results: SelectedLot[] = [];

    for (const lot of lots) {
      try {
        const selectedLot = await this.addLotToProject(projectId, lot.type, lot.configuration);
        results.push(selectedLot);
      } catch (error) {
        console.error(`Erreur lors de l'ajout du lot ${lot.type}:`, error);
        // Continue avec les autres lots
      }
    }

    return results;
  }

  /**
   * Met à jour la configuration d'un lot sélectionné
   */
  static async updateLotConfiguration(
    lotId: string,
    configuration: Partial<LotConfiguration>
  ): Promise<SelectedLot> {
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (configuration.description !== undefined) {
      updateData.description = configuration.description;
    }
    if (configuration.priority !== undefined) {
      updateData.priority = configuration.priority;
    }
    if (configuration.isUrgent !== undefined) {
      updateData.is_urgent = configuration.isUrgent;
    }
    if (configuration.estimatedBudget !== undefined) {
      updateData.estimated_budget_min = configuration.estimatedBudget.min;
      updateData.estimated_budget_max = configuration.estimatedBudget.max;
    }
    if (configuration.estimatedDurationDays !== undefined) {
      updateData.estimated_duration_days = configuration.estimatedDurationDays;
    }
    if (configuration.customRequirements !== undefined) {
      updateData.custom_requirements = JSON.stringify(configuration.customRequirements);
    }
    if (configuration.selectedPrestations !== undefined) {
      updateData.selected_prestations = configuration.selectedPrestations;
    }
    if (configuration.notes !== undefined) {
      updateData.notes = configuration.notes;
    }

    const { data, error } = await supabase
      .from('phase0_selected_lots')
      .update(updateData)
      .eq('id', lotId)
      .select()
      .single();

    if (error) {
      console.error('Erreur lors de la mise à jour du lot:', error);
      throw error;
    }

    return this.mapRowToSelectedLot(data as SelectedLotRow);
  }

  /**
   * Supprime un lot d'un projet
   */
  static async removeLotFromProject(lotId: string): Promise<void> {
    const { error } = await supabase
      .from('phase0_selected_lots')
      .delete()
      .eq('id', lotId);

    if (error) {
      console.error('Erreur lors de la suppression du lot:', error);
      throw error;
    }
  }

  /**
   * Supprime plusieurs lots d'un projet
   */
  static async removeLotsFromProject(lotIds: string[]): Promise<void> {
    const { error } = await supabase
      .from('phase0_selected_lots')
      .delete()
      .in('id', lotIds);

    if (error) {
      console.error('Erreur lors de la suppression des lots:', error);
      throw error;
    }
  }

  /**
   * Change la priorité d'un lot
   */
  static async setLotPriority(lotId: string, priority: LotPriority): Promise<void> {
    const { error } = await supabase
      .from('phase0_selected_lots')
      .update({ priority, updated_at: new Date().toISOString() })
      .eq('id', lotId);

    if (error) {
      console.error('Erreur lors du changement de priorité:', error);
      throw error;
    }
  }

  /**
   * Marque un lot comme urgent ou non
   */
  static async setLotUrgent(lotId: string, isUrgent: boolean): Promise<void> {
    const { error } = await supabase
      .from('phase0_selected_lots')
      .update({ is_urgent: isUrgent, updated_at: new Date().toISOString() })
      .eq('id', lotId);

    if (error) {
      console.error('Erreur lors du changement d\'urgence:', error);
      throw error;
    }
  }

  /**
   * Récupère les statistiques des lots d'un projet
   */
  static async getLotStats(projectId: string): Promise<{
    totalLots: number;
    byCategory: Record<LotCategory, number>;
    byPriority: Record<LotPriority, number>;
    urgentCount: number;
    estimatedBudgetTotal: { min: number; max: number };
    estimatedDurationTotal: number;
  }> {
    const lots = await this.getSelectedLots(projectId);

    const stats = {
      totalLots: lots.length,
      byCategory: {} as Record<LotCategory, number>,
      byPriority: {} as Record<LotPriority, number>,
      urgentCount: 0,
      estimatedBudgetTotal: { min: 0, max: 0 },
      estimatedDurationTotal: 0,
    };

    // Initialiser les compteurs
    const categories: LotCategory[] = ['gros_oeuvre', 'second_oeuvre', 'technique', 'finitions', 'exterieur', 'specifique'];
    const priorities: LotPriority[] = ['critical', 'high', 'medium', 'low', 'optional'];

    categories.forEach(cat => stats.byCategory[cat] = 0);
    priorities.forEach(pri => stats.byPriority[pri] = 0);

    // Calculer les statistiques
    lots.forEach(lot => {
      stats.byCategory[lot.category]++;
      stats.byPriority[lot.priority]++;

      if (lot.isUrgent) {
        stats.urgentCount++;
      }

      if (lot.estimatedBudget) {
        stats.estimatedBudgetTotal.min += lot.estimatedBudget.min || 0;
        stats.estimatedBudgetTotal.max += lot.estimatedBudget.max || 0;
      }

      if (lot.estimatedDurationDays) {
        // Les lots peuvent se chevaucher, donc on ne fait pas une simple addition
        // Pour une estimation réaliste, on pourrait diviser par un facteur
        stats.estimatedDurationTotal += lot.estimatedDurationDays;
      }
    });

    return stats;
  }

  /**
   * Vérifie la compatibilité entre lots
   */
  static checkLotCompatibility(
    selectedLots: LotType[]
  ): { compatible: boolean; warnings: string[]; suggestions: string[] } {
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Règles de compatibilité et suggestions
    const rules = [
      {
        condition: () => selectedLots.includes('plomberie') && !selectedLots.includes('cloisons_doublages'),
        suggestion: 'Les travaux de plomberie nécessitent souvent des interventions sur les cloisons.',
      },
      {
        condition: () => selectedLots.includes('electricite') && !selectedLots.includes('peinture'),
        suggestion: 'Les travaux d\'électricité laissent souvent des traces nécessitant des reprises de peinture.',
      },
      {
        condition: () => selectedLots.includes('menuiseries_exterieures') && !selectedLots.includes('etancheite'),
        suggestion: 'Le remplacement des menuiseries peut nécessiter des reprises d\'étanchéité.',
      },
      {
        condition: () => selectedLots.includes('isolation_thermique') && selectedLots.includes('ventilation'),
        warning: null,
        suggestion: 'Bonne pratique : isolation et ventilation sont complémentaires pour l\'efficacité énergétique.',
      },
      {
        condition: () => selectedLots.includes('couverture') && !selectedLots.includes('charpente'),
        warning: 'Attention : vérifiez l\'état de la charpente avant les travaux de couverture.',
      },
      {
        condition: () => selectedLots.includes('demolition') && selectedLots.length === 1,
        warning: 'Une démolition seule est rarement un projet complet.',
      },
      {
        condition: () => selectedLots.includes('piscine') && !selectedLots.includes('vrd'),
        suggestion: 'Une piscine nécessite généralement des travaux de VRD (raccordements).',
      },
      {
        condition: () => selectedLots.includes('ascenseur') && !selectedLots.includes('electricite'),
        warning: 'L\'installation d\'un ascenseur requiert une alimentation électrique dédiée.',
      },
    ];

    rules.forEach(rule => {
      if (rule.condition()) {
        if ('warning' in rule && rule.warning) {
          warnings.push(rule.warning);
        }
        if (rule.suggestion) {
          suggestions.push(rule.suggestion);
        }
      }
    });

    return {
      compatible: warnings.length === 0,
      warnings,
      suggestions,
    };
  }

  /**
   * Suggère des lots complémentaires
   */
  static suggestComplementaryLots(selectedLots: LotType[]): LotType[] {
    const suggestions = new Set<LotType>();

    const complementaryRules: Record<LotType, LotType[]> = {
      plomberie: ['cloisons_doublages', 'carrelage_faience', 'peinture'],
      electricite: ['cloisons_doublages', 'peinture'],
      chauffage: ['plomberie', 'electricite'],
      climatisation: ['electricite', 'ventilation'],
      isolation_thermique: ['ventilation', 'menuiseries_exterieures'],
      menuiseries_exterieures: ['etancheite', 'peinture'],
      couverture: ['charpente', 'etancheite', 'zinguerie'],
      facades: ['echafaudages', 'etancheite'],
      piscine: ['vrd', 'electricite', 'espaces_verts'],
      cuisine_equipee: ['plomberie', 'electricite', 'carrelage_faience'],
      salle_bains: ['plomberie', 'electricite', 'carrelage_faience', 'ventilation'],
      demolition: ['evacuation_dechets', 'gros_oeuvre'],
      gros_oeuvre: ['maconnerie', 'etancheite'],
      extension: ['gros_oeuvre', 'couverture', 'menuiseries_exterieures'],
      surelevation: ['charpente', 'couverture', 'facades'],
    };

    selectedLots.forEach(lot => {
      const complementary = complementaryRules[lot];
      if (complementary) {
        complementary.forEach(comp => {
          if (!selectedLots.includes(comp)) {
            suggestions.add(comp);
          }
        });
      }
    });

    return Array.from(suggestions);
  }

  /**
   * Calcule l'ordre d'exécution recommandé des lots
   */
  static getRecommendedExecutionOrder(selectedLots: LotType[]): LotType[] {
    // Ordre de priorité des catégories
    const categoryOrder: Record<LotCategory, number> = {
      gros_oeuvre: 1,
      technique: 2,
      second_oeuvre: 3,
      finitions: 4,
      exterieur: 5,
      specifique: 6,
    };

    // Ordre au sein de chaque catégorie (plus le numéro est bas, plus c'est prioritaire)
    const lotPriority: Partial<Record<LotType, number>> = {
      demolition: 1,
      terrassement: 2,
      gros_oeuvre: 3,
      maconnerie: 4,
      charpente: 5,
      couverture: 6,
      etancheite: 7,
      facades: 8,
      vrd: 9,
      plomberie: 10,
      electricite: 11,
      chauffage: 12,
      ventilation: 13,
      climatisation: 14,
      cloisons_doublages: 15,
      isolation_thermique: 16,
      menuiseries_interieures: 17,
      menuiseries_exterieures: 18,
      metallerie: 19,
      carrelage_faience: 20,
      parquet_sols_souples: 21,
      peinture: 22,
      revetements_muraux: 23,
      plafonds: 24,
      cuisine_equipee: 25,
      salle_bains: 26,
      espaces_verts: 27,
      nettoyage: 28,
    };

    return [...selectedLots].sort((a, b) => {
      const defA = this.getLotDefinition(a);
      const defB = this.getLotDefinition(b);

      if (!defA || !defB) return 0;

      // Comparer d'abord par catégorie
      const catDiff = categoryOrder[defA.category] - categoryOrder[defB.category];
      if (catDiff !== 0) return catDiff;

      // Puis par priorité dans la catégorie
      const prioA = lotPriority[a] || 100;
      const prioB = lotPriority[b] || 100;
      return prioA - prioB;
    });
  }

  /**
   * Filtre les lots par critères
   */
  static filterLots(
    criteria: {
      category?: LotCategory;
      rgeEligible?: boolean;
      maxBudget?: number;
      maxDuration?: number;
      searchTerm?: string;
    }
  ): LotDefinition[] {
    let filtered = [...LOT_CATALOG];

    if (criteria.category) {
      filtered = filtered.filter(lot => lot.category === criteria.category);
    }

    if (criteria.rgeEligible !== undefined) {
      filtered = filtered.filter(lot => lot.rgeEligible === criteria.rgeEligible);
    }

    if (criteria.maxBudget !== undefined) {
      filtered = filtered.filter(lot =>
        !lot.basePriceRange || lot.basePriceRange.min <= criteria.maxBudget!
      );
    }

    if (criteria.maxDuration !== undefined) {
      filtered = filtered.filter(lot =>
        !lot.typicalDurationDays || lot.typicalDurationDays <= criteria.maxDuration!
      );
    }

    if (criteria.searchTerm) {
      const term = criteria.searchTerm.toLowerCase();
      filtered = filtered.filter(lot =>
        lot.name.toLowerCase().includes(term) ||
        lot.description.toLowerCase().includes(term) ||
        lot.type.toLowerCase().includes(term)
      );
    }

    return filtered;
  }

  // Méthodes de mapping privées
  private static mapRowToSelectedLot(row: SelectedLotRow): SelectedLot {
    return {
      id: row.id,
      projectId: row.project_id,
      type: row.lot_type as LotType,
      number: row.lot_number,
      category: row.category as LotCategory,
      name: row.name,
      description: row.description || '',
      priority: row.priority as LotPriority,
      isUrgent: row.is_urgent,
      estimatedBudget: row.estimated_budget_min || row.estimated_budget_max ? {
        min: row.estimated_budget_min || 0,
        max: row.estimated_budget_max || 0,
      } : undefined,
      estimatedDurationDays: row.estimated_duration_days || undefined,
      customRequirements: row.custom_requirements ? JSON.parse(row.custom_requirements) : undefined,
      selectedPrestations: row.selected_prestations || [],
      notes: row.notes || undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  private static mapRowToLotDefinition(row: LotReferenceRow): LotDefinition {
    return {
      type: row.lot_type as LotType,
      number: row.lot_number,
      name: row.name,
      category: row.category as LotCategory,
      description: row.description || '',
      basePriceRange: row.base_price_min || row.base_price_max ? {
        min: row.base_price_min || 0,
        max: row.base_price_max || 0,
        unit: 'm²',
      } : undefined,
      typicalDurationDays: row.typical_duration_days || undefined,
      dtuReferences: row.dtu_references || [],
      rgeEligible: row.rge_eligible,
      commonPrestations: row.common_prestations || [],
      requiredDiagnostics: row.required_diagnostics || [],
    };
  }
}

export default LotService;
