/**
 * Supabase Project Service
 * Real project management using Supabase
 */

import { supabase } from '@/lib/supabase';
import { Project } from '@/context/AppContext';
import type { Database } from '@/types/supabase';
import { runOrchestration } from '@/core/platform/engineOrchestrator';

type DbProject = Database['public']['Tables']['projects']['Row'];
type DbProjectInsert = Database['public']['Tables']['projects']['Insert'];
type DbProjectUpdate = Database['public']['Tables']['projects']['Update'];

/**
 * Map database project to app Project format
 */
function mapDbProjectToAppProject(dbProject: DbProject): Project {
  return {
    id: dbProject.id,
    name: dbProject.name,
    type: dbProject.project_type,
    status: dbProject.status,
    score: dbProject.score || undefined,
    grade: dbProject.grade || undefined,
    amount: dbProject.estimated_amount?.toString() || '0',
    createdAt: dbProject.created_at || new Date().toISOString(),
    company: undefined, // Will be joined from companies table if needed
    analysisResult: dbProject.analysis_result as any,
    description: dbProject.description || undefined,
    address: dbProject.address as any,
    startDate: dbProject.start_date || undefined,
    endDate: dbProject.end_date || undefined,
    tags: dbProject.tags || undefined,
  };
}

/**
 * Map app Project to database insert format
 */
function mapAppProjectToDbInsert(
  project: Omit<Project, 'id' | 'createdAt'>,
  userId: string
): DbProjectInsert {
  return {
    user_id: userId,
    name: project.name,
    project_type: project.type,
    status: project.status,
    estimated_amount: parseFloat(project.amount) || 0,
    description: project.description,
    address: project.address as any,
    tags: project.tags,
  };
}

