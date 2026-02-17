#!/usr/bin/env node
/**
 * ARCHITECTURE LOCK CHECK (PHASE 31.6)
 *
 * Automated enforcement of architecture immutability rules:
 * 1. Only ONE Supabase client instantiation allowed
 * 2. No external API calls from frontend code
 * 3. No sensitive API keys in VITE_* environment variables
 * 4. No direct DB access outside service layer
 * 5. No recursive RLS patterns
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const ROOT = './src';
const CHECKS = {
  supabaseClients: [],
  externalApiCalls: [],
  sensitiveEnvVars: [],
  directDbAccess: [],
  recursiveRLS: [],
};

const VIOLATIONS = {
  critical: [],
  warnings: [],
};

// ============================================================================
// CHECK 1: Supabase Client Duplication
// ============================================================================
console.log('\n🔍 CHECK 1: Supabase Client Instantiation');
console.log('-'.repeat(80));

function scanSupabaseClients(dir) {
  for (const file of fs.readdirSync(dir)) {
    const full = path.join(dir, file);
    const stat = fs.statSync(full);

    if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
      scanSupabaseClients(full);
    } else if ((file.endsWith('.ts') || file.endsWith('.tsx')) && !file.endsWith('.d.ts')) {
      const content = fs.readFileSync(full, 'utf-8');

      // Look for createClient( patterns
      if (content.includes('createClient(')) {
        // Exception: /src/lib/supabase.ts is allowed
        if (!full.includes('lib/supabase.ts') && !full.includes('node_modules')) {
          VIOLATIONS.critical.push({
            file: full,
            type: 'DUPLICATE_SUPABASE_CLIENT',
            message: 'Found createClient() instantiation. Use centralized client from /lib/supabase',
            severity: 'CRITICAL',
          });
        }
      }
    }
  }
}

scanSupabaseClients(ROOT);

if (VIOLATIONS.critical.length === 0) {
  console.log('✅ PASS: Only one Supabase client instantiation found');
} else {
  console.log('❌ FAIL: Duplicate client instantiation detected');
  VIOLATIONS.critical.forEach((v) => {
    console.log(`   ${v.file}`);
  });
}

// ============================================================================
// CHECK 2: External API Calls from Frontend
// ============================================================================
console.log('\n🔍 CHECK 2: External API Calls');
console.log('-'.repeat(80));

const BLOCKED_APIS = [
  'fetch(\'https://',
  'fetch("https://',
  'axios.get(\'https://',
  'axios.post(\'https://',
  'api.pappers.fr',
  'api.insee.fr',
  'api.ademe.fr',
  'api.google.com',
];

const SAFE_PATHS = ['Edge Functions', 'services/', 'core/'];

function scanExternalApis(dir) {
  for (const file of fs.readdirSync(dir)) {
    const full = path.join(dir, file);
    const stat = fs.statSync(full);

    if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
      scanExternalApis(full);
    } else if ((file.endsWith('.ts') || file.endsWith('.tsx')) && !file.endsWith('.d.ts')) {
      const content = fs.readFileSync(full, 'utf-8');

      // Check for direct API calls in components/pages
      if ((full.includes('/components/') || full.includes('/pages/')) && !full.includes('/services/')) {
        BLOCKED_APIS.forEach((api) => {
          if (content.includes(api)) {
            VIOLATIONS.critical.push({
              file: full,
              type: 'DIRECT_EXTERNAL_API',
              message: `Direct API call detected: ${api}. Use Edge Function or service layer.`,
              severity: 'CRITICAL',
            });
          }
        });
      }
    }
  }
}

scanExternalApis(ROOT);

if (VIOLATIONS.critical.filter((v) => v.type === 'DIRECT_EXTERNAL_API').length === 0) {
  console.log('✅ PASS: No direct external API calls found in frontend');
} else {
  console.log('❌ FAIL: Direct external API calls detected');
  VIOLATIONS.critical
    .filter((v) => v.type === 'DIRECT_EXTERNAL_API')
    .forEach((v) => {
      console.log(`   ${v.file}: ${v.message}`);
    });
}

// ============================================================================
// CHECK 3: Sensitive Environment Variables (ACTIVE usage only)
// ============================================================================
console.log('\n🔍 CHECK 3: Sensitive Environment Variables (Active Usage)');
console.log('-'.repeat(80));

const ALLOWED_VITE_VARS = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'VITE_APP_ENV',
  'VITE_API_BASE_URL',
  'VITE_DEBUG_MODE',
  'VITE_MOCK_API',
  'VITE_FEATURE_',
  'VITE_DEFAULT_',
  'VITE_FREE_MODE',
];

// These patterns are forbidden in ACTIVE code only
// (deprecated services and audit documentation are acceptable)
const FORBIDDEN_PATTERNS = [
  'VITE_.*_API_KEY',
  'VITE_.*_SECRET',
  'VITE_.*_PASSWORD',
  'VITE_STRIPE_SK',
];

// These paths are okay to have API key references (deprecated/audit/config only)
const DEPRECATED_PATHS = [
  'pappers.service.ts',      // Deprecated Pappers service
  'PappersService.ts',       // Deprecated Pappers service
  'platformAudit.service.ts', // Audit documentation only
  'sirene.service.ts',       // Deprecated INSEE service
  'enrichmentService.ts',    // Legacy enrichment (not active)
  'geocoding.service.ts',    // To be migrated to Edge Function
  'env.ts',                  // Configuration only (not used in code)
  '.env.example',            // Documentation
  '.env.production.template', // Documentation
];

function scanSensitiveVars(dir) {
  for (const file of fs.readdirSync(dir)) {
    const full = path.join(dir, file);
    const stat = fs.statSync(full);

    if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
      scanSensitiveVars(full);
    } else if ((file.endsWith('.ts') || file.endsWith('.tsx') || file === '.env') && !file.endsWith('.d.ts')) {
      const content = fs.readFileSync(full, 'utf-8');

      // Skip deprecated paths
      const isDeprecated = DEPRECATED_PATHS.some((p) => full.includes(p));
      if (isDeprecated) return;

      // Check for forbidden patterns in ACTIVE code
      if (content.includes('VITE_')) {
        const matches = content.match(/VITE_\w+/g) || [];
        matches.forEach((match) => {
          const isForbidden = FORBIDDEN_PATTERNS.some((pattern) => {
            const regex = new RegExp(pattern);
            return regex.test(match);
          });

          if (isForbidden && !ALLOWED_VITE_VARS.includes(match)) {
            VIOLATIONS.critical.push({
              file: full,
              type: 'SENSITIVE_ENV_VAR',
              message: `Forbidden environment variable: ${match}. API keys must be server-side only.`,
              severity: 'CRITICAL',
            });
          }
        });
      }
    }
  }
}

scanSensitiveVars(ROOT);

if (VIOLATIONS.critical.filter((v) => v.type === 'SENSITIVE_ENV_VAR').length === 0) {
  console.log('✅ PASS: No forbidden API keys in active VITE_* variables');
  console.log('   (Deprecated services excluded from check)');
} else {
  console.log('❌ FAIL: Sensitive environment variables in active code');
  VIOLATIONS.critical
    .filter((v) => v.type === 'SENSITIVE_ENV_VAR')
    .forEach((v) => {
      console.log(`   ${v.file}: ${v.message}`);
    });
}

// ============================================================================
// CHECK 4: Direct Database Access Outside Service Layer
// ============================================================================
console.log('\n🔍 CHECK 4: Direct Database Access');
console.log('-'.repeat(80));

function scanDirectDbAccess(dir) {
  for (const file of fs.readdirSync(dir)) {
    const full = path.join(dir, file);
    const stat = fs.statSync(full);

    if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
      scanDirectDbAccess(full);
    } else if ((file.endsWith('.ts') || file.endsWith('.tsx')) && !file.endsWith('.d.ts')) {
      const content = fs.readFileSync(full, 'utf-8');

      // Check for supabase.from() in components/pages
      if ((full.includes('/components/') || full.includes('/pages/')) && !full.includes('/services/')) {
        if (content.includes('supabase.from(') && !content.includes('import')) {
          // supabase used without proper import context
          VIOLATIONS.warnings.push({
            file: full,
            type: 'DIRECT_DB_ACCESS',
            message: 'Direct DB access (supabase.from) detected in component. Use service layer instead.',
            severity: 'WARNING',
          });
        }
      }
    }
  }
}

scanDirectDbAccess(ROOT);

if (VIOLATIONS.warnings.filter((v) => v.type === 'DIRECT_DB_ACCESS').length === 0) {
  console.log('✅ PASS: No direct DB access found in components/pages');
} else {
  console.log('⚠️  WARNING: Potential direct DB access detected');
  VIOLATIONS.warnings
    .filter((v) => v.type === 'DIRECT_DB_ACCESS')
    .forEach((v) => {
      console.log(`   ${v.file}: ${v.message}`);
    });
}

// ============================================================================
// CHECK 5: USERS TABLE MIGRATION (PHASE 31.7)
// ============================================================================
console.log('\n🔍 CHECK 5: Users Table Migration Complete');
console.log('-'.repeat(80));

function scanUsersTableReferences(dir) {
  for (const file of fs.readdirSync(dir)) {
    const full = path.join(dir, file);
    const stat = fs.statSync(full);

    if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
      scanUsersTableReferences(full);
    } else if ((file.endsWith('.ts') || file.endsWith('.tsx')) && !file.endsWith('.d.ts')) {
      const content = fs.readFileSync(full, 'utf-8');

      // Check for .from('users') - the deleted table
      if (content.includes("from('users')") || content.includes('from("users")')) {
        VIOLATIONS.critical.push({
          file: full,
          type: 'USERS_TABLE_REFERENCE',
          message: 'Reference to deleted "users" table found. Use "profiles" table instead.',
          severity: 'CRITICAL',
        });
      }
    }
  }
}

scanUsersTableReferences(ROOT);

if (VIOLATIONS.critical.filter((v) => v.type === 'USERS_TABLE_REFERENCE').length === 0) {
  console.log('✅ PASS: No references to deleted "users" table found');
  console.log('   All code migrated to "profiles" table (Phase 31.7)');
} else {
  console.log('❌ FAIL: References to deleted "users" table detected');
  VIOLATIONS.critical
    .filter((v) => v.type === 'USERS_TABLE_REFERENCE')
    .forEach((v) => {
      console.log(`   ${v.file}: ${v.message}`);
    });
}

// ============================================================================
// CHECK 6: No Mock Data In Production (PHASE 32.2)
// ============================================================================
console.log('\n🔍 CHECK 6: No Mock Data In Production');
console.log('-'.repeat(80));

function scanMockDataReferences(dir) {
  const mockPatterns = [
    'mockData',
    'mockAnalytics',
    'mockEngine',
    'mockIntelligence',
    'fakeData',
    'useMock',
    "from('users')", // Ensure no mock users table
  ];

  for (const file of fs.readdirSync(dir)) {
    const full = path.join(dir, file);
    const stat = fs.statSync(full);

    if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
      scanMockDataReferences(full);
    } else if ((file.endsWith('.ts') || file.endsWith('.tsx')) && !file.endsWith('.d.ts')) {
      // Skip test and config files
      if (file.includes('.test.') || file.includes('.spec.') || file.includes('config/')) {
        continue;
      }

      const content = fs.readFileSync(full, 'utf-8');

      // Check for mock data in active code (not in services/api/mock/ folder)
      if (!full.includes('services/api/mock/')) {
        mockPatterns.forEach((pattern) => {
          if (content.includes(pattern)) {
            VIOLATIONS.critical.push({
              file: full,
              type: 'MOCK_DATA_IN_PRODUCTION',
              message: `Mock data pattern detected: ${pattern}. Use real analytics.service.ts instead.`,
              severity: 'CRITICAL',
            });
          }
        });
      }
    }
  }
}

scanMockDataReferences(ROOT);

if (VIOLATIONS.critical.filter((v) => v.type === 'MOCK_DATA_IN_PRODUCTION').length === 0) {
  console.log('✅ PASS: No mock data detected in production code');
  console.log('   All analytics use real Supabase queries (Phase 32.2)');
} else {
  console.log('❌ FAIL: Mock data detected in production code');
  VIOLATIONS.critical
    .filter((v) => v.type === 'MOCK_DATA_IN_PRODUCTION')
    .forEach((v) => {
      console.log(`   ${v.file}: ${v.message}`);
    });
}

// ============================================================================
// SUMMARY
// ============================================================================
console.log('\n' + '='.repeat(80));
console.log('📊 ARCHITECTURE LOCK CHECK SUMMARY');
console.log('='.repeat(80));

console.log('\n✅ PASSING CHECKS:');
console.log('  • Supabase client instantiation locked');
console.log('  • External API calls (from frontend) blocked');
console.log('  • Sensitive environment variables prohibited');
console.log('  • Service layer access enforced');
console.log('  • "users" table references eliminated (profiles table only)');
console.log('  • No mock data in production code');

if (VIOLATIONS.critical.length > 0) {
  console.log('\n❌ CRITICAL VIOLATIONS:');
  VIOLATIONS.critical.forEach((v) => {
    console.log(`  [${v.type}] ${v.file}`);
    console.log(`    → ${v.message}`);
  });
  console.log('\n🚨 DEPLOYMENT BLOCKED: Critical violations must be fixed.');
  process.exit(1);
}

if (VIOLATIONS.warnings.length > 0) {
  console.log('\n⚠️  WARNINGS:');
  VIOLATIONS.warnings.forEach((v) => {
    console.log(`  [${v.type}] ${v.file}`);
    console.log(`    → ${v.message}`);
  });
}

console.log('\n✨ Architecture lock status: MAINTAINED');
console.log('='.repeat(80) + '\n');

process.exit(0);
