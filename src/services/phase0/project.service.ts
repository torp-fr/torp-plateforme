/**
 * TORP Phase 0 - Service de gestion des projets
 * CRUD et gestion des projets Phase 0
 */

import { supabase } from '@/lib/supabase';
import type {
  Phase0Project,
  Phase0Status,
  Phase0Summary,
  Phase0ProjectFilter,
  Phase0ProjectList,
  CreateProjectPayload,
  UpdateProjectPayload,
  WizardMode,
  MasterOwnerProfile,
  Property,
  WorkProject,
  WorkLot,
} from '@/types/phase0';

// =============================================================================
// TYPES
// =============================================================================

interface Phase0ProjectRow {
  id: string;
  user_id: string;
  name: string;
  reference_number: string | null;
  owner_profile: MasterOwnerProfile;
  property: Property;
  work_project: WorkProject;
  selected_lots: WorkLot[];
  status: Phase0Status;
  wizard_mode: WizardMode;
  completeness: number;
  is_validated: boolean;
  validated_at: string | null;
  validated_by: string | null;
  validation_method: string | null;
  validation_score: Record<string, unknown> | null;
  wizard_state: Record<string, unknown>;
  current_step: number;
  total_steps: number;
  deductions: unknown[];
  deductions_applied_count: number;
  alerts: unknown[];
  estimated_budget_min: number | null;
  estimated_budget_max: number | null;
  estimated_budget_target: number | null;
  currency: string;
  target_start_date: string | null;
  target_end_date: string | null;
  estimated_duration_days: number | null;
  property_type: string | null;
  property_address: string | null;
  property_city: string | null;
  property_postal_code: string | null;
  property_surface: number | null;
  selected_lots_count: number;
  rge_lots_count: number;
  aids_eligible_amount: number | null;
  metadata: Record<string, unknown>;
  tags: string[];
  created_at: string;
  updated_at: string;
  last_activity_at: string;
  archived_at: string | null;
}

// =============================================================================
// SERVICE
// =============================================================================

export class Phase0ProjectService {
  // Static methods for compatibility with useWizard hook

  /**
   * Get project by ID (static version)
   */
  static async getProjectById(projectId: string): Promise<Phase0Project | null> {
    return phase0ProjectServiceInstance.getProjectById(projectId);
  }

  /**
   * Update project (static version)
   */
  static async updateProject(projectId: string, updates: Partial<Phase0Project>): Promise<Phase0Project> {
    return phase0ProjectServiceInstance.updateProject({
      projectId,
      updates: {
        ownerProfile: updates.ownerProfile,
        property: updates.property,
        workProject: updates.workProject,
        selectedLots: updates.selectedLots,
        status: updates.status,
        wizardState: updates.wizardState,
        deductions: updates.deductions,
        alerts: updates.alerts,
        completeness: updates.completeness,
        validation: updates.validation,
      },
    });
  }

  /**
   * Create project (static version)
   */
  static async createProject(userId: string, data: Partial<Phase0Project>): Promise<Phase0Project> {
    return phase0ProjectServiceInstance.createProject({
      userId,
      wizardMode: data.wizardMode || 'b2c',
      initialData: {
        ownerProfile: data.ownerProfile,
        property: data.property,
        workProject: data.workProject,
        selectedLots: data.selectedLots,
      },
    });
  }

  /**
   * Change project status (static version)
   */
  static async changeStatus(projectId: string, status: Phase0Status): Promise<Phase0Project> {
    return phase0ProjectServiceInstance.changeStatus(projectId, status);
  }
  /**
   * Créer un nouveau projet Phase 0
   */
  async createProject(payload: CreateProjectPayload): Promise<Phase0Project> {
    const { userId, wizardMode, initialData } = payload;

    const defaultOwnerProfile: Partial<MasterOwnerProfile> = {
      identity: { type: 'B2C' } as MasterOwnerProfile['identity'],
      contact: { email: '', preferredContact: 'email' },
      torpMetadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: userId,
        version: 1,
        source: 'user_input',
        completeness: 0,
        aiEnriched: false,
      },
    };

