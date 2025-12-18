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
import { Loader2, Save, Plus, Trash2, Beef, Salad, Drumstick } from "lucide-react";

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

interface LunchSide {
  id?: string;
  name: string;
  price: number;
  is_free: boolean;
  available: boolean;
}

interface ExtraMeat {
  id?: string;
  name: string;
  price: number;
  available: boolean;
}

const Lunch = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingBases, setSavingBases] = useState(false);
  const [savingSides, setSavingSides] = useState(false);
  const [savingExtraMeats, setSavingExtraMeats] = useState(false);
  const [lunchMenu, setLunchMenu] = useState<Record<number, LunchItem[]>>({});
  const [lunchBases, setLunchBases] = useState<LunchBase[]>([]);
  const [lunchSides, setLunchSides] = useState<LunchSide[]>([]);
  const [extraMeats, setExtraMeats] = useState<ExtraMeat[]>([]);

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

      // Fetch lunch sides - always show DB data for admin management
      const { data: sidesData, error: sidesError } = await (supabase as any)
        .from('lunch_sides')
        .select('*')
        .order('name');

      if (sidesError) {
        console.error('Error fetching lunch_sides:', sidesError);
        // Use defaults if table doesn't exist
        setLunchSides([
          { name: 'Macarrão', price: 0, is_free: true, available: true },
          { name: 'Farofa', price: 0, is_free: true, available: true },
          { name: 'Macaxeira', price: 0, is_free: true, available: true },
          { name: 'Salada', price: 0, is_free: true, available: true },
        ]);
      } else {
        // Use DB data even if empty - admin can add items
        setLunchSides(sidesData || []);
      }

      // Fetch extra meats - always show DB data for admin management
      const { data: extraMeatsData, error: extraMeatsError } = await (supabase as any)
        .from('extra_meats')
        .select('*')
        .order('name');

      if (extraMeatsError) {
        console.error('Error fetching extra_meats:', extraMeatsError);
      }
      // Always use DB data (show all items including unavailable for admin management)
      setExtraMeats(extraMeatsData || []);

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

  // Meat functions
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

  // Base functions
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

  // Side functions
  const updateSide = (index: number, field: keyof LunchSide, value: string | number | boolean) => {
    setLunchSides(prev => prev.map((item, i) => 
      i === index ? { ...item, [field]: value } : item
    ));
  };

  const addSide = () => {
    setLunchSides(prev => [...prev, { name: '', price: 0, is_free: true, available: true }]);
  };

  const removeSide = (index: number) => {
    if (lunchSides.length <= 1) return;
    setLunchSides(prev => prev.filter((_, i) => i !== index));
  };

  // Extra meat functions
  const updateExtraMeat = (index: number, field: keyof ExtraMeat, value: string | number | boolean) => {
    setExtraMeats(prev => prev.map((item, i) => 
      i === index ? { ...item, [field]: value } : item
    ));
  };

  const addExtraMeat = () => {
    setExtraMeats(prev => [...prev, { name: '', price: 6, available: true }]);
  };

  const removeExtraMeat = (index: number) => {
    setExtraMeats(prev => prev.filter((_, i) => i !== index));
  };

  // Save functions
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
        description: error.message || "Não foi possível salvar",
        variant: "destructive",
      });
    } finally {
      setSavingBases(false);
    }
  };

  const handleSaveSides = async () => {
    setSavingSides(true);
    try {
      await (supabase as any).from('lunch_sides').delete().neq('id', '00000000-0000-0000-0000-000000000000');

      const entries = lunchSides
        .filter(s => s.name.trim())
        .map(s => ({
          name: s.name.trim(),
          price: s.is_free ? 0 : Number(s.price) || 0,
          is_free: s.is_free,
          available: s.available !== false,
        }));

      if (entries.length > 0) {
        const { error } = await (supabase as any).from('lunch_sides').insert(entries);
        if (error) throw error;
      }

      toast({ title: "Acompanhamentos salvos!" });
      fetchData();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Não foi possível salvar. Verifique se a tabela lunch_sides existe.",
        variant: "destructive",
      });
    } finally {
      setSavingSides(false);
    }
  };

  const handleSaveExtraMeats = async () => {
    setSavingExtraMeats(true);
    try {
      await (supabase as any).from('extra_meats').delete().neq('id', '00000000-0000-0000-0000-000000000000');

      const entries = extraMeats
        .filter(m => m.name.trim())
        .map(m => ({
          name: m.name.trim(),
          price: Number(m.price) || 6,
          available: m.available !== false,
        }));

      if (entries.length > 0) {
        const { error } = await (supabase as any).from('extra_meats').insert(entries);
        if (error) throw error;
      }

      toast({ title: "Carnes extras salvas!" });
      fetchData();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Não foi possível salvar. Verifique se a tabela extra_meats existe.",
        variant: "destructive",
      });
    } finally {
      setSavingExtraMeats(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout title="Cardápio de Almoço" subtitle="Configure carnes, bases, acompanhamentos e extras">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Cardápio de Almoço" subtitle="Configure carnes, bases, acompanhamentos e extras">
      <Tabs defaultValue="meats" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="meats" className="gap-2">
            <Beef className="h-4 w-4" />
            <span className="hidden sm:inline">Carnes do Dia</span>
            <span className="sm:hidden">Carnes</span>
          </TabsTrigger>
          <TabsTrigger value="bases" className="gap-2">
            <Salad className="h-4 w-4" />
            <span className="hidden sm:inline">Bases</span>
            <span className="sm:hidden">Bases</span>
          </TabsTrigger>
          <TabsTrigger value="sides" className="gap-2">
            <Salad className="h-4 w-4" />
            <span className="hidden sm:inline">Acompanhamentos</span>
            <span className="sm:hidden">Acomp.</span>
          </TabsTrigger>
          <TabsTrigger value="extras" className="gap-2">
            <Drumstick className="h-4 w-4" />
            <span className="hidden sm:inline">Carne Extra</span>
            <span className="sm:hidden">Extras</span>
          </TabsTrigger>
        </TabsList>

        {/* Carnes do Dia */}
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

        {/* Bases */}
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

        {/* Acompanhamentos */}
        <TabsContent value="sides">
          <div className="flex justify-end mb-4">
            <Button onClick={handleSaveSides} disabled={savingSides} className="gap-2">
              {savingSides ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar Acompanhamentos
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Acompanhamentos do Almoço</CardTitle>
              <p className="text-sm text-muted-foreground">
                Configure quais acompanhamentos são grátis ou pagos
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {lunchSides.map((side, index) => (
                <div key={index} className="flex flex-wrap items-end gap-3 p-3 border rounded-lg bg-muted/30">
                  <div className="flex-1 min-w-[200px]">
                    <Label className="text-xs">Nome</Label>
                    <Input
                      value={side.name}
                      onChange={(e) => updateSide(index, 'name', e.target.value)}
                      placeholder="Ex: Macarrão"
                      className="h-9"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={side.is_free}
                      onCheckedChange={(v) => updateSide(index, 'is_free', v)}
                      id={`side-free-${index}`}
                    />
                    <Label htmlFor={`side-free-${index}`} className="text-xs cursor-pointer">
                      Grátis
                    </Label>
                  </div>
                  {!side.is_free && (
                    <div className="w-24">
                      <Label className="text-xs">Preço</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={side.price || ''}
                        onChange={(e) => updateSide(index, 'price', Number(e.target.value))}
                        placeholder="R$ 0"
                        className="h-9"
                      />
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={side.available !== false}
                      onCheckedChange={(v) => updateSide(index, 'available', v)}
                      id={`side-available-${index}`}
                    />
                    <Label htmlFor={`side-available-${index}`} className="text-xs cursor-pointer">
                      Disponível
                    </Label>
                  </div>
                  {lunchSides.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-9 px-2 text-destructive"
                      onClick={() => removeSide(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={addSide}
              >
                <Plus className="h-4 w-4" />
                Adicionar Acompanhamento
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Carnes Extras */}
        <TabsContent value="extras">
          <div className="flex justify-end mb-4">
            <Button onClick={handleSaveExtraMeats} disabled={savingExtraMeats} className="gap-2">
              {savingExtraMeats ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar Carnes Extras
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Carnes Extras</CardTitle>
              <p className="text-sm text-muted-foreground">
                Carnes que podem ser adicionadas além das incluídas no almoço
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {extraMeats.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhuma carne extra cadastrada. As carnes do dia serão usadas como opções extras com preço padrão de R$ 6,00.
                </p>
              )}
              {extraMeats.map((meat, index) => (
                <div key={index} className="flex flex-wrap items-end gap-3 p-3 border rounded-lg bg-muted/30">
                  <div className="flex-1 min-w-[200px]">
                    <Label className="text-xs">Nome da Carne</Label>
                    <Input
                      value={meat.name}
                      onChange={(e) => updateExtraMeat(index, 'name', e.target.value)}
                      placeholder="Ex: Picanha"
                      className="h-9"
                    />
                  </div>
                  <div className="w-28">
                    <Label className="text-xs">Preço</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={meat.price || ''}
                      onChange={(e) => updateExtraMeat(index, 'price', Number(e.target.value))}
                      placeholder="R$ 6"
                      className="h-9"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={meat.available !== false}
                      onCheckedChange={(v) => updateExtraMeat(index, 'available', v)}
                      id={`extra-meat-available-${index}`}
                    />
                    <Label htmlFor={`extra-meat-available-${index}`} className="text-xs cursor-pointer">
                      Disponível
                    </Label>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 px-2 text-destructive"
                    onClick={() => removeExtraMeat(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={addExtraMeat}
              >
                <Plus className="h-4 w-4" />
                Adicionar Carne Extra
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AdminLayout>
  );
};

export default Lunch;
