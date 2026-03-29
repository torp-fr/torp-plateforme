// ─────────────────────────────────────────────────────────────────────────────
// EnterpriseDataFallback — Pappers → Sirene → cache cascade for enterprise data.
//
// Layer 0 (primary):   Pappers (enriched data, paid)
// Layer 1 (fallback):  INSEE Sirene via recherche-entreprises.api.gouv.fr (free)
// Layer 2 (emergency): In-memory cache from previous successful lookups
//
// Usage:
//   const cascade = new EnterpriseDataFallback();
//   const result  = await cascade.getEnterpriseBySiret('12345678901234');
// ─────────────────────────────────────────────────────────────────────────────

import { FallbackCascade, type CascadeResult } from './FallbackCascade.js';
import { PappersService, type PappersEntreprise } from '@/services/external/pappers.service.js';
import { SireneService, type SireneEntreprise } from '@/services/external/sirene.service.js';

// ── Unified enterprise type (merged Pappers + Sirene) ─────────────────────────

export interface EnterpriseData {
  siret:                string;
  siren:                string;
  nom:                  string | null;
  forme_juridique:      string | null;
  code_naf:             string | null;
  libelle_naf:          string | null;
  adresse:              string | null;
  code_postal:          string | null;
  commune:              string | null;
  date_creation:        string | null;
  est_active:           boolean;
  effectif_min:         number | null;
  effectif_max:         number | null;
  capital:              number | null;
  score_fiabilite:      number | null;   // 0–10 Pappers score, null if from Sirene
  procedures_collectives: boolean;
  dirigeants:           Array<{ nom: string | null; prenom: string | null; qualite: string | null }>;
  certifications_rge:   string[];
  anciennete_annees:    number | null;
  source:               'pappers' | 'sirene' | 'cache';
}

// ── EnterpriseDataFallback ────────────────────────────────────────────────────

export class EnterpriseDataFallback {
  private readonly cascade  = new FallbackCascade();
  private readonly pappers  = new PappersService();
  private readonly sirene   = new SireneService();
  private readonly cache    = new Map<string, EnterpriseData>();

  /**
   * Resolve enterprise data for a given SIRET with automatic fallback.
   * Pappers is tried first (rich data); Sirene is tried next (free).
   * In-memory cache serves as final emergency layer.
   */
  async getEnterpriseBySiret(siret: string): Promise<CascadeResult<EnterpriseData>> {
    const key = siret.replace(/\s/g, '');

    const result = await this.cascade.executeWithFallback<EnterpriseData>(
      `enterprise:${key}`,
      [
        {
          name:      'Pappers',
          priority:  0,
          timeout_ms: 12_000,
          isRetryable: (err) => !err.message.includes('non trouvée') && !err.message.includes('PAPPERS_API_KEY'),
          execute: async () => {
            const data = await this.pappers.getEntrepriseBySiret(key);
            return this.fromPappers(data);
          },
        },
        {
          name:      'INSEE-Sirene',
          priority:  1,
          timeout_ms: 10_000,
          isRetryable: (err) => !err.message.includes('non trouvée'),
          execute: async () => {
            const data = await this.sirene.getEntrepriseBySiret(key);
            return this.fromSirene(data);
          },
        },
        {
          name:      'Cache',
          priority:  2,
          timeout_ms: 500,
          isRetryable: () => false,
          execute: async () => {
            const cached = this.cache.get(key);
            if (!cached) throw new Error(`No cache entry for SIRET ${key}`);
            return { ...cached, source: 'cache' as const };
          },
        },
      ],
      { entityId: key, entityType: 'enterprise' }
    );

    // Warm cache on success
    if (result.status === 'success' && result.data) {
      this.cache.set(key, result.data);
    }

    return result;
  }

  /**
   * Search enterprises by name — always uses Pappers (richer results),
   * falls back to Sirene.
   */
  async searchEnterprises(query: string, limit = 10): Promise<EnterpriseData[]> {
    try {
      const results = await this.pappers.searchEntreprises(query, limit);
      return results.map(r => ({
        siret:                  r.siret_siege,
        siren:                  r.siren,
        nom:                    r.nom_entreprise,
        forme_juridique:        null,
        code_naf:               r.code_naf,
        libelle_naf:            null,
        adresse:                r.adresse,
        code_postal:            null,
        commune:                null,
        date_creation:          null,
        est_active:             r.est_active,
        effectif_min:           null,
        effectif_max:           null,
        capital:                null,
        score_fiabilite:        null,
        procedures_collectives: false,
        dirigeants:             [],
        certifications_rge:     [],
        anciennete_annees:      null,
        source:                 'pappers' as const,
      }));
    } catch {
      // Fallback to Sirene search
      const results = await this.sirene.searchEntreprises(query, limit);
      return results.map(r => this.fromSirene(r));
    }
  }

  // ── Private ──────────────────────────────────────────────────────────────

  private fromPappers(d: PappersEntreprise): EnterpriseData {
    return {
      siret:                  d.siret_siege,
      siren:                  d.siren,
      nom:                    d.nom_entreprise,
      forme_juridique:        d.forme_juridique,
      code_naf:               d.code_naf,
      libelle_naf:            d.libelle_naf,
      adresse:                d.adresse_complete,
      code_postal:            d.code_postal,
      commune:                d.commune,
      date_creation:          d.date_creation,
      est_active:             d.est_active,
      effectif_min:           d.effectif_min,
      effectif_max:           d.effectif_max,
      capital:                d.capital,
      score_fiabilite:        d.score_pappers,
      procedures_collectives: d.procedures_collectives,
      dirigeants:             d.dirigeants.map(dir => ({ nom: dir.nom, prenom: dir.prenom, qualite: dir.qualite })),
      certifications_rge:     d.certifications_rge,
      anciennete_annees:      d.date_creation
        ? Math.floor((Date.now() - new Date(d.date_creation).getTime()) / (365.25 * 86_400_000))
        : null,
      source:                 'pappers',
    };
  }

  private fromSirene(d: SireneEntreprise): EnterpriseData {
    return {
      siret:                  d.siret,
      siren:                  d.siren,
      nom:                    d.raison_sociale,
      forme_juridique:        d.forme_juridique,
      code_naf:               d.code_naf,
      libelle_naf:            d.libelle_naf,
      adresse:                d.adresse_complete,
      code_postal:            d.code_postal,
      commune:                d.commune,
      date_creation:          d.date_creation,
      est_active:             d.est_actif,
      effectif_min:           null,
      effectif_max:           null,
      capital:                null,
      score_fiabilite:        null,
      procedures_collectives: false,
      dirigeants:             [],
      certifications_rge:     [],
      anciennete_annees:      d.anciennete_annees,
      source:                 'sirene',
    };
  }
}
