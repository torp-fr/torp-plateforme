import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

// Constants matching backend pipeline
const KNOWLEDGE_STORAGE_BUCKET = "documents";
const MAX_ATTEMPTS = 3;
const PIPELINE_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  // Only accept POST requests
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
    // Parse request body (from database trigger)
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

    console.log(
      `[rag-ingestion] 🚀 Starting ingestion pipeline for document: ${documentId}`
    );

    // Get environment variables
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      console.error(
        "[rag-ingestion] ❌ Missing required environment variables"
      );
      return new Response(
        JSON.stringify({
          error: "Server configuration error: missing environment variables",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Create Supabase client with service role key
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Attempt to claim and process the document
    // Step 1: Fetch and validate document
    console.log(`[rag-ingestion] Fetching document: ${documentId}`);
    const { data: doc, error: fetchError } = await supabase
      .from("knowledge_documents")
      .select("id, ingestion_status, ingestion_attempts")
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

    // Check if document is in valid state (pending)
    if (doc.ingestion_status !== "pending") {
      console.log(
        `[rag-ingestion] ⚠️ Document already processing or completed: ${doc.ingestion_status}`
      );
      return new Response(
        JSON.stringify({
          status: "already_processing",
          documentId,
          message: `Document is already ${doc.ingestion_status}`,
        }),
        {
          status: 202,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check retry limit
    if ((doc.ingestion_attempts || 0) >= MAX_ATTEMPTS) {
      console.error(
        `[rag-ingestion] ❌ Max retry attempts exceeded for document: ${documentId}`
      );
      return new Response(
        JSON.stringify({ error: "Max retry attempts exceeded" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Step 2: Claim document for processing (atomic update)
    console.log(`[rag-ingestion] Claiming document for processing`);
    const { data: claimedDoc, error: claimError } = await supabase
      .from("knowledge_documents")
      .update({
        ingestion_status: "processing",
        ingestion_attempts: (doc.ingestion_attempts || 0) + 1,
        processing_started_at: new Date().toISOString(),
        pipeline_timeout_at: new Date(Date.now() + PIPELINE_TIMEOUT_MS).toISOString(),
      })
      .eq("id", documentId)
      .eq("ingestion_status", "pending")
      .select()
      .single();

    if (claimError || !claimedDoc) {
      console.log(`[rag-ingestion] ⚠️ Failed to claim document (race condition)`);
      return new Response(
        JSON.stringify({
          status: "conflict",
          documentId,
          message: "Document is being processed by another worker",
        }),
        {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`[rag-ingestion] ✅ Document claimed successfully`);

    // Step 3: Launch async ingestion (fire-and-forget)
    // This runs in the background and doesn't block the response
    launchIngestionAsync(supabase, documentId).catch((err) => {
      console.error(`[rag-ingestion] ❌ Background ingestion failed: ${err.message}`);
    });

    // Return immediately indicating ingestion has been triggered
    return new Response(
      JSON.stringify({
        status: "ingestion_queued",
        documentId,
        message: "Document ingestion queued for processing",
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

/**
 * Launch async ingestion in the background
 * This is intentionally separate from the main request handler
 * so we can return a 202 Accepted response immediately
 */
async function launchIngestionAsync(
  supabase: ReturnType<typeof createClient>,
  documentId: string
): Promise<void> {
  try {
    console.log(`[rag-ingestion:async] Starting ingestion for: ${documentId}`);

    // Fetch full document
    const { data: doc, error: fetchError } = await supabase
      .from("knowledge_documents")
      .select("*")
      .eq("id", documentId)
      .single();

    if (fetchError || !doc) {
      throw new Error(`Document fetch failed: ${fetchError?.message}`);
    }

    // If content not yet extracted, extract from storage
    if (!doc.sanitized_content && !doc.content && doc.file_path) {
      console.log(`[rag-ingestion:async] Extracting content from: ${doc.file_path}`);

      // Update status to EXTRACTING
      await supabase
        .from("knowledge_documents")
        .update({ ingestion_status: "extracting", ingestion_progress: 20 })
        .eq("id", documentId);

      // Download file from storage
      const { data: fileBlob, error: downloadError } = await supabase.storage
        .from(KNOWLEDGE_STORAGE_BUCKET)
        .download(doc.file_path);

      if (downloadError || !fileBlob) {
        throw new Error(
          `Storage download failed: ${downloadError?.message ?? "no data returned"}`
        );
      }

      // For now, mark as requiring manual extraction
      // A full implementation would include extraction logic here
      console.log(
        `[rag-ingestion:async] ⚠️ File downloaded but extraction not yet implemented in Edge Function`
      );

      await supabase
        .from("knowledge_documents")
        .update({
          last_ingestion_error: "Edge Function extraction not yet implemented",
          ingestion_status: "failed",
        })
        .eq("id", documentId);

      console.log(
        `[rag-ingestion:async] ℹ️ Document extraction should be handled by backend service`
      );
      return;
    }

    // If content exists, mark as ready for chunking
    console.log(
      `[rag-ingestion:async] ✅ Content available for chunking (length: ${(doc.content || doc.sanitized_content)?.length ?? 0})`
    );

    // Update to chunking status
    await supabase
      .from("knowledge_documents")
      .update({ ingestion_status: "chunking", ingestion_progress: 40 })
      .eq("id", documentId);

    console.log(
      `[rag-ingestion:async] ℹ️ Document moved to chunking status - backend service should continue from here`
    );
  } catch (err) {
    const errorMessage =
      err instanceof Error ? err.message : JSON.stringify(err);

    console.error(`[rag-ingestion:async] ❌ Error: ${errorMessage}`);

    // Mark document as failed
    try {
      await supabase
        .from("knowledge_documents")
        .update({
          ingestion_status: "failed",
          last_ingestion_error: errorMessage,
        })
        .eq("id", documentId);
    } catch (updateErr) {
      console.error(`[rag-ingestion:async] ❌ Failed to mark document as failed:`, updateErr);
    }
  }
}
