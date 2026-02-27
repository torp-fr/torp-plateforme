import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import * as pdfjsLib from 'https://esm.sh/pdfjs-dist@3.11.174';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseKey);

const MAX_ATTEMPTS = 3;
const CHUNK_SIZE = 3000;
const EMBEDDING_BATCH_SIZE = 20;
const OCR_TEXT_THRESHOLD = 1000;
const PIPELINE_TIMEOUT_MS = 3 * 60 * 1000; // 3 minutes

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const { documentId } = await req.json();

    if (!documentId) {
      return new Response(
        JSON.stringify({ error: 'documentId required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[RAG-INGESTION] Starting for document ${documentId}`);

    // Claim document for processing
    const claimed = await claimDocument(documentId);
    if (!claimed) {
      console.log(`[RAG-INGESTION] Could not claim document ${documentId}`);
      return new Response(
        JSON.stringify({ error: 'Document not available or max retries exceeded' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Process the document
    await processDocument(claimed);

    return new Response(
      JSON.stringify({ success: true, documentId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[RAG-INGESTION] Error:', error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function claimDocument(documentId: string) {
  // Fetch current document
  const { data: currentDoc, error: fetchError } = await supabase
    .from('knowledge_documents')
    .select('ingestion_attempts, ingestion_status')
    .eq('id', documentId)
    .single();

  if (fetchError || !currentDoc) {
    throw new Error(`Document not found: ${fetchError?.message}`);
  }

  if (currentDoc.ingestion_status !== 'pending') {
    console.log(`Document not pending: ${currentDoc.ingestion_status}`);
    return null;
  }

  if (currentDoc.ingestion_attempts >= MAX_ATTEMPTS) {
    await markFailed(documentId, 'Max retry attempts exceeded');
    return null;
  }

  // Claim document
  const { data: claimed, error: claimError } = await supabase
    .from('knowledge_documents')
    .update({
      ingestion_status: 'processing',
      ingestion_attempts: (currentDoc.ingestion_attempts || 0) + 1,
      processing_started_at: new Date().toISOString(),
      pipeline_timeout_at: new Date(Date.now() + PIPELINE_TIMEOUT_MS).toISOString(),
    })
    .eq('id', documentId)
    .eq('ingestion_status', 'pending')
    .select()
    .single();

  if (claimError || !claimed) {
    console.log('Document already claimed by another process');
    return null;
  }

  console.log(`[CLAIM] Document claimed: ${documentId}`);
  return claimed;
}

async function processDocument(doc: any) {
  try {
    console.log(`[PROCESS] Starting ingestion for ${doc.id}`);

    // Step 1: Download file from storage
    const filePath = doc.file_path;
    if (!filePath) {
      throw new Error('No file_path in document record');
    }

    console.log(`[PROCESS] Downloading file from storage: ${filePath}`);
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('knowledge-files')
      .download(filePath);

    if (downloadError || !fileData) {
      throw new Error(`Failed to download file: ${downloadError?.message}`);
    }

    // Step 2: Extract text from file (PDF or plain text)
    console.log(`[PROCESS] Extracting text from file (${doc.mime_type})`);
    let extractedText = '';

    if (doc.mime_type === 'application/pdf' || filePath.endsWith('.pdf')) {
      extractedText = await extractPdfText(fileData);
    } else {
      extractedText = new TextDecoder().decode(await fileData.arrayBuffer());
    }

    console.log(`[PROCESS] Text extracted: ${extractedText.length} chars`);

    // Step 3: If text too short, try OCR
    if (extractedText.length < OCR_TEXT_THRESHOLD) {
      console.log(`[PROCESS] Text too short (${extractedText.length} chars) - attempting OCR`);
      const ocrText = await tryOCR(fileData);
      if (ocrText && ocrText.length > extractedText.length) {
        extractedText = ocrText;
        console.log(`[PROCESS] OCR successful: ${extractedText.length} chars`);
      }
    }

    if (!extractedText || extractedText.trim().length === 0) {
      throw new Error('Failed to extract text from document (no text content found)');
    }

    // Step 4: Chunk the text
    const chunks = chunkText(extractedText, CHUNK_SIZE);
    console.log(`[PROCESS] Generated ${chunks.length} chunks`);

    // Step 5: Generate embeddings and insert chunks
    await processEmbeddingsInBatches(doc.id, chunks);

    // Step 6: Mark as completed
    await markCompleted(doc.id);

    console.log(`[PROCESS] ✅ Document ${doc.id} ingestion complete`);
  } catch (error) {
    console.error(`[PROCESS] Error: ${error}`);
    await markFailed(doc.id, String(error));
    throw error;
  }
}

async function extractPdfText(fileData: Blob): Promise<string> {
  try {
    const arrayBuffer = await fileData.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    // Use pdfjs-dist to extract text
    pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

    const pdf = await pdfjsLib.getDocument(uint8Array).promise;
    let textContent = '';

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item: any) => item.str || '')
        .join(' ');
      textContent += pageText + '\n';
    }

    return textContent.trim();
  } catch (error) {
    console.error(`[PDF] Extraction error: ${error}`);
    return '';
  }
}

async function tryOCR(fileData: Blob): Promise<string> {
  try {
    const googleApiKey = Deno.env.get('GOOGLE_VISION_API_KEY');
    if (!googleApiKey) {
      console.log('[OCR] Google Vision API key not configured');
      return '';
    }

    // Convert to base64 for Google Vision API
    const arrayBuffer = await fileData.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

    const response = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${googleApiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [
          {
            image: { content: base64 },
            features: [
              { type: 'DOCUMENT_TEXT_DETECTION' },
              { type: 'TEXT_DETECTION' },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`[OCR] API error: ${response.status} - ${error}`);
      return '';
    }

    const result = await response.json();
    const annotations = result.responses?.[0]?.fullTextAnnotation;
    const text = annotations?.text || '';

    if (text) {
      console.log(`[OCR] Successfully extracted ${text.length} chars via Google Vision`);
    }

    return text;
  } catch (error) {
    console.error(`[OCR] Error: ${error}`);
    return '';
  }
}

function chunkText(text: string, chunkSize: number): string[] {
  const chunks: string[] = [];

  for (let i = 0; i < text.length; i += chunkSize) {
    const chunk = text.slice(i, i + chunkSize).trim();
    if (chunk.length >= 30) { // Skip very small chunks
      chunks.push(chunk);
    }
  }

  return chunks;
}

async function processEmbeddingsInBatches(documentId: string, chunks: string[]) {
  console.log(`[EMBEDDING] Processing ${chunks.length} chunks`);

  const openaiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiKey) {
    throw new Error('OPENAI_API_KEY environment variable not configured');
  }

  for (let i = 0; i < chunks.length; i += EMBEDDING_BATCH_SIZE) {
    const batch = chunks.slice(i, i + EMBEDDING_BATCH_SIZE);

    // Generate embeddings for this batch via OpenAI API
    const embeddings = await generateEmbeddingsBatch(batch, openaiKey);

    const embeddingData = batch.map((chunk, idx) => ({
      document_id: documentId,
      content: chunk,
      embedding: embeddings[idx] || null, // Vector array for pgvector
      token_count: Math.ceil(chunk.length / 4),
      chunk_index: i + idx,
      embedding_generated_at: new Date().toISOString(),
    }));

    // Insert chunks
    const { error } = await supabase
      .from('knowledge_chunks')
      .insert(embeddingData);

    if (error) {
      throw new Error(`Failed to insert chunks: ${error.message}`);
    }

    console.log(`[EMBEDDING] Inserted batch ${Math.floor(i / EMBEDDING_BATCH_SIZE) + 1}/${Math.ceil(chunks.length / EMBEDDING_BATCH_SIZE)}`);
  }
}

async function generateEmbeddingsBatch(texts: string[], openaiKey: string): Promise<(number[] | null)[]> {
  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: texts,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }

    const result = await response.json();

    // OpenAI returns embeddings in order
    const embeddings = result.data
      .sort((a: any, b: any) => a.index - b.index)
      .map((item: any) => item.embedding);

    console.log(`[EMBEDDING] Generated ${embeddings.length} embeddings`);
    return embeddings;
  } catch (error) {
    console.error(`[EMBEDDING] Error generating embeddings: ${error}`);
    throw error;
  }
}

async function markCompleted(documentId: string) {
  const { error } = await supabase
    .from('knowledge_documents')
    .update({
      ingestion_status: 'completed',
      ingestion_completed_at: new Date().toISOString(),
      pipeline_timeout_at: null,
      ingestion_progress: 100,
    })
    .eq('id', documentId);

  if (error) {
    console.error(`[MARK_COMPLETED] Error: ${error.message}`);
  } else {
    console.log(`[MARK_COMPLETED] Document ${documentId} completed`);
  }
}

async function markFailed(documentId: string, errorMessage: string) {
  const { error } = await supabase
    .from('knowledge_documents')
    .update({
      ingestion_status: 'failed',
      last_ingestion_error: JSON.stringify({
        reason: 'INGESTION_ERROR',
        message: errorMessage,
        timestamp: new Date().toISOString(),
      }),
      pipeline_timeout_at: null,
    })
    .eq('id', documentId);

  if (error) {
    console.error(`[MARK_FAILED] Error: ${error.message}`);
  } else {
    console.log(`[MARK_FAILED] Document ${documentId} marked as failed`);
  }
}
