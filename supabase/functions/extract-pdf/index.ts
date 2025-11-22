import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, handleCors } from '../_shared/cors.ts';

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const contentType = req.headers.get('content-type') || '';
    let pdfBuffer: ArrayBuffer;
    let filename = 'document.pdf';

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File;
      if (!file) {
        return new Response(
          JSON.stringify({ error: 'Fichier PDF requis' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      pdfBuffer = await file.arrayBuffer();
      filename = file.name;
    } else {
      // URL mode - fetch from storage
      const { fileUrl, storagePath } = await req.json();

      if (storagePath) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        const { data, error } = await supabase.storage
          .from('devis')
          .download(storagePath);

        if (error || !data) {
          return new Response(
            JSON.stringify({ error: 'Fichier non trouvé dans storage' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        pdfBuffer = await data.arrayBuffer();
      } else if (fileUrl) {
        const response = await fetch(fileUrl);
        if (!response.ok) {
          return new Response(
            JSON.stringify({ error: 'Impossible de télécharger le fichier' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        pdfBuffer = await response.arrayBuffer();
      } else {
        return new Response(
          JSON.stringify({ error: 'fileUrl ou storagePath requis' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Basic PDF text extraction using pdf-parse equivalent
    // Note: For production, use a more robust PDF library
    const textContent = await extractTextFromPdf(pdfBuffer);

    return new Response(
      JSON.stringify({
        success: true,
        text: textContent,
        filename,
        size: pdfBuffer.byteLength
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function extractTextFromPdf(buffer: ArrayBuffer): Promise<string> {
  // Simple text extraction - looks for text streams in PDF
  const bytes = new Uint8Array(buffer);
  const text = new TextDecoder('latin1').decode(bytes);

  // Extract text between stream markers (basic approach)
  const textParts: string[] = [];
  const streamRegex = /stream\s*([\s\S]*?)\s*endstream/g;
  let match;

  while ((match = streamRegex.exec(text)) !== null) {
    const content = match[1];
    // Look for text operators: Tj, TJ, '
    const textMatches = content.match(/\(([^)]*)\)\s*Tj/g);
    if (textMatches) {
      textMatches.forEach(m => {
        const extracted = m.match(/\(([^)]*)\)/);
        if (extracted) textParts.push(extracted[1]);
      });
    }
  }

  // Fallback: extract readable ASCII strings
  if (textParts.length === 0) {
    const asciiRegex = /[\x20-\x7E]{10,}/g;
    const asciiMatches = text.match(asciiRegex);
    if (asciiMatches) {
      return asciiMatches
        .filter(s => !s.includes('/') && !s.includes('<'))
        .join(' ');
    }
  }

  return textParts.join(' ') || 'Extraction échouée - PDF complexe';
}
