/**
 * TORP Phase 1 - Types Entreprise
 * Module 1.2 : Recherche et Qualification des Entreprises
 *
 * Structure complète pour le sourcing, la qualification et le scoring
 * des entreprises de travaux
 */

import type { Address, EstimationRange } from '../phase0/common.types';

// =============================================================================
// ENTREPRISE PRINCIPALE
// =============================================================================

export interface Entreprise {
  id: string;

  // Identification
  identification: EntrepriseIdentification;

  // Contact
  contact: EntrepriseContact;

  // Qualifications
  qualifications: EntrepriseQualification[];

  // Assurances
  assurances: EntrepriseAssurance[];

  // Références
  references: EntrepriseReference[];

  // Capacités
  capacites: EntrepriseCapacites;

  // Réputation
  reputation: EntrepriseReputation;

  // Scoring TORP
  scoreTORP?: ScoreEntreprise;

  // Métadonnées
  metadata: EntrepriseMetadata;
}

export interface EntrepriseIdentification {
  raisonSociale: string;
  formeJuridique: FormeJuridique;
  siret: string;
  siren?: string;
  codeAPE?: string;
  numeroTVA?: string;
  dateCreation?: string;
  capital?: number;

  // Adresse siège
  adresse: Address;

  // Logo
  logoUrl?: string;
}

export type FormeJuridique =
  | 'ei'              // Entreprise Individuelle
  | 'eurl'            // EURL
  | 'sarl'            // SARL
  | 'sas'             // SAS
  | 'sa'              // SA
  | 'sasu'            // SASU
  | 'snc'             // SNC
  | 'scea'            // SCEA
  | 'autre';

export interface EntrepriseContact {
  // Contact principal
  nomContact: string;
  fonction: string;
  email: string;
  telephone: string;
  telephoneMobile?: string;

  // Site web et réseaux
  siteWeb?: string;
  linkedin?: string;
  facebook?: string;

  // Contacts secondaires
  contactsSecondaires?: ContactSecondaire[];
}

export interface ContactSecondaire {
  nom: string;
  fonction: string;
  email?: string;
  telephone?: string;
  role: 'commercial' | 'technique' | 'administratif' | 'direction';
}

// =============================================================================
// QUALIFICATIONS
// =============================================================================

export interface EntrepriseQualification {
  id: string;
  type: TypeQualification;
  organisme: string;
  designation: string;
  numero?: string;

  // Détails
  niveau?: NiveauQualibat;
  domaine?: DomaineQualibat;
  specialite?: string;

  // Validité
  dateObtention: string;
  dateExpiration: string;
  enCours: boolean;

  // Vérification
  verifie: boolean;
  dateVerification?: string;
  urlVerification?: string;
}

export type TypeQualification =
  | 'qualibat'
  | 'rge'
  | 'qualifelec'
  | 'qualipac'
  | 'qualisol'
  | 'qualipv'
  | 'qualibois'
  | 'qualigaz'
  | 'certification_iso'
  | 'label_artisan'
  | 'autre';

export type NiveauQualibat =
  | 'technicite_courante'    // Traditionnel
  | 'technicite_confirmee'   // Confirmé
  | 'technicite_superieure'  // Supérieur
  | 'technicite_exceptionnelle'; // Exceptionnel

export type DomaineQualibat =
  | '1000' // Terrassement, VRD
  | '2000' // Gros œuvre
  | '3000' // Étanchéité, couverture, charpente
  | '4000' // Génie climatique
  | '5000' // Électricité
  | '6000' // Finitions
  | '7000' // Aménagements
  | '8000'; // Travaux publics

// Correspondance domaines Qualibat
export const DOMAINES_QUALIBAT: Record<DomaineQualibat, string> = {
  '1000': 'Terrassement, VRD',
  '2000': 'Gros œuvre',
  '3000': 'Étanchéité, couverture, charpente',
  '4000': 'Génie climatique',
  '5000': 'Électricité',
  '6000': 'Finitions',
  '7000': 'Aménagements',
  '8000': 'Travaux publics',
};

// Types RGE
export type TypeRGE =
  | 'audit_energetique'
  | 'isolation_thermique_parois_opaques'
  | 'isolation_thermique_parois_vitrees'
  | 'chauffage_bois'
  | 'pompes_a_chaleur'
  | 'chauffe_eau_solaire'
  | 'chauffe_eau_thermodynamique'
  | 'photovoltaique'
  | 'ventilation'
  | 'forage_geothermique';

// =============================================================================
// ASSURANCES
// =============================================================================

export interface EntrepriseAssurance {
  id: string;
  type: TypeAssurance;
  compagnie: string;
  numeroContrat: string;

  // Couverture
  montantGaranti: number;
  activitesCouvertes: string[];

  // Validité
  dateDebut: string;
  dateFin: string;
  enCours: boolean;

  // Document
  attestationUrl?: string;
  dateAttestation?: string;

