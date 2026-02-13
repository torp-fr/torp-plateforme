/**
 * Dashboard - Page d'accueil principale TORP
 * Plateforme de valorisation intelligente des devis BTP
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  ArrowRight,
  FileText,
  ClipboardList,
  BarChart3,
  Award,
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const WORKFLOW_STEPS = [
  {
    number: 1,
    title: 'Cadrage du projet',
    description: 'Définissez le contexte et les enjeux de votre projet BTP',
    icon: ClipboardList,
    color: 'bg-primary/10',
  },
  {
    number: 2,
    title: 'Upload du devis',
    description: 'Uploadez votre devis en PDF pour une analyse instantanée',
    icon: FileText,
    color: 'bg-primary/5',
  },
  {
    number: 3,
    title: 'Analyse et audit',
    description: 'Notre IA évalue votre devis selon 5 axes professionnels',
    icon: BarChart3,
    color: 'bg-primary/10',
  },
  {
    number: 4,
    title: 'Résultats et scoring',
    description: 'Obtenez un rapport détaillé avec recommandations',
    icon: Award,
    color: 'bg-primary/5',
  },
];

export function Dashboard() {
  const navigate = useNavigate();
  const { user } = useApp();

  return (
    <div className="space-y-8 w-full">
      {/* Welcome Section */}
      <div className="space-y-2">
        <h1 className="text-4xl font-bold text-foreground font-display">
          Bienvenue sur TORP 🏗️
        </h1>
        <p className="text-lg text-muted-foreground">
          La plateforme intelligente de valorisation de vos devis BTP
        </p>
        {user?.email && (
          <p className="text-sm text-muted-foreground">
            Connecté en tant que <span className="font-semibold text-foreground">{user.email}</span>
          </p>
        )}
      </div>

      {/* Main CTA */}
      <Card className="border-2 border-primary/30 hover:border-primary/60 transition-colors bg-gradient-primary/5">
        <CardContent className="p-8">
          <div className="flex items-center justify-between gap-6">
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-foreground font-display mb-2">
                Valorisez vos devis
              </h2>
              <p className="text-muted-foreground mb-4">
                Analysez vos devis avec notre système de scoring intelligent. Identifiez les points forts et les axes d'amélioration en quelques secondes.
              </p>
              <Button
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
                onClick={() => navigate('/analyze')}
              >
                Commencer une valorisation
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
            <div className="hidden md:flex h-16 w-16 rounded-lg bg-primary/10 flex-shrink-0 items-center justify-center">
              <Award className="h-8 w-8 text-primary" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Workflow Section */}
      <div>
        <h2 className="text-2xl font-bold text-foreground font-display mb-4">
          Le processus de valorisation
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {WORKFLOW_STEPS.map((step) => {
            const Icon = step.icon;
            return (
              <Card key={step.number} className="relative">
                <CardContent className="p-6">
                  <div className={`${step.color} w-12 h-12 rounded-lg flex items-center justify-center mb-4`}>
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-primary text-white text-xs font-bold">
                        {step.number}
                      </span>
                      <h3 className="font-semibold text-foreground">{step.title}</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">{step.description}</p>
                  </div>
                </CardContent>
                {step.number < WORKFLOW_STEPS.length && (
                  <div className="hidden lg:block absolute top-1/2 -right-2 transform -translate-y-1/2">
                    <div className="w-4 h-0.5 bg-primary/30"></div>
                    <ArrowRight className="h-4 w-4 text-primary/30 absolute right-1 top-1/2 transform -translate-y-1/2" />
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </div>

      {/* Key Features */}
      <Card>
        <CardHeader>
          <CardTitle className="text-primary font-display">Ce que vous gagnez</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {[
              'Scoring multi-critères basé sur 5 axes d\'évaluation professionnels',
              'Rapport détaillé avec analyse point par point de votre devis',
              'Recommandations concrètes pour optimiser vos offres',
              'Historique complet de vos valorisations',
              'Audit trail et conformité documentaire',
            ].map((feature, idx) => (
              <li key={idx} className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <span className="text-muted-foreground">{feature}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Footer Status */}
      <div className="text-xs text-muted-foreground text-center py-4 border-t">
        <p>Plateforme TORP - Système opérationnel et sécurisé</p>
      </div>
    </div>
  );
}

export default Dashboard;
