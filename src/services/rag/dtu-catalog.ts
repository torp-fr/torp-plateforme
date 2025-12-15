/**
 * Catalogue DTU enrichi pour TORP
 * Base de connaissances normatives pour le BTP
 */

export interface DTUReferenceEnriched {
  code: string;
  title: string;
  category: string;
  applicableTo: string[];
  summary?: string;
  keyRequirements?: string[];
  materials?: string[];
  controls?: string[];
  dateVersion?: string;
  relatedNorms?: string[];
}

// =============================================================================
// CATALOGUE DTU COMPLET ET ENRICHI
// =============================================================================

export const DTU_CATALOG_ENRICHED: Record<string, DTUReferenceEnriched[]> = {
  // ============================================
  // GROS ŒUVRE
  // ============================================
  gros_oeuvre: [
    {
      code: 'DTU 13.11',
      title: 'Fondations superficielles',
      category: 'fondations',
      applicableTo: ['semelles', 'radiers', 'longrines'],
      summary: 'Règles pour l\'exécution des fondations superficielles en béton armé ou non armé.',
      keyRequirements: [
        'Profondeur minimale hors gel selon zone climatique (50 à 90 cm)',
        'Béton de propreté obligatoire (5 cm minimum)',
        'Enrobage des armatures selon exposition (3 à 5 cm)',
        'Cure du béton 7 jours minimum',
        'Étude de sol obligatoire pour déterminer la contrainte admissible',
      ],
      materials: [
        'Béton C25/30 minimum pour semelles armées',
        'Acier HA FeE500 pour armatures',
        'Film polyéthylène pour barrière d\'humidité',
      ],
      controls: [
        'Contrôle des fonds de fouille avant coulage',
        'Vérification des armatures (enrobage, recouvrement)',
        'Essais de résistance béton (éprouvettes)',
      ],
      dateVersion: '2019',
      relatedNorms: ['NF EN 1992-1-1 (Eurocode 2)', 'DTU 13.12'],
    },
    {
      code: 'DTU 13.12',
      title: 'Règles de calcul des fondations superficielles',
      category: 'fondations',
      applicableTo: ['dimensionnement', 'calculs'],
      summary: 'Méthodes de calcul et de dimensionnement des fondations superficielles.',
      keyRequirements: [
        'Vérification ELS et ELU',
        'Coefficient de sécurité ≥ 3 sur la portance',
        'Prise en compte des efforts sismiques en zones concernées',
      ],
      dateVersion: '2019',
    },
    {
      code: 'DTU 20.1',
      title: 'Ouvrages en maçonnerie de petits éléments - Parois et murs',
      category: 'maconnerie',
      applicableTo: ['murs', 'cloisons', 'parpaings', 'briques'],
      summary: 'Règles de conception et mise en œuvre des ouvrages en maçonnerie.',
      keyRequirements: [
        'Joints horizontaux entre 10 et 15 mm',
        'Chaînages horizontaux tous les 4 m de hauteur maximum',
        'Chaînages verticaux aux angles et tous les 5 m',
        'Liaison plancher-mur obligatoire',
        'Protection en tête de mur contre les infiltrations',
        'Épaisseur minimale murs porteurs : 20 cm',
      ],
      materials: [
        'Blocs conformes NF EN 771-3 (béton) ou NF EN 771-1 (terre cuite)',
        'Mortier M5 minimum pour murs porteurs',
        'Armatures chaînages FeE500',
      ],
      controls: [
        'Verticalité des murs (tolérance 1 cm / 3 m)',
        'Planéité des parements (5 mm sous règle de 2 m)',
        'Résistance mortier (prélèvement)',
      ],
      dateVersion: '2020',
      relatedNorms: ['NF EN 1996 (Eurocode 6)', 'NF EN 771'],
    },
    {
      code: 'DTU 21',
      title: 'Exécution des travaux en béton',
      category: 'beton',
      applicableTo: ['dalles', 'poteaux', 'poutres', 'voiles'],
      summary: 'Règles d\'exécution des ouvrages en béton armé ou précontraint.',
      keyRequirements: [
        'Enrobage minimal selon classe d\'exposition (2,5 à 5 cm)',
        'Vibration obligatoire du béton',
        'Cure minimale 7 jours (humide) ou protection',
        'Température béton entre 5°C et 35°C',
        'Délai de décoffrage selon résistance atteinte',
        'Joints de dilatation tous les 25-30 m',
      ],
      materials: [
        'Béton selon NF EN 206 + normes complémentaires françaises',
        'Classes minimales : C20/25 (non armé), C25/30 (armé)',
        'Aciers conformes NF A 35-080',
      ],
      controls: [
        'Essais béton frais (affaissement, température)',
        'Éprouvettes pour résistance 28 jours',
        'Contrôle positionnement armatures',
        'Contrôle après décoffrage (fissures, nids de cailloux)',
      ],
      dateVersion: '2021',
      relatedNorms: ['NF EN 1992 (Eurocode 2)', 'NF EN 206'],
    },
    {
      code: 'DTU 23.1',
      title: 'Murs en béton banché',
      category: 'beton',
      applicableTo: ['murs', 'voiles', 'refends'],
      summary: 'Exécution des murs coulés en place avec coffrage.',
      keyRequirements: [
        'Épaisseur minimale : 15 cm pour murs porteurs',
        'Hauteur de coulage max 3 m par levée',
        'Vibration systématique',
        'Reprise de bétonnage selon règles précises',
      ],
      dateVersion: '2017',
    },
    {
      code: 'DTU 26.1',
      title: 'Travaux d\'enduits de mortiers',
      category: 'enduit',
      applicableTo: ['enduit extérieur', 'enduit intérieur', 'ravalement'],
      summary: 'Exécution des enduits à base de liants hydrauliques sur maçonnerie.',
      keyRequirements: [
        'Application en 3 couches minimum (gobetis, corps, finition)',
        'Épaisseur totale 15-25 mm',
        'Délai entre couches : 48h minimum',
        'Température > 5°C et < 30°C',
        'Humidification préalable du support',
        'Protection contre dessiccation rapide',
      ],
      materials: [
        'Mortier OC1 pour gobetis',
        'Mortier OC2/OC3 pour corps d\'enduit',
        'Adjuvants certifiés',
      ],
      controls: [
        'Planéité : 5 mm sous règle de 2 m',
        'Adhérence : essai de quadrillage',
        'Absence de faïençage',
      ],
      dateVersion: '2019',
    },
  ],

  // ============================================
  // CHARPENTE & STRUCTURE BOIS
  // ============================================
  charpente: [
    {
      code: 'DTU 31.1',
      title: 'Charpente et escaliers en bois',
      category: 'charpente_traditionnelle',
      applicableTo: ['fermes', 'pannes', 'chevrons', 'escaliers'],
      summary: 'Conception et mise en œuvre des charpentes en bois traditionnelles.',
      keyRequirements: [
        'Bois classé C18 minimum pour structure',
        'Humidité du bois < 18% à la mise en œuvre',
        'Traitement insecticide et fongicide obligatoire',
        'Assemblages conformes aux règles CB71',
        'Contreventement obligatoire',
        'Ventilation de la sous-toiture',
      ],
      materials: [
        'Bois massif classé selon NF EN 338',
        'Bois lamellé-collé selon NF EN 14080',
        'Connecteurs métalliques certifiés',
        'Produits de traitement CTB-P+',
      ],
      controls: [
        'Humidité du bois (hygromètre)',
        'Traitement (certificat)',
        'Assemblages et connecteurs',
        'Flèche admissible (L/300)',
      ],
      dateVersion: '2019',
      relatedNorms: ['NF EN 1995 (Eurocode 5)', 'NF EN 14081'],
    },
    {
      code: 'DTU 31.2',
      title: 'Construction de maisons et bâtiments à ossature en bois',
      category: 'ossature_bois',
      applicableTo: ['murs ossature bois', 'planchers bois', 'MOB'],
      summary: 'Conception et exécution des constructions à ossature bois.',
      keyRequirements: [
        'Entraxe montants : 40-60 cm selon sollicitations',
        'Contreventement par voile travaillant ou diagonal',
        'Barrière d\'étanchéité à l\'air côté intérieur',
        'Pare-pluie perméable à la vapeur côté extérieur',
        'Traitement classe d\'emploi 2 minimum',
        'Lame d\'air ventilée en façade (2 cm mini)',
      ],
      materials: [
        'Montants C24 minimum',
        'Panneaux OSB/3 ou contreplaqué CTB-X',
        'Pare-vapeur Sd > 18 m',
        'Pare-pluie Sd < 0.5 m',
      ],
      controls: [
        'Test d\'étanchéité à l\'air',
        'Perméabilité pare-vapeur',
        'Fixations et connecteurs',
      ],
      dateVersion: '2020',
    },
    {
      code: 'DTU 31.3',
      title: 'Charpentes en bois assemblées par connecteurs métalliques ou goussets',
      category: 'fermette',
      applicableTo: ['fermettes industrialisées', 'combles'],
      summary: 'Mise en œuvre des charpentes industrialisées (fermettes).',
      keyRequirements: [
        'Contreventement permanent obligatoire',
        'Anti-flambement des membrures comprimées',
        'Entraxe fermettes conforme à la note de calcul',
        'Lisse de chaînage périphérique',
      ],
      dateVersion: '2018',
    },
  ],

  // ============================================
  // COUVERTURE
  // ============================================
  couverture: [
    {
      code: 'DTU 40.11',
      title: 'Couverture en ardoises',
      category: 'ardoise',
      applicableTo: ['toiture ardoise', 'ardoises naturelles', 'fibro-ciment'],
      summary: 'Mise en œuvre des couvertures en ardoises naturelles ou fibro-ciment.',
      keyRequirements: [
        'Pente minimale selon zone climatique et exposition',
        'Recouvrement calculé selon la pente',
        'Pose sur liteaux espacés selon format',
        'Crochets inox en atmosphère marine',
        'Écran de sous-toiture recommandé',
      ],
      materials: [
        'Ardoises NF EN 12326',
        'Crochets inox ou cuivre',
        'Liteaux classe 2 minimum',
      ],
      dateVersion: '2019',
    },
    {
      code: 'DTU 40.21',
      title: 'Couverture en tuiles de terre cuite à emboîtement ou à glissement',
      category: 'tuile',
      applicableTo: ['tuiles mécaniques', 'tuiles canal', 'toiture'],
      summary: 'Mise en œuvre des couvertures en tuiles terre cuite.',
      keyRequirements: [
        'Pente minimale : 22 à 35% selon modèle et exposition',
        'Ventilation haute et basse obligatoire',
        'Fixation des tuiles en rives et égouts',
        'Écran de sous-toiture HPV en zones venteuses',
        'Closoirs ventilés en faîtage',
        'Tuiles de rive scellées ou fixées',
      ],
      materials: [
        'Tuiles certifiées NF',
        'Liteaux traités classe 2',
        'Écran HPV si requis (Sd < 0.1 m)',
      ],
      controls: [
        'Alignement des rangs',
        'Ventilation effective',
        'Fixation conforme',
      ],
      dateVersion: '2020',
    },
    {
      code: 'DTU 40.41',
      title: 'Couvertures par éléments métalliques en feuilles et longues feuilles en zinc',
      category: 'zinc',
      applicableTo: ['couverture zinc', 'joint debout', 'tasseaux'],
      summary: 'Mise en œuvre des couvertures métalliques en zinc.',
      keyRequirements: [
        'Support bois continu ventilé',
        'Pente minimale 5% (3% en joint debout)',
        'Dilatation : joints de fractionnement',
        'Isolation thermique sous support',
        'Évacuation condensation',
      ],
      materials: [
        'Zinc conforme EN 988',
        'Épaisseur 0.65 à 0.80 mm selon exposition',
        'Pattes de fixation inox ou zinc',
      ],
      dateVersion: '2018',
    },
    {
      code: 'DTU 40.44',
      title: 'Couverture par éléments métalliques en feuilles et longues feuilles en acier inoxydable',
      category: 'acier',
      applicableTo: ['bac acier', 'couverture métallique'],
      summary: 'Mise en œuvre des couvertures en bac acier ou acier inoxydable.',
      keyRequirements: [
        'Pente minimale 7% (5% si étanchéité complémentaire)',
        'Recouvrement transversal 200 mm minimum',
        'Fixation par vis inox avec rondelle EPDM',
        'Closoirs mousse en rives',
      ],
      materials: [
        'Bac acier prélaqué ou galvanisé',
        'Vis autoperceuses inox A2/A4',
        'Bandes d\'étanchéité butyl',
      ],
      dateVersion: '2019',
    },
  ],

  // ============================================
  // ÉTANCHÉITÉ
  // ============================================
  etancheite: [
    {
      code: 'DTU 43.1',
      title: 'Étanchéité des toitures-terrasses avec éléments porteurs en maçonnerie',
      category: 'toiture_terrasse',
      applicableTo: ['terrasse accessible', 'terrasse inaccessible', 'terrasse végétalisée'],
      summary: 'Réalisation des toitures-terrasses avec étanchéité bitumineuse ou synthétique.',
      keyRequirements: [
        'Pente minimale 1% (1.5% recommandé)',
        'Relevés d\'étanchéité 15 cm mini au-dessus protection',
        'Acrotères avec becquet ou bande solin',
        'Isolation sous étanchéité (toiture chaude) ou inversée',
        'Évacuations : 1 EP pour 200 m² maximum',
        'Joints de dilatation aux fractionnements du gros œuvre',
      ],
      materials: [
        'Pare-vapeur Sd adapté à l\'hygrométrie',
        'Isolant certifié ACERMI',
        'Revêtement bicouche bitume ou membrane synthétique',
        'Protection lourde ou autoprotection selon usage',
      ],
      controls: [
        'Test d\'étanchéité à l\'eau (mise en eau)',
        'Contrôle relevés et points singuliers',
        'Vérification pentes',
      ],
      dateVersion: '2020',
      relatedNorms: ['NF EN 13707', 'NF EN 13956'],
    },
    {
      code: 'DTU 43.3',
      title: 'Toitures en tôles d\'acier nervurées avec revêtement d\'étanchéité',
      category: 'etancheite_bac_acier',
      applicableTo: ['bac acier support', 'toiture industrielle'],
      summary: 'Étanchéité sur support en tôles d\'acier nervurées.',
      keyRequirements: [
        'Support bac acier épaisseur ≥ 0.75 mm',
        'Isolant porteur obligatoire',
        'Fixations mécaniques de l\'étanchéité',
        'Pare-vapeur selon calcul hygrothermique',
      ],
      dateVersion: '2018',
    },
    {
      code: 'DTU 43.4',
      title: 'Toitures en éléments porteurs en bois et panneaux dérivés du bois',
      category: 'etancheite_bois',
      applicableTo: ['toiture bois', 'charpente bois étanchée'],
      summary: 'Étanchéité sur support bois ou panneaux.',
      keyRequirements: [
        'Support continu (panneaux ou voliges)',
        'Écartement appuis ≤ 90 cm',
        'Pare-vapeur obligatoire côté chaud',
        'Ventilation du support bois si toiture froide',
      ],
      dateVersion: '2019',
    },
  ],

  // ============================================
  // MENUISERIES EXTÉRIEURES
  // ============================================
  menuiserie: [
    {
      code: 'DTU 36.5',
      title: 'Mise en œuvre des fenêtres et portes extérieures',
      category: 'menuiserie_ext',
      applicableTo: ['fenêtres', 'portes', 'baies vitrées', 'volets'],
      summary: 'Pose et mise en œuvre des menuiseries extérieures.',
      keyRequirements: [
        'Calage et fixation en 4 points minimum',
        'Joint d\'étanchéité périphérique continu',
        'Rejingot avec pente vers l\'extérieur',
        'Appui de baie avec larmier',
        'Calfeutrement mousse + mastic silicone',
        'Respect performance AEV annoncée',
      ],
      materials: [
        'Menuiseries certifiées NF ou équivalent',
        'Fixations adaptées au support',
        'Mousse polyuréthane expansive',
        'Mastic silicone neutre ou hybride',
      ],
      controls: [
        'Fonctionnement ouverture/fermeture',
        'Étanchéité (contrôle visuel après pluie)',
        'Verticalité et horizontalité (niveau)',
      ],
      dateVersion: '2020',
      relatedNorms: ['NF EN 14351-1', 'NF P 20-302'],
    },
    {
      code: 'DTU 37.1',
      title: 'Menuiseries métalliques',
      category: 'menuiserie_alu',
      applicableTo: ['fenêtres aluminium', 'façades rideaux', 'vérandas'],
      summary: 'Conception et mise en œuvre des menuiseries métalliques.',
      keyRequirements: [
        'Rupture de pont thermique obligatoire en neuf',
        'Drainage des profilés',
        'Traitement anticorrosion (anodisation ou laquage)',
        'Fixation compatible dilatation alu',
      ],
      dateVersion: '2019',
    },
    {
      code: 'DTU 39',
      title: 'Travaux de miroiterie-vitrerie',
      category: 'vitrage',
      applicableTo: ['vitrages', 'double vitrage', 'verre feuilleté'],
      summary: 'Mise en œuvre des vitrages et produits verriers.',
      keyRequirements: [
        'Calage périphérique et en feuillure',
        'Garde au fond de feuillure 5 mm mini',
        'Jeu périphérique 3 mm minimum',
        'Vitrage sécurité selon emplacement (garde-corps, portes)',
        'Double vitrage avec intercalaire warm-edge recommandé',
      ],
      materials: [
        'Verre conforme NF EN 572',
        'Vitrage isolant selon NF EN 1279',
        'Cales EPDM ou équivalent',
        'Mastic silicone neutre',
      ],
      dateVersion: '2017',
    },
  ],

  // ============================================
  // ISOLATION THERMIQUE
  // ============================================
  isolation: [
    {
      code: 'DTU 45.10',
      title: 'Isolation thermique par soufflage en combles',
      category: 'isolation_combles',
      applicableTo: ['combles perdus', 'soufflage laine', 'ouate de cellulose'],
      summary: 'Mise en œuvre d\'isolant en vrac par soufflage en combles perdus.',
      keyRequirements: [
        'Épaisseur minimale selon R visé (ex: 30 cm pour R=7)',
        'Repères d\'épaisseur obligatoires',
        'Pare-vapeur si combles non ventilés',
        'Coffrage des conduits de fumée',
        'Déflecteurs en égout pour ventilation',
        'Protection spots encastrés (capots)',
      ],
      materials: [
        'Isolant certifié ACERMI',
        'Masse volumique conforme à la fiche technique',
        'Déflecteurs et coffrets certifiés',
      ],
      controls: [
        'Épaisseur moyenne et minimale',
        'Homogénéité de la répartition',
        'Ventilation maintenue',
      ],
      dateVersion: '2020',
      relatedNorms: ['NF EN 14064', 'CPT 3693'],
    },
    {
      code: 'DTU 45.11',
      title: 'Isolation thermique par l\'intérieur (ITI)',
      category: 'iti',
      applicableTo: ['doublage', 'isolation murs intérieur', 'complexes isolants'],
      summary: 'Isolation des parois verticales par l\'intérieur.',
      keyRequirements: [
        'Résistance thermique mini selon zone climatique et réglementation',
        'Traitement des ponts thermiques (retours)',
        'Pare-vapeur côté chaud (Sd ≥ 18 m) si nécessaire',
        'Continuité de l\'isolation en périphérie planchers',
        'Fixation adaptée (collage, rails, calicots)',
      ],
      materials: [
        'Panneaux ou rouleaux certifiés ACERMI',
        'Plaques de plâtre BA13 ou BA15',
        'Membrane pare-vapeur si requis',
        'Mortier-colle ou fixations mécaniques',
      ],
      controls: [
        'Continuité de l\'isolation',
        'Absence de lame d\'air parasite',
        'Traitement jonctions',
      ],
      dateVersion: '2020',
    },
    {
      code: 'ITE (CPT 3035)',
      title: 'Isolation thermique par l\'extérieur (ITE) sous enduit',
      category: 'ite',
      applicableTo: ['isolation extérieure', 'enduit sur isolant', 'ETICS'],
      summary: 'Systèmes d\'isolation thermique extérieure avec enduit.',
      keyRequirements: [
        'Système complet sous Avis Technique',
        'Rail de départ avec profil goutte d\'eau',
        'Fixation collée et/ou chevillée selon support',
        'Renfort armature aux angles et points singuliers',
        'Enduit de finition en 2 couches mini',
        'Jonction avec menuiseries étanche',
      ],
      materials: [
        'Isolant PSE ou laine de roche certifié',
        'Sous-enduit armé de fibres de verre',
        'Enduit de finition minéral ou organique',
        'Chevilles adaptées au support',
      ],
      controls: [
        'Planéité du support (5 mm/2 m)',
        'Densité de chevillage',
        'Épaisseur des couches d\'enduit',
      ],
      dateVersion: '2021',
    },
  ],

  // ============================================
  // CLOISONS & PLÂTRERIE
  // ============================================
  cloisons: [
    {
      code: 'DTU 25.41',
      title: 'Ouvrages en plaques de plâtre',
      category: 'placo',
      applicableTo: ['cloisons', 'doublages', 'plafonds', 'gaines techniques'],
      summary: 'Mise en œuvre des ouvrages en plaques de plâtre sur ossature.',
      keyRequirements: [
        'Entraxe ossature : 60 cm (40 cm pour hauteur > 2.60 m)',
        'Montants doublés au droit des huisseries',
        'Joint décalé entre les deux parements',
        'Traitement des joints (bande + enduit)',
        'Plaques hydrofuges en locaux humides (type H1)',
        'Isolation phonique : double parement recommandé',
      ],
      materials: [
        'Plaques BA13 conformes NF EN 520',
        'Ossature métallique selon NF EN 14195',
        'Vis TTPC adaptées',
        'Bande à joint et enduit',
      ],
      controls: [
        'Planéité : 5 mm sous règle de 2 m',
        'Verticalité cloisons',
        'Qualité du traitement des joints',
      ],
      dateVersion: '2020',
    },
    {
      code: 'DTU 25.42',
      title: 'Plafonds suspendus',
      category: 'faux_plafond',
      applicableTo: ['faux plafond', 'plafond suspendu', 'plafond décoratif'],
      summary: 'Mise en œuvre des plafonds suspendus en plaques ou dalles.',
      keyRequirements: [
        'Suspentes : 1 par m² minimum',
        'Porteurs primaires et secondaires selon calcul',
        'Joints de fractionnement pour surfaces > 50 m²',
        'Plénum accessible ou visitable selon usage',
        'Trappe de visite obligatoire',
      ],
      dateVersion: '2019',
    },
    {
      code: 'DTU 25.1',
      title: 'Enduits intérieurs en plâtre',
      category: 'platre',
      applicableTo: ['enduit plâtre', 'plâtre projeté'],
      summary: 'Application des enduits en plâtre sur parois intérieures.',
      keyRequirements: [
        'Support propre, sain et régulier',
        'Gobetis si support lisse',
        'Épaisseur 10-15 mm',
        'Application en 2 passes maximum',
        'Finition lissée ou talochée',
      ],
      dateVersion: '2017',
    },
  ],

  // ============================================
  // REVÊTEMENTS DE SOL
  // ============================================
  revetement_sol: [
    {
      code: 'DTU 52.1',
      title: 'Revêtements de sol scellés',
      category: 'carrelage_scelle',
      applicableTo: ['carrelage', 'pierre naturelle', 'terrasse'],
      summary: 'Pose scellée des carreaux céramiques et pierre naturelle.',
      keyRequirements: [
        'Chape de pose min 3 cm (scellée) ou 5 cm (désolidarisée)',
        'Joints de fractionnement tous les 60 m² intérieur / 20 m² extérieur',
        'Joints périphériques obligatoires',
        'Pente 1.5% minimum en extérieur',
        'Double encollage pour grands formats (> 2500 cm²)',
      ],
      materials: [
        'Carreaux conformes NF EN 14411',
        'Mortier de pose M5 minimum',
        'Joints souples en périphérie',
      ],
      controls: [
        'Planéité : 3 mm sous règle de 2 m',
        'Adhérence (essai à l\'arrachement)',
        'Sonorité (carreaux creux)',
      ],
      dateVersion: '2019',
    },
    {
      code: 'DTU 52.2',
      title: 'Revêtements de sol collés',
      category: 'carrelage_colle',
      applicableTo: ['carrelage collé', 'faïence', 'mosaïque'],
      summary: 'Pose collée des revêtements céramiques.',
      keyRequirements: [
        'Support sec, plan et cohésif',
        'Primaire si support absorbant',
        'Double encollage si format > 900 cm²',
        'Joints ouverts > 2 mm (ou carreau rectifié)',
        'Délai avant mise en service : 24-48h',
      ],
      materials: [
        'Mortier-colle classé C2 minimum',
        'Joint ciment ou époxy selon usage',
        'Primaire d\'accrochage si nécessaire',
      ],
      controls: [
        'Planéité support avant pose',
        'Épaisseur et peigne mortier-colle',
        'Alignement et joints réguliers',
      ],
      dateVersion: '2018',
    },
    {
      code: 'DTU 51.1',
      title: 'Pose des parquets à clouer',
      category: 'parquet_cloue',
      applicableTo: ['parquet massif', 'parquet traditionnel'],
      summary: 'Pose clouée des parquets massifs sur lambourdes.',
      keyRequirements: [
        'Lambourdes calées tous les 45 cm maximum',
        'Jeu périphérique 8 mm minimum',
        'Humidité du parquet 7-11%',
        'Local conditionné avant pose',
        'Clouage en biais dans la languette',
      ],
      dateVersion: '2019',
    },
    {
      code: 'DTU 51.2',
      title: 'Parquets collés',
      category: 'parquet_colle',
      applicableTo: ['parquet contrecollé', 'parquet collé'],
      summary: 'Pose collée des parquets.',
      keyRequirements: [
        'Support ragréé (planéité 5 mm/2 m)',
        'Hygrométrie support < 3% (CM)',
        'Colle adaptée au format et essence',
        'Jeu périphérique 8-10 mm',
        'Délai ponçage vitrification : 7 jours mini',
      ],
      dateVersion: '2018',
    },
    {
      code: 'DTU 53.2',
      title: 'Revêtements de sol PVC collés',
      category: 'sol_pvc',
      applicableTo: ['sol PVC', 'linoleum', 'sol vinyle'],
      summary: 'Pose collée des revêtements PVC et assimilés.',
      keyRequirements: [
        'Support ragréé P3 minimum',
        'Humidité résiduelle < 4.5% (CM)',
        'Colle acrylique ou néoprène selon produit',
        'Maroufler pour chasser bulles d\'air',
        'Soudure à chaud des joints (PVC homogène)',
      ],
      dateVersion: '2020',
    },
  ],

  // ============================================
  // PEINTURE & FINITIONS
  // ============================================
  peinture: [
    {
      code: 'DTU 59.1',
      title: 'Revêtements de peinture en feuil mince, semi-épais ou épais',
      category: 'peinture',
      applicableTo: ['murs', 'plafonds', 'boiseries', 'métaux'],
      summary: 'Application des peintures intérieures et extérieures.',
      keyRequirements: [
        'Support sec, propre, dépoussiéré',
        'Impression adaptée au support',
        '2 couches de finition minimum',
        'Égrenage entre couches (boiseries)',
        'Température > 8°C et HR < 80%',
        'Délai de recouvrement selon produit',
      ],
      materials: [
        'Peintures conformes aux classes DTU',
        'Impression/fixateur adapté',
        'Enduit de rebouchage/lissage si nécessaire',
      ],
      controls: [
        'Opacité (pouvoir couvrant)',
        'Tendu et absence de coulures',
        'Brillance conforme (mat, satiné, brillant)',
      ],
      dateVersion: '2018',
    },
    {
      code: 'DTU 59.4',
      title: 'Mise en œuvre des papiers peints et revêtements muraux',
      category: 'papier_peint',
      applicableTo: ['papier peint', 'toile de verre', 'revêtement mural'],
      summary: 'Pose des revêtements muraux collés.',
      keyRequirements: [
        'Support lisse et absorbant uniforme',
        'Encollage mur ou papier selon type',
        'Raccords de motifs soignés',
        'Marouflage sans bulles',
        'Joint bord à bord (sauf papiers à raccord)',
      ],
      dateVersion: '2017',
    },
  ],

  // ============================================
  // PLOMBERIE SANITAIRE
  // ============================================
  plomberie: [
    {
      code: 'DTU 60.1',
      title: 'Plomberie sanitaire pour bâtiments',
      category: 'plomberie',
      applicableTo: ['alimentation eau', 'évacuation', 'appareils sanitaires'],
      summary: 'Règles de conception et exécution des installations de plomberie.',
      keyRequirements: [
        'Pression : 1 à 3 bars aux points de puisage',
        'Vitesse écoulement < 2 m/s',
        'Diamètre selon nombre d\'appareils (abaques)',
        'Protection anti-retour obligatoire',
        'Calorifugeage des canalisations ECS',
        'Évacuation en pente 1-3 cm/m',
      ],
      materials: [
        'Tubes cuivre NF EN 1057',
        'Tubes PER conformes NF EN ISO 15875',
        'Tubes multicouche avec Avis Technique',
        'Raccords certifiés',
      ],
      controls: [
        'Épreuve sous pression (1.5x pression service)',
        'Contrôle étanchéité évacuations',
        'Vérification débits et pressions',
      ],
      dateVersion: '2020',
      relatedNorms: ['NF EN 806', 'NF EN 12056'],
    },
    {
      code: 'DTU 60.11',
      title: 'Règles de calcul des installations de plomberie sanitaire',
      category: 'plomberie',
      applicableTo: ['dimensionnement', 'calculs hydrauliques'],
      summary: 'Méthodes de calcul pour le dimensionnement.',
      keyRequirements: [
        'Calcul selon probabilité de simultanéité',
        'Débits de base normalisés par appareil',
        'Pertes de charge linéaires et singulières',
        'Diamètre minimum 12 mm intérieur en habitation',
      ],
      dateVersion: '2019',
    },
    {
      code: 'DTU 65.10',
      title: 'Canalisations d\'eau chaude ou froide sous pression',
      category: 'chauffage',
      applicableTo: ['tuyauteries', 'réseaux hydrauliques'],
      summary: 'Mise en œuvre des canalisations de chauffage et ECS.',
      keyRequirements: [
        'Tubes cuivre ou acier avec protection anticorrosion',
        'Supports et fixations espacés selon diamètre',
        'Lyres de dilatation si nécessaire',
        'Calorifugeage selon zones non chauffées',
        'Pente de vidange si réseau vidangeable',
      ],
      dateVersion: '2018',
    },
  ],

  // ============================================
  // CHAUFFAGE & VENTILATION
  // ============================================
  chauffage: [
    {
      code: 'DTU 65.11',
      title: 'Dispositifs de sécurité des installations de chauffage central',
      category: 'chauffage_securite',
      applicableTo: ['vase expansion', 'soupape', 'régulation'],
      summary: 'Équipements de sécurité obligatoires.',
      keyRequirements: [
        'Vase d\'expansion adapté au volume installation',
        'Soupape de sécurité tarée à 3 bars max (habitat)',
        'Disconnecteur sur remplissage',
        'Purgeurs aux points hauts',
        'Thermostat de sécurité sur générateur',
      ],
      dateVersion: '2017',
    },
    {
      code: 'DTU 65.12',
      title: 'Planchers chauffants à eau chaude',
      category: 'plancher_chauffant',
      applicableTo: ['chauffage sol', 'plancher chauffant hydraulique'],
      summary: 'Conception et mise en œuvre des planchers chauffants hydrauliques.',
      keyRequirements: [
        'Température eau départ ≤ 50°C',
        'Température surface sol ≤ 28°C (locaux courants)',
        'Isolant sous tubes R ≥ 2 m².K/W',
        'Chape d\'enrobage 3 cm mini au-dessus tubes',
        'Espacement tubes 10-30 cm selon puissance',
        'Régulateur et sonde de départ obligatoires',
      ],
      materials: [
        'Tubes PER ou multicouche BAO',
        'Isolant PSE ou polyuréthane',
        'Additif fluidifiant pour chape',
        'Bande périphérique désolidarisation',
      ],
      controls: [
        'Épreuve hydraulique avant chape',
        'Première mise en chauffe après 21 jours',
        'Montée en température progressive',
      ],
      dateVersion: '2019',
      relatedNorms: ['NF EN 1264'],
    },
    {
      code: 'DTU 68.3',
      title: 'Installations de ventilation mécanique',
      category: 'vmc',
      applicableTo: ['VMC simple flux', 'VMC double flux', 'extraction'],
      summary: 'Conception et mise en œuvre des systèmes de ventilation.',
      keyRequirements: [
        'Débits extraction selon type de pièce',
        'Entrées d\'air dans pièces principales (SF)',
        'Conduits rigides ou semi-rigides certifiés',
        'Caisson en combles isolés si non chauffés',
        'Rejet en toiture à 40 cm mini des ouvrants',
        'Nettoyabilité des conduits',
      ],
      materials: [
        'Conduits conformes NF EN 13180',
        'Bouches et entrées d\'air certifiées',
        'Caisson VMC avec avis technique',
      ],
      controls: [
        'Mesure des débits par bouche',
        'Contrôle étanchéité réseau (double flux)',
        'Bruit (émergence admissible)',
      ],
      dateVersion: '2020',
    },
  ],

  // ============================================
  // ÉLECTRICITÉ
  // ============================================
  electricite: [
    {
      code: 'NF C 15-100',
      title: 'Installations électriques à basse tension',
      category: 'electricite',
      applicableTo: ['tableau électrique', 'prises', 'éclairage', 'circuits'],
      summary: 'Norme fondamentale pour les installations électriques domestiques.',
      keyRequirements: [
        'Disjoncteur de branchement en limite de propriété',
        'Interrupteur différentiel 30 mA par groupe de circuits',
        'Section fils selon puissance (1.5 mm² éclairage, 2.5 mm² prises)',
        'Nombre de points par circuit limité (8 prises 16A)',
        'ETEL obligatoire (Espace Technique Électrique du Logement)',
        'Mise à la terre obligatoire (< 100 ohms)',
        'Protection parafoudre selon zone et type',
      ],
      materials: [
        'Câbles H07VU ou H07VR sous conduit',
        'Appareillage certifié NF',
        'Tableau conformes NF EN 61439-3',
        'DDR type A ou AC selon usage',
      ],
      controls: [
        'Contrôle Consuel obligatoire (neuf)',
        'Mesure terre et continuité',
        'Essai des différentiels',
        'Vérification des calibres protection',
      ],
      dateVersion: '2023',
      relatedNorms: ['NF EN 60364 (IEC 60364)', 'NF C 14-100'],
    },
    {
      code: 'DTU 70.1',
      title: 'Installations électriques des bâtiments à usage d\'habitation',
      category: 'electricite',
      applicableTo: ['gaine technique', 'colonne montante'],
      summary: 'Dispositions particulières pour le logement.',
      keyRequirements: [
        'Gaine technique logement (GTL) obligatoire',
        'Réserve de 20% dans tableau',
        'Câblage structuré (grade 3 mini)',
        'Liaison équipotentielle salle de bains',
      ],
      dateVersion: '2018',
    },
  ],

  // ============================================
  // AMÉNAGEMENTS EXTÉRIEURS
  // ============================================
  amenagement_exterieur: [
    {
      code: 'NF P 98-335',
      title: 'Mise en œuvre des pavés et dalles en béton',
      category: 'paves',
      applicableTo: ['allées', 'terrasses', 'parkings'],
      summary: 'Pose des pavés et dalles béton pour voirie et espaces extérieurs.',
      keyRequirements: [
        'Lit de pose sable ou gravillons 3-5 cm',
        'Pente transversale 1-2%',
        'Bordures de maintien périphériques',
        'Joints sable fin ou polymère',
        'Compactage après pose',
      ],
      dateVersion: '2018',
    },
    {
      code: 'DTU 64.1',
      title: 'Dispositifs d\'assainissement non collectif',
      category: 'assainissement',
      applicableTo: ['fosse septique', 'épandage', 'ANC'],
      summary: 'Conception et mise en œuvre de l\'assainissement autonome.',
      keyRequirements: [
        'Étude de sol obligatoire',
        'Dimensionnement selon équivalent-habitant',
        'Distance règlementaire des limites et captages',
        'Ventilation primaire et secondaire',
        'Accessibilité pour entretien',
      ],
      dateVersion: '2020',
    },
  ],

  // ============================================
  // ACCESSIBILITÉ PMR
  // ============================================
  accessibilite: [
    {
      code: 'Arrêté du 20/04/2017',
      title: 'Accessibilité des bâtiments d\'habitation collectifs',
      category: 'pmr',
      applicableTo: ['circulations', 'sanitaires', 'stationnement'],
      summary: 'Règles d\'accessibilité pour les personnes à mobilité réduite.',
      keyRequirements: [
        'Cheminement praticable largeur 1.40 m (1.20 m ponctuel)',
        'Pente max 5% (8% sur 2 m, 10% sur 0.50 m)',
        'Palier de repos tous les 10 m si pente',
        'Ressaut max 2 cm (4 cm avec chanfrein)',
        'Portes passage libre 0.83 m minimum',
        'WC adapté si > 50 personnes',
      ],
      controls: [
        'Mesure des largeurs de passage',
        'Contrôle des pentes',
        'Hauteur des équipements',
      ],
      dateVersion: '2017',
      relatedNorms: ['NF P 98-350', 'NF P 99-611'],
    },
  ],

  // ============================================
  // PERFORMANCE ÉNERGÉTIQUE
  // ============================================
  energie: [
    {
      code: 'RE2020',
      title: 'Réglementation Environnementale 2020',
      category: 'performance',
      applicableTo: ['construction neuve', 'extension'],
      summary: 'Exigences environnementales et énergétiques pour le neuf.',
      keyRequirements: [
        'Bbio max selon zone climatique et altitude',
        'Cep max (kWhep/m²/an) selon usage',
        'Cep,nr (énergie non renouvelable)',
        'DH (degrés-heures inconfort) limité',
        'IC construction et énergie (carbone)',
        'Test perméabilité à l\'air obligatoire',
      ],
      controls: [
        'Étude thermique réglementaire',
        'Test infiltrométrie Q4Pa-surf',
        'Attestation fin de travaux',
      ],
      dateVersion: '2022',
    },
    {
      code: 'RT2012',
      title: 'Réglementation Thermique 2012',
      category: 'performance',
      applicableTo: ['rénovation', 'extension < 100 m²'],
      summary: 'Exigences thermiques applicables aux rénovations importantes.',
      keyRequirements: [
        'Bbio max (besoin bioclimatique)',
        'Cep max 50 kWhep/m²/an modulé',
        'Tic (température intérieure conventionnelle)',
        'Surface vitrée ≥ 1/6 surface habitable',
        'Accès ENR ou traitement pont thermique',
      ],
      dateVersion: '2012',
    },
  ],
};

