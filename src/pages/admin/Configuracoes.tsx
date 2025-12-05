import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { 
  Store, 
  Clock, 
  MapPin, 
  MessageSquare, 
  Printer,
  Bell,
  Loader2,
  Power,
  PowerOff
} from "lucide-react";

interface Settings {
  id: string;
  auto_print_enabled: boolean;
  whatsapp_enabled: boolean;
  webhook_n8n_url: string | null;
  is_open: boolean;
}

const Configuracoes = () => {
  const { toast } = useToast();
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [autoPrintEnabled, setAutoPrintEnabled] = useState(false);
  const [whatsappEnabled, setWhatsappEnabled] = useState(false);
  const [webhookN8nUrl, setWebhookN8nUrl] = useState("");
  const [testPhoneNumber, setTestPhoneNumber] = useState("5588988803368");
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [savingPrint, setSavingPrint] = useState(false);
  const [savingWhatsapp, setSavingWhatsapp] = useState(false);
  const [testingWebhook, setTestingWebhook] = useState(false);
  const [testingWhatsapp, setTestingWhatsapp] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [togglingOpen, setTogglingOpen] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      // Direct query to settings table using any to bypass type checking
      // since settings table may not be in generated types yet
      const { data, error } = await (supabase as any)
        .from("settings")
        .select("*")
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSettingsId(data.id);
        setAutoPrintEnabled(data.auto_print_enabled || false);
        setWhatsappEnabled(data.whatsapp_enabled || false);
        setWebhookN8nUrl(data.webhook_n8n_url || "");
        setIsOpen(data.is_open ?? false);
      } else {
        // Create default settings if none exist
        const { data: newSettings, error: insertError } = await (supabase as any)
          .from("settings")
          .insert({
            auto_print_enabled: false,
            whatsapp_enabled: false,
            webhook_n8n_url: null,
            is_open: false
          })
          .select()
          .single();

        if (insertError) throw insertError;
        if (newSettings) {
          setSettingsId(newSettings.id);
        }
      }
    } catch (error: any) {
      console.error("Erro ao carregar configurações:", error);
      toast({
        title: "Erro ao carregar configurações",
        description: error.message || "Tente novamente",
        variant: "destructive",
      });
    } finally {
      setLoadingSettings(false);
    }
  };

  const updateSettings = async (updates: Partial<Settings>) => {
    if (!settingsId) {
      toast({
        title: "Erro",
        description: "Configurações não encontradas",
        variant: "destructive",
      });
      return false;
    }

    const { error } = await (supabase as any)
      .from("settings")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", settingsId);

    if (error) {
      console.error("Erro ao atualizar configurações:", error);
      throw error;
    }

    return true;
  };

  const handleAutoPrintToggle = async (enabled: boolean) => {
    setSavingPrint(true);
    try {
      await updateSettings({ auto_print_enabled: enabled });
      setAutoPrintEnabled(enabled);
      toast({
        title: enabled ? "Impressão automática ativada" : "Impressão automática desativada",
        description: enabled 
          ? "Comandas serão impressas automaticamente ao enviar para a cozinha"
          : "Use o botão 'Imprimir Comanda' para imprimir manualmente",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao salvar",
        description: error.message || "Tente novamente",
        variant: "destructive",
      });
    } finally {
      setSavingPrint(false);
    }
  };

  const handleWhatsappToggle = async (enabled: boolean) => {
    setSavingWhatsapp(true);
    try {
      await updateSettings({ whatsapp_enabled: enabled });
      setWhatsappEnabled(enabled);
      toast({
        title: enabled ? "WhatsApp ativado" : "WhatsApp desativado",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao salvar",
        description: error.message || "Tente novamente",
        variant: "destructive",
      });
    } finally {
      setSavingWhatsapp(false);
    }
  };

  const handleSaveWebhook = async () => {
    setSavingWhatsapp(true);
    try {
      await updateSettings({ webhook_n8n_url: webhookN8nUrl });
      toast({
        title: "Webhook salvo",
        description: "URL do N8N atualizada com sucesso",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao salvar",
        description: error.message || "Tente novamente",
        variant: "destructive",
      });
    } finally {
      setSavingWhatsapp(false);
    }
  };

  const handleTestWhatsapp = async () => {
    // Validação do número de telefone
    const cleanPhone = testPhoneNumber.replace(/\D/g, '');
    if (!cleanPhone || cleanPhone.length < 10) {
      toast({
        title: "Número inválido",
        description: "Digite um número de telefone válido com DDD (ex: 5588999999999)",
        variant: "destructive",
      });
      return;
    }

    setTestingWhatsapp(true);
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-enviar", {
        body: { 
          to: cleanPhone, 
          text: "✅ Teste de conexão - Sabor de Mãe 🍴\n\nSe você recebeu esta mensagem, a integração está funcionando!",
          type: "text"
        }
      });
      
      if (error) throw error;
      
      console.log("WhatsApp test response:", data);
      
      toast({
        title: "Mensagem enviada!",
        description: `Enviado para ${cleanPhone}. Verifique o WhatsApp.`,
      });
    } catch (error: any) {
      console.error("WhatsApp test error:", error);
      toast({
        title: "Erro ao enviar",
        description: error.message || "Verifique se a Edge Function whatsapp-enviar está implantada",
        variant: "destructive",
      });
    } finally {
      setTestingWhatsapp(false);
    }
  };

  const handleTestWebhook = async () => {
    setTestingWebhook(true);
    try {
      const response = await fetch(webhookN8nUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: '5588000000000',
          message: 'Teste de conexão',
          type: 'test',
          timestamp: new Date().toISOString()
        })
      });
      if (response.ok) {
        toast({
          title: "Conexão OK!",
          description: "N8N respondeu corretamente",
        });
      } else {
        throw new Error(`Status: ${response.status}`);
      }
    } catch (error: any) {
      toast({
        title: "Erro na conexão",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setTestingWebhook(false);
    }
  };

  const handleToggleOpen = async () => {
    setTogglingOpen(true);
    try {
      const newIsOpen = !isOpen;
      await updateSettings({ is_open: newIsOpen } as any);
      setIsOpen(newIsOpen);
      toast({
        title: newIsOpen ? "🟢 Lanchonete ABERTA" : "🔴 Lanchonete FECHADA",
        description: newIsOpen 
          ? "Clientes podem fazer pedidos agora"
          : "Pedidos bloqueados até você abrir novamente",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao alterar status",
        description: error.message || "Tente novamente",
        variant: "destructive",
      });
    } finally {
      setTogglingOpen(false);
    }
  };

  return (
    <AdminLayout title="Configurações" subtitle="Configurações do sistema">
      <PageHeader
        title="Configurações"
        description="Configure os parâmetros do sistema"
      />

      {/* Status da Lanchonete - Card Destacado */}
      <Card className={`mb-6 border-2 ${isOpen ? 'border-green-500 bg-green-50 dark:bg-green-950/20' : 'border-red-500 bg-red-50 dark:bg-red-950/20'}`}>
        <CardContent className="py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-full ${isOpen ? 'bg-green-500' : 'bg-red-500'}`}>
                {isOpen ? (
                  <Power className="h-8 w-8 text-white" />
                ) : (
                  <PowerOff className="h-8 w-8 text-white" />
                )}
              </div>
              <div>
                <h2 className={`text-2xl font-bold ${isOpen ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                  {isOpen ? "Lanchonete ABERTA" : "Lanchonete FECHADA"}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {isOpen 
                    ? "Clientes podem fazer pedidos pelo WhatsApp e sistema"
                    : "Pedidos estão bloqueados - Sofia informará que está fechado"
                  }
                </p>
              </div>
            </div>
            <Button 
              size="lg"
              variant={isOpen ? "destructive" : "default"}
              onClick={handleToggleOpen}
              disabled={togglingOpen || loadingSettings}
              className="min-w-[160px]"
            >
              {togglingOpen ? (
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
              ) : isOpen ? (
                <PowerOff className="h-5 w-5 mr-2" />
              ) : (
                <Power className="h-5 w-5 mr-2" />
              )}
              {isOpen ? "FECHAR" : "ABRIR"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Dados da Loja */}
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Store className="h-5 w-5 text-primary" />
              Dados da Loja
            </CardTitle>
            <CardDescription>Informações básicas da lanchonete</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Nome da Loja</Label>
              <Input defaultValue="Sabor de Mãe" />
            </div>
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input placeholder="(00) 00000-0000" />
            </div>
            <div className="space-y-2">
              <Label>CNPJ</Label>
              <Input placeholder="00.000.000/0000-00" />
            </div>
            <Button>Salvar</Button>
          </CardContent>
        </Card>

        {/* Horários */}
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Horários de Funcionamento
            </CardTitle>
            <CardDescription>Configure os horários de atendimento</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm">Segunda a Sexta</span>
              <div className="flex gap-2">
                <Input className="w-20" placeholder="07:00" />
                <span className="self-center">até</span>
                <Input className="w-20" placeholder="14:00" />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Sábado</span>
              <div className="flex gap-2">
                <Input className="w-20" placeholder="07:00" />
                <span className="self-center">até</span>
                <Input className="w-20" placeholder="14:00" />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Domingo</span>
              <div className="flex gap-2 items-center">
                <span className="text-sm text-muted-foreground">Fechado</span>
              </div>
            </div>
            <Button>Salvar</Button>
          </CardContent>
        </Card>

        {/* Taxa de Entrega */}
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              Taxa de Entrega
            </CardTitle>
            <CardDescription>Configure as taxas por bairro</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Configure os bairros e taxas de entrega na página de configurações avançadas.
            </p>
            <Button variant="outline">Gerenciar Bairros</Button>
          </CardContent>
        </Card>

        {/* Integrações WhatsApp */}
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              WhatsApp (Evolution API)
            </CardTitle>
            <CardDescription>Integração com WhatsApp para receber e enviar mensagens</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Ativar WhatsApp</p>
                <p className="text-xs text-muted-foreground">Receber mensagens de clientes</p>
              </div>
              {loadingSettings ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Switch 
                  checked={whatsappEnabled} 
                  onCheckedChange={handleWhatsappToggle}
                  disabled={savingWhatsapp}
                />
              )}
            </div>
            
            <div className="space-y-2">
              <Label>URL do Webhook de Entrada (Evolution API)</Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 p-2 bg-muted rounded text-xs font-mono break-all select-all">
                  https://napgcbrouifczxblteuw.supabase.co/functions/v1/whatsapp-recebido
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText("https://napgcbrouifczxblteuw.supabase.co/functions/v1/whatsapp-recebido");
                    toast({ title: "Copiado!", description: "URL do webhook copiada" });
                  }}
                >
                  Copiar
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Configure esta URL no painel da Evolution API → Configurações → Webhook → Events: messages.upsert
              </p>
            </div>

            <div className="space-y-2">
              <Label>Número para Teste</Label>
              <Input 
                placeholder="5588999999999"
                value={testPhoneNumber}
                onChange={(e) => setTestPhoneNumber(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Número com código do país + DDD (ex: 5588999999999)
              </p>
            </div>

            <Button 
              variant="outline" 
              size="sm"
              disabled={testingWhatsapp || !testPhoneNumber}
              onClick={handleTestWhatsapp}
            >
              {testingWhatsapp ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Enviar Mensagem de Teste
            </Button>
          </CardContent>
        </Card>

        {/* Webhook N8N */}
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              Agente Sofia (N8N)
            </CardTitle>
            <CardDescription>Configure o webhook do agente de IA para processar mensagens</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>URL do Webhook N8N</Label>
              <Input 
                placeholder="https://seu-n8n.com/webhook/xxx"
                value={webhookN8nUrl}
                onChange={(e) => setWebhookN8nUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                URL do webhook N8N que receberá as mensagens do WhatsApp
              </p>
            </div>

            <div className="p-3 bg-muted rounded-lg space-y-2">
              <p className="text-sm font-medium">Payload recebido pelo N8N:</p>
              <pre className="text-xs font-mono text-muted-foreground overflow-x-auto">
{`{
  "phone": "5588999999999",
  "message": "texto da mensagem",
  "type": "text",
  "client_id": "uuid-do-cliente",
  "client_name": "Nome do Cliente",
  "timestamp": "2025-12-03T12:00:00Z"
}`}
              </pre>
              <p className="text-xs text-muted-foreground">
                Configure um trigger "Webhook" no N8N para receber esses dados e processar com a Sofia.
              </p>
            </div>
            
            <div className="flex gap-2">
              <Button 
                onClick={handleSaveWebhook}
                disabled={savingWhatsapp}
              >
                {savingWhatsapp ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Salvar
              </Button>
              
              <Button 
                variant="outline"
                disabled={!webhookN8nUrl || testingWebhook}
                onClick={handleTestWebhook}
              >
                {testingWebhook ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Testar Conexão
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Impressora */}
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Printer className="h-5 w-5 text-primary" />
              Impressora de Comandas
            </CardTitle>
            <CardDescription>Configure a impressora térmica Elgin I9</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Impressão Automática</p>
                <p className="text-xs text-muted-foreground">
                  Imprimir comanda ao enviar pedido para a cozinha
                </p>
              </div>
              {loadingSettings ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Switch 
                  checked={autoPrintEnabled} 
                  onCheckedChange={handleAutoPrintToggle}
                  disabled={savingPrint}
                />
              )}
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground">
                <strong>Nota:</strong> Para impressão direta na Elgin I9 via ESC/POS, 
                é necessário um servidor de impressão local. A impressão atual usa o 
                diálogo de impressão do navegador.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Notificações */}
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              Notificações
            </CardTitle>
            <CardDescription>Configure alertas do sistema</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Novos pedidos</p>
                <p className="text-xs text-muted-foreground">Som ao receber pedido</p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Pedidos atrasados</p>
                <p className="text-xs text-muted-foreground">Alerta após 15 minutos</p>
              </div>
              <Switch defaultChecked />
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default Configuracoes;
