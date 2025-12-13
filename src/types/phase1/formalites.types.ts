/**
 * TORP Phase 1 - Types Formalités Administratives
 * Module 1.5 : Préparation Administrative
 *
 * Structure complète pour la gestion des formalités administratives
 * avant démarrage de chantier (déclarations, autorisations, affichages)
 */

import type { Address } from '../phase0/common.types';

// =============================================================================
// DOSSIER FORMALITÉS
// =============================================================================

export interface DossierFormalites {
  id: string;
  projectId: string;

  // Autorisations d'urbanisme
  urbanisme: FormalitesUrbanisme;

  // Déclarations préalables chantier
  declarations: DeclarationsChantier;

  // Sécurité et coordination
  securite: FormalitesSecurite;

  // Voirie et domaine public
  voirie: FormalitesVoirie;

  // Autres formalités
  autres: AutresFormalites;

  // État global
  statut: StatutDossierFormalites;
  progression: number; // 0-100

  // Alertes
  alertes: AlerteFormalite[];

  // Métadonnées
  metadata: FormalitesMetadata;
}

export type StatutDossierFormalites =
  | 'a_completer'
  | 'en_cours'
  | 'en_attente_validation'
  | 'valide'
  | 'pret_demarrage';

// =============================================================================
// AUTORISATIONS D'URBANISME
// =============================================================================

export interface FormalitesUrbanisme {
  // Type d'autorisation requise
  typeAutorisation: TypeAutorisationUrbanisme;

  // Déclaration préalable
  declarationPrealable?: DeclarationPrealable;

  // Permis de construire
  permis?: PermisConstruire;

  // Affichage
  affichage?: AffichageChantier;
}

export type TypeAutorisationUrbanisme =
  | 'aucune'                 // Aucune autorisation requise
  | 'declaration_prealable'  // DP
  | 'permis_construire'      // PC
  | 'permis_demolir';        // PD

export interface DeclarationPrealable {
  // Dépôt
  dateDemande?: string;
  numeroDossier?: string;
  lieuDepot: string;

  // Statut
  statut: StatutAutorisationUrbanisme;
  dateDecision?: string;
  dateExpiration?: string;

  // Affichage
  dateDebutAffichage?: string;
  dureeAffichage: number; // mois minimum
  delaiRecours: number; // mois

  // Purgé recours
  purgeRecours: boolean;
  datePurge?: string;

  // Document
  arreteUrl?: string;
}

export interface PermisConstruire {
  // Dépôt
  dateDemande?: string;
  numeroDossier?: string;
  lieuDepot: string;

  // Instruction
  dureeInstruction: number; // mois
  dateInstructionFin?: string;

  // Statut
  statut: StatutAutorisationUrbanisme;
  dateDecision?: string;
  dateExpiration?: string; // 3 ans

  // Affichage terrain
  affichageTerrain: {
    date?: string;
    dureeMinimum: number; // jours
    photoPreuve?: string;
  };

  // Affichage mairie
  affichageMairie: {
    date?: string;
    duree: number; // jours
  };

  // Purgé recours
  purgeRecours: boolean;
  datePurge?: string;
  delaiRecoursRestant?: number; // jours

  // Documents
  arreteUrl?: string;
  conformiteUrl?: string;
}

export type StatutAutorisationUrbanisme =
  | 'non_demandee'
  | 'deposee'
  | 'en_instruction'
  | 'accordee'
  | 'accordee_sous_reserves'
  | 'refusee'
  | 'caducite'
  | 'retiree';

export interface AffichageChantier {
  // Panneau
  typeAnneau: 'dp' | 'pc';
  dimensions: string; // Ex: "80x120cm"
  obligatoire: boolean;

  // Contenu obligatoire
  mentionsObligatoires: MentionPanneau[];

  // État
  installe: boolean;
  dateInstallation?: string;
  photoPreuve?: string;

  // Durée
  dureeMinimum: number; // jours
  dateFinAffichage?: string;
}

export interface MentionPanneau {
  mention: string;
  valeur: string;
  obligatoire: boolean;
}

