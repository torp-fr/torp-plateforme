/**
 * Edge Function: analyze-photo
 * SECURED VERSION - Requires authentication and rate limiting
 *
 * Analyse de photos via GPT-4 Vision pour:
 * - Diagnostic bâtiment (pathologies, état général)
 * - Suivi de chantier (avancement, qualité, problèmes)
 *
 * Security Features:
 * - Requires Supabase auth token (Authorization header)
 * - Verifies user before processing
 * - Rate limiting (10 requests per hour per user)
 * - Restricted CORS (Supabase only)
 * - Structured error responses
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// CORS: Restrict to Supabase origin only
const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('SUPABASE_URL') || 'https://localhost:3000',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

// Simple in-memory rate limiter
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()

/**
 * Rate limiting: max 10 requests per hour per user
 */
function checkRateLimit(userId: string): { allowed: boolean; remaining: number } {
  const now = Date.now()
  const key = userId
  const limit = 10
  const windowMs = 3600000 // 1 hour

  let entry = rateLimitMap.get(key)

  // Clean up old entries
  if (entry && now > entry.resetTime) {
    rateLimitMap.delete(key)
    entry = undefined
  }

  if (!entry) {
    rateLimitMap.set(key, {
      count: 1,
      resetTime: now + windowMs,
    })
    return { allowed: true, remaining: limit - 1 }
  }

  entry.count++

  if (entry.count > limit) {
    return { allowed: false, remaining: 0 }
  }

  return { allowed: true, remaining: limit - entry.count }
}

/**
 * Verify Supabase auth token and extract user ID
 */
async function verifyAuth(authHeader: string | null): Promise<{
  valid: boolean
  userId?: string
  error?: string
}> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      valid: false,
      error: 'Missing or invalid Authorization header. Expected: Bearer <token>',
    }
  }

  const token = authHeader.slice(7)

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    )

    // Verify token using Supabase
    const { data, error } = await supabase.auth.getUser(token)

    if (error || !data.user) {
      return {
        valid: false,
        error: 'Invalid or expired authentication token',
      }
    }

    return {
      valid: true,
      userId: data.user.id,
    }
  } catch (err) {
    console.error('Auth verification error:', err)
    return {
      valid: false,
      error: 'Authentication verification failed',
    }
  }
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
    // ============================================================
    // 1. AUTHENTICATION: Verify Supabase auth token
    // ============================================================
    const authHeader = req.headers.get('Authorization')
    const authResult = await verifyAuth(authHeader)

    if (!authResult.valid || !authResult.userId) {
      return new Response(
        JSON.stringify({
          error: 'Unauthorized',
          message: authResult.error || 'Authentication required',
          code: 'AUTH_REQUIRED',
        }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const userId = authResult.userId

    // ============================================================
    // 2. RATE LIMITING: Check user rate limit
    // ============================================================
    const rateLimitCheck = checkRateLimit(userId)

    if (!rateLimitCheck.allowed) {
      return new Response(
        JSON.stringify({
          error: 'Rate limit exceeded',
          message: 'Maximum 10 analysis requests per hour allowed',
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: 3600,
        }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'Retry-After': '3600',
          },
        }
      )
    }

    // Parse request body
    let imageUrl: string
    let analysisType: string
    let context: any

    try {
      const body = await req.json()
      imageUrl = body.imageUrl
      analysisType = body.analysisType
      context = body.context
    } catch (parseErr) {
      return new Response(
        JSON.stringify({
          error: 'Invalid request body',
          message: 'Request body must be valid JSON',
          code: 'INVALID_JSON',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // ============================================================
    // 3. INPUT VALIDATION
    // ============================================================
    if (!imageUrl) {
      return new Response(
        JSON.stringify({
          error: 'Missing required parameter',
          message: 'imageUrl is required',
          code: 'MISSING_IMAGE_URL',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!['construction', 'diagnostic'].includes(analysisType)) {
      return new Response(
        JSON.stringify({
          error: 'Invalid analysis type',
          message: 'analysisType must be "construction" or "diagnostic"',
          code: 'INVALID_ANALYSIS_TYPE',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get OpenAI API key
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiApiKey) {
      console.error('OpenAI API key not configured')
      return new Response(
        JSON.stringify({
          error: 'Service unavailable',
          message: 'Photo analysis service is not properly configured',
          code: 'SERVICE_CONFIG_ERROR',
        }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ============================================================
    // 4. CALL OPENAI VISION API
    // ============================================================

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
          { role: 'system', content: analysisType === 'diagnostic' ? DIAGNOSTIC_SYSTEM_PROMPT : CONSTRUCTION_SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: imageUrl,
                  detail: 'high',
                },
              },
              {
                type: 'text',
                text: (() => {
                  let msg = 'Analyse cette image.'
                  if (context) {
                    const parts: string[] = []
                    if (context.yearBuilt) parts.push(`Bâtiment construit en ${context.yearBuilt}`)
                    if (context.type) parts.push(`Type: ${context.type}`)
                    if (context.lotCode) parts.push(`Lot concerné: ${context.lotCode}`)
                    if (context.projectType) parts.push(`Type de projet: ${context.projectType}`)
                    if (context.expectedPhase) parts.push(`Phase attendue: ${context.expectedPhase}`)
                    if (context.knownIssues?.length) parts.push(`Problèmes connus: ${context.knownIssues.join(', ')}`)
                    if (parts.length > 0) msg = `Contexte: ${parts.join('. ')}.\n\nAnalyse cette image.`
                  }
                  return msg
                })(),
              },
            ],
          },
        ],
        max_tokens: 3000,
        temperature: 0.2,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      console.error('OpenAI API error:', errorData)
      return new Response(
        JSON.stringify({
          error: 'Analysis service error',
          message: 'OpenAI API request failed',
          code: 'OPENAI_ERROR',
          details: errorData.error?.message || 'Unknown error',
        }),
        {
          status: response.status,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'X-RateLimit-Remaining': String(rateLimitCheck.remaining),
          },
        }
      )
    }

    const result = await response.json()
    const content = result.choices?.[0]?.message?.content

    if (!content) {
      return new Response(
        JSON.stringify({
          error: 'Analysis failed',
          message: 'No analysis content returned from service',
          code: 'NO_CONTENT',
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'X-RateLimit-Remaining': String(rateLimitCheck.remaining),
          },
        }
      )
    }

    // Parse JSON response
    let analysis
    try {
      const cleanedContent = content
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim()
      analysis = JSON.parse(cleanedContent)
    } catch (parseError) {
      console.error('JSON parse error:', parseError)
      return new Response(
        JSON.stringify({
          error: 'Analysis parse error',
          message: 'Failed to parse analysis result',
          code: 'PARSE_ERROR',
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'X-RateLimit-Remaining': String(rateLimitCheck.remaining),
          },
        }
      )
    }

    // Add metadata and response headers
    analysis.analysisType = analysisType
    analysis.analyzedAt = new Date().toISOString()
    analysis.model = 'gpt-4o'
    analysis.userId = userId // Include user ID for audit trail

    return new Response(
      JSON.stringify(analysis),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'X-RateLimit-Remaining': String(rateLimitCheck.remaining),
          'X-RateLimit-Limit': '10',
          'X-RateLimit-Window': '3600', // 1 hour in seconds
        },
      }
    )

  } catch (error) {
    console.error('analyze-photo error:', error)
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
        code: 'INTERNAL_ERROR',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
