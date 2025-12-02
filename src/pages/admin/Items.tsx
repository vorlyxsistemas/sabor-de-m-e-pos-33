import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Loader2, X } from "lucide-react";

interface Category {
  id: string;
  name: string;
}

interface Extra {
  id?: string;
  name: string;
  price: number;
}

interface Item {
  id: string;
  name: string;
  description: string | null;
  price: number;
  category_id: string | null;
  allow_extras: boolean;
  allow_quantity: boolean;
  allow_tapioca_molhada: boolean;
  available: boolean;
  extras?: Extra[];
}

const defaultItem: Omit<Item, 'id'> = {
  name: '',
  description: '',
  price: 0,
  category_id: null,
  allow_extras: false,
  allow_quantity: true,
  allow_tapioca_molhada: false,
  available: true,
  extras: [],
};

const Items = () => {
  const { toast } = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [formData, setFormData] = useState<Omit<Item, 'id'>>(defaultItem);
  const [newExtra, setNewExtra] = useState({ name: '', price: 0 });

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    fetchItems();
  }, [selectedCategory]);

  const fetchCategories = async () => {
    const { data } = await supabase
      .from('categories')
      .select('*')
      .order('name');
    setCategories(data || []);
  };

  const fetchItems = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('items')
        .select(`*, extras(*)`)
        .order('name');

      if (selectedCategory !== 'all') {
        query = query.eq('category_id', selectedCategory);
      }

      const { data, error } = await query;
      if (error) throw error;

      setItems(data || []);
    } catch (error) {
      console.error('Error fetching items:', error);
    } finally {
      setLoading(false);
    }
  };

  const openCreateDialog = () => {
    setEditingItem(null);
    setFormData({ ...defaultItem, category_id: selectedCategory !== 'all' ? selectedCategory : null });
    setDialogOpen(true);
  };

  const openEditDialog = (item: Item) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      description: item.description || '',
      price: item.price,
      category_id: item.category_id,
      allow_extras: item.allow_extras,
      allow_quantity: item.allow_quantity,
      allow_tapioca_molhada: item.allow_tapioca_molhada,
      available: item.available,
      extras: item.extras || [],
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast({ title: "Nome é obrigatório", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const itemData = {
        name: formData.name.trim(),
        description: formData.description?.trim() || null,
        price: Number(formData.price) || 0,
        category_id: formData.category_id || null,
        allow_extras: formData.allow_extras,
        allow_quantity: formData.allow_quantity,
        allow_tapioca_molhada: formData.allow_tapioca_molhada,
        available: formData.available,
      };

      let itemId: string;

      if (editingItem) {
        const { error } = await supabase
          .from('items')
          .update(itemData)
          .eq('id', editingItem.id);
        if (error) throw error;
        itemId = editingItem.id;

        // Delete existing extras
        await supabase.from('extras').delete().eq('item_id', itemId);
      } else {
        const { data, error } = await supabase
          .from('items')
          .insert(itemData)
          .select()
          .single();
        if (error) throw error;
        itemId = data.id;
      }

      // Insert extras
      if (formData.extras && formData.extras.length > 0) {
        const extrasToInsert = formData.extras.map(e => ({
          item_id: itemId,
          name: e.name,
          price: Number(e.price) || 0,
        }));
        await supabase.from('extras').insert(extrasToInsert);
      }

      toast({ title: editingItem ? "Item atualizado!" : "Item criado!" });
      setDialogOpen(false);
      fetchItems();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: Item) => {
    if (!confirm(`Excluir "${item.name}"?`)) return;

    try {
      const { error } = await supabase
        .from('items')
        .delete()
        .eq('id', item.id);
      if (error) throw error;

      toast({ title: "Item excluído!" });
      fetchItems();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  };

  const toggleAvailable = async (item: Item) => {
    try {
      const { error } = await supabase
        .from('items')
        .update({ available: !item.available })
        .eq('id', item.id);
      if (error) throw error;
      fetchItems();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  };

  const addExtra = () => {
    if (!newExtra.name.trim()) return;
    setFormData({
      ...formData,
      extras: [...(formData.extras || []), { ...newExtra }],
    });
    setNewExtra({ name: '', price: 0 });
  };

  const removeExtra = (index: number) => {
    setFormData({
      ...formData,
      extras: formData.extras?.filter((_, i) => i !== index),
    });
  };

  const getCategoryName = (categoryId: string | null) => {
    return categories.find(c => c.id === categoryId)?.name || '-';
  };

  return (
    <AdminLayout title="Itens do Cardápio" subtitle="Gerencie os itens disponíveis">
      <div className="flex flex-col sm:flex-row justify-between gap-4 mb-4">
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Todas categorias" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas categorias</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={openCreateDialog} className="gap-2">
          <Plus className="h-4 w-4" />
          Adicionar Item
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead className="text-right">Preço</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    Nenhum item encontrado
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{item.name}</p>
                        {item.description && (
                          <p className="text-sm text-muted-foreground truncate max-w-xs">
                            {item.description}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{getCategoryName(item.category_id)}</TableCell>
                    <TableCell className="text-right">
                      R$ {Number(item.price).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={item.available}
                        onCheckedChange={() => toggleAvailable(item)}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => openEditDialog(item)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(item)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Editar Item" : "Novo Item"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-2">
                <Label>Nome</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Tapioca de Frango"
                />
              </div>
              <div className="col-span-2 space-y-2">
                <Label>Descrição</Label>
                <Textarea
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descrição do item"
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select
                  value={formData.category_id || 'none'}
                  onValueChange={(v) => setFormData({ ...formData, category_id: v === 'none' ? null : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem categoria</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Preço (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label>Opções</Label>
              <div className="flex items-center justify-between">
                <span className="text-sm">Permitir adicionais</span>
                <Switch
                  checked={formData.allow_extras}
                  onCheckedChange={(v) => setFormData({ ...formData, allow_extras: v })}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Permitir quantidade</span>
                <Switch
                  checked={formData.allow_quantity}
                  onCheckedChange={(v) => setFormData({ ...formData, allow_quantity: v })}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Opção tapioca molhada (+R$ 1,00)</span>
                <Switch
                  checked={formData.allow_tapioca_molhada}
                  onCheckedChange={(v) => setFormData({ ...formData, allow_tapioca_molhada: v })}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Disponível para venda</span>
                <Switch
                  checked={formData.available}
                  onCheckedChange={(v) => setFormData({ ...formData, available: v })}
                />
              </div>
            </div>

            {formData.allow_extras && (
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm">Extras do Item</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {formData.extras?.map((extra, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Badge variant="secondary" className="flex-1 justify-between">
                        {extra.name} - R$ {Number(extra.price).toFixed(2)}
                        <X
                          className="h-3 w-3 ml-2 cursor-pointer"
                          onClick={() => removeExtra(index)}
                        />
                      </Badge>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <Input
                      placeholder="Nome do extra"
                      value={newExtra.name}
                      onChange={(e) => setNewExtra({ ...newExtra, name: e.target.value })}
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="Preço"
                      value={newExtra.price || ''}
                      onChange={(e) => setNewExtra({ ...newExtra, price: Number(e.target.value) })}
                      className="w-24"
                    />
                    <Button type="button" variant="outline" onClick={addExtra}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default Items;
