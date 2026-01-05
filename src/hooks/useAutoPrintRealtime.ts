import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { generateReceiptHTML } from "@/lib/printReceipt";

const PRINT_SERVER_URL = import.meta.env.VITE_PRINT_SERVER_URL;

export function useAutoPrintRealtime(): void {
  const processedOrdersRef = useRef<Set<string>>(new Set());
  const processingOrdersRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!PRINT_SERVER_URL) {
      console.error("[AutoPrint] VITE_PRINT_SERVER_URL não definida. Impressão automática desativada.");
      return;
    }

    console.log("[AutoPrint] Listener de pedidos iniciado...");
    console.log("[AutoPrint] Print Server URL:", PRINT_SERVER_URL);

    const channel = supabase
      .channel("auto-print-orders")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "orders",
        },
        async (payload) => {
          const order = payload.new as Record<string, any>;
          const orderId = order.id as string;

          if (processedOrdersRef.current.has(orderId)) return;
          if (processingOrdersRef.current.has(orderId)) return;
          if (order.printed === true) {
            processedOrdersRef.current.add(orderId);
            return;
          }

          processingOrdersRef.current.add(orderId);
          console.log(`[AutoPrint] Novo pedido detectado: ${orderId}`);

          try {
            const { data, error } = await supabase
              .from("orders")
              .select(
                `
                *,
                order_items (
                  id,
                  quantity,
                  price,
                  notes,
                  extras,
                  tapioca_molhada,
                  item:items (id, name)
                )
              `,
              )
              .eq("id", orderId)
              .single();

            if (error || !data) {
              console.error(`[AutoPrint] Erro ao buscar pedido ${orderId}:`, error);
              processingOrdersRef.current.delete(orderId);
              return;
            }

            const fullOrder = data as any;
            if (fullOrder.printed === true) {
              processedOrdersRef.current.add(orderId);
              processingOrdersRef.current.delete(orderId);
              return;
            }

            // Gerar HTML usando a mesma função da impressão manual
            const receiptHTML = generateReceiptHTML(fullOrder);

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);

            const response = await fetch(`${PRINT_SERVER_URL}/print-html`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ html: receiptHTML }),
              signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
              const errorText = await response.text();
              console.error(`[AutoPrint] Print Server retornou erro para ${orderId}:`, errorText);
              processingOrdersRef.current.delete(orderId);
              return;
            }

            console.log(`[AutoPrint] Pedido ${orderId} impresso com sucesso.`);
            processedOrdersRef.current.add(orderId);
            processingOrdersRef.current.delete(orderId);
          } catch (err) {
            console.error(`[AutoPrint] Erro ao imprimir pedido ${orderId}:`, err);
            processingOrdersRef.current.delete(orderId);
          }
        },
      )
      .subscribe((status) => console.log(`[AutoPrint] Status do canal: ${status}`));

    return () => {
      console.log("[AutoPrint] Removendo listener de impressão automática...");
      supabase.removeChannel(channel);
    };
  }, []);
}
