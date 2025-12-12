import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper to verify admin role
async function verifyAdminRole(supabase: any, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .rpc('has_role', { _user_id: userId, _role: 'admin' });
  
  if (error) {
    console.error("Error checking admin role:", error);
    return false;
  }
  return data === true;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify JWT and get user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error("Auth error:", authError);
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify admin role for all operations
    const isAdmin = await verifyAdminRole(supabase, user.id);
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Acesso negado. Apenas administradores." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // GET - Fetch settings (get first row)
    if (req.method === "GET") {
      const { data, error } = await supabase
        .from("settings")
        .select("*")
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("Error fetching settings:", error);
        throw error;
      }

      // If no settings found, create default
      if (!data) {
        console.log("No settings found, creating default...");
        const { data: newSettings, error: insertError } = await supabase
          .from("settings")
          .insert({ 
            auto_print_enabled: false,
            whatsapp_enabled: false,
            webhook_n8n_url: null,
            is_open: false
          })
          .select()
          .single();

        if (insertError) {
          console.error("Error creating default settings:", insertError);
          throw insertError;
        }
        
        console.log("Default settings created:", newSettings);
        return new Response(JSON.stringify(newSettings), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log("Settings fetched:", data);
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST - Update settings
    if (req.method === "POST") {
      const body = await req.json();
      console.log("Updating settings with:", body);
      
      const { auto_print_enabled, webhook_n8n_url, whatsapp_enabled, is_open } = body;

      // First get current settings
      const { data: currentSettings } = await supabase
        .from("settings")
        .select("id")
        .limit(1)
        .maybeSingle();

      // Build update object with only provided fields
      const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString()
      };
      if (auto_print_enabled !== undefined) updateData.auto_print_enabled = auto_print_enabled;
      if (webhook_n8n_url !== undefined) updateData.webhook_n8n_url = webhook_n8n_url;
      if (whatsapp_enabled !== undefined) updateData.whatsapp_enabled = whatsapp_enabled;
      if (is_open !== undefined) updateData.is_open = is_open;

      let data;
      let error;

      if (currentSettings?.id) {
        // Update existing settings
        const result = await supabase
          .from("settings")
          .update(updateData)
          .eq("id", currentSettings.id)
          .select()
          .single();
        data = result.data;
        error = result.error;
      } else {
        // Insert new settings
        const result = await supabase
          .from("settings")
          .insert({
            auto_print_enabled: auto_print_enabled ?? false,
            whatsapp_enabled: whatsapp_enabled ?? false,
            webhook_n8n_url: webhook_n8n_url ?? null,
            is_open: is_open ?? false
          })
          .select()
          .single();
        data = result.data;
        error = result.error;
      }

      if (error) {
        console.error("Error updating settings:", error);
        throw error;
      }

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
