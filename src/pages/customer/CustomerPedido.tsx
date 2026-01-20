import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { CustomerLayout } from "@/components/layout/CustomerLayout";
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
import { Loader2, Plus, Minus, Trash2, ShoppingCart, UtensilsCrossed, Store, MapPin, Truck, AlertCircle, Banknote, CreditCard, QrCode, Copy, Check } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { LunchOrderSection } from "@/components/order/LunchOrderSection";
import { ItemCard } from "@/components/order/ItemCard";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { z } from "zod";

// Validation schemas for security
const customerSchema = z.object({
  name: z.string().trim().min(2, "Nome deve ter pelo menos 2 caracteres").max(100, "Nome muito longo"),
  phone: z.string().trim().max(20, "Telefone inválido").optional(),
});

const addressSchema = z.object({
  bairro: z.string().trim().min(2, "Bairro obrigatório").max(100, "Bairro muito longo"),
  address: z.string().trim().min(5, "Endereço obrigatório").max(200, "Endereço muito longo"),
});

// PIX info
const PIX_KEY = "64569575000102";
const PIX_OWNER = "JORGE LUIS DO N FRANCELINO LTDA";

interface CartItem {
  item_id: string | null;
  name: string;
  quantity: number;
  price: number;
  extras: { name: string; price: number }[];
  tapioca_molhada: boolean;
  selected_variation?: string;
  isLunch?: boolean;
  lunchBase?: { id: string; name: string; price: number };
  lunchMeats?: string[];
  lunchExtraMeats?: string[];
  lunchSides?: string[];
  lunchPaidSides?: { name: string; price: number }[];
}

interface LunchCartItem {
  type: "lunch";
  base: { id: string; name: string; price: number };
  meats: string[];
  extraMeats: string[];
  sides: string[];
  paidSides?: { name: string; price: number }[];
  quantity: number;
  totalPrice: number;
}

interface DeliveryZone {
  id: string;
  bairro: string;
  taxa: number;
}

