/**
 * Dashboard - Page d'accueil principale
 * Interface épurée et minimaliste - pas de mock data
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileSearch,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export function Dashboard() {
  const navigate = useNavigate();
  const { user } = useApp();

  return (
    <div className="space-y-8 w-full max-w-6xl">
      {/* Welcome Header */}
      <div>
        <h1 className="text-4xl font-bold text-foreground font-display">
          Bienvenue sur TORP 👋
        </h1>
        <p className="text-lg text-muted-foreground mt-2">
          Plateforme intelligente de gestion et d'analyse de devis BTP
        </p>
        {user?.email && (
          <p className="text-sm text-muted-foreground mt-2">
            Connecté en tant que: <span className="font-semibold text-foreground">{user.email}</span>
          </p>
        )}
      </div>

      {/* Main CTA - Analyze Quote */}
      <Card className="border-2 border-primary/30 hover:border-primary/60 transition-colors bg-gradient-primary/5">
        <CardContent className="p-8">
          <div className="flex items-center gap-6">
            <div className="h-16 w-16 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <FileSearch className="h-8 w-8 text-primary" />
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-foreground font-display">
                Analyser un devis
              </h2>
              <p className="text-muted-foreground mt-2">
                Uploadez un PDF et obtenez une analyse détaillée et scoring intelligent de vos devis BTP
              </p>
              <Button
                className="mt-4 bg-primary hover:bg-primary/90 text-primary-foreground"
                onClick={() => navigate('/analyze')}
              >
                Commencer l'analyse
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Info Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* About TORP */}
        <Card>
          <CardHeader>
            <CardTitle className="text-primary font-display">À propos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              TORP est une plateforme spécialisée dans l'analyse intelligente de devis de travaux BTP.
            </p>
            <p>
              Nos algorithmes d'IA évaluent chaque devis selon des critères professionnels et vous fournissent des scores de fiabilité détaillés.
            </p>
          </CardContent>
        </Card>

        {/* Getting Started */}
        <Card>
          <CardHeader>
            <CardTitle className="text-primary font-display">Démarrage rapide</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3 text-sm text-muted-foreground list-decimal list-inside">
              <li>Préparez un devis en PDF</li>
              <li>Cliquez sur "Analyser un devis"</li>
              <li>Consultez votre analyse</li>
              <li>Téléchargez le rapport détaillé</li>
            </ol>
          </CardContent>
        </Card>
      </div>

      {/* Features - Clean list */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-primary font-display">
            <Sparkles className="h-5 w-5" />
            Fonctionnalités
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>✓ Analyse OCR de devis PDF</li>
            <li>✓ Scoring multi-critères intelligent</li>
            <li>✓ Historique d'analyses</li>
            <li>✓ Enrichissement de données</li>
            <li>✓ Rapport d'audit complet</li>
          </ul>
        </CardContent>
      </Card>

      {/* Status */}
      <div className="text-xs text-muted-foreground text-center py-4">
        Plateforme TORP - v2.0 | Système opérationnel
      </div>
    </div>
  );
}

export default Dashboard;
