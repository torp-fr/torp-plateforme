/**
 * Tests for Market Data Service
 * Validates regional coefficients, indices and price adjustments
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MarketDataService, marketDataService } from './market-data.service';

describe('MarketDataService', () => {
  let service: MarketDataService;

  beforeEach(() => {
    service = new MarketDataService();
  });

  describe('getRegionalCoefficient', () => {
    it('should return coefficient for Paris (75)', () => {
      const result = service.getRegionalCoefficient('75001');

      expect(result.coefficient).toBe(1.25);
      expect(result.nomRegion).toBe('Île-de-France');
    });

    it('should return coefficient for Lyon (69)', () => {
      const result = service.getRegionalCoefficient('69001');

      expect(result.coefficient).toBe(1.05);
      expect(result.nomRegion).toBe('Auvergne-Rhône-Alpes');
    });

    it('should return coefficient for Marseille (13)', () => {
      const result = service.getRegionalCoefficient('13001');

      expect(result.coefficient).toBe(1.15);
      expect(result.nomRegion).toBe('Provence-Alpes-Côte d\'Azur');
    });

    it('should return coefficient for Nord (59)', () => {
      const result = service.getRegionalCoefficient('59000');

      expect(result.coefficient).toBe(0.90);
      expect(result.nomRegion).toBe('Hauts-de-France');
    });

    it('should return default coefficient for unknown department', () => {
      const result = service.getRegionalCoefficient('99999');

      expect(result.coefficient).toBe(1.0);
      expect(result.nomRegion).toBe('France métropolitaine');
    });

    it('should return coefficient for Corsica', () => {
      const result = service.getRegionalCoefficient('20000');

      expect(result.coefficient).toBe(1.20);
      expect(result.remarques).toContain('insulaire');
    });
  });

  describe('getAllRegionalCoefficients', () => {
    it('should return all regional coefficients', () => {
      const coefficients = service.getAllRegionalCoefficients();

      expect(coefficients.length).toBeGreaterThan(10);
      expect(coefficients.some(c => c.nomRegion === 'Île-de-France')).toBe(true);
    });

    it('should have valid coefficient values', () => {
      const coefficients = service.getAllRegionalCoefficients();

      coefficients.forEach(coef => {
        expect(coef.coefficient).toBeGreaterThan(0.5);
        expect(coef.coefficient).toBeLessThan(2);
      });
    });
  });

  describe('getBTIndex', () => {
    it('should return index for BT01', () => {
      const index = service.getBTIndex('BT01');

      expect(index).not.toBeNull();
      expect(index?.categorie).toBe('Tous corps d\'état');
      expect(index?.indiceCourant).toBeGreaterThan(100);
    });

    it('should find index by category name', () => {
      const index = service.getBTIndex('plomberie');

      expect(index).not.toBeNull();
      expect(index?.categorie.toLowerCase()).toContain('plomberie');
    });

    it('should return general index for unknown category', () => {
      const index = service.getBTIndex('categorie_inconnue');

      expect(index).not.toBeNull();
      expect(index?.categorie).toBe('Tous corps d\'état');
    });

    it('should have valid variation data', () => {
      const index = service.getBTIndex('chauffage');

      expect(index).not.toBeNull();
      expect(index?.variation12Mois).toBeDefined();
      expect(['hausse', 'stable', 'baisse']).toContain(index?.tendance);
    });
  });

  describe('getAllBTIndices', () => {
    it('should return multiple indices', () => {
      const indices = service.getAllBTIndices();

      expect(indices.length).toBeGreaterThan(5);
    });

    it('should have required properties', () => {
      const indices = service.getAllBTIndices();

      indices.forEach(index => {
        expect(index.categorie).toBeDefined();
        expect(index.indiceBase).toBeDefined();
        expect(index.indiceCourant).toBeDefined();
        expect(index.variation12Mois).toBeDefined();
        expect(index.tendance).toBeDefined();
      });
    });
  });

  describe('getSeasonalAdjustment', () => {
    it('should return adjustment for summer', () => {
      const august = service.getSeasonalAdjustment(8);

      expect(august.coefficient).toBeGreaterThan(1);
      expect(august.raison).toContain('Vacances');
    });

    it('should return adjustment for spring', () => {
      const may = service.getSeasonalAdjustment(5);

      expect(may.coefficient).toBeLessThan(1);
    });

    it('should return adjustment for all months', () => {
      for (let month = 1; month <= 12; month++) {
        const adjustment = service.getSeasonalAdjustment(month);
        expect(adjustment.mois).toBe(month);
        expect(adjustment.coefficient).toBeDefined();
        expect(adjustment.raison).toBeDefined();
      }
    });
  });

  describe('calculateAdjustedPrice', () => {
    it('should apply regional coefficient', () => {
      const result = service.calculateAdjustedPrice(1000, {
        codePostal: '75001',
      });

      expect(result.prixAjuste).toBe(1250); // 1000 * 1.25
      expect(result.details.coefficientRegional).toBe(1.25);
    });

    it('should apply seasonal coefficient', () => {
      const result = service.calculateAdjustedPrice(1000, {
        dateDevis: new Date('2024-08-15'), // Août
      });

      expect(result.prixAjuste).toBeGreaterThan(1000);
      expect(result.details.coefficientSaisonnier).toBeGreaterThan(1);
    });

    it('should apply inflation adjustment', () => {
      const result = service.calculateAdjustedPrice(1000, {
        categorie: 'chauffage',
        ajusterInflation: true,
      });

      expect(result.prixAjuste).toBeGreaterThan(1000);
      expect(result.details.coefficientInflation).toBeGreaterThan(1);
    });

    it('should combine all coefficients', () => {
      const result = service.calculateAdjustedPrice(1000, {
        codePostal: '75001',
        dateDevis: new Date('2024-08-15'),
        categorie: 'chauffage',
        ajusterInflation: true,
      });

      const expectedMultiplier =
        result.details.coefficientRegional *
        result.details.coefficientSaisonnier *
        result.details.coefficientInflation;

      expect(result.coefficientTotal).toBeCloseTo(expectedMultiplier, 2);
      expect(result.prixAjuste).toBeCloseTo(1000 * expectedMultiplier, 0);
    });

    it('should return original price with no options', () => {
      const result = service.calculateAdjustedPrice(1000, {});

      expect(result.prixAjuste).toBe(1000);
      expect(result.coefficientTotal).toBe(1);
    });
  });

  describe('getTrendAnalysis', () => {
    it('should return trend for known category', () => {
      const analysis = service.getTrendAnalysis('chauffage');

      expect(['hausse', 'stable', 'baisse']).toContain(analysis.tendance);
      expect(analysis.variation12Mois).toBeDefined();
      expect(analysis.prevision).toBeDefined();
    });

    it('should provide advice for rising prices', () => {
      const analysis = service.getTrendAnalysis('chauffage');

      if (analysis.tendance === 'hausse') {
        expect(analysis.conseils.length).toBeGreaterThan(0);
      }
    });

    it('should return default for unknown category', () => {
      const analysis = service.getTrendAnalysis('categorie_inconnue');

      // Pour une catégorie inconnue, retourne l'indice général BT01
      expect(['hausse', 'stable', 'baisse']).toContain(analysis.tendance);
      expect(analysis.variation12Mois).toBeDefined();
    });
  });

  describe('compareToMarket', () => {
    it('should identify correct price', () => {
      const result = service.compareToMarket(100, 80, 120);

      expect(result.position).toBe('correct');
      expect(result.interpretation).toContain('conforme');
    });

    it('should identify low price', () => {
      const result = service.compareToMarket(70, 80, 120);

      expect(result.position).toBe('bas');
    });

    it('should identify very low price', () => {
      const result = service.compareToMarket(40, 80, 120);

      expect(result.position).toBe('tres_bas');
      expect(result.interpretation).toContain('anormalement bas');
    });

    it('should identify high price', () => {
      const result = service.compareToMarket(150, 80, 120);

      expect(result.position).toBe('eleve');
    });

    it('should identify very high price', () => {
      const result = service.compareToMarket(200, 80, 120);

      expect(result.position).toBe('tres_eleve');
    });

    it('should adjust for region', () => {
      // Paris has 1.25 coefficient
      const parisResult = service.compareToMarket(100, 80, 120, '75001');
      // Nord has 0.90 coefficient
      const nordResult = service.compareToMarket(100, 80, 120, '59000');

      // Same price, different positions due to regional adjustment
      expect(parisResult.prixAjusteRegion.max).toBeGreaterThan(nordResult.prixAjusteRegion.max);
    });

    it('should calculate percentage deviation', () => {
      const result = service.compareToMarket(120, 80, 120);

      // Prix moyen = 100, prix = 120, écart = 20%
      expect(result.ecartPourcent).toBeCloseTo(20, 0);
    });
  });
});

describe('marketDataService singleton', () => {
  it('should be a singleton instance', () => {
    expect(marketDataService).toBeInstanceOf(MarketDataService);
  });

  it('should have working methods', () => {
    const coef = marketDataService.getRegionalCoefficient('75001');
    expect(coef.coefficient).toBe(1.25);
  });
});
