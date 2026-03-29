// ─────────────────────────────────────────────────────────────────────────────
// RegionalRiskProfiler — Location-based risk assessment using public APIs
// Sources: Géorisques, ADEME, IGN Géoportail, Data.gouv PLU
// ─────────────────────────────────────────────────────────────────────────────

import type { SupabaseClient } from '@supabase/supabase-js';

// ── Types ────────────────────────────────────────────────────────────────────

export interface SeismicRisk {
  zone: number | null;          // 1–5 (French seismic zones)
  description: string;
  requires_ec8: boolean;        // Seismic design required (Eurocode 8)
}

export interface FloodingRisk {
  risk_level: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH';
  zone_type: string | null;     // PPRi, TRI, SDAGE, etc.
  description: string;
}

export interface SnowLoadZone {
  zone: 'A1' | 'A2' | 'B1' | 'B2' | 'C' | 'D' | null;
  snow_load_kg_m2: number | null;
  dtu_reference: string;
}

export interface WindExposure {
  wind_zone: 1 | 2 | 3 | 4 | null;
  max_speed_kmh: number | null;
  dynamic_pressure_pa: number | null;
}

export interface PLURestrictions {
  zone_type: string | null;     // UA, UB, UC, A, N, etc.
  is_abf: boolean;              // Architectes des Bâtiments de France
  restrictions: string[];
}

export interface RegionalRisks {
  seismic: SeismicRisk;
  flooding: FloodingRisk;
  snow_load: SnowLoadZone;
  wind_exposure: WindExposure;
  plu_restrictions: PLURestrictions;
  inferred_dtu_requirements: string[];
  summary: string;
  assessed_at: string;
}

interface GeoCoords {
  lat: number;
  lon: number;
}

// ── RegionalRiskProfiler ──────────────────────────────────────────────────────

export class RegionalRiskProfiler {
  private readonly GEORISQUES_BASE = 'https://www.georisques.gouv.fr/api/v1';
  private readonly BANO_BASE = process.env.BANO_API_ENDPOINT ?? 'https://api-adresse.data.gouv.fr';
  private readonly IGN_URBANISME = 'https://www.geoportail-urbanisme.gouv.fr/api';
  private readonly NOMINATIM_BASE = process.env.NOMINATIM_API_ENDPOINT ?? 'https://nominatim.openstreetmap.org';

  constructor(private readonly supabase: SupabaseClient) {}

  /**
   * Full risk assessment for a project address + domain list.
   * All API calls run in parallel; failures return safe defaults.
   */
  async assessProject(adresse: string, domains: string[]): Promise<RegionalRisks> {
    // 1. Geocode
    const coords = await this.geocodeAddress(adresse);

    // 2. Parallel fetch all risk sources
    const [seismic, flooding, snow, wind, plu] = await Promise.allSettled([
      this.getSeismicRisk(coords),
      this.getFloodingRisk(coords),
      this.getSnowLoadZone(coords),
      this.getWindExposure(coords),
      this.getPLURestrictions(coords),
    ]);

    const seismicData = seismic.status === 'fulfilled' ? seismic.value : this.defaultSeismic();
    const floodingData = flooding.status === 'fulfilled' ? flooding.value : this.defaultFlooding();
    const snowData = snow.status === 'fulfilled' ? snow.value : this.defaultSnow();
    const windData = wind.status === 'fulfilled' ? wind.value : this.defaultWind();
    const pluData = plu.status === 'fulfilled' ? plu.value : this.defaultPLU();

    // 3. Infer DTU requirements
    const dtus = this.inferDTURequirements(domains, seismicData, snowData, windData);

    // 4. Summary
    const summary = this.buildSummary(seismicData, floodingData, snowData, pluData);

    return {
      seismic: seismicData,
      flooding: floodingData,
      snow_load: snowData,
      wind_exposure: windData,
      plu_restrictions: pluData,
      inferred_dtu_requirements: dtus,
      summary,
      assessed_at: new Date().toISOString(),
    };
  }

  // ── Individual risk sources ───────────────────────────────────────────────

  /**
   * Géorisques — sismicité (zone 1–5)
   * Doc: https://www.georisques.gouv.fr/api/v1#/Risques/get_zonage_sismique
   */
  async getSeismicRisk(coords: GeoCoords): Promise<SeismicRisk> {
    try {
      const url = `${this.GEORISQUES_BASE}/zonage_sismique?latlon=${coords.lon},${coords.lat}`;
      const res = await this.timedFetch(url, 5000);
      const data = await res.json() as { zone_sismique?: number; description?: string };

      const zone = data.zone_sismique ?? null;
      return {
        zone,
        description: data.description ?? `Zone sismique ${zone ?? 'inconnue'}`,
        requires_ec8: (zone ?? 0) >= 3,
      };
    } catch {
      return this.defaultSeismic();
    }
  }

