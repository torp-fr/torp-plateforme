/**
 * Project Context Service
 * Gère le contexte projet avec pièces et travaux
 */

import { supabase } from '@/lib/supabase';
import type {
  ProjectContext,
  ProjectContextInput,
  Room,
  RoomWork,
  ValidationResult,
  WorkType,
} from '@/types/ProjectContext';
import { ProjectType, Urgency } from '@/types/ProjectContext';
import { log, warn, error, time, timeEnd } from '@/lib/logger';

export class ProjectContextService {
  /**
   * Créer un nouveau contexte projet
   */
  async createProjectContext(
    userId: string,
    input: ProjectContextInput
  ): Promise<ProjectContext> {
    try {
      // Valider le contexte
      const validation = this.validateContext(input);
      if (!validation.valid) {
        throw new Error(`Validation error: ${validation.errors.join(', ')}`);
      }

      // Afficher les warnings
      if (validation.warnings.length > 0) {
        warn('⚠️ Validation warnings:', validation.warnings);
      }

      // Créer le contexte
      const { data: contextData, error: contextError } = await supabase
        .from('project_contexts')
        .insert({
          user_id: userId,
          address: input.address,
          coordinates: input.coordinates,
          region: input.region,
          project_type: input.projectType,
          budget: input.budget,
          square_meters_total: input.squareMetersTotal,
          climate_zone: input.climateZone,
          construction_year: input.constructionYear,
          timeline: input.timeline,
          urgency: input.urgency,
          constraints: input.constraints,
        })
        .select()
        .single();

      if (contextError) throw contextError;

      log(`✅ Project context created: ${contextData.id}`);

      // Ajouter les pièces si elles existent
      let rooms: Room[] = [];
      if (input.rooms && input.rooms.length > 0) {
        rooms = await Promise.all(
          input.rooms.map(room =>
            this.addRoom(contextData.id, {
              name: room.name,
              surface: room.surface,
              works: room.works || [],
            })
          )
        );
      }

      return this.mapToProjectContext(contextData, rooms);
    } catch (error) {
      console.error('❌ Create context error:', error);
      throw error;
    }
  }

  /**
   * Récupérer un contexte projet complet
   */
  async getProjectContext(projectId: string): Promise<ProjectContext | null> {
    try {
      // Utiliser la fonction RPC pour récupérer le contexte complet
      const { data, error } = await supabase
        .rpc('get_project_context_complete', { project_id: projectId })
        .single();

      if (error) throw error;
      if (!data) return null;

      return this.mapFromCompleteData(data);
    } catch (error) {
      console.error('❌ Get context error:', error);
      throw error;
    }
  }

  /**
   * Lister les contextes du user
   */
  async listProjectContexts(userId: string): Promise<ProjectContext[]> {
    try {
      const { data, error } = await supabase
        .from('project_contexts')
        .select()
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Récupérer les données complètes avec les pièces
      const contexts = await Promise.all(
        (data || []).map(async (ctx) => {
          const fullContext = await this.getProjectContext(ctx.id);
          return fullContext || this.mapToProjectContext(ctx, []);
        })
      );

      return contexts;
    } catch (error) {
      console.error('❌ List contexts error:', error);
      return [];
    }
  }

  /**
   * Mettre à jour un contexte projet
   */
  async updateProjectContext(
    projectId: string,
    input: Partial<ProjectContextInput>
  ): Promise<ProjectContext> {
    try {
      const { data, error } = await supabase
        .from('project_contexts')
        .update({
          address: input.address,
          coordinates: input.coordinates,
          region: input.region,
          project_type: input.projectType,
          budget: input.budget,
          square_meters_total: input.squareMetersTotal,
          climate_zone: input.climateZone,
          construction_year: input.constructionYear,
          timeline: input.timeline,
          urgency: input.urgency,
          constraints: input.constraints,
          updated_at: new Date().toISOString(),
        })
        .eq('id', projectId)
        .select()
        .single();

      if (error) throw error;

      const fullContext = await this.getProjectContext(projectId);
      if (!fullContext) throw new Error('Failed to retrieve updated context');

      return fullContext;
    } catch (error) {
      console.error('❌ Update context error:', error);
      throw error;
    }
  }

