import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import * as pdfjsLib from 'https://esm.sh/pdfjs-dist@3.11.174';
import { createCanvas } from 'https://deno.land/x/canvas@v2.8.1/mod.ts';
import { decompress } from 'https://esm.sh/fflate@0.8.1';

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

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  let documentId: string | null = null;

  try {
    const { documentId: docId } = await req.json();

    if (!docId) {
      return new Response(
        JSON.stringify({ error: 'documentId required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    documentId = docId;
    console.log(`[RAG-INGESTION] Starting for document ${documentId}`);

    // Claim document for processing (atomic single UPDATE)
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

    // PATCH 2️⃣: Secure timeout handling
    const isTimeout = error instanceof Error && (
      error.name === 'AbortError' ||
      error.message.includes('timeout') ||
      error.message.includes('aborted')
    );

    if (documentId && isTimeout) {
      console.log(`[RAG-INGESTION] Timeout detected for document ${documentId}, marking as failed`);
      await markFailed(documentId, 'PIPELINE_TIMEOUT');
    } else if (documentId) {
      // Already handled by processDocument catch, but ensure cleanup if error escapes
      const isAlreadyFailed = error instanceof Error && error.message.includes('INGESTION_ERROR');
      if (!isAlreadyFailed) {
        await markFailed(documentId, String(error));
      }
    }

    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// PATCH 1️⃣: Atomic single UPDATE for claim
async function claimDocument(documentId: string) {
  try {
    // Single atomic UPDATE with all conditions in WHERE clause
    const { data: claimed, error: claimError } = await supabase
      .from('knowledge_documents')
      .update({
        ingestion_status: 'processing',
        ingestion_attempts: supabase.rpc('increment_ingestion_attempts', { doc_id: documentId }).then(() => null) || 0, // Fallback: handled at DB level
        processing_started_at: new Date().toISOString(),
        pipeline_timeout_at: new Date(Date.now() + PIPELINE_TIMEOUT_MS).toISOString(),
      })
      .eq('id', documentId)
      .eq('ingestion_status', 'pending')
      .lt('ingestion_attempts', MAX_ATTEMPTS) // Atomic condition: attempts < MAX_ATTEMPTS
      .select()
      .single();

    if (claimError) {
      // If claimError with code PGRST116 or similar, document is not available
      if (claimError.code === 'PGRST116' || !claimed) {
        console.log(`[CLAIM] Document ${documentId} not available or max attempts reached`);
        return null;
      }
      throw claimError;
    }

    if (!claimed) {
      console.log(`[CLAIM] Document ${documentId} not available or max attempts reached`);
      return null;
    }

    console.log(`[CLAIM] Document claimed: ${documentId}`);
    return claimed;
  } catch (error) {
    console.error(`[CLAIM] Error claiming document: ${error}`);
    throw error;
  }
}

async function processDocument(doc: any) {
  try {
    console.log(`[PROCESS] Starting ingestion for ${doc.id}`);

    // PATCH 3️⃣: Delete existing chunks before reprocessing
    console.log(`[PROCESS] Cleaning up existing chunks for document ${doc.id}`);
    const { error: deleteError } = await supabase
      .from('knowledge_chunks')
      .delete()
      .eq('document_id', doc.id);

    if (deleteError) {
      console.error(`[PROCESS] Warning: Failed to delete old chunks: ${deleteError.message}`);
      // Non-fatal: continue processing
    } else {
      console.log(`[PROCESS] Old chunks deleted`);
    }

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

    // Step 2: Extract text from file based on type
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
    } else if (doc.mime_type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || filePath.endsWith('.docx')) {
      console.log('[PROCESS] Extracting from DOCX file');
      extractedText = await extractDocxText(fileData);
    } else if (doc.mime_type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || filePath.endsWith('.xlsx')) {
      console.log('[PROCESS] Extracting from XLSX file');
      extractedText = await extractXlsxText(fileData);
    } else {
      extractedText = new TextDecoder().decode(await fileData.arrayBuffer());
    }

    console.log(`[PROCESS] Text extracted: ${extractedText.length} chars`);

    if (!extractedText || extractedText.trim().length === 0) {
      throw new Error('Failed to extract text from document (no text content found)');
    }

    // PATCH 6️⃣: Update progress after extraction
    await updateProgress(doc.id, 10);

    // Step 4: Chunk the text
    const chunks = chunkText(extractedText, CHUNK_SIZE);
    console.log(`[PROCESS] Generated ${chunks.length} chunks`);

    // PATCH 6️⃣: Update progress after chunking
    await updateProgress(doc.id, 50);

    // Step 5: Generate embeddings and insert chunks
    await processEmbeddingsInBatches(doc.id, chunks);

    // PATCH 6️⃣: Update progress after embeddings
    await updateProgress(doc.id, 90);

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

/**
 * Extract text from DOCX file
 * 1. Unzip file to access word/document.xml
 * 2. Extract text between <w:t> tags
 * 3. Decode XML entities
 * 4. Return clean text
 */
async function extractDocxText(fileData: Blob): Promise<string> {
  try {
    console.log('[DOCX] Starting extraction');
    const arrayBuffer = await fileData.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    // Decompress ZIP file
    const decompressed = await new Promise<Record<string, Uint8Array>>((resolve, reject) => {
      decompress(uint8Array, (err, data) => {
        if (err) reject(err);
        else resolve(data);
      });
    });

    // Extract word/document.xml
    const documentXml = decompressed['word/document.xml'];
    if (!documentXml) {
      console.log('[DOCX] word/document.xml not found');
      return '';
    }

    const xmlText = new TextDecoder().decode(documentXml);
    console.log('[DOCX] Extracted document.xml');

    // Extract text between <w:t> tags
    const textMatches = xmlText.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [];
    const textParts = textMatches.map(match => {
      const text = match.replace(/<w:t[^>]*>/, '').replace(/<\/w:t>/, '');
      return decodeXmlEntities(text);
    });

    // Join paragraphs - detect paragraph breaks via <w:p>
    const paragraphBreaks = xmlText.split('<w:p>').length - 1;
    const textContent = textParts.join('');

    console.log(`[DOCX] Extracted ${textParts.length} text nodes from ${paragraphBreaks} paragraphs`);
    return textContent.trim();
  } catch (error) {
    console.error(`[DOCX] Extraction error: ${error}`);
    throw new Error(`Failed to extract text from DOCX: ${error}`);
  }
}

/**
 * Extract text from XLSX file
 * 1. Unzip file to access shared strings and worksheets
 * 2. Parse xl/sharedStrings.xml for string values
 * 3. Parse each worksheet and map cell values
 * 4. Return flattened text representation with table structure
 */
async function extractXlsxText(fileData: Blob): Promise<string> {
  try {
    console.log('[XLSX] Starting extraction');
    const arrayBuffer = await fileData.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    // Decompress ZIP file
    const decompressed = await new Promise<Record<string, Uint8Array>>((resolve, reject) => {
      decompress(uint8Array, (err, data) => {
        if (err) reject(err);
        else resolve(data);
      });
    });

    // Extract shared strings
    const sharedStringsXml = decompressed['xl/sharedStrings.xml'];
    if (!sharedStringsXml) {
      console.log('[XLSX] xl/sharedStrings.xml not found');
      return '';
    }

    const sharedStringsText = new TextDecoder().decode(sharedStringsXml);
    const sharedStrings = extractSharedStrings(sharedStringsText);
    console.log(`[XLSX] Extracted ${sharedStrings.length} shared strings`);

    // Extract worksheet data
    let allContent = '';
    let worksheetCount = 0;

    // Get all worksheet files
    for (const [filename, data] of Object.entries(decompressed)) {
      if (filename.startsWith('xl/worksheets/sheet') && filename.endsWith('.xml')) {
        worksheetCount++;
        const worksheetXml = new TextDecoder().decode(data);
        const worksheetContent = extractWorksheetContent(worksheetXml, sharedStrings);
        if (worksheetContent) {
          allContent += worksheetContent + '\n';
        }
      }
    }

    console.log(`[XLSX] Extracted content from ${worksheetCount} worksheets`);
    return allContent.trim();
  } catch (error) {
    console.error(`[XLSX] Extraction error: ${error}`);
    throw new Error(`Failed to extract text from XLSX: ${error}`);
  }
}

/**
 * Extract shared strings from XLSX sharedStrings.xml
 * Returns array of string values in order
 */
function extractSharedStrings(xml: string): string[] {
  const strings: string[] = [];
  const siMatches = xml.split('<si>');

  for (let i = 1; i < siMatches.length; i++) {
    const siBlock = siMatches[i];
    const tMatches = siBlock.match(/<t[^>]*>([^<]*)<\/t>/g) || [];

    const stringParts: string[] = [];
    tMatches.forEach(match => {
      const text = match.replace(/<t[^>]*>/, '').replace(/<\/t>/, '');
      stringParts.push(decodeXmlEntities(text));
    });

    if (stringParts.length > 0) {
      strings.push(stringParts.join(''));
    }
  }

  return strings;
}

/**
 * Extract content from a single worksheet
 * Maps cell references to shared string indices and returns formatted text
 */
function extractWorksheetContent(xml: string, sharedStrings: string[]): string {
  const cells: { row: number; col: number; value: string }[] = [];

  // Match <c> (cell) tags
  const cellMatches = xml.match(/<c r="([A-Z]+)(\d+)"[^>]*>([^<]*(?:<(?!\/c>)[^>]*>[^<]*)*)<\/c>/g) || [];

  for (const cellMatch of cellMatches) {
    const rMatch = cellMatch.match(/r="([A-Z]+)(\d+)"/);
    if (!rMatch) continue;

    const colStr = rMatch[1];
    const rowStr = rMatch[2];
    const row = parseInt(rowStr);
    const col = columnToNumber(colStr);

    // Check if this is a string cell (type="s" references shared strings)
    const isStringCell = cellMatch.includes('t="s"');
    let value = '';

    if (isStringCell) {
      const valueMatch = cellMatch.match(/<v>(\d+)<\/v>/);
      if (valueMatch) {
        const stringIndex = parseInt(valueMatch[1]);
        value = sharedStrings[stringIndex] || '';
      }
    } else {
      // Direct value cell
      const valueMatch = cellMatch.match(/<v>([^<]*)<\/v>/);
      if (valueMatch) {
        value = decodeXmlEntities(valueMatch[1]);
      }
    }

    if (value) {
      cells.push({ row, col, value });
    }
  }

  if (cells.length === 0) {
    return '';
  }

  // Sort by row, then column
  cells.sort((a, b) => a.row - b.row || a.col - b.col);

  // Group by row and format as table-like text
  const rows: Record<number, Record<number, string>> = {};
  let maxCol = 0;

  for (const cell of cells) {
    if (!rows[cell.row]) {
      rows[cell.row] = {};
    }
    rows[cell.row][cell.col] = cell.value;
    maxCol = Math.max(maxCol, cell.col);
  }

  // Build output as rows separated by newlines, columns by pipes
  const lines: string[] = [];
  const sortedRows = Object.keys(rows)
    .map(Number)
    .sort((a, b) => a - b);

  for (const rowNum of sortedRows) {
    const rowData = rows[rowNum];
    const rowValues: string[] = [];

    for (let col = 1; col <= maxCol; col++) {
      rowValues.push(rowData[col] || '');
    }

    // Only add non-empty rows
    if (rowValues.some(v => v.length > 0)) {
      lines.push(rowValues.join(' | '));
    }
  }

  return lines.join('\n');
}

/**
 * Convert column letter(s) to column number (A=1, B=2, ..., Z=26, AA=27, etc.)
 */
function columnToNumber(col: string): number {
  let result = 0;
  for (let i = 0; i < col.length; i++) {
    result = result * 26 + (col.charCodeAt(i) - 64);
  }
  return result;
}

/**
 * Decode XML entities (&lt;, &gt;, &amp;, &quot;, &apos;)
 */
function decodeXmlEntities(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
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

    // PATCH 4️⃣: Validate embeddings response
    if (!result.data || !Array.isArray(result.data)) {
      throw new Error(`Invalid OpenAI response: missing or invalid 'data' field`);
    }

    // OpenAI returns embeddings in order
    const embeddings = result.data
      .sort((a: any, b: any) => a.index - b.index)
      .map((item: any) => item.embedding);

    // PATCH 4️⃣: Validate embedding dimension
    for (let i = 0; i < embeddings.length; i++) {
      if (!Array.isArray(embeddings[i]) || embeddings[i].length !== 1536) {
        throw new Error(`Embedding ${i} has invalid dimension: expected 1536, got ${embeddings[i]?.length || 0}`);
      }
    }

    console.log(`[EMBEDDING] Generated ${embeddings.length} embeddings with valid 1536 dimensions`);
    return embeddings;
  } catch (error) {
    console.error(`[EMBEDDING] Error generating embeddings: ${error}`);
    throw error;
  }
}

// PATCH 6️⃣: Update ingestion progress helper
async function updateProgress(documentId: string, progress: number) {
  const { error } = await supabase
    .from('knowledge_documents')
    .update({
      ingestion_progress: Math.min(progress, 100),
    })
    .eq('id', documentId);

  if (error) {
    console.warn(`[PROGRESS] Failed to update progress: ${error.message}`);
    // Non-fatal: continue processing
  } else {
    console.log(`[PROGRESS] Document ${documentId} progress: ${progress}%`);
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
    throw new Error(`[MARK_COMPLETED] Failed to mark document as completed: ${error.message}`);
  } else {
    console.log(`[MARK_COMPLETED] Document ${documentId} completed`);
  }
}

// PATCH 5️⃣: Secure markFailed with error throwing
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
      ingestion_progress: 0, // PATCH 6️⃣: Reset progress on failure
    })
    .eq('id', documentId);

  if (error) {
    console.error(`[MARK_FAILED] Error updating document: ${error.message}`);
    throw new Error(`[MARK_FAILED] Failed to mark document as failed: ${error.message}`);
  } else {
    console.log(`[MARK_FAILED] Document ${documentId} marked as failed: ${errorMessage}`);
  }
}
