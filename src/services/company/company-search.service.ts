/**
 * Company Search Service (Frontend)
 * Calls Supabase Edge Function to search for company data
 */

import { supabase } from '@/lib/supabase';

export interface CompanySearchOptions {
  siret?: string;
  siren?: string;
  companyName?: string;
  forceRefresh?: boolean;
  usePappers?: boolean;
  includeFinances?: boolean;
  includeRepresentants?: boolean;
  includeProcedures?: boolean;
}

export interface CompanyDataResult {
  success: boolean;
  cached: boolean;
  cacheAge?: number;
  dataSource: 'cache' | 'recherche-entreprises' | 'pappers' | 'combined';

  // Core data
  siret: string;
  siren: string;
  companyName: string;
  legalName?: string;

  // Full data
  data: any;

  // Quality metrics
  qualityScore: number;
  dataCompleteness: number;
  confidence: number;

  // Risk assessment
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  alerts: string[];

  // Metadata
  lastFetched?: Date;
  nextRefresh?: Date;
  fetchCount?: number;

  errors?: string[];
}

export class CompanySearchService {
  /**
   * Search for company data by SIRET, SIREN, or name
   */
  async searchCompany(options: CompanySearchOptions): Promise<CompanyDataResult> {
    try {
      console.log('[CompanySearch] Searching for company:', {
        siret: options.siret,
        siren: options.siren,
        name: options.companyName,
      });

      const { data, error } = await supabase.functions.invoke('company-search', {
        body: options,
      });

      if (error) {
        console.error('[CompanySearch] Error:', error);
        throw new Error(`Company search failed: ${error.message}`);
      }

      if (!data || !data.success) {
        throw new Error(data?.error || 'Company search failed');
      }

      console.log('[CompanySearch] Result:', {
        company: data.companyName,
        cached: data.cached,
        dataSource: data.dataSource,
        qualityScore: data.qualityScore,
        riskLevel: data.riskLevel,
      });

      return data as CompanyDataResult;
    } catch (error) {
      console.error('[CompanySearch] Search failed:', error);
      throw error;
    }
  }

  /**
   * Search by SIRET only
   */
  async searchBySiret(
    siret: string,
    options?: Omit<CompanySearchOptions, 'siret'>
  ): Promise<CompanyDataResult> {
    return this.searchCompany({ ...options, siret });
  }

  /**
   * Search by SIREN only
   */
  async searchBySiren(
    siren: string,
    options?: Omit<CompanySearchOptions, 'siren'>
  ): Promise<CompanyDataResult> {
    return this.searchCompany({ ...options, siren });
  }

  /**
   * Search by company name only
   */
  async searchByName(
    companyName: string,
    options?: Omit<CompanySearchOptions, 'companyName'>
  ): Promise<CompanyDataResult> {
    return this.searchCompany({ ...options, companyName });
  }
}

export const companySearchService = new CompanySearchService();
export default companySearchService;
