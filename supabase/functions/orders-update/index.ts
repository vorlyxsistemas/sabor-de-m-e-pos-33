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
  price: z.number().min(0).max(9999.99),
  extras: z.any().optional().default([]),
  tapioca_molhada: z.boolean().optional().default(false),
});

const updateOrderBodySchema = z.object({
  id: uuidSchema,
  items: z.array(updateOrderItemSchema).min(1, "Pedido deve ter pelo menos um item").max(30),
  observations: z.string().max(500).optional().nullable(),
  subtotal: z.number().min(0).max(99999.99),
  total: z.number().min(0).max(99999.99),
});

async function hasRole(supabase: any, userId: string, role: "admin" | "staff") {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: role });
  if (error) {
    console.error(`Error checking ${role} role:`, error);
    return false;
  }
  return data === true;
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
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    // Use anon key client for auth validation
    const supabaseAuth = createClient(supabaseUrl, anonKey);
    // Use service role for data operations (bypasses RLS)
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabaseAuth.auth.getUser(token);

    if (authError || !user) {
      console.error("Auth error:", authError);
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    console.log("Updating order with items:", orderId);

    // Ensure order exists and not cancelled
    const { data: existingOrder, error: orderCheckError } = await supabase
      .from("orders")
      .select("id, status")
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

    // Delete existing items (service role bypasses RLS)
    const { error: deleteError } = await supabase.from("order_items").delete().eq("order_id", orderId);
    if (deleteError) {
      console.error("Error deleting order items:", deleteError);
      throw deleteError;
    }

    // Insert new items
    const itemsToInsert = body.items.map((item) => ({
      order_id: orderId,
      item_id: item.item_id || null,
      quantity: item.quantity,
      price: item.price,
      extras: item.extras ?? [],
      tapioca_molhada: item.tapioca_molhada ?? false,
    }));

    const { error: insertError } = await supabase.from("order_items").insert(itemsToInsert);
    if (insertError) {
      console.error("Error inserting order items:", insertError);
      throw insertError;
    }

    const { data: updatedOrder, error: updateError } = await supabase
      .from("orders")
      .update({
        subtotal: body.subtotal,
        total: body.total,
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
