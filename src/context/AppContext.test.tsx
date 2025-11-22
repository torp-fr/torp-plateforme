/**
 * Tests for AppContext
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { AppProvider, useApp } from './AppContext';

describe('AppContext', () => {
  it('should provide default values', () => {
    const { result } = renderHook(() => useApp(), {
      wrapper: AppProvider,
    });

    expect(result.current.user).toBeNull();
    expect(result.current.userType).toBe('B2C');
    expect(result.current.projects).toBeDefined();
    expect(Array.isArray(result.current.projects)).toBe(true);
    expect(result.current.currentProject).toBeNull();
    expect(result.current.isAnalyzing).toBe(false);
  });

  it('should set user', () => {
    const { result } = renderHook(() => useApp(), {
      wrapper: AppProvider,
    });

    const testUser = {
      id: '1',
      email: 'test@example.com',
      name: 'Test User',
      type: 'B2C' as const,
    };

    act(() => {
      result.current.setUser(testUser);
    });

    expect(result.current.user).toEqual(testUser);
  });

  it('should set user type', () => {
    const { result } = renderHook(() => useApp(), {
      wrapper: AppProvider,
    });

    act(() => {
      result.current.setUserType('B2B');
    });

    expect(result.current.userType).toBe('B2B');
  });

  it('should add project', () => {
    const { result } = renderHook(() => useApp(), {
      wrapper: AppProvider,
    });

    const initialProjectCount = result.current.projects.length;

    const newProject = {
      id: 'new-1',
      name: 'New Project',
      type: 'Test',
      status: 'draft' as const,
      amount: '1000€',
      createdAt: '2024-01-01',
    };

    act(() => {
      result.current.addProject(newProject);
    });

    expect(result.current.projects.length).toBe(initialProjectCount + 1);
    expect(result.current.projects[0]).toEqual(newProject);
  });

  it('should update project', () => {
    const { result } = renderHook(() => useApp(), {
      wrapper: AppProvider,
    });

    // Use an existing project ID from mock data
    const existingProjectId = result.current.projects[0]?.id;

    if (!existingProjectId) {
      throw new Error('No projects in initial state');
    }

    act(() => {
      result.current.updateProject(existingProjectId, {
        status: 'completed',
        score: 90,
      });
    });

    const updatedProject = result.current.projects.find(p => p.id === existingProjectId);
    expect(updatedProject?.status).toBe('completed');
    expect(updatedProject?.score).toBe(90);
  });

  it('should set current project', () => {
    const { result } = renderHook(() => useApp(), {
      wrapper: AppProvider,
    });

    const testProject = {
      id: 'current-1',
      name: 'Current Project',
      type: 'Test',
      status: 'analyzing' as const,
      amount: '2000€',
      createdAt: '2024-01-01',
    };

    act(() => {
      result.current.setCurrentProject(testProject);
    });

    expect(result.current.currentProject).toEqual(testProject);
  });

  it('should set analyzing state', () => {
    const { result } = renderHook(() => useApp(), {
      wrapper: AppProvider,
    });

    act(() => {
      result.current.setIsAnalyzing(true);
    });

    expect(result.current.isAnalyzing).toBe(true);

    act(() => {
      result.current.setIsAnalyzing(false);
    });

    expect(result.current.isAnalyzing).toBe(false);
  });

  it('should throw error when used outside provider', () => {
    // Suppress console.error for this test
    const originalError = console.error;
    console.error = () => {};

    expect(() => {
      renderHook(() => useApp());
    }).toThrow('useApp must be used within an AppProvider');

    console.error = originalError;
  });
});
