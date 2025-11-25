/**
 * TEST COMPANY SEARCH - Version Standalone
 * Tous les imports sont inline pour permettre déploiement manuel
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

// CORS headers inline
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    const tests: any[] = [];
    let passed = 0;
    let failed = 0;

    // =================================================================
    // TEST 1: SIRET Validation - Valid SIRET
    // =================================================================
    try {
      const validSiret = '73282932000074'; // Valid SIRET with correct Luhn checksum
      const isValid = validateSiret(validSiret);
      if (isValid) {
        tests.push({ test: 'SIRET Validation - Valid', status: 'PASS' });
        passed++;
      } else {
        tests.push({ test: 'SIRET Validation - Valid', status: 'FAIL', error: 'Valid SIRET rejected' });
        failed++;
      }
    } catch (error) {
      tests.push({ test: 'SIRET Validation - Valid', status: 'FAIL', error: error.message });
      failed++;
    }

    // =================================================================
    // TEST 2: SIRET Validation - Invalid Format
    // =================================================================
    try {
      const invalidSiret = '12345'; // Too short
      const isValid = validateSiret(invalidSiret);
      if (!isValid) {
        tests.push({ test: 'SIRET Validation - Invalid Format', status: 'PASS' });
        passed++;
      } else {
        tests.push({ test: 'SIRET Validation - Invalid Format', status: 'FAIL', error: 'Invalid SIRET accepted' });
        failed++;
      }
    } catch (error) {
      tests.push({ test: 'SIRET Validation - Invalid Format', status: 'FAIL', error: error.message });
      failed++;
    }

    // =================================================================
    // TEST 3: SIREN Validation - Valid SIREN
    // =================================================================
    try {
      const validSiren = '732829320'; // Valid SIREN with correct Luhn checksum
      const isValid = validateSiren(validSiren);
      if (isValid) {
        tests.push({ test: 'SIREN Validation - Valid', status: 'PASS' });
        passed++;
      } else {
        tests.push({ test: 'SIREN Validation - Valid', status: 'FAIL', error: 'Valid SIREN rejected' });
        failed++;
      }
    } catch (error) {
      tests.push({ test: 'SIREN Validation - Valid', status: 'FAIL', error: error.message });
      failed++;
    }

    // =================================================================
    // TEST 4: Database Table Exists - company_data_cache
    // =================================================================
    try {
      const { data, error } = await supabase
        .from('company_data_cache')
        .select('id')
        .limit(1);

      if (!error) {
        tests.push({ test: 'Database Table - company_data_cache', status: 'PASS' });
        passed++;
      } else {
        tests.push({ test: 'Database Table - company_data_cache', status: 'FAIL', error: error.message });
        failed++;
      }
    } catch (error) {
      tests.push({ test: 'Database Table - company_data_cache', status: 'FAIL', error: error.message });
      failed++;
    }

    // =================================================================
    // TEST 5: Database Table Exists - company_search_history
    // =================================================================
    try {
      const { data, error } = await supabase
        .from('company_search_history')
        .select('id')
        .limit(1);

      if (!error) {
        tests.push({ test: 'Database Table - company_search_history', status: 'PASS' });
        passed++;
      } else {
        tests.push({ test: 'Database Table - company_search_history', status: 'FAIL', error: error.message });
        failed++;
      }
    } catch (error) {
      tests.push({ test: 'Database Table - company_search_history', status: 'FAIL', error: error.message });
      failed++;
    }

    // =================================================================
    // TEST 6: Database Function - should_refresh_company_cache
    // =================================================================
    try {
      const { data, error } = await supabase.rpc('should_refresh_company_cache', {
        p_siret: '12345678901234'
      });

      if (!error) {
        tests.push({ test: 'PostgreSQL Function - should_refresh_company_cache', status: 'PASS' });
        passed++;
      } else {
        tests.push({ test: 'PostgreSQL Function - should_refresh_company_cache', status: 'FAIL', error: error.message });
        failed++;
      }
    } catch (error) {
      tests.push({ test: 'PostgreSQL Function - should_refresh_company_cache', status: 'FAIL', error: error.message });
      failed++;
    }

    // =================================================================
    // TEST 7: Cache Insert/Read/Delete
    // =================================================================
    try {
      const testSiret = '99999999999999';

      // Insert
      const { error: insertError } = await supabase
        .from('company_data_cache')
        .insert({
          siret: testSiret,
          siren: '999999999',
          company_name: 'Test Company',
          data_source: 'manual',
          cached_data: { test: true },
          quality_score: 50
        });

      if (insertError && !insertError.message.includes('duplicate')) {
        throw new Error(`Insert failed: ${insertError.message}`);
      }

      // Read
      const { data: readData, error: readError } = await supabase
        .from('company_data_cache')
        .select('*')
        .eq('siret', testSiret)
        .single();

      if (readError) {
        throw new Error(`Read failed: ${readError.message}`);
      }

      // Delete
      const { error: deleteError } = await supabase
        .from('company_data_cache')
        .delete()
        .eq('siret', testSiret);

      if (deleteError) {
        throw new Error(`Delete failed: ${deleteError.message}`);
      }

      tests.push({ test: 'Cache Operations - Insert/Read/Delete', status: 'PASS' });
      passed++;
    } catch (error) {
      tests.push({ test: 'Cache Operations - Insert/Read/Delete', status: 'FAIL', error: error.message });
      failed++;
    }

    // =================================================================
    // SUMMARY
    // =================================================================
    const summary = {
      success: failed === 0,
      totalTests: tests.length,
      passed,
      failed,
      results: tests,
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
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

// =================================================================
// VALIDATION FUNCTIONS (Inline)
// =================================================================

function validateSiret(siret: string): boolean {
  if (!siret || typeof siret !== 'string') return false;
  const cleaned = siret.replace(/\s/g, '');
  if (cleaned.length !== 14 || !/^\d{14}$/.test(cleaned)) return false;
  return luhnCheck(cleaned);
}

function validateSiren(siren: string): boolean {
  if (!siren || typeof siren !== 'string') return false;
  const cleaned = siren.replace(/\s/g, '');
  if (cleaned.length !== 9 || !/^\d{9}$/.test(cleaned)) return false;
  return luhnCheck(cleaned);
}

function luhnCheck(num: string): boolean {
  let sum = 0;
  let isEven = false;

  for (let i = num.length - 1; i >= 0; i--) {
    let digit = parseInt(num[i], 10);

    if (isEven) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }

    sum += digit;
    isEven = !isEven;
  }

  return sum % 10 === 0;
}
