import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { Loader2 } from 'lucide-react';

interface KnowledgeDocument {
  id: string;
  title: string;
  category?: string;
  created_at: string;
  preview?: string;
}

export function KnowledgeDocumentsList() {
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDocuments = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data, error: dbError } = await supabase
          .from('knowledge_documents')
          .select('id, title, category, created_at, preview')
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(20);

        if (dbError) throw dbError;

        setDocuments(data || []);
        console.log('[Knowledge Documents] Loaded:', data?.length || 0);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load documents';
        console.error('[Knowledge Documents] Error:', message);
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    fetchDocuments();
  }, []);

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

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-sm text-destructive">Erreur: {error}</p>
        </CardContent>
      </Card>
    );
  }

  if (documents.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Documents ingérés</CardTitle>
          <CardDescription>Aucun document n'a été ingéré pour le moment</CardDescription>
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
        <CardTitle className="text-lg">Documents ingérés ({documents.length})</CardTitle>
        <CardDescription>Derniers documents ajoutés à la Knowledge Base</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="p-4 rounded-lg border border-border/50 hover:border-border/100 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-sm text-foreground truncate">{doc.title}</h3>
                  {doc.preview && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {doc.preview}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground/60 mt-2">
                    {new Date(doc.created_at).toLocaleString('fr-FR')}
                  </p>
                </div>
                {doc.category && (
                  <Badge variant="outline" className="whitespace-nowrap">
                    {doc.category}
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
