import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface KnowledgeDocument {
  id: string;
  title: string;
  preview?: string;
  category?: string;
  created_at: string;
}

interface KnowledgeInspectDrawerProps {
  document: KnowledgeDocument | null;
  onClose: () => void;
}

export function KnowledgeInspectDrawer({ document, onClose }: KnowledgeInspectDrawerProps) {
  if (!document) return null;

  const safeTitle = document.title ?? 'Document';
  const safeCategory = document.category ?? 'général';
  const safePreview = document.preview ?? '';

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 w-96 bg-background border-l border-border z-50 shadow-lg overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 border-b border-border bg-background/95 backdrop-blur p-6 flex items-center justify-between">
          <h2 className="text-xl font-bold">Document Details</h2>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Title */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">TITLE</p>
            <p className="text-lg font-semibold text-foreground">{safeTitle}</p>
          </div>

          {/* ID */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">ID</p>
            <p className="text-sm font-mono text-muted-foreground break-all">{document.id}</p>
          </div>

          {/* Category */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">CATEGORY</p>
            <Badge variant="outline">{safeCategory}</Badge>
          </div>

          {/* Created At */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">INGESTED</p>
            <p className="text-sm text-foreground">
              {new Date(document.created_at).toLocaleString('fr-FR')}
            </p>
          </div>

          {/* Preview */}
          {safePreview && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2">PREVIEW</p>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-foreground line-clamp-6">{safePreview}</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Status */}
          <div className="pt-4 border-t border-border">
            <p className="text-xs font-semibold text-muted-foreground mb-2">STATUS</p>
            <Badge className="bg-green-50 text-green-700 border-green-200">✓ Ingéré</Badge>
          </div>
        </div>
      </div>
    </>
  );
}
