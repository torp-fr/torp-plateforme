/**
 * PappersService - Complete Pappers API Integration
 * Enriches company data with financial metrics, certifications, and solvency assessment
 * Includes caching layer in Supabase for performance optimization
 */

import { supabase } from '@/lib/supabase';
import type {
  PappersCompanyData,
  FinancialMetrics,
  PaymentHealthData,
  Certification,
  ActivityEvent,
} from '@/types/audit';

class PappersService {
  private readonly apiKey = import.meta.env.VITE_PAPPERS_API_KEY;
  private readonly baseUrl = 'https://api.pappers.fr/v2';
  private readonly cacheTTL = 90 * 24 * 60 * 60 * 1000; // 90 days in milliseconds

  /**
   * Get company data by SIRET
   * Checks cache first, then calls API if expired
   */
  async getCompanyBySIRET(siret: string): Promise<PappersCompanyData | null> {
    try {
      console.log(`🔍 Pappers lookup: ${siret}`);

      // 1. Check cache in Supabase
      const cached = await this.getCachedData(siret);
      if (cached && this.isDataValid(cached)) {
        console.log(`✅ Pappers data from cache (valid until ${cached.pappers_valid_until})`);
        return this.transformPappersData(cached);
      }

      // 2. API call to Pappers
      if (!this.apiKey) {
        console.warn('⚠️ VITE_PAPPERS_API_KEY not configured');
        return null;
      }

      const response = await fetch(`${this.baseUrl}/companies?siret=${siret}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Pappers API error: ${response.statusText} (${response.status})`);
      }

      const rawData = await response.json();

      // 3. Store in cache
      await this.cacheCompanyData(siret, rawData);

      console.log(`✅ Pappers data fetched and cached: ${siret}`);
      return this.transformPappersData(rawData);
    } catch (error) {
      console.error(`❌ Pappers lookup error for ${siret}:`, error);
      return null;
    }
  }

  /**
   * Get financial metrics from company data
   */
  async getFinancialMetrics(siret: string): Promise<FinancialMetrics | null> {
    try {
      const company = await this.getCompanyBySIRET(siret);
      if (!company) return null;

      // Call Supabase function to calculate metrics
      const { data, error } = await supabase.rpc('calculate_financial_health_score', {
        turnover: company.turnover2023,
        net_income: company.netIncome2023,
        employees: company.employees,
        bankruptcy_risk: company.bankruptcyRisk || false,
      });

      if (error) {
        console.error('❌ Error calculating financial metrics:', error);
        return null;
      }

      return data as FinancialMetrics;
    } catch (err) {
      console.error('❌ Error getting financial metrics:', err);
      return null;
    }
  }

  /**
   * Check payment health and reliability
   */
  async checkPaymentHealth(siret: string): Promise<PaymentHealthData | null> {
    try {
      const company = await this.getCompanyBySIRET(siret);
      if (!company) return null;

      return {
        score: company.paymentReliability || 50,
        level: this.getPaymentLevel(company.paymentReliability || 50),
        bankruptcyRisk: company.bankruptcyRisk || false,
        recommendations: this.generatePaymentRecommendations(company),
      };
    } catch (err) {
      console.error('❌ Error checking payment health:', err);
      return null;
    }
  }

  /**
   * Get all certifications and licenses
   */
  async getCertifications(siret: string): Promise<Certification[]> {
    try {
      const company = await this.getCompanyBySIRET(siret);
      if (!company?.certifications) return [];

      return company.certifications;
    } catch (err) {
      console.error('❌ Error getting certifications:', err);
      return [];
    }
  }

  /**
   * Get RGE certifications specifically
   */
  async getRGECertifications(siret: string): Promise<string[]> {
    try {
      const company = await this.getCompanyBySIRET(siret);
      if (!company?.rgeCertifications) return [];

      return company.rgeCertifications;
    } catch (err) {
      console.error('❌ Error getting RGE certifications:', err);
      return [];
    }
  }

  /**
   * Get activity history
   */
  async getActivityHistory(siret: string): Promise<ActivityEvent[]> {
    try {
      const company = await this.getCompanyBySIRET(siret);
      if (!company?.activityHistory) return [];

      return company.activityHistory;
    } catch (err) {
      console.error('❌ Error getting activity history:', err);
      return [];
    }
  }

  /**
   * Assess company solvency
   */
  async assessCompanySolvency(siret: string): Promise<Record<string, any> | null> {
    try {
      // Get cached company_data_cache ID
      const { data: company, error } = await supabase
        .from('company_data_cache')
        .select('id')
        .eq('siret', siret)
        .single();

      if (error || !company) {
        console.error('❌ Company not found in cache');
        return null;
      }

      // Call Supabase function
      const { data: assessment, error: assessError } = await supabase.rpc(
        'assess_company_solvency',
        {
          company_id: company.id,
        }
      );

      if (assessError) {
        console.error('❌ Error assessing solvency:', assessError);
        return null;
      }

      return assessment;
    } catch (err) {
      console.error('❌ Error in solvency assessment:', err);
      return null;
    }
  }

  /**
   * Get complete enriched company profile
   */
  async getCompleteProfile(siret: string) {
    try {
      const company = await this.getCompanyBySIRET(siret);
      if (!company) return null;

      const [metrics, paymentHealth, certifications, solvency] = await Promise.all([
        this.getFinancialMetrics(siret),
        this.checkPaymentHealth(siret),
        this.getCertifications(siret),
        this.assessCompanySolvency(siret),
      ]);

      return {
        company,
        financialMetrics: metrics,
        paymentHealth,
        certifications,
        solvencyAssessment: solvency,
        fetchedAt: new Date().toISOString(),
      };
    } catch (err) {
      console.error('❌ Error getting complete profile:', err);
      return null;
    }
  }

  /**
   * Extract SIRET from filename (format: "Devis_SIRET_12345678900XX.pdf")
   */
  async extractSIRETFromFilename(filename: string): Promise<string | null> {
    // Look for SIRET pattern: 14 digits
    const siretMatch = filename.match(/\b(\d{14})\b/);
    return siretMatch ? siretMatch[1] : null;
  }

  // ============================================
  // PRIVATE HELPERS
  // ============================================

  /**
   * Transform raw Pappers response to our format
   */
  private transformPappersData(rawData: any): PappersCompanyData {
    return {
      siret: rawData.siret,
      siren: rawData.siren,
      name: rawData.name || rawData.raison_sociale,
      legalForm: rawData.legal_form || rawData.forme_juridique,
      address: this.formatAddress(rawData),
      city: rawData.city || rawData.commune,
      postalCode: rawData.postal_code || rawData.code_postal,
      country: rawData.country || 'France',
      employees: rawData.employees || rawData.effectif,
      turnover: rawData.turnover,
      netIncome: rawData.net_income,
      turnover2023: rawData.turnover_2023 || rawData.ca_2023,
      netIncome2023: rawData.net_income_2023 || rawData.resultat_2023,
      turnover2022: rawData.turnover_2022 || rawData.ca_2022,
      netIncome2022: rawData.net_income_2022 || rawData.resultat_2022,
      turnover2021: rawData.turnover_2021 || rawData.ca_2021,
      netIncome2021: rawData.net_income_2021 || rawData.resultat_2021,
      solvencyScore: rawData.solvency_score || this.calculateBasicSolvency(rawData),
      paymentReliability: rawData.payment_reliability || 50,
      bankruptcyRisk: rawData.bankruptcy_risk || false,
      certifications: this.parseCertifications(rawData.certifications),
      licenses: this.parseLicenses(rawData.licenses),
      rgeCertifications: rawData.rge_certifications || [],
      activityStartDate: rawData.activity_start_date ? new Date(rawData.activity_start_date) : undefined,
      activityStatus: rawData.activity_status || 'active',
      activityHistory: rawData.activity_history || [],
      yearsInBusiness: this.calculateYearsInBusiness(rawData.activity_start_date),
      executives: rawData.executives || [],
      shareholders: rawData.shareholders || [],
      nafCode: rawData.naf_code || rawData.code_naf,
      sector: rawData.sector,
      subsector: rawData.subsector,
      fetchedAt: new Date(),
    };
  }

  /**
   * Get cached company data from Supabase
   */
  private async getCachedData(siret: string) {
    try {
      const { data, error } = await supabase
        .from('company_data_cache')
        .select('*')
        .eq('siret', siret)
        .single();

      if (error || !data) return null;
      return data;
    } catch (err) {
      console.error('❌ Error reading cache:', err);
      return null;
    }
  }

  /**
   * Check if cached data is still valid (< 90 days old)
   */
  private isDataValid(cached: any): boolean {
    if (!cached.pappers_fetched_at || cached.pappers_error) {
      return false;
    }

    const fetchedDate = new Date(cached.pappers_fetched_at).getTime();
    const now = Date.now();
    return now - fetchedDate < this.cacheTTL;
  }

  /**
   * Store/update company data in Supabase cache
   */
  private async cacheCompanyData(siret: string, rawData: any) {
    try {
      const validUntil = new Date();
      validUntil.setDate(validUntil.getDate() + 90);

      const { error } = await supabase
        .from('company_data_cache')
        .upsert({
          siret,
          siren: rawData.siren,
          company_name: rawData.name || rawData.raison_sociale,
          legal_form: rawData.legal_form || rawData.forme_juridique,
          address: this.formatAddress(rawData),
          city: rawData.city || rawData.commune,
          postal_code: rawData.postal_code || rawData.code_postal,
          country: rawData.country || 'France',
          employees_count: rawData.employees || rawData.effectif,
          turnover_2023: rawData.turnover_2023 || rawData.ca_2023,
          net_income_2023: rawData.net_income_2023 || rawData.resultat_2023,
          turnover_2022: rawData.turnover_2022 || rawData.ca_2022,
          net_income_2022: rawData.net_income_2022 || rawData.resultat_2022,
          turnover_2021: rawData.turnover_2021 || rawData.ca_2021,
          net_income_2021: rawData.net_income_2021 || rawData.resultat_2021,
          solvency_score: rawData.solvency_score || this.calculateBasicSolvency(rawData),
          payment_reliability: rawData.payment_reliability || 50,
          bankruptcy_risk: rawData.bankruptcy_risk || false,
          certifications: this.parseCertifications(rawData.certifications),
          licenses: this.parseLicenses(rawData.licenses),
          rge_certifications: rawData.rge_certifications || [],
          activity_start_date: rawData.activity_start_date,
          activity_status: rawData.activity_status || 'active',
          activity_history: rawData.activity_history || [],
          years_in_business: this.calculateYearsInBusiness(rawData.activity_start_date),
          executives: rawData.executives,
          shareholders: rawData.shareholders,
          naf_code: rawData.naf_code || rawData.code_naf,
          sector: rawData.sector,
          subsector: rawData.subsector,
          pappers_fetched_at: new Date().toISOString(),
          pappers_valid_until: validUntil.toISOString(),
          pappers_full_response: rawData,
          pappers_error: false,
        });

      if (error) {
        console.error('❌ Error caching company data:', error);
      } else {
        console.log(`✅ Company data cached: ${siret}`);
      }
    } catch (err) {
      console.error('❌ Error in caching:', err);
    }
  }

  /**
   * Format full address from parts
   */
  private formatAddress(data: any): string {
    const parts = [];
    if (data.address) parts.push(data.address);
    if (data.postal_code) parts.push(data.postal_code);
    if (data.city) parts.push(data.city);
    return parts.join(', ');
  }

  /**
   * Parse certifications array
   */
  private parseCertifications(certs: any[]): Certification[] {
    if (!certs || !Array.isArray(certs)) return [];

    return certs.map(cert => ({
      name: cert.name || cert.libelle,
      issuer: cert.issuer || cert.organisme,
      expiryDate: cert.expiry_date ? new Date(cert.expiry_date) : undefined,
      status: cert.status || cert.statut,
    }));
  }

  /**
   * Parse licenses array
   */
  private parseLicenses(licenses: any[]): any[] {
    if (!licenses || !Array.isArray(licenses)) return [];

    return licenses.map(lic => ({
      type: lic.type || lic.type_activite,
      number: lic.number || lic.numero,
      status: lic.status || lic.statut,
      expiryDate: lic.expiry_date ? new Date(lic.expiry_date) : undefined,
    }));
  }

  /**
   * Calculate years in business from start date
   */
  private calculateYearsInBusiness(startDate?: string): number {
    if (!startDate) return 0;
    const start = new Date(startDate);
    const now = new Date();
    return Math.floor((now.getTime() - start.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  }

  /**
   * Calculate basic solvency score
   */
  private calculateBasicSolvency(data: any): number {
    let score = 50; // Base score

    // Improve score if profitable
    if (data.net_income_2023 && data.turnover_2023) {
      const profitability = (data.net_income_2023 / data.turnover_2023) * 100;
      if (profitability > 10) score += 20;
      else if (profitability > 5) score += 10;
    }

    // Reduce score if bankruptcy risk
    if (data.bankruptcy_risk) score -= 20;

    // Improve score if active and established
    if (data.activity_status === 'active') score += 10;
    if (this.calculateYearsInBusiness(data.activity_start_date) > 5) score += 10;

    return Math.min(100, Math.max(0, score));
  }

  /**
   * Get payment reliability level
   */
  private getPaymentLevel(score: number): 'Excellent' | 'Bon' | 'Moyen' | 'Mauvais' {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Bon';
    if (score >= 40) return 'Moyen';
    return 'Mauvais';
  }

  /**
   * Generate payment reliability recommendations
   */
  private generatePaymentRecommendations(company: PappersCompanyData): string[] {
    const recommendations: string[] = [];

    if (company.paymentReliability! < 50) {
      recommendations.push('Vérifier les antécédents de paiement avant signature');
    }

    if (company.bankruptcyRisk) {
      recommendations.push('Risque de faillite détecté - vigilance recommandée');
    }

    if (!company.yearsInBusiness || company.yearsInBusiness < 2) {
      recommendations.push('Entreprise nouvelle - demander des garanties supplémentaires');
    }

    if (company.employees === 0 || !company.employees) {
      recommendations.push('Aucun employé déclaré - vérifier le statut');
    }

    return recommendations;
  }
}

// Export singleton
export const pappersService = new PappersService();
export default pappersService;
