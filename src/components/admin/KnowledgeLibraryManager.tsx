import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { Loader2, Eye, Trash2, RotateCw } from 'lucide-react';
import { KnowledgeInspectDrawer } from './KnowledgeInspectDrawer';
import { useToast } from '@/hooks/use-toast';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

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
        .select('id,title,category,preview,created_at,is_active')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(100);

      // PATCH 6: Never throw - handle errors gracefully
      if (dbError) {
        console.error('[KLM DEBUG] Query error:', dbError);
        const errorMsg = dbError.message.includes('permission') || dbError.message.includes('RLS')
          ? 'Permissions insuffisantes (RLS)'
          : dbError.message ?? 'Erreur lors du chargement des documents';
        setError(errorMsg);
        setLoading(false);
        return;
      }

      setDocuments(data || []);
      console.log('[KLM] Documents fetched:', data?.length || 0);
      setLoading(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load documents';
      console.error('[KLM DEBUG]', message);
      setError(message);
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
          <CardTitle className="text-lg">Gestion des Documents ({documents.length})</CardTitle>
          <CardDescription>Documents ingérés et disponibles pour le RAG</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[25%]">Titre</TableHead>
                  <TableHead className="w-[15%]">Catégorie</TableHead>
                  <TableHead className="w-[35%]">Aperçu</TableHead>
                  <TableHead className="w-[15%]">Date</TableHead>
                  <TableHead className="w-[10%] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((doc) => {
                  const safeTitle = doc.title ?? 'Document';
                  const safePreview = doc.preview ?? '';
                  const safeCategory = doc.category ?? 'général';
                  const ragState = getDerivedRagState(doc.created_at);
                  const previewTruncated =
                    safePreview.length > 80 ? safePreview.substring(0, 80) + '...' : safePreview;

                  return (
                    <TableRow key={doc.id} className="hover:bg-muted/50">
                      <TableCell className="font-medium text-sm truncate">{safeTitle}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {safeCategory}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground truncate">
                        {previewTruncated || '(pas d\'aperçu)'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(doc.created_at).toLocaleString('fr-FR', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
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
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
