/**
 * MaterialRecognitionService
 * Service de reconnaissance de matériel via IA Vision (style Google Lens)
 *
 * Permet d'identifier automatiquement le matériel à partir d'une photo :
 * - Catégorie (véhicules, engins, outillage, etc.)
 * - Type exact
 * - Marque et modèle
 * - Spécifications techniques
 * - Estimation de valeur
 */

import { supabase } from '@/lib/supabase';
import type { MaterialCategory } from '@/types/company.types';

// Résultat de la reconnaissance
export interface MaterialRecognitionResult {
  success: boolean;
  confidence: number;
  category: MaterialCategory | 'unknown';
  categoryLabel?: string;
  type: string;
  brand?: string;
  model?: string;
  specifications?: {
    year?: number;
    power?: string;
    capacity?: string;
    dimensions?: string;
    weight?: string;
    features?: string[];
  };
  estimatedValue?: {
    min: number;
    max: number;
    currency: string;
  };
  usage?: string[];
  maintenance?: string[];
  safetyNotes?: string[];
  rawDescription?: string;
}

// Options pour la reconnaissance
export interface RecognitionOptions {
  context?: string;
  maxFileSize?: number; // En bytes, par défaut 10MB
}

const DEFAULT_OPTIONS: RecognitionOptions = {
  maxFileSize: 10 * 1024 * 1024, // 10MB
};

export class MaterialRecognitionService {
  /**
   * Convertit un fichier image en base64
   */
  static async fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Extraire uniquement la partie base64 (sans le préfixe data:image/xxx;base64,)
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /**
   * Compresse une image si nécessaire pour respecter la limite de taille
   */
  static async compressImage(file: File, maxSize: number = 5 * 1024 * 1024): Promise<File> {
    // Si le fichier est déjà assez petit, le retourner tel quel
    if (file.size <= maxSize) {
      return file;
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      img.onload = () => {
        // Calculer les nouvelles dimensions en gardant le ratio
        let { width, height } = img;
        const ratio = Math.sqrt(maxSize / file.size);

        width = Math.floor(width * ratio);
        height = Math.floor(height * ratio);

        canvas.width = width;
        canvas.height = height;

        ctx?.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(new File([blob], file.name, { type: 'image/jpeg' }));
            } else {
              reject(new Error('Failed to compress image'));
            }
          },
          'image/jpeg',
          0.8
        );
      };

      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }

  /**
   * Valide le fichier image
   */
  static validateFile(file: File, options: RecognitionOptions = {}): { valid: boolean; error?: string } {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    // Vérifier le type de fichier
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      return {
        valid: false,
        error: `Type de fichier non supporté. Utilisez: ${allowedTypes.map((t) => t.split('/')[1]).join(', ')}`,
      };
    }

    // Vérifier la taille
    if (file.size > opts.maxFileSize!) {
      return {
        valid: false,
        error: `Fichier trop volumineux. Maximum: ${Math.round(opts.maxFileSize! / 1024 / 1024)}MB`,
      };
    }

    return { valid: true };
  }

  /**
   * Reconnaît le matériel à partir d'une image
   */
  static async recognizeFromFile(
    file: File,
    options: RecognitionOptions = {}
  ): Promise<MaterialRecognitionResult> {
    // Valider le fichier
    const validation = this.validateFile(file, options);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    // Compresser si nécessaire
    const processedFile = await this.compressImage(file);

    // Convertir en base64
    const imageBase64 = await this.fileToBase64(processedFile);

    // Déterminer le type d'image
    const imageType = processedFile.type || 'image/jpeg';

    // Appeler l'Edge Function
    const { data, error } = await supabase.functions.invoke('recognize-material', {
      body: {
        imageBase64,
        imageType,
        context: options.context,
      },
    });

    if (error) {
      console.error('[MaterialRecognition] Edge function error:', error);
      throw new Error('Erreur lors de la reconnaissance. Veuillez réessayer.');
    }

    if (!data?.success) {
      throw new Error(data?.error || 'Échec de la reconnaissance');
    }

    return data.data as MaterialRecognitionResult;
  }

  /**
   * Reconnaît le matériel à partir d'une URL d'image
   */
  static async recognizeFromUrl(
    imageUrl: string,
    options: RecognitionOptions = {}
  ): Promise<MaterialRecognitionResult> {
    // Télécharger l'image
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error('Impossible de télécharger l\'image');
    }

    const blob = await response.blob();
    const file = new File([blob], 'image.jpg', { type: blob.type || 'image/jpeg' });

    return this.recognizeFromFile(file, options);
  }

  /**
   * Capture une photo depuis la caméra (mobile/desktop)
   */
  static async captureFromCamera(): Promise<File> {
    return new Promise((resolve, reject) => {
      // Créer un input file temporaire avec capture
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.capture = 'environment'; // Caméra arrière sur mobile

      input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
          resolve(file);
        } else {
          reject(new Error('Aucune image capturée'));
        }
      };

      input.click();
    });
  }

  /**
   * Mappe le résultat de reconnaissance vers les champs du formulaire matériel
   */
  static mapToMaterialForm(result: MaterialRecognitionResult): {
    category: MaterialCategory;
    type: string;
    name?: string;
    brand?: string;
    model?: string;
    yearAcquisition?: number;
    value?: number;
    notes?: string;
  } {
    // Mapper la catégorie
    const validCategories: MaterialCategory[] = [
      'vehicules',
      'engins',
      'outillage',
      'equipements',
      'informatique',
      'locaux',
    ];

    const category = validCategories.includes(result.category as MaterialCategory)
      ? (result.category as MaterialCategory)
      : 'equipements'; // Catégorie par défaut

    // Construire les notes à partir des infos supplémentaires
    const noteParts: string[] = [];

    if (result.rawDescription) {
      noteParts.push(`Description: ${result.rawDescription}`);
    }

    if (result.specifications?.features?.length) {
      noteParts.push(`Caractéristiques: ${result.specifications.features.join(', ')}`);
    }

    if (result.usage?.length) {
      noteParts.push(`Usages: ${result.usage.join(', ')}`);
    }

    if (result.maintenance?.length) {
      noteParts.push(`Maintenance: ${result.maintenance.join(', ')}`);
    }

    if (result.safetyNotes?.length) {
      noteParts.push(`Sécurité: ${result.safetyNotes.join(', ')}`);
    }

    // Calculer la valeur moyenne estimée
    let estimatedValue: number | undefined;
    if (result.estimatedValue) {
      estimatedValue = Math.round((result.estimatedValue.min + result.estimatedValue.max) / 2);
    }

    return {
      category,
      type: result.type || 'Non identifié',
      name: result.model ? `${result.brand || ''} ${result.model}`.trim() : undefined,
      brand: result.brand,
      model: result.model,
      yearAcquisition: result.specifications?.year,
      value: estimatedValue,
      notes: noteParts.length > 0 ? noteParts.join('\n\n') : undefined,
    };
  }
}

// Export par défaut
export default MaterialRecognitionService;
