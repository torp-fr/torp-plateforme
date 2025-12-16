/**
 * Service Cadastre & Analyse des Risques
 * Utilise les APIs IGN Cadastre et Géorisques
 * ZÉRO MOCK - Données réelles uniquement
 */

// =============================================================================
// TYPES
// =============================================================================

export interface ParcelData {
  id: string;
  commune: string;
  codeInsee: string;
  section: string;
  numero: string;
  prefixe?: string;
  contenance: number; // m²
  adresse?: string;
  geometry?: GeoJSON.Polygon;
}

export interface RiskItem {
  type: 'inondation' | 'seisme' | 'mouvement_terrain' | 'radon' | 'argiles' | 'icpe' | 'cavites' | 'pollution_sols';
  niveau: 'faible' | 'moyen' | 'fort' | 'tres_fort';
  description: string;
  source: string;
  date_maj?: string;
}

export interface RiskAnalysis {
  parcelId: string;
  codeInsee: string;
  risques: RiskItem[];
  pprn?: { nom: string; date: string; lien?: string }[];
  zonage_sismique?: string;
  potentiel_radon?: number;
  score_global: number; // 0-100, 100 = aucun risque
  date_analyse: string;
}

export interface GeocodingResult {
  lat: number;
  lon: number;
  label: string;
  codeInsee: string;
  codePostal: string;
  ville: string;
}

// =============================================================================
// SERVICE
// =============================================================================

class CadastreService {
  private cadastreApiUrl = 'https://apicarto.ign.fr/api/cadastre';
  private georisquesApiUrl = 'https://georisques.gouv.fr/api/v1';
  private adresseApiUrl = 'https://api-adresse.data.gouv.fr';

  // -------------------------------------------------------------------------
  // Géocodage
  // -------------------------------------------------------------------------

  async geocodeAddress(address: string, codePostal?: string): Promise<GeocodingResult | null> {
    try {
      let url = `${this.adresseApiUrl}/search/?q=${encodeURIComponent(address)}&limit=1`;
      if (codePostal) {
        url += `&postcode=${codePostal}`;
      }

      const response = await fetch(url);
      if (!response.ok) throw new Error(`Geocoding failed: ${response.status}`);

      const data = await response.json();

      if (!data.features?.length) return null;

      const feature = data.features[0];
      const [lon, lat] = feature.geometry.coordinates;

      return {
        lat,
        lon,
        label: feature.properties.label,
        codeInsee: feature.properties.citycode,
        codePostal: feature.properties.postcode,
        ville: feature.properties.city,
      };
    } catch (error) {
      console.error('[CadastreService] Geocoding error:', error);
      return null;
    }
  }

  // -------------------------------------------------------------------------
  // Parcelles cadastrales
  // -------------------------------------------------------------------------

  async getParcelByAddress(address: string, codeInsee?: string): Promise<ParcelData[]> {
    try {
      // Géocoder l'adresse d'abord
      const geo = await this.geocodeAddress(address);
      if (!geo) return [];

      // Recherche parcelle par point
      const response = await fetch(
        `${this.cadastreApiUrl}/parcelle?geom=${encodeURIComponent(
          JSON.stringify({ type: 'Point', coordinates: [geo.lon, geo.lat] })
        )}`
      );

      if (!response.ok) {
        console.warn('[CadastreService] Cadastre API error:', response.status);
        return [];
      }

      const data = await response.json();

      return (data.features || []).map((f: any) => ({
        id: f.properties.id,
        commune: f.properties.commune,
        codeInsee: f.properties.code_insee || codeInsee || geo.codeInsee,
        section: f.properties.section,
        numero: f.properties.numero,
        prefixe: f.properties.prefixe,
        contenance: f.properties.contenance || 0,
        adresse: address,
        geometry: f.geometry,
      }));
    } catch (error) {
      console.error('[CadastreService] Parcel search error:', error);
      return [];
    }
  }

  async getParcelByReference(
    codeInsee: string,
    section: string,
    numero: string
  ): Promise<ParcelData | null> {
    try {
      const response = await fetch(
        `${this.cadastreApiUrl}/parcelle?code_insee=${codeInsee}&section=${section}&numero=${numero}`
      );

      if (!response.ok) return null;

      const data = await response.json();
      if (!data.features?.length) return null;

      const f = data.features[0];
      return {
        id: f.properties.id,
        commune: f.properties.commune,
        codeInsee: f.properties.code_insee || codeInsee,
        section: f.properties.section,
        numero: f.properties.numero,
        prefixe: f.properties.prefixe,
        contenance: f.properties.contenance || 0,
        geometry: f.geometry,
      };
    } catch (error) {
      console.error('[CadastreService] Parcel ref search error:', error);
      return null;
    }
  }

