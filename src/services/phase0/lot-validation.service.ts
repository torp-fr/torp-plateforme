/**
 * TORP Phase 0 - Service de validation des lots
 * Gère les dépendances et incompatibilités entre lots de travaux
 */

import type { LotType, LotCategory } from '@/types/phase0/lots.types';
import type { WorkLot } from '@/types/phase0/work-project.types';

// =============================================================================
// TYPES
// =============================================================================

export interface LotDependency {
  sourceLot: LotType;
  targetLot: LotType;
  type: 'requires' | 'recommended' | 'suggests';
  reason: string;
  bidirectional?: boolean;
}

export interface LotIncompatibility {
  lot1: LotType;
  lot2: LotType;
  reason: string;
  severity: 'error' | 'warning';
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  suggestions: LotSuggestion[];
}

export interface ValidationIssue {
  type: 'dependency' | 'incompatibility' | 'technical';
  lotType: LotType;
  relatedLot?: LotType;
  message: string;
  severity: 'error' | 'warning';
  autoResolvable: boolean;
  resolution?: string;
}

export interface LotSuggestion {
  lotType: LotType;
  reason: string;
  source: 'dependency' | 'complementary' | 'efficiency';
  priority: 'high' | 'medium' | 'low';
}

// =============================================================================
// RÈGLES DE DÉPENDANCES
// =============================================================================

const LOT_DEPENDENCIES: LotDependency[] = [
  // Électricité
  {
    sourceLot: 'elec_renovation_complete',
    targetLot: 'platrerie_cloisons',
    type: 'recommended',
    reason: 'La rénovation électrique complète nécessite souvent des reprises de plâtrerie',
  },
  {
    sourceLot: 'elec_renovation_complete',
    targetLot: 'peinture_interieure',
    type: 'requires',
    reason: 'La rénovation électrique nécessite des finitions peinture après passage des câbles',
  },

  // Plomberie
  {
    sourceLot: 'plomb_sdb_complete',
    targetLot: 'carrelage_faience',
    type: 'requires',
    reason: 'La rénovation de salle de bain nécessite la pose de carrelage/faïence',
  },
  {
    sourceLot: 'plomb_sdb_complete',
    targetLot: 'elec_sdb_nfc15100',
    type: 'requires',
    reason: 'La rénovation SdB doit être conforme aux normes électriques NFC 15-100',
  },
  {
    sourceLot: 'plomb_cuisine',
    targetLot: 'elec_cuisine',
    type: 'recommended',
    reason: 'La rénovation cuisine implique généralement une mise aux normes électrique',
  },

  // Chauffage / CVC
  {
    sourceLot: 'chauff_pac_air_eau',
    targetLot: 'elec_tableau_puissance',
    type: 'requires',
    reason: 'L\'installation d\'une PAC nécessite une adaptation du tableau électrique',
  },
  {
    sourceLot: 'chauff_pac_air_eau',
    targetLot: 'chauff_plancher_chauffant',
    type: 'recommended',
    reason: 'Une PAC est plus efficace avec un plancher chauffant basse température',
  },
  {
    sourceLot: 'chauff_chaudiere_condensation',
    targetLot: 'chauff_radiateurs',
    type: 'recommended',
    reason: 'Le remplacement de chaudière peut nécessiter l\'adaptation des radiateurs',
  },

  // Isolation
  {
    sourceLot: 'isol_combles_perdus',
    targetLot: 'ventil_vmc_simple',
    type: 'requires',
    reason: 'L\'isolation nécessite une ventilation adaptée pour éviter condensation',
  },
  {
    sourceLot: 'isol_murs_interieur',
    targetLot: 'elec_depose_repose',
    type: 'requires',
    reason: 'L\'isolation intérieure implique la dépose/repose des éléments électriques',
  },
  {
    sourceLot: 'isol_murs_interieur',
    targetLot: 'platrerie_cloisons',
    type: 'requires',
    reason: 'L\'isolation par l\'intérieur nécessite des finitions plâtrerie',
  },
  {
    sourceLot: 'isol_murs_exterieur',
    targetLot: 'facades_ravalement',
    type: 'requires',
    reason: 'L\'ITE implique une finition de façade',
  },

  // Menuiseries
  {
    sourceLot: 'menuis_fenetres_pvc',
    targetLot: 'platrerie_embrasures',
    type: 'recommended',
    reason: 'Le changement de fenêtres peut nécessiter une reprise des embrasures',
  },
  {
    sourceLot: 'menuis_fenetres_alu',
    targetLot: 'platrerie_embrasures',
    type: 'recommended',
    reason: 'Le changement de fenêtres peut nécessiter une reprise des embrasures',
  },

  // Toiture
  {
    sourceLot: 'couv_refection_complete',
    targetLot: 'charp_traitement',
    type: 'recommended',
    reason: 'La réfection de toiture est l\'occasion de traiter la charpente',
  },
  {
    sourceLot: 'couv_refection_complete',
    targetLot: 'isol_toiture_sarking',
    type: 'recommended',
    reason: 'Profiter de la réfection pour isoler par l\'extérieur',
  },

  // Maçonnerie / Structure
  {
    sourceLot: 'maconnerie_ouverture',
    targetLot: 'menuis_portes_interieures',
    type: 'requires',
    reason: 'La création d\'ouverture nécessite la pose de menuiseries',
  },
  {
    sourceLot: 'maconnerie_demolition',
    targetLot: 'platrerie_cloisons',
    type: 'requires',
    reason: 'Après démolition, des reprises de cloisons sont nécessaires',
  },
];

