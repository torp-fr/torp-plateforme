// supabase/functions/llm-completion/index.ts
// Edge Function pour appeler les LLMs de manière sécurisée (clés API côté serveur)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  validateTokens,
  formatTokenError,
  type TokenCountResult,
  type TokenCountError
} from '../_shared/token-counter.ts'
import { callClaude, callOpenAI } from '../_shared/ai-client.ts'

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
    // Vérifier l'authentification Supabase
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing authorization header')
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    // Vérifier que l'utilisateur est authentifié
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !user) {
      throw new Error('Unauthorized - Invalid or expired token')
    }

    // Parser le body de la requête
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

    // ============================================
    // TOKEN COUNTING & VALIDATION
    // ============================================
    const selectedModel = model || (provider === 'anthropic' ? 'claude-sonnet-4-20250514' : 'gpt-4o')

    // Validate tokens before making API call
    const tokenValidation = validateTokens(messages, selectedModel, max_tokens, system)

    // Check if validation returned an error
    if ('error' in tokenValidation && tokenValidation.error !== undefined) {
      const errorData = tokenValidation as TokenCountError
      console.warn('[Token Validation] Limit exceeded:', {
        model: selectedModel,
        inputTokens: errorData.inputTokens,
        outputTokens: errorData.outputTokens,
        maxAllowed: errorData.maxAllowed
      })

      return new Response(
        JSON.stringify({
          error: 'context_limit_exceeded',
          message: errorData.message,
          details: {
            inputTokens: errorData.inputTokens,
            outputTokens: errorData.outputTokens,
            totalTokens: errorData.inputTokens + errorData.outputTokens,
            maxAllowed: errorData.maxAllowed
          }
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        }
      )
    }

    const validTokens = tokenValidation as TokenCountResult
    console.log('[Token Validation] Passed:', {
      model: selectedModel,
      inputTokens: validTokens.inputTokens,
      outputTokens: validTokens.outputTokens,
      estimatedTotal: validTokens.estimatedTotal,
      safeLimit: validTokens.safeLimit
    })

    // ============================================
    // LLM CALL
    // ============================================
    let response: Response;

    let apiResponse: any;

    if (provider === 'anthropic') {
      // Appel Anthropic Claude via ai-client
      const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
      if (!anthropicKey) {
        throw new Error('Anthropic API key not configured')
      }

      const claudeResponse = await callClaude(
        messages.map(m => `${m.role}: ${m.content}`).join('\n'),
        system || 'You are a helpful assistant.',
        anthropicKey,
        max_tokens,
        false,
        {
          userId: user.id,
          action: 'llm-completion',
          sessionId: authHeader,
          supabaseClient
        }
      )

      if (!claudeResponse.success) {
        throw new Error(claudeResponse.error || 'Claude API error')
      }

      apiResponse = {
        content: [{ text: claudeResponse.data }],
        model: claudeResponse.model,
        usage: {
          input_tokens: claudeResponse.tokens?.input || 0,
          output_tokens: claudeResponse.tokens?.output || 0
        }
      }
      provider = 'anthropic'

    } else {
      // Appel OpenAI via ai-client
      const openaiKey = Deno.env.get('OPENAI_API_KEY')
      if (!openaiKey) {
        throw new Error('OpenAI API key not configured')
      }

      const systemPrompt = system || 'You are a helpful assistant.'
      const userPrompt = messages.map(m => `${m.role}: ${m.content}`).join('\n')

      const openaiResponse = await callOpenAI(
        userPrompt,
        systemPrompt,
        openaiKey,
        {
          model: selectedModel,
          maxTokens: max_tokens,
          temperature,
          userId: user.id,
          action: 'llm-completion',
          sessionId: authHeader,
          supabaseClient
        }
      )

      if (!openaiResponse.success) {
        throw new Error(openaiResponse.error || 'OpenAI API error')
      }

      apiResponse = {
        choices: [{ message: { content: openaiResponse.data } }],
        model: openaiResponse.model,
        usage: {
          prompt_tokens: openaiResponse.tokens?.input || 0,
          completion_tokens: openaiResponse.tokens?.output || 0,
          total_tokens: openaiResponse.tokens?.actual || 0
        }
      }
      provider = 'openai'
    }

    response = new Response(JSON.stringify(apiResponse), { status: 200 })

    const result = apiResponse

    // Normaliser la réponse
    const normalizedResponse = provider === 'anthropic'
      ? {
          content: result.content?.[0]?.text || '',
          model: result.model,
          usage: result.usage,
          provider: 'anthropic',
          tokens: {
            estimated: validTokens.estimatedTotal,
            actual: (result.usage?.input_tokens || 0) + (result.usage?.output_tokens || 0) || null
          }
        }
      : {
          content: result.choices?.[0]?.message?.content || '',
          model: result.model,
          usage: result.usage,
          provider: 'openai',
          tokens: {
            estimated: validTokens.estimatedTotal,
            actual: result.usage?.total_tokens || null
          }
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
