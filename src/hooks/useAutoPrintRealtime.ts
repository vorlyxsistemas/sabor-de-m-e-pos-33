// useAutoPrintRealtime.ts
import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

// URL do Print Server via variável de ambiente
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
            // Buscar dados completos do pedido
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

            // Construir array de items detalhados
            const items = (fullOrder.order_items || []).map((oi: any) => {
              let notesArr: string[] = [];

              // Adicionar extras como observação
              if (oi.extras) notesArr.push(oi.extras);

              // Marcar tapioca molhada
              if (oi.tapioca_molhada) notesArr.push("Tapioca Molhada");

              // Observações do item
              if (oi.notes) notesArr.push(oi.notes);

              return {
                quantity: oi.quantity || 1,
                name: oi.item?.name || "Item",
                notes: notesArr.join(" | "), // concatena com separador
                price: oi.price || 0,
              };
            });

            // Preparar objeto final para ESC/POS
            const orderForPrint = {
              order_id: fullOrder.id,
              table: fullOrder.table_number || fullOrder.order_type || "N/A",
              created_at: fullOrder.created_at || new Date().toISOString(),
              items,
              notes: fullOrder.observations || fullOrder.notes || "",
              customer_name: fullOrder.customer_name || "",
              customer_phone: fullOrder.customer_phone || "",
              subtotal: fullOrder.subtotal || 0,
              extras_fee: fullOrder.extras_fee || 0,
              total: fullOrder.total || 0,
              payment_method: fullOrder.payment_method || "",
            };

            // Enviar para print server ESC/POS
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            const response = await fetch(`${PRINT_SERVER_URL}/print`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(orderForPrint),
              signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
              const errorText = await response.text();
              console.error(`[AutoPrint] Print Server retornou erro para ${orderId}:`, errorText);
              processingOrdersRef.current.delete(orderId);
              return;
            }

            console.log(`[AutoPrint] Pedido impresso com sucesso: ${orderId}`);

            // Log sucesso (campo printed não existe na tabela)
            console.log(`[AutoPrint] Pedido ${orderId} processado com sucesso.`);

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
