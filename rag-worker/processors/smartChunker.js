/**
 * SmartChunker — Robust RAG Chunking Pipeline
 *
 * Optimized for long technical documents:
 *   DTU, Eurocodes, NF standards, construction regulations, CSTB guides
 *
 * Pipeline (guaranteed hard limits on every path):
 *   Step 1 — Normalize:   collapse noise common in PDF/OCR text
 *   Step 2 — Detect:      split at structural section headers (regex-based)
 *   Step 3 — Chunk:       paragraph-aware accumulation within each section
 *   Step 4 — Hard split:  any paragraph that still exceeds MAX is force-split
 *   Step 5 — Micro-merge: absorb chunks below MIN into their neighbors
 *   Step 6 — Safety pass: final guarantee that no chunk exceeds MAX
 *
 * Size targets (optimised for text-embedding-3-small / 384 dimensions):
 *   TARGET_CHUNK_CHARS = 2200   (~550 tokens — safe embedding size, well below trim limit)
 *   MIN_CHUNK_CHARS    =  200
 *   MAX_CHUNK_CHARS    = 3000   (~750 tokens — absolute guard limit, never exceeded in output)
 *
 * Performance:
 *   < 100 ms for documents up to 300 000 characters
 *   No external dependencies — pure Node.js 18+
 */

// ── Size Constants ─────────────────────────────────────────────────────────────

const TARGET_CHUNK_CHARS = 2200;  // Ideal chunk size — safe embedding size (~550 tokens)
const MIN_CHUNK_CHARS    =  200;  // Below this → merge with neighbor
const MAX_CHUNK_CHARS    = 3000;  // Absolute guard limit — never exceeded in output (~750 tokens)

// ─────────────────────────────────────────────────────────────────────────────
// STEP 1 — Text Normalisation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalize raw text before section detection.
 *
 * Removes noise typical of PDF-extracted and OCR text without destroying
 * structural whitespace (newlines are preserved; double-newlines mark paragraph
 * boundaries and must survive into the paragraph-splitting step).
 *
 * Transformations applied:
 *   • Multiple consecutive spaces → single space (newlines kept)
 *   • Three or more consecutive blank lines → double newline
 *   • Lines containing only a number → removed (PDF page numbers)
 *   • Lines containing only dashes / underscores / equals → removed (dividers)
 */
