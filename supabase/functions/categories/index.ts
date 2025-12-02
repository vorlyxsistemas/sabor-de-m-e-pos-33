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

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    console.log('Fetching categories with item counts...')

    // Get categories with item counts
    const { data: categories, error: catError } = await supabase
      .from('categories')
      .select('*')
      .order('name')

    if (catError) {
      console.error('Error fetching categories:', catError)
      throw catError
    }

    // Get item counts per category
    const { data: items, error: itemsError } = await supabase
      .from('items')
      .select('category_id')

    if (itemsError) {
      console.error('Error fetching items:', itemsError)
      throw itemsError
    }

    // Count items per category
    const itemCounts: Record<string, number> = {}
    items?.forEach(item => {
      if (item.category_id) {
        itemCounts[item.category_id] = (itemCounts[item.category_id] || 0) + 1
      }
    })

    // Add item count to each category
    const categoriesWithCounts = categories?.map(cat => ({
      ...cat,
      item_count: itemCounts[cat.id] || 0
    }))

    console.log(`Returning ${categoriesWithCounts?.length || 0} categories`)

    return new Response(
      JSON.stringify({ data: categoriesWithCounts }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in categories function:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
