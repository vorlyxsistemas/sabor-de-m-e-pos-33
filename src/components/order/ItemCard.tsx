import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";

interface Extra {
  name: string;
  price: number;
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
  };
  onAddToCart: (item: any, extras: Extra[], tapiocaMolhada: boolean) => void;
}

// Available extras for lanches (cuscuz, tapiocas, pães, etc.)
const AVAILABLE_EXTRAS: Extra[] = [
  { name: "Carne moída", price: 4 },
  { name: "Ovo", price: 2 },
  { name: "Queijo", price: 3 },
];

export function ItemCard({ item, onAddToCart }: ItemCardProps) {
  const [selectedExtras, setSelectedExtras] = useState<Extra[]>([]);
  const [tapiocaMolhada, setTapiocaMolhada] = useState(false);

  const isTapioca = item.name.toLowerCase().includes("tapioca");
  const isCuscuz = item.name.toLowerCase().includes("cuscuz");
  const canBeMolhada = isTapioca && !item.is_molhado_by_default;
  // Always show extras for all lanches (tapiocas, cuscuz, pães, sanduíches, etc.)
  const canHaveExtras = true;

  const handleExtraToggle = (extra: Extra) => {
    setSelectedExtras(prev => {
      const exists = prev.find(e => e.name === extra.name);
      if (exists) {
        return prev.filter(e => e.name !== extra.name);
      }
      return [...prev, extra];
    });
  };

  const handleAddToCart = () => {
    onAddToCart(item, selectedExtras, tapiocaMolhada);
    // Reset selections
    setSelectedExtras([]);
    setTapiocaMolhada(false);
  };

  const extrasTotal = selectedExtras.reduce((sum, e) => sum + e.price, 0);
  const molhadaPrice = tapiocaMolhada ? 1 : 0;
  const totalPrice = Number(item.price) + extrasTotal + molhadaPrice;

  return (
    <Card className="shadow-sm">
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

        {/* Extra Fillings */}
        {canHaveExtras && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Recheios extras:</p>
            <div className="grid grid-cols-1 gap-1">
              {AVAILABLE_EXTRAS.map((extra) => (
                <div key={extra.name} className="flex items-center space-x-2">
                  <Checkbox
                    id={`extra-${item.id}-${extra.name}`}
                    checked={selectedExtras.some(e => e.name === extra.name)}
                    onCheckedChange={() => handleExtraToggle(extra)}
                  />
                  <Label 
                    htmlFor={`extra-${item.id}-${extra.name}`} 
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

        <Button size="sm" onClick={handleAddToCart} className="w-full">
          <Plus className="h-4 w-4 mr-1" /> Adicionar
        </Button>
      </CardContent>
    </Card>
  );
}
