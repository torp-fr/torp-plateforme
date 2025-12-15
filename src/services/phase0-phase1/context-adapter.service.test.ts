/**
 * Tests for Phase0 Context Adapter
 * Validates the transformation of Phase0Project to Phase0AnalysisContext
 */

import { describe, it, expect } from 'vitest';
import { Phase0ContextAdapter } from './context-adapter.service';
import type { Phase0Project, WorkLot } from '@/types/phase0';

// Mock Phase0Project for testing
const createMockProject = (overrides: Partial<Phase0Project> = {}): Phase0Project => ({
  id: 'test-project-123',
  userId: 'user-456',
  reference: 'TORP-2024-001',
  status: 'in_progress',
  completeness: 75,
  createdAt: new Date('2024-01-15'),
  updatedAt: new Date('2024-06-01'),

  torpMetadata: {
    reference: 'TORP-2024-001',
    version: 1,
  },

  workProject: {
    general: {
      title: 'Rénovation maison',
      type: 'renovation',
    },
    budget: {
      totalEnvelope: {
        amount: 50000,
        minAmount: 40000,
        maxAmount: 60000,
      },
      contingency: {
        percentageOfTotal: 10,
      },
    },
    constraints: {
      temporal: {
        preferredStart: '2024-03-01',
        deadline: {
          date: '2024-09-30',
        },
        maxDuration: 6,
        blackoutPeriods: [
          {
            startDate: '2024-07-15',
            endDate: '2024-08-15',
            reason: 'Vacances',
          },
        ],
      },
      physical: {
        siteAccess: {
          vehicleAccess: 'limited',
          hasStairs: true,
          hasElevator: false,
        },
        parkingAvailability: 'limited',
      },
      technical: {
        acoustic: {
          required: true,
          targetLevel: 'standard',
        },
        thermal: {
          targetClass: 'C',
        },
        accessibility: {
          required: false,
        },
      },
    },
    regulatory: {
      buildingPermit: {
        required: true,
      },
    },
  },

  property: {
    address: {
      city: 'Lyon',
      postalCode: '69001',
      region: 'Auvergne-Rhône-Alpes',
      department: 'Rhône',
    },
    heritage: {
      isProtected: false,
    },
  },

  ownerProfile: {
    identity: {
      type: 'individual',
    },
    expertise: {
      projectExperience: {
        projectCount: 1,
      },
      professionalBackground: {
        hasBTPExperience: false,
      },
    },
    psychological: {
      priorityFactors: ['quality', 'budget'],
    },
    financialCapacity: {
      budgetEnvelope: {
        minAmount: 40000,
        maxAmount: 60000,
      },
    },
  },

  selectedLots: [
    {
      id: 'lot-1',
      category: 'plomberie',
      type: 'plumbing',
      label: 'Plomberie sanitaire',
      isRequired: true,
      isRGEEligible: false,
      estimation: {
        totalHT: {
          min: 5000,
          max: 8000,
        },
      },
    },
    {
      id: 'lot-2',
      category: 'energy',
      type: 'heating',
      label: 'Chauffage',
      isRequired: true,
      isRGEEligible: true,
      estimation: {
        totalHT: {
          min: 10000,
          max: 15000,
        },
      },
    },
  ] as WorkLot[],

  ...overrides,
});

