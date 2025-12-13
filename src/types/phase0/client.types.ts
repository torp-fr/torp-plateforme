/**
 * TORP Phase 0 - Types du Client B2B (Maître d'Ouvrage / Donneur d'ordres)
 * Pour les professionnels qui interviennent chez un client
 */

import type { Address, ContactInfo } from './common.types';

// =============================================================================
// PROFIL CLIENT (pour interventions B2B)
// =============================================================================

export interface ClientProfile {
  id?: string;
  /** Type de client */
  clientType: ClientType;
  /** Identité du client */
  identity: ClientIdentity;
  /** Informations de contact */
  contact: ClientContact;
  /** Site d'intervention */
  site: InterventionSite;
  /** Contexte de l'intervention */
  context: InterventionContext;
  /** Métadonnées */
  metadata?: ClientMetadata;
}

export type ClientType =
  | 'particulier'           // Client particulier
  | 'entreprise'            // Entreprise cliente
  | 'copropriete'           // Copropriété / Syndic
  | 'collectivite'          // Collectivité locale
  | 'bailleur'              // Bailleur social/privé
  | 'marchand_de_biens'     // Marchand de biens
  | 'promoteur'             // Promoteur immobilier
  | 'autre';

// =============================================================================
// IDENTITÉ CLIENT
// =============================================================================

export interface ClientIdentity {
  /** Nom complet ou raison sociale */
  name: string;
  /** Prénom (pour particuliers) */
  firstName?: string;
  /** Civilité */
  civility?: 'M' | 'Mme' | 'M./Mme';
  /** Raison sociale (pour entreprises) */
  companyName?: string;
  /** SIRET (pour entreprises) */
  siret?: string;
  /** Numéro TVA intracommunautaire */
  vatNumber?: string;
  /** Référence interne client */
  internalRef?: string;
}

// =============================================================================
// CONTACT CLIENT
// =============================================================================

export interface ClientContact {
  /** Nom du contact principal */
  contactName?: string;
  /** Fonction du contact */
  contactRole?: string;
  /** Email principal */
  email: string;
  /** Téléphone fixe */
  phone?: string;
  /** Téléphone mobile */
  mobile?: string;
  /** Préférence de contact */
  preferredContact: 'email' | 'phone' | 'sms' | 'whatsapp';
  /** Créneaux de disponibilité */
  availableSlots?: ('morning' | 'afternoon' | 'evening')[];
  /** Notes sur le contact */
  notes?: string;
}

// =============================================================================
// SITE D'INTERVENTION
// =============================================================================

export interface InterventionSite {
  /** Nom/référence du site */
  siteName?: string;
  /** Adresse des travaux */
  address: Address;
  /** Type de site */
  siteType: SiteType;
  /** Caractéristiques du site */
  characteristics?: SiteCharacteristics;
  /** Contraintes d'accès */
  accessConstraints?: AccessConstraints;
  /** Contexte d'occupation */
  occupancy: SiteOccupancy;
}

export type SiteType =
  | 'appartement'
  | 'maison'
  | 'immeuble'
  | 'local_commercial'
  | 'bureaux'
  | 'entrepot'
  | 'terrain'
  | 'erp'                   // Établissement Recevant du Public
  | 'igh'                   // Immeuble de Grande Hauteur
  | 'industriel'
  | 'autre';

export interface SiteCharacteristics {
  /** Surface totale (m²) */
  totalArea?: number;
  /** Surface d'intervention (m²) */
  interventionArea?: number;
  /** Nombre de niveaux */
  levels?: number;
  /** Étage(s) concerné(s) */
  floors?: string;
  /** Année de construction */
  constructionYear?: number;
  /** Type de construction */
  constructionType?: 'traditionnel' | 'industriel' | 'bois' | 'metal' | 'mixte' | 'autre';
  /** DPE actuel */
  dpeRating?: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'non_requis';
}

export interface AccessConstraints {
  /** Accès véhicule */
  vehicleAccess: boolean;
  /** Stationnement possible */
  parkingAvailable: boolean;
  /** Ascenseur disponible */
  elevatorAvailable?: boolean;
  /** Restrictions horaires */
  timeRestrictions?: string;
  /** Contraintes spécifiques */
  specificConstraints?: string[];
}

export interface SiteOccupancy {
  /** Site occupé pendant travaux */
  occupiedDuringWorks: boolean;
  /** Type d'occupation */
  occupancyType?: 'owner' | 'tenant' | 'vacant' | 'mixed';
  /** Nombre d'occupants */
  occupantsCount?: number;
  /** Présence d'activité */
  businessActivity?: boolean;
  /** Contraintes liées à l'occupation */
  occupancyConstraints?: string;
}

// =============================================================================
// CONTEXTE DE L'INTERVENTION
// =============================================================================

