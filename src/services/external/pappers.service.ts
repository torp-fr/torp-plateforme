// ─────────────────────────────────────────────────────────────────────────────
// pappers.service.ts — Server-side Pappers enterprise enrichment
//
// Pappers provides enriched company data: financials, dirigeants, certifications,
// procedures collectives, etc. Requires a paid API key.
//
// API docs: https://www.pappers.fr/api/documentation
// ─────────────────────────────────────────────────────────────────────────────

import { structuredLogger } from '@/services/observability/structured-logger.js';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const TIMEOUT_MS    = 10_000;
const PAPPERS_BASE  = 'https://api.pappers.fr/v2';
const COST_PER_CALL = 0.001; // ~€0.001 per API call (approximate)

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PappersEntreprise {
  siren:                string;
  siret_siege:          string;
  nom_entreprise:       string | null;
  forme_juridique:      string | null;
  code_naf:             string | null;
  libelle_naf:          string | null;
  date_creation:        string | null;
  est_active:           boolean;
  entreprise_cessee:    boolean;
  effectif_min:         number | null;
  effectif_max:         number | null;
  capital:              number | null;
  adresse_complete:     string | null;
  code_postal:          string | null;
  commune:              string | null;
  score_pappers:        number | null;   // 0–10, fiabilité
  procedures_collectives: boolean;        // redressement, liquidation
  dirigeants:           PappersDirigeant[];
  certifications_rge:   string[];         // e.g. ['QualiPV', 'Qualibat']
  source:               'pappers';
}

export interface PappersDirigeant {
  nom:             string | null;
  prenom:          string | null;
  qualite:         string | null;   // 'Gérant', 'Président', etc.
  date_naissance:  string | null;
  nationalite:     string | null;
}

export interface PappersSearchResult {
  siren:          string;
  nom_entreprise: string | null;
  siret_siege:    string;
  adresse:        string | null;
  code_naf:       string | null;
  est_active:     boolean;
}

// ── Service ───────────────────────────────────────────────────────────────────

export class PappersService {
  private readonly apiKey = process.env.PAPPERS_API_KEY ?? '';
  private readonly supabase: SupabaseClient | null;

  constructor() {
    const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
    this.supabase = url && key ? createClient(url, key) : null;
  }

