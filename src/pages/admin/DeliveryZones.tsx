import { useState, useEffect, useRef } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Loader2, Upload } from "lucide-react";

interface DeliveryZone {
  id: string;
  bairro: string;
  dist_km: number | null;
  taxa: number;
}

const DeliveryZones = () => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<DeliveryZone | null>(null);
  const [formData, setFormData] = useState({ bairro: '', dist_km: 0, taxa: 0 });

  useEffect(() => {
    fetchZones();
  }, []);

  const fetchZones = async () => {
    try {
      const { data, error } = await supabase
        .from('delivery_zones')
        .select('*')
        .order('bairro');

      if (error) throw error;
      setZones(data || []);
    } catch (error) {
      console.error('Error fetching zones:', error);
    } finally {
      setLoading(false);
    }
  };

  const openCreateDialog = () => {
    setEditingZone(null);
    setFormData({ bairro: '', dist_km: 0, taxa: 0 });
    setDialogOpen(true);
  };

  const openEditDialog = (zone: DeliveryZone) => {
    setEditingZone(zone);
    setFormData({
      bairro: zone.bairro,
      dist_km: zone.dist_km || 0,
      taxa: zone.taxa,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.bairro.trim()) {
      toast({ title: "Nome do bairro é obrigatório", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const zoneData = {
        bairro: formData.bairro.trim(),
        dist_km: Number(formData.dist_km) || null,
        taxa: Number(formData.taxa) || 0,
      };

      if (editingZone) {
        const { error } = await supabase
          .from('delivery_zones')
          .update(zoneData)
          .eq('id', editingZone.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('delivery_zones')
          .insert(zoneData);
        if (error) throw error;
      }

      toast({ title: editingZone ? "Bairro atualizado!" : "Bairro adicionado!" });
      setDialogOpen(false);
      fetchZones();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (zone: DeliveryZone) => {
    if (!confirm(`Excluir "${zone.bairro}"?`)) return;

    try {
      const { error } = await supabase
        .from('delivery_zones')
        .delete()
        .eq('id', zone.id);
      if (error) throw error;

      toast({ title: "Bairro excluído!" });
      fetchZones();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  };

  const handleImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      const header = lines[0].toLowerCase();
      
      if (!header.includes('bairro')) {
        toast({ title: "CSV inválido", description: "O arquivo deve ter uma coluna 'bairro'", variant: "destructive" });
        return;
      }

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      const bairroIndex = headers.indexOf('bairro');
      const distIndex = headers.findIndex(h => h.includes('dist') || h.includes('km'));
      const taxaIndex = headers.findIndex(h => h.includes('taxa') || h.includes('preco') || h.includes('valor'));

      const entries = [];
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        if (values[bairroIndex]) {
          entries.push({
            bairro: values[bairroIndex],
            dist_km: distIndex >= 0 ? Number(values[distIndex]) || null : null,
            taxa: taxaIndex >= 0 ? Number(values[taxaIndex]) || 0 : 0,
          });
        }
      }

      if (entries.length === 0) {
        toast({ title: "Nenhum bairro encontrado no CSV", variant: "destructive" });
        return;
      }

      const { error } = await supabase.from('delivery_zones').insert(entries);
      if (error) throw error;

      toast({ title: `${entries.length} bairros importados!` });
      fetchZones();
    } catch (error: any) {
      toast({ title: "Erro ao importar", description: error.message, variant: "destructive" });
    }

    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <AdminLayout title="Taxas de Entrega" subtitle="Gerencie os bairros e taxas de entrega">
      <div className="flex flex-col sm:flex-row justify-end gap-2 mb-4">
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleImportCSV}
          className="hidden"
        />
        <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="gap-2">
          <Upload className="h-4 w-4" />
          Importar CSV
        </Button>
        <Button onClick={openCreateDialog} className="gap-2">
          <Plus className="h-4 w-4" />
          Novo Bairro
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
                <TableHead>Bairro</TableHead>
                <TableHead className="text-center">Distância (km)</TableHead>
                <TableHead className="text-right">Taxa (R$)</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {zones.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    Nenhum bairro cadastrado
                  </TableCell>
                </TableRow>
              ) : (
                zones.map((zone) => (
                  <TableRow key={zone.id}>
                    <TableCell className="font-medium">{zone.bairro}</TableCell>
                    <TableCell className="text-center">
                      {zone.dist_km ? `${zone.dist_km} km` : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      R$ {Number(zone.taxa).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => openEditDialog(zone)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(zone)}
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingZone ? "Editar Bairro" : "Novo Bairro"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Bairro</Label>
              <Input
                value={formData.bairro}
                onChange={(e) => setFormData({ ...formData, bairro: e.target.value })}
                placeholder="Nome do bairro"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Distância (km)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={formData.dist_km || ''}
                  onChange={(e) => setFormData({ ...formData, dist_km: Number(e.target.value) })}
                  placeholder="Ex: 5.5"
                />
              </div>
              <div className="space-y-2">
                <Label>Taxa (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.taxa || ''}
                  onChange={(e) => setFormData({ ...formData, taxa: Number(e.target.value) })}
                  placeholder="Ex: 8.00"
                />
              </div>
            </div>
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

export default DeliveryZones;
