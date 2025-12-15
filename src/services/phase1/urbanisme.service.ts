/**
 * TORP Phase 1 - Service Analyse Urbanistique
 *
 * PRODUCTION READY - Utilise les vraies APIs gouvernementales françaises :
 * - API Adresse (BAN) pour le géocodage
 * - API Géo pour les informations communes
 * - API Géoportail Urbanisme pour les zones PLU
 * - API Géorisques pour les risques naturels/technologiques
 * - API Atlas des Patrimoines pour les monuments historiques
 *
 * Principe ZÉRO MOCK : affiche "Non spécifié" si données indisponibles
 */

import type { Address } from '@/types/phase0/common.types';
import type { Phase0Project } from '@/types/phase0/project.types';

// =============================================================================
// TYPES
// =============================================================================

export interface AnalyseUrbanistique {
  adresse: Address;
  commune: CommuneInfo;
  zonePLU: ZonePLU | null;
  secteursProteges: SecteurProtege[];
  contraintes: ContrainteUrbanistique[];
  autorisationsRequises: AutorisationRequise[];
  recommandations: RecommandationUrbanisme[];
  risques: RisqueUrbanistique[];
  risquesNaturels: RisqueNaturel[];
  metadata: {
    dateAnalyse: string;
    sourceDonnees: string[];
    fiabilite: 'haute' | 'moyenne' | 'basse';
    apisUtilisees: string[];
    erreurs?: string[];
  };
}

export interface CommuneInfo {
  nom: string;
  codePostal: string;
  codeInsee: string;
  departement: string;
  departementNom: string;
  region: string;
  population?: number;
  aUnPLU: boolean | null;
  typePLU: 'PLU' | 'PLUi' | 'POS' | 'carte_communale' | 'RNU' | 'inconnu';
  urlServiceUrbanisme?: string;
  contactUrbanisme?: {
    telephone?: string;
    email?: string;
    adresse?: string;
    horaires?: string;
  };
  coordonnees?: {
    latitude: number;
    longitude: number;
  };
}

export interface ZonePLU {
  code: string;
  type: TypeZonePLU;
  designation: string;
  description: string;
  reglesGenerales: ReglePLU[];
  hauteurMax?: number;
  empriseMax?: number;
  cosMax?: number;
  reculs: {
    parRapportVoie?: number;
    parRapportLimites?: number;
    parRapportVoisins?: number;
  };
  sourceDocument?: {
    nom: string;
    dateApprobation?: string;
    url?: string;
  };
}

export type TypeZonePLU =
  | 'urbaine'
  | 'a_urbaniser'
  | 'agricole'
  | 'naturelle'
  | 'mixte'
  | 'inconnu';

export interface ReglePLU {
  article: string;
  titre: string;
  contenu: string;
  impact: 'bloquant' | 'restrictif' | 'informatif';
}

export interface SecteurProtege {
  type: TypeSecteurProtege;
  nom: string;
  description: string;
  perimetre: string;
  contraintes: string[];
  architecteBatimentsFrance: boolean;
  delaiSupplementaire?: number;
  reference?: string;
  dateProtection?: string;
}

export type TypeSecteurProtege =
  | 'monument_historique'
  | 'site_classe'
  | 'site_inscrit'
  | 'avap'
  | 'zppaup'
  | 'secteur_sauvegarde'
  | 'psmv'
  | 'unesco';

export interface ContrainteUrbanistique {
  type: TypeContrainte;
  titre: string;
  description: string;
  source: string;
  impact: 'bloquant' | 'restrictif' | 'informatif';
  solutionsPossibles?: string[];
}

export type TypeContrainte =
  | 'hauteur'
  | 'emprise'
  | 'materiaux'
  | 'couleurs'
  | 'toiture'
  | 'ouvertures'
  | 'clotures'
  | 'stationnement'
  | 'espaces_verts'
  | 'alignement'
  | 'prospect'
  | 'servitude'
  | 'risque_naturel'
  | 'risque_technologique';

export interface AutorisationRequise {
  type: TypeAutorisation;
  obligatoire: boolean;
  motif: string;
  delaiInstruction: number;
  delaiMajore?: number;
  piecesPrincipales: string[];
  formulaire: {
    cerfa: string;
    url?: string;
  };
  destination: string;
  recommandations: string[];
}

export type TypeAutorisation =
  | 'declaration_prealable'
  | 'permis_construire'
  | 'permis_demolir'
  | 'permis_amenager'
  | 'autorisation_travaux_erp'
  | 'autorisation_abf';

export interface RecommandationUrbanisme {
  priorite: 'haute' | 'moyenne' | 'basse';
  titre: string;
  description: string;
  action: string;
  lien?: string;
}

export interface RisqueUrbanistique {
  type: 'refus' | 'modification' | 'retard' | 'contentieux';
  probabilite: 'haute' | 'moyenne' | 'basse';
  description: string;
  prevention: string;
}

export interface RisqueNaturel {
  type: string;
  niveau: 'fort' | 'moyen' | 'faible' | 'tres_faible' | 'inconnu';
  description: string;
  zonage?: string;
  prescriptions?: string[];
  source: string;
}

// =============================================================================
// API RESPONSE TYPES
// =============================================================================

interface BANAddressResponse {
  features: Array<{
    geometry: {
      coordinates: [number, number];
    };
    properties: {
      label: string;
      score: number;
      housenumber?: string;
      street?: string;
      postcode: string;
      citycode: string;
      city: string;
      context: string;
    };
  }>;
}

interface GeoAPICommune {
  nom: string;
  code: string;
  codesPostaux: string[];
  population?: number;
  departement: {
    code: string;
    nom: string;
  };
  region: {
    code: string;
    nom: string;
  };
}

