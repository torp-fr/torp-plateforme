/**
 * TORP Phase 0 - Types Budget et Financement
 * Module 0.6 : Budget et Financement
 *
 * Estimation détaillée des coûts et identification des sources de financement
 * pour les projets de construction/rénovation en France
 */

import type {
  TORPMetadata,
  ConfidenceLevel,
  EstimationRange,
} from './common.types';
import type { OwnerType } from './owner.types';

// =============================================================================
// PLAN BUDGÉTAIRE GLOBAL
// =============================================================================

export interface BudgetPlan {
  id: string;
  projectId: string;

  // Synthèse
  summary: BudgetSummary;

  // Estimation détaillée des coûts
  costEstimation: DetailedCostEstimation;

  // Sources de financement
  financingPlan: FinancingPlan;

  // Aides et subventions
  aidesAnalysis: AidesAnalysis;

  // Plan de trésorerie
  cashFlowPlan: CashFlowPlan;

  // Optimisations
  optimizations: BudgetOptimization[];

  // Risques financiers
  financialRisks: FinancialRisk[];

  // ROI (si applicable)
  returnOnInvestment?: ROIAnalysis;

  torpMetadata: TORPMetadata;
}

export interface BudgetSummary {
  // Totaux
  totalWorksHT: number;
  totalIndirectCostsHT: number;
  contingencyAmount: number;
  totalHT: number;
  totalVAT: number;
  totalTTC: number;

  // Financement
  totalFunding: number;
  personalContribution: number;
  externalFinancing: number;
  totalAides: number;
  remainingToFinance: number;

  // Indicateurs
  financingCoverage: number;  // %
  aidesCoverage: number;      // %
  debtRatio?: number;         // % si crédit
  monthlyPayment?: number;    // Si crédit

  // Status
  status: BudgetStatus;
  confidence: ConfidenceLevel;
  lastUpdated: string;
}

export type BudgetStatus =
  | 'preliminary'            // Estimation préliminaire
  | 'detailed'               // Estimation détaillée
  | 'validated'              // Budget validé
  | 'committed';             // Budget engagé

// =============================================================================
// ESTIMATION DÉTAILLÉE DES COÛTS
// =============================================================================

export interface DetailedCostEstimation {
  // Coûts directs travaux (80-85%)
  directCosts: DirectCosts;

  // Coûts indirects et frais annexes (15-20%)
  indirectCosts: IndirectCosts;

  // Aléas et imprévus (10-15%)
  contingency: ContingencyProvision;

  // TVA
  vatCalculation: VATCalculation;

  // Sources des prix
  priceSources: PriceSource[];
}

// -----------------------------------------------------------------------------
// Coûts Directs (Travaux)
// -----------------------------------------------------------------------------

export interface DirectCosts {
  totalHT: number;
  percentage: number;        // % du budget total
  lots: LotCost[];
}

export interface LotCost {
  lotNumber: number;
  lotCode: string;
  lotName: string;
  category: WorksCostCategory;

  // Décomposition
  breakdown: CostBreakdown;

  // Total
  totalHT: number;
  percentage: number;        // % des coûts directs

  // Détail par poste
  items: CostItem[];

  // Estimation
  estimation: CostEstimationMethod;
  confidence: ConfidenceLevel;
}

export type WorksCostCategory =
  | 'gros_oeuvre'
  | 'second_oeuvre'
  | 'equipements'
  | 'finitions'
  | 'exterieurs';

export interface CostBreakdown {
  materials: number;         // Fournitures
  labor: number;             // Main d'œuvre
  equipment: number;         // Matériel/outillage
  subcontracting?: number;   // Sous-traitance
  overhead: number;          // Frais généraux inclus
}

export interface CostItem {
  id: string;
  reference: string;
  description: string;
  unit: string;
  quantity: number;

  // Prix unitaires
  materialUnitPrice: number;
  laborUnitPrice: number;
  totalUnitPrice: number;

