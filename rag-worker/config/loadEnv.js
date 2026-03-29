import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Resolve root of the monorepo (two levels up from rag-worker/config/)
const rootDir = path.resolve(__dirname, "../../");

// Load .env.local first (takes priority — local overrides)
dotenv.config({ path: path.join(rootDir, ".env.local") });

// Load .env as fallback (variables already set are not overwritten)
dotenv.config({ path: path.join(rootDir, ".env") });

console.log("[ENV] Environment variables loaded from", rootDir);

console.log("[ENV] SUPABASE_URL:", process.env.SUPABASE_URL ? "✅ loaded" : "❌ missing");
console.log("[ENV] SUPABASE_SERVICE_ROLE_KEY:", process.env.SUPABASE_SERVICE_ROLE_KEY ? "✅ loaded" : "❌ missing");
console.log("[ENV] OPENAI_API_KEY:", process.env.OPENAI_API_KEY ? "✅ loaded" : "❌ missing");

if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
  console.log("[ENV] GOOGLE_SERVICE_ACCOUNT_JSON: ✅ loaded (Google Vision OCR enabled)");
} else {
  console.warn("[ENV] GOOGLE_SERVICE_ACCOUNT_JSON: ⚠️ not set (Google OCR disabled)");
}
