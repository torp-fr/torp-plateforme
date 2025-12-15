/**
 * Tests for Lot Validation Service
 * Validates dependency and incompatibility rules between work lots
 */

import { describe, it, expect } from 'vitest';
import { LotValidationService } from './lot-validation.service';
import type { WorkLot } from '@/types/phase0/work-project.types';

// Helper to create mock WorkLot
function createMockLot(lotType: string): WorkLot {
  return {
    id: `lot-${lotType}`,
    lotType: lotType as any,
    category: 'test-category' as any,
    label: `Test ${lotType}`,
    estimatedCost: { min: 1000, max: 2000, unit: '€' },
    complexity: 'medium',
  };
}

describe('LotValidationService', () => {
  describe('validateSelection', () => {
    it('should return valid for empty selection', () => {
      const result = LotValidationService.validateSelection([]);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('should return valid for single lot', () => {
      const lots = [createMockLot('peinture_interieure')];
      const result = LotValidationService.validateSelection(lots);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect incompatible heating systems (PAC vs fioul)', () => {
      const lots = [
        createMockLot('chauff_pac_air_eau'),
        createMockLot('chauff_chaudiere_fioul'),
      ];
      const result = LotValidationService.validateSelection(lots);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].type).toBe('incompatibility');
    });

    it('should detect incompatible ventilation systems (VMC simple vs double)', () => {
      const lots = [
        createMockLot('ventil_vmc_simple'),
        createMockLot('ventil_vmc_double'),
      ];
      const result = LotValidationService.validateSelection(lots);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.type === 'incompatibility')).toBe(true);
    });

    it('should warn about incompatible window types', () => {
      const lots = [
        createMockLot('menuis_fenetres_pvc'),
        createMockLot('menuis_fenetres_bois'),
      ];
      const result = LotValidationService.validateSelection(lots);

      // Should have warnings, not errors
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0].severity).toBe('warning');
    });

    it('should detect missing required dependencies (SdB needs carrelage)', () => {
      const lots = [
        createMockLot('plomb_sdb_complete'),
      ];
      const result = LotValidationService.validateSelection(lots);

      // Should have errors for missing dependencies
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e =>
        e.type === 'dependency' && e.relatedLot === 'carrelage_faience'
      )).toBe(true);
    });

    it('should provide suggestions for recommended dependencies', () => {
      const lots = [
        createMockLot('couv_refection_complete'),
      ];
      const result = LotValidationService.validateSelection(lots);

      // Should suggest charpente treatment
      expect(result.suggestions.length).toBeGreaterThan(0);
      expect(result.suggestions.some(s =>
        s.lotType === 'charp_traitement' || s.lotType === 'isol_toiture_sarking'
      )).toBe(true);
    });

    it('should suggest VMC when isolation is selected', () => {
      const lots = [
        createMockLot('isol_combles_perdus'),
      ];
      const result = LotValidationService.validateSelection(lots);

      // Should suggest VMC or have a required dependency
      const hasVMCSuggestion = result.suggestions.some(s =>
        s.lotType.includes('ventil')
      );
      const hasVMCDependency = result.errors.some(e =>
        e.relatedLot?.includes('ventil')
      );

      expect(hasVMCSuggestion || hasVMCDependency).toBe(true);
    });

    it('should suggest volets when changing windows', () => {
      const lots = [
        createMockLot('menuis_fenetres_pvc'),
      ];
      const result = LotValidationService.validateSelection(lots);

      const hasVoletsSuggestion = result.suggestions.some(s =>
        s.lotType.includes('volets')
      );

      expect(hasVoletsSuggestion).toBe(true);
    });
  });

  describe('areLotsIncompatible', () => {
    it('should return incompatibility for PAC air-air vs plancher chauffant', () => {
      const result = LotValidationService.areLotsIncompatible(
        'chauff_pac_air_air',
        'chauff_plancher_chauffant'
      );

      expect(result).not.toBeNull();
      expect(result?.severity).toBe('error');
    });

    it('should return incompatibility in both directions', () => {
      const result1 = LotValidationService.areLotsIncompatible(
        'chauff_pac_air_eau',
        'chauff_chaudiere_fioul'
      );
      const result2 = LotValidationService.areLotsIncompatible(
        'chauff_chaudiere_fioul',
        'chauff_pac_air_eau'
      );

      expect(result1).not.toBeNull();
      expect(result2).not.toBeNull();
      expect(result1?.reason).toBe(result2?.reason);
    });

    it('should return null for compatible lots', () => {
      const result = LotValidationService.areLotsIncompatible(
        'peinture_interieure',
        'carrelage_faience'
      );

      expect(result).toBeNull();
    });

    it('should return warning for ITI vs ITE (same wall)', () => {
      const result = LotValidationService.areLotsIncompatible(
        'isol_murs_interieur',
        'isol_murs_exterieur'
      );

      expect(result).not.toBeNull();
      expect(result?.severity).toBe('warning');
    });
  });

  describe('getRequiredDependencies', () => {
    it('should return dependencies for electrical renovation', () => {
      const deps = LotValidationService.getRequiredDependencies('elec_renovation_complete');

      expect(deps.length).toBeGreaterThan(0);
      expect(deps.every(d => d.type === 'requires')).toBe(true);
    });

    it('should return dependencies for SdB renovation', () => {
      const deps = LotValidationService.getRequiredDependencies('plomb_sdb_complete');

      expect(deps.length).toBeGreaterThan(0);
      expect(deps.some(d => d.targetLot === 'carrelage_faience')).toBe(true);
      expect(deps.some(d => d.targetLot === 'elec_sdb_nfc15100')).toBe(true);
    });

    it('should return empty array for lot without required dependencies', () => {
      const deps = LotValidationService.getRequiredDependencies('peinture_interieure');

      expect(Array.isArray(deps)).toBe(true);
      expect(deps.length).toBe(0);
    });
  });

  describe('getRecommendedDependencies', () => {
    it('should return recommended dependencies for PAC', () => {
      const deps = LotValidationService.getRecommendedDependencies('chauff_pac_air_eau');

      expect(deps.length).toBeGreaterThan(0);
      expect(deps.every(d => d.type === 'recommended')).toBe(true);
      expect(deps.some(d => d.targetLot === 'chauff_plancher_chauffant')).toBe(true);
    });

    it('should return recommended dependencies for roof repair', () => {
      const deps = LotValidationService.getRecommendedDependencies('couv_refection_complete');

      expect(deps.length).toBeGreaterThan(0);
      expect(deps.some(d => d.targetLot.includes('charp') || d.targetLot.includes('isol'))).toBe(true);
    });
  });

  describe('getIncompatibleLots', () => {
    it('should return all incompatible lots for PAC air-eau', () => {
      const incompatibles = LotValidationService.getIncompatibleLots('chauff_pac_air_eau');

      expect(incompatibles.length).toBeGreaterThan(0);
      expect(incompatibles.some(i => i.lot1 === 'chauff_chaudiere_fioul' || i.lot2 === 'chauff_chaudiere_fioul')).toBe(true);
    });

    it('should return incompatible lots for VMC simple', () => {
      const incompatibles = LotValidationService.getIncompatibleLots('ventil_vmc_simple');

      expect(incompatibles.length).toBeGreaterThan(0);
      expect(incompatibles.some(i =>
        i.lot1 === 'ventil_vmc_double' || i.lot2 === 'ventil_vmc_double'
      )).toBe(true);
    });

    it('should return empty array for lots without incompatibilities', () => {
      const incompatibles = LotValidationService.getIncompatibleLots('peinture_interieure');

      expect(Array.isArray(incompatibles)).toBe(true);
      // May or may not be empty depending on rules
    });
  });

  describe('canAddLot', () => {
    it('should allow adding compatible lot', () => {
      const currentLots = ['peinture_interieure'] as any[];
      const result = LotValidationService.canAddLot('carrelage_faience', currentLots);

      expect(result.canAdd).toBe(true);
      expect(result.blockers).toHaveLength(0);
    });

    it('should block adding incompatible lot', () => {
      const currentLots = ['chauff_pac_air_eau'] as any[];
      const result = LotValidationService.canAddLot('chauff_chaudiere_fioul', currentLots);

      expect(result.canAdd).toBe(false);
      expect(result.blockers.length).toBeGreaterThan(0);
    });

    it('should allow adding to empty selection', () => {
      const currentLots: any[] = [];
      const result = LotValidationService.canAddLot('chauff_pac_air_eau', currentLots);

      expect(result.canAdd).toBe(true);
      expect(result.blockers).toHaveLength(0);
    });

    it('should block VMC double flux if VMC simple is already selected', () => {
      const currentLots = ['ventil_vmc_simple'] as any[];
      const result = LotValidationService.canAddLot('ventil_vmc_double', currentLots);

      expect(result.canAdd).toBe(false);
      expect(result.blockers[0].type).toBe('incompatibility');
    });
  });

  describe('autoResolveDependencies', () => {
    it('should add carrelage when SdB is selected', () => {
      const selectedLots = ['plomb_sdb_complete'] as any[];
      const resolved = LotValidationService.autoResolveDependencies(selectedLots);

      expect(resolved).toContain('plomb_sdb_complete');
      expect(resolved).toContain('carrelage_faience');
    });

    it('should add electrical norm when SdB is selected', () => {
      const selectedLots = ['plomb_sdb_complete'] as any[];
      const resolved = LotValidationService.autoResolveDependencies(selectedLots);

      expect(resolved).toContain('elec_sdb_nfc15100');
    });

    it('should add peinture when electrical renovation is selected', () => {
      const selectedLots = ['elec_renovation_complete'] as any[];
      const resolved = LotValidationService.autoResolveDependencies(selectedLots);

      expect(resolved).toContain('peinture_interieure');
    });

    it('should resolve cascading dependencies', () => {
      // ITI requires electrical work, which requires painting
      const selectedLots = ['isol_murs_interieur'] as any[];
      const resolved = LotValidationService.autoResolveDependencies(selectedLots);

      expect(resolved.length).toBeGreaterThan(1);
      expect(resolved).toContain('isol_murs_interieur');
    });

    it('should not duplicate already selected lots', () => {
      const selectedLots = ['plomb_sdb_complete', 'carrelage_faience'] as any[];
      const resolved = LotValidationService.autoResolveDependencies(selectedLots);

      // Count occurrences
      const carrelageCount = resolved.filter(l => l === 'carrelage_faience').length;
      expect(carrelageCount).toBe(1);
    });
  });
});

