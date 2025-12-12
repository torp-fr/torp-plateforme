/**
 * TORP Phase 0 - Types du Maître d'Ouvrage (MOA)
 * Module 0.1 : Qualification du Porteur de Projet
 */

import type {
  TORPMetadata,
  ContactInfo,
  Address,
  DocumentReference,
  ConfidenceLevel,
} from './common.types';

// =============================================================================
// PROFIL PRINCIPAL DU MAÎTRE D'OUVRAGE
// =============================================================================

export interface MasterOwnerProfile {
  id: string;
  identity: OwnerIdentity;
  contact: ContactInfo;
  ownerStatus: OwnerStatus;
  experience: ProjectExperience;
  expertise: ExpertiseLevel;
  psychology: PsychologicalProfile;
  financialCapacity: FinancialCapacity;
  availability: Availability;
  documents: DocumentReference[];
  torpMetadata: TORPMetadata;
}

// =============================================================================
// IDENTITÉ DU MAÎTRE D'OUVRAGE
// =============================================================================

export type OwnerType = 'B2C' | 'B2B' | 'B2G';

export type OwnerIdentity =
  | IndividualIdentity
  | CompanyIdentity
  | PublicEntityIdentity;

export interface IndividualIdentity {
  type: 'B2C';
  civility: Civility;
  firstName: string;
  lastName: string;
  birthDate?: string;
  nationality?: string;
  fiscalResidence?: Address;
  taxNumber?: string;
  maritalStatus?: MaritalStatus;
  numberOfDependents?: number;
}

export interface CompanyIdentity {
  type: 'B2B';
  companyName: string;
  tradeName?: string;
  siret: string;
  siren?: string;
  legalForm: LegalForm;
  nafCode?: string;
  nafLabel?: string;
  registrationDate?: string;
  capitalAmount?: number;
  headOfficeAddress?: Address;
  representativeName: string;
  representativeRole: string;
  companySize?: CompanySize;
  annualRevenue?: number;
}

export interface PublicEntityIdentity {
  type: 'B2G';
  entityName: string;
  collectivityType: CollectivityType;
  siret?: string;
  population?: number;
  annualBudget?: number;
  responsiblePerson: string;
  responsibleRole: string;
  departmentCode?: string;
  regionCode?: string;
}

export type Civility = 'M' | 'Mme' | 'Autre';

export type MaritalStatus =
  | 'single'
  | 'married'
  | 'civil_partnership' // PACS
  | 'divorced'
  | 'widowed'
  | 'separated';

export type LegalForm =
  | 'SARL' | 'SAS' | 'SASU' | 'SA' | 'SCI' | 'SNC'
  | 'EURL' | 'EI' | 'EIRL' | 'Auto-entrepreneur'
  | 'Association' | 'Fondation' | 'GIE' | 'Autre';

export type CompanySize =
  | 'micro'       // < 10 employés
  | 'small'       // 10-49 employés
  | 'medium'      // 50-249 employés
  | 'large'       // 250-4999 employés
  | 'enterprise'; // 5000+ employés

export type CollectivityType =
  | 'commune'
  | 'intercommunalite'
  | 'departement'
  | 'region'
  | 'metropole'
  | 'etablissement_public'
  | 'bailleur_social'
  | 'state_service';

// =============================================================================
// STATUT DE PROPRIÉTAIRE
// =============================================================================

export interface OwnerStatus {
  status: PropertyOwnershipStatus;
  ownershipType?: OwnershipType;
  acquisitionDate?: string;
  acquisitionPrice?: number;
  coOwners?: CoOwner[];
  isMainResidence: boolean;
  occupancyStatus: OccupancyStatus;
  currentTenant?: TenantInfo;
  managementMode?: ManagementMode;
}

export type PropertyOwnershipStatus =
  | 'owner'          // Propriétaire
  | 'co_owner'       // Co-propriétaire
  | 'future_owner'   // Futur acquéreur
  | 'tenant'         // Locataire
  | 'usufructuary'   // Usufruitier
  | 'bare_owner'     // Nu-propriétaire
  | 'beneficiary'    // Bénéficiaire (succession)
  | 'representative' // Mandataire
  | 'administrator'; // Syndic/Administrateur

