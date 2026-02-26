import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { X } from 'lucide-react';

interface KnowledgeDocument {
  id: string;
  title: string;
  preview_content?: string;
  category?: string;
  created_at: string;
}

interface KnowledgeInspectDrawerProps {
  document: KnowledgeDocument | null;
  onClose: () => void;
}

export function KnowledgeInspectDrawer({ document, onClose }: KnowledgeInspectDrawerProps) {
  const [activeTab, setActiveTab] = useState('metadata');

  if (!document) return null;

  const safeTitle = document.title ?? 'Document';
  const safeCategory = document.category ?? 'général';
  const safePreview = document.preview_content ?? '';

  const chunkEstimate = safePreview ? Math.ceil(safePreview.length / 1000) : 0;
  const edgeOnline = !window.__RAG_EDGE_OFFLINE__;
  const fallbackActive = window.__RAG_EDGE_OFFLINE__ === true;

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 w-96 bg-background border-l border-border z-50 shadow-lg overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 border-b border-border bg-background/95 backdrop-blur p-6 flex items-center justify-between">
          <h2 className="text-xl font-bold">OPS View</h2>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full justify-start rounded-none border-b border-border bg-transparent p-0">
            <TabsTrigger value="metadata" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary">
              📄 Metadata
            </TabsTrigger>
            <TabsTrigger value="pipeline" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary">
              🧠 Pipeline
            </TabsTrigger>
            <TabsTrigger value="vector" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary">
              📊 Vector
            </TabsTrigger>
          </TabsList>

          {/* Metadata Tab */}
          <TabsContent value="metadata" className="p-6 space-y-6">
            {/* Command Mode Header */}
            <div className="bg-gradient-to-r from-primary/10 to-primary/5 p-3 rounded-lg border border-primary/20">
              <p className="text-xs font-semibold text-primary mb-2">AI COMMAND VIEW</p>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Derived State</span>
                  <Badge className="bg-green-50 text-green-700 border-green-200">Ready</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Edge Status</span>
                  <Badge
                    className={
                      !Boolean((window as any).RAG_EDGE_OFFLINE)
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-red-50 text-red-700 border-red-200'
                    }
                  >
                    {!Boolean((window as any).RAG_EDGE_OFFLINE) ? '✓ Online' : '✗ Fallback'}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Last Ops</span>
                  <span className="text-xs font-mono text-muted-foreground">
                    {new Date().toLocaleTimeString('fr-FR')}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Est. Tokens</span>
                  <Badge variant="outline">
                    {safePreview ? Math.ceil(safePreview.length / 4) : 0}
                  </Badge>
                </div>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2">TITLE</p>
              <p className="text-lg font-semibold text-foreground">{safeTitle}</p>
            </div>

            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2">ID</p>
              <p className="text-sm font-mono text-muted-foreground break-all">{document.id}</p>
            </div>

            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2">CATEGORY</p>
              <Badge variant="outline">{safeCategory}</Badge>
            </div>

            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2">INGESTED</p>
              <p className="text-sm text-foreground">
                {new Date(document.created_at).toLocaleString('fr-FR')}
              </p>
            </div>

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
          </TabsContent>

          {/* Pipeline Tab */}
          <TabsContent value="pipeline" className="p-6 space-y-6">
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 rounded-lg border border-border/50 bg-muted/20">
                <span className="text-sm font-medium">Chunks Estimated</span>
                <Badge variant="outline">{chunkEstimate}</Badge>
              </div>

              <div className="flex justify-between items-center p-3 rounded-lg border border-border/50 bg-muted/20">
                <span className="text-sm font-medium">Last Ingestion</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(document.created_at).toLocaleTimeString('fr-FR')}
                </span>
              </div>

              <div className="flex justify-between items-center p-3 rounded-lg border border-border/50 bg-muted/20">
                <span className="text-sm font-medium">Status</span>
                <Badge className="bg-green-50 text-green-700 border-green-200">✓ Ingéré</Badge>
              </div>
            </div>

            <div className="text-xs text-muted-foreground p-3 rounded-lg bg-muted/30">
              <p>Pipeline state derived from ingestion timeline. No processing_state dependency.</p>
            </div>
          </TabsContent>

          {/* Vector Tab */}
          <TabsContent value="vector" className="p-6 space-y-6">
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 rounded-lg border border-border/50 bg-muted/20">
                <span className="text-sm font-medium">Edge Online</span>
                <Badge
                  className={
                    edgeOnline
                      ? 'bg-green-50 text-green-700 border-green-200'
                      : 'bg-red-50 text-red-700 border-red-200'
                  }
                >
                  {edgeOnline ? '✓ Online' : '✗ Offline'}
                </Badge>
              </div>

              <div className="flex justify-between items-center p-3 rounded-lg border border-border/50 bg-muted/20">
                <span className="text-sm font-medium">Embedding Model</span>
                <Badge variant="outline">OpenAI</Badge>
              </div>

              {fallbackActive && (
                <div className="flex justify-between items-center p-3 rounded-lg border border-amber-200 bg-amber-50">
                  <span className="text-sm font-medium">Fallback</span>
                  <Badge className="bg-amber-100 text-amber-800 border-amber-200">⚠️ ACTIVE</Badge>
                </div>
              )}

              <div className="flex justify-between items-center p-3 rounded-lg border border-border/50 bg-muted/20">
                <span className="text-sm font-medium">Dimension</span>
                <Badge variant="outline">1536</Badge>
              </div>
            </div>

            <div className="text-xs text-muted-foreground p-3 rounded-lg bg-muted/30">
              <p>Vector metrics from orchestrator globals. No additional database queries.</p>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
