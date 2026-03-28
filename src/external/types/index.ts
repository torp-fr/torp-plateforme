// External API client types — Phase 3A+

export interface APIClientConfig {
  apiKey: string;
  baseUrl: string;
  timeout: number;
  retries: number;
  backoffMs: number;
}

export interface APICallResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  statusCode?: number;
  retryCount?: number;
  executionTimeMs?: number;
}

// ─────────────────────────────────────────────────────────
// PAPPERS
// ─────────────────────────────────────────────────────────

export interface PappersCompanyData {
  siret: string;
  siren: string;
  raison_sociale: string;
  code_naf: string;
  libelle_naf: string;
  effectifs: number;
  effectifs_etab: number;
  chiffre_affaires: number;
  date_creation: string;
  date_modification: string;
  statut_juridique: string;
  adresse: string;
  code_postal: string;
  ville: string;
  latitude: number;
  longitude: number;
}

// ─────────────────────────────────────────────────────────
// DATA.GOUV
// ─────────────────────────────────────────────────────────

export interface DataGouvCertification {
  id: string;
  name: string;
  type: 'rge' | 'qualiopi' | 'label' | 'other';
  issued_date: string;
  valid_until?: string;
  metadata?: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────
// IGN GEOPORTAIL
// ─────────────────────────────────────────────────────────

export interface IGNParcel {
  id: string;
  commune: string;
  section: string;
  numero: string;
  surface: number; // m²
  location: { lat: number; lng: number };
}

export interface IGNPLUInfo {
  zone_type: string; // 'urbain' | 'peri-urbain' | 'rural'
  allowed_uses: string[];
  protected: boolean;
  monuments_historiques: boolean;
  paysages_proteges: boolean;
  raw?: unknown;
}

// ─────────────────────────────────────────────────────────
// NOMINATIM (OSM)
// ─────────────────────────────────────────────────────────

export interface NominatimResult {
  osm_id: number;
  lat: string;
  lon: string;
  display_name: string;
  address: {
    house_number?: string;
    road?: string;
    village?: string;
    town?: string;
    city?: string;
    postcode?: string;
    country?: string;
    country_code?: string;
  };
}

// ─────────────────────────────────────────────────────────
// BANO (Base Adresse Nationale)
// ─────────────────────────────────────────────────────────

export interface BANOAddressResult {
  id: string;
  label: string;
  score: number; // 0–1
  housenumber: string;
  street: string;
  postcode: string;
  city: string;
  context: string;
  x: number; // longitude
  y: number; // latitude
}

export interface BANOResponse {
  type: 'FeatureCollection';
  features: Array<{
    type: 'Feature';
    geometry: { type: 'Point'; coordinates: [number, number] };
    properties: BANOAddressResult;
  }>;
}

// ─────────────────────────────────────────────────────────
// TRUSTPILOT
// ─────────────────────────────────────────────────────────

export interface TrustpilotReview {
  rating: number;
  text: string;
  created_at: string;
}

export interface TrustpilotBusinessData {
  name: string;
  rating: number;
  reviews_count: number;
  reviews: TrustpilotReview[];
}
