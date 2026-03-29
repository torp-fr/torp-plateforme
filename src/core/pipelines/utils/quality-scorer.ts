// ─────────────────────────────────────────────────────────────────────────────
// quality-scorer.ts — Data quality scoring with confidence intervals
// Produces per-field 0–100 scores so engines can weight unreliable data lower
// ─────────────────────────────────────────────────────────────────────────────

export interface QualityScore {
  /** 0–100 composite quality score */
  score: number;
  /** 0–1 confidence in this score (based on input completeness) */
  confidence: number;
  /** Human-readable quality tier */
  tier: 'excellent' | 'good' | 'acceptable' | 'poor' | 'unusable';
  /** Fields that lowered the score */
  weaknesses: string[];
  /** Fields that raised the score */
  strengths: string[];
}

export interface AddressQualityInput {
  raw?: string;
  street?: string;
  city?: string;
  postalCode?: string;
  lat?: number;
  lon?: number;
  /** Source: 'bano' | 'nominatim' | 'user_input' | 'inferred' */
  source?: string;
  /** Score returned by the geocoder (0–1) */
  geocoderScore?: number;
}

export interface EnterpriseQualityInput {
  siret?: string;
  siren?: string;
  name?: string;
  raisonSociale?: string;
  naf?: string;
  dateCreation?: string;
  isActive?: boolean;
  capitalSocial?: number;
  /** Source: 'pappers' | 'insee' | 'user_input' */
  source?: string;
}

export interface DevisItemQualityInput {
  description?: string;
  quantity?: number;
  unit?: string;
  unitPrice?: number;
  totalHT?: number;
  category?: string;
  /** Extraction confidence from parser (0–1) */
  parserConfidence?: number;
}

// ── Tier thresholds ──────────────────────────────────────────────────────────

function toTier(score: number): QualityScore['tier'] {
  if (score >= 85) return 'excellent';
  if (score >= 65) return 'good';
  if (score >= 45) return 'acceptable';
  if (score >= 25) return 'poor';
  return 'unusable';
}

// ── Address quality ──────────────────────────────────────────────────────────

export function scoreAddressQuality(input: AddressQualityInput): QualityScore {
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  let score = 0;
  let confidenceFactors = 0;

  // Geocoordinates — highest signal
  if (input.lat !== undefined && input.lon !== undefined) {
    score += 35;
    strengths.push('coordonnées GPS disponibles');
    confidenceFactors++;
  } else {
    weaknesses.push('pas de coordonnées GPS');
  }

  // Geocoder score
  if (input.geocoderScore !== undefined) {
    score += Math.round(input.geocoderScore * 25);
    confidenceFactors++;
    if (input.geocoderScore >= 0.8) strengths.push('geocoder haute confiance');
    else if (input.geocoderScore < 0.4) weaknesses.push('geocoder basse confiance');
  }

  // Structured fields
  if (input.street) { score += 10; strengths.push('rue renseignée'); }
  else weaknesses.push('rue manquante');

  if (input.postalCode && /^\d{5}$/.test(input.postalCode)) {
    score += 10;
    strengths.push('code postal valide');
  } else {
    weaknesses.push('code postal absent ou invalide');
  }

  if (input.city) { score += 10; strengths.push('ville renseignée'); }
  else weaknesses.push('ville manquante');

  // Source bonus
  if (input.source === 'bano') { score += 10; strengths.push('source BANO officielle'); }
  else if (input.source === 'nominatim') { score += 5; }
  else if (input.source === 'user_input') weaknesses.push('saisie manuelle non vérifiée');

  const confidence = Math.min(1, (confidenceFactors + (input.raw ? 0.5 : 0)) / 3);

  return {
    score: Math.min(100, score),
    confidence,
    tier: toTier(score),
    strengths,
    weaknesses,
  };
}

// ── Enterprise quality ────────────────────────────────────────────────────────

