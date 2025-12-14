/**
 * Types Phase 3 - Coordination Multi-Entreprises
 * Planning collaboratif, carnet liaison, gestion conflits, interfaces
 */

// ============================================
// PLANNING COLLABORATIF
// ============================================

export type StatutCreneauPlanning =
  | 'disponible'
  | 'reserve'
  | 'confirme'
  | 'en_cours'
  | 'termine'
  | 'conflit';

export type TypeConflitPlanning =
  | 'chevauchement_zone'      // Deux lots même zone même moment
  | 'dependance_non_terminee' // Lot bloqué par lot précédent
  | 'ressource_indisponible'  // Équipement ou personnel non dispo
  | 'acces_impossible'        // Zone inaccessible
  | 'approvisionnement_retard' // Matériaux non livrés
  | 'autre';

export interface CreneauIntervention {
  id: string;
  chantierId: string;

  // Entreprise/Lot
  entrepriseId: string;
  entrepriseNom: string;
  lotId: string;
  lotNom: string;

  // Période
  dateDebut: string;
  dateFin: string;
  heureDebut?: string;
  heureFin?: string;

  // Zone
  zone: string;
  sousZone?: string;

  // Détails
  description?: string;
  effectifPrevu?: number;

  // Statut
  statut: StatutCreneauPlanning;

  // Validation
  creePar: string;      // Entreprise
  validePar?: string;   // MOE ou Conducteur travaux
  dateValidation?: string;

  // Conflits détectés
  conflits: ConflitPlanning[];

  createdAt: string;
  updatedAt: string;
}

export interface ConflitPlanning {
  id: string;
  chantierId: string;

  // Type
  type: TypeConflitPlanning;

  // Créneaux en conflit
  creneau1Id: string;
  creneau2Id?: string;

  // Description
  description: string;
  impact: 'faible' | 'moyen' | 'fort' | 'bloquant';

  // Détection
  dateDetection: string;
  detectePar: 'systeme' | 'utilisateur';

  // Résolution
  statut: 'detecte' | 'en_analyse' | 'proposition_faite' | 'resolu' | 'ignore';

  resolution?: {
    type: 'replanification' | 'parallélisation' | 'priorisation' | 'autre';
    description: string;
    decidePar: string;
    dateDecision: string;
  };

  // Suggestions IA
  suggestionsIA?: SuggestionResolutionConflit[];

  createdAt: string;
  updatedAt: string;
}

export interface SuggestionResolutionConflit {
  id: string;
  type: 'decaler_lot1' | 'decaler_lot2' | 'paralleliser' | 'diviser_zone' | 'changer_horaires';
  description: string;
  impactDelai: number; // jours
  scorePertinence: number; // 0-100
  acceptee?: boolean;
}

// ============================================
// CARNET DE LIAISON
// ============================================

export type TypeEntreeCarnet =
  | 'arrivee'
  | 'depart'
  | 'travaux_realises'
  | 'probleme'
  | 'demande'
  | 'information'
  | 'incident'
  | 'livraison'
  | 'autre';

export interface CarnetLiaison {
  id: string;
  chantierId: string;

  // Date du jour
  date: string;

  // Entrées du jour
  entrees: EntreeCarnetLiaison[];

  // Résumé automatique
  resume?: {
    entreprisesPresentes: string[];
    effectifTotal: number;
    problemesSignales: number;
    demandesOuvertes: number;
  };

  // Signature quotidienne
  signatures: SignatureCarnet[];

  // Cloture du jour
  cloture: boolean;
  cloturePar?: string;
  clotureLe?: string;

  createdAt: string;
  updatedAt: string;
}

export interface EntreeCarnetLiaison {
  id: string;
  carnetId: string;

  // Auteur
  entreprise: string;
  auteur: string;

  // Horaire
  dateHeure: string;

  // Type
  type: TypeEntreeCarnet;

  // Contenu
  contenu: string;

  // Destinataires (si demande/question)
  destinataires?: string[];

  // Photos
  photos?: string[];

