/**
 * Work Type → Rule Activation Map
 *
 * For each WorkType, defines:
 *
 *   property_keys   — canonical property identifiers that rules must carry to
 *                     be considered applicable to this work type. These are the
 *                     same property_key values stored in the `rules` table.
 *
 *   domains         — rule domains (e.g. 'DTU 26.2', 'NF EN 13813') that
 *                     cover this work type. Used to scope activation queries.
 *
 *   categories      — document categories (DTU, EUROCODE…) that produce rules
 *                     for this work type. Must be a subset of SUPPORTED_CATEGORIES.
 *
 *   required_context — context fields that must be present in the quote to
 *                      fully verify rules for this work type. When absent,
 *                      dependent rules are flagged non_verifiable.
 *
 *   dtu_refs         — DTU/Eurocode/NF references that directly cover this
 *                      work type (for documentation and audit purposes).
 *
 * Design:
 *   - property_keys must remain in sync with what ruleExtraction.worker.ts
 *     populates in the `rules.property_key` column.
 *   - required_context drives the verifiability engine (ruleActivation.service.ts).
 *   - A work type may share domains with other work types (e.g. TOITURE and
 *     ETANCHEITE both reference DTU 43.x for toiture-terrasse).
 */

import type { WorkType } from './workTypes';
import type { RequiredContext } from './workTypes';

// =============================================================================
// Rule activation spec per work type
// =============================================================================

export interface WorkTypeRuleSpec {
  /** Canonical property keys applicable to this work type */
  property_keys: string[];
  /**
   * Rule domains (DTU references, Eurocode chapters, NF norms) that cover
   * this work type. Used for rule scoping in activation queries.
   */
  domains: string[];
  /** Document categories that can produce rules for this work type */
  categories: string[];
  /**
   * Context fields that, when absent, cause applicable rules to be flagged
   * non_verifiable rather than verifiable.
   */
  required_context: RequiredContext[];
  /** Normative reference documents for audit log and user display */
  dtu_refs: string[];
}

// =============================================================================
// Map — keyed by WorkType
// =============================================================================