  // Totaux
  materialTotal: number;
  laborTotal: number;
  totalHT: number;

  // Métadonnées
  priceSource: string;
  priceDate: string;
  coefficient?: number;      // Coefficient de majoration
  notes?: string;
}

export interface CostEstimationMethod {
  method: EstimationMethod;
  sources: string[];
  dateReference: string;
  localCoefficient?: number;
  complexityCoefficient?: number;
}

export type EstimationMethod =
  | 'batiprix'               // Base Batiprix
  | 'ffb'                    // Indices FFB
  | 'quotes'                 // Devis réels
  | 'historical'             // Données historiques TORP
  | 'ai_estimation'          // Estimation IA
  | 'mixed';                 // Combinaison

// -----------------------------------------------------------------------------
// Coûts Indirects
// -----------------------------------------------------------------------------

export interface IndirectCosts {
  totalHT: number;
  percentage: number;        // % du budget total

  // Conception / Études
  designCosts: DesignCosts;

  // Administratif / Juridique
  administrativeCosts: AdministrativeCosts;

  // Contrôles / Diagnostics
  inspectionCosts: InspectionCosts;

  // Assurances
  insuranceCosts: InsuranceCosts;

  // Raccordements / Frais fixes
  connectionCosts: ConnectionCosts;

  // Taxes
  taxCosts: TaxCosts;

  // Divers
  miscellaneousCosts: MiscellaneousCosts;
}

export interface DesignCosts {
  totalHT: number;
  items: DesignCostItem[];
}

export interface DesignCostItem {
  type: DesignServiceType;
  description: string;
  estimatedCost: EstimationRange;
  basis: DesignFeeBasis;
  percentage?: number;       // Si % du montant travaux
  mandatory: boolean;
  notes?: string;
}

export type DesignServiceType =
  | 'architect'              // Architecte
  | 'structural_engineer'    // Bureau d'études structure
  | 'mep_engineer'           // Bureau d'études fluides
  | 'thermal_engineer'       // Bureau d'études thermique
  | 'geotechnical'           // Géotechnicien
  | 'surveyor'               // Géomètre
  | 'interior_designer'      // Architecte d'intérieur
  | 'landscape_architect'    // Paysagiste
  | 'project_manager'        // Maîtrise d'œuvre
  | 'opc'                    // Ordonnancement Pilotage Coordination
  | 'other';

export type DesignFeeBasis =
  | 'percentage'             // % du montant travaux
  | 'fixed'                  // Forfait
  | 'hourly'                 // Taux horaire
  | 'mixed';

export interface AdministrativeCosts {
  totalHT: number;
  items: AdministrativeCostItem[];
}

export interface AdministrativeCostItem {
  type: AdministrativeServiceType;
  description: string;
  estimatedCost: EstimationRange;
  mandatory: boolean;
}

export type AdministrativeServiceType =
  | 'permit_filing'          // Dépôt urbanisme
  | 'notary'                 // Notaire
  | 'lawyer'                 // Avocat
  | 'surveyor_boundary'      // Bornage
  | 'condo_syndicate'        // Syndic copropriété
  | 'other';

export interface InspectionCosts {
  totalHT: number;
  items: InspectionCostItem[];
}

export interface InspectionCostItem {
  type: InspectionType;
  description: string;
  estimatedCost: EstimationRange;
  mandatory: boolean;
  provider?: string;
}

export type InspectionType =
  | 'mandatory_diagnostics'  // Diagnostics obligatoires
  | 'technical_control'      // Bureau de contrôle
  | 'air_tightness'          // Test étanchéité air
  | 'consuel'                // Contrôle électrique
  | 'qualigaz'               // Contrôle gaz
  | 'spanc'                  // Contrôle assainissement
  | 'other';

export interface InsuranceCosts {
  totalHT: number;
  items: InsuranceCostItem[];
}

