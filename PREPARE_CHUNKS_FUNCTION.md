# Prepare Chunks Function
## Phase 41: Intelligent Text Chunking and Preparation

**Date**: 2026-02-28
**Status**: ✅ Implemented and Committed
**Location**: `supabase/functions/prepare-chunks/`

---

## Overview

The `prepare-chunks` Edge Function is the **second step** in the document ingestion pipeline. It extracts text from analyzed PDFs, intelligently chunks it, and prepares previews for user review before final embedding generation.

**Key Features**:
1. **Smart Text Extraction**: PDF text extraction with OCR page detection
2. **Text Cleaning**: Removes headers, footers, normalize whitespace
3. **Section Detection**: Identifies numbered headings (1., 1.1, 1.1.1, etc.)
4. **Intelligent Chunking**: 800-1200 tokens per chunk, respects section boundaries
5. **Hash Computation**: SHA256 hash per chunk for deduplication
6. **Quality Metrics**: Duplicate detection, quality scoring

---

## Architecture

### Pipeline Flow

```
Ingestion Job (status='analyzed')
        ↓
analyze-document() ✓ COMPLETED
        ↓
prepare-chunks() ◄─── YOU ARE HERE
        ↓
✅ Extract text
✅ Clean text
✅ Create chunks
✅ Compute hashes
✅ Insert previews
        ↓
status = 'chunk_preview_ready'
        ↓
review-chunks() (next phase)
        ↓
extract-document() (OCR if needed)
        ↓
embed-document() (generate embeddings)
        ↓
Complete
```

---

## Function Specification

### Input

```typescript
interface PrepareChunksRequest {
  job_id: string;  // UUID of analyzed ingestion_job
}
```

**Example Request**:
```bash
curl -X POST https://your-project.supabase.co/functions/v1/prepare-chunks \
  -H "Content-Type: application/json" \
  -d '{
    "job_id": "550e8400-e29b-41d4-a716-446655440000"
  }'
```

### Output

**Success Response** (200):
```json
{
  "success": true,
  "data": {
    "job_id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "chunk_preview_ready",
    "chunks_created": 24,
    "total_estimated_tokens": 19850,
    "chunks_requiring_ocr": 2,
    "chunk_summaries": [
      {
        "chunk_number": 0,
        "section_title": "1",
        "pages": "1-2",
        "tokens": 850,
        "requires_ocr": false,
        "preview": "Introduction to the system. This document covers..."
      },
      {
        "chunk_number": 1,
        "section_title": "1.1",
        "pages": "2-3",
        "tokens": 920,
        "requires_ocr": false,
        "preview": "Overview of components. The system consists of..."
      },
      ...
    ],
    "latency_ms": 4567
  }
}
```

**Error Response** (400/404/500):
```json
{
  "error": "Job status must be 'analyzed' but is 'pending'"
}
```

---

## Database Integration

### ingestion_chunks_preview Table

```sql
CREATE TABLE public.ingestion_chunks_preview (
  id UUID PRIMARY KEY,

  -- Ownership
  job_id UUID NOT NULL,
  company_id UUID NOT NULL,

  -- Chunk metadata
  chunk_number INTEGER,           -- Sequential 0-indexed
  start_page INTEGER,             -- First page
  end_page INTEGER,               -- Last page
  section_title TEXT,             -- Section heading (e.g., "1.2.3")

  -- Content
  content TEXT,                   -- Full chunk text
  content_hash VARCHAR(64),       -- SHA256 hash
  content_summary TEXT,           -- 1-2 sentence summary
  content_preview VARCHAR(200),   -- First 200 chars

  -- Token metrics
  estimated_tokens INTEGER,       -- Pre-embedding estimate
  actual_tokens INTEGER,          -- Post-embedding actual
  min_tokens INTEGER DEFAULT 800,
  max_tokens INTEGER DEFAULT 1200,

  -- OCR tracking
  requires_ocr BOOLEAN,           -- True if pages need OCR
  ocr_pages TEXT[],              -- Array of page numbers

  -- Quality metrics
  status chunk_status,            -- pending_ocr, preview_ready, verified, etc.
  quality_score NUMERIC(3, 2),   -- 0.0-1.0 quality rating
  is_duplicate BOOLEAN,           -- True if similar to previous chunk
  duplicate_of UUID,              -- Reference to original chunk

  -- Timestamps
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  verified_at TIMESTAMPTZ
);
```

