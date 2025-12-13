/**
 * TORP Phase 0 - Service de Faisabilité
 * Module 0.4 : Analyse de faisabilité technique et réglementaire
 */

import { supabase } from '@/lib/supabase';
import type {
  FeasibilityReport,
  FeasibilityStatus,
  PLUAnalysis,
  PLURules,
  UrbanPermitsAnalysis,
  PermitType,
  HeritageAnalysis,
  ABFConsultation,
  CondoConstraintsAnalysis,
  TechnicalStandardsAnalysis,
  DTURequirement,
  FeasibilityCheckResult,
  FeasibilityIssue,
  FeasibilityRecommendation,
} from '@/types/phase0/feasibility.types';
import type { Property } from '@/types/phase0/property.types';
import type { WorkProject } from '@/types/phase0/work-project.types';
import type { SelectedLot } from '@/types/phase0/lots.types';
import type { Priority } from '@/types/phase0/common.types';

// =============================================================================
// TYPES
// =============================================================================

export interface FeasibilityAnalysisInput {
  property: Partial<Property>;
  workProject: Partial<WorkProject>;
  selectedLots: SelectedLot[];
  propertyAddress?: {
    postalCode: string;
    city: string;
    department?: string;
  };
}

export interface PermitDetermination {
  requiredPermit: PermitType;
  reason: string;
  estimatedDuration: number; // months
  estimatedCost: { min: number; max: number };
  requiredDocuments: string[];
  additionalConstraints: string[];
}

export interface DTUAnalysis {
  applicableDTUs: DTURequirement[];
  keyRequirements: string[];
  complianceRisks: string[];
}

export interface FeasibilityScore {
  overall: number; // 0-100
  regulatory: number;
  technical: number;
  financial: number;
  timing: number;
}

// =============================================================================
// SERVICE
// =============================================================================