export interface InsuranceCostItem {
  type: InsuranceType;
  description: string;
  estimatedCost: EstimationRange;
  basis: InsuranceBasis;
  percentage?: number;
  mandatory: boolean;
  provider?: string;
}

export type InsuranceType =
  | 'dommage_ouvrage'        // Dommage-ouvrage
  | 'cnr'                    // Constructeur Non Réalisateur
  | 'trc'                    // Tous Risques Chantier
  | 'rc_maitre_ouvrage'      // RC Maître d'ouvrage
  | 'other';

export type InsuranceBasis =
  | 'percentage'             // % du coût travaux
  | 'fixed'                  // Prime fixe
  | 'risk_based';            // Selon risques

export interface ConnectionCosts {
  totalHT: number;
  items: ConnectionCostItem[];
}

export interface ConnectionCostItem {
  type: ConnectionType;
  description: string;
  estimatedCost: EstimationRange;
  provider: string;
  mandatory: boolean;
  distance?: number;         // ml si tranchée
}

export type ConnectionType =
  | 'electricity'            // Raccordement électrique
  | 'gas'                    // Raccordement gaz
  | 'water'                  // Raccordement eau
  | 'sewer'                  // Raccordement assainissement
  | 'telecom'                // Raccordement télécom/fibre
  | 'district_heating';      // Raccordement réseau chaleur

export interface TaxCosts {
  totalHT: number;
  items: TaxCostItem[];
}

export interface TaxCostItem {
  type: TaxType;
  description: string;
  estimatedAmount: number;
  basis: string;
  calculation?: TaxCalculationDetail;
}

export type TaxType =
  | 'taxe_amenagement'       // Taxe d'aménagement
  | 'rap'                    // Redevance Archéologie Préventive
  | 'versement_transport'    // Versement pour sous-densité
  | 'participation_vrd'      // Participation VRD
  | 'other';

export interface TaxCalculationDetail {
  taxableSurface: number;
  forfaitaryValue: number;
  communalRate: number;
  departmentalRate: number;
  regionalRate?: number;
  exemptions?: TaxExemptionDetail[];
  reductions?: TaxReductionDetail[];
}

export interface TaxExemptionDetail {
  type: string;
  surface: number;
  reason: string;
}

export interface TaxReductionDetail {
  type: string;
  percentage: number;
  reason: string;
}

export interface MiscellaneousCosts {
  totalHT: number;
  items: MiscellaneousCostItem[];
}

export interface MiscellaneousCostItem {
  type: MiscellaneousCostType;
  description: string;
  estimatedCost: EstimationRange;
}

export type MiscellaneousCostType =
  | 'moving'                 // Déménagement
  | 'storage'                // Garde-meubles
  | 'temporary_housing'      // Relogement temporaire
  | 'site_cleaning'          // Nettoyage fin chantier
  | 'landscaping'            // Aménagement extérieur
  | 'other';

// -----------------------------------------------------------------------------
// Aléas et Imprévus
// -----------------------------------------------------------------------------

export interface ContingencyProvision {
  percentage: number;        // % du budget travaux
  amount: number;
  rationale: ContingencyRationale;
  breakdown?: ContingencyBreakdown;
}

export interface ContingencyRationale {
  baseRisk: ContingencyRiskLevel;
  factors: ContingencyFactor[];
  historicalData?: number;   // % moyen sur projets similaires
}

export type ContingencyRiskLevel =
  | 'low'                    // 5-8%
  | 'medium'                 // 8-12%
  | 'high'                   // 12-15%
  | 'very_high';             // 15-20%

export interface ContingencyFactor {
  factor: string;
  impact: 'increase' | 'decrease';
  adjustment: number;        // % ajustement
}

export interface ContingencyBreakdown {
  hiddenWorks: number;       // Travaux cachés
  changeOrders: number;      // Modifications chantier
  priceVariation: number;    // Variation prix
  delays: number;            // Retards
  other: number;
}