  // Réponse
  reponse?: {
    par: string;
    dateHeure: string;
    contenu: string;
  };

  // Urgence
  urgent: boolean;

  // Statut (pour demandes/problèmes)
  statut?: 'ouvert' | 'en_cours' | 'resolu' | 'ignore';

  createdAt: string;
}

export interface SignatureCarnet {
  id: string;
  entreprise: string;
  signataire: string;
  dateHeure: string;
  type: 'arrivee' | 'depart';
}

// ============================================
// CHAT MULTI-ENTREPRISES
// ============================================

export type TypeConversation =
  | 'chantier_general'     // Tout le monde
  | 'lot_specifique'       // Entreprises d'un lot
  | 'coordination'         // MOE + Conducteur
  | 'urgent'               // Alertes urgentes
  | 'prive';               // Entre 2 entreprises

export interface Conversation {
  id: string;
  chantierId: string;

  // Type
  type: TypeConversation;
  nom: string;
  description?: string;

  // Participants
  participants: ParticipantChat[];

  // Dernière activité
  dernierMessage?: string;
  dernierMessageDate?: string;

  // Statut
  actif: boolean;

  createdAt: string;
  updatedAt: string;
}

export interface ParticipantChat {
  id: string;
  entreprise: string;
  nom: string;
  role?: string;
  email?: string;

  // Statut
  actif: boolean;
  derniereLecture?: string;
  messagesNonLus: number;
}

export interface MessageChat {
  id: string;
  conversationId: string;

  // Auteur
  auteurId: string;
  auteurNom: string;
  auteurEntreprise: string;

  // Contenu
  contenu: string;
  type: 'texte' | 'image' | 'fichier' | 'lien' | 'alerte';

  // Pièces jointes
  piecesJointes?: PieceJointeChat[];

  // Mention
  mentions?: string[];

  // Réponse à
  reponseA?: string; // ID message parent

  // Statut
  lu: boolean;
  modifie: boolean;

  createdAt: string;
  updatedAt?: string;
}

export interface PieceJointeChat {
  id: string;
  type: 'image' | 'pdf' | 'plan' | 'photo' | 'autre';
  nom: string;
  url: string;
  taille?: number;
}

// ============================================
// INTERFACES TECHNIQUES
// ============================================

export type TypeInterface =
  | 'reservation'         // Trou dans structure pour passage
  | 'raccordement'        // Branchement entre réseaux
  | 'appui'               // Support pour autre lot
  | 'passage'             // Passage commun
  | 'protection'          // Protection d'un ouvrage
  | 'coordination_pose'   // Ordre de pose
  | 'autre';

export type StatutInterface =
  | 'a_definir'
  | 'defini'
  | 'realise'
  | 'probleme'
  | 'valide';

export interface InterfaceTechnique {
  id: string;
  chantierId: string;

  // Lots concernés
  lot1: {
    lotId: string;
    lotNom: string;
    entreprise: string;
    role: 'emetteur' | 'recepteur'; // Qui exécute
  };
  lot2: {
    lotId: string;
    lotNom: string;
    entreprise: string;
    role: 'emetteur' | 'recepteur';
  };

  // Type
  type: TypeInterface;
  description: string;

  // Localisation
  zone: string;
  localisation?: string; // Détails précis
  coordonnees?: { x: number; y: number; z: number };

  // Spécifications
  specifications?: string;
  cotes?: {
    largeur?: number;
    hauteur?: number;
    profondeur?: number;
    unite: 'mm' | 'cm' | 'm';
  };

  // Dates
  dateRequise: string;
  dateRealisation?: string;

  // Statut
  statut: StatutInterface;

  // Validation
  valideLot1?: {
    par: string;
    date: string;
    commentaire?: string;
  };
  valideLot2?: {
    par: string;
    date: string;
    commentaire?: string;
  };

  // Documents
  planUrl?: string;
  photos?: string[];

