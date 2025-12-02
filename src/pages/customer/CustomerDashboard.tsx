import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChefHat, MessageCircle, User, LogOut, Clock, MapPin } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function CustomerDashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  // WhatsApp number - pode ser configurado depois
  const whatsappNumber = "5588999999999";
  const whatsappMessage = encodeURIComponent("Olá! Gostaria de fazer um pedido.");
  const whatsappLink = `https://wa.me/${whatsappNumber}?text=${whatsappMessage}`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-accent/20 to-background">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-primary">
              <ChefHat className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-semibold text-lg">Sabor de Mãe</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground hidden sm:block">
              {user?.email}
            </span>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sair
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Welcome */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Olá! 👋
          </h1>
          <p className="text-muted-foreground">
            Bem-vindo(a) ao Sabor de Mãe. Faça seu pedido pelo WhatsApp!
          </p>
        </div>

        {/* Quick Actions */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Order via WhatsApp */}
          <Card className="border-primary/20 hover:border-primary/40 transition-colors">
            <CardHeader>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-500/10 text-green-600 mb-2">
                <MessageCircle className="h-6 w-6" />
              </div>
              <CardTitle>Fazer Pedido</CardTitle>
              <CardDescription>
                Envie seu pedido pelo WhatsApp e receba em casa ou retire no local
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                className="w-full bg-green-600 hover:bg-green-700" 
                asChild
              >
                <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Abrir WhatsApp
                </a>
              </Button>
            </CardContent>
          </Card>

          {/* Operating Hours */}
          <Card>
            <CardHeader>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary mb-2">
                <Clock className="h-6 w-6" />
              </div>
              <CardTitle>Horário de Funcionamento</CardTitle>
              <CardDescription>
                Confira nossos horários de atendimento
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Segunda a Sábado</span>
                <span className="font-medium">07:00 - 14:00</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Domingo</span>
                <span className="font-medium text-destructive">Fechado</span>
              </div>
            </CardContent>
          </Card>

          {/* Location */}
          <Card>
            <CardHeader>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 mb-2">
                <MapPin className="h-6 w-6" />
              </div>
              <CardTitle>Localização</CardTitle>
              <CardDescription>
                Juazeiro do Norte - CE
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Entregamos em diversos bairros da cidade. Consulte a taxa de entrega pelo WhatsApp.
              </p>
            </CardContent>
          </Card>

          {/* Profile */}
          <Card>
            <CardHeader>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground mb-2">
                <User className="h-6 w-6" />
              </div>
              <CardTitle>Minha Conta</CardTitle>
              <CardDescription>
                {user?.email}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Em breve você poderá ver seu histórico de pedidos aqui.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Info */}
        <p className="mt-12 text-center text-xs text-muted-foreground">
          Sabor de Mãe • Juazeiro do Norte - CE
        </p>
      </main>
    </div>
  );
}
