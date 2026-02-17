import { useState, useCallback, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useApp } from '@/context/AppContext';
import { useToast } from '@/hooks/use-toast';
import { Upload, FileText, Clock, Shield, CheckCircle, Home, Zap, Droplet, Paintbrush, Download, Loader2 } from 'lucide-react';
import { analysisService } from '@/services/api/analysis.service';

const projectTypes = [
  { id: 'plomberie', label: 'Plomberie', icon: Droplet },
  { id: 'electricite', label: 'Électricité', icon: Zap },
  { id: 'peinture', label: 'Peinture', icon: Paintbrush },
  { id: 'renovation', label: 'Rénovation complète', icon: Home },
  { id: 'cuisine', label: 'Cuisine', icon: Home },
  { id: 'salle-de-bain', label: 'Salle de bain', icon: Home }
];

export default function Analyze() {
  const [step, setStep] = useState(1);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [projectData, setProjectData] = useState({
    name: '',
    type: '',
    budget: '',
    startDate: '',
    endDate: '',
    description: '',
    surface: '',
    urgency: '',
    constraints: ''
  });
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState<string[]>([]);
  const [currentDevisId, setCurrentDevisId] = useState<string | null>(null);

  const { user, addProject, setCurrentProject, userType } = useApp();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  // Load devis from query params if provided
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const devisId = params.get('devisId');

    if (devisId) {
      setCurrentDevisId(devisId);
      // Set step to 2 (project details) since file is already uploaded
      setStep(2);
    }
  }, [location.search]);

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validation du fichier
      const maxSize = 10 * 1024 * 1024; // 10MB
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
      
      if (file.size > maxSize) {
        toast({
          title: 'Fichier trop volumineux',
          description: 'Le fichier ne doit pas dépasser 10MB.',
          variant: 'destructive'
        });
        return;
      }
      
      if (!allowedTypes.includes(file.type)) {
        toast({
          title: 'Format non supporté',
          description: 'Utilisez un fichier PDF, JPG ou PNG.',
          variant: 'destructive'
        });
        return;
      }

      setUploadedFile(file);
      // Toast supprimé pour une meilleure UX - l'affichage du fichier est suffisant
    }
  }, [toast]);

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file) {
      const fakeEvent = { target: { files: [file] } } as any;
      handleFileUpload(fakeEvent);
    }
  }, [handleFileUpload]);

  const handleAnalyze = async () => {
    if (!uploadedFile || !projectData.name || !projectData.type) {
      toast({
        title: 'Informations manquantes',
        description: 'Veuillez remplir tous les champs obligatoires.',
        variant: 'destructive'
      });
      return;
    }

    try {
      setIsAnalyzing(true);
      setAnalysisProgress(['Préparation de l\'analyse...']);

      // Check if user is authenticated
      if (!user) {
        toast({
          title: 'Non authentifié',
          description: 'Veuillez vous connecter pour analyser un devis.',
          variant: 'destructive'
        });
        navigate('/login');
        return;
      }

      console.log('[Analyze] Requesting async analysis with user:', user.id);
      setAnalysisProgress(prev => [...prev, 'Upload du devis en cours...']);

      // Phase 32.1: Request async analysis instead of synchronous
      const jobId = await analysisService.requestAnalysis({
        userId: user.id,
        file: uploadedFile,
        projectName: projectData.name,
        projectType: projectData.type,
        budget: projectData.budget,
        surface: projectData.surface ? parseFloat(projectData.surface) : undefined,
        description: projectData.description,
        startDate: projectData.startDate,
        urgency: projectData.urgency,
        constraints: projectData.constraints,
        userType: userType as 'B2C' | 'B2B' | 'B2G',
      });

      console.log('[Analyze] Analysis job created:', jobId);
      setAnalysisProgress(prev => [...prev, 'Devis uploadé avec succès', 'Redirection vers le statut d\'analyse...']);

      // Small delay for UX feedback
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Phase 32.1: Redirect to job status page
      setAnalysisProgress(prev => [...prev, 'Redirection en cours...']);
      setIsAnalyzing(false);

      // Navigate to job status page
      setTimeout(() => {
        console.log('[Analyze] Navigating to job status page:', jobId);
        navigate(`/analysis/job/${jobId}`);
      }, 500);

    } catch (error) {
      console.error('[Analyze] ===== CATCH BLOCK REACHED =====');
      console.error('[Analyze] Analysis error:', error);
      console.error('[Analyze] Error type:', typeof error);
      console.error('[Analyze] Error message:', error instanceof Error ? error.message : String(error));
      console.error('[Analyze] Error stack:', error instanceof Error ? error.stack : 'No stack');

      setIsAnalyzing(false);
      toast({
        title: 'Erreur d\'analyse',
        description: error instanceof Error ? error.message : 'Une erreur est survenue lors de l\'analyse',
        variant: 'destructive'
      });
    }
  };

  if (isAnalyzing) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-2xl mx-auto text-center">
            <div className="mb-8">
              <div className="relative w-32 h-32 mx-auto mb-6">
                <div className="w-32 h-32 border-4 border-muted rounded-full"></div>
                <div className="w-32 h-32 border-4 border-primary rounded-full border-t-transparent absolute top-0 left-0 animate-spin"></div>
              </div>
              <h2 className="text-3xl font-bold text-foreground mb-4">
                Analyse en cours...
              </h2>
              <p className="text-lg text-muted-foreground mb-8">
                Notre IA analyse votre devis selon plus de 80 critères de qualité
              </p>
            </div>

            <div className="space-y-4">
              {analysisProgress.map((step, index) => (
                <div key={index} className="flex items-center space-x-3 p-4 bg-card rounded-lg animate-fade-in">
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                    {index === analysisProgress.length - 1 && !step.includes('terminée') ? (
                      <Loader2 className="w-4 h-4 text-white animate-spin" />
                    ) : (
                      <CheckCircle className="w-4 h-4 text-white" />
                    )}
                  </div>
                  <span className="text-foreground font-medium">{step}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-foreground">
          Analyser votre devis BTP
        </h1>
        <p className="text-xl text-muted-foreground">
          Obtenez un score de confiance en quelques clics
        </p>
      </div>

        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="w-5 h-5" />
                Étape 1 : Téléverser votre devis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div
                className="border-2 border-dashed border-border rounded-lg p-12 text-center hover:border-primary/50 hover:bg-accent/50 transition-colors cursor-pointer"
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => document.getElementById('file-input')?.click()}
              >
                {uploadedFile ? (
                  <div className="space-y-4">
                    <FileText className="w-16 h-16 text-primary mx-auto" />
                    <div>
                      <h3 className="text-xl font-semibold text-foreground mb-2">
                        Fichier sélectionné
                      </h3>
                      <p className="text-muted-foreground">{uploadedFile.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <Upload className="w-16 h-16 text-muted-foreground mx-auto" />
                    <div>
                      <h3 className="text-xl font-semibold text-foreground mb-2">
                        Glissez votre devis ici
                      </h3>
                      <p className="text-muted-foreground mb-4">
                        ou cliquez pour sélectionner un fichier
                      </p>
                      <p className="text-sm text-muted-foreground mb-4">
                        Formats acceptés : PDF, JPG, PNG (max 10MB)
                      </p>
                    </div>
                  </div>
                )}
                
                <input
                  id="file-input"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>

              <div className="mt-8 grid md:grid-cols-3 gap-6">
                <div className="flex items-center space-x-3">
                  <Shield className="w-6 h-6 text-primary" />
                  <span className="text-muted-foreground">100% sécurisé et confidentiel</span>
                </div>
                <div className="flex items-center space-x-3">
                  <Clock className="w-6 h-6 text-primary" />
                  <span className="text-muted-foreground">Analyse en 3 minutes</span>
                </div>
                <div className="flex items-center space-x-3">
                  <CheckCircle className="w-6 h-6 text-primary" />
                  <span className="text-muted-foreground">Rapport détaillé instantané</span>
                </div>
              </div>

              {uploadedFile && (
              <div className="mt-8 text-center">
                <Button onClick={() => setStep(2)} size="lg">
                  Continuer vers les détails du projet
                </Button>
              </div>
              )}
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Étape 2 : Détails du projet
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="mb-6 p-4 bg-info/10 border border-info/20 rounded-lg">
                <h4 className="font-semibold text-info mb-2">Analyse de cohérence projet/devis</h4>
                <p className="text-sm text-muted-foreground">
                  Ces informations permettent à notre IA de vérifier la cohérence entre vos besoins, 
                  le projet proposé et le prix du devis pour détecter d'éventuelles incohérences.
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="project-name">Nom du projet *</Label>
                  <Input
                    id="project-name"
                    placeholder="Ex: Rénovation salle de bain"
                    value={projectData.name}
                    onChange={(e) => setProjectData({...projectData, name: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Type de projet *</Label>
                  <Select
                    value={projectData.type}
                    onValueChange={(value) => setProjectData({...projectData, type: value})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner le type" />
                    </SelectTrigger>
                    <SelectContent>
                      {projectTypes.map(type => (
                        <SelectItem key={type.id} value={type.id}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Budget estimé prévu</Label>
                  <Select
                    value={projectData.budget}
                    onValueChange={(value) => setProjectData({...projectData, budget: value})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Votre budget initial" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0-5000">Moins de 5 000 €</SelectItem>
                      <SelectItem value="5000-15000">5 000 € - 15 000 €</SelectItem>
                      <SelectItem value="15000-50000">15 000 € - 50 000 €</SelectItem>
                      <SelectItem value="50000-100000">50 000 € - 100 000 €</SelectItem>
                      <SelectItem value="100000+">Plus de 100 000 €</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Surface concernée (m²)</Label>
                  <Input
                    type="number"
                    placeholder="Ex: 15"
                    value={projectData.surface || ''}
                    onChange={(e) => setProjectData({...projectData, surface: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Délai souhaité de début</Label>
                  <Input
                    type="date"
                    value={projectData.startDate}
                    onChange={(e) => setProjectData({...projectData, startDate: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Urgence du projet</Label>
                  <Select
                    value={projectData.urgency || ''}
                    onValueChange={(value) => setProjectData({...projectData, urgency: value})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Niveau d'urgence" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="faible">Pas pressé</SelectItem>
                      <SelectItem value="moyenne">Dans les 3-6 mois</SelectItem>
                      <SelectItem value="forte">Urgent (&lt; 3 mois)</SelectItem>
                      <SelectItem value="critique">Très urgent (&lt; 1 mois)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Description de vos besoins</Label>
                <Textarea
                  placeholder="Décrivez précisément vos attentes et besoins pour ce projet..."
                  value={projectData.description}
                  onChange={(e) => setProjectData({...projectData, description: e.target.value})}
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label>Contraintes particulières</Label>
                <Textarea
                  placeholder="Contraintes techniques, budgétaires, délais spécifiques..."
                  value={projectData.constraints || ''}
                  onChange={(e) => setProjectData({...projectData, constraints: e.target.value})}
                  rows={3}
                />
              </div>

              <div className="flex gap-4 pt-6">
                <Button variant="outline" onClick={() => setStep(1)}>
                  Retour
                </Button>
                <Button onClick={handleAnalyze} size="lg" className="flex-1">
                  Lancer l'analyse TORP
                </Button>
              </div>
            </CardContent>
          </Card>
      )}
    </>
  );
}