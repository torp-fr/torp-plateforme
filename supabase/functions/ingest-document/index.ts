import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import {
  generateEmbeddingsBatch,
  chunkText,
  cleanExtractedText,
  extractSections
} from '../_shared/embeddings.ts';

/**
 * Endpoint d'ingestion de documents pour la base de connaissances
 *
 * Actions:
 * - upload: Upload et enregistre un document
 * - process: Extrait le texte et crée les chunks
 * - index: Génère les embeddings et indexe
 * - status: Vérifie le statut d'un document
 * - list: Liste les documents
 * - delete: Supprime un document
 */

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const contentType = req.headers.get('content-type') || '';

    // Upload multipart (drag & drop)
    if (contentType.includes('multipart/form-data')) {
      return handleFileUpload(req, supabase);
    }

    // Actions JSON
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

  // Valider le type de fichier
  const allowedTypes = ['application/pdf', 'text/plain', 'text/markdown'];
  if (!allowedTypes.includes(file.type) && !file.name.endsWith('.md')) {
    return errorResponse('Type de fichier non supporté. Utilisez PDF, TXT ou MD.');
  }

  // Générer un nom unique
  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const storagePath = `knowledge/${timestamp}_${safeName}`;

  // Upload vers Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from('documents')
    .upload(storagePath, file, {
      contentType: file.type,
      upsert: false
    });

  if (uploadError) {
    // Créer le bucket s'il n'existe pas
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

  // Enregistrer dans la base
  const docData = {
    filename: safeName,
    original_name: file.name,
    file_path: storagePath,
    file_size: file.size,
    mime_type: file.type || 'application/pdf',
    doc_type: metadata.doc_type || 'autre',
    category: metadata.category || null,
    subcategory: metadata.subcategory || null,
    code_reference: metadata.code_reference || null,
    title: metadata.title || file.name,
    version: metadata.version || null,
    date_publication: metadata.date_publication || null,
    organisme: metadata.organisme || null,
    status: 'pending'
  };

  const { data: doc, error: dbError } = await supabase
    .from('knowledge_documents')
    .insert(docData)
    .select()
    .single();

  if (dbError) throw dbError;

  return successResponse({
    message: 'Document uploadé avec succès',
    document: doc,
    nextStep: 'Appelez action "process" pour extraire le contenu'
  });
}

async function handleProcess(body: any, supabase: any) {
  const { documentId } = body;

  if (!documentId) {
    return errorResponse('documentId requis');
  }

  // Récupérer le document
  const { data: doc, error: fetchError } = await supabase
    .from('knowledge_documents')
    .select('*')
    .eq('id', documentId)
    .single();

  if (fetchError || !doc) {
    return errorResponse('Document non trouvé');
  }

  // Mettre à jour le statut
  await supabase
    .from('knowledge_documents')
    .update({ status: 'processing' })
    .eq('id', documentId);

  try {
    // Télécharger le fichier
    const { data: fileData, error: dlError } = await supabase.storage
      .from('documents')
      .download(doc.file_path);

    if (dlError) throw dlError;

    // Extraire le texte selon le type
    let text: string;

    if (doc.mime_type === 'application/pdf') {
      // Pour les PDFs, on utilise une extraction basique
      // En production, utilisez pdf-parse ou appelez extract-pdf
      const buffer = await fileData.arrayBuffer();
      text = await extractTextFromPdf(buffer);
    } else {
      // Fichiers texte
      text = await fileData.text();
    }

    // Nettoyer le texte
    text = cleanExtractedText(text);

    // Découper en chunks
    const chunks = chunkText(text, {
      maxLength: 1500,
      overlap: 200,
      preserveParagraphs: true
    });

    // Extraire les sections pour enrichir les métadonnées
    const sections = extractSections(text);

    // Enrichir les chunks avec les titres de section
    const enrichedChunks = chunks.map(chunk => {
      // Trouver la section correspondante
      const section = sections.find(s =>
        chunk.startChar >= text.indexOf(s.content) &&
        chunk.startChar < text.indexOf(s.content) + s.content.length
      );

      return {
        document_id: documentId,
        content: chunk.content,
        content_length: chunk.content.length,
        chunk_index: chunk.index,
        section_title: section?.title || null,
        metadata: {
          startChar: chunk.startChar,
          endChar: chunk.endChar
        }
      };
    });

    // Insérer les chunks (sans embeddings pour l'instant)
    const { error: insertError } = await supabase
      .from('knowledge_chunks')
      .insert(enrichedChunks);

    if (insertError) throw insertError;

    // Mettre à jour le document
    await supabase
      .from('knowledge_documents')
      .update({
        status: 'processing', // Reste en processing jusqu'à l'indexation
        chunks_count: chunks.length
      })
      .eq('id', documentId);

    return successResponse({
      message: 'Document traité avec succès',
      documentId,
      chunksCreated: chunks.length,
      sectionsFound: sections.length,
      nextStep: 'Appelez action "index" pour générer les embeddings'
    });

  } catch (error) {
    await supabase
      .from('knowledge_documents')
      .update({
        status: 'error',
        processing_error: String(error)
      })
      .eq('id', documentId);

    throw error;
  }
}