// Mentions obligatoires panneau PC
export const MENTIONS_PANNEAU_PC: Omit<MentionPanneau, 'valeur'>[] = [
  { mention: 'Numéro du permis', obligatoire: true },
  { mention: 'Date du permis', obligatoire: true },
  { mention: 'Nom du bénéficiaire', obligatoire: true },
  { mention: 'Raison sociale architecte', obligatoire: true },
  { mention: 'Raison sociale entreprise', obligatoire: false },
  { mention: 'Nature des travaux et destination', obligatoire: true },
  { mention: 'Surface de plancher', obligatoire: true },
  { mention: 'Emprise au sol', obligatoire: true },
  { mention: 'Hauteur de la construction (si >= 20m)', obligatoire: false },
  { mention: 'Adresse mairie', obligatoire: true },
  { mention: 'Délai de recours', obligatoire: true },
];

// =============================================================================
// DÉCLARATIONS PRÉALABLES CHANTIER
// =============================================================================

export interface DeclarationsChantier {
  // DICT
  dict?: DICT;

  // DOC
  doc?: DOC;

  // DAACT (à faire en fin de chantier)
  daactRequise: boolean;

  // Déclaration préalable travaux (500 jours-hommes)
  declarationTravaux?: DeclarationPrealableTravaux;
}

export interface DICT {
  // Demande
  obligatoire: boolean;
  dateDemande?: string;
  numeroRecepisse?: string;

  // Destinataires
  exploitantsContactes: ExploitantReseaux[];

  // Réponses
  reponses: ReponseDICT[];

  // Validité
  dateValidite?: string; // 3 mois max
  renouvellement?: {
    necessaire: boolean;
    dateRenouvellement?: string;
  };

  // Documents
  formulaireUrl?: string;
  plansReseauxUrls?: string[];
}

export interface ExploitantReseaux {
  nom: string;
  type: TypeReseaux;
  contacte: boolean;
  dateContact?: string;
  reponseRecue: boolean;
}

export type TypeReseaux =
  | 'electricite'
  | 'gaz'
  | 'eau'
  | 'assainissement'
  | 'telecom'
  | 'chauffage_urbain'
  | 'eclairage_public'
  | 'autre';

export interface ReponseDICT {
  exploitant: string;
  dateReponse: string;
  resultat: 'reseau_absent' | 'reseau_present' | 'investigation_complementaire';
  recommandations?: string[];
  planUrl?: string;
}

export interface DOC {
  // Déclaration d'Ouverture de Chantier
  obligatoire: boolean; // Obligatoire pour PC
  numeroFormulaire: string; // Cerfa 13407*05

  // Dépôt
  deposee: boolean;
  dateDepot?: string;
  lieuDepot?: string;

  // Document
  formulaireUrl?: string;
  accuseReceptionUrl?: string;
}

export interface DeclarationPrealableTravaux {
  // Seuil: >= 500 jours-hommes
  joursHommesEstimes: number;
  obligatoire: boolean;

  // Formulaire
  numeroFormulaire: string; // Cerfa 13257*03

  // Destinataires
  destinataires: DestinataireDPT[];

  // Dépôt
  deposee: boolean;
  dateDepot?: string;
  delaiAvantDemarrage: number; // 30 jours min

  // Contenu
  contenu: {
    adresseChantier: Address;
    natureTravaux: string;
    maitreOuvrage: string;
    maitreOeuvre?: string;
    entreprises: string[];
    effectifsPrevisionnels: number;
    dureeEstimee: number; // jours-hommes
    coordonnateurSPS?: string;
  };

  // Document
  formulaireUrl?: string;
}

export interface DestinataireDPT {
  organisme: 'inspection_travail' | 'carsat' | 'cramif' | 'oppbtp';
  region: string;
  envoye: boolean;
  dateEnvoi?: string;
  accuseReception?: string;
}

// =============================================================================
// SÉCURITÉ ET COORDINATION
// =============================================================================

export interface FormalitesSecurite {
  // Coordonnateur SPS
  coordonnateurSPS?: CoordonnnateurSPS;

  // PGC
  pgc?: PlanGeneralCoordination;

