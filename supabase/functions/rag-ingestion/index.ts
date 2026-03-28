import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Only POST method is allowed" }),
      {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  try {
    const body = await req.json();
    const { documentId } = body;

    if (!documentId || typeof documentId !== "string") {
      return new Response(
        JSON.stringify({ error: "Missing or invalid documentId" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`[rag-ingestion] 📥 Trigger received for document: ${documentId}`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("[rag-ingestion] ❌ Missing environment variables");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Validate the document exists and is still pending.
    // Do NOT claim it here — claiming would block knowledgeStepRunner (frontend)
    // and rag-worker from processing it, since both require status='pending' to claim.
    // Ingestion is handled by: knowledgeStepRunner (browser) or rag-worker (Node.js).
    const { data: doc, error: fetchError } = await supabase
      .from("knowledge_documents")
      .select("id, ingestion_status")
      .eq("id", documentId)
      .single();

    if (fetchError || !doc) {
      console.error(`[rag-ingestion] ❌ Document not found: ${fetchError?.message}`);
      return new Response(
        JSON.stringify({ error: "Document not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(
      `[rag-ingestion] ✅ Document ${documentId} is ${doc.ingestion_status} — ingestion delegated to worker`
    );

    return new Response(
      JSON.stringify({
        status: "acknowledged",
        documentId,
        ingestion_status: doc.ingestion_status,
        message: "Trigger acknowledged. Document will be processed by knowledgeStepRunner or rag-worker.",
      }),
      {
        status: 202,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    const errorMessage =
      err instanceof Error ? err.message : JSON.stringify(err);

    console.error(`[rag-ingestion] ❌ Error: ${errorMessage}`);

    return new Response(
      JSON.stringify({ error: "Internal server error", details: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
