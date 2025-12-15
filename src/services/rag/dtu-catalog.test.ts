/**
 * Tests for DTU Catalog
 * Validates the enriched DTU database and utility functions
 */

import { describe, it, expect } from 'vitest';
import {
  DTU_CATALOG_ENRICHED,
  getDTUsForCategory,
  getDTUByCode,
  getAllCategories,
  getTotalDTUCount,
  type DTUReferenceEnriched,
} from './dtu-catalog';

describe('DTU_CATALOG_ENRICHED', () => {
  it('should have all expected categories', () => {
    const expectedCategories = [
      'gros_oeuvre',
      'charpente',
      'couverture',
      'etancheite',
      'menuiserie',
      'isolation',
      'cloisons',
      'revetement_sol',
      'peinture',
      'plomberie',
      'chauffage',
      'electricite',
      'amenagement_exterieur',
      'accessibilite',
      'energie',
    ];

    expectedCategories.forEach(cat => {
      expect(DTU_CATALOG_ENRICHED[cat]).toBeDefined();
      expect(Array.isArray(DTU_CATALOG_ENRICHED[cat])).toBe(true);
      expect(DTU_CATALOG_ENRICHED[cat].length).toBeGreaterThan(0);
    });
  });

  it('should have valid DTU structure for each entry', () => {
    Object.values(DTU_CATALOG_ENRICHED).forEach(dtus => {
      dtus.forEach(dtu => {
        expect(dtu.code).toBeDefined();
        expect(typeof dtu.code).toBe('string');
        expect(dtu.title).toBeDefined();
        expect(typeof dtu.title).toBe('string');
        expect(dtu.category).toBeDefined();
        expect(Array.isArray(dtu.applicableTo)).toBe(true);
      });
    });
  });

  it('should have enriched data (keyRequirements, materials, controls)', () => {
    let dtuWithRequirements = 0;
    let dtuWithMaterials = 0;
    let dtuWithControls = 0;

    Object.values(DTU_CATALOG_ENRICHED).forEach(dtus => {
      dtus.forEach(dtu => {
        if (dtu.keyRequirements && dtu.keyRequirements.length > 0) dtuWithRequirements++;
        if (dtu.materials && dtu.materials.length > 0) dtuWithMaterials++;
        if (dtu.controls && dtu.controls.length > 0) dtuWithControls++;
      });
    });

    // At least 30% of DTUs should have enriched data
    const total = getTotalDTUCount();
    expect(dtuWithRequirements).toBeGreaterThan(total * 0.3);
    expect(dtuWithMaterials).toBeGreaterThan(total * 0.2);
    expect(dtuWithControls).toBeGreaterThan(total * 0.2);
  });
});

describe('getDTUsForCategory', () => {
  it('should return DTUs for gros_oeuvre', () => {
    const result = getDTUsForCategory('gros_oeuvre');

    expect(result.length).toBeGreaterThan(3);
    expect(result.some(d => d.code.includes('DTU 20.1'))).toBe(true);
    expect(result.some(d => d.code.includes('DTU 21'))).toBe(true);
  });

  it('should return DTUs for couverture', () => {
    const result = getDTUsForCategory('couverture');

    expect(result.length).toBeGreaterThan(2);
    expect(result.some(d => d.code.includes('DTU 40'))).toBe(true);
  });

  it('should return DTUs for electricite', () => {
    const result = getDTUsForCategory('electricite');

    expect(result.length).toBeGreaterThan(0);
    expect(result.some(d => d.code.includes('NF C 15-100'))).toBe(true);
  });

  it('should find DTUs by keyword search (fenêtres)', () => {
    const result = getDTUsForCategory('fenêtres');

    expect(result.length).toBeGreaterThan(0);
    expect(result.some(d => d.applicableTo.some(a => a.toLowerCase().includes('fenêtre')))).toBe(true);
  });

  it('should find DTUs by keyword search (carrelage)', () => {
    const result = getDTUsForCategory('carrelage');

    expect(result.length).toBeGreaterThan(0);
    expect(result.some(d => d.code.includes('DTU 52'))).toBe(true);
  });

  it('should handle normalized characters (é -> e)', () => {
    const result = getDTUsForCategory('etancheite');
    const resultAccented = getDTUsForCategory('étanchéité');

    // Both should return the same results
    expect(result.length).toBe(resultAccented.length);
  });

  it('should return empty array for unknown category', () => {
    const result = getDTUsForCategory('categorie_inexistante_xyz');

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(0);
  });
});

