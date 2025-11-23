import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * VERSION STANDALONE AVEC EXTRACTION PDF AMÉLIORÉE
 *
 * Stratégie hybride : pdf.js puis fallback Vision OCR (Anthropic prioritaire, puis OpenAI)
 */

// ============================================
// CORS HELPERS (inlined)
// ============================================
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

function handleCors(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  return null;
}

// ============================================
// EMBEDDINGS HELPERS (inlined)
// ============================================
const OPENAI_EMBEDDING_URL = 'https://api.openai.com/v1/embeddings';
const OPENAI_EMBEDDING_MODEL = 'text-embedding-3-small';

interface EmbeddingResult {
  embedding: number[];
  tokens: number;
}

async function generateEmbeddingsBatch(texts: string[], apiKey: string): Promise<EmbeddingResult[]> {
  const BATCH_SIZE = 100;
  const results: EmbeddingResult[] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);

    const response = await fetch(OPENAI_EMBEDDING_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        input: batch,
        model: OPENAI_EMBEDDING_MODEL
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI Embedding error: ${error}`);
    }

    const data = await response.json();
    const batchResults = data.data.map((item: any) => ({
      embedding: item.embedding,
      tokens: Math.floor(data.usage.total_tokens / batch.length)
    }));

    results.push(...batchResults);

    if (i + BATCH_SIZE < texts.length) {
      await new Promise(r => setTimeout(r, 100));
    }
  }

  return results;
}

interface TextChunk {
  content: string;
  index: number;
  startChar: number;
  endChar: number;
}

function chunkText(text: string, options: { maxLength?: number; overlap?: number } = {}): TextChunk[] {
  const { maxLength = 1500, overlap = 200 } = options;
  const chunks: TextChunk[] = [];
  const paragraphs = text.split(/\n\n+/);

  let currentChunk = '';
  let currentStart = 0;
  let chunkIndex = 0;
  let charPos = 0;

  for (const para of paragraphs) {
    const paraWithBreak = para + '\n\n';

    if (currentChunk.length + paraWithBreak.length > maxLength && currentChunk.length > 0) {
      chunks.push({
        content: currentChunk.trim(),
        index: chunkIndex++,
        startChar: currentStart,
        endChar: charPos
      });

      const overlapText = currentChunk.slice(-overlap);
      currentChunk = overlapText + paraWithBreak;
      currentStart = charPos - overlap;
    } else {
      currentChunk += paraWithBreak;
    }

    charPos += paraWithBreak.length;
  }

  if (currentChunk.trim().length > 0) {
    chunks.push({
      content: currentChunk.trim(),
      index: chunkIndex,
      startChar: currentStart,
      endChar: charPos
    });
  }

  return chunks;
}

function cleanExtractedText(text: string): string {
  return text
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^.{0,50}Page \d+.{0,50}$/gm, '')
    .trim();
}

// ============================================
// HELPER: Safe base64 encoding for large buffers
// ============================================
function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 8192;
  let binary = '';

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

// ============================================
// Anthropic Claude Vision (MOINS CHER - PRIORITAIRE)
// ============================================
async function ocrWithClaudeVision(buffer: ArrayBuffer, mimeType: string, apiKey: string): Promise<string> {
  console.log('[OCR] Using Anthropic Claude 3.5 Sonnet Vision');
  const base64 = bufferToBase64(buffer);
  const mediaType = mimeType.startsWith('image/') ? mimeType : 'image/png';

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4000,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: base64
            }
          },
          {
            type: 'text',
            text: `Extrais TOUT le texte de ce document technique du bâtiment de manière structurée.

IMPORTANT : Conserve absolument :
- Les titres et numéros (DTU, NF, articles)
- Les tableaux (format markdown)
- Les valeurs techniques (dimensions, résistances, etc.)
- Les listes à puces et énumérations
- Les références normatives

Retourne UNIQUEMENT le texte extrait, sans commentaires.`
          }
        ]
      }]
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Claude API error ${response.status}: ${error}`);
  }

  const data = await response.json();
  return data.content[0]?.text || '';
}

