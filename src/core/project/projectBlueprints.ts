/**
 * Project Blueprints
 *
 * Canonical phase sequences for each ProjectType.
 *
 * Each blueprint defines:
 *   - Ordered phases (for display; execution order is derived from depends_on)
 *   - Phase dependencies (DAG edges)
 *   - WorkType mapping per phase
 *   - Mandatory flags for gap detection
 *   - Detection keywords/phrases for project type inference
 *
 * Dependency notation:
 *   Phase B depends_on Phase A → A must be COMPLETE before B starts.
 *   Phases with no depends_on start at project launch (batch 0).
 *
 * WorkType mapping rules:
 *   - Assign the primary work types that dominate a phase.
 *   - A work type appearing in multiple phases is intentional:
 *     ELECTRICITE appears in ELECTRICITE phase (rough-in) and FINITIONS
 *     (final connections). Detection of either signals progress.
 *   - Phases without a natural WorkType counterpart (DIAGNOSTIC, DEMOLITION)
 *     carry an empty work_types array — they are detected via project-level
 *     keywords instead.
 */

import type { ProjectBlueprint, ProjectType } from './projectTypes';

// =============================================================================
// PISCINE
// =============================================================================

const PISCINE_BLUEPRINT: ProjectBlueprint = {
  project_type: 'PISCINE',
  description:  'Construction de bassin de natation (structure béton armé ou coque polyester)',
  detection_keywords: ['piscine', 'bassin', 'natation', 'nage', 'spa', 'jacuzzi'],
  detection_phrases:  [
    'construction piscine', 'piscine enterree', 'piscine semi enterree',
    'bassin de nage', 'piscine coque', 'piscine beton',
  ],
  phases: [
    {
      id: 'TERRASSEMENT',
      name: 'Terrassement et fouilles',
      depends_on: [],
      parallel_with: ['VRD'],
      work_types: ['TERRASSEMENT'],
      mandatory: true,
      typical_duration_days: 3,
    },
    {
      id: 'VRD',
      name: 'Voirie et réseaux divers',
      depends_on: [],
      parallel_with: ['TERRASSEMENT'],
      work_types: ['TERRASSEMENT'],
      mandatory: false,
      typical_duration_days: 2,
    },
    {
      id: 'GROS_OEUVRE',
      name: 'Gros-œuvre — voile béton armé',
      depends_on: ['TERRASSEMENT'],
      parallel_with: [],
      work_types: ['STRUCTURE', 'FONDATION', 'MACONNERIE', 'DALLAGE'],
      mandatory: true,
      typical_duration_days: 7,
    },
    {
      id: 'ETANCHEITE',
      name: 'Étanchéité du bassin',
      depends_on: ['GROS_OEUVRE'],
      parallel_with: [],
      work_types: ['ETANCHEITE'],
      mandatory: true,
      typical_duration_days: 3,
    },
    {
      id: 'RESEAUX_HYDRAULIQUES',
      name: 'Réseaux hydrauliques — filtration et plomberie',
      depends_on: ['GROS_OEUVRE'],
      parallel_with: ['ELECTRICITE'],
      work_types: ['PLOMBERIE'],
      mandatory: true,
      typical_duration_days: 4,
    },
    {
      id: 'ELECTRICITE',
      name: 'Électricité — pompe, éclairage subaquatique, tableau',
      depends_on: ['GROS_OEUVRE'],
      parallel_with: ['RESEAUX_HYDRAULIQUES'],
      work_types: ['ELECTRICITE'],
      mandatory: true,
      typical_duration_days: 2,
    },
    {
      id: 'CHAPE',
      name: 'Chape fond de bassin',
      depends_on: ['ETANCHEITE'],
      parallel_with: [],
      work_types: ['CHAPE'],
      mandatory: false,
      typical_duration_days: 2,
    },
    {
      id: 'REVETEMENTS_SOL',
      name: 'Revêtement bassin — carrelage ou liner',
      depends_on: ['CHAPE', 'ETANCHEITE'],
      parallel_with: [],
      work_types: ['CARRELAGE', 'REVETEMENT_SOL'],
      mandatory: true,
      typical_duration_days: 5,
    },
    {
      id: 'MARGELLES_PLAGE',
      name: 'Margelles et plage périphérique',
      depends_on: ['REVETEMENTS_SOL'],
      parallel_with: ['FINITIONS'],
      work_types: ['CARRELAGE', 'MACONNERIE'],
      mandatory: false,
      typical_duration_days: 4,
    },
    {
      id: 'FINITIONS',
      name: 'Finitions — local technique, équipements',
      depends_on: ['RESEAUX_HYDRAULIQUES', 'ELECTRICITE'],
      parallel_with: ['MARGELLES_PLAGE'],
      work_types: ['MACONNERIE', 'PEINTURE'],
      mandatory: false,
      typical_duration_days: 2,
    },
  ],
};

// =============================================================================
// MAISON_INDIVIDUELLE
// =============================================================================

