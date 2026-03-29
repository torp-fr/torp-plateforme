# Devis Parsing Pipeline — Multi-Format Support
**Version:** 1.0
**Date:** 2026-03-27
**Status:** Design

---

## Overview

Accept devis in any format → output structured `DevisItem[]`.

```
User uploads devis
    ↓
[Format Detection]
    ├─ PDF (text)   → PDFTextExtractor
    ├─ PDF (scan)   → PDFImageExtractor → OCR
    ├─ Image/Photo  → OCR (Tesseract / Google Vision)
    ├─ Excel/CSV    → StructuredParser
    ├─ Web Form     → DirectMapper
    └─ Word (.docx) → DocxConverter → PDFTextExtractor
    ↓
[Text Normalization & Cleaning]
    └─ Remove headers, footers, page numbers, boilerplate
    ↓
[Line Item Extraction]
    ├─ Detect table structure (columns)
    ├─ Parse each row: description | qty | unit_price | total
    └─ Handle: merged cells, complex formatting, multi-line items
    ↓
[Category Auto-Classification]
    ├─ "électricité générale" → electricite
    ├─ "plomberie sanitaire"  → plomberie
    └─ Unknown               → "autre"
    ↓
[Validation & QA]
    ├─ Total coherent? (sum of items ≈ total montant)
    ├─ All items parsable?
    ├─ Confidence score: 0.0 – 1.0
    └─ Flag items for manual review
    ↓
[Store in Devis.parsing_result]
```

---

## Format-Specific Handlers

### 1. PDF Handler (most common)

```typescript
interface PDFParserConfig {
  expect_table?: boolean;        // True if devis is in table format
  expected_columns?: string[];   // ['description', 'qty', 'unit_price', 'total']
  language?: 'fr' | 'en';
}

async function parsePDF(filePath: string, config: PDFParserConfig): Promise<RawParseResult> {
  // Step 1: Try text extraction
  const text = await extractTextFromPDF(filePath);  // pdf-parse or pdfminer

  if (!text || text.replace(/\s/g, '').length < 50) {
    // Likely scanned PDF → fallback to OCR
    const images = await extractImagesFromPDF(filePath);
    return await parseImagesWithOCR(images, config.language);
  }

  return await parseStructuredText(text, config);
}
```

### 2. Image/Photo Handler (OCR)

```typescript
type OCRProvider = 'tesseract' | 'google_vision' | 'azure_ocr';

async function parseImageWithOCR(
  imageFile: File | Buffer,
  provider: OCRProvider = 'tesseract'
): Promise<RawParseResult> {
  let text: string;

  switch (provider) {
    case 'tesseract':
      // Free, local, French language model
      text = await Tesseract.recognize(imageFile, 'fra', {
        logger: m => console.log(m.status, m.progress),
      }).then(r => r.data.text);
      break;

    case 'google_vision':
      // Paid, higher accuracy for handwritten or low-quality scans
      text = await GoogleVisionClient.textDetection(imageFile)
        .then(r => r[0].textAnnotations?.[0]?.description ?? '');
      break;

    case 'azure_ocr':
      text = await AzureComputerVision.read(imageFile);
      break;
  }

  return await parseStructuredText(text, { language: 'fr' });
}
```

### 3. Excel/CSV Handler

```typescript
async function parseExcelOrCSV(file: File): Promise<RawParseResult> {
  const extension = file.name.split('.').pop()?.toLowerCase();

  let rows: string[][];
  if (extension === 'csv') {
    rows = await parseCSV(file);
  } else {
    // .xlsx, .xls
    rows = await parseExcel(file);  // sheet-js or exceljs
  }

  // Auto-detect column headers
  const headerRow = rows[0].map(h => h.toLowerCase().trim());
  const colMap = detectColumnMapping(headerRow);
  // Returns: { description: 0, qty: 1, unit_price: 2, total: 3 }

  const items = rows.slice(1)
    .filter(row => row.some(cell => cell.trim()))  // skip empty rows
    .map((row, i) => ({
      line_number: i + 1,
      description: row[colMap.description] ?? '',
      quantity: parseFloat((row[colMap.qty] ?? '1').replace(',', '.')),
      unit_price: parseFloat((row[colMap.unit_price] ?? '0').replace(',', '.')),
      total_ht: parseFloat((row[colMap.total] ?? '0').replace(',', '.')),
    }));

  return { items, confidence: 0.95 };  // CSV always high confidence
}

function detectColumnMapping(headers: string[]): Record<string, number> {
  const synonyms = {
    description: ['description', 'désignation', 'libellé', 'item', 'article', 'prestation'],
    qty: ['qté', 'qty', 'quantité', 'nb', 'nombre', 'quantity'],
    unit_price: ['pu', 'prix unitaire', 'unit price', 'pu ht', 'tarif'],
    total: ['total', 'montant', 'total ht', 'amount'],
  };

  const mapping: Record<string, number> = {};
  for (const [key, words] of Object.entries(synonyms)) {
    const idx = headers.findIndex(h => words.some(w => h.includes(w)));
    if (idx >= 0) mapping[key] = idx;
  }
  return mapping;
}
```

