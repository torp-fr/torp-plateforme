import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useApp } from "@/context/AppContext";
import torpLogo from "@/assets/torp-logo-red.png";

export const Header = () => {
  const { userType, setUserType } = useApp();

  return (
    <header className="w-full bg-background border-b border-border shadow-soft">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/">
            <img src={torpLogo} alt="TORP - Analyse de devis BTP" className="h-12 w-auto hover:opacity-80 transition-opacity" />
          </Link>
          <div>
            <Link to="/">
              <h1 className="text-2xl font-bold text-primary hover:opacity-80 transition-opacity">TORP</h1>
            </Link>
            <p className="text-xs text-muted-foreground hidden md:block">Transparence • Qualité • Confiance</p>
          </div>
        </div>
        <nav className="hidden md:flex items-center gap-6">
          {userType === 'admin' ? (
            <>
              <Link to="/admin-dashboard" className="text-foreground hover:text-primary transition-colors">
                Analytics
              </Link>
              <Link to="/dashboard" className="text-foreground hover:text-primary transition-colors">
                Système
              </Link>
            </>
          ) : userType === 'B2G' ? (
            <>
              <Link to="/collectivites-dashboard" className="text-foreground hover:text-primary transition-colors">
                Observatoire
              </Link>
              <Link to="/analyze" className="text-foreground hover:text-primary transition-colors">
                Analyser
              </Link>
            </>
          ) : userType === 'B2B2C' ? (
            <>
              <Link to="/prescripteurs-dashboard" className="text-foreground hover:text-primary transition-colors">
                Dashboard Prescripteur
              </Link>
              <Link to="/analyze" className="text-foreground hover:text-primary transition-colors">
                Certifier Devis
              </Link>
              <Link to="/pricing" className="text-foreground hover:text-primary transition-colors">
                Abonnements
              </Link>
            </>
          ) : userType === 'B2B' ? (
            <>
              <Link to="/dashboard" className="text-foreground hover:text-primary transition-colors">
                Dashboard Pro
              </Link>
              <Link to="/analyze" className="text-foreground hover:text-primary transition-colors">
                Analyser
              </Link>
              <Link to="/pricing" className="text-foreground hover:text-primary transition-colors">
                Solutions B2B
              </Link>
            </>
          ) : (
            <>
              <Link to="/analyze" className="text-foreground hover:text-primary transition-colors">
                Analyser
              </Link>
              <Link to="/projects" className="text-foreground hover:text-primary transition-colors">
                Mes Projets
              </Link>
              <Link to="/project-tracking" className="text-foreground hover:text-primary transition-colors">
                Suivi
              </Link>
              <Link to="/pricing" className="text-foreground hover:text-primary transition-colors">
                Tarifs
              </Link>
            </>
          )}
        </nav>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground hidden md:block">Profil:</span>
            <Select value={userType} onValueChange={setUserType}>
              <SelectTrigger className="w-36 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="B2C">B2C - Particuliers</SelectItem>
                <SelectItem value="B2B">B2B - Entreprises BTP</SelectItem>
                <SelectItem value="B2G">B2G - Collectivités</SelectItem>
                <SelectItem value="B2B2C">B2B2C - Prescripteurs</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
            <Badge 
              variant={
                userType === 'B2C' ? 'secondary' : 
                userType === 'B2B' ? 'outline' :
                userType === 'B2G' ? 'default' :
                userType === 'B2B2C' ? 'default' :
                userType === 'admin' ? 'destructive' : 'secondary'
              } 
              className="hidden md:inline-flex"
            >
              {userType === 'B2C' ? '👤' : 
               userType === 'B2B' ? '🏢' :
               userType === 'B2G' ? '🏛️' :
               userType === 'B2B2C' ? '🎯' :
               userType === 'admin' ? '⚙️' : '👤'}
            </Badge>
          </div>
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