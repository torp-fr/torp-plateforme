// Follow the Supabase Functions quickstart guide to get started
// See also the HTTP client in the `_shared` folder for common helper functions used
// for making requests and responses

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

interface RequestPayload {
  siret: string
}

interface PappersResponse {
  siret?: string
  [key: string]: any
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      }
    })
  }

  try {
    // Validate request method
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed. Use POST.' }),
        {
          status: 405,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    // Parse request body
    let payload: RequestPayload
    try {
      payload = await req.json()
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    // Validate SIRET
    const { siret } = payload
    if (!siret || typeof siret !== 'string') {
      return new Response(
        JSON.stringify({ error: 'SIRET is required and must be a string' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    // Validate SIRET format (14 digits)
    if (!/^\d{14}$/.test(siret)) {
      return new Response(
        JSON.stringify({ error: 'Invalid SIRET format. Must be 14 digits.' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    // Get API key from environment (server-side only)
    const pappersApiKey = Deno.env.get('PAPPERS_API_KEY')
    if (!pappersApiKey) {
      console.error('⚠️ PAPPERS_API_KEY not configured in Supabase secrets')
      return new Response(
        JSON.stringify({ error: 'Service temporarily unavailable' }),
        {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    // Call Pappers API with timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 8000) // 8 second timeout

    try {
      const pappersResponse = await fetch(
        `https://api.pappers.fr/v2/companies?siret=${siret}&api_token=${pappersApiKey}`,
        {
          method: 'GET',
          headers: {
            'Accept': 'application/json'
          },
          signal: controller.signal
        }
      )

      clearTimeout(timeoutId)

      // Handle Pappers errors
      if (!pappersResponse.ok) {
        const errorData = await pappersResponse.json().catch(() => ({}))

        if (pappersResponse.status === 404) {
          return new Response(
            JSON.stringify({ error: 'Company not found', siret }),
            {
              status: 404,
              headers: { 'Content-Type': 'application/json' }
            }
          )
        }

        if (pappersResponse.status === 429) {
          return new Response(
            JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
            {
              status: 429,
              headers: {
                'Content-Type': 'application/json',
                'Retry-After': '60'
              }
            }
          )
        }

        console.error('Pappers API error:', {
          status: pappersResponse.status,
          siret,
          error: errorData
        })

        return new Response(
          JSON.stringify({
            error: 'Failed to fetch company information from Pappers',
            siret
          }),
          {
            status: pappersResponse.status,
            headers: { 'Content-Type': 'application/json' }
          }
        )
      }

      // Parse and return Pappers response
      const data: PappersResponse = await pappersResponse.json()

      // Log successful call (audit trail)
      console.log(`✅ Pappers API called successfully for SIRET: ${siret}`)

      return new Response(
        JSON.stringify(data),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
          }
        }
      )
    } catch (error) {
      clearTimeout(timeoutId)

      if (error instanceof DOMException && error.name === 'AbortError') {
        console.error('⏱️ Pappers API timeout for SIRET:', siret)
        return new Response(
          JSON.stringify({
            error: 'Request timeout. Pappers API is taking too long to respond.',
            siret
          }),
          {
            status: 504,
            headers: { 'Content-Type': 'application/json' }
          }
        )
      }

      console.error('❌ Error calling Pappers API:', {
        siret,
        error: error instanceof Error ? error.message : String(error)
      })

      return new Response(
        JSON.stringify({
          error: 'Error fetching company information',
          siret,
          details: error instanceof Error ? error.message : 'Unknown error'
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }
  } catch (error) {
    console.error('❌ Unexpected error in pappers-proxy:', error)
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
})