  async getParcelByCoordinates(lat: number, lon: number): Promise<ParcelData | null> {
    try {
      const response = await fetch(
        `${this.cadastreApiUrl}/parcelle?geom=${encodeURIComponent(
          JSON.stringify({ type: 'Point', coordinates: [lon, lat] })
        )}`
      );

      if (!response.ok) return null;

      const data = await response.json();
      if (!data.features?.length) return null;

      const f = data.features[0];
      return {
        id: f.properties.id,
        commune: f.properties.commune,
        codeInsee: f.properties.code_insee,
        section: f.properties.section,
        numero: f.properties.numero,
        prefixe: f.properties.prefixe,
        contenance: f.properties.contenance || 0,
        geometry: f.geometry,
      };
    } catch (error) {
      console.error('[CadastreService] Parcel coord search error:', error);
      return null;
    }
  }

  // -------------------------------------------------------------------------
  // Analyse des risques (Géorisques)
  // -------------------------------------------------------------------------

  async analyzeRisks(lat: number, lon: number, codeInsee: string): Promise<RiskAnalysis> {
    const risques: RiskItem[] = [];
    const latlon = `${lat},${lon}`;

    // Fetch all risk data in parallel
    const [inondation, mvt, argiles, radon, cavites, icpe] = await Promise.allSettled([
      this.fetchInondationRisk(latlon),
      this.fetchMouvementTerrainRisk(latlon),
      this.fetchArgilesRisk(latlon),
      this.fetchRadonRisk(codeInsee),
      this.fetchCavitesRisk(latlon),
      this.fetchICPERisk(latlon),
    ]);

    // Process results
    if (inondation.status === 'fulfilled' && inondation.value) {
      risques.push(inondation.value);
    }
    if (mvt.status === 'fulfilled' && mvt.value) {
      risques.push(mvt.value);
    }
    if (argiles.status === 'fulfilled' && argiles.value) {
      risques.push(argiles.value);
    }
    if (radon.status === 'fulfilled' && radon.value) {
      risques.push(radon.value);
    }
    if (cavites.status === 'fulfilled' && cavites.value) {
      risques.push(cavites.value);
    }
    if (icpe.status === 'fulfilled' && icpe.value) {
      risques.push(icpe.value);
    }

    // Zonage sismique
    const zonageSismique = await this.fetchZonageSismique(codeInsee);

    // Score global
    const scoreGlobal = this.calculateRiskScore(risques);

    return {
      parcelId: `${codeInsee}`,
      codeInsee,
      risques,
      zonage_sismique: zonageSismique,
      potentiel_radon: radon.status === 'fulfilled' && radon.value
        ? this.extractRadonLevel(radon.value)
        : undefined,
      score_global: scoreGlobal,
      date_analyse: new Date().toISOString(),
    };
  }

  private async fetchInondationRisk(latlon: string): Promise<RiskItem | null> {
    try {
      const response = await fetch(
        `${this.georisquesApiUrl}/gaspar/risques?latlon=${latlon}&rayon=100`,
        { signal: AbortSignal.timeout(5000) }
      );
      if (!response.ok) return null;

      const data = await response.json();
      const inondation = data.data?.find((r: any) =>
        r.libelle_risque_jo?.toLowerCase().includes('inondation')
      );

      if (inondation) {
        return {
          type: 'inondation',
          niveau: 'moyen',
          description: inondation.libelle_risque_jo || 'Zone à risque inondation',
          source: 'Géorisques - GASPAR',
        };
      }
      return null;
    } catch {
      return null;
    }
  }

  private async fetchMouvementTerrainRisk(latlon: string): Promise<RiskItem | null> {
    try {
      const response = await fetch(
        `${this.georisquesApiUrl}/mvt?latlon=${latlon}&rayon=500`,
        { signal: AbortSignal.timeout(5000) }
      );
      if (!response.ok) return null;

      const data = await response.json();
      if (data.data?.length > 0) {
        return {
          type: 'mouvement_terrain',
          niveau: data.data.length > 3 ? 'fort' : 'moyen',
          description: `${data.data.length} événement(s) recensé(s) dans un rayon de 500m`,
          source: 'Géorisques - MVT',
        };
      }
      return null;
    } catch {
      return null;
    }
  }

  private async fetchArgilesRisk(latlon: string): Promise<RiskItem | null> {
    try {
      const response = await fetch(
        `${this.georisquesApiUrl}/argiles?latlon=${latlon}`,
        { signal: AbortSignal.timeout(5000) }
      );
      if (!response.ok) return null;

      const data = await response.json();
      if (data.data) {
        const niveau = this.mapArgilesLevel(data.data.niveau);
        return {
          type: 'argiles',
          niveau,
          description: data.data.libelle || `Exposition ${niveau} au retrait-gonflement des argiles`,
          source: 'Géorisques - Argiles',
        };
      }
      return null;
    } catch {
      return null;
    }
  }

