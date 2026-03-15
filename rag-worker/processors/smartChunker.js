/**
 * Semantic and Structure-Aware Chunker for Technical Standards Documents
 *
 * Optimized for: DTU, CSTB, construction regulations, technical guides
 *
 * Target metrics:
 *   Chunk size: 700-900 tokens (~2800-3600 characters)
 *   Overlap: 120-180 tokens (~480-720 characters)
 *   Expected density: 40-120 chunks per document
 *
 * Strategies:
 *   - Structure detection (numbered sections, articles, chapters, annexes)
 *   - Paragraph grouping with semantic boundaries
 *   - Overlap preservation for context
 *   - Safe fallback to paragraph-based chunking
 */

// ────────────────────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────────────────────

// Token estimation: 1 token ≈ 4 characters (matches frontend)
const CHARS_PER_TOKEN = 4;

// Target chunk sizes (tokens)
const MIN_CHUNK_TOKENS = 600;
const TARGET_CHUNK_TOKENS = 800;
const MAX_CHUNK_TOKENS = 1000;

// Overlap (tokens)
const OVERLAP_TOKENS = 150;
const OVERLAP_CHARS = OVERLAP_TOKENS * CHARS_PER_TOKEN; // ~600 chars

// Convert token targets to character targets
const MIN_CHUNK_CHARS = MIN_CHUNK_TOKENS * CHARS_PER_TOKEN; // 2400
const TARGET_CHUNK_CHARS = TARGET_CHUNK_TOKENS * CHARS_PER_TOKEN; // 3200
const MAX_CHUNK_CHARS = MAX_CHUNK_TOKENS * CHARS_PER_TOKEN; // 4000

// Minimum content length to attempt structure detection
const MIN_LENGTH_FOR_STRUCTURE = 500;

// Minimum paragraph length to keep
const MIN_PARA_LENGTH = 50;

// ────────────────────────────────────────────────────────────────────────────
// Utilities
// ────────────────────────────────────────────────────────────────────────────

/**
 * Estimate token count from character length
 * 1 token ≈ 4 characters
 */
