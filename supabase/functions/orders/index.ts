import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Get current hour in Brazil timezone (UTC-3)
function getCurrentHour(): number {
  const now = new Date()
  const brazilOffset = -3 * 60
  const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes()
  const brazilMinutes = utcMinutes + brazilOffset
  return Math.floor(brazilMinutes / 60) % 24
}

function getDayOfWeek(): number {
  const now = new Date()
  const brazilOffset = -3 * 60 * 60 * 1000
  const brazilTime = new Date(now.getTime() + brazilOffset)
  return brazilTime.getUTCDay()
}

// Business hours: Mon-Sat 07:00-14:00
function isWithinBusinessHours(): { open: boolean; message?: string } {
  const dayOfWeek = getDayOfWeek()
  const currentHour = getCurrentHour()

  // Closed on Sundays
  if (dayOfWeek === 0) {
    return { open: false, message: 'Fechado aos domingos' }
  }

  // Open 07:00-14:00
  if (currentHour < 7) {
    return { open: false, message: 'Abrimos às 7h' }
  }

  if (currentHour >= 14) {
    return { open: false, message: 'Fechado - nosso horário é de 7h às 14h' }
  }

  return { open: true }
}

// Category-specific time rules
function isCategoryAvailable(categoryName: string): { available: boolean; message?: string } {
  const currentHour = getCurrentHour()

  // Lanches: only until 10h
  if (categoryName === 'Lanches' && currentHour >= 10) {
    return { available: false, message: 'Lanches disponíveis somente até 10h' }
  }

  // Almoço: only from 11h
  if (categoryName === 'Almoço' && currentHour < 11) {
    return { available: false, message: 'Almoço disponível a partir das 11h' }
  }

  return { available: true }
}

interface OrderItem {
  item_id: string
  quantity: number
  tapioca_molhada?: boolean
  extras?: { code: string }[]
}

interface CreateOrderBody {
  customer_name: string
  customer_phone?: string
  order_type: 'local' | 'retirada' | 'entrega'
  address?: {
    street?: string
    bairro?: string
    cep?: string
    reference?: string
  }
  scheduled_for?: string
  items: OrderItem[]
  payment_method?: string
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