  /**
   * Supprimer un contexte projet
   */
  async deleteProjectContext(projectId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('project_contexts')
        .delete()
        .eq('id', projectId);

      if (error) throw error;
      log(`✅ Project context deleted: ${projectId}`);
    } catch (error) {
      console.error('❌ Delete context error:', error);
      throw error;
    }
  }

  /**
   * Ajouter une pièce
   */
  async addRoom(
    projectId: string,
    room: { name: string; surface: number; works?: RoomWork[] }
  ): Promise<Room> {
    try {
      // Valider la pièce
      if (!room.name || room.name.trim().length === 0) {
        throw new Error('Room name is required');
      }
      if (room.surface <= 0) {
        throw new Error('Room surface must be positive');
      }

      // Créer la pièce
      const { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .insert({
          project_id: projectId,
          name: room.name,
          surface: room.surface,
        })
        .select()
        .single();

      if (roomError) throw roomError;

      // Ajouter les travaux si fournis
      let works: RoomWork[] = [];
      if (room.works && room.works.length > 0) {
        works = await Promise.all(
          room.works.map(work =>
            this.addWork(roomData.id, work)
          )
        );
      }

      log(`✅ Room added: ${roomData.id}`);

      return this.mapToRoom(roomData, works);
    } catch (error) {
      console.error('❌ Add room error:', error);
      throw error;
    }
  }

  /**
   * Ajouter un travail à une pièce
   */
  async addWork(roomId: string, work: Omit<RoomWork, 'id' | 'createdAt'>): Promise<RoomWork> {
    try {
      // Valider le travail
      if (!work.details || work.details.trim().length === 0) {
        throw new Error('Work details are required');
      }

      const { data: workData, error: workError } = await supabase
        .from('room_works')
        .insert({
          room_id: roomId,
          type: work.type,
          scope: work.scope,
          scope_description: work.scopeDescription,
          details: work.details,
          materials: work.materials,
          specific_constraints: work.specificConstraints,
        })
        .select()
        .single();

      if (workError) throw workError;
      log(`✅ Work added: ${workData.id}`);

      return this.mapToRoomWork(workData);
    } catch (error) {
      console.error('❌ Add work error:', error);
      throw error;
    }
  }

  /**
   * Mettre à jour une pièce
   */
  async updateRoom(roomId: string, room: Partial<Room>): Promise<Room> {
    try {
      const { data, error } = await supabase
        .from('rooms')
        .update({
          name: room.name,
          surface: room.surface,
          updated_at: new Date().toISOString(),
        })
        .eq('id', roomId)
        .select()
        .single();

      if (error) throw error;

      // Récupérer les travaux
      const works = await this.getRoomWorks(roomId);
      return this.mapToRoom(data, works);
    } catch (error) {
      console.error('❌ Update room error:', error);
      throw error;
    }
  }

  /**
   * Supprimer une pièce
   */
  async deleteRoom(roomId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('rooms')
        .delete()
        .eq('id', roomId);

      if (error) throw error;
      log(`✅ Room deleted: ${roomId}`);
    } catch (error) {
      console.error('❌ Delete room error:', error);
      throw error;
    }
  }

  /**
   * Récupérer les travaux d'une pièce
   */
  async getRoomWorks(roomId: string): Promise<RoomWork[]> {
    try {
      const { data, error } = await supabase
        .from('room_works')
        .select()
        .eq('room_id', roomId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return (data || []).map(w => this.mapToRoomWork(w));
    } catch (error) {
      console.error('❌ Get works error:', error);
      return [];
    }
  }

  /**
   * Mettre à jour un travail
   */
  async updateWork(workId: string, work: Partial<RoomWork>): Promise<RoomWork> {
    try {
      const { data, error } = await supabase
        .from('room_works')
        .update({
          type: work.type,
          scope: work.scope,
          scope_description: work.scopeDescription,
          details: work.details,
          materials: work.materials,
          specific_constraints: work.specificConstraints,
          updated_at: new Date().toISOString(),
        })
        .eq('id', workId)
        .select()
        .single();

      if (error) throw error;
      return this.mapToRoomWork(data);
    } catch (error) {
      console.error('❌ Update work error:', error);
      throw error;
    }
  }

  /**
   * Supprimer un travail
   */
  async deleteWork(workId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('room_works')
        .delete()
        .eq('id', workId);

      if (error) throw error;
      log(`✅ Work deleted: ${workId}`);
    } catch (error) {
      console.error('❌ Delete work error:', error);
      throw error;
    }
  }

  /**
   * Valider un contexte projet
   */
  private validateContext(context: Partial<ProjectContextInput>): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Champs obligatoires
    if (!context.address || context.address.trim().length === 0) {
      errors.push('Address is required');
    }

    if (!context.projectType) {
      errors.push('Project type is required');
    } else if (!Object.values(ProjectType).includes(context.projectType)) {
      errors.push(`Invalid project type: ${context.projectType}`);
    }

    if (!context.squareMetersTotal || context.squareMetersTotal <= 0) {
      errors.push('Total square meters must be positive');
    }

    // Avertissements
    if (!context.budget) {
      warnings.push('Budget is not specified');
    }

    if (!context.rooms || context.rooms.length === 0) {
      warnings.push('No rooms specified yet');
    }

    if (context.urgency && !Object.values(Urgency).includes(context.urgency)) {
      errors.push(`Invalid urgency: ${context.urgency}`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Mappers pour convertir les données DB
   */
  private mapToProjectContext(data: any, rooms: Room[]): ProjectContext {
    return {
      id: data.id,
      userId: data.user_id,
      address: data.address,
      coordinates: data.coordinates,
      region: data.region,
      rooms,
      projectType: data.project_type as ProjectType,
      budget: data.budget,
      squareMetersTotal: data.square_meters_total,
      climateZone: data.climate_zone,
      constructionYear: data.construction_year,
      timeline: data.timeline,
      urgency: data.urgency as Urgency,
      constraints: data.constraints,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  private mapFromCompleteData(data: any): ProjectContext {
    const rooms: Room[] = (data.rooms_data || []).map((r: any) => ({
      id: r.id,
      projectId: r.projectId,
      name: r.name,
      surface: r.surface,
      works: (r.works || []).map((w: any) => ({
        id: w.id,
        type: w.type as WorkType,
        scope: w.scope,
        scopeDescription: w.scopeDescription,
        details: w.details,
        materials: w.materials,
        specificConstraints: w.specificConstraints,
        createdAt: w.createdAt,
      })),
      createdAt: r.createdAt,
    }));

    return this.mapToProjectContext(data, rooms);
  }

  private mapToRoom(data: any, works: RoomWork[]): Room {
    return {
      id: data.id,
      projectId: data.project_id,
      name: data.name,
      surface: data.surface,
      works,
      createdAt: data.created_at,
    };
  }

  private mapToRoomWork(data: any): RoomWork {
    return {
      id: data.id,
      type: data.type as WorkType,
      scope: data.scope,
      scopeDescription: data.scope_description,
      details: data.details,
      materials: data.materials,
      specificConstraints: data.specific_constraints,
      createdAt: data.created_at,
    };
  }
}

export default new ProjectContextService();
