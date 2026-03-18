import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { Loader2, Eye, Trash2, RotateCw, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { KnowledgeInspectDrawer } from './KnowledgeInspectDrawer';
import { useToast } from '@/hooks/use-toast';
import { log } from '@/lib/logger';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const PAGE_SIZE = 10;

interface KnowledgeDocument {
  id: string;
  title: string;
  category?: string;
  created_at: string;
  preview_content?: string;
}


export function KnowledgeLibraryManager() {
  const { toast } = useToast();
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<KnowledgeDocument | null>(null);

  // ── UI state ──────────────────────────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [page, setPage] = useState(0);

  // ── Data fetching ─────────────────────────────────────────────────────────
  const fetchDocuments = async () => {
    try {
      setLoading(true);
      setFetchError(null);

      const { data, error: dbError } = await supabase
        .from('knowledge_documents')
        .select('id,title,category,preview_content,created_at,is_active')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(500);

      if (dbError) {
        const msg = dbError.message.includes('permission') || dbError.message.includes('RLS')
          ? 'Permissions insuffisantes (RLS)'
          : (dbError.message ?? 'Erreur lors du chargement');
        setFetchError(msg);
        return;
      }

      setDocuments(data ?? []);
      log('[KLM] Documents fetched:', data?.length ?? 0);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
    const handleRefresh = () => fetchDocuments();
    window.addEventListener('RAG_LIBRARY_REFRESH', handleRefresh);
    return () => window.removeEventListener('RAG_LIBRARY_REFRESH', handleRefresh);
  }, []);

  // ── Derived category list ─────────────────────────────────────────────────
  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const doc of documents) set.add(doc.category ?? 'général');
    return Array.from(set).sort();
  }, [documents]);

  // ── Filtering (memoized — no re-compute on unrelated state changes) ───────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return documents.filter(doc => {
      if (categoryFilter !== 'all' && (doc.category ?? 'général') !== categoryFilter) return false;
      if (q && !(doc.title ?? '').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [documents, categoryFilter, search]);

  // Reset to first page whenever the filtered set changes
  const filteredKey = filtered.length + categoryFilter + search;
  useEffect(() => { setPage(0); }, [filteredKey]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageSlice  = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // ── Actions ───────────────────────────────────────────────────────────────
  const handleRetryEmbedding = (doc: KnowledgeDocument) => {
    const safeTitle = doc.title ?? 'Document';
    window.dispatchEvent(new CustomEvent('RAG_RETRY_REQUESTED', {
      detail: { documentId: doc.id, title: safeTitle },
    }));
    toast({ title: 'Retry Signal Sent', description: `Queued: ${safeTitle}` });
    setTimeout(() => window.dispatchEvent(new Event('RAG_LIBRARY_REFRESH')), 1000);
  };

  const handleDelete = async (docId: string, docTitle: string) => {
    try {
      setDeleting(docId);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: updateError } = await (supabase as any)
        .from('knowledge_documents')
        .update({ is_active: false })
        .eq('id', docId)
        .select();

      if (updateError) {
        if (updateError.message.includes('permission') || updateError.message.includes('RLS')) {
          setFetchError('Permissions insuffisantes (RLS)');
          return;
        }
        throw updateError;
      }

      await fetchDocuments();
      window.dispatchEvent(new Event('RAG_LIBRARY_REFRESH'));
      toast({ title: 'Document Removed', description: `${docTitle} has been disabled` });
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Failed to delete document');
    } finally {
      setDeleting(null);
    }
  };

  // ── Render states ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Chargement des documents...</span>
        </CardContent>
      </Card>
    );
  }

  if (fetchError?.includes('RLS')) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-sm text-destructive">{fetchError}</p>
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
            Les documents ingérés apparaîtront ici après upload.
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
          <CardTitle className="text-lg">
            Bibliothèque de documents ({documents.length})
          </CardTitle>
          <CardDescription>Documents ingérés disponibles pour le RAG</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* ── Search ── */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Rechercher par titre..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* ── Category tabs ── */}
          <div className="flex flex-wrap gap-1">
            <button
              onClick={() => setCategoryFilter('all')}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                categoryFilter === 'all'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              Tous ({documents.length})
            </button>
            {categories.map(cat => {
              const count = documents.filter(d => (d.category ?? 'général') === cat).length;
              return (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    categoryFilter === cat
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  {cat} ({count})
                </button>
              );
            })}
          </div>

          {/* ── Table ── */}
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Aucun document correspondant.
            </p>
          ) : (
            <>
              <div className="rounded-lg border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-[30%]">Titre</TableHead>
                      <TableHead className="w-[15%]">Catégorie</TableHead>
                      <TableHead className="w-[35%]">Aperçu</TableHead>
                      <TableHead className="w-[10%]">Date</TableHead>
                      <TableHead className="w-[10%] text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pageSlice.map(doc => {
                      const safeTitle    = doc.title ?? 'Document';
                      const safeCategory = doc.category ?? 'général';
                      const safePreview  = doc.preview_content ?? '';
                      const preview      = safePreview.length > 80
                        ? safePreview.slice(0, 80) + '…'
                        : safePreview;

                      return (
                        <TableRow key={doc.id} className="hover:bg-muted/50">
                          <TableCell className="font-medium text-sm truncate max-w-[200px]">
                            {safeTitle}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs whitespace-nowrap">
                              {safeCategory}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground truncate max-w-[260px]">
                            {preview || '(pas d\'aperçu)'}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {new Date(doc.created_at).toLocaleDateString('fr-FR')}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="outline" size="sm"
                                className="h-7 w-7 p-0"
                                onClick={() => setSelectedDoc(doc)}
                                title="Inspecter"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="outline" size="sm"
                                className="h-7 w-7 p-0"
                                onClick={() => handleRetryEmbedding(doc)}
                                title="Retry Embedding"
                              >
                                <RotateCw className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="destructive" size="sm"
                                className="h-7 w-7 p-0"
                                onClick={() => handleDelete(doc.id, safeTitle)}
                                disabled={deleting === doc.id}
                                title="Supprimer"
                              >
                                {deleting === doc.id
                                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  : <Trash2 className="h-3.5 w-3.5" />}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* ── Pagination ── */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs text-muted-foreground">
                    {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} sur {filtered.length}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline" size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => setPage(p => Math.max(0, p - 1))}
                      disabled={page === 0}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-xs px-2">
                      {page + 1} / {totalPages}
                    </span>
                    <Button
                      variant="outline" size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                      disabled={page >= totalPages - 1}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </>
  );
}