// -----------------------------------------------------------------------------
// TVA
// -----------------------------------------------------------------------------

export interface VATCalculation {
  totalVAT: number;
  details: VATDetail[];
  eligibleForReducedVAT: boolean;
  reducedVATConditions?: string[];
}

export interface VATDetail {
  category: string;
  baseHT: number;
  vatRate: VATRate;
  vatAmount: number;
  totalTTC: number;
}

export type VATRate =
  | 20                       // Taux normal
  | 10                       // Taux intermédiaire (rénovation)
  | 5.5                      // Taux réduit (travaux énergétiques)
  | 2.1;                     // Taux super-réduit (DOM)

// =============================================================================
// SOURCES DE FINANCEMENT
// =============================================================================

export interface FinancingPlan {
  totalRequired: number;
  sources: FinancingSource[];
  summary: FinancingSummary;
  feasibility: FinancingFeasibility;
}

export interface FinancingSource {
  id: string;
  type: FinancingType;
  name: string;
  description: string;

  // Montants
  amount: number;
  percentage: number;        // % du total

  // Statut
  status: FinancingStatus;

  // Détails spécifiques
  details: FinancingDetails;

  // Conditions
  conditions?: string[];

  // Documents requis
  requiredDocuments?: string[];
}

export type FinancingType =
  // Apport personnel
  | 'personal_savings'       // Épargne personnelle
  | 'sale_proceeds'          // Produit de vente
  | 'family_contribution'    // Apport familial
  // Crédit bancaire
  | 'mortgage'               // Prêt immobilier
  | 'renovation_loan'        // Prêt travaux
  | 'consumer_loan'          // Crédit consommation
  // Prêts aidés
  | 'eco_ptz'                // Éco-PTZ
  | 'ptz'                    // PTZ classique
  | 'ptz_plus'               // PTZ+
  | 'pret_action_logement'   // Prêt Action Logement
  | 'pret_epargne_logement'  // PEL/CEL
  // Aides
  | 'maprimerénov'           // MaPrimeRénov'
  | 'maprimerénov_copro'     // MaPrimeRénov' Copropriété
  | 'cee'                    // Certificats Économie Énergie
  | 'anah'                   // ANAH (hors MPR)
  | 'local_grant'            // Aide locale (commune, département)
  | 'regional_grant'         // Aide régionale
  | 'caisse_retraite'        // Caisse de retraite
  | 'action_logement_grant'  // Subvention Action Logement
  // Fiscal
  | 'tax_credit'             // Crédit d'impôt
  | 'reduced_vat'            // TVA réduite
  | 'tax_deduction'          // Déduction fiscale (déficit foncier)
  // Autres
  | 'crowdfunding'           // Financement participatif
  | 'other';

export type FinancingStatus =
  | 'confirmed'              // Confirmé
  | 'in_progress'            // En cours d'obtention
  | 'to_apply'               // À demander
  | 'estimated'              // Estimation
  | 'rejected';              // Refusé

export type FinancingDetails =
  | PersonalFundsDetails
  | LoanDetails
  | AidDetails
  | TaxBenefitDetails;

export interface PersonalFundsDetails {
  type: 'personal_funds';
  source: string;
  availableDate?: string;
  documentation?: string;
}

export interface LoanDetails {
  type: 'loan';
  lender?: string;
  rate?: number;             // % taux nominal
  taeg?: number;             // % TAEG
  duration: number;          // mois
  monthlyPayment: number;
  totalInterest: number;
  totalCost: number;
  insuranceIncluded: boolean;
  insuranceCost?: number;
  startDate?: string;
  deferral?: number;         // mois de différé
  earlyRepaymentAllowed: boolean;
  earlyRepaymentPenalty?: number;
}

