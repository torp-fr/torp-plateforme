/**
 * Mock Project Service
 * Simulates backend API for project management
 * TODO: Replace with real API calls when backend is ready
 */

import { env } from '@/config/env';
import { Project } from '@/context/AppContext';

const delay = (ms: number = 500) => new Promise(resolve => setTimeout(resolve, ms));

export class MockProjectService {
  /**
   * Get all projects for a user
   */
  async getProjects(userId: string): Promise<Project[]> {
    if (!env.api.useMock) {
      throw new Error('Real API not implemented yet');
    }

    await delay();

    // Return mock projects from AppContext
    return [];
  }

  /**
   * Get a single project by ID
   */
  async getProject(projectId: string): Promise<Project | null> {
    if (!env.api.useMock) {
      throw new Error('Real API not implemented yet');
    }

    await delay();

    return null;
  }

  /**
   * Create a new project
   */
  async createProject(data: Omit<Project, 'id' | 'createdAt'>): Promise<Project> {
    if (!env.api.useMock) {
      throw new Error('Real API not implemented yet');
    }

    await delay(800);

    const newProject: Project = {
      ...data,
      id: `project-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };

    return newProject;
  }

  /**
   * Update a project
   */
  async updateProject(projectId: string, updates: Partial<Project>): Promise<Project> {
    if (!env.api.useMock) {
      throw new Error('Real API not implemented yet');
    }

    await delay(500);

    // Mock implementation
    return {
      id: projectId,
      ...updates,
    } as Project;
  }

  /**
   * Delete a project
   */
  async deleteProject(projectId: string): Promise<{ success: boolean }> {
    if (!env.api.useMock) {
      throw new Error('Real API not implemented yet');
    }

    await delay(500);

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
    if (!env.api.useMock) {
      throw new Error('Real API not implemented yet');
    }

    await delay(700);

    return {
      totalSpent: 12500,
      remainingBudget: 2700,
      progress: 65,
      estimatedCompletion: '2024-06-15',
    };
  }
}

export const projectService = new MockProjectService();
export default projectService;
