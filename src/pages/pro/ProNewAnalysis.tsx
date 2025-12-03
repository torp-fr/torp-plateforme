/**
 * ProNewAnalysis Page
 * Créer une nouvelle analyse de devis pour les professionnels B2B
 */

import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ProLayout } from '@/components/pro/ProLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useApp } from '@/context/AppContext';
import { supabase } from '@/lib/supabase';
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

interface UploadedFile {
  file: File;
  preview?: string;
  uploading: boolean;
  uploaded: boolean;
  error?: string;
  url?: string;
}

export default function ProNewAnalysis() {
  const navigate = useNavigate();
  const { user } = useApp();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<'upload' | 'details' | 'processing'>('upload');
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [projectName, setProjectName] = useState('');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [processing, setProcessing] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);

  // Charger l'ID de l'entreprise
  useState(() => {
    async function loadCompany() {
      if (!user?.id) return;
      const { data } = await supabase
        .from('companies')
        .select('id')
        .eq('user_id', user.id)
        .single();
      if (data) setCompanyId(data.id);
    }
    loadCompany();
  });

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFiles = e.target.files;
    if (!selectedFiles) return;

    const newFiles: UploadedFile[] = Array.from(selectedFiles).map((file) => ({
      file,
      uploading: false,
      uploaded: false,
    }));

    setFiles((prev) => [...prev, ...newFiles]);
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function uploadFiles() {
    if (!companyId) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Entreprise non trouvée. Veuillez vous reconnecter.',
      });
      return;
    }

    setProcessing(true);

    try {
      // Upload chaque fichier
      const uploadedUrls: string[] = [];

      for (let i = 0; i < files.length; i++) {
        const fileData = files[i];
        setFiles((prev) =>
          prev.map((f, idx) => (idx === i ? { ...f, uploading: true } : f))
        );

        const fileExt = fileData.file.name.split('.').pop();
        const fileName = `${companyId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('pro-devis')
          .upload(fileName, fileData.file);

        if (uploadError) {
          setFiles((prev) =>
            prev.map((f, idx) =>
              idx === i ? { ...f, uploading: false, error: 'Échec upload' } : f
            )
          );
          continue;
        }

        const { data: urlData } = supabase.storage
          .from('pro-devis')
          .getPublicUrl(fileName);

        uploadedUrls.push(urlData.publicUrl);

        setFiles((prev) =>
          prev.map((f, idx) =>
            idx === i
              ? { ...f, uploading: false, uploaded: true, url: urlData.publicUrl }
              : f
          )
        );
      }

      if (uploadedUrls.length === 0) {
        throw new Error('Aucun fichier uploadé');
      }

      // Créer l'analyse en base
      const { data: analysis, error: analysisError } = await supabase
        .from('pro_devis_analyses')
        .insert({
          company_id: companyId,
          nom_projet: projectName || null,
          reference_devis: reference || `DEV-${Date.now()}`,
          notes: notes || null,
          fichiers_urls: uploadedUrls,
          status: 'pending',
        })
        .select()
        .single();

      if (analysisError) throw analysisError;

      toast({
        title: 'Analyse créée',
        description: 'Votre devis est en cours d\'analyse.',
      });

      // Rediriger vers la liste des analyses
      navigate('/pro/analyses');
    } catch (error) {
      console.error('[ProNewAnalysis] Erreur:', error);
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Impossible de créer l\'analyse.',
      });
    } finally {
      setProcessing(false);
    }
  }

  function handleSubmit() {
    if (files.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Fichier requis',
        description: 'Veuillez ajouter au moins un devis à analyser.',
      });
      return;
    }
    uploadFiles();
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

        {/* Zone d'upload */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Devis à analyser
            </CardTitle>
            <CardDescription>
              Formats acceptés : PDF, JPG, PNG (max 10 Mo par fichier)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Drop zone */}
            <div
              className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-2">
                Cliquez ou glissez-déposez vos fichiers ici
              </p>
              <Button variant="outline" size="sm">
                Parcourir
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                multiple
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>

            {/* Liste des fichiers */}
            {files.length > 0 && (
              <div className="space-y-2">
                {files.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">{file.file.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {(file.file.size / 1024 / 1024).toFixed(2)} Mo
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {file.uploading && (
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      )}
                      {file.uploaded && (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      )}
                      {file.error && (
                        <AlertCircle className="h-4 w-4 text-red-500" />
                      )}
                      {!file.uploading && !file.uploaded && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeFile(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
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
                <Label htmlFor="reference">Référence devis</Label>
                <Input
                  id="reference"
                  placeholder="Ex: DEV-2024-001"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
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
          <Button onClick={handleSubmit} disabled={processing || files.length === 0}>
            {processing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Analyse en cours...
              </>
            ) : (
              <>
                Lancer l'analyse
                <ArrowRight className="h-4 w-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      </div>
    </ProLayout>
  );
}