// =============================================================================
// RÈGLES D'INCOMPATIBILITÉS
// =============================================================================

const LOT_INCOMPATIBILITIES: LotIncompatibility[] = [
  // Chauffage - Systèmes exclusifs
  {
    lot1: 'chauff_pac_air_eau',
    lot2: 'chauff_chaudiere_fioul',
    reason: 'Installation de PAC incompatible avec maintien d\'une chaudière fioul',
    severity: 'error',
  },
  {
    lot1: 'chauff_pac_air_air',
    lot2: 'chauff_plancher_chauffant',
    reason: 'PAC air-air (splits) non compatible avec plancher chauffant',
    severity: 'error',
  },
  {
    lot1: 'chauff_poele_bois',
    lot2: 'chauff_chaudiere_bois',
    reason: 'Poêle et chaudière bois sont redondants - choisir l\'un ou l\'autre',
    severity: 'warning',
  },

  // Isolation - Méthodes incompatibles
  {
    lot1: 'isol_murs_interieur',
    lot2: 'isol_murs_exterieur',
    reason: 'L\'isolation intérieure et extérieure sont exclusives pour les mêmes murs',
    severity: 'warning',
  },

  // Ventilation
  {
    lot1: 'ventil_vmc_simple',
    lot2: 'ventil_vmc_double',
    reason: 'VMC simple flux et double flux sont exclusives',
    severity: 'error',
  },

  // Menuiseries
  {
    lot1: 'menuis_fenetres_pvc',
    lot2: 'menuis_fenetres_bois',
    reason: 'Choisir un type de menuiserie homogène (PVC ou bois)',
    severity: 'warning',
  },
  {
    lot1: 'menuis_fenetres_pvc',
    lot2: 'menuis_fenetres_alu',
    reason: 'Choisir un type de menuiserie homogène pour l\'esthétique',
    severity: 'warning',
  },

  // Revêtements de sol
  {
    lot1: 'sols_parquet_massif',
    lot2: 'sols_carrelage',
    reason: 'Les deux types de sol ne peuvent être posés sur la même surface',
    severity: 'warning',
  },
];

// =============================================================================
// SERVICE
// =============================================================================

