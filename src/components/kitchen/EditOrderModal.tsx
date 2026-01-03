import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Minus, Trash2, Save, X, AlertCircle, UtensilsCrossed } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { LunchOrderModal, LunchCartItem } from "@/components/order/LunchOrderModal";

interface OrderItem {
  id?: string;
  quantity: number;
  price: number;
  extras: any;
  tapioca_molhada?: boolean;
  item: { id?: string; name: string; price?: number } | null;
  item_id?: string | null;
  isNew?: boolean;
}

interface Order {
  id: string;
  customer_name: string;
  customer_phone: string | null;
  status: string;
  order_type: string;
  table_number: number | null;
  address: string | null;
  bairro: string | null;
  reference: string | null;
  subtotal: number;
  delivery_tax: number | null;
  extras_fee: number | null;
  total: number;
  created_at: string;
  payment_method: string | null;
  troco: number | null;
  observations?: string | null;
  order_items: OrderItem[];
}

interface EditOrderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: Order | null;
  onOrderUpdated: () => void;
}

export function EditOrderModal({ open, onOpenChange, order, onOrderUpdated }: EditOrderModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [observations, setObservations] = useState("");
  const [availableItems, setAvailableItems] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedItemToAdd, setSelectedItemToAdd] = useState<string>("");
  const [showLunchModal, setShowLunchModal] = useState(false);
  const [lunchCategoryId, setLunchCategoryId] = useState<string | null>(null);

  const blockedStatuses = ["cancelled"];
  const isBlocked = order ? blockedStatuses.includes(order.status) : false;

  useEffect(() => {
    if (open && order) {
      const cloned = (order.order_items || []).map((it) => ({ ...it }));

      // Detect legacy orders where item.price was persisted as a LINE TOTAL (price×qty, sometimes including extras).
      // If detected, normalize to UNIT base price so quantity is applied only once when calculating/saving.
      const isLunch = (extras: any) => !!extras && typeof extras === "object" && !Array.isArray(extras) && (extras as any).type === "lunch";

      const sumRegularExtrasUnit = (extras: any): number => {
        if (!extras) return 0;
        if (Array.isArray(extras)) return extras.reduce((s, e) => s + (Number(e?.price) || 0), 0);
        if (typeof extras === "object" && !Array.isArray(extras) && Array.isArray((extras as any).regularExtras)) {
          return (extras as any).regularExtras.reduce((s: number, e: any) => s + (Number(e?.price) || 0), 0);
        }
        return 0;
      };

      const getLunchExtrasUnit = (extras: any): number => {
        if (!isLunch(extras)) return 0;
        const meatUnit = Number(extras?.base?.singleMeatPrice) || 6;
        const extraMeats = Array.isArray(extras?.extraMeats) ? extras.extraMeats.length : 0;
        const paidSidesTotal = Array.isArray(extras?.paidSides)
          ? extras.paidSides.reduce((sum: number, s: any) => sum + (Number(s?.price) || 0), 0)
          : 0;
        const regularExtrasTotal = Array.isArray(extras?.regularExtras)
          ? extras.regularExtras.reduce((sum: number, e: any) => sum + (Number(e?.price) || 0), 0)
          : 0;
        return extraMeats * meatUnit + paidSidesTotal + regularExtrasTotal;
      };

      const subtotalAssumingUnitRule = cloned.reduce((sum, it) => {
        const qty = Number(it.quantity) || 1;
        const extras = it.extras as any;
        const lunch = isLunch(extras);

        const unitBase = lunch ? (Number(extras?.base?.price) || Number(it.price) || 0) : (Number(it.price) || 0);
        const extrasUnit = lunch ? getLunchExtrasUnit(extras) : sumRegularExtrasUnit(extras);
        return sum + (unitBase + extrasUnit) * qty;
      }, 0);

      const subtotalAssumingLineRule = cloned.reduce((sum, it) => {
        const qty = Number(it.quantity) || 1;
        const extras = it.extras as any;
        const lunch = isLunch(extras);

        if (!lunch) return sum + (Number(it.price) || 0);

        const unitBase = Number(extras?.base?.price) || Number(it.price) || 0;
        const extrasUnit = getLunchExtrasUnit(extras);
        return sum + (unitBase + extrasUnit) * qty;
      }, 0);

      const target = Number(order.subtotal) || 0;
      const diffUnit = Math.abs(subtotalAssumingUnitRule - target);
      const diffLine = Math.abs(subtotalAssumingLineRule - target);
      const legacyLinePrices = diffLine + 0.01 < diffUnit;

      const normalized = legacyLinePrices
        ? cloned.map((it) => {
            const qty = Number(it.quantity) || 1;
            const extras = it.extras as any;

            if (isLunch(extras)) {
              // keep lunch aligned with backend rule: price is BASE unit; extras are computed from payload
              return { ...it, price: Number(extras?.base?.price) || Number(it.price) || 0 };
            }

            const extrasUnit = sumRegularExtrasUnit(extras);
            const unitBase = qty > 0 ? (Number(it.price) || 0) / qty - extrasUnit : Number(it.price) || 0;
            return { ...it, price: Math.max(0, Math.round(unitBase * 100) / 100) };
          })
        : cloned;

      setItems(normalized);
      setObservations(order.observations || "");
      fetchAvailableItems();
    }
  }, [open, order]);

  const fetchAvailableItems = async () => {
    setLoading(true);
    try {
      const { data: cats } = await supabase
        .from("categories")
        .select("*")
        .order("name");
      setCategories(cats || []);

      // Find lunch category
      const lunchCat = cats?.find(c => 
        c.name.toLowerCase().includes("almoço") || 
        c.name.toLowerCase().includes("almoco")
      );
      setLunchCategoryId(lunchCat?.id || null);

      const { data: allItems } = await supabase
        .from("items")
        .select("id, name, price, category_id, available, extras(*)")
        .eq("available", true)
        .order("name");
      setAvailableItems(allItems || []);
    } catch (error) {
      console.error("Error fetching items:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateItemQuantity = (index: number, delta: number) => {
    const newItems = [...items];
    const newQty = Math.max(1, newItems[index].quantity + delta);
    newItems[index].quantity = newQty;
    setItems(newItems);
  };

  const removeItem = (index: number) => {
    if (items.length === 1) {
      toast({ title: "O pedido deve ter pelo menos um item", variant: "destructive" });
      return;
    }
    setItems(items.filter((_, i) => i !== index));
  };

  const addNewItem = () => {
    if (!selectedItemToAdd) {
      toast({ title: "Selecione um item para adicionar", variant: "destructive" });
      return;
    }

    const itemToAdd = availableItems.find(i => i.id === selectedItemToAdd);
    if (!itemToAdd) return;

    const existingIndex = items.findIndex(
      i => (i.item_id === itemToAdd.id || i.item?.id === itemToAdd.id) && !i.isNew
    );

    if (existingIndex >= 0) {
      const newItems = [...items];
      newItems[existingIndex].quantity += 1;
      setItems(newItems);
      toast({ title: `Quantidade de ${itemToAdd.name} aumentada` });
    } else {
      const newItem: OrderItem = {
        item_id: itemToAdd.id,
        quantity: 1,
        price: Number(itemToAdd.price),
        extras: [],
        tapioca_molhada: false,
        item: { id: itemToAdd.id, name: itemToAdd.name, price: Number(itemToAdd.price) },
        isNew: true,
      };
      setItems([...items, newItem]);
      toast({ title: `${itemToAdd.name} adicionado ao pedido` });
    }
    
    setSelectedItemToAdd("");
  };

  const handleAddLunch = (lunchItem: LunchCartItem) => {
    const newItem: OrderItem = {
      item_id: null,
      quantity: lunchItem.quantity,
      // IMPORTANT: backend treats price as BASE unit price for lunch; extras are computed from extras payload
      price: Number(lunchItem.base.price) || 0,
      extras: {
        type: "lunch",
        base: lunchItem.base,
        meats: lunchItem.meats,
        extraMeats: lunchItem.extraMeats,
        sides: lunchItem.sides,
        paidSides: lunchItem.paidSides,
      },
      tapioca_molhada: false,
      item: { name: `Almoço - ${lunchItem.base.name}` },
      isNew: true,
    };
    setItems([...items, newItem]);
    toast({ title: "Almoço adicionado ao pedido!" });
  };

  const calculateTotals = () => {
    const isLunch = (extras: any) => !!extras && typeof extras === "object" && !Array.isArray(extras) && (extras as any).type === "lunch";

    const sumRegularExtrasUnit = (extras: any): number => {
      if (!extras) return 0;
      if (Array.isArray(extras)) return extras.reduce((s, e) => s + (Number(e?.price) || 0), 0);
      if (typeof extras === "object" && !Array.isArray(extras) && Array.isArray((extras as any).regularExtras)) {
        return (extras as any).regularExtras.reduce((s: number, e: any) => s + (Number(e?.price) || 0), 0);
      }
      return 0;
    };

    const getLunchExtrasUnit = (extras: any): number => {
      if (!isLunch(extras)) return 0;
      const meatUnit = Number(extras?.base?.singleMeatPrice) || 6;
      const extraMeats = Array.isArray(extras?.extraMeats) ? extras.extraMeats.length : 0;
      const paidSidesTotal = Array.isArray(extras?.paidSides)
        ? extras.paidSides.reduce((sum: number, s: any) => sum + (Number(s?.price) || 0), 0)
        : 0;
      const regularExtrasTotal = Array.isArray(extras?.regularExtras)
        ? extras.regularExtras.reduce((sum: number, e: any) => sum + (Number(e?.price) || 0), 0)
        : 0;
      return extraMeats * meatUnit + paidSidesTotal + regularExtrasTotal;
    };

    const subtotal = items.reduce((sum, item) => {
      const qty = Number(item.quantity) || 1;
      const extras = item.extras as any;
      const lunch = isLunch(extras);

      const unitBase = lunch ? (Number(extras?.base?.price) || Number(item.price) || 0) : (Number(item.price) || Number(item.item?.price) || 0);
      const extrasUnit = lunch ? getLunchExtrasUnit(extras) : sumRegularExtrasUnit(extras);

      return sum + (unitBase + extrasUnit) * qty;
    }, 0);

    const deliveryTax = Number(order?.delivery_tax) || 0;
    const total = subtotal + deliveryTax;

    return {
      subtotal: Number(subtotal.toFixed(2)),
      deliveryTax,
      total: Number(total.toFixed(2)),
    };
  };

  const handleSave = async () => {
    if (!order) return;

    if (isBlocked) {
      toast({ title: "Não é possível editar pedidos cancelados", variant: "destructive" });
      return;
    }

    if (items.length === 0) {
      toast({ title: "O pedido deve ter pelo menos um item", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const { subtotal, total } = calculateTotals();

      // Prepare order items payload with correct prices
      const orderItemsPayload = items.map(item => ({
        item_id: item.item_id || item.item?.id || null,
        quantity: Number(item.quantity) || 1,
        price: Number(item.price) || Number(item.item?.price) || 0,
        extras: item.extras || [],
        tapioca_molhada: Boolean(item.tapioca_molhada),
      }));

      console.log("Saving order update:", { 
        orderId: order.id, 
        itemsCount: orderItemsPayload.length,
        subtotal, 
        total,
        observations 
      });

      // Get current session to ensure we're authenticated
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Sessão expirada. Por favor, faça login novamente.");
      }

      const { data, error } = await supabase.functions.invoke("orders-update", {
        method: "POST",
        body: {
          id: order.id,
          items: orderItemsPayload,
          observations: observations || null,
          subtotal,
          total,
        },
      });

      // Check if the response contains an error
      if (error) {
        console.error("Edge function error:", error);
        throw error;
      }
      if (data?.error) {
        console.error("Response error:", data.error, data.details);
        throw new Error(data.details || data.error);
      }

      toast({ title: "Pedido atualizado com sucesso!" });
      onOrderUpdated();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error saving order:", error);
      
      let errorMessage = error.message || "Erro desconhecido";
      if (errorMessage.includes("Token inválido") || errorMessage.includes("401")) {
        errorMessage = "Sessão expirada. Por favor, faça login novamente.";
      }
      
      toast({ 
        title: "Erro ao salvar alterações", 
        description: errorMessage,
        variant: "destructive" 
      });
    } finally {
      setSaving(false);
    }
  };

  if (!order) return null;

  const filteredItems = selectedCategory 
    ? availableItems.filter(i => i.category_id === selectedCategory)
    : availableItems;

  const { subtotal, deliveryTax, total } = calculateTotals();

  const isLunchCategory = selectedCategory === lunchCategoryId;

  const getItemDisplayName = (item: OrderItem) => {
    const extras = item.extras as any;
    if (extras?.type === "lunch") {
      return `Almoço - ${extras?.base?.name || "Base"}`;
    }
    const baseName = item.item?.name || (item.item_id ? "Item carregando..." : "Item sem nome");
    const variation = extras?.selected_variation;
    return variation ? `${baseName} (${variation})` : baseName;
  };

  const getLunchDetails = (extras: any) => {
    if (extras?.type !== "lunch") return null;
    return {
      meats: extras.meats || [],
      extraMeats: extras.extraMeats || [],
      sides: extras.sides || [],
      paidSides: extras.paidSides || [],
    };
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Editar Pedido #{order.id.slice(-6).toUpperCase()}
              {order.status === "preparing" && (
                <Badge variant="secondary" className="bg-blue-100 text-blue-700">Em preparo</Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          {isBlocked ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Não é possível editar pedidos com status "Cancelado".
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-4">
              {order.status === "preparing" && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Este pedido já está em preparo. Novos itens serão marcados como adição posterior.
                  </AlertDescription>
                </Alert>
              )}

              {/* Current Items */}
              <div>
                <Label className="text-sm font-medium mb-2 block">Itens do Pedido</Label>
                <div className="space-y-2 border rounded-lg p-3 bg-muted/30">
                  {items.map((item, index) => {
                    const lunchDetails = getLunchDetails(item.extras);
                    
                    // Calculate line total for display
                    const unitPrice = Number(item.price) || Number(item.item?.price) || 0;
                    const qty = Number(item.quantity) || 1;
                    let extrasPrice = 0;
                    if (item.extras && typeof item.extras === 'object' && !Array.isArray(item.extras)) {
                      if ((item.extras as any).type === 'lunch') {
                        extrasPrice += ((item.extras as any).extraMeats || []).length * 6; // R$6 per extra meat
                        ((item.extras as any).paidSides || []).forEach((s: any) => {
                          extrasPrice += Number(s.price) || 0;
                        });
                        ((item.extras as any).regularExtras || []).forEach((e: any) => {
                          extrasPrice += Number(e.price) || 0;
                        });
                      }
                    } else if (Array.isArray(item.extras)) {
                      item.extras.forEach((e: any) => {
                        extrasPrice += Number(e.price) || 0;
                      });
                    }
                    const lineTotal = (unitPrice + extrasPrice) * qty;
                    
                    return (
                      <div key={index} className="flex items-start justify-between gap-2 py-2 border-b last:border-0">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{getItemDisplayName(item)}</span>
                            {item.isNew && (
                              <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                                Novo
                              </Badge>
                            )}
                          </div>
                          {lunchDetails && (
                            <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                              {lunchDetails.meats.length > 0 && (
                                <p>Carnes: {lunchDetails.meats.join(", ")}</p>
                              )}
                              {lunchDetails.extraMeats.length > 0 && (
                                <p className="text-orange-600">+ Extras: {lunchDetails.extraMeats.join(", ")} (+R${(lunchDetails.extraMeats.length * 3).toFixed(2)})</p>
                              )}
                              {lunchDetails.sides.length > 0 && (
                                <p className="text-green-600">Acomp: {lunchDetails.sides.join(", ")}</p>
                              )}
                            </div>
                          )}
                          <span className="text-xs text-muted-foreground">
                            R$ {unitPrice.toFixed(2)} {extrasPrice > 0 ? `+ R$ ${extrasPrice.toFixed(2)} ` : ''}× {qty} = R$ {lineTotal.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-7 w-7"
                            onClick={() => updateItemQuantity(index, -1)}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-6 text-center text-sm">{item.quantity}</span>
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-7 w-7"
                            onClick={() => updateItemQuantity(index, 1)}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive"
                            onClick={() => removeItem(index)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Add New Item */}
              <div className="border rounded-lg p-3 space-y-3">
                <Label className="text-sm font-medium">Adicionar Item</Label>
                <div className="flex gap-2">
                  <Select value={selectedCategory || "all"} onValueChange={(val) => setSelectedCategory(val === "all" ? "" : val)}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Categoria" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border shadow-lg z-50">
                      <SelectItem value="all">Todas</SelectItem>
                      {categories.map(cat => (
                        <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  {isLunchCategory ? (
                    <Button 
                      className="flex-1 gap-2" 
                      variant="outline"
                      onClick={() => setShowLunchModal(true)}
                    >
                      <UtensilsCrossed className="h-4 w-4" />
                      Adicionar Almoço Completo
                    </Button>
                  ) : (
                    <>
                      <Select value={selectedItemToAdd} onValueChange={setSelectedItemToAdd}>
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Selecione um item" />
                        </SelectTrigger>
                        <SelectContent className="bg-background border shadow-lg z-50">
                          {filteredItems.filter(item => item.id).map(item => (
                            <SelectItem key={item.id} value={item.id}>
                              {item.name} - R$ {Number(item.price).toFixed(2)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button onClick={addNewItem} disabled={!selectedItemToAdd}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
                
                {/* Quick lunch add button - sempre visível */}
                <Button 
                  variant="outline" 
                  className="w-full gap-2"
                  onClick={() => setShowLunchModal(true)}
                >
                  <UtensilsCrossed className="h-4 w-4" />
                  Adicionar Almoço Completo
                </Button>
              </div>

              {/* Observations */}
              <div>
                <Label className="text-sm font-medium mb-2 block">Observações</Label>
                <Textarea
                  value={observations}
                  onChange={(e) => setObservations(e.target.value)}
                  placeholder="Adicione observações sobre o pedido..."
                  rows={2}
                />
              </div>

              {/* Totals */}
              <div className="border-t pt-3 space-y-1">
                <div className="flex justify-between text-sm">
                  <span>Subtotal</span>
                  <span>R$ {subtotal.toFixed(2)}</span>
                </div>
                {deliveryTax > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>Taxa de entrega</span>
                    <span>R$ {deliveryTax.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold">
                  <span>Total</span>
                  <span>R$ {total.toFixed(2)}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
                  <X className="h-4 w-4 mr-2" />
                  Cancelar
                </Button>
                <Button onClick={handleSave} disabled={saving} className="flex-1">
                  {saving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Salvar Alterações
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <LunchOrderModal
        open={showLunchModal}
        onOpenChange={setShowLunchModal}
        onAddToOrder={handleAddLunch}
      />
    </>
  );
}
