// ─────────────────────────────────────────────────────────────────────────────
// OrchestratorService — maestro of all pipelines + learning + certification
// Extends PipelineOrchestrator with: Learning, Insurance, Benchmarking, Risk, Cert
// ─────────────────────────────────────────────────────────────────────────────

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { EventBus, eventBus as globalEventBus } from '../events/EventBus.js';
import { DependencyValidator } from './DependencyValidator.js';
import { PipelineOrchestrator } from './PipelineOrchestrator.js';
import { CompanyMemory } from '../learning/CompanyMemory.js';
import { InsuranceValidator } from '../insurance/InsuranceValidator.js';
import { BenchmarkEngine } from '../benchmarking/BenchmarkEngine.js';
import { RegionalRiskProfiler } from '../risk/RegionalRiskProfiler.js';
import { CertificationScorer } from '../certification/CertificationScorer.js';
import { GeorisquesService } from '../../services/external/georisques.service.js';
import { MesAidesRenovService, type SimulationInput } from '../../services/external/mesaidesrenov.service.js';
import { RGEProfessionalsService } from '../../services/external/rge-professionals.service.js';

// ── Types (re-exported for consumers) ────────────────────────────────────────

export interface OrchestratorConfig {
  /** Override the global eventBus with an isolated instance (useful for tests). */
  eventBus?: EventBus;
  /** Override the Supabase client. */
  supabase?: SupabaseClient;
  /** Health-check interval in ms. Default: 5 minutes. */
  healthCheckIntervalMs?: number;
}

// ── OrchestratorService ───────────────────────────────────────────────────────

export class OrchestratorService {
  private readonly supabase: SupabaseClient;
  private readonly bus: EventBus;
  private readonly validator: DependencyValidator;
  private readonly orchestrator: PipelineOrchestrator;
  private readonly companyMemory: CompanyMemory;
  private readonly insuranceValidator: InsuranceValidator;
  private readonly benchmark: BenchmarkEngine;
  private readonly riskProfiler: RegionalRiskProfiler;
  private readonly certScorer: CertificationScorer;
  private readonly georisques: GeorisquesService;
  private readonly mesAides: MesAidesRenovService;
  private readonly rgePros: RGEProfessionalsService;
  private healthInterval?: ReturnType<typeof setInterval>;

  constructor(config: OrchestratorConfig = {}) {
    this.supabase = config.supabase ?? createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    this.bus = config.eventBus ?? globalEventBus;
    this.validator = new DependencyValidator(this.supabase);
    this.orchestrator = new PipelineOrchestrator(this.supabase);
    this.companyMemory = new CompanyMemory(this.supabase);
    this.insuranceValidator = new InsuranceValidator(this.supabase);
    this.benchmark = new BenchmarkEngine(this.supabase);
    this.riskProfiler = new RegionalRiskProfiler(this.supabase);
    this.certScorer = new CertificationScorer(this.supabase);
    this.georisques = new GeorisquesService();
    this.mesAides   = new MesAidesRenovService();
    this.rgePros    = new RGEProfessionalsService();
  }

  /**
   * Bootstrap: warm up company memory + register all event handlers.
   * Call once at server startup.
   */
  async bootstrap(): Promise<void> {
    console.log('[OrchestratorService] Bootstrapping…');
    await this.companyMemory.initialize();
    this.registerEventHandlers();

    const intervalMs = 5 * 60 * 1000;
    this.healthInterval = setInterval(() => {
      this.healthCheck().catch(err =>
        console.warn('[OrchestratorService] Health check error:', (err as Error).message)
      );
    }, intervalMs);

    console.log('[OrchestratorService] Ready');
  }

  /** Stop background tasks (cleanup for tests / graceful shutdown). */
  shutdown(): void {
    if (this.healthInterval) clearInterval(this.healthInterval);
  }

  // ── FLOW 1: Client enrichment ─────────────────────────────────────────────

