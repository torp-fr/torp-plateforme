/**
 * CLEANUP COMPANY CACHE - Version Standalone Simplifiée
 * Supprime les entrées obsolètes du cache
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

// CORS headers inline
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CleanupRequest {
  dryRun?: boolean;
  maxAgeUnused?: number; // Days
  minFetchCountForOld?: number;
  maxAgeOld?: number; // Days
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
    const body: CleanupRequest = req.method === 'POST' ? await req.json() : {};
    const dryRun = body.dryRun !== undefined ? body.dryRun : true; // Safe par défaut
    const maxAgeUnused = body.maxAgeUnused || 180; // 180 jours
    const minFetchCountForOld = body.minFetchCountForOld || 5;
    const maxAgeOld = body.maxAgeOld || 365; // 1 an

    // Calculer les dates limites
    const unusedCutoffDate = new Date();
    unusedCutoffDate.setDate(unusedCutoffDate.getDate() - maxAgeUnused);

    const oldCutoffDate = new Date();
    oldCutoffDate.setDate(oldCutoffDate.getDate() - maxAgeOld);

    const toDelete: any[] = [];

    // Critère 1 : Jamais utilisé depuis longtemps (fetch_count = 0)
    const { data: unused, error: unusedError } = await supabase
      .from('company_data_cache')
      .select('siret, company_name, fetch_count, created_at, last_fetched_at')
      .eq('fetch_count', 0)
      .lt('created_at', unusedCutoffDate.toISOString());

    if (unusedError) {
      throw new Error(`Failed to fetch unused entries: ${unusedError.message}`);
    }

    if (unused) {
      toDelete.push(...unused.map(item => ({
        ...item,
        reason: `Never used since ${maxAgeUnused} days`
      })));
    }

    // Critère 2 : Rarement utilisé et très ancien (fetch_count < minFetchCountForOld)
    const { data: oldUnused, error: oldError } = await supabase
      .from('company_data_cache')
      .select('siret, company_name, fetch_count, created_at, last_fetched_at')
      .lt('fetch_count', minFetchCountForOld)
      .lt('created_at', oldCutoffDate.toISOString());

    if (oldError) {
      throw new Error(`Failed to fetch old unused entries: ${oldError.message}`);
    }

    if (oldUnused) {
      // Éviter les doublons
      const existingSirets = new Set(toDelete.map(item => item.siret));
      const newOldItems = oldUnused.filter(item => !existingSirets.has(item.siret));

      toDelete.push(...newOldItems.map(item => ({
        ...item,
        reason: `Used <${minFetchCountForOld} times and older than ${maxAgeOld} days`
      })));
    }

    // Mode dry-run : ne rien supprimer, juste montrer
    if (dryRun) {
      return new Response(
        JSON.stringify({
          success: true,
          dryRun: true,
          message: 'Dry run - no entries deleted',
          wouldDelete: toDelete.length,
          entries: toDelete,
          criteria: {
            unusedCutoff: unusedCutoffDate.toISOString(),
            oldCutoff: oldCutoffDate.toISOString(),
            minFetchCountForOld
          },
          timestamp: new Date().toISOString()
        }, null, 2),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // Mode réel : supprimer les entrées
    let deleted = 0;
    let failed = 0;
    const deletionDetails: any[] = [];

    for (const entry of toDelete) {
      try {
        const { error: deleteError } = await supabase
          .from('company_data_cache')
          .delete()
          .eq('siret', entry.siret);

        if (deleteError) {
          failed++;
          deletionDetails.push({
            siret: entry.siret,
            status: 'failed',
            error: deleteError.message
          });
        } else {
          deleted++;
          deletionDetails.push({
            siret: entry.siret,
            company_name: entry.company_name,
            status: 'deleted',
            reason: entry.reason
          });
        }
      } catch (error) {
        failed++;
        deletionDetails.push({
          siret: entry.siret,
          status: 'failed',
          error: error.message
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        dryRun: false,
        message: `Deleted ${deleted} obsolete entries`,
        deleted,
        failed,
        details: deletionDetails,
        criteria: {
          unusedCutoff: unusedCutoffDate.toISOString(),
          oldCutoff: oldCutoffDate.toISOString(),
          minFetchCountForOld
        },
        timestamp: new Date().toISOString()
      }, null, 2),
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