const CustomerPedido = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [categories, setCategories] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedCategoryName, setSelectedCategoryName] = useState<string>("");
  const [cart, setCart] = useState<CartItem[]>([]);
  // Customers can only choose 'retirada' or 'entrega' - 'local' is disabled for customers
  const [orderType, setOrderType] = useState<'local' | 'retirada' | 'entrega'>('retirada');
  const [customerName, setCustomerName] = useState(user?.user_metadata?.name || '');
  const [customerPhone, setCustomerPhone] = useState(user?.user_metadata?.phone || '');
  const [address, setAddress] = useState('');
  const [bairro, setBairro] = useState('');
  const [reference, setReference] = useState('');
  const [observations, setObservations] = useState('');
  const [deliveryTax, setDeliveryTax] = useState(0);
  const [deliveryZones, setDeliveryZones] = useState<DeliveryZone[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'dinheiro' | 'cartao'>('pix');
  const [troco, setTroco] = useState('');
  const [tableNumber, setTableNumber] = useState<string>('');
  const [copiedPix, setCopiedPix] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isClosed, setIsClosed] = useState(false);
  const [closedMessage, setClosedMessage] = useState("");

  useEffect(() => {
    fetchMenu();
    fetchDeliveryZones();
  }, []);

  useEffect(() => {
    if (selectedCategory) fetchItems();
  }, [selectedCategory]);

  const fetchDeliveryZones = async () => {
    const { data } = await supabase
      .from('delivery_zones')
      .select('id, bairro, taxa')
      .order('bairro');
    setDeliveryZones(data || []);
  };

  const fetchMenu = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("menu", {
        body: {},
      });

      if (error) throw error;

      if (data?.data?.closed) {
        setIsClosed(true);
        setClosedMessage(data.data.message || "Estamos fechados no momento");
        setCategories([]);
      } else {
        setCategories(data?.data?.categories || []);
        setIsClosed(false);
      }
    } catch (error) {
      console.error("Erro ao carregar menu:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchItems = async () => {
    const { data } = await (supabase as any)
      .from('items')
      .select('*, extras(*)')
      .eq('category_id', selectedCategory)
      .eq('available', true)
      .neq('internal_only', true);
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
    
    toast({ title: "Item adicionado ao carrinho!" });
  };

  const addLunchToCart = (lunchItem: LunchCartItem) => {
    setCart([
      ...cart,
      {
        item_id: null,
        name: `Almoço - ${lunchItem.base.name}`,
        quantity: lunchItem.quantity,
        price: lunchItem.totalPrice / lunchItem.quantity,
        extras: lunchItem.extraMeats.map((m) => ({ name: m, price: 6 })),
        tapioca_molhada: false,
        isLunch: true,
        lunchBase: lunchItem.base,
        lunchMeats: lunchItem.meats,
        lunchExtraMeats: lunchItem.extraMeats,
        lunchSides: lunchItem.sides,
        lunchPaidSides: lunchItem.paidSides || [],
      },
    ]);

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

  const handleBairroChange = (selectedBairro: string) => {
    setBairro(selectedBairro);
    const zone = deliveryZones.find(z => z.bairro === selectedBairro);
    setDeliveryTax(zone?.taxa || 0);
  };

  const handleCopyPix = async () => {
    try {
      await navigator.clipboard.writeText(PIX_KEY);
      setCopiedPix(true);
      toast({ title: "Chave PIX copiada!" });
      setTimeout(() => setCopiedPix(false), 2000);
    } catch {
      toast({ title: "Erro ao copiar", variant: "destructive" });
    }
  };

  const handleSubmit = async () => {
    // Validate customer data
    const customerValidation = customerSchema.safeParse({
      name: customerName,
      phone: customerPhone || undefined,
    });

    if (!customerValidation.success) {
      toast({ 
        title: "Dados inválidos", 
        description: customerValidation.error.errors[0].message,
        variant: "destructive" 
      });
      return;
    }

    // Validate address if delivery
    if (orderType === 'entrega') {
      const addressValidation = addressSchema.safeParse({ bairro, address });
      if (!addressValidation.success) {
        toast({ 
          title: "Dados inválidos", 
          description: addressValidation.error.errors[0].message,
          variant: "destructive" 
        });
        return;
      }
    }

    if (cart.length === 0) {
      toast({ title: "Adicione itens ao pedido", variant: "destructive" });
      return;
    }

    if (!paymentMethod) {
      toast({ title: "Selecione a forma de pagamento", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      // Use edge function to create order (bypasses RLS)
      const isDelivery = orderType === 'entrega';
      const trimmedBairro = bairro.trim();
      const trimmedAddress = address.trim();
      const trimmedReference = reference.trim();

      // Build order data - only include address/bairro for delivery orders
      const orderData: Record<string, unknown> = {
        customer_name: customerName.trim(),
        customer_phone: customerPhone?.trim() || '',
        order_type: orderType,
        table_number: orderType === 'local' && tableNumber ? parseInt(tableNumber) : null,
        delivery_tax: isDelivery ? deliveryTax : 0,
        subtotal,
        total,
        status: 'pending',
        source: 'web',
        payment_method: paymentMethod,
        troco: paymentMethod === 'dinheiro' && troco ? parseFloat(troco) : null,
        observations: observations.trim() || null,
        items: cart.map(item => {
          // Build extras object based on item type
          let extrasData: any;
          if (item.isLunch) {
              extrasData = {
                type: "lunch",
                base: item.lunchBase,
                meats: item.lunchMeats,
                extraMeats: item.lunchExtraMeats,
                sides: item.lunchSides,
                paidSides: item.lunchPaidSides,
                regularExtras: item.extras,
              };
          } else {
            const parsedVariation = (() => {
              const match = item.name.match(/\(([^)]+)\)\s*$/);
              return match?.[1]?.trim();
            })();

            const variation = item.selected_variation || parsedVariation;

            if (variation) {
              // Item with variation - include variation in extras object
              extrasData = {
                selected_variation: variation,
                regularExtras: item.extras
              };
            } else {
              extrasData = item.extras;
            }
          }

          return {
            item_id: item.item_id,
            quantity: item.quantity,
            extras: extrasData,
            tapioca_molhada: item.tapioca_molhada,
            price: item.price * item.quantity,
          };
        }),
      };

      // Only add address fields for delivery orders
      if (isDelivery) {
        orderData.address = trimmedAddress || '';
        orderData.bairro = trimmedBairro || '';
        orderData.reference = trimmedReference || '';
      }

      const { data, error: orderError } = await supabase.functions.invoke('orders', {
        method: 'POST',
        body: orderData,
      });

      if (orderError) throw orderError;
      if (data?.error) throw new Error(data.error);

      toast({ title: "Pedido realizado com sucesso!" });
      setCart([]);
      navigate('/cliente');
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <CustomerLayout title="Fazer Pedido" subtitle="Monte seu pedido">
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </CustomerLayout>
    );
  }

  if (isClosed) {
    return (
      <CustomerLayout title="Fazer Pedido" subtitle="Monte seu pedido">
        <div className="max-w-2xl mx-auto">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{closedMessage}</AlertDescription>
          </Alert>
        </div>
      </CustomerLayout>
    );
  }

  return (
    <CustomerLayout title="Fazer Pedido" subtitle="Monte seu pedido">
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

          {/* Items */}
          {selectedCategory && (
            isLunchCategory ? (
              <LunchOrderSection onAddToCart={addLunchToCart} />
            ) : (
              <div className="grid sm:grid-cols-2 gap-3">
                {items.map(item => (
                  <ItemCard 
                    key={item.id} 
                    item={item}
                    categoryName={selectedCategoryName}
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
                            Acomp: {item.lunchSides
                              .map((s) => {
                                const sideMap: Record<string, string> = {
                                  macarrao: "Macarrão",
                                  farofa: "Farofa",
                                  macaxeira: "Macaxeira",
                                  salada: "Salada",
                                };
                                return sideMap[s] || s;
                              })
                              .join(", ")}
                          </p>
                        )}
                        {item.isLunch && item.lunchPaidSides && item.lunchPaidSides.length > 0 && (
                          <p className="text-xs text-orange-600">
                            + Pagos: {item.lunchPaidSides.map((s) => s.name).join(", ")}
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
                <Label className="text-xs">Seu Nome *</Label>
                <Input 
                  value={customerName} 
                  onChange={e => setCustomerName(e.target.value)} 
                  placeholder="Nome" 
                  maxLength={100}
                />
              </div>
              <div>
                <Label className="text-xs">Telefone</Label>
                <Input 
                  value={customerPhone} 
                  onChange={e => setCustomerPhone(e.target.value)} 
                  placeholder="(00) 00000-0000" 
                  maxLength={20}
                />
              </div>
              <div>
                <Label className="text-xs font-medium">Tipo de Pedido *</Label>
                {/* Customers can only choose Retirada or Entrega - Local is for staff/admin only */}
                <RadioGroup value={orderType} onValueChange={(v: any) => setOrderType(v)} className="grid grid-cols-2 gap-2 mt-2">
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
                    <Label className="text-xs">Bairro *</Label>
                    <Select value={bairro} onValueChange={handleBairroChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o bairro" />
                      </SelectTrigger>
                      <SelectContent>
                        {deliveryZones.map(zone => (
                          <SelectItem key={zone.id} value={zone.bairro}>
                            {zone.bairro}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Endereço *</Label>
                    <Input 
                      value={address} 
                      onChange={e => setAddress(e.target.value)} 
                      placeholder="Rua, número, complemento" 
                      maxLength={200}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Ponto de Referência</Label>
                    <Input 
                      value={reference} 
                      onChange={e => setReference(e.target.value)} 
                      placeholder="Ex: Próximo à padaria" 
                      maxLength={200}
                    />
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

              {paymentMethod === 'pix' && (
                <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                  <p className="text-xs font-medium">Chave PIX (CNPJ):</p>
                  <div className="flex items-center gap-2">
                    <code className="text-sm bg-background px-2 py-1 rounded flex-1">{PIX_KEY}</code>
                    <Button size="sm" variant="outline" onClick={handleCopyPix} className="gap-1">
                      {copiedPix ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      {copiedPix ? 'Copiado' : 'Copiar'}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">Favorecido: {PIX_OWNER}</p>
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
    </CustomerLayout>
  );
};

export default CustomerPedido;