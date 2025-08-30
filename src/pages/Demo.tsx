import { useState } from 'react';
import { Header } from '@/components/Header';
import { BackButton } from '@/components/BackButton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Upload, 
  FileText, 
  CheckCircle, 
  AlertTriangle, 
  BarChart3, 
  Eye,
  Download,
  Search,
  TrendingUp,
  Shield,
  Clock,
  Euro
} from 'lucide-react';
import sampleDevis from '@/assets/sample-devis.jpg';

export default function Demo() {
  const [currentStep, setCurrentStep] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showResults, setShowResults] = useState(false);

  const steps = [
    'Upload du devis',
    'Analyse IA en cours',
    'Résultats disponibles'
  ];

  const handleStartDemo = () => {
    setIsAnalyzing(true);
    setCurrentStep(1);
    
    // Simulation d'analyse
    setTimeout(() => {
      setCurrentStep(2);
      setIsAnalyzing(false);
      setShowResults(true);
    }, 3000);
  };

  const mockResults = {
    score: 'A',
    scoreText: 'Excellent',
    confidence: 92,
    flags: [
      { type: 'success', text: 'Entreprise certifiée RGE', icon: CheckCircle },
      { type: 'warning', text: 'Délai de réalisation optimiste', icon: AlertTriangle },
      { type: 'success', text: 'Prix conforme au marché local', icon: Euro }
    ],
    analysis: {
      technique: 85,
      prix: 78,
      entreprise: 95,
      delais: 72
    },
    recommendations: [
      'Vérifier la disponibilité des matériaux spécifiés',
      'Demander une garantie décennale détaillée',
      'Clarifier les modalités de paiement'
    ]
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-6xl mx-auto">
          {/* En-tête */}
          <div className="text-center mb-12">
            <div className="mb-6">
              <BackButton to="/" label="Accueil" />
            </div>
            
            <h1 className="text-4xl font-bold text-foreground mb-4">
              Démonstration TORP
            </h1>
            <p className="text-xl text-muted-foreground mb-8">
              Découvrez comment TORP analyse vos devis en 3 minutes
            </p>

            {/* Indicateur de progression */}
            <div className="max-w-md mx-auto mb-8">
              <div className="flex justify-between text-sm text-muted-foreground mb-2">
                {steps.map((step, index) => (
                  <span 
                    key={index} 
                    className={`${index <= currentStep ? 'text-primary font-medium' : ''}`}
                  >
                    {step}
                  </span>
                ))}
              </div>
              <Progress value={(currentStep / (steps.length - 1)) * 100} className="h-2" />
            </div>
          </div>

          {/* Contenu principal */}
          <div className="grid lg:grid-cols-2 gap-8">
            {/* Colonne gauche - Upload et processus */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Upload className="w-5 h-5" />
                    1. Upload de votre devis
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {!showResults ? (
                    <div className="text-center space-y-4">
                      <div className="border-2 border-dashed border-border rounded-lg p-8">
                        <img 
                          src={sampleDevis} 
                          alt="Exemple de devis"
                          className="max-w-full h-32 object-cover mx-auto rounded mb-4"
                        />
                        <p className="text-muted-foreground mb-4">
                          Exemple de devis de rénovation
                        </p>
                        {!isAnalyzing && currentStep === 0 && (
                          <Button onClick={handleStartDemo} size="lg">
                            <Eye className="mr-2 h-4 w-4" />
                            Lancer la démo
                          </Button>
                        )}
                        {isAnalyzing && (
                          <div className="space-y-2">
                            <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto"></div>
                            <p className="text-sm text-muted-foreground">
                              Analyse en cours...
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center space-y-4">
                      <CheckCircle className="w-12 h-12 text-success mx-auto" />
                      <p className="font-semibold">Analyse terminée !</p>
                      <p className="text-sm text-muted-foreground">
                        Votre devis a été analysé avec succès
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Processus d'analyse */}
              {(isAnalyzing || showResults) && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Search className="w-5 h-5" />
                      2. Processus d'analyse
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${showResults ? 'bg-success' : 'bg-primary animate-pulse'}`}></div>
                        <span className="text-sm">Extraction des données</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${showResults ? 'bg-success' : currentStep >= 1 ? 'bg-primary animate-pulse' : 'bg-muted'}`}></div>
                        <span className="text-sm">Vérification entreprise</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${showResults ? 'bg-success' : currentStep >= 1 ? 'bg-primary animate-pulse' : 'bg-muted'}`}></div>
                        <span className="text-sm">Analyse technique</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${showResults ? 'bg-success' : currentStep >= 1 ? 'bg-primary animate-pulse' : 'bg-muted'}`}></div>
                        <span className="text-sm">Comparaison marché</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${showResults ? 'bg-success' : 'bg-muted'}`}></div>
                        <span className="text-sm">Génération du rapport</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Colonne droite - Résultats */}
            <div className="space-y-6">
              {showResults && (
                <>
                  {/* Score principal */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <BarChart3 className="w-5 h-5" />
                        3. Résultats TORP-Score
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-center space-y-4">
                        <div className="relative">
                          <div className="w-24 h-24 rounded-full bg-success/20 flex items-center justify-center mx-auto">
                            <span className="text-3xl font-bold text-success">{mockResults.score}</span>
                          </div>
                          <Badge className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 bg-success">
                            {mockResults.scoreText}
                          </Badge>
                        </div>
                        <p className="text-muted-foreground">
                          Confiance : {mockResults.confidence}%
                        </p>
                      </div>

                      <div className="mt-6 space-y-3">
                        {mockResults.flags.map((flag, index) => {
                          const Icon = flag.icon;
                          return (
                            <div key={index} className="flex items-center gap-3">
                              <Icon className={`w-4 h-4 ${flag.type === 'success' ? 'text-success' : 'text-warning'}`} />
                              <span className="text-sm">{flag.text}</span>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Analyse détaillée */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Analyse détaillée</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Tabs defaultValue="analysis" className="w-full">
                        <TabsList className="grid w-full grid-cols-3">
                          <TabsTrigger value="analysis">Analyse</TabsTrigger>
                          <TabsTrigger value="recommendations">Conseils</TabsTrigger>
                          <TabsTrigger value="report">Rapport</TabsTrigger>
                        </TabsList>
                        
                        <TabsContent value="analysis" className="space-y-4">
                          <div className="space-y-3">
                            <div className="flex justify-between items-center">
                              <span className="text-sm">Aspect technique</span>
                              <span className="font-medium">{mockResults.analysis.technique}%</span>
                            </div>
                            <Progress value={mockResults.analysis.technique} />
                            
                            <div className="flex justify-between items-center">
                              <span className="text-sm">Analyse prix</span>
                              <span className="font-medium">{mockResults.analysis.prix}%</span>
                            </div>
                            <Progress value={mockResults.analysis.prix} />
                            
                            <div className="flex justify-between items-center">
                              <span className="text-sm">Fiabilité entreprise</span>
                              <span className="font-medium">{mockResults.analysis.entreprise}%</span>
                            </div>
                            <Progress value={mockResults.analysis.entreprise} />
                            
                            <div className="flex justify-between items-center">
                              <span className="text-sm">Délais réalistes</span>
                              <span className="font-medium">{mockResults.analysis.delais}%</span>
                            </div>
                            <Progress value={mockResults.analysis.delais} />
                          </div>
                        </TabsContent>
                        
                        <TabsContent value="recommendations" className="space-y-3">
                          {mockResults.recommendations.map((rec, index) => (
                            <div key={index} className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                              <TrendingUp className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                              <span className="text-sm">{rec}</span>
                            </div>
                          ))}
                        </TabsContent>
                        
                        <TabsContent value="report" className="space-y-4">
                          <div className="text-center space-y-4">
                            <FileText className="w-12 h-12 text-muted-foreground mx-auto" />
                            <p className="text-sm text-muted-foreground">
                              Rapport PDF complet disponible
                            </p>
                            <Button variant="outline" className="w-full">
                              <Download className="mr-2 h-4 w-4" />
                              Télécharger le rapport
                            </Button>
                          </div>
                        </TabsContent>
                      </Tabs>
                    </CardContent>
                  </Card>
                </>
              )}

              {/* Fonctionnalités principales */}
              {!showResults && (
                <Card>
                  <CardHeader>
                    <CardTitle>Fonctionnalités TORP</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <Shield className="w-5 h-5 text-primary" />
                        <div>
                          <p className="font-medium">Vérification entreprise</p>
                          <p className="text-sm text-muted-foreground">SIREN, adresse, certifications</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <BarChart3 className="w-5 h-5 text-primary" />
                        <div>
                          <p className="font-medium">Analyse technique</p>
                          <p className="text-sm text-muted-foreground">Conformité, matériaux, méthodes</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Euro className="w-5 h-5 text-primary" />
                        <div>
                          <p className="font-medium">Comparaison prix</p>
                          <p className="text-sm text-muted-foreground">Référentiel marché local</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Clock className="w-5 h-5 text-primary" />
                        <div>
                          <p className="font-medium">Évaluation délais</p>
                          <p className="text-sm text-muted-foreground">Réalisme des planning</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          {/* CTA final */}
          {showResults && (
            <div className="mt-12 text-center space-y-6">
              <h3 className="text-2xl font-bold">Prêt à analyser vos devis ?</h3>
              <p className="text-muted-foreground">
                Commencez dès maintenant avec notre analyse gratuite
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button size="lg" asChild>
                  <a href="/analyze">
                    <Upload className="mr-2 h-4 w-4" />
                    Analyser mon devis
                  </a>
                </Button>
                <Button variant="outline" size="lg" asChild>
                  <a href="/pricing">
                    Voir les tarifs
                  </a>
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}