/**
 * Knowledge Ingestion Studio
 * Admin tooling for uploading documents, previewing chunking, reindexing, and testing retrieval.
 */

import React, { useRef, useState } from 'react';
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
  uploadKnowledgeDocument,
  previewChunks,
  reindexDocument,
  testRetrieval,
  type UploadResult,
  type ChunkPreview,
  type ReindexResult,
  type RetrievalResult,
} from './api/knowledgeIngestionApi';

const ACCEPTED = '.pdf,.docx,.txt,.md,.csv';

// ---------------------------------------------------------------------------
// Tool 1 — Document Upload
// ---------------------------------------------------------------------------

function DocumentUploadTool() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setLoading(true);
    setError(null);
    setResult(null);
    setFileName(file.name);
    try {
      const data = await uploadKnowledgeDocument(file);
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold">Tool 1 — Document Upload</CardTitle>
        <CardDescription>Upload a document to ingest it into the knowledge base</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED}
            className="hidden"
            onChange={handleChange}
          />
          <Button
            variant="outline"
            onClick={() => inputRef.current?.click()}
            disabled={loading}
          >
            {loading ? 'Uploading…' : 'Upload Document'}
          </Button>
          {fileName && !loading && (
            <span className="text-xs text-muted-foreground truncate max-w-xs">{fileName}</span>
          )}
        </div>

        <p className="text-xs text-muted-foreground">Accepted: pdf, docx, txt, md, csv</p>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {loading && <Skeleton className="h-16 w-full" />}

        {result && !loading && (
          <div className="grid grid-cols-3 gap-3">
            {([
              { label: 'Document ID', value: result.documentId },
              { label: 'Chunks Created', value: String(result.chunks) },
              { label: 'Tokens', value: String(result.tokens) },
            ] as const).map(({ label, value }) => (
              <div key={label} className="rounded-lg border bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground mb-1">{label}</p>
                <p className="text-sm font-mono font-medium break-all">{value}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Tool 2 — Chunk Preview
// ---------------------------------------------------------------------------

function ChunkPreviewTool() {
  const [text, setText] = useState('');
  const [chunks, setChunks] = useState<ChunkPreview[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const data = await previewChunks(text.trim());
      setChunks(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
      setChunks(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold">Tool 2 — Chunk Preview</CardTitle>
        <CardDescription>Paste text to preview how it will be chunked</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleSubmit} className="space-y-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste document text here…"
            rows={5}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm resize-y focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          <Button type="submit" disabled={loading || !text.trim()}>
            {loading ? 'Processing…' : 'Preview Chunks'}
          </Button>
        </form>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {loading && (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        )}

        {chunks && !loading && (
          chunks.length === 0
            ? <p className="text-sm text-muted-foreground">No chunks generated.</p>
            : (
              <div className="rounded-md border overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Chunk</TableHead>
                      <TableHead className="w-20">Tokens</TableHead>
                      <TableHead>Preview</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {chunks.map((row) => (
                      <TableRow key={row.chunk}>
                        <TableCell className="font-mono text-xs">{row.chunk}</TableCell>
                        <TableCell className="font-mono text-xs">{row.tokens}</TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-sm truncate">
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
// Tool 3 — Reindex Document
// ---------------------------------------------------------------------------

function ReindexDocumentTool() {
  const [documentId, setDocumentId] = useState('');
  const [result, setResult] = useState<ReindexResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!documentId.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await reindexDocument(documentId.trim());
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reindex failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold">Tool 3 — Reindex Document</CardTitle>
        <CardDescription>Trigger re-embedding and reindexing for an existing document</CardDescription>
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
            {loading ? 'Reindexing…' : 'Reindex'}
          </Button>
        </form>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {loading && <Skeleton className="h-12 w-full" />}

        {result && !loading && (
          <div className="flex gap-3">
            <div className="rounded-lg border bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground mb-1">Status</p>
              <p className={`text-sm font-semibold ${result.success ? 'text-green-600' : 'text-destructive'}`}>
                {result.success ? 'Success' : 'Failed'}
              </p>
            </div>
            <div className="rounded-lg border bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground mb-1">Chunks Indexed</p>
              <p className="text-xl font-semibold tabular-nums">{result.chunksIndexed}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Tool 4 — Retrieval Test
// ---------------------------------------------------------------------------

function RetrievalTestTool() {
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
      const data = await testRetrieval(query.trim());
      setResults(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Retrieval failed');
      setResults(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold">Tool 4 — Retrieval Test</CardTitle>
        <CardDescription>Test semantic retrieval against the current index</CardDescription>
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
            {loading ? 'Searching…' : 'Test'}
          </Button>
        </form>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {loading && (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        )}

        {results && !loading && (
          results.length === 0
            ? <p className="text-sm text-muted-foreground">No results found.</p>
            : (
              <div className="rounded-md border overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">Rank</TableHead>
                      <TableHead className="w-24">Similarity</TableHead>
                      <TableHead>Preview</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.map((row) => (
                      <TableRow key={row.chunkId}>
                        <TableCell className="font-mono text-xs">{row.rank}</TableCell>
                        <TableCell className="font-mono text-xs">{row.similarity.toFixed(4)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-sm truncate">
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
// Knowledge Ingestion Studio (main export)
// ---------------------------------------------------------------------------

export function IngestionStudio() {
  return (
    <Card className="border-2">
      <CardHeader>
        <CardTitle>Knowledge Ingestion Studio</CardTitle>
        <CardDescription>
          Upload documents, preview chunking, reindex, and test retrieval — all in one place.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <DocumentUploadTool />
        <ChunkPreviewTool />
        <ReindexDocumentTool />
        <RetrievalTestTool />
      </CardContent>
    </Card>
  );
}

export default IngestionStudio;
