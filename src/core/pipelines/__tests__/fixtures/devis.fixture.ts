// ─────────────────────────────────────────────────────────────────────────────
// fixtures/devis.fixture.ts — Test fixtures for devis/pricing data
// ─────────────────────────────────────────────────────────────────────────────

import type { DevisItem, PipelineContext } from '../../types/index.js';
import type { PricingAnomalyInput, ParsingAnomalyInput } from '../../utils/anomaly-detector.js';
import type { DevisItemQualityInput } from '../../utils/quality-scorer.js';

export const makeDevisPipelineContext = (overrides?: Partial<PipelineContext>): PipelineContext => ({
  pipelineName: 'devis-parsing',
  entityId: 'devis-uuid-001',
  entityType: 'devis',
  startedAt: new Date('2026-03-01T10:00:00Z'),
  timeout: 60_000,
  ...overrides,
});

// ── Devis item fixtures ──────────────────────────────────────────────────────

export const DEVIS_ITEMS_COMPLETE: DevisItem[] = [
  {
    id: 'item-001',
    line_number: 1,
    description: 'Tableau électrique 18 modules avec disjoncteurs',
    quantity: 1,
    unit: 'u',
    unit_price: 850,
    total_ht: 850,
    category: 'electricite',
    domain: 'électrique',
    is_taxable: true,
    tva_taux: 10,
    confidence: 0.95,
  },
  {
    id: 'item-002',
    line_number: 2,
    description: 'Câblage électrique cuivre 2.5mm²',
    quantity: 120,
    unit: 'm',
    unit_price: 8.5,
    total_ht: 1020,
    category: 'electricite',
    domain: 'électrique',
    is_taxable: true,
    tva_taux: 10,
    confidence: 0.9,
  },
  {
    id: 'item-003',
    line_number: 3,
    description: 'Pose radiateur aluminium 1000W',
    quantity: 3,
    unit: 'u',
    unit_price: 320,
    total_ht: 960,
    category: 'chauffage',
    domain: 'thermique',
    is_taxable: true,
    tva_taux: 10,
    confidence: 0.87,
  },
  {
    id: 'item-004',
    line_number: 4,
    description: 'Isolation combles perdus laine de verre 300mm',
    quantity: 85,
    unit: 'm²',
    unit_price: 35,
    total_ht: 2975,
    category: 'isolation',
    domain: 'thermique',
    is_taxable: true,
    tva_taux: 5.5,
    confidence: 0.92,
  },
];

export const DEVIS_ITEMS_WITH_ANOMALIES: PricingAnomalyInput[] = [
  {
    description: 'Pose carrelage 60x60 rectifié',
    unitPrice: 2.50, // suspiciously low (market: 30–120 €/m²)
    unit: 'm²',
    quantity: 45,
    totalHT: 112.5,
    category: 'carrelage',
  },
  {
    description: 'Fenêtre PVC double vitrage 120x100',
    unitPrice: 8500, // suspiciously high (market: 300–1200 €/u)
    unit: 'u',
    quantity: 2,
    totalHT: 17000,
    category: 'menuiserie',
  },
  {
    description: 'Peinture mur intérieur acrylique',
    unitPrice: 15,
    unit: 'm²',
    quantity: 200,
    totalHT: 4500, // mismatch: 15×200=3000, declared=4500
    category: 'peinture',
  },
];

// ── Quality input fixtures ────────────────────────────────────────────────────

export const DEVIS_ITEM_QUALITY: DevisItemQualityInput[] = [
  {
    description: 'Pose carrelage grès cérame rectifié 60x60, col. Gris Ciment',
    quantity: 45,
    unit: 'm²',
    unitPrice: 68,
    totalHT: 3060,
    category: 'carrelage',
    parserConfidence: 0.93,
  },
  {
    description: '', // missing
    quantity: 0,    // zero
    unit: '',
    unitPrice: 0,
    category: 'autre',
    parserConfidence: 0.2,
  },
];

// ── Parsing anomaly fixtures ──────────────────────────────────────────────────

export const PARSING_GOOD: ParsingAnomalyInput = {
  itemCount: 42,
  missingPriceCount: 1,
  lowConfidenceCount: 2,
  totalHT: 48_500,
  parsedTotalHT: 48_350,
  method: 'pdf_text',
};

export const PARSING_BAD: ParsingAnomalyInput = {
  itemCount: 20,
  missingPriceCount: 12, // 60% missing
  lowConfidenceCount: 15,
  totalHT: 25_000,
  parsedTotalHT: 14_000, // 44% mismatch
  method: 'ocr',
};

export const PARSING_EMPTY: ParsingAnomalyInput = {
  itemCount: 0,
  missingPriceCount: 0,
  lowConfidenceCount: 0,
  method: 'ocr',
};
