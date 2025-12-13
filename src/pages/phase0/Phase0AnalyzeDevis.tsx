/**
 * Page d'analyse de devis enrichie avec le contexte Phase0
 * Permet d'uploader un devis et de l'analyser en tenant compte du projet défini
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import {
  Upload,
  FileText,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  Target,
  Clock,
  Shield,
  Lightbulb,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import { AppLayout } from '@/components/layout';
import { useApp } from '@/context/AppContext';
import { Phase0ProjectService } from '@/services/phase0';
import { torpAnalyzerService } from '@/services/ai/torp-analyzer.service';
import { pdfExtractorService } from '@/services/pdf/pdf-extractor.service';
import type { Phase0Project } from '@/types/phase0';
import type { Phase0EnrichedAnalysis } from '@/services/phase0-phase1';

type AnalysisStep = 'upload' | 'processing' | 'results';

export function Phase0AnalyzeDevis() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { user, userType } = useApp();

  // State
  const [step, setStep] = useState<AnalysisStep>('upload');
  const [project, setProject] = useState<Phase0Project | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisStatus, setAnalysisStatus] = useState('');
  const [result, setResult] = useState<Phase0EnrichedAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Charger le projet Phase0
  useEffect(() => {
    const loadProject = async () => {
      if (!projectId) {
        setError('ID de projet manquant');
        setIsLoading(false);
        return;
      }

      try {
        const loadedProject = await Phase0ProjectService.getProjectById(projectId);
        if (!loadedProject) {
          setError('Projet non trouvé');
        } else {
          setProject(loadedProject);
        }
      } catch (err) {
        setError('Erreur lors du chargement du projet');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    loadProject();
  }, [projectId]);

  // Gestion du fichier
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type !== 'application/pdf' && !selectedFile.type.startsWith('image/')) {
        setError('Format de fichier non supporté. Utilisez un PDF ou une image.');
        return;
      }
      setFile(selectedFile);
      setError(null);
    }
  }, []);

  // Lancer l'analyse
  const handleAnalyze = useCallback(async () => {
    if (!file || !project) return;

    setIsAnalyzing(true);
    setStep('processing');
    setError(null);

    try {
      // Étape 1: Extraction du texte
      setAnalysisProgress(10);
      setAnalysisStatus('Extraction du document...');

      const extractedText = await pdfExtractorService.extractText(file);
      if (!extractedText || extractedText.length < 100) {
        throw new Error('Le document ne contient pas assez de texte exploitable');
      }

      // Étape 2: Analyse TORP enrichie
      setAnalysisProgress(30);
      setAnalysisStatus('Analyse du devis...');

      // Simuler la progression pendant l'analyse
      const progressInterval = setInterval(() => {
        setAnalysisProgress(prev => Math.min(prev + 5, 90));
      }, 2000);

      const analysisResult = await torpAnalyzerService.analyzeDevisWithPhase0Context(
        extractedText,
        project,
        { userType }
      );

      clearInterval(progressInterval);

      // Étape 3: Résultats
      setAnalysisProgress(100);
      setAnalysisStatus('Analyse terminée');
      setResult(analysisResult);
      setStep('results');

    } catch (err) {
      console.error('Erreur d\'analyse:', err);
      setError(err instanceof Error ? err.message : 'Erreur lors de l\'analyse');
      setStep('upload');
    } finally {
      setIsAnalyzing(false);
    }
  }, [file, project, userType]);

  // Rendu conditionnel selon l'état
  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (error && !project) {
    return (
      <AppLayout>
        <div className="max-w-2xl mx-auto">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Erreur</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <Button className="mt-4" onClick={() => navigate('/phase0')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour aux projets
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto">
        {/* En-tête */}
        <div className="mb-8">
          <Button variant="ghost" onClick={() => navigate(`/phase0/project/${projectId}`)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour au projet
          </Button>

          <div className="mt-4">
            <Badge variant="outline" className="mb-2">Analyse contextuelle</Badge>
            <h1 className="text-3xl font-bold">Analyser un devis</h1>
            <p className="text-muted-foreground mt-1">
              Projet: {project?.workProject?.general?.title || 'Sans titre'}
            </p>
          </div>
        </div>

        {/* Contenu principal */}
        {step === 'upload' && (
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Zone d'upload */}
            <Card>
              <CardHeader>
                <CardTitle>Uploader votre devis</CardTitle>
                <CardDescription>
                  Le devis sera analysé en tenant compte de votre projet
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div
                  className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors
                    ${file ? 'border-primary bg-primary/5' : 'border-muted hover:border-primary/50'}`}
                >
                  <input
                    type="file"
                    id="devis-upload"
                    accept=".pdf,image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <label htmlFor="devis-upload" className="cursor-pointer">
                    {file ? (
                      <div className="space-y-2">
                        <FileText className="h-12 w-12 mx-auto text-primary" />
                        <p className="font-medium">{file.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                        <Button variant="outline" size="sm" className="mt-2">
                          Changer de fichier
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Upload className="h-12 w-12 mx-auto text-muted-foreground" />
                        <p className="font-medium">Glissez votre devis ici</p>
                        <p className="text-sm text-muted-foreground">
                          ou cliquez pour sélectionner (PDF ou image)
                        </p>
                      </div>
                    )}
                  </label>
                </div>

                {error && (
                  <Alert variant="destructive" className="mt-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <Button
                  className="w-full mt-6"
                  size="lg"
                  disabled={!file || isAnalyzing}
                  onClick={handleAnalyze}
                >
                  Analyser le devis
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>

            {/* Contexte Phase0 */}
            <Card>
              <CardHeader>
                <CardTitle>Contexte du projet</CardTitle>
                <CardDescription>
                  Ces informations enrichissent l'analyse
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Budget */}
                {project?.workProject?.budget?.totalEnvelope && (
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-green-100 text-green-700">
                      <Target className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-medium">Budget défini</p>
                      <p className="text-sm text-muted-foreground">
                        {project.workProject.budget.totalEnvelope.amount?.toLocaleString('fr-FR')} €
                      </p>
                    </div>
                  </div>
                )}

                {/* Lots */}
                {project?.selectedLots && project.selectedLots.length > 0 && (
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-blue-100 text-blue-700">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-medium">{project.selectedLots.length} lot(s) prévu(s)</p>
                      <p className="text-sm text-muted-foreground">
                        {project.selectedLots.slice(0, 3).map(l => l.label || l.type).join(', ')}
                        {project.selectedLots.length > 3 && '...'}
                      </p>
                    </div>
                  </div>
                )}

                {/* Contraintes */}
                {project?.workProject?.constraints && (
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-orange-100 text-orange-700">
                      <Shield className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-medium">Contraintes identifiées</p>
                      <p className="text-sm text-muted-foreground">
                        {project.workProject.constraints.temporal?.maxDuration
                          ? `Durée max: ${project.workProject.constraints.temporal.maxDuration}j`
                          : 'Voir détails du projet'
                        }
                      </p>
                    </div>
                  </div>
                )}

                {/* Délais */}
                {project?.workProject?.planning?.timeline && (
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-purple-100 text-purple-700">
                      <Clock className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-medium">Planning souhaité</p>
                      <p className="text-sm text-muted-foreground">
                        Début prévu: {project.workProject.planning.timeline.plannedStart || 'Non défini'}
                      </p>
                    </div>
                  </div>
                )}

                <Separator className="my-4" />

                <div className="text-sm text-muted-foreground">
                  <Lightbulb className="h-4 w-4 inline mr-1" />
                  L'analyse comparera le devis à votre projet pour identifier les écarts et vous donner des recommandations personnalisées.
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {step === 'processing' && (
          <Card className="max-w-lg mx-auto">
            <CardContent className="pt-8 pb-8 text-center">
              <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary mb-4" />
              <h3 className="text-lg font-semibold mb-2">Analyse en cours</h3>
              <p className="text-muted-foreground mb-4">{analysisStatus}</p>
              <Progress value={analysisProgress} className="mb-2" />
              <p className="text-sm text-muted-foreground">{analysisProgress}%</p>
            </CardContent>
          </Card>
        )}

        {step === 'results' && result && (
          <Phase0AnalysisResults
            result={result}
            projectId={projectId!}
            onNewAnalysis={() => {
              setStep('upload');
              setFile(null);
              setResult(null);
            }}
          />
        )}
      </div>
    </AppLayout>
  );
}

// Composant pour afficher les résultats enrichis
function Phase0AnalysisResults({
  result,
  projectId,
  onNewAnalysis,
}: {
  result: Phase0EnrichedAnalysis;
  projectId: string;
  onNewAnalysis: () => void;
}) {
  const navigate = useNavigate();
  const { phase0Comparison, contextualScore, contextualRecommendations, baseAnalysis } = result;

  // Déterminer l'icône et la couleur pour le statut budget
  const getBudgetStatusDisplay = (status: string) => {
    switch (status) {
      case 'under':
        return { icon: TrendingDown, color: 'text-yellow-600', bg: 'bg-yellow-100' };
      case 'within':
        return { icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-100' };
      case 'over':
        return { icon: TrendingUp, color: 'text-orange-600', bg: 'bg-orange-100' };
      case 'significantly_over':
        return { icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-100' };
      default:
        return { icon: Minus, color: 'text-gray-600', bg: 'bg-gray-100' };
    }
  };

  const budgetDisplay = getBudgetStatusDisplay(phase0Comparison.budgetComparison.status);
  const BudgetIcon = budgetDisplay.icon;

  return (
    <div className="space-y-6">
      {/* Scores */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-4xl font-bold text-primary mb-1">
                {baseAnalysis.grade}
              </div>
              <p className="text-sm text-muted-foreground">Score TORP</p>
              <p className="text-2xl font-semibold mt-2">
                {baseAnalysis.scoreGlobal}/1150
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-4xl font-bold mb-1" style={{
                color: contextualScore.finalScore >= 70 ? 'green' :
                       contextualScore.finalScore >= 50 ? 'orange' : 'red'
              }}>
                {contextualScore.finalScore}%
              </div>
              <p className="text-sm text-muted-foreground">Score Contextuel</p>
              <Badge variant="outline" className="mt-2">
                Confiance: {contextualScore.contextConfidence}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className={`inline-flex p-3 rounded-full ${budgetDisplay.bg} mb-2`}>
                <BudgetIcon className={`h-8 w-8 ${budgetDisplay.color}`} />
              </div>
              <p className="text-sm text-muted-foreground">Comparaison budget</p>
              <p className="font-semibold mt-1">
                {phase0Comparison.budgetComparison.differencePercent > 0 ? '+' : ''}
                {phase0Comparison.budgetComparison.differencePercent}%
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Comparaison avec Phase0 */}
      <Card>
        <CardHeader>
          <CardTitle>Comparaison avec votre projet</CardTitle>
          <CardDescription>
            Analyse du devis par rapport à votre cahier des charges
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Budget */}
          <div>
            <h4 className="font-semibold mb-2 flex items-center gap-2">
              <Target className="h-4 w-4" />
              Budget
            </h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Budget prévu</p>
                <p className="font-medium">
                  {phase0Comparison.budgetComparison.phase0Estimate.toLocaleString('fr-FR')} €
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Montant devis</p>
                <p className="font-medium">
                  {phase0Comparison.budgetComparison.devisAmount.toLocaleString('fr-FR')} €
                </p>
              </div>
            </div>
            <p className="text-sm mt-2 text-muted-foreground">
              {phase0Comparison.budgetComparison.recommendation}
            </p>
          </div>

          <Separator />

          {/* Lots */}
          <div>
            <h4 className="font-semibold mb-2 flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Couverture des travaux
            </h4>
            <div className="flex items-center gap-4 mb-2">
              <Progress value={phase0Comparison.lotsComparison.coveragePercent} className="flex-1" />
              <span className="font-medium">{phase0Comparison.lotsComparison.coveragePercent}%</span>
            </div>
            <div className="text-sm text-muted-foreground">
              {phase0Comparison.lotsComparison.foundInDevis} / {phase0Comparison.lotsComparison.expectedLots} lots couverts
            </div>

            {phase0Comparison.lotsComparison.missingLots.length > 0 && (
              <Alert variant="destructive" className="mt-3">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Lots manquants</AlertTitle>
                <AlertDescription>
                  {phase0Comparison.lotsComparison.missingLots.join(', ')}
                </AlertDescription>
              </Alert>
            )}
          </div>

          <Separator />

          {/* Contraintes */}
          <div>
            <h4 className="font-semibold mb-2 flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Respect des contraintes
            </h4>
            <div className="flex items-center gap-4 mb-2">
              <Progress
                value={(phase0Comparison.constraintsCheck.satisfied / Math.max(phase0Comparison.constraintsCheck.total, 1)) * 100}
                className="flex-1"
              />
              <span className="font-medium">
                {phase0Comparison.constraintsCheck.satisfied}/{phase0Comparison.constraintsCheck.total}
              </span>
            </div>

            {phase0Comparison.constraintsCheck.violated.length > 0 && (
              <Alert variant="destructive" className="mt-3">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Contraintes non respectées</AlertTitle>
                <AlertDescription>
                  {phase0Comparison.constraintsCheck.violated.join('. ')}
                </AlertDescription>
              </Alert>
            )}

            {phase0Comparison.constraintsCheck.warnings.length > 0 && (
              <Alert className="mt-3">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Points de vigilance</AlertTitle>
                <AlertDescription>
                  {phase0Comparison.constraintsCheck.warnings.join('. ')}
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Recommandations contextuelles */}
      <Card>
        <CardHeader>
          <CardTitle>Recommandations personnalisées</CardTitle>
          <CardDescription>
            Actions suggérées basées sur votre projet
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {contextualRecommendations.map((rec, index) => (
              <div
                key={index}
                className={`p-4 rounded-lg border ${
                  rec.priority === 'high' ? 'border-red-200 bg-red-50' :
                  rec.priority === 'medium' ? 'border-orange-200 bg-orange-50' :
                  'border-gray-200 bg-gray-50'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-full ${
                    rec.type === 'warning' ? 'bg-red-100 text-red-600' :
                    rec.type === 'negotiation' ? 'bg-blue-100 text-blue-600' :
                    rec.type === 'clarification' ? 'bg-yellow-100 text-yellow-600' :
                    rec.type === 'validation' ? 'bg-green-100 text-green-600' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {rec.type === 'warning' && <AlertTriangle className="h-4 w-4" />}
                    {rec.type === 'negotiation' && <TrendingDown className="h-4 w-4" />}
                    {rec.type === 'clarification' && <Lightbulb className="h-4 w-4" />}
                    {rec.type === 'validation' && <CheckCircle2 className="h-4 w-4" />}
                    {rec.type === 'alternative' && <Target className="h-4 w-4" />}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold">{rec.title}</h4>
                    <p className="text-sm text-muted-foreground mt-1">{rec.description}</p>
                    {rec.action && (
                      <p className="text-sm font-medium mt-2">→ {rec.action}</p>
                    )}
                    {rec.impact && (
                      <Badge variant="outline" className="mt-2">{rec.impact}</Badge>
                    )}
                  </div>
                  <Badge variant={rec.priority === 'high' ? 'destructive' : 'secondary'}>
                    {rec.priority === 'high' ? 'Prioritaire' :
                     rec.priority === 'medium' ? 'Important' : 'Info'}
                  </Badge>
                </div>
              </div>
            ))}

            {contextualRecommendations.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle2 className="h-12 w-12 mx-auto mb-2 text-green-500" />
                <p>Ce devis est bien aligné avec votre projet !</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-4 justify-center">
        <Button variant="outline" onClick={onNewAnalysis}>
          Analyser un autre devis
        </Button>
        <Button onClick={() => navigate(`/phase0/project/${projectId}`)}>
          Retour au projet
        </Button>
        <Button variant="secondary" onClick={() => navigate('/compare')}>
          Comparer plusieurs devis
        </Button>
      </div>
    </div>
  );
}

export default Phase0AnalyzeDevis;
