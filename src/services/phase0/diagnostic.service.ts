/**
 * TORP Phase 0 - Service de Diagnostic
 * Module 0.3 : Gestion des diagnostics techniques du bâtiment
 */

import { supabase } from '@/lib/supabase';
import {
  visionService,
  type DiagnosticPhotoAnalysis,
  type BatchAnalysisResult,
} from '@/services/ai/vision.service';
import type {
  DiagnosticReport,
  DiagnosticUrgency,
  MandatoryDiagnosticsBundle,
  TechnicalDiagnosticsBundle,
  BuildingPathology,
  RiskMatrixEntry,
  DiagnosticRecommendation,
  ProjectImpactAssessment,
  DPEDiagnosticDetailed,
  AsbestosDiagnosticDetailed,
  LeadDiagnosticDetailed,
  ElectricityDiagnosticDetailed,
  GasDiagnosticDetailed,
  TermiteDiagnosticDetailed,
} from '@/types/phase0/diagnostic.types';
import type { Property } from '@/types/phase0/property.types';
import type { ConditionGrade } from '@/types/phase0/property.types';

// =============================================================================
// TYPES
// =============================================================================

export interface DiagnosticAnalysisResult {
  score: number;
  condition: ConditionGrade;
  urgency: DiagnosticUrgency;
  mandatoryCount: number;
  completedCount: number;
  expiredCount: number;
  missingCritical: string[];
  warnings: string[];
  recommendations: DiagnosticRecommendation[];
}

export interface DiagnosticRequirement {
  type: string;
  name: string;
  isMandatory: boolean;
  isRequired: boolean; // Required for this specific property/project
  reason: string;
  validityYears: number;
  estimatedCost: { min: number; max: number };
}

export interface DiagnosticImpact {
  lotType: string;
  severity: 'blocking' | 'major' | 'minor' | 'informational';
  description: string;
  additionalCost?: { min: number; max: number };
  additionalDuration?: number; // days
}

// =============================================================================
// SERVICE
// =============================================================================

export class DiagnosticService {
  /**
   * Analyzes all diagnostics for a project
   */
  static analyzeDiagnostics(
    mandatoryDiagnostics?: MandatoryDiagnosticsBundle,
    technicalDiagnostics?: TechnicalDiagnosticsBundle
  ): DiagnosticAnalysisResult {
    const warnings: string[] = [];
    const missingCritical: string[] = [];
    const recommendations: DiagnosticRecommendation[] = [];
    let score = 100;

    // Check mandatory diagnostics
    const mandatoryChecks = this.checkMandatoryDiagnostics(mandatoryDiagnostics);
    score -= mandatoryChecks.penalties;
    warnings.push(...mandatoryChecks.warnings);
    missingCritical.push(...mandatoryChecks.missing);
    recommendations.push(...mandatoryChecks.recommendations);

    // Check technical diagnostics
    const technicalChecks = this.checkTechnicalDiagnostics(technicalDiagnostics);
    score -= technicalChecks.penalties;
    warnings.push(...technicalChecks.warnings);
    recommendations.push(...technicalChecks.recommendations);

    // Determine urgency level
    const urgency = this.calculateUrgency(mandatoryDiagnostics, technicalDiagnostics, missingCritical);

    // Determine overall condition
    const condition = this.scoreToCondition(score);

    return {
      score: Math.max(0, score),
      condition,
      urgency,
      mandatoryCount: mandatoryChecks.total,
      completedCount: mandatoryChecks.completed,
      expiredCount: mandatoryChecks.expired,
      missingCritical,
      warnings,
      recommendations,
    };
  }