  // Problème éventuel
  probleme?: {
    description: string;
    dateSignalement: string;
    signalePar: string;
    gravite: 'mineur' | 'majeur' | 'bloquant';
    resolution?: string;
  };

  createdAt: string;
  updatedAt: string;
}

// ============================================
// PLANS DE SYNTHÈSE (si BIM)
// ============================================

export interface PlanSynthese {
  id: string;
  chantierId: string;

  // Identification
  reference: string;
  nom: string;
  indice: string;

  // Zone couverte
  zone?: string;
  niveau?: string;

  // Réseaux inclus
  reseaux: ReseauSynthese[];

  // Fichiers
  planUrl: string;
  formatFichier: 'pdf' | 'dwg' | 'ifc' | 'autre';

  // Clash détection
  clashsDetectes: ClashDetection[];

  // Dates
  dateCreation: string;
  dateMiseAJour: string;

  // Validation
  statut: 'brouillon' | 'diffuse' | 'valide' | 'obsolete';
  validePar?: string;
  dateValidation?: string;

  createdAt: string;
  updatedAt: string;
}

export interface ReseauSynthese {
  type: 'electricite' | 'plomberie_eu' | 'plomberie_ef' | 'chauffage' | 'climatisation' | 'vmc' | 'gaz' | 'telecom' | 'securite_incendie' | 'autre';
  lot: string;
  entreprise: string;
  couleur?: string; // Code couleur sur le plan
}

export interface ClashDetection {
  id: string;

  // Réseaux en conflit
  reseau1: string;
  reseau2: string;

  // Localisation
  localisation: string;
  coordonnees?: { x: number; y: number; z: number };

  // Description
  description: string;
  gravite: 'info' | 'warning' | 'error';

  // Résolution
  statut: 'detecte' | 'analyse' | 'resolu' | 'accepte';
  resolution?: string;
  resoluPar?: string;
  dateResolution?: string;
}

// ============================================
// CONDUCTEUR DE TRAVAUX (OPC)
// ============================================

export interface ConducteurTravaux {
  id: string;
  chantierId: string;

  // Identification
  nom: string;
  entreprise?: string;
  certification?: string;

  // Contact
  email: string;
  telephone: string;

  // Missions
  missions: MissionOPC[];

  // Présence
  frequencePresence: 'quotidienne' | 'hebdomadaire' | 'bimensuelle';
  joursPresence?: string[];

  // Statut
  actif: boolean;
  dateDebut: string;
  dateFin?: string;

  createdAt: string;
  updatedAt: string;
}

export type TypeMissionOPC =
  | 'pilotage_planning'
  | 'coordination_lots'
  | 'arbitrage_conflits'
  | 'validation_conformite'
  | 'interface_mo_moe'
  | 'reporting'
  | 'reception_travaux';

export interface MissionOPC {
  type: TypeMissionOPC;
  description: string;
  frequence?: string;
}

// ============================================
// RÈGLES DE PRIORITÉ
// ============================================

export interface ReglesChantier {
  id: string;
  chantierId: string;

  // Ordre logique des lots
  ordreLots: OrdreLot[];

  // Règles de priorité
  reglesConflit: RegleConflit[];

  // Protocoles interface
  protocolesInterface: ProtocoleInterface[];

  // Règles dégradation
  reglesDegradation: RegleDegradation;

  // Validé par
  validePar?: string;
  dateValidation?: string;

  createdAt: string;
  updatedAt: string;
}

export interface OrdreLot {
  rang: number;
  lotType: string;
  description?: string;
  prerequis?: string[];
}

export interface RegleConflit {
  id: string;
  situation: string; // Ex: "Deux lots même zone"
  regle: string;     // Ex: "Lot chemin critique prioritaire"
  priorite: number;
}

export interface ProtocoleInterface {
  id: string;
  lot1: string;
  lot2: string;
  action: string;           // Ex: "Percement cloisons"
  responsable: string;      // Ex: "lot1" ou "lot2"
  details?: string;
}

export interface RegleDegradation {
  // Protection
  protectionObligatoire: boolean;
  typesProtection: string[];

