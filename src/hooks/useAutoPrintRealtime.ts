import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Hook para impressão automática de pedidos via Supabase Realtime.
 *
 * - Escuta eventos INSERT na tabela "orders"
 * - Envia automaticamente para o Print Server local (localhost:5000)
 * - Marca o pedido como impresso (printed=true, printed_at) após sucesso
 * - Usa Set em memória para evitar impressões duplicadas
 * - Não interfere nos botões manuais de impressão
 */
export function useAutoPrintRealtime(): void {
  // Set para rastrear pedidos já processados (evita duplicação)
  const processedOrdersRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    console.log("[AutoPrint] Iniciando listener de impressão automática...");

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
          const order = payload.new as Record<string, unknown>;
          const orderId = order.id as string;
          const printed = order.printed as boolean | undefined;

          // Verificar se já foi processado
          if (processedOrdersRef.current.has(orderId)) {
            console.log(`[AutoPrint] Pedido ${orderId} já processado, ignorando.`);
            return;
          }

          // Verificar se já está impresso
          if (printed === true) {
            console.log(`[AutoPrint] Pedido ${orderId} já está impresso, ignorando.`);
            processedOrdersRef.current.add(orderId);
            return;
          }

          // Marcar como em processamento
          processedOrdersRef.current.add(orderId);
          console.log(`[AutoPrint] Novo pedido detectado: ${orderId}`);

          try {
            // Buscar dados completos do pedido (incluindo order_items)
            // Nota: Alguns campos podem não estar no types.ts mas existem no banco
            const { data, error: fetchError } = await supabase
              .from("orders")
              .select(
                `
                *,
                order_items (
                  id,
                  quantity,
                  price,
                  extras,
                  tapioca_molhada,
                  item:items (
                    id,
                    name
                  )
                )
              `,
              )
              .eq("id", orderId)
              .single();

            if (fetchError || !data) {
              console.error(`[AutoPrint] Erro ao buscar pedido ${orderId}:`, fetchError);
              return;
            }

            // Cast para any para acessar campos não tipados
            const fullOrder = data as Record<string, unknown>;

            // Verificar novamente se já foi impresso (pode ter mudado)
            if (fullOrder.printed === true) {
              console.log(`[AutoPrint] Pedido ${orderId} já impresso (verificação dupla).`);
              return;
            }

            // Preparar dados para o Print Server
            const orderItems = fullOrder.order_items as Array<Record<string, unknown>> | undefined;
            const printPayload = {
              order_id: fullOrder.id,
              table: fullOrder.table_number,
              customer_name: fullOrder.customer_name,
              customer_phone: fullOrder.customer_phone,
              order_type: fullOrder.order_type,
              address: fullOrder.address,
              bairro: fullOrder.bairro,
              cep: fullOrder.cep,
              reference: fullOrder.reference,
              subtotal: fullOrder.subtotal,
              delivery_tax: fullOrder.delivery_tax,
              extras_fee: fullOrder.extras_fee,
              total: fullOrder.total,
              created_at: fullOrder.created_at,
              payment_method: fullOrder.payment_method,
              troco: fullOrder.troco,
              observations: fullOrder.observations,
              items: orderItems?.map((oi) => ({
                quantity: oi.quantity,
                price: oi.price,
                extras: oi.extras,
                tapioca_molhada: oi.tapioca_molhada,
                item: oi.item,
              })),
            };

            console.log(`[AutoPrint] Enviando pedido ${orderId} para impressão...`);

            // Enviar para o Print Server local
            const printResponse = await fetch("http://localhost:5000/print-html", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(printPayload),
            });

            if (!printResponse.ok) {
              const errorText = await printResponse.text();
              console.error(`[AutoPrint] Print Server retornou erro para ${orderId}:`, errorText);
              // Não remove do Set - permite retry manual
              return;
            }

            console.log(`[AutoPrint] Impressão enviada com sucesso para ${orderId}`);

            // Marcar como impresso no banco (usando RPC ou update com any)
            const { error: updateError } = await supabase
              .from("orders")
              .update({
                printed: true,
                printed_at: new Date().toISOString(),
              } as Record<string, unknown>)
              .eq("id", orderId);

            if (updateError) {
              console.error(`[AutoPrint] Erro ao marcar pedido ${orderId} como impresso:`, updateError);
            } else {
              console.log(`[AutoPrint] Pedido ${orderId} marcado como impresso.`);
            }
          } catch (error) {
            // Falha na impressão - não trava o sistema
            console.error(`[AutoPrint] Erro ao processar pedido ${orderId}:`, error);
            // Não remove do Set para evitar retry automático infinito
            // O usuário pode usar impressão manual se necessário
          }
        },
      )
      .subscribe((status) => {
        console.log(`[AutoPrint] Status do canal: ${status}`);
      });

    // Cleanup ao desmontar
    return () => {
      console.log("[AutoPrint] Removendo listener de impressão automática...");
      supabase.removeChannel(channel);
    };
  }, []);
}
