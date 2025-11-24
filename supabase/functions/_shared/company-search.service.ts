/**
 * Company Search Service with Intelligent Caching
 * Orchestrates company data retrieval from cache and multiple APIs
 */

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { searchEntreprise, getRGECertifications, getBODACCAnnonces } from './api-clients.ts';
import {
  getCompanyBySiren,
  getEstablishmentBySiret,
  calculateQualityScore,
  extractRiskIndicators,
  formatPappersDataForCache,
  type PappersConfig,
  type PappersCompany,
} from './pappers-client.ts';

// ============================================
// Types & Interfaces
// ============================================

export interface CompanySearchOptions {
  siret?: string;
  siren?: string;
  companyName?: string;
  forceRefresh?: boolean; // Bypass cache
  usePappers?: boolean; // Use premium Pappers API
  includeFinances?: boolean;
  includeRepresentants?: boolean;
  includeProcedures?: boolean;
}

export interface CompanyDataResult {
  success: boolean;
  cached: boolean;
  cacheAge?: number; // Age in days
  dataSource: 'cache' | 'recherche-entreprises' | 'pappers' | 'combined';

  // Core data
  siret: string;
  siren: string;
  companyName: string;
  legalName?: string;

  // Full data
  data: any;

  // Quality metrics
  qualityScore: number; // 0-100
  dataCompleteness: number; // 0-100
  confidence: number; // 0-100

  // Risk assessment
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  alerts: string[];

  // Metadata
  lastFetched?: Date;
  nextRefresh?: Date;
  fetchCount?: number;

  errors?: string[];
}

export interface CompanySearchConfig {
  supabaseUrl: string;
  supabaseServiceKey: string;
  pappersApiKey?: string;
}

// ============================================
// Main Service Class
// ============================================

export class CompanySearchService {
  private supabase: SupabaseClient;
  private pappersConfig?: PappersConfig;