// =============================================================================
// FONCTIONS UTILITAIRES
// =============================================================================

/**
 * Recherche les DTU applicables pour une catégorie de travaux
 */
export function getDTUsForCategory(category: string): DTUReferenceEnriched[] {
  const normalizedCategory = category.toLowerCase().replace(/[éè]/g, 'e').replace(/[àâ]/g, 'a');

  // Recherche directe
  if (DTU_CATALOG_ENRICHED[normalizedCategory]) {
    return DTU_CATALOG_ENRICHED[normalizedCategory];
  }

  // Recherche par mots-clés
  const results: DTUReferenceEnriched[] = [];
  Object.values(DTU_CATALOG_ENRICHED).forEach(dtus => {
    dtus.forEach(dtu => {
      if (
        dtu.applicableTo.some(app => app.toLowerCase().includes(normalizedCategory)) ||
        dtu.title.toLowerCase().includes(normalizedCategory) ||
        dtu.category.toLowerCase().includes(normalizedCategory)
      ) {
        results.push(dtu);
      }
    });
  });

  return results;
}

/**
 * Recherche un DTU par son code
 */
export function getDTUByCode(code: string): DTUReferenceEnriched | undefined {
  for (const dtus of Object.values(DTU_CATALOG_ENRICHED)) {
    const found = dtus.find(dtu => dtu.code.toLowerCase() === code.toLowerCase());
    if (found) return found;
  }
  return undefined;
}

/**
 * Liste toutes les catégories disponibles
 */
export function getAllCategories(): string[] {
  return Object.keys(DTU_CATALOG_ENRICHED);
}

/**
 * Compte total des DTU dans le catalogue
 */
export function getTotalDTUCount(): number {
  return Object.values(DTU_CATALOG_ENRICHED).reduce((sum, dtus) => sum + dtus.length, 0);
}

export default DTU_CATALOG_ENRICHED;
