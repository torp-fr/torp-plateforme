/**
 * TORP Phase 0 - Moteur de Déduction IA
 * Enrichissement automatique des données et suggestions intelligentes
 */

import { supabase } from '@/lib/supabase';
import type {
  DeductionRule,
  DeductionResult,
  DeductionStatus,
  DeductionCategory,
  DeducedData,
  LotSuggestion,
  LotType,
  ExternalApiId,
  ConfidenceLevel,
  Phase0Project,
} from '@/types/phase0';
import { LOT_CATALOG } from '@/types/phase0';

// =============================================================================
// CONFIGURATION
// =============================================================================

const EXTERNAL_API_ENDPOINTS: Record<ExternalApiId, string> = {
  api_ban: 'https://api-adresse.data.gouv.fr',
  api_cadastre: 'https://apicarto.ign.fr/api/cadastre',
  api_georisques: 'https://georisques.gouv.fr/api/v1',
  api_dpe_ademe: 'https://data.ademe.fr/data-fair/api/v1/datasets/dpe-v2-logements-existants',
  api_meteo_france: 'https://public-api.meteofrance.fr/public',
  api_sirene: 'https://api.insee.fr/entreprises/sirene/V3',
  api_pappers: 'https://api.pappers.fr/v2',
  api_france_renov: 'https://api.francerenovation.fr',
  api_atlas_patrimoine: 'https://atlas.patrimoines.culture.fr/api',
  api_plu_gpu: 'https://apicarto.ign.fr/api/gpu',
  api_rge_ademe: 'https://data.ademe.fr/data-fair/api/v1/datasets/liste-des-entreprises-rge',
};

// =============================================================================
// SERVICE
// =============================================================================

// Export types for external use
export interface GeoData {
  coordinates: { lat: number; lng: number };
  department: string;
  region: string;
}

export interface CadastreData {
  references: string[];
  parcelArea: number;
}

export interface NaturalRisksData {
  flood: { level: string; zone: string };
  earthquake: { level: string; zone: string };
  clayShrinkage: { level: string };
}

export interface AidsEligibility {
  name: string;
  type: string;
  estimatedAmount: number;
  conditions: string[];
}

export class DeductionService {
  // Static method for compatibility with useWizard hook
  static async applyDeductions(project: Phase0Project): Promise<Phase0Project> {
    if (!project.id) return project;

    try {
      const results = await deductionServiceInstance.applyDeductions(project.id);

      // Return updated project with deductions applied
      return {
        ...project,
        deductions: results,
      };
    } catch (error) {
      console.error('Error applying deductions:', error);
      return project;
    }
  }
  /**
   * Appliquer les déductions pour un projet
   */
  async applyDeductions(projectId: string): Promise<DeductionResult[]> {
    const { data: project } = await supabase
      .from('phase0_projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (!project) {
      throw new Error('Projet non trouvé');
    }

    const results: DeductionResult[] = [];

    // Déductions géographiques
    if (project.property?.identification?.address) {
      const geoResults = await this.applyGeoDeductions(projectId, project);
      results.push(...geoResults);
    }

    // Suggestions de lots
    if (project.work_project?.general?.projectType) {
      const lotResults = await this.applyLotSuggestions(projectId, project);
      results.push(...lotResults);
    }

    // Déductions réglementaires
    if (project.property && project.work_project) {
      const regResults = await this.applyRegulatoryDeductions(projectId, project);
      results.push(...regResults);
    }

    // Sauvegarder les résultats
    await this.saveDeductionResults(projectId, results);

    return results;
  }

