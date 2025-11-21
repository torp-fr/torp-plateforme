/**
 * Centralized API clients for French enterprise data
 */

// ============================================
// API Recherche Entreprises (Open - No auth)
// ============================================
const API_RECHERCHE_ENTREPRISES = 'https://recherche-entreprises.api.gouv.fr';

export interface RechercheEntrepriseResult {
  siren: string;
  siret?: string;
  nom_complet: string;
  nom_raison_sociale?: string;
  siege: {
    siret: string;
    adresse: string;
    code_postal: string;
    libelle_commune: string;
    latitude?: string;
    longitude?: string;
    liste_rge?: string[];
  };
  etat_administratif: string;
  date_creation: string;
  nature_juridique?: string;
  activite_principale?: string;
  tranche_effectif_salarie?: string;
  categorie_entreprise?: string;
  dirigeants?: any[];
  finances?: Record<string, { ca: number; resultat_net: number }>;
  complements?: {
    est_rge?: boolean;
    est_qualiopi?: boolean;
    est_bio?: boolean;
    convention_collective_renseignee?: boolean;
  };
}

export async function searchEntreprise(params: {
  q?: string;
  siret?: string;
  siren?: string;
  code_postal?: string;
  est_rge?: boolean;
}): Promise<{ results: RechercheEntrepriseResult[]; total: number }> {
  const searchParams = new URLSearchParams();

  if (params.q) searchParams.set('q', params.q);
  if (params.code_postal) searchParams.set('code_postal', params.code_postal);
  if (params.est_rge) searchParams.set('est_rge', 'true');
  searchParams.set('per_page', '10');

  // If SIRET provided, search by SIRET
  if (params.siret) {
    searchParams.set('q', params.siret);
  } else if (params.siren) {
    searchParams.set('q', params.siren);
  }

  const response = await fetch(`${API_RECHERCHE_ENTREPRISES}/search?${searchParams}`);

  if (!response.ok) {
    throw new Error(`API Recherche Entreprises error: ${response.status}`);
  }

  const data = await response.json();
  return {
    results: data.results || [],
    total: data.total_results || 0
  };
}

// ============================================
// API RGE ADEME (Open Data)
// ============================================
const API_RGE_ADEME = 'https://data.ademe.fr/data-fair/api/v1/datasets/liste-des-entreprises-rge-2/lines';

export interface RGECertification {
  siret: string;
  nom_entreprise: string;
  adresse: string;
  code_postal: string;
  commune: string;
  organisme: string;
  nom_qualification: string;
  domaine: string;
  date_debut: string;
  date_fin: string;
  url_qualification?: string;
}

export async function getRGECertifications(params: {
  siret?: string;
  nom?: string;
  code_postal?: string;
}): Promise<RGECertification[]> {
  const searchParams = new URLSearchParams({ size: '100' });

  const queries: string[] = [];
  if (params.siret) queries.push(`siret:"${params.siret}"`);
  if (params.nom) queries.push(`nom_entreprise:"${params.nom}"`);
  if (params.code_postal) queries.push(`code_postal:"${params.code_postal}"`);

  if (queries.length > 0) {
    searchParams.set('q', queries.join(' AND '));
  }

  const response = await fetch(`${API_RGE_ADEME}?${searchParams}`);

  if (!response.ok) {
    return [];
  }

  const data = await response.json();
  return data.results || [];
}

// ============================================
// API BODACC (Annonces légales)
// ============================================
const API_BODACC = 'https://bodacc-datadila.opendatasoft.com/api/explore/v2.0';

export interface BODACCAnnonce {
  id: string;
  dateparution: string;
  typeavis: string;
  familleavis: string;
  commercant?: string;
  ville?: string;
  registre?: string;
  tribunal?: string;
}

export async function getBODACCAnnonces(siren: string): Promise<BODACCAnnonce[]> {
  const where = encodeURIComponent(`registre LIKE "${siren}%"`);
  const response = await fetch(
    `${API_BODACC}/catalog/datasets/annonces-commerciales/records?where=${where}&limit=20`
  );

  if (!response.ok) {
    return [];
  }

  const data = await response.json();
  return (data.records || []).map((r: any) => r.record?.fields || r.fields);
}

// ============================================
// API Entreprise (Requires Bearer Token)
// ============================================
const API_ENTREPRISE_BASE = 'https://entreprise.api.gouv.fr';

export interface APIEntrepriseConfig {
  token: string;
  context?: string;
  object?: string;
  recipient?: string;
}

function buildAPIEntrepriseParams(config: APIEntrepriseConfig): URLSearchParams {
  return new URLSearchParams({
    context: config.context || 'Analyse devis TORP',
    object: config.object || 'Verification entreprise',
    recipient: config.recipient || '00000000000000'
  });
}

// Qualibat certification
export async function getQualibatCertification(siret: string, config: APIEntrepriseConfig) {
  const params = buildAPIEntrepriseParams(config);
  const response = await fetch(
    `${API_ENTREPRISE_BASE}/v4/qualibat/etablissements/${siret}/certification_batiment?${params}`,
    { headers: { Authorization: `Bearer ${config.token}` } }
  );
  if (!response.ok) return null;
  return response.json();
}

