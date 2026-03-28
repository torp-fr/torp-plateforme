/**
 * Work Type Keyword Map
 *
 * Maps each WorkType to the French keywords and phrases that identify it in
 * free-text construction quote descriptions.
 *
 * Design principles:
 *
 *   1. COVERAGE over PRECISION at this layer.
 *      The detection engine scores confidence from keyword count — a false
 *      positive with low confidence (< 0.5) is filtered out downstream.
 *
 *   2. ACCENT-INSENSITIVE matching.
 *      All entries are lowercased. The detection service normalises input
 *      to NFD before matching, so "chape" matches "chape" and "châpe".
 *
 *   3. PHRASE KEYWORDS first.
 *      Multi-word phrases ("chape flottante") score higher than single-word
 *      keywords ("chape"). A phrase match counts as 2 in confidence scoring.
 *
 *   4. TRADE-SPECIFIC ABBREVIATIONS are included.
 *      French BTP practitioners use "ite", "iti", "placo", "ba13", "pa+",
 *      "vmc", "pac" — these must be recognised.
 *
 *   5. OVERLAPPING TERMS are intentional.
 *      "toiture terrasse" triggers both TOITURE and ETANCHEITE because both
 *      rule sets apply. The confidence score distinguishes primary from secondary.
 */

import type { WorkType } from './workTypes';

export interface KeywordSpec {
  /** Single-word or abbreviation triggers (weight 1 in confidence scoring) */
  keywords: string[];
  /**
   * Multi-word phrase triggers (weight 2 — more specific than single words).
   * Must be lowercase, no diacritics, spaces allowed.
   */
  phrases: string[];
}

// =============================================================================
// Keyword map — keyed by WorkType
// =============================================================================