const MAISON_INDIVIDUELLE_BLUEPRINT: ProjectBlueprint = {
  project_type: 'MAISON_INDIVIDUELLE',
  description:  'Construction neuve maison individuelle — tous corps d\'état',
  detection_keywords: ['maison', 'villa', 'pavillon', 'construction neuve', 'construction individuelle', 'mc'],
  detection_phrases:  [
    'construction maison', 'maison individuelle', 'construction neuve',
    'maison de plain pied', 'maison r+1', 'maison bois', 'construction villa',
  ],
  phases: [
    {
      id: 'VRD',
      name: 'Voirie et réseaux divers',
      depends_on: [],
      parallel_with: ['TERRASSEMENT'],
      work_types: ['TERRASSEMENT'],
      mandatory: false,
      typical_duration_days: 3,
    },
    {
      id: 'TERRASSEMENT',
      name: 'Terrassement — décapage et fouilles',
      depends_on: [],
      parallel_with: ['VRD'],
      work_types: ['TERRASSEMENT'],
      mandatory: true,
      typical_duration_days: 4,
    },
    {
      id: 'FONDATIONS',
      name: 'Fondations — semelles filantes et longrines',
      depends_on: ['TERRASSEMENT'],
      parallel_with: [],
      work_types: ['FONDATION', 'STRUCTURE'],
      mandatory: true,
      typical_duration_days: 5,
    },
    {
      id: 'DRAINAGE',
      name: 'Drainage périphérique',
      depends_on: ['FONDATIONS'],
      parallel_with: ['GROS_OEUVRE'],
      work_types: ['PLOMBERIE', 'TERRASSEMENT'],
      mandatory: false,
      typical_duration_days: 2,
    },
    {
      id: 'GROS_OEUVRE',
      name: 'Gros-œuvre — maçonnerie, voiles béton, planchers',
      depends_on: ['FONDATIONS'],
      parallel_with: ['DRAINAGE'],
      work_types: ['MACONNERIE', 'STRUCTURE', 'DALLAGE'],
      mandatory: true,
      typical_duration_days: 30,
    },
    {
      id: 'CHARPENTE_COUVERTURE',
      name: 'Charpente et couverture',
      depends_on: ['GROS_OEUVRE'],
      parallel_with: [],
      work_types: ['CHARPENTE', 'TOITURE'],
      mandatory: true,
      typical_duration_days: 10,
    },
    {
      id: 'HORS_EAU_HORS_AIR',
      name: 'Menuiseries extérieures — hors d\'eau, hors d\'air',
      depends_on: ['CHARPENTE_COUVERTURE'],
      parallel_with: [],
      work_types: ['MENUISERIE'],
      mandatory: true,
      typical_duration_days: 5,
    },
    {
      id: 'FACADE',
      name: 'Façade — enduits ou bardage',
      depends_on: ['HORS_EAU_HORS_AIR'],
      parallel_with: ['PLOMBERIE', 'ELECTRICITE', 'CHAUFFAGE_VMC'],
      work_types: ['FACADE', 'ENDUIT'],
      mandatory: false,
      typical_duration_days: 8,
    },
    {
      id: 'ISOLATION_THERMIQUE',
      name: 'Isolation thermique intérieure',
      depends_on: ['HORS_EAU_HORS_AIR'],
      parallel_with: ['PLOMBERIE', 'ELECTRICITE'],
      work_types: ['ISOLATION'],
      mandatory: true,
      typical_duration_days: 7,
    },
    {
      id: 'PLOMBERIE',
      name: 'Plomberie — canalisations et attentes sanitaires',
      depends_on: ['HORS_EAU_HORS_AIR'],
      parallel_with: ['ELECTRICITE', 'CHAUFFAGE_VMC', 'ISOLATION_THERMIQUE'],
      work_types: ['PLOMBERIE'],
      mandatory: true,
      typical_duration_days: 8,
    },
    {
      id: 'ELECTRICITE',
      name: 'Électricité — câblage et tableau',
      depends_on: ['HORS_EAU_HORS_AIR'],
      parallel_with: ['PLOMBERIE', 'CHAUFFAGE_VMC', 'ISOLATION_THERMIQUE'],
      work_types: ['ELECTRICITE'],
      mandatory: true,
      typical_duration_days: 7,
    },
    {
      id: 'CHAUFFAGE_VMC',
      name: 'Chauffage et VMC',
      depends_on: ['HORS_EAU_HORS_AIR'],
      parallel_with: ['PLOMBERIE', 'ELECTRICITE', 'ISOLATION_THERMIQUE'],
      work_types: ['CHAUFFAGE'],
      mandatory: true,
      typical_duration_days: 5,
    },
    {
      id: 'CLOISONS_DOUBLAGE',
      name: 'Cloisons et doublages',
      depends_on: ['PLOMBERIE', 'ELECTRICITE', 'CHAUFFAGE_VMC', 'ISOLATION_THERMIQUE'],
      parallel_with: [],
      work_types: ['CLOISON', 'ISOLATION'],
      mandatory: true,
      typical_duration_days: 10,
    },
    {
      id: 'CHAPE',
      name: 'Chape et ragréage',
      depends_on: ['CLOISONS_DOUBLAGE'],
      parallel_with: [],
      work_types: ['CHAPE'],
      mandatory: true,
      typical_duration_days: 5,
    },
    {
      id: 'REVETEMENTS_SOL',
      name: 'Revêtements de sol — carrelage, parquet',
      depends_on: ['CHAPE'],
      parallel_with: ['REVETEMENTS_MURS', 'MENUISERIES_INT'],
      work_types: ['REVETEMENT_SOL', 'CARRELAGE'],
      mandatory: true,
      typical_duration_days: 10,
    },
    {
      id: 'REVETEMENTS_MURS',
      name: 'Revêtements muraux — faïence, peinture',
      depends_on: ['CHAPE'],
      parallel_with: ['REVETEMENTS_SOL', 'MENUISERIES_INT'],
      work_types: ['CARRELAGE', 'ENDUIT', 'PEINTURE'],
      mandatory: true,
      typical_duration_days: 10,
    },
    {
      id: 'MENUISERIES_INT',
      name: 'Menuiseries intérieures',
      depends_on: ['CHAPE'],
      parallel_with: ['REVETEMENTS_SOL', 'REVETEMENTS_MURS'],
      work_types: ['MENUISERIE'],
      mandatory: false,
      typical_duration_days: 5,
    },
    {
      id: 'FINITIONS',
      name: 'Finitions — peinture, quincaillerie, nettoyage',
      depends_on: ['REVETEMENTS_SOL', 'REVETEMENTS_MURS'],
      parallel_with: [],
      work_types: ['PEINTURE', 'ENDUIT'],
      mandatory: true,
      typical_duration_days: 7,
    },
  ],
};

