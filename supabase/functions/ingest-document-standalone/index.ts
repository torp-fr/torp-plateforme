import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ============================================
// CORS
// ============================================
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

function handleCors(req: Request) {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  return null;
}

// ============================================
// OCR avec Claude Vision (Multimodal)
// ============================================
async function extractTextWithClaudeVision(
  fileData: ArrayBuffer,
  mimeType: string,
  apiKey: string
): Promise<string> {
  const base64 = btoa(
    new Uint8Array(fileData).reduce((data, byte) => data + String.fromCharCode(byte), '')
  );

  // Claude accepte les images directement
  const mediaType = mimeType.startsWith('image/') ? mimeType : 'image/png';

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8000,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: base64,
            },
          },
          {
            type: 'text',
            text: `Extrais TOUT le texte de ce document de manière structurée.

Conserve:
- Les titres et sous-titres (marque-les avec # ou ##)
- Les listes et énumérations
- Les tableaux (format markdown)
- Les références normatives (DTU, NF, etc.)
- Les valeurs techniques (épaisseurs, résistances thermiques, etc.)

Retourne UNIQUEMENT le texte extrait, sans commentaire ni introduction.`
          }
        ]
      }]
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Claude Vision error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.content[0]?.text || '';
}

// Convertir PDF en images via pdf.js ou API externe
async function convertPdfToImages(pdfBuffer: ArrayBuffer): Promise<Uint8Array[]> {
  // Pour les PDFs, on retourne le buffer tel quel pour traitement ultérieur
  // En production, utiliser pdf.js ou une API de conversion
  return [new Uint8Array(pdfBuffer)];
}

// ============================================
// EMBEDDINGS (OpenAI)
// ============================================
async function generateEmbedding(text: string, apiKey: string) {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      input: text.substring(0, 8000),
      model: 'text-embedding-3-small',
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  return {
    embedding: data.data[0].embedding,
    tokens: data.usage?.total_tokens || 0,
  };
}

async function generateEmbeddingsBatch(texts: string[], apiKey: string) {
  const results = [];
  const batchSize = 20;

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: batch.map(t => t.substring(0, 8000)),
        model: 'text-embedding-3-small',
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const batchResults = data.data.map((item: any, idx: number) => ({
      embedding: item.embedding,
      tokens: Math.round((data.usage?.total_tokens || 0) / batch.length),
    }));
    results.push(...batchResults);
  }

  return results;
}