  /**
   * Determines which diagnostics are required for a property
   */
  static getRequiredDiagnostics(property: Partial<Property>): DiagnosticRequirement[] {
    const requirements: DiagnosticRequirement[] = [];
    const yearBuilt = property.construction?.yearBuilt || 2000;
    const isInCondo = property.condo?.isInCondo || false;
    const isForSale = true; // Assume for sale/rent context
    const hasGas = property.systems?.heating?.type === 'gas' ||
                   property.systems?.hotWater?.energy === 'gas';
    const surface = property.characteristics?.surfaces?.livingArea || 0;

    // DPE - Always mandatory for sale/rent
    requirements.push({
      type: 'dpe',
      name: 'Diagnostic de Performance Énergétique',
      isMandatory: true,
      isRequired: true,
      reason: 'Obligatoire pour toute vente ou location',
      validityYears: 10,
      estimatedCost: { min: 100, max: 250 },
    });

    // Amiante - Buildings before July 1997
    if (yearBuilt < 1997) {
      requirements.push({
        type: 'asbestos',
        name: 'Diagnostic Amiante',
        isMandatory: true,
        isRequired: true,
        reason: `Bâtiment construit avant 1997 (${yearBuilt})`,
        validityYears: -1, // Illimité si négatif
        estimatedCost: { min: 80, max: 150 },
      });
    }

    // Plomb - Buildings before January 1949
    if (yearBuilt < 1949) {
      requirements.push({
        type: 'lead',
        name: 'Diagnostic Plomb (CREP)',
        isMandatory: true,
        isRequired: true,
        reason: `Bâtiment construit avant 1949 (${yearBuilt})`,
        validityYears: 1, // 1 an si positif, illimité si négatif
        estimatedCost: { min: 100, max: 200 },
      });
    }

    // Électricité - Installations > 15 years
    const electricityAge = new Date().getFullYear() -
      (property.systems?.electrical?.installationYear || yearBuilt);
    if (electricityAge > 15) {
      requirements.push({
        type: 'electricity',
        name: 'Diagnostic Électricité',
        isMandatory: true,
        isRequired: true,
        reason: `Installation électrique de plus de 15 ans (${electricityAge} ans)`,
        validityYears: 3,
        estimatedCost: { min: 100, max: 150 },
      });
    }

    // Gaz - If gas installation > 15 years
    if (hasGas) {
      const gasAge = new Date().getFullYear() -
        (property.systems?.heating?.installationYear || yearBuilt);
      if (gasAge > 15) {
        requirements.push({
          type: 'gas',
          name: 'Diagnostic Gaz',
          isMandatory: true,
          isRequired: true,
          reason: `Installation gaz de plus de 15 ans (${gasAge} ans)`,
          validityYears: 3,
          estimatedCost: { min: 100, max: 150 },
        });
      }
    }

    // Termites - Zone declared
    if (property.risks?.naturalRisks?.termiteZone) {
      requirements.push({
        type: 'termites',
        name: 'État relatif aux termites',
        isMandatory: true,
        isRequired: true,
        reason: 'Zone déclarée à risque termites',
        validityYears: 0.5, // 6 mois
        estimatedCost: { min: 100, max: 180 },
      });
    }

    // ERP (État des Risques et Pollutions)
    requirements.push({
      type: 'erp',
      name: 'État des Risques et Pollutions',
      isMandatory: true,
      isRequired: true,
      reason: 'Obligatoire pour toute vente ou location',
      validityYears: 0.5, // 6 mois
      estimatedCost: { min: 0, max: 50 },
    });

    // Carrez - Copropriété
    if (isInCondo) {
      requirements.push({
        type: 'carrez',
        name: 'Mesurage Loi Carrez',
        isMandatory: true,
        isRequired: true,
        reason: 'Obligatoire pour les lots de copropriété',
        validityYears: -1, // Illimité
        estimatedCost: { min: 70, max: 150 },
      });
    }

    // Assainissement non collectif
    if (!property.systems?.sewage?.isCollective) {
      requirements.push({
        type: 'septicTank',
        name: 'Diagnostic Assainissement Non Collectif',
        isMandatory: true,
        isRequired: true,
        reason: 'Assainissement individuel',
        validityYears: 3,
        estimatedCost: { min: 100, max: 200 },
      });
    }

    // Technical diagnostics (recommended)
    // Étude de sol
    requirements.push({
      type: 'soilStudy',
      name: 'Étude de Sol (G1/G2)',
      isMandatory: false,
      isRequired: false,
      reason: 'Recommandé pour travaux de fondation ou extension',
      validityYears: 5,
      estimatedCost: { min: 800, max: 2500 },
    });

    // Étude structurelle
    if (yearBuilt < 1970 || property.currentCondition?.structural?.condition === 'poor') {
      requirements.push({
        type: 'structuralStudy',
        name: 'Diagnostic Structure',
        isMandatory: false,
        isRequired: true,
        reason: 'Recommandé pour bâtiments anciens ou avec signes de désordres',
        validityYears: 5,
        estimatedCost: { min: 500, max: 2000 },
      });
    }

    // Étude humidité
    requirements.push({
      type: 'moistureStudy',
      name: 'Diagnostic Humidité',
      isMandatory: false,
      isRequired: false,
      reason: 'Recommandé en cas de traces d\'humidité ou de sous-sol',
      validityYears: 2,
      estimatedCost: { min: 200, max: 500 },
    });

    return requirements;
  }

