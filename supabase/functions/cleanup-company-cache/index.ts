/**
 * Cleanup Company Cache Function
 * Removes old, unused cache entries to keep database clean
 * Can be triggered by cron job (e.g., weekly)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';

interface CleanupRequest {
  dryRun?: boolean; // Preview what would be deleted without actually deleting
  maxAge?: number; // Max age in days before considering for cleanup
}

interface CleanupResult {
  success: boolean;
  deleted: number;
  dryRun: boolean;
  criteria: {
    neverUsedOlderThan: number; // days
    rarelyUsedOlderThan: number; // days
  };
  deletedEntries?: {
    siret: string;
    companyName: string;
    age: number;
    fetchCount: number;
    reason: string;
  }[];
  error?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Parse request body
    const body: CleanupRequest = req.method === 'POST'
      ? await req.json()
      : {};

    const dryRun = body.dryRun ?? false;
    const maxAge = body.maxAge || 365;

    console.log('Starting company cache cleanup...', { dryRun, maxAge });

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const result: CleanupResult = {
      success: true,
      deleted: 0,
      dryRun,
      criteria: {
        neverUsedOlderThan: 180, // Never used and older than 180 days
        rarelyUsedOlderThan: 365, // Used < 5 times and older than 365 days
      },
      deletedEntries: [],
    };

    // Use the PostgreSQL function for cleanup
    const { data, error } = await supabase.rpc('clean_expired_company_cache');

    if (error) {
      throw new Error(`Cleanup function failed: ${error.message}`);
    }

    result.deleted = data || 0;

    // If dry run or want details, query what would be deleted
    if (dryRun || true) {
      const now = new Date();
      const thirtyDaysAgo180 = new Date(now);
      thirtyDaysAgo180.setDate(thirtyDaysAgo180.getDate() - 180);

      const thirtyDaysAgo365 = new Date(now);
      thirtyDaysAgo365.setDate(thirtyDaysAgo365.getDate() - 365);

      // Find entries matching cleanup criteria
      const { data: neverUsed, error: neverUsedError } = await supabase
        .from('company_data_cache')
        .select('siret, company_name, fetch_count, last_fetched_at')
        .eq('fetch_count', 0)
        .lt('last_fetched_at', thirtyDaysAgo180.toISOString());

      if (!neverUsedError && neverUsed) {
        for (const entry of neverUsed) {
          const age = Math.floor(
            (now.getTime() - new Date(entry.last_fetched_at).getTime()) /
              (1000 * 60 * 60 * 24)
          );
          result.deletedEntries!.push({
            siret: entry.siret,
            companyName: entry.company_name,
            age,
            fetchCount: entry.fetch_count,
            reason: 'Never used and older than 180 days',
          });
        }
      }

      const { data: rarelyUsed, error: rarelyUsedError } = await supabase
        .from('company_data_cache')
        .select('siret, company_name, fetch_count, last_fetched_at')
        .lt('fetch_count', 5)
        .lt('last_fetched_at', thirtyDaysAgo365.toISOString());

      if (!rarelyUsedError && rarelyUsed) {
        for (const entry of rarelyUsed) {
          const age = Math.floor(
            (now.getTime() - new Date(entry.last_fetched_at).getTime()) /
              (1000 * 60 * 60 * 24)
          );

          // Check if already in list (from neverUsed)
          if (!result.deletedEntries!.find((e) => e.siret === entry.siret)) {
            result.deletedEntries!.push({
              siret: entry.siret,
              companyName: entry.company_name,
              age,
              fetchCount: entry.fetch_count,
              reason: 'Rarely used (<5 times) and older than 365 days',
            });
          }
        }
      }
    }

    // If dry run, don't actually delete
    if (dryRun) {
      result.deleted = result.deletedEntries?.length || 0;
      console.log(`Dry run: Would delete ${result.deleted} entries`);
    } else {
      console.log(`Cleanup completed: Deleted ${result.deleted} entries`);
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Cleanup function error:', error);

    return new Response(
      JSON.stringify({
        success: false,
        deleted: 0,
        dryRun: false,
        criteria: {
          neverUsedOlderThan: 180,
          rarelyUsedOlderThan: 365,
        },
        error: String(error),
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
