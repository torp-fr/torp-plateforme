/**
 * TORP B2B - Nouvelle Analyse de Devis
 *
 * Permet aux professionnels B2B de soumettre un devis pour analyse
 * et recevoir un score TORP avec recommandations d'amélioration.
 *
 * @route /pro/new-analysis
 */

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import { getCompanyProfile } from '@/services/api/pro/companyService';
import { createAnalysis } from '@/services/api/pro/analysisService';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  FileText,
  Upload,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  X,
  ArrowLeft,
  Sparkles,
} from 'lucide-react';
import type { CompanyProfile } from '@/types/pro';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ACCEPTED_FILE_TYPES = ['application/pdf'];

export default function NewProAnalysis() {
  const navigate = useNavigate();
  const { user, userType } = useApp();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<CompanyProfile | null>(null);

  // Form data
  const [file, setFile] = useState<File | null>(null);
  const [formData, setFormData] = useState({
    reference_devis: '',
    nom_projet: '',
    montant_ht: '',
    montant_ttc: '',
  });

  useEffect(() => {
    // Vérifier que l'utilisateur est bien de type B2B
    if (user && userType !== 'B2B') {
      navigate('/dashboard');
      return;
    }

    loadProfile();
  }, [user, userType, navigate]);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const companyProfile = await getCompanyProfile();

      if (!companyProfile) {
        // Rediriger vers onboarding si pas de profil
        navigate('/pro/onboarding');
        return;
      }

      setProfile(companyProfile);
    } catch (err: any) {
      setError(err.message || 'Erreur lors du chargement du profil');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    setError(null);

    if (!selectedFile) {
      setFile(null);
      return;
    }

    // Vérifier le type de fichier
    if (!ACCEPTED_FILE_TYPES.includes(selectedFile.type)) {
      setError('Seuls les fichiers PDF sont acceptés');
      setFile(null);
      return;
    }

    // Vérifier la taille
    if (selectedFile.size > MAX_FILE_SIZE) {
      setError(`Le fichier est trop volumineux (max ${MAX_FILE_SIZE / 1024 / 1024}MB)`);
      setFile(null);
      return;
    }

    setFile(selectedFile);
  };

  const handleRemoveFile = () => {
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!profile) {
      setError('Profil entreprise non trouvé');
      return;
    }

    if (!file) {
      setError('Veuillez sélectionner un fichier de devis');
      return;
    }

    if (!formData.reference_devis.trim()) {
      setError('La référence du devis est requise');
      return;
    }

    try {
      setUploading(true);
      setProgress(10);

      // Simuler la progression de l'upload
      const progressInterval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      const analysis = await createAnalysis({
        company_id: profile.id,
        reference_devis: formData.reference_devis,
        nom_projet: formData.nom_projet || undefined,
        montant_ht: formData.montant_ht ? parseFloat(formData.montant_ht) : undefined,
        montant_ttc: formData.montant_ttc ? parseFloat(formData.montant_ttc) : undefined,
        file,
      });

      clearInterval(progressInterval);
      setProgress(100);

      // Rediriger vers la page de détail de l'analyse
      setTimeout(() => {
        navigate(`/pro/analysis/${analysis.id}`);
      }, 500);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la création de l\'analyse');
      setProgress(0);
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!profile) {
    return null; // Redirection handled in useEffect
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/pro/dashboard')}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour au dashboard
          </Button>

          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Sparkles className="w-8 h-8 text-primary" />
            Nouvelle Analyse de Devis
          </h1>
          <p className="text-muted-foreground mt-2">
            Soumettez votre devis pour obtenir un score TORP et des recommandations d'amélioration
          </p>
        </div>

        <Card>
          <form onSubmit={handleSubmit}>
            <CardHeader>
              <CardTitle>Informations du devis</CardTitle>
              <CardDescription>
                Uploadez votre devis au format PDF et renseignez les informations principales
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              {error && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Erreur</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* Upload de fichier */}
              <div className="space-y-3">
                <Label htmlFor="file">Fichier devis (PDF) *</Label>

                {!file ? (
                  <div
                    className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-sm font-medium mb-1">
                      Cliquez pour sélectionner un fichier
                    </p>
                    <p className="text-xs text-muted-foreground">
                      PDF uniquement, max {MAX_FILE_SIZE / 1024 / 1024}MB
                    </p>
                  </div>
                ) : (
                  <div className="border rounded-lg p-4 flex items-center justify-between bg-muted/30">
                    <div className="flex items-center gap-3">
                      <FileText className="w-10 h-10 text-primary" />
                      <div>
                        <p className="font-medium text-sm">{file.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {(file.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleRemoveFile}
                      disabled={uploading}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  id="file"
                  type="file"
                  accept=".pdf"
                  onChange={handleFileChange}
                  className="hidden"
                  disabled={uploading}
                />
              </div>

              {/* Référence devis */}
              <div className="space-y-2">
                <Label htmlFor="reference_devis">
                  Référence du devis *
                </Label>
                <Input
                  id="reference_devis"
                  value={formData.reference_devis}
                  onChange={(e) => setFormData({ ...formData, reference_devis: e.target.value })}
                  placeholder="DEV-2024-001"
                  disabled={uploading}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Numéro de référence unique de votre devis
                </p>
              </div>

              {/* Nom du projet */}
              <div className="space-y-2">
                <Label htmlFor="nom_projet">Nom du projet</Label>
                <Input
                  id="nom_projet"
                  value={formData.nom_projet}
                  onChange={(e) => setFormData({ ...formData, nom_projet: e.target.value })}
                  placeholder="Rénovation appartement Paris 16"
                  disabled={uploading}
                />
                <p className="text-xs text-muted-foreground">
                  Optionnel - pour mieux identifier votre projet
                </p>
              </div>

              {/* Montants */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="montant_ht">Montant HT (€)</Label>
                  <Input
                    id="montant_ht"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.montant_ht}
                    onChange={(e) => setFormData({ ...formData, montant_ht: e.target.value })}
                    placeholder="15000"
                    disabled={uploading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="montant_ttc">Montant TTC (€)</Label>
                  <Input
                    id="montant_ttc"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.montant_ttc}
                    onChange={(e) => setFormData({ ...formData, montant_ttc: e.target.value })}
                    placeholder="18000"
                    disabled={uploading}
                  />
                </div>
              </div>

              {/* Progress bar */}
              {uploading && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Upload en cours...</span>
                    <span className="font-medium">{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>
              )}

              {/* Info box */}
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  Ce que vous allez recevoir
                </h4>
                <ul className="text-xs text-muted-foreground space-y-1.5">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 text-green-600 shrink-0" />
                    <span>Un score TORP sur 1000 points (4 axes : Transparence, Offre, Robustesse, Prix)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 text-green-600 shrink-0" />
                    <span>Des recommandations concrètes pour améliorer votre devis</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 text-green-600 shrink-0" />
                    <span>La possibilité de générer un badge TORP avec QR code pour vos clients</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 text-green-600 shrink-0" />
                    <span>Un historique de versions pour suivre vos améliorations</span>
                  </li>
                </ul>
              </div>
            </CardContent>

            <CardFooter className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/pro/dashboard')}
                disabled={uploading}
                className="flex-1"
              >
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={uploading || !file || !formData.reference_devis.trim()}
                className="flex-1"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Analyse en cours...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Lancer l'analyse
                  </>
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>

        {/* Info supplémentaire */}
        <div className="mt-6 text-center">
          <p className="text-sm text-muted-foreground">
            L'analyse prend généralement entre 30 secondes et 2 minutes.
            <br />
            Vous serez redirigé automatiquement vers les résultats.
          </p>
        </div>
      </div>
    </div>
  );
}