  // PPSPS (par entreprise)
  ppsps?: PPSPS[];

  // Registre journal
  registreJournal?: RegistreJournal;

  // DIUO (à faire en fin de chantier)
  diuoRequis: boolean;
}

export interface CoordonnnateurSPS {
  // Obligation
  obligatoire: boolean;
  motif: 'multi_entreprises' | 'jours_hommes' | 'facultatif';

  // Coordonnateur
  nom?: string;
  societe?: string;
  niveau: NiveauCoordonnateur;
  contact?: {
    email: string;
    telephone: string;
  };

  // Mission
  missionType: 'conception_realisation' | 'realisation';
  dateDebut?: string;
  dateFin?: string;

  // Contrat
  contratUrl?: string;
  cout?: number;
}

export type NiveauCoordonnateur =
  | 'niveau_1' // < 10 000 j-h, < 760 travailleurs max, < 10M€
  | 'niveau_2' // au-delà (infrastructure, génie civil)
  | 'niveau_3'; // travaux dangereux

export interface PlanGeneralCoordination {
  // PGC
  reference: string;
  version: number;
  dateCreation: string;
  dateMAJ?: string;

  // Contenu
  contenu: {
    renseignementsGeneraux: boolean;
    mesuresOrganisation: boolean;
    mesuresSujetions: boolean;
    voiesCirculation: boolean;
    zonesStockage: boolean;
    conditionsManutention: boolean;
    installationsSanitaires: boolean;
    dispositifsSecours: boolean;
  };

  // Validation
  valide: boolean;
  dateValidation?: string;

  // Document
  documentUrl?: string;
}

export interface PPSPS {
  // Plan Particulier de Sécurité et de Protection de la Santé
  entrepriseId: string;
  entrepriseNom: string;

  // Document
  reference: string;
  dateRemise?: string;
  dateValidation?: string;
  documentUrl?: string;

  // Statut
  statut: 'attendu' | 'recu' | 'valide' | 'a_modifier';

  // Contenu vérifié
  contenuVerifie?: {
    analyseRisques: boolean;
    mesuresPrevention: boolean;
    moyensSecours: boolean;
    consignesIncendie: boolean;
    protectionsCollectives: boolean;
    epi: boolean;
  };
}

export interface RegistreJournal {
  // Tenu par le coordonnateur SPS
  reference: string;
  dateOuverture: string;
  dateCloture?: string;

  // Consultable sur chantier
  localisationChantier: string;

  // Document
  documentUrl?: string;
}

// =============================================================================
// VOIRIE ET DOMAINE PUBLIC
// =============================================================================

export interface FormalitesVoirie {
  // Permission de voirie (emprise permanente)
  permissionVoirie?: PermissionVoirie;

  // Autorisation de stationnement (emprise temporaire)
  autorisationStationnement?: AutorisationStationnement;

  // Arrêté de circulation
  arreteCirculation?: ArreteCirculation;
}

export interface PermissionVoirie {
  // Ex: création bateau, abaissement trottoir
  obligatoire: boolean;
  objet: string;

  // Demande
  gestionnaire: 'mairie' | 'departement' | 'metropole';
  dateDemande?: string;
  numeroDossier?: string;

  // Instruction
  dureeInstruction: string;

  // Décision
  statut: 'non_demandee' | 'deposee' | 'en_instruction' | 'accordee' | 'refusee';
  dateDecision?: string;
  conditions?: string[];

  // Taxe
  taxe?: {
    montant: number;
    payee: boolean;
    datePaiement?: string;
  };

  // Document
  autorisationUrl?: string;
}

export interface AutorisationStationnement {
  // Ex: benne, échafaudage, grue, zone réservée
  obligatoire: boolean;
  objets: ObjetStationnement[];

  // Demande
  gestionnaire: string;
  dateDemande?: string;

  // Autorisation
  statut: 'non_demandee' | 'deposee' | 'accordee' | 'refusee';
  dateDebut?: string;
  dateFin?: string;

  // Redevance
  redevance?: {
    montantJournalier: number;
    dureeJours: number;
    montantTotal: number;
    payee: boolean;
  };