---

## Implementation Details

### 1. Text Extraction from PDF

```typescript
const pdfjsLib = await import('https://esm.sh/pdfjs-dist@4.0.0');
const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;

for (let i = 1; i <= pdf.numPages; i++) {
  const page = await pdf.getPage(i);
  const content = await page.getTextContent();
  const pageText = content.items.map(item => item.str).join(' ');

  // Mark as "has text" if > 50 chars extracted
  pages.push({
    number: i,
    hasText: pageText.trim().length > 50
  });
}
```

**Page Classification**:
- **Has Text**: > 50 characters extracted
- **Needs OCR**: < 50 characters (scanned image)

### 2. Text Cleaning

```typescript
function cleanText(text: string): string {
  // 1. Remove page markers: [PAGE 1], [PAGE 2], etc.
  text = text.replace(/\[PAGE \d+\]\n/g, '');

  // 2. Remove header/footer patterns:
  //    - Page numbers: "Page 1", "p. 5"
  //    - Repeated markers: "---", "___"
  //    - Common headers: "Chapter", "Section", "Part"
  HEADER_FOOTER_PATTERNS.forEach(pattern => {
    text = text.replace(pattern, '');
  });

  // 3. Normalize whitespace:
  //    - Multiple spaces → single space
  //    - Empty lines → removed
  //    - Multiple newlines → max 2
  text = text.replace(/  +/g, ' ');
  text = text.replace(/^\s*$/gm, '');
  text = text.replace(/\n{3,}/g, '\n\n');

  return text.trim();
}
```

### 3. Section Detection

```typescript
const SECTION_HEADING_PATTERN = /^(\d+(?:\.\d+)*)\s+(.+)$/;

// Detects:
// 1. Introduction              ← level 1
// 1.1 Background               ← level 2
// 1.1.1 History                ← level 3
// 1.1.1.1 Early Days           ← level 4
```

**Section Extraction**:
- Extracts heading number: "1.2.3"
- Calculates nesting level (number of dots + 1)
- Preserves heading as section title in chunks
- Maintains document structure

### 4. Intelligent Chunking Algorithm

```typescript
async function createIntelligentChunks(
  text: string,
  pages: PageInfo[]
): Promise<ChunkData[]> {
  const chunks = [];
  let currentChunk = '';
  let currentSection = null;

  for (const line of lines) {
    const isSectionHeading = line.match(SECTION_HEADING_PATTERN);

    if (isSectionHeading) {
      // Save previous chunk if substantial
      if (estimateTokens(currentChunk) > TARGET_MIN) {
        chunks.push(finalizeChunk(currentChunk, ...));
        currentChunk = '';
      }
      currentSection = extractedHeading;
      currentChunk = line + '\n';
    } else {
      currentChunk += line + '\n';

      // Save if chunk is getting too large
      if (estimateTokens(currentChunk) > TARGET_MAX) {
        chunks.push(finalizeChunk(currentChunk, ...));
        currentChunk = '';
      }
    }
  }

  // Save remaining chunk
  if (currentChunk.trim()) {
    chunks.push(finalizeChunk(currentChunk, ...));
  }

  return chunks;
}
```

**Chunking Rules**:
1. **Minimum size**: 800 tokens (avoid tiny chunks)
2. **Maximum size**: 1200 tokens (avoid huge chunks)
3. **Section boundaries**: Preserve section structure
4. **Section titles**: Repeat title in subsequent chunks
5. **Conservative estimate**: ~1 token per 4 characters

### 5. SHA256 Hash Computation

```typescript
async function computeContentHash(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);

  // Convert to hex string
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  return hashHex;  // e.g., "a1b2c3d4..."
}
```

