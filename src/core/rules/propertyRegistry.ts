/**
 * Property Registry
 *
 * Single source of truth for all properties supported by the rule extraction
 * and comparison pipeline.
 *
 * Each entry defines:
 *   key          — canonical snake_case identifier used internally
 *   aliases      — French technical variations found in source documents
 *   allowedUnits — accepted unit strings (lowercase, normalized)
 *   category     — domain grouping
 */

export interface PropertyDefinition {
  key: string;
  aliases: string[];
  allowedUnits: string[];
  category: string;
}

export const PROPERTY_REGISTRY: PropertyDefinition[] = [

  // -------------------------------------------------------------------------
  // DIMENSION
  // -------------------------------------------------------------------------

  {
    key: 'epaisseur',
    aliases: [
      'épaisseur',
      'épaisseur minimale',
      'épaisseur totale',
      'épaisseur de paroi',
      'épaisseur nominale',
      'ep.',
    ],
    allowedUnits: ['mm', 'cm', 'm'],
    category: 'dimension',
  },
  {
    key: 'largeur',
    aliases: [
      'largeur',
      'largeur utile',
      'largeur minimale',
      'largeur de passage',
      'largeur hors tout',
      'larg.',
    ],
    allowedUnits: ['mm', 'cm', 'm'],
    category: 'dimension',
  },
  {
    key: 'hauteur',
    aliases: [
      'hauteur',
      'hauteur libre',
      'hauteur sous plafond',
      'hauteur sous poutre',
      'hauteur minimale',
      'haut.',
    ],
    allowedUnits: ['mm', 'cm', 'm'],
    category: 'dimension',
  },
  {
    key: 'longueur',
    aliases: [
      'longueur',
      'longueur maximale',
      'longueur de travée',
      'longueur développée',
      'long.',
    ],
    allowedUnits: ['mm', 'cm', 'm', 'ml'],
    category: 'dimension',
  },
  {
    key: 'entraxe',
    aliases: [
      'entraxe',
      'entre-axe',
      'espacement',
      'espacement des montants',
      'pas d\'espacement',
    ],
    allowedUnits: ['mm', 'cm', 'm'],
    category: 'dimension',
  },
  {
    key: 'diametre',
    aliases: [
      'diamètre',
      'diamètre nominal',
      'diamètre intérieur',
      'diamètre extérieur',
      'dn',
      'ø',
    ],
    allowedUnits: ['mm', 'cm', 'm'],
    category: 'dimension',
  },
  {
    key: 'section',
    aliases: [
      'section',
      'section minimale',
      'section transversale',
      'section droite',
    ],
    allowedUnits: ['mm²', 'cm²', 'm²', 'mm2', 'cm2', 'm2'],
    category: 'dimension',
  },
  {
    key: 'profondeur',
    aliases: [
      'profondeur',
      'profondeur d\'ancrage',
      'profondeur de pose',
      'profondeur minimale',
      'profondeur d\'enfouissement',
    ],
    allowedUnits: ['mm', 'cm', 'm'],
    category: 'dimension',
  },

  // -------------------------------------------------------------------------
  // THERMAL
  // -------------------------------------------------------------------------

  {
    key: 'resistance_thermique',
    aliases: [
      'résistance thermique',
      'résistance thermique totale',
      'valeur r',
      'r thermique',
      'résistance r',
    ],
    allowedUnits: ['m².k/w', 'm2.k/w', 'm².°c/w'],
    category: 'thermal',
  },
  {
    key: 'conductivite',
    aliases: [
      'conductivité thermique',
      'conductivité',
      'lambda',
      'λ',
      'valeur lambda',
      'coefficient lambda',
    ],
    allowedUnits: ['w/m.k', 'w/m·k', 'w/(m.k)'],
    category: 'thermal',
  },
  {
    key: 'transmission_thermique',
    aliases: [
      'transmission thermique',
      'coefficient u',
      'valeur u',
      'u thermique',
      'déperdition thermique',
      'uw',
    ],
    allowedUnits: ['w/m².k', 'w/(m².k)', 'w/m2.k'],
    category: 'thermal',
  },
  {
    key: 'temperature',
    aliases: [
      'température',
      'température ambiante',
      'température intérieure',
      'température de consigne',
      'température de service',
    ],
    allowedUnits: ['°c', 'k'],
    category: 'thermal',
  },

  // -------------------------------------------------------------------------
  // STRUCTURE / LOAD
  // -------------------------------------------------------------------------

  {
    key: 'charge',
    aliases: [
      'charge',
      'charge admissible',
      'charge maximale',
      'charge d\'exploitation',
      'charge permanente',
      'charge totale',
    ],
    allowedUnits: ['kn', 'n', 'kg', 't'],
    category: 'structure',
  },
  {
    key: 'charge_lineique',
    aliases: [
      'charge linéique',
      'charge linéaire',
      'charge répartie linéaire',
      'q linéique',
    ],
    allowedUnits: ['kn/m', 'n/m', 'kg/m'],
    category: 'structure',
  },
  {
    key: 'charge_surfacique',
    aliases: [
      'charge surfacique',
      'charge au sol',
      'charge répartie',
      'surcharge d\'exploitation',
      'q surfacique',
    ],
    allowedUnits: ['kn/m²', 'n/m²', 'kn/m2', 'kg/m²', 'pa'],
    category: 'structure',
  },
  {
    key: 'resistance_mecanique',
    aliases: [
      'résistance mécanique',
      'résistance caractéristique',
      'résistance à la compression',
      'résistance à la traction',
      'résistance de calcul',
      'fck',
    ],
    allowedUnits: ['mpa', 'n/mm²', 'kn/m²', 'pa'],
    category: 'structure',
  },
  {
    key: 'contrainte',
    aliases: [
      'contrainte',
      'contrainte admissible',
      'contrainte de compression',
      'contrainte de cisaillement',
      'contrainte limite',
    ],
    allowedUnits: ['mpa', 'n/mm²', 'kn/m²', 'pa'],
    category: 'structure',
  },
  {
    key: 'module_elasticite',
    aliases: [
      'module d\'élasticité',
      'module de young',
      'module e',
      'rigidité',
    ],
    allowedUnits: ['gpa', 'mpa', 'n/mm²', 'kn/m²'],
    category: 'structure',
  },

  // -------------------------------------------------------------------------
  // HYDRAULIC
  // -------------------------------------------------------------------------

  {
    key: 'debit',
    aliases: [
      'débit',
      'débit nominal',
      'débit minimal',
      'débit maximal',
      'débit de pointe',
      'débit de fuite',
    ],
    allowedUnits: ['l/s', 'm³/h', 'l/min', 'm³/s'],
    category: 'hydraulic',
  },
  {
    key: 'pression',
    aliases: [
      'pression',
      'pression nominale',
      'pression de service',
      'pression d\'essai',
      'pression maximale',
      'pn',
    ],
    allowedUnits: ['bar', 'mpa', 'kpa', 'pa'],
    category: 'hydraulic',
  },
  {
    key: 'vitesse_ecoulement',
    aliases: [
      'vitesse d\'écoulement',
      'vitesse de l\'eau',
      'vitesse de circulation',
      'vitesse maximale',
    ],
    allowedUnits: ['m/s', 'cm/s'],
    category: 'hydraulic',
  },

  // -------------------------------------------------------------------------
  // ELECTRICAL
  // -------------------------------------------------------------------------

  {
    key: 'tension',
    aliases: [
      'tension',
      'tension nominale',
      'tension de service',
      'tension d\'alimentation',
      'tension maximale',
    ],
    allowedUnits: ['v', 'kv', 'mv'],
    category: 'electrical',
  },
  {
    key: 'puissance',
    aliases: [
      'puissance',
      'puissance nominale',
      'puissance maximale',
      'puissance installée',
      'puissance absorbée',
    ],
    allowedUnits: ['w', 'kw', 'mw', 'va', 'kva'],
    category: 'electrical',
  },
  {
    key: 'intensite',
    aliases: [
      'intensité',
      'courant nominal',
      'intensité admissible',
      'calibre',
      'courant de court-circuit',
    ],
    allowedUnits: ['a', 'ma', 'ka'],
    category: 'electrical',
  },
  {
    key: 'section_cable',
    aliases: [
      'section de câble',
      'section des conducteurs',
      'section minimale des fils',
      'section du câble',
    ],
    allowedUnits: ['mm²', 'mm2'],
    category: 'electrical',
  },

  // -------------------------------------------------------------------------
  // ACOUSTIC
  // -------------------------------------------------------------------------

  {
    key: 'affaiblissement_acoustique',
    aliases: [
      'affaiblissement acoustique',
      'indice d\'affaiblissement',
      'isolation acoustique',
      'rw',
      'ra',
      'isolement aux bruits aériens',
    ],
    allowedUnits: ['db', 'db(a)'],
    category: 'acoustic',
  },
  {
    key: 'niveau_bruit',
    aliases: [
      'niveau de bruit',
      'niveau sonore',
      'niveau de pression acoustique',
      'bruit de choc',
      'ln',
      'lnw',
    ],
    allowedUnits: ['db', 'db(a)'],
    category: 'acoustic',
  },
  {
    key: 'temps_reverberation',
    aliases: [
      'temps de réverbération',
      'durée de réverbération',
      'tr',
      'tr60',
    ],
    allowedUnits: ['s'],
    category: 'acoustic',
  },

  // -------------------------------------------------------------------------
  // SLOPE / GEOMETRY
  // -------------------------------------------------------------------------

  {
    key: 'pente',
    aliases: [
      'pente',
      'pente minimale',
      'pente de la toiture',
      'inclinaison',
      'pente d\'écoulement',
      'pente d\'évacuation',
    ],
    allowedUnits: ['%', '°', 'cm/m'],
    category: 'geometry',
  },
  {
    key: 'recouvrement',
    aliases: [
      'recouvrement',
      'recouvrement minimal',
      'recouvrement latéral',
      'recouvrement en tête',
      'chevauchement',
    ],
    allowedUnits: ['mm', 'cm', 'm', '%'],
    category: 'geometry',
  },

  // -------------------------------------------------------------------------
  // FIRE / SAFETY
  // -------------------------------------------------------------------------

  {
    key: 'resistance_feu',
    aliases: [
      'résistance au feu',
      'durée de résistance au feu',
      'classement feu',
      'degré coupe-feu',
      'rei',
      'ef',
    ],
    allowedUnits: ['min', 'h'],
    category: 'fire',
  },
  {
    key: 'reaction_feu',
    aliases: [
      'réaction au feu',
      'classement euroclasse',
      'euroclasse',
      'classe de réaction',
      'm0', 'm1', 'm2', 'm3',
    ],
    allowedUnits: [],
    category: 'fire',
  },
  {
    key: 'distance_securite',
    aliases: [
      'distance de sécurité',
      'distance minimale',
      'recul',
      'distance d\'isolement',
      'dégagement',
    ],
    allowedUnits: ['mm', 'cm', 'm'],
    category: 'fire',
  },

  // -------------------------------------------------------------------------
  // ENVIRONMENTAL / ENERGY
  // -------------------------------------------------------------------------

  {
    key: 'permeabilite_air',
    aliases: [
      'perméabilité à l\'air',
      'infiltrométrie',
      'étanchéité à l\'air',
      'q4pa',
      'n50',
    ],
    allowedUnits: ['m³/h.m²', 'm3/h.m2', 'vol/h'],
    category: 'energy',
  },
  {
    key: 'consommation_energie',
    aliases: [
      'consommation d\'énergie',
      'consommation primaire',
      'besoin en énergie',
      'bbio',
      'cep',
    ],
    allowedUnits: ['kwh/m².an', 'kwh/m2.an', 'kwh/an'],
    category: 'energy',
  },

  // -------------------------------------------------------------------------
  // ANCHORAGE / FIXATION
  // -------------------------------------------------------------------------

  {
    key: 'profondeur_ancrage',
    aliases: [
      'profondeur d\'ancrage',
      'longueur d\'ancrage',
      'ancrage minimal',
      'profondeur de scellement',
    ],
    allowedUnits: ['mm', 'cm', 'm'],
    category: 'fixation',
  },
  {
    key: 'effort_arrachement',
    aliases: [
      'effort d\'arrachement',
      'résistance à l\'arrachement',
      'charge d\'arrachement',
      'tenue mécanique',
    ],
    allowedUnits: ['kn', 'n', 'dan'],
    category: 'fixation',
  },

];