export const WORK_TYPE_RULES_MAP: Readonly<Record<WorkType, WorkTypeRuleSpec>> = {

  // ──────────────────────────────────────────────────────────────────────────
  CHAPE: {
    property_keys: [
      'epaisseur_chape',
      'epaisseur_chape_flottante',
      'epaisseur_chape_rapportee',
      'resistance_compression',
      'resistance_traction',
      'planeite',
      'temps_sechage',
      'desolidarisation',
      'joint_peripherique',
      'joint_de_fractionnement',
      'dosage_ciment',
      'rapport_eau_ciment',
    ],
    domains: ['DTU 26.2', 'NF EN 13813', 'NF EN 13892'],
    categories: ['DTU', 'NORMES'],
    required_context: [],
    dtu_refs: ['DTU 26.2'],
  },

  // ──────────────────────────────────────────────────────────────────────────
  TOITURE: {
    property_keys: [
      'pente_toiture',
      'pente_minimale',
      'pureau_tuile',
      'recouvrement',
      'litelage',
      'voligeage',
      'sous_toiture',
      'ecran_sous_toiture',
      'ventilation_comble',
      'fixation_tuile',
      'fixation_ardoise',
      'resistance_vent',
      'zone_vent',
      'neige_surcharge',
    ],
    domains: ['DTU 40.11', 'DTU 40.12', 'DTU 40.13', 'DTU 40.14', 'DTU 40.21', 'DTU 40.22', 'DTU 40.23', 'NF EN 1991-1-3'],
    categories: ['DTU', 'NORMES', 'EUROCODE'],
    required_context: ['zone_climatique'],
    dtu_refs: ['DTU 40.11', 'DTU 40.12', 'DTU 40.14', 'DTU 40.21', 'DTU 40.22'],
  },

  // ──────────────────────────────────────────────────────────────────────────
  ISOLATION: {
    property_keys: [
      'resistance_thermique',
      'conductivite_thermique',
      'epaisseur_isolant',
      'performance_acoustique',
      'indice_affaiblissement',
      'classe_reaction_feu',
      'vapeur_permeabilite',
      'pont_thermique',
      'deperdition_thermique',
      'uw_value',
      'valeur_r',
    ],
    domains: ['DTU 45.1', 'DTU 45.2', 'DTU 45.3', 'RE 2020', 'NF EN ISO 6946'],
    categories: ['DTU', 'NORMES', 'GUIDE_TECHNIQUE'],
    required_context: ['zone_climatique'],
    dtu_refs: ['DTU 45.1', 'DTU 45.2', 'DTU 45.3'],
  },

  // ──────────────────────────────────────────────────────────────────────────
  MENUISERIE: {
    property_keys: [
      'uw_menuiserie',
      'uw_porte',
      'sw_vitrage',
      'facteur_solaire',
      'permeabilite_air',
      'etancheite_eau',
      'resistance_vent',
      'acces_pmr',
      'largeur_passage_utile',
      'resistance_effraction',
      'classification_aw',
      'double_vitrage',
      'triple_vitrage',
    ],
    domains: ['DTU 36.1', 'DTU 36.2', 'DTU 36.5', 'DTU 37.1', 'NF EN 14351-1'],
    categories: ['DTU', 'NORMES', 'CODE_CONSTRUCTION'],
    required_context: ['zone_climatique', 'destination_batiment'],
    dtu_refs: ['DTU 36.1', 'DTU 36.2', 'DTU 36.5', 'DTU 37.1'],
  },

  // ──────────────────────────────────────────────────────────────────────────
  FONDATION: {
    property_keys: [
      'profondeur_fondation',
      'largeur_semelle',
      'section_semelle',
      'capacite_portante',
      'tassement_differentiel',
      'ancrage_hors_gel',
      'enrobage_beton',
      'resistance_beton',
      'ferraillage_minimum',
      'classe_sol',
      'indice_plasticite',
      'etude_sol',
    ],
    domains: ['DTU 13.1', 'DTU 13.2', 'DTU 13.3', 'NF EN 1997-1', 'NF P 94-500'],
    categories: ['DTU', 'EUROCODE', 'NORMES'],
    required_context: ['type_sol', 'zone_sismique'],
    dtu_refs: ['DTU 13.1', 'DTU 13.2', 'DTU 13.3'],
  },

  // ──────────────────────────────────────────────────────────────────────────
  STRUCTURE: {
    property_keys: [
      'resistance_beton',
      'classe_exposition',
      'enrobage_beton',
      'section_armature',
      'ferraillage',
      'pourcentage_armatures',
      'espacement_armatures',
      'resistance_cisaillement',
      'resistance_compression_beton',
      'module_elasticite',
      'classe_ductilite',
      'capacite_dissipation',
    ],
    domains: ['NF EN 1992-1-1', 'NF EN 1998-1', 'DTU 21', 'NF EN 206'],
    categories: ['EUROCODE', 'NORMES', 'DTU'],
    required_context: ['zone_sismique', 'classe_exposition'],
    dtu_refs: ['DTU 21'],
  },

  // ──────────────────────────────────────────────────────────────────────────
  REVETEMENT_SOL: {
    property_keys: [
      'dureté_parquet',
      'epaisseur_lame',
      'epaisseur_sol_souple',
      'classe_usage',
      'resistance_glissance',
      'pose_collée',
      'pose_flottante',
      'acclimatation',
      'joint_dilatation',
      'preparation_support',
      'planéité_support',
    ],
    domains: ['DTU 51.1', 'DTU 51.2', 'DTU 53.1', 'DTU 53.2', 'DTU 53.3', 'NF EN 14342'],
    categories: ['DTU', 'NORMES'],
    required_context: [],
    dtu_refs: ['DTU 51.1', 'DTU 51.2', 'DTU 53.1', 'DTU 53.2'],
  },

  // ──────────────────────────────────────────────────────────────────────────
  ENDUIT: {
    property_keys: [
      'epaisseur_enduit',
      'adherence_support',
      'resistance_flexion',
      'absorption_eau',
      'durete_surface',
      'nombre_couches',
      'grain_enduit',
      'preparation_support',
      'humidite_support',
    ],
    domains: ['DTU 26.1', 'DTU 26.2', 'DTU 26.3', 'NF EN 998-1'],
    categories: ['DTU', 'NORMES'],
    required_context: [],
    dtu_refs: ['DTU 26.1', 'DTU 26.2', 'DTU 26.3'],
  },

  // ──────────────────────────────────────────────────────────────────────────
  CARRELAGE: {
    property_keys: [
      'format_carrelage',
      'epaisseur_carrelage',
      'module_joint',
      'adherence_collage',
      'resistance_glissance',
      'resistance_gel',
      'absorption_eau_carrelage',
      'joint_peripherique',
      'joint_fractionnement',
      'preparation_support',
      'deformation_support',
      'pente_evacuation',
    ],
    domains: ['DTU 52.1', 'DTU 52.2', 'NF EN 12004', 'NF EN 13888'],
    categories: ['DTU', 'NORMES'],
    required_context: [],
    dtu_refs: ['DTU 52.1', 'DTU 52.2'],
  },

  // ──────────────────────────────────────────────────────────────────────────
  PLOMBERIE: {
    property_keys: [
      'pente_evacuation',
      'diametre_canalisation',
      'pression_eau',
      'temperature_eau_chaude',
      'isolation_canalisation',
      'protection_gel',
      'ventilation_primaire',
      'ventilation_secondaire',
      'siphon_garde_eau',
      'materiau_canalisation',
      'conformite_nf',
    ],
    domains: ['DTU 60.1', 'DTU 60.2', 'DTU 60.3', 'DTU 60.11', 'NF EN 12056'],
    categories: ['DTU', 'NORMES'],
    required_context: [],
    dtu_refs: ['DTU 60.1', 'DTU 60.2', 'DTU 60.3', 'DTU 60.11'],
  },

  // ──────────────────────────────────────────────────────────────────────────
  ELECTRICITE: {
    property_keys: [
      'section_cable',
      'calibre_disjoncteur',
      'indice_protection',
      'distance_inter_prises',
      'hauteur_prises',
      'tableau_repartiteur',
      'differentiel_30ma',
      'terre_impedance',
      'resistance_isolement',
      'eclairage_secours',
      'alarme_incendie',
    ],
    domains: ['NF C 15-100', 'NF C 14-100', 'NF EN 60669'],
    categories: ['NORMES', 'CODE_CONSTRUCTION'],
    required_context: ['destination_batiment'],
    dtu_refs: ['NF C 15-100'],
  },

  // ──────────────────────────────────────────────────────────────────────────
  MACONNERIE: {
    property_keys: [
      'resistance_compression_bloc',
      'epaisseur_joint_mortier',
      'resistance_mortier',
      'chaine_angle',
      'planéité_paroi',
      'verticalite',
      'accrochage',
      'tableau_ouverture',
      'linteau',
      'resistance_vent',
    ],
    domains: ['DTU 20.1', 'DTU 20.11', 'DTU 20.12', 'DTU 20.13', 'NF EN 1996-1-1'],
    categories: ['DTU', 'EUROCODE', 'NORMES'],
    required_context: ['zone_sismique'],
    dtu_refs: ['DTU 20.1', 'DTU 20.11', 'DTU 20.12'],
  },

  // ──────────────────────────────────────────────────────────────────────────
  CHARPENTE: {
    property_keys: [
      'classe_bois',
      'classe_service',
      'section_bois',
      'entraxe',
      'contreventement',
      'assemblage',
      'protection_humidite',
      'traitement_bois',
      'classe_emploi',
      'connecteur',
      'resistance_feu',
      'durabilite',
    ],
    domains: ['DTU 31.1', 'DTU 31.2', 'DTU 31.3', 'NF EN 1995-1-1'],
    categories: ['DTU', 'EUROCODE', 'NORMES'],
    required_context: ['zone_climatique', 'zone_sismique'],
    dtu_refs: ['DTU 31.1', 'DTU 31.2', 'DTU 31.3'],
  },

  // ──────────────────────────────────────────────────────────────────────────
  CLOISON: {
    property_keys: [
      'indice_affaiblissement_acoustique',
      'resistance_feu',
      'stabilite_feu',
      'epaisseur_cloison',
      'hauteur_cloison',
      'entraxe_montants',
      'resistance_choc',
      'planeite_cloison',
      'traitement_joint',
    ],
    domains: ['DTU 25.1', 'DTU 25.2', 'DTU 25.4', 'DTU 25.41', 'NF EN 520'],
    categories: ['DTU', 'NORMES'],
    required_context: ['destination_batiment'],
    dtu_refs: ['DTU 25.1', 'DTU 25.2', 'DTU 25.4', 'DTU 25.41'],
  },

  // ──────────────────────────────────────────────────────────────────────────
  FACADE: {
    property_keys: [
      'resistance_vent_bardage',
      'lame_ventilation',
      'fixation_bardage',
      'resistance_feu_facade',
      'performance_thermique_ite',
      'epaisseur_isolant_ite',
      'fixation_isolant',
      'treillis_armature',
      'enduit_ite',
      'absorption_eau_facade',
    ],
    domains: ['DTU 41.2', 'DTU 45.10', 'NF EN 13162', 'Avis Technique'],
    categories: ['DTU', 'NORMES', 'GUIDE_TECHNIQUE'],
    required_context: ['zone_climatique'],
    dtu_refs: ['DTU 41.2', 'DTU 45.10'],
  },

  // ──────────────────────────────────────────────────────────────────────────
  ETANCHEITE: {
    property_keys: [
      'pente_toiture_terrasse',
      'pente_minimale_terrasse',
      'relevé_etancheite',
      'hauteur_releve',
      'protection_etancheite',
      'system_drainage',
      'type_membrane',
      'epaisseur_membrane',
      'soudure_recouvrement',
      'resistance_poinconnement',
      'ecran_separation',
    ],
    domains: ['DTU 43.1', 'DTU 43.2', 'DTU 43.3', 'DTU 43.4', 'DTU 43.5'],
    categories: ['DTU', 'NORMES'],
    required_context: [],
    dtu_refs: ['DTU 43.1', 'DTU 43.2', 'DTU 43.3', 'DTU 43.4', 'DTU 43.5'],
  },

  // ──────────────────────────────────────────────────────────────────────────
  DALLAGE: {
    property_keys: [
      'epaisseur_dallage',
      'resistance_beton_dallage',
      'joint_retrait',
      'joint_construction',
      'armature_dallage',
      'planéité_dallage',
      'couche_forme',
      'drainage_sous_dallage',
      'preparation_fond_forme',
      'surcharge_exploitation',
    ],
    domains: ['DTU 13.3', 'NF EN 1992-1-1'],
    categories: ['DTU', 'EUROCODE'],
    required_context: ['type_sol'],
    dtu_refs: ['DTU 13.3'],
  },

  // ──────────────────────────────────────────────────────────────────────────
  TERRASSEMENT: {
    property_keys: [
      'pente_talus',
      'coefficient_terre',
      'densite_compactage',
      'niveau_fond_fouille',
      'blindage_fouille',
      'rebouchage_compactage',
      'drainage_periphérique',
      'fond_forme_gravel',
      'geotextile',
    ],
    domains: ['DTU 12', 'NF P 11-300', 'NF P 94-500'],
    categories: ['DTU', 'NORMES'],
    required_context: ['type_sol'],
    dtu_refs: ['DTU 12'],
  },

  // ──────────────────────────────────────────────────────────────────────────
  CHAUFFAGE: {
    property_keys: [
      'puissance_chaudiere',
      'rendement_chaudiere',
      'temperature_eau_circuit',
      'pression_circuit',
      'debit_circulateur',
      'isolation_reseau',
      'regulation_temperature',
      'classe_energetique',
      'coefficient_performance',
      'vmc_debit',
      'renouvellement_air',
    ],
    domains: ['DTU 65.11', 'DTU 65.12', 'DTU 68.1', 'DTU 68.2', 'RE 2020', 'NF EN 14336'],
    categories: ['DTU', 'NORMES', 'CODE_CONSTRUCTION'],
    required_context: ['zone_climatique', 'destination_batiment'],
    dtu_refs: ['DTU 65.11', 'DTU 65.12', 'DTU 68.1', 'DTU 68.2'],
  },

  // ──────────────────────────────────────────────────────────────────────────
  PEINTURE: {
    property_keys: [
      'preparation_support_peinture',
      'nombre_couches_peinture',
      'epaisseur_film',
      'adherence_peinture',
      'brillance',
      'classe_lavabilite',
      'resistance_humidite',
      'couvrance',
      'finition',
    ],
    domains: ['DTU 59.1', 'DTU 59.2', 'DTU 59.3', 'DTU 59.4', 'NF T 30-073'],
    categories: ['DTU', 'NORMES'],
    required_context: [],
    dtu_refs: ['DTU 59.1', 'DTU 59.2', 'DTU 59.3', 'DTU 59.4'],
  },

};