  /**
   * Calculates the impact of diagnostics on the project
   */
  static calculateProjectImpact(
    diagnostics: DiagnosticReport,
    selectedLots: string[]
  ): ProjectImpactAssessment {
    const impacts: DiagnosticImpact[] = [];
    let totalAdditionalCostMin = 0;
    let totalAdditionalCostMax = 0;
    let totalAdditionalDays = 0;
    const blockingIssues: string[] = [];

    // Check asbestos impact
    if (diagnostics.mandatoryDiagnostics?.asbestos) {
      const asbestos = diagnostics.mandatoryDiagnostics.asbestos;
      if (asbestos.presenceDetected && asbestos.materials && asbestos.materials.length > 0) {
        const asbestosImpact = this.calculateAsbestosImpact(asbestos, selectedLots);
        impacts.push(...asbestosImpact.impacts);
        totalAdditionalCostMin += asbestosImpact.costMin;
        totalAdditionalCostMax += asbestosImpact.costMax;
        totalAdditionalDays += asbestosImpact.days;
        if (asbestosImpact.isBlocking) {
          blockingIssues.push('Présence d\'amiante nécessitant désamiantage');
        }
      }
    }

    // Check lead impact
    if (diagnostics.mandatoryDiagnostics?.lead) {
      const lead = diagnostics.mandatoryDiagnostics.lead;
      if (lead.presenceDetected) {
        const leadImpact = this.calculateLeadImpact(lead, selectedLots);
        impacts.push(...leadImpact.impacts);
        totalAdditionalCostMin += leadImpact.costMin;
        totalAdditionalCostMax += leadImpact.costMax;
        totalAdditionalDays += leadImpact.days;
      }
    }

    // Check electrical impact
    if (diagnostics.mandatoryDiagnostics?.electricity) {
      const electricity = diagnostics.mandatoryDiagnostics.electricity;
      if (electricity.overallRating === 'non_conforme') {
        impacts.push({
          lotType: 'electricite',
          severity: 'major',
          description: 'Mise aux normes électriques obligatoire',
          additionalCost: { min: 3000, max: 15000 },
          additionalDuration: 5,
        });
        totalAdditionalCostMin += 3000;
        totalAdditionalCostMax += 15000;
        totalAdditionalDays += 5;
      }
    }

    // Check gas impact
    if (diagnostics.mandatoryDiagnostics?.gas) {
      const gas = diagnostics.mandatoryDiagnostics.gas;
      if (gas.immediateHazard) {
        blockingIssues.push('Danger immédiat gaz - intervention urgente requise');
        impacts.push({
          lotType: 'chauffage',
          severity: 'blocking',
          description: 'Mise en sécurité gaz urgente',
          additionalCost: { min: 500, max: 3000 },
          additionalDuration: 2,
        });
        totalAdditionalCostMin += 500;
        totalAdditionalCostMax += 3000;
        totalAdditionalDays += 2;
      }
    }

    // Check DPE impact
    if (diagnostics.mandatoryDiagnostics?.dpe) {
      const dpe = diagnostics.mandatoryDiagnostics.dpe;
      if (dpe.isEnergyPoor) {
        impacts.push({
          lotType: 'isolation_thermique',
          severity: 'major',
          description: `Passoire énergétique (classe ${dpe.energyClass}) - rénovation énergétique recommandée`,
          additionalCost: { min: 10000, max: 50000 },
          additionalDuration: 20,
        });
      }
    }

    // Check pathologies
    if (diagnostics.pathologies) {
      diagnostics.pathologies
        .filter(p => p.severity === 'critical' || p.severity === 'major')
        .forEach(pathology => {
          impacts.push({
            lotType: pathology.relatedLots?.[0] || 'general',
            severity: pathology.severity === 'critical' ? 'blocking' : 'major',
            description: pathology.title,
            additionalCost: pathology.repairCost,
            additionalDuration: pathology.repairDuration,
          });
          if (pathology.severity === 'critical') {
            blockingIssues.push(pathology.title);
          }
          totalAdditionalCostMin += pathology.repairCost?.min || 0;
          totalAdditionalCostMax += pathology.repairCost?.max || 0;
          totalAdditionalDays += pathology.repairDuration || 0;
        });
    }

    return {
      impacts,
      additionalBudget: {
        min: totalAdditionalCostMin,
        max: totalAdditionalCostMax,
      },
      additionalDuration: totalAdditionalDays,
      blockingIssues,
      canProceed: blockingIssues.length === 0,
      recommendations: this.generateImpactRecommendations(impacts, blockingIssues),
    };
  }

