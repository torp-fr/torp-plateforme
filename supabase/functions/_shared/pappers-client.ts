/**
 * Pappers API Client
 * Premium API for comprehensive French company data
 * Documentation: https://www.pappers.fr/api/documentation
 */

const PAPPERS_API_BASE = 'https://api.pappers.fr/v2';

export interface PappersConfig {
  apiKey: string;
}

// ============================================
// Types & Interfaces
// ============================================

export interface PappersCompany {
  siren: string;
  siren_formate: string;
  nom_entreprise: string;
  nom: string;
  prenom?: string;
  denomination?: string;
  sigle?: string;

  // Legal structure
  forme_juridique: string;
  forme_juridique_code: string;
  capital?: number;
  capital_formate?: string;

  // Activity
  code_naf: string;
  libelle_code_naf: string;
  domaine_activite: string;
  objet_social?: string;

  // Administrative status
  date_creation: string;
  date_creation_formate: string;
  date_radiation?: string;
  entreprise_cessee: boolean;
  date_cloture_exercice?: string;

  // Size indicators
  categorie_juridique: string;
  tranche_effectif_salarie?: string;
  effectif?: number;
  effectif_min?: number;
  effectif_max?: number;

  // Address
  siege: PappersEtablissement;

  // Representatives
  representants: PappersRepresentant[];
  beneficiaires_effectifs?: PappersBeneficiaire[];

  // Financial data
  finances?: PappersFinances[];

  // Compliance & legal
  statut_rcs: string;
  greffe: string;
  numero_rcs: string;
  date_immatriculation_rcs?: string;
  date_debut_activite?: string;

  // Certifications
  labels_certificats?: PappersLabel[];

  // Publications & announcements
  publications_bodacc?: PappersPublication[];
  procedures_collectives?: PappersProcedure[];

  // Scores & ratings
  score_solvabilite?: string;
  score_solvabilite_value?: number;

  // Additional info
  convention_collective?: {
    nom: string;
    idcc: string;
  };

  // Risk indicators
  redressements?: any[];
  comptes_annuels?: any[];
}

export interface PappersEtablissement {
  siret: string;
  siret_formate: string;
  siege: boolean;
  nom_commercial?: string;
  enseigne?: string;

  adresse_ligne_1: string;
  adresse_ligne_2?: string;
  code_postal: string;
  ville: string;
  pays: string;
  latitude?: number;
  longitude?: number;

  code_naf: string;
  libelle_code_naf: string;

  date_creation: string;
  date_creation_formate: string;
  date_debut_activite?: string;
  date_fermeture?: string;
  etablissement_cesse: boolean;

  effectif?: number;
  tranche_effectif_salarie?: string;
}

export interface PappersRepresentant {
  nom: string;
  prenom?: string;
  nom_complet: string;
  qualite: string; // "Président", "Gérant", "Directeur général"
  date_naissance?: string;
  date_prise_de_poste?: string;
  nationalite?: string;
  pays_naissance?: string;
  actionnaire?: boolean;
  pourcentage_detention?: number;
}

export interface PappersBeneficiaire {
  nom: string;
  prenom?: string;
  nom_complet: string;
  type_detention: string;
  date_naissance?: string;
  nationalite?: string;
  pourcentage_parts?: number;
  pourcentage_votes?: number;
}

export interface PappersFinances {
  annee: number;
  date_cloture_exercice: string;
  duree_exercice?: number;

  chiffre_affaires?: number;
  resultat_net?: number;
  resultat_exploitation?: number;
  excedent_brut_exploitation?: number;

  marge_brute?: number;
  charges_personnel?: number;

  total_bilan?: number;
  capitaux_propres?: number;

  disponibilites?: number;
  dettes?: number;
  dettes_financieres?: number;
}

export interface PappersLabel {
  label: string;
  type: string;
  date_delivrance?: string;
  date_expiration?: string;
}

export interface PappersPublication {
  numero_parution: string;
  date_parution: string;
  bodacc: string;
  type: string;
  texte: string;
  details?: any;
}

export interface PappersProcedure {
  type: string; // "Redressement", "Liquidation", "Sauvegarde"
  date_jugement: string;
  tribunal: string;
  ville_tribunal?: string;
  numero_jugement?: string;
  complementaire?: string;
}

export interface PappersSuggestion {
  siren: string;
  nom_entreprise: string;
  siege: {
    siret: string;
    adresse: string;
    code_postal: string;
    ville: string;
  };
}