export interface AidDetails {
  type: 'aid';
  provider: string;
  program: string;
  eligibilityConfirmed: boolean;
  applicationDeadline?: string;
  disbursementTiming: DisbursementTiming;
  disbursementDelay?: string;
  stackableWith?: string[];
  exclusiveOf?: string[];
}

export type DisbursementTiming =
  | 'before_works'           // Avant travaux
  | 'during_works'           // Pendant travaux
  | 'after_works'            // Après travaux
  | 'tax_year';              // Année fiscale

export interface TaxBenefitDetails {
  type: 'tax_benefit';
  mechanism: TaxMechanism;
  benefitAmount: number;
  spreadYears?: number;
  conditions: string[];
}

export type TaxMechanism =
  | 'credit_impot'           // Crédit d'impôt
  | 'reduction_impot'        // Réduction d'impôt
  | 'deduction_revenus'      // Déduction des revenus
  | 'tva_reduite';           // TVA à taux réduit

export interface FinancingSummary {
  personalContribution: number;
  personalContributionPct: number;
  borrowedAmount: number;
  borrowedAmountPct: number;
  aidAmount: number;
  aidAmountPct: number;
  taxBenefitAmount: number;
  taxBenefitAmountPct: number;
}

export interface FinancingFeasibility {
  feasible: boolean;
  debtRatio?: number;        // % taux d'endettement
  maxDebtRatio: number;      // 35% généralement
  remainingToFinance: number;
  monthlyBudgetImpact: number;
  warnings: FinancingWarning[];
  recommendations: FinancingRecommendation[];
}

export interface FinancingWarning {
  type: 'high_debt_ratio' | 'insufficient_funds' | 'timing_issue' | 'eligibility_risk';
  message: string;
  severity: 'info' | 'warning' | 'error';
}

export interface FinancingRecommendation {
  action: string;
  benefit: string;
  impact?: number;
}

// =============================================================================
// AIDES ET SUBVENTIONS
// =============================================================================

export interface AidesAnalysis {
  ownerType: OwnerType;
  eligibilityProfile: EligibilityProfile;
  eligibleAides: EligibleAide[];
  ineligibleAides: IneligibleAide[];
  totalPotential: number;
  totalConfirmed: number;
  optimizations: AideOptimization[];
}

export interface EligibilityProfile {
  // Revenus (pour B2C)
  revenuFiscalReference?: number;
  numberOfParts?: number;
  incomeCategory?: IncomeCategory;

  // Bien
  propertyAge: number;
  isMainResidence: boolean;
  ownershipStatus: string;

  // Projet
  workTypes: string[];
  energyGain?: number;       // % gain DPE
  rgeRequired: boolean;
  hasRgeContractor: boolean;
}

export type IncomeCategory =
  | 'tres_modeste'           // MaPrimeRénov' Bleu
  | 'modeste'                // MaPrimeRénov' Jaune
  | 'intermediaire'          // MaPrimeRénov' Violet
  | 'superieur';             // MaPrimeRénov' Rose

export interface EligibleAide {
  id: string;
  name: string;
  provider: string;
  type: AideType;

  // Montant
  estimatedAmount: number;
  maxAmount?: number;
  calculationBasis: string;

  // Éligibilité
  eligibilityScore: number;  // 0-100
  eligibilityConditions: EligibilityCondition[];

  // Cumul
  stackable: boolean;
  stackableWith: string[];
  exclusiveOf: string[];

  // Procédure
  applicationProcedure: ApplicationProcedure;

  // Timing
  timing: AideTiming;
}

export type AideType =
  | 'grant'                  // Subvention
  | 'subsidized_loan'        // Prêt bonifié
  | 'tax_credit'             // Crédit d'impôt
  | 'tax_reduction'          // Réduction d'impôt
  | 'vat_reduction'          // TVA réduite
  | 'cee_prime';             // Prime CEE

export interface EligibilityCondition {
  condition: string;
  met: boolean;
  notes?: string;
}

