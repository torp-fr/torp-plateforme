import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useApp } from '@/context/AppContext';
import { Header } from '@/components/Header';
import { CheckCircle, AlertTriangle, Lightbulb, TrendingUp, Download, Eye, ArrowLeft, MessageSquare } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Project } from '@/context/AppContext';

export default function Results() {
  const { currentProject, setCurrentProject } = useApp();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [displayScore, setDisplayScore] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const loadProjectData = async () => {
      // If currentProject is available, use it
      if (currentProject && currentProject.analysisResult) {
        return;
      }

      // Try to get devisId from URL params
      const devisId = searchParams.get('devisId');
      if (!devisId) {
        navigate('/analyze');
        return;
      }

      // Load project data from Supabase
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('devis')
          .select('*')
          .eq('id', devisId)
          .single();

        if (error || !data) {
          console.error('Error loading devis:', error);
          navigate('/analyze');
          return;
        }

        // Convert Supabase data to Project format
        const project: Project = {
          id: data.id,
          name: data.nom_projet,
          type: data.type_travaux || 'Non spécifié',
          status: data.status === 'analyzed' ? 'completed' : data.status as any,
          score: data.score_total || 0,
          grade: data.grade || 'C',
          amount: `${data.montant_total || 0} €`,
          createdAt: data.created_at,
          analysisResult: {
            strengths: data.points_forts || [],
            warnings: data.points_vigilance || [],
            recommendations: data.recommandations || {},
            priceComparison: data.comparaison_prix || null,
          }
        };

        setCurrentProject(project);
      } catch (error) {
        console.error('Error loading project:', error);
        navigate('/analyze');
      } finally {
        setIsLoading(false);
      }
    };

    loadProjectData();
  }, [currentProject, searchParams, navigate, setCurrentProject]);

  useEffect(() => {
    if (!currentProject) return;

    // Animation du score
    const timer = setTimeout(() => {
      const finalScore = currentProject.score || 0;
      const increment = finalScore / 50;
      const interval = setInterval(() => {
        setDisplayScore(prev => {
          if (prev >= finalScore) {
            clearInterval(interval);
            return finalScore;
          }
          return Math.min(prev + increment, finalScore);
        });
      }, 20);
      return () => clearInterval(interval);
    }, 500);
    return () => clearTimeout(timer);
  }, [currentProject]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-12 text-center">
          <div className="animate-pulse">
            <h2 className="text-2xl font-bold mb-4">Chargement des résultats...</h2>
          </div>
        </div>
      </div>
    );
  }

  if (!currentProject || !currentProject.analysisResult) {
    return null;
  }

  const { analysisResult, score = 0, grade = 'C' } = currentProject;
  
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-success';
    if (score >= 60) return 'text-warning';
    return 'text-destructive';
  };

  const getGradientColor = (score: number) => {
    if (score >= 80) return 'from-success/20 to-success/5';
    if (score >= 60) return 'from-warning/20 to-warning/5';
    return 'from-destructive/20 to-destructive/5';
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-4 mb-8">
            <Button variant="outline" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Retour au dashboard
            </Button>
          </div>

          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-foreground mb-4">
              Analyse terminée
            </h1>
            <p className="text-xl text-muted-foreground">
              Voici le score TORP et nos recommandations détaillées
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Score principal */}
            <div className="lg:col-span-1">
              <Card className="sticky top-8">
                <CardHeader className="text-center">
                  <CardTitle>Score TORP</CardTitle>
                </CardHeader>
                <CardContent className="text-center space-y-6">
                  {/* Cercle de score */}
                  <div className="relative w-48 h-48 mx-auto">
                    <svg className="w-48 h-48 transform -rotate-90">
                      <circle cx="96" cy="96" r="88" stroke="currentColor" strokeWidth="8" fill="none" className="text-muted" />
                      <circle 
                        cx="96" 
                        cy="96" 
                        r="88" 
                        stroke="currentColor" 
                        strokeWidth="8" 
                        fill="none"
                        strokeDasharray="552" 
                        strokeDashoffset={552 - (552 * displayScore) / 100}
                        className={`transition-all duration-1000 ease-out ${getScoreColor(score)}`}
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <div className={`text-6xl font-bold ${getScoreColor(score)} mb-2`}>{grade}</div>
                      <div className="text-2xl font-semibold text-foreground">{Math.round(displayScore)}/100</div>
                      <div className="text-sm text-muted-foreground">
                        {score >= 80 ? 'Excellent' : score >= 60 ? 'Correct' : 'À améliorer'}
                      </div>
                    </div>
                  </div>

                  {/* Métriques détaillées */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                      <span className="text-muted-foreground">Fiabilité entreprise</span>
                      <Badge variant="secondary" className={getScoreColor(85)}>85%</Badge>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                      <span className="text-muted-foreground">Prix cohérent</span>
                      <Badge variant="secondary" className={getScoreColor(78)}>78%</Badge>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                      <span className="text-muted-foreground">Conformité technique</span>
                      <Badge variant="secondary" className={getScoreColor(72)}>72%</Badge>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Button className="w-full">
                      <Download className="w-4 h-4 mr-2" />
                      Télécharger le rapport PDF
                    </Button>
                    <Button variant="outline" className="w-full" onClick={() => navigate('/projects')}>
                      <Eye className="w-4 h-4 mr-2" />
                      Voir tous mes projets
                    </Button>
                    <Button variant="outline" className="w-full" onClick={() => navigate('/results-interactive')}>
                      <MessageSquare className="w-4 h-4 mr-2" />
                      Accompagnement personnalisé
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Détails de l'analyse */}
            <div className="lg:col-span-2 space-y-6">
              {/* Points forts */}
              <Card className="border-success/50 bg-gradient-to-br from-success/10 to-success/5">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-success">
                    <CheckCircle className="w-5 h-5" />
                    Points forts détectés
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {analysisResult.strengths?.map((strength: string, index: number) => (
                      <li key={index} className="flex items-start gap-3">
                        <div className="w-2 h-2 bg-success rounded-full mt-2 flex-shrink-0"></div>
                        <span className="text-foreground">{strength}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              {/* Points d'attention */}
              {analysisResult.warnings && (
                <Card className="border-warning/50 bg-gradient-to-br from-warning/10 to-warning/5">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-warning">
                      <AlertTriangle className="w-5 h-5" />
                      Points à vérifier
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3">
                      {analysisResult.warnings.map((warning: string, index: number) => (
                        <li key={index} className="flex items-start gap-3">
                          <div className="w-2 h-2 bg-warning rounded-full mt-2 flex-shrink-0"></div>
                          <span className="text-foreground">{warning}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Recommandations */}
              <Card className="border-info/50 bg-gradient-to-br from-info/10 to-info/5">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-info">
                    <Lightbulb className="w-5 h-5" />
                    Recommandations TORP
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {analysisResult.recommendations?.questions && (
                    <div className="p-4 bg-background rounded-lg border">
                      <h4 className="font-semibold text-foreground mb-3">Questions à poser à l'entreprise</h4>
                      <ul className="space-y-2">
                        {analysisResult.recommendations.questions.map((question: string, index: number) => (
                          <li key={index} className="text-sm text-muted-foreground">
                            • {question}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {analysisResult.recommendations?.negotiation && (
                    <div className="p-4 bg-background rounded-lg border">
                      <h4 className="font-semibold text-foreground mb-2">Négociation suggérée</h4>
                      <p className="text-sm text-muted-foreground">
                        {analysisResult.recommendations.negotiation}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Comparaison marché */}
              {analysisResult.priceComparison && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="w-5 h-5" />
                      Comparaison prix marché local
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div className="p-4 bg-muted/50 rounded-lg">
                        <div className="text-2xl font-bold text-muted-foreground">
                          {analysisResult.priceComparison.low.toLocaleString()}€
                        </div>
                        <div className="text-sm text-muted-foreground">Fourchette basse</div>
                      </div>
                      <div className="p-4 bg-primary/10 rounded-lg border-2 border-primary/20">
                        <div className="text-2xl font-bold text-primary">
                          {analysisResult.priceComparison.current.toLocaleString()}€
                        </div>
                        <div className="text-sm text-muted-foreground">Votre devis</div>
                      </div>
                      <div className="p-4 bg-muted/50 rounded-lg">
                        <div className="text-2xl font-bold text-muted-foreground">
                          {analysisResult.priceComparison.high.toLocaleString()}€
                        </div>
                        <div className="text-sm text-muted-foreground">Fourchette haute</div>
                      </div>
                    </div>
                    <div className="mt-4 text-center text-sm text-muted-foreground">
                      Prix basé sur 847 devis similaires dans votre région
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Actions post-analyse */}
              <Card>
                <CardHeader>
                  <CardTitle>Actions disponibles</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-3 gap-4">
                    <Button 
                      variant="outline" 
                      className="h-auto p-4 flex flex-col items-center gap-2"
                      onClick={() => {
                        // Logique pour accepter le devis
                        console.log('Accepter le devis');
                      }}
                    >
                      <CheckCircle className="w-6 h-6 text-success" />
                      <span>Accepter le devis</span>
                    </Button>
                    
                    <Button 
                      variant="outline" 
                      className="h-auto p-4 flex flex-col items-center gap-2"
                      onClick={() => {
                        // Logique pour négocier
                        console.log('Négocier le devis');
                      }}
                    >
                      <Lightbulb className="w-6 h-6 text-warning" />
                      <span>Négocier</span>
                    </Button>
                    
                    <Button 
                      variant="outline" 
                      className="h-auto p-4 flex flex-col items-center gap-2"
                      onClick={() => {
                        // Logique pour refuser
                        console.log('Refuser le devis');
                      }}
                    >
                      <AlertTriangle className="w-6 h-6 text-destructive" />
                      <span>Refuser</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}