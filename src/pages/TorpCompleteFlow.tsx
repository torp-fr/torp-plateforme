import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  TrendingUp, 
  Home, 
  CreditCard, 
  FileText, 
  Award,
  MapPin,
  ArrowRight,
  CheckCircle,
  Clock,
  Shield
} from 'lucide-react';

import QualificationQuiz from '@/components/QualificationQuiz';
import ScoringResult from '@/components/ScoringResult';
import ParcelAnalysis from '@/components/ParcelAnalysis';
import DevisAnalyzer from '@/components/DevisAnalyzer';
import PaymentSystem from '@/components/PaymentSystem';

import { 
  type ScoringResult as ScoringData, 
  type UserData, 
  type ParcelData,
  type RiskAnalysis,
  type TorpAnalysisResult,
  type ProjetTracking,
  type PaymentStage
} from '@/types/torp';

type FlowPhase = 
  | 'welcome' 
  | 'qualification' 
  | 'scoring_result'
  | 'parcel_analysis' 
  | 'devis_analysis'
  | 'payment_management'
  | 'project_tracking'
  | 'complete';

const TorpCompleteFlow: React.FC = () => {
  const [currentPhase, setCurrentPhase] = useState<FlowPhase>('welcome');
  const [completedPhases, setCompletedPhases] = useState<FlowPhase[]>([]);
  
  // États pour chaque phase
  const [scoringResult, setScoringResult] = useState<ScoringData | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [parcelData, setParcelData] = useState<ParcelData | null>(null);
  const [riskAnalysis, setRiskAnalysis] = useState<RiskAnalysis | null>(null);
  const [devisAnalysis, setDevisAnalysis] = useState<TorpAnalysisResult | null>(null);
  const [projectData, setProjectData] = useState<ProjetTracking | null>(null);

  const phases = [
    { id: 'qualification', title: 'Découverte', icon: TrendingUp, description: 'Quiz de qualification 3 min' },
    { id: 'parcel_analysis', title: 'Foncière', icon: MapPin, description: 'Analyse parcelle & PLU' },
    { id: 'devis_analysis', title: 'Analyse IA', icon: FileText, description: '47 critères analysés' },
    { id: 'payment_management', title: 'Paiements', icon: CreditCard, description: 'Séquestre & jalons' },
    { id: 'project_tracking', title: 'Suivi', icon: Shield, description: 'Tracking temps réel' }
  ];

  // Handlers pour chaque phase
  const handleQualificationComplete = (result: ScoringData, user: UserData) => {
    setScoringResult(result);
    setUserData(user);
    setCompletedPhases(prev => [...prev, 'qualification']);
    setCurrentPhase('scoring_result');
  };

  const handleScoringContinue = () => {
    setCompletedPhases(prev => [...prev, 'scoring_result']);
    setCurrentPhase('parcel_analysis');
  };

  const handleParcelAnalysisComplete = (parcel: ParcelData, risks: RiskAnalysis) => {
    setParcelData(parcel);
    setRiskAnalysis(risks);
    setCompletedPhases(prev => [...prev, 'parcel_analysis']);
    setCurrentPhase('devis_analysis');
  };

  const handleDevisAnalysisComplete = (analysis: TorpAnalysisResult) => {
    setDevisAnalysis(analysis);
    setCompletedPhases(prev => [...prev, 'devis_analysis']);
    
    // Création du projet tracking basé sur l'analyse
    const mockProject: ProjetTracking = {
      id: `project_${Date.now()}`,
      nom: 'Extension Maison - Analyse TORP',
      montantTotal: analysis.budgetRealEstime,
      avancement: 0,
      entreprise: {
        siret: '12345678901234',
        nom: 'SAS BATIMENT DURAND',
        age: 12,
        chiffreAffaires: 850000,
        certification: ['RGE', 'Qualibat'],
        assurances: {
          decennale: true,
          rcPro: true,
          validite: '2025-12-31'
        },
        reputation: 4.2,
        litiges: 0
      },
      client: userData!,
      dateDebut: new Date(),
      dateFinPrevue: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // +90 jours
      alerts: [],
      etapesPaiement: [
        {
          id: 'acompte',
          nom: 'Acompte signature',
          montant: Math.round(analysis.budgetRealEstime * 0.3),
          pourcentage: 30,
          status: 'en_attente',
          dateEcheance: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          typeValidation: 'signature'
        },
        {
          id: 'fondations',
          nom: 'Fondations terminées',
          montant: Math.round(analysis.budgetRealEstime * 0.4),
          pourcentage: 40,
          status: 'en_attente',
          dateEcheance: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          typeValidation: 'photos'
        },
        {
          id: 'finition',
          nom: 'Réception travaux',
          montant: Math.round(analysis.budgetRealEstime * 0.3),
          pourcentage: 30,
          status: 'en_attente',
          dateEcheance: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
          typeValidation: 'signature'
        }
      ]
    };
    
    setProjectData(mockProject);
    setCurrentPhase('payment_management');
  };

  const handlePaymentAction = (action: string, data: any) => {
    console.log('Payment action:', action, data);
    // Ici on gérerait les actions de paiement
  };

  const renderPhaseProgress = () => (
    <div className="mb-8">
      <div className="flex items-center justify-between relative">
        {phases.map((phase, index) => {
          const isCompleted = completedPhases.includes(phase.id as FlowPhase);
          const isCurrent = currentPhase === phase.id;
          const IconComponent = phase.icon;

          return (
            <div key={phase.id} className="flex flex-col items-center relative">
              {index > 0 && (
                <div className={`absolute top-5 -left-20 w-40 h-0.5 ${
                  completedPhases.includes(phases[index - 1].id as FlowPhase) 
                    ? 'bg-success' 
                    : 'bg-muted'
                }`} />
              )}
              
              <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 ${
                isCompleted ? 'bg-success text-white' :
                isCurrent ? 'bg-primary text-white' :
                'bg-muted text-muted-foreground'
              }`}>
                {isCompleted ? (
                  <CheckCircle className="h-5 w-5" />
                ) : (
                  <IconComponent className="h-5 w-5" />
                )}
              </div>
              
              <div className="text-center">
                <div className={`text-sm font-medium ${isCurrent ? 'text-primary' : ''}`}>
                  {phase.title}
                </div>
                <div className="text-xs text-muted-foreground mt-1 max-w-20">
                  {phase.description}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  if (currentPhase === 'welcome') {
    return (
      <div className="min-h-screen bg-gradient-soft p-6">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-6">
              <Award className="h-4 w-4" />
              PARCOURS COMPLET TORP • 8 PHASES • 52 POINTS DE CONTRÔLE
            </div>
            <h1 className="text-5xl font-bold mb-4">
              Votre Projet BTP de A à Z
              <span className="text-primary"> Sécurisé</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              De la qualification initiale au suivi complet des travaux, TORP vous accompagne 
              à chaque étape avec son intelligence artificielle et son système de paiements sécurisé.
            </p>
          </div>

          {/* Phases Overview */}
          <div className="grid md:grid-cols-5 gap-6 mb-12">
            {phases.map((phase, index) => {
              const IconComponent = phase.icon;
              return (
                <Card key={phase.id} className="text-center relative">
                  {index < phases.length - 1 && (
                    <ArrowRight className="absolute -right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  )}
                  <CardContent className="p-6">
                    <div className="bg-primary/10 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4">
                      <IconComponent className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="font-semibold mb-2">{phase.title}</h3>
                    <p className="text-sm text-muted-foreground">{phase.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Valeur Créée */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="text-center">Valeur Créée par le Parcours TORP</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-4 gap-6 text-center">
                <div>
                  <div className="text-3xl font-bold text-success mb-2">4,250€</div>
                  <div className="text-sm text-muted-foreground">Économie moyenne client</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-primary mb-2">73%</div>
                  <div className="text-sm text-muted-foreground">Litiges évités</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-warning mb-2">89%</div>
                  <div className="text-sm text-muted-foreground">Taux de succès projets</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-destructive mb-2">2.3s</div>
                  <div className="text-sm text-muted-foreground">Temps d'analyse IA</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* CTA */}
          <div className="text-center">
            <Button 
              size="lg" 
              onClick={() => setCurrentPhase('qualification')}
              className="px-8 py-6 text-lg"
            >
              <TrendingUp className="mr-2 h-6 w-6" />
              Démarrer le Parcours Complet
            </Button>
            <p className="text-sm text-muted-foreground mt-4">
              Durée totale : 15-20 minutes • Valeur moyenne générée : 2,847€ sur 18 mois
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-soft p-6">
      <div className="max-w-6xl mx-auto">
        {/* Progress Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold">Parcours TORP</h1>
            <Badge variant="outline">
              Phase {completedPhases.length + 1}/8
            </Badge>
          </div>
          {renderPhaseProgress()}
        </div>

        {/* Phase Content */}
        {currentPhase === 'qualification' && (
          <div className="space-y-8">
            <div className="text-center">
              <Badge variant="outline" className="mb-4">Phase 1 : Découverte & Acquisition</Badge>
              <h2 className="text-2xl font-bold mb-2">Qualification de votre projet</h2>
              <p className="text-muted-foreground">3 questions pour établir votre profil TORP</p>
            </div>
            <QualificationQuiz onComplete={handleQualificationComplete} />
          </div>
        )}

        {currentPhase === 'scoring_result' && scoringResult && userData && (
          <div className="space-y-8">
            <div className="text-center">
              <Badge variant="outline" className="mb-4">Résultats de Qualification</Badge>
              <h2 className="text-2xl font-bold mb-2">Votre Profil TORP Établi</h2>
              <p className="text-muted-foreground">Score basé sur 127 critères pondérés</p>
            </div>
            <ScoringResult 
              result={scoringResult} 
              userData={userData} 
              onContinue={handleScoringContinue} 
            />
          </div>
        )}

        {currentPhase === 'parcel_analysis' && (
          <div className="space-y-8">
            <div className="text-center">
              <Badge variant="outline" className="mb-4">Phase 2 : Analyse Foncière & Cadastrale</Badge>
              <h2 className="text-2xl font-bold mb-2">Vérification de votre parcelle</h2>
              <p className="text-muted-foreground">Potentiel constructible et contraintes réglementaires</p>
            </div>
            <ParcelAnalysis onAnalysisComplete={handleParcelAnalysisComplete} />
          </div>
        )}

        {currentPhase === 'devis_analysis' && (
          <div className="space-y-8">
            <div className="text-center">
              <Badge variant="outline" className="mb-4">Phase 4 : Analyse Intelligente du Devis</Badge>
              <h2 className="text-2xl font-bold mb-2">IA TORP en Action</h2>
              <p className="text-muted-foreground">47 critères analysés pour évaluer votre devis</p>
            </div>
            <DevisAnalyzer onAnalysisComplete={handleDevisAnalysisComplete} />
          </div>
        )}

        {currentPhase === 'payment_management' && projectData && (
          <div className="space-y-8">
            <div className="text-center">
              <Badge variant="outline" className="mb-4">Phase 3 : Gestion Financière & Paiements</Badge>
              <h2 className="text-2xl font-bold mb-2">Système de Paiements Sécurisé</h2>
              <p className="text-muted-foreground">Séquestre automatique et jalons de validation</p>
            </div>
            <PaymentSystem 
              projet={projectData} 
              userType="client" 
              onPaymentAction={handlePaymentAction} 
            />
            <div className="text-center">
              <Button 
                size="lg" 
                onClick={() => {
                  setCompletedPhases(prev => [...prev, 'payment_management']);
                  setCurrentPhase('complete');
                }}
              >
                Finaliser le Parcours TORP
              </Button>
            </div>
          </div>
        )}

        {currentPhase === 'complete' && (
          <Card className="max-w-4xl mx-auto text-center">
            <CardContent className="p-12">
              <div className="bg-success/10 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                <Award className="h-10 w-10 text-success" />
              </div>
              
              <h2 className="text-3xl font-bold mb-4">Parcours TORP Terminé !</h2>
              <p className="text-lg text-muted-foreground mb-8">
                Votre projet est maintenant entièrement sécurisé et suivi par nos systèmes intelligents.
              </p>

              <div className="grid md:grid-cols-3 gap-6 mb-8">
                <Card>
                  <CardContent className="p-4 text-center">
                    <TrendingUp className="h-8 w-8 text-primary mx-auto mb-2" />
                    <div className="font-semibold">Scoring Établi</div>
                    <div className="text-2xl font-bold text-primary">
                      {scoringResult?.total}/100
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-4 text-center">
                    <Shield className="h-8 w-8 text-success mx-auto mb-2" />
                    <div className="font-semibold">Paiements Protégés</div>
                    <div className="text-2xl font-bold text-success">
                      {projectData?.montantTotal.toLocaleString()}€
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-4 text-center">
                    <Clock className="h-8 w-8 text-warning mx-auto mb-2" />
                    <div className="font-semibold">Suivi Actif</div>
                    <div className="text-2xl font-bold text-warning">24/7</div>
                  </CardContent>
                </Card>
              </div>

              <div className="flex justify-center gap-4">
                <Button size="lg">
                  Accéder au Dashboard Projet
                </Button>
                <Button variant="outline" size="lg">
                  Nouvelle Analyse
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default TorpCompleteFlow;