// ============================================
// OpenAI Vision pour images (GPT-4o) - FALLBACK
// ============================================
async function ocrWithOpenAIVision(buffer: ArrayBuffer, mimeType: string, apiKey: string): Promise<string> {
  console.log('[OCR] Using OpenAI Vision GPT-4o');
  const base64 = bufferToBase64(buffer);
  const mediaType = mimeType.startsWith('image/') ? mimeType : 'image/png';

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      max_tokens: 16000,
      messages: [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:${mediaType};base64,${base64}`, detail: 'high' } },
          {
            type: 'text',
            text: `Extrais TOUT le texte de ce document technique du bâtiment de manière structurée.

IMPORTANT : Conserve absolument :
- Les titres et numéros (DTU, NF, articles)
- Les tableaux (format markdown)
- Les valeurs techniques (dimensions, résistances, etc.)
- Les listes à puces et énumérations
- Les références normatives

Retourne UNIQUEMENT le texte extrait.`
          }
        ]
      }]
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI Vision API error ${response.status}: ${error}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || '';
}

// ============================================
// Extraction PDF AMÉLIORÉE avec pdfjs
// ============================================
async function extractPdfTextWithPdfJs(buffer: ArrayBuffer): Promise<string> {
  console.log('[OCR] Using pdf.js for text extraction');

  try {
    const pdfjsLib = await import('https://esm.sh/pdfjs-dist@4.0.379/build/pdf.mjs');

    // CRITICAL: Disable worker for Deno/Edge Functions compatibility
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(buffer),
      useSystemFonts: true,
      isEvalSupported: false,
      useWorkerFetch: false,
      disableWorker: true, // This is the key fix
    });

    const pdf = await loadingTask.promise;
    const textParts: string[] = [];

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();

      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');

      if (pageText.trim()) {
        textParts.push(`\n\n=== Page ${pageNum} ===\n\n${pageText}`);
      }
    }

    const fullText = textParts.join('\n');
    console.log(`[OCR] ✅ Extracted ${fullText.length} characters from ${pdf.numPages} pages`);

    return fullText;
  } catch (error) {
    console.error('[OCR] pdf.js extraction failed:', error);
    throw error;
  }
}

// ============================================
// Conversion PDF → Images pour OCR Vision
// ============================================
async function convertPdfPagesToImages(buffer: ArrayBuffer, maxPages: number = 20): Promise<string[]> {
  console.log('[OCR] Converting PDF pages to images for Vision OCR');

  try {
    const pdfjsLib = await import('https://esm.sh/pdfjs-dist@4.0.379/build/pdf.mjs');

    // CRITICAL: Disable worker for Deno/Edge Functions compatibility
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(buffer),
      useSystemFonts: true,
      isEvalSupported: false,
      useWorkerFetch: false,
      disableWorker: true, // This is the key fix
    });

    const pdf = await loadingTask.promise;
    const numPages = Math.min(pdf.numPages, maxPages);
    const base64Images: string[] = [];

    console.log(`[OCR] Rendering ${numPages} pages (max ${maxPages})`);

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 2.0 });

      const canvas = new OffscreenCanvas(viewport.width, viewport.height);
      const context = canvas.getContext('2d');

      await page.render({
        canvasContext: context,
        viewport: viewport,
      }).promise;

      const blob = await canvas.convertToBlob({ type: 'image/png' });
      const arrayBuffer = await blob.arrayBuffer();
      const base64 = bufferToBase64(arrayBuffer);

      base64Images.push(base64);
      console.log(`[OCR] ✅ Page ${pageNum} converted to image`);
    }

    return base64Images;
  } catch (error) {
    console.error('[OCR] PDF to images conversion failed:', error);
    throw error;
  }
}

// ============================================
// OCR multi-pages avec Vision (Anthropic prioritaire)
// ============================================
async function ocrPdfWithVision(buffer: ArrayBuffer, anthropicKey?: string, openaiKey?: string): Promise<{ text: string; provider: string }> {
  const MAX_PAGES = 20;

  console.log('[OCR] Using Vision for PDF OCR (fallback mode)');

  const base64Images = await convertPdfPagesToImages(buffer, MAX_PAGES);
  const pageTexts: string[] = [];

  const useAnthropic = !!anthropicKey;
  const useOpenAI = !!openaiKey;

  if (!useAnthropic && !useOpenAI) {
    throw new Error('Aucune clé API Vision (ANTHROPIC_API_KEY ou OPENAI_API_KEY requis)');
  }

  const provider = useAnthropic ? 'Anthropic Claude 3.5 Sonnet' : 'OpenAI GPT-4o';
  console.log(`[OCR] Using ${provider} (~$${(base64Images.length * (useAnthropic ? 0.003 : 0.0077)).toFixed(3)} estimated cost)`);

  for (let i = 0; i < base64Images.length; i++) {
    console.log(`[OCR] Processing page ${i + 1}/${base64Images.length} with ${provider}...`);

    let pageText = '';

    if (useAnthropic) {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': anthropicKey!,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 4000,
          messages: [{
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: 'image/png',
                  data: base64Images[i]
                }
              },
              {
                type: 'text',
                text: `Extrais TOUT le texte de cette page de document technique du bâtiment.

IMPORTANT : Conserve absolument :
- Les titres et numéros (DTU, NF, articles)
- Les tableaux (format markdown)
- Les valeurs techniques (dimensions, résistances, etc.)
- Les listes à puces et énumérations
- Les références normatives

Retourne UNIQUEMENT le texte extrait, sans commentaires.`
              }
            ]
          }]
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Claude API error ${response.status}: ${error}`);
      }

      const data = await response.json();
      pageText = data.content[0]?.text || '';

    } else {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiKey!}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          max_tokens: 4000,
          messages: [{
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/png;base64,${base64Images[i]}`,
                  detail: 'high'
                }
              },
              {
                type: 'text',
                text: `Extrais TOUT le texte de cette page de document technique du bâtiment.

IMPORTANT : Conserve absolument :
- Les titres et numéros (DTU, NF, articles)
- Les tableaux (format markdown)
- Les valeurs techniques (dimensions, résistances, etc.)
- Les listes à puces et énumérations
- Les références normatives

Retourne UNIQUEMENT le texte extrait, sans commentaires.`
              }
            ]
          }]
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenAI Vision API error ${response.status}: ${error}`);
      }

      const data = await response.json();
      pageText = data.choices[0]?.message?.content || '';
    }

    pageTexts.push(`\n\n=== Page ${i + 1} ===\n\n${pageText}`);

    if (i < base64Images.length - 1) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  const fullText = pageTexts.join('\n');
  console.log(`[OCR] ✅ Vision OCR completed: ${fullText.length} characters from ${base64Images.length} pages`);

  return { text: fullText, provider };
}

