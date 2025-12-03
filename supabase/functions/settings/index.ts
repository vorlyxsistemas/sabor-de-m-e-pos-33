import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // GET - Fetch settings
    if (req.method === "GET") {
      const { data, error } = await supabase
        .from("settings")
        .select("*")
        .eq("id", 1)
        .single();

      if (error && error.code === "PGRST116") {
        // No settings found, create default
        const { data: newSettings, error: insertError } = await supabase
          .from("settings")
          .insert({ id: 1, auto_print_enabled: false })
          .select()
          .single();

        if (insertError) throw insertError;
        return new Response(JSON.stringify(newSettings), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (error) throw error;

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST - Update settings
    if (req.method === "POST") {
      const body = await req.json();
      const { auto_print_enabled, webhook_n8n_url, whatsapp_enabled } = body;

      // Build update object with only provided fields
      const updateData: Record<string, unknown> = { id: 1 };
      if (auto_print_enabled !== undefined) updateData.auto_print_enabled = auto_print_enabled;
      if (webhook_n8n_url !== undefined) updateData.webhook_n8n_url = webhook_n8n_url;
      if (whatsapp_enabled !== undefined) updateData.whatsapp_enabled = whatsapp_enabled;

      // Upsert settings
      const { data, error } = await supabase
        .from("settings")
        .upsert(updateData, { onConflict: "id" })
        .select()
        .single();

      if (error) throw error;

      console.log("Settings updated:", data);

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Settings error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
