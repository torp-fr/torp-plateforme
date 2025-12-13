/**
 * Service de validation Phase 0
 * Valide les données du projet à différents niveaux de complétude
 */

import {
  Phase0Project,
  Phase0ValidationResult,
  Phase0FieldValidation,
  Phase0SectionCompleteness,
} from '@/types/phase0/project.types';
import { MasterOwnerProfile } from '@/types/phase0/owner.types';
import { Property } from '@/types/phase0/property.types';
import { WorkProject } from '@/types/phase0/work-project.types';
import { SelectedLot } from '@/types/phase0/lots.types';

export type ValidationLevel = 'minimal' | 'standard' | 'complete';
export type ValidationSeverity = 'error' | 'warning' | 'info';

interface ValidationRule {
  field: string;
  section: string;
  check: (value: unknown, context?: Record<string, unknown>) => boolean;
  message: string;
  severity: ValidationSeverity;
  level: ValidationLevel;
}

export class ValidationService {
  private static ownerRules: ValidationRule[] = [
    // Niveau minimal
    {
      field: 'identity.type',
      section: 'owner',
      check: (v) => !!v,
      message: 'Le type de maître d\'ouvrage est requis',
      severity: 'error',
      level: 'minimal',
    },
    {
      field: 'contact.email',
      section: 'owner',
      check: (v) => !!v && typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
      message: 'Une adresse email valide est requise',
      severity: 'error',
      level: 'minimal',
    },
    {
      field: 'contact.phone',
      section: 'owner',
      check: (v) => !!v,
      message: 'Un numéro de téléphone est requis',
      severity: 'error',
      level: 'minimal',
    },
    // Niveau standard
    {
      field: 'identity.firstName',
      section: 'owner',
      check: (v, ctx) => ctx?.type !== 'b2c' || !!v,
      message: 'Le prénom est requis pour les particuliers',
      severity: 'error',
      level: 'standard',
    },
    {
      field: 'identity.lastName',
      section: 'owner',
      check: (v, ctx) => ctx?.type !== 'b2c' || !!v,
      message: 'Le nom est requis pour les particuliers',
      severity: 'error',
      level: 'standard',
    },
    {
      field: 'identity.companyName',
      section: 'owner',
      check: (v, ctx) => ctx?.type === 'b2c' || !!v,
      message: 'La raison sociale est requise pour les professionnels',
      severity: 'error',
      level: 'standard',
    },
    {
      field: 'contact.preferredContactMethod',
      section: 'owner',
      check: (v) => !!v,
      message: 'Précisez le moyen de contact préféré',
      severity: 'warning',
      level: 'standard',
    },
    // Niveau complet
    {
      field: 'ownership.status',
      section: 'owner',
      check: (v) => !!v,
      message: 'Le statut de propriété est recommandé',
      severity: 'info',
      level: 'complete',
    },
    {
      field: 'financial.globalBudget',
      section: 'owner',
      check: (v) => !!v,
      message: 'Le budget global aide à calibrer les propositions',
      severity: 'info',
      level: 'complete',
    },
  ];

