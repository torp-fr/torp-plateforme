// ─────────────────────────────────────────────────────────────────────────────
// DependencyValidator — Pre-flight checks before running a pipeline
// Prevents running expensive pipelines on missing/invalid dependencies.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export class DependencyValidator {
  private supabase: SupabaseClient;

  constructor(supabase?: SupabaseClient) {
    this.supabase = supabase ?? createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }

  /** Check that a client row exists in the DB. */
  async validateClientExists(clientId: string): Promise<void> {
    const { data, error } = await this.supabase
      .from('clients')
      .select('id')
      .eq('id', clientId)
      .maybeSingle();

    if (error) throw new Error(`DB error validating client ${clientId}: ${error.message}`);
    if (!data) throw new Error(`Client not found: ${clientId}`);
  }

  /** Check that a project row exists in the DB. */
  async validateProjectExists(projectId: string): Promise<void> {
    const { data, error } = await this.supabase
      .from('projets')
      .select('id')
      .eq('id', projectId)
      .maybeSingle();

    if (error) throw new Error(`DB error validating project ${projectId}: ${error.message}`);
    if (!data) throw new Error(`Project not found: ${projectId}`);
  }

  /** Check that a devis row exists and is in the expected state. */
  async validateDevisReady(devisId: string): Promise<void> {
    const { data, error } = await this.supabase
      .from('devis')
      .select('id, file_path')
      .eq('id', devisId)
      .maybeSingle();

    if (error) throw new Error(`DB error validating devis ${devisId}: ${error.message}`);
    if (!data) throw new Error(`Devis not found: ${devisId}`);
    if (!data.file_path) throw new Error(`Devis ${devisId} has no file_path — cannot parse`);
  }

  /** Full validation for a devis analysis job. Returns a ValidationResult (non-throwing). */
  async validateDevisAnalysisDependencies(devisId: string): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    const { data: devis } = await this.supabase
      .from('devis')
      .select('id, projet_id, entreprise_id, file_path')
      .eq('id', devisId)
      .maybeSingle();

    if (!devis) {
      errors.push(`Devis not found: ${devisId}`);
      return { valid: false, errors, warnings };
    }

    if (!devis.file_path) errors.push('Missing file_path — document not uploaded');
    if (!devis.projet_id) warnings.push('Devis has no linked project — domain inference may be incomplete');
    if (!devis.entreprise_id) warnings.push('Devis has no linked enterprise — enrichment skipped');

    // Check project if linked
    if (devis.projet_id) {
      const { data: projet } = await this.supabase
        .from('projets')
        .select('id, type, localisation')
        .eq('id', devis.projet_id)
        .maybeSingle();

      if (!projet) {
        warnings.push(`Linked project ${devis.projet_id} not found`);
      } else if (!projet.localisation) {
        warnings.push('Project has no localisation — regional risk skipped');
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  /** Full validation for a project creation event. */
  async validateProjectDependencies(projectId: string): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    const { data: projet } = await this.supabase
      .from('projets')
      .select('id, client_id, type, localisation')
      .eq('id', projectId)
      .maybeSingle();

    if (!projet) {
      errors.push(`Project not found: ${projectId}`);
      return { valid: false, errors, warnings };
    }

    if (!projet.client_id) errors.push('Project has no client_id');
    if (!projet.type) errors.push('Project type is missing');
    if (!projet.localisation) warnings.push('Project has no localisation — risk profiling skipped');

    // Validate the client is real
    if (projet.client_id) {
      const { data: client } = await this.supabase
        .from('clients')
        .select('id')
        .eq('id', projet.client_id)
        .maybeSingle();

      if (!client) errors.push(`Client ${projet.client_id} not found`);
    }

    return { valid: errors.length === 0, errors, warnings };
  }
}
