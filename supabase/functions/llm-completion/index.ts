// supabase/functions/llm-completion/index.ts
// Edge Function pour appeler les LLMs de mani??re s??curis??e (cl??s API c??t?? serveur)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    // V??rifier que l'utilisateur est authentifi??
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !user) {
      throw new Error('Unauthorized - Invalid or expired token')
    }

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