  async handleClientCreated(payload: {
    clientId: string;
    email: string;
    nom: string;
    prenom: string;
    telephone?: string;
    adresse?: string;
    siret?: string;
  }): Promise<void> {
    const { clientId, siret, adresse } = payload;

    try {
      // 1. Localization pipeline (existing)
      if (adresse) {
        await this.orchestrator.onClientCreated(clientId, adresse);
      }

      // 2. Enterprise enrichment (existing)
      if (siret) {
        await this.orchestrator.onEntrepriseRegistered(siret, clientId);
        await this.companyMemory.createCompanyProfile(siret, {
          raison_sociale: `${payload.prenom} ${payload.nom}`,
          region: null,
          secteur: null,
        });
      }

      await this.bus.emit('client:enriched', { clientId, quality_score: undefined });
    } catch (err) {
      const error = (err as Error).message;
      console.error(`[Orchestrator] Client enrichment failed: ${error}`);
      await this.bus.emit('client:enrichment_failed', { clientId, error });
    }
  }

  // ── FLOW 2: Project enrichment ────────────────────────────────────────────

  async handleProjectCreated(payload: {
    projectId: string;
    clientId: string;
    type: string;
    adresse: string;
  }): Promise<void> {
    const { projectId, clientId, type, adresse } = payload;

    try {
      await this.validator.validateClientExists(clientId);

      // Geocode to get lat/lng for existing ContextRegulation pipeline
      const coords = await this.riskProfiler.geocodeAddress(adresse);

      // 1. Regulatory context (existing pipeline)
      await this.orchestrator.onProjectCreated(
        projectId,
        type as import('../pipelines/types/index.js').ProjectType,
        coords.lat,
        coords.lon
      );

      // 2. Regional risk assessment (new)
      const domains = this.inferDomainsFromProjectType(type);
      const risks = await this.riskProfiler.assessProject(adresse, domains);

      await this.supabase
        .from('projets')
        .update({ regional_risks: risks })
        .eq('id', projectId);

      await this.bus.emit('project:enriched', { projectId, domains, risks });
    } catch (err) {
      const error = (err as Error).message;
      console.error(`[Orchestrator] Project enrichment failed: ${error}`);
      await this.bus.emit('project:enrichment_failed', { projectId, error });
    }
  }

  // ── FLOW 3: Devis full analysis ───────────────────────────────────────────

