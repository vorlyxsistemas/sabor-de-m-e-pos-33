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

    // Get current weekday (0 = Sunday, 6 = Saturday)
    const today = new Date()
    const weekday = today.getDay()

    console.log(`Fetching lunch menu for weekday ${weekday}`)

    // Get lunch category
    const { data: lunchCategory, error: catError } = await supabase
      .from('categories')
      .select('id')
      .eq('name', 'Almoço')
      .maybeSingle()

    if (catError) {
      console.error('Error fetching lunch category:', catError)
      throw catError
    }

    // Get fixed lunch items
    let fixedItems: any[] = []
    if (lunchCategory) {
      const { data: items, error: itemsError } = await supabase
        .from('items')
        .select('*')
        .eq('category_id', lunchCategory.id)
        .eq('available', true)

      if (itemsError) {
        console.error('Error fetching lunch items:', itemsError)
        throw itemsError
      }
      fixedItems = items || []
    }

    // Get today's meat
    const { data: todayMeat, error: meatError } = await supabase
      .from('lunch_menu')
      .select('*')
      .eq('weekday', weekday)

    if (meatError) {
      console.error('Error fetching meat:', meatError)
      throw meatError
    }

    const response = {
      weekday,
      weekday_name: ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][weekday],
      fixed_items: fixedItems,
      meats: todayMeat || [],
      available: weekday >= 1 && weekday <= 5 // Only Monday-Friday
    }

    console.log(`Returning lunch menu: ${fixedItems.length} items, ${todayMeat?.length || 0} meats`)

    return new Response(
      JSON.stringify({ data: response }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in lunch-today function:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
