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
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    const url = new URL(req.url)
    const bairro = url.searchParams.get('bairro')

    console.log('Fetching delivery zone for bairro:', bairro)

    if (!bairro) {
      // Return all zones if no bairro specified
      const { data, error } = await supabase
        .from('delivery_zones')
        .select('*')
        .order('bairro')

      if (error) throw error

      return new Response(
        JSON.stringify({ data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Search for specific bairro (case insensitive)
    const { data, error } = await supabase
      .from('delivery_zones')
      .select('*')
      .ilike('bairro', `%${bairro}%`)

    if (error) {
      console.error('Error fetching delivery zone:', error)
      throw error
    }

    if (!data || data.length === 0) {
      console.log('No delivery zone found for:', bairro)
      return new Response(
        JSON.stringify({ 
          data: null, 
          message: 'Bairro não encontrado. Entre em contato para verificar disponibilidade.' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Found delivery zone:`, data[0])

    return new Response(
      JSON.stringify({ data: data[0] }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in delivery function:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
