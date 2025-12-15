/**
 * Types pour le Marketplace TORP Phase 2
 * Plateforme de mise en relation propriétaires / artisans
 */

// === Artisan / Entreprise ===

export interface ArtisanProfile {
  id: string;
  userId: string;
  companyId?: string;

  // Informations entreprise
  entreprise: {
    nom: string;
    siret: string;
    formeJuridique: 'EI' | 'EURL' | 'SARL' | 'SAS' | 'SASU' | 'SA' | 'autre';
    dateCreation: Date;
    adresse: {
      rue: string;
      codePostal: string;
      ville: string;
      departement: string;
      region: string;
    };
    contact: {
      telephone: string;
      email: string;
      siteWeb?: string;
    };
  };

  // Qualifications
  qualifications: ArtisanQualification[];

  // Corps de métier
  metiers: MetierBTP[];

  // Zone d'intervention
  zoneIntervention: {
    departements: string[];
    rayonKm?: number;
    mobiliteNationale: boolean;
  };

  // Capacités
  capacites: {
    effectif: {
      min: number;
      max: number;
    };
    chantierSimultanes: number;
    delaiIntervention: 'immediat' | '1_semaine' | '2_semaines' | '1_mois' | 'plus';
  };

  // Préférences
  preferences: {
    budgetMinimum?: number;
    budgetMaximum?: number;
    typesChantiers: ('renovation' | 'construction' | 'extension' | 'entretien')[];
    typesClients: ('B2C' | 'B2B' | 'B2G')[];
  };

  // Statistiques
  stats: {
    devisEnvoyes: number;
    devisAcceptes: number;
    tauxConversion: number;
    noteMoyenne: number;
    nombreAvis: number;
    torpScore?: number;
  };

  // Statut
  status: 'pending_verification' | 'verified' | 'premium' | 'suspended';
  createdAt: Date;
  updatedAt: Date;
}

export interface ArtisanQualification {
  id: string;
  type: 'RGE' | 'Qualibat' | 'QualiPAC' | 'QualiSol' | 'autre';
  organisme: string;
  numero: string;
  domaines: string[];
  dateObtention: Date;
  dateValidite: Date;
  estValide: boolean;
  documentUrl?: string;
}

export type MetierBTP =
  | 'maconnerie'
  | 'plomberie'
  | 'electricite'
  | 'chauffage'
  | 'climatisation'
  | 'menuiserie'
  | 'couverture'
  | 'charpente'
  | 'peinture'
  | 'carrelage'
  | 'platerie'
  | 'isolation'
  | 'facade'
  | 'terrassement'
  | 'assainissement'
  | 'piscine'
  | 'domotique'
  | 'alarme'
  | 'autre';

// === Demande de devis ===

export interface DemandeDevis {
  id: string;
  projectId: string; // Lien vers Phase0Project
  userId: string; // Propriétaire

  // Informations projet
  projet: {
    titre: string;
    description: string;
    type: 'renovation' | 'construction' | 'extension' | 'entretien';
    lots: LotDemande[];
    budgetEstime?: {
      min: number;
      max: number;
    };
    delaiSouhaite?: {
      debut: Date;
      fin: Date;
    };
  };

  // Localisation
  localisation: {
    adresse: string;
    codePostal: string;
    ville: string;
    departement: string;
    coordonnees?: {
      latitude: number;
      longitude: number;
    };
  };

  // Critères de sélection
  criteres: {
    rgeRequis: boolean;
    qualificationsRequises: string[];
    noteMinimuim?: number;
    budgetFerme: boolean;
  };

  // Diffusion
  diffusion: {
    mode: 'public' | 'cible' | 'prive';
    artisansCibles?: string[]; // IDs si mode cible ou privé
    dateLimiteReponse: Date;
    nombreDevisMax?: number;
  };

  // État
  status: DemandeStatus;
  nombreDevisRecus: number;
  nombreVues: number;

  // Métadonnées
  createdAt: Date;
  updatedAt: Date;
  publishedAt?: Date;
  closedAt?: Date;
}

export type DemandeStatus =
  | 'draft'
  | 'published'
  | 'in_progress'
  | 'selection'
  | 'attributed'
  | 'cancelled'
  | 'expired';

