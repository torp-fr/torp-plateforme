// ─────────────────────────────────────────────────────────────────────────────
// sirene.service.ts — Server-side INSEE Sirene wrapper
//
// Uses the free public API recherche-entreprises.api.gouv.fr (no key needed).
// Falls back to INSEE api-sirene if SIRENE_API_KEY is set.
// ─────────────────────────────────────────────────────────────────────────────

import { structuredLogger } from '@/services/observability/structured-logger.js';

const TIMEOUT_MS        = 8_000;
const OPEN_API_BASE     = 'https://recherche-entreprises.api.gouv.fr';
const INSEE_API_BASE    = 'https://api.insee.fr/api-sirene/3.11';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SireneEntreprise {
  siret:               string;
  siren:               string;
  raison_sociale:      string | null;
  forme_juridique:     string | null;
  code_naf:            string | null;
  libelle_naf:         string | null;
  adresse_complete:    string;
  code_postal:         string | null;
  commune:             string | null;
  date_creation:       string | null;
  est_actif:           boolean;
  tranche_effectif:    string | null;
  categorie_entreprise: string | null;  // PME, ETI, GE
  anciennete_annees:   number | null;
  source:              'insee-sirene';
}

// ── Service ───────────────────────────────────────────────────────────────────

export class SireneService {
  private readonly sireneApiKey = process.env.SIRENE_API_KEY ?? '';

  /** Lookup an enterprise by SIRET (14 digits). */
  async getEntrepriseBySiret(siret: string): Promise<SireneEntreprise> {
    const clean = siret.replace(/\s/g, '');

    if (!/^\d{14}$/.test(clean)) {
      throw new Error(`Invalid SIRET format: ${siret}`);
    }

    // Try INSEE API first if key is configured
    if (this.sireneApiKey) {
      try {
        return await this.fetchFromINSEE(clean);
      } catch {
        structuredLogger.warn({ message: 'INSEE Sirene failed, falling back to open API', siret: clean });
      }
    }

    return this.fetchFromOpenAPI(clean);
  }

  /** Search enterprises by name or SIRET fragment. */
  async searchEntreprises(query: string, limit = 10): Promise<SireneEntreprise[]> {
    try {
      const url = `${OPEN_API_BASE}/search?q=${encodeURIComponent(query)}&page=1&per_page=${limit}`;
      const resp = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      if (!resp.ok) throw new Error(`recherche-entreprises returned ${resp.status}`);

      const data = await resp.json() as { results?: any[] };
      return (data.results ?? []).map(r => this.mapOpenAPIResult(r));
    } catch (err) {
      structuredLogger.warn({ message: 'Sirene search failed', query, error: String(err) });
      throw err;
    }
  }

  /** Validate SIRET checksum (Luhn algorithm). */
  validateSiret(siret: string): boolean {
    const clean = siret.replace(/\s/g, '');
    if (!/^\d{14}$/.test(clean)) return false;
    let sum = 0;
    for (let i = 0; i < 14; i++) {
      let d = parseInt(clean[13 - i], 10);
      if (i % 2 === 1) { d *= 2; if (d > 9) d -= 9; }
      sum += d;
    }
    return sum % 10 === 0;
  }

  // ── Private ──────────────────────────────────────────────────────────────

