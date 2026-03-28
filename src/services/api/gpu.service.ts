import { log, warn, error, time, timeEnd } from '@/lib/logger';

/**
 * Service API Géoportail Urbanisme (GPU)
 * Récupération des données PLU, zonage, prescriptions
 * Documentation: https://apicarto.ign.fr/api/doc/gpu
 */

// =============================================================================
// TYPES
// =============================================================================

export interface GPUZoneUrba {
  libelle: string;
  libelong: string;
  typezone: string;
  destdomi: string;
  nomfic: string;
  urlfic: string;
  datvalid: string;
  idurba: string;
  partition: string;
}

export interface GPUPrescription {
  libelle: string;
  txt: string;
  typepsc: string;
  stypepsc?: string;
  nomfic?: string;
  urlfic?: string;
}

export interface GPUDocument {
  idurba: string;
  typedoc: 'PLU' | 'PLUi' | 'POS' | 'CC' | 'PSMV' | 'RNU';
  etat: 'opposable' | 'en cours' | 'annulé' | 'remplacé';
  nomreg: string;
  urlreg?: string;
  nomplan?: string;
  urlplan?: string;
  siteweb?: string;
  typeref?: string;
  dateref?: string;
  datappro?: string;
}

export interface GPUServitude {
  libelle: string;
  txt: string;
  typeserv: string;
  nomfic?: string;
  urlfic?: string;
}

export interface PLUAnalysisResult {
  documentType: string;
  documentState: string;
  zone: string;
  zoneType: string;
  zoneLongName: string;
  destination: string;
  prescriptions: Array<{
    type: string;
    subtype?: string;
    libelle: string;
    description: string;
    documentUrl?: string;
  }>;
  servitudes: Array<{
    type: string;
    libelle: string;
    description: string;
  }>;
  reglementUrl?: string;
  planUrl?: string;
  communeWebsite?: string;
  dateApprobation?: string;
  source: string;
  fetchedAt: string;
  confidence: 'high' | 'medium' | 'low';
}

// =============================================================================
// SERVICE
// =============================================================================

class GPUService {
  private readonly BASE_URL = 'https://apicarto.ign.fr/api/gpu';
  private readonly TIMEOUT_MS = 10000;

  /**
   * Récupérer le document d'urbanisme (PLU/PLUi/POS) pour une commune
   */
  async getDocument(codeInsee: string): Promise<GPUDocument | null> {
    try {
      const response = await this.fetchWithTimeout(
        `${this.BASE_URL}/document?code_insee=${codeInsee}`
      );

      if (!response.ok) {
        warn(`GPU getDocument error: ${response.status} for ${codeInsee}`);
        return null;
      }

      const data = await response.json();
      const doc = data.features?.[0]?.properties;

      if (!doc) return null;

      return {
        idurba: doc.idurba || '',
        typedoc: doc.typedoc || 'RNU',
        etat: doc.etat || 'en cours',
        nomreg: doc.nomreg || '',
        urlreg: doc.urlreg,
        nomplan: doc.nomplan,
        urlplan: doc.urlplan,
        siteweb: doc.siteweb,
        typeref: doc.typeref,
        dateref: doc.dateref,
        datappro: doc.datappro,
      };
    } catch (error) {
      console.error('GPU getDocument error:', error);
      return null;
    }
  }

  /**
   * Récupérer le zonage PLU pour une commune entière
   */
  async getZoneUrba(codeInsee: string): Promise<GPUZoneUrba[]> {
    try {
      const response = await this.fetchWithTimeout(
        `${this.BASE_URL}/zone-urba?code_insee=${codeInsee}`
      );

      if (!response.ok) {
        warn(`GPU getZoneUrba error: ${response.status}`);
        return [];
      }

      const data = await response.json();
      return (data.features || []).map((f: { properties: GPUZoneUrba }) => ({
        libelle: f.properties.libelle || 'Non spécifié',
        libelong: f.properties.libelong || '',
        typezone: f.properties.typezone || 'U',
        destdomi: f.properties.destdomi || '',
        nomfic: f.properties.nomfic || '',
        urlfic: f.properties.urlfic || '',
        datvalid: f.properties.datvalid || '',
        idurba: f.properties.idurba || '',
        partition: f.properties.partition || '',
      }));
    } catch (error) {
      console.error('GPU getZoneUrba error:', error);
      return [];
    }
  }