  /**
   * Creates a new diagnostic report
   */
  static async createDiagnosticReport(
    projectId: string,
    propertyId: string,
    mandatoryDiagnostics?: MandatoryDiagnosticsBundle,
    technicalDiagnostics?: TechnicalDiagnosticsBundle
  ): Promise<DiagnosticReport> {
    const analysis = this.analyzeDiagnostics(mandatoryDiagnostics, technicalDiagnostics);

    const report: Partial<DiagnosticReport> = {
      projectId,
      propertyId,
      overallScore: analysis.score,
      overallCondition: analysis.condition,
      urgencyLevel: analysis.urgency,
      mandatoryDiagnostics: mandatoryDiagnostics || {},
      technicalDiagnostics: technicalDiagnostics || {},
      pathologies: [],
      riskMatrix: [],
      recommendations: analysis.recommendations,
      documents: [],
      torpMetadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'system',
        version: 1,
        source: 'user_input',
        completeness: analysis.completedCount / Math.max(analysis.mandatoryCount, 1) * 100,
        aiEnriched: false,
      },
    };

    const { data, error } = await supabase
      .from('phase0_diagnostic_reports')
      .insert({
        project_id: projectId,
        property_id: propertyId,
        overall_score: report.overallScore,
        overall_condition: report.overallCondition,
        urgency_level: report.urgencyLevel,
        mandatory_diagnostics: report.mandatoryDiagnostics,
        technical_diagnostics: report.technicalDiagnostics,
        pathologies: report.pathologies,
        risk_matrix: report.riskMatrix,
        recommendations: report.recommendations,
        documents: report.documents,
        metadata: report.torpMetadata,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating diagnostic report:', error);
      throw new Error(`Erreur lors de la création du rapport de diagnostic: ${error.message}`);
    }

    return {
      ...report,
      id: data.id,
    } as DiagnosticReport;
  }

  /**
   * Updates a diagnostic report
   */
  static async updateDiagnosticReport(
    reportId: string,
    updates: Partial<DiagnosticReport>
  ): Promise<DiagnosticReport> {
    const analysis = this.analyzeDiagnostics(
      updates.mandatoryDiagnostics,
      updates.technicalDiagnostics
    );

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (updates.mandatoryDiagnostics) {
      updateData.mandatory_diagnostics = updates.mandatoryDiagnostics;
    }
    if (updates.technicalDiagnostics) {
      updateData.technical_diagnostics = updates.technicalDiagnostics;
    }
    if (updates.pathologies) {
      updateData.pathologies = updates.pathologies;
    }
    if (updates.photographicSurvey) {
      updateData.photographic_survey = updates.photographicSurvey;
    }

    // Recalculate scores
    updateData.overall_score = analysis.score;
    updateData.overall_condition = analysis.condition;
    updateData.urgency_level = analysis.urgency;
    updateData.recommendations = analysis.recommendations;

    const { data, error } = await supabase
      .from('phase0_diagnostic_reports')
      .update(updateData)
      .eq('id', reportId)
      .select()
      .single();

    if (error) {
      console.error('Error updating diagnostic report:', error);
      throw new Error(`Erreur lors de la mise à jour du rapport: ${error.message}`);
    }

    return this.mapRowToReport(data);
  }

  /**
   * Gets a diagnostic report by project ID
   */
  static async getReportByProjectId(projectId: string): Promise<DiagnosticReport | null> {
    const { data, error } = await supabase
      .from('phase0_diagnostic_reports')
      .select('*')
      .eq('project_id', projectId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      console.error('Error fetching diagnostic report:', error);
      throw new Error(`Erreur lors de la récupération du rapport: ${error.message}`);
    }

    return this.mapRowToReport(data);
  }

  // =============================================================================
  // PHOTO ANALYSIS METHODS (Computer Vision)
  // =============================================================================

