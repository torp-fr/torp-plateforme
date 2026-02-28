async uploadDocumentForServerIngestion(
  file: File,
  options: {
    title?: string;
    category: string;
    source: 'internal' | 'external' | 'official';
  }
) {
  const timestamp = Date.now();
  const storagePath = `knowledge-documents/${timestamp}-${file.name}`;

  // 1️⃣ Upload file to storage
  const { error: uploadError } = await supabase.storage
    .from('knowledge-files')
    .upload(storagePath, file, { upsert: false });

  if (uploadError) {
    throw new Error(`Storage upload failed: ${uploadError.message}`);
  }

  // 2️⃣ Insert DB record
  const { data: doc, error: insertError } = await supabase
    .from('knowledge_documents')
    .insert({
      title: options.title || file.name,
      category: options.category,
      source: options.source,
      file_path: storagePath,
      file_size: file.size,
      mime_type: file.type,
      ingestion_status: 'pending',
      ingestion_progress: 0,
      is_active: true,
    })
    .select()
    .single();

  if (insertError || !doc) {
    throw new Error(`Database insert failed: ${insertError?.message}`);
  }

  // 3️⃣ Trigger Edge Function
  const { error: invokeError } = await supabase.functions.invoke(
    'rag-ingestion',
    {
      body: { documentId: doc.id },
    }
  );

  if (invokeError) {
    console.error("Edge invoke error:", invokeError);
  }

  return doc;
}