  private static propertyRules: ValidationRule[] = [
    // Niveau minimal
    {
      field: 'address.street',
      section: 'property',
      check: (v) => !!v,
      message: 'L\'adresse du bien est requise',
      severity: 'error',
      level: 'minimal',
    },
    {
      field: 'address.postalCode',
      section: 'property',
      check: (v) => !!v && typeof v === 'string' && /^\d{5}$/.test(v),
      message: 'Un code postal valide (5 chiffres) est requis',
      severity: 'error',
      level: 'minimal',
    },
    {
      field: 'address.city',
      section: 'property',
      check: (v) => !!v,
      message: 'La ville est requise',
      severity: 'error',
      level: 'minimal',
    },
    {
      field: 'characteristics.type',
      section: 'property',
      check: (v) => !!v,
      message: 'Le type de bien est requis',
      severity: 'error',
      level: 'minimal',
    },
    // Niveau standard
    {
      field: 'characteristics.livingArea',
      section: 'property',
      check: (v) => typeof v === 'number' && v > 0,
      message: 'La surface habitable doit être renseignée',
      severity: 'error',
      level: 'standard',
    },
    {
      field: 'characteristics.roomCount',
      section: 'property',
      check: (v) => typeof v === 'number' && v > 0,
      message: 'Le nombre de pièces est requis',
      severity: 'warning',
      level: 'standard',
    },
    {
      field: 'construction.yearBuilt',
      section: 'property',
      check: (v) => typeof v === 'number' && v >= 1800 && v <= new Date().getFullYear(),
      message: 'L\'année de construction aide à identifier les contraintes',
      severity: 'warning',
      level: 'standard',
    },
    {
      field: 'condition.overallState',
      section: 'property',
      check: (v) => !!v,
      message: 'L\'état général du bien est requis',
      severity: 'warning',
      level: 'standard',
    },
    // Niveau complet
    {
      field: 'identification.cadastralReferences',
      section: 'property',
      check: (v) => Array.isArray(v) && v.length > 0,
      message: 'Les références cadastrales sont utiles pour les autorisations',
      severity: 'info',
      level: 'complete',
    },
    {
      field: 'diagnostics.dpe.rating',
      section: 'property',
      check: (v) => !!v,
      message: 'Le DPE est obligatoire et aide à définir les travaux énergétiques',
      severity: 'warning',
      level: 'complete',
    },
    {
      field: 'heritage.isClassified',
      section: 'property',
      check: (v) => v !== undefined,
      message: 'Préciser si le bien est classé/inscrit aux monuments historiques',
      severity: 'info',
      level: 'complete',
    },
  ];

  private static projectRules: ValidationRule[] = [
    // Niveau minimal
    {
      field: 'general.title',
      section: 'project',
      check: (v) => !!v && typeof v === 'string' && v.length >= 5,
      message: 'Un titre de projet (min 5 caractères) est requis',
      severity: 'error',
      level: 'minimal',
    },
    {
      field: 'scope.workType',
      section: 'project',
      check: (v) => !!v,
      message: 'Le type de travaux est requis',
      severity: 'error',
      level: 'minimal',
    },
    // Niveau standard
    {
      field: 'general.description',
      section: 'project',
      check: (v) => !!v && typeof v === 'string' && v.length >= 20,
      message: 'Une description détaillée (min 20 caractères) est recommandée',
      severity: 'warning',
      level: 'standard',
    },
    {
      field: 'constraints.temporal.desiredStartDate',
      section: 'project',
      check: (v) => !!v,
      message: 'La date de début souhaitée aide à planifier',
      severity: 'warning',
      level: 'standard',
    },
    {
      field: 'budget.totalEnvelope',
      section: 'project',
      check: (v) => v && typeof v === 'object' && ('min' in v || 'max' in v),
      message: 'L\'enveloppe budgétaire est requise pour dimensionner le projet',
      severity: 'error',
      level: 'standard',
    },
    // Niveau complet
    {
      field: 'constraints.occupancy.duringWorks',
      section: 'project',
      check: (v) => !!v,
      message: 'Précisez si le logement sera occupé pendant les travaux',
      severity: 'info',
      level: 'complete',
    },
    {
      field: 'quality.finishLevel',
      section: 'project',
      check: (v) => !!v,
      message: 'Le niveau de finition attendu aide à calibrer les devis',
      severity: 'info',
      level: 'complete',
    },
    {
      field: 'regulatory.declarationType',
      section: 'project',
      check: (v) => !!v,
      message: 'Le type de déclaration administrative est important',
      severity: 'warning',
      level: 'complete',
    },
  ];