export type OwnershipType =
  | 'full_ownership'    // Pleine propriété
  | 'usufruct'          // Usufruit
  | 'bare_ownership'    // Nue-propriété
  | 'joint_ownership'   // Indivision
  | 'sci_ownership'     // Via SCI
  | 'leasing';          // Crédit-bail

export interface CoOwner {
  name: string;
  sharePercentage: number;
  relationship?: string;
  isDecisionMaker: boolean;
  contact?: ContactInfo;
}

export type OccupancyStatus =
  | 'owner_occupied'    // Occupé par le propriétaire
  | 'rented'            // Loué
  | 'vacant'            // Vacant
  | 'secondary'         // Résidence secondaire
  | 'seasonal_rental'   // Location saisonnière
  | 'free_accommodation'; // Logement à titre gratuit

export interface TenantInfo {
  leaseType: LeaseType;
  leaseStartDate: string;
  leaseEndDate?: string;
  monthlyRent: number;
  renewalNoticeDeadline?: string;
  tenantAware: boolean;
  relocationAssistanceRequired: boolean;
}

export type LeaseType =
  | 'bare_housing'      // Location nue
  | 'furnished'         // Meublé
  | 'commercial'        // Bail commercial
  | 'professional'      // Bail professionnel
  | 'civil'             // Bail civil
  | 'seasonal';         // Location saisonnière

export type ManagementMode =
  | 'self_managed'      // Gestion directe
  | 'real_estate_agent' // Agence immobilière
  | 'property_manager'  // Administrateur de biens
  | 'trustee';          // Syndic (copropriété)

// =============================================================================
// EXPÉRIENCE ET EXPERTISE
// =============================================================================

export interface ProjectExperience {
  hasCompletedProjects: boolean;
  previousProjectsCount: number;
  previousProjectTypes: PreviousProjectType[];
  lastProjectDate?: string;
  lastProjectAmount?: number;
  lastProjectSatisfaction?: 1 | 2 | 3 | 4 | 5;
  issuesEncountered?: ProjectIssue[];
  preferredCommunicationMethod: CommunicationMethod;
}

export interface PreviousProjectType {
  type: string;
  year: number;
  amount?: number;
  satisfaction?: 1 | 2 | 3 | 4 | 5;
  comments?: string;
}

export type ProjectIssue =
  | 'budget_overrun'
  | 'schedule_delay'
  | 'quality_issues'
  | 'contractor_conflict'
  | 'permit_issues'
  | 'neighbor_disputes'
  | 'none';

export type CommunicationMethod =
  | 'email'
  | 'phone'
  | 'video_call'
  | 'in_person'
  | 'messaging_app';

export interface ExpertiseLevel {
  overallLevel: ExpertiseTier;
  btpKnowledge: ExpertiseTier;
  regulatoryKnowledge: ExpertiseTier;
  financialKnowledge: ExpertiseTier;
  projectManagementCapacity: ExpertiseTier;
  technicalUnderstanding: ExpertiseTier;
  needsAssistance: AssistanceNeed[];
  professionalBackground?: ProfessionalBackground;
}

export type ExpertiseTier =
  | 'novice'         // Débutant, besoin d'accompagnement complet
  | 'beginner'       // Quelques notions, besoin de guidance
  | 'intermediate'   // Expérience moyenne, autonomie partielle
  | 'advanced'       // Bonne maîtrise, supervision ponctuelle
  | 'expert';        // Expert, autonome

export type AssistanceNeed =
  | 'project_definition'    // Définition du projet
  | 'contractor_selection'  // Sélection entreprises
  | 'quote_analysis'        // Analyse devis
  | 'site_supervision'      // Suivi chantier
  | 'administrative'        // Démarches administratives
  | 'financing'             // Montage financier
  | 'technical_design'      // Conception technique
  | 'permits'               // Autorisations
  | 'conflict_resolution'   // Résolution conflits
  | 'none';

export interface ProfessionalBackground {
  industry?: string;
  hasConstructionBackground: boolean;
  hasFinanceBackground: boolean;
  hasLegalBackground: boolean;
  isArchitect: boolean;
  isEngineer: boolean;
  isContractor: boolean;
}

// =============================================================================
// PROFIL PSYCHOLOGIQUE
// =============================================================================