// =============================================================================
// RENOVATION
// =============================================================================

const RENOVATION_BLUEPRINT: ProjectBlueprint = {
  project_type: 'RENOVATION',
  description:  'Rénovation intérieure d\'un bien existant — second œuvre et technique',
  detection_keywords: [
    'renovation', 'renov', 'refection', 'mise a jour', 'rehabilitation',
    'rafraichissement', 'restructuration', 'travaux', 'logement existant',
  ],
  detection_phrases:  [
    'renovation complete', 'renovation appartement', 'renovation maison',
    'travaux de renovation', 'remise en etat', 'mise aux normes',
  ],
  phases: [
    {
      id: 'DIAGNOSTIC',
      name: 'Diagnostic — amiante, plomb, structure',
      depends_on: [],
      parallel_with: [],
      work_types: [],
      mandatory: true,
      typical_duration_days: 1,
    },
    {
      id: 'DEMOLITION',
      name: 'Démolition et dépose',
      depends_on: ['DIAGNOSTIC'],
      parallel_with: [],
      work_types: ['MACONNERIE'],
      mandatory: false,
      typical_duration_days: 5,
    },
    {
      id: 'GROS_OEUVRE',
      name: 'Gros-œuvre — reprises structure, ouvertures',
      depends_on: ['DEMOLITION'],
      parallel_with: [],
      work_types: ['MACONNERIE', 'STRUCTURE'],
      mandatory: false,
      typical_duration_days: 7,
    },
    {
      id: 'ETANCHEITE',
      name: 'Traitement d\'humidité et étanchéité',
      depends_on: ['GROS_OEUVRE'],
      parallel_with: ['ISOLATION_THERMIQUE'],
      work_types: ['ETANCHEITE', 'ENDUIT'],
      mandatory: false,
      typical_duration_days: 3,
    },
    {
      id: 'ISOLATION_THERMIQUE',
      name: 'Isolation thermique et acoustique',
      depends_on: ['GROS_OEUVRE'],
      parallel_with: ['ETANCHEITE', 'PLOMBERIE', 'ELECTRICITE'],
      work_types: ['ISOLATION'],
      mandatory: false,
      typical_duration_days: 5,
    },
    {
      id: 'PLOMBERIE',
      name: 'Plomberie — remplacement ou extension réseau',
      depends_on: ['GROS_OEUVRE'],
      parallel_with: ['ELECTRICITE', 'CHAUFFAGE_VMC', 'ISOLATION_THERMIQUE'],
      work_types: ['PLOMBERIE'],
      mandatory: false,
      typical_duration_days: 6,
    },
    {
      id: 'ELECTRICITE',
      name: 'Électricité — mise aux normes et câblage',
      depends_on: ['GROS_OEUVRE'],
      parallel_with: ['PLOMBERIE', 'CHAUFFAGE_VMC', 'ISOLATION_THERMIQUE'],
      work_types: ['ELECTRICITE'],
      mandatory: false,
      typical_duration_days: 5,
    },
    {
      id: 'CHAUFFAGE_VMC',
      name: 'Chauffage et ventilation',
      depends_on: ['GROS_OEUVRE'],
      parallel_with: ['PLOMBERIE', 'ELECTRICITE', 'ISOLATION_THERMIQUE'],
      work_types: ['CHAUFFAGE'],
      mandatory: false,
      typical_duration_days: 4,
    },
    {
      id: 'CLOISONS_DOUBLAGE',
      name: 'Cloisons et doublages',
      depends_on: ['PLOMBERIE', 'ELECTRICITE', 'CHAUFFAGE_VMC'],
      parallel_with: [],
      work_types: ['CLOISON', 'ISOLATION'],
      mandatory: false,
      typical_duration_days: 7,
    },
    {
      id: 'CHAPE',
      name: 'Chape et ragréage',
      depends_on: ['CLOISONS_DOUBLAGE'],
      parallel_with: [],
      work_types: ['CHAPE'],
      mandatory: false,
      typical_duration_days: 3,
    },
    {
      id: 'REVETEMENTS_SOL',
      name: 'Revêtements de sol',
      depends_on: ['CHAPE'],
      parallel_with: ['REVETEMENTS_MURS'],
      work_types: ['REVETEMENT_SOL', 'CARRELAGE'],
      mandatory: false,
      typical_duration_days: 7,
    },
    {
      id: 'REVETEMENTS_MURS',
      name: 'Revêtements muraux et peinture',
      depends_on: ['CHAPE'],
      parallel_with: ['REVETEMENTS_SOL'],
      work_types: ['ENDUIT', 'PEINTURE', 'CARRELAGE'],
      mandatory: false,
      typical_duration_days: 7,
    },
    {
      id: 'FINITIONS',
      name: 'Finitions — menuiseries fines, nettoyage',
      depends_on: ['REVETEMENTS_SOL', 'REVETEMENTS_MURS'],
      parallel_with: [],
      work_types: ['MENUISERIE', 'PEINTURE'],
      mandatory: false,
      typical_duration_days: 4,
    },
  ],
};

