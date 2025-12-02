import { useState, useEffect } from "react";
import { StaffLayout } from "@/components/layout/StaffLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Eye } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Orders = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState<any>(null);

  useEffect(() => { fetchOrders(); }, [statusFilter]);

  const fetchOrders = async () => {
    setLoading(true);
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    let query = supabase
      .from('orders')
      .select(`*, order_items(*, item:items(name))`)
      .gte('created_at', threeDaysAgo.toISOString())
      .order('created_at', { ascending: false });

    if (statusFilter !== 'all') query = query.eq('status', statusFilter as any);

    const { data } = await query;
    setOrders(data || []);
    setLoading(false);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      pending: 'secondary', preparing: 'default', ready: 'default', delivered: 'outline', cancelled: 'destructive'
    };
    return <Badge variant={variants[status] || 'outline'}>{status}</Badge>;
  };

  return (
    <StaffLayout title="Pedidos" subtitle="Histórico dos últimos 3 dias">
      <div className="flex gap-4 mb-4">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pending">Pendente</SelectItem>
            <SelectItem value="preparing">Preparando</SelectItem>
            <SelectItem value="ready">Pronto</SelectItem>
            <SelectItem value="delivered">Entregue</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={() => navigate('/orders/new')}>Novo Pedido</Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Data</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map(order => (
                <TableRow key={order.id}>
                  <TableCell className="font-medium">{order.customer_name}</TableCell>
                  <TableCell>{order.order_type}</TableCell>
                  <TableCell>R$ {Number(order.total).toFixed(2)}</TableCell>
                  <TableCell>{getStatusBadge(order.status)}</TableCell>
                  <TableCell>{new Date(order.created_at).toLocaleString('pt-BR')}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => setSelectedOrder(order)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Pedido #{selectedOrder?.id?.slice(0, 8)}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p><strong>Cliente:</strong> {selectedOrder?.customer_name}</p>
            <p><strong>Telefone:</strong> {selectedOrder?.customer_phone || '-'}</p>
            <p><strong>Tipo:</strong> {selectedOrder?.order_type}</p>
            {selectedOrder?.address && <p><strong>Endereço:</strong> {selectedOrder?.address}</p>}
            <div>
              <strong>Itens:</strong>
              <ul className="mt-2 space-y-1">
                {selectedOrder?.order_items?.map((oi: any, i: number) => (
                  <li key={i} className="text-sm">{oi.quantity}x {oi.item?.name} - R$ {Number(oi.price).toFixed(2)}</li>
                ))}
              </ul>
            </div>
            <p><strong>Total:</strong> R$ {Number(selectedOrder?.total).toFixed(2)}</p>
          </div>
        </DialogContent>
      </Dialog>
    </StaffLayout>
  );
};

export default Orders;