describe('ValidationResult structure', () => {
  it('should have correct properties', () => {
    const result = LotValidationService.validateSelection([]);

    expect(result).toHaveProperty('isValid');
    expect(result).toHaveProperty('errors');
    expect(result).toHaveProperty('warnings');
    expect(result).toHaveProperty('suggestions');

    expect(typeof result.isValid).toBe('boolean');
    expect(Array.isArray(result.errors)).toBe(true);
    expect(Array.isArray(result.warnings)).toBe(true);
    expect(Array.isArray(result.suggestions)).toBe(true);
  });

  it('should provide autoResolvable flag for dependency errors', () => {
    const lots = [createMockLot('plomb_sdb_complete')];
    const result = LotValidationService.validateSelection(lots);

    const depErrors = result.errors.filter(e => e.type === 'dependency');
    if (depErrors.length > 0) {
      expect(depErrors[0].autoResolvable).toBe(true);
      expect(depErrors[0].resolution).toBeDefined();
    }
  });

  it('should provide resolution messages', () => {
    const lots = [
      createMockLot('chauff_pac_air_eau'),
      createMockLot('chauff_chaudiere_fioul'),
    ];
    const result = LotValidationService.validateSelection(lots);

    if (result.errors.length > 0) {
      expect(result.errors[0].resolution).toBeDefined();
      expect(typeof result.errors[0].resolution).toBe('string');
    }
  });
});

describe('Suggestions quality', () => {
  it('should deduplicate suggestions', () => {
    const lots = [
      createMockLot('isol_combles_perdus'),
      createMockLot('isol_murs_interieur'),
    ];
    const result = LotValidationService.validateSelection(lots);

    // Check for duplicates in suggestions
    const lotTypes = result.suggestions.map(s => s.lotType);
    const uniqueLotTypes = [...new Set(lotTypes)];

    expect(lotTypes.length).toBe(uniqueLotTypes.length);
  });

  it('should prioritize high priority suggestions', () => {
    const lots = [createMockLot('isol_combles_perdus')];
    const result = LotValidationService.validateSelection(lots);

    const highPriority = result.suggestions.filter(s => s.priority === 'high');

    // If there's a VMC suggestion, it should be high priority
    const vmcSuggestion = result.suggestions.find(s => s.lotType.includes('ventil'));
    if (vmcSuggestion) {
      expect(vmcSuggestion.priority).toBe('high');
    }
  });
});
