import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import {
  generateEmbeddingsBatch,
  chunkText,
  cleanExtractedText,
} from '../_shared/embeddings.ts';

/**
 * Architecture OCR robuste avec fallbacks multiples
 *
 * Stratégies d'extraction par ordre de priorité :
 * 1. Images : OpenAI Vision (GPT-4o) - haute qualité
 * 2. PDFs petits (<1MB, <5 pages) : OCR.space
 * 3. PDFs moyens : Conversion pdf.co + OpenAI Vision
 * 4. PDFs complexes : Extraction texte basique + warning
 * 5. Fallback final : Erreur documentée avec suggestions
 */

// ============================================
// STRATÉGIE 1 : OpenAI Vision (Images + fallback PDF)
// ============================================
async function ocrWithOpenAIVision(buffer: ArrayBuffer, mimeType: string, apiKey: string): Promise<string> {
  const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
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
    throw new Error(`OpenAI Vision: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || '';
}

// ============================================
// STRATÉGIE 2 : OCR.space (rapide, limites : 1MB, 3 pages)
// ============================================
async function ocrWithOCRSpace(buffer: ArrayBuffer, mimeType: string, apiKey: string): Promise<string> {
  const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
  const formData = new FormData();

  formData.append('base64Image', `data:${mimeType};base64,${base64}`);
  formData.append('language', 'fre');
  formData.append('isOverlayRequired', 'false');
  formData.append('detectOrientation', 'true');
  formData.append('scale', 'true');
  formData.append('OCREngine', '2');

  const response = await fetch('https://api.ocr.space/parse/image', {
    method: 'POST',
    headers: { 'apikey': apiKey },
    body: formData,
  });

  if (!response.ok) throw new Error(`OCR.space HTTP ${response.status}`);

  const data = await response.json();
  if (data.IsErroredOnProcessing) {
    throw new Error(`OCR.space: ${data.ErrorMessage?.[0] || 'Unknown error'}`);
  }

  return data.ParsedResults?.map((r: any) => r.ParsedText).join('\n\n---\n\n') || '';
}

// ============================================
// STRATÉGIE 3 : Microservice OCR (PaddleOCR) - Production quality
// ============================================
async function ocrWithMicroservice(buffer: ArrayBuffer, mimeType: string): Promise<string> {
  const ocrServiceUrl = Deno.env.get('OCR_SERVICE_URL');

  if (!ocrServiceUrl) {
    throw new Error('OCR_SERVICE_URL not configured');
  }

  console.log(`[OCR Microservice] Calling ${ocrServiceUrl}...`);
  const base64Content = btoa(String.fromCharCode(...new Uint8Array(buffer)));

  const response = await fetch(`${ocrServiceUrl}/ocr`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      content: base64Content,
      mime_type: mimeType,
      max_pages: 100  // Augmenter la limite pour DTU longs
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OCR Microservice: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  console.log(`[OCR Microservice] Extracted ${data.text.length} chars from ${data.pages_processed} pages`);

  if (data.warnings && data.warnings.length > 0) {
    console.log(`[OCR Microservice] Warnings: ${data.warnings.join(', ')}`);
  }

  return data.text;
}

// ============================================
// STRATÉGIE 4 : Google Cloud Vision API (OCR avec API Key)
// ============================================
async function ocrWithGoogleVision(buffer: ArrayBuffer, mimeType: string, apiKey: string): Promise<string> {
  console.log('[Google Vision] Processing document...');
  const base64Content = btoa(String.fromCharCode(...new Uint8Array(buffer)));

  const endpoint = 'https://vision.googleapis.com/v1/images:annotate';

  const response = await fetch(`${endpoint}?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      requests: [{
        image: {
          content: base64Content
        },
        features: [{
          type: 'DOCUMENT_TEXT_DETECTION',
          maxResults: 1
        }],
        imageContext: {
          languageHints: ['fr', 'en']
        }
      }]
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google Vision: ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  if (data.responses?.[0]?.error) {
    throw new Error(`Google Vision: ${data.responses[0].error.message}`);
  }

  const text = data.responses?.[0]?.fullTextAnnotation?.text || '';
  console.log(`[Google Vision] Extracted ${text.length} characters`);
  return text;
}

// ============================================
// ORCHESTRATEUR OCR avec fallbacks intelligents
// ============================================
async function extractTextSmart(
  buffer: ArrayBuffer,
  mimeType: string,
  fileSize: number,
  fileName: string
): Promise<{ text: string; method: string; warnings: string[] }> {
  const warnings: string[] = [];
  const openaiKey = Deno.env.get('OPENAI_API_KEY');
  const ocrSpaceKey = Deno.env.get('OCRSPACE_API_KEY');
  const pdfCoKey = Deno.env.get('PDFCO_API_KEY');

  const isImage = mimeType.startsWith('image/');
  const isPdf = mimeType === 'application/pdf';
  const sizeMB = fileSize / 1024 / 1024;

  console.log(`[OCR] File: ${fileName}, Type: ${mimeType}, Size: ${sizeMB.toFixed(2)}MB`);

  // ========== IMAGES ==========
  if (isImage) {
    if (openaiKey) {
      try {
        console.log('[OCR] Strategy: OpenAI Vision (image)');
        const text = await ocrWithOpenAIVision(buffer, mimeType, openaiKey);
        return { text, method: 'OpenAI Vision', warnings };
      } catch (error) {
        console.error('[OCR] OpenAI Vision failed:', error);
        warnings.push(`OpenAI Vision échoué: ${error}`);
      }
    }

    if (ocrSpaceKey && sizeMB < 1) {
      try {
        console.log('[OCR] Strategy: OCR.space (image fallback)');
        const text = await ocrWithOCRSpace(buffer, mimeType, ocrSpaceKey);
        warnings.push('Utilisé OCR.space (fallback) - qualité moyenne');
        return { text, method: 'OCR.space', warnings };
      } catch (error) {
        console.error('[OCR] OCR.space failed:', error);
        warnings.push(`OCR.space échoué: ${error}`);
      }
    }

    throw new Error('Aucun service OCR disponible pour les images');
  }

  // ========== PDFs ==========
  if (isPdf) {
    // Stratégie 1 : Microservice OCR (PaddleOCR) - PRIORITAIRE pour production
    const ocrServiceUrl = Deno.env.get('OCR_SERVICE_URL');
    if (ocrServiceUrl && sizeMB < 50) {
      try {
        console.log('[OCR] Strategy: Microservice PaddleOCR (production quality)');
        const text = await ocrWithMicroservice(buffer, mimeType);
        if (text.length > 100) {
          return { text, method: 'PaddleOCR Microservice', warnings };
        }
      } catch (error) {
        console.error('[OCR] Microservice failed:', error);
        warnings.push(`Microservice OCR échoué: ${error}`);
        // Continue avec fallbacks
      }
    }

    // Stratégie 2 : OCR.space pour petits PDFs (fallback rapide)
    if (ocrSpaceKey && sizeMB < 3) {
      try {
        console.log('[OCR] Strategy: OCR.space (PDF, max 3 pages)');
        const text = await ocrWithOCRSpace(buffer, mimeType, ocrSpaceKey);
        if (text.length > 200) {
          warnings.push('OCR.space utilisé - limité aux 3 premières pages du PDF');
          return { text, method: 'OCR.space (3 premières pages)', warnings };
        }
      } catch (error) {
        const errorMsg = String(error);
        if (errorMsg.includes('maximum page limit')) {
          console.log('[OCR] OCR.space reached 3-page limit, but may have extracted content');
          warnings.push('PDF > 3 pages - seules 3 premières pages extraites par OCR.space');
        } else {
          console.error('[OCR] OCR.space failed:', error);
          warnings.push(`OCR.space échoué: ${error}`);
        }
      }
    }

    // Stratégie 3 : Google Cloud Vision (si configuré)
    const googleApiKey = Deno.env.get('GOOGLE_CLOUD_API_KEY');
    if (googleApiKey && sizeMB < 10) {
      try {
        console.log('[OCR] Strategy: Google Cloud Vision');
        const text = await ocrWithGoogleVision(buffer, mimeType, googleApiKey);
        if (text.length > 100) {
          return { text, method: 'Google Cloud Vision', warnings };
        }
      } catch (error) {
        console.error('[OCR] Google Cloud Vision failed:', error);
        warnings.push(`Google Vision échoué: ${error}`);
      }
    }

    // Stratégie 4 : Extraction texte basique (fallback ultime)
    console.log('[OCR] Strategy: Basic PDF text extraction (fallback)');
    const basicText = extractBasicPdfText(buffer);

    if (basicText.length < 100) {
      warnings.push('ATTENTION: Extraction limitée - convertissez en images PNG pour meilleure qualité');
      return {
        text: `[Extraction PDF limitée - ${basicText.length} caractères extraits]\n\nPour documents avec schémas/tableaux complexes:\n1. Convertissez chaque page en PNG (300 DPI)\n2. Uploadez les images séparément\n3. OCR haute qualité via OpenAI Vision\n\n${basicText}`,
        method: 'Extraction basique (fallback)',
        warnings
      };
    }

    warnings.push('Extraction texte basique - peut manquer tableaux/images');
    return { text: basicText, method: 'Extraction basique', warnings };
  }

  // Texte brut
  return {
    text: new TextDecoder().decode(new Uint8Array(buffer)),
    method: 'Texte brut',
    warnings: []
  };
}

// Extraction PDF basique (fallback)
function extractBasicPdfText(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const text = new TextDecoder('latin1').decode(bytes);
  const parts: string[] = [];

  // Extraire les streams de texte
  const streamRegex = /stream\s*([\s\S]*?)\s*endstream/g;
  let match;
  while ((match = streamRegex.exec(text)) !== null) {
    const content = match[1];
    const textMatches = content.match(/\(([^)]*)\)\s*Tj/g);
    if (textMatches) {
      textMatches.forEach(m => {
        const extracted = m.match(/\(([^)]*)\)/);
        if (extracted) parts.push(extracted[1]);
      });
    }
  }

  if (parts.length === 0) {
    const asciiMatches = text.match(/[\x20-\x7E]{10,}/g);
    return asciiMatches?.filter(s => !s.includes('/') && !s.includes('<')).join(' ') || '';
  }

  return parts.join(' ');
}

