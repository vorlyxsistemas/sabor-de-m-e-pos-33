import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Pencil, Trash2, DollarSign, Tag } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Extra {
  id: string;
  code: string;
  name: string;
  price: number;
  applies_to_category: string | null;
  created_at: string;
}

interface Category {
  id: string;
  name: string;
}

const Extras = () => {
  const { toast } = useToast();
  const [extras, setExtras] = useState<Extra[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingExtra, setEditingExtra] = useState<Extra | null>(null);
  
  // Form state
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [price, setPrice] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  useEffect(() => {
    fetchExtras();
    fetchCategories();
  }, []);

  const fetchExtras = async () => {
    const { data, error } = await supabase
      .from("global_extras")
      .select("*")
      .order("name");
    
    if (error) {
      toast({ title: "Erro ao carregar extras", variant: "destructive" });
    } else {
      setExtras(data || []);
    }
    setLoading(false);
  };

  const fetchCategories = async () => {
    const { data } = await supabase.from("categories").select("*").order("name");
    setCategories(data || []);
  };

  const resetForm = () => {
    setName("");
    setCode("");
    setPrice("");
    setSelectedCategory("all");
    setEditingExtra(null);
  };

  const openEditDialog = (extra: Extra) => {
    setEditingExtra(extra);
    setName(extra.name);
    setCode(extra.code);
    setPrice(extra.price.toString());
    setSelectedCategory(extra.applies_to_category || "all");
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim() || !code.trim() || !price) {
      toast({ title: "Preencha todos os campos", variant: "destructive" });
      return;
    }

    const extraData = {
      name: name.trim(),
      code: code.trim().toLowerCase().replace(/\s+/g, "_"),
      price: parseFloat(price),
      applies_to_category: selectedCategory === "all" ? null : selectedCategory,
    };

    if (editingExtra) {
      // Update
      const { error } = await supabase
        .from("global_extras")
        .update(extraData)
        .eq("id", editingExtra.id);
      
      if (error) {
        toast({ title: "Erro ao atualizar", variant: "destructive" });
      } else {
        toast({ title: "Extra atualizado!" });
        fetchExtras();
        setDialogOpen(false);
        resetForm();
      }
    } else {
      // Create
      const { error } = await supabase
        .from("global_extras")
        .insert(extraData);
      
      if (error) {
        toast({ title: "Erro ao criar extra", variant: "destructive" });
      } else {
        toast({ title: "Extra criado!" });
        fetchExtras();
        setDialogOpen(false);
        resetForm();
      }
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("global_extras").delete().eq("id", id);
    
    if (error) {
      toast({ title: "Erro ao deletar", variant: "destructive" });
    } else {
      toast({ title: "Extra removido!" });
      fetchExtras();
    }
  };

  if (loading) {
    return (
      <AdminLayout title="Extras" subtitle="Gerenciar extras do cardápio">
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Extras" subtitle="Gerenciar extras do cardápio (carne moída, ovo, queijo, etc.)">
      <div className="space-y-6">
        {/* Add Button */}
        <div className="flex justify-end">
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" /> Adicionar Extra
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingExtra ? "Editar Extra" : "Novo Extra"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label>Nome *</Label>
                  <Input 
                    value={name} 
                    onChange={(e) => setName(e.target.value)} 
                    placeholder="Ex: Carne moída"
                  />
                </div>
                <div>
                  <Label>Código *</Label>
                  <Input 
                    value={code} 
                    onChange={(e) => setCode(e.target.value)} 
                    placeholder="Ex: carne_moida"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Identificador único usado internamente
                  </p>
                </div>
                <div>
                  <Label>Preço (R$) *</Label>
                  <Input 
                    type="number" 
                    step="0.01"
                    value={price} 
                    onChange={(e) => setPrice(e.target.value)} 
                    placeholder="Ex: 4.00"
                  />
                </div>
                <div>
                  <Label>Aplica-se a qual categoria?</Label>
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as categorias</SelectItem>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.name}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Se "Todas", aparecerá em itens que permitem extras
                  </p>
                </div>
                <Button onClick={handleSave} className="w-full">
                  {editingExtra ? "Salvar Alterações" : "Criar Extra"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Extras List */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {extras.length === 0 ? (
            <Card className="col-span-full">
              <CardContent className="py-12 text-center">
                <Tag className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Nenhum extra cadastrado</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Clique em "Adicionar Extra" para começar
                </p>
              </CardContent>
            </Card>
          ) : (
            extras.map((extra) => (
              <Card key={extra.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base">{extra.name}</CardTitle>
                      <p className="text-xs text-muted-foreground">{extra.code}</p>
                    </div>
                    <Badge variant="secondary" className="flex items-center gap-1">
                      <DollarSign className="h-3 w-3" />
                      R$ {Number(extra.price).toFixed(2)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <Badge variant="outline">
                      {extra.applies_to_category || "Todas categorias"}
                    </Badge>
                    <div className="flex gap-1">
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        onClick={() => openEditDialog(extra)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="icon" variant="ghost" className="text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remover extra?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta ação não pode ser desfeita. O extra "{extra.name}" será removido permanentemente.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(extra.id)}>
                              Remover
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Info Card */}
        <Card className="bg-muted/50">
          <CardContent className="py-4">
            <h4 className="font-medium mb-2">Como funcionam os extras?</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Extras aparecem apenas em itens que permitem extras (tapiocas, cuscuz, lanches)</li>
              <li>• Bebidas e porções <strong>NÃO</strong> mostram extras</li>
              <li>• Você pode definir para qual categoria específica o extra se aplica</li>
              <li>• Extras com "Todas categorias" aparecem em todos os itens que permitem extras</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default Extras;
