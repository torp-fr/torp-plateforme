/**
 * Edge Function: analyze-photo
 * Analyse de photos via GPT-4 Vision pour:
 * - Diagnostic bâtiment (pathologies, état général)
 * - Suivi de chantier (avancement, qualité, problèmes)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AnalysisRequest {
  imageUrl: string;
  analysisType: 'construction' | 'diagnostic';
  context?: {
    lotCode?: string;
    projectType?: string;
    yearBuilt?: number;
    type?: string;
    expectedPhase?: string;
    knownIssues?: string[];
  };
}

const DIAGNOSTIC_SYSTEM_PROMPT = `Tu es un expert en diagnostic bâtiment avec 20 ans d'expérience.
Analyse cette photo et identifie:

1. **Pathologies visibles** - Pour chaque pathologie détectée:
   - type: nom technique (fissure, humidité, moisissure, décollement, efflorescence, etc.)
   - description: description détaillée de ce qui est visible
   - severity: gravité de 1 (mineur) à 5 (critique/dangereux)
   - location: localisation sur l'image (mur, plafond, sol, angle, etc.)
   - possibleCauses: tableau des causes probables
   - recommendedActions: tableau des actions recommandées
   - estimatedRepairCost: {min, max} en euros si estimable

2. **État général** (overallCondition):
   - "bon": pas de problème majeur
   - "moyen": quelques défauts mineurs
   - "dégradé": problèmes significatifs nécessitant intervention
   - "critique": danger potentiel, intervention urgente

3. **Urgence** (urgentAttention): true si intervention immédiate nécessaire

4. **Coût réparation global** (estimatedRepairCost): {min, max} en euros

5. **Recommandations** générales (recommendations): tableau de strings

Réponds UNIQUEMENT en JSON valide avec cette structure exacte:
{
  "pathologies": [...],
  "overallCondition": "...",
  "urgentAttention": boolean,
  "estimatedRepairCost": {"min": number, "max": number},
  "recommendations": [...],
  "confidence": number (0-1)
}`

const CONSTRUCTION_SYSTEM_PROMPT = `Tu es un conducteur de travaux expert BTP avec 15 ans d'expérience.
Analyse cette photo de chantier et fournis:

1. **Lot détecté** (lotDetected): code du lot si identifiable (GO, ELEC, PLOMB, etc.)
2. **Nom du lot** (lotName): nom complet du lot
3. **Avancement** (progressEstimate): pourcentage d'avancement estimé (0-100)
4. **Qualité** (qualityScore): score qualité exécution (0-100)

5. **Problèmes détectés** (issues): tableau avec pour chaque problème:
   - type: catégorie (malfaçon, sécurité, non-conformité, retard, etc.)
   - description: description du problème
   - severity: "low", "medium", "high" ou "critical"
   - location: localisation si visible
   - suggestedAction: action recommandée

6. **Recommandations** (recommendations): tableau de strings

7. **Confiance** (confidence): niveau de confiance de l'analyse (0-1)

Réponds UNIQUEMENT en JSON valide avec cette structure exacte:
{
  "lotDetected": "string ou null",
  "lotName": "string ou null",
  "progressEstimate": number,
  "qualityScore": number,
  "issues": [...],
  "recommendations": [...],
  "confidence": number
}`

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { imageUrl, analysisType, context }: AnalysisRequest = await req.json()

    // Validate inputs
    if (!imageUrl) {
      return new Response(
        JSON.stringify({ error: 'imageUrl is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!['construction', 'diagnostic'].includes(analysisType)) {
      return new Response(
        JSON.stringify({ error: 'analysisType must be "construction" or "diagnostic"' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get OpenAI API key
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiApiKey) {
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Build system prompt based on analysis type
    const systemPrompt = analysisType === 'diagnostic'
      ? DIAGNOSTIC_SYSTEM_PROMPT
      : CONSTRUCTION_SYSTEM_PROMPT

    // Build context message
    let contextMessage = 'Analyse cette image.'
    if (context) {
      const contextParts: string[] = []
      if (context.yearBuilt) contextParts.push(`Bâtiment construit en ${context.yearBuilt}`)
      if (context.type) contextParts.push(`Type: ${context.type}`)
      if (context.lotCode) contextParts.push(`Lot concerné: ${context.lotCode}`)
      if (context.projectType) contextParts.push(`Type de projet: ${context.projectType}`)
      if (context.expectedPhase) contextParts.push(`Phase attendue: ${context.expectedPhase}`)
      if (context.knownIssues?.length) contextParts.push(`Problèmes connus: ${context.knownIssues.join(', ')}`)

      if (contextParts.length > 0) {
        contextMessage = `Contexte: ${contextParts.join('. ')}.\n\nAnalyse cette image.`
      }
    }

    // Call OpenAI Vision API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: imageUrl,
                  detail: 'high', // Use high detail for better analysis
                },
              },
              {
                type: 'text',
                text: contextMessage,
              },
            ],
          },
        ],
        max_tokens: 3000,
        temperature: 0.2, // Lower temperature for more consistent results
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      console.error('OpenAI API error:', errorData)
      return new Response(
        JSON.stringify({
          error: 'OpenAI API error',
          details: errorData.error?.message || 'Unknown error',
        }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const result = await response.json()
    const content = result.choices?.[0]?.message?.content

    if (!content) {
      return new Response(
        JSON.stringify({ error: 'No analysis content returned' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse JSON response
    let analysis
    try {
      // Clean potential markdown code blocks
      const cleanedContent = content
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim()
      analysis = JSON.parse(cleanedContent)
    } catch (parseError) {
      console.error('JSON parse error:', parseError, 'Content:', content)
      return new Response(
        JSON.stringify({
          error: 'Failed to parse analysis result',
          rawContent: content,
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Add metadata
    analysis.analysisType = analysisType
    analysis.analyzedAt = new Date().toISOString()
    analysis.model = 'gpt-4o'

    return new Response(
      JSON.stringify(analysis),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('analyze-photo error:', error)
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
