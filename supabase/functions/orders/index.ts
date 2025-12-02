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

    // GET - Fetch order by ID
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

    // POST - Create new order
    if (req.method === 'POST') {
      const body = await req.json()
      
      console.log('Creating new order:', body)

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

      // Create order
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          customer_name: body.customer_name,
          customer_phone: body.customer_phone || null,
          order_type: body.order_type || 'local',
          address: body.address || null,
          cep: body.cep || null,
          reference: body.reference || null,
          scheduled_for: body.scheduled_for || null,
          delivery_tax: body.delivery_tax || 0,
          subtotal: body.subtotal || 0,
          total: body.total || 0,
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
      const orderItems = body.items.map((item: any) => ({
        order_id: order.id,
        item_id: item.item_id,
        quantity: item.quantity || 1,
        extras: item.extras || [],
        tapioca_molhada: item.tapioca_molhada || false,
        price: item.price || 0
      }))

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems)

      if (itemsError) {
        console.error('Error creating order items:', itemsError)
        // Rollback order if items fail
        await supabase.from('orders').delete().eq('id', order.id)
        throw itemsError
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
        JSON.stringify({ data: completeOrder }),
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
