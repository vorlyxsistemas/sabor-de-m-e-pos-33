import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, Plus, Trash2, Beef, Salad } from "lucide-react";

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

interface LunchBase {
  id?: string;
  name: string;
  price: number;
  price_one_meat: number;
  is_available: boolean;
}

const Lunch = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingBases, setSavingBases] = useState(false);
  const [lunchMenu, setLunchMenu] = useState<Record<number, LunchItem[]>>({});
  const [lunchBases, setLunchBases] = useState<LunchBase[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch lunch meats
      const { data: meatsData, error: meatsError } = await (supabase as any)
        .from('lunch_menu')
        .select('*')
        .order('weekday');

      if (meatsError) throw meatsError;

      const grouped: Record<number, LunchItem[]> = {};
      weekdays.forEach(day => {
        grouped[day.value] = meatsData?.filter((item: any) => item.weekday === day.value) || [];
        if (grouped[day.value].length === 0) {
          grouped[day.value] = [{ weekday: day.value, meat_name: '', meat_price: 0, is_available: true }];
        }
      });
      setLunchMenu(grouped);

      // Fetch lunch bases
      const { data: basesData, error: basesError } = await (supabase as any)
        .from('lunch_bases')
        .select('*')
        .order('name');

      if (basesError && basesError.code !== '42P01') {
        // Table doesn't exist, use default bases
        setLunchBases([
          { name: 'Arroz e feijão', price: 14, price_one_meat: 12, is_available: true },
          { name: 'Baião simples', price: 14, price_one_meat: 12, is_available: true },
          { name: 'Baião de fava', price: 15, price_one_meat: 13, is_available: true },
          { name: 'Baião de pequi', price: 15, price_one_meat: 13, is_available: true },
          { name: 'Baião cremoso', price: 16, price_one_meat: 14, is_available: true },
          { name: 'Somente arroz', price: 12, price_one_meat: 10, is_available: true },
        ]);
      } else {
        setLunchBases(basesData || []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os dados",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateMeatItem = (weekday: number, index: number, field: 'meat_name' | 'meat_price' | 'is_available', value: string | number | boolean) => {
    setLunchMenu(prev => ({
      ...prev,
      [weekday]: prev[weekday].map((item, i) => 
        i === index ? { ...item, [field]: value } : item
      ),
    }));
  };

  const addMeatItem = (weekday: number) => {
    setLunchMenu(prev => ({
      ...prev,
      [weekday]: [...prev[weekday], { weekday, meat_name: '', meat_price: 0, is_available: true }],
    }));
  };

  const removeMeatItem = (weekday: number, index: number) => {
    if (lunchMenu[weekday].length <= 1) return;
    setLunchMenu(prev => ({
      ...prev,
      [weekday]: prev[weekday].filter((_, i) => i !== index),
    }));
  };

  const updateBase = (index: number, field: keyof LunchBase, value: string | number | boolean) => {
    setLunchBases(prev => prev.map((item, i) => 
      i === index ? { ...item, [field]: value } : item
    ));
  };

  const addBase = () => {
    setLunchBases(prev => [...prev, { name: '', price: 0, price_one_meat: 0, is_available: true }]);
  };

  const removeBase = (index: number) => {
    if (lunchBases.length <= 1) return;
    setLunchBases(prev => prev.filter((_, i) => i !== index));
  };

  const handleSaveMeats = async () => {
    setSaving(true);
    try {
      await (supabase as any).from('lunch_menu').delete().neq('id', '00000000-0000-0000-0000-000000000000');

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

      toast({ title: "Carnes do almoço salvas!" });
      fetchData();
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

  const handleSaveBases = async () => {
    setSavingBases(true);
    try {
      // Try to delete existing bases
      await (supabase as any).from('lunch_bases').delete().neq('id', '00000000-0000-0000-0000-000000000000');

      const entries = lunchBases
        .filter(b => b.name.trim())
        .map(b => ({
          name: b.name.trim(),
          price: Number(b.price) || 0,
          price_one_meat: Number(b.price_one_meat) || 0,
          is_available: b.is_available !== false,
        }));

      if (entries.length > 0) {
        const { error } = await (supabase as any).from('lunch_bases').insert(entries);
        if (error) throw error;
      }

      toast({ title: "Bases do almoço salvas!" });
      fetchData();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Não foi possível salvar. Verifique se a tabela lunch_bases existe.",
        variant: "destructive",
      });
    } finally {
      setSavingBases(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout title="Cardápio de Almoço" subtitle="Configure carnes e bases do almoço">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Cardápio de Almoço" subtitle="Configure carnes e bases do almoço">
      <Tabs defaultValue="meats" className="space-y-4">
        <TabsList>
          <TabsTrigger value="meats" className="gap-2">
            <Beef className="h-4 w-4" />
            Carnes do Dia
          </TabsTrigger>
          <TabsTrigger value="bases" className="gap-2">
            <Salad className="h-4 w-4" />
            Bases do Almoço
          </TabsTrigger>
        </TabsList>

        <TabsContent value="meats">
          <div className="flex justify-end mb-4">
            <Button onClick={handleSaveMeats} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar Carnes
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {weekdays.map((day) => (
              <Card key={day.value} className={day.value === 0 ? 'opacity-60' : ''}>
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
                            onChange={(e) => updateMeatItem(day.value, index, 'meat_name', e.target.value)}
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
                            onChange={(e) => updateMeatItem(day.value, index, 'meat_price', Number(e.target.value))}
                            className="h-8 text-sm"
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={item.is_available !== false}
                            onCheckedChange={(v) => updateMeatItem(day.value, index, 'is_available', v)}
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
                            onClick={() => removeMeatItem(day.value, index)}
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
                    onClick={() => addMeatItem(day.value)}
                  >
                    <Plus className="h-3 w-3" />
                    Adicionar carne
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="bases">
          <div className="flex justify-end mb-4">
            <Button onClick={handleSaveBases} disabled={savingBases} className="gap-2">
              {savingBases ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar Bases
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Tipos de Arroz / Base</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {lunchBases.map((base, index) => (
                <div key={index} className="flex flex-wrap items-end gap-3 p-3 border rounded-lg bg-muted/30">
                  <div className="flex-1 min-w-[200px]">
                    <Label className="text-xs">Nome da Base</Label>
                    <Input
                      value={base.name}
                      onChange={(e) => updateBase(index, 'name', e.target.value)}
                      placeholder="Ex: Arroz e feijão"
                      className="h-9"
                    />
                  </div>
                  <div className="w-28">
                    <Label className="text-xs">Preço (2 carnes)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={base.price || ''}
                      onChange={(e) => updateBase(index, 'price', Number(e.target.value))}
                      placeholder="R$ 14"
                      className="h-9"
                    />
                  </div>
                  <div className="w-28">
                    <Label className="text-xs">Preço (1 carne)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={base.price_one_meat || ''}
                      onChange={(e) => updateBase(index, 'price_one_meat', Number(e.target.value))}
                      placeholder="R$ 12"
                      className="h-9"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={base.is_available !== false}
                      onCheckedChange={(v) => updateBase(index, 'is_available', v)}
                      id={`base-available-${index}`}
                    />
                    <Label htmlFor={`base-available-${index}`} className="text-xs cursor-pointer">
                      Ativo
                    </Label>
                  </div>
                  {lunchBases.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-9 px-2 text-destructive"
                      onClick={() => removeBase(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={addBase}
              >
                <Plus className="h-4 w-4" />
                Adicionar Base
              </Button>
            </CardContent>
          </Card>

        </TabsContent>
      </Tabs>
    </AdminLayout>
  );
};

export default Lunch;