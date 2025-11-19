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
import { Header } from '@/components/Header';
import { BackButton } from '@/components/BackButton';
import { devisService } from '@/services/api/supabase/devis.service';
import { supabase } from '@/lib/supabase';

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

  const { user, addProject, setCurrentProject } = useApp();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

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
      toast({
        title: 'Fichier uploadé',
        description: `${file.name} a été ajouté avec succès.`,
      });
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
      console.log('[Analyze] User check:', { hasUser: !!user, userId: user?.id, email: user?.email });

      if (!user) {
        console.error('[Analyze] No user found in context');
        toast({
          title: 'Non authentifié',
          description: 'Veuillez vous connecter pour analyser un devis.',
          variant: 'destructive'
        });
        navigate('/login');
        return;
      }

      console.log('[Analyze] Starting upload with user:', user.id);
      console.log('[Analyze] File:', { name: uploadedFile.name, size: uploadedFile.size, type: uploadedFile.type });
      console.log('[Analyze] Project data:', projectData);

      // Upload devis and start analysis
      setAnalysisProgress(prev => [...prev, 'Upload du devis en cours...']);
      const devis = await devisService.uploadDevis(
        user.id,
        uploadedFile,
        projectData.name,
        {
          typeTravaux: projectData.type,
          budget: projectData.budget,
          surface: projectData.surface ? parseFloat(projectData.surface) : undefined,
          description: projectData.description,
          delaiSouhaite: projectData.startDate,
          urgence: projectData.urgency,
          contraintes: projectData.constraints,
        }
      );

      setCurrentDevisId(devis.id);
      setAnalysisProgress(prev => [...prev, 'Devis uploadé avec succès', 'Analyse TORP en cours...']);

      // Poll for analysis completion
      const checkAnalysisStatus = async () => {
        const { data, error } = await supabase
          .from('devis')
          .select('*')
          .eq('id', devis.id)
          .single();

        if (error) {
          console.error('Error checking analysis status:', error);
          return null;
        }

        return data;
      };

      // Poll every 3 seconds
      const pollInterval = setInterval(async () => {
        const devisData = await checkAnalysisStatus();

        if (!devisData) return;

        // Update progress based on status
        if (devisData.status === 'analyzing') {
          // Show random progress step
          const steps = [
            'Extraction des données du devis...',
            'Analyse de l\'entreprise (250 pts)...',
            'Vérification des prix du marché (300 pts)...',
            'Analyse de la complétude technique (200 pts)...',
            'Vérification de la conformité (150 pts)...',
            'Analyse des délais (100 pts)...',
            'Génération de la synthèse finale...'
          ];
          const randomStep = steps[Math.floor(Math.random() * steps.length)];
          setAnalysisProgress(prev => {
            if (!prev.includes(randomStep)) {
              return [...prev, randomStep];
            }
            return prev;
          });
        } else if (devisData.status === 'analyzed') {
          clearInterval(pollInterval);
          setAnalysisProgress(prev => [...prev, 'Analyse terminée !']);

          // Create project with real data
          const newProject = {
            id: devis.id,
            name: projectData.name,
            type: projectData.type,
            status: 'completed' as const,
            score: devisData.score_total || 0,
            grade: devisData.grade || 'C',
            amount: `${devisData.montant_total || 0} €`,
            createdAt: devisData.created_at,
            analysisResult: {
              strengths: devisData.points_forts || [],
              warnings: devisData.points_vigilance || [],
              recommendations: devisData.recommandations || {},
              priceComparison: devisData.comparaison_prix || null,
            }
          };

          addProject(newProject);
          setCurrentProject(newProject);
          setIsAnalyzing(false);

          toast({
            title: 'Analyse terminée !',
            description: `Score TORP: ${newProject.score}/100 (${newProject.grade})`,
          });

          navigate(`/results?devisId=${devis.id}`);
        } else if (devisData.status === 'uploaded') {
          // Still waiting for analysis to start
          setAnalysisProgress(prev => {
            const lastMsg = 'En attente de traitement...';
            if (!prev.includes(lastMsg)) {
              return [...prev, lastMsg];
            }
            return prev;
          });
        }
      }, 3000);

      // Timeout after 5 minutes
      setTimeout(() => {
        clearInterval(pollInterval);
        if (isAnalyzing) {
          setIsAnalyzing(false);
          toast({
            title: 'Délai d\'analyse dépassé',
            description: 'L\'analyse prend plus de temps que prévu. Consultez votre dashboard.',
            variant: 'destructive'
          });
          navigate('/dashboard');
        }
      }, 300000);

    } catch (error) {
      console.error('Analysis error:', error);
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
        <Header />
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
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-4 mb-8">
            <BackButton />
            <div>
              <h1 className="text-4xl font-bold text-foreground">
                Analyser votre devis BTP
              </h1>
              <p className="text-xl text-muted-foreground">
                Obtenez un score de confiance en quelques clics
              </p>
            </div>
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
                        <div className="mt-4">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              // Simuler l'upload d'un devis exemple
                              const mockFile = new File(['mock content'], 'devis-exemple-salle-de-bain.pdf', { type: 'application/pdf' });
                              Object.defineProperty(mockFile, 'size', { value: 2548736 }); // 2.5MB
                              setUploadedFile(mockFile);
                              toast({
                                title: 'Devis exemple chargé',
                                description: 'Vous pouvez maintenant tester l\'analyse.',
                              });
                            }}
                            className="text-sm text-primary hover:text-primary/80 underline"
                          >
                            Ou essayez avec notre devis d'exemple
                          </button>
                        </div>
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
        </div>
      </div>
    </div>
  );
}