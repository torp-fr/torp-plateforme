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

  const requestBody: Record<string, unknown> = {
    model: model || "text-embedding-3-small",
    input: inputArray,
  };

  // Pass dimensions only when explicitly requested (text-embedding-3-small supports this)
  if (typeof dimensions === "number" && dimensions > 0) {
    requestBody.dimensions = dimensions;
  }

  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errText = await response.text();
    return new Response(
      JSON.stringify({ error: `OpenAI error: ${errText}` }),
      {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const json = await response.json();

  // OpenAI returns data[] sorted by index — safe to map directly
  const embeddings: number[][] = json.data.map(
    (item: { embedding: number[] }) => item.embedding
  );

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
});
