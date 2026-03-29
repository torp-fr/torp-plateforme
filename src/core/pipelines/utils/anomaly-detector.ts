// ─────────────────────────────────────────────────────────────────────────────
// anomaly-detector.ts — Statistical anomaly detection for BTP data
// Flags pricing outliers, enterprise inconsistencies, and parsing errors
// ─────────────────────────────────────────────────────────────────────────────

export type AnomalySeverity = 'critical' | 'high' | 'medium' | 'low';

export interface Anomaly {
  code: string;
  severity: AnomalySeverity;
  message: string;
  /** Value that triggered the anomaly */
  observed?: number | string;
  /** Expected value or range */
  expected?: string;
  /** Suggested action for downstream engines */
  action?: 'block' | 'flag' | 'warn' | 'log';
}

export interface AnomalyReport {
  hasAnomalies: boolean;
  criticalCount: number;
  anomalies: Anomaly[];
}

// ── Pricing reference ranges (€ HT / unit) ───────────────────────────────────
// Sourced from BTP market databases + BATIPRIX references (2024/2025 estimates)

interface PriceRange {
  min: number;
  max: number;
  unit: string;
}

const PRICE_RANGES: Record<string, PriceRange> = {
  // Electricité
  'câblage': { min: 15, max: 120, unit: 'm' },
  'tableau électrique': { min: 500, max: 4000, unit: 'u' },
  'prise': { min: 50, max: 250, unit: 'u' },
  'interrupteur': { min: 30, max: 180, unit: 'u' },

  // Plomberie
  'tuyauterie': { min: 20, max: 150, unit: 'm' },
  'robinet': { min: 80, max: 600, unit: 'u' },
  'évacuation': { min: 25, max: 120, unit: 'm' },

  // Structure
  'béton': { min: 100, max: 350, unit: 'm³' },
  'terrassement': { min: 15, max: 80, unit: 'm³' },
  'maçonnerie': { min: 60, max: 250, unit: 'm²' },

  // Toiture
  'tuile': { min: 25, max: 120, unit: 'm²' },
  'ardoise': { min: 60, max: 250, unit: 'm²' },
  'zinguerie': { min: 40, max: 200, unit: 'm' },
  'charpente bois': { min: 50, max: 180, unit: 'm²' },

  // Isolation
  'isolation combles': { min: 20, max: 80, unit: 'm²' },
  'ite': { min: 80, max: 250, unit: 'm²' },
  'isolation plancher': { min: 25, max: 90, unit: 'm²' },

  // Menuiserie
  'fenêtre pvc': { min: 300, max: 1200, unit: 'u' },
  'fenêtre bois': { min: 600, max: 2500, unit: 'u' },
  'porte': { min: 200, max: 2000, unit: 'u' },
  'velux': { min: 500, max: 2000, unit: 'u' },

  // Finitions
  'carrelage': { min: 30, max: 120, unit: 'm²' },
  'peinture mur': { min: 8, max: 35, unit: 'm²' },
  'parquet': { min: 30, max: 150, unit: 'm²' },

  // Chauffage
  'chaudière gaz': { min: 2000, max: 8000, unit: 'u' },
  'pompe à chaleur': { min: 5000, max: 20000, unit: 'u' },
  'radiateur': { min: 150, max: 800, unit: 'u' },
};

// ── Pricing anomaly detection ─────────────────────────────────────────────────

export interface PricingAnomalyInput {
  description: string;
  unitPrice: number;
  unit?: string;
  quantity?: number;
  totalHT?: number;
  category?: string;
}

/**
 * Detect pricing anomalies in a single devis line item.
 * Compares against BTP market reference ranges.
 */
