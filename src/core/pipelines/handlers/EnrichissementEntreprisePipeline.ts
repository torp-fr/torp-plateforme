// ─────────────────────────────────────────────────────────────────────
// EnrichissementEntreprisePipeline — REAL implementation
// Uses PappersClient + DataGouvClient + TrustpilotClient
// ─────────────────────────────────────────────────────────────────────

import { apiClients } from '../../external/clients/index.js';
import type { PipelineContext, PipelineResult } from '../types/index.js';

interface EnrichissementData {
  rcs_data: {
    code_naf: string;
    libelle_naf: string;
    effectifs: number;
    chiffre_affaires: number;
    date_creation: string;
    statut_juridique: string;
    adresse_siege: string;
    code_postal: string;
    ville: string;
  } | null;
  certifications: {
    rge: boolean;
    qualiopi: boolean;
    labels: string[];
    details: unknown[];
    last_fetched_at: string;
  };
  reputation: {
    google: null;
    trustpilot: { rating: number; reviews_count: number } | null;
  } | null;
}

export class EnrichissementEntreprisePipeline {
  async execute(
    params: { siret: string },
    _context: PipelineContext
  ): Promise<PipelineResult<EnrichissementData>> {
    const startTime = Date.now();
    const warnings: string[] = [];
    const { siret } = params;

    try {
      // Step 1 + 2: Parallel — Pappers + data.gouv (both free/fast)
      const [rcsResult, certResult] = await Promise.allSettled([
        apiClients.pappers.getCompanyBySIRET(siret),
        apiClients.datagouv.getCertificationsBySIRET(siret),
      ]);

      const rcs = rcsResult.status === 'fulfilled' && rcsResult.value.success
        ? rcsResult.value.data!
        : null;

      if (rcsResult.status === 'rejected' || (rcsResult.status === 'fulfilled' && !rcsResult.value.success)) {
        warnings.push(`Pappers: ${rcsResult.status === 'rejected' ? rcsResult.reason : rcsResult.value.error}`);
      }

      const certList = certResult.status === 'fulfilled' && certResult.value.success
        ? (certResult.value.data ?? [])
        : [];

      if (certResult.status === 'rejected') {
        warnings.push(`data.gouv: ${certResult.reason}`);
      }

      // Step 3: Trustpilot (optional, paid)
      let reputation: EnrichissementData['reputation'] = null;
      if (apiClients.trustpilot && rcs?.raison_sociale) {
        const repResult = await apiClients.trustpilot.searchBusinessByName(rcs.raison_sociale);
        if (repResult.success && repResult.data) {
          reputation = {
            google: null,
            trustpilot: {
              rating:        repResult.data.rating,
              reviews_count: repResult.data.reviews_count,
            },
          };
        } else {
          warnings.push(`Trustpilot: ${repResult.error} (non-blocking)`);
        }
      }

      const data: EnrichissementData = {
        rcs_data: rcs ? {
          code_naf:       rcs.code_naf,
          libelle_naf:    rcs.libelle_naf,
          effectifs:      rcs.effectifs,
          chiffre_affaires: rcs.chiffre_affaires,
          date_creation:  rcs.date_creation,
          statut_juridique: rcs.statut_juridique,
          adresse_siege:  rcs.adresse,
          code_postal:    rcs.code_postal,
          ville:          rcs.ville,
        } : null,
        certifications: {
          rge:       certList.some(c => c.type === 'rge'),
          qualiopi:  certList.some(c => c.type === 'qualiopi'),
          labels:    certList.filter(c => c.type === 'label').map(c => c.name),
          details:   certList,
          last_fetched_at: new Date().toISOString(),
        },
        reputation,
      };

      return {
        status:          'completed',
        data,
        warnings:        warnings.length > 0 ? warnings : undefined,
        executionTimeMs: Date.now() - startTime,
        retryable:       false,
      };
    } catch (err) {
      return {
        status:          'failed',
        error:           err instanceof Error ? err.message : String(err),
        executionTimeMs: Date.now() - startTime,
        retryable:       true,
      };
    }
  }
}
