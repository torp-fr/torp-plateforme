import { createClient } from "@supabase/supabase-js";

// ========================================
// AUTHENTICATION VALIDATION
// ========================================

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Validate required environment variables for storage operations
if (!SUPABASE_URL) {
  throw new Error(
    "❌ FATAL: SUPABASE_URL environment variable is not set. " +
    "Worker cannot initialize Supabase client."
  );
}

if (!SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    "❌ FATAL: SUPABASE_SERVICE_ROLE_KEY environment variable is not set. " +
    "Worker requires SERVICE_ROLE_KEY to bypass RLS and download files from Storage. " +
    "Ensure this variable is provided in the deployment environment."
  );
}

console.log("[SUPABASE] ✅ SUPABASE_URL configured");
console.log("[SUPABASE] ✅ SUPABASE_SERVICE_ROLE_KEY configured (first 10 chars: " +
            SUPABASE_SERVICE_ROLE_KEY.substring(0, 10) + "...)");

export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY
);

console.log("[SUPABASE] ✅ Supabase client initialized with SERVICE_ROLE authentication");
