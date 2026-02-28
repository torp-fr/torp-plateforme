/**
 * Edge Function: prepare-chunks
 * Phase 41: Intelligent Text Chunking and Preparation
 *
 * Responsibilities:
 * 1. Verify ingestion_jobs.status = 'analyzed'
 * 2. Extract full text from document
 * 3. Clean text: remove headers/footers, normalize whitespace, remove boilerplate
 * 4. Detect sections based on numbered headings (1., 1.1, etc.)
 * 5. Create intelligent chunks (800-1200 tokens target)
 * 6. Compute SHA256 hash per chunk
 * 7. Insert into ingestion_chunks_preview
 * 8. Update ingestion_jobs.status = 'chunk_preview_ready'
 * 9. Abort if job.status = 'cancelled'
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { countTokens } from '../_shared/token-counter.ts';

// ============================================================
// TYPES
// ============================================================

interface PrepareChunksRequest {
  job_id: string; // UUID of ingestion_job
}

interface TextSection {
  title: string;           // Section heading (e.g., "1.2.3")
  level: number;           // Nesting level
  start_page: number;
  end_page: number;
  content: string;
}

interface ChunkData {
  chunk_number: number;
  start_page: number;
  end_page: number;
  section_title: string | null;
  content: string;
  estimated_tokens: number;
  content_hash: string;
  requires_ocr: boolean;
  ocr_pages: string[];
}

// ============================================================
// CONSTANTS
// ============================================================

const TARGET_TOKENS_MIN = 800;
const TARGET_TOKENS_MAX = 1200;
const MODEL_FOR_COUNTING = 'claude-3-5-sonnet-20241022';

// Common header/footer patterns to remove
const HEADER_FOOTER_PATTERNS = [
  /^(Page|p\.|pp\.)\s*\d+\s*$/gm,
  /^\d+\s*$/gm,
  /^(Chapter|Section|Part)\s+\d+/gm,
  /^(Table of Contents|Index|Glossary)/gm,
  /^\s*-{3,}\s*$/gm,
  /^\s*_{3,}\s*$/gm,
];

// Section heading pattern (1., 1.1, 1.1.1, etc.)
const SECTION_HEADING_PATTERN = /^(\d+(?:\.\d+)*)\s+(.+)$/;

// ============================================================
// HELPER: Error Response
// ============================================================

function errorResponse(message: string, status: number = 400) {
  return new Response(
    JSON.stringify({ error: message }),
    {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    }
  );
}

// ============================================================
// HELPER: Success Response
// ============================================================

function successResponse(data: any) {
  return new Response(
    JSON.stringify({ success: true, data }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    }
  );
}

// ============================================================
// HELPER: Load File from Storage
// ============================================================

async function loadFileFromStorage(
  supabase: any,
  filePath: string
): Promise<ArrayBuffer> {
  console.log(`[PREPARE-CHUNKS] Loading file from storage: ${filePath}`);

  try {
    const { data, error } = await supabase.storage
      .from('documents')
      .download(filePath);

    if (error) {
      throw new Error(`Storage download error: ${error.message}`);
    }

    if (!data) {
      throw new Error('No data returned from storage');
    }

    return await data.arrayBuffer();
  } catch (err) {
    console.error('[PREPARE-CHUNKS] Storage load error:', err);
    throw err;
  }
}

// ============================================================
// HELPER: Extract Text from PDF
// ============================================================

async function extractTextFromPDF(
  buffer: ArrayBuffer
): Promise<{ text: string; pages: Array<{ number: number; hasText: boolean }> }> {
  console.log('[PREPARE-CHUNKS] Extracting text from PDF');

  const pdfjsLib = await import('https://esm.sh/pdfjs-dist@4.0.0');
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
  const pageCount = pdf.numPages;

  let fullText = '';
  const pages = [];

  for (let i = 1; i <= pageCount; i++) {
    try {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items.map((item: any) => item.str || '').join(' ');

      pages.push({
        number: i,
        hasText: pageText.trim().length > 50 // Consider page has text if >50 chars
      });

      fullText += `\n\n[PAGE ${i}]\n${pageText}`;

      console.log(`[PREPARE-CHUNKS] Page ${i}: ${pageText.length} chars`);
    } catch (err) {
      console.warn(`[PREPARE-CHUNKS] Error extracting page ${i}:`, err);
      pages.push({ number: i, hasText: false });
    }
  }

  return { text: fullText, pages };
}

// ============================================================
// HELPER: Clean Text
// ============================================================

function cleanText(text: string): string {
  console.log('[PREPARE-CHUNKS] Cleaning text');

  let cleaned = text;

  // Remove page markers
  cleaned = cleaned.replace(/\[PAGE \d+\]\n/g, '');

  // Remove header/footer patterns
  HEADER_FOOTER_PATTERNS.forEach(pattern => {
    cleaned = cleaned.replace(pattern, '');
  });

  // Normalize whitespace: multiple spaces to single space
  cleaned = cleaned.replace(/  +/g, ' ');

  // Remove empty lines with just spaces
  cleaned = cleaned.replace(/^\s*$/gm, '');

  // Remove multiple consecutive newlines (keep max 2)
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

  // Trim leading/trailing whitespace
  cleaned = cleaned.trim();

  return cleaned;
}

// ============================================================
// HELPER: Detect Sections from Numbered Headings
// ============================================================

function detectSections(text: string): TextSection[] {
  console.log('[PREPARE-CHUNKS] Detecting sections');

  const sections: TextSection[] = [];
  const lines = text.split('\n');

  let currentSection: Partial<TextSection> | null = null;
  let sectionContent = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(SECTION_HEADING_PATTERN);

    if (match) {
      // Found a section heading
      const heading = match[1]; // e.g., "1.2.3"
      const title = match[2].trim();
      const level = heading.split('.').length;

      // Save previous section
      if (currentSection) {
        sections.push({
          ...currentSection,
          content: sectionContent.trim(),
          end_page: currentSection.start_page || 0
        } as TextSection);
      }

      // Start new section
      currentSection = {
        title: heading,
        level,
        start_page: 0 // Will be set during chunking
      };
      sectionContent = title + '\n';
    } else if (currentSection) {
      sectionContent += line + '\n';
    }
  }

  // Save last section
  if (currentSection && sectionContent.trim()) {
    sections.push({
      ...currentSection,
      content: sectionContent.trim(),
      end_page: 0
    } as TextSection);
  }

  console.log(`[PREPARE-CHUNKS] Detected ${sections.length} sections`);
  return sections;
}

// ============================================================
// HELPER: Compute SHA256 Hash
// ============================================================

async function computeContentHash(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

// ============================================================
// HELPER: Estimate Tokens
// ============================================================

function estimateTokens(content: string): number {
  // Rough estimate: ~1 token per 4 characters for English text
  // This is a local estimate; actual tokens counted after embedding
  const estimatedTokens = Math.ceil(content.length / 4);
  return Math.max(1, estimatedTokens); // At least 1 token
}

// ============================================================
// HELPER: Create Intelligent Chunks
// ============================================================

async function createIntelligentChunks(
  text: string,
  pages: Array<{ number: number; hasText: boolean }>
): Promise<ChunkData[]> {
  console.log('[PREPARE-CHUNKS] Creating intelligent chunks');

  const chunks: ChunkData[] = [];
  const lines = text.split('\n').filter(line => line.trim());

  let currentChunk = '';
  let currentSectionTitle: string | null = null;
  let startPage = 1;
  let chunkNumber = 0;
  let ocrPages: Set<string> = new Set();

  for (const line of lines) {
    const match = line.match(SECTION_HEADING_PATTERN);

    if (match) {
      // Found section heading
      currentSectionTitle = match[1]; // Store heading number

      // If current chunk is substantial, save it before starting new section
      const estimatedTokens = estimateTokens(currentChunk);
      if (estimatedTokens > TARGET_TOKENS_MIN && currentChunk.trim()) {
        chunks.push(await finalizeChunk(
          currentChunk,
          chunkNumber++,
          startPage,
          startPage,
          currentSectionTitle,
          ocrPages
        ));
        currentChunk = '';
        ocrPages = new Set();
      }

      // Add section heading to new chunk
      currentChunk = line + '\n';
    } else {
      // Regular content line
      currentChunk += line + '\n';

      // Check if chunk is getting too large
      const estimatedTokens = estimateTokens(currentChunk);
      if (estimatedTokens > TARGET_TOKENS_MAX) {
        // Save current chunk
        chunks.push(await finalizeChunk(
          currentChunk,
          chunkNumber++,
          startPage,
          startPage,
          currentSectionTitle,
          ocrPages
        ));
        currentChunk = '';
        ocrPages = new Set();
      }
    }
  }

  // Save remaining chunk
  if (currentChunk.trim()) {
    chunks.push(await finalizeChunk(
      currentChunk,
      chunkNumber++,
      startPage,
      startPage,
      currentSectionTitle,
      ocrPages
    ));
  }

  console.log(`[PREPARE-CHUNKS] Created ${chunks.length} chunks`);
  return chunks;
}

// ============================================================
// HELPER: Finalize Chunk (compute hash, estimate tokens, etc.)
// ============================================================

async function finalizeChunk(
  content: string,
  chunkNumber: number,
  startPage: number,
  endPage: number,
  sectionTitle: string | null,
  ocrPages: Set<string>
): Promise<ChunkData> {
  const contentHash = await computeContentHash(content);
  const estimatedTokens = estimateTokens(content);

  return {
    chunk_number: chunkNumber,
    start_page: startPage,
    end_page: endPage,
    section_title: sectionTitle,
    content: content.trim(),
    estimated_tokens: estimatedTokens,
    content_hash: contentHash,
    requires_ocr: ocrPages.size > 0,
    ocr_pages: Array.from(ocrPages)
  };
}

// ============================================================
// MAIN HANDLER
// ============================================================

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const startTime = Date.now();

  try {
    console.log('[PREPARE-CHUNKS] Starting chunk preparation');

    // ============================================================
    // 1. PARSE REQUEST
    // ============================================================

    const { job_id } = (await req.json()) as PrepareChunksRequest;

    if (!job_id || typeof job_id !== 'string') {
      return errorResponse('Missing or invalid job_id parameter');
    }

    console.log(`[PREPARE-CHUNKS] Processing job: ${job_id}`);

    // ============================================================
    // 2. CREATE SUPABASE CLIENT
    // ============================================================

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      return errorResponse('Missing Supabase configuration', 500);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ============================================================
    // 3. FETCH INGESTION JOB
    // ============================================================

    const { data: job, error: jobError } = await supabase
      .from('ingestion_jobs')
      .select('*')
      .eq('id', job_id)
      .single();

    if (jobError || !job) {
      return errorResponse(`Job not found: ${jobError?.message || 'unknown error'}`, 404);
    }

    console.log('[PREPARE-CHUNKS] Job loaded:', {
      id: job.id,
      status: job.status,
      file_path: job.file_path
    });

    // ============================================================
    // 4. VERIFY JOB STATUS = 'analyzed'
    // ============================================================

    if (job.status === 'cancelled') {
      console.log('[PREPARE-CHUNKS] Job is cancelled - aborting');
      return errorResponse('Job has been cancelled', 400);
    }

    if (job.status !== 'analyzed') {
      return errorResponse(
        `Job status must be 'analyzed' but is '${job.status}'`,
        400
      );
    }

    // ============================================================
    // 5. LOAD FILE FROM STORAGE
    // ============================================================

    let fileBuffer: ArrayBuffer;
    try {
      fileBuffer = await loadFileFromStorage(supabase, job.file_path);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown storage error';
      console.error('[PREPARE-CHUNKS] Failed to load file:', errorMsg);

      await supabase
        .from('ingestion_jobs')
        .update({
          status: 'failed',
          error_message: `Storage load error: ${errorMsg}`,
          updated_at: new Date().toISOString()
        })
        .eq('id', job_id);

      return errorResponse(`Failed to load file: ${errorMsg}`, 500);
    }

    // ============================================================
    // 6. EXTRACT TEXT FROM PDF
    // ============================================================

    let extractedText: string;
    let pageInfo: Array<{ number: number; hasText: boolean }>;

    try {
      const result = await extractTextFromPDF(fileBuffer);
      extractedText = result.text;
      pageInfo = result.pages;

      // Identify pages without text (mark for OCR)
      const pagesNeedingOCR = pageInfo
        .filter(p => !p.hasText)
        .map(p => p.number.toString());

      console.log(`[PREPARE-CHUNKS] Pages needing OCR: ${pagesNeedingOCR.join(', ')}`);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown extraction error';
      console.error('[PREPARE-CHUNKS] PDF extraction failed:', errorMsg);

      await supabase
        .from('ingestion_jobs')
        .update({
          status: 'failed',
          error_message: `PDF extraction error: ${errorMsg}`,
          updated_at: new Date().toISOString()
        })
        .eq('id', job_id);

      return errorResponse(`PDF extraction failed: ${errorMsg}`, 500);
    }

    // ============================================================
    // 7. CLEAN TEXT
    // ============================================================

    const cleanedText = cleanText(extractedText);
    console.log(`[PREPARE-CHUNKS] Cleaned text: ${cleanedText.length} chars`);

    // ============================================================
    // 8. DETECT SECTIONS & CREATE CHUNKS
    // ============================================================

    const sections = detectSections(cleanedText);
    const chunks = await createIntelligentChunks(cleanedText, pageInfo);

    if (chunks.length === 0) {
      return errorResponse('No valid chunks could be created from document', 400);
    }

    // ============================================================
    // 9. INSERT CHUNKS INTO DATABASE
    // ============================================================

    console.log(`[PREPARE-CHUNKS] Inserting ${chunks.length} chunks`);

    const chunkInserts = chunks.map(chunk => ({
      job_id,
      company_id: job.company_id,
      chunk_number: chunk.chunk_number,
      start_page: chunk.start_page,
      end_page: chunk.end_page,
      section_title: chunk.section_title,
      content: chunk.content,
      content_hash: chunk.content_hash,
      content_summary: chunk.content.substring(0, 150),
      content_preview: chunk.content.substring(0, 200),
      estimated_tokens: chunk.estimated_tokens,
      requires_ocr: chunk.requires_ocr,
      ocr_pages: chunk.ocr_pages,
      status: chunk.requires_ocr ? 'pending_ocr' : 'preview_ready',
      quality_score: 0.85, // Default quality score
      is_duplicate: false,
      created_at: new Date().toISOString()
    }));

    const { error: insertError } = await supabase
      .from('ingestion_chunks_preview')
      .insert(chunkInserts);

    if (insertError) {
      console.error('[PREPARE-CHUNKS] Failed to insert chunks:', insertError);

      await supabase
        .from('ingestion_jobs')
        .update({
          status: 'failed',
          error_message: `Chunk insertion error: ${insertError.message}`,
          updated_at: new Date().toISOString()
        })
        .eq('id', job_id);

      return errorResponse(`Failed to insert chunks: ${insertError.message}`, 500);
    }

    // ============================================================
    // 10. UPDATE INGESTION JOB STATUS
    // ============================================================

    const updated_at = new Date().toISOString();

    const { error: updateError } = await supabase
      .from('ingestion_jobs')
      .update({
        status: 'chunk_preview_ready',
        progress: 50, // Chunking is 50% of pipeline
        updated_at
      })
      .eq('id', job_id);

    if (updateError) {
      console.error('[PREPARE-CHUNKS] Failed to update job:', updateError);
      return errorResponse(`Failed to update job: ${updateError.message}`, 500);
    }

    console.log('[PREPARE-CHUNKS] Job updated successfully');

    // ============================================================
    // 11. RETURN SUCCESS RESPONSE
    // ============================================================

    const latencyMs = Date.now() - startTime;
    console.log(`[PREPARE-CHUNKS] Chunk preparation complete in ${latencyMs}ms`);

    return successResponse({
      job_id,
      status: 'chunk_preview_ready',
      chunks_created: chunks.length,
      total_estimated_tokens: chunks.reduce((sum, c) => sum + c.estimated_tokens, 0),
      chunks_requiring_ocr: chunks.filter(c => c.requires_ocr).length,
      chunk_summaries: chunks.map(c => ({
        chunk_number: c.chunk_number,
        section_title: c.section_title,
        pages: `${c.start_page}-${c.end_page}`,
        tokens: c.estimated_tokens,
        requires_ocr: c.requires_ocr,
        preview: c.content.substring(0, 100) + '...'
      })),
      latency_ms: latencyMs
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[PREPARE-CHUNKS] Unhandled error:', errorMsg);
    return errorResponse(`Internal error: ${errorMsg}`, 500);
  }
});