  private async fetchRadonRisk(codeInsee: string): Promise<RiskItem | null> {
    try {
      const response = await fetch(
        `${this.georisquesApiUrl}/radon?code_insee=${codeInsee}`,
        { signal: AbortSignal.timeout(5000) }
      );
      if (!response.ok) return null;

      const data = await response.json();
      if (data.data) {
        const classe = data.data.classe_potentiel;
        const niveau: RiskItem['niveau'] =
          classe >= 3 ? 'fort' : classe >= 2 ? 'moyen' : 'faible';

        return {
          type: 'radon',
          niveau,
          description: `Potentiel radon catégorie ${classe}`,
          source: 'Géorisques - Radon',
        };
      }
      return null;
    } catch {
      return null;
    }
  }

  private async fetchCavitesRisk(latlon: string): Promise<RiskItem | null> {
    try {
      const response = await fetch(
        `${this.georisquesApiUrl}/cavites?latlon=${latlon}&rayon=500`,
        { signal: AbortSignal.timeout(5000) }
      );
      if (!response.ok) return null;

      const data = await response.json();
      if (data.data?.length > 0) {
        return {
          type: 'cavites',
          niveau: data.data.length > 2 ? 'fort' : 'moyen',
          description: `${data.data.length} cavité(s) souterraine(s) recensée(s)`,
          source: 'Géorisques - Cavités',
        };
      }
      return null;
    } catch {
      return null;
    }
  }

  private async fetchICPERisk(latlon: string): Promise<RiskItem | null> {
    try {
      const response = await fetch(
        `${this.georisquesApiUrl}/installations?latlon=${latlon}&rayon=1000`,
        { signal: AbortSignal.timeout(5000) }
      );
      if (!response.ok) return null;

      const data = await response.json();
      const sevesoCount = data.data?.filter((i: any) => i.seveso).length || 0;

      if (sevesoCount > 0) {
        return {
          type: 'icpe',
          niveau: sevesoCount > 1 ? 'fort' : 'moyen',
          description: `${sevesoCount} site(s) SEVESO dans un rayon de 1km`,
          source: 'Géorisques - ICPE',
        };
      }
      return null;
    } catch {
      return null;
    }
  }

  private async fetchZonageSismique(codeInsee: string): Promise<string | undefined> {
    try {
      const response = await fetch(
        `${this.georisquesApiUrl}/gaspar/communes?code_insee=${codeInsee}`,
        { signal: AbortSignal.timeout(5000) }
      );
      if (!response.ok) return undefined;

      const data = await response.json();
      return data.data?.[0]?.zone_sismicite;
    } catch {
      return undefined;
    }
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private mapArgilesLevel(niveau: number): RiskItem['niveau'] {
    if (niveau >= 3) return 'fort';
    if (niveau >= 2) return 'moyen';
    return 'faible';
  }

  private extractRadonLevel(risk: RiskItem): number {
    const match = risk.description.match(/catégorie (\d)/);
    return match ? parseInt(match[1]) : 1;
  }

  private calculateRiskScore(risques: RiskItem[]): number {
    if (!risques.length) return 100;

    const penalties: Record<RiskItem['niveau'], number> = {
      faible: 5,
      moyen: 15,
      fort: 30,
      tres_fort: 50,
    };

    const totalPenalty = risques.reduce((sum, r) => sum + penalties[r.niveau], 0);
    return Math.max(0, Math.min(100, 100 - totalPenalty));
  }

  // -------------------------------------------------------------------------
  // Public helpers
  // -------------------------------------------------------------------------

  getRiskLabel(niveau: RiskItem['niveau']): string {
    const labels: Record<RiskItem['niveau'], string> = {
      faible: 'Faible',
      moyen: 'Moyen',
      fort: 'Fort',
      tres_fort: 'Très fort',
    };
    return labels[niveau];
  }

  getRiskColor(niveau: RiskItem['niveau']): string {
    const colors: Record<RiskItem['niveau'], string> = {
      faible: 'green',
      moyen: 'yellow',
      fort: 'orange',
      tres_fort: 'red',
    };
    return colors[niveau];
  }

  getScoreLabel(score: number): string {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Bon';
    if (score >= 40) return 'Moyen';
    if (score >= 20) return 'Préoccupant';
    return 'Critique';
  }
}

export const cadastreService = new CadastreService();
export default cadastreService;
