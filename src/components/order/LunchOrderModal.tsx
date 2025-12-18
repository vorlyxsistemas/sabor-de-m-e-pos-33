import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Plus, Minus, UtensilsCrossed } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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

interface ExtraMeat {
  id: string;
  name: string;
  price: number;
  available: boolean;
}

export interface LunchCartItem {
  type: "lunch";
  base: { id: string; name: string; price: number };
  meats: string[];
  extraMeats: string[];
  sides: string[];
  paidSides: { name: string; price: number }[];
  quantity: number;
  totalPrice: number;
}

interface LunchOrderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddToOrder: (item: LunchCartItem) => void;
}

// Fallback data
const DEFAULT_LUNCH_BASES = [
  { id: "arroz_feijao", name: "Arroz e Feijão Carioca", price: 14.0, singleMeatPrice: 12.0 },
  { id: "baiao_fava", name: "Baião de Fava", price: 14.0, singleMeatPrice: 12.0 },
  { id: "baiao_pequi", name: "Baião de Pequi", price: 14.0, singleMeatPrice: 12.0 },
  { id: "baiao_cremoso", name: "Baião Cremoso", price: 16.0, singleMeatPrice: 14.0 },
  { id: "baiao_simples", name: "Baião Simples", price: 14.0, singleMeatPrice: 12.0 },
  { id: "somente_arroz", name: "Somente Arroz", price: 12.0, singleMeatPrice: 10.0 },
];

const MEATS_BY_DAY: Record<number, string[]> = {
  0: [],
  1: ["Lasanha de frango", "Picadinho"],
  2: ["Frango ao molho", "Carne de sol"],
  3: ["Almôndega", "Costela"],
  4: ["Lasanha de carne", "Bife ao molho"],
  5: ["Peixe frito", "Peixe cozido", "Fígado acebolado"],
  6: ["Feijoada", "Porco frito/cozido", "Panelada"],
};

const DEFAULT_FREE_SIDES = [
  { id: "macarrao", name: "Macarrão", is_free: true, price: 0, available: true },
  { id: "farofa", name: "Farofa", is_free: true, price: 0, available: true },
  { id: "macaxeira", name: "Macaxeira", is_free: true, price: 0, available: true },
  { id: "salada", name: "Salada", is_free: true, price: 0, available: true },
];