### 4. Web Form Handler (Direct)

```typescript
// Already structured — just map to DevisItem[]
function mapWebFormToItems(formData: WebFormDevis): DevisItem[] {
  return formData.lines.map((line, i) => ({
    id: crypto.randomUUID(),
    line_number: i + 1,
    description: line.description,
    quantity: line.quantity ?? 1,
    unit: line.unit ?? 'forfait',
    unit_price: line.unit_price,
    total_ht: line.quantity * line.unit_price,
    category: classifyItemCategory(line.description),
    is_taxable: true,
    tva_taux: line.tva_taux ?? 10,
    confidence: 1.0,  // User-entered = perfect confidence
  }));
}
```

---

## Text Parsing Logic

### Column Detection (Heuristic)

```typescript
// Typical French devis line formats:
// "Fourniture et pose béton armé fondations    15    m²    120,00    1 800,00"
// "Terrassement manuel              1    forfait    350,00    350,00"
// "Tableau électrique TGBT          1    u    890,00    890,00"

const PRICE_PATTERN = /(\d{1,3}(?:[.,\s]\d{3})*(?:[.,]\d{2})?)\s*€?/g;
const QTY_PATTERN = /\b(\d+(?:[.,]\d+)?)\s*(m²|ml|m3|u|forfait|h|j|kg)\b/gi;

function extractLineComponents(line: string): Partial<DevisItem> {
  // Find all numbers in the line (right to left = totals first)
  const prices = [...line.matchAll(PRICE_PATTERN)]
    .map(m => parseFloat(m[1].replace(/[\s,]/g, '.').replace('..', '.')));

  const qtyMatch = line.match(QTY_PATTERN);

  // Heuristic: last number = total, second-to-last = unit_price, first number with unit = qty
  const total = prices[prices.length - 1] ?? 0;
  const unitPrice = prices[prices.length - 2] ?? total;
  const qty = qtyMatch ? parseFloat(qtyMatch[0]) : 1;

  // Description = everything before the first number
  const descEnd = line.search(/\d/);
  const description = descEnd > 0 ? line.slice(0, descEnd).trim() : line.trim();

  return { description, quantity: qty, unit_price: unitPrice, total_ht: total };
}
```

---

## Category Auto-Classification

```typescript
interface CategoryMapping {
  keywords: string[];
  domain: string;      // DB domain (for rule.engine)
}

const CATEGORY_MAP: Record<string, CategoryMapping> = {
  electricite: {
    keywords: ['électr', 'câbl', 'tableau', 'prise', 'interrupteur', 'circuit', 'tgbt', 'consuel'],
    domain: 'électrique',
  },
  plomberie: {
    keywords: ['plomb', 'tuyau', 'eau', 'sanitaire', 'robinet', 'filtr', 'evacuation', 'wc'],
    domain: 'hydraulique',
  },
  structure: {
    keywords: ['béton', 'beton', 'fondation', 'terrassement', 'ferraillag', 'dalle', 'maçon', 'gros oeuvre'],
    domain: 'structure',
  },
  chauffage: {
    keywords: ['chauffage', 'chaudière', 'pompe chaleur', 'vmc', 'climatisation', 'thermopompe'],
    domain: 'thermique',
  },
  toiture: {
    keywords: ['toiture', 'couverture', 'ardoise', 'tuile', 'zinguerie', 'charpente'],
    domain: 'structure',
  },
  isolation: {
    keywords: ['isolation', 'laine', 'isolant', 'pare-vapeur', 'ite', 'iti'],
    domain: 'thermique',
  },
};

function classifyItemCategory(description: string): string {
  const normalized = description
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');  // remove accents

  for (const [category, config] of Object.entries(CATEGORY_MAP)) {
    if (config.keywords.some(kw => normalized.includes(kw))) {
      return category;
    }
  }
  return 'autre';
}
```