// ============================================
// ORCHESTRATEUR HYBRIDE INTELLIGENT
// ============================================
async function extractTextSmart(
  buffer: ArrayBuffer,
  mimeType: string,
  fileSize: number,
  fileName: string
): Promise<{ text: string; method: string; warnings: string[] }> {
  const warnings: string[] = [];
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
  const openaiKey = Deno.env.get('OPENAI_API_KEY');
  const sizeMB = fileSize / 1024 / 1024;

  console.log(`[OCR] Processing: ${fileName} (${mimeType}, ${sizeMB.toFixed(2)}MB)`);

  // Images directes - Anthropic prioritaire (moins cher)
  if (mimeType.startsWith('image/')) {
    if (anthropicKey) {
      try {
        const text = await ocrWithClaudeVision(buffer, mimeType, anthropicKey);
        console.log(`[OCR] ✅ Image processed with Claude (${text.length} chars)`);
        return { text, method: 'Anthropic Claude 3.5 Sonnet Vision', warnings };
      } catch (error) {
        console.error('[OCR] ❌ Claude Vision failed:', error);
        warnings.push('Claude Vision échoué, essai OpenAI...');
      }
    }

    if (openaiKey) {
      try {
        const text = await ocrWithOpenAIVision(buffer, mimeType, openaiKey);
        console.log(`[OCR] ✅ Image processed with OpenAI (${text.length} chars)`);
        return { text, method: 'OpenAI Vision GPT-4o', warnings };
      } catch (error) {
        console.error('[OCR] ❌ OpenAI Vision failed:', error);
        throw new Error(`Échec OCR image: ${error}`);
      }
    }

    throw new Error('Aucune clé API Vision (ANTHROPIC_API_KEY ou OPENAI_API_KEY requis)');
  }

  // PDFs - Stratégie hybride intelligente
  if (mimeType === 'application/pdf') {
    // ÉTAPE 1: Essayer pdf.js (rapide et gratuit)
    try {
      const text = await extractPdfTextWithPdfJs(buffer);

      if (text.length >= 100) {
        console.log('[OCR] ✅ pdf.js extraction successful');
        return { text, method: 'pdf.js', warnings };
      }

      console.log(`[OCR] ⚠️ pdf.js extracted only ${text.length} chars, switching to Vision OCR`);
      warnings.push('pdf.js a extrait peu de texte, passage à Vision OCR');
    } catch (pdfError) {
      console.warn('[OCR] ❌ pdf.js failed, switching to Vision OCR:', pdfError);
      warnings.push('pdf.js échoué, passage à Vision OCR');
    }

    // ÉTAPE 2: Fallback vers Vision OCR
    if (!anthropicKey && !openaiKey) {
      warnings.push('Aucune clé API Vision - impossible d\'utiliser Vision OCR');
      return {
        text: '[Erreur] pdf.js a échoué et aucune clé Vision API configurée.\n\n' +
              'Configurez ANTHROPIC_API_KEY ou OPENAI_API_KEY.',
        method: 'Erreur - pas de fallback',
        warnings
      };
    }

    try {
      const { text: visionText, provider } = await ocrPdfWithVision(buffer, anthropicKey, openaiKey);
      warnings.push(`${provider} utilisé avec succès`);

      if (sizeMB > 5) {
        warnings.push('Document volumineux - coût Vision OCR élevé');
      }

      return { text: visionText, method: `${provider} OCR (fallback)`, warnings };
    } catch (visionError) {
      console.error('[OCR] ❌ Vision OCR failed:', visionError);
      throw new Error(`Échec complet de l'extraction PDF: ${visionError}`);
    }
  }

  // Texte brut
  console.log('[OCR] Processing as plain text');
  return {
    text: new TextDecoder().decode(new Uint8Array(buffer)),
    method: 'Texte brut',
    warnings: []
  };
}

