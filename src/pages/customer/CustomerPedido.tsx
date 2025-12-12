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
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Minus, Trash2, ShoppingCart, UtensilsCrossed, Store, MapPin, Truck, AlertCircle } from "lucide-react";
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

interface CartItem {
  item_id: string | null;
  name: string;
  quantity: number;
  price: number;
  extras: { name: string; price: number }[];
  tapioca_molhada: boolean;
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

const CustomerPedido = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [categories, setCategories] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedCategoryName, setSelectedCategoryName] = useState<string>("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderType, setOrderType] = useState<'local' | 'retirada' | 'entrega'>('local');
  const [customerName, setCustomerName] = useState(user?.user_metadata?.name || '');
  const [customerPhone, setCustomerPhone] = useState(user?.user_metadata?.phone || '');
  const [address, setAddress] = useState('');
  const [bairro, setBairro] = useState('');
  const [deliveryTax, setDeliveryTax] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isClosed, setIsClosed] = useState(false);
  const [closedMessage, setClosedMessage] = useState("");

  useEffect(() => {
    fetchMenu();
  }, []);

  useEffect(() => {
    if (selectedCategory) fetchItems();
  }, [selectedCategory]);

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
    
    toast({ title: "Item adicionado ao carrinho!" });
  };

  const addLunchToCart = (lunchItem: LunchCartItem) => {
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

    setSubmitting(true);
    try {
      // Use edge function to create order (bypasses RLS)
      const orderData = {
        customer_name: customerName.trim(),
        customer_phone: customerPhone?.trim() || null,
        order_type: orderType,
        address: orderType === 'entrega' ? address.trim() : null,
        bairro: orderType === 'entrega' ? bairro.trim() : null,
        delivery_tax: orderType === 'entrega' ? deliveryTax : 0,
        subtotal,
        total,
        status: 'pending',
        source: 'web',
        items: cart.map(item => ({
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
        })),
      };

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
                    <Label className="text-xs">Bairro *</Label>
                    <div className="flex gap-2">
                      <Input 
                        value={bairro} 
                        onChange={e => setBairro(e.target.value)} 
                        placeholder="Bairro" 
                        maxLength={100}
                      />
                      <Button variant="outline" size="sm" onClick={fetchDeliveryTax}>Buscar</Button>
                    </div>
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
    </CustomerLayout>
  );
};

export default CustomerPedido;
