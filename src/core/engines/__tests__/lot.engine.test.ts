import { describe, test, expect } from 'vitest';
import { categorizeLot } from '../lot.engine';

describe('categorizeLot', () => {
  // ── Électricité ────────────────────────────────────────────────────────────
  test.each([
    'Électricité générale',
    'Installation électrique',
    'Tableau électrique',
    'Câblage circuits',
    'Câblage réseau',
    'Prises et interrupteurs',
    'Circuit spécialisé',
    'electricite',
    'Pompe electrique piscine',
  ])('"%s" → electricite', (input) => {
    expect(categorizeLot(input)).toBe('electricite');
  });

  // ── Plomberie ──────────────────────────────────────────────────────────────
  test.each([
    'Plomberie sanitaire',
    'Tuyauterie eau',
    'Réseau eau chaude',
    'Réseau eau froide',
    'Filtre à sable',
    'Pompe de circulation',  // circulation → plomberie
    'Assainissement',
    'Canalisation EU',
    'Robinetterie',
    'Sanitaires',
  ])('"%s" → plomberie', (input) => {
    expect(categorizeLot(input)).toBe('plomberie');
  });

  // ── Toiture ───────────────────────────────────────────────────────────────
  test.each([
    'Toiture zinc',
    'Couverture tuiles',
    'Zinguerie',
    'Ardoises',
    'Toiture terrasse',
  ])('"%s" → toiture', (input) => {
    expect(categorizeLot(input)).toBe('toiture');
  });

  // ── Structure (nouveau) ───────────────────────────────────────────────────
  test.each([
    'Terrassement et fouilles',
    'Fondations béton',
    'Béton armé bassin',
    'Maçonnerie générale',
    'Gros oeuvre',
    'Ferraillage',
    'Coffrage',
    'Dalle béton',
    'Mur porteur',
    'Structure béton armé',
    'Excavation',
  ])('"%s" → structure', (input) => {
    expect(categorizeLot(input)).toBe('structure');
  });

  // ── Chauffage (nouveau) ───────────────────────────────────────────────────
  test.each([
    'Chauffage central',
    'Climatisation',
    'Ventilation VMC',
    'VMC double flux',
    'CVC installation',
    'Thermopompe',
    'Chaudière gaz',
    'Radiateurs',
    'Plancher chauffant',
  ])('"%s" → chauffage', (input) => {
    expect(categorizeLot(input)).toBe('chauffage');
  });

  // ── Fallbacks ─────────────────────────────────────────────────────────────
  test('chaîne vide → unknown', () => {
    expect(categorizeLot('')).toBe('unknown');
  });

  test('type non reconnu → autre', () => {
    expect(categorizeLot('Peinture murale intérieure')).toBe('autre');
    expect(categorizeLot('Carrelage sol')).toBe('autre');
    expect(categorizeLot('Menuiserie bois')).toBe('autre');
  });

  // ── Piscine — cas réels du E2E test ──────────────────────────────────────
  test("tous les lots d'un devis piscine sont classifies", () => {
    const piscineLines = [
      'Terrassement et fouilles',
      'Structure béton armé bassin',
      'Plomberie réseau filtration',
      'Installation électrique pompe',
    ];
    const results = piscineLines.map(categorizeLot);
    expect(results).toEqual(['structure', 'structure', 'plomberie', 'electricite']);
    expect(results.every((r) => r !== 'autre')).toBe(true);
  });
});