  private async fetchFromINSEE(siret: string): Promise<SireneEntreprise> {
    const resp = await fetch(`${INSEE_API_BASE}/siret/${siret}`, {
      headers: {
        'Accept': 'application/json',
        'X-INSEE-Api-Key-Integration': this.sireneApiKey,
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (resp.status === 403) throw new Error('Établissement non diffusible');
    if (resp.status === 404) throw new Error('Établissement non trouvé');
    if (!resp.ok) throw new Error(`INSEE returned ${resp.status}`);

    const data = await resp.json();
    return this.mapINSEEResult(data.etablissement);
  }

  private async fetchFromOpenAPI(siret: string): Promise<SireneEntreprise> {
    const url = `${OPEN_API_BASE}/search?q=siret:${siret}&page=1&per_page=1`;
    const resp = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!resp.ok) throw new Error(`recherche-entreprises returned ${resp.status}`);

    const data = await resp.json() as { results?: any[] };

    if (!data.results?.length) {
      // Try by SIREN
      const siren = siret.slice(0, 9);
      const r2 = await fetch(`${OPEN_API_BASE}/search?q=${siren}&page=1&per_page=5`, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      const d2 = await r2.json() as { results?: any[] };
      const match = d2.results?.find((e: any) => e.siren === siren) ?? d2.results?.[0];
      if (!match) throw new Error(`Entreprise non trouvée pour SIRET ${siret}`);
      return this.mapOpenAPIResult(match, siret);
    }

    return this.mapOpenAPIResult(data.results[0], siret);
  }

  private mapOpenAPIResult(data: any, originalSiret?: string): SireneEntreprise {
    const siege = data.siege ?? {};
    const dateCreation = data.date_creation ?? siege.date_creation ?? null;

    let anciennete: number | null = null;
    if (dateCreation) {
      anciennete = Math.floor((Date.now() - new Date(dateCreation).getTime()) / (365.25 * 86_400_000));
    }

    return {
      siret:               siege.siret ?? originalSiret ?? '',
      siren:               data.siren ?? '',
      raison_sociale:      data.nom_complet ?? data.nom_raison_sociale ?? null,
      forme_juridique:     data.nature_juridique ?? null,
      code_naf:            siege.activite_principale ?? data.activite_principale ?? null,
      libelle_naf:         siege.libelle_activite_principale ?? data.libelle_activite_principale ?? null,
      adresse_complete:    siege.adresse ?? siege.geo_adresse ?? 'Non renseignée',
      code_postal:         siege.code_postal ?? null,
      commune:             siege.libelle_commune ?? null,
      date_creation:       dateCreation,
      est_actif:           data.etat_administratif === 'A',
      tranche_effectif:    data.tranche_effectif_salarie ?? siege.tranche_effectif_salarie ?? null,
      categorie_entreprise: data.categorie_entreprise ?? null,
      anciennete_annees:   anciennete,
      source:              'insee-sirene',
    };
  }

  private mapINSEEResult(etab: any): SireneEntreprise {
    const ul   = etab.uniteLegale ?? {};
    const addr = etab.adresseEtablissement ?? {};
    const dateCreation = ul.dateCreationUniteLegale ?? null;

    let anciennete: number | null = null;
    if (dateCreation) {
      anciennete = Math.floor((Date.now() - new Date(dateCreation).getTime()) / (365.25 * 86_400_000));
    }

    const adresseComplete = [
      addr.numeroVoieEtablissement,
      addr.typeVoieEtablissement,
      addr.libelleVoieEtablissement,
      addr.codePostalEtablissement,
      addr.libelleCommuneEtablissement,
    ].filter(Boolean).join(' ');

    return {
      siret:               etab.siret ?? '',
      siren:               etab.siren ?? '',
      raison_sociale:      ul.denominationUniteLegale ?? null,
      forme_juridique:     ul.categorieJuridiqueUniteLegale ?? null,
      code_naf:            etab.periodesEtablissement?.[0]?.activitePrincipaleEtablissement ?? null,
      libelle_naf:         null,
      adresse_complete:    adresseComplete || 'Non renseignée',
      code_postal:         addr.codePostalEtablissement ?? null,
      commune:             addr.libelleCommuneEtablissement ?? null,
      date_creation:       dateCreation,
      est_actif:           ul.etatAdministratifUniteLegale === 'A',
      tranche_effectif:    ul.trancheEffectifsUniteLegale ?? null,
      categorie_entreprise: ul.categorieEntreprise ?? null,
      anciennete_annees:   anciennete,
      source:              'insee-sirene',
    };
  }
}
