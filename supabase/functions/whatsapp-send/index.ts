import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const EVOLUTION_API_URL = Deno.env.get('EVOLUTION_API_URL')
    const EVOLUTION_API_TOKEN = Deno.env.get('EVOLUTION_API_TOKEN')

    if (!EVOLUTION_API_URL || !EVOLUTION_API_TOKEN) {
      throw new Error('Evolution API credentials not configured')
    }

    const body = await req.json()
    const { to, text, type = 'text', imageUrl, caption, buttons, instance = 'sabordemae' } = body

    if (!to) {
      return new Response(JSON.stringify({ error: 'Missing "to" parameter' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Format phone number
    const phone = to.replace(/\D/g, '') // Remove non-digits
    console.log('Sending message to:', phone, 'type:', type)

    let evolutionEndpoint: string
    let messagePayload: Record<string, unknown>

    // Build request based on message type
    switch (type) {
      case 'image':
        evolutionEndpoint = `${EVOLUTION_API_URL}/message/sendMedia/${instance}`
        messagePayload = {
          number: phone,
          mediatype: 'image',
          media: imageUrl,
          caption: caption || ''
        }
        break

      case 'buttons':
        evolutionEndpoint = `${EVOLUTION_API_URL}/message/sendButtons/${instance}`
        messagePayload = {
          number: phone,
          title: text,
          buttons: buttons || []
        }
        break

      case 'text':
      default:
        evolutionEndpoint = `${EVOLUTION_API_URL}/message/sendText/${instance}`
        messagePayload = {
          number: phone,
          text: text
        }
        break
    }

    console.log('Calling Evolution API:', evolutionEndpoint)

    const response = await fetch(evolutionEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': EVOLUTION_API_TOKEN
      },
      body: JSON.stringify(messagePayload)
    })

    const responseData = await response.json()
    console.log('Evolution API response:', response.status, JSON.stringify(responseData))

    if (!response.ok) {
      throw new Error(`Evolution API error: ${response.status} - ${JSON.stringify(responseData)}`)
    }

    // Log the outbound message
    const { error: logError } = await supabase
      .from('messages_log')
      .insert({
        phone,
        outbound_text: text || caption || '[media]',
        metadata: {
          type,
          evolution_response: responseData
        }
      })

    if (logError) {
      console.error('Error logging outbound message:', logError)
    }

    return new Response(JSON.stringify({ 
      status: 'sent',
      to: phone,
      evolution_response: responseData
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Error in whatsapp-send:', error)
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
