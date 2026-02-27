/**
 * Strict domain types for Devis Proposal Vectorization
 * Inferred from usage patterns in devis-proposal.embeddings.ts
 *
 * PHASE 36.12: Type safety for devis extraction pipeline
 */

/**
 * Individual line item (poste) in a devis
 * Represents labor, materials, or services with pricing details
 */
export interface PosteData {
  /** Description of the line item */
  designation: string;

  /** Quantity of items */
  quantite?: number;

  /** Unit of measurement (m2, m3, piece, etc.) */
  unite?: string;

  /** Unit price */
  prixUnitaire?: number;

  /** Total price for this line (quantity × unit price or fixed amount) */
  prixTotal: number;

  /** Optional category for classification */
  category?: string;
}

/**
 * Pricing information from a devis
 */
export interface PricingData {
  /** Total amount including tax */
  montantTotal: number;

  /** Pre-tax amount */
  montantHT?: number;

  /** Tax amount (TVA) */
  tva?: number;
}

/**
 * Timeline and scheduling information
 */
export interface TimelineData {
  /** Start date (ISO format) */
  debut?: string;

  /** End date (ISO format) */
  fin?: string;

  /** Whether detailed planning is provided */
  planning_detaille?: boolean;

  /** Project phases */
  phases?: string[];

  /** Key milestones with dates and descriptions */
  jalons?: Array<{
    date: string;
    description: string;
  }>;
}

/**
 * Insurance coverage information
 */
export interface InsuranceData {
  /** 10-year liability coverage (Décennale) */
  decennale?: boolean;

  /** Professional liability insurance */
  rcPro?: boolean;
}

/**
 * Company/contractor information
 */
export interface EntrepriseData {
  /** Company name */
  nom: string;

  /** SIRET business registration number */
  siret?: string;

  /** Business address */
  adresse?: string;

  /** Contact phone number */
  telephone?: string | boolean;

  /** Contact email */
  email?: string | boolean;

  /** Professional certifications (RGE, etc.) */
  certifications?: string[];

  /** Insurance coverage */
  assurances?: InsuranceData;

  /** Company representative name */
  representant?: string;
}

/**
 * Work/scope description
 */
export interface TravauxData {
  /** Type of work (plomberie, électricité, etc.) */
  type?: string;

  /** Detailed description of work */
  description?: string;

  /** Line items included in the quote */
  postes?: PosteData[];
}

/**
 * Complete extracted devis (quote/proposal) data
 * Represents the full structure of an extracted proposal document
 */
export interface ExtractedDevisData {
  /** Work details and line items */
  travaux?: TravauxData;

  /** Pricing information */
  devis?: PricingData;

  /** Timeline and scheduling */
  delais?: TimelineData;

  /** Company/contractor information */
  entreprise?: EntrepriseData;

  /** Budget range from demand (used for comparison) */
  budgetRange?: {
    min?: number;
    max?: number;
  };

  /** Urgency level from demand (used for comparison) */
  urgencyLevel?: 'basse' | 'normale' | 'haute' | 'tres-haute';
}

/**
 * Type guard to validate ExtractedDevisData structure
 */
export function isExtractedDevisData(data: unknown): data is ExtractedDevisData {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;

  // At least one section should be present
  return !!(obj.travaux || obj.devis || obj.delais || obj.entreprise);
}

/**
 * Type guard to validate PosteData
 */
export function isPosteData(data: unknown): data is PosteData {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;

  return (
    typeof obj.designation === 'string' &&
    (typeof obj.prixTotal === 'number' || obj.prixTotal === undefined)
  );
}

/**
 * Type guard to validate array of PosteData
 */
export function isPosteDataArray(data: unknown): data is PosteData[] {
  return Array.isArray(data) && data.every(isPosteData);
}

/**
 * Type guard to validate PricingData
 */
export function isPricingData(data: unknown): data is PricingData {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;

  return typeof obj.montantTotal === 'number';
}

/**
 * Type guard to validate TimelineData
 */
export function isTimelineData(data: unknown): data is TimelineData {
  if (typeof data !== 'object' || data === null) return false;
  // Timeline can be empty, so just validate type
  return true;
}

/**
 * Type guard to validate EntrepriseData
 */
export function isEntrepriseData(data: unknown): data is EntrepriseData {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;

  return (
    typeof obj.nom === 'string' ||
    typeof obj.siret === 'string' ||
    Array.isArray(obj.certifications)
  );
}

/**
 * Type guard to validate TravauxData
 */
export function isTravauxData(data: unknown): data is TravauxData {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;

  return (
    (typeof obj.type === 'string' ||
      typeof obj.description === 'string' ||
      Array.isArray(obj.postes))
  );
}
