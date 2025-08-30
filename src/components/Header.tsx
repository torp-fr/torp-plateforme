import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import torpLogo from "@/assets/torp-logo-red.png";

export const Header = () => {
  return (
    <header className="w-full bg-background border-b border-border shadow-soft">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src={torpLogo} alt="TORP - Analyse de devis BTP" className="h-12 w-auto" />
          <div>
            <h1 className="text-2xl font-bold text-primary">TORP</h1>
            <p className="text-xs text-muted-foreground hidden md:block">Transparence • Qualité • Confiance</p>
          </div>
        </div>
        <nav className="hidden md:flex items-center gap-6">
          <a href="#analyse" className="text-foreground hover:text-primary transition-colors">
            Analyse
          </a>
          <a href="#dashboard" className="text-foreground hover:text-primary transition-colors">
            Dashboard
          </a>
          <a href="#projets" className="text-foreground hover:text-primary transition-colors">
            Projets
          </a>
          <a href="#tarifs" className="text-foreground hover:text-primary transition-colors">
            Tarifs
          </a>
        </nav>
        <div className="flex items-center gap-3">
          <Link to="/login">
            <Button variant="outline" size="sm">
              Connexion
            </Button>
          </Link>
          <Link to="/analyze">
            <Button variant="hero" size="sm">
              Analyser un devis
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
};