  /**
   * Analyzes building photos using AI Vision to detect pathologies
   * Uses GPT-4 Vision via Edge Function
   */
  static async analyzePhotos(
    photoUrls: string[],
    buildingInfo?: { yearBuilt?: number; type?: string }
  ): Promise<DiagnosticPhotoAnalysis[]> {
    const results: DiagnosticPhotoAnalysis[] = [];

    for (const url of photoUrls) {
      try {
        const analysis = await visionService.analyzeDiagnosticPhoto(url, buildingInfo);
        results.push(analysis);
      } catch (error) {
        console.error(`Failed to analyze photo ${url}:`, error);
        // Continue with other photos
      }
    }

    return results;
  }

  /**
   * Analyzes multiple photos in batch with summary
   */
  static async analyzePhotosBatch(
    photos: Array<{ id: string; url: string }>,
    buildingInfo?: { yearBuilt?: number; type?: string }
  ): Promise<BatchAnalysisResult> {
    return visionService.analyzePhotosBatch(photos, 'diagnostic', buildingInfo);
  }

  /**
   * Converts photo analysis results to BuildingPathology format
   */
  static photoAnalysisToPathologies(
    photoAnalyses: DiagnosticPhotoAnalysis[]
  ): BuildingPathology[] {
    const pathologies: BuildingPathology[] = [];

    photoAnalyses.forEach((analysis, photoIndex) => {
      analysis.pathologies.forEach((pathology, pathologyIndex) => {
        pathologies.push({
          id: `photo_${photoIndex}_pathology_${pathologyIndex}`,
          title: pathology.type,
          description: pathology.description,
          severity: this.severityToGrade(pathology.severity),
          location: pathology.location,
          possibleCauses: pathology.possibleCauses,
          recommendations: pathology.recommendedActions,
          repairCost: pathology.estimatedRepairCost,
          detectedBy: 'ai_vision',
          detectedAt: analysis.analysisDate,
          relatedLots: this.pathologyToRelatedLots(pathology.type),
        });
      });
    });

    return pathologies;
  }

  /**
   * Updates diagnostic report with photo analysis results
   */
  static async updateReportWithPhotoAnalysis(
    reportId: string,
    photoAnalyses: DiagnosticPhotoAnalysis[]
  ): Promise<DiagnosticReport> {
    const pathologies = this.photoAnalysisToPathologies(photoAnalyses);

    // Calculate overall condition from photo analyses
    const conditionScores = { 'critique': 4, 'dégradé': 3, 'moyen': 2, 'bon': 1 };
    const avgScore = photoAnalyses.reduce(
      (sum, a) => sum + (conditionScores[a.overallCondition] || 0),
      0
    ) / photoAnalyses.length;

    const photographicSurvey = {
      photosAnalyzed: photoAnalyses.length,
      pathologiesDetected: pathologies.length,
      overallCondition: avgScore >= 3.5 ? 'critique' :
                        avgScore >= 2.5 ? 'dégradé' :
                        avgScore >= 1.5 ? 'moyen' : 'bon',
      urgentAttention: photoAnalyses.some(a => a.urgentAttention),
      totalEstimatedRepairCost: photoAnalyses.reduce((sum, a) => ({
        min: sum.min + (a.estimatedRepairCost?.min || 0),
        max: sum.max + (a.estimatedRepairCost?.max || 0),
      }), { min: 0, max: 0 }),
      analysisDate: new Date().toISOString(),
    };

    return this.updateDiagnosticReport(reportId, {
      pathologies,
      photographicSurvey,
    });
  }

  /**
   * Converts severity number (1-5) to ConditionGrade
   */
  private static severityToGrade(severity: number): 'critical' | 'major' | 'minor' | 'informational' {
    if (severity >= 5) return 'critical';
    if (severity >= 4) return 'critical';
    if (severity >= 3) return 'major';
    if (severity >= 2) return 'minor';
    return 'informational';
  }