export interface PappersSearchResult {
  resultats: PappersCompany[];
  total: number;
  nombre_resultats: number;
  page: number;
  par_page: number;
}

// ============================================
// API Methods
// ============================================

/**
 * Search companies by name or other criteria
 */
export async function searchCompanies(
  query: string,
  config: PappersConfig,
  options?: {
    codePostal?: string;
    codeNaf?: string;
    region?: string;
    departement?: string;
    entrepriseCessee?: boolean;
    page?: number;
    parPage?: number;
  }
): Promise<PappersSearchResult> {
  const params = new URLSearchParams({
    api_token: config.apiKey,
    q: query,
    par_page: String(options?.parPage || 10),
    page: String(options?.page || 1),
  });

  if (options?.codePostal) params.set('code_postal', options.codePostal);
  if (options?.codeNaf) params.set('code_naf', options.codeNaf);
  if (options?.region) params.set('region', options.region);
  if (options?.departement) params.set('departement', options.departement);
  if (options?.entrepriseCessee !== undefined) {
    params.set('entreprise_cessee', String(options.entrepriseCessee));
  }

  const response = await fetch(`${PAPPERS_API_BASE}/recherche?${params}`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Pappers API error: ${response.status} - ${error}`);
  }

  return response.json();
}

/**
 * Get company by SIREN (9 digits)
 */
export async function getCompanyBySiren(
  siren: string,
  config: PappersConfig,
  options?: {
    representants?: boolean;
    beneficiaires?: boolean;
    finances?: boolean;
    publications?: boolean;
    procedures?: boolean;
  }
): Promise<PappersCompany> {
  const params = new URLSearchParams({
    api_token: config.apiKey,
    siren: siren.replace(/\s/g, ''),
  });

  // Add optional data sections
  if (options?.representants) params.set('representants', 'true');
  if (options?.beneficiaires) params.set('beneficiaires_effectifs', 'true');
  if (options?.finances) params.set('finances', 'true');
  if (options?.publications) params.set('publications_bodacc', 'true');
  if (options?.procedures) params.set('procedures_collectives', 'true');

  const response = await fetch(`${PAPPERS_API_BASE}/entreprise?${params}`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Pappers API error: ${response.status} - ${error}`);
  }

  return response.json();
}

/**
 * Get establishment by SIRET (14 digits)
 */
export async function getEstablishmentBySiret(
  siret: string,
  config: PappersConfig
): Promise<{ entreprise: PappersCompany; etablissement: PappersEtablissement }> {
  const params = new URLSearchParams({
    api_token: config.apiKey,
    siret: siret.replace(/\s/g, ''),
  });

  const response = await fetch(`${PAPPERS_API_BASE}/etablissement?${params}`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Pappers API error: ${response.status} - ${error}`);
  }

  return response.json();
}

/**
 * Get company suggestions (autocomplete)
 */
export async function suggestCompanies(
  query: string,
  config: PappersConfig,
  maxResults: number = 10
): Promise<PappersSuggestion[]> {
  const params = new URLSearchParams({
    api_token: config.apiKey,
    q: query,
    longueur: String(maxResults),
  });

  const response = await fetch(`${PAPPERS_API_BASE}/recherche-suggestions?${params}`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    return [];
  }

  const data = await response.json();
  return data.resultats || [];
}

/**
 * Get company documents (Kbis, statuts, etc.)
 */
export async function getCompanyDocuments(
  siren: string,
  config: PappersConfig
): Promise<any> {
  const params = new URLSearchParams({
    api_token: config.apiKey,
    siren: siren.replace(/\s/g, ''),
  });

  const response = await fetch(`${PAPPERS_API_BASE}/documents?${params}`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    return null;
  }

  return response.json();
}

/**
 * Check API quota/credits
 */
export async function checkApiStatus(config: PappersConfig): Promise<{
  credits_restants: number;
  credits_utilises: number;
  limite_mensuelle: number;
}> {
  const params = new URLSearchParams({
    api_token: config.apiKey,
  });

  const response = await fetch(`${PAPPERS_API_BASE}/statut?${params}`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Pappers API error: ${response.status}`);
  }

  return response.json();
}

// ============================================
// Utility Functions
// ============================================

/**
 * Calculate company quality score based on Pappers data
 */
