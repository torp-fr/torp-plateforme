/**
 * Company Search Edge Function
 * Searches for company data with intelligent caching
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import {
  CompanySearchService,
  type CompanySearchOptions,
} from '../_shared/company-search.service.ts';

interface SearchRequest extends CompanySearchOptions {
  // Extends CompanySearchOptions with any additional request fields
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const pappersApiKey = Deno.env.get('PAPPERS_API_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing required environment variables');
    }

    // Parse request
    const body: SearchRequest = await req.json();

    // Validate request
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

    // Initialize service
    const companySearchService = new CompanySearchService({
      supabaseUrl,
      supabaseServiceKey,
      pappersApiKey,
    });

    // Perform search
    const result = await companySearchService.searchCompany({
      siret: body.siret,
      siren: body.siren,
      companyName: body.companyName,
      forceRefresh: body.forceRefresh || false,
      usePappers: body.usePappers !== false, // Default to true if Pappers is available
      includeFinances: body.includeFinances || false,
      includeRepresentants: body.includeRepresentants || false,
      includeProcedures: body.includeProcedures || false,
    });

    return new Response(JSON.stringify(result, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
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