// ============================================
// TEXT PROCESSING
// ============================================
function cleanExtractedText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/\n{4,}/g, '\n\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function chunkText(text: string, options: { maxLength?: number; overlap?: number } = {}) {
  const { maxLength = 1500, overlap = 200 } = options;
  const chunks = [];
  const paragraphs = text.split(/\n\n+/);

  let currentChunk = '';
  let currentStart = 0;
  let charPosition = 0;

  for (const para of paragraphs) {
    if (currentChunk.length + para.length + 2 > maxLength && currentChunk.length > 0) {
      chunks.push({
        content: currentChunk.trim(),
        index: chunks.length,
        startChar: currentStart,
        endChar: charPosition,
      });

      const overlapText = currentChunk.slice(-overlap);
      currentChunk = overlapText + '\n\n' + para;
      currentStart = charPosition - overlap;
    } else {
      if (currentChunk.length === 0) {
        currentStart = charPosition;
      }
      currentChunk += (currentChunk ? '\n\n' : '') + para;
    }
    charPosition += para.length + 2;
  }

  if (currentChunk.trim()) {
    chunks.push({
      content: currentChunk.trim(),
      index: chunks.length,
      startChar: currentStart,
      endChar: charPosition,
    });
  }

  return chunks;
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
    console.error('Ingestion error:', error);
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

  // Valider le type de fichier (PDF, images, texte)
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
    message: 'Document uploade',
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

  if (fetchError || !doc) return errorResponse('Document non trouve');

  await supabase.from('knowledge_documents')
    .update({ status: 'processing' })
    .eq('id', documentId);

  try {
    const { data: fileData, error: dlError } = await supabase.storage
      .from('documents')
      .download(doc.file_path);

    if (dlError) throw dlError;

    let text: string;
    const claudeApiKey = Deno.env.get('CLAUDE_API_KEY');
    const isImage = doc.mime_type.startsWith('image/');
    const isPdf = doc.mime_type === 'application/pdf';

    // Utiliser OCR Claude Vision pour images et PDFs
    if (claudeApiKey && (isImage || isPdf)) {
      console.log('Using Claude Vision OCR for:', doc.mime_type);
      const buffer = await fileData.arrayBuffer();

      if (isImage) {
        // Images: envoyer directement à Claude Vision
        text = await extractTextWithClaudeVision(buffer, doc.mime_type, claudeApiKey);
      } else {
        // PDF: essayer extraction basique, fallback sur message d'erreur
        text = extractTextFromPdf(buffer);
        if (!text || text.length < 100) {
          // Texte trop court = extraction échouée
          // Note: Pour les PDFs, convertir en images d'abord serait idéal
          console.log('PDF extraction failed, text too short');
          text = `[Extraction PDF limitée - Convertir en images PNG pour OCR complet]\n\nContenu partiel:\n${text}`;
        }
      }
    } else if (isPdf) {
      const buffer = await fileData.arrayBuffer();
      text = extractTextFromPdf(buffer);
    } else {
      text = await fileData.text();
    }

    text = cleanExtractedText(text);
    const chunks = chunkText(text, { maxLength: 1500, overlap: 200 });

    const chunkData = chunks.map(chunk => ({
      document_id: documentId,
      content: chunk.content,
      content_length: chunk.content.length,
      chunk_index: chunk.index,
      metadata: { startChar: chunk.startChar, endChar: chunk.endChar }
    }));

    const { error: insertError } = await supabase
      .from('knowledge_chunks')
      .insert(chunkData);

    if (insertError) throw insertError;

    await supabase.from('knowledge_documents')
      .update({ chunks_count: chunks.length })
      .eq('id', documentId);

    return successResponse({
      message: 'Document traite',
      documentId,
      chunksCreated: chunks.length
    });

  } catch (error) {
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
  if (!openaiKey) return errorResponse('OPENAI_API_KEY non configuree');

  const { data: chunks, error: fetchError } = await supabase
    .from('knowledge_chunks')
    .select('id, content')
    .eq('document_id', documentId)
    .is('embedding', null);

  if (fetchError) throw fetchError;
  if (!chunks || chunks.length === 0) {
    return successResponse({ message: 'Deja indexe', documentId });
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

  return successResponse({
    message: 'Document indexe',
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

  if (error) return errorResponse('Document non trouve');

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
  return successResponse({ message: 'Supprime', documentId });
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

// ============================================
// HELPERS
// ============================================
function extractTextFromPdf(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const text = new TextDecoder('latin1').decode(bytes);
  const textParts: string[] = [];
  const streamRegex = /stream\s*([\s\S]*?)\s*endstream/g;
  let match;

  while ((match = streamRegex.exec(text)) !== null) {
    const content = match[1];
    const textMatches = content.match(/\(([^)]*)\)\s*Tj/g);
    if (textMatches) {
      textMatches.forEach(m => {
        const extracted = m.match(/\(([^)]*)\)/);
        if (extracted) textParts.push(extracted[1]);
      });
    }
  }

  if (textParts.length === 0) {
    const asciiRegex = /[\x20-\x7E]{10,}/g;
    const asciiMatches = text.match(asciiRegex);
    if (asciiMatches) {
      return asciiMatches.filter(s => !s.includes('/') && !s.includes('<')).join(' ');
    }
  }

  return textParts.join(' ');
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
