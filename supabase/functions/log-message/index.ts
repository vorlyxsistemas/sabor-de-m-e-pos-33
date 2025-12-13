import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Validate that request comes from service role or has valid internal signature
const validateServiceAccess = (req: Request): boolean => {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return false
  
  // Check if it's service role key (used by edge functions)
  const token = authHeader.replace('Bearer ', '')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  
  // Service role key check - edge functions use this
  if (token === serviceRoleKey) return true
  
  // Check for internal service header (used by n8n/webhooks)
  const internalKey = req.headers.get('x-internal-service-key')
  const expectedKey = Deno.env.get('INTERNAL_SERVICE_KEY')
  if (expectedKey && internalKey === expectedKey) return true
  
  return false
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Validate service access - only service role or internal services can access
    if (!validateServiceAccess(req)) {
      console.warn('Unauthorized access attempt to log-message')
      return new Response(
        JSON.stringify({ error: 'Unauthorized - service access required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const body = await req.json()

    console.log('Logging message:', {
      session_id: body.session_id,
      phone: body.phone,
      has_inbound: !!body.inbound_text,
      has_outbound: !!body.outbound_text
    })

    const { data, error } = await supabase
      .from('messages_log')
      .insert({
        session_id: body.session_id || null,
        phone: body.phone || null,
        inbound_text: body.inbound_text || null,
        outbound_text: body.outbound_text || null,
        metadata: body.metadata || {}
      })
      .select()
      .single()

    if (error) {
      console.error('Error logging message:', error)
      throw error
    }

    console.log('Message logged:', data.id)

    return new Response(
      JSON.stringify({ data }),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in log-message function:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