**Hash Uses**:
- **Deduplication**: Detect duplicate chunks
- **Integrity**: Verify chunk content not modified
- **Caching**: Could cache embeddings by hash
- **Tracking**: Audit trail of chunk modifications

### 6. Token Estimation

```typescript
function estimateTokens(content: string): number {
  // Conservative estimate: 1 token per 4 characters
  // Actual tokens may be 10-15% different based on:
  // - Language (multilingual = more tokens)
  // - Special characters (= more tokens)
  // - Code/technical content (= more tokens)

  const estimatedTokens = Math.ceil(content.length / 4);
  return Math.max(1, estimatedTokens);
}

// Examples:
// 3,200 chars → 800 tokens (target minimum)
// 4,800 chars → 1,200 tokens (target maximum)
```

---

## Usage Examples

### Example 1: Basic Chunking

```typescript
// After analyze-document() completes
const response = await fetch('/.netlify/functions/prepare-chunks', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ job_id: job.id })
});

const { data } = await response.json();

console.log(`Created ${data.chunks_created} chunks`);
console.log(`Total tokens: ${data.total_estimated_tokens}`);
console.log(`Chunks needing OCR: ${data.chunks_requiring_ocr}`);

// Display chunk previews to user
data.chunk_summaries.forEach(chunk => {
  console.log(`Chunk ${chunk.chunk_number}: "${chunk.section_title}" (${chunk.tokens} tokens)`);
  console.log(`  Preview: ${chunk.preview}`);
  if (chunk.requires_ocr) {
    console.log(`  ⚠️ Requires OCR`);
  }
});
```

### Example 2: Check Before Embedding

```typescript
// User reviews chunks before embedding
const { data: chunks } = await supabase
  .from('ingestion_chunks_preview')
  .select('*')
  .eq('job_id', jobId)
  .order('chunk_number');

const totalTokens = chunks.reduce((sum, c) => sum + c.estimated_tokens, 0);
const estimatedEmbeddingCost = (totalTokens / 1_000_000) * 0.00002;

console.log(`Total tokens: ${totalTokens}`);
console.log(`Est. embedding cost: $${estimatedEmbeddingCost.toFixed(4)}`);

// User can now decide whether to proceed
if (userConfirms) {
  await proceedWithEmbedding(jobId);
}
```

### Example 3: Duplicate Detection

```typescript
// Find duplicate chunks
const { data: duplicates } = await supabase
  .from('ingestion_chunks_preview')
  .select('*')
  .eq('job_id', jobId)
  .eq('is_duplicate', true);

duplicates.forEach(chunk => {
  console.log(`Chunk ${chunk.chunk_number} is duplicate of ${chunk.duplicate_of}`);
});

// Could deduplicate before embedding to save costs
const uniqueChunks = chunks.filter(c => !c.is_duplicate);
console.log(`${uniqueChunks.length} unique chunks to embed`);
```

---

## Error Handling

### Possible Errors

| Error | Status | Message | Recovery |
|-------|--------|---------|----------|
| Missing job_id | 400 | "Missing or invalid job_id" | Provide valid UUID |
| Job not found | 404 | "Job not found" | Create job first |
| Wrong status | 400 | "Job status must be 'analyzed'" | Run analyze-document first |
| Job cancelled | 400 | "Job has been cancelled" | Create new job |
| Storage error | 500 | "Failed to load file" | Check file exists |
| PDF parse error | 500 | "PDF extraction failed" | Check PDF integrity |
| Chunk insertion error | 500 | "Failed to insert chunks" | Check database |

### Error Recovery

```typescript
// If chunking fails, job is marked as 'failed'
{
  status: 'failed',
  error_message: 'PDF extraction error: Invalid PDF structure',
  failure_reason: 'pdf_parse_error'
}

// User can:
// 1. Fix the document
// 2. Create new ingestion job
// 3. Retry from analyze-document phase
```

---

## Performance Characteristics

### Time Complexity

| Document Size | Pages | Chunks | Est. Time | Notes |
|---------------|-------|--------|-----------|-------|
| <1 MB | 5-10 | 2-4 | 1-2s | Fast |
| 1-5 MB | 20-50 | 5-15 | 2-4s | Typical |
| 5-10 MB | 50-100 | 15-30 | 4-8s | Large |
| >10 MB | >100 | >30 | 8-15s | Very large |

