/**
 * COMPANY SEARCH - Standalone Version for Manual Deployment
 *
 * This version can be copy-pasted directly into Supabase Dashboard
 * without import dependencies.
 *
 * IMPORTANT: This is a simplified version. For production, you should deploy
 * the full version from supabase/functions/company-search/index.ts which imports
 * the complete shared services.
 *
 * This standalone version provides BASIC company search with cache lookup.
 * The full shared service includes advanced features like:
 * - SIRET validation with Luhn algorithm
 * - Multiple API fallbacks (Recherche Entreprises, BODACC, RGE)
 * - Quality scoring and risk assessment
 * - Smart cache refresh strategies
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SearchRequest {
  siret?: string;
  siren?: string;
  companyName?: string;
  forceRefresh?: boolean;
  usePappers?: boolean;
  includeFinances?: boolean;
  includeRepresentants?: boolean;
  includeProcedures?: boolean;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const pappersApiKey = Deno.env.get('PAPPERS_API_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase configuration');
    }

    // Parse request
    const body: SearchRequest = await req.json();

    // Validate
    if (!body.siret && !body.siren && !body.companyName) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'At least one of siret, siren, or companyName is required',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Step 1: Check cache
    if (!body.forceRefresh && body.siret) {
      console.log(`[CompanySearch] Checking cache for SIRET: ${body.siret}`);

      const { data: cached } = await supabase
        .from('company_data_cache')
        .select('*')
        .eq('siret', body.siret)
        .single();

      if (cached) {
        // Check if cache is still valid
        const nextRefresh = new Date(cached.next_refresh_at);
        if (nextRefresh > new Date()) {
          console.log('[CompanySearch] Cache HIT - returning cached data');

          // Increment fetch count
          await supabase.rpc('increment_company_cache_fetch_count', {
            siret_param: body.siret,
          });

          return new Response(
            JSON.stringify({
              success: true,
              cached: true,
              cacheAge: Math.floor(
                (Date.now() - new Date(cached.last_fetched_at).getTime()) / (1000 * 60 * 60 * 24)
              ),
              dataSource: 'cache',
              siret: cached.siret,
              siren: cached.siren,
              companyName: cached.company_name,
              legalName: cached.legal_name,
              data: cached.cached_data,
              qualityScore: cached.quality_score,
              dataCompleteness: 100,
              confidence: 95,
              riskLevel: cached.risk_level || 'low',
              alerts: cached.risk_indicators || [],
              lastFetched: cached.last_fetched_at,
              nextRefresh: cached.next_refresh_at,
              fetchCount: cached.fetch_count,
            }),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }
      }
    }

    // Step 2: Fetch from Pappers API (if configured)
    if (pappersApiKey && body.usePappers !== false && body.siret) {
      console.log('[CompanySearch] Cache MISS - fetching from Pappers API');

      const pappersUrl = `https://api.pappers.fr/v2/entreprise?api_token=${pappersApiKey}&siret=${body.siret}`;

      const pappersResponse = await fetch(pappersUrl);

      if (pappersResponse.ok) {
        const pappersData = await pappersResponse.json();

        // Extract basic info
        const companyName = pappersData.nom_entreprise || pappersData.denomination || 'Unknown';
        const siren = pappersData.siren || body.siret?.substring(0, 9) || '';

        // Simple quality scoring
        let qualityScore = 50;
        if (pappersData.chiffre_affaires) qualityScore += 15;
        if (pappersData.resultat) qualityScore += 10;
        if (pappersData.date_creation) qualityScore += 10;
        if (pappersData.effectif) qualityScore += 10;
        if (pappersData.statut_rcs === 'Inscrit') qualityScore += 5;

        // Determine risk level
        let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
        const alerts: string[] = [];

        if (pappersData.procedure_collective && pappersData.procedure_collective.length > 0) {
          riskLevel = 'critical';
          alerts.push('Procédure collective en cours');
        } else if (pappersData.chiffre_affaires && pappersData.chiffre_affaires < 100000) {
          riskLevel = 'medium';
          alerts.push('Chiffre d\'affaires faible');
        }

        // Store in cache
        const { error: cacheError } = await supabase.from('company_data_cache').upsert({
          siret: body.siret,
          siren: siren,
          company_name: companyName,
          legal_name: pappersData.denomination,
          cached_data: pappersData,
          quality_score: qualityScore,
          data_source: 'pappers',
          risk_level: riskLevel,
          risk_indicators: alerts,
          last_fetched_at: new Date().toISOString(),
          next_refresh_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 days
          refresh_strategy: 'standard',
          fetch_count: 1,
        });

        if (cacheError) {
          console.error('[CompanySearch] Cache storage failed:', cacheError);
        }

        return new Response(
          JSON.stringify({
            success: true,
            cached: false,
            dataSource: 'pappers',
            siret: body.siret,
            siren: siren,
            companyName: companyName,
            legalName: pappersData.denomination,
            data: pappersData,
            qualityScore: qualityScore,
            dataCompleteness: 100,
            confidence: 100,
            riskLevel: riskLevel,
            alerts: alerts,
            lastFetched: new Date(),
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // Step 3: No data found
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Company not found. Please check SIRET/SIREN or configure Pappers API key.',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      }
    );
  } catch (error) {
    console.error('[CompanySearch] Error:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
