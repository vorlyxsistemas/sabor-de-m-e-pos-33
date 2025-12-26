import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};

const uuidSchema = z.string().uuid("ID inválido");

const updateOrderItemSchema = z.object({
  item_id: z.union([uuidSchema, z.null()]).optional(),
  quantity: z.number().int().min(1).max(50),
  price: z.number().min(0).max(9999.99), // This is UNIT price
  extras: z.any().optional().default([]),
  tapioca_molhada: z.boolean().optional().default(false),
});

const updateOrderBodySchema = z.object({
  id: uuidSchema,
  items: z.array(updateOrderItemSchema).min(1, "Pedido deve ter pelo menos um item").max(30),
  observations: z.string().max(500).optional().nullable(),
  // subtotal and total are accepted but will be RECALCULATED on backend
  subtotal: z.number().min(0).max(99999.99).optional(),
  total: z.number().min(0).max(99999.99).optional(),
});

async function hasRole(supabase: any, userId: string, role: "admin" | "staff") {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: role });
  if (error) {
    console.error(`Error checking ${role} role:`, error);
    return false;
  }
  return data === true;
}

// Calculate extras price from extras object/array
function calculateExtrasPrice(extras: any): number {
  if (!extras) return 0;
  
  let extrasPrice = 0;
  
  if (typeof extras === 'object' && !Array.isArray(extras)) {
    // Lunch item with extras object
    if (extras.type === 'lunch') {
      // Extra meats cost R$3 each
      const extraMeats = extras.extraMeats || [];
      extrasPrice += extraMeats.length * 3;
      
      // Paid sides cost
      const paidSides = extras.paidSides || [];
      paidSides.forEach((side: any) => {
        extrasPrice += Number(side.price) || 0;
      });
    }
  } else if (Array.isArray(extras)) {
    // Regular extras array
    extras.forEach((extra: any) => {
      extrasPrice += Number(extra.price) || 0;
    });
  }
  
  return extrasPrice;
}

// CRITICAL: Always recalculate totals from items - NEVER trust frontend values
function calculateOrderTotals(items: any[], deliveryTax: number = 0): { subtotal: number; total: number } {
  // Reset to zero and calculate fresh
  let subtotal = 0;
  
  for (const item of items) {
    const unitPrice = Number(item.price) || 0;
    const quantity = Number(item.quantity) || 1;
    const extrasPrice = calculateExtrasPrice(item.extras);
    
    // Line total = (unit price + extras) * quantity
    const lineTotal = (unitPrice + extrasPrice) * quantity;
    subtotal += lineTotal;
    
    console.log(`Item calculation: unitPrice=${unitPrice}, extras=${extrasPrice}, qty=${quantity}, lineTotal=${lineTotal}`);
  }
  
  // Round to 2 decimal places
  subtotal = Math.round(subtotal * 100) / 100;
  const total = Math.round((subtotal + deliveryTax) * 100) / 100;
  
  console.log(`Order totals: subtotal=${subtotal}, deliveryTax=${deliveryTax}, total=${total}`);
  
  return { subtotal, total };
}

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("No authorization header provided");
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    console.log("Validating token for orders-update...");
    
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error("Auth error details:", authError?.message, authError?.status);
      return new Response(JSON.stringify({ error: "Token inválido", details: authError?.message }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    console.log("User authenticated:", user.id, user.email);

    const [isAdmin, isStaff] = await Promise.all([
      hasRole(supabase, user.id, "admin"),
      hasRole(supabase, user.id, "staff"),
    ]);

    if (!isAdmin && !isStaff) {
      return new Response(JSON.stringify({ error: "Acesso negado" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rawBody = await req.json();
    console.log("Received update request:", JSON.stringify(rawBody, null, 2));
    
    const bodyResult = updateOrderBodySchema.safeParse(rawBody);
    if (!bodyResult.success) {
      const errors = bodyResult.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ");
      console.error("Update order validation error:", errors);
      return new Response(JSON.stringify({ error: `Dados inválidos: ${errors}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = bodyResult.data;
    const orderId = body.id;

    console.log("Updating order:", orderId, "with", body.items.length, "items");

    // Ensure order exists and not cancelled, also get delivery_tax
    const { data: existingOrder, error: orderCheckError } = await supabase
      .from("orders")
      .select("id, status, delivery_tax")
      .eq("id", orderId)
      .maybeSingle();

    if (orderCheckError) throw orderCheckError;
    if (!existingOrder) {
      return new Response(JSON.stringify({ error: "Pedido não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if ((existingOrder as any).status === "cancelled") {
      return new Response(JSON.stringify({ error: "Não é possível editar pedidos cancelados" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // CRITICAL: Recalculate totals from scratch - NEVER trust frontend values
    const deliveryTax = Number((existingOrder as any).delivery_tax) || 0;
    const { subtotal, total } = calculateOrderTotals(body.items, deliveryTax);
    
    console.log(`Backend calculated: subtotal=${subtotal}, total=${total} (frontend sent: subtotal=${body.subtotal}, total=${body.total})`);

    // Delete existing items (service role bypasses RLS)
    const { error: deleteError } = await supabase.from("order_items").delete().eq("order_id", orderId);
    if (deleteError) {
      console.error("Error deleting order items:", deleteError);
      throw deleteError;
    }

    // Insert new items with UNIT prices only
    const itemsToInsert = body.items.map((item) => ({
      order_id: orderId,
      item_id: item.item_id || null,
      quantity: item.quantity,
      price: item.price, // This is UNIT price, not line total
      extras: item.extras ?? [],
      tapioca_molhada: item.tapioca_molhada ?? false,
    }));

    console.log("Inserting items:", JSON.stringify(itemsToInsert, null, 2));

    const { error: insertError } = await supabase.from("order_items").insert(itemsToInsert);
    if (insertError) {
      console.error("Error inserting order items:", insertError);
      throw insertError;
    }

    // Update order with BACKEND-CALCULATED values
    const { data: updatedOrder, error: updateError } = await supabase
      .from("orders")
      .update({
        subtotal: subtotal, // Backend calculated
        total: total,       // Backend calculated
        observations: body.observations || null,
        last_modified_at: new Date().toISOString(),
        last_modified_by: user.id,
      })
      .eq("id", orderId)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating order:", updateError);
      throw updateError;
    }

    console.log("Order updated successfully:", orderId, "subtotal:", subtotal, "total:", total);

    return new Response(JSON.stringify({ data: updatedOrder, message: "Pedido atualizado com sucesso" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("orders-update error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
