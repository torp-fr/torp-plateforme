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

async function extractPdfText(buffer: ArrayBuffer): Promise<string> {
  const pdfjsLib = await import('https://esm.sh/pdfjs-dist@4.0.379/build/pdf.mjs');
  const pdf = await pdfjsLib.getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
    isEvalSupported: false,
    useWorkerFetch: false,
    disableWorker: true,
  }).promise;

  const textParts: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map((item: any) => item.str).join(' ');
    if (pageText.trim()) textParts.push(`\n\n=== Page ${i} ===\n\n${pageText}`);
  }
  return textParts.join('\n');
}

async function ocrVision(buffer: ArrayBuffer, anthropicKey?: string, openaiKey?: string): Promise<string> {
  const base64 = bufferToBase64(buffer);
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
            { type: 'image', source: { type: 'base64', media_type: 'image/png', data: base64 } },
            { type: 'text', text: 'Extrais TOUT le texte de ce document. Conserve les titres, tableaux, valeurs techniques, listes et références.' }
          ]
        }]
      })
    });
    if (res.ok) return (await res.json()).content[0]?.text || '';
  }
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
            { type: 'image_url', image_url: { url: `data:image/png;base64,${base64}` } },
            { type: 'text', text: 'Extrais TOUT le texte de ce document. Conserve les titres, tableaux, valeurs techniques.' }
          ]
        }]
      })
    });
    if (res.ok) return (await res.json()).choices[0]?.message?.content || '';
  }
  throw new Error('Aucune clé API Vision');
}

async function generateEmbeddings(texts: string[], apiKey: string): Promise<any[]> {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ input: texts, model: 'text-embedding-3-small' })
  });
  const data = await res.json();
  return data.data.map((item: any) => ({ embedding: item.embedding, tokens: 0 }));
}

function chunkText(text: string): any[] {
  const chunks: any[] = [];
  const paragraphs = text.split(/\n\n+/);
  let current = '', idx = 0, start = 0, pos = 0;

  for (const p of paragraphs) {
    const para = p + '\n\n';
    if (current.length + para.length > 1500 && current.length > 0) {
      chunks.push({ content: current.trim(), index: idx++, startChar: start, endChar: pos });
      current = current.slice(-200) + para;
      start = pos - 200;
    } else {
      current += para;
    }
    pos += para.length;
  }
  if (current.trim()) chunks.push({ content: current.trim(), index: idx, startChar: start, endChar: pos });
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
        try {
          text = await extractPdfText(buffer);
          method = 'pdf.js';
          console.log(`[OCR] ✅ pdf.js: ${text.length} chars`);
        } catch (e) {
          console.log('[OCR] pdf.js failed, using Vision');
          text = await ocrVision(buffer, Deno.env.get('ANTHROPIC_API_KEY'), Deno.env.get('OPENAI_API_KEY'));
          method = 'Vision OCR';
        }
      } else if (doc.mime_type.startsWith('image/')) {
        text = await ocrVision(buffer, Deno.env.get('ANTHROPIC_API_KEY'), Deno.env.get('OPENAI_API_KEY'));
        method = 'Vision OCR';
      } else {
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

      const embeddings = await generateEmbeddings(chunks.map((c: any) => c.content), openaiKey);
      for (let i = 0; i < chunks.length; i++) {
        await supabase.from('knowledge_chunks').update({ embedding: embeddings[i].embedding }).eq('id', chunks[i].id);
      }

      await supabase.from('knowledge_documents').update({ status: 'indexed', indexed_at: new Date().toISOString() }).eq('id', documentId);
      return new Response(JSON.stringify({ success: true, chunksIndexed: chunks.length }),
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

    throw new Error(`Action inconnue: ${action}`);

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ success: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
