import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

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

function extractBasicPdfText(buffer: ArrayBuffer): string {
  try {
    const decoder = new TextDecoder('latin1');
    const text = decoder.decode(buffer);

    const textParts: string[] = [];

    // Extract text from PDF text objects (between BT and ET markers)
    const textObjectRegex = /BT\s+(.*?)\s+ET/gs;
    const matches = text.matchAll(textObjectRegex);

    for (const match of matches) {
      const textBlock = match[1];

      // Extract strings from parentheses () which contain the actual text
      const stringRegex = /\(([^)]*)\)/g;
      const strings = textBlock.matchAll(stringRegex);

      for (const str of strings) {
        let extracted = str[1];

        // Decode PDF string escapes
        extracted = extracted
          .replace(/\\n/g, '\n')
          .replace(/\\r/g, '\r')
          .replace(/\\t/g, '\t')
          .replace(/\\\(/g, '(')
          .replace(/\\\)/g, ')')
          .replace(/\\\\/g, '\\');

        if (extracted.trim().length > 0) {
          textParts.push(extracted);
        }
      }
    }

    // Also try to extract text from Tj/TJ operators
    const tjRegex = /\(((?:[^\\)]|\\.)*?)\)\s*Tj/g;
    const tjMatches = text.matchAll(tjRegex);

    for (const match of tjMatches) {
      let extracted = match[1];
      extracted = extracted
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\r')
        .replace(/\\t/g, '\t')
        .replace(/\\\(/g, '(')
        .replace(/\\\)/g, ')')
        .replace(/\\\\/g, '\\');

      if (extracted.trim().length > 0 && !textParts.includes(extracted)) {
        textParts.push(extracted);
      }
    }

    const result = textParts.join(' ').trim();

    // If we extracted very little text, it might be a scanned PDF
    if (result.length < 50) {
      return '';
    }

    return result;
  } catch (error) {
    console.log(`[PDF] Basic extraction failed: ${error.message}`);
    return '';
  }
}

async function ocrVisionImage(buffer: ArrayBuffer, mimeType: string, anthropicKey?: string, openaiKey?: string): Promise<string> {
  const base64 = bufferToBase64(buffer);

  // Anthropic API
  if (anthropicKey) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4000,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64 } },
            { type: 'text', text: 'Extrais TOUT le texte de ce document. Conserve les titres, tableaux, valeurs techniques, listes et références.' }
          ]
        }]
      })
    });
    if (res.ok) {
      const data = await res.json();
      console.log('[OCR] ✅ Anthropic Vision OCR successful');
      return data.content[0]?.text || '';
    } else {
      const error = await res.text();
      console.log(`[OCR] ❌ Anthropic failed (${res.status}): ${error.substring(0, 200)}`);
    }
  }

  // OpenAI API
  if (openaiKey) {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o',
        max_tokens: 4000,
        messages: [{
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
            { type: 'text', text: 'Extrais TOUT le texte de ce document. Conserve les titres, tableaux, valeurs techniques.' }
          ]
        }]
      })
    });
    if (res.ok) {
      const data = await res.json();
      console.log('[OCR] ✅ OpenAI Vision OCR successful');
      return data.choices[0]?.message?.content || '';
    } else {
      const error = await res.text();
      console.log(`[OCR] ❌ OpenAI failed (${res.status}): ${error.substring(0, 200)}`);
    }
  }

  throw new Error('Toutes les APIs Vision ont échoué');
}

// Estimate tokens from character count (conservative: 1 token ≈ 3.5 chars)
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.5);
}

async function generateEmbeddings(texts: string[], apiKey: string): Promise<any[]> {
  // Log token estimation for this batch
  const totalChars = texts.reduce((sum, t) => sum + t.length, 0);
  const estimatedTokens = estimateTokens(totalChars.toString());
  console.log(`[Embeddings] Batch: ${texts.length} chunks, ${totalChars} chars, ~${estimatedTokens} tokens estimated`);

  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ input: texts, model: 'text-embedding-3-small' })
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`OpenAI Embeddings API failed (${res.status}): ${error.substring(0, 200)}`);
  }

  const data = await res.json();

  if (!data.data || !Array.isArray(data.data)) {
    throw new Error('Invalid response from OpenAI Embeddings API');
  }

  return data.data.map((item: any) => ({ embedding: item.embedding, tokens: 0 }));
}

