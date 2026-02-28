import { supabase } from "@/integrations/supabase/client";

export class KnowledgeBrainService {
  async uploadDocumentForServerIngestion(
    file: File,
    options: {
      title?: string;
      category: string;
      source: "internal" | "external" | "official";
    }
  ) {
    try {
      console.log("📤 Starting upload process");

      const timestamp = Date.now();
      const storagePath = `knowledge-documents/${timestamp}-${file.name}`;

      // 1️⃣ Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from("knowledge-files")
        .upload(storagePath, file, { upsert: false });

      if (uploadError) {
        throw new Error(`Storage upload failed: ${uploadError.message}`);
      }

      console.log("✅ File uploaded to storage");

      // 2️⃣ Insert DB record
      const { data: doc, error: insertError } = await supabase
        .from("knowledge_documents")
        .insert({
          title: options.title || file.name,
          category: options.category,
          source: options.source,
          file_path: storagePath,
          file_size: file.size,
          mime_type: file.type,
          ingestion_status: "pending",
          ingestion_progress: 0,
          is_active: true,
        })
        .select()
        .single();

      if (insertError || !doc) {
        throw new Error(
          `Database insert failed: ${insertError?.message}`
        );
      }

      console.log("✅ Document inserted in DB:", doc.id);

      // 3️⃣ Invoke Edge Function
      console.log("🔥 ABOUT TO CALL EDGE:", doc.id);

      const { data, error } = await supabase.functions.invoke(
        "rag-ingestion",
        {
          body: { documentId: doc.id },
        }
      );

      console.log("🔥 EDGE RESPONSE:", data, error);

      if (error) {
        console.error("❌ Edge invoke error:", error);
      }

      return doc;
    } catch (error: any) {
      console.error("❌ Upload error:", error);
      throw error;
    }
  }
}

export const knowledgeBrainService = new KnowledgeBrainService();
