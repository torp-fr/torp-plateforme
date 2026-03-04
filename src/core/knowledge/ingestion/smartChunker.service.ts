/**
 * Smart Chunker Service
 * Adapts chunking strategy to document type for structure-aware splitting.
 *
 * Position in the ingestion pipeline:
 *   classifyDocument → [THIS SERVICE] → embeddings
 *
 * Strategies:
 *  regulation       — split on Article / Art. / Section / Chapitre boundaries
 *  technical_guide  — split on numbered section headers (1. / 1.1 / A.)
 *  pricing_reference— keep table rows together, paragraph-fallback for prose
 *  jurisprudence    — paragraph-based with 50-token overlap
 *  generic          — paragraph-based with 50-token overlap (same as above)
 *
 * All strategies enforce:
 *  MAX_TOKENS = 500 per chunk
 *  OVERLAP_TOKENS = 50 (paragraph modes only)
 */

import type { DocumentType } from './documentClassifier.service';
import { log } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_TOKENS = 500;
const OVERLAP_TOKENS = 50;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Chunk {
  content: string;
  tokenCount: number;
  metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Shared utility
// ---------------------------------------------------------------------------

/**
 * Estimate token count.
 * 1 token ≈ 4 characters — matches the existing chunker's heuristic so that
 * both services produce comparable numbers.
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Build a single Chunk with pre-computed metadata.
 */
function makeChunk(content: string, meta: Record<string, unknown>): Chunk {
  return {
    content: content.trim(),
    tokenCount: estimateTokens(content.trim()),
    metadata: meta,
  };
}

// ---------------------------------------------------------------------------
// Strategy: paragraph-based with overlap
// Used by: jurisprudence, generic (and as sub-chunker fallback)
// ---------------------------------------------------------------------------

/**
 * Split text into paragraph-bounded chunks, adding sentence-level overlap
 * between successive chunks to preserve context across boundaries.
 */
function chunkByParagraphs(
  text: string,
  strategy: string
): Chunk[] {
  const paragraphs = text
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  const chunks: Chunk[] = [];
  let current = '';
  let currentTokens = 0;

  for (const para of paragraphs) {
    const paraTokens = estimateTokens(para);

    if (currentTokens + paraTokens > MAX_TOKENS && current.length > 0) {
      // Flush current chunk
      chunks.push(makeChunk(current, { strategy, splitMode: 'paragraph' }));

      // Compute overlap: last two sentences of the flushed chunk
      const sentences = current.split(/(?<=[.!?])\s+/);
      const overlapText = sentences.slice(-2).join(' ');
      const overlapTok = estimateTokens(overlapText);

      if (overlapTok < OVERLAP_TOKENS) {
        // Overlap is small enough to seed next chunk
        current = overlapText + '\n\n' + para;
        currentTokens = overlapTok + paraTokens;
      } else {
        // Overlap alone fills the budget — start fresh
        current = para;
        currentTokens = paraTokens;
      }
    } else {
      current = current.length > 0 ? current + '\n\n' + para : para;
      currentTokens += paraTokens;
    }
  }

  if (current.trim().length > 0) {
    chunks.push(makeChunk(current, { strategy, splitMode: 'paragraph' }));
  }

  return chunks;
}

// ---------------------------------------------------------------------------
// Strategy: article-boundary splitting (regulation)
// ---------------------------------------------------------------------------

/**
 * Regex that matches the start of a new legal article or section.
 * Matches at the beginning of a line (trim applied before test).
 * Examples: "Article 1", "Art. 2", "Section 3", "Chapitre IV"
 */
const ARTICLE_BOUNDARY =
  /^(?:Article\s+\d+|Art\.\s*\d+|Section\s+\d+|Chapitre\s+\w+)/i;

/**
 * Split a regulation document on article/section headers.
 * Each article section is kept as one chunk; sections exceeding MAX_TOKENS
 * are sub-chunked by paragraph so that individual articles are never split
 * arbitrarily mid-sentence.
 */
function chunkRegulation(text: string): Chunk[] {
  const lines = text.split('\n');
  const sections: string[] = [];
  let current = '';

  for (const line of lines) {
    if (ARTICLE_BOUNDARY.test(line.trim()) && current.trim().length > 0) {
      // New article boundary — flush the accumulated section
      sections.push(current.trim());
      current = line + '\n';
    } else {
      current += line + '\n';
    }
  }
  if (current.trim().length > 0) {
    sections.push(current.trim());
  }

  const chunks: Chunk[] = [];

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    const tokens = estimateTokens(section);

    // Extract the header line (first non-empty line) for metadata
    const headerLine = section.split('\n').find((l) => l.trim().length > 0) ?? '';

    if (tokens <= MAX_TOKENS) {
      // Entire article fits in one chunk
      chunks.push(
        makeChunk(section, {
          strategy: 'regulation',
          articleHeader: headerLine,
          sectionIndex: i,
        })
      );
    } else {
      // Article is too long — sub-chunk by paragraph while keeping context
      const subChunks = chunkByParagraphs(section, 'regulation');
      subChunks.forEach((c, j) => {
        c.metadata = {
          ...c.metadata,
          articleHeader: headerLine,
          sectionIndex: i,
          subChunkIndex: j,
        };
      });
      chunks.push(...subChunks);
    }
  }

  return chunks;
}

// ---------------------------------------------------------------------------
// Strategy: section-header splitting (technical_guide)
// ---------------------------------------------------------------------------

/**
 * Matches numbered section headers at the start of a line.
 * Handles:
 *   "1. "  "1.1 "  "1.1.2 "   → numbered sections
 *   "A. "  "B. "               → lettered sections
 */