  // Signalisation
  signalisation: {
    panneaux: boolean;
    cones: boolean;
    barrieres: boolean;
  };

  // Document
  autorisationUrl?: string;
}

export interface ObjetStationnement {
  type: 'benne' | 'echafaudage' | 'grue' | 'engin' | 'zone_travaux' | 'autre';
  description: string;
  emplacementTrottoir: boolean;
  emplacementChaussee: boolean;
  dimensions?: string;
  duree: number; // jours
}

export interface ArreteCirculation {
  // Fermeture de voie, déviation
  obligatoire: boolean;
  objet: string;

  // Demande
  dateDemandeMinimum: number; // jours avant (généralement 3 semaines)
  dateDemande?: string;

  // Contenu
  ruesConcernees: string[];
  typeRestriction: 'fermeture_totale' | 'fermeture_partielle' | 'alternat' | 'deviation';
  periodes: PeriodeRestriction[];

  // Plan
  planCirculationUrl?: string;

  // Information
  riverainsInformes: boolean;
  dateInformation?: string;

  // Statut
  statut: 'non_demande' | 'depose' | 'accorde' | 'refuse';
  arreteUrl?: string;
}

export interface PeriodeRestriction {
  dateDebut: string;
  dateFin: string;
  heureDebut?: string;
  heureFin?: string;
  jours?: string[]; // Si restriction partielle
}

// =============================================================================
// AUTRES FORMALITÉS
// =============================================================================

export interface AutresFormalites {
  // Assurances chantier
  assurances: FormalitesAssurances;

  // Information voisinage
  informationVoisinage?: InformationVoisinage;

  // Affichages chantier
  affichagesChantier: AffichageChantierObligatoire[];
}

export interface FormalitesAssurances {
  // Attestations à jour
  attestationsVerifiees: AttestationVerifiee[];

  // Dommage-ouvrage
  dommageOuvrage?: {
    souscrit: boolean;
    parQui: 'mo' | 'entreprise';
    compagnie?: string;
    numeroPolice?: string;
    montant?: number;
    dateEffet?: string;
    attestationUrl?: string;
  };

  // TRC
  trc?: {
    souscrit: boolean;
    parQui: 'mo' | 'entreprise';
    compagnie?: string;
    numeroPolice?: string;
    couverture?: string[];
    attestationUrl?: string;
  };
}

export interface AttestationVerifiee {
  type: 'rc_decennale' | 'rc_professionnelle';
  entrepriseId: string;
  entrepriseNom: string;
  compagnie: string;
  numeroPolice: string;
  montantGaranti: number;
  dateDebut: string;
  dateFin: string;
  valide: boolean;
  attestationUrl?: string;
  dateVerification: string;
}

export interface InformationVoisinage {
  // Courtoisie recommandée
  faite: boolean;
  dateCourrier?: string;

  // Contenu
  contenu: {
    natureTravaux: string;
    dureePrevue: string;
    nuisancesAttendues: string[];
    coordinateesContact: string;
  };

  // Mode
  mode: 'courrier_simple' | 'recommande' | 'remise_main_propre';

  // Destinataires
  destinataires: string[];

  // Document
  courrierUrl?: string;
}

export interface AffichageChantierObligatoire {
  type: TypeAffichageChantier;
  obligatoire: boolean;
  installe: boolean;
  dateInstallation?: string;
  contenu: string;
}

export type TypeAffichageChantier =
  | 'panneau_entreprise'
  | 'horaires_chantier'
  | 'coordonnees_chef_chantier'
  | 'numeros_urgence'
  | 'consignes_securite'
  | 'interdiction_acces';

// =============================================================================
// ALERTES ET RAPPELS
// =============================================================================

export interface AlerteFormalite {
  id: string;
  type: TypeAlerteFormalite;
  severite: 'info' | 'warning' | 'error';
  titre: string;
  message: string;
  dateEcheance?: string;
  joursRestants?: number;
  formaliteConcernee: string;
  actionRequise: string;
}

