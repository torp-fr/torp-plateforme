import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useApp } from '@/context/AppContext';
import { Header } from '@/components/Header';
import { CheckCircle, AlertTriangle, Lightbulb, Download, Eye, ArrowLeft, MessageSquare, Building2, DollarSign, FileCheck, Shield, Clock } from 'lucide-react';
import type { Project } from '@/context/AppContext';
import { CarteEntreprise } from '@/components/results/CarteEntreprise';
import { AnalysePrixDetaillee } from '@/components/results/AnalysePrixDetaillee';
import { AnalyseCompletetudeConformite } from '@/components/results/AnalyseCompletetudeConformite';
import { ConseilsPersonnalises } from '@/components/results/ConseilsPersonnalises';

export default function Results() {
  const { currentProject, setCurrentProject } = useApp();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [displayScore, setDisplayScore] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const loadProjectData = async () => {
      // Always load from database if we have a devisId in URL
      // This ensures we get the complete, up-to-date analysis data
      const devisId = searchParams.get('devisId');
      if (!devisId) {
        navigate('/analyze');
        return;
      }

      // Load project data from Supabase using REST API to avoid blocking
      setIsLoading(true);
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseAuthKey = `sb-${supabaseUrl.split('//')[1].split('.')[0]}-auth-token`;
        const sessionData = localStorage.getItem(supabaseAuthKey);

        let accessToken = import.meta.env.VITE_SUPABASE_ANON_KEY;
        if (sessionData) {
          try {
            const session = JSON.parse(sessionData);
            accessToken = session.access_token;
          } catch (e) {
            console.error('Failed to parse session:', e);
          }
        }

        const queryUrl = `${supabaseUrl}/rest/v1/devis?id=eq.${devisId}&select=*`;
        const response = await fetch(queryUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
        });

        if (!response.ok) {
          console.error('Error loading devis:', response.status);
          navigate('/analyze');
          return;
        }

        const dataArray = await response.json();
        const data = dataArray[0];

        if (!data) {
          console.error('No devis found');
          navigate('/analyze');
          return;
        }

        // Helper function to parse JSON if it's a string, or return as-is if already parsed
        const parseIfString = (value: any) => {
          if (typeof value === 'string') {
            try {
              return JSON.parse(value);
            } catch (e) {
              console.error('[Results] Failed to parse JSON:', e);
              return {};
            }
          }
          return value || {};
        };

        // Parse JSON fields (Supabase may return them as strings or objects)
        const scoreEntrepriseData = parseIfString(data.score_entreprise);
        const scorePrixData = parseIfString(data.score_prix);
        const scoreCompletudeData = parseIfString(data.score_completude);
        const scoreConformiteData = parseIfString(data.score_conformite);
        const scoreDelaisData = parseIfString(data.score_delais);
        const recommendationsData = parseIfString(data.recommendations);

        console.log('[Results] Parsed score_entreprise:', scoreEntrepriseData);
        console.log('[Results] Parsed recommendations:', recommendationsData);

        // Extract scores from analysis objects and convert to percentages
        // TORP scores: Entreprise /250, Prix /300, Complétude /200, Conformité /150, Délais /100
        const scoreEntreprise = Math.round(((scoreEntrepriseData?.scoreTotal || 0) / 250) * 100);
        const scorePrix = Math.round(((scorePrixData?.scoreTotal || 0) / 300) * 100);
        const scoreCompletude = Math.round(((scoreCompletudeData?.scoreTotal || 0) / 200) * 100);
        const scoreConformite = Math.round(((scoreConformiteData?.scoreTotal || 0) / 150) * 100);
        const scoreDelais = Math.round(((scoreDelaisData?.scoreTotal || 0) / 100) * 100);

        console.log('[Results] Calculated scores:', { scoreEntreprise, scorePrix, scoreCompletude, scoreConformite, scoreDelais });

        // Extract different types of information from recommendations
        const pointsForts = recommendationsData.pointsForts || [];
        const pointsFaibles = recommendationsData.pointsFaibles || [];
        const questionsAPoser = recommendationsData.questionsAPoser || [];
        const pointsNegociation = recommendationsData.pointsNegociation || [];
        const recommandationsActions = recommendationsData.recommandations || [];

        console.log('[Results] Recommendations data:', { pointsForts, pointsFaibles, questionsAPoser });

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
            strengths: pointsForts.length > 0 ? pointsForts : ['Analyse complétée avec succès'],
            warnings: pointsFaibles.length > 0 ? pointsFaibles : [],
            recommendations: {
              questions: questionsAPoser,
              negotiation: pointsNegociation.length > 0 ? pointsNegociation.join(', ') : null,
              actions: recommandationsActions
            },
            priceComparison: data.comparaison_prix || null,
            detailedScores: {
              entreprise: scoreEntreprise,
              prix: scorePrix,
              completude: scoreCompletude,
              conformite: scoreConformite,
              delais: scoreDelais,
            },
            // Store raw data for new components
            rawData: {
              scoreEntreprise: scoreEntrepriseData,
              scorePrix: scorePrixData,
              scoreCompletude: scoreCompletudeData,
              scoreConformite: scoreConformiteData,
              scoreDelais: scoreDelaisData,
              montantTotal: data.amount || data.montant_total || 0,
              margeNegociation: {
                min: data.negotiation_margin_min || 0,
                max: data.negotiation_margin_max || 0,
              },
              surcoutsDetectes: data.detected_overcosts || data.surcouts_detectes || 0,
              budgetRealEstime: data.amount || data.estimated_budget || data.budget_reel_estime || 0,
            }
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
  }, [searchParams, navigate, setCurrentProject]);

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
  const detailedScores = analysisResult?.detailedScores || {
    entreprise: 0,
    prix: 0,
    completude: 0,
    conformite: 0,
    delais: 0
  };

  const rawData = analysisResult?.rawData || {};

  // Convert score from /1000 to percentage for color coding
  const scorePercentage = (score / 1000) * 100;

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-success';
    if (score >= 60) return 'text-warning';
    return 'text-destructive';
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="container mx-auto px-4 py-12">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-4 mb-8">
            <Button variant="outline" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Retour au dashboard
            </Button>
          </div>

          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-foreground mb-4">
              Analyse TORP terminée
            </h1>
            <p className="text-xl text-muted-foreground">
              Voici le score détaillé et nos recommandations personnalisées
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
                        strokeDashoffset={552 - (552 * displayScore) / 1000}
                        className={`transition-all duration-1000 ease-out ${getScoreColor(scorePercentage)}`}
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <div className={`text-6xl font-bold ${getScoreColor(scorePercentage)} mb-2`}>{grade}</div>
                      <div className="text-2xl font-semibold text-foreground">{Math.round(displayScore)}/1000</div>
                      <div className="text-sm text-muted-foreground">
                        {displayScore >= 800 ? 'Excellent' : displayScore >= 600 ? 'Correct' : 'À améliorer'}
                      </div>
                    </div>
                  </div>

                  {/* Métriques détaillées */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                      <span className="text-muted-foreground">Fiabilité entreprise</span>
                      <Badge variant="secondary" className={getScoreColor(detailedScores.entreprise)}>{detailedScores.entreprise}%</Badge>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                      <span className="text-muted-foreground">Prix cohérent</span>
                      <Badge variant="secondary" className={getScoreColor(detailedScores.prix)}>{detailedScores.prix}%</Badge>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                      <span className="text-muted-foreground">Complétude</span>
                      <Badge variant="secondary" className={getScoreColor(detailedScores.completude)}>{detailedScores.completude}%</Badge>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                      <span className="text-muted-foreground">Conformité</span>
                      <Badge variant="secondary" className={getScoreColor(detailedScores.conformite)}>{detailedScores.conformite}%</Badge>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                      <span className="text-muted-foreground">Délais</span>
                      <Badge variant="secondary" className={getScoreColor(detailedScores.delais)}>{detailedScores.delais}%</Badge>
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

            {/* Détails de l'analyse - Nouveaux onglets */}
            <div className="lg:col-span-2">
              <Tabs defaultValue="synthese" className="w-full">
                <TabsList className="grid w-full grid-cols-5 mb-6">
                  <TabsTrigger value="synthese">
                    <Lightbulb className="w-4 h-4 mr-2" />
                    Synthèse
                  </TabsTrigger>
                  <TabsTrigger value="entreprise">
                    <Building2 className="w-4 h-4 mr-2" />
                    Entreprise
                  </TabsTrigger>
                  <TabsTrigger value="prix">
                    <DollarSign className="w-4 h-4 mr-2" />
                    Prix
                  </TabsTrigger>
                  <TabsTrigger value="technique">
                    <FileCheck className="w-4 h-4 mr-2" />
                    Technique
                  </TabsTrigger>
                  <TabsTrigger value="conseils">
                    <MessageSquare className="w-4 h-4 mr-2" />
                    Conseils
                  </TabsTrigger>
                </TabsList>

                {/* Onglet Synthèse */}
                <TabsContent value="synthese" className="space-y-6">
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
                  {analysisResult.warnings && analysisResult.warnings.length > 0 && (
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

                  {/* Questions à poser */}
                  {analysisResult.recommendations?.questions && analysisResult.recommendations.questions.length > 0 && (
                    <Card className="border-info/30">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-info">
                          <MessageSquare className="w-5 h-5" />
                          Questions à poser à l'entreprise
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-2">
                          {analysisResult.recommendations.questions.map((question: string, index: number) => (
                            <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                              <span className="text-info mt-0.5">•</span>
                              <span>{question}</span>
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                {/* Onglet Entreprise */}
                <TabsContent value="entreprise">
                  <CarteEntreprise
                    entreprise={rawData.entreprise}
                    scoreEntreprise={rawData.scoreEntreprise}
                  />
                </TabsContent>

                {/* Onglet Prix */}
                <TabsContent value="prix">
                  <AnalysePrixDetaillee
                    scorePrix={rawData.scorePrix}
                    montantTotal={rawData.montantTotal}
                    margeNegociation={rawData.margeNegociation}
                    surcoutsDetectes={rawData.surcoutsDetectes}
                    budgetRealEstime={rawData.budgetRealEstime}
                    comparaisonMarche={analysisResult.priceComparison}
                  />
                </TabsContent>

                {/* Onglet Technique */}
                <TabsContent value="technique">
                  <AnalyseCompletetudeConformite
                    scoreCompletude={rawData.scoreCompletude}
                    scoreConformite={rawData.scoreConformite}
                  />
                </TabsContent>

                {/* Onglet Conseils */}
                <TabsContent value="conseils">
                  <ConseilsPersonnalises
                    grade={grade}
                    scoreTotal={score}
                    scoreEntreprise={detailedScores.entreprise}
                    scorePrix={detailedScores.prix}
                    scoreCompletude={detailedScores.completude}
                    scoreConformite={detailedScores.conformite}
                    scoreDelais={detailedScores.delais}
                    recommendations={analysisResult.recommendations}
                  />
                </TabsContent>
              </Tabs>

              {/* Actions post-analyse */}
              <Card className="mt-6">
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
