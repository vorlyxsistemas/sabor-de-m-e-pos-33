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
  // REQUIRED: uuid for normal items, null ONLY for lunch items
  item_id: z.union([uuidSchema, z.null()]),
  quantity: z.number().int().min(1).max(50),
  price: z.number().min(0).max(9999.99), // This is UNIT price (may be ignored for lunch)
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

function isLunchExtras(extras: any): extras is {
  type: 'lunch'
  base?: { name?: string; price?: number; singleMeatPrice?: number }
  meats?: string[]
  extraMeats?: string[]
  sides?: string[]
  paidSides?: { name?: string; price?: number }[]
  regularExtras?: { name?: string; price?: number }[]
} {
  return (
    !!extras &&
    typeof extras === 'object' &&
    !Array.isArray(extras) &&
    (extras as any).type === 'lunch'
  )
}

function isVariationExtras(extras: any): extras is {
  selected_variation?: string
  regularExtras?: { name?: string; price?: number }[]
} {
  return !!extras && typeof extras === 'object' && !Array.isArray(extras) && (extras as any).type !== 'lunch'
}

function sumExtrasArray(extrasArr: any[]): number {
  let total = 0
  for (const e of extrasArr) total += Number(e?.price) || 0
  return total
}

function getLunchExtraMeatUnitPrice(lunchExtras: any): number {
  // Production behavior: legacy uses R$6 per extra meat. If base.singleMeatPrice exists, prefer it.
  const fromPayload = Number(lunchExtras?.base?.singleMeatPrice)
  return Number.isFinite(fromPayload) && fromPayload > 0 ? fromPayload : 6
}

function calculateExtrasUnitPrice(extras: any): number {
  if (!extras) return 0

  // Lunch extras (per unit)
  if (isLunchExtras(extras)) {
    const extraMeatsCount = Array.isArray(extras.extraMeats) ? extras.extraMeats.length : 0
    const meatUnit = getLunchExtraMeatUnitPrice(extras)
    const paidSidesTotal = Array.isArray(extras.paidSides)
      ? extras.paidSides.reduce((sum: number, s: any) => sum + (Number(s?.price) || 0), 0)
      : 0
    const regularExtrasTotal = Array.isArray(extras.regularExtras) ? sumExtrasArray(extras.regularExtras as any[]) : 0

    const extrasUnit = extraMeatsCount * meatUnit + paidSidesTotal + regularExtrasTotal

    console.log(
      `Lunch extras (unit): extraMeats=${extraMeatsCount}×${meatUnit}, paidSides=R$${paidSidesTotal.toFixed(2)}, regularExtras=R$${regularExtrasTotal.toFixed(2)}, total=R$${extrasUnit.toFixed(2)}`
    )

    return extrasUnit
  }

  // Variation object with regularExtras
  if (isVariationExtras(extras) && Array.isArray((extras as any).regularExtras)) {
    const unit = sumExtrasArray((extras as any).regularExtras)
    if (unit > 0) console.log(`Variation regularExtras (unit): R$${unit.toFixed(2)}`)
    return unit
  }

  // Regular extras array
  if (Array.isArray(extras)) {
    const unit = sumExtrasArray(extras)
    if (unit > 0) console.log(`Regular extras array (unit): count=${extras.length}, total=R$${unit.toFixed(2)}`)
    return unit
  }

  return 0
}

/**
 * CRITICAL: Always recalculate totals from items - NEVER trust frontend values
 *
 * Rule: total = SUM( (unitBase + extrasUnit) × quantity ) + deliveryTax
 * IMPORTANT: quantity is applied ONCE per item.
 */
function calculateOrderTotals(items: any[], deliveryTax: number = 0): { subtotal: number; total: number } {
  let subtotal = 0

  console.log(`\n=== CALCULATING ORDER TOTALS (${items.length} items) ===`)

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    const quantity = Number(item.quantity) || 1

    const extras = item.extras

    // For lunch: compute base from extras.base.price when available (prevents double counting when item.price already includes extras)
    const isLunch = isLunchExtras(extras) && item.item_id === null
    const unitBase = isLunch ? (Number(extras?.base?.price) || Number(item.price) || 0) : (Number(item.price) || 0)

    const extrasUnit = calculateExtrasUnitPrice(extras)

    const lineTotal = (unitBase + extrasUnit) * quantity
    subtotal += lineTotal

    console.log(
      `Item ${i + 1}: isLunch=${isLunch}, unitBase=R$${unitBase.toFixed(2)}, extrasUnit=R$${extrasUnit.toFixed(2)}, qty=${quantity}, lineTotal=R$${lineTotal.toFixed(2)}`
    )
  }

  subtotal = Math.round(subtotal * 100) / 100
  const total = Math.round((subtotal + deliveryTax) * 100) / 100

  console.log(`=== FINAL: subtotal=R$${subtotal.toFixed(2)}, deliveryTax=R$${deliveryTax.toFixed(2)}, total=R$${total.toFixed(2)} ===\n`)

  return { subtotal, total }
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

    // Guardrail: prevent saving non-lunch items with item_id=null (this causes missing names later)
    for (let i = 0; i < body.items.length; i++) {
      const it = body.items[i] as any;
      const isLunch = it.item_id === null && isLunchExtras(it.extras);
      if (it.item_id === null && !isLunch) {
        return new Response(JSON.stringify({ error: `Item inválido na posição ${i + 1}: item_id ausente` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

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
    const { error: updateError } = await supabase
      .from("orders")
      .update({
        subtotal: subtotal, // Backend calculated
        total: total,       // Backend calculated
        observations: body.observations ?? undefined, // Keep existing if not provided
        last_modified_at: new Date().toISOString(),
        last_modified_by: user.id,
      })
      .eq("id", orderId);

    if (updateError) {
      console.error("Error updating order:", updateError);
      throw updateError;
    }

    // Fetch complete order with order_items and item names for return
    const { data: completeOrder, error: fetchError } = await supabase
      .from("orders")
      .select(`
        *,
        order_items(
          *,
          item:items(id, name, price)
        )
      `)
      .eq("id", orderId)
      .single();

    if (fetchError) {
      console.error("Error fetching complete order:", fetchError);
      throw fetchError;
    }

    console.log("Order updated successfully:", orderId, "subtotal:", subtotal, "total:", total);

    return new Response(JSON.stringify({ data: completeOrder, message: "Pedido atualizado com sucesso" }), {
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
