import "jsr:@supabase/functions-js/edge-runtime.d.ts";

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

  const body = await req.json();

  // Support all request shapes:
  //   Batch (preferred) : { inputs: string[], model?, dimensions? }
  //   Batch (legacy)    : { texts: string[], model?, dimensions? }
  //   Single (legacy)   : { text: string, model?, dimensions? }
  const { inputs, text, texts, model, dimensions } = body;

  // Resolve input array — inputs > texts > text (single)
  const inputArray: string[] = Array.isArray(inputs)
    ? inputs
    : Array.isArray(texts)
    ? texts
    : typeof text === "string" && text.length > 0
    ? [text]
    : [];

  console.log("[EMBEDDING] Received", inputArray.length, "raw inputs");

  // =========================================================================
  // INPUT SANITIZATION: Remove nulls, trim, filter empty
  // =========================================================================
  const cleanedInputs = inputArray
    .map((t) => (t || "").trim())
    .filter((t) => t.length > 0);

  console.log("[EMBEDDING] After sanitization:", cleanedInputs.length, "valid inputs");

  if (cleanedInputs.length === 0) {
    console.warn("[EMBEDDING] No valid inputs after sanitization");
    return new Response(
      JSON.stringify({ embeddings: [] }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // OpenAI allows up to 2048 inputs per request; enforce a safe server-side cap
  const MAX_BATCH = 100;
  if (cleanedInputs.length > MAX_BATCH) {
    console.warn("[EMBEDDING] Batch size", cleanedInputs.length, "exceeds MAX_BATCH of", MAX_BATCH);
    return new Response(
      JSON.stringify({ error: `Batch size exceeds limit of ${MAX_BATCH}` }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  // =========================================================================
  // TEXT LENGTH LIMIT: OpenAI cannot handle extremely long inputs
  // =========================================================================
  const MAX_TEXT_LENGTH = 8000;
  const safeInputs = cleanedInputs.map((t) => {
    if (t.length > MAX_TEXT_LENGTH) {
      console.warn("[EMBEDDING] Truncating text from", t.length, "to", MAX_TEXT_LENGTH, "characters");
      return t.slice(0, MAX_TEXT_LENGTH);
    }
    return t;
  });

  console.log("[EMBEDDING] After length limiting: all texts <= ", MAX_TEXT_LENGTH, "chars");

  const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY");
  if (!OPENAI_KEY) {
    return new Response(
      JSON.stringify({ error: "OPENAI_API_KEY is not configured on this function" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    console.log("[EMBEDDING] Generating embeddings for", safeInputs.length, "texts");
    console.log("[EMBEDDING] Model: text-embedding-3-small");
    console.log("[EMBEDDING] Requested dimensions:", dimensions || "default (1536)");

    // Build OpenAI request - only use parameters that OpenAI accepts
    const requestBody: any = {
      model: "text-embedding-3-small",
      input: safeInputs,
    };

    // Include dimensions if specified (text-embedding-3-small supports 256-1536)
    if (dimensions && typeof dimensions === "number" && dimensions > 0) {
      requestBody.dimensions = dimensions;
      console.log("[EMBEDDING] Including dimensions parameter:", dimensions);
    }

    console.log("[EMBEDDING] OpenAI request body:", JSON.stringify(requestBody, null, 2));

    // Call OpenAI embeddings API
    console.log("[EMBEDDING] Calling OpenAI embeddings API...");
    let response;
    try {
      response = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });
    } catch (fetchErr) {
      console.error("[EMBEDDING] Network error calling OpenAI:", fetchErr);
      throw new Error(`Network error: ${fetchErr instanceof Error ? fetchErr.message : String(fetchErr)}`);
    }

    console.log("[EMBEDDING] OpenAI response status:", response.status);
    console.log("[EMBEDDING] OpenAI response headers:", Array.from(response.headers.entries()));

    // Handle non-OK responses
    if (!response.ok) {
      let errText = "";
      try {
        errText = await response.text();
      } catch (textErr) {
        errText = `(failed to read error text: ${textErr})`;
      }
      console.error("[EMBEDDING] ❌ OpenAI returned error status:", response.status);
      console.error("[EMBEDDING] ❌ OpenAI error response body:", errText);

      // Return 200 with error detail instead of crashing with 502
      return new Response(
        JSON.stringify({
          error: "OPENAI_ERROR",
          status: response.status,
          message: errText,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Parse JSON response
    let json;
    try {
      json = await response.json();
      console.log("[EMBEDDING] ✅ OpenAI response parsed successfully");
    } catch (parseErr) {
      console.error("[EMBEDDING] ❌ Failed to parse OpenAI response as JSON:", parseErr);
      console.error("[EMBEDDING] Response text:", await response.text());
      throw new Error(`JSON parse error: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`);
    }

    // Validate response structure
    if (!json || !json.data || !Array.isArray(json.data)) {
      console.error("[EMBEDDING] ❌ Invalid OpenAI response structure");
      console.error("[EMBEDDING] Response:", JSON.stringify(json, null, 2));
      throw new Error("Invalid OpenAI response: missing data array");
    }

    console.log("[EMBEDDING] OpenAI returned", json.data.length, "embeddings");

    // Extract embeddings from OpenAI response
    // OpenAI returns { data: [{ embedding: number[] }, ...], usage: {...} }
    let embeddings: number[][];
    try {
      embeddings = json.data.map(
        (item: { embedding: number[] }) => item.embedding
      );
      console.log("[EMBEDDING] ✅ Successfully extracted embeddings");
      console.log("[EMBEDDING] First embedding dimensions:", embeddings[0]?.length || "N/A");
      console.log("[EMBEDDING] All embeddings valid:", embeddings.every(e => Array.isArray(e) && e.length > 0));
    } catch (mapErr) {
      console.error("[EMBEDDING] ❌ Failed to extract embeddings:", mapErr);
      throw new Error(`Embedding extraction error: ${mapErr instanceof Error ? mapErr.message : String(mapErr)}`);
    }

    // =========================================================================
    // PROTECT AGAINST EMPTY RESPONSE: Pad with null if OpenAI returns fewer
    // =========================================================================
    if (embeddings.length < safeInputs.length) {
      console.warn("[EMBEDDING] ⚠️  OpenAI returned", embeddings.length, "embeddings but we sent", safeInputs.length, "inputs");
      console.warn("[EMBEDDING] Padding with null values...");
      while (embeddings.length < safeInputs.length) {
        embeddings.push(null as any);
      }
      console.log("[EMBEDDING] ✅ Padded embeddings array to", embeddings.length);
    }

    // ── Fire-and-forget cost tracking ──────────────────────────────────────
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (supabaseUrl && supabaseKey && json.usage?.total_tokens) {
      const tokensUsed = json.usage.total_tokens as number;
      const costUsd    = (tokensUsed / 1_000) * 0.00002; // text-embedding-3-small: $0.02/1M tokens
      fetch(`${supabaseUrl}/rest/v1/api_costs`, {
        method: "POST",
        headers: {
          "Content-Type":  "application/json",
          "apikey":        supabaseKey,
          "Authorization": `Bearer ${supabaseKey}`,
          "Prefer":        "return=minimal",
        },
        body: JSON.stringify({
          api_name:    "openai-text-embedding-3-small",
          cost_usd:    costUsd,
          metrics:     { tokens_used: tokensUsed },
          recorded_at: new Date().toISOString(),
        }),
      }).catch((e: unknown) => console.error("[CostTrack] generate-embedding:", e));
    }

    // Batch callers (inputs or texts) get { embeddings: number[][] }.
    // Single-text legacy callers get { embedding: number[] }.
    if (Array.isArray(inputs) || Array.isArray(texts)) {
      console.log("[EMBEDDING] ✅ Returning batch response with", embeddings.length, "embeddings");
      return new Response(JSON.stringify({ embeddings }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[EMBEDDING] ✅ Returning single embedding response");
    return new Response(JSON.stringify({ embedding: embeddings[0] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[EMBEDDING] ❌ CAUGHT EXCEPTION");
    console.error("[EMBEDDING] Error type:", error?.constructor?.name);
    console.error("[EMBEDDING] Error message:", error instanceof Error ? error.message : String(error));
    console.error("[EMBEDDING] Error string:", String(error));
    console.error("[EMBEDDING] Full error object:", error);
    if (error instanceof Error) {
      console.error("[EMBEDDING] Stack trace:", error.stack);
    }

    // Return 200 with error detail instead of crashing with 500
    return new Response(
      JSON.stringify({
        error: "EMBEDDING_ERROR",
        message: error instanceof Error ? error.message : String(error),
        type: error?.constructor?.name || "Unknown",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
