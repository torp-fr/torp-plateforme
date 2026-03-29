// ─────────────────────────────────────────────────────────────────────────────
// CompanyMemory — Persistent learning system for each company (SIRET-keyed)
// Learns: tarifs, formats, processus, insurance profile, anomaly patterns
// ─────────────────────────────────────────────────────────────────────────────

import type { SupabaseClient } from '@supabase/supabase-js';

// ── Types ────────────────────────────────────────────────────────────────────

export interface TarifPattern {
  values: number[];
  avg: number;
  min: number;
  max: number;
  count: number;
}

export interface InsuranceProfile {
  policy_number: string | null;
  insurer: string | null;
  start_date: string | null;
  end_date: string | null;
  covered_activities: string[];
  coverage_amounts: Record<string, number>;
  garanties: string[];
  updated_at: string;
}

export interface CompanyProfile {
  siret: string;
  raison_sociale: string | null;
  region: string | null;
  secteur: string | null;
  tarifs: Record<string, TarifPattern>;
  formats: Record<string, unknown>;
  processus: {
    margins?: number[];
    avg_margin?: number;
    discount_patterns?: unknown[];
  };
  insurance_profile: InsuranceProfile | null;
  devis_count: number;
  /** 0–1: confidence in learned patterns (maxes at 1.0 after 10 devis) */
  learning_confidence: number;
  patterns: string[];
  created_at?: string;
  updated_at?: string;
}

// ── CompanyMemory ─────────────────────────────────────────────────────────────

export class CompanyMemory {
  private cache = new Map<string, CompanyProfile>();

  constructor(private readonly supabase: SupabaseClient) {}

  /**
   * Load all company profiles into the in-memory cache.
   * Call once at server startup.
   */
  async initialize(): Promise<void> {
    const { data, error } = await this.supabase
      .from('company_profiles')
      .select('*');

    if (error) {
      console.warn('[CompanyMemory] Failed to initialize from DB:', error.message);
      return;
    }

    for (const row of data ?? []) {
      this.cache.set(row.siret, row as CompanyProfile);
    }

    console.log(`[CompanyMemory] Initialized — ${this.cache.size} profiles loaded`);
  }

  /**
   * Create (or upsert) a company profile when a new client registers.
   */
  async createCompanyProfile(
    siret: string,
    metadata: { raison_sociale?: string | null; region?: string | null; secteur?: string | null }
  ): Promise<void> {
    const existing = this.cache.get(siret);
    if (existing) return; // Already known — don't overwrite learned data

    const profile: CompanyProfile = {
      siret,
      raison_sociale: metadata.raison_sociale ?? null,
      region: metadata.region ?? null,
      secteur: metadata.secteur ?? null,
      tarifs: {},
      formats: {},
      processus: {},
      insurance_profile: null,
      devis_count: 0,
      learning_confidence: 0,
      patterns: [],
    };

    const { error } = await this.supabase
      .from('company_profiles')
      .upsert(profile, { onConflict: 'siret', ignoreDuplicates: true });

    if (error) {
      console.warn(`[CompanyMemory] Failed to create profile for ${siret}:`, error.message);
    }

    this.cache.set(siret, profile);
  }