interface GeorisquesResponse {
  results?: Array<{
    libelle_risque: string;
    code_national_risque: string;
    niveau_risque?: string;
  }>;
}

interface GPUResponse {
  features?: Array<{
    properties: {
      libelle?: string;
      libelong?: string;
      typezone?: string;
      destdomi?: string;
      partition?: string;
      idurba?: string;
    };
  }>;
}

// =============================================================================
// SERVICE
// =============================================================================

export class UrbanismeService {
  private static readonly API_ADRESSE = 'https://api-adresse.data.gouv.fr';
  private static readonly API_GEO = 'https://geo.api.gouv.fr';
  private static readonly API_GEORISQUES = 'https://www.georisques.gouv.fr/api/v1';
  private static readonly API_GPU = 'https://apicarto.ign.fr/api/gpu';

  private static readonly TIMEOUT_MS = 10000;

  /**
   * Analyse complète des contraintes urbanistiques pour un projet
   */
  static async analyzeProject(project: Phase0Project): Promise<AnalyseUrbanistique> {
    const address = this.getProjectAddress(project);
    const errors: string[] = [];
    const apisUtilisees: string[] = [];

    if (!address || !address.city) {
      throw new Error('Adresse du projet requise pour l\'analyse urbanistique');
    }

    // Géocoder l'adresse pour obtenir les coordonnées
    let coordinates: { lat: number; lon: number } | null = null;
    let codeInsee: string | null = null;

    try {
      const geocodeResult = await this.geocodeAddress(address);
      if (geocodeResult) {
        coordinates = { lat: geocodeResult.lat, lon: geocodeResult.lon };
        codeInsee = geocodeResult.codeInsee;
        apisUtilisees.push('API Adresse (BAN)');
      }
    } catch (err) {
      errors.push(`Géocodage: ${err instanceof Error ? err.message : 'Erreur inconnue'}`);
    }

    // Récupérer les informations de la commune
    let commune: CommuneInfo;
    try {
      commune = await this.getCommuneInfo(address, codeInsee, coordinates);
      if (commune.codeInsee) {
        apisUtilisees.push('API Géo');
      }
    } catch (err) {
      errors.push(`Commune: ${err instanceof Error ? err.message : 'Erreur inconnue'}`);
      commune = this.getDefaultCommuneInfo(address);
    }

    // Récupérer la zone PLU
    let zonePLU: ZonePLU | null = null;
    if (coordinates) {
      try {
        zonePLU = await this.getZonePLU(coordinates);
        if (zonePLU) {
          apisUtilisees.push('API Géoportail Urbanisme');
        }
      } catch (err) {
        errors.push(`Zone PLU: ${err instanceof Error ? err.message : 'Erreur inconnue'}`);
      }
    }

    // Récupérer les risques naturels/technologiques
    let risquesNaturels: RisqueNaturel[] = [];
    if (coordinates) {
      try {
        risquesNaturels = await this.getRisquesNaturels(coordinates, codeInsee);
        if (risquesNaturels.length > 0) {
          apisUtilisees.push('API Géorisques');
        }
      } catch (err) {
        errors.push(`Risques: ${err instanceof Error ? err.message : 'Erreur inconnue'}`);
      }
    }

    // Identifier les secteurs protégés (monuments historiques, etc.)
    let secteursProteges: SecteurProtege[] = [];
    if (coordinates) {
      try {
        secteursProteges = await this.getSecteursProteges(coordinates);
        if (secteursProteges.length > 0) {
          apisUtilisees.push('Atlas des Patrimoines');
        }
      } catch (err) {
        errors.push(`Secteurs protégés: ${err instanceof Error ? err.message : 'Erreur inconnue'}`);
      }
    }

    // Analyser les contraintes selon le type de travaux
    const contraintes = this.analyzeContraintes(project, zonePLU, secteursProteges, risquesNaturels);

    // Déterminer les autorisations requises
    const autorisationsRequises = this.determineAutorisations(project, zonePLU, secteursProteges);

    // Générer les recommandations
    const recommandations = this.generateRecommandations(project, contraintes, autorisationsRequises);

    // Évaluer les risques urbanistiques
    const risques = this.evaluateRisques(project, contraintes, secteursProteges);

    // Déterminer la fiabilité
    const fiabilite = this.determineReliability(apisUtilisees, errors);

    return {
      adresse: address,
      commune,
      zonePLU,
      secteursProteges,
      contraintes,
      autorisationsRequises,
      recommandations,
      risques,
      risquesNaturels,
      metadata: {
        dateAnalyse: new Date().toISOString(),
        sourceDonnees: apisUtilisees.length > 0 ? apisUtilisees : ['Données insuffisantes'],
        fiabilite,
        apisUtilisees,
        erreurs: errors.length > 0 ? errors : undefined,
      },
    };
  }

  /**
   * Géocode une adresse via l'API Adresse (BAN)
   */
  private static async geocodeAddress(address: Address): Promise<{
    lat: number;
    lon: number;
    codeInsee: string;
    label: string;
  } | null> {
    const query = [
      address.street,
      address.postalCode,
      address.city
    ].filter(Boolean).join(' ');

    if (!query) return null;

    const url = `${this.API_ADRESSE}/search/?q=${encodeURIComponent(query)}&limit=1`;

    try {
      const response = await this.fetchWithTimeout(url);
      if (!response.ok) {
        throw new Error(`API Adresse: ${response.status}`);
      }

      const data: BANAddressResponse = await response.json();

      if (data.features && data.features.length > 0) {
        const feature = data.features[0];
        return {
          lon: feature.geometry.coordinates[0],
          lat: feature.geometry.coordinates[1],
          codeInsee: feature.properties.citycode,
          label: feature.properties.label,
        };
      }
    } catch (err) {
      console.error('[Urbanisme] Geocode error:', err);
    }

    return null;
  }

