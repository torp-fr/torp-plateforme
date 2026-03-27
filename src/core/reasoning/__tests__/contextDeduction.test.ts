import { describe, test, expect } from 'vitest';
import {
  deduceImpliedDomains,
  enrichWithImpliedDomains,
  PROJECT_TYPE_TAXONOMY,
  VALID_DB_DOMAINS,
} from '../contextDeduction.service';

describe('contextDeduction.service', () => {
  describe('deduceImpliedDomains', () => {
    test('piscine → structure + hydraulique + électrique + sécurité + thermique', () => {
      const result = deduceImpliedDomains('piscine');
      expect(result).toContain('structure');
      expect(result).toContain('hydraulique');
      expect(result).toContain('électrique');
      expect(result).toContain('sécurité');
      expect(result).toContain('thermique');
      expect(result.length).toBeGreaterThanOrEqual(5);
    });

    test('maison_neuve → 7 domaines', () => {
      const result = deduceImpliedDomains('maison_neuve');
      expect(result.length).toBe(7);
      expect(result).toContain('structure');
      expect(result).toContain('thermique');
      expect(result).toContain('électrique');
      expect(result).toContain('hydraulique');
      expect(result).toContain('acoustique');
      expect(result).toContain('accessibilité');
    });

    test('electricite_seule → exactement électrique + sécurité', () => {
      const result = deduceImpliedDomains('electricite_seule');
      expect(result).toContain('électrique');
      expect(result).toContain('sécurité');
      expect(result.length).toBe(2);
    });

    test('plomberie_seule → hydraulique + sécurité', () => {
      const result = deduceImpliedDomains('plomberie_seule');
      expect(result).toContain('hydraulique');
      expect(result).toContain('sécurité');
      expect(result.length).toBe(2);
    });

    test('gros_oeuvre → structure + sismique + sécurité', () => {
      const result = deduceImpliedDomains('gros_oeuvre');
      expect(result).toContain('structure');
      expect(result).toContain('sismique');
      expect(result).toContain('sécurité');
    });

    test('ERP → tous les domaines (9)', () => {
      const result = deduceImpliedDomains('erp');
      expect(result.length).toBe(9);
    });

    // ── Normalisation ──────────────────────────────────────────────────────
    test('RENOVATION (majuscules) → normalisé correctement', () => {
      const result = deduceImpliedDomains('RENOVATION');
      expect(result.length).toBeGreaterThan(0);
      expect(result).toContain('structure');
    });

    test('"maison neuve" (espaces) → normalisé comme maison_neuve', () => {
      const result = deduceImpliedDomains('maison neuve');
      expect(result.length).toBe(7);
    });

    test('"Piscine Enterrée" (accents + majuscules) → normalisé', () => {
      const result = deduceImpliedDomains('Piscine Enterrée');
      expect(result).toContain('structure');
      expect(result).toContain('hydraulique');
    });

    // ── Fallbacks ──────────────────────────────────────────────────────────
    test('type inconnu → fallback structure', () => {
      const result = deduceImpliedDomains('xyz_unknown_type_42');
      expect(result).toEqual(['structure']);
    });

    test('chaîne vide → fallback structure', () => {
      expect(deduceImpliedDomains('')).toEqual(['structure']);
    });

    test('null → fallback structure', () => {
      expect(deduceImpliedDomains(null)).toEqual(['structure']);
    });

    test('undefined → fallback structure', () => {
      expect(deduceImpliedDomains(undefined)).toEqual(['structure']);
    });
  });

  // ── Intégrité de la taxonomie ────────────────────────────────────────────
  describe('PROJECT_TYPE_TAXONOMY integrity', () => {
    test('tous les domaines référencés sont valides en DB', () => {
      Object.entries(PROJECT_TYPE_TAXONOMY).forEach(([type, entry]) => {
        entry.domains.forEach((domain) => {
          expect(
            VALID_DB_DOMAINS,
            `Type "${type}" référence le domaine "${domain}" qui n'existe pas en DB`
          ).toContain(domain);
        });
      });
    });

    test('chaque entrée a au moins un domaine', () => {
      Object.entries(PROJECT_TYPE_TAXONOMY).forEach(([type, entry]) => {
        expect(entry.domains.length, `Type "${type}" a 0 domaine`).toBeGreaterThan(0);
      });
    });

    test('fallback "unknown" retourne structure', () => {
      expect(PROJECT_TYPE_TAXONOMY['unknown'].domains).toContain('structure');
    });

    test('au moins 15 types de projets définis', () => {
      expect(Object.keys(PROJECT_TYPE_TAXONOMY).length).toBeGreaterThanOrEqual(15);
    });
  });

  // ── enrichWithImpliedDomains ─────────────────────────────────────────────
  describe('enrichWithImpliedDomains', () => {
    test('ajoute impliedDomains et contextDeductionConfidence à projectData', () => {
      const result = enrichWithImpliedDomains({ type: 'piscine', size: '10x4m' });
      expect(result.impliedDomains).toContain('hydraulique');
      expect(result.contextDeductionConfidence).toBe('high');
      expect(result.size).toBe('10x4m'); // propriétés d'origine préservées
    });

    test('field "project_type" pris en compte si "type" absent', () => {
      const result = enrichWithImpliedDomains({ project_type: 'renovation' });
      expect(result.impliedDomains).toContain('structure');
      expect(result.impliedDomains).toContain('thermique');
    });

    test('type inconnu → confidence low + domains ["structure"]', () => {
      const result = enrichWithImpliedDomains({ type: 'niche_product_xyz' });
      expect(result.impliedDomains).toEqual(['structure']);
      expect(result.contextDeductionConfidence).toBe('low');
    });

    test('projectData sans type → fallback structure', () => {
      const result = enrichWithImpliedDomains({});
      expect(result.impliedDomains).toEqual(['structure']);
    });
  });
});