async function handleIndex(body: any, supabase: any) {
  const { documentId } = body;

  if (!documentId) {
    return errorResponse('documentId requis');
  }

  const openaiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiKey) {
    return errorResponse('OPENAI_API_KEY non configurée pour les embeddings');
  }

  // Récupérer les chunks sans embedding
  const { data: chunks, error: fetchError } = await supabase
    .from('knowledge_chunks')
    .select('id, content')
    .eq('document_id', documentId)
    .is('embedding', null);

  if (fetchError) throw fetchError;

  if (!chunks || chunks.length === 0) {
    return successResponse({
      message: 'Tous les chunks sont déjà indexés',
      documentId
    });
  }

  // Générer les embeddings par batch
  const texts = chunks.map((c: any) => c.content);
  const embeddings = await generateEmbeddingsBatch(texts, openaiKey);

  // Mettre à jour les chunks avec les embeddings
  let indexed = 0;
  for (let i = 0; i < chunks.length; i++) {
    const { error: updateError } = await supabase
      .from('knowledge_chunks')
      .update({ embedding: embeddings[i].embedding })
      .eq('id', chunks[i].id);

    if (!updateError) indexed++;
  }

  // Mettre à jour le statut du document
  await supabase
    .from('knowledge_documents')
    .update({
      status: 'indexed',
      indexed_at: new Date().toISOString()
    })
    .eq('id', documentId);

  return successResponse({
    message: 'Document indexé avec succès',
    documentId,
    chunksIndexed: indexed,
    totalTokensUsed: embeddings.reduce((sum, e) => sum + e.tokens, 0)
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

  // Compter les chunks indexés
  const { count } = await supabase
    .from('knowledge_chunks')
    .select('*', { count: 'exact', head: true })
    .eq('document_id', documentId)
    .not('embedding', 'is', null);

  return successResponse({
    document: doc,
    chunksIndexed: count || 0
  });
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

  const { data, error, count } = await query;

  if (error) throw error;

  return successResponse({
    documents: data,
    total: count
  });
}

async function handleDelete(body: any, supabase: any) {
  const { documentId } = body;

  // Récupérer le document pour le chemin du fichier
  const { data: doc } = await supabase
    .from('knowledge_documents')
    .select('file_path')
    .eq('id', documentId)
    .single();

  // Supprimer le fichier du storage
  if (doc?.file_path) {
    await supabase.storage
      .from('documents')
      .remove([doc.file_path]);
  }

  // Supprimer le document (cascade supprime les chunks)
  const { error } = await supabase
    .from('knowledge_documents')
    .delete()
    .eq('id', documentId);

  if (error) throw error;

  return successResponse({ message: 'Document supprimé', documentId });
}

async function handleStats(supabase: any) {
  const { data, error } = await supabase.rpc('get_knowledge_stats');

  if (error) throw error;

  // Stats globales
  const { count: totalDocs } = await supabase
    .from('knowledge_documents')
    .select('*', { count: 'exact', head: true });

  const { count: indexedDocs } = await supabase
    .from('knowledge_documents')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'indexed');

  const { count: totalChunks } = await supabase
    .from('knowledge_chunks')
    .select('*', { count: 'exact', head: true });

  return successResponse({
    totalDocuments: totalDocs,
    indexedDocuments: indexedDocs,
    totalChunks: totalChunks,
    byCategory: data
  });
}

// ============================================
// HELPERS
// ============================================

async function extractTextFromPdf(buffer: ArrayBuffer): Promise<string> {
  // Extraction basique - en production, utilisez pdf-parse
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
    // Fallback: extraire les chaînes ASCII lisibles
    const asciiRegex = /[\x20-\x7E]{10,}/g;
    const asciiMatches = text.match(asciiRegex);
    if (asciiMatches) {
      return asciiMatches
        .filter(s => !s.includes('/') && !s.includes('<'))
        .join(' ');
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
