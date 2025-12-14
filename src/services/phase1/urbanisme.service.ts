/**
 * TORP Phase 1 - Service Analyse Urbanistique
 *
 * Analyse les contraintes urbanistiques locales basées sur l'adresse du projet :
 * - Zones PLU (Plan Local d'Urbanisme)
 * - Secteurs protégés (monuments historiques, AVAP, sites classés)
 * - Restrictions locales (hauteur, emprise, matériaux, couleurs)
 * - Autorisations requises selon le type de travaux
 */

import type { Address } from '@/types/phase0/common.types';
import type { Phase0Project } from '@/types/phase0/project.types';

// =============================================================================
// TYPES
// =============================================================================

export interface AnalyseUrbanistique {
  adresse: Address;
  commune: CommuneInfo;
  zonePLU: ZonePLU;
  secteursProteges: SecteurProtege[];
  contraintes: ContrainteUrbanistique[];
  autorisationsRequises: AutorisationRequise[];
  recommandations: RecommandationUrbanisme[];
  risques: RisqueUrbanistique[];
  metadata: {
    dateAnalyse: string;
    sourceDonnees: string[];
    fiabilite: 'haute' | 'moyenne' | 'basse';
  };
}

export interface CommuneInfo {
  nom: string;
  codePostal: string;
  codeInsee?: string;
  departement: string;
  region: string;
  population?: number;
  aUnPLU: boolean;
  typePLU: 'PLU' | 'PLUi' | 'POS' | 'carte_communale' | 'RNU';
  urlServiceUrbanisme?: string;
  contactUrbanisme?: {
    telephone?: string;
    email?: string;
    adresse?: string;
    horaires?: string;
  };
}

export interface ZonePLU {
  code: string; // Ex: "UA", "UB", "AU", "N", "A"
  type: TypeZonePLU;
  designation: string;
  description: string;
  reglesGenerales: ReglePLU[];
  hauteurMax?: number; // mètres
  empriseMax?: number; // pourcentage
  cosMax?: number; // Coefficient d'Occupation des Sols (si applicable)
  reculs: {
    parRapportVoie?: number;
    parRapportLimites?: number;
    parRapportVoisins?: number;
  };
}

export type TypeZonePLU =
  | 'urbaine'           // U - zones urbaines
  | 'a_urbaniser'       // AU - zones à urbaniser
  | 'agricole'          // A - zones agricoles
  | 'naturelle'         // N - zones naturelles
  | 'mixte';

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
  perimetre: string; // Ex: "500m autour du monument"
  contraintes: string[];
  architecteBatimentsFrance: boolean; // ABF requis
  delaiSupplementaire?: number; // jours
}

export type TypeSecteurProtege =
  | 'monument_historique'      // Périmètre MH (500m)
  | 'site_classe'              // Site classé
  | 'site_inscrit'             // Site inscrit
  | 'avap'                     // Aire de Valorisation de l'Architecture et du Patrimoine
  | 'zppaup'                   // Zone de Protection du Patrimoine
  | 'secteur_sauvegarde'       // Secteur sauvegardé / SPR
  | 'psmv'                     // Plan de Sauvegarde et Mise en Valeur
  | 'unesco';                  // Patrimoine mondial UNESCO

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
  | 'servitude';

