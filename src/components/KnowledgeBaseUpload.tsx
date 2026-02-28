/**
 * Knowledge Base Document Upload Component
 * PHASE 36.2: Refactored to use new knowledge_documents schema and knowledgeBrainService
 * Upload and manage domain knowledge documents
 */

import React, { useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Upload,
  Loader,
  AlertCircle,
  CheckCircle,
  FileText,
  X,
} from 'lucide-react';
import { KNOWLEDGE_CATEGORY_LABELS, getAllCategories } from '@/constants/knowledge-categories';
import { knowledgeBrainService } from '@/services/ai/knowledge-brain.service';
import { env } from '@/config/env';
import { log, warn, error, time, timeEnd } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

// Map of sources with French labels
const SOURCES = {
  internal: { label: 'Interne', reliability: 50 },
  external: { label: 'Externe', reliability: 40 },
  official: { label: 'Officiel', reliability: 95 },
} as const;

// Get all available categories with French labels
const KNOWLEDGE_CATEGORIES = getAllCategories().map(cat => cat.id);

/**
 * Helper: Create ingestion job via Edge Function
 */
async function createIngestionJob(
  filePath: string,
  fileName: string,
  fileSizeBytes: number
): Promise<string> {
  const { data, error: err } = await supabase.functions.invoke(
    'create-ingestion-job',
    {
      body: {
        file_name: fileName,
        file_path: filePath,
        file_size_bytes: fileSizeBytes,
      },
    }
  );

  if (err) {
    console.error('[UPLOAD] create-ingestion-job error:', err);
    throw new Error(`Failed to create ingestion job: ${err.message || 'Unknown error'}`);
  }

  if (!data?.job_id) {
    throw new Error('No job_id returned from create-ingestion-job');
  }

  log('[UPLOAD] ✅ Ingestion job created:', data.job_id);
  return data.job_id;
}

interface UploadState {
  file: File | null;
  category: string;
  source: 'internal' | 'external' | 'official';
  region?: string;
  loading: boolean;
  error: string | null;
  success: boolean;
}

