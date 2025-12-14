/**
 * Types Phase 2 - Chantier
 * Dossier principal du chantier et configuration
 */

// Statuts
export type StatutChantier =
  | 'preparation'
  | 'ordre_service'
  | 'en_cours'
  | 'suspendu'
  | 'reception'
  | 'garantie_parfait_achevement'
  | 'clos';

export type StatutOrdreService =
  | 'brouillon'
  | 'envoye'
  | 'accuse_reception'
  | 'conteste'
  | 'valide';

export type TypeOrdreService =
  | 'demarrage'
  | 'suspension'
  | 'reprise'
  | 'prolongation'
  | 'travaux_sup'
  | 'modification'
  | 'arret_definitif';

// Interfaces principales
export interface Chantier {
  id: string;
  projectId: string;
  contratId?: string;

  // Identification
  reference?: string;
  nom: string;

  // Dates
  dateNotification?: string;
  dateOrdreService?: string;
  dateDebutPrevue?: string;
  dateFinPrevue?: string;
  dateDebutEffective?: string;
  dateFinEffective?: string;

  // Durée
  dureeMarcheJours?: number;
  delaiExecutionJours?: number;

  // Montants
  montantMarcheHT?: number;
  montantTravauxSupHT?: number;
  montantTotalHT?: number;

  // Statut
  statut: StatutChantier;
  avancementGlobal: number;

  // Configuration
  config?: ChantierConfig;

  // Métadonnées
  metadata?: Record<string, unknown>;

  // Timestamps
  createdAt: string;
  updatedAt: string;
}

export interface ChantierConfig {
  // Réunions
  frequenceReunionChantier: 'hebdomadaire' | 'bimensuelle' | 'mensuelle';
  jourReunionChantier?: string;
  heureReunionChantier?: string;

  // Reporting
  frequenceRapportAvancement: 'quotidien' | 'hebdomadaire' | 'mensuel';

  // Notifications
  alerteRetardJours: number;
  alerteDepassementBudget: number; // %

  // Participants par défaut
  participantsDefaut: ChantierParticipant[];
}

export interface ChantierParticipant {
  id: string;
  nom: string;
  role: string;
  entreprise?: string;
  email?: string;
  telephone?: string;
  estObligatoire: boolean;
}

// Ordre de Service
export interface OrdreService {
  id: string;
  chantierId: string;

  // Numérotation
  numero: number;
  reference?: string;

  // Type et contenu
  type: TypeOrdreService;
  objet: string;
  description?: string;

  // Dates
  dateEmission: string;
  dateEffet: string;
  dateReception?: string;

  // Impact
  impactDelaiJours: number;
  nouvelleDateFin?: string;
  impactFinancierHT: number;

  // Statut
  statut: StatutOrdreService;

  // Signataires
  emetteur?: OSSignataire;
  destinataire?: OSSignataire;

  // Accusé réception
  accuseReception?: {
    date: string;
    signataire: string;
    commentaire?: string;
  };

  // Documents
  documents: OSDocument[];

  // Timestamps
  createdAt: string;
  updatedAt: string;
}

export interface OSSignataire {
  nom: string;
  fonction: string;
  entreprise?: string;
  email?: string;
  dateSignature?: string;
}

export interface OSDocument {
  id: string;
  nom: string;
  type: string;
  url: string;
  dateAjout: string;
}

// Création / Mise à jour
export interface CreateChantierInput {
  projectId: string;
  contratId?: string;
  nom: string;
  reference?: string;
  dateDebutPrevue?: string;
  dateFinPrevue?: string;
  montantMarcheHT?: number;
  config?: Partial<ChantierConfig>;
}

export interface CreateOSInput {
  chantierId: string;
  type: TypeOrdreService;
  objet: string;
  description?: string;
  dateEffet: string;
  impactDelaiJours?: number;
  impactFinancierHT?: number;
  emetteur?: OSSignataire;
  destinataire?: OSSignataire;
}

// Résumé pour affichage
export interface ChantierResume {
  id: string;
  nom: string;
  reference?: string;
  statut: StatutChantier;
  avancementGlobal: number;
  dateDebutPrevue?: string;
  dateFinPrevue?: string;
  montantTotalHT?: number;
  retardJours?: number;
  alertes: ChantierAlerte[];
}

export interface ChantierAlerte {
  type: 'retard' | 'budget' | 'document' | 'securite' | 'qualite';
  niveau: 'info' | 'warning' | 'error';
  message: string;
  date: string;
}
