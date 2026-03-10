/**
 * Knowledge Control Center
 * Developer debug UI for the knowledge ingestion pipeline, retrieval layer, and RAG flow.
 */

import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  getIngestionStats,
  debugRetrieval,
  getChunks,
  traceRAG,
  type IngestionStats,
  type RetrievalResult,
  type ChunkVisualization,
  type RAGTrace,
} from './api/knowledgeDebugApi';

// ---------------------------------------------------------------------------
// Ingestion Dashboard Panel
// ---------------------------------------------------------------------------

function IngestionDashboardPanel() {
  const [stats, setStats] = useState<IngestionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getIngestionStats()
      .then(setStats)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  const statCards: { label: string; key: keyof IngestionStats }[] = [
    { label: 'Documents', key: 'documents' },
    { label: 'Chunks', key: 'chunks' },
    { label: 'Embeddings', key: 'embeddings' },
    { label: 'Avg Quality', key: 'avgQuality' },
    { label: 'Publishable Docs', key: 'publishableDocuments' },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Ingestion Dashboard</CardTitle>
        <CardDescription>Global knowledge ingestion metrics</CardDescription>
      </CardHeader>
      <CardContent>
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {statCards.map(({ label, key }) => (
              <div
                key={key}
                className="rounded-lg border bg-muted/40 p-3 text-center"
              >
                <p className="text-xs text-muted-foreground mb-1">{label}</p>
                {loading ? (
                  <Skeleton className="h-6 w-12 mx-auto" />
                ) : (
                  <p className="text-xl font-semibold tabular-nums">
                    {stats ? String(stats[key]) : '—'}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Retrieval Debugger Panel
// ---------------------------------------------------------------------------

function RetrievalDebuggerPanel() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<RetrievalResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const data = await debugRetrieval(query.trim());
      setResults(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch');
      setResults(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Retrieval Debugger</CardTitle>
        <CardDescription>Inspect semantic search results for a query</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            placeholder="Search query…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1"
          />
          <Button type="submit" disabled={loading || !query.trim()}>
            {loading ? 'Searching…' : 'Search'}
          </Button>
        </form>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {loading && (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        )}

        {results && !loading && (
          results.length === 0 ? (
            <p className="text-sm text-muted-foreground">No results found.</p>
          ) : (
            <div className="rounded-md border overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Rank</TableHead>
                    <TableHead className="w-24">Similarity</TableHead>
                    <TableHead>Document</TableHead>
                    <TableHead>Preview</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((row) => (
                    <TableRow key={row.chunkId}>
                      <TableCell className="font-mono text-xs">{row.rank}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {row.similarity.toFixed(4)}
                      </TableCell>
                      <TableCell className="font-mono text-xs max-w-[140px] truncate">
                        {row.documentId}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                        {row.preview}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Chunk Visualizer Panel
// ---------------------------------------------------------------------------

function ChunkVisualizerPanel() {
  const [documentId, setDocumentId] = useState('');
  const [chunks, setChunks] = useState<ChunkVisualization[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!documentId.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getChunks(documentId.trim());
      setChunks(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch');
      setChunks(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Chunk Visualizer</CardTitle>
        <CardDescription>Inspect how a document was chunked</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            placeholder="Document ID…"
            value={documentId}
            onChange={(e) => setDocumentId(e.target.value)}
            className="flex-1 font-mono text-sm"
          />
          <Button type="submit" disabled={loading || !documentId.trim()}>
            {loading ? 'Loading…' : 'Visualize'}
          </Button>
        </form>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {loading && (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        )}

        {chunks && !loading && (
          chunks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No chunks found for this document.</p>
          ) : (
            <div className="rounded-md border overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Chunk</TableHead>
                    <TableHead className="w-20">Tokens</TableHead>
                    <TableHead className="w-24">Quality</TableHead>
                    <TableHead>Preview</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {chunks.map((row) => (
                    <TableRow key={row.chunk}>
                      <TableCell className="font-mono text-xs">{row.chunk}</TableCell>
                      <TableCell className="font-mono text-xs">{row.tokens}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {row.quality !== null ? row.quality.toFixed(3) : '—'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                        {row.preview}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// RAG Trace Panel
// ---------------------------------------------------------------------------

function RAGTracePanel() {
  const [query, setQuery] = useState('');
  const [trace, setTrace] = useState<RAGTrace | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const data = await traceRAG(query.trim());
      setTrace(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch');
      setTrace(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">RAG Trace</CardTitle>
        <CardDescription>
          Trace the full pipeline: embedding → retrieval → compression
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            placeholder="Query to trace…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1"
          />
          <Button type="submit" disabled={loading || !query.trim()}>
            {loading ? 'Tracing…' : 'Trace'}
          </Button>
        </form>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {loading && (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        )}

        {trace && !loading && (
          <div className="space-y-4">
            {/* Embedding */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                1. Embedding
              </p>
              <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
                Dimensions:{' '}
                <span className="font-mono font-medium">{trace.steps.embedding.dimensions}</span>
              </div>
            </div>

            {/* Retrieval */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                2. Retrieved Chunks ({trace.steps.retrieval.length})
              </p>
              {trace.steps.retrieval.length === 0 ? (
                <p className="text-sm text-muted-foreground">No chunks retrieved.</p>
              ) : (
                <div className="rounded-md border overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-20">Similarity</TableHead>
                        <TableHead>Preview</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {trace.steps.retrieval.map((row, i) => (
                        <TableRow key={`${row.chunkId}-${i}`}>
                          <TableCell className="font-mono text-xs">
                            {row.similarity.toFixed(4)}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                            {row.preview}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

            {/* Compression */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                3. Compressed Context ({trace.steps.compression.length})
              </p>
              {trace.steps.compression.length === 0 ? (
                <p className="text-sm text-muted-foreground">No compressed output.</p>
              ) : (
                <div className="space-y-1">
                  {trace.steps.compression.map((item, i) => (
                    <div
                      key={i}
                      className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground"
                    >
                      {item.preview}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Knowledge Control Center (main export)
// ---------------------------------------------------------------------------

export function KnowledgeControlCenter() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Knowledge Control Center</h1>
        <p className="text-muted-foreground text-sm">
          Developer tools for inspecting the knowledge ingestion pipeline, retrieval layer, and RAG flow.
        </p>
      </div>

      <IngestionDashboardPanel />
      <RetrievalDebuggerPanel />
      <ChunkVisualizerPanel />
      <RAGTracePanel />
    </div>
  );
}

export default KnowledgeControlCenter;