export interface ApplicationProcedure {
  steps: ApplicationStep[];
  documents: string[];
  onlinePortal?: string;
  deadline?: string;
  processingTime: string;
}

export interface ApplicationStep {
  order: number;
  action: string;
  when: 'before_quotes' | 'before_works' | 'during_works' | 'after_works';
  responsible: 'owner' | 'contractor' | 'both';
}

export interface AideTiming {
  applicationTiming: 'before_quotes' | 'before_works' | 'after_works';
  disbursementTiming: DisbursementTiming;
  disbursementDelay: string;
}

export interface IneligibleAide {
  id: string;
  name: string;
  reason: string;
  workaround?: string;
}

export interface AideOptimization {
  description: string;
  currentAmount: number;
  optimizedAmount: number;
  gain: number;
  actions: string[];
}

// =============================================================================
// AIDES DÉTAILLÉES PAR TYPE
// =============================================================================

// -----------------------------------------------------------------------------
// MaPrimeRénov' (B2C)
// -----------------------------------------------------------------------------

export interface MaPrimeRenovAnalysis {
  eligible: boolean;
  parcours: MaPrimeRenovParcours;
  colorCategory: IncomeCategory;
  details: MaPrimeRenovDetails;
}

export type MaPrimeRenovParcours =
  | 'par_geste'              // Aides par geste
  | 'accompagne'             // Parcours accompagné (rénovation globale)
  | 'copropriete';           // Copropriété

export interface MaPrimeRenovDetails {
  // Par geste
  aideParGeste?: MaPrimeRenovGeste[];

  // Parcours accompagné
  parcoursAccompagne?: MaPrimeRenovAccompagne;

  // Total
  totalEligible: number;
  bonuses: MaPrimeRenovBonus[];
}

export interface MaPrimeRenovGeste {
  workType: MaPrimeRenovWorkType;
  description: string;
  unit: string;
  quantity: number;
  unitAmount: number;
  maxQuantity?: number;
  totalAmount: number;
  rgeRequired: boolean;
}

export type MaPrimeRenovWorkType =
  // Isolation
  | 'isolation_murs_ext'
  | 'isolation_murs_int'
  | 'isolation_toiture'
  | 'isolation_combles'
  | 'isolation_planchers'
  // Menuiseries
  | 'fenetres'
  | 'portes_fenetres'
  // Chauffage
  | 'pac_air_eau'
  | 'pac_geothermique'
  | 'chaudiere_biomasse'
  | 'poele_granules'
  | 'poele_buches'
  | 'insert'
  // Eau chaude
  | 'chauffe_eau_thermodynamique'
  | 'chauffe_eau_solaire'
  // Ventilation
  | 'vmc_double_flux'
  // Autres
  | 'depose_cuve_fioul'
  | 'audit_energetique';

export interface MaPrimeRenovAccompagne {
  eligible: boolean;
  currentDPE: string;
  targetDPE: string;
  gainClasses: number;
  worksCost: number;
  aidPercentage: number;
  maxAid: number;
  calculatedAid: number;
  accompagnatorCost: number;
  accompagnatorAid: number;
}

export interface MaPrimeRenovBonus {
  type: MaPrimeRenovBonusType;
  amount: number;
  condition: string;
  applicable: boolean;
}

export type MaPrimeRenovBonusType =
  | 'sortie_passoire'        // Sortie de passoire énergétique
  | 'bbc'                    // Atteinte BBC
  | 'copropriete_fragile';   // Copropriété fragile

// -----------------------------------------------------------------------------
// Éco-PTZ
// -----------------------------------------------------------------------------

export interface EcoPTZAnalysis {
  eligible: boolean;
  version: EcoPTZVersion;
  maxAmount: number;
  duration: number;          // mois
  workCategories: EcoPTZWorkCategory[];
  estimatedAmount: number;
  conditions: string[];
}

export type EcoPTZVersion =
  | 'eco_ptz_individuel'
  | 'eco_ptz_copropriete'
  | 'eco_ptz_performance_globale';

