// supabase/functions/generate-embedding/index.ts
// Edge Function pour g??n??rer des embeddings de mani??re s??curis??e (cl??s API c??t?? serveur)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  console.log('[EDGE:generate-embedding] === REQUEST RECEIVED ===')
  console.log('[EDGE:generate-embedding] Method:', req.method)
  console.log('[EDGE:generate-embedding] URL:', req.url)

  try {
    // Log environment setup
    console.log('[EDGE:generate-embedding] SUPABASE_URL exists:', !!Deno.env.get('SUPABASE_URL'))
    console.log('[EDGE:generate-embedding] SUPABASE_ANON_KEY exists:', !!Deno.env.get('SUPABASE_ANON_KEY'))
    console.log('[EDGE:generate-embedding] OPENAI_API_KEY exists:', !!Deno.env.get('OPENAI_API_KEY'))

    // Verify Supabase auth
    const authHeader = req.headers.get('Authorization')
    console.log('[EDGE:generate-embedding] Authorization header exists:', !!authHeader)
    console.log('[EDGE:generate-embedding] Authorization header length:', authHeader?.length)

    if (!authHeader) {
      throw new Error('Missing authorization header')
    }

    console.log('[EDGE:generate-embedding] Creating Supabase client...')
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    // Verify user is authenticated
    console.log('[EDGE:generate-embedding] Verifying user authentication...')
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()

    if (authError) {
      console.error('[EDGE:generate-embedding] Auth error:', authError.message)
      throw new Error('Unauthorized - Invalid or expired token')
    }

    if (!user) {
      console.error('[EDGE:generate-embedding] No user found in token')
      throw new Error('Unauthorized - No user in token')
    }

    console.log('[EDGE:generate-embedding] User authenticated:', user.id)

    // Parse request body
    console.log('[EDGE:generate-embedding] Parsing request body...')
    const { text, model = 'text-embedding-3-small' } = await req.json()
    console.log('[EDGE:generate-embedding] Text length:', text?.length)
    console.log('[EDGE:generate-embedding] Model:', model)

    if (!text || typeof text !== 'string') {
      throw new Error('Missing or invalid text parameter')
    }

    if (text.length > 8000) {
      throw new Error('Text too long - maximum 8000 characters')
    }

    // Get OpenAI key from Supabase secrets
    const openaiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiKey) {
      console.error('[EDGE:generate-embedding] OPENAI_API_KEY is missing!')
      throw new Error('OpenAI API key not configured')
    }
    console.log('[EDGE:generate-embedding] OpenAI API key exists, length:', openaiKey.length)

    // Call OpenAI Embeddings API
    console.log('[EDGE:generate-embedding] Calling OpenAI API...')
    const openaiResponse = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: text,
        model: model,
      }),
    })

    console.log('[EDGE:generate-embedding] OpenAI response status:', openaiResponse.status)
    console.log('[EDGE:generate-embedding] OpenAI response ok:', openaiResponse.ok)

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text()
      console.error('[EDGE:generate-embedding] OpenAI API error response:', errorText)
      throw new Error(`OpenAI API error: ${openaiResponse.status} - ${errorText}`)
    }

    const result = await openaiResponse.json()
    console.log('[EDGE:generate-embedding] Embedding received, length:', result.data[0]?.embedding?.length)

    // Return embedding and usage info
    console.log('[EDGE:generate-embedding] Returning successful response')
    return new Response(
      JSON.stringify({
        embedding: result.data[0].embedding,
        model: result.model,
        usage: result.usage,
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    )

  } catch (error) {
    console.error('[EDGE:generate-embedding] ERROR CAUGHT')
    console.error('[EDGE:generate-embedding] Error message:', error.message)
    console.error('[EDGE:generate-embedding] Error type:', typeof error)
    console.error('[EDGE:generate-embedding] Full error:', error)

    return new Response(
      JSON.stringify({
        error: error.message || 'Internal server error',
        code: 'EMBEDDING_ERROR'
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