  constructor(config: CompanySearchConfig) {
    this.supabase = createClient(
      config.supabaseUrl,
      config.supabaseServiceKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    if (config.pappersApiKey) {
      this.pappersConfig = { apiKey: config.pappersApiKey };
    }
  }

  /**
   * Main search method with intelligent caching
   */
  async searchCompany(options: CompanySearchOptions): Promise<CompanyDataResult> {
    const startTime = Date.now();
    const errors: string[] = [];

    // Validate input
    if (!options.siret && !options.siren && !options.companyName) {
      return {
        success: false,
        cached: false,
        dataSource: 'cache',
        siret: '',
        siren: '',
        companyName: '',
        data: {},
        qualityScore: 0,
        dataCompleteness: 0,
        confidence: 0,
        riskLevel: 'critical',
        alerts: ['No search criteria provided'],
        errors: ['SIRET, SIREN, or company name required'],
      };
    }

    // Normalize identifiers
    const siret = options.siret?.replace(/[\s-]/g, '');
    const siren = options.siren?.replace(/[\s-]/g, '') || (siret ? siret.substring(0, 9) : undefined);

    // Step 1: Check cache (if not forcing refresh)
    if (!options.forceRefresh && siret) {
      const cachedResult = await this.getCachedData(siret);
      if (cachedResult) {
        // Log cache hit
        await this.logSearchHistory({
          siret,
          siren,
          searchType: 'siret',
          found: true,
          cacheHit: true,
          responseTimeMs: Date.now() - startTime,
        });

        return cachedResult;
      }
    }

    // Step 2: Fetch from APIs
    let result: CompanyDataResult;

    if (options.usePappers && this.pappersConfig && siren) {
      // Premium path: Pappers API
      result = await this.fetchFromPappers(siren, siret, options);
    } else if (siret || siren) {
      // Free path: Government APIs
      result = await this.fetchFromFreeAPIs(siret, siren, options);

      // If free APIs return low quality and Pappers is available, upgrade
      if (result.qualityScore < 60 && this.pappersConfig && siren) {
        errors.push('Free API data quality low, upgrading to Pappers');
        result = await this.fetchFromPappers(siren, siret, options);
      }
    } else {
      // Search by name only
      result = await this.searchByName(options.companyName!, options);
    }

    // Step 3: Store in cache
    if (result.success && siret) {
      await this.cacheCompanyData(result);
    }

    // Step 4: Log search history
    await this.logSearchHistory({
      siret,
      siren,
      searchQuery: options.companyName,
      searchType: siret ? 'siret' : siren ? 'siren' : 'name',
      found: result.success,
      cacheHit: false,
      apiCallsMade: [result.dataSource],
      responseTimeMs: Date.now() - startTime,
      errorMessage: result.errors?.join('; '),
    });

    return {
      ...result,
      errors: errors.concat(result.errors || []),
    };
  }

  /**
   * Get cached company data
   */
  private async getCachedData(siret: string): Promise<CompanyDataResult | null> {
    try {
      const { data, error } = await this.supabase.rpc('get_cached_company_data', {
        p_siret: siret,
      });

      if (error || !data || data.length === 0) {
        return null;
      }

      const cached = data[0];

      // Check if needs refresh
      if (cached.needs_refresh) {
        return null; // Force API fetch
      }

      // Extract risk indicators from cached data
      const riskInfo = this.assessRiskFromData(cached.cached_data);

      return {
        success: true,
        cached: true,
        cacheAge: cached.age_days,
        dataSource: 'cache',
        siret: cached.siret,
        siren: cached.siren,
        companyName: cached.company_name,
        legalName: cached.legal_name,
        data: cached.cached_data,
        qualityScore: cached.quality_score,
        dataCompleteness: cached.data_completeness,
        confidence: 95, // High confidence for cached data
        riskLevel: riskInfo.level,
        alerts: riskInfo.alerts,
        lastFetched: new Date(cached.last_fetched_at),
        fetchCount: cached.fetch_count,
      };
    } catch (error) {
      console.error('Cache lookup error:', error);
      return null;
    }
  }

  /**
   * Fetch from free government APIs
   */
  private async fetchFromFreeAPIs(
    siret: string | undefined,
    siren: string | undefined,
    options: CompanySearchOptions
  ): Promise<CompanyDataResult> {
    const errors: string[] = [];
    const combinedData: any = {};

    try {
      // API Recherche Entreprises (primary source)
      const searchParams = siret ? { siret } : siren ? { siren } : {};
      const rechercheResult = await searchEntreprise(searchParams);

      if (rechercheResult.results.length === 0) {
        return {
          success: false,
          cached: false,
          dataSource: 'recherche-entreprises',
          siret: siret || '',
          siren: siren || '',
          companyName: '',
          data: {},
          qualityScore: 0,
          dataCompleteness: 0,
          confidence: 0,
          riskLevel: 'critical',
          alerts: ['Company not found in Recherche Entreprises API'],
          errors: ['No results found'],
        };
      }

      const company = rechercheResult.results[0];
      combinedData.recherche_entreprises = company;

      // Extract core info
      const actualSiret = siret || company.siege?.siret || '';
      const actualSiren = siren || company.siren || '';

      // RGE Certifications
      try {
        const rgeCerts = await getRGECertifications({ siret: actualSiret });
        combinedData.rge_certifications = rgeCerts;
      } catch (err) {
        errors.push('RGE API failed');
      }

      // BODACC Announcements
      try {
        const bodacc = await getBODACCAnnonces(actualSiren);
        combinedData.bodacc_annonces = bodacc;
      } catch (err) {
        errors.push('BODACC API failed');
      }

      // Calculate quality score
      const qualityScore = this.calculateQualityScoreFreeAPI(combinedData);
      const dataCompleteness = this.calculateCompletenessScore(combinedData);

      // Assess risk
      const riskInfo = this.assessRiskFromData(combinedData);

      return {
        success: true,
        cached: false,
        dataSource: 'recherche-entreprises',
        siret: actualSiret,
        siren: actualSiren,
        companyName: company.nom_complet,
        legalName: company.nom_raison_sociale,
        data: combinedData,
        qualityScore,
        dataCompleteness,
        confidence: 75,
        riskLevel: riskInfo.level,
        alerts: riskInfo.alerts,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error) {
      return {
        success: false,
        cached: false,
        dataSource: 'recherche-entreprises',
        siret: siret || '',
        siren: siren || '',
        companyName: '',
        data: {},
        qualityScore: 0,
        dataCompleteness: 0,
        confidence: 0,
        riskLevel: 'critical',
        alerts: ['API fetch failed'],
        errors: [String(error)],
      };
    }
  }

  /**
   * Fetch from Pappers API (premium)
   */
  private async fetchFromPappers(
    siren: string,
    siret: string | undefined,
    options: CompanySearchOptions
  ): Promise<CompanyDataResult> {
    if (!this.pappersConfig) {
      return this.fetchFromFreeAPIs(siret, siren, options);
    }

    try {
      let company: PappersCompany;

      if (siret) {
        const result = await getEstablishmentBySiret(siret, this.pappersConfig);
        company = result.entreprise;
      } else {
        company = await getCompanyBySiren(siren, this.pappersConfig, {
          representants: options.includeRepresentants ?? true,
          finances: options.includeFinances ?? true,
          procedures: options.includeProcedures ?? true,
          beneficiaires: true,
          publications: true,
        });
      }

      // Calculate scores
      const qualityScore = calculateQualityScore(company);
      const riskInfo = extractRiskIndicators(company);

      const formattedData = formatPappersDataForCache(company);

      return {
        success: true,
        cached: false,
        dataSource: 'pappers',
        siret: siret || company.siege?.siret || '',
        siren: company.siren,
        companyName: company.nom_entreprise,
        legalName: company.denomination,
        data: formattedData,
        qualityScore,
        dataCompleteness: 90, // Pappers is very complete
        confidence: 95,
        riskLevel: riskInfo.level,
        alerts: riskInfo.alerts,
      };
    } catch (error) {
      // Fallback to free APIs
      return this.fetchFromFreeAPIs(siret, siren, options);
    }
  }

  /**
   * Search by company name
   */
  private async searchByName(
    companyName: string,
    options: CompanySearchOptions
  ): Promise<CompanyDataResult> {
    try {
      const rechercheResult = await searchEntreprise({ q: companyName });

      if (rechercheResult.results.length === 0) {
        return {
          success: false,
          cached: false,
          dataSource: 'recherche-entreprises',
          siret: '',
          siren: '',
          companyName: companyName,
          data: {},
          qualityScore: 0,
          dataCompleteness: 0,
          confidence: 0,
          riskLevel: 'critical',
          alerts: ['Company not found'],
          errors: ['No results found for company name'],
        };
      }

      // Use best match (first result)
      const company = rechercheResult.results[0];

      return this.fetchFromFreeAPIs(
        company.siege?.siret,
        company.siren,
        options
      );
    } catch (error) {
      return {
        success: false,
        cached: false,
        dataSource: 'recherche-entreprises',
        siret: '',
        siren: '',
        companyName: companyName,
        data: {},
        qualityScore: 0,
        dataCompleteness: 0,
        confidence: 0,
        riskLevel: 'critical',
        alerts: ['Search failed'],
        errors: [String(error)],
      };
    }
  }

  /**
   * Cache company data
   */
  private async cacheCompanyData(result: CompanyDataResult): Promise<void> {
    try {
      await this.supabase.rpc('upsert_company_cache', {
        p_siret: result.siret,
        p_siren: result.siren,
        p_company_name: result.companyName,
        p_legal_name: result.legalName || null,
        p_data_source: result.dataSource,
        p_cached_data: result.data,
        p_quality_score: result.qualityScore,
        p_data_completeness: result.dataCompleteness,
      });
    } catch (error) {
      console.error('Cache write error:', error);
    }
  }

  /**
   * Log search history for analytics
   */
  private async logSearchHistory(log: {
    siret?: string;
    siren?: string;
    searchQuery?: string;
    searchType: string;
    found: boolean;
    cacheHit: boolean;
    apiCallsMade?: string[];
    responseTimeMs: number;
    errorMessage?: string;
  }): Promise<void> {
    try {
      await this.supabase.from('company_search_history').insert({
        siret: log.siret || null,
        siren: log.siren || null,
        search_query: log.searchQuery || null,
        search_type: log.searchType,
        found: log.found,
        cache_hit: log.cacheHit,
        api_calls_made: log.apiCallsMade || [],
        response_time_ms: log.responseTimeMs,
        error_message: log.errorMessage || null,
      });
    } catch (error) {
      console.error('Search history log error:', error);
    }
  }

  /**
   * Calculate quality score from free API data
   */
  private calculateQualityScoreFreeAPI(data: any): number {
    let score = 0;
    const recherche = data.recherche_entreprises;

    if (!recherche) return 0;

    // Basic info (40 points)
    if (recherche.nom_complet) score += 10;
    if (recherche.siege?.adresse) score += 10;
    if (recherche.date_creation) score += 10;
    if (recherche.activite_principale) score += 10;

    // Legal status (20 points)
    if (recherche.etat_administratif === 'Actif') score += 20;

    // Size indicators (15 points)
    if (recherche.tranche_effectif_salarie) score += 10;
    if (recherche.categorie_entreprise) score += 5;

    // Additional data (25 points)
    if (data.rge_certifications && data.rge_certifications.length > 0) score += 15;
    if (recherche.dirigeants && recherche.dirigeants.length > 0) score += 5;
    if (recherche.finances) score += 5;

    return Math.min(score, 100);
  }

  /**
   * Calculate data completeness score
   */
  private calculateCompletenessScore(data: any): number {
    const fields = [
      'nom_complet',
      'siret',
      'siren',
      'date_creation',
      'activite_principale',
      'forme_juridique',
      'siege.adresse',
      'dirigeants',
      'finances',
      'tranche_effectif_salarie',
    ];

    let present = 0;
    const recherche = data.recherche_entreprises;

    if (!recherche) return 0;

    for (const field of fields) {
      if (field.includes('.')) {
        const [parent, child] = field.split('.');
        if (recherche[parent]?.[child]) present++;
      } else {
        if (recherche[field]) present++;
      }
    }

    return Math.round((present / fields.length) * 100);
  }

  /**
   * Assess risk from data
   */
  private assessRiskFromData(data: any): {
    level: 'low' | 'medium' | 'high' | 'critical';
    alerts: string[];
  } {
    const alerts: string[] = [];
    let level: 'low' | 'medium' | 'high' | 'critical' = 'low';

    const recherche = data.recherche_entreprises || data;

    // Company status
    if (recherche.etat_administratif !== 'Actif' && recherche.etat_administratif !== 'Active') {
      alerts.push('CRITIQUE: Entreprise non active');
      level = 'critical';
    }

    // BODACC issues
    if (data.bodacc_annonces && data.bodacc_annonces.length > 0) {
      const hasInsolvency = data.bodacc_annonces.some((a: any) =>
        a.typeavis?.includes('Procédure') || a.familleavis?.includes('collective')
      );

      if (hasInsolvency) {
        alerts.push('CRITIQUE: Procédure collective détectée');
        level = 'critical';
      }
    }

    // Recent creation
    if (recherche.date_creation) {
      const ageYears =
        (Date.now() - new Date(recherche.date_creation).getTime()) /
        (1000 * 60 * 60 * 24 * 365);

      if (ageYears < 2) {
        alerts.push('ATTENTION: Entreprise récente (moins de 2 ans)');
        if (level === 'low') level = 'medium';
      }
    }

    // No RGE for BTP companies
    if (
      recherche.activite_principale?.startsWith('43') &&
      (!data.rge_certifications || data.rge_certifications.length === 0)
    ) {
      alerts.push('ATTENTION: Pas de certification RGE pour une entreprise BTP');
      if (level === 'low') level = 'medium';
    }

    return { level, alerts };
  }

  /**
   * Force refresh company data
   */
  async refreshCompanyData(siret: string): Promise<CompanyDataResult> {
    return this.searchCompany({
      siret,
      forceRefresh: true,
      usePappers: true,
      includeFinances: true,
      includeRepresentants: true,
      includeProcedures: true,
    });
  }
}

// ============================================
// Helper Functions
// ============================================

/**
 * Create service instance from environment
 */
export function createCompanySearchService(): CompanySearchService {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const pappersApiKey = Deno.env.get('PAPPERS_API_KEY');

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing required environment variables');
  }

  return new CompanySearchService({
    supabaseUrl,
    supabaseServiceKey,
    pappersApiKey,
  });
}
