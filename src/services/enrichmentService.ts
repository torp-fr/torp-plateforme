import { log, warn, error, time, timeEnd } from '@/lib/logger';

/**
 * Service d'enrichissement des données client
 * Intégration APIs: Google Maps, DPE, Cadastre (APICARTO), Pappers
 */

import type {
  ClientInfo,
  EnrichedClientData,
  EnrichmentServiceResponse,
  GeocodeResult,
  DPEData,
  CadastreData,
  RegulatoryData,
  UrbanData,
  CompanyData,
} from '@/types/enrichment';

// ============================================================================
// CONFIGURATION
// ============================================================================

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const DPE_API_KEY = import.meta.env.VITE_DPE_API_KEY;
// NOTE: PAPPERS_API_KEY moved to server-side only (Supabase Edge Function)
// const PAPPERS_API_KEY = import.meta.env.VITE_PAPPERS_API_KEY;

const APICARTO_URL = 'https://api.apicarto.gouv.fr';
const GOOGLE_MAPS_URL = 'https://maps.googleapis.com/maps/api';
const DPE_URL = 'https://data.ademe.fr/api/3';

// ============================================================================
// GÉOCODAGE (Google Maps)
// ============================================================================

export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  if (!GOOGLE_MAPS_API_KEY) {
    warn('⚠️ Google Maps API key not configured');
    return null;
  }

  try {
    const params = new URLSearchParams({
      address,
      key: GOOGLE_MAPS_API_KEY,
      region: 'fr',
    });

    const response = await fetch(
      `${GOOGLE_MAPS_URL}/geocode/json?${params.toString()}`
    );

    if (!response.ok) throw new Error(`Geocoding failed: ${response.status}`);

    const data = await response.json();

    if (data.results && data.results.length > 0) {
      const result = data.results[0];
      return {
        address: result.formatted_address,
        latitude: result.geometry.location.lat,
        longitude: result.geometry.location.lng,
        accuracy: result.geometry.location_type,
      };
    }

    return null;
  } catch (error) {
    console.error('❌ Geocoding error:', error);
    return null;
  }
}

// ============================================================================
// DPE - PERFORMANCE ÉNERGÉTIQUE
// ============================================================================

export async function fetchDPEData(lat: number, lon: number): Promise<DPEData> {
  try {
    // Utiliser API DPE publique ou autre source
    // Note: DPE API nécessite authentification, utiliser données publiques si possible
    const params = new URLSearchParams({
      latitude: lat.toString(),
      longitude: lon.toString(),
    });

    const response = await fetch(`${DPE_URL}/dpe/batiments?${params.toString()}`);

    if (!response.ok) {
      warn('⚠️ DPE API unavailable, returning empty data');
      return { available: false };
    }

    const data = await response.json();

    if (data.results && data.results.length > 0) {
      const dpe = data.results[0];
      return {
        available: true,
        class: dpe.classe_bilan_dpe,
        consumption: dpe.consommation_energie,
        emissions: dpe.emissions_ges,
        lastAudit: dpe.date_visite_diagnostic,
        diagnosticId: dpe.numero_dpe,
        source: 'ADEME',
      };
    }

    return { available: false };
  } catch (error) {
    console.error('⚠️ DPE fetch error:', error);
    return { available: false };
  }
}

// ============================================================================
// CADASTRE & URBANISME - APICARTO (GRATUIT - IGN)
// ============================================================================

export async function fetchCadastreData(
  lat: number,
  lon: number
): Promise<CadastreData> {
  try {
    // APICARTO est gratuite et ne nécessite pas de clé API
    const response = await fetch(
      `${APICARTO_URL}/cadastre/parcelle?lon=${lon}&lat=${lat}`
    );

    if (!response.ok) {
      warn('⚠️ APICARTO unavailable');
      return {};
    }

    const data = await response.json();

    if (data.features && data.features.length > 0) {
      const parcel = data.features[0].properties;
      return {
        parcelleNumber: parcel.id,
        communeCode: parcel.commune_cgoam,
        departement: parcel.departement,
        region: parcel.region,
        // Note: Autres données nécessitent requêtes additionnelles
      };
    }

    return {};
  } catch (error) {
    console.error('⚠️ APICARTO error:', error);
    return {};
  }
}

export async function fetchUrbanData(
  lat: number,
  lon: number
): Promise<UrbanData> {
  try {
    // APICARTO - PLU/Servitudes
    const response = await fetch(
      `${APICARTO_URL}/gpu/servitudes?lon=${lon}&lat=${lat}`
    );

    if (!response.ok) {
      return {};
    }

    const data = await response.json();

    return {
      servitudes: data.servitudes || [],
      protectionPerimeters: data.perimetres_protection || [],
    };
  } catch (error) {
    console.error('⚠️ Urban data fetch error:', error);
    return {};
  }
}

// ============================================================================
// DONNÉES RÉGLEMENTAIRES
// ============================================================================