  private static lotsRules: ValidationRule[] = [
    {
      field: 'lots',
      section: 'lots',
      check: (v) => Array.isArray(v) && v.length > 0,
      message: 'La sélection de lots de travaux est recommandée pour une estimation précise',
      severity: 'info',
      level: 'standard',
    },
    {
      field: 'lots',
      section: 'lots',
      check: (v) => {
        if (!Array.isArray(v)) return true;
        return v.every((lot: SelectedLot) => lot.priority);
      },
      message: 'Tous les lots doivent avoir une priorité définie',
      severity: 'warning',
      level: 'standard',
    },
    {
      field: 'lots',
      section: 'lots',
      check: (v) => {
        if (!Array.isArray(v)) return true;
        return v.every((lot: SelectedLot) => lot.description && lot.description.length > 0);
      },
      message: 'Tous les lots devraient avoir une description',
      severity: 'info',
      level: 'complete',
    },
  ];

  /**
   * Valide un projet Phase 0 complet
   */
  static validateProject(
    project: Partial<Phase0Project>,
    level: ValidationLevel = 'standard'
  ): Phase0ValidationResult {
    const validations: Phase0FieldValidation[] = [];

    // Valider chaque section
    if (project.owner) {
      validations.push(...this.validateOwner(project.owner, level));
    } else {
      validations.push({
        field: 'owner',
        section: 'owner',
        isValid: false,
        message: 'Les informations du maître d\'ouvrage sont requises',
        severity: 'error',
      });
    }

    if (project.property) {
      validations.push(...this.validateProperty(project.property, level));
    } else {
      validations.push({
        field: 'property',
        section: 'property',
        isValid: false,
        message: 'Les informations du bien sont requises',
        severity: 'error',
      });
    }

    if (project.workProject) {
      validations.push(...this.validateWorkProject(project.workProject, level));
    } else {
      validations.push({
        field: 'workProject',
        section: 'project',
        isValid: false,
        message: 'Les informations du projet sont requises',
        severity: 'error',
      });
    }

    // Valider les lots
    validations.push(...this.validateLots(project.selectedLots || [], level));

    // Calculer les statistiques
    const errors = validations.filter(v => !v.isValid && v.severity === 'error');
    const warnings = validations.filter(v => !v.isValid && v.severity === 'warning');
    const infos = validations.filter(v => !v.isValid && v.severity === 'info');

    return {
      isValid: errors.length === 0,
      canProceed: errors.length === 0 && (level === 'minimal' || warnings.length < 5),
      completeness: this.calculateCompleteness(project, validations),
      validations,
      errorCount: errors.length,
      warningCount: warnings.length,
      infoCount: infos.length,
    };
  }

  /**
   * Valide les informations du maître d'ouvrage
   */
  static validateOwner(
    owner: Partial<MasterOwnerProfile>,
    level: ValidationLevel = 'standard'
  ): Phase0FieldValidation[] {
    const context = { type: owner?.identity?.type };
    return this.applyRules(this.ownerRules, owner, level, context);
  }

  /**
   * Valide les informations du bien
   */
  static validateProperty(
    property: Partial<Property>,
    level: ValidationLevel = 'standard'
  ): Phase0FieldValidation[] {
    return this.applyRules(this.propertyRules, property, level);
  }

  /**
   * Valide les informations du projet
   */
  static validateWorkProject(
    workProject: Partial<WorkProject>,
    level: ValidationLevel = 'standard'
  ): Phase0FieldValidation[] {
    return this.applyRules(this.projectRules, workProject, level);
  }

  /**
   * Valide les lots sélectionnés
   */
  static validateLots(
    lots: SelectedLot[],
    level: ValidationLevel = 'standard'
  ): Phase0FieldValidation[] {
    return this.applyRules(this.lotsRules, { lots }, level);
  }

