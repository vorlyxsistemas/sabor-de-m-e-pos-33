import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Get current hour in Brazil timezone (UTC-3)
function getCurrentHour(): number {
  const now = new Date()
  // Brazil is UTC-3
  const brazilOffset = -3 * 60
  const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes()
  const brazilMinutes = utcMinutes + brazilOffset
  return Math.floor(brazilMinutes / 60) % 24
}

function getDayOfWeek(): number {
  const now = new Date()
  const brazilOffset = -3 * 60 * 60 * 1000
  const brazilTime = new Date(now.getTime() + brazilOffset)
  return brazilTime.getUTCDay() // 0 = Sunday
}

// Time-based category filtering rules
interface TimeRestriction {
  category: string
  availableUntil?: number // Hour until available (exclusive)
  availableFrom?: number  // Hour from which available (inclusive)
  message?: string
}

const TIME_RESTRICTIONS: TimeRestriction[] = [
  { 
    category: 'Lanches', 
    availableUntil: 10,
    message: 'Lanches disponíveis somente até 10h'
  },
  { 
    category: 'Almoço', 
    availableFrom: 11,
    message: 'Almoço disponível a partir das 11h'
  }
]

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
    const skipTimeCheck = url.searchParams.get('skip_time_check') === 'true'

    const currentHour = getCurrentHour()
    const dayOfWeek = getDayOfWeek()

    console.log('Fetching menu, category:', categoryId, 'includeUnavailable:', includeUnavailable, 'currentHour:', currentHour, 'dayOfWeek:', dayOfWeek)

    // Sunday = closed
    if (dayOfWeek === 0 && !skipTimeCheck) {
      return new Response(
        JSON.stringify({ 
          data: {
            categories: [],
            items: [],
            menu_by_category: [],
            global_extras: [],
            closed: true,
            message: 'Fechado aos domingos'
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // After 14h = closed
    if (currentHour >= 14 && !skipTimeCheck) {
      return new Response(
        JSON.stringify({ 
          data: {
            categories: [],
            items: [],
            menu_by_category: [],
            global_extras: [],
            closed: true,
            message: 'Fechado - Nosso horário é de 7h às 14h'
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

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

    // Fetch lunch menu for today
    const { data: lunchMenu } = await supabase
      .from('lunch_menu')
      .select('*')
      .eq('weekday', dayOfWeek)

    // Apply time-based filtering
    let filteredItems = items || []
    const categoryMessages: Record<string, string> = {}

    if (!skipTimeCheck) {
      for (const restriction of TIME_RESTRICTIONS) {
        const category = categories?.find(c => c.name === restriction.category)
        if (!category) continue

        let isAvailable = true

        // Check "available until" rule
        if (restriction.availableUntil !== undefined && currentHour >= restriction.availableUntil) {
          isAvailable = false
        }

        // Check "available from" rule
        if (restriction.availableFrom !== undefined && currentHour < restriction.availableFrom) {
          isAvailable = false
          categoryMessages[category.id] = restriction.message || ''
        }

        if (!isAvailable) {
          filteredItems = filteredItems.filter(item => item.category_id !== category.id)
        }
      }
    }

    // Group items by category (only categories with items or messages)
    const menuByCategory = categories?.map(cat => {
      const catItems = filteredItems.filter(item => item.category_id === cat.id)
      return {
        ...cat,
        items: catItems,
        unavailable_message: categoryMessages[cat.id] || null
      }
    }).filter(cat => cat.items.length > 0 || cat.unavailable_message)

    return new Response(
      JSON.stringify({ 
        data: {
          categories,
          items: filteredItems,
          menu_by_category: menuByCategory,
          global_extras: globalExtras || [],
          lunch_menu: lunchMenu || [],
          current_hour: currentHour,
          day_of_week: dayOfWeek,
          closed: false
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