  async handleDevisUploaded(payload: {
    devisId: string;
    projectId: string;
    clientId: string;
    fileUrl: string;
    fileName: string;
  }): Promise<void> {
    const { devisId, projectId, clientId, fileName } = payload;

    try {
      // 1. Pre-flight validation
      const validation = await this.validator.validateDevisAnalysisDependencies(devisId);
      if (!validation.valid) {
        throw new Error(`Dependency check failed: ${validation.errors.join('; ')}`);
      }

      // 2. Parse + score via existing pipeline
      await this.orchestrator.onDevisUploaded(
        devisId,
        payload.fileUrl,
        fileName.split('.').pop()?.toLowerCase() ?? 'pdf'
      );

      // 3. Fetch parsed data for enrichment steps
      const { data: devisRow } = await this.supabase
        .from('devis')
        .select('parsing_result, montant_ht')
        .eq('id', devisId)
        .maybeSingle();

      const devisData = (devisRow?.parsing_result as Record<string, unknown>) ?? {};
      const qualityScore = typeof devisData.quality_score === 'number' ? devisData.quality_score : 50;
      const conformityScore = typeof devisData.conformity_score === 'number' ? devisData.conformity_score : 50;

      // 4. Benchmarking
      const { data: projectRow } = await this.supabase
        .from('projets')
        .select('type, region, localisation')
        .eq('id', projectId)
        .maybeSingle();

      const benchmarkResult = await this.benchmark.compareQuote(
        { montant_ht: devisRow?.montant_ht ?? undefined },
        { type: projectRow?.type, region: projectRow?.region }
      );

      // 5. Insurance validation
      const { data: clientRow } = await this.supabase
        .from('clients')
        .select('siret')
        .eq('id', clientId)
        .maybeSingle();

      const insuranceProfile = clientRow?.siret
        ? await this.companyMemory.getInsuranceProfile(clientRow.siret)
        : null;

      const domains = Array.isArray(devisData.inferred_domains)
        ? (devisData.inferred_domains as string[])
        : [];

      const insuranceCoverage = insuranceProfile
        ? this.insuranceValidator.validateCoverage(
            {
              policy_number: insuranceProfile.policy_number,
              insurer: insuranceProfile.insurer,
              start_date: insuranceProfile.start_date,
              end_date: insuranceProfile.end_date,
              covered_activities: insuranceProfile.covered_activities,
              coverage_amounts: insuranceProfile.coverage_amounts,
              garanties: insuranceProfile.garanties,
              exclusions: [],
              confidence: 0.9,
            },
            domains
          )
        : { is_covered: false, uncovered_domains: [], expiry_alert: null, exclusion_alerts: [], confidence: 0 };

      // 6. Certification scoring
      const certScore = this.certScorer.scoreDevis({
        devisQuality: qualityScore,
        conformity: conformityScore,
        insuranceCoverage: insuranceCoverage.is_covered ? 10 : 0,
        benchmarkPosition: benchmarkResult.percentile ?? 50,
      });

      // 7. Persist analysis enrichments
      await this.supabase
        .from('devis')
        .update({
          benchmark_analysis: benchmarkResult,
          insurance_validation: insuranceCoverage,
          certification_score: certScore,
          analyzed_at: new Date().toISOString(),
        })
        .eq('id', devisId);

      // 8. Learning: update company memory
      if (clientRow?.siret) {
        await this.companyMemory.learnFromDevis(clientRow.siret, {
          items: Array.isArray(devisData.items) ? (devisData.items as Array<{ description?: string; unit?: string; unit_price?: number }>) : [],
          montant_ht: typeof devisData.montant_ht === 'number' ? devisData.montant_ht : undefined,
          montant_ttc: typeof devisData.montant_ttc === 'number' ? devisData.montant_ttc : undefined,
          montant_tva: typeof devisData.montant_tva === 'number' ? devisData.montant_tva : undefined,
        });
      }

      await this.bus.emit('devis:analyzed', {
        devisId,
        quality_score: qualityScore,
        certification_score: certScore,
        benchmark_position: benchmarkResult.percentile,
        insurance_covered: insuranceCoverage.is_covered,
      });
    } catch (err) {
      const error = (err as Error).message;
      console.error(`[Orchestrator] Devis analysis failed: ${error}`);
      await this.bus.emit('devis:analysis_failed', { devisId, error });
    }
  }

  // ── FLOW 4: Insurance validation ──────────────────────────────────────────

  async handleInsuranceUploaded(payload: {
    clientId: string;
    fileUrl: string;
    fileName: string;
  }): Promise<void> {
    const { clientId, fileUrl, fileName } = payload;

    try {
      // 1. Parse insurance document via Claude OCR
      const parsed = await this.insuranceValidator.parseDocument(fileUrl, fileName);

      // 2. Alerts
      const alerts = this.insuranceValidator.buildAlerts(parsed);

      // 3. Get client's SIRET
      const { data: clientRow } = await this.supabase
        .from('clients')
        .select('siret')
        .eq('id', clientId)
        .maybeSingle();

      // 4. Store in company memory
      if (clientRow?.siret) {
        await this.companyMemory.updateInsuranceProfile(clientRow.siret, {
          policy_number: parsed.policy_number,
          insurer: parsed.insurer,
          start_date: parsed.start_date,
          end_date: parsed.end_date,
          covered_activities: parsed.covered_activities,
          coverage_amounts: parsed.coverage_amounts,
          garanties: parsed.garanties,
        });
      }

      await this.bus.emit('insurance:validated', {
        clientId,
        covered_activities: parsed.covered_activities,
        expiration_date: parsed.end_date,
        alerts,
      });
    } catch (err) {
      const error = (err as Error).message;
      console.error(`[Orchestrator] Insurance validation failed: ${error}`);
      await this.bus.emit('insurance:validation_failed', { clientId, error });
    }
  }

  // ── Background health check ───────────────────────────────────────────────