  /**
   * Maps pathology type to related work lots
   */
  private static pathologyToRelatedLots(pathologyType: string): string[] {
    const mapping: Record<string, string[]> = {
      'fissure': ['gros_oeuvre', 'maconnerie', 'facades'],
      'humidité': ['etancheite', 'plomberie', 'drainage'],
      'moisissure': ['ventilation', 'isolation_thermique'],
      'décollement': ['peinture', 'revetements'],
      'efflorescence': ['maconnerie', 'facades'],
      'infiltration': ['couverture', 'etancheite', 'zinguerie'],
      'corrosion': ['charpente_metal', 'serrurerie'],
      'pourriture': ['charpente', 'menuiseries'],
      'termites': ['charpente', 'gros_oeuvre'],
      'amiante': ['demolition', 'desamiantage'],
      'plomb': ['peinture', 'plomberie'],
    };

    const lowerType = pathologyType.toLowerCase();
    for (const [key, lots] of Object.entries(mapping)) {
      if (lowerType.includes(key)) {
        return lots;
      }
    }
    return ['general'];
  }

  // =============================================================================
  // PRIVATE METHODS
  // =============================================================================

  private static checkMandatoryDiagnostics(diagnostics?: MandatoryDiagnosticsBundle): {
    total: number;
    completed: number;
    expired: number;
    penalties: number;
    missing: string[];
    warnings: string[];
    recommendations: DiagnosticRecommendation[];
  } {
    const result = {
      total: 8, // DPE, Amiante, Plomb, Électricité, Gaz, Termites, ERP, Carrez
      completed: 0,
      expired: 0,
      penalties: 0,
      missing: [] as string[],
      warnings: [] as string[],
      recommendations: [] as DiagnosticRecommendation[],
    };

    if (!diagnostics) {
      result.penalties = 40;
      result.missing.push('Aucun diagnostic fourni');
      return result;
    }

    const now = new Date();

    // Check DPE
    if (diagnostics.dpe) {
      result.completed++;
      if (new Date(diagnostics.dpe.expirationDate) < now) {
        result.expired++;
        result.warnings.push('DPE expiré');
        result.penalties += 5;
      }
      if (diagnostics.dpe.isEnergyPoor) {
        result.warnings.push(`Passoire énergétique (classe ${diagnostics.dpe.energyClass})`);
        result.recommendations.push({
          id: 'dpe_renovation',
          type: 'work',
          priority: 'high',
          title: 'Rénovation énergétique recommandée',
          description: 'Le bien est classé passoire énergétique. Une rénovation est fortement recommandée.',
          estimatedCost: { min: 15000, max: 50000 },
          relatedDiagnostic: 'dpe',
          relatedLots: ['isolation_thermique', 'chauffage', 'menuiseries_exterieures'],
        });
      }
    } else {
      result.missing.push('DPE');
      result.penalties += 10;
    }

    // Check Asbestos
    if (diagnostics.asbestos) {
      result.completed++;
      if (diagnostics.asbestos.presenceDetected) {
        result.warnings.push('Présence d\'amiante détectée');
        result.recommendations.push({
          id: 'asbestos_removal',
          type: 'work',
          priority: 'critical',
          title: 'Désamiantage potentiellement nécessaire',
          description: 'Des matériaux amiantés ont été détectés. Vérifier si travaux impactent ces zones.',
          relatedDiagnostic: 'asbestos',
          relatedLots: [],
        });
      }
    }

    // Check Lead
    if (diagnostics.lead) {
      result.completed++;
      if (diagnostics.lead.presenceDetected) {
        result.warnings.push('Présence de plomb détectée');
      }
    }

    // Check Electricity
    if (diagnostics.electricity) {
      result.completed++;
      if (diagnostics.electricity.overallRating === 'non_conforme') {
        result.warnings.push('Installation électrique non conforme');
        result.penalties += 5;
        result.recommendations.push({
          id: 'electrical_upgrade',
          type: 'work',
          priority: 'high',
          title: 'Mise aux normes électrique',
          description: 'L\'installation électrique présente des non-conformités à corriger.',
          estimatedCost: { min: 3000, max: 15000 },
          relatedDiagnostic: 'electricity',
          relatedLots: ['electricite'],
        });
      }
    }

    // Check Gas
    if (diagnostics.gas) {
      result.completed++;
      if (diagnostics.gas.immediateHazard) {
        result.warnings.push('⚠️ DANGER GAZ IMMÉDIAT');
        result.penalties += 20;
      } else if (diagnostics.gas.hazardType === 'type_a2') {
        result.warnings.push('Anomalie gaz à corriger');
        result.penalties += 5;
      }
    }

    // Check Termites
    if (diagnostics.termites) {
      result.completed++;
      if (diagnostics.termites.presenceDetected) {
        result.warnings.push('Présence de termites détectée');
        result.penalties += 10;
        result.recommendations.push({
          id: 'termite_treatment',
          type: 'work',
          priority: 'critical',
          title: 'Traitement anti-termites urgent',
          description: 'Une infestation de termites a été détectée. Traitement urgent recommandé.',
          estimatedCost: { min: 2000, max: 10000 },
          relatedDiagnostic: 'termites',
          relatedLots: ['charpente', 'gros_oeuvre'],
        });
      }
    }

    // Check ERP
    if (diagnostics.erp) {
      result.completed++;
    }

    // Check Carrez
    if (diagnostics.carrez) {
      result.completed++;
    }

    return result;
  }