### Token Estimation Accuracy

```
Formula: chars / 4 (conservative)
Typical accuracy: ±10-15%

Example:
- Content: 10,000 chars
- Estimate: 2,500 tokens
- Actual range: 2,125-2,875 tokens (±15%)
```

### Cost per Chunking Operation

```
PDF extraction: ~0
Text cleaning: ~0
SHA256 hashing: ~0
Database inserts: ~$0.001 (per 1000 rows)

Total: ~$0.001-0.005 (negligible)
```

---

## Quality Metrics

### Duplicate Detection

```typescript
// Future enhancement: Use similarity scoring
// For now, duplicates marked by hash matching

const duplicateCheck = async (newHash: string) => {
  const existing = await supabase
    .from('ingestion_chunks_preview')
    .select('id')
    .eq('content_hash', newHash)
    .single();

  return existing ? 'duplicate' : 'unique';
};
```

### Quality Score

```
Default: 0.85 (85% quality)

Future enhancements:
- Reduce for chunks with OCR pages
- Reduce for very small chunks (<500 tokens)
- Reduce for detected duplicates
- Increase for well-structured content
```

---

## Integration Points

### 1. User Review Interface

```typescript
// After prepare-chunks completes
const chunks = await fetchChunkPreviews(jobId);

// Display:
// - Chunk content preview
// - Estimated tokens
// - Section title
// - OCR flag
// - Quality score

// User can:
// - Edit chunk content
// - Mark duplicates
// - Set quality score
// - Flag issues
```

### 2. Cost Forecasting

```typescript
const totalTokens = await supabase
  .from('ingestion_chunks_preview')
  .select('estimated_tokens')
  .eq('job_id', jobId);

const totalEstimate = totalTokens.reduce((sum, c) => sum + c.estimated_tokens, 0);
const embeddingCost = (totalEstimate / 1_000_000) * 0.00002;

console.log(`Estimated embedding cost: $${embeddingCost.toFixed(4)}`);
```

### 3. Quality Metrics Dashboard

```typescript
// Admin dashboard: chunk processing stats
const stats = {
  total_chunks: await countChunks(jobId),
  chunks_ready: await countChunks(jobId, 'preview_ready'),
  chunks_ocr: await countChunks(jobId, 'pending_ocr'),
  avg_quality: await avgQualityScore(jobId),
  duplicates_detected: await countDuplicates(jobId)
};
```

---

## Testing

### Unit Tests

```typescript
// Test text cleaning
const dirty = '  Multiple   spaces\n\n\n[PAGE 1]\nContent';
const clean = cleanText(dirty);
assert(!clean.includes('[PAGE'));
assert(!clean.includes('  '));
assert(!clean.match(/\n{3,}/));

// Test section detection
const text = '1. Intro\n1.1 Background\n1.1.1 History';
const sections = detectSections(text);
assert.equal(sections.length, 3);
assert.equal(sections[0].level, 1);
assert.equal(sections[1].level, 2);
assert.equal(sections[2].level, 3);

// Test hash computation
const hash1 = await computeHash('content');
const hash2 = await computeHash('content');
assert.equal(hash1, hash2); // Deterministic

// Test token estimation
const tokens = estimateTokens('a'.repeat(3200));
assert.equal(tokens, 800); // 3200 / 4
```

### Integration Tests

```typescript
// End-to-end chunking
const response = await prepareChunks({ job_id });
assert.equal(response.status, 'chunk_preview_ready');

// Verify chunks inserted
const chunks = await fetchChunks(job_id);
assert(chunks.length > 0);
assert(chunks.every(c => c.content_hash));
assert(chunks.every(c => c.estimated_tokens >= 1));

// Verify job updated
const job = await fetchJob(job_id);
assert.equal(job.status, 'chunk_preview_ready');
assert.equal(job.progress, 50);
```

---

## Monitoring & Logging

### Log Levels