export interface EcoPTZWorkCategory {
  category: string;
  eligible: boolean;
  works: string[];
}

// -----------------------------------------------------------------------------
// CEE (Certificats d'Économie d'Énergie)
// -----------------------------------------------------------------------------

export interface CEEAnalysis {
  eligible: boolean;
  operations: CEEOperation[];
  totalPrime: number;
  operators: CEEOperator[];
}

export interface CEEOperation {
  code: string;              // Ex: BAR-EN-101
  name: string;
  workType: string;
  primeForfaitaire?: number;
  primeCalculee?: number;
  calculationBasis?: string;
  conditions: string[];
}

export interface CEEOperator {
  name: string;
  type: 'energy_provider' | 'distributor' | 'aggregator';
  offer: number;
  deadline?: string;
  url?: string;
}

// -----------------------------------------------------------------------------
// Aides Locales
// -----------------------------------------------------------------------------

export interface LocalAidesAnalysis {
  region: LocalAide[];
  department: LocalAide[];
  intercommunality: LocalAide[];
  municipality: LocalAide[];
}

export interface LocalAide {
  id: string;
  name: string;
  provider: string;
  providerType: 'region' | 'department' | 'epci' | 'commune';
  eligibleWorks: string[];
  amount: EstimationRange;
  stackable: boolean;
  conditions: string[];
  applicationUrl?: string;
  contactInfo?: string;
}

// =============================================================================
// PLAN DE TRÉSORERIE
// =============================================================================

export interface CashFlowPlan {
  // Paramètres
  parameters: CashFlowParameters;

  // Échéancier des dépenses
  expenditureSchedule: ExpenditureItem[];

  // Échéancier des recettes
  incomeSchedule: IncomeItem[];

  // Flux nets
  monthlyFlows: MonthlyFlow[];

  // Besoins de trésorerie
  treasuryNeeds: TreasuryNeeds;

  // Optimisation
  optimizations: CashFlowOptimization[];
}

export interface CashFlowParameters {
  startDate: string;
  endDate: string;
  currency: string;
  inflationRate?: number;
}

export interface ExpenditureItem {
  id: string;
  description: string;
  category: ExpenditureCategory;
  amount: number;
  date: string;
  month: number;             // Mois relatif au démarrage
  paymentType: PaymentType;
  recipient?: string;
}

export type ExpenditureCategory =
  | 'design'                 // Conception
  | 'permits'                // Autorisations
  | 'works'                  // Travaux
  | 'equipment'              // Équipements
  | 'insurance'              // Assurances
  | 'taxes'                  // Taxes
  | 'other';

export type PaymentType =
  | 'advance'                // Acompte
  | 'progress'               // Situation
  | 'final'                  // Solde
  | 'retention_release';     // Levée retenue

export interface IncomeItem {
  id: string;
  description: string;
  source: FinancingType;
  amount: number;
  date: string;
  month: number;
  status: 'confirmed' | 'expected' | 'conditional';
  conditions?: string[];
}

export interface MonthlyFlow {
  month: number;
  date: string;
  expenditures: number;
  income: number;
  netFlow: number;
  cumulativeBalance: number;
  treasuryNeed: number;
}

export interface TreasuryNeeds {
  maxNegativeBalance: number;
  maxNegativeMonth: number;
  bridgingRequired: boolean;
  bridgingAmount?: number;
  bridgingDuration?: number;
  recommendations: string[];
}

export interface CashFlowOptimization {
  description: string;
  impact: number;
  implementation: string;
}

// =============================================================================
// OPTIMISATIONS ET ANALYSES
// =============================================================================

export interface BudgetOptimization {
  id: string;
  type: OptimizationType;
  description: string;
  currentCost: number;
  optimizedCost: number;
  savings: number;
  savingsPercentage: number;
  tradeoffs?: string[];
  implementation: string;
  priority: 'high' | 'medium' | 'low';
}

