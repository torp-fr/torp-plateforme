/**
 * Layout public pour les pages de tickets
 * Design épuré sans navigation complexe
 */

import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

interface PublicLayoutProps {
  children: ReactNode;
}

export function PublicLayout({ children }: PublicLayoutProps) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      {/* Header minimaliste */}
      <header className="border-b bg-white/80 dark:bg-slate-950/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <button onClick={() => navigate('/')} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">T</span>
            </div>
            <span className="font-semibold text-lg">TORP</span>
          </button>
          <span className="text-sm text-muted-foreground">
            Analyse de devis vérifiée
          </span>
        </div>
      </header>

      {/* Contenu */}
      <main className="container max-w-4xl mx-auto px-4 py-8">{children}</main>

      {/* Footer minimaliste */}
      <footer className="border-t bg-white dark:bg-slate-950 mt-12">
        <div className="container max-w-4xl mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
            <p>© {new Date().getFullYear()} TORP - L'analyse intelligente de devis BTP</p>
            <div className="flex gap-4">
              <button onClick={() => navigate('/about')} className="hover:text-primary transition-colors">
                À propos
              </button>
              <button onClick={() => navigate('/privacy')} className="hover:text-primary transition-colors">
                Confidentialité
              </button>
              <button onClick={() => navigate('/terms')} className="hover:text-primary transition-colors">
                CGU
              </button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
