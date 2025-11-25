import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useApp } from '@/context/AppContext';
import { Header } from '@/components/Header';
import { CheckCircle, AlertTriangle, Lightbulb, TrendingUp, Download, Eye, ArrowLeft, MessageSquare, Building2, ShieldCheck, Database } from 'lucide-react';
import type { Project } from '@/context/AppContext';

export default function Results() {
  const { currentProject, setCurrentProject } = useApp();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [displayScore, setDisplayScore] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [companyData, setCompanyData] = useState<any>(null);
  const [projectAmount, setProjectAmount] = useState<number>(0);
  const [paymentSchedule, setPaymentSchedule] = useState({
    deposit: 30,
    midpoint: 40,
    completion: 30
  });

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

        // Extract company data if available
        if (scoreEntrepriseData?.companyData) {
          console.log('[Results] Company data found:', scoreEntrepriseData.companyData);
          setCompanyData(scoreEntrepriseData.companyData);
        }

        // Store project amount for payment schedule
        if (data.montant_total) {
          setProjectAmount(data.montant_total);
        }

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, navigate]);

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
  
  const getScoreColor = (score: number) => {
    if (score >= 800) return 'text-success';
    if (score >= 600) return 'text-warning';
    if (score >= 400) return 'text-orange-500';
    return 'text-destructive';
  };

  const getGradientColor = (score: number) => {
    if (score >= 800) return 'from-success/20 to-success/5';
    if (score >= 600) return 'from-warning/20 to-warning/5';
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
                        strokeDashoffset={552 - (552 * displayScore) / 1000}
                        className={`transition-all duration-1000 ease-out ${getScoreColor(score)}`}
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <div className={`text-6xl font-bold ${getScoreColor(score)} mb-2`}>{grade}</div>
                      <div className="text-2xl font-semibold text-foreground">{score}/1000</div>
                      <div className="text-sm text-muted-foreground">
                        {score >= 800 ? 'Excellent' : score >= 600 ? 'Correct' : score >= 400 ? 'Moyen' : 'À améliorer'}
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

            {/* Détails de l'analyse */}
            <div className="lg:col-span-2 space-y-6">
              {/* Company enrichment data */}
              {companyData && (
                <Card className="border-primary/50 bg-gradient-to-br from-primary/10 to-primary/5">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-primary">
                      <Building2 className="w-5 h-5" />
                      Informations entreprise vérifiées
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Company header */}
                    <div className="p-4 bg-background rounded-lg border space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="text-xl font-bold text-foreground mb-2">{companyData.companyName}</h3>
                          <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <span className="font-semibold">SIRET:</span> {companyData.siret}
                            </span>
                            <span className="flex items-center gap-1">
                              <span className="font-semibold">SIREN:</span> {companyData.siren}
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <Badge
                            variant="secondary"
                            className="text-xs"
                          >
                            <Database className="w-3 h-3 mr-1" />
                            {companyData.dataSource === 'pappers' ? 'Données officielles' : companyData.dataSource}
                          </Badge>
                          {companyData.cached && (
                            <Badge variant="outline" className="text-xs">
                              ✓ Vérifiées
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Activity description */}
                      {companyData.data?.objet_social && (
                        <div className="pt-3 border-t">
                          <p className="text-sm text-muted-foreground mb-2">
                            <span className="font-semibold text-foreground">Activité : </span>
                            {companyData.data.objet_social.length > 200
                              ? companyData.data.objet_social.substring(0, 200) + '...'
                              : companyData.data.objet_social}
                          </p>
                        </div>
                      )}

                      {/* Tags/Hashtags */}
                      <div className="flex flex-wrap gap-2">
                        {companyData.data?.forme_juridique && (
                          <Badge variant="outline" className="text-xs">
                            {companyData.data.forme_juridique}
                          </Badge>
                        )}
                        {companyData.data?.code_naf && (
                          <Badge variant="outline" className="text-xs">
                            NAF: {companyData.data.code_naf}
                          </Badge>
                        )}
                        {companyData.data?.domaine_activite && (
                          <Badge variant="secondary" className="text-xs">
                            #{companyData.data.domaine_activite.replace(/\s+/g, '')}
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Quality and risk metrics */}
                    <div className="space-y-4">
                      {/* Quality Score */}
                      <div className="p-4 bg-background rounded-lg border">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <span className="text-sm font-semibold text-foreground">Compatibilité avec votre projet</span>
                            <p className="text-xs text-muted-foreground mt-1">Adéquation entre l'entreprise et vos besoins</p>
                          </div>
                          <ShieldCheck className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex items-end gap-2 mb-2">
                          <span className={`text-4xl font-bold ${
                            companyData.qualityScore >= 80 ? 'text-success' :
                            companyData.qualityScore >= 60 ? 'text-warning' :
                            'text-destructive'
                          }`}>
                            {companyData.qualityScore}
                          </span>
                          <span className="text-muted-foreground mb-2">/100</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2 mb-3">
                          <div
                            className={`h-2 rounded-full transition-all ${
                              companyData.qualityScore >= 80 ? 'bg-success' :
                              companyData.qualityScore >= 60 ? 'bg-warning' :
                              'bg-destructive'
                            }`}
                            style={{ width: `${companyData.qualityScore}%` }}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {companyData.qualityScore >= 80
                            ? '✓ Excellente correspondance - Cette entreprise est parfaitement adaptée à votre projet'
                            : companyData.qualityScore >= 60
                            ? '⚠ Bonne correspondance - L\'entreprise convient à votre projet'
                            : '⚠ Correspondance moyenne - Vérifiez les détails avant de vous engager'}
                        </p>
                      </div>

                      {/* Risk Level with clear recommendation */}
                      <div className={`p-4 rounded-lg border ${
                        companyData.riskLevel === 'low'
                          ? 'bg-success/5 border-success/30'
                          : companyData.riskLevel === 'medium'
                          ? 'bg-warning/5 border-warning/30'
                          : 'bg-destructive/5 border-destructive/30'
                      }`}>
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <span className="text-sm font-semibold text-foreground">Notre recommandation</span>
                            <p className="text-xs text-muted-foreground mt-1">Basée sur l'analyse des risques</p>
                          </div>
                          <AlertTriangle className={`w-5 h-5 ${
                            companyData.riskLevel === 'low' ? 'text-success' :
                            companyData.riskLevel === 'medium' ? 'text-warning' :
                            'text-destructive'
                          }`} />
                        </div>

                        <div className="mb-3">
                          <Badge
                            variant={
                              companyData.riskLevel === 'low' ? 'default' :
                              companyData.riskLevel === 'medium' ? 'secondary' :
                              'destructive'
                            }
                            className="text-base px-4 py-1.5"
                          >
                            {companyData.riskLevel === 'low' ? '✓ Risque faible' :
                             companyData.riskLevel === 'medium' ? '⚠ Risque modéré' :
                             companyData.riskLevel === 'high' ? '⚠ Risque élevé' :
                             '🚨 Risque critique'}
                          </Badge>
                        </div>

                        <div className={`p-3 rounded-lg ${
                          companyData.riskLevel === 'low'
                            ? 'bg-success/10'
                            : companyData.riskLevel === 'medium'
                            ? 'bg-warning/10'
                            : 'bg-destructive/10'
                        }`}>
                          <p className="text-sm font-semibold mb-2">
                            {companyData.riskLevel === 'low' && '✅ Oui, vous pouvez faire confiance à cette entreprise'}
                            {companyData.riskLevel === 'medium' && '⚠️ Oui, avec quelques précautions'}
                            {companyData.riskLevel === 'high' && '❌ Non, sauf si les points suivants sont clarifiés'}
                            {companyData.riskLevel === 'critical' && '🚫 Refus recommandé'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {companyData.riskLevel === 'low' &&
                              'L\'entreprise présente toutes les garanties nécessaires. Les données officielles confirment sa fiabilité et sa santé financière. Vous pouvez procéder en toute confiance.'}
                            {companyData.riskLevel === 'medium' &&
                              'L\'entreprise est globalement fiable mais présente quelques points à surveiller. Nous vous recommandons de vérifier les garanties et assurances avant de signer.'}
                            {companyData.riskLevel === 'high' &&
                              'L\'entreprise présente des signaux d\'alerte importants. Exigez des garanties supplémentaires et clarifiez les points d\'attention avant tout engagement.'}
                            {companyData.riskLevel === 'critical' &&
                              'L\'entreprise présente des risques majeurs (difficultés financières, procédures en cours). Nous vous déconseillons fortement de travailler avec cette entreprise.'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Financial data from Pappers API */}
                    {companyData.data && (
                      <div className="p-4 bg-background rounded-lg border">
                        <h4 className="font-semibold text-foreground mb-3">📊 Données financières</h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          {companyData.data.chiffre_affaires && (
                            <div>
                              <div className="text-xs text-muted-foreground mb-1">Chiffre d'affaires</div>
                              <div className="text-sm font-semibold text-foreground">
                                {(companyData.data.chiffre_affaires / 1000).toFixed(0)}k €
                              </div>
                            </div>
                          )}
                          {companyData.data.effectif && (
                            <div>
                              <div className="text-xs text-muted-foreground mb-1">Effectifs</div>
                              <div className="text-sm font-semibold text-foreground">
                                {companyData.data.effectif} personnes
                              </div>
                            </div>
                          )}
                          {companyData.data.date_creation && (
                            <div>
                              <div className="text-xs text-muted-foreground mb-1">Création</div>
                              <div className="text-sm font-semibold text-foreground">
                                {new Date(companyData.data.date_creation).getFullYear()}
                              </div>
                            </div>
                          )}
                          {companyData.data.statut_rcs && (
                            <div>
                              <div className="text-xs text-muted-foreground mb-1">Statut RCS</div>
                              <div className="text-sm font-semibold text-foreground">
                                {companyData.data.statut_rcs}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Alerts */}
                    {companyData.alerts && companyData.alerts.length > 0 && (
                      <div className="p-4 bg-destructive/10 rounded-lg border border-destructive/50">
                        <h4 className="font-semibold text-destructive mb-2">⚠️ Alertes détectées</h4>
                        <ul className="space-y-1">
                          {companyData.alerts.map((alert: string, index: number) => (
                            <li key={index} className="text-sm text-destructive flex items-start gap-2">
                              <span className="mt-0.5">•</span>
                              <span>{alert}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

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
                      Ce qu'il faut vérifier avant de signer
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground mb-4">
                      Voici les points importants à clarifier avec l'entreprise pour éviter les mauvaises surprises :
                    </p>
                    <div className="space-y-4">
                      {analysisResult.warnings.map((warning: string, index: number) => (
                        <div key={index} className="p-3 bg-background rounded-lg border border-warning/30">
                          <div className="flex items-start gap-3">
                            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-warning/20 text-warning font-bold text-sm flex-shrink-0 mt-0.5">
                              !
                            </div>
                            <div className="flex-1">
                              <p className="text-sm text-foreground leading-relaxed">{warning}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 p-3 bg-warning/10 rounded-lg border border-warning/30">
                      <p className="text-xs text-muted-foreground">
                        💡 <span className="font-semibold">Que faire ?</span> Demandez des précisions écrites à l'entreprise sur chacun de ces points avant de signer le devis.
                        N'hésitez pas à demander des garanties supplémentaires si nécessaire.
                      </p>
                    </div>
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
                  {/* Recommandations détaillées avec priorités */}
                  {analysisResult.recommendations?.actions && Array.isArray(analysisResult.recommendations.actions) && analysisResult.recommendations.actions.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="font-semibold text-foreground">Actions prioritaires</h4>
                      {analysisResult.recommendations.actions.map((action: any, index: number) => (
                        <div key={index} className={`p-4 rounded-lg border-l-4 ${
                          action.priorite === 'haute' ? 'bg-destructive/5 border-destructive' :
                          action.priorite === 'moyenne' ? 'bg-warning/5 border-warning' :
                          'bg-muted/30 border-muted'
                        }`}>
                          <div className="flex items-start justify-between mb-2">
                            <h5 className="font-semibold text-foreground">{action.titre}</h5>
                            <Badge variant={action.priorite === 'haute' ? 'destructive' : action.priorite === 'moyenne' ? 'default' : 'secondary'}>
                              {action.priorite}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">{action.description}</p>
                          <p className="text-sm font-medium text-foreground">→ {action.actionSuggeree}</p>
                          {action.impactBudget && (
                            <p className="text-sm text-success mt-2">💰 Économie potentielle : {action.impactBudget}€</p>
                          )}
                          {action.delaiAction && (
                            <p className="text-xs text-muted-foreground mt-1">⏱️ À faire sous {action.delaiAction} jours</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Questions à poser */}
                  {analysisResult.recommendations?.questions && analysisResult.recommendations.questions.length > 0 && (
                    <div className="p-4 bg-background rounded-lg border">
                      <h4 className="font-semibold text-foreground mb-3">❓ Questions à poser à l'entreprise</h4>
                      <ul className="space-y-2">
                        {analysisResult.recommendations.questions.map((question: string, index: number) => (
                          <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                            <span className="text-info mt-0.5">•</span>
                            <span>{question}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Points de négociation */}
                  {analysisResult.recommendations?.negotiation && (
                    <div className="p-4 bg-background rounded-lg border">
                      <h4 className="font-semibold text-foreground mb-2">💬 Points de négociation</h4>
                      <p className="text-sm text-muted-foreground">
                        {analysisResult.recommendations.negotiation}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Payment Schedule Proposal */}
              {projectAmount > 0 && (
                <Card className="border-info/50 bg-gradient-to-br from-info/10 to-info/5">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-info">
                      <TrendingUp className="w-5 h-5" />
                      Proposition de paiement échelonné
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Pour sécuriser votre projet, nous vous proposons un calendrier de paiement progressif lié à l'avancement des travaux. Vous pouvez ajuster les pourcentages selon vos préférences.
                    </p>

                    {/* Payment breakdown */}
                    <div className="space-y-4">
                      {/* Deposit */}
                      <div className="p-4 bg-background rounded-lg border">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <h4 className="font-semibold text-foreground">1️⃣ Acompte à la signature</h4>
                            <p className="text-xs text-muted-foreground">Engagement des deux parties</p>
                          </div>
                          <Badge variant="secondary" className="text-lg px-3 py-1">
                            {paymentSchedule.deposit}%
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <input
                            type="range"
                            min="10"
                            max="40"
                            value={paymentSchedule.deposit}
                            onChange={(e) => {
                              const deposit = parseInt(e.target.value);
                              const remaining = 100 - deposit;
                              setPaymentSchedule({
                                deposit,
                                midpoint: Math.round(remaining * 0.6),
                                completion: Math.round(remaining * 0.4)
                              });
                            }}
                            className="flex-1 mr-4"
                          />
                          <span className="text-xl font-bold text-primary">
                            {Math.round((projectAmount * paymentSchedule.deposit) / 100).toLocaleString()} €
                          </span>
                        </div>
                        <div className="mt-2 w-full bg-muted rounded-full h-2">
                          <div
                            className="h-2 rounded-l-full bg-primary transition-all"
                            style={{ width: `${paymentSchedule.deposit}%` }}
                          />
                        </div>
                      </div>

                      {/* Midpoint */}
                      <div className="p-4 bg-background rounded-lg border">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <h4 className="font-semibold text-foreground">2️⃣ Paiement intermédiaire</h4>
                            <p className="text-xs text-muted-foreground">À 50% d'avancement des travaux</p>
                          </div>
                          <Badge variant="secondary" className="text-lg px-3 py-1">
                            {paymentSchedule.midpoint}%
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <input
                            type="range"
                            min="20"
                            max="60"
                            value={paymentSchedule.midpoint}
                            onChange={(e) => {
                              const midpoint = parseInt(e.target.value);
                              const remaining = 100 - paymentSchedule.deposit - midpoint;
                              setPaymentSchedule({
                                ...paymentSchedule,
                                midpoint,
                                completion: Math.max(10, remaining)
                              });
                            }}
                            className="flex-1 mr-4"
                          />
                          <span className="text-xl font-bold text-primary">
                            {Math.round((projectAmount * paymentSchedule.midpoint) / 100).toLocaleString()} €
                          </span>
                        </div>
                        <div className="mt-2 w-full bg-muted rounded-full h-2">
                          <div
                            className="h-2 bg-warning transition-all"
                            style={{
                              width: `${paymentSchedule.midpoint}%`,
                              marginLeft: `${paymentSchedule.deposit}%`
                            }}
                          />
                        </div>
                      </div>

                      {/* Final payment */}
                      <div className="p-4 bg-background rounded-lg border">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <h4 className="font-semibold text-foreground">3️⃣ Solde à la réception</h4>
                            <p className="text-xs text-muted-foreground">Après vérification des travaux terminés</p>
                          </div>
                          <Badge variant="secondary" className="text-lg px-3 py-1">
                            {paymentSchedule.completion}%
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex-1 mr-4 text-sm text-muted-foreground">
                            Calculé automatiquement (solde restant)
                          </div>
                          <span className="text-xl font-bold text-success">
                            {Math.round((projectAmount * paymentSchedule.completion) / 100).toLocaleString()} €
                          </span>
                        </div>
                        <div className="mt-2 w-full bg-muted rounded-full h-2">
                          <div
                            className="h-2 rounded-r-full bg-success transition-all"
                            style={{
                              width: `${paymentSchedule.completion}%`,
                              marginLeft: `${paymentSchedule.deposit + paymentSchedule.midpoint}%`
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Visual progress bar */}
                    <div className="p-4 bg-background rounded-lg border">
                      <h4 className="font-semibold text-foreground mb-3">Répartition visuelle</h4>
                      <div className="w-full h-8 bg-muted rounded-full overflow-hidden flex">
                        <div
                          className="bg-primary flex items-center justify-center text-white text-xs font-semibold"
                          style={{ width: `${paymentSchedule.deposit}%` }}
                        >
                          {paymentSchedule.deposit}%
                        </div>
                        <div
                          className="bg-warning flex items-center justify-center text-white text-xs font-semibold"
                          style={{ width: `${paymentSchedule.midpoint}%` }}
                        >
                          {paymentSchedule.midpoint}%
                        </div>
                        <div
                          className="bg-success flex items-center justify-center text-white text-xs font-semibold"
                          style={{ width: `${paymentSchedule.completion}%` }}
                        >
                          {paymentSchedule.completion}%
                        </div>
                      </div>
                    </div>

                    {/* Tips */}
                    <div className="p-3 bg-info/10 rounded-lg border border-info/30">
                      <p className="text-xs text-muted-foreground">
                        💡 <span className="font-semibold">Conseil :</span> Ne versez jamais plus de 30-40% avant le démarrage des travaux.
                        Gardez toujours un solde significatif (au moins 20-30%) pour la réception finale, c'est votre garantie que les travaux seront terminés correctement.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

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