// =============================================================================
// EXTENSION
// =============================================================================

const EXTENSION_BLUEPRINT: ProjectBlueprint = {
  project_type: 'EXTENSION',
  description:  'Extension ou agrandissement d\'un bâtiment existant',
  detection_keywords: ['extension', 'agrandissement', 'annexe', 'surélévation', 'surelevation', 'veranda'],
  detection_phrases:  [
    'extension maison', 'agrandissement maison', 'extension bois',
    'surélévation toiture', 'ajout de piece',
  ],
  phases: [
    {
      id: 'DIAGNOSTIC',
      name: 'Diagnostic structure existante',
      depends_on: [],
      parallel_with: [],
      work_types: [],
      mandatory: true,
      typical_duration_days: 1,
    },
    {
      id: 'TERRASSEMENT',
      name: 'Terrassement — fouilles extension',
      depends_on: ['DIAGNOSTIC'],
      parallel_with: [],
      work_types: ['TERRASSEMENT'],
      mandatory: true,
      typical_duration_days: 3,
    },
    {
      id: 'FONDATIONS',
      name: 'Fondations de l\'extension',
      depends_on: ['TERRASSEMENT'],
      parallel_with: [],
      work_types: ['FONDATION', 'STRUCTURE'],
      mandatory: true,
      typical_duration_days: 4,
    },
    {
      id: 'GROS_OEUVRE',
      name: 'Gros-œuvre de l\'extension',
      depends_on: ['FONDATIONS'],
      parallel_with: [],
      work_types: ['MACONNERIE', 'STRUCTURE'],
      mandatory: true,
      typical_duration_days: 15,
    },
    {
      id: 'JONCTION',
      name: 'Jonction — liaison thermique et structurale avec l\'existant',
      depends_on: ['GROS_OEUVRE'],
      parallel_with: [],
      work_types: ['MACONNERIE', 'ISOLATION', 'ETANCHEITE'],
      mandatory: true,
      typical_duration_days: 3,
    },
    {
      id: 'CHARPENTE_COUVERTURE',
      name: 'Charpente et couverture de l\'extension',
      depends_on: ['GROS_OEUVRE'],
      parallel_with: ['JONCTION'],
      work_types: ['CHARPENTE', 'TOITURE'],
      mandatory: true,
      typical_duration_days: 8,
    },
    {
      id: 'HORS_EAU_HORS_AIR',
      name: 'Menuiseries extérieures',
      depends_on: ['CHARPENTE_COUVERTURE'],
      parallel_with: [],
      work_types: ['MENUISERIE'],
      mandatory: true,
      typical_duration_days: 3,
    },
    {
      id: 'PLOMBERIE',
      name: 'Extension réseau plomberie',
      depends_on: ['HORS_EAU_HORS_AIR', 'JONCTION'],
      parallel_with: ['ELECTRICITE', 'CHAUFFAGE_VMC'],
      work_types: ['PLOMBERIE'],
      mandatory: false,
      typical_duration_days: 4,
    },
    {
      id: 'ELECTRICITE',
      name: 'Extension réseau électrique',
      depends_on: ['HORS_EAU_HORS_AIR', 'JONCTION'],
      parallel_with: ['PLOMBERIE', 'CHAUFFAGE_VMC'],
      work_types: ['ELECTRICITE'],
      mandatory: false,
      typical_duration_days: 3,
    },
    {
      id: 'CHAUFFAGE_VMC',
      name: 'Extension chauffage et ventilation',
      depends_on: ['HORS_EAU_HORS_AIR', 'JONCTION'],
      parallel_with: ['PLOMBERIE', 'ELECTRICITE'],
      work_types: ['CHAUFFAGE'],
      mandatory: false,
      typical_duration_days: 3,
    },
    {
      id: 'CLOISONS_DOUBLAGE',
      name: 'Cloisons, doublage et isolation intérieure',
      depends_on: ['PLOMBERIE', 'ELECTRICITE', 'CHAUFFAGE_VMC'],
      parallel_with: [],
      work_types: ['CLOISON', 'ISOLATION'],
      mandatory: false,
      typical_duration_days: 5,
    },
    {
      id: 'CHAPE',
      name: 'Chape',
      depends_on: ['CLOISONS_DOUBLAGE'],
      parallel_with: [],
      work_types: ['CHAPE'],
      mandatory: false,
      typical_duration_days: 2,
    },
    {
      id: 'FINITIONS',
      name: 'Finitions — revêtements, peinture',
      depends_on: ['CHAPE'],
      parallel_with: [],
      work_types: ['REVETEMENT_SOL', 'CARRELAGE', 'PEINTURE', 'ENDUIT'],
      mandatory: false,
      typical_duration_days: 8,
    },
  ],
};