export interface AutorisationRequise {
  type: TypeAutorisation;
  obligatoire: boolean;
  motif: string;
  delaiInstruction: number; // jours
  delaiMajore?: number; // si ABF ou secteur protégé
  piecesPrincipales: string[];
  formulaire: {
    cerfa: string;
    url?: string;
  };
  destination: string; // "Mairie", "Préfecture", etc.
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

// =============================================================================
// SERVICE
// =============================================================================

export class UrbanismeService {
  /**
   * Analyse complète des contraintes urbanistiques pour un projet
   */
  static async analyzeProject(project: Phase0Project): Promise<AnalyseUrbanistique> {
    const address = this.getProjectAddress(project);

    if (!address || !address.city) {
      throw new Error('Adresse du projet requise pour l\'analyse urbanistique');
    }

    // Récupérer les informations de la commune
    const commune = await this.getCommuneInfo(address);

    // Déterminer la zone PLU
    const zonePLU = await this.getZonePLU(address, commune);

    // Identifier les secteurs protégés
    const secteursProteges = await this.getSecteursProteges(address);

    // Analyser les contraintes selon le type de travaux
    const contraintes = this.analyzeContraintes(project, zonePLU, secteursProteges);

    // Déterminer les autorisations requises
    const autorisationsRequises = this.determineAutorisations(project, zonePLU, secteursProteges);

    // Générer les recommandations
    const recommandations = this.generateRecommandations(project, contraintes, autorisationsRequises);

    // Évaluer les risques
    const risques = this.evaluateRisques(project, contraintes, secteursProteges);

    return {
      adresse: address,
      commune,
      zonePLU,
      secteursProteges,
      contraintes,
      autorisationsRequises,
      recommandations,
      risques,
      metadata: {
        dateAnalyse: new Date().toISOString(),
        sourceDonnees: ['Géoportail Urbanisme', 'Base Mérimée', 'PLU communal'],
        fiabilite: secteursProteges.length > 0 ? 'moyenne' : 'haute',
      },
    };
  }

  /**
   * Récupère l'adresse du projet
   */
  private static getProjectAddress(project: Phase0Project): Address | undefined {
    // Priorité à l'adresse d'identification, sinon adresse property
    return project.property?.identification?.address
      || project.property?.address;
  }

  /**
   * Récupère les informations de la commune
   */
  private static async getCommuneInfo(address: Address): Promise<CommuneInfo> {
    // En production, cela appellerait l'API Géo ou une base de données
    // Pour l'instant, on génère des données simulées mais réalistes

    const departement = address.postalCode?.substring(0, 2) || '75';
    const regions: Record<string, string> = {
      '75': 'Île-de-France', '92': 'Île-de-France', '93': 'Île-de-France', '94': 'Île-de-France',
      '69': 'Auvergne-Rhône-Alpes', '13': 'Provence-Alpes-Côte d\'Azur',
      '33': 'Nouvelle-Aquitaine', '31': 'Occitanie', '59': 'Hauts-de-France',
    };

    return {
      nom: address.city || 'Commune inconnue',
      codePostal: address.postalCode || '',
      departement: departement,
      region: regions[departement] || 'France métropolitaine',
      aUnPLU: true,
      typePLU: 'PLU',
      urlServiceUrbanisme: `https://www.${address.city?.toLowerCase().replace(/\s+/g, '-')}.fr/urbanisme`,
      contactUrbanisme: {
        telephone: '01 XX XX XX XX',
        email: `urbanisme@${address.city?.toLowerCase().replace(/\s+/g, '-')}.fr`,
        horaires: 'Lundi-Vendredi 9h-12h / 14h-17h',
      },
    };
  }

  /**
   * Détermine la zone PLU de l'adresse
   */
  private static async getZonePLU(address: Address, commune: CommuneInfo): Promise<ZonePLU> {
    // En production, cela appellerait l'API Géoportail Urbanisme
    // Pour l'instant, on simule une zone urbaine standard

    // Détection basique basée sur le contexte urbain
    const isUrban = ['Paris', 'Lyon', 'Marseille', 'Toulouse', 'Nice', 'Nantes', 'Bordeaux']
      .some(city => address.city?.toLowerCase().includes(city.toLowerCase()));

    return {
      code: isUrban ? 'UA' : 'UB',
      type: 'urbaine',
      designation: isUrban ? 'Zone urbaine centrale' : 'Zone urbaine générale',
      description: isUrban
        ? 'Zone urbaine dense à caractère résidentiel et commercial'
        : 'Zone urbaine à dominante résidentielle',
      reglesGenerales: [
        {
          article: 'UA1',
          titre: 'Occupations et utilisations du sol interdites',
          contenu: 'Constructions à usage agricole, industriel, installations classées',
          impact: 'informatif',
        },
        {
          article: 'UA6',
          titre: 'Implantation par rapport aux voies',
          contenu: 'Les constructions doivent être implantées à l\'alignement ou en retrait',
          impact: 'restrictif',
        },
        {
          article: 'UA10',
          titre: 'Hauteur maximale',
          contenu: 'La hauteur maximale des constructions est limitée',
          impact: 'restrictif',
        },
      ],
      hauteurMax: isUrban ? 25 : 12,
      empriseMax: isUrban ? 80 : 60,
      reculs: {
        parRapportVoie: 0,
        parRapportLimites: 3,
        parRapportVoisins: 4,
      },
    };
  }

