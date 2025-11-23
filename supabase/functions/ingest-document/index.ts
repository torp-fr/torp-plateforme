import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { chunkText, cleanExtractedText, generateEmbeddingsBatch } from '../_shared/embeddings.ts';

/**
 * Version simplifiée et robuste de l'ingestion OCR avec PDF.js
 *
 * STRATÉGIES (sans dépendances externes qui échouent) :
 * 1. Images → OpenAI Vision GPT-4o (haute qualité, fiable)
 * 2. PDFs → pdf.js pour extraction de texte fiable (avec fallback basique)
 *
 * ✅ Plus de dépendances à OCR.space, pdf.co, Google Vision, ou microservices
 * ✅ Extraction PDF améliorée avec pdf.js
 * ✅ Code simple et robuste qui ne plante pas
 */

// ============================================
// HELPER: Safe base64 encoding for large buffers
// ============================================
function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 8192; // Process 8KB at a time to avoid stack overflow
  let binary = '';

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

// ============================================
// OpenAI Vision pour images (GPT-4o)
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
// Extraction PDF AMÉLIORÉE avec pdf.js
// ============================================
async function extractPdfTextWithPdfJs(buffer: ArrayBuffer): Promise<string> {
  console.log('[OCR] Using pdf.js for text extraction');

  try {
    // Import dynamique de pdfjs-dist depuis ESM
    const pdfjsLib = await import('https://esm.sh/pdfjs-dist@4.0.379/build/pdf.mjs');

    // Configurer le worker (CRITIQUE pour Deno/Edge Functions)
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://esm.sh/pdfjs-dist@4.0.379/build/pdf.worker.mjs';

    // Charger le PDF
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(buffer),
      useSystemFonts: true,
    });

    const pdf = await loadingTask.promise;
    const textParts: string[] = [];

    // Extraire le texte de chaque page
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();

      // Combiner les items de texte
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
// Extraction PDF basique (fallback amélioré)
// ============================================
function extractBasicPdfText(buffer: ArrayBuffer): string {
  console.log('[OCR] Using basic fallback PDF text extraction');
  const bytes = new Uint8Array(buffer);

  // Essayer UTF-8 d'abord, puis Latin1
  let text = '';
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    text = new TextDecoder('latin1').decode(bytes);
  }

  const parts: string[] = [];

  // Méthode 1: Extraction des objets texte
  const textObjRegex = /BT\s*(.*?)\s*ET/gs;
  let match;
  while ((match = textObjRegex.exec(text)) !== null) {
    const textBlock = match[1];
    const textMatches = textBlock.match(/\(([^)]*)\)\s*Tj/g);
    if (textMatches) {
      textMatches.forEach(m => {
        const extracted = m.match(/\(([^)]*)\)/);
        if (extracted && extracted[1]) {
          // Décoder les séquences d'échappement
          const decoded = extracted[1]
            .replace(/\\n/g, '\n')
            .replace(/\\r/g, '\r')
            .replace(/\\t/g, '\t')
            .replace(/\\\(/g, '(')
            .replace(/\\\)/g, ')')
            .replace(/\\\\/g, '\\');
          parts.push(decoded);
        }
      });
    }
  }

  if (parts.length > 0) {
    return parts.join(' ');
  }

  // Méthode 2: Extraction ASCII brute (dernier recours)
  const asciiMatches = text.match(/[\x20-\x7E]{10,}/g);
  return asciiMatches
    ?.filter(s => !s.includes('/') && !s.includes('<') && !s.match(/^[0-9.]+$/))
    .join(' ') || '';
}

// ============================================
// ORCHESTRATEUR SIMPLIFIÉ
// ============================================
async function extractTextSmart(
  buffer: ArrayBuffer,
  mimeType: string,
  fileSize: number,
  fileName: string
): Promise<{ text: string; method: string; warnings: string[] }> {
  const warnings: string[] = [];
  const openaiKey = Deno.env.get('OPENAI_API_KEY');
  const sizeMB = fileSize / 1024 / 1024;

  console.log(`[OCR] Processing: ${fileName} (${mimeType}, ${sizeMB.toFixed(2)}MB)`);

  // ========== IMAGES ==========
  if (mimeType.startsWith('image/')) {
    if (!openaiKey) {
      throw new Error('OPENAI_API_KEY non configurée - requis pour les images');
    }

    try {
      const text = await ocrWithOpenAIVision(buffer, mimeType, openaiKey);
      console.log(`[OCR] ✅ Image processed successfully (${text.length} chars)`);
      return { text, method: 'OpenAI Vision GPT-4o', warnings };
    } catch (error) {
      console.error('[OCR] ❌ OpenAI Vision failed:', error);
      throw new Error(`Échec OCR image: ${error}`);
    }
  }

  // ========== PDFs ==========
  if (mimeType === 'application/pdf') {
    // Essayer pdf.js d'abord, puis fallback
    try {
      const text = await extractPdfTextWithPdfJs(buffer);

      if (text.length < 100) {
        warnings.push('PDF scanné ou avec peu de texte - essayez de convertir en images');
        return {
          text: `[PDF avec peu de texte extrait - ${text.length} caractères]\n\n` +
                `Suggestion: Convertissez en images PNG pour meilleur OCR\n\n${text}`,
          method: 'pdf.js (texte limité)',
          warnings
        };
      }

      return { text, method: 'pdf.js', warnings };
    } catch (pdfError) {
      console.warn('[OCR] pdf.js failed, trying fallback:', pdfError);
      warnings.push(`pdf.js échoué: ${pdfError}, utilisation du fallback`);

      // Fallback sur extraction basique
      const basicText = extractBasicPdfText(buffer);

      if (basicText.length < 100) {
        warnings.push('Extraction limitée - document scanné ou encodage complexe');
        return {
          text: `[Extraction limitée - ${basicText.length} caractères]\n\n` +
                `Le PDF semble scanné ou utilise un encodage complexe.\n` +
                `Convertissez-le en images PNG pour un meilleur résultat.\n\n${basicText}`,
          method: 'Extraction basique (fallback)',
          warnings
        };
      }

      if (basicText.length < 500) {
        warnings.push('Extraction basique - qualité non garantie');
      }
      return { text: basicText, method: 'Extraction basique (fallback)', warnings };
    }
  }

  // ========== TEXTE BRUT ==========
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

  // Valider le type de fichier
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