  /**
   * Récupérer le zonage pour un point géographique précis
   */
  async getZoneUrbaByPoint(lon: number, lat: number): Promise<GPUZoneUrba | null> {
    try {
      const geom = encodeURIComponent(JSON.stringify({
        type: 'Point',
        coordinates: [lon, lat],
      }));

      const response = await this.fetchWithTimeout(
        `${this.BASE_URL}/zone-urba?geom=${geom}`
      );

      if (!response.ok) {
        warn(`GPU getZoneUrbaByPoint error: ${response.status}`);
        return null;
      }

      const data = await response.json();
      const props = data.features?.[0]?.properties;

      if (!props) return null;

      return {
        libelle: props.libelle || 'Non spécifié',
        libelong: props.libelong || '',
        typezone: props.typezone || 'U',
        destdomi: props.destdomi || '',
        nomfic: props.nomfic || '',
        urlfic: props.urlfic || '',
        datvalid: props.datvalid || '',
        idurba: props.idurba || '',
        partition: props.partition || '',
      };
    } catch (error) {
      console.error('GPU getZoneUrbaByPoint error:', error);
      return null;
    }
  }

  /**
   * Récupérer les prescriptions PLU (surfaciques)
   */
  async getPrescriptions(codeInsee: string): Promise<GPUPrescription[]> {
    try {
      const response = await this.fetchWithTimeout(
        `${this.BASE_URL}/prescription-surf?code_insee=${codeInsee}`
      );

      if (!response.ok) {
        warn(`GPU getPrescriptions error: ${response.status}`);
        return [];
      }

      const data = await response.json();
      return (data.features || []).map((f: { properties: GPUPrescription }) => ({
        libelle: f.properties.libelle || 'Non spécifié',
        txt: f.properties.txt || '',
        typepsc: f.properties.typepsc || '',
        stypepsc: f.properties.stypepsc,
        nomfic: f.properties.nomfic,
        urlfic: f.properties.urlfic,
      }));
    } catch (error) {
      console.error('GPU getPrescriptions error:', error);
      return [];
    }
  }

  /**
   * Récupérer les prescriptions pour un point géographique
   */
  async getPrescriptionsByPoint(lon: number, lat: number): Promise<GPUPrescription[]> {
    try {
      const geom = encodeURIComponent(JSON.stringify({
        type: 'Point',
        coordinates: [lon, lat],
      }));

      const response = await this.fetchWithTimeout(
        `${this.BASE_URL}/prescription-surf?geom=${geom}`
      );

      if (!response.ok) return [];

      const data = await response.json();
      return (data.features || []).map((f: { properties: GPUPrescription }) => ({
        libelle: f.properties.libelle || '',
        txt: f.properties.txt || '',
        typepsc: f.properties.typepsc || '',
        stypepsc: f.properties.stypepsc,
        nomfic: f.properties.nomfic,
        urlfic: f.properties.urlfic,
      }));
    } catch (error) {
      console.error('GPU getPrescriptionsByPoint error:', error);
      return [];
    }
  }

  /**
   * Récupérer les servitudes d'utilité publique
   */
  async getServitudes(codeInsee: string): Promise<GPUServitude[]> {
    try {
      const response = await this.fetchWithTimeout(
        `${this.BASE_URL}/secteur-cc?code_insee=${codeInsee}`
      );

      if (!response.ok) return [];

      const data = await response.json();
      return (data.features || []).map((f: { properties: GPUServitude }) => ({
        libelle: f.properties.libelle || '',
        txt: f.properties.txt || '',
        typeserv: f.properties.typeserv || '',
        nomfic: f.properties.nomfic,
        urlfic: f.properties.urlfic,
      }));
    } catch (error) {
      console.error('GPU getServitudes error:', error);
      return [];
    }
  }

