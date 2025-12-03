import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { StaffLayout } from "@/components/layout/StaffLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Minus, Trash2, ShoppingCart, UtensilsCrossed, Store, MapPin, Truck } from "lucide-react";
import { LunchOrderSection } from "@/components/order/LunchOrderSection";
import { ItemCard } from "@/components/order/ItemCard";

interface CartItem {
  item_id: string | null;
  name: string;
  quantity: number;
  price: number;
  extras: { name: string; price: number }[];
  tapioca_molhada: boolean;
  // Lunch specific fields
  isLunch?: boolean;
  lunchBase?: { id: string; name: string; price: number };
  lunchMeats?: string[];
  lunchExtraMeats?: string[];
  lunchSides?: string[];
}

interface LunchCartItem {
  type: "lunch";
  base: { id: string; name: string; price: number };
  meats: string[];
  extraMeats: string[];
  sides: string[];
  quantity: number;
  totalPrice: number;
}

const NewOrder = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [categories, setCategories] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedCategoryName, setSelectedCategoryName] = useState<string>("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderType, setOrderType] = useState<'local' | 'retirada' | 'entrega'>('local');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [address, setAddress] = useState('');
  const [bairro, setBairro] = useState('');
  const [deliveryTax, setDeliveryTax] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    if (selectedCategory) fetchItems();
  }, [selectedCategory]);

  const fetchCategories = async () => {
    const { data } = await supabase.from('categories').select('*').order('name');
    setCategories(data || []);
    setLoading(false);
  };

  const fetchItems = async () => {
    const { data } = await supabase
      .from('items')
      .select('*, extras(*)')
      .eq('category_id', selectedCategory)
      .eq('available', true);
    setItems(data || []);
  };

  const addToCart = (item: any, extras: any[] = [], tapioca_molhada = false) => {
    const extrasTotal = extras.reduce((sum, e) => sum + Number(e.price), 0);
    const tapiocaExtra = tapioca_molhada ? 1 : 0;
    const price = Number(item.price) + extrasTotal + tapiocaExtra;

    setCart([...cart, {
      item_id: item.id,
      name: item.name,
      quantity: 1,
      price,
      extras,
      tapioca_molhada,
    }]);
  };

  const addLunchToCart = (lunchItem: LunchCartItem) => {
    const sidesNames = lunchItem.sides.map(s => {
      const sideMap: Record<string, string> = {
        macarrao: "Macarrão",
        farofa: "Farofa", 
        macaxeira: "Macaxeira",
        salada: "Salada"
      };
      return sideMap[s] || s;
    });

    const description = [
      lunchItem.base.name,
      `Carnes: ${lunchItem.meats.join(", ")}`,
      lunchItem.extraMeats.length > 0 ? `Extras: ${lunchItem.extraMeats.join(", ")}` : null,
      sidesNames.length > 0 ? `Acomp: ${sidesNames.join(", ")}` : null,
    ].filter(Boolean).join(" | ");

    setCart([...cart, {
      item_id: null,
      name: `Almoço - ${lunchItem.base.name}`,
      quantity: lunchItem.quantity,
      price: lunchItem.totalPrice / lunchItem.quantity,
      extras: lunchItem.extraMeats.map(m => ({ name: m, price: 6 })),
      tapioca_molhada: false,
      isLunch: true,
      lunchBase: lunchItem.base,
      lunchMeats: lunchItem.meats,
      lunchExtraMeats: lunchItem.extraMeats,
      lunchSides: lunchItem.sides,
    }]);

    toast({ title: "Almoço adicionado ao carrinho!" });
  };

  const handleCategorySelect = (catId: string, catName: string) => {
    setSelectedCategory(catId);
    setSelectedCategoryName(catName);
  };

  const isLunchCategory = selectedCategoryName.toLowerCase().includes("almoço") || 
                          selectedCategoryName.toLowerCase().includes("almoco");

  const updateQuantity = (index: number, delta: number) => {
    const newCart = [...cart];
    newCart[index].quantity = Math.max(1, newCart[index].quantity + delta);
    setCart(newCart);
  };

  const removeFromCart = (index: number) => {
    setCart(cart.filter((_, i) => i !== index));
  };

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const total = subtotal + (orderType === 'entrega' ? deliveryTax : 0);

  const fetchDeliveryTax = async () => {
    if (!bairro.trim()) return;
    const { data } = await supabase
      .from('delivery_zones')
      .select('taxa')
      .ilike('bairro', `%${bairro}%`)
      .maybeSingle();
    setDeliveryTax(data?.taxa || 0);
  };

  const handleSubmit = async () => {
    if (!customerName.trim()) {
      toast({ title: "Nome é obrigatório", variant: "destructive" });
      return;
    }
    if (cart.length === 0) {
      toast({ title: "Adicione itens ao pedido", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          customer_name: customerName,
          customer_phone: customerPhone || null,
          order_type: orderType,
          address: orderType === 'entrega' ? address : null,
          delivery_tax: orderType === 'entrega' ? deliveryTax : 0,
          subtotal,
          total,
          status: 'pending',
        })
        .select()
        .single();

      if (orderError) throw orderError;

      const orderItems = cart.map(item => ({
        order_id: order.id,
        item_id: item.item_id,
        quantity: item.quantity,
        extras: item.isLunch 
          ? {
              type: "lunch",
              base: item.lunchBase,
              meats: item.lunchMeats,
              extraMeats: item.lunchExtraMeats,
              sides: item.lunchSides,
              regularExtras: item.extras
            }
          : item.extras,
        tapioca_molhada: item.tapioca_molhada,
        price: item.price * item.quantity,
      }));

      await supabase.from('order_items').insert(orderItems);

      toast({ title: "Pedido criado com sucesso!" });
      navigate('/kitchen');
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <StaffLayout title="Novo Pedido" subtitle="Criar pedido">
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>
      </StaffLayout>
    );
  }

  return (
    <StaffLayout title="Novo Pedido" subtitle="Montar pedido">
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Menu */}
        <div className="lg:col-span-2 space-y-4">
          {/* Categories */}
          <div className="flex flex-wrap gap-2">
            {categories.map(cat => (
              <Button
                key={cat.id}
                variant={selectedCategory === cat.id ? "default" : "outline"}
                size="sm"
                onClick={() => handleCategorySelect(cat.id, cat.name)}
                className="gap-1"
              >
                {(cat.name.toLowerCase().includes("almoço") || cat.name.toLowerCase().includes("almoco")) && (
                  <UtensilsCrossed className="h-3 w-3" />
                )}
                {cat.name}
              </Button>
            ))}
          </div>

          {/* Items - Regular or Lunch */}
          {selectedCategory && (
            isLunchCategory ? (
              <LunchOrderSection onAddToCart={addLunchToCart} />
            ) : (
              <div className="grid sm:grid-cols-2 gap-3">
                {items.map(item => (
                  <ItemCard 
                    key={item.id} 
                    item={item} 
                    onAddToCart={addToCart}
                  />
                ))}
              </div>
            )
          )}
        </div>

        {/* Cart */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <ShoppingCart className="h-4 w-4" /> Carrinho
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {cart.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Carrinho vazio</p>
              ) : (
                cart.map((item, index) => (
                  <div key={index} className="border-b pb-2">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="text-sm font-medium">{item.name}</p>
                        {item.isLunch && item.lunchMeats && (
                          <p className="text-xs text-muted-foreground">
                            Carnes: {item.lunchMeats.join(", ")}
                          </p>
                        )}
                        {item.isLunch && item.lunchExtraMeats && item.lunchExtraMeats.length > 0 && (
                          <p className="text-xs text-orange-600">
                            + Extras: {item.lunchExtraMeats.join(", ")}
                          </p>
                        )}
                        {item.isLunch && item.lunchSides && item.lunchSides.length > 0 && (
                          <p className="text-xs text-green-600">
                            Acomp: {item.lunchSides.map(s => {
                              const sideMap: Record<string, string> = {
                                macarrao: "Macarrão", farofa: "Farofa", 
                                macaxeira: "Macaxeira", salada: "Salada"
                              };
                              return sideMap[s] || s;
                            }).join(", ")}
                          </p>
                        )}
                        {!item.isLunch && item.extras.length > 0 && (
                          <p className="text-xs text-muted-foreground">
                            Extras: {item.extras.map(e => e.name).join(", ")}
                          </p>
                        )}
                        {!item.isLunch && item.tapioca_molhada && (
                          <Badge variant="secondary" className="text-xs mt-1">Molhada +R$1</Badge>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          R$ {item.price.toFixed(2)} x {item.quantity}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button size="icon" variant="outline" className="h-6 w-6" onClick={() => updateQuantity(index, -1)}>
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="text-sm w-4 text-center">{item.quantity}</span>
                        <Button size="icon" variant="outline" className="h-6 w-6" onClick={() => updateQuantity(index, 1)}>
                          <Plus className="h-3 w-3" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => removeFromCart(index)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}

              <div className="pt-2 space-y-2 text-sm">
                <div className="flex justify-between"><span>Subtotal</span><span>R$ {subtotal.toFixed(2)}</span></div>
                {orderType === 'entrega' && <div className="flex justify-between"><span>Taxa</span><span>R$ {deliveryTax.toFixed(2)}</span></div>}
                <div className="flex justify-between font-bold"><span>Total</span><span>R$ {total.toFixed(2)}</span></div>
              </div>
            </CardContent>
          </Card>

          {/* Customer Info */}
          <Card>
            <CardContent className="pt-4 space-y-3">
              <div>
                <Label className="text-xs">Nome do Cliente *</Label>
                <Input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Nome" />
              </div>
              <div>
                <Label className="text-xs">Telefone</Label>
                <Input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="(00) 00000-0000" />
              </div>
              <div>
                <Label className="text-xs font-medium">Tipo de Pedido *</Label>
                <RadioGroup value={orderType} onValueChange={(v: any) => setOrderType(v)} className="grid grid-cols-3 gap-2 mt-2">
                  <div className={`flex flex-col items-center p-3 rounded-lg border-2 cursor-pointer transition-all ${orderType === 'local' ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'}`}>
                    <RadioGroupItem value="local" id="local" className="sr-only" />
                    <Label htmlFor="local" className="cursor-pointer text-center">
                      <Store className="h-5 w-5 mx-auto mb-1" />
                      <span className="text-xs">Local</span>
                    </Label>
                  </div>
                  <div className={`flex flex-col items-center p-3 rounded-lg border-2 cursor-pointer transition-all ${orderType === 'retirada' ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'}`}>
                    <RadioGroupItem value="retirada" id="retirada" className="sr-only" />
                    <Label htmlFor="retirada" className="cursor-pointer text-center">
                      <MapPin className="h-5 w-5 mx-auto mb-1" />
                      <span className="text-xs">Retirada</span>
                    </Label>
                  </div>
                  <div className={`flex flex-col items-center p-3 rounded-lg border-2 cursor-pointer transition-all ${orderType === 'entrega' ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'}`}>
                    <RadioGroupItem value="entrega" id="entrega" className="sr-only" />
                    <Label htmlFor="entrega" className="cursor-pointer text-center">
                      <Truck className="h-5 w-5 mx-auto mb-1" />
                      <span className="text-xs">Entrega</span>
                    </Label>
                  </div>
                </RadioGroup>
              </div>
              {orderType === 'entrega' && (
                <>
                  <div>
                    <Label className="text-xs">Bairro</Label>
                    <div className="flex gap-2">
                      <Input value={bairro} onChange={e => setBairro(e.target.value)} placeholder="Bairro" />
                      <Button variant="outline" size="sm" onClick={fetchDeliveryTax}>Buscar</Button>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Endereço</Label>
                    <Input value={address} onChange={e => setAddress(e.target.value)} placeholder="Rua, número" />
                  </div>
                </>
              )}
              <Button className="w-full" onClick={handleSubmit} disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Finalizar Pedido
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </StaffLayout>
  );
};

export default NewOrder;