export function detectPricingAnomalies(items: PricingAnomalyInput[]): AnomalyReport {
  const anomalies: Anomaly[] = [];

  for (const item of items) {
    // Total coherence
    if (
      item.unitPrice > 0 &&
      item.quantity !== undefined &&
      item.totalHT !== undefined
    ) {
      const expected = item.unitPrice * item.quantity;
      const deviation = Math.abs(expected - item.totalHT) / expected;
      if (deviation > 0.05) {
        anomalies.push({
          code: 'PRICE_TOTAL_MISMATCH',
          severity: deviation > 0.2 ? 'critical' : 'high',
          message: `Total HT incohérent avec prix×quantité pour: "${item.description}"`,
          observed: item.totalHT,
          expected: `${expected.toFixed(2)}€`,
          action: deviation > 0.2 ? 'block' : 'flag',
        });
      }
    }

    // Zero or negative price
    if (item.unitPrice <= 0) {
      anomalies.push({
        code: 'PRICE_ZERO_OR_NEGATIVE',
        severity: 'high',
        message: `Prix unitaire nul ou négatif: "${item.description}"`,
        observed: item.unitPrice,
        action: 'flag',
      });
    }

    // Market range check
    const descLower = item.description.toLowerCase();
    for (const [key, range] of Object.entries(PRICE_RANGES)) {
      if (descLower.includes(key)) {
        if (item.unitPrice < range.min * 0.3) {
          anomalies.push({
            code: 'PRICE_SUSPICIOUSLY_LOW',
            severity: 'high',
            message: `Prix anormalement bas pour "${key}": ${item.unitPrice}€/${range.unit}`,
            observed: item.unitPrice,
            expected: `${range.min}–${range.max} €/${range.unit}`,
            action: 'flag',
          });
        } else if (item.unitPrice > range.max * 3) {
          anomalies.push({
            code: 'PRICE_SUSPICIOUSLY_HIGH',
            severity: 'medium',
            message: `Prix anormalement élevé pour "${key}": ${item.unitPrice}€/${range.unit}`,
            observed: item.unitPrice,
            expected: `${range.min}–${range.max} €/${range.unit}`,
            action: 'warn',
          });
        }
        break;
      }
    }

    // Very high line total (potential data entry error)
    if (item.totalHT !== undefined && item.totalHT > 500_000) {
      anomalies.push({
        code: 'LINE_TOTAL_VERY_HIGH',
        severity: 'medium',
        message: `Total ligne très élevé (>500k€): "${item.description}"`,
        observed: item.totalHT,
        action: 'warn',
      });
    }
  }

  return buildReport(anomalies);
}

// ── Enterprise anomaly detection ──────────────────────────────────────────────

export interface EnterpriseAnomalyInput {
  siret?: string;
  siren?: string;
  name?: string;
  naf?: string;
  dateCreation?: string;
  isActive?: boolean;
  capitalSocial?: number;
  /** Devis domain being checked against */
  devisDomain?: string;
  /** NAF codes declared by contractor */
  declaredNafCodes?: string[];
}

/** NAF codes associated with BTP domains */
const BTP_NAF_CODES = new Set([
  '4110A', '4110B', '4110C', '4110D',
  '4120A', '4120B',
  '4211Z', '4212Z', '4213A', '4213B', '4221Z', '4222Z', '4291Z', '4299Z',
  '4311Z', '4312A', '4312B', '4313Z',
  '4321A', '4321B', '4322A', '4322B', '4329A', '4329B',
  '4331Z', '4332A', '4332B', '4332C', '4333Z', '4334Z', '4339Z',
  '4391A', '4391B', '4399A', '4399B', '4399C', '4399D', '4399E',
]);

export function detectEnterpriseAnomalies(input: EnterpriseAnomalyInput): AnomalyReport {
  const anomalies: Anomaly[] = [];

  // SIRET format
  if (input.siret && !/^\d{14}$/.test(input.siret)) {
    anomalies.push({
      code: 'SIRET_INVALID_FORMAT',
      severity: 'critical',
      message: `SIRET invalide (format attendu: 14 chiffres): ${input.siret}`,
      observed: input.siret,
      action: 'block',
    });
  }

  // LUHN-style check: SIRET = SIREN + NIC (no formal checksum in French law, but warn on obvious mismatches)
  if (input.siret && input.siren && !input.siret.startsWith(input.siren)) {
    anomalies.push({
      code: 'SIRET_SIREN_MISMATCH',
      severity: 'critical',
      message: `SIRET ne commence pas par le SIREN déclaré`,
      observed: input.siret,
      expected: `Commence par ${input.siren}`,
      action: 'block',
    });
  }

  // Inactive company
  if (input.isActive === false) {
    anomalies.push({
      code: 'ENTERPRISE_INACTIVE',
      severity: 'critical',
      message: `Entreprise inactive ou radiée au registre`,
      action: 'block',
    });
  }

  // Very young company (< 6 months)
  if (input.dateCreation) {
    const ageMonths = (Date.now() - new Date(input.dateCreation).getTime()) / (30 * 24 * 3600 * 1000);
    if (ageMonths < 6) {
      anomalies.push({
        code: 'ENTERPRISE_TOO_YOUNG',
        severity: 'high',
        message: `Entreprise créée il y a moins de 6 mois`,
        observed: `${Math.round(ageMonths)} mois`,
        action: 'flag',
      });
    }
  }

  // NAF code not in BTP list
  if (input.naf && !BTP_NAF_CODES.has(input.naf)) {
    anomalies.push({
      code: 'NAF_NOT_BTP',
      severity: 'medium',
      message: `Code NAF ${input.naf} non répertorié dans les activités BTP`,
      observed: input.naf,
      action: 'warn',
    });
  }

  // Very low capital
  if (input.capitalSocial !== undefined && input.capitalSocial < 100) {
    anomalies.push({
      code: 'CAPITAL_VERY_LOW',
      severity: 'low',
      message: `Capital social très faible: ${input.capitalSocial}€`,
      observed: input.capitalSocial,
      action: 'log',
    });
  }

  return buildReport(anomalies);
}