  /**
   * Calcule le pourcentage de complétude par section
   */
  static calculateSectionCompleteness(
    project: Partial<Phase0Project>
  ): Phase0SectionCompleteness {
    const sections: Phase0SectionCompleteness = {
      owner: 0,
      property: 0,
      project: 0,
      lots: 0,
      overall: 0,
    };

    // Calculer la complétude de chaque section
    if (project.owner) {
      sections.owner = this.calculateFieldCompleteness(project.owner, [
        'identity.type',
        'identity.firstName',
        'identity.lastName',
        'contact.email',
        'contact.phone',
        'contact.preferredContactMethod',
        'ownership.status',
        'financial.globalBudget',
      ]);
    }

    if (project.property) {
      sections.property = this.calculateFieldCompleteness(project.property, [
        'address.street',
        'address.postalCode',
        'address.city',
        'characteristics.type',
        'characteristics.livingArea',
        'characteristics.roomCount',
        'construction.yearBuilt',
        'condition.overallState',
        'diagnostics.dpe.rating',
      ]);
    }

    if (project.workProject) {
      sections.project = this.calculateFieldCompleteness(project.workProject, [
        'general.title',
        'general.description',
        'scope.workType',
        'constraints.temporal.desiredStartDate',
        'budget.totalEnvelope',
        'quality.finishLevel',
      ]);
    }

    // Lots: basé sur le nombre de lots avec description complète
    if (project.selectedLots && project.selectedLots.length > 0) {
      const completeLots = project.selectedLots.filter(
        lot => lot.description && lot.priority && lot.estimatedBudget
      ).length;
      sections.lots = Math.round((completeLots / project.selectedLots.length) * 100);
    }

    // Moyenne pondérée
    sections.overall = Math.round(
      (sections.owner * 0.2 + sections.property * 0.25 + sections.project * 0.25 + sections.lots * 0.3)
    );

    return sections;
  }

  /**
   * Obtient la liste des champs manquants pour atteindre un niveau
   */
  static getMissingFields(
    project: Partial<Phase0Project>,
    targetLevel: ValidationLevel = 'standard'
  ): Array<{ field: string; section: string; message: string }> {
    const validation = this.validateProject(project, targetLevel);

    return validation.validations
      .filter(v => !v.isValid && (v.severity === 'error' || v.severity === 'warning'))
      .map(v => ({
        field: v.field,
        section: v.section,
        message: v.message,
      }));
  }

  /**
   * Vérifie si un projet peut passer à l'étape suivante
   * NOTE: Les cases correspondent à l'index de l'étape actuelle + 1 (1-indexed)
   *
   * B2C Wizard steps order: Profile(1), Property(2), Works(3), Constraints(4), Budget(5), Summary(6)
   * B2B Wizard steps order: Client(1), Site(2), Works(3), Constraints(4), Budget(5), Summary(6)
   */
  static canProceedToNextStep(
    project: Partial<Phase0Project>,
    currentStep: number,
    mode: 'b2c' | 'b2b' | 'b2b_professional' = 'b2c'
  ): { canProceed: boolean; blockers: string[] } {
    const blockers: string[] = [];
    const isB2B = mode === 'b2b' || mode === 'b2b_professional';

    // Accès aux données selon le mode
    const owner = project.ownerProfile || project.owner;
    const client = project.client as Record<string, unknown> | undefined;
    const clientIdentity = client?.identity as Record<string, unknown> | undefined;
    const clientContext = client?.context as Record<string, unknown> | undefined;
    const clientSite = client?.site as Record<string, unknown> | undefined;
    const siteAddress = clientSite?.address as Record<string, unknown> | undefined;

    // B2B Mode: Navigation libre pour faciliter l'utilisation
    // La validation complète se fait à la finalisation du projet
    if (isB2B) {
      switch (currentStep) {
        case 1: // Client & Projet - type de client requis
          if (!clientIdentity?.clientType) {
            blockers.push('Sélectionnez le type de client');
          }
          break;
        // Étapes 2-6: Navigation libre, pas de blocage
        // Cela permet aux pros de remplir les infos dans l'ordre qu'ils souhaitent
        default:
          break;
      }
      return { canProceed: blockers.length === 0, blockers };
    }

    // B2C Mode: Validation stricte par étape
    switch (currentStep) {
      case 1: // Profil MOA - seulement le type est requis pour avancer
        if (!owner?.identity?.type) {
          blockers.push('Sélectionnez votre profil (particulier, professionnel, etc.)');
        }
        break;

      case 2: // Identification bien (adresse)
        if (!project.property?.address?.street) {
          blockers.push('L\'adresse du bien est requise');
        }
        if (!project.property?.address?.postalCode) {
          blockers.push('Le code postal est requis');
        }
        if (!project.property?.characteristics?.type) {
          blockers.push('Le type de bien est requis');
        }
        break;

      case 3: // Intention travaux - seulement workType requis
        if (!project.workProject?.scope?.workType) {
          blockers.push('Le type de travaux est requis');
        }
        // Les lots sont optionnels - suggérés automatiquement
        break;

      case 4: // Contraintes - étape optionnelle
        // Aucun blocage, étape optionnelle
        break;

      case 5: // Budget et détails du bien
        // Rendre optionnel pour l'instant
        break;

      case 6: // Validation finale - pas de blocage
        // Les étapes précédentes ont validé les champs essentiels
        // L'utilisateur peut terminer même avec des informations partielles
        // La validation complète se fait dans complete() mais n'est pas bloquante
        break;
    }

    return {
      canProceed: blockers.length === 0,
      blockers,
    };
  }

