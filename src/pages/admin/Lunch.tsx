import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, Plus, Trash2 } from "lucide-react";

const weekdays = [
  { value: 0, label: 'Domingo' },
  { value: 1, label: 'Segunda-feira' },
  { value: 2, label: 'Terça-feira' },
  { value: 3, label: 'Quarta-feira' },
  { value: 4, label: 'Quinta-feira' },
  { value: 5, label: 'Sexta-feira' },
  { value: 6, label: 'Sábado' },
];

interface LunchItem {
  id?: string;
  weekday: number;
  meat_name: string;
  meat_price: number;
  is_available: boolean;
}

const Lunch = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lunchMenu, setLunchMenu] = useState<Record<number, LunchItem[]>>({});

  useEffect(() => {
    fetchLunchMenu();
  }, []);

  const fetchLunchMenu = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from('lunch_menu')
        .select('*')
        .order('weekday');

      if (error) throw error;

      // Group by weekday
      const grouped: Record<number, LunchItem[]> = {};
      weekdays.forEach(day => {
        grouped[day.value] = data?.filter((item: any) => item.weekday === day.value) || [];
        // Ensure at least one entry per day
        if (grouped[day.value].length === 0) {
          grouped[day.value] = [{ weekday: day.value, meat_name: '', meat_price: 0, is_available: true }];
        }
      });

      setLunchMenu(grouped);
    } catch (error) {
      console.error('Error fetching lunch menu:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar o cardápio",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateItem = (weekday: number, index: number, field: 'meat_name' | 'meat_price' | 'is_available', value: string | number | boolean) => {
    setLunchMenu(prev => ({
      ...prev,
      [weekday]: prev[weekday].map((item, i) => 
        i === index ? { ...item, [field]: value } : item
      ),
    }));
  };

  const addItem = (weekday: number) => {
    setLunchMenu(prev => ({
      ...prev,
      [weekday]: [...prev[weekday], { weekday, meat_name: '', meat_price: 0, is_available: true }],
    }));
  };

  const removeItem = (weekday: number, index: number) => {
    if (lunchMenu[weekday].length <= 1) return;
    setLunchMenu(prev => ({
      ...prev,
      [weekday]: prev[weekday].filter((_, i) => i !== index),
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Delete all existing entries
      await (supabase as any).from('lunch_menu').delete().neq('id', '00000000-0000-0000-0000-000000000000');

      // Insert all entries
      const entries: { weekday: number; meat_name: string; meat_price: number; is_available: boolean }[] = [];
      
      Object.entries(lunchMenu).forEach(([weekday, items]) => {
        items.forEach(item => {
          if (item.meat_name.trim()) {
            entries.push({
              weekday: Number(weekday),
              meat_name: item.meat_name.trim(),
              meat_price: Number(item.meat_price) || 0,
              is_available: item.is_available !== false,
            });
          }
        });
      });

      if (entries.length > 0) {
        const { error } = await (supabase as any).from('lunch_menu').insert(entries);
        if (error) throw error;
      }

      toast({ title: "Cardápio de almoço salvo!" });
      fetchLunchMenu();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Não foi possível salvar",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout title="Cardápio de Almoço" subtitle="Configure as carnes do dia">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Cardápio de Almoço" subtitle="Configure as carnes do dia">
      <div className="flex justify-end mb-4">
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar Alterações
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {weekdays.map((day) => (
          <Card key={day.value} className={day.value === 0 || day.value === 6 ? 'opacity-60' : ''}>
            <CardHeader className="py-3">
              <CardTitle className="text-sm">{day.label}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {lunchMenu[day.value]?.map((item, index) => (
                <div key={index} className="space-y-2 border-b pb-3 mb-3 last:border-b-0 last:mb-0 last:pb-0">
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Label className="text-xs">Carne {index + 1}</Label>
                      <Input
                        value={item.meat_name}
                        onChange={(e) => updateItem(day.value, index, 'meat_name', e.target.value)}
                        placeholder="Nome da carne"
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="w-24">
                      <Label className="text-xs">Preço</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={item.meat_price || ''}
                        onChange={(e) => updateItem(day.value, index, 'meat_price', Number(e.target.value))}
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={item.is_available !== false}
                        onCheckedChange={(v) => updateItem(day.value, index, 'is_available', v)}
                        id={`available-${day.value}-${index}`}
                      />
                      <Label htmlFor={`available-${day.value}-${index}`} className="text-xs cursor-pointer">
                        Disponível
                      </Label>
                    </div>
                    {index > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs text-destructive gap-1"
                        onClick={() => removeItem(day.value, index)}
                      >
                        <Trash2 className="h-3 w-3" />
                        Remover
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                className="w-full h-7 text-xs gap-1"
                onClick={() => addItem(day.value)}
              >
                <Plus className="h-3 w-3" />
                Adicionar carne
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </AdminLayout>
  );
};

export default Lunch;
