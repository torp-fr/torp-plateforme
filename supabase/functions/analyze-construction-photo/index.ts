/**
 * Edge Function: analyze-construction-photo
 * Analyse les photos de chantier avec GPT-4o Vision
 *
 * Usage:
 * POST /functions/v1/analyze-construction-photo
 * Body: { photoUrl: string, context?: { zone?: string, typeAttendu?: string } }
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PhotoAnalysisRequest {
  photoUrl: string;
  projetId?: string;
  lotId?: string;
  context?: {
    zone?: string;
    typeAttendu?: string;
  };
}

interface DetectedElement {
  type: string;
  description: string;
  zone: string;
  etat: 'bon' | 'acceptable' | 'deteriore' | 'critique';
  confiance: number;
}

interface Anomaly {
  type: 'securite' | 'qualite' | 'avancement' | 'organisation';
  severite: 'faible' | 'moyenne' | 'elevee' | 'critique';
  description: string;
  localisation: string;
  actionRequise: string;
  priorite: number;
}

interface PhotoAnalysisResult {
  elementsDetectes: DetectedElement[];
  anomalies: Anomaly[];
  avancementEstime: number;
  conformiteGenerale: 'conforme' | 'attention' | 'non_conforme';
  commentaireIA: string;
  tagsAutomatiques: string[];
  confiance: number;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const startTime = Date.now();

    // Parse request body
    const { photoUrl, projetId, lotId, context }: PhotoAnalysisRequest = await req.json();

    if (!photoUrl) {
      return new Response(JSON.stringify({ error: 'photoUrl is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get OpenAI API key
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      return new Response(JSON.stringify({ error: 'OpenAI API key not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build the prompt
    const prompt = `Tu es un expert en contrôle de chantier BTP. Analyse cette photo de chantier et fournis une évaluation détaillée.

${context?.zone ? `Zone: ${context.zone}` : ''}
${context?.typeAttendu ? `Type de travaux attendu: ${context.typeAttendu}` : ''}

Analyse la photo et retourne un JSON avec:
1. "elementsDetectes": liste des éléments visibles avec {type, description, zone, etat, confiance}
   - etat: "bon", "acceptable", "deteriore", "critique"
   - confiance: 0-100
2. "anomalies": liste des problèmes détectés avec {type, severite, description, localisation, actionRequise, priorite}
   - type: "securite", "qualite", "avancement", "organisation"
   - severite: "faible", "moyenne", "elevee", "critique"
   - priorite: 1-5 (1 = le plus urgent)
3. "avancementEstime": estimation du % d'avancement visible (0-100)
4. "conformiteGenerale": "conforme", "attention", "non_conforme"
5. "commentaireIA": synthèse de l'analyse en 2-3 phrases
6. "tagsAutomatiques": liste de tags descriptifs (max 10)
7. "confiance": niveau de confiance global de l'analyse (0-100)

Sois particulièrement attentif aux:
- Équipements de sécurité (EPI, garde-corps, signalisation)
- Qualité des travaux visibles (alignements, finitions)
- Organisation du chantier (stockage, propreté)
- Conformité aux bonnes pratiques BTP

Réponds uniquement en JSON valide.`;

    // Call OpenAI GPT-4o Vision API
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: photoUrl, detail: 'high' } },
            ],
          },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 2000,
        temperature: 0.3,
      }),
    });

    if (!openaiResponse.ok) {
      const error = await openaiResponse.text();
      console.error('OpenAI API error:', error);
      return new Response(JSON.stringify({ error: 'Failed to analyze image', details: error }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const openaiData = await openaiResponse.json();
    const analysisContent = openaiData.choices?.[0]?.message?.content;

    if (!analysisContent) {
      return new Response(JSON.stringify({ error: 'No analysis returned from AI' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse the analysis
    const analysis: PhotoAnalysisResult = JSON.parse(analysisContent);

    // Calculate processing time
    const processingTime = Date.now() - startTime;

    // If projetId is provided, save to database
    if (projetId) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      await supabase.from('photo_analyses').insert({
        projet_id: projetId,
        lot_id: lotId,
        photo_url: photoUrl,
        zone: context?.zone,
        elements_detectes: analysis.elementsDetectes,
        anomalies: analysis.anomalies,
        avancement_estime: analysis.avancementEstime,
        conformite_generale: analysis.conformiteGenerale,
        commentaire_ia: analysis.commentaireIA,
        tags: analysis.tagsAutomatiques,
        confiance: analysis.confiance,
        modele_ia: 'gpt-4o',
        temps_analyse_ms: processingTime,
      });
    }

    // Return the analysis
    return new Response(
      JSON.stringify({
        success: true,
        analysis,
        metadata: {
          processingTimeMs: processingTime,
          model: 'gpt-4o',
          savedToDatabase: !!projetId,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in analyze-construction-photo:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
