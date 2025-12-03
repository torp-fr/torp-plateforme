/**
 * ProNewAnalysis Page
 * Créer une nouvelle analyse de devis pour les professionnels B2B
 * Utilise le même système que B2C (table devis + devisService)
 */

import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ProLayout } from '@/components/pro/ProLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { useApp } from '@/context/AppContext';
import { devisService } from '@/services/api/supabase/devis.service';
import { useToast } from '@/hooks/use-toast';
import {
  Upload,
  FileText,
  Loader2,
  CheckCircle2,
  AlertCircle,
  X,
  ArrowRight,
} from 'lucide-react';

export default function ProNewAnalysis() {
  const navigate = useNavigate();
  const { user } = useApp();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [projectName, setProjectName] = useState('');
  const [projectType, setProjectType] = useState('');
  const [notes, setNotes] = useState('');
  const [processing, setProcessing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState<string[]>([]);
  const [progressPercent, setProgressPercent] = useState(0);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validation
    const maxSize = 10 * 1024 * 1024; // 10MB
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];

    if (file.size > maxSize) {
      toast({
        variant: 'destructive',
        title: 'Fichier trop volumineux',
        description: 'Le fichier ne doit pas dépasser 10 Mo.',
      });
      return;
    }

    if (!allowedTypes.includes(file.type)) {
      toast({
        variant: 'destructive',
        title: 'Format non supporté',
        description: 'Utilisez un fichier PDF, JPG ou PNG.',
      });
      return;
    }

    setUploadedFile(file);
    toast({
      title: 'Fichier ajouté',
      description: file.name,
    });
  }

  function removeFile() {
    setUploadedFile(null);
  }

  async function handleSubmit() {
    if (!uploadedFile) {
      toast({
        variant: 'destructive',
        title: 'Fichier requis',
        description: 'Veuillez ajouter un devis à analyser.',
      });
      return;
    }

    if (!user?.id) {
      toast({
        variant: 'destructive',
        title: 'Non authentifié',
        description: 'Veuillez vous reconnecter.',
      });
      navigate('/login');
      return;
    }

    setProcessing(true);
    setAnalysisProgress(['Préparation de l\'analyse...']);
    setProgressPercent(10);

    try {
      // Upload et démarrer l'analyse via devisService existant
      setAnalysisProgress(prev => [...prev, 'Upload du devis en cours...']);
      setProgressPercent(20);

      const devis = await devisService.uploadDevis(
        user.id,
        uploadedFile,
        projectName || 'Analyse Pro',
        {
          typeTravaux: projectType || 'pro',
          description: notes,
        }
      );

      setAnalysisProgress(prev => [...prev, 'Devis uploadé avec succès', 'Analyse TORP en cours...']);
      setProgressPercent(40);

      // Polling pour suivre l'avancement
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

      const checkStatus = async () => {
        const queryUrl = `${supabaseUrl}/rest/v1/devis?id=eq.${devis.id}&select=*`;
        const response = await fetch(queryUrl, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
        });
        if (!response.ok) return null;
        const data = await response.json();
        return data[0] || null;
      };

      // Polling toutes les 3 secondes
      const pollInterval = setInterval(async () => {
        const devisData = await checkStatus();
        if (!devisData) return;

        if (devisData.status === 'analyzing') {
          const steps = [
            'Extraction des données du devis...',
            'Analyse de l\'entreprise (250 pts)...',
            'Vérification des prix du marché (300 pts)...',
            'Analyse de la complétude technique (200 pts)...',
            'Vérification de la conformité (150 pts)...',
            'Analyse des délais (100 pts)...',
          ];
          const randomStep = steps[Math.floor(Math.random() * steps.length)];
          setAnalysisProgress(prev => {
            if (!prev.includes(randomStep)) return [...prev, randomStep];
            return prev;
          });
          setProgressPercent(prev => Math.min(prev + 10, 85));
        } else if (devisData.status === 'analyzed') {
          clearInterval(pollInterval);
          setProgressPercent(100);
          setAnalysisProgress(prev => [...prev, 'Analyse terminée !']);

          toast({
            title: 'Analyse terminée !',
            description: `Score TORP: ${devisData.score_total}/1000 (${devisData.grade})`,
          });

          // Rediriger vers les résultats
          setTimeout(() => {
            navigate(`/results?devisId=${devis.id}`);
          }, 1000);
        }
      }, 3000);

      // Timeout après 5 minutes
      setTimeout(() => {
        clearInterval(pollInterval);
        if (processing) {
          setProcessing(false);
          toast({
            variant: 'destructive',
            title: 'Timeout',
            description: 'L\'analyse prend plus de temps que prévu. Vérifiez dans "Mes analyses".',
          });
          navigate('/pro/analyses');
        }
      }, 300000);

    } catch (error: any) {
      console.error('[ProNewAnalysis] Erreur:', error);
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: error?.message || 'Impossible de créer l\'analyse.',
      });
      setProcessing(false);
    }
  }

  return (
    <ProLayout>
      <div className="space-y-6 max-w-2xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold">Nouvelle analyse</h1>
          <p className="text-muted-foreground">
            Uploadez un devis pour obtenir une analyse TORP détaillée
          </p>
        </div>

        {processing ? (
          // Écran de progression
          <Card>
            <CardContent className="py-12">
              <div className="text-center space-y-6">
                <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
                <div>
                  <h3 className="text-lg font-semibold mb-2">Analyse en cours...</h3>
                  <Progress value={progressPercent} className="h-2 mb-4" />
                </div>
                <div className="text-left bg-muted/50 rounded-lg p-4 max-h-48 overflow-y-auto">
                  {analysisProgress.map((step, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm py-1">
                      <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                      <span>{step}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Zone d'upload */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Devis à analyser
                </CardTitle>
                <CardDescription>
                  Formats acceptés : PDF, JPG, PNG (max 10 Mo)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!uploadedFile ? (
                  <div
                    className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground mb-2">
                      Cliquez ou glissez-déposez votre fichier ici
                    </p>
                    <Button variant="outline" size="sm">
                      Parcourir
                    </Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      className="hidden"
                      onChange={handleFileSelect}
                    />
                  </div>
                ) : (
                  <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <FileText className="h-8 w-8 text-primary" />
                      <div>
                        <p className="font-medium">{uploadedFile.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {(uploadedFile.size / 1024 / 1024).toFixed(2)} Mo
                        </p>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={removeFile}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Informations optionnelles */}
            <Card>
              <CardHeader>
                <CardTitle>Informations (optionnel)</CardTitle>
                <CardDescription>
                  Ajoutez des détails pour mieux identifier cette analyse
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="projectName">Nom du projet</Label>
                    <Input
                      id="projectName"
                      placeholder="Ex: Rénovation Villa Martin"
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="projectType">Type de travaux</Label>
                    <Input
                      id="projectType"
                      placeholder="Ex: Plomberie, Électricité..."
                      value={projectType}
                      onChange={(e) => setProjectType(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    placeholder="Informations complémentaires..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => navigate('/pro/analyses')}>
                Annuler
              </Button>
              <Button onClick={handleSubmit} disabled={!uploadedFile}>
                Lancer l'analyse
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </>
        )}
      </div>
    </ProLayout>
  );
}