  /**
   * Fetch full enterprise enrichment data by SIREN (9 digits).
   * Uses the /entreprise endpoint which returns the most complete dataset.
   */
  async getEntrepriseBySiren(siren: string): Promise<PappersEntreprise> {
    if (!this.apiKey) throw new Error('PAPPERS_API_KEY not configured');

    const clean = siren.replace(/\s/g, '');
    if (!/^\d{9}$/.test(clean)) throw new Error(`Invalid SIREN: ${siren}`);

    try {
      const params = new URLSearchParams({
        api_token:           this.apiKey,
        siren:               clean,
        extrait_inpi:        'true',
        beneficiaires:       'true',
        dirigeants:          'true',
        publications:        'false',
        finances:            'false',
      });

      const resp = await fetch(`${PAPPERS_BASE}/entreprise?${params}`, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      if (resp.status === 404) throw new Error(`Entreprise non trouvée: ${siren}`);
      if (resp.status === 401 || resp.status === 403) throw new Error('Pappers: clé API invalide');
      if (!resp.ok) throw new Error(`Pappers returned ${resp.status}`);

      const data = await resp.json();
      const result = this.mapEntreprise(data);

      this.trackCost(1, 'pappers-entreprise');

      return result;
    } catch (err) {
      structuredLogger.warn({ message: 'Pappers getEntrepriseBySiren failed', siren: clean, error: String(err) });
      throw err;
    }
  }

  /**
   * Fetch full enterprise enrichment data by SIRET (14 digits).
   * Extracts SIREN and delegates.
   */
  async getEntrepriseBySiret(siret: string): Promise<PappersEntreprise> {
    const clean = siret.replace(/\s/g, '');
    if (!/^\d{14}$/.test(clean)) throw new Error(`Invalid SIRET: ${siret}`);
    return this.getEntrepriseBySiren(clean.slice(0, 9));
  }

  /**
   * Search enterprises by name or keyword.
   */
  async searchEntreprises(query: string, limit = 10): Promise<PappersSearchResult[]> {
    if (!this.apiKey) throw new Error('PAPPERS_API_KEY not configured');

    try {
      const params = new URLSearchParams({
        api_token:   this.apiKey,
        q:           query,
        par_page:    String(Math.min(limit, 20)),
        page:        '1',
      });

      const resp = await fetch(`${PAPPERS_BASE}/recherche?${params}`, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      if (!resp.ok) throw new Error(`Pappers recherche returned ${resp.status}`);

      const data = await resp.json() as { resultats?: any[] };
      this.trackCost(1, 'pappers-recherche');

      return (data.resultats ?? []).map(r => this.mapSearchResult(r));
    } catch (err) {
      structuredLogger.warn({ message: 'Pappers search failed', query, error: String(err) });
      throw err;
    }
  }

  // ── Private ──────────────────────────────────────────────────────────────

  private mapEntreprise(data: any): PappersEntreprise {
    const siege = data.siege ?? {};
    const dirigeants: PappersDirigeant[] = (data.representants ?? []).map((r: any) => ({
      nom:            r.nom ?? null,
      prenom:         r.prenom ?? null,
      qualite:        r.qualite ?? null,
      date_naissance: r.date_naissance_formate ?? null,
      nationalite:    r.nationalite ?? null,
    }));

    // Detect RGE certifications from labels / certifications
    const certifications: string[] = [];
    for (const cert of data.certifications ?? []) {
      if (cert.nom) certifications.push(cert.nom);
    }

    const hasProcedure = !!(
      data.derniere_procedure_collective?.en_cours ||
      data.en_liquidation ||
      data.en_redressement
    );

    return {
      siren:                  data.siren ?? '',
      siret_siege:            data.siret_siege ?? siege.siret ?? '',
      nom_entreprise:         data.nom_entreprise ?? data.denomination ?? null,
      forme_juridique:        data.forme_juridique ?? null,
      code_naf:               data.code_naf ?? null,
      libelle_naf:            data.libelle_code_naf ?? null,
      date_creation:          data.date_creation ?? null,
      est_active:             !data.entreprise_cessee,
      entreprise_cessee:      data.entreprise_cessee ?? false,
      effectif_min:           data.effectif_min ?? null,
      effectif_max:           data.effectif_max ?? null,
      capital:                data.capital ?? null,
      adresse_complete:       siege.adresse_ligne_1 ?? siege.adresse ?? null,
      code_postal:            siege.code_postal ?? null,
      commune:                siege.ville ?? null,
      score_pappers:          data.score ?? null,
      procedures_collectives: hasProcedure,
      dirigeants,
      certifications_rge:     certifications,
      source:                 'pappers',
    };
  }

  private mapSearchResult(r: any): PappersSearchResult {
    return {
      siren:          r.siren ?? '',
      nom_entreprise: r.nom_entreprise ?? null,
      siret_siege:    r.siret_siege ?? '',
      adresse:        r.siege?.adresse_ligne_1 ?? null,
      code_naf:       r.code_naf ?? null,
      est_active:     !r.entreprise_cessee,
    };
  }

  /** Fire-and-forget cost tracking to Supabase api_costs table. */
  private trackCost(callCount: number, endpoint: string): void {
    if (!this.supabase) return;
    const costUsd = COST_PER_CALL * callCount;

    this.supabase.from('api_costs').insert({
      api_name:    'pappers',
      cost_usd:    costUsd,
      metrics:     { requests_count: callCount, endpoint },
      recorded_at: new Date().toISOString(),
    }).then(() => void 0).catch(() => void 0);
  }
}
