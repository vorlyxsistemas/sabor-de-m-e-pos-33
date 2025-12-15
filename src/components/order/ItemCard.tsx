import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Plus, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Extra {
  id: string;
  name: string;
  price: number;
  code?: string;
}

interface ItemCardProps {
  item: {
    id: string;
    name: string;
    price: number;
    description?: string;
    allow_tapioca_molhada?: boolean;
    is_molhado_by_default?: boolean;
    allow_extras?: boolean;
    category_id?: string;
    image_url?: string | null;
    requires_variation?: boolean;
    variation_options?: string[] | null;
  };
  categoryName?: string;
  onAddToCart: (item: any, extras: Extra[], tapiocaMolhada: boolean, selectedVariation?: string) => void;
}

// Categories that should NOT show extras
const CATEGORIES_WITHOUT_EXTRAS = ["bebidas", "porções", "porcoes", "sucos", "refrigerantes", "caldos"];

export function ItemCard({ item, categoryName = "", onAddToCart }: ItemCardProps) {
  const [selectedExtras, setSelectedExtras] = useState<Extra[]>([]);
  const [tapiocaMolhada, setTapiocaMolhada] = useState(false);
  const [availableExtras, setAvailableExtras] = useState<Extra[]>([]);
  const [selectedVariation, setSelectedVariation] = useState<string>("");

  const isTapioca = item.name.toLowerCase().includes("tapioca");
  const canBeMolhada = isTapioca && !item.is_molhado_by_default;
  
  // Check if this category should show extras
  const categoryLower = categoryName.toLowerCase();
  const isExcludedCategory = CATEGORIES_WITHOUT_EXTRAS.some(cat => categoryLower.includes(cat));
  const canHaveExtras = item.allow_extras !== false && !isExcludedCategory;

  // Check if item requires variation selection (like "1/2 caldo")
  const requiresVariation = item.requires_variation && item.variation_options && item.variation_options.length > 0;

  // Fetch available extras for this item's category
  useEffect(() => {
    if (canHaveExtras) {
      fetchExtras();
    }
  }, [categoryName, canHaveExtras]);

  // Reset variation when item changes
  useEffect(() => {
    setSelectedVariation("");
  }, [item.id]);

  const fetchExtras = async () => {
    const { data } = await supabase
      .from("global_extras")
      .select("*")
      .or(`applies_to_category.is.null,applies_to_category.eq.${categoryName}`)
      .order("name");
    
    if (data) {
      setAvailableExtras(data.map(e => ({
        id: e.id,
        name: e.name,
        price: Number(e.price),
        code: e.code
      })));
    }
  };

  const handleExtraToggle = (extra: Extra) => {
    setSelectedExtras(prev => {
      const exists = prev.find(e => e.id === extra.id);
      if (exists) {
        return prev.filter(e => e.id !== extra.id);
      }
      return [...prev, extra];
    });
  };

  const handleAddToCart = () => {
    // If variation is required but not selected, show error
    if (requiresVariation && !selectedVariation) {
      return;
    }
    
    onAddToCart(item, selectedExtras, tapiocaMolhada, selectedVariation || undefined);
    // Reset selections
    setSelectedExtras([]);
    setTapiocaMolhada(false);
    setSelectedVariation("");
  };

  const extrasTotal = selectedExtras.reduce((sum, e) => sum + e.price, 0);
  const molhadaPrice = tapiocaMolhada ? 1 : 0;
  const totalPrice = Number(item.price) + extrasTotal + molhadaPrice;

  const canAdd = !requiresVariation || selectedVariation;

  return (
    <Card className="shadow-sm overflow-hidden">
      {item.image_url && (
        <div className="w-full h-24 bg-muted">
          <img 
            src={item.image_url} 
            alt={item.name}
            className="w-full h-full object-cover"
          />
        </div>
      )}
      <CardHeader className="py-3 px-4">
        <CardTitle className="text-sm flex justify-between">
          <span>{item.name}</span>
          <span>R$ {Number(item.price).toFixed(2)}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="py-2 px-4 space-y-3">
        {item.description && (
          <p className="text-xs text-muted-foreground">{item.description}</p>
        )}

        {/* Variation Selection (e.g., for "1/2 caldo") */}
        {requiresVariation && (
          <div className="space-y-2 p-2 bg-amber-50 dark:bg-amber-950/30 rounded border border-amber-200 dark:border-amber-800">
            <p className="text-xs font-medium flex items-center gap-1">
              <AlertCircle className="h-3 w-3 text-amber-600" />
              Escolha o tipo:
            </p>
            <RadioGroup value={selectedVariation} onValueChange={setSelectedVariation}>
              {item.variation_options?.map((option) => (
                <div key={option} className="flex items-center space-x-2">
                  <RadioGroupItem value={option} id={`var-${item.id}-${option}`} />
                  <Label htmlFor={`var-${item.id}-${option}`} className="text-xs cursor-pointer">
                    {option}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        )}

        {/* Tapioca Molhada Option */}
        {isTapioca && canBeMolhada && (
          <div className="flex items-center space-x-2 p-2 bg-accent/50 rounded">
            <Checkbox
              id={`molhada-${item.id}`}
              checked={tapiocaMolhada}
              onCheckedChange={(checked) => setTapiocaMolhada(!!checked)}
            />
            <Label htmlFor={`molhada-${item.id}`} className="text-xs cursor-pointer">
              Molhar com caldo (+R$1,00)
            </Label>
          </div>
        )}

        {/* Extra Fillings - Only show if category allows */}
        {canHaveExtras && availableExtras.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Recheios extras:</p>
            <div className="grid grid-cols-1 gap-1">
              {availableExtras.map((extra) => (
                <div key={extra.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`extra-${item.id}-${extra.id}`}
                    checked={selectedExtras.some(e => e.id === extra.id)}
                    onCheckedChange={() => handleExtraToggle(extra)}
                  />
                  <Label 
                    htmlFor={`extra-${item.id}-${extra.id}`} 
                    className="text-xs cursor-pointer flex-1"
                  >
                    {extra.name}
                  </Label>
                  <span className="text-xs text-muted-foreground">
                    +R${extra.price.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Total with extras */}
        {(selectedExtras.length > 0 || tapiocaMolhada) && (
          <div className="flex items-center justify-between text-xs border-t pt-2">
            <span className="text-muted-foreground">Total com extras:</span>
            <Badge variant="secondary">R$ {totalPrice.toFixed(2)}</Badge>
          </div>
        )}

        <Button 
          size="sm" 
          onClick={handleAddToCart} 
          className="w-full"
          disabled={!canAdd}
        >
          <Plus className="h-4 w-4 mr-1" /> 
          {requiresVariation && !selectedVariation ? "Selecione o tipo" : "Adicionar"}
        </Button>
      </CardContent>
    </Card>
  );
}
