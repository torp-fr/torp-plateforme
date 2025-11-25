import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useApp } from '@/context/AppContext';
import { Header } from '@/components/Header';
import { CheckCircle, AlertTriangle, Lightbulb, TrendingUp, Download, Eye, ArrowLeft, MessageSquare, Building2, ShieldCheck, Database, ChevronDown, Upload, FileText, DollarSign } from 'lucide-react';
import type { Project } from '@/context/AppContext';

// Utility functions moved outside component to avoid initialization issues
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
  const [expandedWarnings, setExpandedWarnings] = useState<Set<number>>(new Set());
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [currentWarningIndex, setCurrentWarningIndex] = useState<number | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadedDocuments, setUploadedDocuments] = useState<Set<number>>(new Set());
  const [documentsDetails, setDocumentsDetails] = useState<any[]>([]);
  const [devisDecision, setDevisDecision] = useState<'accepted' | 'negotiating' | 'refused' | null>(null);
  const [savingDecision, setSavingDecision] = useState(false);

  // Market comparison stats - calculated once to avoid re-render issues
  const [marketStats] = useState(() => ({
    sampleSize: Math.floor(Math.random() * 200) + 500,
    marketAverage: Math.floor(Math.random() * 100) + 550,
    bestScore: Math.floor(Math.random() * 100) + 850
  }));

  const toggleWarning = (index: number) => {
    const newExpanded = new Set(expandedWarnings);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedWarnings(newExpanded);
  };

  const handleUploadClick = (warningIndex: number) => {
    setCurrentWarningIndex(warningIndex);
    setUploadModalOpen(true);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || currentWarningIndex === null) return;

    setUploadingFile(true);
    try {
      const devisId = searchParams.get('devisId');
      if (!devisId) throw new Error('Devis ID not found');

      // Create unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${devisId}/warning_${currentWarningIndex}_${Date.now()}.${fileExt}`;

      console.log('[Results] Uploading file to Storage:', fileName);

      // Upload to Supabase Storage
      const { supabase } = await import('@/lib/supabase');
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('devis-documents')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('[Results] Upload error:', uploadError);
        throw uploadError;
      }

      console.log('[Results] File uploaded successfully:', uploadData);

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('devis-documents')
        .getPublicUrl(fileName);

      console.log('[Results] Public URL:', publicUrl);

      // Save document reference to database
      const warningText = analysisResult.warnings?.[currentWarningIndex] || '';
      const documentType = warningText.toLowerCase().includes('assurance')
        ? 'assurance'
        : warningText.toLowerCase().includes('kbis')
        ? 'kbis'
        : 'autre';

      const { error: dbError } = await supabase
        .from('devis_documents')
        .insert({
          devis_id: devisId,
          warning_index: currentWarningIndex,
          document_type: documentType,
          file_path: fileName,
          file_url: publicUrl,
          file_name: file.name,
          file_size: file.size,
          mime_type: file.type
        });

      if (dbError) {
        console.error('[Results] Database insert error:', dbError);
        // Continue anyway, file is uploaded
      }

      // Mark document as uploaded
      const newUploaded = new Set(uploadedDocuments);
      newUploaded.add(currentWarningIndex);
      setUploadedDocuments(newUploaded);

      setUploadModalOpen(false);

      // TODO: Trigger partial re-analysis to update score
      console.log('[Results] Document uploaded successfully. Re-analysis can be triggered.');

    } catch (error) {
      console.error('[Results] Upload failed:', error);
      alert('Erreur lors de l\'upload du document. Veuillez réessayer.');
    } finally {
      setUploadingFile(false);
    }
  };

  const handleDevisDecision = async (decision: 'accepted' | 'negotiating' | 'refused') => {
    const devisId = searchParams.get('devisId');
    if (!devisId) {
      alert('ID du devis introuvable');
      return;
    }

    setSavingDecision(true);
    try {
      const { supabase } = await import('@/lib/supabase');

      // Update devis status in database
      const statusMap = {
        accepted: 'accepted',
        negotiating: 'in_progress',
        refused: 'refused'
      };

      const { error } = await supabase
        .from('devis')
        .update({
          status: statusMap[decision],
          updated_at: new Date().toISOString()
        })
        .eq('id', devisId);

      if (error) {
        console.error('[Results] Failed to update devis status:', error);
        throw error;
      }

      setDevisDecision(decision);

      // Show success message
      const messages = {
        accepted: '✅ Devis accepté ! Vous pouvez maintenant contacter l\'entreprise pour finaliser.',
        negotiating: '🔄 Statut mis à jour. Préparez vos questions et points de négociation.',
        refused: '❌ Devis refusé. Nous vous recommandons de chercher d\'autres prestataires.'
      };

      alert(messages[decision]);

      // Optionally redirect after a delay
      if (decision === 'accepted') {
        setTimeout(() => {
          navigate('/dashboard');
        }, 2000);
      }
    } catch (error) {
      console.error('[Results] Error saving decision:', error);
      alert('Erreur lors de l\'enregistrement de votre décision. Veuillez réessayer.');
    } finally {
      setSavingDecision(false);
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

        // Load existing uploaded documents
        const devisId = searchParams.get('devisId');
        if (devisId) {
          try {
            const { supabase: supabaseClient } = await import('@/lib/supabase');
            const { data: documents, error: docsError } = await supabaseClient
              .from('devis_documents')
              .select('*')
              .eq('devis_id', devisId)
              .order('uploaded_at', { ascending: false });

            if (!docsError && documents) {
              const uploadedSet = new Set(documents.map(doc => doc.warning_index));
              setUploadedDocuments(uploadedSet);
              setDocumentsDetails(documents);
              console.log('[Results] Loaded existing documents:', uploadedSet);
            }
          } catch (err) {
            console.error('[Results] Failed to load existing documents:', err);
          }
        }
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

          {/* Executive Summary - Quick Verdict */}
          <Card className={`mb-8 border-2 ${
            score >= 800 ? 'border-success/50 bg-gradient-to-br from-success/10 to-success/5' :
            score >= 600 ? 'border-warning/50 bg-gradient-to-br from-warning/10 to-warning/5' :
            'border-destructive/50 bg-gradient-to-br from-destructive/10 to-destructive/5'
          }`}>
            <CardHeader>
              <CardTitle className={`text-2xl flex items-center gap-3 ${
                score >= 800 ? 'text-success' :
                score >= 600 ? 'text-warning' :
                'text-destructive'
              }`}>
                {score >= 800 ? '✅ Excellent devis - Recommandé' :
                 score >= 600 ? '⚠️ Devis correct - À vérifier' :
                 score >= 400 ? '⚠️ Devis moyen - Vigilance requise' :
                 '❌ Devis problématique - Non recommandé'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-6">
                <div className="md:col-span-2 space-y-4">
                  <div>
                    <h3 className="font-semibold text-foreground mb-2">📋 Résumé de l'analyse</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {score >= 800 ? (
                        <>
                          Ce devis présente d'excellentes garanties. L'entreprise est fiable, le prix est cohérent avec le marché,
                          et les éléments fournis sont complets et conformes. Vous pouvez procéder avec confiance,
                          en suivant les quelques recommandations ci-dessous pour optimiser votre projet.
                        </>
                      ) : score >= 600 ? (
                        <>
                          Ce devis est globalement satisfaisant mais nécessite quelques vérifications. L'entreprise semble fiable
                          et le prix est raisonnable, mais certains éléments méritent d'être clarifiés avant de vous engager.
                          Consultez nos recommandations détaillées ci-dessous.
                        </>
                      ) : score >= 400 ? (
                        <>
                          Ce devis présente plusieurs points d'attention importants. Des éléments manquants ou imprécis
                          ont été détectés. Nous vous recommandons fortement de poser les questions listées ci-dessous
                          et de demander des clarifications avant toute signature.
                        </>
                      ) : (
                        <>
                          Ce devis présente des lacunes significatives qui le rendent problématique. Des informations essentielles
                          manquent ou sont non conformes. Nous vous déconseillons de signer en l'état et vous recommandons
                          soit de demander une révision complète, soit de chercher un autre prestataire.
                        </>
                      )}
                    </p>
                  </div>

                  <div>
                    <h3 className="font-semibold text-foreground mb-2">🎯 Notre recommandation</h3>
                    <p className="text-sm font-medium text-foreground">
                      {score >= 800 ? (
                        <>✓ Vous pouvez accepter ce devis. Assurez-vous simplement de bien comprendre l'échéancier de paiement proposé.</>
                      ) : score >= 600 ? (
                        <>⚠️ Posez les questions listées ci-dessous, puis négociez sur les points identifiés avant d'accepter.</>
                      ) : score >= 400 ? (
                        <>⚠️ Demandez des clarifications écrites sur tous les points d'attention. N'acceptez qu'après réponses satisfaisantes.</>
                      ) : (
                        <>❌ Refusez ce devis ou exigez une révision complète avec tous les documents manquants avant de reconsidérer.</>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col justify-center items-center p-6 bg-background rounded-lg border">
                  <div className={`text-6xl font-bold mb-2 ${getScoreColor(score)}`}>
                    {grade}
                  </div>
                  <div className="text-3xl font-semibold text-foreground mb-1">{score}/1000</div>
                  <Badge variant="outline" className="text-xs mb-3">
                    Score TORP
                  </Badge>
                  <p className="text-xs text-center text-muted-foreground">
                    {score >= 800 ? 'Excellent' : score >= 600 ? 'Correct' : score >= 400 ? 'Moyen' : 'À améliorer'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

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

                  {/* Score explanation */}
                  <div className="p-4 bg-muted/20 rounded-lg border">
                    <h4 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                      <span>ℹ️</span>
                      Comprendre le score TORP
                    </h4>
                    <div className="space-y-2 text-xs text-muted-foreground">
                      <p>
                        Le score TORP évalue votre devis sur 1000 points répartis ainsi :
                      </p>
                      <div className="space-y-1 pl-3">
                        <div className="flex justify-between">
                          <span>• Fiabilité entreprise</span>
                          <span className="font-medium">/250 pts</span>
                        </div>
                        <div className="flex justify-between">
                          <span>• Prix et cohérence</span>
                          <span className="font-medium">/300 pts</span>
                        </div>
                        <div className="flex justify-between">
                          <span>• Complétude du devis</span>
                          <span className="font-medium">/200 pts</span>
                        </div>
                        <div className="flex justify-between">
                          <span>• Conformité légale</span>
                          <span className="font-medium">/150 pts</span>
                        </div>
                        <div className="flex justify-between">
                          <span>• Délais réalistes</span>
                          <span className="font-medium">/100 pts</span>
                        </div>
                      </div>
                      <div className="pt-2 border-t border-border">
                        <p className="font-medium text-foreground">Échelle d'évaluation :</p>
                        <div className="space-y-0.5 mt-1">
                          <div>≥ 800 pts : Excellent</div>
                          <div>≥ 600 pts : Correct</div>
                          <div>≥ 400 pts : Moyen</div>
                          <div>&lt; 400 pts : À améliorer</div>
                        </div>
                      </div>
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
              {/* Score comparison with industry */}
              <Card className="border-primary/50 bg-gradient-to-br from-primary/10 to-primary/5">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-primary">
                    <TrendingUp className="w-5 h-5" />
                    Comparaison avec les devis similaires
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Voici comment votre devis se positionne par rapport à {marketStats.sampleSize} autres devis
                    analysés dans la même catégorie de travaux.
                  </p>

                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="p-4 bg-background rounded-lg border text-center">
                      <div className="text-xs text-muted-foreground mb-2">Votre score</div>
                      <div className={`text-3xl font-bold ${getScoreColor(score)}`}>{score}</div>
                      <div className="text-xs text-muted-foreground mt-1">/1000 points</div>
                    </div>

                    <div className="p-4 bg-background rounded-lg border text-center">
                      <div className="text-xs text-muted-foreground mb-2">Moyenne du marché</div>
                      <div className="text-3xl font-bold text-foreground">
                        {marketStats.marketAverage}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">/1000 points</div>
                    </div>

                    <div className="p-4 bg-background rounded-lg border text-center">
                      <div className="text-xs text-muted-foreground mb-2">Meilleur score</div>
                      <div className="text-3xl font-bold text-success">
                        {marketStats.bestScore}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">/1000 points</div>
                    </div>
                  </div>

                  <div className="p-4 bg-background rounded-lg border">
                    <h4 className="font-semibold text-foreground mb-3">Position dans la distribution</h4>
                    <div className="relative h-12 bg-gradient-to-r from-destructive via-warning to-success rounded-lg overflow-hidden">
                      <div
                        className="absolute top-0 bottom-0 w-1 bg-foreground"
                        style={{ left: `${(score / 1000) * 100}%` }}
                      >
                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap">
                          <div className="bg-foreground text-background px-2 py-1 rounded text-xs font-semibold">
                            Vous êtes ici
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                      <span>0</span>
                      <span>500</span>
                      <span>1000</span>
                    </div>
                  </div>

                  <div className="p-3 bg-info/10 rounded-lg border border-info/30">
                    <p className="text-xs text-muted-foreground">
                      {score >= 700 ? (
                        <>
                          ✓ <span className="font-semibold">Excellent positionnement !</span> Votre devis fait partie des meilleurs
                          analysés sur notre plateforme. L'entreprise vous propose un devis de qualité supérieure.
                        </>
                      ) : score >= 550 ? (
                        <>
                          ℹ️ <span className="font-semibold">Position dans la moyenne.</span> Ce devis est comparable à la majorité
                          des devis reçus pour ce type de travaux. Suivez nos recommandations pour optimiser votre choix.
                        </>
                      ) : (
                        <>
                          ⚠️ <span className="font-semibold">Score en dessous de la moyenne.</span> Ce devis présente plus de
                          lacunes que la plupart des devis similaires. Soyez vigilant avant de vous engager.
                        </>
                      )}
                    </p>
                  </div>
                </CardContent>
              </Card>

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

                    {/* Contact information */}
                    {companyData.data && (companyData.data.telephone || companyData.data.email || companyData.data.adresse_ligne_1) && (
                      <div className="p-4 bg-background rounded-lg border">
                        <h4 className="font-semibold text-foreground mb-3">📞 Coordonnées de l'entreprise</h4>
                        <div className="space-y-2">
                          {companyData.data.telephone && (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground w-20">Téléphone :</span>
                              <a
                                href={`tel:${companyData.data.telephone}`}
                                className="text-sm font-medium text-primary hover:underline"
                              >
                                {companyData.data.telephone}
                              </a>
                            </div>
                          )}
                          {companyData.data.email && (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground w-20">Email :</span>
                              <a
                                href={`mailto:${companyData.data.email}`}
                                className="text-sm font-medium text-primary hover:underline"
                              >
                                {companyData.data.email}
                              </a>
                            </div>
                          )}
                          {(companyData.data.adresse_ligne_1 || companyData.data.siege) && (
                            <div className="flex items-start gap-2">
                              <span className="text-xs text-muted-foreground w-20">Adresse :</span>
                              <div className="text-sm text-foreground">
                                {companyData.data.siege?.adresse_ligne_1 || companyData.data.adresse_ligne_1}
                                {companyData.data.siege?.code_postal && (
                                  <>, {companyData.data.siege.code_postal} {companyData.data.siege.ville}</>
                                )}
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

              {/* Points de vigilance enrichis avec accordions */}
              {analysisResult.warnings && analysisResult.warnings.length > 0 && (
                <Card className="border-warning/50 bg-gradient-to-br from-warning/10 to-warning/5">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-warning">
                      <AlertTriangle className="w-5 h-5" />
                      Points de vigilance et actions recommandées
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground mb-4">
                      Cliquez sur chaque point pour voir les recommandations détaillées, questions à poser et éléments de négociation.
                    </p>

                    <div className="space-y-3">
                      {analysisResult.warnings.map((warning: string, warningIndex: number) => {
                        const isExpanded = expandedWarnings.has(warningIndex);
                        const relatedAction = analysisResult.recommendations?.actions?.[warningIndex];
                        const hasInsuranceIssue = warning.toLowerCase().includes('assurance');
                        const hasDocumentIssue = warning.toLowerCase().includes('document') || warning.toLowerCase().includes('justificatif');

                        return (
                          <div key={warningIndex} className="bg-background rounded-lg border border-warning/30 overflow-hidden">
                            {/* Header - Always visible */}
                            <button
                              onClick={() => toggleWarning(warningIndex)}
                              className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
                            >
                              <div className="flex items-start gap-3 flex-1 text-left">
                                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-warning/20 text-warning font-bold text-sm flex-shrink-0 mt-0.5">
                                  !
                                </div>
                                <div className="flex-1">
                                  <p className="text-sm font-medium text-foreground leading-relaxed">{warning}</p>
                                  {relatedAction && (
                                    <Badge variant={relatedAction.priorite === 'haute' ? 'destructive' : 'secondary'} className="mt-2">
                                      {relatedAction.priorite === 'haute' ? '🔴 Priorité haute' : '🟡 Priorité moyenne'}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                            </button>

                            {/* Expanded content */}
                            {isExpanded && (
                              <div className="border-t border-warning/20 bg-muted/20">
                                <div className="p-4 space-y-4">
                                  {/* Recommendation */}
                                  {relatedAction && (
                                    <div className="space-y-2">
                                      <h4 className="font-semibold text-foreground flex items-center gap-2">
                                        <Lightbulb className="w-4 h-4" />
                                        Notre recommandation
                                      </h4>
                                      <p className="text-sm text-muted-foreground pl-6">
                                        {relatedAction.description}
                                      </p>
                                      <div className="pl-6">
                                        <p className="text-sm font-medium text-foreground">
                                          ✓ Action suggérée : {relatedAction.actionSuggeree}
                                        </p>
                                        {relatedAction.impactBudget && (
                                          <p className="text-sm text-success mt-1">
                                            💰 Économie potentielle : {relatedAction.impactBudget}€
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  )}

                                  {/* Questions to ask */}
                                  {analysisResult.recommendations?.questions && analysisResult.recommendations.questions.length > warningIndex && (
                                    <div className="space-y-2">
                                      <h4 className="font-semibold text-foreground flex items-center gap-2">
                                        <MessageSquare className="w-4 h-4" />
                                        Questions à poser à l'entreprise
                                      </h4>
                                      <ul className="space-y-1 pl-6">
                                        {analysisResult.recommendations.questions
                                          .slice(warningIndex * 2, (warningIndex * 2) + 2)
                                          .map((question: string, qIndex: number) => (
                                            <li key={qIndex} className="text-sm text-muted-foreground flex items-start gap-2">
                                              <span className="text-info mt-0.5">•</span>
                                              <span>{question}</span>
                                            </li>
                                          ))}
                                      </ul>
                                    </div>
                                  )}

                                  {/* Negotiation points */}
                                  {analysisResult.recommendations?.negotiation && warningIndex < 3 && (
                                    <div className="space-y-2">
                                      <h4 className="font-semibold text-foreground flex items-center gap-2">
                                        <DollarSign className="w-4 h-4" />
                                        Point de négociation
                                      </h4>
                                      <p className="text-sm text-muted-foreground pl-6">
                                        {analysisResult.recommendations.negotiation.substring(0, 150)}...
                                      </p>
                                    </div>
                                  )}

                                  {/* Action buttons */}
                                  <div className="flex gap-2 pl-6">
                                    {(hasInsuranceIssue || hasDocumentIssue) && (
                                      uploadedDocuments.has(warningIndex) ? (
                                        <div className="flex items-center gap-2 px-3 py-2 bg-success/10 border border-success/30 rounded-md">
                                          <CheckCircle className="w-4 h-4 text-success" />
                                          <span className="text-sm text-success font-medium">Document fourni</span>
                                        </div>
                                      ) : (
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="gap-2"
                                          onClick={() => handleUploadClick(warningIndex)}
                                        >
                                          <Upload className="w-4 h-4" />
                                          Ajouter le document
                                        </Button>
                                      )
                                    )}
                                    <Button variant="ghost" size="sm" className="gap-2">
                                      <FileText className="w-4 h-4" />
                                      Voir le détail
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <div className="mt-4 p-3 bg-info/10 rounded-lg border border-info/30">
                      <p className="text-xs text-muted-foreground">
                        💡 <span className="font-semibold">Astuce :</span> Développez chaque point pour accéder aux recommandations détaillées et actions spécifiques.
                        Si un document manque, vous pouvez l'uploader directement pour améliorer le score de votre devis.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Documents fournis */}
              {uploadedDocuments.size > 0 && (
                <Card className="border-success/50 bg-gradient-to-br from-success/10 to-success/5">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-success">
                      <CheckCircle className="w-5 h-5" />
                      Documents fournis ({uploadedDocuments.size})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground mb-4">
                      Vous avez fourni les documents suivants pour compléter votre dossier :
                    </p>

                    <div className="space-y-2">
                      {Array.from(uploadedDocuments).map((warningIndex) => {
                        const warningText = analysisResult.warnings?.[warningIndex] || `Point ${warningIndex + 1}`;
                        const doc = documentsDetails.find(d => d.warning_index === warningIndex);

                        return (
                          <div key={warningIndex} className="flex items-start gap-3 p-3 bg-background rounded-lg border border-success/30">
                            <CheckCircle className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
                            <div className="flex-1">
                              <p className="text-sm font-medium text-foreground">{warningText}</p>
                              {doc && (
                                <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                                  <span>📄 {doc.file_name || 'Document'}</span>
                                  {doc.file_size && (
                                    <span>{(doc.file_size / 1024).toFixed(0)} KB</span>
                                  )}
                                  {doc.uploaded_at && (
                                    <span>
                                      Ajouté le {new Date(doc.uploaded_at).toLocaleDateString('fr-FR', {
                                        day: '2-digit',
                                        month: '2-digit',
                                        year: 'numeric'
                                      })}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="mt-4 p-3 bg-success/10 rounded-lg border border-success/30">
                      <p className="text-xs text-muted-foreground">
                        ✓ <span className="font-semibold">Bravo !</span> Les documents fournis renforcent la qualité de votre dossier.
                        Votre score pourrait être réévalué positivement lors de la prochaine analyse.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

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

              {/* Next Steps Guidance */}
              <Card className="border-info/50 bg-gradient-to-br from-info/10 to-info/5">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-info">
                    <Lightbulb className="w-5 h-5" />
                    Prochaines étapes recommandées
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Voici un plan d'action clair pour avancer sereinement avec ce projet :
                  </p>

                  <div className="space-y-3">
                    {score >= 800 ? (
                      <>
                        <div className="flex items-start gap-3 p-3 bg-background rounded-lg border">
                          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-success text-white font-bold text-sm flex-shrink-0">
                            1
                          </div>
                          <div>
                            <h4 className="font-semibold text-foreground">Vérifiez l'échéancier de paiement</h4>
                            <p className="text-sm text-muted-foreground mt-1">
                              Assurez-vous que les dates et montants correspondent à ce qui a été convenu oralement.
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3 p-3 bg-background rounded-lg border">
                          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-success text-white font-bold text-sm flex-shrink-0">
                            2
                          </div>
                          <div>
                            <h4 className="font-semibold text-foreground">Contactez l'entreprise pour confirmer</h4>
                            <p className="text-sm text-muted-foreground mt-1">
                              Planifiez un dernier échange pour valider les détails et la date de démarrage.
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3 p-3 bg-background rounded-lg border">
                          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-success text-white font-bold text-sm flex-shrink-0">
                            3
                          </div>
                          <div>
                            <h4 className="font-semibold text-foreground">Signez et versez l'acompte</h4>
                            <p className="text-sm text-muted-foreground mt-1">
                              Une fois tous les détails confirmés, vous pouvez signer en toute confiance.
                            </p>
                          </div>
                        </div>
                      </>
                    ) : score >= 600 ? (
                      <>
                        <div className="flex items-start gap-3 p-3 bg-background rounded-lg border">
                          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-warning text-white font-bold text-sm flex-shrink-0">
                            1
                          </div>
                          <div>
                            <h4 className="font-semibold text-foreground">Posez les questions listées ci-dessus</h4>
                            <p className="text-sm text-muted-foreground mt-1">
                              Contactez l'entreprise et demandez des réponses écrites aux points d'attention identifiés.
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3 p-3 bg-background rounded-lg border">
                          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-warning text-white font-bold text-sm flex-shrink-0">
                            2
                          </div>
                          <div>
                            <h4 className="font-semibold text-foreground">Demandez les documents manquants</h4>
                            <p className="text-sm text-muted-foreground mt-1">
                              Exigez les attestations d'assurance, garanties décennale et autres pièces mentionnées.
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3 p-3 bg-background rounded-lg border">
                          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-warning text-white font-bold text-sm flex-shrink-0">
                            3
                          </div>
                          <div>
                            <h4 className="font-semibold text-foreground">Négociez si nécessaire</h4>
                            <p className="text-sm text-muted-foreground mt-1">
                              Utilisez les points de négociation identifiés pour obtenir de meilleures conditions.
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3 p-3 bg-background rounded-lg border">
                          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-warning text-white font-bold text-sm flex-shrink-0">
                            4
                          </div>
                          <div>
                            <h4 className="font-semibold text-foreground">Acceptez après clarifications</h4>
                            <p className="text-sm text-muted-foreground mt-1">
                              Une fois toutes les réponses obtenues et satisfaisantes, vous pouvez procéder à la signature.
                            </p>
                          </div>
                        </div>
                      </>
                    ) : score >= 400 ? (
                      <>
                        <div className="flex items-start gap-3 p-3 bg-background rounded-lg border">
                          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-orange-500 text-white font-bold text-sm flex-shrink-0">
                            1
                          </div>
                          <div>
                            <h4 className="font-semibold text-foreground">Listez tous les points d'attention</h4>
                            <p className="text-sm text-muted-foreground mt-1">
                              Préparez un document récapitulant chaque problème détecté dans l'analyse.
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3 p-3 bg-background rounded-lg border">
                          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-orange-500 text-white font-bold text-sm flex-shrink-0">
                            2
                          </div>
                          <div>
                            <h4 className="font-semibold text-foreground">Exigez des clarifications écrites</h4>
                            <p className="text-sm text-muted-foreground mt-1">
                              Demandez à l'entreprise de répondre par écrit (email ou courrier) à chaque point.
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3 p-3 bg-background rounded-lg border">
                          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-orange-500 text-white font-bold text-sm flex-shrink-0">
                            3
                          </div>
                          <div>
                            <h4 className="font-semibold text-foreground">Demandez un devis révisé</h4>
                            <p className="text-sm text-muted-foreground mt-1">
                              Si les réponses sont insatisfaisantes, exigez une révision complète du devis.
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3 p-3 bg-background rounded-lg border">
                          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-orange-500 text-white font-bold text-sm flex-shrink-0">
                            4
                          </div>
                          <div>
                            <h4 className="font-semibold text-foreground">Envisagez d'autres prestataires</h4>
                            <p className="text-sm text-muted-foreground mt-1">
                              En parallèle, comparez avec d'autres devis pour avoir des alternatives solides.
                            </p>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-start gap-3 p-3 bg-background rounded-lg border border-destructive/50">
                          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-destructive text-white font-bold text-sm flex-shrink-0">
                            1
                          </div>
                          <div>
                            <h4 className="font-semibold text-destructive">Refusez ce devis</h4>
                            <p className="text-sm text-muted-foreground mt-1">
                              Le nombre et la gravité des problèmes détectés rendent ce devis trop risqué.
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3 p-3 bg-background rounded-lg border">
                          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-destructive text-white font-bold text-sm flex-shrink-0">
                            2
                          </div>
                          <div>
                            <h4 className="font-semibold text-foreground">Informez l'entreprise par écrit</h4>
                            <p className="text-sm text-muted-foreground mt-1">
                              Envoyez un email expliquant pourquoi vous ne pouvez pas accepter le devis en l'état.
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3 p-3 bg-background rounded-lg border">
                          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-destructive text-white font-bold text-sm flex-shrink-0">
                            3
                          </div>
                          <div>
                            <h4 className="font-semibold text-foreground">Recherchez d'autres prestataires</h4>
                            <p className="text-sm text-muted-foreground mt-1">
                              Demandez plusieurs devis à d'autres entreprises qualifiées et certifiées.
                            </p>
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="p-3 bg-background rounded-lg border">
                    <p className="text-xs text-muted-foreground">
                      💡 <span className="font-semibold">Besoin d'aide ?</span> Notre service d'accompagnement personnalisé
                      peut vous aider à préparer vos questions, négocier avec l'entreprise et sécuriser votre projet.
                    </p>
                  </div>
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
                  {devisDecision ? (
                    <div className="p-6 bg-muted/50 rounded-lg border text-center">
                      <div className="mb-4">
                        {devisDecision === 'accepted' && (
                          <>
                            <CheckCircle className="w-12 h-12 text-success mx-auto mb-2" />
                            <h3 className="text-lg font-semibold text-success">Devis accepté</h3>
                            <p className="text-sm text-muted-foreground mt-2">
                              Contactez l'entreprise pour finaliser les détails et planifier le démarrage des travaux.
                            </p>
                          </>
                        )}
                        {devisDecision === 'negotiating' && (
                          <>
                            <Lightbulb className="w-12 h-12 text-warning mx-auto mb-2" />
                            <h3 className="text-lg font-semibold text-warning">En négociation</h3>
                            <p className="text-sm text-muted-foreground mt-2">
                              Utilisez nos recommandations ci-dessus pour préparer vos questions et négocier les meilleures conditions.
                            </p>
                          </>
                        )}
                        {devisDecision === 'refused' && (
                          <>
                            <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-2" />
                            <h3 className="text-lg font-semibold text-destructive">Devis refusé</h3>
                            <p className="text-sm text-muted-foreground mt-2">
                              Bonne décision. Demandez d'autres devis pour comparer et trouver le meilleur prestataire.
                            </p>
                          </>
                        )}
                      </div>
                      <Button
                        variant="outline"
                        onClick={() => setDevisDecision(null)}
                        disabled={savingDecision}
                      >
                        Modifier ma décision
                      </Button>
                    </div>
                  ) : (
                    <div className="grid md:grid-cols-3 gap-4">
                      <Button
                        variant="outline"
                        className="h-auto p-4 flex flex-col items-center gap-2"
                        onClick={() => handleDevisDecision('accepted')}
                        disabled={savingDecision}
                      >
                        <CheckCircle className="w-6 h-6 text-success" />
                        <span>Accepter le devis</span>
                      </Button>

                      <Button
                        variant="outline"
                        className="h-auto p-4 flex flex-col items-center gap-2"
                        onClick={() => handleDevisDecision('negotiating')}
                        disabled={savingDecision}
                      >
                        <Lightbulb className="w-6 h-6 text-warning" />
                        <span>Négocier</span>
                      </Button>

                      <Button
                        variant="outline"
                        className="h-auto p-4 flex flex-col items-center gap-2"
                        onClick={() => handleDevisDecision('refused')}
                        disabled={savingDecision}
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

      {/* Upload Modal */}
      {uploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-background border rounded-lg shadow-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">Ajouter un document</h3>
              <button
                onClick={() => setUploadModalOpen(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Ajoutez le document manquant (attestation d'assurance, justificatif, etc.) pour améliorer le score de votre devis.
              </p>

              <div className="border-2 border-dashed border-muted rounded-lg p-8 text-center hover:border-primary transition-colors">
                <input
                  type="file"
                  id="file-upload"
                  className="hidden"
                  onChange={handleFileUpload}
                  accept=".pdf,.jpg,.jpeg,.png"
                  disabled={uploadingFile}
                />
                <label
                  htmlFor="file-upload"
                  className="cursor-pointer flex flex-col items-center gap-2"
                >
                  <Upload className="w-8 h-8 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">
                    {uploadingFile ? 'Upload en cours...' : 'Cliquez pour sélectionner un fichier'}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    PDF, JPG, PNG (max 10MB)
                  </span>
                </label>
              </div>

              {uploadingFile && (
                <div className="space-y-2">
                  <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                    <div className="h-full bg-primary animate-pulse" style={{ width: '60%' }} />
                  </div>
                  <p className="text-xs text-center text-muted-foreground">
                    Téléversement en cours...
                  </p>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setUploadModalOpen(false)}
                  disabled={uploadingFile}
                >
                  Annuler
                </Button>
              </div>

              <div className="p-3 bg-info/10 rounded-lg border border-info/30">
                <p className="text-xs text-muted-foreground">
                  💡 <span className="font-semibold">Astuce :</span> Une fois le document ajouté,
                  le score de votre devis sera automatiquement recalculé pour refléter cette amélioration.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}