  /**
   * Learn from a parsed devis: update tarif patterns, formats, processus.
   */
  async learnFromDevis(siret: string, devisData: {
    items?: Array<{ description?: string; unit?: string; unit_price?: number }>;
    montant_ht?: number;
    montant_ttc?: number;
    montant_tva?: number;
    remise?: number;
    devise?: string;
    date?: string;
  }): Promise<void> {
    let profile = this.cache.get(siret) ?? await this.fetchProfile(siret);

    if (!profile) {
      console.warn(`[CompanyMemory] No profile for ${siret} — skipping learning`);
      return;
    }

    // Deep-clone to avoid mutating cache directly while building
    profile = structuredClone(profile);

    // 1. Learn tarif patterns per item
    for (const item of devisData.items ?? []) {
      if (!item.description || item.unit_price === undefined || item.unit_price <= 0) continue;

      const key = `${item.description.substring(0, 40).trim()}__${item.unit ?? 'u'}`;

      const existing = profile.tarifs[key] ?? { values: [], avg: 0, min: Infinity, max: -Infinity, count: 0 };
      existing.values.push(item.unit_price);
      existing.count = existing.values.length;
      existing.avg = existing.values.reduce((s, v) => s + v, 0) / existing.count;
      existing.min = Math.min(existing.min, item.unit_price);
      existing.max = Math.max(existing.max, item.unit_price);
      // Keep a rolling window of last 50 prices
      if (existing.values.length > 50) existing.values = existing.values.slice(-50);
      profile.tarifs[key] = existing;
    }

    // 2. Learn format patterns
    profile.formats = {
      ...profile.formats,
      last_structure: {
        has_vat_line: devisData.montant_tva !== undefined && devisData.montant_tva > 0,
        has_discount: (devisData.remise ?? 0) > 0,
        currency: devisData.devise ?? 'EUR',
        date_format: this.detectDateFormat(devisData.date),
        updated_at: new Date().toISOString(),
      },
    };

    // 3. Learn processus (margin patterns)
    if (devisData.montant_ht && devisData.montant_ttc && devisData.montant_ht > 0) {
      const margin = (devisData.montant_ttc - devisData.montant_ht) / devisData.montant_ht;
      const margins = profile.processus.margins ?? [];
      margins.push(margin);
      if (margins.length > 20) margins.splice(0, margins.length - 20);
      profile.processus.margins = margins;
      profile.processus.avg_margin = margins.reduce((s, v) => s + v, 0) / margins.length;
    }

    // 4. Update learning confidence (max at 10 devis)
    profile.devis_count += 1;
    profile.learning_confidence = Math.min(1.0, profile.devis_count / 10);

    // 5. Persist
    const { error } = await this.supabase
      .from('company_profiles')
      .update({
        tarifs: profile.tarifs,
        formats: profile.formats,
        processus: profile.processus,
        devis_count: profile.devis_count,
        learning_confidence: profile.learning_confidence,
        updated_at: new Date().toISOString(),
      })
      .eq('siret', siret);

    if (error) {
      console.warn(`[CompanyMemory] Failed to persist learning for ${siret}:`, error.message);
    }

    this.cache.set(siret, profile);
  }

  /**
   * Get the learned tarif pattern for a given item description.
   * Uses prefix matching (first 40 chars) for fuzzy lookup.
   */
  getTarifPattern(siret: string, description: string): TarifPattern | null {
    const profile = this.cache.get(siret);
    if (!profile) return null;

    const prefix = description.substring(0, 40).toLowerCase().trim();
    for (const [key, pattern] of Object.entries(profile.tarifs)) {
      if (key.toLowerCase().startsWith(prefix.substring(0, 20))) {
        return pattern;
      }
    }
    return null;
  }

  /**
   * Update the insurance profile for a company.
   */
  async updateInsuranceProfile(siret: string, insurance: Omit<InsuranceProfile, 'updated_at'>): Promise<void> {
    const profile = this.cache.get(siret) ?? await this.fetchProfile(siret);
    if (!profile) return;

    const insuranceProfile: InsuranceProfile = {
      ...insurance,
      updated_at: new Date().toISOString(),
    };

    const { error } = await this.supabase
      .from('company_profiles')
      .update({
        insurance_profile: insuranceProfile,
        updated_at: new Date().toISOString(),
      })
      .eq('siret', siret);

    if (error) {
      console.warn(`[CompanyMemory] Failed to update insurance for ${siret}:`, error.message);
    }

    const updated = { ...(profile ?? { siret, raison_sociale: null, region: null, secteur: null, tarifs: {}, formats: {}, processus: {}, devis_count: 0, learning_confidence: 0, patterns: [] }), insurance_profile: insuranceProfile };
    this.cache.set(siret, updated as CompanyProfile);
  }

  /**
   * Get the insurance profile for a company (from cache or DB).
   */
  async getInsuranceProfile(siret: string): Promise<InsuranceProfile | null> {
    const profile = this.cache.get(siret) ?? await this.fetchProfile(siret);
    return profile?.insurance_profile ?? null;
  }

  /** Get a company profile from the cache or DB. */
  async getProfile(siret: string): Promise<CompanyProfile | null> {
    return this.cache.get(siret) ?? this.fetchProfile(siret);
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private async fetchProfile(siret: string): Promise<CompanyProfile | null> {
    const { data } = await this.supabase
      .from('company_profiles')
      .select('*')
      .eq('siret', siret)
      .maybeSingle();

    if (data) {
      this.cache.set(siret, data as CompanyProfile);
      return data as CompanyProfile;
    }
    return null;
  }

  private detectDateFormat(dateStr?: string): string {
    if (!dateStr) return 'UNKNOWN';
    if (/\d{2}\/\d{2}\/\d{4}/.test(dateStr)) return 'DD/MM/YYYY';
    if (/\d{4}-\d{2}-\d{2}/.test(dateStr)) return 'YYYY-MM-DD';
    if (/\d{2}\.\d{2}\.\d{4}/.test(dateStr)) return 'DD.MM.YYYY';
    return 'UNKNOWN';
  }
}
