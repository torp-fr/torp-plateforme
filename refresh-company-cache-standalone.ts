/**
 * REFRESH COMPANY CACHE - Version Standalone Simplifiée
 * Marque les entrées du cache qui nécessitent un rafraîchissement
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

// CORS headers inline
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RefreshRequest {
  maxCompanies?: number;
  forceAll?: boolean;
  sirets?: string[];
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse request
    const body: RefreshRequest = req.method === 'POST' ? await req.json() : {};
    const maxCompanies = body.maxCompanies || 50;
    const forceAll = body.forceAll || false;
    const specificSirets = body.sirets || [];

    let refreshed = 0;
    let failed = 0;
    let skipped = 0;
    const details: any[] = [];

    // Cas 1 : SIRETs spécifiques fournis
    if (specificSirets.length > 0) {
      for (const siret of specificSirets.slice(0, maxCompanies)) {
        try {
          // Vérifier si l'entrée existe
          const { data: existing } = await supabase
            .from('company_data_cache')
            .select('*')
            .eq('siret', siret)
            .single();

          if (existing) {
            // Marquer pour rafraîchissement en mettant refresh_strategy à 'expired'
            const { error: updateError } = await supabase
              .from('company_data_cache')
              .update({
                refresh_strategy: 'expired',
                updated_at: new Date().toISOString()
              })
              .eq('siret', siret);

            if (updateError) {
              failed++;
              details.push({ siret, status: 'failed', error: updateError.message });
            } else {
              refreshed++;
              details.push({ siret, status: 'marked_for_refresh' });
            }
          } else {
            skipped++;
            details.push({ siret, status: 'not_found' });
          }
        } catch (error) {
          failed++;
          details.push({ siret, status: 'failed', error: error.message });
        }
      }
    }
    // Cas 2 : Rafraîchir les entrées qui nécessitent un refresh
    else {
      let query = supabase
        .from('company_data_cache')
        .select('siret, next_refresh_at, fetch_count, last_fetched_at')
        .order('next_refresh_at', { ascending: true });

      if (!forceAll) {
        // Seulement celles qui ont dépassé next_refresh_at
        query = query.lt('next_refresh_at', new Date().toISOString());
      }

      query = query.limit(maxCompanies);

      const { data: toRefresh, error: fetchError } = await query;

      if (fetchError) {
        throw new Error(`Failed to fetch companies: ${fetchError.message}`);
      }

      if (!toRefresh || toRefresh.length === 0) {
        return new Response(
          JSON.stringify({
            success: true,
            message: 'No companies need refreshing',
            refreshed: 0,
            failed: 0,
            skipped: 0,
            details: []
          }, null, 2),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Marquer chaque entrée pour rafraîchissement
      for (const company of toRefresh) {
        try {
          const { error: updateError } = await supabase
            .from('company_data_cache')
            .update({
              refresh_strategy: 'expired',
              updated_at: new Date().toISOString()
            })
            .eq('siret', company.siret);

          if (updateError) {
            failed++;
            details.push({ siret: company.siret, status: 'failed', error: updateError.message });
          } else {
            refreshed++;
            details.push({
              siret: company.siret,
              status: 'marked_for_refresh',
              fetch_count: company.fetch_count,
              last_fetched: company.last_fetched_at
            });
          }
        } catch (error) {
          failed++;
          details.push({ siret: company.siret, status: 'failed', error: error.message });
        }
      }
    }

    // Résumé
    const summary = {
      success: true,
      message: `Marked ${refreshed} companies for refresh`,
      refreshed,
      failed,
      skipped,
      details,
      timestamp: new Date().toISOString()
    };

    return new Response(
      JSON.stringify(summary, null, 2),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
