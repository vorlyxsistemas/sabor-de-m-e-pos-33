import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { StaffLayout } from "@/components/layout/StaffLayout";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Minus, Trash2, ShoppingCart, UtensilsCrossed, Store, MapPin, Truck, Banknote, CreditCard, QrCode } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { LunchOrderSection } from "@/components/order/LunchOrderSection";
import { ItemCard } from "@/components/order/ItemCard";

interface CartItem {
  item_id: string | null;
  name: string;
  quantity: number;
  price: number;
  extras: { name: string; price: number }[];
  tapioca_molhada: boolean;
  selected_variation?: string;
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
  const { isAdmin } = useAuth();
  const [categories, setCategories] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedCategoryName, setSelectedCategoryName] = useState<string>("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderType, setOrderType] = useState<'local' | 'retirada' | 'entrega'>('local');
  const [tableNumber, setTableNumber] = useState<string>('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [address, setAddress] = useState('');
  const [bairro, setBairro] = useState('');
  const [reference, setReference] = useState('');
  const [observations, setObservations] = useState('');
  const [deliveryTax, setDeliveryTax] = useState(0);
  const [deliveryZones, setDeliveryZones] = useState<{ id: string; bairro: string; taxa: number }[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'dinheiro' | 'cartao'>('pix');
  const [troco, setTroco] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchCategories();
    fetchDeliveryZones();
  }, []);

  useEffect(() => {
    if (selectedCategory) fetchItems();
  }, [selectedCategory]);

  const fetchCategories = async () => {
    const { data } = await supabase.from('categories').select('*').order('name');
    setCategories(data || []);
    setLoading(false);
  };

  const fetchDeliveryZones = async () => {
    const { data } = await supabase
      .from('delivery_zones')
      .select('id, bairro, taxa')
      .order('bairro');
    setDeliveryZones(data || []);
  };

  const handleBairroChange = (selectedBairro: string) => {
    setBairro(selectedBairro);
    const zone = deliveryZones.find(z => z.bairro === selectedBairro);
    setDeliveryTax(zone?.taxa || 0);
  };

  const fetchItems = async () => {
    const { data } = await supabase
      .from('items')
      .select('id, name, price, description, available, allow_extras, allow_tapioca_molhada, is_molhado_by_default, image_url, requires_variation, variation_options, extras(*)')
      .eq('category_id', selectedCategory)
      .eq('available', true);
    setItems(data || []);
  };

  const addToCart = (item: any, extras: any[] = [], tapioca_molhada = false, selected_variation?: string) => {
    const extrasTotal = extras.reduce((sum, e) => sum + Number(e.price), 0);
    const tapiocaExtra = tapioca_molhada ? 1 : 0;
    const price = Number(item.price) + extrasTotal + tapiocaExtra;

    // Build display name with variation if present
    const displayName = selected_variation 
      ? `${item.name} (${selected_variation})`
      : item.name;

    setCart([...cart, {
      item_id: item.id,
      name: displayName,
      quantity: 1,
      price,
      extras,
      tapioca_molhada,
      selected_variation,
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
          table_number: orderType === 'local' && tableNumber ? parseInt(tableNumber) : null,
          address: orderType === 'entrega' ? address : null,
          bairro: orderType === 'entrega' ? bairro : null,
          reference: orderType === 'entrega' ? reference : null,
          delivery_tax: orderType === 'entrega' ? deliveryTax : 0,
          subtotal,
          total,
          status: 'pending',
          payment_method: paymentMethod,
          troco: paymentMethod === 'dinheiro' && troco ? parseFloat(troco) : null,
          observations: observations.trim() || null,
        })
        .select()
        .single();

      if (orderError) throw orderError;

      const orderItems = cart.map(item => {
        let extrasData: any;
        if (item.isLunch) {
          extrasData = {
            type: "lunch",
            base: item.lunchBase,
            meats: item.lunchMeats,
            extraMeats: item.lunchExtraMeats,
            sides: item.lunchSides,
            regularExtras: item.extras
          };
        } else {
          const parsedVariation = (() => {
            const match = item.name.match(/\(([^)]+)\)\s*$/);
            return match?.[1]?.trim();
          })();

          const variation = item.selected_variation || parsedVariation;

          if (variation) {
            extrasData = {
              selected_variation: variation,
              regularExtras: item.extras
            };
          } else {
            extrasData = item.extras;
          }
        }

        return {
          order_id: order.id,
          item_id: item.item_id,
          quantity: item.quantity,
          extras: extrasData,
          tapioca_molhada: item.tapioca_molhada,
          price: item.price * item.quantity,
        };
      });

      await supabase.from('order_items').insert(orderItems);

      toast({ title: "Pedido criado com sucesso!" });
      navigate(isAdmin ? '/admin/kanban' : '/kitchen');
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const Layout = isAdmin ? AdminLayout : StaffLayout;

  if (loading) {
    return (
      <Layout title="Novo Pedido" subtitle="Criar pedido">
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>
      </Layout>
    );
  }

  return (
    <Layout title="Novo Pedido" subtitle="Montar pedido">
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
              {orderType === 'local' && (
                <div>
                  <Label className="text-xs">Número da Mesa</Label>
                  <Select value={tableNumber} onValueChange={setTableNumber}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a mesa" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border shadow-lg z-50">
                      {Array.from({ length: 12 }, (_, i) => (
                        <SelectItem key={i + 1} value={String(i + 1)}>
                          Mesa {i + 1}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {orderType === 'entrega' && (
                <>
                  <div>
                    <Label className="text-xs">Bairro *</Label>
                    <Select value={bairro} onValueChange={handleBairroChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o bairro" />
                      </SelectTrigger>
                      <SelectContent className="bg-background border shadow-lg z-50 max-h-60">
                        {deliveryZones.map((zone) => (
                          <SelectItem key={zone.id} value={zone.bairro}>
                            {zone.bairro} {zone.taxa > 0 ? `(+R$ ${zone.taxa.toFixed(2)})` : '(Grátis)'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Endereço *</Label>
                    <Input value={address} onChange={e => setAddress(e.target.value)} placeholder="Rua, número" />
                  </div>
                  <div>
                    <Label className="text-xs">Ponto de Referência</Label>
                    <Input value={reference} onChange={e => setReference(e.target.value)} placeholder="Próximo a..." />
                  </div>
                </>
              )}
              
              {/* Payment Method */}
              <div>
                <Label className="text-xs font-medium">Forma de Pagamento *</Label>
                <RadioGroup value={paymentMethod} onValueChange={(v: any) => setPaymentMethod(v)} className="grid grid-cols-3 gap-2 mt-2">
                  <div className={`flex flex-col items-center p-3 rounded-lg border-2 cursor-pointer transition-all ${paymentMethod === 'pix' ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'}`}>
                    <RadioGroupItem value="pix" id="pix" className="sr-only" />
                    <Label htmlFor="pix" className="cursor-pointer text-center">
                      <QrCode className="h-5 w-5 mx-auto mb-1" />
                      <span className="text-xs">Pix</span>
                    </Label>
                  </div>
                  <div className={`flex flex-col items-center p-3 rounded-lg border-2 cursor-pointer transition-all ${paymentMethod === 'dinheiro' ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'}`}>
                    <RadioGroupItem value="dinheiro" id="dinheiro" className="sr-only" />
                    <Label htmlFor="dinheiro" className="cursor-pointer text-center">
                      <Banknote className="h-5 w-5 mx-auto mb-1" />
                      <span className="text-xs">Dinheiro</span>
                    </Label>
                  </div>
                  <div className={`flex flex-col items-center p-3 rounded-lg border-2 cursor-pointer transition-all ${paymentMethod === 'cartao' ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'}`}>
                    <RadioGroupItem value="cartao" id="cartao" className="sr-only" />
                    <Label htmlFor="cartao" className="cursor-pointer text-center">
                      <CreditCard className="h-5 w-5 mx-auto mb-1" />
                      <span className="text-xs">Cartão</span>
                    </Label>
                  </div>
                </RadioGroup>
              </div>
              {paymentMethod === 'dinheiro' && (
                <div>
                  <Label className="text-xs">Troco para quanto?</Label>
                  <Input 
                    type="number" 
                    value={troco} 
                    onChange={e => setTroco(e.target.value)} 
                    placeholder="Ex: 50.00 (deixe vazio se não precisar)"
                  />
                </div>
              )}

              {/* Observations */}
              <div>
                <Label className="text-xs">Observações</Label>
                <Textarea 
                  value={observations} 
                  onChange={e => setObservations(e.target.value)} 
                  placeholder="Ex: Sem cebola, ponto da carne, etc."
                  maxLength={500}
                  rows={2}
                />
              </div>

              <Button className="w-full" onClick={handleSubmit} disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Finalizar Pedido
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default NewOrder;
