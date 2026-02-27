import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import * as pdfjsLib from 'https://esm.sh/pdfjs-dist@3.11.174';
import { createCanvas } from 'https://deno.land/x/canvas@v2.8.1/mod.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseKey);

const MAX_ATTEMPTS = 3;
const CHUNK_SIZE = 3000;
const EMBEDDING_BATCH_SIZE = 20;
const OCR_TEXT_THRESHOLD = 200; // Pages with < 200 chars get OCR
const PIPELINE_TIMEOUT_MS = 2.5 * 60 * 1000; // 2.5 minutes
const OCR_THROTTLE_MS = 200; // 200ms between OCR calls
const MAX_CONCURRENT_OCR = 5; // Max 5 concurrent OCR requests

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
      const processingStartTime = Date.now();
      const abortController = new AbortController();

      // Set timeout for entire pipeline (2.5 minutes)
      const timeoutHandle = setTimeout(() => {
        console.log('[PROCESS] Pipeline timeout reached, aborting');
        abortController.abort();
      }, PIPELINE_TIMEOUT_MS);

      try {
        extractedText = await extractPdfTextWithOCR(fileData, abortController);
      } finally {
        clearTimeout(timeoutHandle);
        const processingTime = Date.now() - processingStartTime;
        console.log(`[PROCESS] Text extracted: ${extractedText.length} chars in ${processingTime}ms`);
      }
    } else {
      extractedText = new TextDecoder().decode(await fileData.arrayBuffer());
    }

    console.log(`[PROCESS] Text extracted: ${extractedText.length} chars`);

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

/**
 * PHASE 1-4: Multi-page PDF processing with OCR support
 * - Extracts text page-by-page
 * - For pages with < 200 chars: renders to image and uses Google Vision OCR
 * - Implements throttling (200ms between calls), concurrency limits (5), and timeout control
 * - Memory-safe: processes sequentially, clears resources after each page
 */
async function extractPdfTextWithOCR(fileData: Blob, abortController: AbortController): Promise<string> {
  try {
    const arrayBuffer = await fileData.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

    const pdf = await pdfjsLib.getDocument(uint8Array).promise;
    console.log(`[PDF] Processing ${pdf.numPages} pages`);

    let finalText = '';
    const ocrQueue: Array<{ pageNum: number; pageText: string }> = [];
    let ocrTasksInFlight = 0;

    // Phase 1 & 4: Process pages sequentially to maintain memory safety
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      // Check abort signal
      if (abortController.signal.aborted) {
        console.log(`[PDF] Processing aborted at page ${pageNum}`);
        break;
      }

      try {
        const page = await pdf.getPage(pageNum);
        const content = await page.getTextContent();
        const pageText = content.items
          .map((item: any) => item.str || '')
          .join(' ')
          .trim();

        console.log(`[PDF] Page ${pageNum}: ${pageText.length} chars`);

        // Check if page needs OCR (less than threshold)
        if (pageText.length < OCR_TEXT_THRESHOLD && pageText.length > 0) {
          console.log(`[PDF] Page ${pageNum} below threshold, scheduling OCR`);
          ocrQueue.push({ pageNum, pageText });
        } else {
          finalText += pageText + '\n';
        }

        // Phase 4: Clear page resources
        page.cleanup?.();
      } catch (pageError) {
        console.error(`[PDF] Error processing page ${pageNum}: ${pageError}`);
      }
    }

    // Phase 2 & 3: Process OCR queue with throttling and concurrency control
    if (ocrQueue.length > 0) {
      console.log(`[OCR] Starting OCR for ${ocrQueue.length} pages with max ${MAX_CONCURRENT_OCR} concurrent tasks`);
      const ocrResults = await processOCRQueue(ocrQueue, fileData, pdf, uint8Array, abortController);
      finalText += ocrResults;
    }

    return finalText.trim();
  } catch (error) {
    console.error(`[PDF] Fatal extraction error: ${error}`);
    throw error;
  }
}

/**
 * Process OCR queue with proper concurrency control and throttling
 * Phase 2: Implements throttling (200ms between calls)
 * Phase 3: Implements timeout control via abortController
 * Max 5 concurrent OCR requests
 */
