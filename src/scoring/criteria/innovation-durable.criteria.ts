/**
 * Criteres de scoring - Axe Innovation & Developpement Durable
 *
 * Total : 50 points
 * - Performance environnementale : 30 pts
 * - Innovation technique : 20 pts
 */

export const INNOVATION_DURABLE_CRITERIA = {
  axe: 'INNOVATION_DURABLE',
  nom: 'Innovation & Developpement Durable',
  pointsMax: 50,
  poids: 0.048, // ~4.8% du score total (50/1050)

  sousAxes: {
    // ============================================
    // PERFORMANCE ENVIRONNEMENTALE (30 pts)
    // ============================================
    PERFORMANCE_ENVIRONNEMENTALE: {
      nom: 'Performance Environnementale',
      pointsMax: 30,
      criteres: {
        // Materiaux bas carbone / biosources (10 pts)
        MATERIAUX_BAS_CARBONE: {
          nom: 'Materiaux bas carbone / biosources',
          pointsMax: 10,
          description: 'Utilisation de materiaux a faible impact carbone ou biosources',
          source: 'analyse_devis',
          algorithme: {
            type: 'detection_keywords',
            keywords: {
              // Isolants biosources
              biosource: ['laine de bois', 'fibre de bois', 'ouate de cellulose', 'chanvre', 'lin', 'coton recycle', 'liege', 'paille'],
              // Materiaux recycles
              recycle: ['recycle', 'reemploi', 'recuperation', 'seconde vie'],
              // Labels environnementaux produits
              labels: ['PEFC', 'FSC', 'Natureplus', 'Ecolabel', 'HQE', 'FDES', 'PEP'],
              // Betons bas carbone
              beton_bas_carbone: ['beton bas carbone', 'CEM III', 'laitier', 'cendres volantes'],
            },
            scoring: {
              '0_keyword': 0,
              '1_keyword': 3,
              '2_keywords': 5,
              '3_keywords': 7,
              '4+_keywords': 10,
            },
          },
        },

        // Economies energetiques (10 pts)
        ECONOMIES_ENERGETIQUES: {
          nom: 'Economies energetiques',
          pointsMax: 10,
          description: 'Solutions visant a reduire la consommation energetique',
          source: 'analyse_devis',
          algorithme: {
            type: 'detection_solutions',
            solutions: {
              isolation: {
                keywords: ['isolation', 'ITE', 'ITI', 'combles', 'toiture', 'plancher bas'],
                points: 3,
              },
              menuiseries: {
                keywords: ['double vitrage', 'triple vitrage', 'Uw', 'rupture de pont thermique'],
                points: 2,
              },
              ventilation: {
                keywords: ['VMC double flux', 'recuperation chaleur', 'VMC hygro B'],
                points: 2,
              },
              chauffage_performant: {
                keywords: ['pompe a chaleur', 'PAC', 'chaudiere condensation', 'geothermie'],
                points: 2,
              },
              energie_renouvelable: {
                keywords: ['panneaux solaires', 'photovoltaique', 'solaire thermique', 'chauffe-eau solaire'],
                points: 3,
              },
              domotique_energie: {
                keywords: ['thermostat connecte', 'programmation', 'gestion energie', 'domotique'],
                points: 1,
              },
            },
            plafond: 10,
          },
        },

        // Gestion dechets chantier (5 pts)
        GESTION_DECHETS: {
          nom: 'Gestion des dechets chantier',
          pointsMax: 5,
          description: 'Mention de tri, valorisation ou evacuation responsable des dechets',
          source: 'analyse_devis',
          algorithme: {
            type: 'detection_presence',
            elements: {
              tri_dechets: {
                keywords: ['tri des dechets', 'tri selectif', 'benne de tri'],
                points: 2,
              },
              valorisation: {
                keywords: ['valorisation', 'recyclage', 'reemploi', 'economie circulaire'],
                points: 2,
              },
              evacuation: {
                keywords: ['evacuation dechets', 'enlevement gravats', 'centre de tri', 'dechetterie'],
                points: 1,
              },
            },
          },
        },

        // Circuits courts / local (5 pts)
        CIRCUITS_COURTS: {
          nom: 'Circuits courts / approvisionnement local',
          pointsMax: 5,
          description: 'Utilisation de fournisseurs ou materiaux locaux',
          source: 'analyse_devis + entreprise',
          algorithme: {
            type: 'combined',
            elements: {
              mention_local: {
                keywords: ['local', 'regional', 'proximite', 'circuit court', 'France', 'francais'],
                points: 2,
              },
              fournisseurs_francais: {
                keywords: ['fabrique en France', 'made in France', 'origine France'],
                points: 2,
              },
              entreprise_locale: {
                // Base sur la distance entreprise-chantier
                condition: 'distance_km < 50',
                points: 1,
              },
            },
          },
        },
      },
    },

    // ============================================
    // INNOVATION TECHNIQUE (20 pts)
    // ============================================
    INNOVATION_TECHNIQUE: {
      nom: 'Innovation Technique',
      pointsMax: 20,
      criteres: {
        // Solutions innovantes maitrisees (10 pts)
        SOLUTIONS_INNOVANTES: {
          nom: 'Solutions innovantes',
          pointsMax: 10,
          description: 'Utilisation de technologies ou methodes innovantes',
          source: 'analyse_devis',
          algorithme: {
            type: 'detection_technologies',
            technologies: {
              // Domotique / Smart Home
              domotique: {
                keywords: ['domotique', 'smart home', 'maison connectee', 'KNX', 'Zigbee', 'connecte'],
                points: 3,
              },
              // Systemes performants
              systemes_performants: {
                keywords: ['inverter', 'ECS thermodynamique', 'ballon thermodynamique', 'recuperateur de chaleur'],
                points: 2,
              },
              // Materiaux innovants
              materiaux_innovants: {
                keywords: ['aerogel', 'VIP', 'panneau isolant sous vide', 'beton de chanvre', 'brique monomur'],
                points: 2,
              },
              // Techniques construction
              techniques_innovantes: {
                keywords: ['prefabrication', 'modulaire', 'ossature bois', 'construction seche', 'hors site'],
                points: 2,
              },
              // Autoconsommation
              autoconsommation: {
                keywords: ['autoconsommation', 'batterie', 'stockage energie', 'autonomie energetique'],
                points: 2,
              },
            },
            plafond: 10,
          },
        },

        // Outils numeriques (5 pts)
        OUTILS_NUMERIQUES: {
          nom: 'Outils numeriques',
          pointsMax: 5,
          description: 'Utilisation de BIM, maquette 3D, suivi digital',
          source: 'analyse_devis + entreprise',
          algorithme: {
            type: 'detection_presence',
            elements: {
              bim: {
                keywords: ['BIM', 'maquette numerique', 'Building Information Modeling'],
                points: 3,
              },
              visualisation_3d: {
                keywords: ['maquette 3D', 'visualisation 3D', 'rendu 3D', 'visite virtuelle'],
                points: 1,
              },
              suivi_digital: {
                keywords: ['application chantier', 'suivi digital', 'planning digital', 'photos chantier'],
                points: 1,
              },
            },
          },
        },

        // Certifications innovation entreprise (5 pts)
        CERTIFICATIONS_INNOVATION: {
          nom: 'Certifications innovation entreprise',
          pointsMax: 5,
          description: 'Labels et certifications lies a l\'innovation ou l\'environnement',
          source: 'pappers + analyse_devis',
          algorithme: {
            type: 'verification_labels',
            labels: {
              // Labels RGE (deja dans entreprise mais bonus ici)
              rge_specifiques: {
                labels: ['RGE Qualibat', 'RGE Qualifelec', 'RGE Qualit\'EnR'],
                points: 2,
              },
              // Labels environnementaux
              environnement: {
                labels: ['ISO 14001', 'Eco-artisan', 'Entreprise du patrimoine vivant'],
                points: 2,
              },
              // Labels qualite/innovation
              innovation: {
                labels: ['Qualibat mention efficacite energetique', 'Pros de la performance energetique'],
                points: 1,
              },
            },
          },
        },
      },
    },
  },
};

// ============================================
// TYPES
// ============================================

export interface InnovationDurableScore {
  total: number;                    // 0-50
  pourcentage: number;              // 0-100%
  grade: 'A' | 'B' | 'C' | 'D' | 'F';

  sousAxes: {
    performanceEnvironnementale: {
      total: number;                // 0-30
      details: {
        materiauxBasCarbone: number;
        economiesEnergetiques: number;
        gestionDechets: number;
        circuitsCourts: number;
      };
      elementsDetectes: string[];
    };
    innovationTechnique: {
      total: number;                // 0-20
      details: {
        solutionsInnovantes: number;
        outilsNumeriques: number;
        certificationsInnovation: number;
      };
      elementsDetectes: string[];
    };
  };

  recommandations: string[];
  pointsForts: string[];
}

export type InnovationDurableGrade = InnovationDurableScore['grade'];
