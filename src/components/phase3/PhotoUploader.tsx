/**
 * PhotoUploader - Composant d'upload et d'analyse de photos de chantier Phase 3
 */

import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Upload,
  X,
  Image as ImageIcon,
  Camera,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Eye,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { photoAnalysisAgent } from '@/ai/agents/phase3';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface PhotoUploaderProps {
  projetId: string;
  lotId?: string;
  zone?: string;
  onUploadComplete?: (photos: UploadedPhoto[]) => void;
  maxFiles?: number;
  analyzeOnUpload?: boolean;
  className?: string;
}

interface UploadedPhoto {
  id: string;
  url: string;
  name: string;
  size: number;
  uploadedAt: Date;
  analysis?: PhotoAnalysis;
}

interface PhotoAnalysis {
  avancementEstime: number;
  conformiteGenerale: 'conforme' | 'attention' | 'non_conforme';
  anomalies: Array<{ type: string; description: string; severite: string }>;
  tagsAutomatiques: string[];
}

interface FileWithPreview extends File {
  preview: string;
}

export function PhotoUploader({
  projetId,
  lotId,
  zone,
  onUploadComplete,
  maxFiles = 10,
  analyzeOnUpload = true,
  className,
}: PhotoUploaderProps) {
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [uploadedPhotos, setUploadedPhotos] = useState<UploadedPhoto[]>([]);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const newFiles = acceptedFiles.slice(0, maxFiles - files.length).map((file) =>
        Object.assign(file, {
          preview: URL.createObjectURL(file),
        })
      );
      setFiles((prev) => [...prev, ...newFiles]);
    },
    [files.length, maxFiles]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.webp'],
    },
    maxFiles: maxFiles - files.length,
    disabled: uploading || files.length >= maxFiles,
  });

  const removeFile = (index: number) => {
    setFiles((prev) => {
      const newFiles = [...prev];
      URL.revokeObjectURL(newFiles[index].preview);
      newFiles.splice(index, 1);
      return newFiles;
    });
  };

  const uploadFiles = async () => {
    if (files.length === 0) return;

    setUploading(true);
    setProgress(0);

    const uploaded: UploadedPhoto[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileName = `${projetId}/${Date.now()}-${file.name}`;

        // Upload to Supabase Storage
        const { data, error } = await supabase.storage
          .from('site-photos')
          .upload(fileName, file);

        if (error) throw error;

        // Get public URL
        const {
          data: { publicUrl },
        } = supabase.storage.from('site-photos').getPublicUrl(data.path);

        uploaded.push({
          id: crypto.randomUUID(),
          url: publicUrl,
          name: file.name,
          size: file.size,
          uploadedAt: new Date(),
        });

        setProgress(((i + 1) / files.length) * 100);
      }

      setUploadedPhotos((prev) => [...prev, ...uploaded]);

      // Clean up previews
      files.forEach((file) => URL.revokeObjectURL(file.preview));
      setFiles([]);

      toast.success(`${uploaded.length} photo(s) uploadée(s)`);

      // Analyze if enabled
      if (analyzeOnUpload && uploaded.length > 0) {
        await analyzePhotos(uploaded);
      }

      onUploadComplete?.(uploaded);
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Erreur lors de l\'upload');
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  const analyzePhotos = async (photos: UploadedPhoto[]) => {
    setAnalyzing(true);

    try {
      const results = await photoAnalysisAgent.analyzeBatch(
        photos.map((p) => ({ url: p.url, zone, lotId })),
        projetId
      );

      // Update photos with analysis results
      setUploadedPhotos((prev) =>
        prev.map((photo) => {
          const analysis = results.resultats.find((r) => r.url === photo.url);
          if (analysis) {
            return {
              ...photo,
              analysis: {
                avancementEstime: analysis.avancementEstime,
                conformiteGenerale: analysis.conformiteGenerale,
                anomalies: analysis.anomalies.map((a) => ({
                  type: a.type,
                  description: a.description,
                  severite: a.severite,
                })),
                tagsAutomatiques: analysis.tagsAutomatiques,
              },
            };
          }
          return photo;
        })
      );

      toast.success('Analyse des photos terminée');
    } catch (error) {
      console.error('Analysis error:', error);
      toast.error('Erreur lors de l\'analyse');
    } finally {
      setAnalyzing(false);
    }
  };

  const getConformiteBadge = (conformite?: string) => {
    switch (conformite) {
      case 'conforme':
        return (
          <Badge className="bg-green-100 text-green-800">
            <CheckCircle className="mr-1 h-3 w-3" />
            Conforme
          </Badge>
        );
      case 'attention':
        return (
          <Badge className="bg-yellow-100 text-yellow-800">
            <AlertTriangle className="mr-1 h-3 w-3" />
            Attention
          </Badge>
        );
      case 'non_conforme':
        return (
          <Badge className="bg-red-100 text-red-800">
            <AlertTriangle className="mr-1 h-3 w-3" />
            Non conforme
          </Badge>
        );
      default:
        return <Badge variant="outline">En attente</Badge>;
    }
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Camera className="h-5 w-5" />
          Photos de chantier
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Zone de drop */}
        <div
          {...getRootProps()}
          className={cn(
            'cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors',
            isDragActive && 'border-primary bg-primary/5',
            files.length >= maxFiles && 'cursor-not-allowed opacity-50'
          )}
        >
          <input {...getInputProps()} />
          <Upload className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">
            {isDragActive
              ? 'Déposez les fichiers ici...'
              : 'Glissez-déposez des photos ou cliquez pour sélectionner'}
          </p>
          <p className="text-xs text-muted-foreground">
            Max {maxFiles} fichiers • JPG, PNG, WebP
          </p>
        </div>

        {/* Preview des fichiers */}
        {files.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Fichiers sélectionnés ({files.length})</p>
            <div className="grid grid-cols-4 gap-2">
              {files.map((file, index) => (
                <div key={index} className="group relative">
                  <img
                    src={file.preview}
                    alt={file.name}
                    className="h-20 w-full rounded-md object-cover"
                  />
                  <button
                    onClick={() => removeFile(index)}
                    className="absolute -right-1 -top-1 rounded-full bg-red-500 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>

            {/* Bouton d'upload */}
            <Button onClick={uploadFiles} disabled={uploading} className="w-full">
              {uploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Upload en cours ({Math.round(progress)}%)
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Uploader {files.length} photo(s)
                </>
              )}
            </Button>

            {uploading && <Progress value={progress} className="h-2" />}
          </div>
        )}

        {/* Photos uploadées */}
        {uploadedPhotos.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Photos uploadées ({uploadedPhotos.length})</p>
              {analyzing && (
                <Badge variant="outline">
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  Analyse en cours...
                </Badge>
              )}
            </div>

            <div className="space-y-2">
              {uploadedPhotos.map((photo) => (
                <div
                  key={photo.id}
                  className="flex items-center gap-3 rounded-lg border p-2"
                >
                  <img
                    src={photo.url}
                    alt={photo.name}
                    className="h-16 w-16 rounded object-cover"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium">{photo.name}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {getConformiteBadge(photo.analysis?.conformiteGenerale)}
                      {photo.analysis && (
                        <Badge variant="outline">
                          {photo.analysis.avancementEstime}% avancement
                        </Badge>
                      )}
                    </div>
                    {photo.analysis?.tagsAutomatiques && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {photo.analysis.tagsAutomatiques.slice(0, 3).map((tag, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <Button size="sm" variant="ghost">
                    <Eye className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* État vide */}
        {files.length === 0 && uploadedPhotos.length === 0 && (
          <div className="py-8 text-center text-muted-foreground">
            <ImageIcon className="mx-auto h-12 w-12 opacity-50" />
            <p className="mt-2">Aucune photo</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
