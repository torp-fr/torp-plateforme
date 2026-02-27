/**
 * Generate Embedding Edge Function
 * Centralized through ai-client.ts for usage tracking
 * All API calls go through generateEmbedding() function
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { generateEmbedding } from "../_shared/ai-client.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Missing auth" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { text, model } = await req.json();
  if (!text) {
    return new Response(JSON.stringify({ error: "No text" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY");

    // Create Supabase client for usage tracking
    let supabaseClient = null;
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (supabaseUrl && supabaseKey) {
        supabaseClient = createClient(supabaseUrl, supabaseKey);
      }
    } catch (err) {
      console.warn("[Embeddings] Could not create Supabase client:", err);
    }

    // ============================================
    // ALL API CALLS GO THROUGH ai-client.ts
    // ============================================
    const result = await generateEmbedding(
      text,
      OPENAI_KEY,
      model || "text-embedding-3-small",
      {
        sessionId: crypto.randomUUID(),
        supabaseClient
      }
    );

    return new Response(
      JSON.stringify({
        embedding: result.embedding,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[Embeddings] Error:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
