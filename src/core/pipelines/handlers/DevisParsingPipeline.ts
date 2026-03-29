// ─────────────────────────────────────────────────────────────────────
// DevisParsingPipeline
// Detects format, extracts text (or runs OCR), parses line items, classifies
// Input:  { filePath, format }
// Output: { items: DevisItem[], montant_ht, parsing_confidence, parsing_method }
// ─────────────────────────────────────────────────────────────────────

import { classifyItemCategory, CATEGORY_TO_DOMAIN } from '../utils/index.js';
import type { PipelineContext, PipelineResult, DevisItem } from '../types/index.js';
import { createClient } from '@supabase/supabase-js';

const PRICE_PATTERN = /(\d{1,3}(?:[.,\s]\d{3})*(?:[.,]\d{2})?)\s*€?/g;
const QTY_UNIT_PATTERN = /\b(\d+(?:[.,]\d+)?)\s*(m²|ml|m3|u|forfait|h|j|kg|m2)\b/gi;

interface ParsingResult {
  status: 'parsed' | 'failed';
  items: DevisItem[];
  montant_ht: number;
  montant_ttc: number;
  tva_taux: number;
  parsing_confidence: number;
  parsing_method: 'pdf_text' | 'ocr' | 'csv' | 'web_form' | 'manual';
  parsing_errors: string[];
  parsed_at: string;
}

export class DevisParsingPipeline {
  async execute(
    params: { filePath: string; format: string },
    context: PipelineContext
  ): Promise<PipelineResult<ParsingResult>> {
    const startTime = Date.now();

    try {
      let text = '';
      let method: ParsingResult['parsing_method'] = 'pdf_text';
      const errors: string[] = [];

      // Step 1: Download file from Supabase Storage
      const fileBuffer = await this.downloadFile(params.filePath);

      // Step 2: Extract text based on format
      switch (params.format) {
        case 'pdf':
          ({ text, method } = await this.extractFromPDF(fileBuffer, errors));
          break;
        case 'image':
          text = await this.extractFromImage(fileBuffer);
          method = 'ocr';
          break;
        case 'csv':
          return this.parseCSV(fileBuffer, startTime);
        case 'web_form':
          // Already structured — handled upstream
          method = 'web_form';
          break;
        default:
          errors.push(`Unsupported format: ${params.format}`);
          return {
            status: 'failed',
            error: errors.join('; '),
            executionTimeMs: Date.now() - startTime,
            retryable: false,
          };
      }

      // Step 3: Parse line items from text
      const { items, confidence } = this.parseLineItems(text);

      // Step 4: Classify categories + assign domains
      const enrichedItems = items.map((item, i) => ({
        ...item,
        id:        crypto.randomUUID(),
        category:  classifyItemCategory(item.description),
        domain:    CATEGORY_TO_DOMAIN[classifyItemCategory(item.description)],
        is_taxable: true,
        tva_taux:  10,
      }));

      // Step 5: Compute totals
      const montant_ht = enrichedItems.reduce((s, i) => s + i.total_ht, 0);

      const data: ParsingResult = {
        status:             'parsed',
        items:              enrichedItems,
        montant_ht,
        montant_ttc:        montant_ht * 1.1,
        tva_taux:           10,
        parsing_confidence: confidence,
        parsing_method:     method,
        parsing_errors:     errors,
        parsed_at:          new Date().toISOString(),
      };

      return {
        status: 'completed',
        data,
        warnings: errors.length > 0 ? errors : undefined,
        executionTimeMs: Date.now() - startTime,
        retryable: false,
      };
    } catch (err) {
      return {
        status: 'failed',
        error: err instanceof Error ? err.message : String(err),
        executionTimeMs: Date.now() - startTime,
        retryable: true,
      };
    }
  }

  private async downloadFile(filePath: string): Promise<Buffer> {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const bucket = process.env.STORAGE_BUCKET_DEVIS ?? 'devis_uploads';
    const { data, error } = await supabase.storage.from(bucket).download(filePath);

    if (error || !data) {
      throw new Error(`Storage download failed: ${error?.message}`);
    }

    return Buffer.from(await data.arrayBuffer());
  }

  private async extractFromPDF(
    buffer: Buffer,
    errors: string[]
  ): Promise<{ text: string; method: 'pdf_text' | 'ocr' }> {
    // Try pdf-parse first (text extraction)
    try {
      const pdfParse = await import('pdf-parse');
      const parsed = await pdfParse.default(buffer);
      const text = parsed.text ?? '';

      // If text is too short, it's likely a scanned PDF
      if (text.replace(/\s/g, '').length < 50) {
        errors.push('PDF appears scanned — falling back to OCR');
        const ocrText = await this.extractFromImage(buffer);
        return { text: ocrText, method: 'ocr' };
      }

      return { text, method: 'pdf_text' };
    } catch (err) {
      errors.push(`pdf-parse failed: ${err} — trying OCR`);
      const ocrText = await this.extractFromImage(buffer);
      return { text: ocrText, method: 'ocr' };
    }
  }

  private async extractFromImage(buffer: Buffer): Promise<string> {
    // Prefer Google Vision if key available (better accuracy for handwritten/low-res)
    if (process.env.GOOGLE_VISION_API_KEY) {
      return this.extractWithGoogleVision(buffer);
    }

    // Fallback: Tesseract (local, free)
    return this.extractWithTesseract(buffer);
  }