export function calculateQualityScore(company: PappersCompany): number {
  let score = 0;
  let maxScore = 0;

  // Basic info (30 points)
  maxScore += 30;
  if (company.denomination) score += 10;
  if (company.objet_social) score += 10;
  if (company.date_creation) score += 10;

  // Legal & administrative (20 points)
  maxScore += 20;
  if (company.statut_rcs === 'Inscrit') score += 10;
  if (!company.entreprise_cessee) score += 10;

  // Representatives (15 points)
  maxScore += 15;
  if (company.representants && company.representants.length > 0) score += 15;

  // Financial data (20 points)
  maxScore += 20;
  if (company.finances && company.finances.length > 0) {
    score += 10;
    const latestFinances = company.finances[0];
    if (latestFinances.chiffre_affaires !== undefined) score += 5;
    if (latestFinances.resultat_net !== undefined) score += 5;
  }

  // Risk indicators (15 points)
  maxScore += 15;
  if (!company.procedures_collectives || company.procedures_collectives.length === 0) {
    score += 15;
  }

  // Normalized to 100
  return Math.round((score / maxScore) * 100);
}

/**
 * Extract risk indicators from Pappers data
 */
export function extractRiskIndicators(company: PappersCompany): {
  level: 'low' | 'medium' | 'high' | 'critical';
  alerts: string[];
} {
  const alerts: string[] = [];
  let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';

  // Company ceased
  if (company.entreprise_cessee) {
    alerts.push('CRITIQUE: Entreprise radiée');
    riskLevel = 'critical';
  }

  // Collective procedures
  if (company.procedures_collectives && company.procedures_collectives.length > 0) {
    const procedures = company.procedures_collectives;
    for (const proc of procedures) {
      alerts.push(`CRITIQUE: ${proc.type} - ${proc.date_jugement}`);
    }
    riskLevel = 'critical';
  }

  // Recent creation (< 2 years)
  if (company.date_creation) {
    const creationDate = new Date(company.date_creation);
    const ageYears = (Date.now() - creationDate.getTime()) / (1000 * 60 * 60 * 24 * 365);
    if (ageYears < 2) {
      alerts.push('ATTENTION: Entreprise récente (moins de 2 ans)');
      if (riskLevel === 'low') riskLevel = 'medium';
    }
  }

  // Financial health
  if (company.finances && company.finances.length > 0) {
    const latestFinances = company.finances[0];
    if (latestFinances.resultat_net !== undefined && latestFinances.resultat_net < 0) {
      alerts.push(`ATTENTION: Résultat net négatif (${latestFinances.annee})`);
      if (riskLevel === 'low') riskLevel = 'medium';
    }

    if (latestFinances.capitaux_propres !== undefined && latestFinances.capitaux_propres < 0) {
      alerts.push(`ALERTE: Capitaux propres négatifs (${latestFinances.annee})`);
      if (riskLevel !== 'critical') riskLevel = 'high';
    }
  }

  // Solvency score
  if (company.score_solvabilite_value !== undefined) {
    if (company.score_solvabilite_value < 30) {
      alerts.push('ALERTE: Score de solvabilité faible');
      if (riskLevel !== 'critical') riskLevel = 'high';
    }
  }

  return { level: riskLevel, alerts };
}

/**
 * Format Pappers data for cache storage
 */
export function formatPappersDataForCache(company: PappersCompany): any {
  return {
    // Identity
    siren: company.siren,
    siret: company.siege?.siret,
    nom: company.nom_entreprise,
    denomination: company.denomination,
    sigle: company.sigle,

    // Legal
    forme_juridique: company.forme_juridique,
    capital: company.capital,
    date_creation: company.date_creation,
    entreprise_cessee: company.entreprise_cessee,

    // Activity
    code_naf: company.code_naf,
    libelle_naf: company.libelle_code_naf,
    domaine_activite: company.domaine_activite,

    // Size
    effectif: company.effectif,
    tranche_effectif: company.tranche_effectif_salarie,

    // Location
    siege: company.siege,

    // People
    representants: company.representants?.slice(0, 3), // Keep top 3

    // Finances
    finances: company.finances?.slice(0, 3), // Keep last 3 years

    // Risk
    procedures_collectives: company.procedures_collectives,
    score_solvabilite: company.score_solvabilite_value,

    // Certifications
    labels: company.labels_certificats,

    // Recent publications
    publications_bodacc: company.publications_bodacc?.slice(0, 5),

    // Metadata
    fetched_at: new Date().toISOString(),
    source: 'pappers',
  };
}
