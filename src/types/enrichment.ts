/**
 * Types pour l'enrichissement des données client
 * Vectorisation, DPE, Cadastre, Réglementaire, etc.
 */

// ============================================================================
// TYPES CLIENT & ADRESSE
// ============================================================================

export interface ClientAddress {
  number?: string;
  street: string;
  city: string;
  postalCode: string;
  country?: string;
}

export interface ClientInfo {
  name: string;
  phone?: string;
  email?: string;
  address: ClientAddress;
  siret?: string; // Pour les entreprises - sera enrichi via Pappers
}

// ============================================================================
// DONNÉES DPE (Performance Énergétique)
// ============================================================================

export type DPEClass = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';

export interface DPEData {
  available: boolean;
  class?: DPEClass;
  consumption?: number; // kWh/m²/an
  emissions?: number; // kg CO2/m²/an
  lastAudit?: string; // ISO Date
  diagnosisDate?: string;
  diagnosticId?: string;
  source?: string;
}

// ============================================================================
// DONNÉES CADASTRE (IGN/APICARTO)
// ============================================================================

export interface CadastreData {
  parcelleNumber?: string;
  communeCode?: string;
  departement?: string;
  region?: string;
  yearConstruction?: number;
  buildingType?: 'maison' | 'apartement' | 'autre'; // Type de bâti
  totalSurface?: number; // m²
  habitableSurface?: number; // m² habitable
  floors?: number; // Nombre d'étages
  landSurface?: number; // m² terrain
  valuationLand?: number; // Valeur foncière
  owner?: string;
  ownerAddress?: string;
}

// ============================================================================
// DONNÉES RÉGLEMENTAIRES
// ============================================================================

export interface RegulatoryData {
  permitRequired: boolean;
  priorDeclaration: boolean;
  abfZone: boolean; // Architectes Bâtiments de France
  seismicZone?: 'zone1' | 'zone2a' | 'zone2b' | 'zone3' | 'zone4' | 'zone5';
  seismicLevel?: number;
  floodableZone: boolean; // Zones PPRI
  floodRisk?: 'faible' | 'moyen' | 'fort';
  coOwned: boolean; // Copropriété
  coOwnershipRulesConstraining?: boolean;
  protectionPerimeters?: string[];
  localRules?: string[];
}

// ============================================================================
// DONNÉES URBANISME (PLU, etc.)
// ============================================================================

export interface UrbanData {
  pluZone?: string;
  constructionCoefficientMax?: number; // COS - Coefficient d'Occupation des Sol
  floorAreaRatio?: number;
  setbacks?: {
    front?: number; // Recul façade
    sides?: number;
    rear?: number;
  };
  heightMax?: number; // Hauteur max en mètres
  parkingRequired?: boolean;
  servitudes?: string[];
  protectionPerimeters?: string[];
}

// ============================================================================
// DONNÉES ENTREPRISE (Pappers API)
// ============================================================================

export interface CompanyData {
  siret?: string;
  siren?: string;
  name?: string;
  legalForm?: string;
  creationDate?: string;
  registrationDate?: string;
  address?: ClientAddress;
  phone?: string;
  email?: string;
  website?: string;
  employees?: number;
  revenue?: number;
  turnover?: number;
  status?: 'active' | 'inactive' | 'dissolved';
  activities?: string[];
  naf?: string; // Code NAF
}

// ============================================================================
// DONNÉES ENRICHIES COMPLÈTES
// ============================================================================

export interface EnrichedClientData {
  // Identifiants
  id?: string;
  ccfId?: string;
  timestamp?: string;

  // Données originales
  client: ClientInfo;
  addressText: string; // Adresse formatée complète
  coordinates?: {
    latitude: number;
    longitude: number;
  };

  // Données enrichies
  dpe: DPEData;
  cadastre: CadastreData;
  regulatory: RegulatoryData;
  urban: UrbanData;
  company?: CompanyData;

  // Metadata enrichissement
  enrichmentStatus: 'pending' | 'in_progress' | 'completed' | 'partial' | 'failed';
  enrichmentErrors?: string[];
  lastUpdated?: string;
  expiresAt?: string; // TTL pour cache

  // Vectorisation (pour RAG)
  embedding?: number[]; // Vector(1536) pour OpenAI
  rawResponse?: {
    dpe?: any;
    cadastre?: any;
    regulatory?: any;
    urban?: any;
    company?: any;
  };
}

// ============================================================================
// RÉPONSES DES SERVICES
// ============================================================================

export interface EnrichmentServiceResponse {
  success: boolean;
  data?: EnrichedClientData;
  errors?: string[];
  warnings?: string[];
}

export interface GeocodeResult {
  address: string;
  latitude: number;
  longitude: number;
  accuracy?: string;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

export interface EnrichmentConfig {
  apis: {
    googleMaps: {
      enabled: boolean;
      apiKey?: string;
    };
    dpe: {
      enabled: boolean;
      apiKey?: string;
      baseUrl?: string;
    };
    cadastre: {
      enabled: boolean; // APICARTO (free)
      baseUrl?: string;
    };
    pappers: {
      enabled: boolean;
      apiKey?: string;
      baseUrl?: string;
    };
  };
  cache: {
    enabled: boolean;
    ttl: number; // secondes
  };
  parallel: boolean; // Requêtes parallèles
  timeout: number; // ms
}