export class LotValidationService {
  /**
   * Valide une sélection de lots
   */
  static validateSelection(selectedLots: WorkLot[]): ValidationResult {
    const selectedTypes = selectedLots.map(l => l.lotType);
    const errors: ValidationIssue[] = [];
    const warnings: ValidationIssue[] = [];
    const suggestions: LotSuggestion[] = [];

    // Vérifier les incompatibilités
    for (const incomp of LOT_INCOMPATIBILITIES) {
      const hasLot1 = selectedTypes.includes(incomp.lot1);
      const hasLot2 = selectedTypes.includes(incomp.lot2);

      if (hasLot1 && hasLot2) {
        const issue: ValidationIssue = {
          type: 'incompatibility',
          lotType: incomp.lot1,
          relatedLot: incomp.lot2,
          message: incomp.reason,
          severity: incomp.severity,
          autoResolvable: false,
          resolution: `Retirer l'un des deux lots : ${incomp.lot1} ou ${incomp.lot2}`,
        };

        if (incomp.severity === 'error') {
          errors.push(issue);
        } else {
          warnings.push(issue);
        }
      }
    }

    // Vérifier les dépendances manquantes
    for (const dep of LOT_DEPENDENCIES) {
      const hasSource = selectedTypes.includes(dep.sourceLot);
      const hasTarget = selectedTypes.includes(dep.targetLot);

      if (hasSource && !hasTarget) {
        if (dep.type === 'requires') {
          errors.push({
            type: 'dependency',
            lotType: dep.sourceLot,
            relatedLot: dep.targetLot,
            message: dep.reason,
            severity: 'error',
            autoResolvable: true,
            resolution: `Ajouter le lot ${dep.targetLot}`,
          });
        } else if (dep.type === 'recommended') {
          suggestions.push({
            lotType: dep.targetLot,
            reason: dep.reason,
            source: 'dependency',
            priority: 'high',
          });
        } else if (dep.type === 'suggests') {
          suggestions.push({
            lotType: dep.targetLot,
            reason: dep.reason,
            source: 'complementary',
            priority: 'medium',
          });
        }
      }
    }

    // Ajouter des suggestions d'efficacité
    suggestions.push(...this.getEfficiencySuggestions(selectedTypes));

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions: this.deduplicateSuggestions(suggestions),
    };
  }

  /**
   * Vérifie si deux lots sont incompatibles
   */
  static areLotsIncompatible(lot1: LotType, lot2: LotType): LotIncompatibility | null {
    return LOT_INCOMPATIBILITIES.find(
      incomp =>
        (incomp.lot1 === lot1 && incomp.lot2 === lot2) ||
        (incomp.lot1 === lot2 && incomp.lot2 === lot1)
    ) || null;
  }

  /**
   * Obtient les dépendances requises pour un lot
   */
  static getRequiredDependencies(lotType: LotType): LotDependency[] {
    return LOT_DEPENDENCIES.filter(
      dep => dep.sourceLot === lotType && dep.type === 'requires'
    );
  }

  /**
   * Obtient les dépendances recommandées pour un lot
   */
  static getRecommendedDependencies(lotType: LotType): LotDependency[] {
    return LOT_DEPENDENCIES.filter(
      dep => dep.sourceLot === lotType && dep.type === 'recommended'
    );
  }

  /**
   * Obtient tous les lots incompatibles avec un lot donné
   */
  static getIncompatibleLots(lotType: LotType): LotIncompatibility[] {
    return LOT_INCOMPATIBILITIES.filter(
      incomp => incomp.lot1 === lotType || incomp.lot2 === lotType
    );
  }

  /**
   * Vérifie si l'ajout d'un lot est valide
   */
  static canAddLot(
    lotToAdd: LotType,
    currentLots: LotType[]
  ): { canAdd: boolean; blockers: ValidationIssue[] } {
    const blockers: ValidationIssue[] = [];

    // Vérifier les incompatibilités avec les lots existants
    for (const existing of currentLots) {
      const incomp = this.areLotsIncompatible(lotToAdd, existing);
      if (incomp && incomp.severity === 'error') {
        blockers.push({
          type: 'incompatibility',
          lotType: lotToAdd,
          relatedLot: existing,
          message: incomp.reason,
          severity: 'error',
          autoResolvable: false,
        });
      }
    }

    return {
      canAdd: blockers.length === 0,
      blockers,
    };
  }

  /**
   * Résout automatiquement les dépendances requises
   */
  static autoResolveDependencies(selectedLots: LotType[]): LotType[] {
    const allLots = new Set(selectedLots);
    let hasChanges = true;

    // Répéter jusqu'à ce qu'il n'y ait plus de dépendances à résoudre
    while (hasChanges) {
      hasChanges = false;

      for (const lot of Array.from(allLots)) {
        const required = this.getRequiredDependencies(lot);
        for (const dep of required) {
          if (!allLots.has(dep.targetLot)) {
            allLots.add(dep.targetLot);
            hasChanges = true;
          }
        }
      }
    }

    return Array.from(allLots);
  }

  /**
   * Suggestions basées sur l'efficacité des travaux
   */
  private static getEfficiencySuggestions(selectedTypes: LotType[]): LotSuggestion[] {
    const suggestions: LotSuggestion[] = [];

    // Si isolation sans VMC
    const hasIsolation = selectedTypes.some(t =>
      t.startsWith('isol_') || t.includes('isolation')
    );
    const hasVMC = selectedTypes.some(t => t.startsWith('ventil_'));

    if (hasIsolation && !hasVMC) {
      suggestions.push({
        lotType: 'ventil_vmc_simple',
        reason: 'L\'isolation renforcée nécessite une ventilation efficace pour éviter les problèmes d\'humidité',
        source: 'efficiency',
        priority: 'high',
      });
    }

    // Si fenêtres sans volets roulants
    const hasFenetres = selectedTypes.some(t => t.includes('fenetres'));
    const hasVolets = selectedTypes.some(t => t.includes('volets'));

    if (hasFenetres && !hasVolets) {
      suggestions.push({
        lotType: 'menuis_volets_roulants',
        reason: 'Profiter du changement de fenêtres pour installer des volets performants',
        source: 'efficiency',
        priority: 'medium',
      });
    }

    // Si PAC sans thermostat connecté
    const hasPAC = selectedTypes.some(t => t.includes('pac'));
    const hasThermostat = selectedTypes.some(t => t.includes('thermostat'));

    if (hasPAC && !hasThermostat) {
      suggestions.push({
        lotType: 'chauff_thermostat_connecte',
        reason: 'Un thermostat connecté optimise les performances de la PAC et réduit la consommation',
        source: 'efficiency',
        priority: 'medium',
      });
    }

    return suggestions;
  }

  /**
   * Déduplique les suggestions
   */
  private static deduplicateSuggestions(suggestions: LotSuggestion[]): LotSuggestion[] {
    const seen = new Map<LotType, LotSuggestion>();

    for (const suggestion of suggestions) {
      const existing = seen.get(suggestion.lotType);
      if (!existing || this.getPriorityValue(suggestion.priority) > this.getPriorityValue(existing.priority)) {
        seen.set(suggestion.lotType, suggestion);
      }
    }

    return Array.from(seen.values());
  }

  private static getPriorityValue(priority: 'high' | 'medium' | 'low'): number {
    switch (priority) {
      case 'high': return 3;
      case 'medium': return 2;
      case 'low': return 1;
    }
  }
}

export default LotValidationService;