export const WORK_TYPE_KEYWORDS: Readonly<Record<WorkType, KeywordSpec>> = {

  // ──────────────────────────────────────────────────────────────────────────
  CHAPE: {
    keywords: [
      'chape', 'chapes', 'ragréage', 'ragréages', 'ragréage', 'ragreage',
      'chapiste', 'talochage', 'talochage',
    ],
    phrases: [
      'chape flottante', 'chape liquide', 'chape anhydrite', 'chape ciment',
      'chape fibre', 'chape allégée', 'chape seche', 'chape sèche',
      'chape de compression', 'chape de forme', 'chape rapide',
      'ragréage autolissant', 'ragréage fibré', 'ragréage de sol',
      'plancher chauffant noyé',   // chape poured over underfloor heating
    ],
  },

  // ──────────────────────────────────────────────────────────────────────────
  TOITURE: {
    keywords: [
      'toiture', 'couverture', 'toit', 'tuile', 'tuiles', 'ardoise',
      'ardoises', 'zinc', 'zinguerie', 'faitage', 'faîtage',
      'rive', 'noue', 'noues', 'chevêtre', 'lucarne', 'lucarnes',
      'chatière', 'solins',
    ],
    phrases: [
      'toiture inclinée', 'toiture en pente', 'couverture tuiles',
      'couverture ardoises', 'toiture bac acier', 'couverture zinc',
      'toiture traditionnelle', 'toiture débord', 'gouttière zinc',
      'chéneau zinc', 'tuyau de descente', 'couverture fibrociment',
      'couverture ondulée',
    ],
  },

  // ──────────────────────────────────────────────────────────────────────────
  ISOLATION: {
    keywords: [
      'isolation', 'isolant', 'isolants', 'isoler', 'iti', 'ite',
      'polystyrène', 'polystyrene', 'polyuréthane', 'polyurethane',
      'liège', 'liege', 'cellulose', 'ouate', 'chanvre',
      'résilience', 'resilience',
    ],
    phrases: [
      'isolation thermique', 'isolation acoustique', 'isolation phonique',
      'laine de verre', 'laine de roche', 'laine minérale',
      'isolation par l intérieur', 'isolation par l extérieur',
      'isolation sous rampant', 'isolation combles', 'isolation sol',
      'isolation toiture', 'doublage isolant', 'ite façade',
      'isolation des murs', 'isolation des combles perdus',
    ],
  },

  // ──────────────────────────────────────────────────────────────────────────
  MENUISERIE: {
    keywords: [
      'fenêtre', 'fenetre', 'fenêtres', 'fenetres', 'menuiserie',
      'menuiseries', 'volet', 'volets', 'portail', 'portails',
      'velux', 'châssis', 'chassis', 'oscillo', 'imposte',
      'allège', 'vitrage', 'vitrages', 'dormant', 'ouvrant',
    ],
    phrases: [
      'porte fenêtre', 'porte fenetre', 'baie vitrée', 'baie vitree',
      'double vitrage', 'triple vitrage', 'vitrage isolant',
      'menuiseries extérieures', 'menuiseries aluminium',
      'menuiseries pvc', 'menuiseries bois', 'fenêtre de toit',
      'porte d entrée', "porte d'entrée", 'porte blindée',
      'volet roulant', 'volet battant', 'volet persienne',
      'store extérieur', 'brise soleil',
    ],
  },

  // ──────────────────────────────────────────────────────────────────────────
  FONDATION: {
    keywords: [
      'fondation', 'fondations', 'semelle', 'semelles',
      'micropieu', 'micropieux', 'pieu', 'pieux', 'radier',
      'longrine', 'longrines', 'libage', 'sablon',
    ],
    phrases: [
      'fondations superficielles', 'fondations profondes',
      'semelle filante', 'semelle isolée', 'radier général',
      'pieux forés', 'pieux battus', 'micropieux injectés',
      'fondations sur sol argileux', 'fondations anti-sismiques',
      'arase de fondation', 'béton de fondation', 'béton de propreté',
    ],
  },

  // ──────────────────────────────────────────────────────────────────────────
  STRUCTURE: {
    keywords: [
      'structure', 'structurelle', 'structurel', 'béton', 'beton',
      'armature', 'armatures', 'ferraillage', 'acier', 'voile',
      'voiles', 'poteau', 'poteaux', 'poutre', 'poutres',
      'dalle', 'plancher', 'refend', 'chaîne', 'tirant',
    ],
    phrases: [
      'béton armé', 'beton armé', 'voile béton', 'voile beton',
      'plancher béton', 'dalle béton', 'structure béton',
      'béton de structure', 'poutre en béton', 'poteau en béton',
      'mur de refend', 'chaîne d accrochage', 'béton de plancher',
      'dalle pleine', 'dalle nervurée', 'plancher hourdis',
      'structure métallique', 'charpente métallique',
    ],
  },

  // ──────────────────────────────────────────────────────────────────────────
  REVETEMENT_SOL: {
    keywords: [
      'parquet', 'stratifié', 'stratifie', 'moquette', 'linoléum',
      'linoleum', 'lvt', 'spc', 'vinyl', 'vinyle', 'lame',
      'plancher', 'bambou', 'lièges', 'dalles pvc',
    ],
    phrases: [
      'revêtement sol', 'revetement sol', 'revêtement de sol',
      'sol souple', 'sol PVC', 'parquet massif', 'parquet contrecollé',
      'parquet flottant', 'parquet collé', 'plancher bois',
      'lame de parquet', 'sol stratifié', 'revêtement vinyle',
      'dalle de sol', 'sol de sport', 'sol technique',
    ],
  },

  // ──────────────────────────────────────────────────────────────────────────
  ENDUIT: {
    keywords: [
      'enduit', 'enduits', 'crépi', 'crepi', 'ravalement',
      'crépissage', 'crepissage', 'badigeon', 'gobetis', 'arriccio',
      'finition', 'talochage',
    ],
    phrases: [
      'enduit de façade', 'enduit intérieur', 'enduit extérieur',
      'enduit de mortier', 'enduit monocouche', 'enduit bicouche',
      'enduit tricouche', 'enduit projeté', 'ravalement de façade',
      'enduit à la chaux', 'enduit plâtre', 'enduit de lissage',
      'gobetis d accrochage', 'enduit de dressage', 'enduit de finition',
    ],
  },

  // ──────────────────────────────────────────────────────────────────────────
  CARRELAGE: {
    keywords: [
      'carrelage', 'carreaux', 'céramique', 'ceramique',
      'grès', 'gres', 'faïence', 'faience', 'mosaïque', 'mosaique',
      'grès cérame', 'gres cerame', 'joint', 'colle',
    ],
    phrases: [
      'pose carrelage', 'revêtement céramique', 'revêtement carrelage',
      'carrelage sol', 'carrelage mur', 'carrelage salle de bain',
      'carrelage cuisine', 'faïence murale', 'grès cérame rectifié',
      'carrelage grand format', 'carrelage imitation bois',
      'joint de carrelage', 'colle carrelage', 'joint époxy',
      'dépose carrelage existant', 'carrelage antidérapant',
    ],
  },

  // ──────────────────────────────────────────────────────────────────────────
  PLOMBERIE: {
    keywords: [
      'plomberie', 'tuyauterie', 'sanitaire', 'sanitaires',
      'lavabo', 'évier', 'evier', 'wc', 'toilette', 'baignoire',
      'douche', 'receveur', 'robinetterie', 'canalisation',
      'canalisations', 'évacuation', 'evacuation',
    ],
    phrases: [
      'alimentation eau froide', 'alimentation eau chaude',
      'eau chaude sanitaire', 'réseau eaux usées', 'réseau eaux pluviales',
      'colonne montante', 'chute eaux usées', 'siphon de sol',
      'ventilation primaire', 'ventilation secondaire',
      'plancher technique plomberie', 'salle de bain',
      'installation sanitaire', 'ensemble sanitaire',
    ],
  },

  // ──────────────────────────────────────────────────────────────────────────
  ELECTRICITE: {
    keywords: [
      'électricité', 'electricite', 'câblage', 'cablage',
      'prise', 'prises', 'interrupteur', 'disjoncteur',
      'tableau', 'éclairage', 'eclairage', 'luminaire',
      'gaine', 'conduit', 'vrd', 'courant',
    ],
    phrases: [
      'tableau électrique', 'tableau electrique', 'coffret électrique',
      'câblage électrique', 'installation électrique', 'mise en conformité',
      'courant fort', 'courant faible', 'nf c 15-100',
      'éclairage led', 'domotique', 'système alarme',
      'prise rj45', 'prise antenne', 'interphone', 'visiophone',
      'bornier de terre', 'liaison équipotentielle',
    ],
  },

  // ──────────────────────────────────────────────────────────────────────────
  MACONNERIE: {
    keywords: [
      'maçonnerie', 'maconnerie', 'parpaing', 'parpaings',
      'brique', 'briques', 'agglo', 'agglos', 'bloc', 'blocs',
      'jointoiement', 'mortier', 'pilier', 'muret', 'mur',
    ],
    phrases: [
      'bloc béton', 'bloc beton', 'mur de maçonnerie',
      'mur en parpaing', 'mur en brique', 'mur de clôture',
      'mur de soutènement', 'mur de soubassement',
      'mortier de maçonnerie', 'maçonnerie de moellons',
      'rejointoiement joints', 'linteau béton',
      'tableau de fenêtre', 'tableau de porte',
    ],
  },

  // ──────────────────────────────────────────────────────────────────────────
  CHARPENTE: {
    keywords: [
      'charpente', 'charpentes', 'fermette', 'fermettes',
      'chevron', 'chevrons', 'panne', 'pannes', 'faîtière',
      'faîtage', 'contreventement', 'lisses', 'solives',
      'madrier', 'lamellé', 'osb',
    ],
    phrases: [
      'charpente bois', 'charpente traditionnelle', 'charpente fermette',
      'charpente industrielle', 'ossature bois', 'structure bois',
      'lamellé collé', 'bois lamellé', 'poutre bois',
      'charpente métallique', 'charpente bois massif',
      'contreventement triangulaire', 'charpente en bois résineux',
      'structure de toiture', 'travaux de charpente',
    ],
  },

  // ──────────────────────────────────────────────────────────────────────────
  CLOISON: {
    keywords: [
      'cloison', 'cloisons', 'doublage', 'plaque', 'plaques',
      'placo', 'ba13', 'staff', 'plâtrerie', 'platerie',
      'plafond', 'faux-plafond', 'suspente', 'rail',
    ],
    phrases: [
      'plaque de plâtre', 'plaques de plâtre', 'cloison placo',
      'cloison distributive', 'doublage thermique', 'doublage acoustique',
      'faux plafond', 'faux-plafond suspendu', 'plafond suspendu',
      'dalle minérale', 'ossature métallique', 'montant acier',
      'cloison amovible', 'cloison hydrofuge', 'cloison ba13',
      'cloison coupe-feu', 'cloison phonique',
    ],
  },

  // ──────────────────────────────────────────────────────────────────────────
  FACADE: {
    keywords: [
      'façade', 'facade', 'bardage', 'parement', 'vêture',
      'vêtage', 'habillage', 'revêtement', 'revetement',
      'soubassement', 'bandeaux',
    ],
    phrases: [
      'isolation thermique extérieure', 'ite façade', 'ite sur façade',
      'bardage bois', 'bardage fibre ciment', 'bardage composite',
      'bardage métallique', 'enduit de façade', 'ravalement façade',
      'peinture façade', 'parement pierre', 'parement brique',
      'vêtage façade', 'habillage façade',
    ],
  },

  // ──────────────────────────────────────────────────────────────────────────
  ETANCHEITE: {
    keywords: [
      'étanchéité', 'etancheite', 'membrane', 'bitume',
      'epdm', 'tpo', 'pvc souple', 'asphalte', 'relief',
      'relevé', 'releve', 'naissance',
    ],
    phrases: [
      'toiture terrasse', 'toiture plate', 'terrasse accessible',
      'terrasse inaccessible', 'terrasse technique',
      'étanchéité toiture', 'membrane bitumineuse',
      'membrane epdm', 'complexe d étanchéité',
      'protection lourde', 'protection légère',
      'relevé d étanchéité', 'naissance avaloir',
      'pont de dilatation', 'étanchéité sous carrelage',
    ],
  },

  // ──────────────────────────────────────────────────────────────────────────
  DALLAGE: {
    keywords: [
      'dallage', 'dallages', 'dalle', 'dalles',
      'sol béton', 'sol industriel', 'dalle sol',
    ],
    phrases: [
      'dallage béton', 'dallage industriel', 'dallage sur sol',
      'dalle sur vide sanitaire', 'dalle de rez-de-chaussée',
      'plancher sur terre-plein', 'dalle sur remblais',
      'dallage résilient', 'joint de dilatation dallage',
      'joint de retrait', 'armature dallage', 'treillis soudé',
    ],
  },

  // ──────────────────────────────────────────────────────────────────────────
  TERRASSEMENT: {
    keywords: [
      'terrassement', 'terrassements', 'décapage', 'fouille',
      'fouilles', 'tranchée', 'tranchees', 'remblai', 'remblais',
      'compactage', 'nivellement', 'décaissement', 'excavation',
    ],
    phrases: [
      'terrassement en masse', 'terrassement général',
      'fouille en rigole', 'fouille en puits',
      'fouille pour fondations', 'décapage terre végétale',
      'mise en dépôt', 'évacuation déblais',
      'remblai compacté', 'remblai de fondation',
      'nivellement terrain', 'planage terrain',
    ],
  },

  // ──────────────────────────────────────────────────────────────────────────
  CHAUFFAGE: {
    keywords: [
      'chauffage', 'chaudière', 'chaudiere', 'radiateur',
      'convecteur', 'vmc', 'ventilation', 'climatisation',
      'pac', 'thermopompe', 'poêle', 'insert',
    ],
    phrases: [
      'plancher chauffant', 'plancher rayonnant',
      'pompe à chaleur', 'pompe a chaleur', 'chaudière gaz',
      'chaudière fioul', 'chaudière à condensation',
      'vmc simple flux', 'vmc double flux',
      'réseau de chauffage', 'corps de chauffe',
      'ballon thermodynamique', 'eau chaude sanitaire',
      'système de régulation', 'thermostat programmable',
    ],
  },

  // ──────────────────────────────────────────────────────────────────────────
  PEINTURE: {
    keywords: [
      'peinture', 'peintures', 'lasure', 'vernis', 'badigeon',
      'finition', 'finitions', 'teinture', 'primaire',
      'sous-couche', 'enduit de lissage',
    ],
    phrases: [
      'travaux de peinture', 'peinture intérieure', 'peinture extérieure',
      'peinture façade', 'peinture plafond', 'peinture murs',
      'peinture boiseries', 'lasure bois', 'vernis bois',
      'primaire d accrochage', 'peinture acrylique',
      'peinture glycéro', 'peinture mat', 'peinture satin',
      'décoration peinture', 'remise en peinture',
    ],
  },

} as const;

// =============================================================================
// Derived: flattened keyword → WorkType reverse index
// (used by the detection service for efficient lookup)
// =============================================================================

/** Weight multiplier for phrase matches (higher specificity) */
export const PHRASE_WEIGHT = 2;
/** Weight multiplier for single-keyword matches */
export const KEYWORD_WEIGHT = 1;

/** Max denominator for confidence calculation per work type */
export function maxScoreForWorkType(workType: WorkType): number {
  const spec = WORK_TYPE_KEYWORDS[workType];
  return (
    spec.keywords.length * KEYWORD_WEIGHT +
    spec.phrases.length  * PHRASE_WEIGHT
  );
}
