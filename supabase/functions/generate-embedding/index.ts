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
    const { text, model = 'text-embedding-3-small' } = await req.json()

    if (!text || typeof text !== 'string') {
      throw new Error('Missing or invalid text parameter')
    }

    if (text.length > 8000) {
      throw new Error('Text too long - maximum 8000 characters')
    }

    // R??cup??rer la cl?? OpenAI depuis les secrets Supabase
    const openaiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiKey) {
      throw new Error('OpenAI API key not configured')
    }

    // Appeler l'API OpenAI Embeddings
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

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text()
      console.error('OpenAI API error:', errorText)
      throw new Error(`OpenAI API error: ${openaiResponse.status}`)
    }

    const result = await openaiResponse.json()

    // Retourner l'embedding et les infos d'utilisation
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
    console.error('Edge function error:', error)
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
