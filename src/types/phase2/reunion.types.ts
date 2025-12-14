/**
 * Types Phase 2 - Réunions de chantier
 * Réunion de lancement, hebdomadaires, réception
 */

// Types de réunion
export type TypeReunion =
  | 'lancement'
  | 'chantier_hebdo'
  | 'coordination'
  | 'reception_partielle'
  | 'pre_reception'
  | 'reception'
  | 'levee_reserves'
  | 'extraordinaire';

// Statuts
export type StatutReunion =
  | 'planifiee'
  | 'confirmee'
  | 'en_cours'
  | 'terminee'
  | 'annulee'
  | 'reportee';

// Interfaces principales
export interface Reunion {
  id: string;
  chantierId: string;

  // Identification
  numero: number;
  type: TypeReunion;
  titre: string;

  // Planification
  dateHeure: string;
  dureeMinutes: number;
  lieu?: string;

  // Ordre du jour
  ordreDuJour: PointOrdreDuJour[];

  // Participants
  participantsPrevus: Participant[];
  participantsPresents: Participant[];

  // Statut
  statut: StatutReunion;

  // Compte-rendu
  compteRendu?: CompteRendu;
  decisions: Decision[];
  actions: Action[];

  // Documents
  documents: ReunionDocument[];
  photos: ReunionPhoto[];

  // Signatures
  signatures: Signature[];

  // Timestamps
  createdAt: string;
  updatedAt: string;
}

export interface PointOrdreDuJour {
  id: string;
  ordre: number;
  titre: string;
  description?: string;
  dureeMinutes?: number;
  responsable?: string;
  traite: boolean;
}

export interface Participant {
  id: string;
  nom: string;
  prenom?: string;
  role: string;
  entreprise?: string;
  email?: string;
  telephone?: string;
  estObligatoire: boolean;
  present?: boolean;
  heureArrivee?: string;
  heureDepart?: string;
}

export interface CompteRendu {
  redacteur: string;
  dateRedaction: string;
  contenu: SectionCompteRendu[];
  remarquesGenerales?: string;
}

export interface SectionCompteRendu {
  titre: string;
  contenu: string;
  points: string[];
}

export interface Decision {
  id: string;
  description: string;
  responsable?: string;
  date: string;
  impact?: string;
}

export interface Action {
  id: string;
  description: string;
  responsable: string;
  echeance: string;
  priorite: 'basse' | 'normale' | 'haute' | 'urgente';
  statut: 'a_faire' | 'en_cours' | 'terminee' | 'annulee';
  commentaire?: string;
}

export interface ReunionDocument {
  id: string;
  nom: string;
  type: string;
  url: string;
  dateAjout: string;
}

export interface ReunionPhoto {
  id: string;
  url: string;
  legende?: string;
  dateHeure: string;
  localisation?: string;
}

export interface Signature {
  participant: string;
  role: string;
  dateSignature: string;
  signatureUrl?: string;
}

// Templates
export interface TemplateOrdreDuJour {
  type: TypeReunion;
  points: Omit<PointOrdreDuJour, 'id' | 'traite'>[];
}

// Réunion de lancement - template spécifique
export const TEMPLATE_REUNION_LANCEMENT: TemplateOrdreDuJour = {
  type: 'lancement',
  points: [
    { ordre: 1, titre: 'Présentation des participants', description: 'Tour de table, rôles et responsabilités', dureeMinutes: 15 },
    { ordre: 2, titre: 'Rappel du projet', description: 'Objet, périmètre, budget, délais', dureeMinutes: 10 },
    { ordre: 3, titre: 'Planning général', description: 'Jalons, dates clés, interfaces entre lots', dureeMinutes: 15 },
    { ordre: 4, titre: 'Organisation du chantier', description: 'Base-vie, stockage, circulation, accès', dureeMinutes: 15 },
    { ordre: 5, titre: 'Modalités de suivi', description: 'Fréquence réunions, outils, rapports', dureeMinutes: 10 },
    { ordre: 6, titre: 'Sécurité', description: 'PPSPS, PGC, EPI, consignes', dureeMinutes: 15 },
    { ordre: 7, titre: 'Gestion des imprévus', description: 'Procédure modifications, délais réponse', dureeMinutes: 10 },
    { ordre: 8, titre: 'Qualité et contrôles', description: 'Points d\'arrêt, essais, bureau contrôle', dureeMinutes: 10 },
    { ordre: 9, titre: 'Réception', description: 'Modalités, critères, procédure réserves', dureeMinutes: 5 },
    { ordre: 10, titre: 'Questions diverses', dureeMinutes: 15 },
  ]
};

// Réunion hebdomadaire - template
export const TEMPLATE_REUNION_HEBDO: TemplateOrdreDuJour = {
  type: 'chantier_hebdo',
  points: [
    { ordre: 1, titre: 'Avancement semaine écoulée', description: 'Réalisé vs prévu', dureeMinutes: 15 },
    { ordre: 2, titre: 'Difficultés rencontrées', dureeMinutes: 10 },
    { ordre: 3, titre: 'Planning semaine à venir', description: 'Tâches, équipes, livraisons', dureeMinutes: 15 },
    { ordre: 4, titre: 'Modifications / Travaux supplémentaires', dureeMinutes: 10 },
    { ordre: 5, titre: 'Sécurité', description: 'Observations, incidents', dureeMinutes: 5 },
    { ordre: 6, titre: 'Qualité', description: 'Contrôles, réserves', dureeMinutes: 5 },
    { ordre: 7, titre: 'Questions diverses', dureeMinutes: 10 },
  ]
};

// Inputs création
export interface CreateReunionInput {
  chantierId: string;
  type: TypeReunion;
  titre: string;
  dateHeure: string;
  dureeMinutes?: number;
  lieu?: string;
  participantsPrevus?: Omit<Participant, 'present' | 'heureArrivee' | 'heureDepart'>[];
  ordreDuJour?: Omit<PointOrdreDuJour, 'id' | 'traite'>[];
}

export interface UpdateReunionInput {
  titre?: string;
  dateHeure?: string;
  dureeMinutes?: number;
  lieu?: string;
  statut?: StatutReunion;
  participantsPrevus?: Participant[];
  participantsPresents?: Participant[];
  ordreDuJour?: PointOrdreDuJour[];
  compteRendu?: CompteRendu;
  decisions?: Decision[];
  actions?: Action[];
}
