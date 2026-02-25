import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { Loader2, Eye, Trash2 } from 'lucide-react';

interface KnowledgeDocument {
  id: string;
  title: string;
  category?: string;
  created_at: string;
  preview?: string;
  processing_state?: string;
}

export function KnowledgeLibraryManager() {
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: dbError } = await supabase
        .from('knowledge_documents')
        .select('id, title, category, created_at, preview')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(50);

      if (dbError) {
        if (dbError.message.includes('permission') || dbError.message.includes('RLS')) {
          throw new Error('Permissions insuffisantes (RLS)');
        }
        throw dbError;
      }

      setDocuments(data || []);
      console.log('[Knowledge Library Manager] Loaded:', data?.length || 0);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load documents';
      console.error('[Knowledge Library Manager] Error:', message);
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const handleDelete = async (docId: string, docTitle: string) => {
    try {
      setDeleting(docId);
      console.log('[Knowledge Library Manager] Deleting:', docId, docTitle);

      const { error: updateError } = await supabase
        .from('knowledge_documents')
        .update({ is_active: false })
        .eq('id', docId)
        .select();

      if (updateError) {
        if (updateError.message.includes('permission') || updateError.message.includes('RLS')) {
          setError('Permissions insuffisantes (RLS)');
          return;
        }
        throw updateError;
      }

      console.log('[Knowledge Library Manager] Document disabled:', docId);
      // Refresh the list
      await fetchDocuments();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete document';
      console.error('[Knowledge Library Manager] Delete error:', message);
      setError(message);
    } finally {
      setDeleting(null);
    }
  };

  const getProcessingStateColor = () => {
    return 'bg-green-50 text-green-700 border-green-200';
  };

  const getProcessingStateLabel = () => {
    return '✓ Ingéré';
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Chargement des documents...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error && error.includes('RLS')) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-sm text-destructive">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (documents.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Bibliothèque d'enrichissement</CardTitle>
          <CardDescription>Gestion centralisée du cerveau métier</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Les documents ingérés apparaîtront ici après upload dans la section ci-dessus.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Bibliothèque d'enrichissement ({documents.length})</CardTitle>
        <CardDescription>Documents ingérés et disponibles pour le RAG</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {documents.map((doc) => {
            const safeTitle = doc.title ?? 'Document';
            const safePreview = doc.preview ?? '';
            const safeCategory = doc.category ?? 'général';

            return (
              <div
                key={doc.id}
                className="p-4 rounded-lg border border-border/50 hover:border-border/100 transition-colors group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-sm text-foreground truncate">{safeTitle}</h3>
                    {safePreview && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {safePreview}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <Badge variant="outline" className="whitespace-nowrap text-xs">
                        {safeCategory}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={`whitespace-nowrap text-xs ${getProcessingStateColor()}`}
                      >
                        {getProcessingStateLabel()}
                      </Badge>
                      <p className="text-xs text-muted-foreground/60">
                        {new Date(doc.created_at).toLocaleString('fr-FR')}
                      </p>
                    </div>
                  </div>

                  {/* ACTION BAR */}
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 w-8 p-0"
                      title="Inspecter"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => handleDelete(doc.id, safeTitle)}
                      disabled={deleting === doc.id}
                      title="Supprimer"
                    >
                      {deleting === doc.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