// =============================================================================
// TERRASSE
// =============================================================================

const TERRASSE_BLUEPRINT: ProjectBlueprint = {
  project_type: 'TERRASSE',
  description:  'Construction de terrasse extérieure — bois, carrelage ou béton',
  detection_keywords: ['terrasse', 'deck', 'dalle', 'lame', 'platelage', 'pergola', 'pool house'],
  detection_phrases:  [
    'terrasse bois', 'terrasse carrelage', 'terrasse beton', 'creation terrasse',
    'amenagement terrasse', 'dalle terrasse', 'lames de terrasse',
  ],
  phases: [
    {
      id: 'TERRASSEMENT',
      name: 'Décaissement et nivellement',
      depends_on: [],
      parallel_with: [],
      work_types: ['TERRASSEMENT'],
      mandatory: true,
      typical_duration_days: 2,
    },
    {
      id: 'DRAINAGE',
      name: 'Drainage et évacuation des eaux',
      depends_on: ['TERRASSEMENT'],
      parallel_with: ['FONDATIONS'],
      work_types: ['PLOMBERIE', 'TERRASSEMENT'],
      mandatory: false,
      typical_duration_days: 1,
    },
    {
      id: 'FONDATIONS',
      name: 'Fondations légères — dés béton, longrines',
      depends_on: ['TERRASSEMENT'],
      parallel_with: ['DRAINAGE'],
      work_types: ['FONDATION', 'DALLAGE'],
      mandatory: true,
      typical_duration_days: 2,
    },
    {
      id: 'STRUCTURE_BOIS',
      name: 'Structure ossature bois ou dalle béton',
      depends_on: ['FONDATIONS'],
      parallel_with: [],
      work_types: ['CHARPENTE', 'DALLAGE', 'MACONNERIE'],
      mandatory: true,
      typical_duration_days: 3,
    },
    {
      id: 'ETANCHEITE',
      name: 'Étanchéité (si terrasse couverte)',
      depends_on: ['STRUCTURE_BOIS'],
      parallel_with: [],
      work_types: ['ETANCHEITE'],
      mandatory: false,
      typical_duration_days: 2,
    },
    {
      id: 'REVETEMENT_TERRASSE',
      name: 'Revêtement — lames, carrelage, composite',
      depends_on: ['STRUCTURE_BOIS'],
      parallel_with: [],
      work_types: ['REVETEMENT_SOL', 'CARRELAGE'],
      mandatory: true,
      typical_duration_days: 4,
    },
    {
      id: 'GARDE_CORPS',
      name: 'Garde-corps et balustrades',
      depends_on: ['REVETEMENT_TERRASSE'],
      parallel_with: ['FINITIONS'],
      work_types: ['MENUISERIE'],
      mandatory: false,
      typical_duration_days: 2,
    },
    {
      id: 'FINITIONS',
      name: 'Finitions — joints, traitement bois',
      depends_on: ['REVETEMENT_TERRASSE'],
      parallel_with: ['GARDE_CORPS'],
      work_types: ['PEINTURE', 'ENDUIT'],
      mandatory: false,
      typical_duration_days: 1,
    },
  ],
};

// =============================================================================
// AMENAGEMENT_COMBLE
// =============================================================================