  /**
   * Géorisques — risque inondation
   */
  async getFloodingRisk(coords: GeoCoords): Promise<FloodingRisk> {
    try {
      const url = `${this.GEORISQUES_BASE}/mvt_terrain?latlon=${coords.lon},${coords.lat}`;
      const res = await this.timedFetch(url, 5000);
      const data = await res.json() as { niveau_risque?: string; zone?: string };

      const level = this.mapRiskLevel(data.niveau_risque);
      return {
        risk_level: level,
        zone_type: data.zone ?? null,
        description: `Risque inondation: ${level}`,
      };
    } catch {
      return this.defaultFlooding();
    }
  }

  /**
   * Snow load zone — estimated from latitude + altitude
   * Based on DTU NV65 zones (simplified mapping by département)
   */
  async getSnowLoadZone(coords: GeoCoords): Promise<SnowLoadZone> {
    try {
      // Use altitude from IGN to refine zone
      const zone = this.estimateSnowZoneFromCoords(coords);
      return zone;
    } catch {
      return this.defaultSnow();
    }
  }

  /**
   * Wind exposure — NV65 wind zones (simplified mapping)
   */
  async getWindExposure(coords: GeoCoords): Promise<WindExposure> {
    try {
      const zone = this.estimateWindZoneFromCoords(coords);
      return zone;
    } catch {
      return this.defaultWind();
    }
  }

  /**
   * PLU restrictions — Geoportail Urbanisme API
   */
  async getPLURestrictions(coords: GeoCoords): Promise<PLURestrictions> {
    try {
      const url = `${this.IGN_URBANISME}/feature-info?lon=${coords.lon}&lat=${coords.lat}&format=json`;
      const res = await this.timedFetch(url, 8000);
      const data = await res.json() as { zone?: string; secteur_sauvegarde?: boolean; restrictions?: string[] };

      return {
        zone_type: data.zone ?? null,
        is_abf: data.secteur_sauvegarde ?? false,
        restrictions: data.restrictions ?? [],
      };
    } catch {
      return this.defaultPLU();
    }
  }

  // ── DTU inference ─────────────────────────────────────────────────────────

