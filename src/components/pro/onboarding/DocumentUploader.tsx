/**
 * Document Uploader Component
 * Composant réutilisable pour l'upload de documents entreprise
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Upload, FileText, X, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type DocumentType = 'KBIS' | 'ASSURANCE_DECENNALE' | 'ASSURANCE_RC_PRO' | 'ATTESTATION_URSSAF' | 'ATTESTATION_VIGILANCE' | 'CERTIFICATION_QUALIBAT' | 'CERTIFICATION_RGE';

interface DocumentConfig {
  type: DocumentType;
  label: string;
  obligatoire: boolean;
  description: string;
  icon: string;
}

export const DOCUMENTS_CONFIG: DocumentConfig[] = [
  { type: 'KBIS', label: 'Extrait Kbis', obligatoire: true, description: 'Moins de 3 mois', icon: '🏢' },
  { type: 'ASSURANCE_DECENNALE', label: 'Assurance décennale', obligatoire: true, description: 'En cours de validité', icon: '🛡️' },
  { type: 'ASSURANCE_RC_PRO', label: 'RC Professionnelle', obligatoire: false, description: 'Recommandé', icon: '🛡️' },
  { type: 'ATTESTATION_URSSAF', label: 'Attestation URSSAF', obligatoire: false, description: 'Moins de 6 mois', icon: '📋' },
  { type: 'ATTESTATION_VIGILANCE', label: 'Attestation Vigilance', obligatoire: false, description: 'Pour sous-traitance', icon: '📋' },
  { type: 'CERTIFICATION_QUALIBAT', label: 'Certification Qualibat', obligatoire: false, description: 'Si applicable', icon: '🏆' },
  { type: 'CERTIFICATION_RGE', label: 'Certification RGE', obligatoire: false, description: 'Si applicable', icon: '🏆' },
];

interface UploadedFile {
  file: File;
  preview: string;
  uploading: boolean;
  uploaded: boolean;
  error?: string;
}

interface DocumentUploaderProps {
  companyId: string;
  onlyRequired?: boolean; // Si true, affiche uniquement les docs obligatoires
  onUploadComplete?: (type: DocumentType, success: boolean) => void;
}

export const DocumentUploader = ({ companyId, onlyRequired = false, onUploadComplete }: DocumentUploaderProps) => {
  const [uploadedFiles, setUploadedFiles] = useState<Record<DocumentType, UploadedFile | null>>({
    KBIS: null,
    ASSURANCE_DECENNALE: null,
    ASSURANCE_RC_PRO: null,
    ATTESTATION_URSSAF: null,
    ATTESTATION_VIGILANCE: null,
    CERTIFICATION_QUALIBAT: null,
    CERTIFICATION_RGE: null,
  });

  const documentsToShow = onlyRequired
    ? DOCUMENTS_CONFIG.filter(d => d.obligatoire)
    : DOCUMENTS_CONFIG;

  const handleFileSelect = (type: DocumentType, file: File | null) => {
    if (!file) {
      setUploadedFiles(prev => ({ ...prev, [type]: null }));
      return;
    }

    // Valider le fichier
    const maxSize = 10 * 1024 * 1024; // 10MB
    const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];

    if (!validTypes.includes(file.type)) {
      setUploadedFiles(prev => ({
        ...prev,
        [type]: {
          file,
          preview: '',
          uploading: false,
          uploaded: false,
          error: 'Format non supporté. Utilisez PDF, JPG ou PNG.',
        },
      }));
      return;
    }

    if (file.size > maxSize) {
      setUploadedFiles(prev => ({
        ...prev,
        [type]: {
          file,
          preview: '',
          uploading: false,
          uploaded: false,
          error: 'Fichier trop volumineux. Maximum 10MB.',
        },
      }));
      return;
    }

    // Créer preview si image
    let preview = '';
    if (file.type.startsWith('image/')) {
      preview = URL.createObjectURL(file);
    }

    setUploadedFiles(prev => ({
      ...prev,
      [type]: {
        file,
        preview,
        uploading: false,
        uploaded: false,
      },
    }));
  };

  const uploadDocument = async (type: DocumentType) => {
    const fileData = uploadedFiles[type];
    if (!fileData || !fileData.file) return;

    setUploadedFiles(prev => ({
      ...prev,
      [type]: { ...prev[type]!, uploading: true, error: undefined },
    }));

    try {
      // 1. Upload fichier vers Supabase Storage
      const fileExt = fileData.file.name.split('.').pop();
      const fileName = `${companyId}/${type}/${Date.now()}.${fileExt}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('company-documents')
        .upload(fileName, fileData.file);

      if (uploadError) throw uploadError;

      // 2. Récupérer l'URL publique
      const { data: urlData } = supabase.storage
        .from('company-documents')
        .getPublicUrl(fileName);

      // 3. Créer l'entrée en base de données
      const { error: insertError } = await supabase.from('company_documents').insert({
        company_id: companyId,
        type,
        nom: fileData.file.name,
        file_url: urlData.publicUrl,
        file_name: fileData.file.name,
        file_size: fileData.file.size,
        mime_type: fileData.file.type,
        statut: 'PENDING',
      });

      if (insertError) throw insertError;

      setUploadedFiles(prev => ({
        ...prev,
        [type]: { ...prev[type]!, uploading: false, uploaded: true },
      }));

      onUploadComplete?.(type, true);
    } catch (error) {
      console.error('Erreur upload:', error);
      setUploadedFiles(prev => ({
        ...prev,
        [type]: {
          ...prev[type]!,
          uploading: false,
          uploaded: false,
          error: 'Erreur lors de l\'upload. Réessayez.',
        },
      }));
      onUploadComplete?.(type, false);
    }
  };

  const removeFile = (type: DocumentType) => {
    const fileData = uploadedFiles[type];
    if (fileData?.preview) {
      URL.revokeObjectURL(fileData.preview);
    }
    setUploadedFiles(prev => ({ ...prev, [type]: null }));
  };

  return (
    <div className="space-y-4">
      {documentsToShow.map((doc) => {
        const fileData = uploadedFiles[doc.type];
        const hasFile = !!fileData?.file;
        const isUploading = fileData?.uploading;
        const isUploaded = fileData?.uploaded;
        const hasError = !!fileData?.error;

        return (
          <Card key={doc.type} className={hasError ? 'border-red-300' : ''}>
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                {/* Icône */}
                <div className="text-3xl flex-shrink-0">{doc.icon}</div>

                {/* Infos */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Label className="text-base font-semibold">{doc.label}</Label>
                    {doc.obligatoire && (
                      <span className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded">
                        Obligatoire
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">{doc.description}</p>

                  {/* État du fichier */}
                  {!hasFile ? (
                    // Aucun fichier
                    <div>
                      <Input
                        id={`file-${doc.type}`}
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => handleFileSelect(doc.type, e.target.files?.[0] || null)}
                        className="hidden"
                      />
                      <Label
                        htmlFor={`file-${doc.type}`}
                        className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 border border-dashed border-border rounded-md hover:bg-muted transition-colors"
                      >
                        <Upload className="w-4 h-4" />
                        <span className="text-sm">Choisir un fichier</span>
                      </Label>
                      <p className="text-xs text-muted-foreground mt-1">
                        PDF, JPG ou PNG • Max 10MB
                      </p>
                    </div>
                  ) : (
                    // Fichier sélectionné
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 bg-muted rounded-lg p-3">
                        {fileData.preview ? (
                          <img
                            src={fileData.preview}
                            alt="Preview"
                            className="w-12 h-12 object-cover rounded"
                          />
                        ) : (
                          <FileText className="w-12 h-12 text-muted-foreground" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{fileData.file.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {(fileData.file.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2">
                          {isUploaded ? (
                            <CheckCircle2 className="w-5 h-5 text-green-600" />
                          ) : isUploading ? (
                            <Loader2 className="w-5 h-5 animate-spin text-primary" />
                          ) : hasError ? (
                            <AlertCircle className="w-5 h-5 text-red-600" />
                          ) : (
                            <>
                              <Button
                                size="sm"
                                onClick={() => uploadDocument(doc.type)}
                                disabled={isUploading}
                              >
                                <Upload className="w-4 h-4 mr-1" />
                                Uploader
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => removeFile(doc.type)}
                                disabled={isUploading}
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Erreur */}
                      {hasError && (
                        <p className="text-sm text-red-600 flex items-center gap-1">
                          <AlertCircle className="w-4 h-4" />
                          {fileData.error}
                        </p>
                      )}

                      {/* Succès */}
                      {isUploaded && (
                        <p className="text-sm text-green-600 flex items-center gap-1">
                          <CheckCircle2 className="w-4 h-4" />
                          Document uploadé avec succès
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