describe('Phase0ContextAdapter', () => {
  describe('toAnalysisContext', () => {
    it('should transform a complete project to analysis context', () => {
      const project = createMockProject();
      const context = Phase0ContextAdapter.toAnalysisContext(project);

      expect(context.projectId).toBe('test-project-123');
      expect(context.projectReference).toBe('TORP-2024-001');
    });

    it('should extract budget correctly', () => {
      const project = createMockProject();
      const context = Phase0ContextAdapter.toAnalysisContext(project);

      expect(context.budget.totalEnvelope).toBe(50000);
      expect(context.budget.minBudget).toBe(40000);
      expect(context.budget.maxBudget).toBe(60000);
      expect(context.budget.contingencyPercent).toBe(10);
    });

    it('should extract expected lots', () => {
      const project = createMockProject();
      const context = Phase0ContextAdapter.toAnalysisContext(project);

      expect(context.expectedLots).toHaveLength(2);
      expect(context.expectedLots[0]).toMatchObject({
        category: 'plomberie',
        type: 'plumbing',
        label: 'Plomberie sanitaire',
        priority: 'required',
      });
      expect(context.expectedLots[0].estimatedBudget).toMatchObject({
        min: 5000,
        max: 8000,
      });
    });

    it('should detect RGE requirement from energy lots', () => {
      const project = createMockProject();
      const context = Phase0ContextAdapter.toAnalysisContext(project);

      expect(context.constraints.rgeRequired).toBe(true);
    });

    it('should extract constraints correctly', () => {
      const project = createMockProject();
      const context = Phase0ContextAdapter.toAnalysisContext(project);

      expect(context.constraints.startDate).toBe('2024-03-01');
      expect(context.constraints.endDate).toBe('2024-09-30');
      expect(context.constraints.maxDuration).toBe(6);
      expect(context.constraints.permitRequired).toBe(true);
      expect(context.constraints.heritageProtection).toBe(false);
      expect(context.constraints.blackoutPeriods).toHaveLength(1);
    });

    it('should extract access restrictions', () => {
      const project = createMockProject();
      const context = Phase0ContextAdapter.toAnalysisContext(project);

      expect(context.constraints.accessRestrictions).toContain('Accès véhicules limité');
      expect(context.constraints.accessRestrictions).toContain('Escaliers sans ascenseur');
    });

    it('should extract specific requirements', () => {
      const project = createMockProject();
      const context = Phase0ContextAdapter.toAnalysisContext(project);

      expect(context.constraints.specificRequirements).toContain('Isolation acoustique: standard');
      expect(context.constraints.specificRequirements).toContain('Performance thermique cible: C');
    });

    it('should extract owner profile for B2C', () => {
      const project = createMockProject();
      const context = Phase0ContextAdapter.toAnalysisContext(project);

      expect(context.ownerProfile.type).toBe('B2C');
      expect(context.ownerProfile.expertiseLevel).toBe('intermediate');
      expect(context.ownerProfile.communicationStyle).toBe('detailed');
      expect(context.ownerProfile.priorityFactors).toContain('quality');
    });

    it('should identify B2B owner type', () => {
      const project = createMockProject({
        ownerProfile: {
          identity: {
            type: 'company',
          },
          expertise: {
            projectExperience: { projectCount: 5 },
            professionalBackground: { hasBTPExperience: true },
          },
        },
      });
      const context = Phase0ContextAdapter.toAnalysisContext(project);

      expect(context.ownerProfile.type).toBe('B2B');
      expect(context.ownerProfile.expertiseLevel).toBe('expert');
      expect(context.ownerProfile.communicationStyle).toBe('technical');
    });

    it('should extract location correctly', () => {
      const project = createMockProject();
      const context = Phase0ContextAdapter.toAnalysisContext(project);

      expect(context.location.city).toBe('Lyon');
      expect(context.location.postalCode).toBe('69001');
      expect(context.location.region).toBe('Auvergne-Rhône-Alpes');
      expect(context.location.department).toBe('Rhône');
    });

    it('should extract work type', () => {
      const project = createMockProject();
      const context = Phase0ContextAdapter.toAnalysisContext(project);

      expect(context.workType.main).toBe('renovation');
      expect(context.workType.categories).toContain('plomberie');
      expect(context.workType.categories).toContain('energy');
    });

    it('should handle project with minimal data', () => {
      const minimalProject = createMockProject({
        workProject: undefined,
        property: undefined,
        ownerProfile: undefined,
        selectedLots: [],
      });

      const context = Phase0ContextAdapter.toAnalysisContext(minimalProject);

      expect(context.projectId).toBe('test-project-123');
      expect(context.budget.totalEnvelope).toBe(0);
      expect(context.expectedLots).toHaveLength(0);
      expect(context.location).toEqual({});
    });
  });

  describe('validateContext', () => {
    it('should validate a complete context', () => {
      const project = createMockProject();
      const context = Phase0ContextAdapter.toAnalysisContext(project);
      const validation = Phase0ContextAdapter.validateContext(context);

      expect(validation.isValid).toBe(true);
      expect(validation.completeness).toBeGreaterThanOrEqual(80);
      expect(validation.missingElements).toHaveLength(0);
    });

    it('should detect missing budget', () => {
      const project = createMockProject({
        workProject: {
          ...createMockProject().workProject,
          budget: undefined,
        },
        ownerProfile: {
          ...createMockProject().ownerProfile,
          financialCapacity: undefined,
        },
      });
      const context = Phase0ContextAdapter.toAnalysisContext(project);
      const validation = Phase0ContextAdapter.validateContext(context);

      expect(validation.missingElements).toContain('Budget estimé');
    });

    it('should detect missing lots', () => {
      const project = createMockProject({
        selectedLots: [],
      });
      const context = Phase0ContextAdapter.toAnalysisContext(project);
      const validation = Phase0ContextAdapter.validateContext(context);

      expect(validation.missingElements).toContain('Lots de travaux sélectionnés');
    });

    it('should detect missing location', () => {
      const project = createMockProject({
        property: undefined,
      });
      const context = Phase0ContextAdapter.toAnalysisContext(project);
      const validation = Phase0ContextAdapter.validateContext(context);

      expect(validation.missingElements).toContain('Localisation du bien');
    });

    it('should return valid for minimum required data', () => {
      const project = createMockProject();
      const context = Phase0ContextAdapter.toAnalysisContext(project);
      const validation = Phase0ContextAdapter.validateContext(context);

      // 50% minimum = budget (3) + lots (3) = 6 pts sur 10
      expect(validation.isValid).toBe(true);
      expect(validation.completeness).toBeGreaterThanOrEqual(50);
    });
  });
});