  private async extractWithGoogleVision(buffer: Buffer): Promise<string> {
    // Calls existing supabase/functions/google-vision-ocr Edge Function
    const supabaseUrl = process.env.SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    const response = await fetch(`${supabaseUrl}/functions/v1/google-vision-ocr`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ image: buffer.toString('base64') }),
    });

    if (!response.ok) throw new Error(`Google Vision OCR failed: ${response.statusText}`);
    const result = await response.json() as { text: string };
    return result.text ?? '';
  }

  private async extractWithTesseract(buffer: Buffer): Promise<string> {
    const Tesseract = await import('tesseract.js');
    const lang = process.env.TESSERACT_LANG ?? 'fra';
    const { data } = await Tesseract.recognize(buffer, lang);
    return data.text;
  }

  private parseLineItems(text: string): { items: Omit<DevisItem, 'id' | 'category' | 'domain' | 'is_taxable' | 'tva_taux'>[]; confidence: number } {
    const lines = text
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 5);

    const items: Omit<DevisItem, 'id' | 'category' | 'domain' | 'is_taxable' | 'tva_taux'>[] = [];
    let parsedCount = 0;

    for (const [i, line] of lines.entries()) {
      const prices = [...line.matchAll(PRICE_PATTERN)]
        .map(m => parseFloat(m[1].replace(/[\s,]/g, '.').replace('..', '.')))
        .filter(n => !isNaN(n) && n > 0);

      if (prices.length < 1) continue; // No price → skip (likely header/footer)

      const qtyMatch = QTY_UNIT_PATTERN.exec(line);
      QTY_UNIT_PATTERN.lastIndex = 0; // reset regex state

      const total_ht = prices[prices.length - 1] ?? 0;
      const unit_price = prices.length >= 2 ? prices[prices.length - 2] : total_ht;
      const quantity = qtyMatch ? parseFloat(qtyMatch[1].replace(',', '.')) : 1;
      const unit = qtyMatch ? qtyMatch[2] : 'forfait';

      const descEnd = line.search(/\d/);
      const description = (descEnd > 5 ? line.slice(0, descEnd) : line).trim();

      items.push({
        line_number: i + 1,
        description,
        quantity,
        unit,
        unit_price,
        total_ht,
        confidence: prices.length >= 2 ? 0.8 : 0.5,
      });

      parsedCount++;
    }

    const confidence = items.length > 0
      ? (parsedCount / Math.max(lines.filter(l => /\d/.test(l)).length, 1)) * 0.85
      : 0;

    return { items, confidence: Math.min(1, confidence) };
  }

  private parseCSV(buffer: Buffer, startTime: number): PipelineResult<ParsingResult> {
    // CSV → split rows → detect column headers → map to DevisItem[]
    const text = buffer.toString('utf-8');
    const rows = text.split('\n').map(r => r.split(';').map(c => c.trim().replace(/^"|"$/g, '')));

    if (rows.length < 2) {
      return { status: 'failed', error: 'CSV has no data rows', executionTimeMs: Date.now() - startTime, retryable: false };
    }

    const headers = rows[0].map(h => h.toLowerCase());
    const colMap = this.detectCSVColumns(headers);

    const items: DevisItem[] = rows.slice(1)
      .filter(row => row.some(cell => cell.trim()))
      .map((row, i) => {
        const description = colMap.description !== undefined ? (row[colMap.description] ?? '') : '';
        const quantity    = parseFloat((colMap.qty !== undefined ? row[colMap.qty] : '1')?.replace(',', '.') ?? '1') || 1;
        const unit_price  = parseFloat((colMap.unit_price !== undefined ? row[colMap.unit_price] : '0')?.replace(',', '.') ?? '0');
        const total_ht    = parseFloat((colMap.total !== undefined ? row[colMap.total] : '0')?.replace(',', '.') ?? '0')
                           || (quantity * unit_price);
        const category    = classifyItemCategory(description);

        return {
          id:          crypto.randomUUID(),
          line_number: i + 1,
          description,
          quantity,
          unit:        'forfait',
          unit_price,
          total_ht,
          category,
          domain:      CATEGORY_TO_DOMAIN[category],
          is_taxable:  true,
          tva_taux:    10,
          confidence:  0.95,
        };
      });

    const montant_ht = items.reduce((s, i) => s + i.total_ht, 0);

    return {
      status: 'completed',
      data: {
        status: 'parsed', items, montant_ht, montant_ttc: montant_ht * 1.1,
        tva_taux: 10, parsing_confidence: 0.95, parsing_method: 'csv',
        parsing_errors: [], parsed_at: new Date().toISOString(),
      },
      executionTimeMs: Date.now() - startTime,
      retryable: false,
    };
  }

  private detectCSVColumns(headers: string[]): Record<string, number> {
    const synonyms: Record<string, string[]> = {
      description: ['description', 'désignation', 'libellé', 'item', 'article', 'prestation'],
      qty:         ['qté', 'qty', 'quantité', 'nb', 'nombre', 'quantity'],
      unit_price:  ['pu', 'prix unitaire', 'unit price', 'pu ht', 'tarif'],
      total:       ['total', 'montant', 'total ht', 'amount'],
    };

    const mapping: Record<string, number> = {};
    for (const [key, words] of Object.entries(synonyms)) {
      const idx = headers.findIndex(h => words.some(w => h.includes(w)));
      if (idx >= 0) mapping[key] = idx;
    }
    return mapping;
  }
}
