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
    const categoryId = url.searchParams.get('category')
    const includeUnavailable = url.searchParams.get('include_unavailable') === 'true'

    console.log('Fetching menu, category:', categoryId, 'includeUnavailable:', includeUnavailable)

    // Fetch categories
    const { data: categories, error: catError } = await supabase
      .from('categories')
      .select('*')
      .order('name')

    if (catError) throw catError

    // Build items query
    let itemsQuery = supabase
      .from('items')
      .select(`
        *,
        category:categories(id, name),
        extras(id, name, price)
      `)
      .order('name')

    // Filter by availability (default: only available)
    if (!includeUnavailable) {
      itemsQuery = itemsQuery.eq('available', true)
    }

    // Filter by category if specified
    if (categoryId) {
      itemsQuery = itemsQuery.eq('category_id', categoryId)
    }

    const { data: items, error: itemsError } = await itemsQuery

    if (itemsError) throw itemsError

    // Fetch global extras
    const { data: globalExtras, error: extrasError } = await supabase
      .from('global_extras')
      .select('*')

    if (extrasError) {
      console.error('Error fetching global extras:', extrasError)
    }

    // Group items by category
    const menuByCategory = categories?.map(cat => ({
      ...cat,
      items: items?.filter(item => item.category_id === cat.id) || []
    }))

    return new Response(
      JSON.stringify({ 
        data: {
          categories,
          items,
          menu_by_category: menuByCategory,
          global_extras: globalExtras || []
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in menu function:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
