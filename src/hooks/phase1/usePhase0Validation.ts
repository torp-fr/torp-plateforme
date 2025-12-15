/**
 * usePhase0Validation - Hook de validation des prérequis Phase 0
 *
 * Vérifie que le projet Phase 0 est complet avant de permettre
 * l'accès aux fonctionnalités Phase 1.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ValidationError {
  code: string;
  field: string;
  message: string;
  action: string;
  link?: string;
}

export interface ValidationWarning {
  code: string;
  message: string;
  recommendation?: string;
}

export interface Phase0ValidationResult {
  isValid: boolean;
  isLoading: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  completeness: number;
  refetch: () => void;
}

export function usePhase0Validation(projectId: string): Phase0ValidationResult {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['phase0-validation', projectId],
    queryFn: async () => validatePhase0(projectId),
    enabled: !!projectId,
    staleTime: 30000, // Cache 30 secondes
  });

  return {
    isValid: data?.isValid ?? false,
    isLoading,
    errors: data?.errors ?? [],
    warnings: data?.warnings ?? [],
    completeness: data?.completeness ?? 0,
    refetch,
  };
}

/**
 * Validation complète du projet Phase 0
 */
async function validatePhase0(projectId: string): Promise<{
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  completeness: number;
}> {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  let completeness = 0;

  try {
    // 1. Récupérer le projet Phase 0
    const { data: project, error: projectError } = await supabase
      .from('phase0_projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      errors.push({
        code: 'PROJECT_NOT_FOUND',
        field: 'project',
        message: 'Projet Phase 0 introuvable',
        action: 'Créer un projet Phase 0 avant de passer à la consultation',
        link: '/phase0/new',
      });
      return { isValid: false, errors, warnings, completeness: 0 };
    }

    completeness = project.completeness || 0;

    // 2. Vérifier profil propriétaire (obligatoire)
    const ownerProfile = project.owner_profile;
    if (!ownerProfile) {
      errors.push({
        code: 'OWNER_MISSING',
        field: 'owner_profile',
        message: 'Profil du maître d\'ouvrage non renseigné',
        action: 'Compléter le profil dans l\'étape "Votre profil"',
        link: `/phase0/${projectId}?step=profile`,
      });
    } else {
      // Vérifier les champs obligatoires du profil
      if (!ownerProfile.nom && !ownerProfile.raisonSociale) {
        errors.push({
          code: 'OWNER_NAME_MISSING',
          field: 'owner_profile.nom',
          message: 'Nom ou raison sociale du maître d\'ouvrage manquant',
          action: 'Renseigner le nom complet',
          link: `/phase0/${projectId}?step=profile`,
        });
      }

      if (!ownerProfile.email && !ownerProfile.contact?.email) {
        warnings.push({
          code: 'OWNER_EMAIL_MISSING',
          message: 'Email du maître d\'ouvrage non renseigné',
          recommendation: 'L\'email est nécessaire pour la communication avec les entreprises',
        });
      }
    }

    // 3. Vérifier adresse du bien (obligatoire)
    const property = project.property;
    if (!property?.address) {
      errors.push({
        code: 'ADDRESS_MISSING',
        field: 'property.address',
        message: 'Adresse du bien non renseignée',
        action: 'Renseigner l\'adresse complète du bien',
        link: `/phase0/${projectId}?step=property`,
      });
    } else {
      const address = property.address;
      if (!address.street && !address.streetName) {
        errors.push({
          code: 'STREET_MISSING',
          field: 'property.address.street',
          message: 'Rue non renseignée',
          action: 'Compléter l\'adresse avec le nom de la rue',
          link: `/phase0/${projectId}?step=property`,
        });
      }

      if (!address.postalCode) {
        errors.push({
          code: 'POSTAL_CODE_MISSING',
          field: 'property.address.postalCode',
          message: 'Code postal manquant',
          action: 'Renseigner le code postal',
          link: `/phase0/${projectId}?step=property`,
        });
      }

      if (!address.city) {
        errors.push({
          code: 'CITY_MISSING',
          field: 'property.address.city',
          message: 'Ville manquante',
          action: 'Renseigner la ville',
          link: `/phase0/${projectId}?step=property`,
        });
      }
    }

    // 4. Vérifier les lots sélectionnés (obligatoire)
    const selectedLots = project.selected_lots || [];
    if (selectedLots.length === 0) {
      errors.push({
        code: 'NO_LOTS_SELECTED',
        field: 'selected_lots',
        message: 'Aucun lot de travaux sélectionné',
        action: 'Sélectionner au moins un lot de travaux',
        link: `/phase0/${projectId}?step=lots`,
      });
    } else {
      // Vérifier que les lots ont des descriptions
      const lotsWithoutDescription = selectedLots.filter(
        (lot: any) => !lot.description && !lot.specifications
      );

      if (lotsWithoutDescription.length > 0) {
        warnings.push({
          code: 'LOTS_WITHOUT_DESCRIPTION',
          message: `${lotsWithoutDescription.length} lot(s) sans description détaillée`,
          recommendation: 'Ajouter des descriptions améliore la qualité des devis reçus',
        });
      }
    }

    // 5. Vérifier le budget (avertissement)
    const workProject = project.work_project;
    if (!workProject?.budget?.totalEnvelope && !workProject?.budget?.estimatedTotal) {
      warnings.push({
        code: 'BUDGET_NOT_ESTIMATED',
        message: 'Budget non estimé',
        recommendation: 'Définir une enveloppe budgétaire aide à filtrer les entreprises adaptées',
      });
    }

    // 6. Vérifier la génération du CCTP (avertissement)
    const { data: documents } = await supabase
      .from('phase0_documents')
      .select('type')
      .eq('project_id', projectId)
      .eq('type', 'cctp');

    if (!documents || documents.length === 0) {
      warnings.push({
        code: 'CCTP_NOT_GENERATED',
        message: 'CCTP non généré',
        recommendation: 'Un CCTP détaillé améliore la précision des devis',
      });
    }

    // 7. Vérifier la complétude globale (avertissement)
    if (completeness < 70) {
      warnings.push({
        code: 'LOW_COMPLETENESS',
        message: `Complétude du projet: ${completeness}%`,
        recommendation: 'Un projet complété à 80%+ donne de meilleurs résultats',
      });
    }

    // 8. Vérifier le statut du projet (avertissement)
    const validStatuses = ['validated', 'consultation_ready', 'in_consultation', 'quotes_received'];
    if (project.status && !validStatuses.includes(project.status)) {
      warnings.push({
        code: 'PROJECT_NOT_VALIDATED',
        message: `Statut du projet: ${translateStatus(project.status)}`,
        recommendation: 'Valider le projet avant de lancer la consultation',
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      completeness,
    };
  } catch (error) {
    console.error('Erreur validation Phase 0:', error);
    errors.push({
      code: 'VALIDATION_ERROR',
      field: 'system',
      message: 'Erreur lors de la validation du projet',
      action: 'Réessayer ou contacter le support',
    });
    return { isValid: false, errors, warnings, completeness: 0 };
  }
}

/**
 * Traduction des statuts
 */
function translateStatus(status: string): string {
  const translations: Record<string, string> = {
    draft: 'Brouillon',
    in_progress: 'En cours',
    awaiting_validation: 'En attente de validation',
    validated: 'Validé',
    consultation_ready: 'Prêt pour consultation',
    in_consultation: 'En consultation',
    quotes_received: 'Devis reçus',
    archived: 'Archivé',
  };
  return translations[status] || status;
}

export default usePhase0Validation;
