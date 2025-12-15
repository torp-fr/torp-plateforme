/**
 * Test Company Search System
 * Comprehensive test suite for company search functionality
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { extractCompanyInfo, isValidSiret, isValidSiren } from '../_shared/siret-extractor.ts';
import { createCompanySearchService } from '../_shared/company-search.service.ts';

interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
  details?: any;
}

interface TestSuite {
  suiteName: string;
  tests: TestResult[];
  passed: number;
  failed: number;
  duration: number;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const allTests: TestSuite[] = [];
    const startTime = Date.now();

    // ================================================
    // TEST SUITE 1: SIRET Validation
    // ================================================
    const siretTests: TestResult[] = [];
    let siretStart = Date.now();

    // Test 1.1: Valid SIRET
    siretStart = Date.now();
    siretTests.push({
      name: 'Valid SIRET (with spaces)',
      passed: isValidSiret('732 829 320 00074'),
      duration: Date.now() - siretStart,
    });

    // Test 1.2: Valid SIRET (no spaces)
    siretStart = Date.now();
    siretTests.push({
      name: 'Valid SIRET (no spaces)',
      passed: isValidSiret('73282932000074'),
      duration: Date.now() - siretStart,
    });

    // Test 1.3: Invalid SIRET (wrong length)
    siretStart = Date.now();
    siretTests.push({
      name: 'Invalid SIRET (wrong length)',
      passed: !isValidSiret('1234567890'),
      duration: Date.now() - siretStart,
    });

    // Test 1.4: Invalid SIRET (Luhn check fails)
    siretStart = Date.now();
    siretTests.push({
      name: 'Invalid SIRET (Luhn fails)',
      passed: !isValidSiret('12345678901234'),
      duration: Date.now() - siretStart,
    });

    // Test 1.5: Valid SIREN
    siretStart = Date.now();
    siretTests.push({
      name: 'Valid SIREN',
      passed: isValidSiren('732829320'),
      duration: Date.now() - siretStart,
    });

    allTests.push({
      suiteName: 'SIRET/SIREN Validation',
      tests: siretTests,
      passed: siretTests.filter((t) => t.passed).length,
      failed: siretTests.filter((t) => !t.passed).length,
      duration: siretTests.reduce((sum, t) => sum + t.duration, 0),
    });

    // ================================================
    // TEST SUITE 2: SIRET Extraction
    // ================================================
    const extractionTests: TestResult[] = [];

    // Test 2.1: Extract from formatted text
    let extractStart = Date.now();
    try {
      const sampleText = `
        DEVIS N° 2024-001
        Entreprise: BTP SOLUTIONS SARL
        SIRET: 732 829 320 00074
        Adresse: 10 rue de la Paix, 75001 PARIS
      `;
      const result = await extractCompanyInfo(sampleText);
      extractionTests.push({
        name: 'Extract SIRET from formatted text',
        passed: result.success && result.siret === '73282932000074',
        duration: Date.now() - extractStart,
        details: { extractionMethod: result.extractionMethod, confidence: result.confidence },
      });
    } catch (error) {
      extractionTests.push({
        name: 'Extract SIRET from formatted text',
        passed: false,
        duration: Date.now() - extractStart,
        error: String(error),
      });
    }

    // Test 2.2: Extract from compact format
    extractStart = Date.now();
    try {
      const sampleText = 'SIRET73282932000074';
      const result = await extractCompanyInfo(sampleText);
      extractionTests.push({
        name: 'Extract SIRET from compact format',
        passed: result.success && result.siret === '73282932000074',
        duration: Date.now() - extractStart,
        details: { extractionMethod: result.extractionMethod },
      });
    } catch (error) {
      extractionTests.push({
        name: 'Extract SIRET from compact format',
        passed: false,
        duration: Date.now() - extractStart,
        error: String(error),
      });
    }

    // Test 2.3: Handle missing SIRET gracefully
    extractStart = Date.now();
    try {
      const sampleText = 'This is a document without any SIRET number.';
      const result = await extractCompanyInfo(sampleText);
      extractionTests.push({
        name: 'Handle missing SIRET gracefully',
        passed: !result.success && result.extractionMethod === 'failed',
        duration: Date.now() - extractStart,
      });
    } catch (error) {
      extractionTests.push({
        name: 'Handle missing SIRET gracefully',
        passed: false,
        duration: Date.now() - extractStart,
        error: String(error),
      });
    }

    allTests.push({
      suiteName: 'SIRET Extraction',
      tests: extractionTests,
      passed: extractionTests.filter((t) => t.passed).length,
      failed: extractionTests.filter((t) => !t.passed).length,
      duration: extractionTests.reduce((sum, t) => sum + t.duration, 0),
    });

    // ================================================
    // TEST SUITE 3: Company Search Service
    // ================================================
    const searchTests: TestResult[] = [];

    // Check if Pappers API key is configured
    const pappersApiKey = Deno.env.get('PAPPERS_API_KEY');
    const hasPappersKey = !!pappersApiKey;

    if (hasPappersKey) {
      // Test 3.1: Search by SIRET (real API call)
      let searchStart = Date.now();
      try {
        const service = createCompanySearchService();
        const result = await service.searchCompany({
          siret: '73282932000074', // Apple France SARL (example)
        });

        searchTests.push({
          name: 'Search by SIRET (API call)',
          passed: result.success,
          duration: Date.now() - searchStart,
          details: {
            cached: result.cached,
            dataSource: result.dataSource,
            qualityScore: result.qualityScore,
            riskLevel: result.riskLevel,
          },
        });
      } catch (error) {
        searchTests.push({
          name: 'Search by SIRET (API call)',
          passed: false,
          duration: Date.now() - searchStart,
          error: String(error),
        });
      }

      // Test 3.2: Search by SIRET again (should be cached)
      searchStart = Date.now();
      try {
        const service = createCompanySearchService();
        const result = await service.searchCompany({
          siret: '73282932000074',
        });

        searchTests.push({
          name: 'Search by SIRET (cache hit)',
          passed: result.success && result.cached === true,
          duration: Date.now() - searchStart,
          details: {
            cached: result.cached,
            cacheAge: result.cacheAge,
            dataSource: result.dataSource,
          },
        });
      } catch (error) {
        searchTests.push({
          name: 'Search by SIRET (cache hit)',
          passed: false,
          duration: Date.now() - searchStart,
          error: String(error),
        });
      }

      // Test 3.3: Force refresh
      searchStart = Date.now();
      try {
        const service = createCompanySearchService();
        const result = await service.searchCompany({
          siret: '73282932000074',
          forceRefresh: true,
        });

        searchTests.push({
          name: 'Force refresh (bypass cache)',
          passed: result.success && result.cached === false,
          duration: Date.now() - searchStart,
          details: {
            cached: result.cached,
            dataSource: result.dataSource,
          },
        });
      } catch (error) {
        searchTests.push({
          name: 'Force refresh (bypass cache)',
          passed: false,
          duration: Date.now() - searchStart,
          error: String(error),
        });
      }
    } else {
      searchTests.push({
        name: 'Company Search Tests',
        passed: false,
        duration: 0,
        error: 'PAPPERS_API_KEY not configured. Skipping API tests.',
      });
    }

    allTests.push({
      suiteName: 'Company Search Service',
      tests: searchTests,
      passed: searchTests.filter((t) => t.passed).length,
      failed: searchTests.filter((t) => !t.passed).length,
      duration: searchTests.reduce((sum, t) => sum + t.duration, 0),
    });

    // ================================================
    // TEST SUITE 4: Database Functions
    // ================================================
    const dbTests: TestResult[] = [];

    // Test 4.1: Check if cache table exists
    let dbStart = Date.now();
    try {
      const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.39.3');
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );

      const { data, error } = await supabase
        .from('company_data_cache')
        .select('count')
        .limit(1);

      dbTests.push({
        name: 'Cache table exists',
        passed: !error,
        duration: Date.now() - dbStart,
      });
    } catch (error) {
      dbTests.push({
        name: 'Cache table exists',
        passed: false,
        duration: Date.now() - dbStart,
        error: String(error),
      });
    }

    // Test 4.2: Check if search history table exists
    dbStart = Date.now();
    try {
      const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.39.3');
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );

      const { data, error } = await supabase
        .from('company_search_history')
        .select('count')
        .limit(1);

      dbTests.push({
        name: 'Search history table exists',
        passed: !error,
        duration: Date.now() - dbStart,
      });
    } catch (error) {
      dbTests.push({
        name: 'Search history table exists',
        passed: false,
        duration: Date.now() - dbStart,
        error: String(error),
      });
    }

    allTests.push({
      suiteName: 'Database Functions',
      tests: dbTests,
      passed: dbTests.filter((t) => t.passed).length,
      failed: dbTests.filter((t) => !t.passed).length,
      duration: dbTests.reduce((sum, t) => sum + t.duration, 0),
    });

    // ================================================
    // SUMMARY
    // ================================================
    const totalDuration = Date.now() - startTime;
    const totalTests = allTests.reduce((sum, suite) => sum + suite.tests.length, 0);
    const totalPassed = allTests.reduce((sum, suite) => sum + suite.passed, 0);
    const totalFailed = allTests.reduce((sum, suite) => sum + suite.failed, 0);

    const summary = {
      totalTests,
      totalPassed,
      totalFailed,
      totalDuration,
      passRate: ((totalPassed / totalTests) * 100).toFixed(2) + '%',
      suites: allTests,
      environment: {
        hasPappersKey,
        hasClaudeKey: !!Deno.env.get('CLAUDE_API_KEY'),
        hasSupabase: !!Deno.env.get('SUPABASE_URL'),
      },
    };

    return new Response(JSON.stringify(summary, null, 2), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Test suite error:', error);

    return new Response(
      JSON.stringify({
        error: String(error),
        message: 'Test suite execution failed',
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