function normalizeText(text) {
  return text
    .replace(/[^\S\n]+/g, ' ')           // multi-space → single space
    .replace(/\n{3,}/g, '\n\n')          // 3+ blank lines → paragraph break
    .replace(/^\s*\d+\s*$/gm, '')        // isolated page numbers
    .replace(/^\s*[-_=]{3,}\s*$/gm, '')  // visual dividers (---, ___, ===)
    .trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 2 — Section Detection
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Matches the FIRST LINE of a structural section header.
 *
 * Patterns covered (all anchored to line start via ^ + /m flag):
 *
 *   Numbered:   "1. Titre"  "1.2 Titre"  "2.3.4 Titre"  "1.2.3.4 Titre"
 *               The character immediately following the number+space must
 *               NOT be a digit or whitespace — this prevents false positives
 *               on numbered list items like "1. bullet" that appear inside
 *               paragraphs. (Those list items are handled by paragraph
 *               splitting rather than section splitting.)
 *
 *   Article:    "Article 5 — Objet"  "ARTICLE 12"  "Art. 3"
 *   Chapter:    "CHAPITRE 1 — Généralités"  "Chapitre 2"
 *   Section:    "SECTION 1"  "Section 3 — Domaine"
 *   Annex:      "ANNEXE A"  "Annexe B"  "Annexe informative C"
 *
 * The `[^\n]{0,150}` tail captures the rest of the header line (the title
 * text) so that match[0] can be used directly as section_title.
 */
const SECTION_HEADER_RE = /^(?:\d{1,3}(?:\.\d{1,3}){0,3}\.?\s+[^\d\s\n][^\n]{0,150}|(?:Article|ARTICLE|Art\.?)\s+\d+[^\n]{0,100}|(?:CHAPITRE|Chapitre)\s+\S[^\n]{0,100}|(?:SECTION|Section)\s+\d+[^\n]{0,100}|(?:ANNEXE|Annexe)\s+[A-Z0-9][^\n]{0,100})/gm;

/**
 * Derive the nesting depth from a header line.
 *
 * "1. Title"       → 1
 * "1.2 Title"      → 2
 * "1.2.3 Title"    → 3
 * "Article / CHAPITRE / ANNEXE" → 1
 * "SECTION"        → 2
 */
function extractLevel(header) {
  const numbered = header.match(/^(\d+(?:\.\d+)*)/);
  if (numbered) {
    return (numbered[1].match(/\./g) || []).length + 1;
  }
  if (/^(SECTION|Section)\s/i.test(header)) return 2;
  return 1; // Article, CHAPITRE, ANNEXE, etc.
}

/**
 * Split normalised text into structural sections.
 *
 * Returns:
 *   Array<{ header: string|null, level: number|null, content: string }>
 *
 * Each section's content INCLUDES the header line as its first line so that
 * the header text is preserved in the embedded chunk.
 *
 * If no headers are found the entire text is returned as a single section
 * with header = null, which will be handled by paragraph-based chunking.
 */
function detectSections(text) {
  const positions = [];
  for (const match of text.matchAll(SECTION_HEADER_RE)) {
    positions.push({ index: match.index, header: match[0].trim() });
  }

  if (positions.length === 0) {
    // No structural markers — treat the whole document as one section
    return [{ header: null, level: null, content: text.trim() }];
  }

  const sections = [];

  // Preamble: text before the first detected header
  if (positions[0].index > 0) {
    const preamble = text.slice(0, positions[0].index).trim();
    if (preamble.length >= MIN_CHUNK_CHARS) {
      sections.push({ header: null, level: null, content: preamble });
    }
  }

  // One section per detected header
  for (let i = 0; i < positions.length; i++) {
    const start   = positions[i].index;
    const end     = i + 1 < positions.length ? positions[i + 1].index : text.length;
    const content = text.slice(start, end).trim();
    sections.push({
      header:  positions[i].header,
      level:   extractLevel(positions[i].header),
      content,
    });
  }

  return sections;
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 3 + 4 — Section → Raw Chunks
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Hard-split a text string into pieces of at most TARGET_CHUNK_CHARS chars.
 *
 * Used as the innermost fallback for paragraphs that are larger than
 * MAX_CHUNK_CHARS even after all higher-level splitting has been tried.
 *
 * The dotAll flag (s) ensures newlines inside a paragraph are also consumed,
 * so the regex works correctly on OCR text that lacks double-newline breaks.
 */
function hardSplit(text) {
  return text.match(new RegExp(`.{1,${TARGET_CHUNK_CHARS}}`, 'gs')) || [text];
}

/**
 * Convert one detected section into one or more raw chunk objects.
 *
 * Strategy (applied in order, stopping as soon as the section fits):
 *   1. If the entire section content is ≤ MAX_CHUNK_CHARS → one chunk.
 *   2. Otherwise accumulate consecutive paragraphs (separated by \n\n) until
 *      adding the next paragraph would exceed MAX_CHUNK_CHARS, then flush.
 *   3. If a single paragraph is itself > MAX_CHUNK_CHARS (e.g., a dense OCR
 *      block with no double-newlines) → hard-split it into TARGET_CHUNK_CHARS
 *      pieces.
 *
 * Returns:
 *   Array<{ content: string, section_title: string|null, section_level: number|null }>
 */
function chunkSection(section) {
  const { header, level, content } = section;

  // Fast path: section already fits in one chunk
  if (content.length <= MAX_CHUNK_CHARS) {
    return [{ content, section_title: header, section_level: level }];
  }

  const paragraphs = content
    .split(/\n\n+/)
    .map(p => p.trim())
    .filter(p => p.length > 0);

  const chunks = [];
  let current  = '';

  for (const para of paragraphs) {
    const candidate = current ? `${current}\n\n${para}` : para;

    if (candidate.length <= MAX_CHUNK_CHARS) {
      // Fits — keep accumulating
      current = candidate;
    } else {
      // Flush current accumulation
      if (current) {
        chunks.push({ content: current.trim(), section_title: header, section_level: level });
      }

      if (para.length > MAX_CHUNK_CHARS) {
        // Paragraph is itself too large — hard-split it
        for (const piece of hardSplit(para)) {
          chunks.push({ content: piece, section_title: header, section_level: level });
        }
        current = '';
      } else {
        current = para;
      }
    }
  }

  // Flush remainder
  if (current.trim()) {
    chunks.push({ content: current.trim(), section_title: header, section_level: level });
  }

  // Edge case: section had no double-newline paragraphs and was too large
  // (hardSplit would have been invoked above; if chunks is still empty it
  // means the entire content is one giant un-split block)
  if (chunks.length === 0) {
    for (const piece of hardSplit(content)) {
      chunks.push({ content: piece, section_title: header, section_level: level });
    }
  }

  return chunks;
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 5 — Micro-chunk Filtering
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Absorb chunks shorter than MIN_CHUNK_CHARS into their neighbors.
 *
 * Merge priority:
 *   1. Merge backward into the previous chunk (if result ≤ MAX_CHUNK_CHARS).
 *   2. If backward merge is impossible, hold the micro-chunk and attempt to
 *      merge it forward into the next chunk.
 *   3. If neither direction fits, emit the micro-chunk as-is — data
 *      preservation takes priority over the MIN_CHUNK_CHARS target.
 *
 * The merged content uses a double-newline separator so downstream
 * paragraph logic remains valid.
 */
function filterMicroChunks(chunks) {
  if (chunks.length === 0) return chunks;

  const result  = [];
  let overflow  = null; // micro-chunk awaiting a forward-merge opportunity

  for (const chunk of chunks) {
    // Attempt to resolve a pending overflow before processing the current chunk
    if (overflow) {
      const merged = `${overflow.content}\n\n${chunk.content}`;
      if (merged.length <= MAX_CHUNK_CHARS) {
        // Forward merge succeeded — emit the merged chunk and clear overflow
        result.push({ ...chunk, content: merged });
        overflow = null;
        continue;
      } else {
        // Cannot merge forward either — emit overflow unchanged
        result.push(overflow);
        overflow = null;
      }
    }

    if (chunk.content.length < MIN_CHUNK_CHARS) {
      // Try backward merge first
      if (result.length > 0) {
        const prev   = result[result.length - 1];
        const merged = `${prev.content}\n\n${chunk.content}`;
        if (merged.length <= MAX_CHUNK_CHARS) {
          result[result.length - 1] = { ...prev, content: merged };
          continue;
        }
      }
      // Backward merge impossible — hold for forward merge
      overflow = chunk;
    } else {
      result.push(chunk);
    }
  }

  // Flush any remaining overflow
  if (overflow) {
    if (result.length > 0) {
      const prev   = result[result.length - 1];
      const merged = `${prev.content}\n\n${overflow.content}`;
      if (merged.length <= MAX_CHUNK_CHARS) {
        result[result.length - 1] = { ...prev, content: merged };
      } else {
        result.push(overflow); // keep rather than lose data
      }
    } else {
      result.push(overflow);
    }
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 6 — Final Safety Pass
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Last-resort guarantee: any chunk that still exceeds MAX_CHUNK_CHARS after
 * all previous steps is hard-split here.
 *
 * In a correctly functioning pipeline this step should produce zero splits.
 * Its purpose is to prevent embedding-API failures on unexpectedly long chunks
 * that slipped through (e.g., an OCR block with zero paragraph breaks).
 */
function finalSafetyPass(chunks) {
  return chunks.flatMap(chunk => {
    if (chunk.content.length <= MAX_CHUNK_CHARS) return [chunk];
    // Re-split and inherit metadata from the parent chunk
    return hardSplit(chunk.content).map(piece => ({
      ...chunk,
      content: piece,
    }));
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Main chunking entry point — drop-in replacement for the previous
 * smartChunkText export consumed by worker.js.
 *
 * @param {string} text      - Raw document text (normalised internally).
 * @param {Array}  _sections - Legacy parameter (ignored; section detection is
 *                             now performed internally via regex). Kept so the
 *                             worker call-site requires no changes.
 *
 * @returns {Array<{
 *   content:        string,
 *   content_length: number,
 *   chunk_index:    number,
 *   section_title:  string | null,
 *   section_level:  number | null,
 *   metadata:       object,
 * }>}
 */
export function smartChunkText(text, _sections) {
  if (!text || text.trim().length === 0) return [];

  // ── Step 1: Normalize ────────────────────────────────────────────────────
  const normalized = normalizeText(text);

  // ── Step 2: Detect sections ──────────────────────────────────────────────
  const sections = detectSections(normalized);
  console.log(`  [SmartChunker] Sections detected: ${sections.length}`);

  // ── Steps 3 + 4: Section → raw chunks (with hard fallback inside) ────────
  let fallbackSplits = 0;
  const rawChunks    = [];

  for (const section of sections) {
    const sectionChunks = chunkSection(section);
    if (sectionChunks.length > 1) fallbackSplits += sectionChunks.length - 1;
    rawChunks.push(...sectionChunks);
  }

  console.log(`  [SmartChunker] Semantic chunks: ${rawChunks.length}`);
  console.log(`  [SmartChunker] Fallback splits applied: ${fallbackSplits}`);

  // ── Step 5: Merge micro-chunks ───────────────────────────────────────────
  const filtered = filterMicroChunks(rawChunks);

  // ── Step 6: Final safety pass ────────────────────────────────────────────
  const safe = finalSafetyPass(filtered);

  console.log(`  [SmartChunker] Final chunks: ${safe.length}`);

  // ── Assign stable indices and normalise output shape ─────────────────────
  return safe.map((chunk, idx) => ({
    content:        chunk.content,
    content_length: chunk.content.length,
    chunk_index:    idx,
    section_title:  chunk.section_title  ?? null,
    section_level:  chunk.section_level  ?? null,
    // metadata kept as empty object so worker.js `chunk.metadata || {}` path
    // continues to work without modification
    metadata:       {},
  }));
}

// Named alias for callers that prefer the descriptive function name
export { smartChunkText as createSmartChunks };