export type OptimizationType =
  | 'material_substitution'  // Substitution matériau
  | 'scope_reduction'        // Réduction périmètre
  | 'phasing'                // Phasage travaux
  | 'aide_optimization'      // Optimisation aides
  | 'financing_optimization' // Optimisation financement
  | 'contractor_negotiation' // Négociation entreprise
  | 'diy_partial'            // Auto-construction partielle
  | 'grouping';              // Regroupement travaux

export interface FinancialRisk {
  id: string;
  type: FinancialRiskType;
  description: string;
  probability: 'high' | 'medium' | 'low';
  impact: number;            // €
  mitigation: string;
  contingencyAllocation?: number;
}

export type FinancialRiskType =
  | 'cost_overrun'           // Dépassement budget
  | 'hidden_works'           // Travaux cachés
  | 'price_increase'         // Hausse prix matériaux
  | 'contractor_default'     // Défaillance entreprise
  | 'delay_penalty'          // Pénalités retard
  | 'aide_rejection'         // Refus aide
  | 'financing_issue'        // Problème financement
  | 'regulatory_change';     // Changement réglementation

// =============================================================================
// ROI ET RENTABILITÉ
// =============================================================================

export interface ROIAnalysis {
  applicable: boolean;
  projectType: ROIProjectType;

  // Investissement
  totalInvestment: number;
  netInvestment: number;     // Après aides

  // Gains
  gains: ROIGain[];
  totalAnnualGains: number;

  // Indicateurs
  simplePayback: number;     // années
  discountedPayback?: number;
  npv?: number;              // Valeur Actuelle Nette
  irr?: number;              // Taux Rendement Interne

  // Valorisation
  propertyValueIncrease?: PropertyValueIncrease;

  // Graphiques
  cashFlowProjection?: YearlyProjection[];
}

export type ROIProjectType =
  | 'energy_renovation'      // Rénovation énergétique
  | 'rental_investment'      // Investissement locatif
  | 'value_increase'         // Plus-value patrimoniale
  | 'maintenance_saving';    // Économie maintenance

export interface ROIGain {
  type: ROIGainType;
  description: string;
  annualAmount: number;
  certainty: 'guaranteed' | 'estimated' | 'potential';
  duration?: number;         // années
  indexation?: number;       // % annuel
}

export type ROIGainType =
  | 'energy_savings'         // Économies énergie
  | 'maintenance_savings'    // Économies entretien
  | 'rental_income'          // Revenus locatifs
  | 'rental_increase'        // Augmentation loyer
  | 'tax_benefit'            // Avantage fiscal
  | 'avoided_costs';         // Coûts évités

export interface PropertyValueIncrease {
  currentValue: number;
  estimatedValueAfter: number;
  increase: number;
  increasePercentage: number;
  basis: string;
  confidence: ConfidenceLevel;
}

export interface YearlyProjection {
  year: number;
  investment: number;
  gains: number;
  netCashFlow: number;
  cumulativeCashFlow: number;
}

// =============================================================================
// COMPARATEUR OFFRES
// =============================================================================

export interface LoanComparator {
  loans: LoanOffer[];
  bestOffer?: string;
  comparisonCriteria: ComparisonCriterion[];
}

export interface LoanOffer {
  id: string;
  lender: string;
  productName: string;
  amount: number;
  duration: number;          // mois
  nominalRate: number;       // %
  taeg: number;              // %
  monthlyPayment: number;
  totalInterest: number;
  totalCost: number;
  insuranceRequired: boolean;
  insuranceCost?: number;
  applicationFees?: number;
  guaranteeFees?: number;
  earlyRepaymentPenalty?: number;
  conditions: string[];
  expirationDate?: string;
  score: number;             // Score comparatif
}

export interface ComparisonCriterion {
  name: string;
  weight: number;
  bestValue: 'lowest' | 'highest';
}