// Qualifelec certification
export async function getQualifelecCertification(siret: string, config: APIEntrepriseConfig) {
  const params = buildAPIEntrepriseParams(config);
  const response = await fetch(
    `${API_ENTREPRISE_BASE}/v3/qualifelec/etablissements/${siret}/certificats?${params}`,
    { headers: { Authorization: `Bearer ${config.token}` } }
  );
  if (!response.ok) return null;
  return response.json();
}

// OPQIBI certification (ingénierie)
export async function getOPQIBICertification(siren: string, config: APIEntrepriseConfig) {
  const params = buildAPIEntrepriseParams(config);
  const response = await fetch(
    `${API_ENTREPRISE_BASE}/v3/opqibi/unites_legales/${siren}/certification_ingenierie?${params}`,
    { headers: { Authorization: `Bearer ${config.token}` } }
  );
  if (!response.ok) return null;
  return response.json();
}

// URSSAF attestation vigilance
export async function getURSSAFAttestation(siren: string, config: APIEntrepriseConfig) {
  const params = buildAPIEntrepriseParams(config);
  const response = await fetch(
    `${API_ENTREPRISE_BASE}/v4/urssaf/unites_legales/${siren}/attestation_vigilance?${params}`,
    { headers: { Authorization: `Bearer ${config.token}` } }
  );
  if (!response.ok) return null;
  return response.json();
}

// DGFIP attestation fiscale
export async function getDGFIPAttestation(siren: string, config: APIEntrepriseConfig) {
  const params = buildAPIEntrepriseParams(config);
  const response = await fetch(
    `${API_ENTREPRISE_BASE}/v4/dgfip/unites_legales/${siren}/attestation_fiscale?${params}`,
    { headers: { Authorization: `Bearer ${config.token}` } }
  );
  if (!response.ok) return null;
  return response.json();
}

// Banque de France bilans
export async function getBDFBilans(siren: string, config: APIEntrepriseConfig) {
  const params = buildAPIEntrepriseParams(config);
  const response = await fetch(
    `${API_ENTREPRISE_BASE}/v3/banque_de_france/unites_legales/${siren}/bilans?${params}`,
    { headers: { Authorization: `Bearer ${config.token}` } }
  );
  if (!response.ok) return null;
  return response.json();
}

// DGFIP chiffres d'affaires
export async function getDGFIPChiffresAffaires(siret: string, config: APIEntrepriseConfig) {
  const params = buildAPIEntrepriseParams(config);
  const response = await fetch(
    `${API_ENTREPRISE_BASE}/v3/dgfip/etablissements/${siret}/chiffres_affaires?${params}`,
    { headers: { Authorization: `Bearer ${config.token}` } }
  );
  if (!response.ok) return null;
  return response.json();
}

// Infogreffe Kbis
export async function getInfogreffeKbis(siren: string, config: APIEntrepriseConfig) {
  const params = buildAPIEntrepriseParams(config);
  const response = await fetch(
    `${API_ENTREPRISE_BASE}/v3/infogreffe/rcs/unites_legales/${siren}/extrait_kbis?${params}`,
    { headers: { Authorization: `Bearer ${config.token}` } }
  );
  if (!response.ok) return null;
  return response.json();
}

// INSEE SIRENE adresse
export async function getINSEEAdresse(siret: string, config: APIEntrepriseConfig) {
  const params = buildAPIEntrepriseParams(config);
  const response = await fetch(
    `${API_ENTREPRISE_BASE}/v3/insee/sirene/etablissements/diffusibles/${siret}/adresse?${params}`,
    { headers: { Authorization: `Bearer ${config.token}` } }
  );
  if (!response.ok) return null;
  return response.json();
}

// ============================================
// Indices BTP (INSEE)
// ============================================
const API_INSEE_INDICES = 'https://api.insee.fr/series/BDM/V1/data';

export async function getIndicesBTP(inseeToken?: string): Promise<any> {
  // BT01 - Indice général tous travaux
  // Reference: https://www.insee.fr/fr/statistiques/serie/001711129

  if (!inseeToken) {
    // Return static fallback data
    return {
      BT01: { value: 129.8, date: '2024-Q4', name: 'Indice BT01 - Tous corps d\'état' },
      BT02: { value: 127.3, date: '2024-Q4', name: 'Terrassement' },
      BT03: { value: 131.2, date: '2024-Q4', name: 'Maçonnerie et béton armé' },
      BT40: { value: 125.6, date: '2024-Q4', name: 'Plomberie sanitaire' },
      BT41: { value: 128.9, date: '2024-Q4', name: 'Chauffage central' },
      BT43: { value: 126.4, date: '2024-Q4', name: 'Électricité' },
      source: 'INSEE - Base 2010'
    };
  }

  const response = await fetch(
    `${API_INSEE_INDICES}/SERIES_BDM/001711129`,
    { headers: { Authorization: `Bearer ${inseeToken}` } }
  );

  if (!response.ok) {
    return null;
  }

  return response.json();
}