export interface LotDemande {
  id: string;
  categorie: string;
  designation: string;
  description?: string;
  quantiteEstimee?: {
    valeur: number;
    unite: string;
  };
  budgetEstime?: {
    min: number;
    max: number;
  };
  priorite: 'obligatoire' | 'souhaite' | 'optionnel';
}

// === Réponse / Devis artisan ===

export interface ReponseArtisan {
  id: string;
  demandeId: string;
  artisanId: string;

  // Contenu de l'offre
  offre: {
    montantHT: number;
    tva: number;
    montantTTC: number;
    detailLots: LotReponse[];
    validite: Date;
    delaiRealisation: {
      debut: Date;
      duree: number; // jours
    };
  };

  // Documents joints
  documents: {
    devisPdf?: string;
    portfolioUrls?: string[];
  };

  // Message
  message?: string;

  // État
  status: ReponseStatus;
  vueParClient: boolean;
  dateVue?: Date;

  // Notation (après travaux)
  evaluation?: EvaluationArtisan;

  // Métadonnées
  createdAt: Date;
  updatedAt: Date;
}

export type ReponseStatus =
  | 'draft'
  | 'submitted'
  | 'viewed'
  | 'shortlisted'
  | 'accepted'
  | 'rejected'
  | 'withdrawn';

export interface LotReponse {
  lotDemandeId: string;
  designation: string;
  montantHT: number;
  details?: string;
  inclus: boolean;
}

// === Évaluation ===

export interface EvaluationArtisan {
  id: string;
  reponseId: string;
  artisanId: string;
  userId: string;

  notes: {
    qualiteTravail: number; // 1-5
    respectDelais: number;
    communication: number;
    rapport_qualite_prix: number;
    proprete: number;
  };
  noteMoyenne: number;

  commentaire?: string;
  recommande: boolean;

  // Photos après travaux
  photosUrls?: string[];

  // Modération
  isPublic: boolean;
  isVerified: boolean;

  createdAt: Date;
}

// === Matching ===

export interface MatchingResult {
  artisanId: string;
  score: number;
  scoreDetails: {
    competencesTechniques: number;
    proximiteGeographique: number;
    disponibilite: number;
    prixCompetitif: number;
    notation: number;
    qualifications: number;
  };
  artisan: ArtisanProfile;
}

export interface MatchingCriteria {
  demandeId: string;
  metiers: MetierBTP[];
  codePostal: string;
  budgetEstime?: { min: number; max: number };
  rgeRequis: boolean;
  qualificationsRequises: string[];
  dateDebut?: Date;
}

// === Conversation ===

export interface Conversation {
  id: string;
  demandeId: string;
  participants: {
    userId: string;
    artisanId: string;
  };
  messages: Message[];
  status: 'active' | 'archived';
  createdAt: Date;
  lastMessageAt: Date;
}

export interface Message {
  id: string;
  senderId: string;
  senderType: 'user' | 'artisan';
  content: string;
  attachments?: string[];
  readAt?: Date;
  createdAt: Date;
}

// === Abonnement artisan ===

export interface ArtisanSubscription {
  id: string;
  artisanId: string;
  plan: 'free' | 'starter' | 'pro' | 'premium';
  features: {
    demandesParMois: number;
    miseEnAvant: boolean;
    badgePremium: boolean;
    statistiquesAvancees: boolean;
    supportPrioritaire: boolean;
  };
  pricing: {
    mensuel: number;
    annuel: number;
  };
  status: 'active' | 'cancelled' | 'expired';
  startDate: Date;
  endDate: Date;
  autoRenew: boolean;
}

// === Notifications ===

export type MarketplaceNotificationType =
  | 'new_demand_match'
  | 'new_response'
  | 'response_viewed'
  | 'response_shortlisted'
  | 'response_accepted'
  | 'response_rejected'
  | 'new_message'
  | 'evaluation_request'
  | 'demand_expiring'
  | 'qualification_expiring';

export interface MarketplaceNotification {
  id: string;
  userId: string;
  type: MarketplaceNotificationType;
  title: string;
  message: string;
  data: Record<string, unknown>;
  isRead: boolean;
  createdAt: Date;
}