  /**
   * Appliquer une règle de déduction spécifique
   */
  async applyRule(
    projectId: string,
    ruleId: string,
    context: Record<string, unknown>
  ): Promise<DeductionResult> {
    const startTime = Date.now();

    const result: DeductionResult = {
      id: `ded_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ruleId,
      ruleName: '',
      timestamp: new Date().toISOString(),
      status: 'pending',
      success: false,
      sourceData: context,
      deducedData: [],
      confidence: 'medium',
      executionTimeMs: 0,
    };

    try {
      // Exécuter la règle selon son ID
      switch (ruleId) {
        case 'DEDUC_001': // Zone climatique
          await this.deduceClimateZone(result, context);
          break;
        case 'DEDUC_002': // Risques naturels
          await this.deduceNaturalRisks(result, context);
          break;
        case 'DEDUC_003': // Zone ABF
          await this.deduceHeritageZone(result, context);
          break;
        case 'DEDUC_004': // Références cadastrales
          await this.deduceCadastralRef(result, context);
          break;
        case 'DEDUC_010': // Lots depuis description
          await this.deduceLotsFromDescription(result, context);
          break;
        case 'DEDUC_020': // Permis requis
          await this.deducePermitRequired(result, context);
          break;
        case 'DEDUC_021': // Architecte obligatoire
          await this.deduceArchitectRequired(result, context);
          break;
        default:
          result.status = 'skipped';
          result.error = {
            code: 'UNKNOWN_RULE',
            message: `Règle inconnue: ${ruleId}`,
            retryable: false,
          };
      }

      if (result.status === 'pending') {
        result.status = 'success';
        result.success = true;
      }
    } catch (error) {
      result.status = 'failed';
      result.success = false;
      result.error = {
        code: 'EXECUTION_ERROR',
        message: error instanceof Error ? error.message : 'Erreur inconnue',
        retryable: true,
      };
    }

    result.executionTimeMs = Date.now() - startTime;

    // Sauvegarder le résultat
    await this.saveDeductionResult(projectId, result);

    return result;
  }

  /**
   * Obtenir les suggestions de lots basées sur le type de projet
   */
  async getLotSuggestions(
    projectType: string,
    description?: string,
    existingCondition?: number
  ): Promise<LotSuggestion[]> {
    const suggestions: LotSuggestion[] = [];

    // Lots suggérés par type de projet
    const lotsByProjectType: Record<string, LotType[]> = {
      new_construction: [
        'terrassement_vrd', 'maconnerie', 'beton_arme', 'charpente_bois',
        'couverture', 'menuiseries_exterieures', 'platrerie', 'courants_forts',
        'sanitaires', 'chauffage_central', 'vmc_simple_flux', 'carrelage', 'peinture'
      ],
      extension: [
        'terrassement_vrd', 'maconnerie', 'couverture', 'menuiseries_exterieures',
        'isolation_interieure', 'platrerie', 'courants_forts', 'sanitaires',
        'radiateurs', 'carrelage', 'peinture'
      ],
      heavy_renovation: [
        'demolition', 'maconnerie', 'couverture', 'ite', 'menuiseries_exterieures',
        'isolation_interieure', 'platrerie', 'courants_forts', 'sanitaires',
        'chauffage_central', 'vmc_double_flux', 'carrelage', 'peinture'
      ],
      renovation: [
        'platrerie', 'courants_forts', 'sanitaires', 'radiateurs',
        'carrelage', 'peinture', 'menuiseries_interieures'
      ],
      energy_renovation: [
        'ite', 'isolation_interieure', 'menuiseries_exterieures',
        'chauffage_central', 'eau_chaude', 'vmc_double_flux', 'photovoltaique'
      ],
      refurbishment: [
        'peinture', 'sols_souples', 'carrelage', 'menuiseries_interieures'
      ],
    };

    const recommendedLots = lotsByProjectType[projectType] || lotsByProjectType['renovation'];

    for (const lotType of recommendedLots) {
      const lotDef = LOT_CATALOG.find(l => l.type === lotType);
      if (!lotDef) continue;

      const suggestion: LotSuggestion = {
        lotType,
        lotName: lotDef.name,
        suggestionReason: 'project_type_match',
        confidence: 'high',
        priority: this.determineLotPriority(lotType, projectType),
        estimatedImpact: {
          cost: {
            min: lotDef.typicalPriceRange.min,
            max: lotDef.typicalPriceRange.max,
          },
          duration: {
            minDays: lotDef.typicalDuration.minDays,
            maxDays: lotDef.typicalDuration.maxDays,
          },
        },
        dependencies: lotDef.dependencies,
      };

      suggestions.push(suggestion);
    }

    // Si description fournie, analyser pour suggestions supplémentaires
    if (description) {
      const descriptionSuggestions = this.analyzedescriptionForLots(description);
      for (const ds of descriptionSuggestions) {
        if (!suggestions.find(s => s.lotType === ds.lotType)) {
          suggestions.push(ds);
        }
      }
    }

    // Trier par priorité
    suggestions.sort((a, b) => {
      const priorityOrder = { required: 0, recommended: 1, optional: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    return suggestions;
  }

  /**
   * Vérifier l'éligibilité aux aides
   */
  async checkAidsEligibility(
    projectId: string,
    selectedLots: string[],
    ownerProfile: Record<string, unknown>
  ): Promise<unknown[]> {
    const eligibleAids: unknown[] = [];

    // Vérifier les lots RGE
    const rgeLots = LOT_CATALOG.filter(
      lot => selectedLots.includes(lot.type) && lot.rgeEligible
    );

    if (rgeLots.length > 0) {
      // MaPrimeRénov'
      eligibleAids.push({
        name: 'MaPrimeRénov\'',
        type: 'maprimerénov',
        estimatedAmount: this.estimateMaPrimeRenovAmount(rgeLots, ownerProfile),
        confidence: 'medium',
        conditions: [
          'Logement de plus de 15 ans',
          'Résidence principale',
          'Travaux réalisés par artisan RGE',
        ],
      });

      // CEE
      eligibleAids.push({
        name: 'Prime CEE',
        type: 'cee',
        estimatedAmount: this.estimateCEEAmount(rgeLots),
        confidence: 'medium',
        conditions: [
          'Logement de plus de 2 ans',
          'Travaux réalisés par artisan RGE',
        ],
      });

      // Éco-PTZ
      if (rgeLots.length >= 2) {
        eligibleAids.push({
          name: 'Éco-PTZ',
          type: 'eco_ptz',
          estimatedAmount: 50000,
          maxAmount: 50000,
          confidence: 'high',
          conditions: [
            'Bouquet de 2 travaux minimum',
            'Logement de plus de 2 ans',
            'Résidence principale',
          ],
        });
      }
    }

    // TVA réduite
    eligibleAids.push({
      name: 'TVA à taux réduit',
      type: 'reduced_vat',
      rate: rgeLots.length > 0 ? 5.5 : 10,
      confidence: 'high',
      conditions: ['Logement de plus de 2 ans'],
    });

    return eligibleAids;
  }

  /**
   * Accepter une déduction
   */
  async acceptDeduction(projectId: string, deductionId: string): Promise<void> {
    await supabase
      .from('phase0_deductions')
      .update({
        user_action: 'accepted',
        user_action_at: new Date().toISOString(),
      })
      .eq('id', deductionId)
      .eq('project_id', projectId);

    // Appliquer la valeur déduite au projet
    const { data: deduction } = await supabase
      .from('phase0_deductions')
      .select('*')
      .eq('id', deductionId)
      .single();

    if (deduction && deduction.deduced_value) {
      // Mettre à jour le projet avec la valeur déduite
      await this.applyDeducedValueToProject(projectId, deduction.target_field, deduction.deduced_value);
    }
  }

  /**
   * Rejeter une déduction
   */
  async rejectDeduction(projectId: string, deductionId: string): Promise<void> {
    await supabase
      .from('phase0_deductions')
      .update({
        user_action: 'rejected',
        user_action_at: new Date().toISOString(),
      })
      .eq('id', deductionId)
      .eq('project_id', projectId);
  }

  /**
   * Modifier une déduction
   */
  async modifyDeduction(
    projectId: string,
    deductionId: string,
    newValue: unknown
  ): Promise<void> {
    await supabase
      .from('phase0_deductions')
      .update({
        user_action: 'modified',
        user_action_at: new Date().toISOString(),
        user_override_value: newValue,
      })
      .eq('id', deductionId)
      .eq('project_id', projectId);

    // Appliquer la nouvelle valeur
    const { data: deduction } = await supabase
      .from('phase0_deductions')
      .select('target_field')
      .eq('id', deductionId)
      .single();

    if (deduction) {
      await this.applyDeducedValueToProject(projectId, deduction.target_field, newValue);
    }
  }

  // =============================================================================
  // PRIVATE METHODS - Déductions géographiques
  // =============================================================================

  private async applyGeoDeductions(
    projectId: string,
    project: Record<string, unknown>
  ): Promise<DeductionResult[]> {
    const results: DeductionResult[] = [];
    const address = (project.property as Record<string, unknown>)?.identification as Record<string, unknown>;

    if (!address?.address) return results;

    // Géocodage et risques
    try {
      const geoResult = await this.applyRule(projectId, 'DEDUC_002', {
        address: address.address,
      });
      results.push(geoResult);
    } catch (error) {
      console.error('Error in geo deductions:', error);
    }

    return results;
  }

  private async deduceClimateZone(
    result: DeductionResult,
    context: Record<string, unknown>
  ): Promise<void> {
    const postalCode = (context.address as Record<string, string>)?.postalCode;
    if (!postalCode) {
      result.status = 'skipped';
      return;
    }

    // Déterminer la zone climatique à partir du code postal
    const dept = postalCode.substring(0, 2);
    const climateZone = this.getClimateZoneFromDept(dept);

    result.ruleName = 'Zone climatique depuis code postal';
    result.deducedData.push({
      field: 'property.environment.climate.climateZone',
      value: climateZone,
      confidence: 'high',
      source: 'rule_engine',
      requiresValidation: false,
      validated: true,
    });
  }

  private async deduceNaturalRisks(
    result: DeductionResult,
    context: Record<string, unknown>
  ): Promise<void> {
    result.ruleName = 'Risques naturels depuis adresse';

    // Simulation - en production, appeler l'API Géorisques
    const mockRisks = {
      flood: { level: 'low' as const, zone: 'Hors zone inondable' },
      earthquake: { level: 'low' as const, zone: 'Zone 1' },
      clayShrinkage: { level: 'medium' as const },
    };

    result.deducedData.push({
      field: 'property.diagnostics.erp.naturalRisks',
      value: [
        { type: 'flood', level: mockRisks.flood.level, zone: mockRisks.flood.zone },
        { type: 'earthquake', level: mockRisks.earthquake.level, zone: mockRisks.earthquake.zone },
        { type: 'clay_shrinkage', level: mockRisks.clayShrinkage.level },
      ],
      confidence: 'high',
      source: 'api_external',
      requiresValidation: true,
      validated: false,
    });
    result.confidence = 'high';
  }

  private async deduceHeritageZone(
    result: DeductionResult,
    context: Record<string, unknown>
  ): Promise<void> {
    result.ruleName = 'Zone ABF depuis adresse';

    // Simulation - en production, appeler l'API Atlas Patrimoine
    const isInProtectedZone = false;

    result.deducedData.push({
      field: 'property.heritageStatus',
      value: {
        isProtected: false,
        isInProtectedZone,
        abfRequired: isInProtectedZone,
      },
      confidence: 'high',
      source: 'api_external',
      requiresValidation: true,
      validated: false,
    });
  }

  private async deduceCadastralRef(
    result: DeductionResult,
    context: Record<string, unknown>
  ): Promise<void> {
    result.ruleName = 'Références cadastrales depuis adresse';

    // Simulation - en production, appeler l'API Cadastre IGN
    result.deducedData.push({
      field: 'property.identification.cadastralReferences',
      value: [],
      confidence: 'low',
      source: 'api_external',
      requiresValidation: true,
      validated: false,
    });
    result.reasoning = 'Références cadastrales non trouvées automatiquement. Vérification manuelle recommandée.';
  }

  // =============================================================================
  // PRIVATE METHODS - Suggestions de lots
  // =============================================================================

  private async applyLotSuggestions(
    projectId: string,
    project: Record<string, unknown>
  ): Promise<DeductionResult[]> {
    const results: DeductionResult[] = [];
    const workProject = project.work_project as Record<string, unknown>;
    const projectType = (workProject?.general as Record<string, string>)?.projectType;

    if (!projectType) return results;

    const suggestions = await this.getLotSuggestions(
      projectType,
      (workProject?.scope as Record<string, string>)?.descriptionDetailed
    );

    const result: DeductionResult = {
      id: `ded_lots_${Date.now()}`,
      ruleId: 'DEDUC_010',
      ruleName: 'Suggestion de lots depuis type de projet',
      timestamp: new Date().toISOString(),
      status: 'success',
      success: true,
      sourceData: { projectType },
      deducedData: [{
        field: 'suggestedLots',
        value: suggestions,
        confidence: 'medium',
        source: 'rule_engine',
        requiresValidation: true,
        validated: false,
      }],
      confidence: 'medium',
      reasoning: `${suggestions.length} lots suggérés pour un projet de type "${projectType}"`,
      executionTimeMs: 0,
    };

    results.push(result);

    return results;
  }

  private async deduceLotsFromDescription(
    result: DeductionResult,
    context: Record<string, unknown>
  ): Promise<void> {
    const description = context.description as string;
    if (!description) {
      result.status = 'skipped';
      return;
    }

    result.ruleName = 'Lots depuis description projet';
    const suggestions = this.analyzedescriptionForLots(description);

    result.deducedData.push({
      field: 'suggestedLots',
      value: suggestions,
      confidence: 'medium',
      source: 'ai_model',
      requiresValidation: true,
      validated: false,
    });
  }

  private analyzedescriptionForLots(description: string): LotSuggestion[] {
    const suggestions: LotSuggestion[] = [];
    const descLower = description.toLowerCase();

    // Mapping mots-clés -> lots
    const keywordMapping: Record<string, LotType[]> = {
      'salle de bain': ['salle_bain_cle_main', 'sanitaires', 'carrelage'],
      'douche': ['sanitaires', 'carrelage'],
      'cuisine': ['cuisine_equipee', 'carrelage'],
      'fenêtre': ['menuiseries_exterieures'],
      'volet': ['fermetures'],
      'isolation': ['isolation_interieure', 'ite'],
      'chauffage': ['chauffage_central', 'radiateurs'],
      'pompe à chaleur': ['chauffage_central'],
      'pac': ['chauffage_central'],
      'électricité': ['courants_forts'],
      'peinture': ['peinture'],
      'parquet': ['parquet'],
      'carrelage': ['carrelage'],
      'toiture': ['couverture'],
      'façade': ['ravalement', 'ite'],
      'extension': ['terrassement_vrd', 'maconnerie', 'couverture'],
      'véranda': ['menuiseries_exterieures'],
      'terrasse': ['amenagements_exterieurs'],
      'piscine': ['piscine'],
      'portail': ['clotures'],
      'escalier': ['escaliers'],
      'placard': ['agencement'],
      'dressing': ['agencement'],
    };

    for (const [keyword, lotTypes] of Object.entries(keywordMapping)) {
      if (descLower.includes(keyword)) {
        for (const lotType of lotTypes) {
          if (!suggestions.find(s => s.lotType === lotType)) {
            const lotDef = LOT_CATALOG.find(l => l.type === lotType);
            if (lotDef) {
              suggestions.push({
                lotType,
                lotName: lotDef.name,
                suggestionReason: 'description_analysis',
                confidence: 'medium',
                priority: 'recommended',
                estimatedImpact: {
                  cost: {
                    min: lotDef.typicalPriceRange.min,
                    max: lotDef.typicalPriceRange.max,
                  },
                  duration: {
                    minDays: lotDef.typicalDuration.minDays,
                    maxDays: lotDef.typicalDuration.maxDays,
                  },
                },
                dependencies: lotDef.dependencies,
                aiReasoning: `Détecté dans la description: "${keyword}"`,
              });
            }
          }
        }
      }
    }

    return suggestions;
  }

  private determineLotPriority(
    lotType: LotType,
    projectType: string
  ): 'required' | 'recommended' | 'optional' {
    const requiredLots: Record<string, LotType[]> = {
      new_construction: ['terrassement_vrd', 'maconnerie', 'couverture', 'courants_forts'],
      extension: ['terrassement_vrd', 'maconnerie', 'couverture'],
      heavy_renovation: ['demolition', 'courants_forts'],
    };

    if (requiredLots[projectType]?.includes(lotType)) {
      return 'required';
    }

    const lotDef = LOT_CATALOG.find(l => l.type === lotType);
    if (lotDef?.rgeEligible) {
      return 'recommended';
    }

    return 'optional';
  }

  // =============================================================================
  // PRIVATE METHODS - Déductions réglementaires
  // =============================================================================

  private async applyRegulatoryDeductions(
    projectId: string,
    project: Record<string, unknown>
  ): Promise<DeductionResult[]> {
    const results: DeductionResult[] = [];

    // Vérifier si permis requis
    const permitResult = await this.applyRule(projectId, 'DEDUC_020', {
      surfaceImpact: (project.work_project as Record<string, unknown>)?.scope,
      property: project.property,
    });
    results.push(permitResult);

    // Vérifier si architecte obligatoire
    const architectResult = await this.applyRule(projectId, 'DEDUC_021', {
      surfaceImpact: (project.work_project as Record<string, unknown>)?.scope,
      ownerType: (project.owner_profile as Record<string, unknown>)?.identity,
    });
    results.push(architectResult);

    return results;
  }

  private async deducePermitRequired(
    result: DeductionResult,
    context: Record<string, unknown>
  ): Promise<void> {
    result.ruleName = 'Autorisation urbanisme requise';

    const surfaceImpact = context.surfaceImpact as Record<string, number>;
    const extensionSurface = surfaceImpact?.extensionSurface || 0;
    const elevationSurface = surfaceImpact?.elevationSurface || 0;
    const totalNewSurface = extensionSurface + elevationSurface;

    let permitType = 'none';
    let reason = '';

    if (totalNewSurface > 40) {
      permitType = 'permis_construire';
      reason = `Surface créée (${totalNewSurface}m²) > 40m²`;
    } else if (totalNewSurface > 20) {
      permitType = 'permis_construire';
      reason = `Surface créée (${totalNewSurface}m²) > 20m² (zone urbaine PLU)`;
    } else if (totalNewSurface > 5) {
      permitType = 'declaration_prealable';
      reason = `Surface créée (${totalNewSurface}m²) entre 5 et 20m²`;
    }

    result.deducedData.push({
      field: 'project.regulatory.buildingPermits.permitType',
      value: permitType,
      confidence: 'high',
      source: 'rule_engine',
      requiresValidation: true,
      validated: false,
    });

    result.reasoning = reason || 'Aucune autorisation requise pour ces travaux';
    result.confidence = 'high';
  }

  private async deduceArchitectRequired(
    result: DeductionResult,
    context: Record<string, unknown>
  ): Promise<void> {
    result.ruleName = 'Architecte obligatoire';

    const surfaceImpact = context.surfaceImpact as Record<string, number>;
    const ownerType = context.ownerType as Record<string, string>;

    const projectedLivingArea = surfaceImpact?.projectedLivingArea || 0;
    const isB2C = ownerType?.type === 'B2C';

    let architectRequired = false;
    let reason = '';

    if (projectedLivingArea > 150 && isB2C) {
      architectRequired = true;
      reason = `Surface totale après travaux (${projectedLivingArea}m²) > 150m² pour un particulier`;
    }

    result.deducedData.push({
      field: 'project.regulatory.buildingPermits.architectRequired',
      value: architectRequired,
      confidence: 'high',
      source: 'rule_engine',
      requiresValidation: false,
      validated: true,
    });

    result.reasoning = reason || 'Recours à un architecte non obligatoire';
    result.confidence = 'high';
  }

  // =============================================================================
  // PRIVATE METHODS - Utilitaires
  // =============================================================================

  private getClimateZoneFromDept(dept: string): string {
    const zoneMapping: Record<string, string> = {
      // Zone H1a - Nord-Est
      '08': 'H1a', '10': 'H1a', '51': 'H1a', '52': 'H1a', '54': 'H1a',
      '55': 'H1a', '57': 'H1a', '67': 'H1a', '68': 'H1a', '88': 'H1a',
      // Zone H1b - Nord
      '02': 'H1b', '59': 'H1b', '60': 'H1b', '62': 'H1b', '80': 'H1b',
      // Zone H1c - Centre-Est
      '21': 'H1c', '25': 'H1c', '39': 'H1c', '58': 'H1c', '70': 'H1c',
      '71': 'H1c', '89': 'H1c', '90': 'H1c',
      // Zone H2a - Nord-Ouest
      '14': 'H2a', '22': 'H2a', '27': 'H2a', '28': 'H2a', '29': 'H2a',
      '35': 'H2a', '50': 'H2a', '53': 'H2a', '56': 'H2a', '61': 'H2a',
      '72': 'H2a', '76': 'H2a',
      // Zone H2b - Centre-Ouest (Île-de-France)
      '75': 'H2b', '77': 'H2b', '78': 'H2b', '91': 'H2b', '92': 'H2b',
      '93': 'H2b', '94': 'H2b', '95': 'H2b', '18': 'H2b', '36': 'H2b',
      '37': 'H2b', '41': 'H2b', '45': 'H2b',
      // Zone H2c - Sud-Ouest
      '16': 'H2c', '17': 'H2c', '19': 'H2c', '23': 'H2c', '24': 'H2c',
      '33': 'H2c', '40': 'H2c', '47': 'H2c', '64': 'H2c', '79': 'H2c',
      '85': 'H2c', '86': 'H2c', '87': 'H2c',
      // Zone H2d - Centre-Sud
      '01': 'H2d', '03': 'H2d', '07': 'H2d', '15': 'H2d', '26': 'H2d',
      '38': 'H2d', '42': 'H2d', '43': 'H2d', '63': 'H2d', '69': 'H2d',
      '73': 'H2d', '74': 'H2d',
      // Zone H3 - Méditerranée
      '04': 'H3', '05': 'H3', '06': 'H3', '09': 'H3', '11': 'H3',
      '12': 'H3', '13': 'H3', '30': 'H3', '31': 'H3', '32': 'H3',
      '34': 'H3', '46': 'H3', '48': 'H3', '65': 'H3', '66': 'H3',
      '81': 'H3', '82': 'H3', '83': 'H3', '84': 'H3',
    };

    return zoneMapping[dept] || 'H2b';
  }

  private estimateMaPrimeRenovAmount(
    rgeLots: typeof LOT_CATALOG,
    ownerProfile: Record<string, unknown>
  ): number {
    // Estimation simplifiée basée sur les lots
    let total = 0;

    for (const lot of rgeLots) {
      switch (lot.type) {
        case 'ite':
          total += 75 * 100; // 75€/m² pour 100m²
          break;
        case 'isolation_interieure':
          total += 25 * 100;
          break;
        case 'menuiseries_exterieures':
          total += 100 * 6; // 100€ par fenêtre
          break;
        case 'chauffage_central':
          total += 4000;
          break;
        case 'eau_chaude':
          total += 1200;
          break;
        case 'vmc_double_flux':
          total += 2500;
          break;
        default:
          total += 500;
      }
    }

    return total;
  }

  private estimateCEEAmount(rgeLots: typeof LOT_CATALOG): number {
    let total = 0;

    for (const lot of rgeLots) {
      switch (lot.type) {
        case 'ite':
        case 'isolation_interieure':
          total += 10 * 100; // 10€/m²
          break;
        case 'chauffage_central':
          total += 2500;
          break;
        case 'vmc_double_flux':
          total += 500;
          break;
        default:
          total += 200;
      }
    }

    return total;
  }

  private async saveDeductionResults(
    projectId: string,
    results: DeductionResult[]
  ): Promise<void> {
    for (const result of results) {
      await this.saveDeductionResult(projectId, result);
    }

    // Mettre à jour le compteur sur le projet
    await supabase
      .from('phase0_projects')
      .update({
        deductions_applied_count: results.filter(r => r.success).length,
        updated_at: new Date().toISOString(),
      })
      .eq('id', projectId);
  }

  private async saveDeductionResult(
    projectId: string,
    result: DeductionResult
  ): Promise<void> {
    await supabase.from('phase0_deductions').insert({
      id: result.id,
      project_id: projectId,
      rule_id: result.ruleId,
      rule_name: result.ruleName,
      category: 'property_enrichment',
      status: result.status,
      executed_at: result.timestamp,
      execution_time_ms: result.executionTimeMs,
      source_data: result.sourceData,
      source_fields: [],
      target_field: result.deducedData[0]?.field || '',
      deduced_value: result.deducedData[0]?.value,
      confidence: result.confidence,
      reasoning: result.reasoning,
      error_code: result.error?.code,
      error_message: result.error?.message,
    });
  }

  private async applyDeducedValueToProject(
    projectId: string,
    targetField: string,
    value: unknown
  ): Promise<void> {
    // Parser le chemin du champ (ex: "property.heritageStatus")
    const parts = targetField.split('.');

    if (parts[0] === 'property') {
      const { data: project } = await supabase
        .from('phase0_projects')
        .select('property')
        .eq('id', projectId)
        .single();

      if (project) {
        const property = project.property || {};
        this.setNestedValue(property, parts.slice(1), value);

        await supabase
          .from('phase0_projects')
          .update({ property, updated_at: new Date().toISOString() })
          .eq('id', projectId);
      }
    } else if (parts[0] === 'project') {
      const { data: project } = await supabase
        .from('phase0_projects')
        .select('work_project')
        .eq('id', projectId)
        .single();

      if (project) {
        const workProject = project.work_project || {};
        this.setNestedValue(workProject, parts.slice(1), value);

        await supabase
          .from('phase0_projects')
          .update({ work_project: workProject, updated_at: new Date().toISOString() })
          .eq('id', projectId);
      }
    }
  }

  private setNestedValue(
    obj: Record<string, unknown>,
    path: string[],
    value: unknown
  ): void {
    let current = obj;
    for (let i = 0; i < path.length - 1; i++) {
      if (!current[path[i]]) {
        current[path[i]] = {};
      }
      current = current[path[i]] as Record<string, unknown>;
    }
    current[path[path.length - 1]] = value;
  }
}

// Create instance for static methods to use
const deductionServiceInstance = new DeductionService();

// Export both the instance and allow class access
export const deductionService = deductionServiceInstance;