  /**
   * Analyse PLU complète pour un projet
   * Combine toutes les données GPU en une analyse structurée
   */
  async analyzePLU(
    codeInsee: string,
    coordinates?: { lon: number; lat: number }
  ): Promise<PLUAnalysisResult> {
    // Récupérer données en parallèle
    const [document, zones, prescriptions, servitudes] = await Promise.all([
      this.getDocument(codeInsee),
      coordinates
        ? this.getZoneUrbaByPoint(coordinates.lon, coordinates.lat).then(z => (z ? [z] : []))
        : this.getZoneUrba(codeInsee),
      coordinates
        ? this.getPrescriptionsByPoint(coordinates.lon, coordinates.lat)
        : this.getPrescriptions(codeInsee),
      this.getServitudes(codeInsee),
    ]);

    const zone = zones[0];
    const hasRealData = document !== null || zone !== undefined;

    return {
      documentType: document?.typedoc || 'Non spécifié',
      documentState: document?.etat || 'Non spécifié',
      zone: zone?.libelle || 'Non spécifié',
      zoneType: zone?.typezone || 'U',
      zoneLongName: zone?.libelong || '',
      destination: this.parseDestination(zone?.destdomi),
      prescriptions: prescriptions.map(p => ({
        type: this.parsePrescriptionType(p.typepsc),
        subtype: p.stypepsc,
        libelle: p.libelle,
        description: p.txt,
        documentUrl: p.urlfic,
      })),
      servitudes: servitudes.map(s => ({
        type: s.typeserv,
        libelle: s.libelle,
        description: s.txt,
      })),
      reglementUrl: zone?.urlfic || document?.urlreg,
      planUrl: document?.urlplan,
      communeWebsite: document?.siteweb,
      dateApprobation: document?.datappro,
      source: 'Géoportail Urbanisme (GPU) - IGN',
      fetchedAt: new Date().toISOString(),
      confidence: hasRealData ? (coordinates ? 'high' : 'medium') : 'low',
    };
  }

  // =============================================================================
  // PRIVATE METHODS
  // =============================================================================

  private async fetchWithTimeout(url: string): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private parseDestination(destdomi?: string): string {
    const destinations: Record<string, string> = {
      '01': 'Habitation',
      '02': 'Activité',
      '03': 'Destination mixte',
      '04': 'Loisirs et tourisme',
      '05': 'Équipement',
      '06': 'Activité agricole',
      '07': 'Espace naturel',
      '00': 'Sans objet',
    };
    return destinations[destdomi || ''] || destdomi || 'Non spécifié';
  }

  private parsePrescriptionType(typepsc: string): string {
    const types: Record<string, string> = {
      '01': 'Espace boisé classé',
      '02': 'Limitations de la constructibilité',
      '03': 'Secteur avec dispositions de reconstruction/démolition',
      '04': 'Périmètre de protection',
      '05': 'Emplacement réservé',
      '06': 'Secteur à densité spécifique',
      '07': 'Patrimoine à protéger',
      '08': 'Zone d\'aménagement concerté',
      '09': 'Secteur d\'attente de projet',
      '10': 'Élément de paysage',
      '11': 'Secteur de risques',
      '12': 'Secteur à programme de logements',
      '13': 'Secteur de taille et capacité d\'accueil limitées',
      '14': 'Secteur de mixité sociale',
      '15': 'Secteur avec règles volumétriques alternatives',
      '16': 'Secteur de diversité commerciale',
      '17': 'Secteur à plan de masse',
      '18': 'Aire de mise en valeur de l\'architecture',
      '19': 'Secteur de projet',
      '20': 'Secteur de performance environnementale',
      '21': 'Réservation logement',
      '22': 'Secteur OAP',
      '23': 'Plan de masse',
      '24': 'Périmètre patrimoine bâti',
      '25': 'Secteur de majoration des droits',
      '26': 'Secteur du bonus de constructibilité',
      '27': 'Secteur de transfert de constructibilité',
      '28': 'Périmètre de préemption',
      '29': 'Secteur de renaturation',
      '99': 'Autre',
    };
    return types[typepsc] || `Type ${typepsc}`;
  }
}

export const gpuService = new GPUService();
export default gpuService;