  // Vérification
  verifie: boolean;
  dateVerification?: string;
}

export type TypeAssurance =
  | 'rc_decennale'
  | 'rc_professionnelle'
  | 'garantie_biennale'
  | 'parfait_achevement'
  | 'dommage_ouvrage'
  | 'tous_risques_chantier';

// =============================================================================
// RÉFÉRENCES
// =============================================================================

export interface EntrepriseReference {
  id: string;

  // Client
  client: {
    nom: string;
    type: 'particulier' | 'entreprise' | 'collectivite';
    contact?: {
      nom: string;
      telephone?: string;
      email?: string;
    };
    temoignageAutorise: boolean;
  };

  // Projet
  projet: {
    titre: string;
    description: string;
    adresse?: Partial<Address>;
    type: TypeProjetReference;
    surface?: number;
    lotsRealises: string[];
  };

  // Données chiffrées
  montantHT: number;
  dateDebut: string;
  dateFin: string;
  delaiReel: number; // jours
  delaiPrevu: number; // jours

  // Qualité
  noteClient?: number; // 1-5
  reservesLevees: boolean;
  litiges: boolean;

  // Médias
  photosAvant?: string[];
  photosApres?: string[];
  attestationUrl?: string;

  // Vérification
  verifie: boolean;
  dateVerification?: string;
  commentaireVerification?: string;
}

export type TypeProjetReference =
  | 'construction_neuve'
  | 'extension'
  | 'renovation_complete'
  | 'renovation_partielle'
  | 'renovation_energetique'
  | 'mise_aux_normes'
  | 'entretien'
  | 'autre';

// =============================================================================
// CAPACITÉS
// =============================================================================

export interface EntrepriseCapacites {
  // Financières
  financieres: {
    chiffreAffaires?: number;
    anneeCA?: number;
    evolutionCA?: number; // % sur 3 ans
    resultatNet?: number;
    tresorerieNette?: number;
    scoreBanqueFrance?: string;
    procedureCollective: boolean;
    typeProcedure?: 'sauvegarde' | 'redressement' | 'liquidation';
  };

  // Humaines
  humaines: {
    effectifTotal: number;
    effectifProductif: number;
    effectifAdministratif: number;
    effectifEncadrement: number;
    tauxTurnover?: number;
    formationAnnuelle?: boolean;
  };

  // Techniques
  techniques: {
    corpsMetier: CorpsMetier[];
    outillage: string[];
    enginsPropriete: string[];
    enginsLocation: string[];
    capaciteChantierSimultane: number;
  };

  // Géographiques
  geographiques: {
    rayonIntervention: number; // km
    departementsIntervention: string[];
    regionsIntervention: string[];
  };
}

export type CorpsMetier =
  | 'demolition'
  | 'terrassement'
  | 'maconnerie'
  | 'beton'
  | 'charpente'
  | 'couverture'
  | 'etancheite'
  | 'menuiserie_exterieure'
  | 'menuiserie_interieure'
  | 'metallerie'
  | 'electricite'
  | 'plomberie'
  | 'chauffage'
  | 'climatisation'
  | 'ventilation'
  | 'isolation'
  | 'platrerie'
  | 'carrelage'
  | 'parquet'
  | 'peinture'
  | 'facade'
  | 'espaces_verts'
  | 'vrd'
  | 'domotique'
  | 'autre';

// =============================================================================
// RÉPUTATION
// =============================================================================

export interface EntrepriseReputation {
  // Avis en ligne
  avisGoogle?: AvisEnLigne;
  avisPagesJaunes?: AvisEnLigne;
  avisTrustpilot?: AvisEnLigne;
  avisFacebook?: AvisEnLigne;

  // Note globale TORP
  noteGlobaleTORP?: number;

  // Historique TORP
  historiqueTORP?: {
    chantiersRealises: number;
    notesMoyennes: number;
    tauxLitiges: number;
    tauxRecommandation: number;
  };

  // Signalements
  signalements?: Signalement[];

  // Litiges connus
  litigesConnus?: LitigeConnu[];
}

export interface AvisEnLigne {
  plateforme: string;
  note: number; // Sur 5
  nombreAvis: number;
  urlPage?: string;
  dateRecuperation: string;
}

export interface Signalement {
  id: string;
  date: string;
  type: 'retard' | 'malfacon' | 'abandon' | 'litige' | 'non_paiement' | 'autre';
  description: string;
  resolu: boolean;
  dateResolution?: string;
  source: string;
}

export interface LitigeConnu {
  id: string;
  date: string;
  nature: string;
  montant?: number;
  statut: 'en_cours' | 'resolu' | 'cloture';
  commentaire?: string;
}

// =============================================================================
// SCORING TORP
// =============================================================================

export interface ScoreEntreprise {
  // Score global
  scoreGlobal: number; // 0-100

  // Scores par critère
  scoreParCritere: ScoreCritere[];

