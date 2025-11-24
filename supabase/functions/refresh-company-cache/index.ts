/**
 * Refresh Company Cache Function
 * Automatically refreshes company data that needs updating
 * Can be triggered by cron job or manually
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { createCompanySearchService } from '../_shared/company-search.service.ts';
import { corsHeaders } from '../_shared/cors.ts';

interface RefreshRequest {
  maxCompanies?: number; // Max number of companies to refresh per run
  forceAll?: boolean; // Force refresh all companies
  sirets?: string[]; // Specific SIRETs to refresh
}

interface RefreshResult {
  success: boolean;
  refreshed: number;
  failed: number;
  skipped: number;
  errors: string[];
  details: {
    siret: string;
    status: 'refreshed' | 'failed' | 'skipped';
    error?: string;
  }[];
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Parse request body
    const body: RefreshRequest = req.method === 'POST'
      ? await req.json()
      : {};

    const maxCompanies = body.maxCompanies || 50;
    const forceAll = body.forceAll || false;
    const specificSirets = body.sirets || [];

    console.log('Starting company cache refresh...', {
      maxCompanies,
      forceAll,
      specificSirets: specificSirets.length,
    });

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Initialize company search service
    const companySearchService = createCompanySearchService();

    const result: RefreshResult = {
      success: true,
      refreshed: 0,
      failed: 0,
      skipped: 0,
      errors: [],
      details: [],
    };

    let companiesToRefresh: any[] = [];

    // Get companies that need refresh
    if (specificSirets.length > 0) {
      // Refresh specific SIRETs
      const { data, error } = await supabase
        .from('company_data_cache')
        .select('*')
        .in('siret', specificSirets);

      if (error) {
        throw new Error(`Failed to fetch specific companies: ${error.message}`);
      }

      companiesToRefresh = data || [];
    } else if (forceAll) {
      // Refresh all companies (limited by maxCompanies)
      const { data, error } = await supabase
        .from('company_data_cache')
        .select('*')
        .order('last_fetched_at', { ascending: true })
        .limit(maxCompanies);

      if (error) {
        throw new Error(`Failed to fetch all companies: ${error.message}`);
      }

      companiesToRefresh = data || [];
    } else {
      // Refresh companies that need it based on strategy
      // 1. Companies marked as 'expired'
      const { data: expiredCompanies, error: expiredError } = await supabase
        .from('company_data_cache')
        .select('*')
        .eq('refresh_strategy', 'expired')
        .limit(maxCompanies);

      if (expiredError) {
        console.error('Failed to fetch expired companies:', expiredError);
      } else {
        companiesToRefresh.push(...(expiredCompanies || []));
      }

      // 2. Companies past their next_refresh_at date
      const { data: scheduledRefresh, error: scheduledError } = await supabase
        .from('company_data_cache')
        .select('*')
        .lt('next_refresh_at', new Date().toISOString())
        .order('next_refresh_at', { ascending: true })
        .limit(maxCompanies - companiesToRefresh.length);

      if (scheduledError) {
        console.error('Failed to fetch scheduled refresh:', scheduledError);
      } else {
        companiesToRefresh.push(...(scheduledRefresh || []));
      }

      // 3. High-traffic companies with old data (fetch_count > 10, age > 30 days)
      if (companiesToRefresh.length < maxCompanies) {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const { data: highTraffic, error: highTrafficError } = await supabase
          .from('company_data_cache')
          .select('*')
          .gt('fetch_count', 10)
          .lt('last_fetched_at', thirtyDaysAgo.toISOString())
          .order('fetch_count', { ascending: false })
          .limit(maxCompanies - companiesToRefresh.length);

        if (highTrafficError) {
          console.error('Failed to fetch high-traffic companies:', highTrafficError);
        } else {
          companiesToRefresh.push(...(highTraffic || []));
        }
      }
    }

    console.log(`Found ${companiesToRefresh.length} companies to refresh`);

    // Refresh each company
    for (const company of companiesToRefresh) {
      try {
        console.log(`Refreshing ${company.siret}...`);

        const refreshResult = await companySearchService.refreshCompanyData(company.siret);

        if (refreshResult.success) {
          result.refreshed++;
          result.details.push({
            siret: company.siret,
            status: 'refreshed',
          });
          console.log(`✓ Refreshed ${company.siret}`);
        } else {
          result.failed++;
          result.details.push({
            siret: company.siret,
            status: 'failed',
            error: refreshResult.errors?.join(', '),
          });
          result.errors.push(`${company.siret}: ${refreshResult.errors?.join(', ')}`);
          console.error(`✗ Failed to refresh ${company.siret}:`, refreshResult.errors);
        }
      } catch (error) {
        result.failed++;
        const errorMsg = String(error);
        result.details.push({
          siret: company.siret,
          status: 'failed',
          error: errorMsg,
        });
        result.errors.push(`${company.siret}: ${errorMsg}`);
        console.error(`✗ Exception refreshing ${company.siret}:`, error);
      }

      // Small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    result.success = result.failed === 0;

    console.log('Refresh completed:', {
      refreshed: result.refreshed,
      failed: result.failed,
      skipped: result.skipped,
    });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Refresh function error:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: String(error),
        refreshed: 0,
        failed: 0,
        skipped: 0,
        errors: [String(error)],
        details: [],
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
