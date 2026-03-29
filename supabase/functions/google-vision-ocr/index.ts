/**
 * Supabase Edge Function: Google Cloud Vision OCR
 *
 * Extracts text from scanned PDFs using Google Cloud Vision API
 * Called as fallback when pdfjs returns empty text
 *
 * Requires:
 * - GOOGLE_CLOUD_PROJECT_ID: GCP project ID
 * - GOOGLE_CLOUD_API_KEY: GCP API key with Vision API enabled
 * Or:
 * - GOOGLE_CLOUD_CREDENTIALS: Service account JSON (base64 encoded)
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface OCRRequest {
  imageData: string; // base64 encoded PDF or image
  mimeType: string; // e.g., 'application/pdf', 'image/png'
  filename?: string;
}

interface OCRResponse {
  text: string;
  confidence: number;
  pages_processed: number;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  // Only accept POST
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Only POST method is allowed" }),
      {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  try {
    const body = (await req.json()) as OCRRequest;

    if (!body.imageData) {
      return new Response(
        JSON.stringify({ error: "Missing imageData" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("[Vision OCR] Processing document:", body.filename || "unknown");
    console.log("[Vision OCR] MIME type:", body.mimeType);

    // Get API credentials from environment
    const apiKey = Deno.env.get("GOOGLE_CLOUD_API_KEY");
    const projectId = Deno.env.get("GOOGLE_CLOUD_PROJECT_ID");

    if (!apiKey || !projectId) {
      console.error("[Vision OCR] Missing Google Cloud credentials");
      return new Response(
        JSON.stringify({
          error: "Server configuration error: Google Cloud Vision API not configured",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Call Google Cloud Vision API
    // Documentation: https://cloud.google.com/vision/docs/ocr
    const visionUrl =
      `https://vision.googleapis.com/v1/projects/${projectId}/images:annotate?key=${apiKey}`;

    console.log("[Vision OCR] Calling Google Cloud Vision API");

    const visionResponse = await fetch(visionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        requests: [
          {
            image: {
              content: body.imageData, // base64 encoded
            },
            features: [
              {
                type: "DOCUMENT_TEXT_DETECTION", // Better for multi-page PDFs
                maxResults: 1,
              },
            ],
            imageContext: {
              languageHints: ["fr", "en"], // French and English hints
            },
          },
        ],
      }),
    });

    if (!visionResponse.ok) {
      const errorData = await visionResponse.text();
      console.error("[Vision OCR] API error:", errorData);
      throw new Error(`Vision API returned ${visionResponse.status}: ${errorData}`);
    }

    const result = await visionResponse.json();

    // Extract text from Vision API response
    if (
      !result.responses ||
      !result.responses[0] ||
      !result.responses[0].fullTextAnnotation
    ) {
      console.log("[Vision OCR] No text detected in document");
      return new Response(
        JSON.stringify({
          text: "",
          confidence: 0,
          pages_processed: 0,
        } as OCRResponse),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const fullTextAnnotation = result.responses[0].fullTextAnnotation;
    const extractedText = fullTextAnnotation.text || "";

    console.log("[Vision OCR] ✅ Text extraction completed");
    console.log("[Vision OCR] Extracted text length:", extractedText.length);

    // Calculate confidence (average confidence of all text elements)
    let totalConfidence = 0;
    let elementCount = 0;

    if (fullTextAnnotation.pages) {
      for (const page of fullTextAnnotation.pages) {
        if (page.blocks) {
          for (const block of page.blocks) {
            if (block.confidence) {
              totalConfidence += block.confidence;
              elementCount++;
            }
          }
        }
      }
    }

    const confidence = elementCount > 0 ? totalConfidence / elementCount : 0.5;
    const pagesProcessed = fullTextAnnotation.pages?.length || 1;

    return new Response(
      JSON.stringify({
        text: extractedText,
        confidence: Math.round(confidence * 100) / 100,
        pages_processed: pagesProcessed,
      } as OCRResponse),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    const errorMessage =
      err instanceof Error ? err.message : JSON.stringify(err);

    console.error("[Vision OCR] ❌ Error:", errorMessage);

    return new Response(
      JSON.stringify({ error: "OCR processing failed", details: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