  private static checkTechnicalDiagnostics(diagnostics?: TechnicalDiagnosticsBundle): {
    penalties: number;
    warnings: string[];
    recommendations: DiagnosticRecommendation[];
  } {
    const result = {
      penalties: 0,
      warnings: [] as string[],
      recommendations: [] as DiagnosticRecommendation[],
    };

    if (!diagnostics) {
      return result;
    }

    // Check soil study
    if (diagnostics.soilStudy) {
      if (diagnostics.soilStudy.classification === 'clay_high' ||
          diagnostics.soilStudy.classification === 'unstable') {
        result.warnings.push('Sol à risque - précautions nécessaires');
        result.recommendations.push({
          id: 'soil_precautions',
          type: 'study',
          priority: 'high',
          title: 'Étude géotechnique complémentaire',
          description: 'Le sol présente des risques. Étude G2 recommandée avant travaux de fondation.',
          estimatedCost: { min: 1500, max: 3000 },
          relatedDiagnostic: 'soilStudy',
          relatedLots: ['fondations', 'gros_oeuvre'],
        });
      }
    }

    // Check structural study
    if (diagnostics.structuralStudy) {
      const criticalIssues = diagnostics.structuralStudy.issues?.filter(
        i => i.severity === 'critical'
      ) || [];
      if (criticalIssues.length > 0) {
        result.warnings.push(`${criticalIssues.length} problème(s) structurel(s) critique(s)`);
        result.penalties += 15;
      }
    }

    // Check moisture study
    if (diagnostics.moistureStudy) {
      if (diagnostics.moistureStudy.humidityLevel === 'severe') {
        result.warnings.push('Problème d\'humidité sévère');
        result.recommendations.push({
          id: 'moisture_treatment',
          type: 'work',
          priority: 'high',
          title: 'Traitement de l\'humidité',
          description: 'Un problème d\'humidité sévère a été identifié. Traitement nécessaire.',
          estimatedCost: { min: 3000, max: 15000 },
          relatedDiagnostic: 'moistureStudy',
          relatedLots: ['maconnerie', 'etancheite'],
        });
      }
    }

    return result;
  }

  private static calculateUrgency(
    mandatory?: MandatoryDiagnosticsBundle,
    technical?: TechnicalDiagnosticsBundle,
    missingCritical?: string[]
  ): DiagnosticUrgency {
    // Critical if gas danger or termites
    if (mandatory?.gas?.immediateHazard) return 'critical';
    if (mandatory?.termites?.presenceDetected) return 'critical';

    // High if major structural issues or severe moisture
    if (technical?.structuralStudy?.issues?.some(i => i.severity === 'critical')) return 'high';
    if (technical?.moistureStudy?.humidityLevel === 'severe') return 'high';

    // High if missing critical diagnostics
    if (missingCritical && missingCritical.length > 2) return 'high';

    // Medium if non-compliant electrical or asbestos
    if (mandatory?.electricity?.overallRating === 'non_conforme') return 'medium';
    if (mandatory?.asbestos?.presenceDetected) return 'medium';

    // Low if energy poor building
    if (mandatory?.dpe?.isEnergyPoor) return 'low';

    return 'informational';
  }

  private static scoreToCondition(score: number): ConditionGrade {
    if (score >= 90) return 'excellent';
    if (score >= 75) return 'good';
    if (score >= 50) return 'fair';
    if (score >= 25) return 'poor';
    return 'critical';
  }

