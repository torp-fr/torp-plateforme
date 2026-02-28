import express from 'express';
import pdfParse from 'pdf-parse';
import fetch from 'node-fetch';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json({ limit: '50mb' }));

/**
 * POST /extract
 * Receives { file_url }
 * Downloads PDF from URL
 * Extracts text using pdf-parse
 * Returns { success, text, pages }
 */
app.post('/extract', async (req, res) => {
  try {
    const { file_url } = req.body;

    if (!file_url || typeof file_url !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Missing or invalid file_url parameter',
      });
    }

    console.log(`[PDF-EXTRACT] Processing: ${file_url}`);

    // Download PDF from URL
    const response = await fetch(file_url, {
      headers: {
        'User-Agent': 'TORP-PDFExtractor/1.0',
      },
      timeout: 30000,
    });

    if (!response.ok) {
      console.error(`[PDF-EXTRACT] Download failed: ${response.status} ${response.statusText}`);
      return res.status(400).json({
        success: false,
        error: `Failed to download PDF: ${response.status}`,
      });
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/pdf')) {
      console.error(`[PDF-EXTRACT] Invalid content type: ${contentType}`);
      return res.status(400).json({
        success: false,
        error: 'Invalid content type: not a PDF',
      });
    }

    const buffer = await response.buffer();

    if (buffer.length === 0) {
      console.error('[PDF-EXTRACT] Empty buffer');
      return res.status(400).json({
        success: false,
        error: 'PDF file is empty',
      });
    }

    console.log(`[PDF-EXTRACT] Downloaded ${buffer.length} bytes`);

    // Parse PDF
    console.log('[PDF-EXTRACT] Parsing PDF...');
    const data = await pdfParse(buffer);

    if (!data.text || data.text.trim().length === 0) {
      console.error('[PDF-EXTRACT] No text extracted');
      return res.status(400).json({
        success: false,
        error: 'No text could be extracted from PDF',
      });
    }

    console.log(`[PDF-EXTRACT] Success: ${data.text.length} chars, ${data.numpages} pages`);

    return res.json({
      success: true,
      text: data.text,
      pages: data.numpages,
    });
  } catch (error) {
    console.error('[PDF-EXTRACT] Error:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message || 'PDF extraction failed',
    });
  }
});

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'torp-pdf-extractor' });
});

/**
 * Root endpoint
 */
app.get('/', (req, res) => {
  res.json({
    service: 'TORP PDF Extractor',
    version: '1.0.0',
    endpoint: 'POST /extract',
    example: { file_url: 'https://example.com/document.pdf' },
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`[PDF-EXTRACTOR] Service running on port ${PORT}`);
  console.log(`[PDF-EXTRACTOR] Health check: http://localhost:${PORT}/health`);
  console.log(`[PDF-EXTRACTOR] Extract endpoint: POST http://localhost:${PORT}/extract`);
});
