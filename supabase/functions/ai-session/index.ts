import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const url = new URL(req.url)

    // GET - Fetch session
    if (req.method === 'GET') {
      const sessionId = url.searchParams.get('session_id')
      
      if (!sessionId) {
        return new Response(
          JSON.stringify({ error: 'session_id é obrigatório' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      console.log('Fetching AI session:', sessionId)

      const { data, error } = await supabase
        .from('ai_sessions')
        .select('*')
        .eq('session_id', sessionId)
        .maybeSingle()

      if (error) {
        console.error('Error fetching session:', error)
        throw error
      }

      return new Response(
        JSON.stringify({ data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // POST - Create or update session
    if (req.method === 'POST') {
      const body = await req.json()
      
      if (!body.session_id) {
        return new Response(
          JSON.stringify({ error: 'session_id é obrigatório' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      console.log('Upserting AI session:', body.session_id)

      const { data, error } = await supabase
        .from('ai_sessions')
        .upsert({
          session_id: body.session_id,
          phone: body.phone || null,
          context: body.context || {},
          cart: body.cart || [],
          last_intent: body.last_intent || null,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'session_id'
        })
        .select()
        .single()

      if (error) {
        console.error('Error upserting session:', error)
        throw error
      }

      console.log('Session upserted successfully')

      return new Response(
        JSON.stringify({ data }),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // DELETE - Clear session
    if (req.method === 'DELETE') {
      const sessionId = url.searchParams.get('session_id')
      
      if (!sessionId) {
        return new Response(
          JSON.stringify({ error: 'session_id é obrigatório' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      console.log('Deleting AI session:', sessionId)

      const { error } = await supabase
        .from('ai_sessions')
        .delete()
        .eq('session_id', sessionId)

      if (error) {
        console.error('Error deleting session:', error)
        throw error
      }

      return new Response(
        JSON.stringify({ message: 'Session deleted' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in ai-session function:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
