import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  TrendingUp, 
  Target, 
  Clock, 
  DollarSign, 
  Home, 
  MapPin, 
  CheckCircle,
  AlertCircle,
  Info
} from 'lucide-react';
import { type ScoringResult, type UserData } from '@/types/torp';

interface ScoringResultProps {
  result: ScoringResult;
  userData: UserData;
  onContinue: () => void;
}

const ScoringResult: React.FC<ScoringResultProps> = ({ result, userData, onContinue }) => {
  
  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'A+': return 'success';
      case 'A': return 'success';
      case 'B': return 'warning';
      case 'C': return 'warning';
      case 'D': return 'destructive';
      case 'F': return 'destructive';
      default: return 'secondary';
    }
  };

  const getRecommendations = () => {
    const recommendations = [];
    
    if (result.budget < 15) {
      recommendations.push({
        type: 'budget',
        title: 'Optimisation Budget',
        message: 'Considérez les aides disponibles pour augmenter votre capacité d\'investissement',
        icon: DollarSign,
        level: 'info'
      });
    }
    
    if (result.timeline < 10) {
      recommendations.push({
        type: 'timing',
        title: 'Planification Stratégique', 
        message: 'Un planning plus précis améliorera vos négociations avec les artisans',
        icon: Clock,
        level: 'warning'
      });
    }
    
    if (result.typeProjet >= 25) {
      recommendations.push({
        type: 'premium',
        title: 'Projet Premium Détecté',
        message: 'Votre projet nécessite un accompagnement expert personnalisé',
        icon: Target,
        level: 'success'
      });
    }

    return recommendations;
  };

  const recommendations = getRecommendations();

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Score Principal */}
      <Card className="text-center">
        <CardHeader>
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="bg-primary/10 p-3 rounded-full">
              <TrendingUp className="h-8 w-8 text-primary" />
            </div>
            <div>
              <CardTitle className="text-2xl">Scoring Initial TORP</CardTitle>
              <p className="text-muted-foreground">Analyse de votre profil projet</p>
            </div>
          </div>
          
          <div className="flex items-center justify-center gap-4">
            <div className="text-4xl font-bold text-primary">{result.total}/100</div>
            <Badge variant={getGradeColor(result.grade) as any} className="text-lg px-4 py-2">
              Grade {result.grade}
            </Badge>
          </div>
          
          <p className="text-lg mt-4 font-medium">{result.message}</p>
        </CardHeader>

        <CardContent>
          <div className="mb-6">
            <Progress value={result.total} className="h-4" />
          </div>
        </CardContent>
      </Card>

      {/* Détails du Scoring */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Home className="h-5 w-5" />
              Analyse Détaillée
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span>Type de projet</span>
              <div className="text-right">
                <span className="font-bold">{result.typeProjet}/30</span>
                <Progress value={(result.typeProjet / 30) * 100} className="w-20 h-2 mt-1" />
              </div>
            </div>
            
            <div className="flex justify-between items-center">
              <span>Budget</span>
              <div className="text-right">
                <span className="font-bold">{result.budget}/30</span>
                <Progress value={(result.budget / 30) * 100} className="w-20 h-2 mt-1" />
              </div>
            </div>
            
            <div className="flex justify-between items-center">
              <span>Timeline</span>
              <div className="text-right">
                <span className="font-bold">{result.timeline}/25</span>
                <Progress value={(result.timeline / 25) * 100} className="w-20 h-2 mt-1" />
              </div>
            </div>
            
            <div className="flex justify-between items-center">
              <span>Source de trafic</span>
              <div className="text-right">
                <span className="font-bold">{result.trafficSource}/15</span>
                <Progress value={(result.trafficSource / 15) * 100} className="w-20 h-2 mt-1" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Données Locales */}
        {userData.location && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Contexte Local
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Région</span>
                    <span className="font-medium">{userData.location.region}</span>
                  </div>
                </div>
                
                <div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Prix moyen/m²</span>
                    <span className="font-medium">{userData.location.prixMoyenM2.toLocaleString()}€</span>
                  </div>
                </div>
                
                <div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Artisans dispo.</span>
                    <span className="font-medium">{userData.location.disponibiliteArtisans}/km²</span>
                  </div>
                </div>
                
                <div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Délai moyen</span>
                    <span className="font-medium">{userData.location.delaiMoyenChantier}j</span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-success" />
                  <span className="text-success">Données automatiquement enrichies</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Recommandations */}
      {recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recommandations Personnalisées</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {recommendations.map((rec, index) => {
              const IconComponent = rec.icon;
              return (
                <div key={index} className="flex gap-3 p-4 border rounded-lg">
                  <div className={`p-2 rounded-lg ${
                    rec.level === 'success' ? 'bg-success/10 text-success' :
                    rec.level === 'warning' ? 'bg-warning/10 text-warning' :
                    'bg-primary/10 text-primary'
                  }`}>
                    <IconComponent className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium">{rec.title}</h4>
                    <p className="text-sm text-muted-foreground mt-1">{rec.message}</p>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex justify-center gap-4">
        <Button variant="outline" size="lg">
          Modifier mes réponses
        </Button>
        <Button size="lg" onClick={onContinue} className="min-w-[200px]">
          Continuer vers l'analyse
        </Button>
      </div>

      {/* Footer Info */}
      <Card className="bg-muted/30">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-primary mt-0.5" />
            <div className="text-sm">
              <p className="font-medium mb-1">Algorithme TORP v2.4</p>
              <p className="text-muted-foreground">
                Ce scoring initial est basé sur 127 critères pondérés. Il sera affiné lors de l'analyse 
                de vos devis avec nos algorithmes d'intelligence artificielle et les données de marché en temps réel.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ScoringResult;