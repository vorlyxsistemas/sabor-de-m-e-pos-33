import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Validation schemas
const extraSchema = z.object({
  name: z.string().trim().min(1).max(100),
  price: z.number().min(0).max(9999.99),
});

const orderItemSchema = z.object({
  item_id: z.string().uuid('ID do item inválido'),
  quantity: z.number().int().min(1, 'Quantidade mínima é 1').max(50, 'Quantidade máxima é 50'),
  price: z.number().min(0).max(9999.99),
  tapioca_molhada: z.boolean().optional().default(false),
  extras: z.array(extraSchema).optional().default([]),
});

const customerSchema = z.object({
  name: z.string().trim().min(2, 'Nome deve ter pelo menos 2 caracteres').max(100, 'Nome muito longo'),
  phone: z.string().trim().min(8, 'Telefone inválido').max(20, 'Telefone muito longo')
    .regex(/^[\d\s\(\)\-\+]*$/, 'Telefone inválido'),
});

const orderDetailsSchema = z.object({
  order_type: z.enum(['local', 'delivery', 'pickup']),
  payment_method: z.string().max(50).optional(),
  scheduled_for: z.string().nullable().optional(),
  address: z.string().trim().max(200).optional(),
  bairro: z.string().trim().max(100).optional(),
});

const createOrderFromAISchema = z.object({
  customer: customerSchema,
  order: orderDetailsSchema,
  items: z.array(orderItemSchema).min(1, 'Pedido deve ter pelo menos um item').max(30, 'Máximo de 30 itens'),
});

type CreateOrderFromAIInput = z.infer<typeof createOrderFromAISchema>;

async function isStoreOpen(supabase: any): Promise<{ open: boolean; message?: string }> {
  const { data: settings, error } = await supabase
    .from('settings')
    .select('is_open')
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[create-order-from-ai] Error checking store status:', error);
    return { open: true };
  }

  if (!settings || settings.is_open === null || settings.is_open === undefined) {
    return { open: true };
  }

  if (!settings.is_open) {
    return { open: false, message: 'A lanchonete está fechada no momento.' };
  }

  return { open: true };
}

async function getDeliveryFee(supabase: any, bairro: string): Promise<number> {
  if (!bairro) return 0;
  
  const { data, error } = await supabase
    .from('delivery_zones')
    .select('taxa')
    .ilike('bairro', bairro)
    .maybeSingle();

  if (error || !data) {
    console.log('[create-order-from-ai] Bairro not found:', bairro);
    return 0;
  }

  return data.taxa || 0;
}

serve(async (req) => {
  console.log('[create-order-from-ai] Request:', req.method);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const rawBody = await req.json();
    console.log('[create-order-from-ai] Raw body:', JSON.stringify(rawBody, null, 2));

    // Validate with Zod schema
    const parseResult = createOrderFromAISchema.safeParse(rawBody);
    if (!parseResult.success) {
      const errors = parseResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
      console.error('[create-order-from-ai] Validation error:', errors);
      return new Response(
        JSON.stringify({ success: false, error: `Dados inválidos: ${errors}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = parseResult.data;
    console.log('[create-order-from-ai] Validated body:', JSON.stringify(body, null, 2));

    // Check store status
    const storeStatus = await isStoreOpen(supabase);
    if (!storeStatus.open) {
      return new Response(
        JSON.stringify({ success: false, error: storeStatus.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate totals (items already validated by Zod)
    let subtotal = 0;
    let extras_fee = 0;

    for (const item of body.items) {
      subtotal += item.price * item.quantity;

      if (item.tapioca_molhada) {
        extras_fee += 1.00 * item.quantity;
      }

      if (item.extras && Array.isArray(item.extras)) {
        for (const extra of item.extras) {
          extras_fee += (extra.price || 0) * item.quantity;
        }
      }
    }

    // Normalize order_type
    let orderType: 'local' | 'retirada' | 'entrega' = 'local';
    if (body.order?.order_type === 'delivery') {
      orderType = 'entrega';
    } else if (body.order?.order_type === 'pickup') {
      orderType = 'retirada';
    }

    // Get delivery fee
    let delivery_fee = 0;
    if (orderType === 'entrega' && body.order?.bairro) {
      delivery_fee = await getDeliveryFee(supabase, body.order.bairro);
    }

    const total = subtotal + extras_fee + delivery_fee;
    console.log('[create-order-from-ai] Totals:', { subtotal, extras_fee, delivery_fee, total });

    // Insert order
    const orderData = {
      customer_name: body.customer.name.trim(),
      customer_phone: body.customer.phone.trim(),
      order_type: orderType,
      scheduled_for: body.order?.scheduled_for || null,
      address: body.order?.address || null,
      cep: null,
      reference: null,
      subtotal,
      extras_fee,
      delivery_tax: delivery_fee,
      total,
      status: 'A_PREPARAR'
    };

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert(orderData)
      .select()
      .single();

    if (orderError) {
      console.error('[create-order-from-ai] Order error:', orderError);
      throw orderError;
    }

    console.log('[create-order-from-ai] Order created:', order.id);

    // Insert order items
    const orderItemsData = body.items.map(item => ({
      order_id: order.id,
      item_id: item.item_id,
      quantity: item.quantity,
      price: item.price || 0,
      extras: item.extras || [],
      tapioca_molhada: item.tapioca_molhada || false
    }));

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItemsData);

    if (itemsError) {
      console.error('[create-order-from-ai] Items error:', itemsError);
      await supabase.from('orders').delete().eq('id', order.id);
      throw itemsError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        order_id: order.id,
        order_number: order.id.slice(-6).toUpperCase(),
        total: total,
        message: `Pedido #${order.id.slice(-6).toUpperCase()} criado com sucesso! Total: R$ ${total.toFixed(2)}`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[create-order-from-ai] Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro interno ao criar pedido' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
