/**
 * TORP Phase0 Context Adapter
 * Transforme un Phase0Project complet en Phase0AnalysisContext simplifié pour l'analyse
 */

import type { Phase0Project, WorkLot, LotCategory } from '@/types/phase0';
import type { Phase0AnalysisContext } from './connection.service';

export class Phase0ContextAdapter {
  /**
   * Convertit un Phase0Project complet en contexte d'analyse simplifié
   */
  static toAnalysisContext(project: Phase0Project): Phase0AnalysisContext {
    return {
      projectId: project.id,
      projectReference: project.torpMetadata?.reference,

      budget: this.extractBudget(project),
      expectedLots: this.extractExpectedLots(project),
      constraints: this.extractConstraints(project),
      ownerProfile: this.extractOwnerProfile(project),
      location: this.extractLocation(project),
      workType: this.extractWorkType(project),
    };
  }

  /**
   * Extrait les informations budgétaires
   */
  private static extractBudget(project: Phase0Project): Phase0AnalysisContext['budget'] {
    const workBudget = project.workProject?.budget;
    const ownerBudget = project.ownerProfile?.financialCapacity?.budgetEnvelope;

    // Priorité au budget projet, sinon budget propriétaire
    const totalEnvelope = workBudget?.totalEnvelope?.amount ||
      ownerBudget?.maxAmount ||
      0;

    const minBudget = workBudget?.totalEnvelope?.minAmount ||
      ownerBudget?.minAmount ||
      totalEnvelope * 0.8;

    const maxBudget = workBudget?.totalEnvelope?.maxAmount ||
      ownerBudget?.maxAmount ||
      totalEnvelope * 1.2;

    const contingencyPercent = workBudget?.contingency?.percentageOfTotal || 10;

    return {
      totalEnvelope,
      minBudget,
      maxBudget,
      contingencyPercent,
    };
  }

  /**
   * Extrait les lots de travaux attendus
   */
  private static extractExpectedLots(project: Phase0Project): Phase0AnalysisContext['expectedLots'] {
    if (!project.selectedLots?.length) {
      return [];
    }

    return project.selectedLots.map(lot => ({
      category: lot.category,
      type: lot.type,
      label: lot.label || lot.type,
      estimatedBudget: lot.estimation ? {
        min: lot.estimation.totalHT?.min || 0,
        max: lot.estimation.totalHT?.max || 0,
      } : undefined,
      priority: lot.isRequired ? 'required' : 'optional',
    }));
  }

  /**
   * Extrait les contraintes du projet
   */
  private static extractConstraints(project: Phase0Project): Phase0AnalysisContext['constraints'] {
    const temporal = project.workProject?.constraints?.temporal;
    const regulatory = project.workProject?.regulatory;
    const physical = project.workProject?.constraints?.physical;
    const technical = project.workProject?.constraints?.technical;

    // Vérifier si RGE est requis (travaux éligibles aux aides)
    const rgeRequired = project.selectedLots?.some(lot =>
      lot.isRGEEligible || lot.category === 'energy'
    ) || false;

    // Vérifier si le bien est protégé
    const heritageProtection = project.property?.heritage?.isProtected || false;

    // Vérifier si permis requis
    const permitRequired = regulatory?.buildingPermit?.required || false;

    // Extraire les périodes d'exclusion
    const blackoutPeriods = temporal?.blackoutPeriods?.map(bp => ({
      start: bp.startDate,
      end: bp.endDate,
      reason: bp.reason || 'Période non disponible',
    })) || [];

    // Extraire les restrictions d'accès
    const accessRestrictions: string[] = [];
    if (physical?.siteAccess?.vehicleAccess === 'limited') {
      accessRestrictions.push('Accès véhicules limité');
    }
    if (physical?.siteAccess?.hasStairs && !physical?.siteAccess?.hasElevator) {
      accessRestrictions.push('Escaliers sans ascenseur');
    }
    if (physical?.parkingAvailability === 'none') {
      accessRestrictions.push('Pas de stationnement');
    }

    // Extraire les exigences spécifiques
    const specificRequirements: string[] = [];
    if (technical?.acoustic?.required) {
      specificRequirements.push(`Isolation acoustique: ${technical.acoustic.targetLevel || 'standard'}`);
    }
    if (technical?.thermal?.targetClass) {
      specificRequirements.push(`Performance thermique cible: ${technical.thermal.targetClass}`);
    }
    if (technical?.accessibility?.required) {
      specificRequirements.push('Accessibilité PMR requise');
    }

    return {
      startDate: temporal?.preferredStart || undefined,
      endDate: temporal?.deadline?.date || undefined,
      maxDuration: temporal?.maxDuration || undefined,
      blackoutPeriods: blackoutPeriods.length > 0 ? blackoutPeriods : undefined,
      heritageProtection,
      permitRequired,
      rgeRequired,
      accessRestrictions: accessRestrictions.length > 0 ? accessRestrictions : undefined,
      specificRequirements: specificRequirements.length > 0 ? specificRequirements : undefined,
    };
  }

