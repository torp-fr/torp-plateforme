# RAG Worker v2 - Multi-Format Document Ingestion

Production-ready document ingestion worker with modular architecture, multi-format support, and Google Vision OCR fallback.

## Architecture

### `/core`
- **supabaseClient.js** - Initialized Supabase client
- **embeddingService.js** - OpenAI embedding generation and validation

### `/extractors`
- **extractionService.js** - Format detection and router
- **pdfExtractor.js** - PDF text extraction (pdf-parse)
- **wordExtractor.js** - DOCX text extraction (mammoth)
- **excelExtractor.js** - XLSX conversion to text (xlsx)
- **visionExtractor.js** - Image OCR via Google Vision API

### `/processors`
- **cleanText.js** - Text normalization and cleanup
- **structureSections.js** - Detect and structure document sections
- **smartChunker.js** - Intelligent chunking with metadata preservation

## Supported Formats

| Format | Method | Fallback |
|--------|--------|----------|
| PDF | pdf-parse | Google Vision OCR if <500 chars |
| DOCX | mammoth | None |
| XLSX | xlsx (CSV conversion) | None |
| JPEG/PNG | Google Vision OCR | None |
| TXT | TextDecoder | None |

## Environment Variables

```bash
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
OPENAI_API_KEY=your_openai_key
GOOGLE_VISION_API_KEY=your_vision_api_key
```

## Features

### Atomic Claim Pattern
- Prevents race conditions with database UPDATE condition
- Only processes documents in 'pending' state

### Smart Chunking
- Respects document sections and structure
- Maintains section hierarchy metadata
- Fallback to simple chunking for unstructured text

### Batch Embeddings
- Single OpenAI API call for all chunks
- Validates embedding dimensions (1536-dim)
- Error handling with clear messaging

### Structured Metadata
Each chunk stores:
- `section_title` - Document section name
- `section_level` - Hierarchy level (0-6)
- `metadata` - JSON with detailed metadata
- `source_type` - Extraction method (pdf, docx, xlsx, image_ocr, text)
- `extraction_confidence` - "native" or "ocr"

### Progress Tracking
- ingestion_status: pending → processing → completed/failed
- ingestion_progress: 10 → 30 → 50 → 100

### Error Handling
- Graceful fallbacks (e.g., PDF → OCR)
- Error messages stored in `last_ingestion_error`
- Try-catch with detailed logging

## Polling

Worker polls every 10 seconds for documents with `ingestion_status = 'pending'`.

```javascript
setInterval(pollDocuments, 10000);
```

## Database Schema

Required tables:
- `knowledge_documents` - Document metadata
- `knowledge_chunks` - Text chunks with embeddings

### knowledge_chunks columns
```
- document_id (UUID)
- chunk_index (INT)
- content (TEXT)
- token_count (INT)
- section_title (TEXT)
- section_level (INT)
- metadata (JSONB)
- source_type (TEXT)
- extraction_confidence (TEXT)
- embedding (VECTOR(1536))
- embedding_generated_at (TIMESTAMP)
```

## Performance

- **PDF extraction**: ~1-2s for typical documents
- **DOCX extraction**: ~500ms
- **XLSX conversion**: ~500ms per sheet
- **Image OCR**: ~2-3s via Google Vision API
- **Batch embeddings**: ~1-2s for 50 chunks
- **Total typical document**: ~10-15s

## Production Ready

✅ Atomic operations
✅ Error recovery
✅ Graceful fallbacks
✅ Structured logging
✅ Batch operations
✅ Metadata preservation
✅ Multi-format support
✅ No hardcoded secrets
✅ Railway compatible

## Deployment

```bash
npm install
node worker.js
```

For Railway:
```
NODE_ENV=production
START: node worker.js
```
