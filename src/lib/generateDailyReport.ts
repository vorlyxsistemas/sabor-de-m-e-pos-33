import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/integrations/supabase/client";

interface OrderItem {
  quantity: number;
  price: number;
  extras: any;
  tapioca_molhada: boolean;
  item: { name: string } | null;
}

interface Order {
  id: string;
  customer_name: string;
  order_type: string;
  subtotal: number;
  delivery_tax: number | null;
  extras_fee: number | null;
  total: number;
  status: string;
  created_at: string;
  order_items: OrderItem[];
}

export async function generateDailyReport() {
  // Get today's date range
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);

  // Fetch today's delivered orders
  const { data: orders, error } = await supabase
    .from("orders")
    .select(`
      id,
      customer_name,
      order_type,
      subtotal,
      delivery_tax,
      extras_fee,
      total,
      status,
      created_at,
      order_items(quantity, price, extras, tapioca_molhada, item:items(name))
    `)
    .gte("created_at", startOfDay.toISOString())
    .lte("created_at", endOfDay.toISOString())
    .neq("status", "cancelled");

  if (error) {
    console.error("Error fetching orders for report:", error);
    throw error;
  }

  const allOrders = (orders as Order[]) || [];
  const deliveredOrders = allOrders.filter((o) => o.status === "delivered");

  // Calculate stats
  const totalRevenue = deliveredOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);
  const totalOrders = allOrders.length;
  const avgTicket = deliveredOrders.length > 0 ? totalRevenue / deliveredOrders.length : 0;

  const ordersByType = {
    local: allOrders.filter((o) => o.order_type === "local").length,
    retirada: allOrders.filter((o) => o.order_type === "retirada").length,
    entrega: allOrders.filter((o) => o.order_type === "entrega").length,
  };

  // Calculate best-selling items
  const itemSales: Record<string, { qty: number; total: number }> = {};
  const extrasSales: Record<string, number> = {};

  allOrders.forEach((order) => {
    order.order_items?.forEach((item) => {
      const itemName = item.item?.name || "Item desconhecido";
      if (!itemSales[itemName]) {
        itemSales[itemName] = { qty: 0, total: 0 };
      }
      itemSales[itemName].qty += item.quantity;
      itemSales[itemName].total += Number(item.price);

      // Count extras
      if (item.tapioca_molhada) {
        extrasSales["Tapioca molhada"] = (extrasSales["Tapioca molhada"] || 0) + item.quantity;
      }

      const extras = item.extras as any;
      if (extras && Array.isArray(extras)) {
        extras.forEach((e: any) => {
          const extraName = e.name || "Extra";
          extrasSales[extraName] = (extrasSales[extraName] || 0) + 1;
        });
      }

      // Count lunch extras
      if (extras?.extraMeats && Array.isArray(extras.extraMeats)) {
        extras.extraMeats.forEach((meat: string) => {
          extrasSales[`Carne extra: ${meat}`] = (extrasSales[`Carne extra: ${meat}`] || 0) + 1;
        });
      }
    });
  });

  // Sort items by quantity sold
  const sortedItems = Object.entries(itemSales)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 15);

  const sortedExtras = Object.entries(extrasSales)
    .map(([name, qty]) => ({ name, qty }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 10);

  // Create PDF
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const dateStr = now.toLocaleDateString("pt-BR");
  const timeStr = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  // Header
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("SABOR DE MÃE", pageWidth / 2, 20, { align: "center" });
  doc.setFontSize(14);
  doc.setFont("helvetica", "normal");
  doc.text("Relatório Diário", pageWidth / 2, 28, { align: "center" });
  doc.setFontSize(10);
  doc.text(`Data: ${dateStr}`, pageWidth / 2, 35, { align: "center" });

  // Financial Summary
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Resumo Financeiro", 14, 50);

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  const summaryData = [
    ["Faturamento do Dia", `R$ ${totalRevenue.toFixed(2).replace(".", ",")}`],
    ["Total de Pedidos", totalOrders.toString()],
    ["Pedidos Entregues", deliveredOrders.length.toString()],
    ["Ticket Médio", `R$ ${avgTicket.toFixed(2).replace(".", ",")}`],
    ["Pedidos Local", ordersByType.local.toString()],
    ["Pedidos Retirada", ordersByType.retirada.toString()],
    ["Pedidos Entrega", ordersByType.entrega.toString()],
  ];

  autoTable(doc, {
    startY: 55,
    head: [["Descrição", "Valor"]],
    body: summaryData,
    theme: "grid",
    headStyles: { fillColor: [41, 128, 185] },
    margin: { left: 14, right: 14 },
  });

  // Best-selling items
  const finalY1 = (doc as any).lastAutoTable.finalY || 100;
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Itens Mais Vendidos", 14, finalY1 + 15);

  if (sortedItems.length > 0) {
    autoTable(doc, {
      startY: finalY1 + 20,
      head: [["Item", "Qtd", "Total R$"]],
      body: sortedItems.map((item) => [
        item.name,
        item.qty.toString(),
        item.total.toFixed(2).replace(".", ","),
      ]),
      theme: "grid",
      headStyles: { fillColor: [39, 174, 96] },
      margin: { left: 14, right: 14 },
    });
  } else {
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Nenhum item vendido hoje", 14, finalY1 + 25);
  }

  // Extras most sold
  const finalY2 = (doc as any).lastAutoTable?.finalY || finalY1 + 30;
  
  // Check if we need a new page
  if (finalY2 > 230) {
    doc.addPage();
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Extras Mais Vendidos", 14, 20);

    if (sortedExtras.length > 0) {
      autoTable(doc, {
        startY: 25,
        head: [["Extra", "Quantidade"]],
        body: sortedExtras.map((e) => [e.name, e.qty.toString()]),
        theme: "grid",
        headStyles: { fillColor: [142, 68, 173] },
        margin: { left: 14, right: 14 },
      });
    }
  } else {
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Extras Mais Vendidos", 14, finalY2 + 15);

    if (sortedExtras.length > 0) {
      autoTable(doc, {
        startY: finalY2 + 20,
        head: [["Extra", "Quantidade"]],
        body: sortedExtras.map((e) => [e.name, e.qty.toString()]),
        theme: "grid",
        headStyles: { fillColor: [142, 68, 173] },
        margin: { left: 14, right: 14 },
      });
    } else {
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text("Nenhum extra vendido hoje", 14, finalY2 + 25);
    }
  }

  // Footer with generation timestamp
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(
      `Relatório gerado em ${dateStr} às ${timeStr} - Página ${i} de ${pageCount}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: "center" }
    );
  }

  // Download the PDF
  doc.save(`relatorio-sabor-de-mae-${dateStr.replace(/\//g, "-")}.pdf`);
}