export interface PsychologicalProfile {
  decisionStyle: DecisionStyle;
  riskTolerance: RiskTolerance;
  priorityFactor: PriorityFactor;
  communicationPreference: CommunicationPreference;
  stressFactors: StressFactor[];
  motivations: ProjectMotivation[];
  dealBreakers: DealBreaker[];
}

export type DecisionStyle =
  | 'analytical'     // Analytique - besoin de données détaillées
  | 'intuitive'      // Intuitif - décisions rapides
  | 'collaborative'  // Collaboratif - consultation famille/proches
  | 'delegator'      // Délégateur - fait confiance aux experts
  | 'cautious';      // Prudent - nombreuses vérifications

export type RiskTolerance =
  | 'risk_averse'    // Très prudent
  | 'conservative'   // Conservateur
  | 'moderate'       // Modéré
  | 'risk_tolerant'  // Tolérant au risque
  | 'risk_seeking';  // Preneur de risques

export type PriorityFactor =
  | 'budget'         // Le budget est la priorité
  | 'quality'        // La qualité prime
  | 'speed'          // La rapidité compte
  | 'reliability'    // La fiabilité avant tout
  | 'flexibility'    // Souplesse importante
  | 'sustainability' // Durabilité/écologie
  | 'balanced';      // Équilibré

export type CommunicationPreference =
  | 'detailed'       // Communications détaillées
  | 'summary'        // Synthèses uniquement
  | 'visual'         // Supports visuels
  | 'regular'        // Mises à jour régulières
  | 'on_demand';     // À la demande

export type StressFactor =
  | 'budget_uncertainty'
  | 'schedule_uncertainty'
  | 'contractor_reliability'
  | 'quality_concerns'
  | 'administrative_complexity'
  | 'neighbor_relations'
  | 'living_during_works'
  | 'hidden_defects'
  | 'resale_value';

export type ProjectMotivation =
  | 'comfort_improvement'
  | 'energy_savings'
  | 'value_increase'
  | 'space_expansion'
  | 'compliance_update'
  | 'aesthetic_update'
  | 'family_adaptation'
  | 'accessibility'
  | 'rental_optimization'
  | 'investment_return';

export type DealBreaker =
  | 'exceeds_budget'
  | 'too_long_duration'
  | 'requires_relocation'
  | 'destroys_garden'
  | 'changes_character'
  | 'permit_required'
  | 'neighbor_opposition'
  | 'asbestos_presence'
  | 'structural_issues';

// =============================================================================
// CAPACITÉ FINANCIÈRE
// =============================================================================

export interface FinancialCapacity {
  budgetEnvelope: BudgetEnvelope;
  currentSituation: FinancialSituation;
  fundingSources: FundingSource[];
  eligibleAids: EligibleAid[];
  creditCapacity?: CreditCapacity;
  investmentHorizon?: InvestmentHorizon;
}

export interface BudgetEnvelope {
  minBudget: number;
  maxBudget: number;
  preferredBudget: number;
  flexibility: BudgetFlexibility;
  currency: string;
  includesContingency: boolean;
  contingencyPercentage?: number;
}

export type BudgetFlexibility =
  | 'strict'         // Budget non négociable
  | 'slight'         // Légère flexibilité (+10%)
  | 'moderate'       // Flexibilité modérée (+20%)
  | 'flexible'       // Assez flexible (+30%)
  | 'to_be_defined'; // Budget à définir

export interface FinancialSituation {
  annualIncome?: number;
  householdIncome?: number;
  referenceIncomeTax?: number; // Revenu fiscal de référence (pour aides)
  numberOfParts?: number;      // Parts fiscales
  currentDebtRatio?: number;
  hasOngoingCredit: boolean;
  monthlyRepayments?: number;
  availableSavings?: number;
  propertyValue?: number;      // Valeur du bien actuel
  existingMortgage?: number;   // Reste à rembourser
}

export interface FundingSource {
  type: FundingType;
  amount: number;
  percentage: number;
  status: FundingStatus;
  provider?: string;
  rate?: number;        // Pour crédit
  duration?: number;    // En mois pour crédit
  conditions?: string;
}

export type FundingType =
  | 'personal_savings'
  | 'sale_proceeds'
  | 'mortgage'
  | 'renovation_loan'
  | 'eco_ptz'           // Éco-PTZ
  | 'ptz'               // PTZ classique
  | 'family_loan'
  | 'grant'
  | 'cee'               // Certificats d'économie d'énergie
  | 'maprimerénov'
  | 'local_aid'
  | 'tax_credit'
  | 'other';