  // Recommandation
  recommandation: RecommandationEntreprise;

  // Date de calcul
  dateCalcul: string;

  // Paramètres utilisés
  parametresCalcul: ParametresScoring;
}

export interface ScoreCritere {
  critere: CritereScoring;
  poids: number; // %
  pointsMax: number;
  pointsObtenus: number;
  details?: string;
}

export type CritereScoring =
  | 'qualification_rge'
  | 'niveau_qualibat'
  | 'assurances_jour'
  | 'references_similaires'
  | 'chiffre_affaires'
  | 'proximite'
  | 'avis_clients'
  | 'disponibilite'
  | 'reactivite'
  | 'prix_competitif';

// Pondérations par défaut pour le scoring
export const PONDERATIONS_SCORING_DEFAUT: Record<CritereScoring, { poids: number; pointsMax: number }> = {
  qualification_rge: { poids: 15, pointsMax: 15 },
  niveau_qualibat: { poids: 10, pointsMax: 10 },
  assurances_jour: { poids: 10, pointsMax: 10 },
  references_similaires: { poids: 15, pointsMax: 15 },
  chiffre_affaires: { poids: 5, pointsMax: 5 },
  proximite: { poids: 10, pointsMax: 10 },
  avis_clients: { poids: 15, pointsMax: 15 },
  disponibilite: { poids: 10, pointsMax: 10 },
  reactivite: { poids: 5, pointsMax: 5 },
  prix_competitif: { poids: 5, pointsMax: 5 },
};

export type RecommandationEntreprise =
  | 'fortement_recommande' // Score >= 80
  | 'recommande'           // Score 60-79
  | 'a_etudier'            // Score < 60
  | 'non_recommande';      // Critères éliminatoires non remplis

// Seuils de recommandation
export const SEUILS_RECOMMANDATION = {
  fortement_recommande: 80,
  recommande: 60,
  a_etudier: 0,
};

export interface ParametresScoring {
  // Projet spécifique
  projetId: string;
  localisation: Address;
  typeTravaux: string[];
  budgetEstime: EstimationRange;
  urgence: 'normale' | 'urgente' | 'tres_urgente';
  exigenceRGE: boolean;

  // Pondérations personnalisées
  ponderations?: Partial<Record<CritereScoring, number>>;
}

// =============================================================================
// RECHERCHE ENTREPRISES
// =============================================================================

export interface CriteresRechercheEntreprise {
  // Localisation
  localisation: {
    adresse: Address;
    rayonKm: number;
  };

  // Corps de métier
  corpsMetier: CorpsMetier[];

  // Budget
  budgetProjet?: EstimationRange;

  // Qualifications
  qualificationsRequises?: TypeQualification[];
  rgeObligatoire?: boolean;

  // Filtres
  filtres?: {
    noteMinimale?: number;
    caMinimum?: number;
    effectifMinimum?: number;
    ancienneteMinimum?: number;
    assurancesAJour?: boolean;
    disponibiliteSous?: number; // jours
  };

  // Tri
  tri?: {
    critere: 'score' | 'distance' | 'note' | 'prix';
    ordre: 'asc' | 'desc';
  };

  // Pagination
  page?: number;
  parPage?: number;
}

export interface ResultatRechercheEntreprise {
  entreprises: Entreprise[];
  total: number;
  page: number;
  parPage: number;
  criteresUtilises: CriteresRechercheEntreprise;
  tempsRecherche: number; // ms
}

// =============================================================================
// MÉTADONNÉES
// =============================================================================

export interface EntrepriseMetadata {
  // Source
  source: SourceEntreprise;
  dateCreation: string;
  dateModification: string;

  // Vérification
  verifiee: boolean;
  dateVerification?: string;
  niveauVerification: NiveauVerification;

  // Mise à jour
  derniereMAJ: string;
  frequenceMAJ?: string;

  // Statut
  actif: boolean;
  raisonInactif?: string;
}

export type SourceEntreprise =
  | 'inscription_directe'
  | 'import_qualibat'
  | 'import_rge'
  | 'scraping_web'
  | 'partenaire'
  | 'manuel';

export type NiveauVerification =
  | 'non_verifie'
  | 'verification_basique'     // Kbis vérifié
  | 'verification_standard'    // Kbis + assurances
  | 'verification_complete';   // Kbis + assurances + qualifications + références

// =============================================================================
// CANAUX DE SOURCING
// =============================================================================

export type CanalSourcing =
  | 'qualibat'
  | 'rge_ademe'
  | 'profils_acheteurs'
  | 'pages_jaunes'
  | 'google_maps'
  | 'linkedin'
  | 'federation_batiment'
  | 'capeb'
  | 'ffb'
  | 'recommandation'
  | 'bouche_a_oreille';

export interface ConfigurationSourcing {
  canauxActifs: CanalSourcing[];
  rayonDefaut: number;
  limiteResultats: number;
  frequenceMAJ: string; // Cron expression
}