  private static calculateAsbestosImpact(
    asbestos: AsbestosDiagnosticDetailed,
    selectedLots: string[]
  ): {
    impacts: DiagnosticImpact[];
    costMin: number;
    costMax: number;
    days: number;
    isBlocking: boolean;
  } {
    const impacts: DiagnosticImpact[] = [];
    let costMin = 0;
    let costMax = 0;
    let days = 0;
    let isBlocking = false;

    if (!asbestos.materials) {
      return { impacts, costMin, costMax, days, isBlocking };
    }

    // Map asbestos locations to lots
    const asbestosLotMapping: Record<string, string[]> = {
      'flocage': ['demolition', 'cloisons_doublages'],
      'calorifugeage': ['plomberie', 'chauffage'],
      'faux_plafond': ['plafonds', 'electricite'],
      'dalles_sol': ['carrelage_faience', 'parquet_sols_souples'],
      'toiture': ['couverture', 'etancheite'],
      'conduit': ['chauffage', 'ventilation'],
    };

    asbestos.materials.forEach(material => {
      const affectedLots = asbestosLotMapping[material.type] || [];
      const isAffected = affectedLots.some(lot => selectedLots.includes(lot));

      if (isAffected) {
        const cost = material.removalCost || { min: 2000, max: 10000 };
        impacts.push({
          lotType: affectedLots[0],
          severity: material.condition === 'degraded' ? 'blocking' : 'major',
          description: `Amiante ${material.type} - ${material.condition === 'degraded' ? 'désamiantage obligatoire' : 'précautions requises'}`,
          additionalCost: cost,
          additionalDuration: material.condition === 'degraded' ? 10 : 3,
        });
        costMin += cost.min;
        costMax += cost.max;
        days += material.condition === 'degraded' ? 10 : 3;
        if (material.condition === 'degraded') {
          isBlocking = true;
        }
      }
    });

    return { impacts, costMin, costMax, days, isBlocking };
  }

  private static calculateLeadImpact(
    lead: LeadDiagnosticDetailed,
    selectedLots: string[]
  ): {
    impacts: DiagnosticImpact[];
    costMin: number;
    costMax: number;
    days: number;
  } {
    const impacts: DiagnosticImpact[] = [];
    let costMin = 0;
    let costMax = 0;
    let days = 0;

    const paintLots = ['peinture', 'menuiseries_interieures', 'menuiseries_exterieures'];
    const affectsSelectedLots = paintLots.some(lot => selectedLots.includes(lot));

    if (affectsSelectedLots && lead.presenceDetected) {
      impacts.push({
        lotType: 'peinture',
        severity: 'major',
        description: 'Présence de plomb - précautions et traitement des surfaces',
        additionalCost: { min: 1500, max: 5000 },
        additionalDuration: 3,
      });
      costMin += 1500;
      costMax += 5000;
      days += 3;
    }

    return { impacts, costMin, costMax, days };
  }

  private static generateImpactRecommendations(
    impacts: DiagnosticImpact[],
    blockingIssues: string[]
  ): string[] {
    const recommendations: string[] = [];

    if (blockingIssues.length > 0) {
      recommendations.push('Résoudre les problèmes bloquants avant de commencer les travaux');
    }

    const majorImpacts = impacts.filter(i => i.severity === 'major');
    if (majorImpacts.length > 0) {
      recommendations.push(`Prévoir un budget supplémentaire pour ${majorImpacts.length} intervention(s) majeure(s)`);
    }

    return recommendations;
  }

  private static mapRowToReport(row: Record<string, unknown>): DiagnosticReport {
    return {
      id: row.id as string,
      projectId: row.project_id as string,
      propertyId: row.property_id as string,
      overallScore: row.overall_score as number,
      overallCondition: row.overall_condition as ConditionGrade,
      urgencyLevel: row.urgency_level as DiagnosticUrgency,
      mandatoryDiagnostics: row.mandatory_diagnostics as MandatoryDiagnosticsBundle,
      technicalDiagnostics: row.technical_diagnostics as TechnicalDiagnosticsBundle,
      photographicSurvey: row.photographic_survey as DiagnosticReport['photographicSurvey'],
      pathologies: row.pathologies as BuildingPathology[],
      riskMatrix: row.risk_matrix as RiskMatrixEntry[],
      recommendations: row.recommendations as DiagnosticRecommendation[],
      projectImpact: row.project_impact as ProjectImpactAssessment,
      documents: row.documents as DiagnosticReport['documents'],
      torpMetadata: row.metadata as DiagnosticReport['torpMetadata'],
    };
  }
}

export default DiagnosticService;