// ============================================
// HANDLERS
// ============================================
serve(async (req) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      return handleUpload(req, supabase);
    }

    const body = await req.json();
    const { action } = body;

    switch (action) {
      case 'process': return handleProcess(body, supabase);
      case 'index': return handleIndex(body, supabase);
      case 'status': return handleStatus(body, supabase);
      case 'list': return handleList(body, supabase);
      case 'delete': return handleDelete(body, supabase);
      case 'stats': return handleStats(supabase);
      default: return errorResponse(`Action inconnue: ${action}`);
    }
  } catch (error) {
    console.error('[ERROR]', error);
    return errorResponse(String(error), 500);
  }
});

async function handleUpload(req: Request, supabase: any) {
  const formData = await req.formData();
  const file = formData.get('file') as File;
  const metadata = JSON.parse(formData.get('metadata') as string || '{}');

  if (!file) return errorResponse('Fichier requis');

  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const storagePath = `knowledge/${timestamp}_${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from('documents')
    .upload(storagePath, file, { contentType: file.type, upsert: false });

  if (uploadError) {
    if (uploadError.message?.includes('not found')) {
      await supabase.storage.createBucket('documents', { public: false });
      const { error: retryError } = await supabase.storage.from('documents').upload(storagePath, file);
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

  return successResponse({ message: 'Document uploadé', documentId: doc.id, document: doc });
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

  await supabase.from('knowledge_documents').update({ status: 'processing' }).eq('id', documentId);

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

    const { error: insertError } = await supabase.from('knowledge_chunks').insert(chunkData);
    if (insertError) throw insertError;

    await supabase.from('knowledge_documents').update({ chunks_count: chunks.length }).eq('id', documentId);

    return successResponse({
      message: 'Document traité',
      documentId,
      chunksCreated: chunks.length,
      method,
      warnings
    });

  } catch (error) {
    await supabase.from('knowledge_documents').update({
      status: 'error',
      processing_error: String(error)
    }).eq('id', documentId);
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

  await supabase.from('knowledge_documents').update({
    status: 'indexed',
    indexed_at: new Date().toISOString()
  }).eq('id', documentId);

  return successResponse({ message: 'Document indexé', documentId, chunksIndexed: indexed });
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

  const { error } = await supabase.from('knowledge_documents').delete().eq('id', documentId);
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
