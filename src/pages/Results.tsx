import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useApp } from '@/context/AppContext';
import { Header } from '@/components/Header';
import { CheckCircle, AlertTriangle, Lightbulb, Download, Eye, ArrowLeft, MessageSquare, Building2, DollarSign, FileCheck, Shield, Clock, Ticket, TrendingUp, RefreshCw, Loader2, MapPin } from 'lucide-react';
import type { Project } from '@/context/AppContext';
import { CarteEntreprise } from '@/components/results/CarteEntreprise';
import { AnalysePrixDetaillee } from '@/components/results/AnalysePrixDetaillee';
import { AnalyseCompletetudeConformite } from '@/components/results/AnalyseCompletetudeConformite';
import { ConseilsPersonnalises } from '@/components/results/ConseilsPersonnalises';
import { InfosEntreprisePappers } from '@/components/results/InfosEntreprisePappers';
import { OngletLocalisation } from '@/components/results/OngletLocalisation';
import { RGEStatusCard } from '@/components/entreprise/RGEStatusCard';
import { TransparencyCard } from '@/components/devis/TransparencyCard';
import { generateAnalysisReportPDF } from '@/utils/pdfGenerator';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

export default function Results() {
  const { currentProject, setCurrentProject, userType, user } = useApp();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [displayScore, setDisplayScore] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingTicket, setIsGeneratingTicket] = useState(false);
  const { toast } = useToast();

  // Fonction pour générer un ticket TORP
  const generateTorpTicket = async () => {
    if (!currentProject || !user?.id) {
      toast({
        title: 'Erreur',
        description: 'Données insuffisantes pour générer le ticket',
        variant: 'destructive',
      });
      return;
    }

    setIsGeneratingTicket(true);

    try {
      // Récupérer la company de l'utilisateur avec son nom
      let companyId: string;
      let companyName: string = 'Mon entreprise';

      const { data: existingCompany, error: companyError } = await supabase
        .from('companies')
        .select('id, name')
        .eq('user_id', user.id)
        .single();

      if (companyError || !existingCompany) {
        // Si pas de company, en créer une automatiquement pour l'utilisateur B2B
        const { data: newCompany, error: createError } = await supabase
          .from('companies')
          .insert({
            user_id: user.id,
            name: user.name || 'Mon entreprise',
            email: user.email,
          })
          .select('id, name')
          .single();

        if (createError || !newCompany) {
          throw new Error('Impossible de créer l\'entreprise');
        }

        companyId = newCompany.id;
        companyName = newCompany.name || 'Mon entreprise';
      } else {
        companyId = existingCompany.id;
        companyName = existingCompany.name || 'Mon entreprise';
      }

      // Générer une référence unique de 12 caractères alphanumériques
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      let reference = '';
      for (let i = 0; i < 12; i++) {
        reference += chars.charAt(Math.floor(Math.random() * chars.length));
      }

      // Générer un code d'accès client de 8 caractères (plus court, facile à saisir)
      let codeAcces = '';
      for (let i = 0; i < 8; i++) {
        codeAcces += chars.charAt(Math.floor(Math.random() * chars.length));
      }

      // Calculer la date d'expiration (6 mois)
      const expirationDate = new Date();
      expirationDate.setMonth(expirationDate.getMonth() + 6);

      // Créer le ticket avec tous les champs
      const { data: ticket, error: ticketError } = await supabase
        .from('torp_tickets')
        .insert({
          company_id: companyId,
          reference: reference,
          code_acces: codeAcces,
          entreprise_nom: companyName,
          nom_projet: currentProject.name || 'Projet sans nom',
          score_torp: currentProject.score || 0,
          grade: currentProject.grade || 'C',
          status: 'active',
          date_emission: new Date().toISOString(),
          date_expiration: expirationDate.toISOString(),
          duree_validite: 30, // 30 jours par défaut
        })
        .select()
        .single();

      if (ticketError) {
        throw ticketError;
      }

      toast({
        title: 'Ticket TORP généré !',
        description: `Référence: ${reference}`,
      });

      // Rediriger vers la page des tickets
      navigate('/pro/tickets');
    } catch (error) {
      console.error('[Results] Erreur génération ticket:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de générer le ticket TORP',
        variant: 'destructive',
      });
    } finally {
      setIsGeneratingTicket(false);
    }
  };

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
        const extractedData = parseIfString(data.extracted_data);
        const analysisResultData = parseIfString(data.analysis_result);
        const scoreInnovationDurableData = parseIfString(data.score_innovation_durable);
        const scoreTransparenceData = parseIfString(data.score_transparence);

        console.log('[Results] Parsed score_entreprise:', scoreEntrepriseData);
        console.log('[Results] Parsed recommendations:', recommendationsData);
        console.log('[Results] Parsed extracted_data:', extractedData);
        console.log('[Results] Parsed score_transparence:', scoreTransparenceData);
        console.log('[Results] Parsed score_innovation_durable:', scoreInnovationDurableData);

        // Extraire l'adresse du chantier depuis différentes sources possibles
        const adresseChantier =
          extractedData?.travaux?.adresseChantier ||
          extractedData?.adresseChantier ||
          analysisResultData?.travaux?.adresseChantier ||
          data.adresse_chantier ||
          null;

        console.log('[Results] Adresse chantier détectée:', adresseChantier);

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
              // Extraire les données entreprise depuis extractedData (données OCR) + scoreEntreprise (scores)
              entreprise: {
                nom: extractedData?.entreprise?.nom || scoreEntrepriseData?.entreprise || scoreEntrepriseData?.nom || null,
                siret: extractedData?.entreprise?.siret || scoreEntrepriseData?.siret || null,
                codeNaf: extractedData?.entreprise?.codeNaf || scoreEntrepriseData?.codeNaf || null,
                adresse: extractedData?.entreprise?.adresse || scoreEntrepriseData?.adresse || null,
                telephone: extractedData?.entreprise?.telephone || scoreEntrepriseData?.telephone || null,
                email: extractedData?.entreprise?.email || scoreEntrepriseData?.email || null,
                age: scoreEntrepriseData?.details?.fiabilite?.anciennete || scoreEntrepriseData?.anciennete || scoreEntrepriseData?.age || null,
                certifications: Array.isArray(extractedData?.entreprise?.certifications)
                  ? extractedData.entreprise.certifications.map((c: any) => typeof c === 'string' ? c : c?.nom || c?.name || String(c))
                  : Array.isArray(scoreEntrepriseData?.certifications)
                    ? scoreEntrepriseData.certifications.map((c: any) => typeof c === 'string' ? c : c?.nom || c?.name || String(c))
                    : [],
                assurances: extractedData?.entreprise?.assurances || scoreEntrepriseData?.assurances || null,
                // Données enrichies depuis SIRET verification
                siretVerification: extractedData?.entreprise?.siretVerification || null,
              },
              scoreEntreprise: {
                ...scoreEntrepriseData,
                // S'assurer que risques et benefices sont des arrays de strings
                risques: Array.isArray(scoreEntrepriseData?.risques)
                  ? scoreEntrepriseData.risques.map((r: any) => typeof r === 'string' ? r : r?.description || r?.message || String(r))
                  : [],
                benefices: Array.isArray(scoreEntrepriseData?.benefices)
                  ? scoreEntrepriseData.benefices.map((b: any) => typeof b === 'string' ? b : b?.description || b?.message || String(b))
                  : [],
              },
              scorePrix: scorePrixData,
              // Transformer scoreCompletude pour s'assurer que les arrays sont des strings
              scoreCompletude: {
                ...scoreCompletudeData,
                elementsManquants: Array.isArray(scoreCompletudeData?.elementsManquants)
                  ? scoreCompletudeData.elementsManquants.map((e: any) => typeof e === 'string' ? e : e?.element || e?.description || String(e))
                  : [],
                incoherences: Array.isArray(scoreCompletudeData?.incoherences)
                  ? scoreCompletudeData.incoherences.map((i: any) => typeof i === 'string' ? i : i?.description || i?.message || String(i))
                  : [],
                risquesTechniques: Array.isArray(scoreCompletudeData?.risquesTechniques)
                  ? scoreCompletudeData.risquesTechniques.map((r: any) => typeof r === 'string' ? r : r?.description || r?.risque || String(r))
                  : [],
              },
              // Transformer scoreConformite pour extraire les booléens des objets
              scoreConformite: {
                scoreTotal: scoreConformiteData?.scoreTotal || 0,
                assurances: typeof scoreConformiteData?.assurances === 'boolean'
                  ? scoreConformiteData.assurances
                  : scoreConformiteData?.assurances?.conforme ?? false,
                plu: typeof scoreConformiteData?.plu === 'boolean'
                  ? scoreConformiteData.plu
                  : scoreConformiteData?.plu?.conforme ?? false,
                normes: typeof scoreConformiteData?.normes === 'boolean'
                  ? scoreConformiteData.normes
                  : (scoreConformiteData?.normes?.respectees?.length > 0 || scoreConformiteData?.normes?.conforme) ?? false,
                accessibilite: typeof scoreConformiteData?.accessibilite === 'boolean'
                  ? scoreConformiteData.accessibilite
                  : scoreConformiteData?.accessibilite?.conforme ?? false,
                defauts: Array.isArray(scoreConformiteData?.defauts)
                  ? scoreConformiteData.defauts.map((d: any) => typeof d === 'string' ? d : d?.description || d?.defaut || String(d))
                  : [],
              },
              scoreDelais: scoreDelaisData,
              montantTotal: data.recommendations?.budgetRealEstime || data.amount || data.montant_total || 0,
              margeNegociation: data.recommendations?.margeNegociation || {
                min: data.amount ? data.amount * 0.95 : 0,
                max: data.amount ? data.amount * 1.05 : 0,
              },
              surcoutsDetectes: data.detected_overcosts || data.surcouts_detectes || 0,
              budgetRealEstime: data.recommendations?.budgetRealEstime || data.amount || data.budget_reel_estime || 0,
              // Adresse du chantier pour le géocodage
              adresseChantier: adresseChantier,
              // Données RGE ADEME (vérification externe)
              rge: extractedData?.rge || null,
              // Score Innovation & Développement Durable
              scoreInnovationDurable: scoreInnovationDurableData || null,
              // Score Transparence Documentation
              scoreTransparence: scoreTransparenceData || null,
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

  // Helper function to format strength/warning items (can be string or object)
  const formatItem = (item: any): string => {
    if (typeof item === 'string') return item;
    if (typeof item === 'object' && item !== null) {
      // Handle different object structures
      if (item.aspect && item.detail) {
        return `${item.aspect}: ${item.detail}${item.impact ? ` (${item.impact})` : ''}`;
      }
      if (item.gravite && item.resolution) {
        return `${item.aspect || ''}: ${item.detail || ''} - ${item.resolution || ''}`;
      }
      // Fallback: convert object to string
      return JSON.stringify(item);
    }
    return String(item);
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
                    {rawData.scoreTransparence && (
                      <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                        <span className="text-muted-foreground">Transparence</span>
                        <Badge variant="secondary" className={getScoreColor(rawData.scoreTransparence.scoreTotal)}>{rawData.scoreTransparence.scoreTotal}%</Badge>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <Button
                      className="w-full"
                      onClick={() => {
                        if (currentProject) {
                          generateAnalysisReportPDF(currentProject);
                        }
                      }}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Télécharger le rapport PDF
                    </Button>
                    <Button variant="outline" className="w-full" onClick={() => navigate('/dashboard')}>
                      <Eye className="w-4 h-4 mr-2" />
                      Voir tous mes projets
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Détails de l'analyse - Nouveaux onglets */}
            <div className="lg:col-span-2">
              <Tabs defaultValue="synthese" className="w-full">
                <TabsList className="grid w-full grid-cols-6 mb-6">
                  <TabsTrigger value="synthese">
                    <Lightbulb className="w-4 h-4 mr-2" />
                    Synthèse
                  </TabsTrigger>
                  <TabsTrigger value="entreprise">
                    <Building2 className="w-4 h-4 mr-2" />
                    Entreprise
                  </TabsTrigger>
                  <TabsTrigger value="localisation">
                    <MapPin className="w-4 h-4 mr-2" />
                    Localisation
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
                        {analysisResult.strengths?.map((strength: any, index: number) => (
                          <li key={index} className="flex items-start gap-3">
                            <div className="w-2 h-2 bg-success rounded-full mt-2 flex-shrink-0"></div>
                            <span className="text-foreground">{formatItem(strength)}</span>
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
                          {analysisResult.warnings.map((warning: any, index: number) => (
                            <li key={index} className="flex items-start gap-3">
                              <div className="w-2 h-2 bg-warning rounded-full mt-2 flex-shrink-0"></div>
                              <span className="text-foreground">{formatItem(warning)}</span>
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
                <TabsContent value="entreprise" className="space-y-6">
                  <CarteEntreprise
                    entreprise={rawData.entreprise}
                    scoreEntreprise={rawData.scoreEntreprise}
                  />

                  {/* Statut RGE ADEME */}
                  <RGEStatusCard
                    rgeData={rawData.rge}
                    showDetails={true}
                  />

                  {/* Données enrichies Pappers */}
                  {(rawData.scoreEntreprise?.siret || rawData.scoreEntreprise?.siren) && (
                    <InfosEntreprisePappers
                      siret={rawData.scoreEntreprise?.siret}
                      siren={rawData.scoreEntreprise?.siren}
                      autoLoad={false}
                    />
                  )}
                </TabsContent>

                {/* Onglet Localisation */}
                <TabsContent value="localisation">
                  <OngletLocalisation
                    entrepriseAdresse={rawData.entreprise?.adresse}
                    chantierAdresse={rawData.adresseChantier}
                    entrepriseNom={rawData.entreprise?.nom}
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
                <TabsContent value="technique" className="space-y-6">
                  <AnalyseCompletetudeConformite
                    scoreCompletude={rawData.scoreCompletude}
                    scoreConformite={rawData.scoreConformite}
                  />

                  {/* Transparence Documentation */}
                  {rawData.scoreTransparence && (
                    <TransparencyCard
                      analysis={{
                        scoreTotal: rawData.scoreTransparence.scoreTotal || 0,
                        niveau: rawData.scoreTransparence.niveau || 'Insuffisant',
                        criteres: rawData.scoreTransparence.criteres || {},
                        pointsForts: rawData.scoreTransparence.pointsForts || [],
                        pointsFaibles: rawData.scoreTransparence.pointsFaibles || [],
                        recommandations: rawData.scoreTransparence.recommandations || [],
                      }}
                    />
                  )}
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

              {/* Actions post-analyse - Adaptées selon le type d'utilisateur */}
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle>Actions disponibles</CardTitle>
                </CardHeader>
                <CardContent>
                  {userType === 'B2B' ? (
                    /* Actions pour profil B2B (Professionnel) */
                    <div className="grid md:grid-cols-3 gap-4">
                      <Button
                        variant="outline"
                        className="h-auto p-4 flex flex-col items-center gap-2"
                        onClick={() => {
                          // Rediriger vers la page de nouvelle analyse pour optimiser
                          navigate('/pro/analyses/new');
                        }}
                      >
                        <TrendingUp className="w-6 h-6 text-primary" />
                        <span>Optimiser mon score</span>
                        <span className="text-xs text-muted-foreground">Relancer une analyse</span>
                      </Button>

                      <Button
                        variant="outline"
                        className="h-auto p-4 flex flex-col items-center gap-2"
                        onClick={() => {
                          // Valider le devis et marquer comme finalisé
                          console.log('Valider le devis');
                        }}
                      >
                        <CheckCircle className="w-6 h-6 text-success" />
                        <span>Valider mon devis</span>
                        <span className="text-xs text-muted-foreground">Marquer comme finalisé</span>
                      </Button>

                      <Button
                        variant="outline"
                        className="h-auto p-4 flex flex-col items-center gap-2"
                        onClick={generateTorpTicket}
                        disabled={isGeneratingTicket}
                      >
                        {isGeneratingTicket ? (
                          <Loader2 className="w-6 h-6 text-warning animate-spin" />
                        ) : (
                          <Ticket className="w-6 h-6 text-warning" />
                        )}
                        <span>{isGeneratingTicket ? 'Génération...' : 'Générer un ticket'}</span>
                        <span className="text-xs text-muted-foreground">Certificat TORP</span>
                      </Button>
                    </div>
                  ) : (
                    /* Actions pour profil B2C (Particulier) */
                    <div className="grid md:grid-cols-3 gap-4">
                      <Button
                        variant="outline"
                        className="h-auto p-4 flex flex-col items-center gap-2"
                        onClick={() => {
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
                          console.log('Refuser le devis');
                        }}
                      >
                        <AlertTriangle className="w-6 h-6 text-destructive" />
                        <span>Refuser</span>
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