export type TypeAlerteFormalite =
  | 'echeance_proche'
  | 'document_manquant'
  | 'document_expire'
  | 'formalite_obligatoire'
  | 'renouvellement_necessaire'
  | 'validation_requise';

// =============================================================================
// CHECKLIST ET PROGRESSION
// =============================================================================

export interface ChecklistFormalites {
  projectId: string;

  // Items de la checklist
  items: ItemChecklist[];

  // Progression
  itemsCompletes: number;
  itemsTotal: number;
  pourcentage: number;

  // Statut global
  pretPourDemarrage: boolean;
  bloqueursRestants: string[];
}

export interface ItemChecklist {
  id: string;
  categorie: CategorieFormalite;
  designation: string;
  description: string;
  obligatoire: boolean;
  statut: StatutItemChecklist;
  dateCompletion?: string;
  documentUrl?: string;
  commentaire?: string;
}

export type CategorieFormalite =
  | 'urbanisme'
  | 'declarations'
  | 'securite'
  | 'voirie'
  | 'assurances'
  | 'voisinage'
  | 'affichages';

export type StatutItemChecklist =
  | 'non_commence'
  | 'en_cours'
  | 'en_attente'
  | 'complete'
  | 'non_applicable';

// Checklist standard avant démarrage chantier
export const CHECKLIST_STANDARD: Omit<ItemChecklist, 'id' | 'statut'>[] = [
  // Urbanisme
  { categorie: 'urbanisme', designation: 'Autorisation d\'urbanisme obtenue', description: 'DP/PC accordé et purgé des recours', obligatoire: true },
  { categorie: 'urbanisme', designation: 'Panneau de chantier affiché', description: 'Panneau réglementaire installé sur le terrain', obligatoire: true },

  // Déclarations
  { categorie: 'declarations', designation: 'DICT effectuée', description: 'Déclaration aux exploitants de réseaux réalisée', obligatoire: true },
  { categorie: 'declarations', designation: 'DOC déposée', description: 'Déclaration d\'ouverture de chantier déposée en mairie', obligatoire: false },
  { categorie: 'declarations', designation: 'Déclaration préalable travaux', description: 'Si >= 500 jours-hommes, déclaration à l\'inspection du travail', obligatoire: false },

  // Sécurité
  { categorie: 'securite', designation: 'Coordonnateur SPS désigné', description: 'Si multi-entreprises ou >= 500 j-h', obligatoire: false },
  { categorie: 'securite', designation: 'PGC établi', description: 'Plan Général de Coordination', obligatoire: false },
  { categorie: 'securite', designation: 'PPSPS reçus', description: 'Plans Particuliers de chaque entreprise', obligatoire: false },

  // Voirie
  { categorie: 'voirie', designation: 'Autorisation de stationnement', description: 'Pour benne, échafaudage sur voie publique', obligatoire: false },
  { categorie: 'voirie', designation: 'Arrêté de circulation', description: 'Si fermeture de voie nécessaire', obligatoire: false },

  // Assurances
  { categorie: 'assurances', designation: 'Attestations RC décennale', description: 'Attestations de toutes les entreprises vérifiées', obligatoire: true },
  { categorie: 'assurances', designation: 'Dommage-ouvrage souscrit', description: 'Recommandé pour travaux > 50k€', obligatoire: false },

  // Voisinage
  { categorie: 'voisinage', designation: 'Information voisinage', description: 'Lettre d\'information aux voisins', obligatoire: false },

  // Affichages
  { categorie: 'affichages', designation: 'Horaires chantier affichés', description: 'Horaires de travaux autorisés', obligatoire: true },
  { categorie: 'affichages', designation: 'Coordonnées responsable', description: 'Contact chef de chantier visible', obligatoire: true },
  { categorie: 'affichages', designation: 'Numéros d\'urgence', description: 'Pompiers, SAMU, police', obligatoire: true },
  { categorie: 'affichages', designation: 'Consignes sécurité', description: 'Interdiction d\'accès, EPI requis', obligatoire: true },
];

// =============================================================================
// MÉTADONNÉES
// =============================================================================

export interface FormalitesMetadata {
  version: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  lastChecked?: string;
  notes?: string;
}
