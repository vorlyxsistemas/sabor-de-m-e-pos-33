import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Plus, Minus, UtensilsCrossed } from "lucide-react";

// Fallback bases (usado apenas se tabela não existir)
const DEFAULT_LUNCH_BASES = [
  { id: "arroz_feijao", name: "Arroz e Feijão Carioca", price: 14.0, singleMeatPrice: 12.0 },
  { id: "baiao_fava", name: "Baião de Fava", price: 14.0, singleMeatPrice: 12.0 },
  { id: "baiao_pequi", name: "Baião de Pequi", price: 14.0, singleMeatPrice: 12.0 },
  { id: "baiao_cremoso", name: "Baião Cremoso", price: 16.0, singleMeatPrice: 14.0 },
  { id: "baiao_simples", name: "Baião Simples", price: 14.0, singleMeatPrice: 12.0 },
  { id: "baiao_simples", name: "Baião Simples", price: 14.0, singleMeatPrice: 12.0 },
  { id: "somente_arroz", name: "Somente Arroz", price: 12.0, singleMeatPrice: 10.0 },
];

// Carnes por dia da semana (fallback)
const MEATS_BY_DAY: Record<number, string[]> = {
  0: [],
  1: ["Lasanha de frango", "Picadinho"],
  2: ["Frango ao molho", "Carne de sol"],
  3: ["Almôndega", "Costela"],
  4: ["Lasanha de carne", "Bife ao molho"],
  5: ["Peixe frito", "Peixe cozido", "Fígado acebolado"],
  6: ["Feijoada", "Porco frito/cozido", "Panelada"],
};

interface LunchBase {
  id: string;
  name: string;
  price: number;
  singleMeatPrice: number;
}

interface LunchSide {
  id: string;
  name: string;
  price: number;
  is_free: boolean;
  available: boolean;
}

