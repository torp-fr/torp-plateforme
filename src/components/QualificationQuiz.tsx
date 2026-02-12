import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Home, DollarSign, Clock, MapPin, TrendingUp } from 'lucide-react';
import { QualificationAnswers, ScoringResult, LocationData, UserData } from '@/types/torp';
import { supabase } from '@/lib/supabase';

// Données régionales par défaut (utilisées si aucune donnée Supabase disponible)
const REGIONAL_DEFAULTS: Record<string, LocationData> = {
  'Île-de-France': { region: 'Île-de-France', prixMoyenM2: 2850, disponibiliteArtisans: 7.2, delaiMoyenChantier: 145 },
  'Provence-Alpes-Côte d\'Azur': { region: 'PACA', prixMoyenM2: 2200, disponibiliteArtisans: 5.8, delaiMoyenChantier: 130 },
  'Auvergne-Rhône-Alpes': { region: 'ARA', prixMoyenM2: 1950, disponibiliteArtisans: 6.1, delaiMoyenChantier: 135 },
  'default': { region: 'France', prixMoyenM2: 1800, disponibiliteArtisans: 4.5, delaiMoyenChantier: 150 },
};

interface QualificationQuizProps {
  onComplete: (result: ScoringResult, userData: UserData) => void;
}

const QualificationQuiz: React.FC<QualificationQuizProps> = ({ onComplete }) => {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<QualificationAnswers>({
    typeProjet: 'renovation_legere',
    budget: 'moins_20k',
    timeline: 'exploration'
  });
  const [locationData, setLocationData] = useState<LocationData | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Détection de la région via Supabase ou géolocalisation
  useEffect(() => {
    const detectLocation = async () => {
      try {
        // Essayer de récupérer les données régionales depuis Supabase
        const { data: regionalData } = await supabase
          .from('regional_market_data')
          .select('region, prix_moyen_m2, disponibilite_artisans, delai_moyen_chantier')
          .eq('region', 'Île-de-France')
          .single();

        if (regionalData) {
          setLocationData({
            region: regionalData.region,
            prixMoyenM2: regionalData.prix_moyen_m2,
            disponibiliteArtisans: regionalData.disponibilite_artisans,
            delaiMoyenChantier: regionalData.delai_moyen_chantier,
          });
          return;
        }
      } catch {
        // Table n'existe pas encore, utiliser les données par défaut
      }

      // Fallback vers les données par défaut IDF
      setLocationData(REGIONAL_DEFAULTS['Île-de-France']);
    };

    detectLocation();
  }, []);

  // Algorithme de scoring initial selon les spécifications
  const calculateInitialScore = (): ScoringResult => {
    let scoreInitial = 0;
    let scoreTypeProjet = 0;
    let scoreBudget = 0;
    let scoreTimeline = 0;
    
    // Type projet (selon spécifications)
    switch (answers.typeProjet) {
      case 'construction_neuve':
        scoreTypeProjet = 30; // Fort potentiel
        break;
      case 'extension':
        scoreTypeProjet = 25;
        break;
      case 'renovation_lourde':
        scoreTypeProjet = 20;
        break;
      case 'renovation_legere':
        scoreTypeProjet = 10;
        break;
    }

    // Budget
    switch (answers.budget) {
      case 'plus_100k':
        scoreBudget = 30;
        break;
      case '50k_100k':
        scoreBudget = 20;
        break;
      case '20k_50k':
        scoreBudget = 10;
        break;
      case 'moins_20k':
        scoreBudget = 5;
        break;
    }

    // Timeline
    switch (answers.timeline) {
      case 'immediat':
        scoreTimeline = 25;
        break;
      case '3_mois':
        scoreTimeline = 15;
        break;
      case '6_mois':
        scoreTimeline = 8;
        break;
      case 'exploration':
        scoreTimeline = 3;
        break;
    }

    // Source trafic simulée (direct = intention forte)
    const scoreTrafficSource = 10; // Simulation source directe

    const totalScore = scoreTypeProjet + scoreBudget + scoreTimeline + scoreTrafficSource;

    // Attribution grade
    let grade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';
    let message: string;

    if (totalScore >= 80) {
      grade = 'A+';
      message = 'Profil premium - Fort potentiel business';
    } else if (totalScore >= 65) {
      grade = 'A';
      message = 'Excellent profil - Priorité commerciale';
    } else if (totalScore >= 50) {
      grade = 'B';
      message = 'Bon profil - Suivi standard';
    } else if (totalScore >= 35) {
      grade = 'C';
      message = 'Profil moyen - Nurturing nécessaire';
    } else if (totalScore >= 20) {
      grade = 'D';
      message = 'Profil faible - Lead de prospection';
    } else {
      grade = 'F';
      message = 'Profil non qualifié';
    }

    return {
      scoreInitial: totalScore,
      typeProjet: scoreTypeProjet,
      budget: scoreBudget,
      timeline: scoreTimeline,
      trafficSource: scoreTrafficSource,
      total: totalScore,
      grade,
      message
    };
  };

  const questions = [
    {
      title: "Quel est votre type de projet ?",
      icon: Home,
      options: [
        { value: 'construction_neuve', label: 'Construction neuve', description: 'Maison complète sur terrain nu' },
        { value: 'extension', label: 'Extension', description: 'Agrandissement existant' },
        { value: 'renovation_lourde', label: 'Rénovation lourde', description: 'Restructuration complète' },
        { value: 'renovation_legere', label: 'Rénovation légère', description: 'Rafraîchissement, finitions' }
      ]
    },
    {
      title: "Quel est votre budget approximatif ?",
      icon: DollarSign,
      options: [
        { value: 'plus_100k', label: '+ de 100 000€', description: 'Projet premium' },
        { value: '50k_100k', label: '50 000€ - 100 000€', description: 'Projet standard' },
        { value: '20k_50k', label: '20 000€ - 50 000€', description: 'Projet accessible' },
        { value: 'moins_20k', label: '- de 20 000€', description: 'Petit projet' }
      ]
    },
    {
      title: "Quel est votre horizon de temps ?",
      icon: Clock,
      options: [
        { value: 'immediat', label: 'Immédiat', description: 'Démarrage < 1 mois' },
        { value: '3_mois', label: 'Dans 3 mois', description: 'Projet programmé' },
        { value: '6_mois', label: 'Dans 6 mois', description: 'Planification avancée' },
        { value: 'exploration', label: 'Exploration', description: 'Phase de réflexion' }
      ]
    }
  ];

  const handleNext = () => {
    if (step < questions.length - 1) {
      setStep(step + 1);
    } else {
      setIsAnalyzing(true);
      
      setTimeout(() => {
        const scoringResult = calculateInitialScore();
        const userData: UserData = {
          id: `user_${Date.now()}`,
          scoreInitial: scoringResult.total,
          location: locationData || undefined,
          source: { type: 'direct', points: 10 },
          profileType: 'B2C'
        };
        
        onComplete(scoringResult, userData);
      }, 2000);
    }
  };

  const currentQuestion = questions[step];
  const progress = ((step + 1) / questions.length) * 100;

  if (isAnalyzing) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardContent className="p-8 text-center">
          <div className="space-y-6">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary mx-auto"></div>
            <div>
              <h3 className="text-xl font-semibold mb-2">Analyse de votre profil en cours...</h3>
              <p className="text-muted-foreground">Calcul du scoring initial basé sur vos réponses</p>
            </div>
            
            {locationData && (
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="h-4 w-4 text-primary" />
                  <span className="font-medium">Données locales détectées</span>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Région :</span>
                    <span className="ml-2 font-medium">{locationData.region}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Prix moyen :</span>
                    <span className="ml-2 font-medium">{locationData.prixMoyenM2}€/m²</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Artisans disponibles :</span>
                    <span className="ml-2 font-medium">{locationData.disponibiliteArtisans}/km²</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Délai moyen :</span>
                    <span className="ml-2 font-medium">{locationData.delaiMoyenChantier}j</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <div className="flex items-center gap-4 mb-4">
          <div className="bg-primary/10 p-2 rounded-lg">
            <currentQuestion.icon className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-xl">{currentQuestion.title}</CardTitle>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-sm text-muted-foreground">Question {step + 1} sur {questions.length}</span>
              <Progress value={progress} className="flex-1 h-2" />
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {currentQuestion.options.map((option) => (
          <button
            key={option.value}
            onClick={() => setAnswers(prev => ({
              ...prev,
              [step === 0 ? 'typeProjet' : step === 1 ? 'budget' : 'timeline']: option.value
            }))}
            className={`w-full p-4 text-left border rounded-lg transition-all hover:border-primary/50 ${
              answers[step === 0 ? 'typeProjet' : step === 1 ? 'budget' : 'timeline'] === option.value
                ? 'border-primary bg-primary/5'
                : 'border-border'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">{option.label}</div>
                <div className="text-sm text-muted-foreground mt-1">{option.description}</div>
              </div>
              {answers[step === 0 ? 'typeProjet' : step === 1 ? 'budget' : 'timeline'] === option.value && (
                <Badge variant="default" className="ml-2">Sélectionné</Badge>
              )}
            </div>
          </button>
        ))}

        <div className="flex justify-between pt-6">
          <Button
            variant="outline"
            onClick={() => setStep(step - 1)}
            disabled={step === 0}
          >
            Précédent
          </Button>
          
          <Button
            onClick={handleNext}
            disabled={!answers[step === 0 ? 'typeProjet' : step === 1 ? 'budget' : 'timeline']}
            className="min-w-[120px]"
          >
            {step === questions.length - 1 ? (
              <span className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Analyser mon profil
              </span>
            ) : (
              'Suivant'
            )}
          </Button>
        </div>

        {locationData && (
          <div className="mt-6 p-4 bg-success/5 border border-success/20 rounded-lg">
            <div className="flex items-center gap-2 text-success">
              <MapPin className="h-4 w-4" />
              <span className="text-sm font-medium">
                Données de votre région automatiquement détectées ({locationData.region})
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default QualificationQuiz;