import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Validation schemas
const uuidSchema = z.string().uuid('ID inválido')

const extraSchema = z.object({
  code: z.string().max(50).optional(),
  id: z.string().max(50).optional(),
  name: z.string().max(100).optional(),
  price: z.number().min(0).max(9999.99).optional(),
}).refine(data => data.code || data.id || data.name, {
  message: 'Extra deve ter code, id ou name',
})

const orderItemInputSchema = z.object({
  item_id: uuidSchema,
  quantity: z.number().int().min(1).max(50),
  price: z.number().min(0).max(9999.99).optional(),
  tapioca_molhada: z.boolean().optional().default(false),
  extras: z.array(extraSchema).optional().default([]),
})

const addressObjectSchema = z.object({
  street: z.string().trim().max(200).optional(),
  bairro: z.string().trim().max(100).optional(),
  cep: z.string().trim().max(10).optional(),
  reference: z.string().trim().max(200).optional(),
})

const createOrderBodySchema = z.object({
  customer_name: z.string().trim().min(2, 'Nome deve ter pelo menos 2 caracteres').max(100, 'Nome muito longo'),
  customer_phone: z.string().trim().max(20).regex(/^[\d\s\(\)\-\+]*$/, 'Telefone inválido').optional().or(z.literal('')),
  order_type: z.enum(['local', 'retirada', 'entrega']),
  address: z.union([z.string().max(200), addressObjectSchema]).optional(),
  bairro: z.string().trim().max(100).optional(),
  cep: z.string().trim().max(10).optional(),
  reference: z.string().trim().max(200).optional(),
  scheduled_for: z.string().max(30).optional(),
  items: z.array(orderItemInputSchema).min(1, 'Pedido deve ter pelo menos um item').max(30),
  payment_method: z.string().max(50).optional(),
  user_id: z.string().uuid().nullable().optional(), // Link to authenticated user
})

const updateOrderStatusSchema = z.object({
  status: z.enum(['pending', 'A_PREPARAR', 'PREPARANDO', 'PRONTO', 'ENTREGUE', 'cancelled']),
})

function sanitizeString(input: string): string {
  return input.trim().replace(/[<>]/g, '').slice(0, 1000)
}

// Helper to verify user role (admin or staff)
async function verifyRole(supabase: any, userId: string, role: string): Promise<boolean> {
  const { data, error } = await supabase
    .rpc('has_role', { _user_id: userId, _role: role });
  
  if (error) {
    console.error(`Error checking ${role} role:`, error);
    return false;
  }
  return data === true;
}

// Helper to get authenticated user and verify staff/admin role
async function getAuthenticatedStaffUser(req: Request, supabase: any): Promise<{ user: any; error?: string }> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return { user: null, error: 'Não autorizado' };
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return { user: null, error: 'Token inválido' };
  }

  // Check if user is admin or staff
  const isAdmin = await verifyRole(supabase, user.id, 'admin');
  const isStaff = await verifyRole(supabase, user.id, 'staff');

  if (!isAdmin && !isStaff) {
    return { user: null, error: 'Acesso negado. Apenas administradores e funcionários.' };
  }

  return { user };
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

// Category-specific time rules (optional warnings, not blocking)
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

interface OrderItemExtra {
  code?: string
  id?: string
  name?: string
  price?: number
}

interface OrderItem {
  item_id: string
  quantity: number
  price?: number
  tapioca_molhada?: boolean
  extras?: OrderItemExtra[]
}

// Support both formats: nested object OR separate fields (for Sofia AI compatibility)
interface CreateOrderBody {
  customer_name: string
  customer_phone?: string
  order_type: 'local' | 'retirada' | 'entrega'
  // Nested address format (original)
  address?: string | {
    street?: string
    bairro?: string
    cep?: string
    reference?: string
  }
  // Flat address fields (Sofia AI format)
  bairro?: string
  cep?: string
  reference?: string
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

