// ─────────────────────────────────────────────────────────────────────────────
// InsuranceValidator — Parse insurance attestations (PDF/image) via Claude
// Extracts: policy number, dates, covered activities, coverage amounts, exclusions
// ─────────────────────────────────────────────────────────────────────────────

import type { SupabaseClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

// BTP activities that insurance might cover
const BTP_ACTIVITIES = [
  'isolation', 'chauffage', 'plomberie', 'electricite', 'menuiserie',
  'peinture', 'couverture', 'charpente', 'carrelage', 'maçonnerie',
  'fenetre', 'etancheite', 'acoustique', 'accessibilite', 'terrassement',
  'demolition', 'echafaudage', 'structure', 'climatisation', 'ventilation',
] as const;

// ── Types ────────────────────────────────────────────────────────────────────

export interface ParsedInsuranceData {
  policy_number: string | null;
  insurer: string | null;
  start_date: string | null;
  end_date: string | null;
  covered_activities: string[];
  coverage_amounts: Record<string, number>;
  garanties: string[];
  exclusions: string[];
  confidence: number;
}

export interface CoverageValidation {
  is_covered: boolean;
  uncovered_domains: string[];
  expiry_alert: string | null;
  exclusion_alerts: string[];
  confidence: number;
}

// ── InsuranceValidator ────────────────────────────────────────────────────────

export class InsuranceValidator {
  private _anthropic?: Anthropic;
  private get anthropic(): Anthropic {
    if (!this._anthropic) {
      this._anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    }
    return this._anthropic;
  }

  constructor(private readonly supabase: SupabaseClient) {}

  /**
   * Parse an insurance document (PDF or image) using Claude.
   * Returns structured insurance data with a confidence score.
   */
  async parseDocument(fileUrl: string, fileName: string): Promise<ParsedInsuranceData> {
    // 1. Download the file
    const buffer = await this.downloadFile(fileUrl);
    const base64 = buffer.toString('base64');
    const ext = fileName.split('.').pop()?.toLowerCase() ?? '';

    const mediaType = this.resolveMediaType(ext);

    // 2. Build Claude message content
    const fileContent = mediaType === 'application/pdf'
      ? { type: 'document' as const, source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: base64 } }
      : { type: 'image' as const, source: { type: 'base64' as const, media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp', data: base64 } };

    const prompt = `Tu es un expert en assurance BTP français.
Analyse ce document d'assurance et extrait les informations suivantes en JSON strict.

Activités BTP à rechercher: ${BTP_ACTIVITIES.join(', ')}

Retourne UNIQUEMENT le JSON suivant (sans markdown, sans commentaire):
{
  "policy_number": "numéro de police ou null",
  "insurer": "nom de l'assureur ou null",
  "start_date": "YYYY-MM-DD ou null",
  "end_date": "YYYY-MM-DD ou null",
  "covered_activities": ["liste des activités BTP couvertes parmi la liste fournie"],
  "coverage_amounts": { "responsabilite_civile": montant_en_euros, "dommages_ouvrage": montant_en_euros },
  "garanties": ["liste des garanties mentionnées"],
  "exclusions": ["liste des exclusions importantes"],
  "confidence": 0.0_to_1.0
}

Si une information est absente, mettre null ou [].`;

    const response = await this.anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{ role: 'user', content: [fileContent, { type: 'text', text: prompt }] }],
    });

    // 3. Parse response
    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      return this.emptyResult(0.1);
    }

    try {
      const parsed = JSON.parse(jsonMatch[0]) as ParsedInsuranceData;
      return {
        policy_number: parsed.policy_number ?? null,
        insurer: parsed.insurer ?? null,
        start_date: parsed.start_date ?? null,
        end_date: parsed.end_date ?? null,
        covered_activities: Array.isArray(parsed.covered_activities) ? parsed.covered_activities : [],
        coverage_amounts: typeof parsed.coverage_amounts === 'object' ? parsed.coverage_amounts : {},
        garanties: Array.isArray(parsed.garanties) ? parsed.garanties : [],
        exclusions: Array.isArray(parsed.exclusions) ? parsed.exclusions : [],
        confidence: typeof parsed.confidence === 'number' ? Math.min(1, Math.max(0, parsed.confidence)) : 0.5,
      };
    } catch {
      return this.emptyResult(0.1);
    }
  }

  /**
   * Validate that an insurance document covers the project domains.
   * Does NOT call the API — uses already-parsed data.
   */
  validateCoverage(
    insurance: ParsedInsuranceData,
    projectDomains: string[]
  ): CoverageValidation {
    const uncoveredDomains = projectDomains.filter(
      d => !insurance.covered_activities.includes(d)
    );

    // Expiry alert
    let expiryAlert: string | null = null;
    if (insurance.end_date) {
      const days = (new Date(insurance.end_date).getTime() - Date.now()) / (86_400 * 1000);
      if (days < 0) expiryAlert = `Attestation expirée depuis ${Math.abs(Math.round(days))} jours`;
      else if (days < 30) expiryAlert = `Attestation expire dans ${Math.round(days)} jours`;
    } else {
      expiryAlert = 'Date d\'expiration inconnue';
    }

    // Exclusion alerts for project domains
    const exclusionAlerts = (insurance.exclusions ?? []).filter(ex =>
      projectDomains.some(d => ex.toLowerCase().includes(d))
    );

    return {
      is_covered: uncoveredDomains.length === 0 && !expiryAlert?.includes('expiré'),
      uncovered_domains: uncoveredDomains,
      expiry_alert: expiryAlert,
      exclusion_alerts: exclusionAlerts,
      confidence: insurance.confidence,
    };
  }

  /**
   * Build a list of human-readable alerts from parsed insurance data.
   * Used by OrchestratorService to notify clients.
   */
  buildAlerts(insurance: ParsedInsuranceData): string[] {
    const alerts: string[] = [];

    if (insurance.end_date) {
      const days = (new Date(insurance.end_date).getTime() - Date.now()) / (86_400 * 1000);
      if (days < 0) alerts.push(`Attestation expirée il y a ${Math.abs(Math.round(days))} jours`);
      else if (days < 60) alerts.push(`Attestation expire dans ${Math.round(days)} jours — renouvellement urgent`);
    }

    if (insurance.covered_activities.length === 0) {
      alerts.push('Aucune activité couverte détectée dans le document');
    }

    if (!insurance.policy_number) {
      alerts.push('Numéro de police non lisible — vérification manuelle requise');
    }

    return alerts;
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private async downloadFile(url: string): Promise<Buffer> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download insurance document: HTTP ${response.status}`);
    }
    return Buffer.from(await response.arrayBuffer());
  }

  private resolveMediaType(ext: string): string {
    const map: Record<string, string> = {
      pdf: 'application/pdf',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
    };
    const type = map[ext];
    if (!type) throw new Error(`Unsupported insurance document format: .${ext}`);
    return type;
  }

  private emptyResult(confidence: number): ParsedInsuranceData {
    return {
      policy_number: null,
      insurer: null,
      start_date: null,
      end_date: null,
      covered_activities: [],
      coverage_amounts: {},
      garanties: [],
      exclusions: [],
      confidence,
    };
  }
}