  // Constatation
  delaiSignalement: number; // heures
  photoObligatoire: boolean;

  // Réparation
  delaiReparation: number; // jours
  responsableParDefaut: 'causant' | 'victime';
}

// ============================================
// GESTION DES DÉGRADATIONS
// ============================================

export type StatutDegradation =
  | 'signalee'
  | 'constatee'
  | 'responsable_identifie'
  | 'en_reparation'
  | 'reparee'
  | 'contestee'
  | 'arbitrage';

export interface Degradation {
  id: string;
  chantierId: string;

  // Signalement
  dateSignalement: string;
  signalePar: string;
  entrepriseVictime: string;
  lotVictime: string;

  // Localisation
  zone: string;
  localisation?: string;

  // Description
  description: string;
  gravite: 'mineure' | 'importante' | 'grave';

  // Photos (preuve)
  photos: PhotoDegradation[];

  // Responsable présumé
  entrepriseResponsable?: string;
  lotResponsable?: string;

  // Constatation
  constatation?: {
    date: string;
    par: string; // MOE ou conducteur
    confirmee: boolean;
    observations?: string;
  };

  // Statut
  statut: StatutDegradation;

  // Contestation
  contestation?: {
    date: string;
    par: string;
    motif: string;
  };

  // Réparation
  reparation?: {
    description: string;
    entrepriseReparatrice: string;
    dateDebut?: string;
    dateFin?: string;
    coutHT?: number;
    facturePar?: string;
  };

  // Carnet liaison
  inscritCarnet: boolean;
  entreeCarnetId?: string;

  createdAt: string;
  updatedAt: string;
}

export interface PhotoDegradation {
  id: string;
  url: string;
  dateHeure: string;
  legende?: string;
  geolocalisee?: boolean;
}

// ============================================
// ALERTES COORDINATION
// ============================================

export interface AlerteCoordination {
  id: string;
  chantierId: string;

  type:
    | 'conflit_planning'
    | 'interface_non_definie'
    | 'interface_probleme'
    | 'degradation_signalee'
    | 'retard_lot'
    | 'absence_carnet'
    | 'message_urgent'
    | 'clash_detecte';

  niveau: 'info' | 'warning' | 'error' | 'critical';

  // Référence
  entiteType: 'creneau' | 'conflit' | 'interface' | 'degradation' | 'lot' | 'message' | 'clash';
  entiteId: string;

  // Message
  titre: string;
  message: string;
  entreprisesConcernees?: string[];

  // Action
  actionRequise?: string;

  // Dates
  dateCreation: string;
  dateEcheance?: string;

  // Statut
  lu: boolean;
  traite: boolean;

  createdAt: string;
}

// ============================================
// INPUTS CRÉATION
// ============================================

export interface CreateCreneauInput {
  chantierId: string;
  entrepriseId: string;
  entrepriseNom: string;
  lotId: string;
  lotNom: string;
  dateDebut: string;
  dateFin: string;
  zone: string;
  description?: string;
  effectifPrevu?: number;
}

export interface CreateEntreeCarnetInput {
  chantierId: string;
  date: string;
  entreprise: string;
  auteur: string;
  type: TypeEntreeCarnet;
  contenu: string;
  destinataires?: string[];
  urgent?: boolean;
  photos?: string[];
}

export interface CreateInterfaceInput {
  chantierId: string;
  lot1: InterfaceTechnique['lot1'];
  lot2: InterfaceTechnique['lot2'];
  type: TypeInterface;
  description: string;
  zone: string;
  dateRequise: string;
  specifications?: string;
}

export interface CreateDegradationInput {
  chantierId: string;
  entrepriseVictime: string;
  lotVictime: string;
  zone: string;
  description: string;
  gravite: Degradation['gravite'];
  entrepriseResponsable?: string;
  photos?: string[];
}

export interface CreateConversationInput {
  chantierId: string;
  type: TypeConversation;
  nom: string;
  description?: string;
  participants: ParticipantChat[];
}
