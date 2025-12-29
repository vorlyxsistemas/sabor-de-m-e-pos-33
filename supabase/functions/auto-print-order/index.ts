import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PRINT_SERVER_URL = Deno.env.get('PRINT_SERVER_URL') || 'http://localhost:5000/print';

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Only accept POST
  if (req.method !== 'POST') {
    console.error('Method not allowed:', req.method);
    return new Response(
      JSON.stringify({ error: 'Método não permitido. Use POST.' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const { order_id } = await req.json();

    // Validate order_id
    if (!order_id) {
      console.error('Missing order_id in request');
      return new Response(
        JSON.stringify({ error: 'order_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Processing auto-print for order:', order_id);

    // Create Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch order with items
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        id,
        table_number,
        notes,
        total,
        created_at,
        printed,
        printed_at,
        order_items (
          id,
          quantity,
          unit_price,
          subtotal,
          notes,
          item:items (
            name
          )
        )
      `)
      .eq('id', order_id)
      .single();

    if (orderError || !order) {
      console.error('Order not found:', order_id, orderError?.message);
      return new Response(
        JSON.stringify({ error: 'Pedido não encontrado', details: orderError?.message }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if already printed
    if (order.printed === true) {
      console.log('Order already printed:', order_id);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Pedido já foi impresso anteriormente',
          printed_at: order.printed_at 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Prepare data for PrintServer
    const printData = {
      order_id: order.id,
      table_number: order.table_number,
      items: order.order_items.map((item: any) => ({
        name: item.item?.name || 'Item desconhecido',
        quantity: item.quantity,
        unit_price: item.unit_price,
        subtotal: item.subtotal,
        notes: item.notes
      })),
      notes: order.notes,
      total: order.total,
      created_at: order.created_at
    };

    console.log('Sending to PrintServer:', PRINT_SERVER_URL);

    // Send to PrintServer
    let printResponse;
    try {
      printResponse = await fetch(PRINT_SERVER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(printData)
      });
    } catch (fetchError) {
      console.error('Failed to connect to PrintServer:', fetchError);
      return new Response(
        JSON.stringify({ 
          error: 'Não foi possível conectar ao servidor de impressão',
          details: String(fetchError)
        }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let printResult;
    try {
      printResult = await printResponse.json();
    } catch {
      console.error('Invalid response from PrintServer');
      return new Response(
        JSON.stringify({ error: 'Resposta inválida do servidor de impressão' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('PrintServer response:', printResult);

    // Check print result
    if (!printResult.success) {
      console.error('Print failed:', printResult.error);
      return new Response(
        JSON.stringify({ 
          error: 'Falha na impressão',
          details: printResult.error 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Mark order as printed
    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from('orders')
      .update({ 
        printed: true, 
        printed_at: now 
      })
      .eq('id', order_id);

    if (updateError) {
      console.error('Failed to update order printed status:', updateError.message);
      return new Response(
        JSON.stringify({ 
          error: 'Impressão realizada, mas falha ao atualizar status',
          details: updateError.message 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Order printed successfully:', order_id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Pedido impresso com sucesso',
        printed_at: now 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error in auto-print-order:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno', details: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