// ── Parsing anomaly detection ─────────────────────────────────────────────────

export interface ParsingAnomalyInput {
  /** Total number of items extracted */
  itemCount: number;
  /** Items with missing unit price */
  missingPriceCount: number;
  /** Items with confidence below 0.5 */
  lowConfidenceCount: number;
  /** Total devis amount HT */
  totalHT?: number;
  /** Sum of all parsed line totals */
  parsedTotalHT?: number;
  /** Extraction method */
  method?: 'ocr' | 'pdf_text' | 'manual';
}

export function detectParsingAnomalies(input: ParsingAnomalyInput): AnomalyReport {
  const anomalies: Anomaly[] = [];

  if (input.itemCount === 0) {
    anomalies.push({
      code: 'NO_ITEMS_PARSED',
      severity: 'critical',
      message: 'Aucune ligne de devis extraite — document peut-être illisible ou vide',
      action: 'block',
    });
    return buildReport(anomalies);
  }

  // Missing prices ratio
  const missingRatio = input.missingPriceCount / input.itemCount;
  if (missingRatio > 0.5) {
    anomalies.push({
      code: 'HIGH_MISSING_PRICE_RATIO',
      severity: 'high',
      message: `${Math.round(missingRatio * 100)}% des lignes sans prix unitaire`,
      observed: `${input.missingPriceCount}/${input.itemCount}`,
      action: 'flag',
    });
  }

  // Low confidence ratio
  const lowConfRatio = input.lowConfidenceCount / input.itemCount;
  if (lowConfRatio > 0.4) {
    anomalies.push({
      code: 'HIGH_LOW_CONFIDENCE_RATIO',
      severity: input.method === 'ocr' ? 'medium' : 'high',
      message: `${Math.round(lowConfRatio * 100)}% des lignes à faible confiance d'extraction`,
      observed: `${input.lowConfidenceCount}/${input.itemCount}`,
      action: 'warn',
    });
  }

  // Total coherence
  if (
    input.totalHT !== undefined &&
    input.parsedTotalHT !== undefined &&
    input.totalHT > 0
  ) {
    const deviation = Math.abs(input.totalHT - input.parsedTotalHT) / input.totalHT;
    if (deviation > 0.15) {
      anomalies.push({
        code: 'TOTAL_AMOUNT_MISMATCH',
        severity: deviation > 0.3 ? 'critical' : 'high',
        message: `Total parsé diffère du total déclaré de ${(deviation * 100).toFixed(1)}%`,
        observed: input.parsedTotalHT,
        expected: `${input.totalHT}€`,
        action: deviation > 0.3 ? 'block' : 'flag',
      });
    }
  }

  return buildReport(anomalies);
}

// ── Statistical outlier detection (Z-score) ───────────────────────────────────

/**
 * Flag statistical outliers in a numeric dataset using Z-score.
 * Returns indices of outlier values (|z| > threshold, default 2.5).
 */
export function detectStatisticalOutliers(
  values: number[],
  threshold = 2.5
): Array<{ index: number; value: number; zScore: number }> {
  if (values.length < 3) return [];

  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);

  if (stdDev === 0) return [];

  return values
    .map((value, index) => ({ index, value, zScore: Math.abs((value - mean) / stdDev) }))
    .filter(({ zScore }) => zScore > threshold);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildReport(anomalies: Anomaly[]): AnomalyReport {
  return {
    hasAnomalies: anomalies.length > 0,
    criticalCount: anomalies.filter(a => a.severity === 'critical').length,
    anomalies,
  };
}
