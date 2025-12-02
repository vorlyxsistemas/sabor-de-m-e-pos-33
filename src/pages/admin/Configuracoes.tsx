import { AdminLayout } from "@/components/layout/AdminLayout";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { 
  Store, 
  Clock, 
  MapPin, 
  MessageSquare, 
  Printer,
  Bell
} from "lucide-react";

const Configuracoes = () => {
  return (
    <AdminLayout title="Configurações" subtitle="Configurações do sistema">
      <PageHeader
        title="Configurações"
        description="Configure os parâmetros do sistema"
      />

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
                <Input className="w-20" placeholder="11:00" />
                <span className="self-center">até</span>
                <Input className="w-20" placeholder="22:00" />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Sábado</span>
              <div className="flex gap-2">
                <Input className="w-20" placeholder="11:00" />
                <span className="self-center">até</span>
                <Input className="w-20" placeholder="23:00" />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Domingo</span>
              <div className="flex gap-2">
                <Input className="w-20" placeholder="11:00" />
                <span className="self-center">até</span>
                <Input className="w-20" placeholder="20:00" />
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

        {/* Integrações */}
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              Integrações
            </CardTitle>
            <CardDescription>WhatsApp e outros serviços</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">WhatsApp</p>
                <p className="text-xs text-muted-foreground">Evolution API</p>
              </div>
              <Switch disabled />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Agente Sofia (IA)</p>
                <p className="text-xs text-muted-foreground">N8N + Lovable</p>
              </div>
              <Switch disabled />
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
            <CardDescription>Configure a impressora térmica</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              A configuração de impressora será habilitada após integração com o sistema.
            </p>
            <Button variant="outline" disabled>Configurar Impressora</Button>
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