const AMENAGEMENT_COMBLE_BLUEPRINT: ProjectBlueprint = {
  project_type: 'AMENAGEMENT_COMBLE',
  description:  'Aménagement des combles perdus ou habitables',
  detection_keywords: ['comble', 'combles', 'grenier', 'sous toiture', 'mansarde', 'surcomble'],
  detection_phrases:  [
    'amenagement combles', 'amenagement grenier', 'combles perdus',
    'transformation combles', 'combles habitables',
  ],
  phases: [
    {
      id: 'DIAGNOSTIC',
      name: 'Diagnostic charpente et structure',
      depends_on: [],
      parallel_with: [],
      work_types: [],
      mandatory: true,
      typical_duration_days: 1,
    },
    {
      id: 'CHARPENTE_COUVERTURE',
      name: 'Renforcement charpente et modification toiture',
      depends_on: ['DIAGNOSTIC'],
      parallel_with: [],
      work_types: ['CHARPENTE', 'TOITURE'],
      mandatory: false,
      typical_duration_days: 5,
    },
    {
      id: 'ISOLATION_THERMIQUE',
      name: 'Isolation sous rampants',
      depends_on: ['CHARPENTE_COUVERTURE'],
      parallel_with: ['PLOMBERIE', 'ELECTRICITE', 'CHAUFFAGE_VMC'],
      work_types: ['ISOLATION'],
      mandatory: true,
      typical_duration_days: 4,
    },
    {
      id: 'PLOMBERIE',
      name: 'Extension plomberie (salle de bain combles)',
      depends_on: ['DIAGNOSTIC'],
      parallel_with: ['ELECTRICITE', 'CHAUFFAGE_VMC', 'ISOLATION_THERMIQUE'],
      work_types: ['PLOMBERIE'],
      mandatory: false,
      typical_duration_days: 3,
    },
    {
      id: 'ELECTRICITE',
      name: 'Câblage électrique combles',
      depends_on: ['DIAGNOSTIC'],
      parallel_with: ['PLOMBERIE', 'CHAUFFAGE_VMC', 'ISOLATION_THERMIQUE'],
      work_types: ['ELECTRICITE'],
      mandatory: true,
      typical_duration_days: 2,
    },
    {
      id: 'CHAUFFAGE_VMC',
      name: 'Chauffage et VMC combles',
      depends_on: ['DIAGNOSTIC'],
      parallel_with: ['PLOMBERIE', 'ELECTRICITE', 'ISOLATION_THERMIQUE'],
      work_types: ['CHAUFFAGE'],
      mandatory: false,
      typical_duration_days: 2,
    },
    {
      id: 'CLOISONS_DOUBLAGE',
      name: 'Cloisons, doublage, plafond rampant',
      depends_on: ['ISOLATION_THERMIQUE', 'PLOMBERIE', 'ELECTRICITE'],
      parallel_with: [],
      work_types: ['CLOISON'],
      mandatory: true,
      typical_duration_days: 5,
    },
    {
      id: 'CHAPE',
      name: 'Chape sur plancher combles',
      depends_on: ['CLOISONS_DOUBLAGE'],
      parallel_with: [],
      work_types: ['CHAPE'],
      mandatory: false,
      typical_duration_days: 2,
    },
    {
      id: 'FINITIONS',
      name: 'Finitions — revêtements, menuiseries, peinture',
      depends_on: ['CHAPE'],
      parallel_with: [],
      work_types: ['REVETEMENT_SOL', 'CARRELAGE', 'PEINTURE', 'MENUISERIE'],
      mandatory: true,
      typical_duration_days: 7,
    },
  ],
};

// =============================================================================
// APPARTEMENT
// =============================================================================

const APPARTEMENT_BLUEPRINT: ProjectBlueprint = {
  project_type: 'APPARTEMENT',
  description:  'Rénovation d\'appartement — second œuvre uniquement, sans gros-œuvre',
  detection_keywords: ['appartement', 'appart', 'studio', 'duplex', 'loft', 'flat'],
  detection_phrases:  [
    'renovation appartement', 'travaux appartement', 'remise en etat appartement',
    'refection appartement',
  ],
  phases: [
    {
      id: 'DIAGNOSTIC',
      name: 'Diagnostic amiante et état des lieux',
      depends_on: [],
      parallel_with: [],
      work_types: [],
      mandatory: true,
      typical_duration_days: 1,
    },
    {
      id: 'DEMOLITION',
      name: 'Dépose et démolition légère',
      depends_on: ['DIAGNOSTIC'],
      parallel_with: [],
      work_types: [],
      mandatory: false,
      typical_duration_days: 3,
    },
    {
      id: 'PLOMBERIE',
      name: 'Plomberie — remplacement ou rénovation',
      depends_on: ['DEMOLITION'],
      parallel_with: ['ELECTRICITE', 'CHAUFFAGE_VMC'],
      work_types: ['PLOMBERIE'],
      mandatory: false,
      typical_duration_days: 5,
    },
    {
      id: 'ELECTRICITE',
      name: 'Électricité — mise aux normes',
      depends_on: ['DEMOLITION'],
      parallel_with: ['PLOMBERIE', 'CHAUFFAGE_VMC'],
      work_types: ['ELECTRICITE'],
      mandatory: false,
      typical_duration_days: 4,
    },
    {
      id: 'CHAUFFAGE_VMC',
      name: 'Chauffage et ventilation',
      depends_on: ['DEMOLITION'],
      parallel_with: ['PLOMBERIE', 'ELECTRICITE'],
      work_types: ['CHAUFFAGE'],
      mandatory: false,
      typical_duration_days: 3,
    },
    {
      id: 'CLOISONS_DOUBLAGE',
      name: 'Cloisons et doublages',
      depends_on: ['PLOMBERIE', 'ELECTRICITE', 'CHAUFFAGE_VMC'],
      parallel_with: [],
      work_types: ['CLOISON', 'ISOLATION'],
      mandatory: false,
      typical_duration_days: 5,
    },
    {
      id: 'CHAPE',
      name: 'Ragréage et chape',
      depends_on: ['CLOISONS_DOUBLAGE'],
      parallel_with: [],
      work_types: ['CHAPE'],
      mandatory: false,
      typical_duration_days: 2,
    },
    {
      id: 'REVETEMENTS_SOL',
      name: 'Revêtements de sol',
      depends_on: ['CHAPE'],
      parallel_with: ['REVETEMENTS_MURS'],
      work_types: ['REVETEMENT_SOL', 'CARRELAGE'],
      mandatory: false,
      typical_duration_days: 5,
    },
    {
      id: 'REVETEMENTS_MURS',
      name: 'Carrelage mural et peinture',
      depends_on: ['CHAPE'],
      parallel_with: ['REVETEMENTS_SOL'],
      work_types: ['CARRELAGE', 'PEINTURE', 'ENDUIT'],
      mandatory: false,
      typical_duration_days: 5,
    },
    {
      id: 'FINITIONS',
      name: 'Finitions — menuiseries intérieures, nettoyage',
      depends_on: ['REVETEMENTS_SOL', 'REVETEMENTS_MURS'],
      parallel_with: [],
      work_types: ['MENUISERIE', 'PEINTURE'],
      mandatory: false,
      typical_duration_days: 3,
    },
  ],
};

