import { useNavigate } from "react-router-dom";
import { ChefHat, ArrowRight, LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

const Index = () => {
  const navigate = useNavigate();
  const { user, role, loading, signOut, isAdmin, isStaff } = useAuth();

  const handleSignOut = async () => {
    await signOut();
  };

  const handleAccessSystem = () => {
    if (!user) {
      navigate("/login");
      return;
    }
    
    // User is logged in, redirect based on role
    if (isAdmin) {
      navigate("/admin");
    } else if (isStaff) {
      navigate("/kitchen");
    } else {
      // Customer - for now just show they're logged in
      navigate("/login");
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-background via-accent/20 to-background p-4">
      <div className="text-center animate-fade-in">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <div className="flex h-24 w-24 items-center justify-center rounded-3xl gradient-primary shadow-lg">
            <ChefHat className="h-12 w-12 text-primary-foreground" />
          </div>
        </div>

        {/* Title */}
        <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-3">
          Sabor de Mãe
        </h1>
        <p className="text-lg text-muted-foreground mb-8 max-w-md mx-auto">
          Sistema de gestão para lanchonete
        </p>

        {/* User Status */}
        {user && !loading && (
          <div className="mb-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <User className="h-4 w-4" />
            <span>Logado como: <strong>{user.email}</strong></span>
            <span className="px-2 py-0.5 bg-primary/10 text-primary rounded-full text-xs font-medium">
              {role || 'carregando...'}
            </span>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          {!user ? (
            // Not logged in - show login button
            <Button 
              size="lg" 
              onClick={() => navigate("/login")}
              className="gap-2"
            >
              Acessar Sistema
              <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            // Logged in - show appropriate options based on role
            <>
              {isAdmin && (
                <Button 
                  size="lg" 
                  onClick={() => navigate("/admin")}
                  className="gap-2"
                >
                  Painel Admin
                  <ArrowRight className="h-4 w-4" />
                </Button>
              )}
              {isStaff && (
                <Button 
                  size="lg" 
                  variant={isAdmin ? "outline" : "default"}
                  onClick={() => navigate("/kitchen")}
                  className="gap-2"
                >
                  Cozinha
                  <ArrowRight className="h-4 w-4" />
                </Button>
              )}
              {!isAdmin && !isStaff && (
                <Button 
                  size="lg" 
                  onClick={() => navigate("/customer")}
                  className="gap-2"
                >
                  Minha Área
                  <ArrowRight className="h-4 w-4" />
                </Button>
              )}
              <Button 
                size="lg" 
                variant="outline"
                onClick={handleSignOut}
                className="gap-2"
              >
                <LogOut className="h-4 w-4" />
                Sair
              </Button>
            </>
          )}
        </div>

        {/* Info */}
        <p className="mt-8 text-xs text-muted-foreground">
          MVP em desenvolvimento • Versão 0.1.0
        </p>
      </div>
    </div>
  );
};

export default Index;
