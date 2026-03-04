/**
 * Text Normalizer Service
 * Cleans and stabilizes raw extracted document text before chunking.
 *
 * Position in the ingestion pipeline:
 *   text extraction → [THIS SERVICE] → semantic chunking → embeddings
 *
 * All transformations are:
 *  - Pure (no side effects, no I/O)
 *  - Deterministic (same input always yields same output)
 *  - Ordered (steps build on each other — do not reorder)
 */

/**
 * Lines that appear more than this many times across the document are
 * considered repeated headers/footers and are stripped.
 */
const REPEATED_LINE_THRESHOLD = 5;

/**
 * Maximum number of consecutive blank lines allowed in the output.
 */
const MAX_CONSECUTIVE_BLANK_LINES = 2;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Step 1 — Normalize line endings.
 * Converts Windows CRLF and legacy Mac CR to Unix LF so that all subsequent
 * regex patterns can rely on a single newline character.
 */
function normalizeLineEndings(text: string): string {
  // Replace CRLF first, then stray CR (order matters)
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

/**
 * Step 2 — Collapse excessive horizontal whitespace.
 * Multiple consecutive spaces or tabs within a line become one space.
 * Newlines are left untouched here; they are handled in later steps.
 */
function collapseWhitespace(text: string): string {
  return text.replace(/[^\S\n]+/g, ' ');
}

/**
 * Step 3 — Remove repeated header/footer lines.
 * Counts how many times each unique trimmed line appears. Any line that
 * exceeds REPEATED_LINE_THRESHOLD is removed because it is almost certainly
 * a page header, footer, or watermark echoed across pages.
 *
 * Empty lines are excluded from the frequency count (they are handled in
 * step 6) so that blank separators are never mistaken for footers.
 */
function removeRepeatedLines(text: string): string {
  const lines = text.split('\n');

  // Build frequency map over non-empty trimmed lines
  const freq = new Map<string, number>();
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;
    freq.set(trimmed, (freq.get(trimmed) ?? 0) + 1);
  }

  // Keep lines whose trimmed content falls below the threshold
  return lines
    .filter((line) => {
      const trimmed = line.trim();
      if (trimmed.length === 0) return true; // preserve blank lines for now
      return (freq.get(trimmed) ?? 0) <= REPEATED_LINE_THRESHOLD;
    })
    .join('\n');
}

/**
 * Step 4 — Merge broken lines inside paragraphs.
 * PDF text extraction commonly splits a single sentence across multiple lines
 * at arbitrary column widths. We rejoin a line with the next when:
 *   - The current line does not end with sentence-ending punctuation, and
 *   - The next line starts with a lowercase letter.
 *
 * This heuristic preserves intentional line breaks (e.g. list items, titles)
 * while healing soft-wrapped prose.
 */
function mergeBrokenLines(text: string): string {
  // Punctuation that reliably ends a sentence or a discrete block
  const sentenceEnd = /[.!?:;,\-—\])]$/;

  const lines = text.split('\n');
  const merged: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const current = lines[i];
    const next = lines[i + 1];

    const currentTrimmed = current.trimEnd();
    const nextTrimmed = next !== undefined ? next.trimStart() : '';

    const shouldMerge =
      next !== undefined &&
      currentTrimmed.length > 0 &&          // current line has content
      nextTrimmed.length > 0 &&             // next line has content
      !sentenceEnd.test(currentTrimmed) &&  // current does not end a sentence
      /^[a-z]/.test(nextTrimmed);           // next starts with lowercase

    if (shouldMerge) {
      // Emit current line with a space instead of a newline; skip the next
      // line in isolation (it will be appended to the following iteration)
      merged.push(currentTrimmed + ' ' + nextTrimmed);
      i++; // consume the next line
    } else {
      merged.push(current);
    }
  }

  return merged.join('\n');
}

/**
 * Step 5 — Normalize Unicode characters.
 * NFKC decomposition followed by canonical composition ensures that visually
 * identical characters (e.g. ligatures, full-width digits, decorated quotes)
 * map to their standard ASCII or Unicode equivalents. This improves tokenizer
 * consistency and reduces false negative matches in semantic search.
 */
function normalizeUnicode(text: string): string {
  return text.normalize('NFKC');
}

/**
 * Step 6 — Collapse excessive blank lines.
 * More than MAX_CONSECUTIVE_BLANK_LINES consecutive empty lines are reduced
 * to exactly that many. This preserves paragraph boundaries while removing
 * the large vertical gaps that PDF exporters often inject between sections.
 */
function collapseBlankLines(text: string): string {
  // Build a pattern that matches more blank lines than the allowed maximum
  const excessPattern = new RegExp(`\\n{${MAX_CONSECUTIVE_BLANK_LINES + 1},}`, 'g');
  return text.replace(excessPattern, '\n'.repeat(MAX_CONSECUTIVE_BLANK_LINES));
}

/**
 * Step 7 — Trim the document.
 * Removes leading and trailing whitespace from the entire document so that
 * the first/last chunks are not padded with empty content.
 */
function trimDocument(text: string): string {
  return text.trim();
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Normalize raw extracted document text.
 *
 * Applies the full normalization pipeline in order:
 *  1. Normalize line endings (CRLF / CR → LF)
 *  2. Collapse excessive horizontal whitespace
 *  3. Remove repeated header/footer lines (> 5 occurrences)
 *  4. Merge soft-wrapped lines inside paragraphs
 *  5. Normalize Unicode (NFKC)
 *  6. Collapse excessive blank lines (max 2 consecutive)
 *  7. Trim the document
 *
 * @param rawText - Text as returned by the extraction layer
 * @returns Cleaned, stable text ready for semantic chunking
 */
export function normalizeText(rawText: string): string {
  if (rawText.length === 0) {
    return rawText;
  }

  let text = rawText;

  text = normalizeLineEndings(text);  // Step 1
  text = collapseWhitespace(text);    // Step 2
  text = removeRepeatedLines(text);   // Step 3
  text = mergeBrokenLines(text);      // Step 4
  text = normalizeUnicode(text);      // Step 5
  text = collapseBlankLines(text);    // Step 6
  text = trimDocument(text);          // Step 7

  return text;
}