const SECTION_HEADER = /^(\d+(?:\.\d+)*\.?\s+|[A-Z]\.\s+)/;

/**
 * Split a technical guide on numbered / lettered section headers.
 * Each section becomes a chunk; oversized sections are sub-chunked by
 * paragraph to avoid breaking mid-procedure.
 */
function chunkTechnicalGuide(text: string): Chunk[] {
  const lines = text.split('\n');
  const sections: string[] = [];
  let current = '';

  for (const line of lines) {
    if (SECTION_HEADER.test(line.trim()) && current.trim().length > 0) {
      sections.push(current.trim());
      current = line + '\n';
    } else {
      current += line + '\n';
    }
  }
  if (current.trim().length > 0) {
    sections.push(current.trim());
  }

  const chunks: Chunk[] = [];

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    const tokens = estimateTokens(section);
    const headerLine = section.split('\n').find((l) => l.trim().length > 0) ?? '';

    if (tokens <= MAX_TOKENS) {
      chunks.push(
        makeChunk(section, {
          strategy: 'technical_guide',
          sectionHeader: headerLine,
          sectionIndex: i,
        })
      );
    } else {
      const subChunks = chunkByParagraphs(section, 'technical_guide');
      subChunks.forEach((c, j) => {
        c.metadata = {
          ...c.metadata,
          sectionHeader: headerLine,
          sectionIndex: i,
          subChunkIndex: j,
        };
      });
      chunks.push(...subChunks);
    }
  }

  return chunks;
}

// ---------------------------------------------------------------------------
// Strategy: table-aware splitting (pricing_reference)
// ---------------------------------------------------------------------------

/**
 * A line is a table row when it contains a pipe character.
 * The XLSX and CSV extractors produce `col1 | col2 | col3` format,
 * so this covers both sources.
 */
function isTableRow(line: string): boolean {
  return line.includes('|');
}

/**
 * Split a pricing document so that each coherent table block stays together.
 *
 * Algorithm:
 *  1. Walk the lines and group them into "runs": consecutive table rows form
 *     a table run; everything else forms a prose run.
 *  2. Each run is emitted as chunk(s):
 *     - Table runs: pack rows into chunks up to MAX_TOKENS; never split a row.
 *     - Prose runs: delegate to paragraph chunker.
 */
function chunkPricingReference(text: string): Chunk[] {
  const lines = text.split('\n');

  // Group lines into alternating table / prose runs
  type Run = { kind: 'table' | 'prose'; lines: string[] };
  const runs: Run[] = [];
  let current: Run | null = null;

  for (const line of lines) {
    const kind: 'table' | 'prose' = isTableRow(line) ? 'table' : 'prose';
    if (!current || current.kind !== kind) {
      current = { kind, lines: [] };
      runs.push(current);
    }
    current.lines.push(line);
  }

  const chunks: Chunk[] = [];

  for (const run of runs) {
    if (run.kind === 'table') {
      // Pack table rows into chunks without splitting a row
      let rowBuffer: string[] = [];
      let bufferTokens = 0;

      for (const row of run.lines) {
        const rowTokens = estimateTokens(row);

        if (bufferTokens + rowTokens > MAX_TOKENS && rowBuffer.length > 0) {
          chunks.push(
            makeChunk(rowBuffer.join('\n'), {
              strategy: 'pricing_reference',
              splitMode: 'table',
            })
          );
          rowBuffer = [];
          bufferTokens = 0;
        }

        rowBuffer.push(row);
        bufferTokens += rowTokens;
      }

      if (rowBuffer.length > 0) {
        chunks.push(
          makeChunk(rowBuffer.join('\n'), {
            strategy: 'pricing_reference',
            splitMode: 'table',
          })
        );
      }
    } else {
      // Prose between tables — use paragraph chunker
      const proseText = run.lines.join('\n');
      if (proseText.trim().length > 0) {
        chunks.push(...chunkByParagraphs(proseText, 'pricing_reference'));
      }
    }
  }

  return chunks;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Chunk a document using the strategy appropriate for its document type.
 *
 * @param text         - Normalized document text
 * @param documentType - Classification result from classifyDocument()
 * @returns Array of Chunk objects ready for embedding
 */
export function chunkSmart(text: string, documentType: DocumentType): Chunk[] {
  log('[SmartChunker] Chunking with strategy:', documentType);

  let chunks: Chunk[];

  switch (documentType) {
    case 'regulation':
      chunks = chunkRegulation(text);
      break;

    case 'normes':
      // Standards (NF EN, ISO, Eurocode) follow the same article/section structure
      // as regulations — split on article boundaries, sub-chunk oversized sections.
      chunks = chunkRegulation(text);
      break;

    case 'technical_guide':
      chunks = chunkTechnicalGuide(text);
      break;

    case 'pricing_reference':
      chunks = chunkPricingReference(text);
      break;

    case 'jurisprudence':
      chunks = chunkByParagraphs(text, 'jurisprudence');
      break;

    case 'generic':
    default:
      chunks = chunkByParagraphs(text, 'generic');
      break;
  }

  // Drop empty chunks that can appear when sections have no body text
  chunks = chunks.filter((c) => c.content.length > 0);

  const avgTokens =
    chunks.length > 0
      ? Math.round(chunks.reduce((s, c) => s + c.tokenCount, 0) / chunks.length)
      : 0;

  log(
    '[SmartChunker] Produced',
    chunks.length,
    'chunks — avg tokens:',
    avgTokens
  );

  return chunks;
}
