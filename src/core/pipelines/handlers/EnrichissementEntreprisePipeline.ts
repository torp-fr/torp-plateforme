// ─────────────────────────────────────────────────────────────────────
// EnrichissementEntreprisePipeline
// Fetches RCS data (Pappers) + certifications (data.gouv) + reputation
// Input:  siret: string
// Output: { rcs_data, certifications, reputation }
// ─────────────────────────────────────────────────────────────────────

import { callAPIWithRetry } from '../utils/index.js';
import type { PipelineContext, PipelineResult } from '../types/index.js';

interface RCSData {
  code_naf?: string;
  libelle_naf?: string;
  effectifs?: number;
  chiffre_affaires?: number;
  capital_social?: number;
  forme_juridique?: string;
  date_creation?: string;
  adresse_siege?: string;
  dirigeant?: string;
  raison_sociale?: string;
}

interface Certifications {
  rge: boolean;
  qualiopi: boolean;
  qualibat: boolean;
  qualifelec: boolean;
  labels: string[];
  last_fetched_at: string;
}

interface Reputation {
  google: { note: number; count: number; last_fetched_at: string } | null;
  trustpilot: { note: number; count: number; last_fetched_at: string } | null;
}

interface EnrichissementResult {
  rcs_data: RCSData | null;
  certifications: Certifications | null;
  reputation: Reputation | null;
}

export class EnrichissementEntreprisePipeline {
  async execute(
    params: { siret: string },
    context: PipelineContext
  ): Promise<PipelineResult<EnrichissementResult>> {
    const startTime = Date.now();
    const warnings: string[] = [];

    try {
      // Step 1 + 2 in parallel (both free APIs)
      const [rcsData, certifications] = await Promise.allSettled([
        this.fetchRCS(params.siret),
        this.fetchCertifications(params.siret),
      ]);

      const rcs = rcsData.status === 'fulfilled' ? rcsData.value : null;
      if (rcsData.status === 'rejected') {
        warnings.push(`Pappers fetch failed: ${rcsData.reason?.message}`);
      }

      const certs = certifications.status === 'fulfilled' ? certifications.value : null;
      if (certifications.status === 'rejected') {
        warnings.push(`Certifications fetch failed: ${certifications.reason?.message}`);
      }

      // Step 3: Reputation (optional — only if paid key present)
      let reputation: Reputation | null = null;
      if (process.env.TRUSTPILOT_API_KEY && rcs?.raison_sociale) {
        try {
          reputation = await this.fetchReputation(rcs.raison_sociale);
        } catch (err) {
          warnings.push(`Reputation fetch failed (non-blocking): ${err}`);
        }
      }

      const data: EnrichissementResult = {
        rcs_data: rcs,
        certifications: certs,
        reputation,
      };

      return {
        status: 'completed',
        data,
        warnings: warnings.length > 0 ? warnings : undefined,
        executionTimeMs: Date.now() - startTime,
        retryable: false,
      };
    } catch (err) {
      return {
        status: 'failed',
        error: err instanceof Error ? err.message : String(err),
        executionTimeMs: Date.now() - startTime,
        retryable: true,
      };
    }
  }

  private async fetchRCS(siret: string): Promise<RCSData | null> {
    const endpoint = process.env.PAPPERS_API_ENDPOINT ?? 'https://api.pappers.fr/v2';
    const key = process.env.PAPPERS_API_KEY;

    if (!key) {
      console.warn('[EnrichissementEntreprise] PAPPERS_API_KEY not set — skipping RCS fetch');
      return null;
    }

    const raw = await callAPIWithRetry<Record<string, unknown>>({
      method: 'GET',
      url: `${endpoint}/entreprise?siret=${siret}&api_token=${key}`,
      retries: 2,
      fallback: null,
    });

    if (!raw) return null;

    return {
      code_naf:        raw['code_naf'] as string | undefined,
      libelle_naf:     raw['libelle_code_naf'] as string | undefined,
      effectifs:       raw['tranche_effectif'] as number | undefined,
      chiffre_affaires: raw['chiffre_affaires'] as number | undefined,
      capital_social:  raw['capital'] as number | undefined,
      forme_juridique: raw['forme_juridique'] as string | undefined,
      date_creation:   raw['date_creation'] as string | undefined,
      adresse_siege:   raw['siege']?.['adresse_ligne_1'] as string | undefined,
      dirigeant:       (raw['representants'] as Array<Record<string, unknown>>)?.[0]?.['nom_complet'] as string | undefined,
      raison_sociale:  raw['nom_entreprise'] as string | undefined,
    };
  }

  private async fetchCertifications(siret: string): Promise<Certifications> {
    // data.gouv RGE dataset — free, no key
    const endpoint = process.env.DATAGOUV_API_ENDPOINT ?? 'https://www.data.gouv.fr/api/1';

    const rgeData = await callAPIWithRetry<{ total: number; data?: Array<Record<string, unknown>> }>({
      method: 'GET',
      url: `${endpoint}/datasets/r/7e6c5d60-5d3c-432e-b2a2-b9b51c6bb1d2?siret=${siret}`,
      retries: 2,
      fallback: { total: 0 },
    });

    const isRGE = (rgeData?.total ?? 0) > 0;

    // NAF code can indicate Qualiopi/Qualibat — simplified heuristic for now
    // Real implementation would query the RNCP / Qualiopi registry
    return {
      rge:        isRGE,
      qualiopi:   false, // TBD: RNCP API
      qualibat:   false, // TBD: Qualibat API
      qualifelec: false, // TBD: Qualifelec API
      labels:     isRGE ? ['RGE'] : [],
      last_fetched_at: new Date().toISOString(),
    };
  }

  private async fetchReputation(companyName: string): Promise<Reputation> {
    const endpoint = process.env.TRUSTPILOT_API_ENDPOINT ?? 'https://api.trustpilot.com/v1';
    const key = process.env.TRUSTPILOT_API_KEY;

    const tpData = await callAPIWithRetry<{ score?: { trustScore: number }; numberOfReviews?: { total: number } }>({
      method: 'GET',
      url: `${endpoint}/business-units/find?name=${encodeURIComponent(companyName)}`,
      headers: { Authorization: `Bearer ${key}` },
      retries: 1,
      fallback: null,
    });

    const trustpilot = tpData
      ? {
          note:          tpData?.score?.trustScore ?? 0,
          count:         tpData?.numberOfReviews?.total ?? 0,
          last_fetched_at: new Date().toISOString(),
        }
      : null;

    return { google: null, trustpilot };
  }
}