function chunkText(text: string): any[] {
  const chunks: any[] = [];
  const MAX_CHUNK_SIZE = 1500; // ~430 tokens max (conservative: 1 token ≈ 3.5 chars)
  const paragraphs = text.split(/\n\n+/);
  let current = '', idx = 0, start = 0, pos = 0;

  for (const p of paragraphs) {
    const para = p + '\n\n';

    // If paragraph itself is too large, force-split it
    if (para.length > MAX_CHUNK_SIZE) {
      if (current.trim()) {
        chunks.push({ content: current.trim(), index: idx++, startChar: start, endChar: pos });
      }

      // Split the large paragraph into smaller pieces with succession
      for (let i = 0; i < para.length; i += MAX_CHUNK_SIZE) {
        const piece = para.slice(i, Math.min(i + MAX_CHUNK_SIZE, para.length));
        if (piece.trim().length > 0) {
          chunks.push({ content: piece.trim(), index: idx++, startChar: pos + i, endChar: pos + i + piece.length });
        }
      }

      current = '';
      start = pos + para.length;
    } else if (current.length + para.length > MAX_CHUNK_SIZE && current.length > 0) {
      // Normal chunking with small overlap for context continuity
      chunks.push({ content: current.trim(), index: idx++, startChar: start, endChar: pos });
      current = current.slice(-150) + para; // Reduced overlap for better distribution
      start = pos - 150;
    } else {
      current += para;
    }
    pos += para.length;
  }

  // Handle remaining text with succession
  if (current.trim()) {
    if (current.length > MAX_CHUNK_SIZE) {
      for (let i = 0; i < current.length; i += MAX_CHUNK_SIZE) {
        const piece = current.slice(i, Math.min(i + MAX_CHUNK_SIZE, current.length));
        if (piece.trim().length > 0) {
          chunks.push({ content: piece.trim(), index: idx++, startChar: start + i, endChar: start + i + piece.length });
        }
      }
    } else {
      chunks.push({ content: current.trim(), index: idx, startChar: start, endChar: pos });
    }
  }

  // Calculate and log statistics
  const avgChunkSize = chunks.reduce((sum, c) => sum + c.content.length, 0) / chunks.length;
  const maxChunkSize = Math.max(...chunks.map(c => c.content.length));
  console.log(`[Chunking] Created ${chunks.length} chunks from ${text.length} characters (avg: ${Math.round(avgChunkSize)}, max: ${maxChunkSize})`);

  return chunks;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  try {
    // Health check for GET requests
    if (req.method === 'GET') {
      return new Response(JSON.stringify({ success: true, message: 'ingest-document function is running', timestamp: new Date().toISOString() }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File;
      if (!file) throw new Error('Fichier requis');

      const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const path = `knowledge/${Date.now()}_${safeName}`;

      const { error: uploadErr } = await supabase.storage.from('documents').upload(path, file);
      if (uploadErr) throw uploadErr;

      const { data: doc, error: dbErr } = await supabase.from('knowledge_documents').insert({
        filename: safeName,
        original_name: file.name,
        file_path: path,
        file_size: file.size,
        mime_type: file.type,
        doc_type: 'autre',
        title: file.name,
        status: 'pending'
      }).select().single();

      if (dbErr) throw dbErr;
      return new Response(JSON.stringify({ success: true, documentId: doc.id, document: doc }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Parse JSON body for POST requests
    const body = await req.json().catch(() => ({}));
    const { action, documentId } = body;

    if (!action) {
      return new Response(JSON.stringify({ success: false, error: 'Action requise (process, index, list, delete)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'process') {
      const { data: doc } = await supabase.from('knowledge_documents').select('*').eq('id', documentId).single();
      if (!doc) throw new Error('Document non trouvé');

      await supabase.from('knowledge_documents').update({ status: 'processing' }).eq('id', documentId);

      const { data: fileData } = await supabase.storage.from('documents').download(doc.file_path);
      const buffer = await fileData!.arrayBuffer();

      let text = '';
      let method = '';

      if (doc.mime_type === 'application/pdf') {
        // Try basic PDF text extraction first
        text = extractBasicPdfText(buffer);

        if (text.length > 0) {
          method = 'PDF text extraction';
          console.log(`[PDF] ✅ Extracted ${text.length} characters`);
        } else {
          // PDF appears to be scanned or encrypted
          console.log('[PDF] ⚠️ No extractable text - likely scanned or encrypted');
          text = '⚠️ Ce PDF ne contient pas de texte extractible. Il s\'agit probablement d\'un scan ou d\'un PDF protégé. Pour traiter ce document, veuillez le convertir en images (PNG/JPG) et les uploader séparément.';
          method = 'PDF scan detection';
        }
      } else if (doc.mime_type.startsWith('image/')) {
        // Use Vision OCR for images only
        const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
        const openaiKey = Deno.env.get('OPENAI_API_KEY');
        console.log(`[DEBUG] ANTHROPIC_API_KEY exists: ${!!anthropicKey}, OPENAI_API_KEY exists: ${!!openaiKey}`);
        text = await ocrVisionImage(buffer, doc.mime_type, anthropicKey, openaiKey);
        method = 'Vision OCR';
      } else {
        // Plain text files
        text = new TextDecoder().decode(new Uint8Array(buffer));
        method = 'text';
      }

      const chunks = chunkText(text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '').trim());
      const chunkData = chunks.map(c => ({
        document_id: documentId,
        content: c.content,
        content_length: c.content.length,
        chunk_index: c.index,
        metadata: { method }
      }));

      await supabase.from('knowledge_chunks').insert(chunkData);
      await supabase.from('knowledge_documents').update({ chunks_count: chunks.length, status: 'processed' }).eq('id', documentId);

      return new Response(JSON.stringify({ success: true, chunksCreated: chunks.length, method }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'index') {
      const openaiKey = Deno.env.get('OPENAI_API_KEY');
      if (!openaiKey) throw new Error('OPENAI_API_KEY requis');

      const { data: chunks } = await supabase.from('knowledge_chunks').select('id, content').eq('document_id', documentId).is('embedding', null);
      if (!chunks?.length) return new Response(JSON.stringify({ success: true, message: 'Déjà indexé' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      // Process embeddings with dynamic batch sizing based on token estimation
      // Target: max 250k tokens per batch (safety margin under 300k limit)
      const MAX_BATCH_TOKENS = 250000;
      const MAX_BATCH_SIZE = 20; // Max chunks per batch for safety
      let totalProcessed = 0;
      let batchNum = 0;

      let i = 0;
      while (i < chunks.length) {
        const batch: any[] = [];
        let batchTokens = 0;

        // Build dynamic batch based on token count
        while (i < chunks.length && batch.length < MAX_BATCH_SIZE) {
          const chunkTokens = estimateTokens(chunks[i].content);

          // Check if adding this chunk would exceed limits
          if (batchTokens + chunkTokens > MAX_BATCH_TOKENS && batch.length > 0) {
            break; // Start new batch
          }

          batch.push(chunks[i]);
          batchTokens += chunkTokens;
          i++;
        }

        batchNum++;
        console.log(`[Embeddings] Processing batch ${batchNum}/${Math.ceil(chunks.length / MAX_BATCH_SIZE)} (${batch.length} chunks, ~${batchTokens} tokens)`);

        const embeddings = await generateEmbeddings(batch.map((c: any) => c.content), openaiKey);

        for (let j = 0; j < batch.length; j++) {
          await supabase.from('knowledge_chunks').update({ embedding: embeddings[j].embedding }).eq('id', batch[j].id);
        }

        totalProcessed += batch.length;
      }

      await supabase.from('knowledge_documents').update({ status: 'indexed', indexed_at: new Date().toISOString() }).eq('id', documentId);
      return new Response(JSON.stringify({ success: true, chunksIndexed: totalProcessed }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'list') {
      const { data } = await supabase.from('knowledge_documents').select('*').order('created_at', { ascending: false }).limit(50);
      return new Response(JSON.stringify({ success: true, documents: data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'delete') {
      const { data: doc } = await supabase.from('knowledge_documents').select('file_path').eq('id', documentId).single();
      if (doc?.file_path) await supabase.storage.from('documents').remove([doc.file_path]);
      await supabase.from('knowledge_documents').delete().eq('id', documentId);
      return new Response(JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'stats') {
      const { count: totalDocs } = await supabase.from('knowledge_documents').select('*', { count: 'exact', head: true });
      const { count: totalChunks } = await supabase.from('knowledge_chunks').select('*', { count: 'exact', head: true });
      const { data: byType } = await supabase.from('knowledge_documents').select('doc_type').eq('status', 'indexed');

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

      return new Response(JSON.stringify({ success: true, stats }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    throw new Error(`Action inconnue: ${action}`);

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ success: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
