import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Plus, Minus, UtensilsCrossed } from "lucide-react";

// Bases fixas do almoço com preços
const LUNCH_BASES = [
  { id: "arroz_feijao", name: "Arroz e Feijão Carioca", price: 14.0 },
  { id: "baiao_fava", name: "Baião de Fava", price: 14.0 },
  { id: "baiao_pequi", name: "Baião de Pequi", price: 14.0 },
  { id: "baiao_cremoso", name: "Baião Cremoso", price: 16.0 },
  { id: "baiao_simples", name: "Baião Simples", price: 14.0 },
];

// Carnes por dia da semana (0 = Domingo, 6 = Sábado)
const MEATS_BY_DAY: Record<number, string[]> = {
  0: [], // Domingo - não funciona
  1: ["Lasanha de frango", "Picadinho"], // Segunda
  2: ["Frango ao molho", "Carne de sol"], // Terça
  3: ["Almôndega", "Costela"], // Quarta
  4: ["Lasanha de carne", "Bife ao molho"], // Quinta
  5: ["Peixe frito", "Peixe cozido", "Fígado acebolado"], // Sexta
  6: ["Feijoada", "Porco frito/cozido", "Panelada"], // Sábado
};

// Acompanhamentos gratuitos
const FREE_SIDES = [
  { id: "macarrao", name: "Macarrão" },
  { id: "farofa", name: "Farofa" },
  { id: "macaxeira", name: "Macaxeira" },
  { id: "salada", name: "Salada" },
];

const EXTRA_MEAT_PRICE = 6.0;

interface LunchCartItem {
  type: "lunch";
  base: { id: string; name: string; price: number };
  meats: string[];
  extraMeats: string[];
  sides: string[];
  quantity: number;
  totalPrice: number;
}

interface LunchOrderSectionProps {
  onAddToCart: (item: LunchCartItem) => void;
}

