/**
 * Page d'accueil Phase 0
 * Permet de choisir entre le wizard B2C et le formulaire B2B
 */

import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  User, Building2, ArrowRight, CheckCircle2, Sparkles, Clock, FileText, Shield, LayoutDashboard
} from 'lucide-react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { useApp } from '@/context/AppContext';

export function Phase0Landing() {
  const navigate = useNavigate();
  const { user } = useApp();

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 flex flex-col">
      <Header />

      <main className="flex-1">
        <div className="container max-w-6xl mx-auto px-4 py-12">
        {/* En-tête */}
        <div className="text-center mb-12">
          <Badge variant="outline" className="mb-4">
            Phase 0 - Conception & Définition
          </Badge>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Définissez votre projet de travaux
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Transformez votre intention de travaux en un cahier des charges structuré
            pour obtenir des devis précis et adaptés.
          </p>
        </div>

        {/* Avantages */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-12">
          {[
            { icon: <Sparkles className="w-5 h-5" />, text: 'Estimation gratuite' },
            { icon: <Clock className="w-5 h-5" />, text: '10 minutes' },
            { icon: <FileText className="w-5 h-5" />, text: 'Documents générés' },
            { icon: <Shield className="w-5 h-5" />, text: 'Données sécurisées' },
          ].map((item, i) => (
            <div key={i} className="flex items-center justify-center gap-2 p-4 bg-background rounded-lg border">
              <span className="text-primary">{item.icon}</span>
              <span className="font-medium">{item.text}</span>
            </div>
          ))}
        </div>

        {/* Choix du parcours */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
          {/* Parcours particulier */}
          <Card className="relative overflow-hidden border-2 hover:border-primary transition-colors cursor-pointer group"
                onClick={() => navigate('/phase0/wizard')}>
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-full" />
            <CardHeader>
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <User className="w-8 h-8 text-primary" />
              </div>
              <CardTitle className="text-2xl">Particulier</CardTitle>
              <CardDescription className="text-base">
                Vous êtes un particulier et souhaitez rénover votre logement
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2">
                {[
                  'Accompagnement pas à pas',
                  'Questions simples et guidées',
                  'Suggestions intelligentes',
                  'Estimation automatique',
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    {item}
                  </li>
                ))}
              </ul>

              <Button className="w-full group-hover:bg-primary/90">
                Commencer le wizard
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </CardContent>
          </Card>

          {/* Parcours professionnel */}
          <Card className="relative overflow-hidden border-2 hover:border-primary transition-colors cursor-pointer group"
                onClick={() => navigate('/phase0/professional')}>
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-full" />
            <CardHeader>
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <Building2 className="w-8 h-8 text-primary" />
              </div>
              <CardTitle className="text-2xl">Professionnel</CardTitle>
              <CardDescription className="text-base">
                Vous êtes un professionnel avec un projet déjà défini
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2">
                {[
                  'Saisie directe et rapide',
                  'Import de documents',
                  'Multi-projets',
                  'Gestion équipe',
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    {item}
                  </li>
                ))}
              </ul>

              <Button variant="outline" className="w-full group-hover:bg-primary group-hover:text-primary-foreground">
                Accéder au formulaire
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Comment ça marche */}
        <div className="bg-muted/50 rounded-2xl p-8 mb-12">
          <h2 className="text-2xl font-bold text-center mb-8">Comment ça marche ?</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {[
              {
                step: '1',
                title: 'Décrivez votre projet',
                description: 'Répondez à quelques questions sur votre bien et vos besoins',
              },
              {
                step: '2',
                title: 'Sélectionnez les travaux',
                description: 'Choisissez les lots de travaux qui vous concernent',
              },
              {
                step: '3',
                title: 'Obtenez une estimation',
                description: 'Recevez une estimation budgétaire et temporelle',
              },
              {
                step: '4',
                title: 'Recevez vos documents',
                description: 'CCF et APS générés automatiquement pour vos devis',
              },
            ].map((item, i) => (
              <div key={i} className="relative text-center">
                <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground font-bold text-lg flex items-center justify-center mx-auto mb-4">
                  {item.step}
                </div>
                <h3 className="font-semibold mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.description}</p>

                {i < 3 && (
                  <div className="hidden md:block absolute top-6 left-[60%] w-[80%] h-0.5 bg-border" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Mes projets (si connecté) */}
        {user && (
          <div className="bg-primary/5 rounded-2xl p-8 mb-12">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <LayoutDashboard className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">Mes projets en cours</h3>
                  <p className="text-sm text-muted-foreground">
                    Retrouvez et continuez vos projets de conception
                  </p>
                </div>
              </div>
              <Button onClick={() => navigate('/phase0/dashboard')}>
                Voir mes projets
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* FAQ rapide */}
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-4">Des questions ?</h2>
          <p className="text-muted-foreground mb-4">
            Notre équipe est disponible pour vous accompagner dans votre projet
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button variant="outline" asChild>
              <Link to="/pricing">Voir les tarifs</Link>
            </Button>
            <Button variant="ghost" asChild>
              <Link to="/">Retour à l'accueil</Link>
            </Button>
          </div>
        </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default Phase0Landing;
