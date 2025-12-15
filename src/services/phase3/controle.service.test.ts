/**
 * Tests for ControleService
 * Tests for Phase 3 control and quality management
 */

import { describe, it, expect } from 'vitest';
import { ControleService } from './controle.service';

describe('ControleService', () => {
  describe('getMissionLibelle', () => {
    it('should return correct label for L (Solidité)', () => {
      const libelle = ControleService.getMissionLibelle('L');
      expect(libelle).toBe('Solidité des ouvrages');
    });

    it('should return correct label for S (Sécurité)', () => {
      const libelle = ControleService.getMissionLibelle('S');
      expect(libelle).toBe('Sécurité des personnes');
    });

    it('should return correct label for PS (Sécurité incendie)', () => {
      const libelle = ControleService.getMissionLibelle('PS');
      expect(libelle).toBe('Sécurité incendie');
    });

    it('should return correct label for HAND (Accessibilité)', () => {
      const libelle = ControleService.getMissionLibelle('HAND');
      expect(libelle).toBe('Accessibilité handicapés');
    });

    it('should return correct label for TH (Thermique)', () => {
      const libelle = ControleService.getMissionLibelle('TH');
      expect(libelle).toBe('Thermique');
    });

    it('should return correct label for PH (Acoustique)', () => {
      const libelle = ControleService.getMissionLibelle('PH');
      expect(libelle).toBe('Acoustique');
    });

    it('should return correct label for SEI (ERP)', () => {
      const libelle = ControleService.getMissionLibelle('SEI');
      expect(libelle).toBe('Sécurité ERP');
    });

    it('should return correct label for DTA (Amiante)', () => {
      const libelle = ControleService.getMissionLibelle('DTA');
      expect(libelle).toBe('Diagnostic amiante');
    });

    it('should return correct label for STI (Sécurité travail)', () => {
      const libelle = ControleService.getMissionLibelle('STI');
      expect(libelle).toBe('Sécurité travail');
    });

    it('should return correct label for AV (Ascenseurs)', () => {
      const libelle = ControleService.getMissionLibelle('AV');
      expect(libelle).toBe('Ascenseurs');
    });

    it('should return code itself for unknown mission', () => {
      const libelle = ControleService.getMissionLibelle('UNKNOWN');
      expect(libelle).toBe('UNKNOWN');
    });

    it('should return code for custom mission', () => {
      const libelle = ControleService.getMissionLibelle('CUSTOM123');
      expect(libelle).toBe('CUSTOM123');
    });
  });
});

describe('ControleService filter types', () => {
  // Testing filter interface shapes
  it('should accept valid OrganismeControleFilters', () => {
    const filters = {
      chantierId: 'chantier-123',
      type: 'bureau_controle' as const,
      statut: 'actif' as const,
    };

    expect(filters.chantierId).toBeDefined();
    expect(filters.type).toBe('bureau_controle');
    expect(filters.statut).toBe('actif');
  });

  it('should accept valid VisiteControleFilters', () => {
    const filters = {
      organismeId: 'org-123',
      chantierId: 'chantier-456',
      dateDebut: '2024-01-01',
      dateFin: '2024-12-31',
      statut: 'planifiee' as const,
    };

    expect(filters.dateDebut).toBe('2024-01-01');
    expect(filters.dateFin).toBe('2024-12-31');
  });

  it('should accept partial filters', () => {
    const filters = {
      chantierId: 'chantier-123',
    };

    expect(filters.chantierId).toBeDefined();
    expect((filters as any).type).toBeUndefined();
  });
});

describe('Type organisme codes', () => {
  const ORGANISME_TYPES = [
    'bureau_controle',
    'sps',
    'consuel',
    'qualigaz',
    'certigaz',
    'operateur_rt',
    'autre',
  ];

  it('should have 7 organisme types', () => {
    expect(ORGANISME_TYPES.length).toBe(7);
  });

  it('should include bureau_controle', () => {
    expect(ORGANISME_TYPES).toContain('bureau_controle');
  });

  it('should include sps (coordinateur SPS)', () => {
    expect(ORGANISME_TYPES).toContain('sps');
  });

  it('should include consuel', () => {
    expect(ORGANISME_TYPES).toContain('consuel');
  });

  it('should include qualigaz', () => {
    expect(ORGANISME_TYPES).toContain('qualigaz');
  });

  it('should include operateur_rt', () => {
    expect(ORGANISME_TYPES).toContain('operateur_rt');
  });
});

describe('Certification statuses', () => {
  const STATUT_CERTIFICATION = [
    'a_obtenir',
    'en_cours',
    'obtenu',
    'refuse',
    'expire',
  ];

  it('should have 5 certification statuses', () => {
    expect(STATUT_CERTIFICATION.length).toBe(5);
  });

  it('should follow logical progression', () => {
    // a_obtenir -> en_cours -> obtenu (success path)
    expect(STATUT_CERTIFICATION.indexOf('a_obtenir')).toBeLessThan(
      STATUT_CERTIFICATION.indexOf('en_cours')
    );
    expect(STATUT_CERTIFICATION.indexOf('en_cours')).toBeLessThan(
      STATUT_CERTIFICATION.indexOf('obtenu')
    );
  });
});

describe('Visite types', () => {
  const VISITE_TYPES = [
    'visite_initiale',
    'visite_periodique',
    'visite_finale',
    'visite_inopinee',
    'controle_levee_reserve',
  ];

  it('should have 5 visite types', () => {
    expect(VISITE_TYPES.length).toBe(5);
  });

  it('should include initial visit', () => {
    expect(VISITE_TYPES).toContain('visite_initiale');
  });

  it('should include final visit', () => {
    expect(VISITE_TYPES).toContain('visite_finale');
  });

  it('should include reserve lifting control', () => {
    expect(VISITE_TYPES).toContain('controle_levee_reserve');
  });
});

describe('Avis rapport values', () => {
  const AVIS_VALUES = ['favorable', 'favorable_reserve', 'defavorable', 'en_attente'];

  it('should have 4 possible avis', () => {
    expect(AVIS_VALUES.length).toBe(4);
  });

  it('should include favorable', () => {
    expect(AVIS_VALUES).toContain('favorable');
  });

  it('should include favorable_reserve', () => {
    expect(AVIS_VALUES).toContain('favorable_reserve');
  });

  it('should include defavorable', () => {
    expect(AVIS_VALUES).toContain('defavorable');
  });

  it('should include en_attente', () => {
    expect(AVIS_VALUES).toContain('en_attente');
  });
});

describe('Reserve severity levels', () => {
  const GRAVITE_LEVELS = ['mineure', 'majeure', 'bloquante'];

  it('should have 3 severity levels', () => {
    expect(GRAVITE_LEVELS.length).toBe(3);
  });

  it('should be ordered by severity', () => {
    expect(GRAVITE_LEVELS[0]).toBe('mineure');
    expect(GRAVITE_LEVELS[1]).toBe('majeure');
    expect(GRAVITE_LEVELS[2]).toBe('bloquante');
  });
});

describe('Reserve statuses', () => {
  const STATUT_RESERVE = ['emise', 'en_cours_traitement', 'levee', 'contestee'];

  it('should have 4 reserve statuses', () => {
    expect(STATUT_RESERVE.length).toBe(4);
  });

  it('should include emise (initial state)', () => {
    expect(STATUT_RESERVE).toContain('emise');
  });

  it('should include levee (final state)', () => {
    expect(STATUT_RESERVE).toContain('levee');
  });

  it('should include contestee (disputed state)', () => {
    expect(STATUT_RESERVE).toContain('contestee');
  });
});
