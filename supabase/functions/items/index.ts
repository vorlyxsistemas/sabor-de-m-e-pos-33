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
    const categoryId = url.searchParams.get('category_id')
    const available = url.searchParams.get('available')

    console.log('Fetching items with filters:', { categoryId, available })

    let query = supabase
      .from('items')
      .select(`
        *,
        category:categories(id, name),
        extras(*)
      `)
      .order('name')

    if (categoryId) {
      query = query.eq('category_id', categoryId)
    }

    if (available !== null) {
      query = query.eq('available', available === 'true')
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching items:', error)
      throw error
    }

    console.log(`Returning ${data?.length || 0} items`)

    return new Response(
      JSON.stringify({ data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in items function:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
