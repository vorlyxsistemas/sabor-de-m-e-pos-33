import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Check if store is open from settings table (manual control ONLY - v2)
async function isStoreOpen(supabase: any): Promise<{ open: boolean; message?: string }> {
  const { data: settings, error } = await supabase
    .from('settings')
    .select('is_open')
    .limit(1)
    .maybeSingle()

  console.log('Store status check - settings:', settings, 'error:', error)

  if (error) {
    console.error('Error checking store status:', error)
    // Default to open if can't check settings (so admin can fix)
    return { open: true }
  }

  // If no settings row exists or is_open is null, default to OPEN (admin controls manually)
  if (!settings || settings.is_open === null || settings.is_open === undefined) {
    console.log('No is_open setting found, defaulting to OPEN')
    return { open: true }
  }

  const isOpen = settings.is_open === true

  if (!isOpen) {
    return { 
      open: false, 
      message: 'A lanchonete está fechada no momento. Entre em contato conosco para mais informações.' 
    }
  }

  return { open: true }
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
    const skipTimeCheck = url.searchParams.get('skip_time_check') === 'true'

    // Check if store is open (manual control via settings)
    if (!skipTimeCheck) {
      const storeStatus = await isStoreOpen(supabase)
      if (!storeStatus.open) {
        return new Response(
          JSON.stringify({ 
            data: {
              weekday: new Date().getDay(),
              weekday_name: ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][new Date().getDay()],
              fixed_items: [],
              meats: [],
              available: false,
              closed: true,
              message: storeStatus.message
            }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

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
      available: weekday >= 1 && weekday <= 6, // Monday-Saturday (not Sunday)
      closed: false
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
