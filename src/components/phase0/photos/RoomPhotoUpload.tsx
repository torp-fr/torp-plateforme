/**
 * Composant d'upload de photos par pièce
 * Permet aux utilisateurs de capturer/télécharger des photos pour chaque pièce
 */

import React, { useState, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Camera,
  Upload,
  Image as ImageIcon,
  X,
  Plus,
  Trash2,
  ZoomIn,
  CheckCircle,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { RoomType, PhotoType } from '@/types/phase0/property.types';
import type { RoomPhotoSet, PhotoEntry } from '@/types/phase0/diagnostic.types';

// =============================================================================
// TYPES
// =============================================================================

export interface RoomPhotoUploadProps {
  projectId: string;
  roomName: string;
  roomType: RoomType;
  level: number;
  existingPhotos?: RoomPhotoSet;
  onPhotosChange: (photos: RoomPhotoSet) => void;
  disabled?: boolean;
  className?: string;
}

interface UploadedPhoto {
  id: string;
  file: File;
  preview: string;
  category: 'overview' | 'detail' | 'ceiling';
  description: string;
  status: 'pending' | 'uploading' | 'success' | 'error';
  progress: number;
  url?: string;
  error?: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];

const PHOTO_CATEGORIES = [
  { value: 'overview', label: 'Vue d\'ensemble', icon: ImageIcon, description: 'Photo générale de la pièce' },
  { value: 'detail', label: 'Détail', icon: ZoomIn, description: 'Détail spécifique (défaut, équipement...)' },
  { value: 'ceiling', label: 'Plafond', icon: Camera, description: 'État du plafond' },
] as const;

const ROOM_TYPE_LABELS: Record<RoomType, string> = {
  living_room: 'Salon',
  dining_room: 'Salle à manger',
  bedroom: 'Chambre',
  bathroom: 'Salle de bain',
  shower_room: 'Salle d\'eau',
  toilet: 'WC',
  kitchen: 'Cuisine',
  office: 'Bureau',
  laundry: 'Buanderie',
  dressing: 'Dressing',
  storage: 'Rangement',
  cellar: 'Cave',
  attic: 'Grenier',
  garage: 'Garage',
  workshop: 'Atelier',
  veranda: 'Véranda',
  entrance: 'Entrée',
  hallway: 'Couloir',
  staircase: 'Escalier',
  utility: 'Local technique',
  other: 'Autre',
};

// =============================================================================
// COMPONENT
// =============================================================================

export function RoomPhotoUpload({
  projectId,
  roomName,
  roomType,
  level,
  existingPhotos,
  onPhotosChange,
  disabled = false,
  className,
}: RoomPhotoUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<UploadedPhoto | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [captureMode, setCaptureMode] = useState(false);

  // Charger les photos existantes
  React.useEffect(() => {
    if (existingPhotos) {
      const loadedPhotos: UploadedPhoto[] = [
        ...(existingPhotos.overview || []).map(p => mapPhotoEntryToUploadedPhoto(p, 'overview')),
        ...(existingPhotos.details || []).map(p => mapPhotoEntryToUploadedPhoto(p, 'detail')),
        ...(existingPhotos.ceiling || []).map(p => mapPhotoEntryToUploadedPhoto(p, 'ceiling')),
      ];
      setPhotos(loadedPhotos);
    }
  }, [existingPhotos]);

  // Validation du fichier
  const validateFile = useCallback((file: File): string | null => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return 'Format non supporté. Utilisez JPG, PNG ou WebP.';
    }
    if (file.size > MAX_FILE_SIZE) {
      return 'Fichier trop volumineux (max 10 MB)';
    }
    return null;
  }, []);

  // Gestion de la sélection de fichiers
  const handleFileSelect = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const newPhotos: UploadedPhoto[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const error = validateFile(file);

      if (error) {
        continue; // Skip invalid files
      }

      const preview = URL.createObjectURL(file);
      const photo: UploadedPhoto = {
        id: `${Date.now()}-${i}`,
        file,
        preview,
        category: 'overview',
        description: '',
        status: 'pending',
        progress: 0,
      };

      newPhotos.push(photo);
    }

    setPhotos(prev => [...prev, ...newPhotos]);
  }, [validateFile]);

  // Upload d'une photo vers Supabase Storage
  const uploadPhoto = useCallback(async (photo: UploadedPhoto): Promise<string> => {
    const fileName = `phase0/${projectId}/rooms/${roomName}/${photo.category}/${Date.now()}_${photo.file.name}`;

    setPhotos(prev => prev.map(p =>
      p.id === photo.id ? { ...p, status: 'uploading', progress: 0 } : p
    ));

    const { data, error } = await supabase.storage
      .from('documents')
      .upload(fileName, photo.file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      throw new Error(error.message);
    }

    const { data: urlData } = supabase.storage
      .from('documents')
      .getPublicUrl(fileName);

    return urlData.publicUrl;
  }, [projectId, roomName]);

  // Upload de toutes les photos en attente
  const handleUploadAll = useCallback(async () => {
    const pendingPhotos = photos.filter(p => p.status === 'pending');
    if (pendingPhotos.length === 0) return;

    setIsUploading(true);

    for (const photo of pendingPhotos) {
      try {
        const url = await uploadPhoto(photo);

        setPhotos(prev => prev.map(p =>
          p.id === photo.id ? { ...p, status: 'success', progress: 100, url } : p
        ));
      } catch (error) {
        setPhotos(prev => prev.map(p =>
          p.id === photo.id ? {
            ...p,
            status: 'error',
            error: error instanceof Error ? error.message : 'Erreur inconnue',
          } : p
        ));
      }
    }

    setIsUploading(false);

    // Mettre à jour les photos du parent
    updateParentPhotos();
  }, [photos, uploadPhoto]);

  // Mise à jour des photos côté parent
  const updateParentPhotos = useCallback(() => {
    const successPhotos = photos.filter(p => p.status === 'success' && p.url);

    const roomPhotoSet: RoomPhotoSet = {
      room: roomName,
      level,
      overview: successPhotos
        .filter(p => p.category === 'overview')
        .map(mapUploadedPhotoToEntry),
      details: successPhotos
        .filter(p => p.category === 'detail')
        .map(mapUploadedPhotoToEntry),
      ceiling: successPhotos
        .filter(p => p.category === 'ceiling')
        .map(mapUploadedPhotoToEntry),
    };

    onPhotosChange(roomPhotoSet);
  }, [photos, roomName, level, onPhotosChange]);

  // Suppression d'une photo
  const handleDeletePhoto = useCallback((photoId: string) => {
    setPhotos(prev => {
      const photo = prev.find(p => p.id === photoId);
      if (photo?.preview) {
        URL.revokeObjectURL(photo.preview);
      }
      return prev.filter(p => p.id !== photoId);
    });
  }, []);

  // Changement de catégorie
  const handleCategoryChange = useCallback((photoId: string, category: UploadedPhoto['category']) => {
    setPhotos(prev => prev.map(p =>
      p.id === photoId ? { ...p, category } : p
    ));
  }, []);

  // Changement de description
  const handleDescriptionChange = useCallback((photoId: string, description: string) => {
    setPhotos(prev => prev.map(p =>
      p.id === photoId ? { ...p, description } : p
    ));
  }, []);

  // Drag & Drop
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFileSelect(e.dataTransfer.files);
  }, [handleFileSelect]);

  // Capture caméra
  const handleCapture = useCallback(() => {
    if (fileInputRef.current) {
      fileInputRef.current.setAttribute('capture', 'environment');
      fileInputRef.current.click();
    }
  }, []);

  const pendingCount = photos.filter(p => p.status === 'pending').length;
  const uploadedCount = photos.filter(p => p.status === 'success').length;

  return (
    <Card className={cn('', className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Camera className="w-5 h-5 text-primary" />
          Photos - {roomName}
          <Badge variant="outline" className="ml-2">
            {ROOM_TYPE_LABELS[roomType]}
          </Badge>
        </CardTitle>
        <CardDescription>
          Niveau {level >= 0 ? level : `sous-sol ${Math.abs(level)}`} •
          {uploadedCount > 0 && ` ${uploadedCount} photo(s) uploadée(s)`}
          {pendingCount > 0 && ` • ${pendingCount} en attente`}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Zone de drop */}
        <div
          className={cn(
            'border-2 border-dashed rounded-lg p-6 text-center transition-colors',
            dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25',
            disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-primary/50',
          )}
          onDragOver={!disabled ? handleDragOver : undefined}
          onDragLeave={!disabled ? handleDragLeave : undefined}
          onDrop={!disabled ? handleDrop : undefined}
          onClick={!disabled ? () => fileInputRef.current?.click() : undefined}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={ALLOWED_TYPES.join(',')}
            multiple
            className="hidden"
            onChange={(e) => handleFileSelect(e.target.files)}
            disabled={disabled}
          />

          <div className="flex flex-col items-center gap-2">
            <Upload className="w-10 h-10 text-muted-foreground" />
            <p className="font-medium">Glissez vos photos ici</p>
            <p className="text-sm text-muted-foreground">ou cliquez pour parcourir</p>
          </div>
        </div>

        {/* Boutons d'action */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCapture}
            disabled={disabled}
          >
            <Camera className="w-4 h-4 mr-2" />
            Prendre une photo
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
          >
            <Upload className="w-4 h-4 mr-2" />
            Parcourir
          </Button>
        </div>

        {/* Liste des photos */}
        {photos.length > 0 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {photos.map((photo) => (
                <div
                  key={photo.id}
                  className="relative group rounded-lg overflow-hidden border bg-muted/50"
                >
                  {/* Aperçu */}
                  <div
                    className="aspect-square cursor-pointer"
                    onClick={() => {
                      setSelectedPhoto(photo);
                      setShowPreview(true);
                    }}
                  >
                    <img
                      src={photo.preview}
                      alt={photo.description || 'Photo'}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Statut */}
                  <div className="absolute top-2 right-2">
                    {photo.status === 'uploading' && (
                      <div className="bg-blue-500 rounded-full p-1">
                        <Loader2 className="w-4 h-4 text-white animate-spin" />
                      </div>
                    )}
                    {photo.status === 'success' && (
                      <div className="bg-green-500 rounded-full p-1">
                        <CheckCircle className="w-4 h-4 text-white" />
                      </div>
                    )}
                    {photo.status === 'error' && (
                      <div className="bg-red-500 rounded-full p-1">
                        <AlertTriangle className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <Button
                      size="icon"
                      variant="secondary"
                      className="w-8 h-8"
                      onClick={() => {
                        setSelectedPhoto(photo);
                        setShowPreview(true);
                      }}
                    >
                      <ZoomIn className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="destructive"
                      className="w-8 h-8"
                      onClick={() => handleDeletePhoto(photo.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>

                  {/* Catégorie */}
                  <div className="p-2 space-y-1">
                    <Select
                      value={photo.category}
                      onValueChange={(v) => handleCategoryChange(photo.id, v as UploadedPhoto['category'])}
                      disabled={photo.status === 'uploading'}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PHOTO_CATEGORIES.map((cat) => (
                          <SelectItem key={cat.value} value={cat.value}>
                            {cat.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Barre de progression */}
                  {photo.status === 'uploading' && (
                    <Progress value={photo.progress} className="h-1 absolute bottom-0 left-0 right-0" />
                  )}
                </div>
              ))}

              {/* Bouton ajouter */}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled}
                className={cn(
                  'aspect-square rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-colors',
                  disabled
                    ? 'opacity-50 cursor-not-allowed'
                    : 'hover:border-primary hover:bg-primary/5 cursor-pointer',
                )}
              >
                <Plus className="w-8 h-8 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Ajouter</span>
              </button>
            </div>

            {/* Bouton upload */}
            {pendingCount > 0 && (
              <Button
                onClick={handleUploadAll}
                disabled={isUploading || disabled}
                className="w-full"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Upload en cours...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Uploader {pendingCount} photo(s)
                  </>
                )}
              </Button>
            )}
          </div>
        )}

        {/* Conseils */}
        <Alert>
          <Camera className="w-4 h-4" />
          <AlertDescription className="text-sm">
            <strong>Conseils :</strong> Prenez des photos bien éclairées, incluant
            les angles, les défauts visibles et les équipements existants.
            3 à 5 photos par pièce sont recommandées.
          </AlertDescription>
        </Alert>

        {/* Modal de prévisualisation */}
        <Dialog open={showPreview} onOpenChange={setShowPreview}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Aperçu de la photo</DialogTitle>
              <DialogDescription>
                {selectedPhoto?.description || 'Pas de description'}
              </DialogDescription>
            </DialogHeader>

            {selectedPhoto && (
              <div className="space-y-4">
                <div className="relative rounded-lg overflow-hidden bg-muted">
                  <img
                    src={selectedPhoto.preview}
                    alt={selectedPhoto.description || 'Photo'}
                    className="w-full h-auto max-h-[60vh] object-contain"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Catégorie</Label>
                    <Select
                      value={selectedPhoto.category}
                      onValueChange={(v) => handleCategoryChange(selectedPhoto.id, v as UploadedPhoto['category'])}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PHOTO_CATEGORIES.map((cat) => (
                          <SelectItem key={cat.value} value={cat.value}>
                            <div>
                              <span className="font-medium">{cat.label}</span>
                              <span className="text-xs text-muted-foreground ml-2">
                                {cat.description}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Input
                      value={selectedPhoto.description}
                      onChange={(e) => handleDescriptionChange(selectedPhoto.id, e.target.value)}
                      placeholder="Ex: Fissure au mur nord..."
                    />
                  </div>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowPreview(false)}>
                Fermer
              </Button>
              {selectedPhoto && (
                <Button
                  variant="destructive"
                  onClick={() => {
                    handleDeletePhoto(selectedPhoto.id);
                    setShowPreview(false);
                  }}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Supprimer
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

// =============================================================================
// HELPERS
// =============================================================================

function mapPhotoEntryToUploadedPhoto(
  entry: PhotoEntry,
  category: UploadedPhoto['category']
): UploadedPhoto {
  return {
    id: entry.id,
    file: null as unknown as File, // Photo déjà uploadée
    preview: entry.thumbnailUrl || entry.url,
    category,
    description: entry.description,
    status: 'success',
    progress: 100,
    url: entry.url,
  };
}

function mapUploadedPhotoToEntry(photo: UploadedPhoto): PhotoEntry {
  return {
    id: photo.id,
    url: photo.url || '',
    thumbnailUrl: photo.preview,
    description: photo.description,
    takenAt: new Date().toISOString(),
    location: photo.category,
  };
}

export default RoomPhotoUpload;