// =============================================================================
// LOCAL_COMMERCIAL
// =============================================================================

const LOCAL_COMMERCIAL_BLUEPRINT: ProjectBlueprint = {
  project_type: 'LOCAL_COMMERCIAL',
  description:  'Aménagement ou rénovation de local commercial, bureau ou ERP',
  detection_keywords: [
    'local', 'commercial', 'bureau', 'boutique', 'magasin', 'restaurant',
    'erp', 'professionnel', 'atelier', 'entrepot',
  ],
  detection_phrases:  [
    'local commercial', 'amenagement bureau', 'amenagement magasin',
    'travaux erp', 'amenagement restaurant', 'renovation local',
  ],
  phases: [
    {
      id: 'DIAGNOSTIC',
      name: 'Diagnostic — accessibilité PMR, sécurité incendie',
      depends_on: [],
      parallel_with: [],
      work_types: [],
      mandatory: true,
      typical_duration_days: 1,
    },
    {
      id: 'DEMOLITION',
      name: 'Démolition et dépose',
      depends_on: ['DIAGNOSTIC'],
      parallel_with: [],
      work_types: ['MACONNERIE'],
      mandatory: false,
      typical_duration_days: 4,
    },
    {
      id: 'GROS_OEUVRE',
      name: 'Gros-œuvre — reprises, renforcements, ouvertures',
      depends_on: ['DEMOLITION'],
      parallel_with: [],
      work_types: ['MACONNERIE', 'STRUCTURE'],
      mandatory: false,
      typical_duration_days: 7,
    },
    {
      id: 'PLOMBERIE',
      name: 'Plomberie — sanitaires, cuisine professionnelle',
      depends_on: ['GROS_OEUVRE'],
      parallel_with: ['ELECTRICITE', 'CHAUFFAGE_VMC'],
      work_types: ['PLOMBERIE'],
      mandatory: true,
      typical_duration_days: 5,
    },
    {
      id: 'ELECTRICITE',
      name: 'Électricité — mise aux normes ERP, éclairage',
      depends_on: ['GROS_OEUVRE'],
      parallel_with: ['PLOMBERIE', 'CHAUFFAGE_VMC'],
      work_types: ['ELECTRICITE'],
      mandatory: true,
      typical_duration_days: 6,
    },
    {
      id: 'CHAUFFAGE_VMC',
      name: 'CVC — chauffage, climatisation, ventilation',
      depends_on: ['GROS_OEUVRE'],
      parallel_with: ['PLOMBERIE', 'ELECTRICITE'],
      work_types: ['CHAUFFAGE'],
      mandatory: true,
      typical_duration_days: 5,
    },
    {
      id: 'CLOISONS_DOUBLAGE',
      name: 'Cloisons et plafonds techniques',
      depends_on: ['PLOMBERIE', 'ELECTRICITE', 'CHAUFFAGE_VMC'],
      parallel_with: [],
      work_types: ['CLOISON'],
      mandatory: false,
      typical_duration_days: 7,
    },
    {
      id: 'CHAPE',
      name: 'Chape et ragréage',
      depends_on: ['CLOISONS_DOUBLAGE'],
      parallel_with: [],
      work_types: ['CHAPE'],
      mandatory: false,
      typical_duration_days: 3,
    },
    {
      id: 'REVETEMENTS_SOL',
      name: 'Revêtements de sol — normes ERP',
      depends_on: ['CHAPE'],
      parallel_with: ['REVETEMENTS_MURS'],
      work_types: ['REVETEMENT_SOL', 'CARRELAGE'],
      mandatory: true,
      typical_duration_days: 5,
    },
    {
      id: 'REVETEMENTS_MURS',
      name: 'Peinture et revêtements muraux',
      depends_on: ['CHAPE'],
      parallel_with: ['REVETEMENTS_SOL'],
      work_types: ['PEINTURE', 'ENDUIT', 'CARRELAGE'],
      mandatory: false,
      typical_duration_days: 5,
    },
    {
      id: 'FINITIONS',
      name: 'Finitions — signalétique, menuiseries, nettoyage',
      depends_on: ['REVETEMENTS_SOL', 'REVETEMENTS_MURS'],
      parallel_with: [],
      work_types: ['MENUISERIE', 'PEINTURE'],
      mandatory: false,
      typical_duration_days: 3,
    },
  ],
};