    const defaultProperty: Partial<Property> = {
      identification: {
        type: 'house',
        address: {
          streetName: '',
          postalCode: '',
          city: '',
          country: 'France',
        },
        cadastralReferences: [],
      },
      torpMetadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: userId,
        version: 1,
        source: 'user_input',
        completeness: 0,
        aiEnriched: false,
      },
    };

    const defaultWorkProject: Partial<WorkProject> = {
      general: {
        name: 'Nouveau projet',
        description: '',
        projectType: 'renovation',
        objectives: [],
        primaryMotivation: 'comfort_improvement',
        secondaryMotivations: [],
      },
      torpMetadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: userId,
        version: 1,
        source: 'user_input',
        completeness: 0,
        aiEnriched: false,
      },
    };

    const { data, error } = await supabase
      .from('phase0_projects')
      .insert({
        user_id: userId,
        name: initialData?.workProject?.general?.name || 'Nouveau projet',
        wizard_mode: wizardMode,
        owner_profile: initialData?.ownerProfile || defaultOwnerProfile,
        property: initialData?.property || defaultProperty,
        work_project: initialData?.workProject || defaultWorkProject,
        selected_lots: initialData?.selectedLots || [],
        status: 'draft',
        completeness: 0,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating Phase 0 project:', error);
      throw new Error(`Erreur lors de la création du projet: ${error.message}`);
    }

    // Créer l'entrée wizard progress
    await supabase.from('phase0_wizard_progress').insert({
      project_id: data.id,
      current_step: 1,
      total_steps: 6,
      step_data: {},
      step_completion: {},
    });

    return this.mapRowToProject(data);
  }

  /**
   * Récupérer un projet par ID
   */
  async getProjectById(projectId: string): Promise<Phase0Project | null> {
    const { data, error } = await supabase
      .from('phase0_projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      console.error('Error fetching Phase 0 project:', error);
      throw new Error(`Erreur lors de la récupération du projet: ${error.message}`);
    }

    return this.mapRowToProject(data);
  }

  /**
   * Récupérer les projets d'un utilisateur
   */
  async getUserProjects(
    userId: string,
    filter?: Phase0ProjectFilter
  ): Promise<Phase0ProjectList> {
    let query = supabase
      .from('phase0_projects')
      .select('*', { count: 'exact' })
      .eq('user_id', userId);

    // Appliquer les filtres
    if (filter?.status && filter.status.length > 0) {
      query = query.in('status', filter.status);
    }

    if (filter?.completenessMin !== undefined) {
      query = query.gte('completeness', filter.completenessMin);
    }

    if (filter?.completenessMax !== undefined) {
      query = query.lte('completeness', filter.completenessMax);
    }

    if (filter?.budgetMin !== undefined) {
      query = query.gte('estimated_budget_target', filter.budgetMin);
    }

    if (filter?.budgetMax !== undefined) {
      query = query.lte('estimated_budget_target', filter.budgetMax);
    }

    if (filter?.createdAfter) {
      query = query.gte('created_at', filter.createdAfter);
    }

    if (filter?.createdBefore) {
      query = query.lte('created_at', filter.createdBefore);
    }

    if (filter?.searchQuery) {
      query = query.or(
        `name.ilike.%${filter.searchQuery}%,property_city.ilike.%${filter.searchQuery}%,property_address.ilike.%${filter.searchQuery}%`
      );
    }

    // Tri
    const sortBy = filter?.sortBy || 'createdAt';
    const sortOrder = filter?.sortOrder || 'desc';
    const sortColumn = this.mapSortField(sortBy);
    query = query.order(sortColumn, { ascending: sortOrder === 'asc' });

    // Pagination
    const page = filter?.page || 1;
    const pageSize = filter?.pageSize || 10;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching user projects:', error);
      throw new Error(`Erreur lors de la récupération des projets: ${error.message}`);
    }

    const items: Phase0Summary[] = (data || []).map(row => this.mapRowToSummary(row));

    return {
      items,
      total: count || 0,
      page,
      pageSize,
      hasMore: (count || 0) > page * pageSize,
    };
  }

  /**
   * Mettre à jour un projet
   */
  async updateProject(payload: UpdateProjectPayload): Promise<Phase0Project> {
    const { projectId, updates } = payload;

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      last_activity_at: new Date().toISOString(),
    };

    if (updates.ownerProfile) {
      updateData.owner_profile = updates.ownerProfile;
    }

    if (updates.property) {
      updateData.property = updates.property;
      // Mettre à jour les champs dénormalisés
      if (updates.property.identification) {
        updateData.property_type = updates.property.identification.type;
        if (updates.property.identification.address) {
          const addr = updates.property.identification.address;
          updateData.property_address = addr.formattedAddress || `${addr.streetNumber || ''} ${addr.streetName}`.trim();
          updateData.property_city = addr.city;
          updateData.property_postal_code = addr.postalCode;
        }
      }
      if (updates.property.characteristics?.surfaces) {
        updateData.property_surface = updates.property.characteristics.surfaces.livingArea;
      }
    }

    if (updates.workProject) {
      updateData.work_project = updates.workProject;
      if (updates.workProject.general?.name) {
        updateData.name = updates.workProject.general.name;
      }
      if (updates.workProject.budget?.envelope) {
        updateData.estimated_budget_min = updates.workProject.budget.envelope.minBudget;
        updateData.estimated_budget_max = updates.workProject.budget.envelope.maxBudget;
        updateData.estimated_budget_target = updates.workProject.budget.envelope.targetBudget;
        updateData.currency = updates.workProject.budget.envelope.currency;
      }
      if (updates.workProject.planning?.timeline) {
        updateData.target_start_date = updates.workProject.planning.timeline.worksStart;
        updateData.target_end_date = updates.workProject.planning.timeline.worksEnd;
      }
    }

    if (updates.selectedLots) {
      updateData.selected_lots = updates.selectedLots;
    }

    if (updates.status) {
      updateData.status = updates.status;
    }

    if (updates.wizardState) {
      updateData.wizard_state = updates.wizardState;
      updateData.current_step = updates.wizardState.currentStepIndex;
    }

    if (updates.deductions) {
      updateData.deductions = updates.deductions;
      updateData.deductions_applied_count = updates.deductions.length;
    }

    if (updates.alerts) {
      updateData.alerts = updates.alerts;
    }

    if (updates.completeness !== undefined) {
      updateData.completeness = updates.completeness.overall;
    }

    if (updates.validation) {
      updateData.is_validated = updates.validation.isValid;
      updateData.validated_at = updates.validation.validatedAt;
      updateData.validated_by = updates.validation.validatedBy;
      updateData.validation_method = updates.validation.validationMethod;
      updateData.validation_score = updates.validation.score;
    }

    const { data, error } = await supabase
      .from('phase0_projects')
      .update(updateData)
      .eq('id', projectId)
      .select()
      .single();

    if (error) {
      console.error('Error updating Phase 0 project:', error);
      throw new Error(`Erreur lors de la mise à jour du projet: ${error.message}`);
    }

    return this.mapRowToProject(data);
  }

  /**
   * Changer le statut d'un projet
   */
  async changeStatus(
    projectId: string,
    newStatus: Phase0Status,
    reason?: string
  ): Promise<Phase0Project> {
    const updateData: Record<string, unknown> = {
      status: newStatus,
      updated_at: new Date().toISOString(),
    };

    if (newStatus === 'archived') {
      updateData.archived_at = new Date().toISOString();
    }

    if (newStatus === 'validated') {
      updateData.is_validated = true;
      updateData.validated_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('phase0_projects')
      .update(updateData)
      .eq('id', projectId)
      .select()
      .single();

    if (error) {
      console.error('Error changing project status:', error);
      throw new Error(`Erreur lors du changement de statut: ${error.message}`);
    }

    return this.mapRowToProject(data);
  }

  /**
   * Supprimer un projet
   */
  async deleteProject(projectId: string): Promise<void> {
    const { error } = await supabase
      .from('phase0_projects')
      .delete()
      .eq('id', projectId);

    if (error) {
      console.error('Error deleting Phase 0 project:', error);
      throw new Error(`Erreur lors de la suppression du projet: ${error.message}`);
    }
  }

  /**
   * Dupliquer un projet
   */
  async duplicateProject(
    sourceProjectId: string,
    newName: string,
    includeLots: boolean = true
  ): Promise<Phase0Project> {
    const sourceProject = await this.getProjectById(sourceProjectId);

    if (!sourceProject) {
      throw new Error('Projet source non trouvé');
    }

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      throw new Error('Utilisateur non authentifié');
    }

    const newProject = await this.createProject({
      userId: userData.user.id,
      wizardMode: sourceProject.wizardMode,
      initialData: {
        ownerProfile: sourceProject.ownerProfile,
        property: sourceProject.property,
        workProject: {
          ...sourceProject.workProject,
          general: {
            ...sourceProject.workProject.general,
            name: newName,
          },
        },
        selectedLots: includeLots ? sourceProject.selectedLots : [],
      },
    });

    return newProject;
  }

  /**
   * Calculer la complétude d'un projet
   */
  async calculateCompleteness(projectId: string): Promise<number> {
    const { data, error } = await supabase.rpc('calculate_phase0_completeness', {
      project_id: projectId,
    });

    if (error) {
      console.error('Error calculating completeness:', error);
      // Fallback local calculation
      const project = await this.getProjectById(projectId);
      if (!project) return 0;
      return this.localCalculateCompleteness(project);
    }

    return data || 0;
  }

  // =============================================================================
  // PRIVATE METHODS
  // =============================================================================

  private mapRowToProject(row: Phase0ProjectRow): Phase0Project {
    return {
      id: row.id,
      userId: row.user_id,
      ownerProfile: row.owner_profile as MasterOwnerProfile,
      property: row.property as Property,
      workProject: row.work_project as WorkProject,
      selectedLots: row.selected_lots as WorkLot[],
      status: row.status,
      wizardMode: row.wizard_mode,
      completeness: {
        overall: row.completeness,
        bySection: [],
        missingRequired: [],
        suggestedImprovements: [],
        lastCalculated: row.updated_at,
      },
      validation: {
        isValid: row.is_validated,
        validatedAt: row.validated_at || undefined,
        validatedBy: row.validated_by || undefined,
        validationMethod: (row.validation_method as 'auto' | 'user' | 'professional' | 'mixed') || 'auto',
        checks: [],
        score: {
          total: 0,
          byCategory: {
            completeness: 0,
            consistency: 0,
            regulatory: 0,
            technical: 0,
            financial: 0,
          },
          grade: 'C',
        },
      },
      wizardState: {
        projectId: row.id,
        currentStepIndex: row.current_step - 1,
        completedSteps: [],
        answers: {},
        aiDeductions: [],
        validationErrors: [],
        alerts: [],
        progress: {
          overallPercentage: row.completeness,
          stepProgress: [],
          estimatedTimeRemaining: 0,
          lastSaved: row.updated_at,
          autoSaveEnabled: true,
        },
        metadata: {
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          createdBy: row.user_id,
          wizardMode: row.wizard_mode,
          version: 1,
          sessionDuration: 0,
          abandonedSteps: [],
        },
      },
      deductions: row.deductions as unknown[],
      generatedDocuments: [],
      alerts: row.alerts as unknown[],
      torpMetadata: {
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        createdBy: row.user_id,
        version: 1,
        source: 'user_input',
        completeness: row.completeness,
        aiEnriched: row.deductions_applied_count > 0,
      },
    } as Phase0Project;
  }

  private mapRowToSummary(row: Phase0ProjectRow): Phase0Summary {
    let ownerName = 'Non défini';
    if (row.owner_profile?.identity) {
      const identity = row.owner_profile.identity;
      if (identity.type === 'B2C' && 'firstName' in identity && 'lastName' in identity) {
        ownerName = `${identity.firstName || ''} ${identity.lastName || ''}`.trim() || 'Non défini';
      } else if (identity.type === 'B2B' && 'companyName' in identity) {
        ownerName = identity.companyName || 'Non défini';
      } else if (identity.type === 'B2G' && 'entityName' in identity) {
        ownerName = identity.entityName || 'Non défini';
      }
    }

    return {
      projectId: row.id,
      projectName: row.name,
      status: row.status,
      completeness: row.completeness,
      ownerType: (row.owner_profile?.identity?.type as 'B2C' | 'B2B' | 'B2G') || 'B2C',
      ownerName,
      propertyType: row.property_type || 'Non défini',
      propertyAddress: row.property_address
        ? `${row.property_address}, ${row.property_postal_code || ''} ${row.property_city || ''}`.trim()
        : 'Non définie',
      projectType: row.work_project?.general?.projectType || 'Non défini',
      estimatedBudget: {
        min: row.estimated_budget_min || 0,
        max: row.estimated_budget_max || 0,
        currency: row.currency || 'EUR',
      },
      selectedLotsCount: row.selected_lots_count || 0,
      eligibleAids: {
        count: row.rge_lots_count || 0,
        totalEstimated: row.aids_eligible_amount || 0,
      },
      estimatedDuration: {
        minDays: row.estimated_duration_days || 0,
        maxDays: row.estimated_duration_days || 0,
      },
      documentsGenerated: 0,
      ccfReady: false,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      targetStartDate: row.target_start_date || undefined,
    };
  }

  private mapSortField(field: string): string {
    const mapping: Record<string, string> = {
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      completeness: 'completeness',
      status: 'status',
      budget: 'estimated_budget_target',
      ownerName: 'name',
    };
    return mapping[field] || 'created_at';
  }

  private localCalculateCompleteness(project: Phase0Project): number {
    let total = 0;
    let completed = 0;

    // Owner profile (15%)
    total += 15;
    if (project.ownerProfile?.identity?.type) {
      completed += 7.5;
      if (project.ownerProfile?.contact?.email) {
        completed += 7.5;
      }
    }

    // Property (25%)
    total += 25;
    if (project.property?.identification?.address?.city) {
      completed += 10;
      if (project.property?.characteristics) {
        completed += 7.5;
      }
      if (project.property?.currentCondition) {
        completed += 7.5;
      }
    }

    // Lots (30%)
    total += 30;
    if (project.selectedLots && project.selectedLots.length > 0) {
      completed += 30;
    }

    // Constraints (10%)
    total += 10;
    if (project.workProject?.constraints) {
      completed += 10;
    }

    // Budget (15%)
    total += 15;
    if (project.workProject?.budget?.envelope?.targetBudget) {
      completed += 15;
    }

    // Validation (5%)
    total += 5;
    if (project.validation?.isValid) {
      completed += 5;
    }

    return Math.round((completed / total) * 100);
  }
}

// Create instance for static methods to use
const phase0ProjectServiceInstance = new Phase0ProjectService();

// Export row types for external use
export type { Phase0ProjectRow };
export type Phase0ProjectInsert = Partial<Phase0ProjectRow>;
export type Phase0ProjectUpdate = Partial<Phase0ProjectRow>;

// Export both the instance and allow class access
export const phase0ProjectService = phase0ProjectServiceInstance;