export function KnowledgeBaseUpload() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<UploadState>({
    file: null,
    category: 'GUIDELINE',
    source: 'internal',
    region: 'National',
    loading: false,
    error: null,
    success: false,
  });

  async function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];

    // Validate file type
    if (file.type !== 'application/pdf' && !file.name.endsWith('.txt')) {
      setState(prev => ({
        ...prev,
        error: 'Seuls les fichiers PDF et TXT sont acceptés',
      }));
      return;
    }

    // Validate file size (use configured max from env)
    if (file.size > env.upload.maxFileSize) {
      const maxSizeMB = (env.upload.maxFileSize / (1024 * 1024)).toFixed(0);
      setState(prev => ({
        ...prev,
        error: `Le fichier ne doit pas dépasser ${maxSizeMB} MB`,
      }));
      return;
    }

    setState(prev => ({
      ...prev,
      file,
      error: null,
    }));
  }

  async function handleUpload() {
    log('🧠 [UPLOAD] Handler called - START');

    if (!state.file || !state.category) {
      console.error('🧠 [UPLOAD] Missing required fields', { file: !!state.file, category: state.category });
      setState(prev => ({
        ...prev,
        error: 'Sélectionnez un fichier et une catégorie',
      }));
      return;
    }

    try {
      log('🧠 [UPLOAD] Setting loading state...');
      setState(prev => ({ ...prev, loading: true, error: null }));

      // PHASE 43: Simple upload flow
      // Step 1: Upload file to storage only
      log('🧠 [UPLOAD] Step 1: Uploading file to storage...');
      const uploadResult = await knowledgeBrainService.uploadDocumentForServerIngestion(
        state.file,
        {
          title: state.file.name.replace(/\.[^/.]+$/, ''),
          category: state.category,
          source: state.source,
        }
      );

      log('🧠 [UPLOAD] File uploaded successfully');

      // Step 2: Create ingestion job
      log('🧠 [UPLOAD] Step 2: Creating ingestion job...');
      try {
        const jobId = await createIngestionJob(
          uploadResult.filePath,
          state.file.name,
          state.file.size
        );
        log('🧠 [UPLOAD] Ingestion job created:', jobId);
      } catch (jobErr) {
        warn('🧠 [UPLOAD] Warning: ingestion job creation failed, but file upload succeeded:', jobErr);
        // Don't fail the upload if ingestion job creation fails
      }

      // Success - reset form
      setState(prev => ({
        ...prev,
        file: null,
        category: 'GUIDELINE',
        source: 'internal',
        region: 'National',
        success: true,
        loading: false,
      }));

      // Clear file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      // Reset success message after 3 seconds
      setTimeout(() => {
        setState(prev => ({ ...prev, success: false }));
      }, 3000);

      log('🧠 [UPLOAD] Handler completed successfully');
    } catch (err) {
      console.error('❌ [UPLOAD] Handler error:', err);
      setState(prev => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Erreur lors de l\'upload du document',
        loading: false,
      }));
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload de Documents Knowledge Base</CardTitle>
        <CardDescription>
          Uploadez des documents (DTU, normes, guides, etc.) pour enrichir l'IA avec du contexte métier
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Success Alert */}
        {state.success && (
          <Alert className="bg-green-50 border-green-200">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              ✅ Document uploadé avec succès! Le document sera traité et intégré à la Knowledge Base.
            </AlertDescription>
          </Alert>
        )}

        {/* Error Alert */}
        {state.error && (
          <Alert className="bg-destructive/10 border-destructive/20">
            <AlertCircle className="h-4 w-4 text-destructive" />
            <AlertDescription className="text-destructive">{state.error}</AlertDescription>
          </Alert>
        )}

        {/* File Input - PHASE 36.2: Ensure network request is triggered */}
        <div className="space-y-2">
          <label className="block text-sm font-semibold">Fichier *</label>
          <div
            className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.txt"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
            {state.file ? (
              <div className="flex items-center justify-center gap-2">
                <FileText className="h-6 w-6 text-primary" />
                <span className="text-sm font-medium">{state.file.name}</span>
                <button
                  onClick={e => {
                    e.stopPropagation();
                    setState(prev => ({ ...prev, file: null }));
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="ml-2"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div>
                <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm">Cliquez pour sélectionner un fichier PDF ou TXT</p>
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground">Max {(env.upload.maxFileSize / (1024 * 1024)).toFixed(0)}MB. PDF ou TXT uniquement.</p>
        </div>

        {/* Category - PHASE 36.2: Display French labels */}
        <div className="space-y-2">
          <label className="block text-sm font-semibold">Catégorie *</label>
          <select
            value={state.category}
            onChange={e => setState(prev => ({ ...prev, category: e.target.value }))}
            className="w-full px-3 py-2 border rounded-md text-sm"
          >
            {KNOWLEDGE_CATEGORIES.map(catKey => (
              <option key={catKey} value={catKey}>
                {KNOWLEDGE_CATEGORY_LABELS[catKey]?.label || catKey}
              </option>
            ))}
          </select>
          {state.category && KNOWLEDGE_CATEGORY_LABELS[state.category]?.description && (
            <p className="text-xs text-muted-foreground mt-1">
              {KNOWLEDGE_CATEGORY_LABELS[state.category].description}
            </p>
          )}
        </div>

        {/* Source - PHASE 36.2: French labels with reliability info */}
        <div className="space-y-2">
          <label className="block text-sm font-semibold">Source *</label>
          <div className="space-y-2">
            {(Object.entries(SOURCES) as Array<[keyof typeof SOURCES, typeof SOURCES[keyof typeof SOURCES]]>).map(([sourceKey, sourceInfo]) => (
              <label key={sourceKey} className="flex items-center gap-3 p-2 rounded border hover:bg-muted cursor-pointer">
                <input
                  type="radio"
                  name="source"
                  value={sourceKey}
                  checked={state.source === sourceKey}
                  onChange={() => setState(prev => ({ ...prev, source: sourceKey }))}
                />
                <div className="flex-1">
                  <p className="text-sm font-medium">{sourceInfo.label}</p>
                  <p className="text-xs text-muted-foreground">Fiabilité: {sourceInfo.reliability}%</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Region */}
        <div className="space-y-2">
          <label className="block text-sm font-semibold">Région (optionnel)</label>
          <input
            type="text"
            value={state.region || ''}
            onChange={e => setState(prev => ({ ...prev, region: e.target.value || 'National' }))}
            placeholder="Ex: Île-de-France, National..."
            className="w-full px-3 py-2 border rounded-md text-sm"
          />
        </div>

        {/* Upload Button */}
        <div className="flex justify-end gap-2 pt-4">
          <Button
            variant="outline"
            onClick={() => {
              setState(prev => ({
                ...prev,
                file: null,
                category: 'GUIDELINE',
                source: 'internal',
                region: 'National',
              }));
              if (fileInputRef.current) fileInputRef.current.value = '';
            }}
            disabled={state.loading}
          >
            Annuler
          </Button>
          <Button
            onClick={handleUpload}
            disabled={!state.file || !state.category || state.loading}
          >
            {state.loading ? (
              <>
                <Loader className="h-4 w-4 mr-2 animate-spin" />
                Upload en cours...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Uploader
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