  /**
   * Extrait le profil du maître d'ouvrage
   */
  private static extractOwnerProfile(project: Phase0Project): Phase0AnalysisContext['ownerProfile'] {
    const owner = project.ownerProfile;

    // Déterminer le type
    let type: 'B2C' | 'B2B' | 'B2G' = 'B2C';
    if (owner?.identity?.type === 'company') {
      type = 'B2B';
    } else if (owner?.identity?.type === 'public_entity') {
      type = 'B2G';
    }

    // Déterminer le niveau d'expertise
    let expertiseLevel: 'novice' | 'intermediate' | 'expert' = 'novice';
    const experience = owner?.expertise?.projectExperience;
    if (experience?.projectCount && experience.projectCount >= 3) {
      expertiseLevel = 'expert';
    } else if (experience?.projectCount && experience.projectCount >= 1) {
      expertiseLevel = 'intermediate';
    }
    if (owner?.expertise?.professionalBackground?.hasBTPExperience) {
      expertiseLevel = 'expert';
    }

    // Extraire les facteurs de priorité
    const priorityFactors: string[] = [];
    const psychological = owner?.psychological;
    if (psychological?.priorityFactors) {
      priorityFactors.push(...psychological.priorityFactors);
    }

    // Déterminer le style de communication
    let communicationStyle: 'simple' | 'detailed' | 'technical' = 'simple';
    if (type === 'B2B' || expertiseLevel === 'expert') {
      communicationStyle = 'technical';
    } else if (expertiseLevel === 'intermediate') {
      communicationStyle = 'detailed';
    }

    return {
      type,
      expertiseLevel,
      priorityFactors,
      communicationStyle,
    };
  }

  /**
   * Extrait la localisation
   */
  private static extractLocation(project: Phase0Project): Phase0AnalysisContext['location'] {
    const address = project.property?.address;

    if (!address) {
      return {};
    }

    return {
      region: address.region || undefined,
      department: address.department || undefined,
      city: address.city || undefined,
      postalCode: address.postalCode || undefined,
    };
  }

  /**
   * Extrait le type de travaux principal
   */
  private static extractWorkType(project: Phase0Project): Phase0AnalysisContext['workType'] {
    const workProject = project.workProject;

    // Type principal depuis le projet
    const mainType = workProject?.general?.type || 'renovation';

    // Catégories depuis les lots sélectionnés
    const categories: string[] = [];
    if (project.selectedLots?.length) {
      const uniqueCategories = new Set(project.selectedLots.map(l => l.category));
      categories.push(...uniqueCategories);
    }

    // Ajouter le sous-type si disponible
    const subTypes = workProject?.general?.subTypes || [];

    return {
      main: mainType,
      categories: [...categories, ...subTypes],
    };
  }

  /**
   * Valide qu'un contexte Phase0 est suffisamment complet pour enrichir l'analyse
   */
  static validateContext(context: Phase0AnalysisContext): {
    isValid: boolean;
    completeness: number;
    missingElements: string[];
  } {
    const missingElements: string[] = [];
    let score = 0;
    const maxScore = 10;

    // Budget (3 points)
    if (context.budget.totalEnvelope && context.budget.totalEnvelope > 0) {
      score += 3;
    } else {
      missingElements.push('Budget estimé');
    }

    // Lots attendus (3 points)
    if (context.expectedLots.length > 0) {
      score += 3;
    } else {
      missingElements.push('Lots de travaux sélectionnés');
    }

    // Localisation (2 points)
    if (context.location.postalCode || context.location.city) {
      score += 2;
    } else {
      missingElements.push('Localisation du bien');
    }

    // Type de travaux (2 points)
    if (context.workType.main) {
      score += 2;
    } else {
      missingElements.push('Type de travaux');
    }

    return {
      isValid: score >= 5, // Au moins 50% de complétude
      completeness: Math.round((score / maxScore) * 100),
      missingElements,
    };
  }
}
