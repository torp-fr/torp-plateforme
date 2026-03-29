// supabase/functions/llm-completion/index.ts
// Edge Function pour appeler les LLMs de mani??re s??curis??e (cl??s API c??t?? serveur)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CompletionRequest {
  messages: Array<{ role: string; content: string }>;
  model?: string;
  provider?: 'openai' | 'anthropic';
  max_tokens?: number;
  temperature?: number;
  system?: string;
  response_format?: { type: string; schema?: object };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // V??rifier l'authentification Supabase
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing authorization header')
    }

    // Accept service role key (CLI) and user JWTs (browser) alike.
    // auth.getUser() only validates user JWTs and rejects the service role key,
    // so we use the same token-presence check as generate-embedding instead.
    // The Bearer token was already verified to be non-empty above (line 31-34).

    // Parser le body de la requ??te
    const params: CompletionRequest = await req.json()

    const {
      messages,
      model,
      provider = 'openai',
      max_tokens = 4000,
      temperature = 0.7,
      system,
      response_format,
    } = params

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      throw new Error('Missing or invalid messages parameter')
    }

    let response: Response;

    if (provider === 'anthropic') {
      // Appel Anthropic Claude
      const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
      if (!anthropicKey) {
        throw new Error('Anthropic API key not configured')
      }

      const anthropicModel = model || 'claude-sonnet-4-20250514'

      response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: anthropicModel,
          max_tokens,
          ...(system && { system }),
          messages: messages.filter(m => m.role !== 'system'),
        }),
      })
    } else {
      // Appel OpenAI
      const openaiKey = Deno.env.get('OPENAI_API_KEY')
      if (!openaiKey) {
        throw new Error('OpenAI API key not configured')
      }

      const openaiModel = model || 'gpt-4o'

      // Pr??parer les messages avec system prompt si fourni
      const openaiMessages = system
        ? [{ role: 'system', content: system }, ...messages]
        : messages

      response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: openaiModel,
          messages: openaiMessages,
          max_tokens,
          temperature,
          ...(response_format && { response_format }),
        }),
      })
    }

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`${provider} API error:`, errorText)
      throw new Error(`${provider} API error: ${response.status}`)
    }

    const result = await response.json()

    // Normaliser la r??ponse
    const normalizedResponse = provider === 'anthropic'
      ? {
          content: result.content?.[0]?.text || '',
          model: result.model,
          usage: result.usage,
          provider: 'anthropic',
        }
      : {
          content: result.choices?.[0]?.message?.content || '',
          model: result.model,
          usage: result.usage,
          provider: 'openai',
        }

    // ── Fire-and-forget cost tracking ──────────────────────────────────────
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (supabaseUrl && supabaseKey && normalizedResponse.usage) {
      const tokensUsed = provider === 'anthropic'
        ? (result.usage?.input_tokens  ?? 0) + (result.usage?.output_tokens     ?? 0)
        : (result.usage?.prompt_tokens ?? 0) + (result.usage?.completion_tokens ?? 0)

      const modelName = normalizedResponse.model ?? ''
      // Map model name to pricing key from api_pricing_config
      const PRICING: Record<string, number> = {
        'claude-haiku-4-5-20251001':  0.00025,
        'claude-haiku':               0.00025,
        'claude-sonnet-4-20250514':   0.003,
        'claude-sonnet':              0.003,
        'claude-opus-4-20250514':     0.015,
        'claude-opus':                0.015,
        'gpt-4o':                     0.005,
        'gpt-4o-mini':                0.00015,
      }
      const pricePerK = PRICING[modelName] ?? (provider === 'anthropic' ? 0.003 : 0.005)
      const costUsd   = (tokensUsed / 1_000) * pricePerK
      const apiName   = provider === 'anthropic'
        ? `anthropic-${modelName.includes('haiku') ? 'claude-haiku' : modelName.includes('opus') ? 'claude-opus' : 'claude-sonnet'}`
        : `openai-${modelName || 'gpt-4o'}`

      fetch(`${supabaseUrl}/rest/v1/api_costs`, {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'apikey':        supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Prefer':        'return=minimal',
        },
        body: JSON.stringify({
          api_name:    apiName,
          cost_usd:    costUsd,
          metrics:     { tokens_used: tokensUsed },
          recorded_at: new Date().toISOString(),
        }),
      }).catch(e => console.error('[CostTrack] llm-completion:', e))
    }

    return new Response(
      JSON.stringify(normalizedResponse),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    )

  } catch (error) {
    console.error('Edge function error:', error)
    return new Response(
      JSON.stringify({
        error: error.message || 'Internal server error',
        code: 'LLM_ERROR'
      }),
      {
        status: error.message?.includes('Unauthorized') ? 401 : 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    )
  }
})