describe('getDTUByCode', () => {
  it('should find DTU 20.1', () => {
    const result = getDTUByCode('DTU 20.1');

    expect(result).toBeDefined();
    expect(result?.code).toBe('DTU 20.1');
    expect(result?.title).toContain('maçonnerie');
  });

  it('should find DTU 21', () => {
    const result = getDTUByCode('DTU 21');

    expect(result).toBeDefined();
    expect(result?.code).toBe('DTU 21');
    expect(result?.title.toLowerCase()).toContain('béton');
  });

  it('should find NF C 15-100', () => {
    const result = getDTUByCode('NF C 15-100');

    expect(result).toBeDefined();
    expect(result?.code).toBe('NF C 15-100');
    expect(result?.category).toBe('electricite');
  });

  it('should find DTU case-insensitively', () => {
    const result1 = getDTUByCode('dtu 20.1');
    const result2 = getDTUByCode('DTU 20.1');

    expect(result1).toBeDefined();
    expect(result2).toBeDefined();
    expect(result1?.code).toBe(result2?.code);
  });

  it('should return undefined for unknown DTU', () => {
    const result = getDTUByCode('DTU 99.99');

    expect(result).toBeUndefined();
  });

  it('should find RE2020', () => {
    const result = getDTUByCode('RE2020');

    expect(result).toBeDefined();
    expect(result?.title).toContain('2020');
    expect(result?.category).toBe('performance');
  });
});

describe('getAllCategories', () => {
  it('should return all categories', () => {
    const categories = getAllCategories();

    expect(Array.isArray(categories)).toBe(true);
    expect(categories.length).toBeGreaterThan(10);
    expect(categories).toContain('gros_oeuvre');
    expect(categories).toContain('electricite');
    expect(categories).toContain('plomberie');
  });

  it('should return unique categories', () => {
    const categories = getAllCategories();
    const uniqueCategories = [...new Set(categories)];

    expect(categories.length).toBe(uniqueCategories.length);
  });
});

describe('getTotalDTUCount', () => {
  it('should return total count greater than 40', () => {
    const count = getTotalDTUCount();

    expect(count).toBeGreaterThan(40);
  });

  it('should match sum of all categories', () => {
    const count = getTotalDTUCount();
    let manualCount = 0;

    Object.values(DTU_CATALOG_ENRICHED).forEach(dtus => {
      manualCount += dtus.length;
    });

    expect(count).toBe(manualCount);
  });
});

describe('DTU Data Quality', () => {
  it('DTU 13.11 (Fondations) should have detailed requirements', () => {
    const dtu = getDTUByCode('DTU 13.11');

    expect(dtu).toBeDefined();
    expect(dtu?.keyRequirements).toBeDefined();
    expect(dtu?.keyRequirements?.length).toBeGreaterThan(3);
    expect(dtu?.keyRequirements?.some(r => r.toLowerCase().includes('gel'))).toBe(true);
  });

  it('DTU 65.12 (Plancher chauffant) should have materials list', () => {
    const dtu = getDTUByCode('DTU 65.12');

    expect(dtu).toBeDefined();
    expect(dtu?.materials).toBeDefined();
    expect(dtu?.materials?.length).toBeGreaterThan(0);
    expect(dtu?.materials?.some(m => m.toLowerCase().includes('per') || m.toLowerCase().includes('tube'))).toBe(true);
  });

  it('NF C 15-100 should have control requirements', () => {
    const dtu = getDTUByCode('NF C 15-100');

    expect(dtu).toBeDefined();
    expect(dtu?.controls).toBeDefined();
    expect(dtu?.controls?.length).toBeGreaterThan(0);
    expect(dtu?.controls?.some(c => c.toLowerCase().includes('consuel'))).toBe(true);
  });

  it('DTU 36.5 (Menuiseries) should have applicableTo array', () => {
    const dtu = getDTUByCode('DTU 36.5');

    expect(dtu).toBeDefined();
    expect(dtu?.applicableTo).toBeDefined();
    expect(dtu?.applicableTo.length).toBeGreaterThan(0);
    expect(dtu?.applicableTo.some(a => a.toLowerCase().includes('fenêtre'))).toBe(true);
  });

  it('DTU 43.1 should have related norms', () => {
    const dtu = getDTUByCode('DTU 43.1');

    expect(dtu).toBeDefined();
    expect(dtu?.relatedNorms).toBeDefined();
    expect(dtu?.relatedNorms?.length).toBeGreaterThan(0);
  });
});