export async function fetchRegulatoryData(
  lat: number,
  lon: number,
  address: string
): Promise<RegulatoryData> {
  try {
    // Requêtes multiples via APICARTO
    const requests = [
      // ABF
      fetch(`${APICARTO_URL}/gpu/document-urba?lon=${lon}&lat=${lat}`),
      // Inondabilité
      fetch(`${APICARTO_URL}/risques/inondation?lon=${lon}&lat=${lat}`),
    ];

    const [abfResponse, floodResponse] = await Promise.allSettled(requests);

    let abfZone = false;
    let floodableZone = false;

    if (abfResponse.status === 'fulfilled' && abfResponse.value.ok) {
      const abfData = await abfResponse.value.json();
      abfZone = abfData.features?.some(
        (f: any) => f.properties.libelle?.includes('ABF')
      ) || false;
    }

    if (floodResponse.status === 'fulfilled' && floodResponse.value.ok) {
      const floodData = await floodResponse.value.json();
      floodableZone = floodData.features?.length > 0 || false;
    }

    return {
      permitRequired: true, // Par défaut vrai en France
      priorDeclaration: true,
      abfZone,
      floodableZone,
      coOwned: false, // À déterminer via cadastre
      coOwnershipRulesConstraining: false,
    };
  } catch (error) {
    console.error('⚠️ Regulatory data fetch error:', error);
    return {
      permitRequired: true,
      priorDeclaration: true,
      abfZone: false,
      floodableZone: false,
      coOwned: false,
      coOwnershipRulesConstraining: false,
    };
  }
}

// ============================================================================
// DONNÉES ENTREPRISE - PAPPERS (SIRET)
// ============================================================================

export async function fetchCompanyData(siret: string): Promise<CompanyData | undefined> {
  if (!PAPPERS_API_KEY || !siret) {
    return undefined;
  }

  try {
    const response = await fetch(`https://api.pappers.fr/v2/companies/${siret}`, {
      headers: {
        Authorization: `Bearer ${PAPPERS_API_KEY}`,
      },
    });

    if (!response.ok) {
      warn('⚠️ Pappers API error');
      return undefined;
    }

    const data = await response.json();

    return {
      siret: data.siret,
      siren: data.siren,
      name: data.denomination,
      legalForm: data.forme_juridique,
      creationDate: data.date_creation,
      address: {
        number: data.adresse?.numero,
        street: data.adresse?.rue,
        city: data.adresse?.ville,
        postalCode: data.adresse?.code_postal,
      },
      phone: data.telephone,
      email: data.email,
      website: data.site_web,
      employees: data.effectif,
      status: data.statut_etablissement === 'A' ? 'active' : 'inactive',
      activities: data.activites,
      naf: data.code_naf,
    };
  } catch (error) {
    console.error('⚠️ Pappers fetch error:', error);
    return undefined;
  }
}

// ============================================================================
// VECTORISATION (MOVED TO SUPABASE EDGE FUNCTION)
// ============================================================================

/**
 * DEPRECATED: Vectorization now handled by Supabase Edge Function
 * This keeps API keys server-side only
 *
 * Call supabase.functions.invoke('generate-embedding') instead
 * See /supabase/functions/generate-embedding/index.ts
 */
export async function vectorizeEnrichedData(
  data: EnrichedClientData
): Promise<number[] | undefined> {
  // Vectorization is now server-side only (Supabase Edge Function)
  // Frontend should not make direct API calls
  warn('⚠️ Vectorization has been moved to server-side (Supabase Edge Function)');
  return undefined;
}

// ============================================================================
// SERVICE PRINCIPAL D'ENRICHISSEMENT
// ============================================================================

export async function enrichClientData(
  client: ClientInfo,
  siret?: string
): Promise<EnrichmentServiceResponse> {
  try {
    const addressText = formatAddress(client.address);
    log('🔍 Starting enrichment for:', addressText);

    // Étape 1: Géocodage
    const geocode = await geocodeAddress(addressText);
    if (!geocode) {
      return {
        success: false,
        errors: ['Geocoding failed - address not found'],
      };
    }

    log('📍 Geocoded:', geocode);

    const { latitude, longitude } = geocode;

    // Étape 2: Requêtes parallèles
    const [dpe, cadastre, regulatory, urban, company] = await Promise.all([
      fetchDPEData(latitude, longitude),
      fetchCadastreData(latitude, longitude),
      fetchRegulatoryData(latitude, longitude, addressText),
      fetchUrbanData(latitude, longitude),
      siret ? fetchCompanyData(siret) : Promise.resolve(undefined),
    ]);

    // Étape 3: Créer objet enrichi
    const enrichedData: EnrichedClientData = {
      timestamp: new Date().toISOString(),
      client,
      addressText,
      coordinates: { latitude, longitude },
      dpe,
      cadastre,
      regulatory,
      urban,
      company,
      enrichmentStatus: 'completed',
      lastUpdated: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 jours
    };

    // Étape 4: Vectorisation
    const embedding = await vectorizeEnrichedData(enrichedData);
    if (embedding) {
      enrichedData.embedding = embedding;
    }

    log('✅ Enrichment completed');

    return {
      success: true,
      data: enrichedData,
    };
  } catch (error) {
    console.error('❌ Enrichment service error:', error);
    return {
      success: false,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
    };
  }
}

// ============================================================================
// UTILITAIRES
// ============================================================================

function formatAddress(address: any): string {
  const parts = [
    address.number,
    address.street,
    address.postalCode,
    address.city,
    address.country || 'France',
  ].filter(Boolean);

  return parts.join(', ');
}

// Export pour usage direct
export { enrichClientData as default };