---

## Validation & QA

```typescript
interface ParsingQA {
  total_items: number;
  parsed_items: number;
  failed_items: number;
  montant_declared: number;    // From devis header
  montant_computed: number;    // Sum of parsed items
  delta_pct: number;           // % difference (tolerance: ±2%)
  confidence: number;          // 0.0 – 1.0
  warnings: string[];
  errors: string[];
}

function validateParsingResult(items: DevisItem[], declaredTotal?: number): ParsingQA {
  const parsedItems = items.filter(i => i.description.length > 3);
  const failedItems = items.length - parsedItems.length;
  const computedTotal = parsedItems.reduce((s, i) => s + i.total_ht, 0);
  const declared = declaredTotal ?? computedTotal;
  const delta = Math.abs(declared - computedTotal) / Math.max(declared, 1);

  const warnings: string[] = [];
  const errors: string[] = [];

  if (delta > 0.02) {
    warnings.push(`Total mismatch: declared ${declared}€ vs computed ${computedTotal}€ (${(delta * 100).toFixed(1)}% delta)`);
  }
  if (failedItems > parsedItems.length * 0.1) {
    errors.push(`High failure rate: ${failedItems}/${items.length} items failed to parse`);
  }
  if (parsedItems.some(i => i.unit_price === 0)) {
    warnings.push('Some items have €0 unit price — verify manually');
  }

  // Confidence: 1.0 if no issues, decreases per warning/error
  const confidence = Math.max(0,
    (parsedItems.length / Math.max(items.length, 1))
    * (1 - warnings.length * 0.1)
    * (errors.length > 0 ? 0.5 : 1)
  );

  return {
    total_items: items.length,
    parsed_items: parsedItems.length,
    failed_items: failedItems,
    montant_declared: declared,
    montant_computed: computedTotal,
    delta_pct: delta * 100,
    confidence,
    warnings,
    errors,
  };
}
```

---

## Reuse from KB Ingestion Pipeline

**Current KB pipeline (Phase 1-2):**
```
PDF upload → text extraction (pdf-parse) → smartChunker → embeddings → Supabase
```

**Devis pipeline (Phase 3+):**
```
Devis upload → format detection → OCR/extract → line parsing → category classification → Supabase
```

### Shared Layer: `DocumentParser`

```typescript
// Shared base class (extract + normalize text)
abstract class DocumentParser {
  abstract extract(file: File | Buffer): Promise<string>;

  normalize(text: string): string {
    return text
      .replace(/\r\n/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  async parse(file: File | Buffer): Promise<string> {
    const raw = await this.extract(file);
    return this.normalize(raw);
  }
}

// KB specialization
class KBDocumentExtractor extends DocumentParser {
  async extract(file: File): Promise<string> {
    return extractFullText(file);  // All text for chunking
  }
}

// Devis specialization
class DevisItemExtractor extends DocumentParser {
  async extract(file: File): Promise<string> {
    return extractTableText(file);  // Focus on tabular content
  }

  async parseItems(file: File): Promise<DevisItem[]> {
    const text = await this.parse(file);
    return extractLineItems(text);  // Structured line parsing
  }
}
```

**Overlap:**
- PDF text extraction: ✅ Reuse same pdf-parse / pdfminer
- OCR: ✅ Reuse same Tesseract/Google Vision setup
- Text normalization: ✅ Reuse same utils

**Divergence:**
- KB: Extract all text → chunk semantically for embeddings
- Devis: Extract table structure → parse monetary line items

---

## Confidence Tiers

| Confidence | Meaning | UI Behavior |
|-----------|---------|------------|
| 0.90 – 1.0 | Excellent (structured format) | Auto-accept, no review needed |
| 0.70 – 0.89 | Good (clear PDF) | Show items, light review prompt |
| 0.50 – 0.69 | Moderate (complex layout or OCR) | Review prompt with flagged items |
| 0.0 – 0.49 | Poor (illegible scan, bad format) | Block submission, require manual entry |
