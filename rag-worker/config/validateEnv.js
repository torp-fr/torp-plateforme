const required = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "OPENAI_API_KEY",
];

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`❌ Missing required environment variable: ${key}`);
  }
}

if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
  console.error("[ENV] ERROR: GOOGLE_SERVICE_ACCOUNT_JSON is not set — scanned PDFs will fail with 'No extractable text' and be marked failed");
}

console.log("[ENV] Environment validation passed");
