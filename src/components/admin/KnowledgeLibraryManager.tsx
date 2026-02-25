import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { Loader2, Eye, Trash2, RotateCw } from 'lucide-react';
import { KnowledgeInspectDrawer } from './KnowledgeInspectDrawer';
import { useToast } from '@/hooks/use-toast';

interface KnowledgeDocument {
  id: string;
  title: string;
  category?: string;
  created_at: string;
  preview?: string;
}

const getDerivedRagState = (createdAt: string): { label: string; color: string } => {
  const now = new Date();
  const created = new Date(createdAt);
  const minutes = (now.getTime() - created.getTime()) / (1000 * 60);

  if (minutes < 5) return { label: 'PROCESSING', color: 'bg-amber-50 text-amber-700 border-amber-200' };
  return { label: 'READY', color: 'bg-green-50 text-green-700 border-green-200' };
};

export function KnowledgeLibraryManager() {
  const { toast } = useToast();
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<KnowledgeDocument | null>(null);

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
      console.log('[KLM] Loaded:', data?.length || 0);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load documents';
      console.error('[KLM] Error:', message);
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();

    // Listen for library refresh events
    const handleRefresh = () => fetchDocuments();
    window.addEventListener('RAG_LIBRARY_REFRESH', handleRefresh);

    return () => window.removeEventListener('RAG_LIBRARY_REFRESH', handleRefresh);
  }, []);

  const handleInspect = (doc: KnowledgeDocument) => {
    setSelectedDoc(doc);
  };

  const handleRetryEmbedding = (doc: KnowledgeDocument) => {
    const safeTitle = doc.title ?? 'Document';
    console.log('[KLM OPS] Retry requested:', doc.id, safeTitle);

    // Dispatch OPS event for orchestrator
    window.dispatchEvent(
      new CustomEvent('RAG_RETRY_REQUESTED', {
        detail: { documentId: doc.id, title: safeTitle },
      })
    );

    toast({
      title: 'Retry Signal Sent',
      description: `Manual embedding trigger queued for ${safeTitle}`,
    });

    // Trigger refresh
    setTimeout(() => {
      window.dispatchEvent(new Event('RAG_LIBRARY_REFRESH'));
    }, 1000);
  };

  const handleDelete = async (docId: string, docTitle: string) => {
    try {
      setDeleting(docId);
      console.log('[KLM] Deleting:', docId);

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

      console.log('[KLM] Document disabled:', docId);
      await fetchDocuments();

      // Dispatch refresh event
      window.dispatchEvent(new Event('RAG_LIBRARY_REFRESH'));

      toast({
        title: 'Document Removed',
        description: `${docTitle} has been disabled`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete document';
      console.error('[KLM] Delete error:', message);
      setError(message);
    } finally {
      setDeleting(null);
    }
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
    <>
      <KnowledgeInspectDrawer document={selectedDoc} onClose={() => setSelectedDoc(null)} />

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
              const ragState = getDerivedRagState(doc.created_at);

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
                          className={`whitespace-nowrap text-xs ${ragState.color}`}
                        >
                          {ragState.label}
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
                        onClick={() => handleInspect(doc)}
                        title="Inspecter"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => handleRetryEmbedding(doc)}
                        title="Retry Embedding"
                      >
                        <RotateCw className="h-4 w-4" />
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
    </>
  );
}