// ============================================
// MAIN HANDLER
// ============================================
serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      return handleFileUpload(req, supabase);
    }

    const body = await req.json();
    const { action } = body;

    switch (action) {
      case 'process':
        return handleProcess(body, supabase);
      case 'index':
        return handleIndex(body, supabase);
      case 'status':
        return handleStatus(body, supabase);
      case 'list':
        return handleList(body, supabase);
      case 'delete':
        return handleDelete(body, supabase);
      case 'stats':
        return handleStats(supabase);
      default:
        return errorResponse(`Action inconnue: ${action}`);
    }
  } catch (error) {
    console.error('❌ Ingestion error:', error);
    return errorResponse(String(error), 500);
  }
});

// ============================================
// HANDLERS
// ============================================
async function handleFileUpload(req: Request, supabase: any) {
  const formData = await req.formData();
  const file = formData.get('file') as File;
  const metadata = JSON.parse(formData.get('metadata') as string || '{}');

  if (!file) {
    return errorResponse('Fichier requis');
  }

  const allowedTypes = [
    'application/pdf',
    'text/plain',
    'text/markdown',
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/webp',
    'image/gif'
  ];
  const fileType = file.type || 'application/octet-stream';
  if (!allowedTypes.some(t => fileType.includes(t.split('/')[1])) &&
      !file.name.match(/\.(pdf|txt|md|png|jpg|jpeg|webp|gif)$/i)) {
    return errorResponse('Type non supporté. Utilisez PDF, images (PNG/JPG) ou TXT.');
  }

  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const storagePath = `knowledge/${timestamp}_${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from('documents')
    .upload(storagePath, file, { contentType: file.type, upsert: false });

  if (uploadError) {
    if (uploadError.message?.includes('not found')) {
      await supabase.storage.createBucket('documents', { public: false });
      const { error: retryError } = await supabase.storage
        .from('documents')
        .upload(storagePath, file);
      if (retryError) throw retryError;
    } else {
      throw uploadError;
    }
  }

  const { data: doc, error: dbError } = await supabase
    .from('knowledge_documents')
    .insert({
      filename: safeName,
      original_name: file.name,
      file_path: storagePath,
      file_size: file.size,
      mime_type: file.type || 'application/pdf',
      doc_type: metadata.doc_type || 'autre',
      category: metadata.category || null,
      code_reference: metadata.code_reference || null,
      title: metadata.title || file.name,
      status: 'pending'
    })
    .select()
    .single();

  if (dbError) throw dbError;

  return successResponse({
    message: 'Document uploadé',
    documentId: doc.id,
    document: doc
  });
}

async function handleProcess(body: any, supabase: any) {
  const { documentId } = body;
  if (!documentId) return errorResponse('documentId requis');

  const { data: doc, error: fetchError } = await supabase
    .from('knowledge_documents')
    .select('*')
    .eq('id', documentId)
    .single();

  if (fetchError || !doc) return errorResponse('Document non trouvé');

  await supabase.from('knowledge_documents')
    .update({ status: 'processing' })
    .eq('id', documentId);

  try {
    const { data: fileData, error: dlError } = await supabase.storage
      .from('documents')
      .download(doc.file_path);

    if (dlError) throw dlError;

    const buffer = await fileData.arrayBuffer();
    const { text, method, warnings } = await extractTextSmart(
      buffer,
      doc.mime_type,
      doc.file_size,
      doc.filename
    );

    const cleanedText = cleanExtractedText(text);
    const chunks = chunkText(cleanedText, { maxLength: 1500, overlap: 200 });

    const chunkData = chunks.map(chunk => ({
      document_id: documentId,
      content: chunk.content,
      content_length: chunk.content.length,
      chunk_index: chunk.index,
      metadata: { startChar: chunk.startChar, endChar: chunk.endChar, warnings, method }
    }));

    const { error: insertError } = await supabase
      .from('knowledge_chunks')
      .insert(chunkData);

    if (insertError) throw insertError;

    await supabase.from('knowledge_documents')
      .update({ chunks_count: chunks.length, status: 'processed' })
      .eq('id', documentId);

    console.log(`✅ Document ${documentId} processed: ${chunks.length} chunks, method: ${method}`);

    return successResponse({
      message: 'Document traité',
      documentId,
      chunksCreated: chunks.length,
      method,
      warnings
    });

  } catch (error) {
    console.error(`❌ Processing failed for document ${documentId}:`, error);
    await supabase.from('knowledge_documents')
      .update({ status: 'error', processing_error: String(error) })
      .eq('id', documentId);
    throw error;
  }
}

async function handleIndex(body: any, supabase: any) {
  const { documentId } = body;
  if (!documentId) return errorResponse('documentId requis');

  const openaiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiKey) return errorResponse('OPENAI_API_KEY non configurée');

  const { data: chunks, error: fetchError } = await supabase
    .from('knowledge_chunks')
    .select('id, content')
    .eq('document_id', documentId)
    .is('embedding', null);

  if (fetchError) throw fetchError;
  if (!chunks || chunks.length === 0) {
    return successResponse({ message: 'Déjà indexé', documentId });
  }

  const texts = chunks.map((c: any) => c.content);
  const embeddings = await generateEmbeddingsBatch(texts, openaiKey);

  let indexed = 0;
  for (let i = 0; i < chunks.length; i++) {
    const { error } = await supabase
      .from('knowledge_chunks')
      .update({ embedding: embeddings[i].embedding })
      .eq('id', chunks[i].id);
    if (!error) indexed++;
  }

  await supabase.from('knowledge_documents')
    .update({ status: 'indexed', indexed_at: new Date().toISOString() })
    .eq('id', documentId);

  console.log(`✅ Document ${documentId} indexed: ${indexed} chunks`);

  return successResponse({
    message: 'Document indexé',
    documentId,
    chunksIndexed: indexed
  });
}

async function handleStatus(body: any, supabase: any) {
  const { documentId } = body;
  const { data: doc, error } = await supabase
    .from('knowledge_documents')
    .select('*')
    .eq('id', documentId)
    .single();

  if (error) return errorResponse('Document non trouvé');

  const { count } = await supabase
    .from('knowledge_chunks')
    .select('*', { count: 'exact', head: true })
    .eq('document_id', documentId)
    .not('embedding', 'is', null);

  return successResponse({ document: doc, chunksIndexed: count || 0 });
}

async function handleList(body: any, supabase: any) {
  const { doc_type, category, status, limit = 50, offset = 0 } = body;

  let query = supabase
    .from('knowledge_documents')
    .select('*')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (doc_type) query = query.eq('doc_type', doc_type);
  if (category) query = query.eq('category', category);
  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) throw error;

  return successResponse({ documents: data });
}

async function handleDelete(body: any, supabase: any) {
  const { documentId } = body;

  const { data: doc } = await supabase
    .from('knowledge_documents')
    .select('file_path')
    .eq('id', documentId)
    .single();

  if (doc?.file_path) {
    await supabase.storage.from('documents').remove([doc.file_path]);
  }

  const { error } = await supabase
    .from('knowledge_documents')
    .delete()
    .eq('id', documentId);

  if (error) throw error;
  return successResponse({ message: 'Supprimé', documentId });
}

async function handleStats(supabase: any) {
  const { count: totalDocs } = await supabase
    .from('knowledge_documents')
    .select('*', { count: 'exact', head: true });

  const { count: totalChunks } = await supabase
    .from('knowledge_chunks')
    .select('*', { count: 'exact', head: true });

  const { data: byType } = await supabase
    .from('knowledge_documents')
    .select('doc_type')
    .eq('status', 'indexed');

  const stats = {
    total_documents: totalDocs || 0,
    total_chunks: totalChunks || 0,
    by_type: byType ? Object.entries(
      byType.reduce((acc: any, d: any) => {
        acc[d.doc_type] = (acc[d.doc_type] || 0) + 1;
        return acc;
      }, {})
    ).map(([doc_type, count]) => ({ doc_type, count })) : []
  };

  return successResponse({ stats });
}

function successResponse(data: any) {
  return new Response(
    JSON.stringify({ success: true, ...data }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

function errorResponse(message: string, status = 400) {
  return new Response(
    JSON.stringify({ success: false, error: message }),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