function estimateTokens(text) {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Extract section level from a header line
 * Examples:
 *   "1. Title" → 1
 *   "1.2. Subtitle" → 2
 *   "Chapitre 5" → 1
 *   "Article 10" → 1
 */
function extractSectionLevel(headerLine) {
  // Check for numbered headers (1., 1.2., 1.2.3., etc.)
  const numberedMatch = headerLine.match(/^(\d+(?:\.\d+)*)\./);
  if (numberedMatch) {
    const dots = (numberedMatch[1].match(/\./g) || []).length;
    return dots + 1;
  }

  // Check for keyword headers
  if (/^(Chapitre|Chapter|CHAPITRE|CHAPTER)\s+/i.test(headerLine)) return 1;
  if (/^(Article|Article|ARTICLE)\s+/i.test(headerLine)) return 1;
  if (/^(Section|SECTION)\s+/i.test(headerLine)) return 2;
  if (/^(Annexe|ANNEXE|Appendix|APPENDIX)\s+/i.test(headerLine)) return 1;

  return 0; // Not a structured header
}

/**
 * Detect if a line is a section/article header
 * Matches:
 *   - Numbered: "1. ", "1.2. ", "A. "
 *   - Keywords: "Chapitre ", "Article ", "Section ", "Annexe "
 */
function isSectionHeader(line) {
  const trimmed = line.trim();

  // Empty lines are not headers
  if (trimmed.length === 0) return false;

  // Numbered sections (1., 1.2., A., etc.)
  if (/^(\d+(?:\.\d+)*\.?\s+|[A-Z]+\.?\s+)/i.test(trimmed)) {
    // Must have some content after the number/letter
    return trimmed.length > 4;
  }

  // Article/Section/Chapter headers
  if (/^(Article|Art\.|Section|Chapitre|Chapter|Annexe|ANNEXE|Appendix)\s+/i.test(trimmed)) {
    return true;
  }

  return false;
}

/**
 * Normalize and split text into paragraphs
 * Handles multiple newlines, extra spaces
 */
function splitIntoParagraphs(text) {
  return text
    .split(/\n\n+/)
    .map((para) => para.trim())
    .filter((para) => para.length >= MIN_PARA_LENGTH);
}

/**
 * Group paragraphs into chunks while respecting size limits
 * Returns array of { content, tokens }
 */
function groupParagraphsIntoChunks(paragraphs) {
  const chunks = [];
  let currentChunk = '';
  let currentTokens = 0;

  for (const para of paragraphs) {
    const paraTokens = estimateTokens(para);

    // Check if adding this paragraph would exceed max chunk size
    if (currentTokens + paraTokens > MAX_CHUNK_TOKENS && currentChunk.length > 0) {
      // Flush current chunk
      chunks.push({
        content: currentChunk.trim(),
        tokens: currentTokens,
      });

      // Start next chunk (possibly with overlap)
      currentChunk = para;
      currentTokens = paraTokens;
    } else {
      // Add to current chunk
      currentChunk = currentChunk.length > 0 ? currentChunk + '\n\n' + para : para;
      currentTokens += paraTokens;
    }
  }

  // Flush remaining chunk
  if (currentChunk.length > 0) {
    chunks.push({
      content: currentChunk.trim(),
      tokens: currentTokens,
    });
  }

  return chunks;
}

/**
 * Add overlap between consecutive chunks
 * Overlap: last N sentences from chunk[i] prepended to chunk[i+1]
 */
function addOverlapToChunks(chunks) {
  if (chunks.length <= 1) return chunks;

  const result = [];
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];

    if (i === 0) {
      result.push(chunk);
    } else {
      // Get overlap from previous chunk (last 1-2 sentences)
      const prevChunk = chunks[i - 1];
      const sentences = prevChunk.content.split(/(?<=[.!?])\s+/);

      // Take last 1-2 sentences as overlap (aim for OVERLAP_TOKENS)
      let overlap = '';
      let overlapTokens = 0;

      for (let j = sentences.length - 1; j >= 0 && overlapTokens < OVERLAP_TOKENS; j--) {
        const sentence = sentences[j];
        const sentenceTokens = estimateTokens(sentence);

        // Add to front of overlap to maintain order
        overlap = sentence + ' ' + overlap;
        overlapTokens += sentenceTokens;

        if (overlapTokens >= OVERLAP_TOKENS) break;
      }

      // Create chunk with overlap + new content
      const overlapContent = overlap.trim() ? overlap.trim() + '\n\n' + chunk.content : chunk.content;
      const overlapTokens_ = estimateTokens(overlapContent);

      result.push({
        content: overlapContent,
        tokens: overlapTokens_,
      });
    }
  }

  return result;
}

// ────────────────────────────────────────────────────────────────────────────
// Core Chunking: Structure-Aware with Semantic Boundaries
// ────────────────────────────────────────────────────────────────────────────

/**
 * Detect structural sections in the text
 * Returns array of { start_line, header, level, content }
 */
function detectStructuralSections(lines) {
  const sections = [];
  let currentSection = null;
  let currentLines = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (isSectionHeader(line)) {
      // Found a new section header
      if (currentSection) {
        // Save previous section
        currentSection.content_lines = currentLines;
        sections.push(currentSection);
      }

      const level = extractSectionLevel(line);
      currentSection = {
        start_line: i,
        header: line.trim(),
        level: level,
        content_lines: [],
      };
      currentLines = [];
    } else {
      // Content line for current section
      currentLines.push(line);
    }
  }

  // Save last section
  if (currentSection) {
    currentSection.content_lines = currentLines;
    sections.push(currentSection);
  }

  return sections;
}

/**
 * Chunk a section while preserving structure
 * If section is small, keep as one chunk
 * If large, split by paragraphs with overlap
 */