```
[PREPARE-CHUNKS] Starting chunk preparation
[PREPARE-CHUNKS] Processing job: 550e8400...
[PREPARE-CHUNKS] Job loaded: {id, status, file_path}
[PREPARE-CHUNKS] Loading file from storage
[PREPARE-CHUNKS] Extracting text from PDF
[PREPARE-CHUNKS] Page 1: 2450 chars
[PREPARE-CHUNKS] Pages needing OCR: 2, 45, 67
[PREPARE-CHUNKS] Extracted text: 234567 chars
[PREPARE-CHUNKS] Cleaning text
[PREPARE-CHUNKS] Cleaned text: 198765 chars
[PREPARE-CHUNKS] Detecting sections
[PREPARE-CHUNKS] Detected 12 sections
[PREPARE-CHUNKS] Creating intelligent chunks
[PREPARE-CHUNKS] Created 24 chunks
[PREPARE-CHUNKS] Inserting chunks
[PREPARE-CHUNKS] Job updated successfully
[PREPARE-CHUNKS] Chunk preparation complete in 4567ms
```

### Metrics to Track

- `chunk_preparation_duration_ms` (latency)
- `chunks_created_count` (throughput)
- `total_estimated_tokens` (cost tracking)
- `chunks_requiring_ocr_count` (quality metric)
- `job_success_rate` (reliability)

---

## Future Improvements

### v2 Enhancements

1. **ML-Based Chunking**
   - Semantic similarity scoring
   - ML-based optimal split points
   - Preserve semantic boundaries

2. **Advanced Deduplication**
   - Fuzzy matching for near-duplicates
   - Similarity threshold-based detection
   - Cross-document deduplication

3. **Chunk Quality Scoring**
   - Reduce score for OCR chunks
   - Reduce for small chunks
   - Reduce for duplicates
   - Increase for well-structured

4. **Batch Processing**
   - Process multiple documents in parallel
   - Optimize storage operations
   - Reduce latency for bulk ingestion

5. **User Feedback Loop**
   - Allow users to edit chunks
   - Learn from user corrections
   - Improve future chunking

---

## Related Functions

- **analyze-document**: Analyzes PDF structure (phase 1)
- **prepare-chunks**: Intelligently chunks text (phase 2) ◄── YOU ARE HERE
- **review-chunks**: User review and approval interface (phase 3)
- **extract-document**: Performs OCR on marked pages (phase 4)
- **embed-document**: Generates embeddings (phase 5)

---

## Troubleshooting

### Function Timeout

**Problem**: Function exceeds 60-second timeout
**Symptoms**: "504 Gateway Timeout"
**Solution**:
- Implement streaming uploads for very large files
- Add chunking for files > 50 MB
- Use batch database inserts (current implementation already does this)

### Memory Issues

**Problem**: "Out of memory" error
**Symptoms**: Function crashes during text extraction
**Solution**:
- PDFs loaded entirely into memory
- Large PDFs (>100 MB) may cause issues
- Consider splitting PDFs before ingestion

### Incorrect Chunk Boundaries

**Problem**: Chunks breaking in middle of sections
**Symptoms**: Section titles not appearing in first chunks
**Solution**:
- This function respects section boundaries
- Verify document has proper numbered headings (1., 1.1, etc.)
- For documents without headings, default chunking applies

### Token Estimate Inaccuracy

**Problem**: Actual tokens differ significantly from estimate
**Symptoms**: >20% variance between estimate and actual
**Solution**:
- Estimates are ±15% by design
- Multi-language documents may have higher variance
- Code/technical content causes higher token usage
- Use actual counts from embedding phase for accuracy

---

## Conclusion

The `prepare-chunks` function provides:
- ✅ Intelligent text extraction from PDFs
- ✅ Smart text cleaning and normalization
- ✅ Section-aware chunking
- ✅ SHA256 hashing for integrity
- ✅ Token estimation for cost planning
- ✅ OCR page detection
- ✅ Quality metrics and duplicate detection
- ✅ Preview generation for user review
- ✅ Foundation for embedding phase

See `INGESTION_PIPELINE.md` for the complete document processing workflow.

