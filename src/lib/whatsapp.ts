import { supabase } from "@/integrations/supabase/client";

interface SendTextParams {
  to: string;
  text: string;
}

interface SendImageParams {
  to: string;
  imageUrl: string;
  caption?: string;
}

interface SendButtonsParams {
  to: string;
  text: string;
  buttons: Array<{ buttonId: string; buttonText: { displayText: string } }>;
}

interface WhatsAppResponse {
  status: string;
  to: string;
  evolution_response?: unknown;
  error?: string;
}

export const WhatsAppService = {
  /**
   * Send a text message via WhatsApp
   */
  async sendText({ to, text }: SendTextParams): Promise<WhatsAppResponse> {
    const { data, error } = await supabase.functions.invoke("whatsapp-enviar", {
      body: { to, text, type: "text" }
    });

    if (error) {
      console.error("WhatsApp sendText error:", error);
      throw new Error(error.message || "Failed to send text message");
    }

    return data;
  },

  /**
   * Send an image with optional caption
   */
  async sendImage({ to, imageUrl, caption }: SendImageParams): Promise<WhatsAppResponse> {
    const { data, error } = await supabase.functions.invoke("whatsapp-enviar", {
      body: { to, imageUrl, caption, type: "image" }
    });

    if (error) {
      console.error("WhatsApp sendImage error:", error);
      throw new Error(error.message || "Failed to send image");
    }

    return data;
  },

  /**
   * Send interactive buttons
   */
  async sendButtons({ to, text, buttons }: SendButtonsParams): Promise<WhatsAppResponse> {
    const { data, error } = await supabase.functions.invoke("whatsapp-enviar", {
      body: { to, text, buttons, type: "buttons" }
    });

    if (error) {
      console.error("WhatsApp sendButtons error:", error);
      throw new Error(error.message || "Failed to send buttons");
    }

    return data;
  },

  /**
   * Send a menu with options
   */
  async sendMenu(to: string, title: string, options: string[]): Promise<WhatsAppResponse> {
    const buttons = options.slice(0, 3).map((opt, idx) => ({
      buttonId: `opt_${idx}`,
      buttonText: { displayText: opt }
    }));

    return this.sendButtons({ to, text: title, buttons });
  },

  /**
   * Parse incoming webhook event from Evolution API
   */
  parseIncomingEvent(event: unknown): {
    phone: string;
    message: string;
    type: string;
    raw: unknown;
  } | null {
    if (!event || typeof event !== 'object') return null;

    const e = event as Record<string, unknown>;
    const data = (e.data as Record<string, unknown>) || e;
    const message = (data.message as Record<string, unknown>) || {};
    const key = (message.key as Record<string, unknown>) || {};
    
    const from = (key.remoteJid as string) || 
                 (e.from as string) || 
                 (e.phone as string) || '';
    
    const text = ((message.message as Record<string, unknown>)?.conversation as string) ||
                 (((message.message as Record<string, unknown>)?.extendedTextMessage as Record<string, unknown>)?.text as string) ||
                 (e.text as string) ||
                 '';

    if (!from) return null;

    return {
      phone: from.replace('@s.whatsapp.net', '').replace('@c.us', ''),
      message: text,
      type: (data.messageType as string) || 'text',
      raw: event
    };
  }
};