    // GET - Fetch order by ID or list all orders
    if (req.method === 'GET') {
      const orderId = url.searchParams.get('id')
      
      if (!orderId) {
        // List all orders (for admin/staff)
        const { data, error } = await supabase
          .from('orders')
          .select(`
            *,
            order_items(
              *,
              item:items(id, name, price)
            )
          `)
          .order('created_at', { ascending: false })

        if (error) throw error

        return new Response(
          JSON.stringify({ data }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      console.log('Fetching order:', orderId)

      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          order_items(
            *,
            item:items(id, name, price)
          )
        `)
        .eq('id', orderId)
        .maybeSingle()

      if (error) {
        console.error('Error fetching order:', error)
        throw error
      }

      if (!data) {
        return new Response(
          JSON.stringify({ error: 'Pedido não encontrado' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({ data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // POST - Create new order with business rules
    if (req.method === 'POST') {
      const body: CreateOrderBody = await req.json()
      
      console.log('Creating new order:', JSON.stringify(body))

      // RULE 1: Check business hours
      const skipHoursCheck = url.searchParams.get('skip_hours_check') === 'true'
      if (!skipHoursCheck) {
        const businessHours = isWithinBusinessHours()
        if (!businessHours.open) {
          return new Response(
            JSON.stringify({ 
              error: 'Fora do horário de funcionamento',
              message: businessHours.message
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      }

      // Validate required fields
      if (!body.customer_name) {
        return new Response(
          JSON.stringify({ error: 'Nome do cliente é obrigatório' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (!body.items || body.items.length === 0) {
        return new Response(
          JSON.stringify({ error: 'Pedido deve conter pelo menos um item' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Fetch all items from DB to validate and get prices
      const itemIds = body.items.map(i => i.item_id)
      const { data: dbItems, error: itemsError } = await supabase
        .from('items')
        .select('*, category:categories(name)')
        .in('id', itemIds)

      if (itemsError) throw itemsError

      // RULE 2: Check availability
      const unavailableItems = dbItems?.filter(i => !i.available) || []
      if (unavailableItems.length > 0) {
        return new Response(
          JSON.stringify({ 
            error: 'Itens indisponíveis',
            items: unavailableItems.map(i => i.name)
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // RULE 3: Check category-specific time restrictions
      if (!skipHoursCheck) {
        for (const dbItem of dbItems || []) {
          const categoryName = dbItem.category?.name || ''
          const categoryCheck = isCategoryAvailable(categoryName)
          
          if (!categoryCheck.available) {
            return new Response(
              JSON.stringify({ 
                error: categoryCheck.message,
                item: dbItem.name
              }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }
        }
      }

      // Fetch global extras
      const { data: globalExtras } = await supabase
        .from('global_extras')
        .select('*')

      // Calculate totals for each item
      let subtotal = 0
      let extrasTotal = 0
      const orderItemsData = []

      for (const orderItem of body.items) {
        const dbItem = dbItems?.find(i => i.id === orderItem.item_id)
        if (!dbItem) {
          return new Response(
            JSON.stringify({ error: `Item não encontrado: ${orderItem.item_id}` }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        const quantity = orderItem.quantity || 1
        let itemPrice = Number(dbItem.price)
        let itemExtrasPrice = 0
        const appliedExtras: { name: string; price: number }[] = []

        // RULE 4: Tapioca molhada (+R$1.00 per unit if allowed and not already molhado)
        let tapiocaMolhadaApplied = false
        if (orderItem.tapioca_molhada && dbItem.allow_tapioca_molhada && !dbItem.is_molhado_by_default) {
          itemPrice += 1.00
          tapiocaMolhadaApplied = true
          console.log(`Applied tapioca molhada to ${dbItem.name}: +R$1.00`)
        }

        // RULE 5: Apply extras (OVO = R$2 for Lanches/Tapiocas, CARNE_EXTRA = R$6 for Almoço)
        if (orderItem.extras && orderItem.extras.length > 0 && dbItem.allow_extras) {
          const categoryName = dbItem.category?.name || ''
          
          for (const extra of orderItem.extras) {
            // Check global extras
            const globalExtra = globalExtras?.find(e => e.code === extra.code)
            if (globalExtra) {
              // Check if extra applies to this category
              if (!globalExtra.applies_to_category || globalExtra.applies_to_category === categoryName) {
                itemExtrasPrice += Number(globalExtra.price)
                appliedExtras.push({ name: globalExtra.name, price: Number(globalExtra.price) })
                console.log(`Applied global extra ${globalExtra.name} to ${dbItem.name}: +R$${globalExtra.price}`)
              }
            }

            // Check item-specific extras
            const { data: itemExtras } = await supabase
              .from('extras')
              .select('*')
              .eq('item_id', dbItem.id)
              .eq('name', extra.code)

            if (itemExtras && itemExtras.length > 0) {
              for (const ie of itemExtras) {
                itemExtrasPrice += Number(ie.price)
                appliedExtras.push({ name: ie.name, price: Number(ie.price) })
                console.log(`Applied item extra ${ie.name} to ${dbItem.name}: +R$${ie.price}`)
              }
            }
          }
        }

        const totalItemPrice = (itemPrice * quantity) + (itemExtrasPrice * quantity)
        subtotal += totalItemPrice
        extrasTotal += itemExtrasPrice * quantity

        orderItemsData.push({
          item_id: dbItem.id,
          quantity,
          extras: appliedExtras,
          tapioca_molhada: tapiocaMolhadaApplied,
          price: itemPrice,
        })
      }

      // RULE 6: Calculate delivery fee
      let deliveryFee = 0
      if (body.order_type === 'entrega') {
        if (!body.address?.bairro) {
          return new Response(
            JSON.stringify({ error: 'Bairro é obrigatório para entregas' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        const { data: taxaData, error: taxaError } = await supabase
          .rpc('get_taxa_by_bairro', { bairro_in: body.address.bairro })

        if (taxaError) {
          console.error('Error getting taxa:', taxaError)
        }

        if (!taxaData || taxaData.length === 0) {
          return new Response(
            JSON.stringify({ 
              error: 'Bairro não encontrado',
              message: 'Por favor, verifique o bairro ou entre em contato conosco'
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        deliveryFee = Number(taxaData[0].taxa) || 0
        console.log(`Delivery fee for ${body.address.bairro}: R$${deliveryFee}`)
      }

      const total = subtotal + deliveryFee

      console.log(`Order totals - Subtotal: R$${subtotal}, Extras: R$${extrasTotal}, Delivery: R$${deliveryFee}, Total: R$${total}`)

      // Create order
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          customer_name: body.customer_name,
          customer_phone: body.customer_phone || null,
          order_type: body.order_type || 'local',
          address: body.address ? JSON.stringify(body.address) : null,
          cep: body.address?.cep || null,
          reference: body.address?.reference || null,
          scheduled_for: body.scheduled_for || null,
          delivery_tax: deliveryFee,
          extras_fee: extrasTotal,
          subtotal: subtotal,
          total: total,
          status: 'pending'
        })
        .select()
        .single()

      if (orderError) {
        console.error('Error creating order:', orderError)
        throw orderError
      }

      console.log('Order created:', order.id)

      // Create order items
      const orderItems = orderItemsData.map((item) => ({
        order_id: order.id,
        item_id: item.item_id,
        quantity: item.quantity,
        extras: item.extras,
        tapioca_molhada: item.tapioca_molhada,
        price: item.price
      }))

      const { error: itemsInsertError } = await supabase
        .from('order_items')
        .insert(orderItems)

      if (itemsInsertError) {
        console.error('Error creating order items:', itemsInsertError)
        // Rollback order if items fail
        await supabase.from('orders').delete().eq('id', order.id)
        throw itemsInsertError
      }

      console.log(`Created ${orderItems.length} order items`)

      // Return complete order
      const { data: completeOrder, error: fetchError } = await supabase
        .from('orders')
        .select(`
          *,
          order_items(
            *,
            item:items(id, name, price)
          )
        `)
        .eq('id', order.id)
        .single()

      if (fetchError) throw fetchError

      return new Response(
        JSON.stringify({ 
          data: completeOrder,
          summary: {
            subtotal,
            extras_fee: extrasTotal,
            delivery_fee: deliveryFee,
            total
          }
        }),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // PATCH - Update order status
    if (req.method === 'PATCH') {
      const orderId = url.searchParams.get('id')
      const body = await req.json()

      if (!orderId) {
        return new Response(
          JSON.stringify({ error: 'ID do pedido é obrigatório' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      console.log('Updating order:', orderId, body)

      const { data, error } = await supabase
        .from('orders')
        .update(body)
        .eq('id', orderId)
        .select()
        .single()

      if (error) {
        console.error('Error updating order:', error)
        throw error
      }

      return new Response(
        JSON.stringify({ data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // DELETE - Cancel order (within 10 min window)
    if (req.method === 'DELETE') {
      const orderId = url.searchParams.get('id')

      if (!orderId) {
        return new Response(
          JSON.stringify({ error: 'ID do pedido é obrigatório' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Check if order can be cancelled
      const { data: canCancel, error: checkError } = await supabase
        .rpc('can_cancel_order', { order_id: orderId })

      if (checkError) {
        console.error('Error checking cancellation:', checkError)
        throw checkError
      }

      if (!canCancel) {
        return new Response(
          JSON.stringify({ 
            error: 'Cancelamento não permitido',
            message: 'Janela de cancelamento de 10 minutos expirada. Pedido já foi encaminhado para cozinha.'
          }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Cancel the order
      const { data, error } = await supabase
        .from('orders')
        .update({ status: 'cancelled' })
        .eq('id', orderId)
        .select()
        .single()

      if (error) {
        console.error('Error cancelling order:', error)
        throw error
      }

      return new Response(
        JSON.stringify({ data, message: 'Pedido cancelado com sucesso' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in orders function:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})