  /**
   * Valide un champ spécifique
   */
  static validateField(
    field: string,
    value: unknown,
    section: 'owner' | 'property' | 'project' | 'lots'
  ): Phase0FieldValidation | null {
    const rules = this.getRulesForSection(section);
    const rule = rules.find(r => r.field === field);

    if (!rule) return null;

    const isValid = rule.check(value);
    return {
      field,
      section,
      isValid,
      message: isValid ? '' : rule.message,
      severity: rule.severity,
    };
  }

  // Méthodes privées

  private static applyRules(
    rules: ValidationRule[],
    data: Record<string, unknown>,
    level: ValidationLevel,
    context?: Record<string, unknown>
  ): Phase0FieldValidation[] {
    const levelPriority: Record<ValidationLevel, number> = {
      minimal: 1,
      standard: 2,
      complete: 3,
    };

    return rules
      .filter(rule => levelPriority[rule.level] <= levelPriority[level])
      .map(rule => {
        const value = this.getNestedValue(data, rule.field);
        const isValid = rule.check(value, context);

        return {
          field: rule.field,
          section: rule.section,
          isValid,
          message: isValid ? '' : rule.message,
          severity: rule.severity,
        };
      });
  }

  private static getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce((current: unknown, key: string) => {
      if (current && typeof current === 'object') {
        return (current as Record<string, unknown>)[key];
      }
      return undefined;
    }, obj);
  }

  private static calculateCompleteness(
    project: Partial<Phase0Project>,
    validations: Phase0FieldValidation[]
  ): number {
    const sections = this.calculateSectionCompleteness(project);
    return sections.overall;
  }

  private static calculateFieldCompleteness(
    data: Record<string, unknown>,
    fields: string[]
  ): number {
    let filled = 0;

    fields.forEach(field => {
      const value = this.getNestedValue(data, field);
      if (value !== undefined && value !== null && value !== '') {
        filled++;
      }
    });

    return Math.round((filled / fields.length) * 100);
  }

  private static getRulesForSection(section: string): ValidationRule[] {
    switch (section) {
      case 'owner':
        return this.ownerRules;
      case 'property':
        return this.propertyRules;
      case 'project':
        return this.projectRules;
      case 'lots':
        return this.lotsRules;
      default:
        return [];
    }
  }
}

export default ValidationService;