async function processOCRQueue(
  queue: Array<{ pageNum: number; pageText: string }>,
  fileData: Blob,
  pdf: any,
  uint8Array: Uint8Array,
  abortController: AbortController
): Promise<string> {
  let results = '';
  let inFlightCount = 0;
  let queueIndex = 0;
  const inFlightPromises: Promise<void>[] = [];

  // Helper to add task result
  const addResult = (pageNum: number, text: string, originalText: string) => {
    if (text && text.length > originalText.length) {
      results += text + '\n';
      console.log(`[OCR] Page ${pageNum}: OCR improved text to ${text.length} chars`);
    } else {
      results += originalText + '\n';
      console.log(`[OCR] Page ${pageNum}: Using original text (${originalText.length} chars)`);
    }
  };

  // Process queue with concurrency limit
  while (queueIndex < queue.length || inFlightCount > 0) {
    if (abortController.signal.aborted) {
      console.log('[OCR] Processing aborted');
      break;
    }

    // Start new tasks while under concurrency limit
    while (inFlightCount < MAX_CONCURRENT_OCR && queueIndex < queue.length) {
      const item = queue[queueIndex];
      queueIndex++;
      inFlightCount++;

      const taskPromise = (async () => {
        try {
          const ocrText = await performPageOCR(fileData, item.pageNum, uint8Array, pdf, abortController);
          addResult(item.pageNum, ocrText, item.pageText);
        } catch (error) {
          console.error(`[OCR] Error on page ${item.pageNum}: ${error}`);
          results += item.pageText + '\n';
        } finally {
          inFlightCount--;
        }
      })();

      inFlightPromises.push(taskPromise);

      // Phase 2: Throttle - 200ms between starting new OCR tasks
      if (queueIndex < queue.length && inFlightCount < MAX_CONCURRENT_OCR) {
        await new Promise(r => setTimeout(r, OCR_THROTTLE_MS));
      }
    }

    // Wait for at least one task to complete before starting new ones
    if (inFlightCount >= MAX_CONCURRENT_OCR && queueIndex < queue.length) {
      await Promise.race(inFlightPromises);
    }
  }

  // Wait for all remaining tasks to complete
  await Promise.all(inFlightPromises);

  return results;
}

/**
 * Render a single PDF page to image and send to Google Vision API
 * Phase 1: Render page to canvas
 * Phase 2: Convert to PNG base64
 * Phase 3: Send to Google Vision with DOCUMENT_TEXT_DETECTION
 */
async function performPageOCR(
  fileData: Blob,
  pageNum: number,
  uint8Array: Uint8Array,
  pdf: any,
  abortController: AbortController
): Promise<string> {
  const googleApiKey = Deno.env.get('GOOGLE_VISION_API_KEY');
  if (!googleApiKey) {
    console.log(`[OCR] Page ${pageNum}: Google Vision API key not configured`);
    return '';
  }

  try {
    // Render page to image
    const imageBase64 = await renderPageToImage(pdf, pageNum);
    if (!imageBase64) {
      console.log(`[OCR] Page ${pageNum}: Failed to render page to image`);
      return '';
    }

    // Send to Google Vision API with DOCUMENT_TEXT_DETECTION
    const response = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${googleApiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [
          {
            image: { content: imageBase64 },
            features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
          },
        ],
      }),
      signal: abortController.signal,
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`[OCR] Page ${pageNum} API error: ${response.status}`);
      return '';
    }

    const result = await response.json();
    const annotations = result.responses?.[0]?.fullTextAnnotation;
    const text = annotations?.text || '';

    if (text) {
      console.log(`[OCR] Page ${pageNum}: Extracted ${text.length} chars via Google Vision`);
    }

    return text;
  } catch (error) {
    console.error(`[OCR] Page ${pageNum} error: ${error}`);
    return '';
  }
}

/**
 * Render PDF page to PNG image (base64)
 * Uses canvas to convert PDF page to image
 */
async function renderPageToImage(pdf: any, pageNum: number): Promise<string> {
  try {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 2 }); // 2x scale for better OCR quality

    // Create canvas - use reasonable defaults (max 2000px width)
    const maxWidth = 2000;
    const scale = Math.min(1, maxWidth / viewport.width);
    const scaledViewport = page.getViewport({ scale: 2 * scale });

    const canvas = createCanvas(Math.ceil(scaledViewport.width), Math.ceil(scaledViewport.height));
    const context = canvas.getContext('2d');

    const renderContext = {
      canvasContext: context,
      viewport: scaledViewport,
    };

    await page.render(renderContext).promise;

    // Convert canvas to PNG base64
    const imageData = canvas.toDataURL('image/png');
    // Remove data:image/png;base64, prefix
    const base64 = imageData.replace(/^data:image\/png;base64,/, '');

    return base64;
  } catch (error) {
    console.error(`[RENDER] Page ${pageNum} render error: ${error}`);
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