export class SupabaseProjectService {
  /**
   * Get all projects for a user
   */
  async getProjects(userId: string): Promise<Project[]> {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('user_id', userId)
      .eq('archived', false)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch projects: ${error.message}`);
    }

    return data.map(mapDbProjectToAppProject);
  }

  /**
   * Get a single project by ID
   */
  async getProject(projectId: string): Promise<Project | null> {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Failed to fetch project: ${error.message}`);
    }

    return mapDbProjectToAppProject(data);
  }

  /**
   * Create a new project
   */
  async createProject(
    data: Omit<Project, 'id' | 'createdAt'>,
    userId: string
  ): Promise<Project> {
    const projectInsert = mapAppProjectToDbInsert(data, userId);

    const { data: createdProject, error } = await supabase
      .from('projects')
      .insert(projectInsert)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create project: ${error.message}`);
    }

    const appProject = mapDbProjectToAppProject(createdProject);

    // Trigger engine orchestration asynchronously (non-blocking)
    // This starts the platform engine pipeline for the new project
    try {
      runOrchestration({
        projectId: appProject.id,
        data: appProject,
      }).catch((err) => {
        // Silently catch orchestration errors to not affect project creation
        console.warn('[ProjectService] Orchestration warning:', err);
      });
    } catch (orchestrationError) {
      // Silently catch synchronous errors to not affect project creation
      console.warn('[ProjectService] Orchestration initialization warning:', orchestrationError);
    }

    return appProject;
  }

  /**
   * Update a project
   */
  async updateProject(projectId: string, updates: Partial<Project>): Promise<Project> {
    const dbUpdates: DbProjectUpdate = {};

    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.type !== undefined) dbUpdates.project_type = updates.type;
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.score !== undefined) dbUpdates.score = updates.score;
    if (updates.grade !== undefined) dbUpdates.grade = updates.grade;
    if (updates.amount !== undefined) {
      dbUpdates.estimated_amount = parseFloat(updates.amount) || 0;
    }
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.address !== undefined) dbUpdates.address = updates.address as any;
    if (updates.startDate !== undefined) dbUpdates.start_date = updates.startDate;
    if (updates.endDate !== undefined) dbUpdates.end_date = updates.endDate;
    if (updates.tags !== undefined) dbUpdates.tags = updates.tags;
    if (updates.analysisResult !== undefined) {
      dbUpdates.analysis_result = updates.analysisResult as any;
    }

    const { data, error } = await supabase
      .from('projects')
      .update(dbUpdates)
      .eq('id', projectId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update project: ${error.message}`);
    }

    const appProject = mapDbProjectToAppProject(data);

    // Trigger engine orchestration asynchronously (non-blocking)
    // This re-runs the platform engine pipeline for the updated project
    try {
      runOrchestration({
        projectId: appProject.id,
        data: appProject,
      }).catch((err) => {
        // Silently catch orchestration errors to not affect project update
        console.warn('[ProjectService] Orchestration warning:', err);
      });
    } catch (orchestrationError) {
      // Silently catch synchronous errors to not affect project update
      console.warn('[ProjectService] Orchestration initialization warning:', orchestrationError);
    }

    return appProject;
  }

  /**
   * Delete a project (soft delete by archiving)
   */
  async deleteProject(projectId: string): Promise<{ success: boolean }> {
    // Soft delete by setting archived flag
    const { error } = await supabase
      .from('projects')
      .update({ archived: true })
      .eq('id', projectId);

    if (error) {
      throw new Error(`Failed to delete project: ${error.message}`);
    }

    return { success: true };
  }

  /**
   * Permanently delete a project (hard delete)
   */
  async permanentlyDeleteProject(projectId: string): Promise<{ success: boolean }> {
    // First, delete all associated devis
    const { error: devisError } = await supabase
      .from('devis')
      .delete()
      .eq('project_id', projectId);

    if (devisError) {
      throw new Error(`Failed to delete project devis: ${devisError.message}`);
    }

    // Then delete the project
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', projectId);

    if (error) {
      throw new Error(`Failed to permanently delete project: ${error.message}`);
    }

    return { success: true };
  }

  /**
   * Get project analytics
   */
  async getProjectAnalytics(projectId: string): Promise<{
    totalSpent: number;
    remainingBudget: number;
    progress: number;
    estimatedCompletion: string;
  }> {
    // Fetch project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (projectError) {
      throw new Error(`Failed to fetch project: ${projectError.message}`);
    }

    // Fetch all payments for this project
    const { data: payments, error: paymentsError } = await supabase
      .from('payments')
      .select('amount, status')
      .eq('project_id', projectId);

    if (paymentsError) {
      throw new Error(`Failed to fetch payments: ${paymentsError.message}`);
    }

    // Calculate total spent (paid + validated payments)
    const totalSpent = payments
      ? payments
          .filter(p => p.status === 'paid' || p.status === 'validated')
          .reduce((sum, p) => sum + p.amount, 0)
      : 0;

    const estimatedAmount = project.estimated_amount || 0;
    const remainingBudget = estimatedAmount - totalSpent;

    // Calculate progress based on actual dates if available
    let progress = 0;
    if (project.actual_start_date && project.end_date) {
      const start = new Date(project.actual_start_date).getTime();
      const end = new Date(project.end_date).getTime();
      const now = Date.now();
      const total = end - start;
      const elapsed = now - start;
      progress = Math.min(Math.max((elapsed / total) * 100, 0), 100);
    } else if (project.status === 'completed' || project.status === 'finished') {
      progress = 100;
    } else if (project.status === 'in_progress') {
      progress = 50; // Default progress if no dates available
    }

    // Estimated completion based on end_date or project status
    let estimatedCompletion = project.end_date || '';
    if (!estimatedCompletion && project.start_date) {
      // If no end date but has start date, estimate 3 months
      const startDate = new Date(project.start_date);
      startDate.setMonth(startDate.getMonth() + 3);
      estimatedCompletion = startDate.toISOString().split('T')[0];
    }

    return {
      totalSpent,
      remainingBudget,
      progress: Math.round(progress),
      estimatedCompletion,
    };
  }

  /**
   * Get projects by status
   */
  async getProjectsByStatus(
    userId: string,
    status: DbProject['status']
  ): Promise<Project[]> {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('user_id', userId)
      .eq('status', status)
      .eq('archived', false)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch projects: ${error.message}`);
    }

    return data.map(mapDbProjectToAppProject);
  }

  /**
   * Search projects by name or tags
   */
  async searchProjects(userId: string, query: string): Promise<Project[]> {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('user_id', userId)
      .eq('archived', false)
      .or(`name.ilike.%${query}%,description.ilike.%${query}%`)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to search projects: ${error.message}`);
    }

    return data.map(mapDbProjectToAppProject);
  }

  /**
   * Get archived projects
   */
  async getArchivedProjects(userId: string): Promise<Project[]> {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('user_id', userId)
      .eq('archived', true)
      .order('updated_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch archived projects: ${error.message}`);
    }

    return data.map(mapDbProjectToAppProject);
  }

  /**
   * Restore archived project
   */
  async restoreProject(projectId: string): Promise<{ success: boolean }> {
    const { error } = await supabase
      .from('projects')
      .update({ archived: false })
      .eq('id', projectId);

    if (error) {
      throw new Error(`Failed to restore project: ${error.message}`);
    }

    return { success: true };
  }
}

export const projectService = new SupabaseProjectService();
export default projectService;