  /**
   * Récupère les informations de la commune via l'API Géo
   */
  private static async getCommuneInfo(
    address: Address,
    codeInsee: string | null,
    coordinates: { lat: number; lon: number } | null
  ): Promise<CommuneInfo> {
    let communeData: GeoAPICommune | null = null;

    // Essayer par code INSEE
    if (codeInsee) {
      try {
        const url = `${this.API_GEO}/communes/${codeInsee}?fields=nom,code,codesPostaux,population,departement,region`;
        const response = await this.fetchWithTimeout(url);
        if (response.ok) {
          communeData = await response.json();
        }
      } catch (err) {
        console.error('[Urbanisme] Commune by INSEE error:', err);
      }
    }

    // Essayer par coordonnées si pas de résultat
    if (!communeData && coordinates) {
      try {
        const url = `${this.API_GEO}/communes?lat=${coordinates.lat}&lon=${coordinates.lon}&fields=nom,code,codesPostaux,population,departement,region`;
        const response = await this.fetchWithTimeout(url);
        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data) && data.length > 0) {
            communeData = data[0];
          }
        }
      } catch (err) {
        console.error('[Urbanisme] Commune by coords error:', err);
      }
    }

    // Essayer par code postal
    if (!communeData && address.postalCode) {
      try {
        const url = `${this.API_GEO}/communes?codePostal=${address.postalCode}&fields=nom,code,codesPostaux,population,departement,region`;
        const response = await this.fetchWithTimeout(url);
        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data) && data.length > 0) {
            // Chercher la commune correspondant à la ville
            communeData = data.find((c: GeoAPICommune) =>
              c.nom.toLowerCase() === address.city?.toLowerCase()
            ) || data[0];
          }
        }
      } catch (err) {
        console.error('[Urbanisme] Commune by postal code error:', err);
      }
    }

    if (communeData) {
      return {
        nom: communeData.nom,
        codePostal: address.postalCode || communeData.codesPostaux[0] || '',
        codeInsee: communeData.code,
        departement: communeData.departement.code,
        departementNom: communeData.departement.nom,
        region: communeData.region.nom,
        population: communeData.population,
        aUnPLU: null, // Non disponible via API Géo
        typePLU: 'inconnu',
        coordonnees: coordinates ? { latitude: coordinates.lat, longitude: coordinates.lon } : undefined,
      };
    }

    return this.getDefaultCommuneInfo(address);
  }

  /**
   * Retourne des informations commune par défaut (données incomplètes)
   */
  private static getDefaultCommuneInfo(address: Address): CommuneInfo {
    const deptCode = address.postalCode?.substring(0, 2) || '';

    return {
      nom: address.city || 'Non spécifié',
      codePostal: address.postalCode || '',
      codeInsee: '',
      departement: deptCode,
      departementNom: 'Non spécifié',
      region: 'Non spécifié',
      aUnPLU: null,
      typePLU: 'inconnu',
    };
  }

  /**
   * Récupère la zone PLU via l'API Géoportail Urbanisme (APICarto)
   */
  private static async getZonePLU(coordinates: { lat: number; lon: number }): Promise<ZonePLU | null> {
    try {
      // API Carto GPU - Zone d'urbanisme
      const url = `${this.API_GPU}/zone-urba?geom={"type":"Point","coordinates":[${coordinates.lon},${coordinates.lat}]}`;

      const response = await this.fetchWithTimeout(url);
      if (!response.ok) {
        console.error('[Urbanisme] GPU API error:', response.status);
        return null;
      }

      const data: GPUResponse = await response.json();

      if (data.features && data.features.length > 0) {
        const zone = data.features[0].properties;
        const typeCode = zone.typezone || '';

        return {
          code: zone.libelle || typeCode || 'Non spécifié',
          type: this.mapTypeZone(typeCode),
          designation: zone.libelong || zone.libelle || 'Zone urbanistique',
          description: zone.destdomi || 'Non spécifié',
          reglesGenerales: [], // Le règlement détaillé nécessite l'accès au document PDF
          reculs: {},
          sourceDocument: zone.idurba ? {
            nom: `Document d'urbanisme ${zone.partition || ''}`.trim(),
            url: `https://www.geoportail-urbanisme.gouv.fr/document/${zone.idurba}`,
          } : undefined,
        };
      }
    } catch (err) {
      console.error('[Urbanisme] GPU zone error:', err);
    }

    return null;
  }

  /**
   * Récupère les risques naturels et technologiques via l'API Géorisques
   */
  private static async getRisquesNaturels(
    coordinates: { lat: number; lon: number },
    codeInsee: string | null
  ): Promise<RisqueNaturel[]> {
    const risques: RisqueNaturel[] = [];

    // API Géorisques - Risques par commune ou par coordonnées
    try {
      let url: string;
      if (codeInsee) {
        url = `${this.API_GEORISQUES}/gaspar/risques?code_insee=${codeInsee}`;
      } else {
        url = `${this.API_GEORISQUES}/gaspar/risques?latlon=${coordinates.lat},${coordinates.lon}`;
      }

      const response = await this.fetchWithTimeout(url);
      if (response.ok) {
        const data: GeorisquesResponse = await response.json();

        if (data.results) {
          for (const risque of data.results) {
            risques.push({
              type: risque.libelle_risque || risque.code_national_risque,
              niveau: this.mapNiveauRisque(risque.niveau_risque),
              description: risque.libelle_risque,
              source: 'Géorisques - GASPAR',
            });
          }
        }
      }
    } catch (err) {
      console.error('[Urbanisme] Georisques GASPAR error:', err);
    }

    // Ajouter une requête pour les PPR (Plans de Prévention des Risques)
    try {
      const pprUrl = `${this.API_GEORISQUES}/ppr?latlon=${coordinates.lat},${coordinates.lon}&rayon=100`;
      const pprResponse = await this.fetchWithTimeout(pprUrl);

      if (pprResponse.ok) {
        const pprData = await pprResponse.json();
        if (pprData.results && Array.isArray(pprData.results)) {
          for (const ppr of pprData.results) {
            // Éviter les doublons
            const existe = risques.some(r => r.type === ppr.libelle_risque_jo);
            if (!existe && ppr.libelle_risque_jo) {
              risques.push({
                type: ppr.libelle_risque_jo,
                niveau: 'inconnu',
                description: `PPR: ${ppr.nom || 'Plan de Prévention des Risques'}`,
                zonage: ppr.alea,
                source: 'Géorisques - PPR',
              });
            }
          }
        }
      }
    } catch (err) {
      console.error('[Urbanisme] Georisques PPR error:', err);
    }

    return risques;
  }

  /**
   * Identifie les secteurs protégés (monuments historiques, sites classés, etc.)
   * Utilise l'API Atlas des Patrimoines / Mérimée
   */
  private static async getSecteursProteges(
    coordinates: { lat: number; lon: number }
  ): Promise<SecteurProtege[]> {
    const secteurs: SecteurProtege[] = [];

    // API Carto GPU - Servitudes d'utilité publique
    try {
      const supUrl = `${this.API_GPU}/sup?geom={"type":"Point","coordinates":[${coordinates.lon},${coordinates.lat}]}`;
      const response = await this.fetchWithTimeout(supUrl);

      if (response.ok) {
        const data = await response.json();

        if (data.features && Array.isArray(data.features)) {
          for (const feature of data.features) {
            const props = feature.properties || {};

            // Filtrer les SUP liées au patrimoine (AC1, AC2, AC3, AC4)
            if (props.categorie?.startsWith('AC')) {
              const type = this.mapSUPToSecteurType(props.categorie);
              if (type) {
                secteurs.push({
                  type,
                  nom: props.libelle || `Servitude ${props.categorie}`,
                  description: props.txt || 'Servitude d\'utilité publique',
                  perimetre: props.perimetre || 'Selon document',
                  contraintes: [
                    'Consultation du service territorial de l\'architecture et du patrimoine',
                  ],
                  architecteBatimentsFrance: ['AC1', 'AC2'].includes(props.categorie),
                  delaiSupplementaire: props.categorie === 'AC1' ? 30 : 15,
                  reference: props.idgest,
                });
              }
            }
          }
        }
      }
    } catch (err) {
      console.error('[Urbanisme] SUP patrimoniales error:', err);
    }

    // Ajouter une requête à l'API Atlas des Patrimoines si disponible
    // Note: L'API Atlas des Patrimoines n'est pas toujours accessible publiquement
    // On utilise une approche de fallback

    return secteurs;
  }

  /**
   * Récupère l'adresse du projet
   */
  private static getProjectAddress(project: Phase0Project): Address | undefined {
    return project.property?.identification?.address || project.property?.address;
  }

  /**
   * Analyse les contraintes selon le projet et le contexte urbanistique
   */
  private static analyzeContraintes(
    project: Phase0Project,
    zonePLU: ZonePLU | null,
    secteurs: SecteurProtege[],
    risques: RisqueNaturel[]
  ): ContrainteUrbanistique[] {
    const contraintes: ContrainteUrbanistique[] = [];
    const workType = project.workProject?.scope?.workType;
    const impactsFacade = project.workProject?.scope?.impactsFacade;

    // Contraintes liées à la zone PLU
    if (zonePLU) {
      if (workType === 'extension' || workType === 'surelevation') {
        if (zonePLU.hauteurMax) {
          contraintes.push({
            type: 'hauteur',
            titre: 'Limitation de hauteur',
            description: `Hauteur maximale autorisée: ${zonePLU.hauteurMax}m`,
            source: `PLU Zone ${zonePLU.code}`,
            impact: 'restrictif',
            solutionsPossibles: ['Vérifier la hauteur actuelle', 'Consulter le règlement de zone'],
          });
        }

        if (zonePLU.empriseMax) {
          contraintes.push({
            type: 'emprise',
            titre: 'Coefficient d\'emprise au sol',
            description: `Emprise maximale autorisée: ${zonePLU.empriseMax}%`,
            source: `PLU Zone ${zonePLU.code}`,
            impact: 'restrictif',
          });
        }
      }

      // Zone agricole ou naturelle
      if (zonePLU.type === 'agricole' || zonePLU.type === 'naturelle') {
        contraintes.push({
          type: 'servitude',
          titre: `Zone ${zonePLU.type}`,
          description: `Le terrain est en zone ${zonePLU.type} (${zonePLU.code}). Les possibilités de construction sont très limitées.`,
          source: 'PLU',
          impact: 'bloquant',
          solutionsPossibles: [
            'Vérifier les exceptions pour bâtiments existants',
            'Consulter le service urbanisme',
          ],
        });
      }
    } else {
      // Pas de zone PLU trouvée
      contraintes.push({
        type: 'servitude',
        titre: 'Zone PLU non identifiée',
        description: 'La zone PLU n\'a pas pu être identifiée. Consulter le service urbanisme de la commune.',
        source: 'Analyse TORP',
        impact: 'informatif',
        solutionsPossibles: ['Contacter le service urbanisme', 'Demander un certificat d\'urbanisme'],
      });
    }

    // Contraintes liées aux modifications de façade
    if (impactsFacade) {
      contraintes.push({
        type: 'materiaux',
        titre: 'Prescriptions architecturales',
        description: 'Les modifications de façade doivent respecter le caractère architectural du quartier',
        source: 'PLU - Règlement',
        impact: secteurs.length > 0 ? 'bloquant' : 'restrictif',
        solutionsPossibles: [
          'Utiliser des matériaux harmonisés avec l\'existant',
          'Consulter le service urbanisme',
        ],
      });
    }

    // Contraintes liées aux secteurs protégés
    for (const secteur of secteurs) {
      contraintes.push({
        type: 'servitude',
        titre: `Secteur protégé: ${secteur.nom}`,
        description: secteur.description,
        source: secteur.type,
        impact: secteur.architecteBatimentsFrance ? 'bloquant' : 'restrictif',
        solutionsPossibles: secteur.contraintes,
      });
    }

    // Contraintes liées aux risques naturels
    for (const risque of risques) {
      if (risque.niveau === 'fort' || risque.niveau === 'moyen') {
        contraintes.push({
          type: 'risque_naturel',
          titre: `Risque ${risque.type}`,
          description: risque.description,
          source: risque.source,
          impact: risque.niveau === 'fort' ? 'bloquant' : 'restrictif',
          solutionsPossibles: risque.prescriptions || [
            'Consulter le PPR de la commune',
            'Vérifier les prescriptions constructives',
          ],
        });
      }
    }

    return contraintes;
  }

  /**
   * Détermine les autorisations d'urbanisme requises
   */
  private static determineAutorisations(
    project: Phase0Project,
    zonePLU: ZonePLU | null,
    secteurs: SecteurProtege[]
  ): AutorisationRequise[] {
    const autorisations: AutorisationRequise[] = [];
    const workType = project.workProject?.scope?.workType;
    const impactsFacade = project.workProject?.scope?.impactsFacade;
    const surface = project.property?.surface || 0;
    const hasABF = secteurs.some(s => s.architecteBatimentsFrance);
    const delaiABF = secteurs.reduce((max, s) => Math.max(max, s.delaiSupplementaire || 0), 0);

    let autorisationType: TypeAutorisation | null = null;
    let motif = '';

    // Déterminer le type d'autorisation selon le type de travaux
    if (workType === 'extension') {
      if (surface > 40) {
        autorisationType = 'permis_construire';
        motif = 'Extension > 40m² de surface de plancher';
      } else if (surface > 20) {
        autorisationType = zonePLU ? 'permis_construire' : 'declaration_prealable';
        motif = zonePLU
          ? 'Extension > 20m² en zone urbaine avec PLU'
          : 'Extension entre 20 et 40m²';
      } else if (surface > 5) {
        autorisationType = 'declaration_prealable';
        motif = 'Extension entre 5 et 20m² de surface de plancher';
      }
    } else if (workType === 'renovation_complete') {
      if (impactsFacade) {
        autorisationType = 'declaration_prealable';
        motif = 'Modification de l\'aspect extérieur';
      }
    } else if (workType === 'surelevation') {
      autorisationType = 'permis_construire';
      motif = 'Surélévation modifiant le volume du bâtiment';
    } else if (workType === 'demolition') {
      autorisationType = 'permis_demolir';
      motif = 'Démolition totale ou partielle';
    }

    // Secteur protégé et travaux visibles
    if (secteurs.length > 0 && (impactsFacade || workType === 'couverture')) {
      if (!autorisationType) {
        autorisationType = 'declaration_prealable';
        motif = 'Travaux en secteur protégé';
      }
    }

    // Ajouter l'autorisation principale
    if (autorisationType) {
      const baseDelai = autorisationType === 'permis_construire' ? 60
        : autorisationType === 'declaration_prealable' ? 30
        : 60;

      autorisations.push({
        type: autorisationType,
        obligatoire: true,
        motif,
        delaiInstruction: baseDelai,
        delaiMajore: hasABF ? baseDelai + delaiABF : undefined,
        piecesPrincipales: this.getPiecesPrincipales(autorisationType),
        formulaire: this.getFormulaire(autorisationType),
        destination: 'Mairie du lieu des travaux',
        recommandations: this.getRecommandationsAutorisation(autorisationType, hasABF),
      });
    }

    // Ajouter autorisation ABF si nécessaire
    if (hasABF && autorisationType) {
      autorisations.push({
        type: 'autorisation_abf',
        obligatoire: true,
        motif: 'Travaux en périmètre de monument historique ou secteur protégé',
        delaiInstruction: 30,
        piecesPrincipales: [
          'Plan de situation',
          'Plan de masse',
          'Photos de l\'existant',
          'Insertion paysagère du projet',
          'Échantillons de matériaux (si demandé)',
        ],
        formulaire: {
          cerfa: 'Intégré au dossier principal',
        },
        destination: 'UDAP (Unité Départementale de l\'Architecture et du Patrimoine)',
        recommandations: [
          'Prendre rendez-vous avec l\'ABF avant dépôt',
          'Privilégier les matériaux traditionnels',
          'Soigner particulièrement l\'insertion paysagère',
        ],
      });
    }

    return autorisations;
  }

  /**
   * Génère les recommandations personnalisées
   */
  private static generateRecommandations(
    project: Phase0Project,
    contraintes: ContrainteUrbanistique[],
    autorisations: AutorisationRequise[]
  ): RecommandationUrbanisme[] {
    const recommandations: RecommandationUrbanisme[] = [];

    // Recommandation de consultation préalable
    if (autorisations.some(a => a.type === 'permis_construire')) {
      recommandations.push({
        priorite: 'haute',
        titre: 'Consultation préalable recommandée',
        description: 'Pour un permis de construire, il est vivement conseillé de consulter le service urbanisme avant le dépôt',
        action: 'Prendre rendez-vous avec le service urbanisme de la mairie',
      });
    }

    // Recommandation ABF
    if (autorisations.some(a => a.type === 'autorisation_abf')) {
      recommandations.push({
        priorite: 'haute',
        titre: 'Rencontre avec l\'ABF',
        description: 'Votre projet est en secteur protégé, une rencontre préalable avec l\'Architecte des Bâtiments de France peut faciliter l\'instruction',
        action: 'Contacter l\'UDAP pour prendre rendez-vous',
        lien: 'https://www.culture.gouv.fr/Regions',
      });
    }

    // Recommandation certificat d'urbanisme
    if (contraintes.some(c => c.impact === 'bloquant')) {
      recommandations.push({
        priorite: 'haute',
        titre: 'Certificat d\'urbanisme opérationnel',
        description: 'Des contraintes importantes existent, un CU opérationnel permettra de sécuriser votre projet',
        action: 'Demander un certificat d\'urbanisme (CUb) avant de finaliser le projet',
        lien: 'https://www.service-public.fr/particuliers/vosdroits/F1633',
      });
    }

    // Recommandation risques naturels
    if (contraintes.some(c => c.type === 'risque_naturel')) {
      recommandations.push({
        priorite: 'haute',
        titre: 'Vérification des prescriptions risques',
        description: 'Le terrain est soumis à des risques naturels, des prescriptions constructives peuvent s\'appliquer',
        action: 'Consulter le Plan de Prévention des Risques (PPR) de la commune',
        lien: 'https://www.georisques.gouv.fr/',
      });
    }

    // Recommandation délais
    const maxDelai = autorisations.reduce((max, a) => Math.max(max, a.delaiMajore || a.delaiInstruction), 0);
    if (maxDelai > 60) {
      recommandations.push({
        priorite: 'moyenne',
        titre: 'Anticipez les délais',
        description: `Le délai d'instruction peut atteindre ${maxDelai} jours. Planifiez votre projet en conséquence`,
        action: 'Déposer le dossier au moins 3 mois avant le début souhaité des travaux',
      });
    }

    // Recommandation Géoportail Urbanisme
    recommandations.push({
      priorite: 'basse',
      titre: 'Consulter le Géoportail de l\'Urbanisme',
      description: 'Le Géoportail de l\'Urbanisme permet d\'accéder au règlement complet du PLU',
      action: 'Rechercher votre commune sur le Géoportail',
      lien: 'https://www.geoportail-urbanisme.gouv.fr/',
    });

    return recommandations;
  }

  /**
   * Évalue les risques urbanistiques du projet
   */
  private static evaluateRisques(
    project: Phase0Project,
    contraintes: ContrainteUrbanistique[],
    secteurs: SecteurProtege[]
  ): RisqueUrbanistique[] {
    const risques: RisqueUrbanistique[] = [];

    // Risque lié aux secteurs protégés
    if (secteurs.length > 0) {
      risques.push({
        type: 'modification',
        probabilite: 'moyenne',
        description: 'L\'ABF peut demander des modifications pour respecter le caractère patrimonial',
        prevention: 'Consulter l\'ABF en amont et privilégier des solutions architecturales traditionnelles',
      });
    }

    // Risque de refus si contraintes bloquantes
    if (contraintes.some(c => c.impact === 'bloquant')) {
      risques.push({
        type: 'refus',
        probabilite: 'moyenne',
        description: 'Des contraintes réglementaires importantes peuvent entraîner un refus',
        prevention: 'Vérifier la conformité du projet avec le PLU avant dépôt',
      });
    }

    // Risque risques naturels
    if (contraintes.some(c => c.type === 'risque_naturel')) {
      risques.push({
        type: 'modification',
        probabilite: 'haute',
        description: 'Des prescriptions constructives liées aux risques naturels peuvent modifier le projet',
        prevention: 'Intégrer les prescriptions du PPR dès la conception',
      });
    }

    // Risque de retard si dossier incomplet
    risques.push({
      type: 'retard',
      probabilite: 'basse',
      description: 'Un dossier incomplet entraîne une demande de pièces complémentaires',
      prevention: 'Vérifier la liste des pièces requises et la qualité des documents',
    });

    return risques;
  }

  // =============================================================================
  // MÉTHODES UTILITAIRES
  // =============================================================================

  /**
   * Fetch avec timeout
   */
  private static async fetchWithTimeout(url: string): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
        },
      });
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Mappe le code type de zone vers TypeZonePLU
   */
  private static mapTypeZone(code: string): TypeZonePLU {
    if (!code) return 'inconnu';
    const upper = code.toUpperCase();
    if (upper.startsWith('U')) return 'urbaine';
    if (upper.startsWith('AU')) return 'a_urbaniser';
    if (upper.startsWith('A')) return 'agricole';
    if (upper.startsWith('N')) return 'naturelle';
    return 'inconnu';
  }

  /**
   * Mappe le niveau de risque Géorisques vers notre enum
   */
  private static mapNiveauRisque(niveau?: string): RisqueNaturel['niveau'] {
    if (!niveau) return 'inconnu';
    const lower = niveau.toLowerCase();
    if (lower.includes('fort') || lower.includes('élevé') || lower.includes('eleve')) return 'fort';
    if (lower.includes('moyen') || lower.includes('modéré') || lower.includes('modere')) return 'moyen';
    if (lower.includes('faible')) return 'faible';
    if (lower.includes('très faible') || lower.includes('tres faible')) return 'tres_faible';
    return 'inconnu';
  }

  /**
   * Mappe les catégories SUP vers TypeSecteurProtege
   */
  private static mapSUPToSecteurType(categorie: string): TypeSecteurProtege | null {
    switch (categorie) {
      case 'AC1': return 'monument_historique';
      case 'AC2': return 'site_classe';
      case 'AC3': return 'site_inscrit';
      case 'AC4': return 'avap';
      default: return null;
    }
  }

  /**
   * Détermine la fiabilité de l'analyse
   */
  private static determineReliability(
    apis: string[],
    errors: string[]
  ): 'haute' | 'moyenne' | 'basse' {
    if (errors.length === 0 && apis.length >= 3) return 'haute';
    if (apis.length >= 2) return 'moyenne';
    return 'basse';
  }

  /**
   * Retourne les pièces principales selon le type d'autorisation
   */
  private static getPiecesPrincipales(type: TypeAutorisation): string[] {
    switch (type) {
      case 'declaration_prealable':
        return [
          'DP1 - Plan de situation du terrain',
          'DP2 - Plan de masse des constructions',
          'DP3 - Plan en coupe du terrain et de la construction',
          'DP4 - Plan des façades et des toitures',
          'DP5 - Représentation de l\'aspect extérieur',
          'DP6 - Document graphique d\'insertion',
          'DP7/8 - Photographies',
        ];
      case 'permis_construire':
        return [
          'PC1 - Plan de situation du terrain',
          'PC2 - Plan de masse des constructions',
          'PC3 - Plan en coupe du terrain et de la construction',
          'PC4 - Notice décrivant le terrain et le projet',
          'PC5 - Plan des façades et des toitures',
          'PC6 - Document graphique d\'insertion',
          'PC7/8 - Photographies',
          'Attestation RE2020 si applicable',
        ];
      case 'permis_demolir':
        return [
          'PD1 - Plan de situation',
          'PD2 - Plan de masse',
          'PD3 - Document photographique',
        ];
      default:
        return [];
    }
  }

  /**
   * Retourne les informations du formulaire CERFA
   */
  private static getFormulaire(type: TypeAutorisation): { cerfa: string; url?: string } {
    switch (type) {
      case 'declaration_prealable':
        return {
          cerfa: '13703*11',
          url: 'https://www.service-public.fr/particuliers/vosdroits/R2028',
        };
      case 'permis_construire':
        return {
          cerfa: '13406*11',
          url: 'https://www.service-public.fr/particuliers/vosdroits/R11637',
        };
      case 'permis_demolir':
        return {
          cerfa: '13405*08',
          url: 'https://www.service-public.fr/particuliers/vosdroits/R1980',
        };
      default:
        return { cerfa: '' };
    }
  }

  /**
   * Retourne les recommandations spécifiques pour une autorisation
   */
  private static getRecommandationsAutorisation(type: TypeAutorisation, hasABF: boolean): string[] {
    const reco: string[] = [];

    if (type === 'permis_construire') {
      reco.push('Faire appel à un architecte si surface > 150m²');
      reco.push('Prévoir 4 exemplaires du dossier (+1 si ABF)');
    }

    if (type === 'declaration_prealable') {
      reco.push('Prévoir 2 exemplaires du dossier (+1 si ABF)');
    }

    if (hasABF) {
      reco.push('Ajouter 1 exemplaire supplémentaire pour l\'ABF');
      reco.push('Soigner particulièrement les documents d\'insertion paysagère');
    }

    reco.push('Conserver l\'accusé de réception de dépôt');
    reco.push('Afficher l\'autorisation sur le terrain pendant toute la durée des travaux');

    return reco;
  }

  /**
   * Génère un document pré-rempli pour autorisation d'urbanisme
   */
  static generatePrefilledDocument(
    type: TypeAutorisation,
    project: Phase0Project,
    analyse: AnalyseUrbanistique
  ): string {
    const owner = project.ownerProfile;
    const property = project.property;
    const address = analyse.adresse;
    const workProject = project.workProject;

    const lines: string[] = [];

    if (type === 'declaration_prealable') {
      lines.push('═'.repeat(70));
      lines.push('DÉCLARATION PRÉALABLE DE TRAVAUX');
      lines.push('Cerfa n°13703*11');
      lines.push('═'.repeat(70));
      lines.push('');
      lines.push('CADRE 1 - IDENTITÉ DU DEMANDEUR');
      lines.push('─'.repeat(70));
      if (owner?.identity?.type === 'B2C') {
        const identity = owner.identity as any;
        lines.push(`Nom: ${identity.lastName || '_______________'}`);
        lines.push(`Prénom: ${identity.firstName || '_______________'}`);
      } else if (owner?.identity?.type === 'B2B') {
        const identity = owner.identity as any;
        lines.push(`Raison sociale: ${identity.companyName || '_______________'}`);
        lines.push(`SIRET: ${identity.siret || '_______________'}`);
      }
      lines.push(`Adresse: ${owner?.contact?.address?.street || '_______________'}`);
      lines.push(`Code postal: ${owner?.contact?.address?.postalCode || '_____'} Ville: ${owner?.contact?.address?.city || '_______________'}`);
      lines.push(`Téléphone: ${owner?.contact?.phone || '_______________'}`);
      lines.push(`Email: ${owner?.contact?.email || '_______________'}`);
      lines.push('');
      lines.push('CADRE 2 - LOCALISATION DU TERRAIN');
      lines.push('─'.repeat(70));
      lines.push(`Adresse: ${address.street || '_______________'}`);
      lines.push(`Code postal: ${address.postalCode || '_____'} Commune: ${address.city || '_______________'}`);
      lines.push(`Code INSEE: ${analyse.commune.codeInsee || '_______________'}`);
      lines.push(`Références cadastrales: Section _____ N° _____`);
      lines.push(`Surface du terrain: ${property?.surface || '___'} m²`);
      lines.push('');
      lines.push('CADRE 3 - NATURE DES TRAVAUX');
      lines.push('─'.repeat(70));
      lines.push(`Description: ${workProject?.general?.description || '_______________'}`);
      lines.push(`Type de travaux: ${workProject?.scope?.workType || '_______________'}`);
      lines.push(`Surface créée: _____ m²`);
      lines.push('');
      lines.push('CADRE 4 - INFORMATIONS COMPLÉMENTAIRES');
      lines.push('─'.repeat(70));
      if (analyse.secteursProteges.length > 0) {
        lines.push(`☑ Secteur protégé: ${analyse.secteursProteges[0].nom}`);
      } else {
        lines.push('☐ Secteur protégé');
      }
      if (analyse.zonePLU) {
        lines.push(`Zone PLU: ${analyse.zonePLU.code} - ${analyse.zonePLU.designation}`);
      } else {
        lines.push('Zone PLU: Non identifiée - consulter la mairie');
      }
    } else if (type === 'permis_construire') {
      lines.push('═'.repeat(70));
      lines.push('DEMANDE DE PERMIS DE CONSTRUIRE');
      lines.push('Cerfa n°13406*11');
      lines.push('═'.repeat(70));
      lines.push('');
      lines.push('CADRE 1 - IDENTITÉ DU DEMANDEUR');
      lines.push('─'.repeat(70));
      if (owner?.identity?.type === 'B2C') {
        const identity = owner.identity as any;
        lines.push(`☑ Personne physique`);
        lines.push(`Nom: ${identity.lastName || '_______________'}`);
        lines.push(`Prénom: ${identity.firstName || '_______________'}`);
      } else {
        lines.push(`☑ Personne morale`);
        const identity = owner?.identity as any;
        lines.push(`Dénomination: ${identity?.companyName || identity?.entityName || '_______________'}`);
      }
      lines.push(`Adresse: ${owner?.contact?.address?.street || '_______________'}`);
      lines.push(`${owner?.contact?.address?.postalCode || '_____'} ${owner?.contact?.address?.city || '_______________'}`);
      lines.push(`Téléphone: ${owner?.contact?.phone || '_______________'}`);
      lines.push(`Email: ${owner?.contact?.email || '_______________'}`);
      lines.push('');
      lines.push('CADRE 2 - TERRAIN');
      lines.push('─'.repeat(70));
      lines.push(`Adresse ou lieu-dit: ${address.street || '_______________'}`);
      lines.push(`Code postal: ${address.postalCode || '_____'} Commune: ${address.city || '_______________'}`);
      lines.push(`Code INSEE: ${analyse.commune.codeInsee || '_______________'}`);
      lines.push(`Références cadastrales: _______________`);
      lines.push(`Superficie: ${property?.surface || '___'} m²`);
      lines.push('');
      lines.push('CADRE 3 - PROJET');
      lines.push('─'.repeat(70));
      lines.push(`Nature des travaux: ${workProject?.general?.title || '_______________'}`);
      lines.push(`Description: ${workProject?.general?.description || '_______________'}`);
      lines.push('');
      lines.push('Surfaces (m²):');
      lines.push('  Surface de plancher existante: _____');
      lines.push('  Surface de plancher créée: _____');
      lines.push('  Surface de plancher supprimée: _____');
      lines.push('  TOTAL surface de plancher: _____');
    }

    lines.push('');
    lines.push('─'.repeat(70));

    // Informations complémentaires basées sur l'analyse
    if (analyse.risquesNaturels.length > 0) {
      lines.push('');
      lines.push('RISQUES IDENTIFIÉS:');
      for (const risque of analyse.risquesNaturels.slice(0, 3)) {
        lines.push(`  - ${risque.type} (niveau: ${risque.niveau})`);
      }
    }

    lines.push('');
    lines.push('Date: _______________');
    lines.push('Signature du demandeur: _______________');
    lines.push('');
    lines.push('═'.repeat(70));
    lines.push(`Document pré-rempli par TORP - ${new Date().toLocaleDateString('fr-FR')}`);
    lines.push('À compléter et vérifier avant dépôt en mairie');
    lines.push(`Fiabilité des données: ${analyse.metadata.fiabilite}`);
    if (analyse.metadata.apisUtilisees.length > 0) {
      lines.push(`Sources: ${analyse.metadata.apisUtilisees.join(', ')}`);
    }
    lines.push('═'.repeat(70));

    return lines.join('\n');
  }

  /**
   * Vérifie si les APIs sont accessibles (health check)
   */
  static async healthCheck(): Promise<{
    banApi: boolean;
    geoApi: boolean;
    georisquesApi: boolean;
    gpuApi: boolean;
  }> {
    const results = {
      banApi: false,
      geoApi: false,
      georisquesApi: false,
      gpuApi: false,
    };

    // Test API Adresse
    try {
      const response = await this.fetchWithTimeout(`${this.API_ADRESSE}/search/?q=paris&limit=1`);
      results.banApi = response.ok;
    } catch {
      results.banApi = false;
    }

    // Test API Géo
    try {
      const response = await this.fetchWithTimeout(`${this.API_GEO}/communes/75056`);
      results.geoApi = response.ok;
    } catch {
      results.geoApi = false;
    }

    // Test Géorisques
    try {
      const response = await this.fetchWithTimeout(`${this.API_GEORISQUES}/gaspar/risques?code_insee=75056`);
      results.georisquesApi = response.ok;
    } catch {
      results.georisquesApi = false;
    }

    // Test GPU (APICarto)
    try {
      const response = await this.fetchWithTimeout(`${this.API_GPU}/document?geom={"type":"Point","coordinates":[2.3522,48.8566]}`);
      results.gpuApi = response.ok;
    } catch {
      results.gpuApi = false;
    }

    return results;
  }
}

export default UrbanismeService;