export function scoreEnterpriseQuality(input: EnterpriseQualityInput): QualityScore {
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  let score = 0;
  let confidenceFactors = 0;

  // SIRET — critical identifier
  if (input.siret && /^\d{14}$/.test(input.siret)) {
    score += 30;
    strengths.push('SIRET valide (14 chiffres)');
    confidenceFactors++;
  } else if (input.siren && /^\d{9}$/.test(input.siren)) {
    score += 15;
    strengths.push('SIREN valide');
  } else {
    weaknesses.push('identifiant fiscal absent ou invalide');
  }

  // Name / raison sociale
  if (input.raisonSociale || input.name) {
    score += 15;
    strengths.push('raison sociale renseignée');
    confidenceFactors++;
  } else {
    weaknesses.push('raison sociale manquante');
  }

  // NAF code (activity)
  if (input.naf && /^\d{4}[A-Z]$/.test(input.naf)) {
    score += 10;
    strengths.push('code NAF valide');
  } else {
    weaknesses.push('code NAF manquant');
  }

  // Active status
  if (input.isActive === true) {
    score += 20;
    strengths.push('entreprise active');
    confidenceFactors++;
  } else if (input.isActive === false) {
    weaknesses.push('entreprise inactive ou radiée');
    // No score penalty here — just flag it
  }

  // Creation date
  if (input.dateCreation) {
    const years = (Date.now() - new Date(input.dateCreation).getTime()) / (365.25 * 24 * 3600 * 1000);
    if (years >= 2) { score += 10; strengths.push(`ancienneté ${Math.floor(years)} ans`); }
    else if (years < 1) weaknesses.push('entreprise créée il y a moins d\'un an');
  }

  // Capital social
  if (input.capitalSocial !== undefined && input.capitalSocial >= 1000) {
    score += 5;
    strengths.push('capital social renseigné');
  }

  // Source bonus
  if (input.source === 'pappers') { score += 10; strengths.push('données Pappers vérifiées'); confidenceFactors++; }
  else if (input.source === 'insee') { score += 5; }

  const confidence = Math.min(1, confidenceFactors / 4);

  return {
    score: Math.min(100, score),
    confidence,
    tier: toTier(score),
    strengths,
    weaknesses,
  };
}

// ── Devis item quality ────────────────────────────────────────────────────────

export function scoreDevisItemQuality(input: DevisItemQualityInput): QualityScore {
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  let score = 0;
  let confidenceFactors = 0;

  // Description
  if (input.description && input.description.trim().length >= 10) {
    score += 20;
    strengths.push('description suffisamment détaillée');
    confidenceFactors++;
  } else if (input.description) {
    score += 5;
    weaknesses.push('description trop courte');
  } else {
    weaknesses.push('description absente');
  }

  // Quantities and units
  if (input.quantity !== undefined && input.quantity > 0) {
    score += 20;
    strengths.push('quantité présente');
    confidenceFactors++;
  } else {
    weaknesses.push('quantité absente ou nulle');
  }

  if (input.unit && input.unit.trim().length > 0) {
    score += 10;
    strengths.push('unité renseignée');
  } else {
    weaknesses.push('unité manquante');
  }

  // Pricing
  if (input.unitPrice !== undefined && input.unitPrice > 0) {
    score += 20;
    strengths.push('prix unitaire présent');
    confidenceFactors++;
  } else {
    weaknesses.push('prix unitaire absent ou nul');
  }

  // Total coherence check
  if (
    input.totalHT !== undefined &&
    input.unitPrice !== undefined &&
    input.quantity !== undefined
  ) {
    const expected = input.unitPrice * input.quantity;
    const deviation = Math.abs(expected - input.totalHT) / (expected || 1);
    if (deviation < 0.01) {
      score += 15;
      strengths.push('cohérence prix×qté vérifiée');
    } else if (deviation > 0.1) {
      weaknesses.push(`incohérence prix×qté (${(deviation * 100).toFixed(1)}%)`);
    }
  }

  // Category
  if (input.category && input.category !== 'autre') {
    score += 5;
    strengths.push('catégorie identifiée');
  }

  // Parser confidence
  if (input.parserConfidence !== undefined) {
    score += Math.round(input.parserConfidence * 10);
    confidenceFactors++;
    if (input.parserConfidence < 0.5) weaknesses.push('faible confiance extraction OCR');
  }

  const confidence = Math.min(1, confidenceFactors / 4);

  return {
    score: Math.min(100, score),
    confidence,
    tier: toTier(score),
    strengths,
    weaknesses,
  };
}

// ── Aggregate quality ────────────────────────────────────────────────────────

/**
 * Merge multiple QualityScores into a single aggregate.
 * Uses weighted average with individual confidence as weight.
 */
export function aggregateQualityScores(
  scores: Array<{ score: QualityScore; weight?: number }>
): QualityScore {
  if (scores.length === 0) {
    return { score: 0, confidence: 0, tier: 'unusable', weaknesses: ['no data'], strengths: [] };
  }

  let weightedSum = 0;
  let weightSum = 0;
  let confSum = 0;
  const allWeaknesses: string[] = [];
  const allStrengths: string[] = [];

  for (const { score, weight = 1 } of scores) {
    const w = weight * score.confidence;
    weightedSum += score.score * w;
    weightSum += w;
    confSum += score.confidence;
    allWeaknesses.push(...score.weaknesses);
    allStrengths.push(...score.strengths);
  }

  const composite = weightSum > 0 ? Math.round(weightedSum / weightSum) : 0;
  const confidence = confSum / scores.length;

  return {
    score: composite,
    confidence,
    tier: toTier(composite),
    weaknesses: [...new Set(allWeaknesses)],
    strengths: [...new Set(allStrengths)],
  };
}
