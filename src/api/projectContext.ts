/**
 * Project Context API
 * Endpoints pour la gestion du contexte projet
 */

import { getCurrentUser } from '@/lib/supabase';
import { ProjectContextService } from '@/services/project/ProjectContextService';
import type { ProjectContextInput, Room, RoomWork } from '@/types/ProjectContext';

/**
 * Créer un nouveau contexte projet
 */
export async function createProjectContext(input: ProjectContextInput) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('User not authenticated');

    return await ProjectContextService.createProjectContext(user.id, input);
  } catch (error) {
    console.error('❌ Create context error:', error);
    throw error;
  }
}

/**
 * Récupérer un contexte projet complet
 */
export async function getProjectContext(projectId: string) {
  try {
    const context = await ProjectContextService.getProjectContext(projectId);
    if (!context) {
      throw new Error('Project context not found');
    }
    return context;
  } catch (error) {
    console.error('❌ Get context error:', error);
    throw error;
  }
}

/**
 * Lister les contextes du user
 */
export async function listProjectContexts() {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('User not authenticated');

    return await ProjectContextService.listProjectContexts(user.id);
  } catch (error) {
    console.error('❌ List contexts error:', error);
    throw error;
  }
}

/**
 * Mettre à jour un contexte projet
 */
export async function updateProjectContext(
  projectId: string,
  input: Partial<ProjectContextInput>
) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('User not authenticated');

    // Vérifier la propriété
    const context = await ProjectContextService.getProjectContext(projectId);
    if (!context || context.userId !== user.id) {
      throw new Error('Unauthorized');
    }

    return await ProjectContextService.updateProjectContext(projectId, input);
  } catch (error) {
    console.error('❌ Update context error:', error);
    throw error;
  }
}

/**
 * Supprimer un contexte projet
 */
export async function deleteProjectContext(projectId: string) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('User not authenticated');

    // Vérifier la propriété
    const context = await ProjectContextService.getProjectContext(projectId);
    if (!context || context.userId !== user.id) {
      throw new Error('Unauthorized');
    }

    await ProjectContextService.deleteProjectContext(projectId);
  } catch (error) {
    console.error('❌ Delete context error:', error);
    throw error;
  }
}

/**
 * Ajouter une pièce à un contexte
 */
export async function addRoom(
  projectId: string,
  room: { name: string; surface: number }
) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('User not authenticated');

    // Vérifier la propriété
    const context = await ProjectContextService.getProjectContext(projectId);
    if (!context || context.userId !== user.id) {
      throw new Error('Unauthorized');
    }

    return await ProjectContextService.addRoom(projectId, room);
  } catch (error) {
    console.error('❌ Add room error:', error);
    throw error;
  }
}

/**
 * Mettre à jour une pièce
 */
export async function updateRoom(roomId: string, room: Partial<Room>) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('User not authenticated');

    // Vérifier la propriété via la pièce et le projet
    const works = await ProjectContextService.getRoomWorks(roomId);
    // La vérification complète se ferait côté DB avec RLS

    return await ProjectContextService.updateRoom(roomId, room);
  } catch (error) {
    console.error('❌ Update room error:', error);
    throw error;
  }
}

/**
 * Supprimer une pièce
 */
export async function deleteRoom(roomId: string) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('User not authenticated');

    await ProjectContextService.deleteRoom(roomId);
  } catch (error) {
    console.error('❌ Delete room error:', error);
    throw error;
  }
}

/**
 * Ajouter un travail à une pièce
 */
export async function addWork(
  roomId: string,
  work: Omit<RoomWork, 'id' | 'createdAt'>
) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('User not authenticated');

    return await ProjectContextService.addWork(roomId, work);
  } catch (error) {
    console.error('❌ Add work error:', error);
    throw error;
  }
}

/**
 * Mettre à jour un travail
 */
export async function updateWork(workId: string, work: Partial<RoomWork>) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('User not authenticated');

    return await ProjectContextService.updateWork(workId, work);
  } catch (error) {
    console.error('❌ Update work error:', error);
    throw error;
  }
}

/**
 * Supprimer un travail
 */
export async function deleteWork(workId: string) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('User not authenticated');

    await ProjectContextService.deleteWork(workId);
  } catch (error) {
    console.error('❌ Delete work error:', error);
    throw error;
  }
}

/**
 * Valider un contexte projet
 */
export async function validateProjectContext(input: Partial<ProjectContextInput>) {
  try {
    const service = ProjectContextService as any;
    return service.validateContext(input);
  } catch (error) {
    console.error('❌ Validation error:', error);
    throw error;
  }
}