function chunkSection(section, sectionIndex) {
  const sectionContent = [section.header, ...section.content_lines].join('\n');
  const sectionTokens = estimateTokens(sectionContent);

  // Small sections: keep as single chunk
  if (sectionTokens <= TARGET_CHUNK_TOKENS) {
    return [{
      content: sectionContent,
      tokens: sectionTokens,
      metadata: {
        section_header: section.header,
        section_level: section.level,
        section_index: sectionIndex,
        is_complete_section: true,
      },
    }];
  }

  // Large sections: split by paragraphs
  const contentText = section.content_lines.join('\n');
  const paragraphs = splitIntoParagraphs(contentText);

  if (paragraphs.length === 0) {
    // No paragraphs found, split by lines
    return [{
      content: sectionContent,
      tokens: sectionTokens,
      metadata: {
        section_header: section.header,
        section_level: section.level,
        section_index: sectionIndex,
        is_complete_section: false,
        split_reason: 'no_paragraphs',
      },
    }];
  }

  // Group paragraphs into chunks
  let subChunks = groupParagraphsIntoChunks(paragraphs);

  // Add overlap between sub-chunks
  subChunks = addOverlapToChunks(subChunks);

  // Prepend section header to first chunk
  if (subChunks.length > 0) {
    const firstContent = section.header + '\n\n' + subChunks[0].content;
    subChunks[0] = {
      content: firstContent,
      tokens: estimateTokens(firstContent),
    };
  }

  // Add metadata to each sub-chunk
  return subChunks.map((chunk, idx) => ({
    ...chunk,
    metadata: {
      section_header: section.header,
      section_level: section.level,
      section_index: sectionIndex,
      sub_chunk_index: idx,
      is_complete_section: false,
    },
  }));
}

/**
 * Main chunking function: structure-aware with semantic grouping
 */
function chunkWithStructure(text) {
  // If text is too short, use simple paragraph chunking
  if (text.length < MIN_LENGTH_FOR_STRUCTURE) {
    const paragraphs = splitIntoParagraphs(text);
    const chunks = groupParagraphsIntoChunks(paragraphs);
    return chunks.map((chunk, idx) => ({
      ...chunk,
      metadata: {
        section_header: 'Unstructured',
        section_level: 0,
        section_index: 0,
        is_complete_section: false,
      },
    }));
  }

  // Detect structural sections
  const lines = text.split('\n');
  const sections = detectStructuralSections(lines);

  // If no structures detected, fall back to paragraph chunking
  if (sections.length === 0) {
    const paragraphs = splitIntoParagraphs(text);
    const chunks = groupParagraphsIntoChunks(paragraphs);
    return chunks.map((chunk, idx) => ({
      ...chunk,
      metadata: {
        section_header: 'Unstructured',
        section_level: 0,
        section_index: 0,
        is_complete_section: false,
      },
    }));
  }

  // Chunk each section independently
  const allChunks = [];
  for (let i = 0; i < sections.length; i++) {
    const sectionChunks = chunkSection(sections[i], i);
    allChunks.push(...sectionChunks);
  }

  return allChunks;
}

// ────────────────────────────────────────────────────────────────────────────
// Legacy API Compatibility
// ────────────────────────────────────────────────────────────────────────────

/**
 * Main export: compatible with existing ingestion pipeline
 *
 * Parameters:
 *   text (string) — normalized document text
 *   sections (array) — optional section metadata from structureSections()
 *   chunkSize (number) — legacy parameter (ignored, uses new sizing)
 *
 * Returns:
 *   Array of chunks with { content, section_title, section_level, chunk_index, metadata }
 */
export function smartChunkText(text, sections, chunkSize = 2500) {
  if (!text || text.trim().length === 0) {
    return [];
  }

  // Use new structure-aware chunking
  const chunks = chunkWithStructure(text);

  // Convert to legacy format for compatibility
  return chunks.map((chunk, idx) => ({
    content: chunk.content,
    section_title: chunk.metadata?.section_header || 'Unstructured',
    section_level: chunk.metadata?.section_level || 0,
    chunk_index: idx,
    global_index: idx,
    metadata: chunk.metadata || {},
  }));
}

/**
 * Legacy fallback: simple character-based chunking
 * (Kept for backwards compatibility, but not used by default)
 */
function simpleChunking(text, chunkSize) {
  const chunks = [];

  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push({
      content: text.substring(i, i + chunkSize),
      section_title: "Unstructured",
      section_level: 0,
      chunk_index: chunks.length,
      global_index: chunks.length,
      metadata: {
        section: "Unstructured",
        is_complete_section: false,
        split_reason: 'simple_fallback',
      },
    });
  }

  return chunks;
}