export interface InterventionContext {
  /** Type de projet/mission */
  projectType: B2BProjectType;
  /** Nature de la demande */
  requestNature: RequestNature;
  /** Origine du contact */
  leadSource?: LeadSource;
  /** Référence appel d'offres/consultation */
  tenderRef?: string;
  /** Budget client communiqué */
  clientBudget?: ClientBudget;
  /** Délais souhaités */
  timeline?: ProjectTimeline;
  /** Exigences spécifiques */
  requirements?: string[];
  /** Documents fournis par le client */
  clientDocuments?: ClientDocument[];
}

export type B2BProjectType =
  | 'renovation_globale'
  | 'renovation_energetique'
  | 'extension'
  | 'amenagement'
  | 'mise_aux_normes'
  | 'maintenance'
  | 'expertise'
  | 'audit'
  | 'construction_neuve'
  | 'demolition'
  | 'autre';

export type RequestNature =
  | 'devis'                 // Demande de devis simple
  | 'consultation'          // Consultation multi-entreprises
  | 'appel_offres'          // Appel d'offres formel
  | 'marche_public'         // Marché public
  | 'urgence'               // Intervention urgente
  | 'contrat_cadre'         // Dans le cadre d'un contrat existant
  | 'recommandation';       // Recommandation/partenariat

export type LeadSource =
  | 'direct'                // Contact direct
  | 'site_web'              // Via le site web
  | 'recommandation'        // Bouche à oreille
  | 'partenaire'            // Via un partenaire
  | 'appel_offres'          // Réponse à AO
  | 'ancien_client'         // Client existant
  | 'prospection'           // Prospection commerciale
  | 'autre';

export interface ClientBudget {
  /** Budget min communiqué */
  min?: number;
  /** Budget max communiqué */
  max?: number;
  /** Budget cible */
  target?: number;
  /** Flexibilité budgétaire */
  flexibility?: 'strict' | 'negociable' | 'a_definir';
  /** Notes budget */
  notes?: string;
}

export interface ProjectTimeline {
  /** Date de démarrage souhaitée */
  desiredStartDate?: string;
  /** Date de fin souhaitée */
  desiredEndDate?: string;
  /** Urgence */
  urgency: 'immediate' | 'court_terme' | 'moyen_terme' | 'long_terme' | 'flexible';
  /** Contraintes de planning */
  constraints?: string[];
}

export interface ClientDocument {
  /** Type de document */
  type: ClientDocumentType;
  /** Nom du fichier */
  fileName: string;
  /** URL du fichier */
  fileUrl?: string;
  /** Statut de réception */
  status: 'recu' | 'en_attente' | 'non_requis';
  /** Notes */
  notes?: string;
}

export type ClientDocumentType =
  | 'plans_existants'
  | 'diagnostics'
  | 'dce_client'
  | 'cctp_client'
  | 'photos'
  | 'permis_construire'
  | 'reglement_copro'
  | 'autre';

// =============================================================================
// MÉTADONNÉES
// =============================================================================

export interface ClientMetadata {
  /** Date de création */
  createdAt: string;
  /** Date de modification */
  updatedAt: string;
  /** Créé par (user ID) */
  createdBy: string;
  /** Source des données */
  dataSource: 'manual' | 'import' | 'crm' | 'api';
  /** Qualité des données (0-100) */
  dataQuality?: number;
}

// =============================================================================
// ANALYSE CONTEXTUELLE (pour génération documents)
// =============================================================================

export interface ClientAnalysis {
  /** Profil déduit du client */
  inferredProfile: InferredClientProfile;
  /** Complexité estimée du projet */
  projectComplexity: ComplexityLevel;
  /** Risques identifiés */
  identifiedRisks: IdentifiedRisk[];
  /** Documents à générer */
  suggestedDocuments: SuggestedDocument[];
  /** Points d'attention */
  attentionPoints: string[];
  /** Recommandations */
  recommendations: string[];
}

export interface InferredClientProfile {
  /** Segment client */
  segment: 'premium' | 'standard' | 'economique';
  /** Niveau d'exigence attendu */
  exigenceLevel: 'haute' | 'moyenne' | 'standard';
  /** Sensibilité prix */
  priceSensitivity: 'faible' | 'moyenne' | 'forte';
  /** Expérience travaux */
  experienceLevel: 'expert' | 'averti' | 'novice';
  /** Autonomie décisionnelle */
  decisionAutonomy: 'autonome' | 'partielle' | 'hierarchique';
}

export type ComplexityLevel = 'simple' | 'moderee' | 'complexe' | 'tres_complexe';

export interface IdentifiedRisk {
  /** Type de risque */
  type: 'technique' | 'financier' | 'planning' | 'relationnel' | 'juridique';
  /** Description */
  description: string;
  /** Niveau */
  level: 'faible' | 'moyen' | 'eleve';
  /** Mitigation suggérée */
  mitigation?: string;
}

export interface SuggestedDocument {
  /** Type de document */
  type: 'devis' | 'cctp' | 'planning' | 'dpgf' | 'memoire_technique' | 'attestations';
  /** Priorité */
  priority: 'obligatoire' | 'recommande' | 'optionnel';
  /** Raison */
  reason: string;
}