// =============================================================================
// GROS_OEUVRE_NEUF
// =============================================================================

const GROS_OEUVRE_NEUF_BLUEPRINT: ProjectBlueprint = {
  project_type: 'GROS_OEUVRE_NEUF',
  description:  'Gros-œuvre seul — fondations, dalle, murs, planchers (sans second œuvre)',
  detection_keywords: ['gros oeuvre', 'structure', 'beton arme', 'voile beton', 'plancher', 'poutre', 'poteau'],
  detection_phrases:  [
    'gros oeuvre seul', 'construction structure', 'dalle beton', 'voile beton arme',
    'fondations semelles', 'plancher beton',
  ],
  phases: [
    {
      id: 'TERRASSEMENT',
      name: 'Terrassement et fouilles',
      depends_on: [],
      parallel_with: [],
      work_types: ['TERRASSEMENT'],
      mandatory: true,
      typical_duration_days: 5,
    },
    {
      id: 'FONDATIONS',
      name: 'Fondations',
      depends_on: ['TERRASSEMENT'],
      parallel_with: [],
      work_types: ['FONDATION', 'STRUCTURE'],
      mandatory: true,
      typical_duration_days: 7,
    },
    {
      id: 'GROS_OEUVRE',
      name: 'Gros-œuvre — voiles, poteaux, poutres, planchers',
      depends_on: ['FONDATIONS'],
      parallel_with: [],
      work_types: ['STRUCTURE', 'MACONNERIE'],
      mandatory: true,
      typical_duration_days: 30,
    },
    {
      id: 'CHARPENTE_COUVERTURE',
      name: 'Charpente et couverture',
      depends_on: ['GROS_OEUVRE'],
      parallel_with: [],
      work_types: ['CHARPENTE', 'TOITURE'],
      mandatory: false,
      typical_duration_days: 10,
    },
    {
      id: 'DALLAGE',
      name: 'Dallage sur sol',
      depends_on: ['FONDATIONS'],
      parallel_with: ['GROS_OEUVRE'],
      work_types: ['DALLAGE', 'CHAPE'],
      mandatory: false,
      typical_duration_days: 5,
    },
  ],
};

// =============================================================================
// VRD
// =============================================================================

const VRD_BLUEPRINT: ProjectBlueprint = {
  project_type: 'VRD',
  description:  'Voirie et Réseaux Divers — voirie, canalisations, branchements',
  detection_keywords: ['vrd', 'voirie', 'reseau', 'canalisation', 'branchement', 'assainissement', 'eau pluviale'],
  detection_phrases:  [
    'voirie et reseaux', 'travaux vrd', 'assainissement eaux usees',
    'branchement eau', 'canalisation ep', 'collecteur pluvial',
  ],
  phases: [
    {
      id: 'TERRASSEMENT',
      name: 'Terrassement — tranchées et fouilles réseaux',
      depends_on: [],
      parallel_with: [],
      work_types: ['TERRASSEMENT'],
      mandatory: true,
      typical_duration_days: 5,
    },
    {
      id: 'DRAINAGE',
      name: 'Pose canalisations et réseaux',
      depends_on: ['TERRASSEMENT'],
      parallel_with: [],
      work_types: ['PLOMBERIE', 'TERRASSEMENT'],
      mandatory: true,
      typical_duration_days: 7,
    },
    {
      id: 'DALLAGE',
      name: 'Voirie — dalle béton ou enrobé',
      depends_on: ['DRAINAGE'],
      parallel_with: [],
      work_types: ['DALLAGE', 'CHAPE'],
      mandatory: false,
      typical_duration_days: 5,
    },
    {
      id: 'FINITIONS',
      name: 'Finitions voirie — bordures, marquage',
      depends_on: ['DALLAGE'],
      parallel_with: [],
      work_types: ['MACONNERIE'],
      mandatory: false,
      typical_duration_days: 2,
    },
  ],
};

// =============================================================================
// Blueprint registry
// =============================================================================

export const PROJECT_BLUEPRINTS: Readonly<Record<ProjectType, ProjectBlueprint>> = {
  PISCINE:             PISCINE_BLUEPRINT,
  MAISON_INDIVIDUELLE: MAISON_INDIVIDUELLE_BLUEPRINT,
  RENOVATION:          RENOVATION_BLUEPRINT,
  EXTENSION:           EXTENSION_BLUEPRINT,
  TERRASSE:            TERRASSE_BLUEPRINT,
  AMENAGEMENT_COMBLE:  AMENAGEMENT_COMBLE_BLUEPRINT,
  APPARTEMENT:         APPARTEMENT_BLUEPRINT,
  LOCAL_COMMERCIAL:    LOCAL_COMMERCIAL_BLUEPRINT,
  GROS_OEUVRE_NEUF:    GROS_OEUVRE_NEUF_BLUEPRINT,
  VRD:                 VRD_BLUEPRINT,
};
