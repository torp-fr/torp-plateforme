import React, { useState } from 'react';
import QualificationQuiz from '@/components/QualificationQuiz';
import ScoringResult from '@/components/ScoringResult';
import { type ScoringResult as ScoringData, type UserData } from '@/types/torp';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Users, Clock, Shield } from 'lucide-react';

type FlowStep = 'welcome' | 'quiz' | 'results' | 'complete';

const DiscoveryFlow: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<FlowStep>('welcome');
  const [scoringResult, setScoringResult] = useState<ScoringData | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);

  const handleQuizComplete = (result: ScoringData, user: UserData) => {
    setScoringResult(result);
    setUserData(user);
    setCurrentStep('results');
  };

  const handleContinue = () => {
    setCurrentStep('complete');
  };

  if (currentStep === 'welcome') {
    return (
      <div className="min-h-screen bg-gradient-soft p-6">
        <div className="max-w-4xl mx-auto">
          {/* Hero Section */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-6">
              <TrendingUp className="h-4 w-4" />
              Phase 1 : Découverte & Acquisition TORP
            </div>
            <h1 className="text-4xl font-bold mb-4">
              Votre Projet BTP Analysé en 
              <span className="text-primary"> 2 Minutes</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Obtenez votre scoring TORP personnalisé et découvrez le potentiel de votre projet 
              grâce à notre algorithme d'intelligence artificielle.
            </p>
          </div>

          {/* Stats Rapides */}
          <div className="grid md:grid-cols-4 gap-6 mb-12">
            <Card className="text-center">
              <CardContent className="p-6">
                <div className="bg-primary/10 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4">
                  <TrendingUp className="h-6 w-6 text-primary" />
                </div>
                <div className="text-2xl font-bold mb-2">127</div>
                <div className="text-sm text-muted-foreground">Critères analysés</div>
              </CardContent>
            </Card>

            <Card className="text-center">
              <CardContent className="p-6">
                <div className="bg-success/10 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Users className="h-6 w-6 text-success" />
                </div>
                <div className="text-2xl font-bold mb-2">15,847</div>
                <div className="text-sm text-muted-foreground">Projets analysés</div>
              </CardContent>
            </Card>

            <Card className="text-center">
              <CardContent className="p-6">
                <div className="bg-warning/10 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Clock className="h-6 w-6 text-warning" />
                </div>
                <div className="text-2xl font-bold mb-2">30s</div>
                <div className="text-sm text-muted-foreground">Temps d'analyse</div>
              </CardContent>
            </Card>

            <Card className="text-center">
              <CardContent className="p-6">
                <div className="bg-destructive/10 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Shield className="h-6 w-6 text-destructive" />
                </div>
                <div className="text-2xl font-bold mb-2">4,250€</div>
                <div className="text-sm text-muted-foreground">Économie moyenne</div>
              </CardContent>
            </Card>
          </div>

          {/* Processus */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Comment ça fonctionne ?</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="bg-primary text-primary-foreground w-8 h-8 rounded-full flex items-center justify-center mx-auto mb-4 text-sm font-bold">1</div>
                  <h3 className="font-semibold mb-2">Quiz Rapide</h3>
                  <p className="text-sm text-muted-foreground">3 questions sur votre projet pour établir votre profil</p>
                </div>
                <div className="text-center">
                  <div className="bg-primary text-primary-foreground w-8 h-8 rounded-full flex items-center justify-center mx-auto mb-4 text-sm font-bold">2</div>
                  <h3 className="font-semibold mb-2">Analyse IA</h3>
                  <p className="text-sm text-muted-foreground">Algorithme TORP calcule votre scoring personnalisé</p>
                </div>
                <div className="text-center">
                  <div className="bg-primary text-primary-foreground w-8 h-8 rounded-full flex items-center justify-center mx-auto mb-4 text-sm font-bold">3</div>
                  <h3 className="font-semibold mb-3">Recommandations</h3>
                  <p className="text-sm text-muted-foreground">Actions personnalisées pour optimiser votre projet</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* CTA */}
          <div className="text-center">
            <button
              onClick={() => setCurrentStep('quiz')}
              className="bg-primary text-primary-foreground hover:bg-primary-dark px-8 py-4 rounded-lg text-lg font-semibold shadow-medium transition-all"
            >
              Commencer l'Analyse Gratuite
            </button>
            <p className="text-sm text-muted-foreground mt-4">
              Sans engagement • Résultats instantanés • 100% gratuit
            </p>
          </div>

          {/* Trust Badges */}
          <div className="flex justify-center gap-4 mt-12 text-sm text-muted-foreground">
            <Badge variant="outline" className="flex items-center gap-2">
              <Shield className="h-3 w-3" />
              Données sécurisées
            </Badge>
            <Badge variant="outline" className="flex items-center gap-2">
              <TrendingUp className="h-3 w-3" />
              IA certifiée
            </Badge>
            <Badge variant="outline" className="flex items-center gap-2">
              <Users className="h-3 w-3" />
              15K+ utilisateurs
            </Badge>
          </div>
        </div>
      </div>
    );
  }

  if (currentStep === 'quiz') {
    return (
      <div className="min-h-screen bg-gradient-soft p-6">
        <div className="max-w-4xl mx-auto pt-8">
          <div className="text-center mb-8">
            <Badge variant="outline" className="mb-4">
              Étape 1/3 : Qualification Projet
            </Badge>
            <h2 className="text-2xl font-bold">Analysons votre projet</h2>
            <p className="text-muted-foreground">Quelques questions pour personnaliser votre expérience</p>
          </div>
          
          <QualificationQuiz onComplete={handleQuizComplete} />
        </div>
      </div>
    );
  }

  if (currentStep === 'results' && scoringResult && userData) {
    return (
      <div className="min-h-screen bg-gradient-soft p-6">
        <div className="max-w-6xl mx-auto pt-8">
          <div className="text-center mb-8">
            <Badge variant="outline" className="mb-4">
              Étape 2/3 : Résultats d'Analyse
            </Badge>
            <h2 className="text-2xl font-bold">Votre Profil TORP</h2>
            <p className="text-muted-foreground">Analyse complète basée sur vos réponses</p>
          </div>
          
          <ScoringResult 
            result={scoringResult} 
            userData={userData} 
            onContinue={handleContinue} 
          />
        </div>
      </div>
    );
  }

  if (currentStep === 'complete') {
    return (
      <div className="min-h-screen bg-gradient-soft p-6">
        <div className="max-w-4xl mx-auto pt-8">
          <Card className="text-center">
            <CardContent className="p-12">
              <div className="bg-success/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                <Shield className="h-8 w-8 text-success" />
              </div>
              
              <h2 className="text-3xl font-bold mb-4">Profil Créé avec Succès !</h2>
              <p className="text-lg text-muted-foreground mb-8">
                Vous êtes maintenant prêt à utiliser TORP pour analyser vos devis et 
                gérer vos projets en toute sécurité.
              </p>

              {scoringResult && (
                <div className="bg-muted/30 rounded-lg p-6 mb-8">
                  <div className="text-sm text-muted-foreground mb-2">Votre Score TORP</div>
                  <div className="text-2xl font-bold text-primary">
                    {scoringResult.total}/100 - Grade {scoringResult.grade}
                  </div>
                </div>
              )}

              <div className="flex justify-center gap-4">
                <button className="bg-primary text-primary-foreground hover:bg-primary-dark px-6 py-3 rounded-lg font-medium">
                  Analyser un devis
                </button>
                <button className="border border-input bg-background hover:bg-accent hover:text-accent-foreground px-6 py-3 rounded-lg font-medium">
                  Explorer TORP
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return null;
};

export default DiscoveryFlow;