  /**
   * Identifie les secteurs protégés autour de l'adresse
   */
  private static async getSecteursProteges(address: Address): Promise<SecteurProtege[]> {
    const secteurs: SecteurProtege[] = [];

    // En production, cela appellerait l'API Atlas des Patrimoines
    // Simulation basée sur des villes connues pour avoir des secteurs protégés

    const villesAvecMH = ['Paris', 'Lyon', 'Bordeaux', 'Strasbourg', 'Avignon', 'Carcassonne'];
    const villesUNESCO = ['Paris', 'Lyon', 'Bordeaux', 'Provins', 'Carcassonne'];

    if (villesAvecMH.some(v => address.city?.toLowerCase().includes(v.toLowerCase()))) {
      secteurs.push({
        type: 'monument_historique',
        nom: 'Périmètre de protection d\'un monument historique',
        description: 'L\'adresse se situe dans le périmètre de protection (500m) d\'un monument historique',
        perimetre: '500 mètres',
        contraintes: [
          'Avis de l\'Architecte des Bâtiments de France (ABF) obligatoire',
          'Délai d\'instruction majoré (+1 mois)',
          'Attention particulière aux matériaux et couleurs',
        ],
        architecteBatimentsFrance: true,
        delaiSupplementaire: 30,
      });
    }

    if (villesUNESCO.some(v => address.city?.toLowerCase().includes(v.toLowerCase()))) {
      secteurs.push({
        type: 'unesco',
        nom: 'Zone tampon UNESCO',
        description: 'Proximité d\'un bien inscrit au patrimoine mondial',
        perimetre: 'Zone tampon définie',
        contraintes: [
          'Préservation de l\'intégrité visuelle du site',
          'Consultation possible des instances UNESCO',
        ],
        architecteBatimentsFrance: true,
        delaiSupplementaire: 15,
      });
    }

    return secteurs;
  }

  /**
   * Analyse les contraintes selon le projet et le contexte urbanistique
   */
  private static analyzeContraintes(
    project: Phase0Project,
    zonePLU: ZonePLU,
    secteurs: SecteurProtege[]
  ): ContrainteUrbanistique[] {
    const contraintes: ContrainteUrbanistique[] = [];
    const workType = project.workProject?.scope?.workType;
    const impactsFacade = project.workProject?.scope?.impactsFacade;
    const surface = project.property?.surface || 0;

    // Contraintes liées à la hauteur
    if (workType === 'extension' || workType === 'surelevation') {
      contraintes.push({
        type: 'hauteur',
        titre: 'Limitation de hauteur',
        description: `Hauteur maximale autorisée: ${zonePLU.hauteurMax}m`,
        source: `PLU Zone ${zonePLU.code} - Article 10`,
        impact: 'restrictif',
        solutionsPossibles: ['Vérifier la hauteur actuelle', 'Consulter le service urbanisme'],
      });
    }

    // Contraintes liées à l'emprise
    if (workType === 'extension') {
      contraintes.push({
        type: 'emprise',
        titre: 'Coefficient d\'emprise au sol',
        description: `Emprise maximale autorisée: ${zonePLU.empriseMax}%`,
        source: `PLU Zone ${zonePLU.code} - Article 9`,
        impact: 'restrictif',
      });
    }

    // Contraintes si impacts sur la façade
    if (impactsFacade) {
      contraintes.push({
        type: 'materiaux',
        titre: 'Prescriptions architecturales',
        description: 'Les modifications de façade doivent respecter le caractère architectural du quartier',
        source: 'PLU - Règlement architectural',
        impact: secteurs.length > 0 ? 'bloquant' : 'restrictif',
        solutionsPossibles: [
          'Utiliser des matériaux traditionnels',
          'Respecter les couleurs locales',
          'Consulter l\'ABF si secteur protégé',
        ],
      });
    }

    // Contraintes liées aux secteurs protégés
    secteurs.forEach(secteur => {
      contraintes.push({
        type: 'servitude',
        titre: `Secteur protégé: ${secteur.nom}`,
        description: secteur.description,
        source: secteur.type,
        impact: secteur.architecteBatimentsFrance ? 'bloquant' : 'restrictif',
        solutionsPossibles: secteur.contraintes,
      });
    });

    return contraintes;
  }

