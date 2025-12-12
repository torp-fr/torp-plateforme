/**
 * Services d'extraction et enrichissement
 * Module centralisé pour l'OCR, parsing et enrichissement des devis
 */

export { OcrExtractorService, ocrExtractorService, type OcrExtractionResult } from './ocr-extractor.service';
export { DevisParserService, devisParserService, type ParsedDevis, type DevisLigne, type DevisLot } from './devis-parser.service';
export { PriceReferenceService, priceReferenceService, type PriceReference, type PriceComparisonResult } from './price-reference.service';
