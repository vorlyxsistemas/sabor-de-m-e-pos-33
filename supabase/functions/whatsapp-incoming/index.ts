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

  // Only accept POST
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

    const body = await req.json()
    console.log('Incoming WhatsApp webhook:', JSON.stringify(body, null, 2))

    // Extract message data from Evolution API payload
    // Evolution API sends different event types
    const eventType = body.event || body.type
    
    // Handle message events
    if (eventType === 'messages.upsert' || eventType === 'message') {
      const messageData = body.data?.message || body.message || body
      const from = messageData?.key?.remoteJid || body.from || body.phone
      const messageText = messageData?.message?.conversation || 
                         messageData?.message?.extendedTextMessage?.text ||
                         body.text ||
                         body.message?.text ||
                         ''
      const messageType = messageData?.messageType || body.messageType || 'text'

      if (!from) {
        console.log('No phone number in payload, skipping')
        return new Response(JSON.stringify({ status: 'skipped', reason: 'no phone' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Clean phone number (remove @s.whatsapp.net if present)
      const phone = from.replace('@s.whatsapp.net', '').replace('@c.us', '')
      console.log('Processing message from:', phone)

      // Check if client exists
      let { data: client, error: clientError } = await supabase
        .from('clients')
        .select('*')
        .eq('phone', phone)
        .single()

      if (clientError && clientError.code === 'PGRST116') {
        // Client doesn't exist, create new one
        console.log('Creating new client:', phone)
        const { data: newClient, error: createError } = await supabase
          .from('clients')
          .insert({
            phone,
            name: 'Sem nome',
            first_contact_at: new Date().toISOString(),
            is_active: true,
            total_orders: 0
          })
          .select()
          .single()

        if (createError) {
          console.error('Error creating client:', createError)
        } else {
          client = newClient
          console.log('New client created:', newClient.id)
        }
      } else if (clientError) {
        console.error('Error fetching client:', clientError)
      } else {
        // Update last_seen_at
        await supabase
          .from('clients')
          .update({ last_seen_at: new Date().toISOString() })
          .eq('id', client.id)
      }

      // Log the incoming message
      const { data: logData, error: logError } = await supabase
        .from('messages_log')
        .insert({
          phone,
          inbound_text: messageText,
          metadata: {
            type: messageType,
            client_id: client?.id,
            raw_event: eventType
          }
        })
        .select()
        .single()

      if (logError) {
        console.error('Error logging message:', logError)
      } else {
        console.log('Message logged:', logData.id)
      }

      // Forward to n8n webhook if configured
      const { data: settings } = await supabase
        .from('settings')
        .select('webhook_n8n_url')
        .eq('id', 1)
        .single()

      if (settings?.webhook_n8n_url) {
        console.log('Forwarding to n8n:', settings.webhook_n8n_url)
        try {
          const n8nResponse = await fetch(settings.webhook_n8n_url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              phone,
              message: messageText,
              type: messageType,
              client_id: client?.id,
              client_name: client?.name,
              timestamp: new Date().toISOString()
            })
          })
          console.log('n8n response status:', n8nResponse.status)
        } catch (n8nError) {
          console.error('Error forwarding to n8n:', n8nError)
        }
      }

      return new Response(JSON.stringify({ 
        status: 'ok', 
        client_id: client?.id,
        message_logged: !!logData 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // For other event types, just acknowledge
    console.log('Event type not handled:', eventType)
    return new Response(JSON.stringify({ status: 'ok', event: eventType }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Error in whatsapp-incoming:', error)
    // Always return 200 to Evolution API to prevent retries
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ status: 'error', message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