export const LunchOrderSection = ({ onAddToCart }: LunchOrderSectionProps) => {
  const [loading, setLoading] = useState(true);
  const [todayMeats, setTodayMeats] = useState<string[]>([]);
  const [grilledMeats, setGrilledMeats] = useState<string[]>([]);
  const [weekdayName, setWeekdayName] = useState("");
  const [isAvailable, setIsAvailable] = useState(false);

  // Form state
  const [selectedBase, setSelectedBase] = useState<string>("");
  const [meatOption, setMeatOption] = useState<"both" | "one">("both");
  const [selectedMeats, setSelectedMeats] = useState<string[]>([]);
  const [extraMeats, setExtraMeats] = useState<string[]>([]);
  const [selectedSides, setSelectedSides] = useState<string[]>([]);
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    fetchTodayLunch();
  }, []);

  const fetchTodayLunch = async () => {
    try {
      const today = new Date();
      const weekday = today.getDay();
      const weekdayNames = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
      
      setWeekdayName(weekdayNames[weekday]);
      
      // Restaurante funciona segunda a sábado (1-6)
      if (weekday === 0) {
        setIsAvailable(false);
        setLoading(false);
        return;
      }

      // Verificar horário (almoço a partir das 11h)
      const hour = today.getHours();
      setIsAvailable(hour >= 11 || true); // Permitir pedidos antes, mas mostrar aviso

      // Buscar carnes do dia do banco
      const { data: dbMeats } = await supabase
        .from("lunch_menu")
        .select("meat_name")
        .eq("weekday", weekday);

      if (dbMeats && dbMeats.length > 0) {
        setTodayMeats(dbMeats.map(m => m.meat_name));
      } else {
        // Fallback para carnes definidas no código
        setTodayMeats(MEATS_BY_DAY[weekday] || []);
      }

      // Buscar carnes assadas (porções) disponíveis
      const { data: porcoes } = await supabase
        .from("items")
        .select("name")
        .eq("available", true)
        .ilike("name", "%assad%");
      
      if (porcoes && porcoes.length > 0) {
        setGrilledMeats(porcoes.map(p => p.name));
      }
    } catch (error) {
      console.error("Error fetching lunch:", error);
      // Use default meats
      const weekday = new Date().getDay();
      setTodayMeats(MEATS_BY_DAY[weekday] || []);
    } finally {
      setLoading(false);
    }
  };

  // Combine today's meats with grilled meats
  const allAvailableMeats = [...todayMeats, ...grilledMeats];

  const toggleMeat = (meat: string, isExtra: boolean = false) => {
    if (isExtra) {
      setExtraMeats(prev => 
        prev.includes(meat) ? prev.filter(m => m !== meat) : [...prev, meat]
      );
    } else {
      if (meatOption === "one") {
        // Allow selecting same meat or different meat
        setSelectedMeats([meat]);
      } else {
        // Allow selecting same meat twice or two different meats
        setSelectedMeats(prev => {
          if (prev.length < 2) {
            return [...prev, meat];
          }
          // Replace oldest
          return [prev[1], meat];
        });
      }
    }
  };

  const removeMeat = (index: number) => {
    setSelectedMeats(prev => prev.filter((_, i) => i !== index));
  };

  const toggleSide = (sideId: string) => {
    setSelectedSides(prev =>
      prev.includes(sideId) ? prev.filter(s => s !== sideId) : [...prev, sideId]
    );
  };

  const calculatePrice = () => {
    const base = LUNCH_BASES.find(b => b.id === selectedBase);
    if (!base) return 0;

    const basePrice = base.price;
    const extraMeatsPrice = extraMeats.length * EXTRA_MEAT_PRICE;
    
    return (basePrice + extraMeatsPrice) * quantity;
  };

  const handleAddToCart = () => {
    const base = LUNCH_BASES.find(b => b.id === selectedBase);
    if (!base || selectedMeats.length === 0) return;

    const item: LunchCartItem = {
      type: "lunch",
      base,
      meats: selectedMeats,
      extraMeats,
      sides: selectedSides,
      quantity,
      totalPrice: calculatePrice(),
    };

    onAddToCart(item);

    // Reset form
    setSelectedBase("");
    setMeatOption("both");
    setSelectedMeats([]);
    setExtraMeats([]);
    setSelectedSides([]);
    setQuantity(1);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAvailable && new Date().getDay() === 0) {
    return (
      <Card className="border-destructive/50 bg-destructive/5">
        <CardContent className="py-6 text-center">
          <p className="text-muted-foreground">
            Não funcionamos aos domingos. Volte amanhã!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <UtensilsCrossed className="h-5 w-5 text-primary" />
        <h3 className="font-semibold">Almoço de {weekdayName}</h3>
        {new Date().getHours() < 11 && (
          <Badge variant="outline" className="text-xs">
            Disponível a partir das 11h
          </Badge>
        )}
      </div>

      {/* Base Selection */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm">1. Escolha a Base</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <RadioGroup value={selectedBase} onValueChange={setSelectedBase}>
            {LUNCH_BASES.map(base => (
              <div key={base.id} className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value={base.id} id={base.id} />
                  <Label htmlFor={base.id} className="text-sm cursor-pointer">
                    {base.name}
                  </Label>
                </div>
                <span className="text-sm text-muted-foreground">
                  R$ {base.price.toFixed(2)}
                </span>
              </div>
            ))}
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Meat Option */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm">2. Quantidade de Carnes (incluídas)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <RadioGroup value={meatOption} onValueChange={(v: "both" | "one") => {
            setMeatOption(v);
            if (v === "one" && selectedMeats.length > 1) {
              setSelectedMeats([selectedMeats[0]]);
            }
          }}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="both" id="both" />
              <Label htmlFor="both" className="text-sm cursor-pointer">
                Desejo as duas carnes (pode repetir)
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="one" id="one" />
              <Label htmlFor="one" className="text-sm cursor-pointer">
                Escolher somente 1 carne
              </Label>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Meat Selection */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm">
            3. Carnes Disponíveis ({meatOption === "both" ? "clique para adicionar, máx 2" : "escolha 1"})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Selected Meats Display */}
          {selectedMeats.length > 0 && (
            <div className="bg-muted/50 rounded-lg p-2 space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Carnes selecionadas:</p>
              <div className="flex flex-wrap gap-1">
                {selectedMeats.map((meat, idx) => (
                  <Badge 
                    key={idx} 
                    variant="secondary" 
                    className="cursor-pointer hover:bg-destructive/20"
                    onClick={() => removeMeat(idx)}
                  >
                    {meat} ✕
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Carnes do dia */}
          {todayMeats.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Carnes do dia:</p>
              <div className="space-y-2">
                {todayMeats.map(meat => (
                  <Button
                    key={meat}
                    variant="outline"
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => toggleMeat(meat)}
                    disabled={meatOption === "one" && selectedMeats.length >= 1 || meatOption === "both" && selectedMeats.length >= 2}
                  >
                    <Plus className="h-3 w-3 mr-2" />
                    {meat}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Carnes assadas */}
          {grilledMeats.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Carnes assadas:</p>
              <div className="space-y-2">
                {grilledMeats.map(meat => (
                  <Button
                    key={meat}
                    variant="outline"
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => toggleMeat(meat)}
                    disabled={meatOption === "one" && selectedMeats.length >= 1 || meatOption === "both" && selectedMeats.length >= 2}
                  >
                    <Plus className="h-3 w-3 mr-2" />
                    {meat}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {allAvailableMeats.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Nenhuma carne disponível hoje
            </p>
          )}
        </CardContent>
      </Card>

      {/* Extra Meats */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm flex items-center gap-2">
            4. Carne Extra (opcional)
            <Badge variant="secondary" className="text-xs">+R$ 6,00 cada</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {allAvailableMeats.map(meat => (
            <div key={`extra-${meat}`} className="flex items-center space-x-2">
              <Checkbox
                id={`extra-${meat}`}
                checked={extraMeats.includes(meat)}
                onCheckedChange={() => toggleMeat(meat, true)}
              />
              <Label htmlFor={`extra-${meat}`} className="text-sm cursor-pointer">
                + {meat}
              </Label>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Free Sides */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm flex items-center gap-2">
            5. Acompanhamentos
            <Badge variant="outline" className="text-xs text-green-600">Grátis</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {FREE_SIDES.map(side => (
            <div key={side.id} className="flex items-center space-x-2">
              <Checkbox
                id={side.id}
                checked={selectedSides.includes(side.id)}
                onCheckedChange={() => toggleSide(side.id)}
              />
              <Label htmlFor={side.id} className="text-sm cursor-pointer">
                {side.name}
              </Label>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Quantity & Add */}
      <Card>
        <CardContent className="py-4 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Quantidade</span>
            <div className="flex items-center gap-2">
              <Button
                size="icon"
                variant="outline"
                className="h-8 w-8"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <span className="w-8 text-center font-medium">{quantity}</span>
              <Button
                size="icon"
                variant="outline"
                className="h-8 w-8"
                onClick={() => setQuantity(quantity + 1)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t">
            <span className="font-medium">Total</span>
            <span className="text-lg font-bold text-primary">
              R$ {calculatePrice().toFixed(2)}
            </span>
          </div>

          <Button
            className="w-full"
            onClick={handleAddToCart}
            disabled={!selectedBase || selectedMeats.length === 0}
          >
            <Plus className="h-4 w-4 mr-2" />
            Adicionar ao Pedido
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