interface ExtraMeatOption {
  id: string;
  name: string;
  price: number;
  available: boolean;
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

interface LunchOrderSectionProps {
  onAddToCart: (item: LunchCartItem) => void;
}

export const LunchOrderSection = ({ onAddToCart }: LunchOrderSectionProps) => {
  const [loading, setLoading] = useState(true);
  const [lunchBases, setLunchBases] = useState<LunchBase[]>(DEFAULT_LUNCH_BASES);
  const [todayMeats, setTodayMeats] = useState<string[]>([]);
  const [grilledMeats, setGrilledMeats] = useState<string[]>([]);
  const [weekdayName, setWeekdayName] = useState("");
  const [isAvailable, setIsAvailable] = useState(false);

  const [lunchSides, setLunchSides] = useState<LunchSide[]>([]);
  const [extraMeatOptions, setExtraMeatOptions] = useState<ExtraMeatOption[]>([]);

  // Form state
  const [selectedBase, setSelectedBase] = useState<string>("");
  const [meatOption, setMeatOption] = useState<"both" | "one">("both");
  const [selectedMeats, setSelectedMeats] = useState<string[]>([]);
  const [extraMeats, setExtraMeats] = useState<string[]>([]);
  const [selectedSides, setSelectedSides] = useState<string[]>([]); // armazenar NOMES, não IDs
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    fetchTodayLunch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      setIsAvailable(hour >= 11 || true);

      // Buscar bases do almoço do banco (apenas disponíveis)
      const { data: dbBases, error: basesError } = await (supabase as any)
        .from("lunch_bases")
        .select("id, name, price, price_one_meat, is_available")
        .eq("is_available", true)
        .order("name");

      if (!basesError && dbBases && dbBases.length > 0) {
        setLunchBases(
          dbBases.map((b: any) => ({
            id: b.id,
            name: b.name,
            price: Number(b.price) || 0,
            singleMeatPrice: Number(b.price_one_meat) || 0,
          }))
        );
      }
      // Se erro ou sem dados, mantém DEFAULT_LUNCH_BASES

      // Buscar carnes do dia do banco (apenas disponíveis)
      const { data: dbMeats } = await (supabase as any)
        .from("lunch_menu")
        .select("meat_name, is_available")
        .eq("weekday", weekday)
        .neq("is_available", false);

      if (dbMeats && dbMeats.length > 0) {
        setTodayMeats(dbMeats.map((m: any) => m.meat_name));
      } else {
        setTodayMeats(MEATS_BY_DAY[weekday] || []);
      }

      // Buscar carnes assadas marcadas pelo admin
      const { data: porcoes } = await (supabase as any)
        .from("items")
        .select("name")
        .eq("available", true)
        .eq("is_grilled_meat", true);

      if (porcoes && porcoes.length > 0) {
        setGrilledMeats(porcoes.map((p: any) => p.name));
      }

      // Acompanhamentos (fonte única: tabela lunch_sides) - respeitar available=true
      const { data: sidesData, error: sidesError } = await (supabase as any)
        .from("lunch_sides")
        .select("id, name, price, is_free, available")
        .eq("available", true)
        .order("name");

      if (sidesError) {
        console.error("Error fetching lunch_sides:", sidesError);
        setLunchSides([]);
      } else {
        setLunchSides(
          (sidesData || []).map((s: any) => ({
            id: s.id,
            name: s.name,
            price: Number(s.price) || 0,
            is_free: !!s.is_free,
            available: s.available !== false,
          }))
        );
      }

      // Carnes extras (fonte única: tabela extra_meats) - respeitar available=true
      const { data: extraMeatsData, error: extraMeatsError } = await (supabase as any)
        .from("extra_meats")
        .select("id, name, price, available")
        .eq("available", true)
        .order("name");

      if (extraMeatsError) {
        console.error("Error fetching extra_meats:", extraMeatsError);
        setExtraMeatOptions([]);
      } else {
        setExtraMeatOptions(
          (extraMeatsData || []).map((m: any) => ({
            id: m.id,
            name: m.name,
            price: Number(m.price) || 0,
            available: m.available !== false,
          }))
        );
      }
    } catch (error) {
      console.error("Error fetching lunch:", error);
      const weekday = new Date().getDay();
      setTodayMeats(MEATS_BY_DAY[weekday] || []);
      setLunchSides([]);
      setExtraMeatOptions([]);
    } finally {
      setLoading(false);
    }
  };

  // Combine today's meats with grilled meats
  const allAvailableMeats = [...todayMeats, ...grilledMeats];

  const freeSides = lunchSides.filter((s) => s.is_free);
  const paidSides = lunchSides.filter((s) => !s.is_free);

  const toggleMeat = (meat: string, isExtra: boolean = false) => {
    if (isExtra) {
      setExtraMeats((prev) => (prev.includes(meat) ? prev.filter((m) => m !== meat) : [...prev, meat]));
      return;
    }

    if (meatOption === "one") {
      // Allow selecting same meat or different meat
      setSelectedMeats([meat]);
      return;
    }

    // Allow selecting same meat twice or two different meats
    setSelectedMeats((prev) => {
      if (prev.length < 2) return [...prev, meat];
      // Replace oldest
      return [prev[1], meat];
    });
  };

  const removeMeat = (index: number) => {
    setSelectedMeats((prev) => prev.filter((_, i) => i !== index));
  };

  const toggleSide = (sideName: string) => {
    setSelectedSides((prev) => (prev.includes(sideName) ? prev.filter((s) => s !== sideName) : [...prev, sideName]));
  };

  const calculatePrice = () => {
    const base = lunchBases.find((b) => b.id === selectedBase);
    if (!base) return 0;

    const basePrice = meatOption === "one" ? base.singleMeatPrice : base.price;

    const extraMeatsPrice = extraMeats.reduce((sum, meatName) => {
      const option = extraMeatOptions.find((m) => m.name === meatName);
      return sum + (option?.price ?? 0);
    }, 0);

    const paidSidesPrice = selectedSides.reduce((sum, sideName) => {
      const side = lunchSides.find((s) => s.name === sideName);
      if (side && !side.is_free) return sum + (Number(side.price) || 0);
      return sum;
    }, 0);

    return (basePrice + extraMeatsPrice + paidSidesPrice) * quantity;
  };

  const handleAddToCart = () => {
    const base = lunchBases.find((b) => b.id === selectedBase);
    if (!base || selectedMeats.length === 0) return;

    const paidSidesSelected = selectedSides
      .map((name) => lunchSides.find((s) => s.name === name))
      .filter((s): s is LunchSide => !!s && !s.is_free)
      .map((s) => ({ name: s.name, price: Number(s.price) || 0 }));

    const item: LunchCartItem = {
      type: "lunch",
      base,
      meats: selectedMeats,
      extraMeats,
      sides: selectedSides,
      paidSides: paidSidesSelected,
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
          <p className="text-muted-foreground">Não funcionamos aos domingos. Volte amanhã!</p>
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
            {lunchBases.map((base) => {
              const displayPrice = meatOption === "one" ? base.singleMeatPrice : base.price;
              return (
                <div key={base.id} className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value={base.id} id={base.id} />
                    <Label htmlFor={base.id} className="text-sm cursor-pointer">
                      {base.name}
                    </Label>
                  </div>
                  <span className="text-sm text-muted-foreground">R$ {displayPrice.toFixed(2)}</span>
                </div>
              );
            })}
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Meat Option */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm">2. Quantidade de Carnes (incluídas)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <RadioGroup
            value={meatOption}
            onValueChange={(v: "both" | "one") => {
              setMeatOption(v);
              if (v === "one" && selectedMeats.length > 1) {
                setSelectedMeats([selectedMeats[0]]);
              }
            }}
          >
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
                {todayMeats.map((meat) => (
                  <Button
                    key={meat}
                    variant="outline"
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => toggleMeat(meat)}
                    disabled={
                      (meatOption === "one" && selectedMeats.length >= 1) ||
                      (meatOption === "both" && selectedMeats.length >= 2)
                    }
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
                {grilledMeats.map((meat) => (
                  <Button
                    key={meat}
                    variant="outline"
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => toggleMeat(meat)}
                    disabled={
                      (meatOption === "one" && selectedMeats.length >= 1) ||
                      (meatOption === "both" && selectedMeats.length >= 2)
                    }
                  >
                    <Plus className="h-3 w-3 mr-2" />
                    {meat}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {allAvailableMeats.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma carne disponível hoje</p>
          )}
        </CardContent>
      </Card>

      {/* Extra Meats */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm flex items-center gap-2">
            4. Carne Extra (opcional)
            <Badge variant="outline" className="text-xs">
              Preço varia
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {extraMeatOptions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma carne extra disponível</p>
          ) : (
            extraMeatOptions.map((meat) => (
              <div key={`extra-${meat.id}`} className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id={`extra-${meat.id}`}
                    checked={extraMeats.includes(meat.name)}
                    onCheckedChange={() => toggleMeat(meat.name, true)}
                  />
                  <Label htmlFor={`extra-${meat.id}`} className="text-sm cursor-pointer">
                    + {meat.name}
                  </Label>
                </div>
                <Badge variant="secondary" className="text-xs">
                  +R$ {meat.price.toFixed(2)}
                </Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Sides */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span>5. Acompanhamentos</span>
              {freeSides.length > 0 && (
                <Badge variant="outline" className="text-xs">
                  Grátis
                </Badge>
              )}
              {paidSides.length > 0 && (
                <Badge variant="secondary" className="text-xs">
                  Pagos
                </Badge>
              )}
            </div>
            {freeSides.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setSelectedSides(freeSides.map((s) => s.name))}
              >
                Selecionar Grátis
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {lunchSides.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum acompanhamento disponível</p>
          ) : (
            <>
              {freeSides.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Grátis</p>
                  {freeSides.map((side) => (
                    <div key={side.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`side-${side.id}`}
                        checked={selectedSides.includes(side.name)}
                        onCheckedChange={() => toggleSide(side.name)}
                      />
                      <Label htmlFor={`side-${side.id}`} className="text-sm cursor-pointer">
                        {side.name}
                      </Label>
                    </div>
                  ))}
                </div>
              )}

              {paidSides.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Pagos</p>
                  {paidSides.map((side) => (
                    <div key={side.id} className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id={`side-${side.id}`}
                          checked={selectedSides.includes(side.name)}
                          onCheckedChange={() => toggleSide(side.name)}
                        />
                        <Label htmlFor={`side-${side.id}`} className="text-sm cursor-pointer">
                          {side.name}
                        </Label>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        +R$ {side.price.toFixed(2)}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
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
            <span className="text-lg font-bold text-primary">R$ {calculatePrice().toFixed(2)}</span>
          </div>

          <Button className="w-full" onClick={handleAddToCart} disabled={!selectedBase || selectedMeats.length === 0}>
            <Plus className="h-4 w-4 mr-2" />
            Adicionar ao Pedido
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