  async healthCheck(): Promise<void> {
    const { data } = await this.supabase
      .from('analysis_jobs')
      .select('id')
      .eq('status', 'failed')
      .gt('created_at', new Date(Date.now() - 3_600_000).toISOString())
      .limit(1)
      .catch(() => ({ data: null }));

    if (data && data.length > 0) {
      await this.bus.emit('system:pipeline_error', { failed_jobs_count: data.length });
    } else {
      await this.bus.emit('system:health_ok', { checked_at: new Date().toISOString() });
    }
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private registerEventHandlers(): void {
    this.bus.on('client:created',      e => this.handleClientCreated(e.payload));
    this.bus.on('project:created',     e => this.handleProjectCreated(e.payload));
    this.bus.on('devis:uploaded',      e => this.handleDevisUploaded(e.payload));
    this.bus.on('insurance:uploaded',  e => this.handleInsuranceUploaded(e.payload));
  }

  /**
   * Enrich a renovation project with natural hazard risks, financial aids simulation,
   * and nearby RGE-certified professionals.
   * Results are persisted to the `projets` table and emitted on the event bus.
   */
  async enrichProjectWithAidsAndRisks(payload: {
    projectId:          string;
    lat:                number;
    lng:                number;
    code_postal:        string;
    revenue_fiscal_ref: number | null;
    nb_personnes_foyer: number;
    work_types:         SimulationInput['work_types'];
    cout_travaux:       number | null;
    annee_construction: number | null;
    est_proprietaire:   boolean;
  }): Promise<void> {
    const { projectId, lat, lng, code_postal } = payload;

    try {
      // Run all three enrichments in parallel for performance
      const [riskReport, rgeSearch, aidsResult] = await Promise.allSettled([
        this.georisques.getRiskReport(lat, lng),
        this.rgePros.searchNearLocation(lat, lng, 30, 10),
        Promise.resolve(this.mesAides.simulate({
          code_postal,
          revenue_fiscal_ref: payload.revenue_fiscal_ref,
          nb_personnes_foyer: payload.nb_personnes_foyer,
          work_types:         payload.work_types,
          cout_travaux:       payload.cout_travaux,
          annee_construction: payload.annee_construction,
          est_proprietaire:   payload.est_proprietaire,
        })),
      ]);

      const enrichment = {
        risk_report:   riskReport.status  === 'fulfilled' ? riskReport.value  : null,
        rge_nearby:    rgeSearch.status   === 'fulfilled' ? rgeSearch.value   : null,
        aids_simulation: aidsResult.status === 'fulfilled' ? aidsResult.value : null,
        enriched_at:   new Date().toISOString(),
      };

      await this.supabase
        .from('projets')
        .update({ enrichment_data: enrichment })
        .eq('id', projectId);

      await this.bus.emit('project:aids_risks_enriched', {
        projectId,
        has_risk_data:    enrichment.risk_report    !== null,
        has_aids_data:    enrichment.aids_simulation !== null,
        has_rge_data:     enrichment.rge_nearby      !== null,
      });
    } catch (err) {
      const error = (err as Error).message;
      console.error(`[Orchestrator] Aids+risks enrichment failed: ${error}`);
      await this.bus.emit('project:aids_risks_failed', { projectId, error });
    }
  }

  private inferDomainsFromProjectType(type: string): string[] {
    const map: Record<string, string[]> = {
      piscine:            ['hydraulique', 'électrique', 'structure'],
      renovation:         ['structure', 'thermique', 'électrique', 'finitions'],
      extension:          ['structure', 'enveloppe', 'thermique'],
      construction_neuve: ['structure', 'enveloppe', 'thermique', 'électrique', 'hydraulique'],
      maison_neuve:       ['structure', 'enveloppe', 'thermique', 'électrique', 'hydraulique'],
      toiture:            ['couverture', 'structure'],
      electricite_seule:  ['électrique'],
      plomberie_seule:    ['hydraulique'],
      isolation:          ['thermique', 'enveloppe'],
      chauffage:          ['thermique', 'hydraulique'],
      fenetre:            ['enveloppe'],
      cuisine:            ['finitions', 'hydraulique', 'électrique'],
      salle_de_bain:      ['finitions', 'hydraulique', 'électrique'],
    };
    return map[type] ?? ['divers'];
  }
}
