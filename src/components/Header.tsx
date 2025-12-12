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
import { authService } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { NotificationBell } from "@/components/notifications/NotificationBell";

export const Header = () => {
  const { user, setUser } = useApp();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { toast } = useToast();

  const handleLogout = async () => {
    try {
      await authService.logout();
      setUser(null);
      toast({
        title: 'Déconnexion réussie',
        description: 'À bientôt!',
      });
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
      // Even if logout fails, clear local user state
      setUser(null);
      navigate('/login');
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
              <DropdownMenuContent align="start" className="w-64">
                <DropdownMenuItem onClick={() => navigate('/phase0')}>
                  <div>
                    <div className="font-medium">📝 Définir mon projet</div>
                    <div className="text-xs text-muted-foreground">
                      Créez votre cahier des charges en quelques clics
                    </div>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/analyze')}>
                  <div>
                    <div className="font-medium">📊 Analyser un devis</div>
                    <div className="text-xs text-muted-foreground">
                      Comprenez et validez vos devis de travaux
                    </div>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/register')}>
                  <div>
                    <div className="font-medium">👤 Particuliers</div>
                    <div className="text-xs text-muted-foreground">
                      Accompagnement personnalisé
                    </div>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/pro')}>
                  <div>
                    <div className="font-medium">🏢 Professionnels BTP</div>
                    <div className="text-xs text-muted-foreground">
                      Espace dédié aux pros
                    </div>
                  </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Link
              to="/phase0"
              className="text-sm font-medium text-primary hover:text-primary/80 transition-colors"
            >
              Définir mon projet
            </Link>

            <Link
              to="/pricing"
              className="text-sm font-medium text-foreground hover:text-primary transition-colors"
            >
              Tarifs
            </Link>

            {user && (
              <>
                <Link
                  to="/dashboard"
                  className="text-sm font-medium text-foreground hover:text-primary transition-colors"
                >
                  Mes Analyses
                </Link>
                <Link
                  to="/compare"
                  className="text-sm font-medium text-foreground hover:text-primary transition-colors"
                >
                  Comparer
                </Link>
              </>
            )}
          </nav>

          {/* CTAs */}
          <div className="hidden lg:flex items-center gap-3">
            {user ? (
              <>
                <NotificationBell />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      {user.name || user.email}
                      <ChevronDown className="ml-2 h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={() => navigate('/dashboard')}>
                      📊 Dashboard
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('/compare')}>
                      ⚖️ Comparer devis
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('/profile')}>
                      👤 Mon Profil
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={handleLogout}
                      className="text-red-600"
                    >
                      🚪 Déconnexion
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <>
                <Link to="/login">
                  <Button variant="ghost" size="sm">
                    Connexion
                  </Button>
                </Link>
                <Link to="/register">
                  <Button variant="outline" size="sm">
                    Inscription
                  </Button>
                </Link>
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
            {/* Phase 0 - Définir mon projet (CTA principal) */}
            <Link
              to="/phase0"
              className="block px-3 py-3 text-sm font-medium bg-primary/10 text-primary hover:bg-primary/20 rounded-lg transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              📝 Définir mon projet
            </Link>

            <div className="space-y-2">
              <div className="text-sm font-semibold text-muted-foreground px-2">
                Solutions
              </div>
              <Link
                to="/analyze"
                className="block px-2 py-2 text-sm text-foreground hover:text-primary hover:bg-accent rounded-md transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                📊 Analyser un devis
              </Link>
              <Link
                to="/register"
                className="block px-2 py-2 text-sm text-foreground hover:text-primary hover:bg-accent rounded-md transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                👤 Particuliers
              </Link>
              <Link
                to="/pro"
                className="block px-2 py-2 text-sm text-foreground hover:text-primary hover:bg-accent rounded-md transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                🏢 Professionnels BTP
              </Link>
            </div>

            <Link
              to="/pricing"
              className="block px-2 py-2 text-sm text-foreground hover:text-primary hover:bg-accent rounded-md transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              Tarifs
            </Link>

            {user && (
              <>
                <Link
                  to="/dashboard"
                  className="block px-2 py-2 text-sm text-foreground hover:text-primary hover:bg-accent rounded-md transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Mes Analyses
                </Link>
                <Link
                  to="/compare"
                  className="block px-2 py-2 text-sm text-foreground hover:text-primary hover:bg-accent rounded-md transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Comparer devis
                </Link>
              </>
            )}

            <div className="pt-4 space-y-2">
              {user ? (
                <>
                  <div className="px-2 py-2 text-sm font-medium text-muted-foreground border-b mb-2">
                    {user.name || user.email}
                  </div>
                  <Link to="/dashboard" onClick={() => setMobileMenuOpen(false)}>
                    <Button variant="outline" size="sm" className="w-full justify-start">
                      📊 Dashboard
                    </Button>
                  </Link>
                  <Link to="/profile" onClick={() => setMobileMenuOpen(false)}>
                    <Button variant="outline" size="sm" className="w-full justify-start">
                      👤 Mon Profil
                    </Button>
                  </Link>
                  <Button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      handleLogout();
                    }}
                    variant="outline"
                    size="sm"
                    className="w-full text-red-600 hover:text-red-700"
                  >
                    🚪 Déconnexion
                  </Button>
                </>
              ) : (
                <>
                  <Link to="/login" onClick={() => setMobileMenuOpen(false)}>
                    <Button variant="outline" size="sm" className="w-full">
                      Connexion
                    </Button>
                  </Link>
                  <Link to="/register" onClick={() => setMobileMenuOpen(false)}>
                    <Button variant="outline" size="sm" className="w-full">
                      Inscription
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </nav>
        )}
      </div>
    </header>
  );
};
