/**
 * Optimized Header Component
 * Simplified navigation with clear user journey
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Link, useNavigate } from "react-router-dom";
import { Menu, X, ChevronDown } from "lucide-react";
import { useApp } from "@/context/AppContext";
import torpLogo from "@/assets/torp-logo-red.png";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Header = () => {
  const { user } = useApp();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleAnalyzeClick = () => {
    if (user) {
      navigate('/analyze');
    } else {
      // Pour les non-connectés, on propose le parcours découverte
      navigate('/discovery');
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <img
              src={torpLogo}
              alt="TORP"
              className="h-10 w-auto"
            />
            <div className="hidden sm:block">
              <h1 className="text-xl font-bold text-primary">TORP</h1>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                Analyse de devis IA
              </p>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-8">
            {/* Solutions dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-1 text-sm font-medium text-foreground hover:text-primary transition-colors cursor-pointer">
                Solutions
                <ChevronDown className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuItem onClick={() => navigate('/b2c-dashboard')}>
                  <div>
                    <div className="font-medium">👤 Particuliers</div>
                    <div className="text-xs text-muted-foreground">
                      Analysez vos devis de travaux
                    </div>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/improved-b2b-dashboard')}>
                  <div>
                    <div className="font-medium">🏢 Entreprises BTP</div>
                    <div className="text-xs text-muted-foreground">
                      Valorisez votre expertise
                    </div>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/collectivites-dashboard')}>
                  <div>
                    <div className="font-medium">🏛️ Collectivités</div>
                    <div className="text-xs text-muted-foreground">
                      Observatoire des marchés publics
                    </div>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/prescripteurs-dashboard')}>
                  <div>
                    <div className="font-medium">🎯 Prescripteurs</div>
                    <div className="text-xs text-muted-foreground">
                      Accompagnez vos clients
                    </div>
                  </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Link
              to="/pricing"
              className="text-sm font-medium text-foreground hover:text-primary transition-colors"
            >
              Tarifs
            </Link>

            <Link
              to="/demo"
              className="text-sm font-medium text-foreground hover:text-primary transition-colors"
            >
              Démo
            </Link>

            {user && (
              <Link
                to="/projects"
                className="text-sm font-medium text-foreground hover:text-primary transition-colors"
              >
                Mes Projets
              </Link>
            )}
          </nav>

          {/* CTAs */}
          <div className="hidden lg:flex items-center gap-3">
            {user ? (
              <>
                <Link to="/dashboard">
                  <Button variant="ghost" size="sm">
                    Dashboard
                  </Button>
                </Link>
                <Button
                  onClick={handleAnalyzeClick}
                  variant="default"
                  size="sm"
                  className="bg-primary hover:bg-primary/90"
                >
                  Analyser un devis
                </Button>
              </>
            ) : (
              <>
                <Link to="/login">
                  <Button variant="ghost" size="sm">
                    Connexion
                  </Button>
                </Link>
                <Button
                  onClick={handleAnalyzeClick}
                  variant="default"
                  size="sm"
                  className="bg-primary hover:bg-primary/90"
                >
                  Essayer gratuitement
                </Button>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            className="lg:hidden p-2 text-foreground hover:text-primary transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </button>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <nav className="lg:hidden mt-4 pb-4 space-y-3 border-t pt-4">
            <div className="space-y-2">
              <div className="text-sm font-semibold text-muted-foreground px-2">
                Solutions
              </div>
              <Link
                to="/b2c-dashboard"
                className="block px-2 py-2 text-sm text-foreground hover:text-primary hover:bg-accent rounded-md transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                👤 Particuliers
              </Link>
              <Link
                to="/improved-b2b-dashboard"
                className="block px-2 py-2 text-sm text-foreground hover:text-primary hover:bg-accent rounded-md transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                🏢 Entreprises BTP
              </Link>
              <Link
                to="/collectivites-dashboard"
                className="block px-2 py-2 text-sm text-foreground hover:text-primary hover:bg-accent rounded-md transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                🏛️ Collectivités
              </Link>
              <Link
                to="/prescripteurs-dashboard"
                className="block px-2 py-2 text-sm text-foreground hover:text-primary hover:bg-accent rounded-md transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                🎯 Prescripteurs
              </Link>
            </div>

            <Link
              to="/pricing"
              className="block px-2 py-2 text-sm text-foreground hover:text-primary hover:bg-accent rounded-md transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              Tarifs
            </Link>

            <Link
              to="/demo"
              className="block px-2 py-2 text-sm text-foreground hover:text-primary hover:bg-accent rounded-md transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              Démo
            </Link>

            {user && (
              <Link
                to="/projects"
                className="block px-2 py-2 text-sm text-foreground hover:text-primary hover:bg-accent rounded-md transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                Mes Projets
              </Link>
            )}

            <div className="pt-4 space-y-2">
              {user ? (
                <>
                  <Link to="/dashboard" onClick={() => setMobileMenuOpen(false)}>
                    <Button variant="outline" size="sm" className="w-full">
                      Dashboard
                    </Button>
                  </Link>
                  <Button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      handleAnalyzeClick();
                    }}
                    variant="default"
                    size="sm"
                    className="w-full bg-primary hover:bg-primary/90"
                  >
                    Analyser un devis
                  </Button>
                </>
              ) : (
                <>
                  <Link to="/login" onClick={() => setMobileMenuOpen(false)}>
                    <Button variant="outline" size="sm" className="w-full">
                      Connexion
                    </Button>
                  </Link>
                  <Button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      handleAnalyzeClick();
                    }}
                    variant="default"
                    size="sm"
                    className="w-full bg-primary hover:bg-primary/90"
                  >
                    Essayer gratuitement
                  </Button>
                </>
              )}
            </div>
          </nav>
        )}
      </div>
    </header>
  );
};
