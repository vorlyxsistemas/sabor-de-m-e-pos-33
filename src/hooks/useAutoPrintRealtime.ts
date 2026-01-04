import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Hook para impressão automática de pedidos via Supabase Realtime.
 *
 * ⚠️ USO: Este hook deve ser chamado SOMENTE no layout/admin da cozinha,
 *         no notebook conectado à impressora local.
 *         NÃO usar em App.tsx ou outros layouts.
 *
 * - Escuta eventos INSERT na tabela "orders"
 * - Envia automaticamente para o Print Server local (IP configurável via env)
 * - Marca o pedido como impresso (printed=true, printed_at) após sucesso
 * - Usa Set em memória para evitar impressões duplicadas
 * - Não interfere nos botões manuais de impressão
 * - Usa timeout de 5s para evitar travamento de rede
 */

// URL do Print Server via variável de ambiente (sem fallback - obrigatório configurar)
const PRINT_SERVER_URL = import.meta.env.VITE_PRINT_SERVER_URL;

export function useAutoPrintRealtime(): void {
  // Set para rastrear pedidos já impressos com sucesso (evita duplicação)
  const processedOrdersRef = useRef<Set<string>>(new Set());
  // Set para rastrear pedidos em processamento (evita chamadas paralelas)
  const processingOrdersRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Validação: se a variável de ambiente não estiver definida, desativar impressão automática
    if (!PRINT_SERVER_URL) {
      console.error("[AutoPrint] VITE_PRINT_SERVER_URL não definida. Impressão automática desativada.");
      return;
    }

    console.log("[AutoPrint] Iniciando listener de impressão automática...");
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
          const order = payload.new as Record<string, unknown>;
          const orderId = order.id as string;
          const printed = order.printed as boolean | undefined;

          // Verificar se já foi impresso com sucesso anteriormente
          if (processedOrdersRef.current.has(orderId)) {
            console.log(`[AutoPrint] Pedido ${orderId} já foi impresso, ignorando.`);
            return;
          }

          // Verificar se está em processamento (evita chamadas paralelas)
          if (processingOrdersRef.current.has(orderId)) {
            console.log(`[AutoPrint] Pedido ${orderId} já está em processamento, ignorando.`);
            return;
          }

          // Verificar se já está marcado como impresso no banco
          if (printed === true) {
            console.log(`[AutoPrint] Pedido ${orderId} já está impresso no banco, ignorando.`);
            processedOrdersRef.current.add(orderId);
            return;
          }

          // Marcar como em processamento (temporário)
          processingOrdersRef.current.add(orderId);
          console.log(`[AutoPrint] Novo pedido detectado: ${orderId}`);

          try {
            // Buscar dados completos do pedido (incluindo order_items)
            const { data, error: fetchError } = await supabase
              .from("orders")
              .select(`
                *,
                order_items (
                  id,
                  quantity,
                  notes,
                  item:items (
                    id,
                    name
                  )
                )
              `)
              .eq("id", orderId)
              .single();

            if (fetchError || !data) {
              console.error(`[AutoPrint] Erro ao buscar pedido ${orderId}:`, fetchError);
              processingOrdersRef.current.delete(orderId);
              return;
            }

            const fullOrder = data as Record<string, unknown>;

            // Verificar novamente se já foi impresso (pode ter mudado)
            if (fullOrder.printed === true) {
              console.log(`[AutoPrint] Pedido ${orderId} já impresso (verificação dupla).`);
              processedOrdersRef.current.add(orderId);
              processingOrdersRef.current.delete(orderId);
              return;
            }

            // Preparar dados no formato esperado pelo Print Server
            const orderItems = fullOrder.order_items as Array<Record<string, unknown>> | undefined;
            const printPayload = {
              order_id: fullOrder.id as string,
              table: String(fullOrder.table_number ?? fullOrder.mesa ?? ""),
              items: (orderItems ?? []).map((oi) => ({
                quantity: oi.quantity as number,
                name: (oi.item as Record<string, unknown>)?.name ?? "Item",
                notes: (oi.notes as string) ?? "",
              })),
              notes: (fullOrder.notes as string) ?? (fullOrder.observations as string) ?? "",
              created_at: fullOrder.created_at as string,
            };

            console.log(`[AutoPrint] Payload enviado:`, printPayload);
            console.log(`[AutoPrint] Enviando pedido ${orderId} para impressão em ${PRINT_SERVER_URL}/print...`);

            // Usar AbortController com timeout de 5s para evitar travamento
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            try {
              // Enviar para o Print Server local
              const printResponse = await fetch(`${PRINT_SERVER_URL}/print`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(printPayload),
                signal: controller.signal,
              });

              clearTimeout(timeoutId);

              if (!printResponse.ok) {
                const errorText = await printResponse.text();
                console.error(`[AutoPrint] Print Server retornou erro para ${orderId}:`, errorText);
                // Remove do processamento para permitir retry manual
                processingOrdersRef.current.delete(orderId);
                // NÃO adiciona ao processedOrdersRef - permite reimprimir depois
                return;
              }
            } catch (fetchError) {
              clearTimeout(timeoutId);
              if ((fetchError as Error).name === "AbortError") {
                console.error(`[AutoPrint] Timeout (5s) ao tentar imprimir pedido ${orderId}`);
              } else {
                console.error(`[AutoPrint] Erro de rede ao imprimir pedido ${orderId}:`, fetchError);
              }
              // Remove do processamento para permitir retry manual
              processingOrdersRef.current.delete(orderId);
              // NÃO adiciona ao processedOrdersRef - permite reimprimir depois
              return;
            }

            console.log(`[AutoPrint] Pedido impresso com sucesso: ${orderId}`);

            // ✅ SOMENTE após sucesso: marcar como impresso no banco
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
              console.log(`[AutoPrint] Pedido ${orderId} marcado como impresso no banco.`);
            }

            // ✅ SOMENTE após sucesso: adicionar ao Set de processados
            processedOrdersRef.current.add(orderId);
            processingOrdersRef.current.delete(orderId);
          } catch (error) {
            // Falha na impressão - não trava o sistema
            console.error(`[AutoPrint] Erro na impressão:`, error);
            // Remove do processamento para permitir retry manual
            processingOrdersRef.current.delete(orderId);
            // NÃO adiciona ao processedOrdersRef - permite reimprimir depois
          }
        }
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
