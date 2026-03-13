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

  if (inputArray.length === 0) {
    return new Response(
      JSON.stringify({ error: "inputs must be an array of strings" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // OpenAI allows up to 2048 inputs per request; enforce a safe server-side cap
  const MAX_BATCH = 100;
  if (inputArray.length > MAX_BATCH) {
    return new Response(
      JSON.stringify({ error: `Batch size exceeds limit of ${MAX_BATCH}` }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY");
  if (!OPENAI_KEY) {
    return new Response(
      JSON.stringify({ error: "OPENAI_API_KEY is not configured on this function" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    console.log("[EMBEDDING] Generating embeddings for", inputArray.length, "texts");
    console.log("[EMBEDDING] Model:", model || "text-embedding-3-small");

    // Build OpenAI request - only use parameters that OpenAI accepts
    // CRITICAL: Do NOT pass dimensions unless explicitly supported by the model
    const requestBody = {
      model: "text-embedding-3-small",
      input: inputArray,
    };

    console.log("[EMBEDDING] OpenAI request body:", JSON.stringify(requestBody, null, 2));

    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    console.log("[EMBEDDING] OpenAI response status:", response.status);

    if (!response.ok) {
      const errText = await response.text();
      console.error("[EMBEDDING] OpenAI error response:", errText);
      return new Response(
        JSON.stringify({ error: `OpenAI error: ${errText}` }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const json = await response.json();
    console.log("[EMBEDDING] OpenAI returned", json.data?.length || 0, "embeddings");

    // Extract embeddings from OpenAI response
    // OpenAI returns { data: [{ embedding: number[] }, ...], usage: {...} }
    const embeddings: number[][] = json.data.map(
      (item: { embedding: number[] }) => item.embedding
    );

    console.log("[EMBEDDING] Successfully extracted embeddings");
    console.log("[EMBEDDING] First embedding dimensions:", embeddings[0]?.length || "N/A");

    // Batch callers (inputs or texts) get { embeddings: number[][] }.
    // Single-text legacy callers get { embedding: number[] }.
    if (Array.isArray(inputs) || Array.isArray(texts)) {
      return new Response(JSON.stringify({ embeddings }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ embedding: embeddings[0] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[EMBEDDING] Unexpected error:", error);
    console.error("[EMBEDDING] Error type:", error?.constructor?.name);
    console.error("[EMBEDDING] Error message:", error instanceof Error ? error.message : String(error));
    console.error("[EMBEDDING] Stack:", error instanceof Error ? error.stack : "N/A");

    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
