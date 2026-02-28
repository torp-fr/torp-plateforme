import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

Deno.serve(async (req) => {
  try {
    // SECURITY: Verify Authorization header for server-to-server calls
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.error("❌ Unauthorized: missing Authorization header");
      return new Response(
        JSON.stringify({ error: "Unauthorized: missing Authorization header" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    const providedToken = authHeader.substring(7);
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!serviceRoleKey || providedToken !== serviceRoleKey) {
      console.error("❌ Unauthorized: invalid token");
      return new Response(
        JSON.stringify({ error: "Unauthorized: invalid token" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log("✅ Authorization verified (service role)");

    if (req.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    const { documentId } = await req.json();

    console.log("🚀 RAG ingestion started for:", documentId);

    const { data: claimed } = await supabase
      .from("knowledge_documents")
      .update({
        ingestion_status: "processing",
        ingestion_progress: 10,
      })
      .eq("id", documentId)
      .eq("ingestion_status", "pending")
      .select()
      .single();

    if (!claimed) {
      console.log("⚠️ Already processing or invalid document");
      return new Response("Skipped", { status: 200 });
    }

    await new Promise((r) => setTimeout(r, 1500));

    await supabase.from("knowledge_chunks").insert({
      document_id: documentId,
      content: "Test chunk from ingestion",
      embedding: Array(1536).fill(0),
    });

    await supabase
      .from("knowledge_documents")
      .update({
        ingestion_status: "completed",
        ingestion_progress: 100,
      })
      .eq("id", documentId);

    console.log("✅ RAG ingestion completed");

    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("❌ RAG ingestion error:", error);
    return new Response("Error", { status: 500 });
  }
});
