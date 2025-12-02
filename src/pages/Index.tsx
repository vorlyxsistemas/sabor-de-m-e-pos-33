import { useNavigate } from "react-router-dom";
import { ChefHat, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const Index = () => {
  const navigate = useNavigate();

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

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button 
            size="lg" 
            onClick={() => navigate("/login")}
            className="gap-2"
          >
            Acessar Sistema
            <ArrowRight className="h-4 w-4" />
          </Button>
          <Button 
            size="lg" 
            variant="outline"
            onClick={() => navigate("/admin")}
          >
            Demo Admin
          </Button>
          <Button 
            size="lg" 
            variant="outline"
            onClick={() => navigate("/staff")}
          >
            Demo Cozinha
          </Button>
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