export class FeasibilityService {
  /**
   * Performs a complete feasibility analysis
   */
  static async analyzeFeasibility(
    input: FeasibilityAnalysisInput
  ): Promise<FeasibilityReport> {
    const { property, workProject, selectedLots } = input;

    // Run all analyses in parallel
    const [
      pluAnalysis,
      permitsAnalysis,
      heritageAnalysis,
      condoAnalysis,
      technicalAnalysis,
    ] = await Promise.all([
      this.analyzePLU(property, workProject),
      this.analyzePermitRequirements(property, workProject, selectedLots),
      this.analyzeHeritageConstraints(property),
      this.analyzeCondoConstraints(property, selectedLots),
      this.analyzeTechnicalStandards(property, selectedLots),
    ]);

    // Collect all issues and recommendations
    const allIssues = [
      ...pluAnalysis.issues,
      ...permitsAnalysis.issues,
      ...heritageAnalysis.issues,
      ...condoAnalysis.issues,
      ...technicalAnalysis.issues,
    ];

    const allRecommendations = [
      ...pluAnalysis.recommendations,
      ...permitsAnalysis.recommendations,
      ...heritageAnalysis.recommendations,
      ...condoAnalysis.recommendations,
      ...technicalAnalysis.recommendations,
    ];

    // Calculate overall feasibility status
    const status = this.calculateOverallStatus(allIssues);
    const score = this.calculateFeasibilityScore(
      pluAnalysis,
      permitsAnalysis,
      heritageAnalysis,
      condoAnalysis,
      technicalAnalysis
    );

    return {
      id: crypto.randomUUID(),
      projectId: '', // Will be set when saving
      status,
      score,
      pluAnalysis,
      permitsAnalysis,
      heritageAnalysis,
      condoConstraints: condoAnalysis,
      technicalStandards: technicalAnalysis,
      issues: allIssues,
      recommendations: allRecommendations,
      validatedAt: undefined,
      validatedBy: undefined,
      torpMetadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'system',
        version: 1,
        source: 'analysis',
        completeness: this.calculateCompleteness(input),
        aiEnriched: false,
      },
    };
  }

  /**
   * Analyzes PLU (Plan Local d'Urbanisme) constraints
   */
  static async analyzePLU(
    property: Partial<Property>,
    workProject: Partial<WorkProject>
  ): Promise<PLUAnalysis & { issues: FeasibilityIssue[]; recommendations: FeasibilityRecommendation[] }> {
    const issues: FeasibilityIssue[] = [];
    const recommendations: FeasibilityRecommendation[] = [];

    // Default PLU rules (would be fetched from external API in production)
    const pluRules: PLURules = {
      zoneType: property.location?.zoning?.pluZone || 'U',
      zoneName: property.location?.zoning?.zoneName || 'Zone Urbaine',
      allowedUses: ['habitation', 'commerce', 'artisanat'],
      prohibitedUses: ['industrie_lourde'],
      buildingRules: {
        maxHeight: property.location?.zoning?.maxHeight || 12,
        maxFootprint: property.location?.zoning?.maxFootprint || 0.6,
        maxFloorArea: property.location?.zoning?.maxFloorArea || 1.5,
        minSetbacks: {
          front: 5,
          side: 3,
          rear: 4,
        },
        parkingRatio: 1, // 1 place per housing unit
      },
      aestheticRules: {
        allowedRoofTypes: ['tuiles', 'ardoise'],
        allowedFacadeMaterials: ['enduit', 'pierre', 'brique'],
        allowedColors: [],
        maxFenceHeight: 2,
        greenSpaceRatio: 0.2,
      },
    };

    // Check height compliance
    const currentHeight = property.characteristics?.numberOfFloors
      ? property.characteristics.numberOfFloors * 3
      : 6;
    const plannedExtension = workProject.scope?.extension?.verticalExtension;
    if (plannedExtension && currentHeight + 3 > pluRules.buildingRules.maxHeight) {
      issues.push({
        id: 'height_exceeded',
        type: 'regulatory',
        severity: 'blocking',
        title: 'Hauteur maximale dépassée',
        description: `La surélévation envisagée dépasse la hauteur maximale autorisée de ${pluRules.buildingRules.maxHeight}m`,
        source: 'PLU',
        resolution: 'Réduire la hauteur du projet ou demander une dérogation',
        estimatedCost: undefined,
        estimatedDelay: 3,
      });
    }

    // Check footprint compliance
    const currentFootprint = property.characteristics?.surfaces?.landArea
      ? (property.characteristics.surfaces.groundFloorArea || 100) /
        property.characteristics.surfaces.landArea
      : 0;
    const plannedHorizontalExtension = workProject.scope?.extension?.horizontalExtension;
    if (plannedHorizontalExtension) {
      const additionalFootprint =
        (plannedHorizontalExtension / (property.characteristics?.surfaces?.landArea || 500));
      if (currentFootprint + additionalFootprint > pluRules.buildingRules.maxFootprint) {
        issues.push({
          id: 'footprint_exceeded',
          type: 'regulatory',
          severity: 'blocking',
          title: 'Emprise au sol maximale dépassée',
          description: `L'extension horizontale dépasse le coefficient d'emprise au sol maximum de ${pluRules.buildingRules.maxFootprint * 100}%`,
          source: 'PLU',
          resolution: 'Réduire la surface d\'extension ou demander une dérogation',
        });
      }
    }

    // Add PLU consultation recommendation if major works
    if (workProject.scope?.workType === 'extension' ||
        workProject.scope?.workType === 'major_renovation') {
      recommendations.push({
        id: 'plu_consultation',
        type: 'administrative',
        priority: 'high',
        title: 'Consultation du PLU en mairie',
        description: 'Consulter le PLU en vigueur à la mairie pour confirmer les règles applicables',
        estimatedCost: { min: 0, max: 0 },
        estimatedDuration: 0.5,
      });
    }

    return {
      commune: property.identification?.address?.city || 'Inconnue',
      pluReference: pluRules.zoneName,
      pluDate: new Date().toISOString(),
      zoneType: pluRules.zoneType,
      rules: pluRules,
      compliance: {
        isCompliant: issues.filter(i => i.severity === 'blocking').length === 0,
        violations: issues.filter(i => i.severity === 'blocking').map(i => i.title),
        warnings: issues.filter(i => i.severity === 'major').map(i => i.title),
        derogationsRequired: issues.some(i => i.resolution?.includes('dérogation')),
      },
      issues,
      recommendations,
    };
  }

  /**
   * Determines required permits for the project
   */
  static async analyzePermitRequirements(
    property: Partial<Property>,
    workProject: Partial<WorkProject>,
    selectedLots: SelectedLot[]
  ): Promise<UrbanPermitsAnalysis & { issues: FeasibilityIssue[]; recommendations: FeasibilityRecommendation[] }> {
    const issues: FeasibilityIssue[] = [];
    const recommendations: FeasibilityRecommendation[] = [];

    const determination = this.determineRequiredPermit(property, workProject, selectedLots);

    // Add issues based on permit type
    if (determination.requiredPermit === 'PC') {
      if (property.heritage?.isInProtectedZone || property.heritage?.isClassified) {
        issues.push({
          id: 'abf_required',
          type: 'regulatory',
          severity: 'major',
          title: 'Consultation ABF obligatoire',
          description: 'Le bien est situé en zone protégée. L\'avis de l\'ABF est requis.',
          source: 'Code du patrimoine',
          estimatedDelay: 2,
        });
      }

      recommendations.push({
        id: 'architect_required',
        type: 'study',
        priority: 'high',
        title: 'Architecte obligatoire',
        description: 'Le recours à un architecte est obligatoire pour les permis de construire sur surfaces > 150m²',
        estimatedCost: { min: 5000, max: 15000 },
        estimatedDuration: 1,
      });
    }

    // Required documents based on permit type
    const requiredDocuments = this.getRequiredDocuments(determination.requiredPermit);

    return {
      requiredPermit: determination.requiredPermit,
      permitReason: determination.reason,
      estimatedProcessingTime: determination.estimatedDuration,
      requiredDocuments,
      additionalConstraints: determination.additionalConstraints,
      instructionDetails: {
        submissionDeadline: undefined,
        instructionService: 'Service Urbanisme',
        estimatedCost: determination.estimatedCost,
      },
      issues,
      recommendations,
    };
  }

  /**
   * Analyzes heritage/ABF constraints
   */
  static async analyzeHeritageConstraints(
    property: Partial<Property>
  ): Promise<HeritageAnalysis & { issues: FeasibilityIssue[]; recommendations: FeasibilityRecommendation[] }> {
    const issues: FeasibilityIssue[] = [];
    const recommendations: FeasibilityRecommendation[] = [];

    const isInProtectedZone = property.heritage?.isInProtectedZone || false;
    const isClassified = property.heritage?.isClassified || false;
    const isRegistered = property.heritage?.isRegistered || false;
    const nearMonument = property.heritage?.nearMonument || false;

    let abfConsultation: ABFConsultation | undefined;

    if (isInProtectedZone || isClassified || isRegistered || nearMonument) {
      abfConsultation = {
        isRequired: true,
        reason: isClassified
          ? 'Monument classé'
          : isRegistered
          ? 'Monument inscrit'
          : nearMonument
          ? 'Périmètre de monument historique'
          : 'Zone de protection du patrimoine',
        consultationType: isClassified ? 'avis_conforme' : 'avis_simple',
        estimatedDuration: isClassified ? 3 : 2,
        constraints: [],
      };

      issues.push({
        id: 'heritage_constraint',
        type: 'regulatory',
        severity: isClassified ? 'blocking' : 'major',
        title: 'Contraintes patrimoniales',
        description: `Le bien est soumis à des contraintes patrimoniales (${abfConsultation.reason})`,
        source: 'Code du patrimoine',
        estimatedDelay: abfConsultation.estimatedDuration,
      });

      recommendations.push({
        id: 'abf_precons',
        type: 'administrative',
        priority: 'high',
        title: 'Rendez-vous préalable avec l\'ABF',
        description: 'Solliciter un rendez-vous avec l\'Architecte des Bâtiments de France avant de finaliser le projet',
        estimatedCost: { min: 0, max: 0 },
        estimatedDuration: 0.5,
      });

      if (isClassified) {
        recommendations.push({
          id: 'heritage_architect',
          type: 'study',
          priority: 'critical',
          title: 'Architecte spécialisé Monuments Historiques',
          description: 'Le recours à un architecte du patrimoine ou ACMH est recommandé',
          estimatedCost: { min: 8000, max: 25000 },
          estimatedDuration: 2,
        });
      }
    }

    return {
      isInProtectedZone,
      protectionType: isClassified
        ? 'monument_classe'
        : isRegistered
        ? 'monument_inscrit'
        : nearMonument
        ? 'abords_monument'
        : undefined,
      abfConsultation,
      constraints: abfConsultation?.constraints || [],
      issues,
      recommendations,
    };
  }

  /**
   * Analyzes condo (copropriété) constraints
   */
  static async analyzeCondoConstraints(
    property: Partial<Property>,
    selectedLots: SelectedLot[]
  ): Promise<CondoConstraintsAnalysis & { issues: FeasibilityIssue[]; recommendations: FeasibilityRecommendation[] }> {
    const issues: FeasibilityIssue[] = [];
    const recommendations: FeasibilityRecommendation[] = [];

    const isInCondo = property.condo?.isInCondo || false;

    if (!isInCondo) {
      return {
        isInCondo: false,
        issues,
        recommendations,
      };
    }

    // Determine which works affect common areas
    const commonAreaLots = ['facades', 'couverture', 'etancheite', 'gros_oeuvre', 'ascenseur'];
    const affectsCommonAreas = selectedLots.some(lot =>
      commonAreaLots.includes(lot.type)
    );

    // Determine if AG authorization is needed
    const agRequiredLots = ['facades', 'couverture', 'menuiseries_exterieures', 'climatisation'];
    const requiresAGAuthorization = selectedLots.some(lot =>
      agRequiredLots.includes(lot.type)
    );

    if (requiresAGAuthorization) {
      issues.push({
        id: 'ag_required',
        type: 'regulatory',
        severity: 'major',
        title: 'Autorisation AG requise',
        description: 'Certains travaux nécessitent l\'autorisation de l\'assemblée générale des copropriétaires',
        source: 'Règlement de copropriété',
        resolution: 'Inscrire la demande à l\'ordre du jour de la prochaine AG',
        estimatedDelay: 3,
      });

      recommendations.push({
        id: 'contact_syndic',
        type: 'administrative',
        priority: 'high',
        title: 'Contacter le syndic',
        description: 'Prendre contact avec le syndic pour connaître les délais et modalités de la prochaine AG',
        estimatedCost: { min: 0, max: 200 },
        estimatedDuration: 0.25,
      });
    }

    if (affectsCommonAreas) {
      recommendations.push({
        id: 'review_reglement',
        type: 'study',
        priority: 'medium',
        title: 'Vérifier le règlement de copropriété',
        description: 'Consulter le règlement de copropriété pour les contraintes spécifiques',
        estimatedCost: { min: 0, max: 0 },
        estimatedDuration: 0.25,
      });
    }

    // Work hours constraints
    const workHoursConstraints = {
      weekdays: { start: '08:00', end: '19:00' },
      saturday: { start: '09:00', end: '12:00' },
      sundayAndHolidays: false,
    };

    return {
      isInCondo: true,
      syndicContact: property.condo?.syndicContact,
      regulationConstraints: [],
      commonAreaWorks: affectsCommonAreas
        ? selectedLots.filter(l => commonAreaLots.includes(l.type)).map(l => l.name)
        : [],
      requiresAGAuthorization,
      nextAGDate: undefined,
      workHoursConstraints,
      issues,
      recommendations,
    };
  }

  /**
   * Analyzes technical standards (DTU, norms)
   */
  static async analyzeTechnicalStandards(
    property: Partial<Property>,
    selectedLots: SelectedLot[]
  ): Promise<TechnicalStandardsAnalysis & { issues: FeasibilityIssue[]; recommendations: FeasibilityRecommendation[] }> {
    const issues: FeasibilityIssue[] = [];
    const recommendations: FeasibilityRecommendation[] = [];

    // Get applicable DTUs based on selected lots
    const applicableDTUs = this.getApplicableDTUs(selectedLots);

    // Determine thermal regulation
    const yearBuilt = property.construction?.yearBuilt || 2000;
    const thermalRegulation = yearBuilt >= 2022
      ? 'RE2020'
      : yearBuilt >= 2013
      ? 'RT2012'
      : yearBuilt >= 2006
      ? 'RT2005'
      : 'RT2000';

    // Check if thermal renovation triggers RE2020 requirements
    const thermalLots = ['isolation_thermique', 'chauffage', 'menuiseries_exterieures', 'ventilation'];
    const isThermalRenovation = selectedLots.some(lot => thermalLots.includes(lot.type));

    if (isThermalRenovation) {
      recommendations.push({
        id: 'thermal_study',
        type: 'study',
        priority: 'high',
        title: 'Étude thermique recommandée',
        description: `Une étude thermique est recommandée pour optimiser la rénovation énergétique (réglementation ${thermalRegulation})`,
        estimatedCost: { min: 500, max: 1500 },
        estimatedDuration: 0.5,
      });
    }

    // Check electrical norms
    const electricalLots = ['electricite'];
    const isElectricalWork = selectedLots.some(lot => electricalLots.includes(lot.type));

    if (isElectricalWork) {
      recommendations.push({
        id: 'consuel',
        type: 'administrative',
        priority: 'high',
        title: 'Attestation CONSUEL',
        description: 'Une attestation de conformité CONSUEL sera nécessaire après travaux électriques',
        estimatedCost: { min: 150, max: 300 },
        estimatedDuration: 0.25,
      });
    }

    // Check accessibility requirements
    const isERP = property.identification?.type === 'commercial' ||
                  property.identification?.type === 'office';
    if (isERP) {
      issues.push({
        id: 'accessibility',
        type: 'regulatory',
        severity: 'major',
        title: 'Normes accessibilité ERP',
        description: 'Le bien étant un ERP, les normes d\'accessibilité PMR sont applicables',
        source: 'Code de la construction',
        resolution: 'Prévoir un diagnostic accessibilité et les travaux de mise en conformité',
      });
    }

    return {
      applicableDTUs,
      thermalRegulation,
      electricalNorms: ['NF C 15-100'],
      accessibilityNorms: isERP ? ['Arrêté du 20 avril 2017'] : [],
      fireNorms: this.getApplicableFireNorms(property),
      acousticNorms: this.getApplicableAcousticNorms(property),
      issues,
      recommendations,
    };
  }

  /**
   * Determines the required permit type
   */
  static determineRequiredPermit(
    property: Partial<Property>,
    workProject: Partial<WorkProject>,
    selectedLots: SelectedLot[]
  ): PermitDetermination {
    const workType = workProject.scope?.workType;
    const extension = workProject.scope?.extension;
    const isInCondo = property.condo?.isInCondo;
    const isProtected = property.heritage?.isInProtectedZone ||
                        property.heritage?.isClassified;
    const currentSurface = property.characteristics?.surfaces?.livingArea || 0;

    // Calculate extension surface
    const extensionSurface = (extension?.horizontalExtension || 0) +
                             (extension?.verticalExtension || 0);

    // Facade works
    const hasFacadeWork = selectedLots.some(lot =>
      ['facades', 'menuiseries_exterieures', 'couverture'].includes(lot.type)
    );

    // Default: no permit needed
    let result: PermitDetermination = {
      requiredPermit: 'none',
      reason: 'Travaux intérieurs n\'affectant pas l\'aspect extérieur',
      estimatedDuration: 0,
      estimatedCost: { min: 0, max: 0 },
      requiredDocuments: [],
      additionalConstraints: [],
    };

    // DP cases (Déclaration Préalable)
    if (hasFacadeWork && !isProtected) {
      result = {
        requiredPermit: 'DP',
        reason: 'Modification de l\'aspect extérieur',
        estimatedDuration: 1,
        estimatedCost: { min: 0, max: 100 },
        requiredDocuments: ['Cerfa n°13703*08', 'Plan de situation', 'Plan de masse', 'Photos'],
        additionalConstraints: [],
      };
    }

    // Extension < 20m² (or < 40m² in PLU zone)
    if (extensionSurface > 0 && extensionSurface <= 20) {
      result = {
        requiredPermit: 'DP',
        reason: `Extension de ${extensionSurface}m² (< 20m²)`,
        estimatedDuration: 1,
        estimatedCost: { min: 0, max: 100 },
        requiredDocuments: ['Cerfa n°13703*08', 'Plan de situation', 'Plan de masse', 'Plan de coupe', 'Insertion paysagère'],
        additionalConstraints: [],
      };
    }

    // PC cases (Permis de Construire)
    // Extension > 20m² (or > 40m² in PLU zone)
    if (extensionSurface > 20) {
      result = {
        requiredPermit: 'PC',
        reason: `Extension de ${extensionSurface}m² (> 20m²)`,
        estimatedDuration: 2,
        estimatedCost: { min: 100, max: 500 },
        requiredDocuments: [
          'Cerfa n°13406*09',
          'Plan de situation',
          'Plan de masse',
          'Plan de coupe',
          'Notice descriptive',
          'Plan des façades',
          'Insertion paysagère',
          'Photos',
        ],
        additionalConstraints: [],
      };

      // Architect required if total surface > 150m²
      if (currentSurface + extensionSurface > 150) {
        result.additionalConstraints.push('Recours à un architecte obligatoire');
      }
    }

    // New construction
    if (workType === 'construction') {
      result = {
        requiredPermit: 'PC',
        reason: 'Construction nouvelle',
        estimatedDuration: 3,
        estimatedCost: { min: 200, max: 1000 },
        requiredDocuments: [
          'Cerfa n°13406*09',
          'Plan de situation',
          'Plan de masse',
          'Plan de coupe',
          'Notice descriptive',
          'Plan des façades et toitures',
          'Insertion paysagère',
          'Photos',
          'Attestation RT2012/RE2020',
        ],
        additionalConstraints: ['Recours à un architecte obligatoire'],
      };
    }

    // Protected zone increases processing time
    if (isProtected && result.requiredPermit !== 'none') {
      result.estimatedDuration += 1;
      result.additionalConstraints.push('Avis ABF requis');
    }

    // Change of use
    if (workType === 'change_of_use') {
      result = {
        requiredPermit: 'PC',
        reason: 'Changement de destination',
        estimatedDuration: 2,
        estimatedCost: { min: 100, max: 500 },
        requiredDocuments: [
          'Cerfa n°13406*09',
          'Plan de situation',
          'Plan avant/après',
          'Notice descriptive',
        ],
        additionalConstraints: [],
      };
    }

    return result;
  }

  /**
   * Creates or updates a feasibility report in the database
   */
  static async saveFeasibilityReport(
    projectId: string,
    report: FeasibilityReport
  ): Promise<FeasibilityReport> {
    const { data, error } = await supabase
      .from('phase0_feasibility_checks')
      .upsert({
        project_id: projectId,
        status: report.status,
        score: report.score,
        plu_analysis: report.pluAnalysis,
        permits_analysis: report.permitsAnalysis,
        heritage_analysis: report.heritageAnalysis,
        condo_constraints: report.condoConstraints,
        technical_standards: report.technicalStandards,
        issues: report.issues,
        recommendations: report.recommendations,
        metadata: report.torpMetadata,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'project_id',
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving feasibility report:', error);
      throw new Error(`Erreur lors de la sauvegarde: ${error.message}`);
    }

    return {
      ...report,
      id: data.id,
      projectId,
    };
  }

  /**
   * Gets feasibility report by project ID
   */
  static async getReportByProjectId(projectId: string): Promise<FeasibilityReport | null> {
    const { data, error } = await supabase
      .from('phase0_feasibility_checks')
      .select('*')
      .eq('project_id', projectId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Erreur lors de la récupération: ${error.message}`);
    }

    return this.mapRowToReport(data);
  }

  // =============================================================================
  // PRIVATE METHODS
  // =============================================================================

  private static calculateOverallStatus(issues: FeasibilityIssue[]): FeasibilityStatus {
    const blockingCount = issues.filter(i => i.severity === 'blocking').length;
    const majorCount = issues.filter(i => i.severity === 'major').length;

    if (blockingCount > 0) return 'not_feasible';
    if (majorCount > 2) return 'conditional';
    if (majorCount > 0) return 'feasible_with_conditions';
    return 'feasible';
  }

  private static calculateFeasibilityScore(
    plu: PLUAnalysis & { issues: FeasibilityIssue[] },
    permits: UrbanPermitsAnalysis & { issues: FeasibilityIssue[] },
    heritage: HeritageAnalysis & { issues: FeasibilityIssue[] },
    condo: CondoConstraintsAnalysis & { issues: FeasibilityIssue[] },
    technical: TechnicalStandardsAnalysis & { issues: FeasibilityIssue[] }
  ): FeasibilityScore {
    const calculateSectionScore = (issues: FeasibilityIssue[]): number => {
      let score = 100;
      issues.forEach(issue => {
        if (issue.severity === 'blocking') score -= 40;
        else if (issue.severity === 'major') score -= 20;
        else if (issue.severity === 'minor') score -= 10;
      });
      return Math.max(0, score);
    };

    const regulatory = calculateSectionScore([...plu.issues, ...permits.issues, ...heritage.issues]);
    const technicalScore = calculateSectionScore(technical.issues);
    const financial = 80; // Default, would be calculated from costs
    const timing = 80; // Default, would be calculated from delays

    const overall = Math.round((regulatory * 0.4 + technicalScore * 0.3 + financial * 0.15 + timing * 0.15));

    return { overall, regulatory, technical: technicalScore, financial, timing };
  }

  private static calculateCompleteness(input: FeasibilityAnalysisInput): number {
    let completeness = 0;

    if (input.property?.identification?.address) completeness += 20;
    if (input.property?.condo?.isInCondo !== undefined) completeness += 10;
    if (input.property?.heritage) completeness += 15;
    if (input.workProject?.scope?.workType) completeness += 20;
    if (input.selectedLots.length > 0) completeness += 20;
    if (input.property?.characteristics?.surfaces) completeness += 15;

    return completeness;
  }

  private static getApplicableDTUs(selectedLots: SelectedLot[]): DTURequirement[] {
    const dtuMapping: Record<string, DTURequirement[]> = {
      gros_oeuvre: [
        { reference: 'DTU 20.1', title: 'Ouvrages en maçonnerie', isRequired: true },
      ],
      charpente: [
        { reference: 'DTU 31.1', title: 'Charpente en bois', isRequired: true },
        { reference: 'DTU 31.2', title: 'Construction de maisons à ossature bois', isRequired: false },
      ],
      couverture: [
        { reference: 'DTU 40.11', title: 'Couverture en ardoises', isRequired: false },
        { reference: 'DTU 40.21', title: 'Couverture en tuiles de terre cuite', isRequired: false },
      ],
      plomberie: [
        { reference: 'DTU 60.1', title: 'Plomberie sanitaire', isRequired: true },
        { reference: 'DTU 60.11', title: 'Règles de calcul des installations de plomberie', isRequired: true },
      ],
      electricite: [
        { reference: 'NF C 15-100', title: 'Installations électriques à basse tension', isRequired: true },
      ],
      chauffage: [
        { reference: 'DTU 65.11', title: 'Dispositifs de sécurité des installations de chauffage', isRequired: true },
      ],
      isolation_thermique: [
        { reference: 'DTU 45.10', title: 'Isolation thermique des bâtiments', isRequired: true },
      ],
      carrelage_faience: [
        { reference: 'DTU 52.2', title: 'Pose collée des revêtements céramiques', isRequired: true },
      ],
      peinture: [
        { reference: 'DTU 59.1', title: 'Travaux de peinture', isRequired: true },
      ],
    };

    const dtus: DTURequirement[] = [];
    const addedReferences = new Set<string>();

    selectedLots.forEach(lot => {
      const lotDTUs = dtuMapping[lot.type] || [];
      lotDTUs.forEach(dtu => {
        if (!addedReferences.has(dtu.reference)) {
          dtus.push(dtu);
          addedReferences.add(dtu.reference);
        }
      });
    });

    return dtus;
  }

  private static getApplicableFireNorms(property: Partial<Property>): string[] {
    const norms: string[] = [];
    const isERP = property.identification?.type === 'commercial' ||
                  property.identification?.type === 'office';

    if (isERP) {
      norms.push('Règlement de sécurité contre l\'incendie ERP');
    }

    const isImmeuble = property.identification?.type === 'building' ||
                       (property.condo?.isInCondo && property.characteristics?.numberOfFloors > 2);
    if (isImmeuble) {
      norms.push('Arrêté du 31 janvier 1986 (protection contre l\'incendie - habitations)');
    }

    return norms;
  }

  private static getApplicableAcousticNorms(property: Partial<Property>): string[] {
    const norms: string[] = [];

    if (property.condo?.isInCondo) {
      norms.push('Arrêté du 30 juin 1999 (acoustique des bâtiments d\'habitation)');
    }

    return norms;
  }

  private static getRequiredDocuments(permitType: PermitType): string[] {
    const documentMap: Record<PermitType, string[]> = {
      none: [],
      DP: [
        'Cerfa n°13703*08 (Déclaration préalable)',
        'DP1 - Plan de situation',
        'DP2 - Plan de masse',
        'DP3 - Plan de coupe',
        'DP4 - Plan des façades et toitures',
        'DP5/DP6 - Représentation de l\'aspect extérieur',
        'DP7/DP8 - Photographies',
      ],
      PC: [
        'Cerfa n°13406*09 (Permis de construire)',
        'PC1 - Plan de situation',
        'PC2 - Plan de masse',
        'PC3 - Plan de coupe',
        'PC4 - Notice descriptive',
        'PC5 - Plan des façades et toitures',
        'PC6 - Document graphique (insertion paysagère)',
        'PC7/PC8 - Photographies',
        'Attestation RT2012/RE2020',
      ],
      PA: [
        'Cerfa n°13409*08 (Permis d\'aménager)',
        'PA1 - Plan de situation',
        'PA2 - Notice de présentation',
        'PA3 - Plan de l\'état actuel',
        'PA4 - Plan du projet d\'aménagement',
      ],
      PD: [
        'Cerfa n°13405*08 (Permis de démolir)',
        'PD1 - Plan de situation',
        'PD2 - Plan de masse',
        'PD3 - Photographies',
      ],
    };

    return documentMap[permitType] || [];
  }

  private static mapRowToReport(row: Record<string, unknown>): FeasibilityReport {
    return {
      id: row.id as string,
      projectId: row.project_id as string,
      status: row.status as FeasibilityStatus,
      score: row.score as FeasibilityScore,
      pluAnalysis: row.plu_analysis as PLUAnalysis,
      permitsAnalysis: row.permits_analysis as UrbanPermitsAnalysis,
      heritageAnalysis: row.heritage_analysis as HeritageAnalysis,
      condoConstraints: row.condo_constraints as CondoConstraintsAnalysis,
      technicalStandards: row.technical_standards as TechnicalStandardsAnalysis,
      issues: row.issues as FeasibilityIssue[],
      recommendations: row.recommendations as FeasibilityRecommendation[],
      validatedAt: row.validated_at as string | undefined,
      validatedBy: row.validated_by as string | undefined,
      torpMetadata: row.metadata as FeasibilityReport['torpMetadata'],
    };
  }
}

export default FeasibilityService;
