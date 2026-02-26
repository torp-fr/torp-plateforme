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
import { devisService } from '@/services/api/supabase/devis.service';
import type { DevisMetadata } from '@/services/api/supabase/devis.service';
import { env } from '@/config/env';

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
      const maxSize = env.upload.maxFileSize; // Use configured max size
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
      const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(0);

      if (file.size > maxSize) {
        toast({
          title: 'Fichier trop volumineux',
          description: `Le fichier ne doit pas dépasser ${maxSizeMB}MB.`,
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

  // PHASE 34.4: Upload file and move to Step 2 (new clean architecture)
  const handleContinueToStep2 = async () => {
    console.log('[PHASE 34.4] handleContinueToStep2 called');

    if (!uploadedFile || !user) {
      console.error('[PHASE 34.4] Missing file or user');
      toast({
        title: 'Erreur',
        description: 'Fichier manquant ou utilisateur non authentifié',
        variant: 'destructive'
      });
      return;
    }

    try {
      setIsAnalyzing(true);
      setAnalysisProgress(['Upload du devis en cours...']);

      console.log('[PHASE 34.4] Uploading file:', uploadedFile.name);

      // Upload and get devisId
      const uploadResult = await devisService.uploadDevis(
        user.id,
        uploadedFile,
        projectData.name || 'Sans titre'
      );

      console.log('[PHASE 34.4] Upload complete, devisId:', uploadResult.id);

      // Store devisId and move to Step 2
      setCurrentDevisId(uploadResult.id);
      setAnalysisProgress(prev => [...prev, 'Devis uploadé avec succès!']);

      // Small delay for UX feedback
      await new Promise(resolve => setTimeout(resolve, 500));

      setIsAnalyzing(false);
      setStep(2);
    } catch (error) {
      console.error('[PHASE 34.4] Upload error:', error);
      setIsAnalyzing(false);
      toast({
        title: 'Erreur d\'upload',
        description: error instanceof Error ? error.message : 'Une erreur est survenue',
        variant: 'destructive'
      });
    }
  };

  const handleAnalyze = async () => {
    console.log('[PHASE 34.4] handleAnalyze called - CLEAN ARCHITECTURE');
    console.log('[PHASE 34.4] Current state:', {
      devisId: currentDevisId,
      projectName: projectData.name,
      projectType: projectData.type,
      isAnalyzing,
      userExists: !!user,
    });

    // PHASE 34.4: Validation - NO LONGER check uploadedFile (it's lost after navigation)
    if (!projectData.name || !projectData.type) {
      console.warn('[PHASE 34.4] Validation failed - missing required fields');
      console.log('[PHASE 34.4] Validation details:', {
        projectName: !!projectData.name,
        projectType: !!projectData.type,
      });
      toast({
        title: 'Informations manquantes',
        description: 'Veuillez remplir tous les champs obligatoires.',
        variant: 'destructive'
      });
      return;
    }

    // PHASE 34.4: Verify devisId exists (the file was uploaded in Step 1)
    if (!currentDevisId) {
      console.error('[PHASE 34.4] No devisId found - cannot analyze');
      toast({
        title: 'Erreur',
        description: 'Devis non trouvé. Veuillez retourner à l\'étape 1.',
        variant: 'destructive'
      });
      setStep(1);
      return;
    }

    try {
      console.log('[PHASE 34.4] Validation passed - proceeding with analysis');
      setIsAnalyzing(true);
      setAnalysisProgress(['Préparation de l\'analyse...']);

      // Check if user is authenticated
      if (!user) {
        console.log('[PHASE 34.4] User not authenticated - redirecting to login');
        toast({
          title: 'Non authentifié',
          description: 'Veuillez vous connecter pour analyser un devis.',
          variant: 'destructive'
        });
        navigate('/login');
        return;
      }

      console.log('[PHASE 34.4] User authenticated:', user.id);
      console.log('[PHASE 34.4] Using devisId:', currentDevisId);

      // Build metadata from form data
      const metadata: DevisMetadata = {
        nom: projectData.name,
        typeTravaux: projectData.type,
        budget: projectData.budget,
        surface: projectData.surface ? parseFloat(projectData.surface) : undefined,
        description: projectData.description,
        delaiSouhaite: projectData.startDate,
        urgence: projectData.urgency,
        contraintes: projectData.constraints,
        userType: userType as 'B2C' | 'B2B' | 'admin',
      };

      console.log('[PHASE 34.4] Calling devisService.analyzeDevisById()');
      setAnalysisProgress(prev => [...prev, 'Analyse du devis en cours...']);

      // PHASE 34.4: Call analyzeDevisById with devisId (no file re-upload)
      await devisService.analyzeDevisById(
        currentDevisId,
        undefined, // No file - it's already in storage
        metadata
      );

      console.log('[PHASE 34.4] Analysis complete for devisId:', currentDevisId);
      setAnalysisProgress(prev => [...prev, 'Analyse terminée avec succès', 'Redirection vers le résultat...']);

      // Small delay for UX feedback
      await new Promise(resolve => setTimeout(resolve, 1000));

      setAnalysisProgress(prev => [...prev, 'Redirection en cours...']);
      setIsAnalyzing(false);

      // PHASE 34.4: Navigate to devis details page (analysis result)
      setTimeout(() => {
        console.log('[PHASE 34.4] Navigating to devis page:', currentDevisId);
        navigate(`/devis/${currentDevisId}`);
      }, 500);

    } catch (error) {
      console.error('[PHASE 34.4] ===== ERROR IN ANALYSIS =====');
      console.error('[PHASE 34.4] Error object:', error);
      console.error('[PHASE 34.4] Error type:', typeof error);
      console.error('[PHASE 34.4] Error message:', error instanceof Error ? error.message : String(error));
      console.error('[PHASE 34.4] Error stack:', error instanceof Error ? error.stack : 'No stack trace');

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
                        Formats acceptés : PDF, JPG, PNG (max {(env.upload.maxFileSize / (1024 * 1024)).toFixed(0)}MB)
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
                <Button onClick={handleContinueToStep2} size="lg" disabled={isAnalyzing}>
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