    // GET - Fetch order by ID or list all orders (REQUIRES ADMIN/STAFF AUTH)
    if (req.method === 'GET') {
      // Verify authentication and role
      const { user, error: authError } = await getAuthenticatedStaffUser(req, supabase);
      if (authError) {
        return new Response(
          JSON.stringify({ error: authError }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

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
      const rawBody = await req.json()
      
      console.log('Creating new order - raw:', JSON.stringify(rawBody))
      
      // Validate with Zod schema
      const parseResult = createOrderBodySchema.safeParse(rawBody)
      if (!parseResult.success) {
        const errors = parseResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ')
        console.error('Order validation error:', errors)
        return new Response(
          JSON.stringify({ error: `Dados inválidos: ${errors}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      const body = parseResult.data
      console.log('Creating new order - validated:', JSON.stringify(body))

      // Try to get user_id from body OR from auth token
      let userId: string | null = body.user_id || null
      
      // Prefer authenticated user_id from JWT (prevents missing/forged user_id)
      const authHeader = req.headers.get('Authorization')
      if (authHeader) {
        try {
          const supabaseAuth = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            {
              global: { headers: { Authorization: authHeader } },
              auth: { autoRefreshToken: false, persistSession: false },
            }
          )

          const { data: { user }, error: authErr } = await supabaseAuth.auth.getUser()

          if (authErr) {
            console.log('Auth getUser error:', authErr)
          }

          if (user) {
            userId = user.id
            console.log('Extracted user_id from auth token:', userId)
          }
        } catch (e) {
          console.log('Could not extract user from token:', e)
        }
      }
      
      console.log('Final user_id for order:', userId)

      // Normalize address: support both flat fields (Sofia) and nested object (original)
      // Extract bairro from flat field or nested address object
      let bairro: string | undefined
      let cep: string | undefined
      let reference: string | undefined
      let addressStr: string | undefined

      // Priority: flat bairro field > nested address.bairro
      if (body.bairro) {
        // Flat fields (Sofia AI or CustomerPedido format)
        bairro = body.bairro
        cep = body.cep
        reference = body.reference
        // Get street from nested object if address is object, otherwise from string
        if (body.address && typeof body.address === 'object') {
          addressStr = body.address.street
        } else if (typeof body.address === 'string') {
          addressStr = body.address
        }
      } else if (body.address && typeof body.address === 'object') {
        // Only nested object (original format without flat fields)
        bairro = body.address.bairro
        cep = body.address.cep
        reference = body.address.reference
        addressStr = body.address.street
      } else if (typeof body.address === 'string') {
        // Just a string address, no bairro (legacy fallback)
        addressStr = body.address
      }

      // RULE 1: Check if store is open (manual control via settings)
      const skipHoursCheck = url.searchParams.get('skip_hours_check') === 'true'
      if (!skipHoursCheck) {
        const storeStatus = await isStoreOpen(supabase)
        if (!storeStatus.open) {
          return new Response(
            JSON.stringify({ 
              error: 'Lanchonete fechada',
              message: storeStatus.message
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

        // RULE 5: Apply extras - Support both formats:
        // Old: {code: string} - look up in DB
        // Sofia: {id?: string, name?: string, price?: number} - can use provided price or look up
        if (orderItem.extras && orderItem.extras.length > 0 && dbItem.allow_extras) {
          const categoryName = dbItem.category?.name || ''
          
          for (const extra of orderItem.extras) {
            // Determine the extra identifier (code, name, or id)
            const extraCode = extra.code || extra.name || extra.id

            // If Sofia provided name and price directly, use them
            if (extra.name && extra.price !== undefined) {
              itemExtrasPrice += Number(extra.price)
              appliedExtras.push({ name: extra.name, price: Number(extra.price) })
              console.log(`Applied Sofia extra ${extra.name} to ${dbItem.name}: +R$${extra.price}`)
              continue
            }

            if (!extraCode) continue

            // Check global extras
            const globalExtra = globalExtras?.find(e => 
              e.code === extraCode || e.name === extraCode || e.id === extraCode
            )
            if (globalExtra) {
              // Check if extra applies to this category
              if (!globalExtra.applies_to_category || globalExtra.applies_to_category === categoryName) {
                itemExtrasPrice += Number(globalExtra.price)
                appliedExtras.push({ name: globalExtra.name, price: Number(globalExtra.price) })
                console.log(`Applied global extra ${globalExtra.name} to ${dbItem.name}: +R$${globalExtra.price}`)
                continue
              }
            }

            // Check item-specific extras
            const { data: itemExtras } = await supabase
              .from('extras')
              .select('*')
              .eq('item_id', dbItem.id)
              .or(`name.eq.${extraCode},id.eq.${extraCode}`)

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
        if (!bairro) {
          return new Response(
            JSON.stringify({ error: 'Bairro é obrigatório para entregas' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        const { data: taxaData, error: taxaError } = await supabase
          .rpc('get_taxa_by_bairro', { bairro_in: bairro })

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
        console.log(`Delivery fee for ${bairro}: R$${deliveryFee}`)
      }

      const total = subtotal + deliveryFee

      console.log(`Order totals - Subtotal: R$${subtotal}, Extras: R$${extrasTotal}, Delivery: R$${deliveryFee}, Total: R$${total}`)

      // Build address object for storage
      const addressData = bairro ? {
        street: addressStr,
        bairro,
        cep,
        reference
      } : null

      // Create order
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          customer_name: body.customer_name,
          customer_phone: body.customer_phone || null,
          order_type: body.order_type || 'local',
          address: addressStr || null,
          bairro: bairro || null,
          cep: cep || null,
          reference: reference || null,
          scheduled_for: body.scheduled_for || null,
          delivery_tax: deliveryFee,
          extras_fee: extrasTotal,
          subtotal: subtotal,
          total: total,
          status: 'pending',
          user_id: userId // Link order to authenticated user for customer visibility
        })
        .select()
        .single()

      if (orderError) {
        console.error('Error creating order:', orderError)
        throw orderError
      }

      console.log('Order created:', order.id, 'with user_id:', userId)

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

    // PATCH - Update order status (REQUIRES ADMIN/STAFF AUTH)
    if (req.method === 'PATCH') {
      // Verify authentication and role
      const { user, error: authError } = await getAuthenticatedStaffUser(req, supabase);
      if (authError) {
        return new Response(
          JSON.stringify({ error: authError }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const orderId = url.searchParams.get('id')
      const rawBody = await req.json()

      // Validate orderId
      const orderIdResult = uuidSchema.safeParse(orderId)
      if (!orderIdResult.success) {
        return new Response(
          JSON.stringify({ error: 'ID do pedido inválido' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Validate status update body
      const bodyResult = updateOrderStatusSchema.safeParse(rawBody)
      if (!bodyResult.success) {
        const errors = bodyResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ')
        return new Response(
          JSON.stringify({ error: `Dados inválidos: ${errors}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      console.log('Updating order:', orderId, bodyResult.data)

      const { data, error } = await supabase
        .from('orders')
        .update(bodyResult.data)
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

    // DELETE - Cancel order (REQUIRES ADMIN/STAFF AUTH + within 10 min window)
    if (req.method === 'DELETE') {
      // Verify authentication and role
      const { user, error: authError } = await getAuthenticatedStaffUser(req, supabase);
      if (authError) {
        return new Response(
          JSON.stringify({ error: authError }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const orderId = url.searchParams.get('id')

      // Validate orderId
      const orderIdResult = uuidSchema.safeParse(orderId)
      if (!orderIdResult.success) {
        return new Response(
          JSON.stringify({ error: 'ID do pedido inválido' }),
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