export type FundingStatus =
  | 'confirmed'
  | 'in_progress'
  | 'to_apply'
  | 'estimated'
  | 'rejected';

export interface EligibleAid {
  name: string;
  type: AidType;
  estimatedAmount: number;
  maxAmount?: number;
  conditions: string[];
  applicationDeadline?: string;
  stackable: boolean;
  status: AidStatus;
  confidence: ConfidenceLevel;
  sourceApi?: string;
}

export type AidType =
  | 'maprimerénov'
  | 'maprimerénov_copro'
  | 'cee'
  | 'eco_ptz'
  | 'local_grant'
  | 'regional_grant'
  | 'anah'
  | 'action_logement'
  | 'caisse_retraite'
  | 'tax_credit'
  | 'reduced_vat'      // TVA réduite
  | 'other';

export type AidStatus =
  | 'eligible'
  | 'potentially_eligible'
  | 'not_eligible'
  | 'verification_needed'
  | 'applied'
  | 'granted'
  | 'rejected';

export interface CreditCapacity {
  maxLoanAmount: number;
  maxMonthlyPayment: number;
  currentDebtRatio: number;
  maxDebtRatio: number;
  preApproved: boolean;
  preApprovalAmount?: number;
  preApprovalDate?: string;
  preApprovalBank?: string;
}

export type InvestmentHorizon =
  | 'short_term'    // < 5 ans
  | 'medium_term'   // 5-10 ans
  | 'long_term'     // 10-20 ans
  | 'permanent';    // > 20 ans / définitif

// =============================================================================
// DISPONIBILITÉ
// =============================================================================

export interface Availability {
  projectTimeframe: ProjectTimeframe;
  presenceConstraints: PresenceConstraints;
  decisionMakingSpeed: DecisionSpeed;
  meetingAvailability: MeetingAvailability;
  blackoutPeriods: BlackoutPeriod[];
}

export interface ProjectTimeframe {
  desiredStartDate?: string;
  latestStartDate?: string;
  desiredEndDate?: string;
  flexibleDates: boolean;
  preferredSeason?: Season;
  urgencyLevel: UrgencyLevel;
  reason?: string;
}

export type Season = 'spring' | 'summer' | 'autumn' | 'winter' | 'any';

export type UrgencyLevel =
  | 'immediate'     // < 1 mois
  | 'short_term'    // 1-3 mois
  | 'medium_term'   // 3-6 mois
  | 'long_term'     // 6-12 mois
  | 'planning';     // > 12 mois, phase conception

export interface PresenceConstraints {
  canBeOnSite: boolean;
  presenceFrequency?: PresenceFrequency;
  proximityToSite: ProximityLevel;
  hasLocalRepresentative: boolean;
  representativeContact?: ContactInfo;
  canAttendMeetings: boolean;
  preferredMeetingMode: MeetingMode;
}

export type PresenceFrequency =
  | 'daily'
  | 'several_per_week'
  | 'weekly'
  | 'biweekly'
  | 'monthly'
  | 'rarely';

export type ProximityLevel =
  | 'on_site'       // Sur place
  | 'nearby'        // < 30 min
  | 'regional'      // 30 min - 2h
  | 'national'      // > 2h
  | 'international'; // Étranger

export type MeetingMode = 'in_person' | 'video' | 'phone' | 'mixed';

export type DecisionSpeed =
  | 'immediate'     // Décision possible immédiatement
  | 'fast'          // Quelques jours
  | 'moderate'      // 1-2 semaines
  | 'slow'          // 2-4 semaines
  | 'consultative'; // Consultation nécessaire (plusieurs personnes)

export interface MeetingAvailability {
  availableDays: Day[];
  preferredTimeSlots: TimeSlotPreference[];
  noticePeriodDays: number;
  remoteOk: boolean;
}

export type Day =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

export interface TimeSlotPreference {
  day?: Day;
  slot: 'morning' | 'afternoon' | 'evening';
  preferred: boolean;
}

export interface BlackoutPeriod {
  startDate: string;
  endDate: string;
  reason?: string;
  type: 'vacation' | 'professional' | 'family' | 'other';
  worksPossible: boolean;
  contactPossible: boolean;
}