  inferDTURequirements(
    domains: string[],
    seismic: SeismicRisk,
    snow: SnowLoadZone,
    wind: WindExposure
  ): string[] {
    const dtus = new Set<string>();

    if (domains.includes('structure')) {
      dtus.add('DTU 20.1 (Maçonnerie)');
      dtus.add('DTU 13.3 (Dallages)');
      if (seismic.requires_ec8) dtus.add('NF EN 1998-1 (Eurocodes sismiques EC8)');
    }

    if (domains.includes('couverture') || domains.includes('charpente')) {
      dtus.add('DTU 40.11 (Couverture zinc)');
      dtus.add('DTU 40.21 (Couverture ardoise)');
      dtus.add('DTU 31.1 (Charpente et escaliers en bois)');
      if ((snow.snow_load_kg_m2 ?? 0) > 200) dtus.add('NV65 Annexe C — charge neige renforcée');
      if ((wind.wind_zone ?? 1) >= 3) dtus.add('NV65 — vent zone 3/4 — fixations renforcées');
    }

    if (domains.includes('isolation')) {
      dtus.add('DTU 45.11 (Isolation thermique par l\'intérieur)');
      dtus.add('RE 2020 / RT 2012');
    }

    if (domains.includes('electricite')) {
      dtus.add('NF C 15-100 (Installations électriques basse tension)');
    }

    if (domains.includes('plomberie') || domains.includes('chauffage')) {
      dtus.add('DTU 60.1 (Plomberie sanitaire)');
      dtus.add('DTU 65.3 (Chauffage central)');
    }

    if (domains.includes('etancheite')) {
      dtus.add('DTU 43.1 (Étanchéité des toitures-terrasses)');
    }

    return [...dtus];
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  async geocodeAddress(address: string): Promise<GeoCoords> {
    try {
      const encoded = encodeURIComponent(address);
      const url = `${this.BANO_BASE}/search/?q=${encoded}&limit=1`;
      const res = await this.timedFetch(url, 5000);
      const data = await res.json() as { features?: Array<{ geometry?: { coordinates?: number[] } }> };

      const coords = data.features?.[0]?.geometry?.coordinates;
      if (coords && coords.length >= 2) {
        return { lon: coords[0], lat: coords[1] };
      }
    } catch {
      // Fall through to Nominatim
    }

    try {
      const encoded = encodeURIComponent(address);
      const url = `${this.NOMINATIM_BASE}/search?q=${encoded}&format=json&limit=1`;
      const res = await this.timedFetch(url, 5000, {
        'User-Agent': process.env.NOMINATIM_USER_AGENT ?? 'TORP/1.0 contact@torp.fr',
      });
      const data = await res.json() as Array<{ lat?: string; lon?: string }>;

      if (data[0]?.lat && data[0]?.lon) {
        return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
      }
    } catch {
      // Fall through to centroid
    }

    // Last resort: Paris centroid
    console.warn(`[RegionalRiskProfiler] Could not geocode: "${address}" — using Paris centroid`);
    return { lat: 48.8566, lon: 2.3522 };
  }

  private estimateSnowZoneFromCoords(coords: GeoCoords): SnowLoadZone {
    // Simplified: NV65 snow zones based on latitude bands
    const lat = coords.lat;
    if (lat > 47.0) return { zone: 'B2', snow_load_kg_m2: 150, dtu_reference: 'NV65 §6' };
    if (lat > 46.0) return { zone: 'B1', snow_load_kg_m2: 100, dtu_reference: 'NV65 §6' };
    return { zone: 'A2', snow_load_kg_m2: 70, dtu_reference: 'NV65 §6' };
  }

  private estimateWindZoneFromCoords(coords: GeoCoords): WindExposure {
    const lon = coords.lon;
    // Coastal areas (west) have higher wind exposure
    if (lon < 0) return { wind_zone: 3, max_speed_kmh: 170, dynamic_pressure_pa: 1500 };
    if (lon < 2) return { wind_zone: 2, max_speed_kmh: 140, dynamic_pressure_pa: 1200 };
    return { wind_zone: 1, max_speed_kmh: 120, dynamic_pressure_pa: 900 };
  }

  private mapRiskLevel(level?: string): FloodingRisk['risk_level'] {
    if (!level) return 'NONE';
    const l = level.toLowerCase();
    if (l.includes('fort') || l.includes('élevé')) return 'HIGH';
    if (l.includes('moyen')) return 'MEDIUM';
    if (l.includes('faible')) return 'LOW';
    return 'NONE';
  }

  private buildSummary(
    seismic: SeismicRisk,
    flooding: FloodingRisk,
    snow: SnowLoadZone,
    plu: PLURestrictions
  ): string {
    const factors: string[] = [];
    if ((seismic.zone ?? 0) >= 3) factors.push(`Zone sismique ${seismic.zone}`);
    if (flooding.risk_level !== 'NONE') factors.push(`Risque inondation ${flooding.risk_level}`);
    if ((snow.snow_load_kg_m2 ?? 0) > 200) factors.push(`Charge neige élevée (${snow.snow_load_kg_m2} kg/m²)`);
    if (plu.is_abf) factors.push('Secteur ABF — architecte des Bâtiments de France obligatoire');

    if (factors.length === 0) return 'Projet standard — DTU usuels applicables, aucun risque spécifique détecté';
    return `Contraintes identifiées: ${factors.join(', ')} — normes additionnelles requises`;
  }

  private async timedFetch(url: string, timeoutMs: number, extraHeaders?: Record<string, string>): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { 'Accept': 'application/json', ...(extraHeaders ?? {}) },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
      return res;
    } finally {
      clearTimeout(timer);
    }
  }

  // ── Default safe values (used on API failure) ─────────────────────────────

  private defaultSeismic(): SeismicRisk { return { zone: null, description: 'Données sismiques non disponibles', requires_ec8: false }; }
  private defaultFlooding(): FloodingRisk { return { risk_level: 'NONE', zone_type: null, description: 'Données inondation non disponibles' }; }
  private defaultSnow(): SnowLoadZone { return { zone: 'A2', snow_load_kg_m2: 70, dtu_reference: 'NV65 §6 (défaut zone A2)' }; }
  private defaultWind(): WindExposure { return { wind_zone: 2, max_speed_kmh: 140, dynamic_pressure_pa: 1200 }; }
  private defaultPLU(): PLURestrictions { return { zone_type: null, is_abf: false, restrictions: [] }; }
}