export function LunchOrderModal({ open, onOpenChange, onAddToOrder }: LunchOrderModalProps) {
  const [loading, setLoading] = useState(true);
  const [lunchBases, setLunchBases] = useState<LunchBase[]>(DEFAULT_LUNCH_BASES);
  const [todayMeats, setTodayMeats] = useState<string[]>([]);
  const [grilledMeats, setGrilledMeats] = useState<string[]>([]);
  const [lunchSides, setLunchSides] = useState<LunchSide[]>(DEFAULT_FREE_SIDES);
  const [extraMeatsOptions, setExtraMeatsOptions] = useState<ExtraMeat[]>([]);
  const [weekdayName, setWeekdayName] = useState("");

  // Form state
  const [selectedBase, setSelectedBase] = useState<string>("");
  const [meatOption, setMeatOption] = useState<"both" | "one">("both");
  const [selectedMeats, setSelectedMeats] = useState<string[]>([]);
  const [extraMeats, setExtraMeats] = useState<string[]>([]);
  const [selectedSides, setSelectedSides] = useState<string[]>([]);
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    if (open) {
      fetchData();
    }
  }, [open]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const today = new Date();
      const weekday = today.getDay();
      const weekdayNames = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
      setWeekdayName(weekdayNames[weekday]);

      // Fetch bases
      const { data: dbBases } = await (supabase as any)
        .from("lunch_bases")
        .select("id, name, price, price_one_meat, is_available")
        .eq("is_available", true)
        .order("name");

      if (dbBases && dbBases.length > 0) {
        setLunchBases(dbBases.map((b: any) => ({
          id: b.id,
          name: b.name,
          price: Number(b.price) || 0,
          singleMeatPrice: Number(b.price_one_meat) || 0,
        })));
      }

      // Fetch meats of the day
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

      // Fetch grilled meats
      const { data: porcoes } = await (supabase as any)
        .from("items")
        .select("name")
        .eq("available", true)
        .eq("is_grilled_meat", true);

      if (porcoes && porcoes.length > 0) {
        setGrilledMeats(porcoes.map((p: any) => p.name));
      }

      // Fetch lunch sides from DB - ONLY use DB data, filter by available=true
      const { data: sidesData, error: sidesError } = await (supabase as any)
        .from("lunch_sides")
        .select("*")
        .eq("available", true)
        .order("name");

      console.log("Fetched lunch_sides:", sidesData, "Error:", sidesError);
      
      if (sidesError) {
        console.error("Error fetching lunch_sides:", sidesError);
        // Only use defaults if table doesn't exist (error code 42P01)
        if (sidesError.code === "42P01") {
          setLunchSides(DEFAULT_FREE_SIDES);
        }
      } else {
        // ALWAYS use DB data - no fallback to defaults
        // If DB returns empty array, show empty (admin needs to add items)
        setLunchSides(sidesData || []);
      }

      // Fetch extra meats from DB - ONLY use DB data, filter by available=true
      const { data: extraMeatsData, error: extraMeatsError } = await (supabase as any)
        .from("extra_meats")
        .select("*")
        .eq("available", true)
        .order("name");

      console.log("Fetched extra_meats:", extraMeatsData, "Error:", extraMeatsError);

      if (extraMeatsError) {
        console.error("Error fetching extra_meats:", extraMeatsError);
      } else {
        // ALWAYS use DB data - only available=true items
        setExtraMeatsOptions(extraMeatsData || []);
      }
    } catch (error) {
      console.error("Error fetching lunch data:", error);
    } finally {
      setLoading(false);
    }
  };

  const allAvailableMeats = [...todayMeats, ...grilledMeats];

  // Extra meats options - ONLY from extra_meats table, respecting available=true filter
  // Do NOT mix with allAvailableMeats - those are included meats, not extras
  const allExtraMeatOptions = extraMeatsOptions.map(m => ({ 
    name: m.name, 
    price: Number(m.price) || 0 
  }));

  const toggleMeat = (meat: string) => {
    if (meatOption === "one") {
      setSelectedMeats([meat]);
    } else {
      setSelectedMeats(prev => {
        if (prev.length < 2) {
          return [...prev, meat];
        }
        return [prev[1], meat];
      });
    }
  };

  const removeMeat = (index: number) => {
    setSelectedMeats(prev => prev.filter((_, i) => i !== index));
  };

  const toggleExtraMeat = (meat: string) => {
    setExtraMeats(prev => 
      prev.includes(meat) ? prev.filter(m => m !== meat) : [...prev, meat]
    );
  };

  const toggleSide = (sideName: string) => {
    setSelectedSides(prev =>
      prev.includes(sideName) ? prev.filter(s => s !== sideName) : [...prev, sideName]
    );
  };

  const calculatePrice = () => {
    const base = lunchBases.find(b => b.id === selectedBase);
    if (!base) return 0;

    const basePrice = meatOption === "one" ? base.singleMeatPrice : base.price;
    
    // Calculate extra meats price
    const extraMeatsPrice = extraMeats.reduce((sum, meatName) => {
      const option = allExtraMeatOptions.find(o => o.name === meatName);
      return sum + (option?.price || 6);
    }, 0);

    // Calculate paid sides
    const paidSidesPrice = selectedSides.reduce((sum, sideName) => {
      const side = lunchSides.find(s => s.name === sideName);
      if (side && !side.is_free) {
        return sum + Number(side.price);
      }
      return sum;
    }, 0);

    return (basePrice + extraMeatsPrice + paidSidesPrice) * quantity;
  };

  const handleAddToOrder = () => {
    const base = lunchBases.find(b => b.id === selectedBase);
    if (!base || selectedMeats.length === 0) return;

    const paidSides = selectedSides
      .map(sideName => lunchSides.find(s => s.name === sideName))
      .filter(s => s && !s.is_free)
      .map(s => ({ name: s!.name, price: Number(s!.price) }));

    const item: LunchCartItem = {
      type: "lunch",
      base: { id: base.id, name: base.name, price: meatOption === "one" ? base.singleMeatPrice : base.price },
      meats: selectedMeats,
      extraMeats,
      sides: selectedSides,
      paidSides,
      quantity,
      totalPrice: calculatePrice(),
    };

    onAddToOrder(item);
    resetForm();
    onOpenChange(false);
  };

  const resetForm = () => {
    setSelectedBase("");
    setMeatOption("both");
    setSelectedMeats([]);
    setExtraMeats([]);
    setSelectedSides([]);
    setQuantity(1);
  };

  const freeSides = lunchSides.filter(s => s.is_free);
  const paidSides = lunchSides.filter(s => !s.is_free);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UtensilsCrossed className="h-5 w-5" />
            Adicionar Almoço de {weekdayName}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Base Selection */}
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm">1. Escolha a Base</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <RadioGroup value={selectedBase} onValueChange={setSelectedBase}>
                  {lunchBases.map(base => {
                    const displayPrice = meatOption === "one" ? base.singleMeatPrice : base.price;
                    return (
                      <div key={base.id} className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value={base.id} id={`base-${base.id}`} />
                          <Label htmlFor={`base-${base.id}`} className="text-sm cursor-pointer">
                            {base.name}
                          </Label>
                        </div>
                        <span className="text-sm text-muted-foreground">
                          R$ {displayPrice.toFixed(2)}
                        </span>
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
                <RadioGroup value={meatOption} onValueChange={(v: "both" | "one") => {
                  setMeatOption(v);
                  if (v === "one" && selectedMeats.length > 1) {
                    setSelectedMeats([selectedMeats[0]]);
                  }
                }}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="both" id="modal-both" />
                    <Label htmlFor="modal-both" className="text-sm cursor-pointer">
                      Desejo as duas carnes (pode repetir)
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="one" id="modal-one" />
                    <Label htmlFor="modal-one" className="text-sm cursor-pointer">
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
                  3. Carnes Disponíveis ({meatOption === "both" ? "máx 2" : "escolha 1"})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
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
                          disabled={(meatOption === "one" && selectedMeats.length >= 1) || (meatOption === "both" && selectedMeats.length >= 2)}
                        >
                          <Plus className="h-3 w-3 mr-2" />
                          {meat}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

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
                          disabled={(meatOption === "one" && selectedMeats.length >= 1) || (meatOption === "both" && selectedMeats.length >= 2)}
                        >
                          <Plus className="h-3 w-3 mr-2" />
                          {meat}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Extra Meats */}
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  4. Carne Extra (opcional)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {allExtraMeatOptions.map(option => (
                  <div key={`extra-${option.name}`} className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id={`modal-extra-${option.name}`}
                        checked={extraMeats.includes(option.name)}
                        onCheckedChange={() => toggleExtraMeat(option.name)}
                      />
                      <Label htmlFor={`modal-extra-${option.name}`} className="text-sm cursor-pointer">
                        + {option.name}
                      </Label>
                    </div>
                    <Badge variant="secondary" className="text-xs">+R$ {option.price.toFixed(2)}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Sides */}
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm flex items-center justify-between">
                  <span>5. Acompanhamentos</span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setSelectedSides(freeSides.map(s => s.name))}
                  >
                    Selecionar Grátis
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Free sides */}
                {freeSides.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-green-600 mb-2">Grátis:</p>
                    {freeSides.map(side => (
                      <div key={side.id} className="flex items-center space-x-2 mb-1">
                        <Checkbox
                          id={`modal-side-${side.id}`}
                          checked={selectedSides.includes(side.name)}
                          onCheckedChange={() => toggleSide(side.name)}
                        />
                        <Label htmlFor={`modal-side-${side.id}`} className="text-sm cursor-pointer">
                          {side.name}
                        </Label>
                        <Badge variant="outline" className="text-xs text-green-600">Grátis</Badge>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Paid sides */}
                {paidSides.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">Pagos:</p>
                    {paidSides.map(side => (
                      <div key={side.id} className="flex items-center justify-between mb-1">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id={`modal-side-${side.id}`}
                            checked={selectedSides.includes(side.name)}
                            onCheckedChange={() => toggleSide(side.name)}
                          />
                          <Label htmlFor={`modal-side-${side.id}`} className="text-sm cursor-pointer">
                            {side.name}
                          </Label>
                        </div>
                        <Badge variant="secondary" className="text-xs">+R$ {Number(side.price).toFixed(2)}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quantity & Total */}
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
                  onClick={handleAddToOrder}
                  disabled={!selectedBase || selectedMeats.length === 0}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar ao Pedido
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
