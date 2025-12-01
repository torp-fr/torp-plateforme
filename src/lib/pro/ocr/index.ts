/**
 * Module d'extraction OCR
 * Export centralisé des services OCR
 */

export { extractDevisData, extractDevisDataMock } from './extract-devis';
export type { ExtractedDevisData } from './extract-devis';
export { EXTRACTION_PATTERNS, parseAmount, parseDate, cleanText } from './patterns';
