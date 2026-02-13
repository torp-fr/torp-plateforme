/**
 * Knowledge Base Document Upload Component
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
import { supabase } from '@/lib/supabase';

const DOCUMENT_CATEGORIES = [
  'DTU', 'EUROCODE', 'NORM', 'REGULATION',
  'GUIDELINE', 'BEST_PRACTICE', 'TECHNICAL_GUIDE',
  'TRAINING', 'MANUAL', 'HANDBOOK',
  'SUSTAINABILITY', 'ENERGY_EFFICIENCY',
  'LEGAL', 'LIABILITY', 'WARRANTY',
  'CASE_STUDY', 'LESSONS_LEARNED'
];

const WORK_TYPES = [
  'plumbing', 'electrical', 'painting', 'renovation',
  'construction', 'hvac', 'roofing', 'insulation',
  'flooring', 'kitchen', 'bathroom', 'facade',
  'structure', 'landscaping', 'other'
];

interface UploadState {
  file: File | null;
  title: string;
  category: string;
  workTypes: string[];
  source: 'internal' | 'external' | 'official';
  loading: boolean;
  error: string | null;
  success: boolean;
}

export function KnowledgeBaseUpload() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<UploadState>({
    file: null,
    title: '',
    category: 'GUIDELINE',
    workTypes: [],
    source: 'internal',
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

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      setState(prev => ({
        ...prev,
        error: 'Le fichier ne doit pas dépasser 10 MB',
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
    if (!state.file || !state.title || !state.category) {
      setState(prev => ({
        ...prev,
        error: 'Remplissez tous les champs obligatoires',
      }));
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      // Read file content
      const content = await state.file.text();

      // Extract title from filename if not provided
      const title = state.title || state.file.name.replace(/\.[^/.]+$/, '');

      // Insert document into database
      const { data, error } = await supabase
        .from('knowledge_documents')
        .insert([
          {
            title,
            description: `Uploaded from ${state.file.name}`,
            content,
            category: state.category,
            work_types: state.workTypes.length > 0 ? state.workTypes : ['other'],
            tags: [state.source],
            source: state.source,
            authority: state.source === 'official' ? 'official' : 'community',
            confidence_score: state.source === 'official' ? 95 : 50,
          },
        ])
        .select();

      if (error) throw error;

      // Success
      setState(prev => ({
        ...prev,
        file: null,
        title: '',
        category: 'GUIDELINE',
        workTypes: [],
        source: 'internal',
        success: true,
        loading: false,
      }));

      // Clear file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      // Reset success after 3 seconds
      setTimeout(() => {
        setState(prev => ({ ...prev, success: false }));
      }, 3000);
    } catch (err) {
      console.error('[KnowledgeBaseUpload] Error:', err);
      setState(prev => ({
        ...prev,
        error: 'Erreur lors de l\'upload du document',
        loading: false,
      }));
    }
  }

  function toggleWorkType(workType: string) {
    setState(prev => ({
      ...prev,
      workTypes: prev.workTypes.includes(workType)
        ? prev.workTypes.filter(t => t !== workType)
        : [...prev.workTypes, workType],
    }));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload de Documents Métier</CardTitle>
        <CardDescription>
          Uploadez des documents DTU, normes, guides de bonnes pratiques, etc.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Success Alert */}
        {state.success && (
          <Alert className="bg-green-50 border-green-200">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              Document uploadé avec succès! Il sera disponible après approbation.
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

        {/* File Input */}
        <div className="space-y-2">
          <label className="block text-sm font-semibold">Fichier *</label>
          <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
            onClick={() => fileInputRef.current?.click()}>
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
          <p className="text-xs text-muted-foreground">Max 10MB. PDF ou TXT uniquement.</p>
        </div>

        {/* Title */}
        <div className="space-y-2">
          <label className="block text-sm font-semibold">Titre *</label>
          <input
            type="text"
            value={state.title}
            onChange={e => setState(prev => ({ ...prev, title: e.target.value }))}
            placeholder="Ex: DTU 31.2 - Joints et étanchéité"
            className="w-full px-3 py-2 border rounded-md text-sm"
          />
        </div>

        {/* Category */}
        <div className="space-y-2">
          <label className="block text-sm font-semibold">Catégorie *</label>
          <select
            value={state.category}
            onChange={e => setState(prev => ({ ...prev, category: e.target.value }))}
            className="w-full px-3 py-2 border rounded-md text-sm"
          >
            {DOCUMENT_CATEGORIES.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        {/* Work Types */}
        <div className="space-y-2">
          <label className="block text-sm font-semibold">Types de Travaux (optionnel)</label>
          <div className="flex flex-wrap gap-2">
            {WORK_TYPES.map(type => (
              <Badge
                key={type}
                onClick={() => toggleWorkType(type)}
                className={`cursor-pointer ${
                  state.workTypes.includes(type)
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                }`}
              >
                {type}
              </Badge>
            ))}
          </div>
        </div>

        {/* Source */}
        <div className="space-y-2">
          <label className="block text-sm font-semibold">Source *</label>
          <div className="flex gap-4">
            {(['internal', 'external', 'official'] as const).map(source => (
              <label key={source} className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="source"
                  value={source}
                  checked={state.source === source}
                  onChange={() => setState(prev => ({ ...prev, source }))}
                />
                <span className="capitalize">
                  {source === 'internal' ? 'Interne' : source === 'external' ? 'Externe' : 'Officiel'}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Upload Button */}
        <div className="flex justify-end gap-2 pt-4">
          <Button
            variant="outline"
            onClick={() => {
              setState(prev => ({
                ...prev,
                file: null,
                title: '',
                category: 'GUIDELINE',
                workTypes: [],
                source: 'internal',
              }));
              if (fileInputRef.current) fileInputRef.current.value = '';
            }}
            disabled={state.loading}
          >
            Annuler
          </Button>
          <Button
            onClick={handleUpload}
            disabled={!state.file || !state.title || state.loading}
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
