import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
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

  const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY");
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: model || "text-embedding-3-small",
      input: text,
    }),
  });

  const json = await response.json();
  return new Response(
    JSON.stringify({
      embedding: json.data[0].embedding,
    }),
    {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
});