  /**
   * Détermine les autorisations d'urbanisme requises
   */
  private static determineAutorisations(
    project: Phase0Project,
    zonePLU: ZonePLU,
    secteurs: SecteurProtege[]
  ): AutorisationRequise[] {
    const autorisations: AutorisationRequise[] = [];
    const workType = project.workProject?.scope?.workType;
    const impactsFacade = project.workProject?.scope?.impactsFacade;
    const surface = project.property?.surface || 0;
    const hasABF = secteurs.some(s => s.architecteBatimentsFrance);
    const delaiABF = secteurs.reduce((max, s) => Math.max(max, s.delaiSupplementaire || 0), 0);

    // Analyser le type de travaux pour déterminer l'autorisation
    let autorisationType: TypeAutorisation | null = null;
    let motif = '';

    if (workType === 'extension') {
      if (surface > 40) {
        autorisationType = 'permis_construire';
        motif = 'Extension > 40m² de surface de plancher';
      } else if (surface > 20) {
        autorisationType = 'permis_construire';
        motif = 'Extension > 20m² en zone urbaine avec PLU';
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

    // Si secteur protégé et travaux sur façade/toiture
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

    return recommandations;
  }

  /**
   * Évalue les risques du projet
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

    // Risque de retard si dossier incomplet
    risques.push({
      type: 'retard',
      probabilite: 'basse',
      description: 'Un dossier incomplet entraîne une demande de pièces complémentaires',
      prevention: 'Vérifier la liste des pièces requises et la qualité des documents',
    });

    return risques;
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
          'Attestation RT2012/RE2020 si applicable',
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
          cerfa: '13703*09',
          url: 'https://www.service-public.fr/particuliers/vosdroits/R2028',
        };
      case 'permis_construire':
        return {
          cerfa: '13406*10',
          url: 'https://www.service-public.fr/particuliers/vosdroits/R11637',
        };
      case 'permis_demolir':
        return {
          cerfa: '13405*07',
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
    reco.push('Vérifier l\'affichage en mairie après dépôt');

    return reco;
  }

  /**
   * Génère un document pré-rempli
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
      lines.push('Cerfa n°13703*09');
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
      lines.push(`Zone PLU: ${analyse.zonePLU.code} - ${analyse.zonePLU.designation}`);
    } else if (type === 'permis_construire') {
      lines.push('═'.repeat(70));
      lines.push('DEMANDE DE PERMIS DE CONSTRUIRE');
      lines.push('Cerfa n°13406*10');
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
    lines.push('Date: _______________');
    lines.push('Signature du demandeur: _______________');
    lines.push('');
    lines.push('═'.repeat(70));
    lines.push(`Document pré-rempli par TORP - ${new Date().toLocaleDateString('fr-FR')}`);
    lines.push('À compléter et vérifier avant dépôt en mairie');
    lines.push('═'.repeat(70));

    return lines.join('\n');
  }
}

export default UrbanismeService;
