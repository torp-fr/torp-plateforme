// ─────────────────────────────────────────────────────────────────────────────
// utils.pipeline.test.ts — Unit tests for pipeline utility modules
// Covers: domain-inference, quality-scorer, anomaly-detector, fallback-chain
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';

// Domain inference
import {
  getDomainProfile,
  inferItemDomain,
  requiresRGE,
  inferDTUsForCategory,
  scoreContractorDomainMatch,
} from '../utils/domain-inference.js';

// Quality scorer
import {
  scoreAddressQuality,
  scoreEnterpriseQuality,
  scoreDevisItemQuality,
  aggregateQualityScores,
} from '../utils/quality-scorer.js';

// Anomaly detector
import {
  detectPricingAnomalies,
  detectEnterpriseAnomalies,
  detectParsingAnomalies,
  detectStatisticalOutliers,
} from '../utils/anomaly-detector.js';

// Fallback chain
import { runFallbackChain, mergeFallbackResults } from '../utils/fallback-chain.js';

// Fixtures
import {
  ADDRESS_FIXTURES,
  ENTERPRISE_FIXTURES,
  ENTERPRISE_ANOMALY_FIXTURES,
} from './fixtures/clients.fixture.js';
import {
  DEVIS_ITEMS_WITH_ANOMALIES,
  DEVIS_ITEM_QUALITY,
  PARSING_GOOD,
  PARSING_BAD,
  PARSING_EMPTY,
} from './fixtures/devis.fixture.js';

// ── domain-inference ─────────────────────────────────────────────────────────

describe('domain-inference', () => {
  describe('getDomainProfile', () => {
    it('returns a profile for every known project type', () => {
      const types = [
        'piscine', 'renovation', 'extension', 'construction_neuve', 'maison_neuve',
        'toiture', 'electricite_seule', 'plomberie_seule', 'isolation', 'chauffage',
        'fenetre', 'cuisine', 'salle_de_bain', 'autre',
      ] as const;

      for (const t of types) {
        const profile = getDomainProfile(t);
        expect(profile).toBeDefined();
        expect(profile.primary).toBeTruthy();
        expect(Array.isArray(profile.dtu)).toBe(true);
        expect(Array.isArray(profile.normes)).toBe(true);
        expect(Array.isArray(profile.certifications)).toBe(true);
        expect(Array.isArray(profile.permits)).toBe(true);
      }
    });

    it('returns the autre fallback for unknown type', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const profile = getDomainProfile('unknown_type' as any);
      expect(profile.primary).toBe('divers');
    });

    it('piscine profile includes PLU permits', () => {
      const profile = getDomainProfile('piscine');
      expect(profile.permits.some(p => p.includes('PLU') || p.includes('Permis'))).toBe(true);
    });

    it('electricite_seule has NF C 15-100', () => {
      const profile = getDomainProfile('electricite_seule');
      expect(profile.normes.some(n => n.includes('NF C 15-100'))).toBe(true);
    });
  });

  describe('inferItemDomain', () => {
    it('maps electricite to électrique', () => {
      expect(inferItemDomain('electricite')).toBe('électrique');
    });

    it('maps plomberie to hydraulique', () => {
      expect(inferItemDomain('plomberie')).toBe('hydraulique');
    });

    it('falls back to divers for unknown category', () => {
      expect(inferItemDomain('unknown_category')).toBe('divers');
    });
  });

  describe('requiresRGE', () => {
    it('thermique requires RGE', () => {
      expect(requiresRGE('thermique')).toBe(true);
    });

    it('structure does not require RGE', () => {
      expect(requiresRGE('structure')).toBe(false);
    });
  });

  describe('inferDTUsForCategory', () => {
    it('electricite has DTU 70.1', () => {
      expect(inferDTUsForCategory('electricite')).toContain('DTU 70.1');
    });

    it('returns empty array for peinture', () => {
      expect(inferDTUsForCategory('peinture')).toEqual([]);
    });

    it('returns empty array for unknown category', () => {
      expect(inferDTUsForCategory('does_not_exist')).toEqual([]);
    });
  });

  describe('scoreContractorDomainMatch', () => {
    it('perfect match returns 1.0', () => {
      expect(scoreContractorDomainMatch('électrique', 'électrique')).toBe(1.0);
    });

    it('plombier matches hydraulique at 0.8', () => {
      expect(scoreContractorDomainMatch('plombier', 'hydraulique')).toBe(0.8);
    });

    it('tous corps d état returns 0.5', () => {
      expect(scoreContractorDomainMatch('tous corps d état', 'structure')).toBe(0.5);
    });

    it('unrelated activity returns 0.2', () => {
      expect(scoreContractorDomainMatch('fleuriste', 'électrique')).toBe(0.2);
    });
  });
});

// ── quality-scorer ────────────────────────────────────────────────────────────

describe('quality-scorer', () => {
  describe('scoreAddressQuality', () => {
    it('full BANO address scores excellent', () => {
      const result = scoreAddressQuality(ADDRESS_FIXTURES.fullGeocodedBANO);
      expect(result.score).toBeGreaterThanOrEqual(85);
      expect(result.tier).toBe('excellent');
    });

    it('empty address scores unusable', () => {
      const result = scoreAddressQuality(ADDRESS_FIXTURES.empty);
      expect(result.score).toBeLessThan(25);
      expect(result.tier).toBe('unusable');
    });

    it('nominatim fallback scores at least acceptable', () => {
      const result = scoreAddressQuality(ADDRESS_FIXTURES.nominatimFallback);
      expect(result.score).toBeGreaterThanOrEqual(45);
    });

    it('has strengths for BANO source', () => {
      const result = scoreAddressQuality(ADDRESS_FIXTURES.fullGeocodedBANO);
      expect(result.strengths.some(s => s.includes('BANO'))).toBe(true);
    });

    it('has weaknesses for empty address', () => {
      const result = scoreAddressQuality(ADDRESS_FIXTURES.empty);
      expect(result.weaknesses.length).toBeGreaterThan(0);
    });
  });

  describe('scoreEnterpriseQuality', () => {
    it('active BTP company from Pappers scores excellent', () => {
      const result = scoreEnterpriseQuality(ENTERPRISE_FIXTURES.activeBTP);
      expect(result.score).toBeGreaterThanOrEqual(85);
      expect(result.tier).toBe('excellent');
    });

    it('inactive company is flagged in weaknesses', () => {
      const result = scoreEnterpriseQuality(ENTERPRISE_FIXTURES.inactive);
      // isActive=false doesn't penalise score but must appear
      expect(result.weaknesses.length).toBeGreaterThan(0);
    });

    it('young company is penalised', () => {
      const youngResult = scoreEnterpriseQuality(ENTERPRISE_FIXTURES.youngCompany);
      const activeResult = scoreEnterpriseQuality(ENTERPRISE_FIXTURES.activeBTP);
      expect(youngResult.score).toBeLessThan(activeResult.score);
    });
  });

  describe('scoreDevisItemQuality', () => {
    it('complete item scores excellent', () => {
      const result = scoreDevisItemQuality(DEVIS_ITEM_QUALITY[0]);
      expect(result.score).toBeGreaterThanOrEqual(85);
    });

    it('empty item scores unusable', () => {
      const result = scoreDevisItemQuality(DEVIS_ITEM_QUALITY[1]);
      expect(result.score).toBeLessThan(25);
    });
  });

  describe('aggregateQualityScores', () => {
    it('aggregate of two excellent scores is excellent', () => {
      const s1 = scoreAddressQuality(ADDRESS_FIXTURES.fullGeocodedBANO);
      const s2 = scoreEnterpriseQuality(ENTERPRISE_FIXTURES.activeBTP);
      const agg = aggregateQualityScores([{ score: s1 }, { score: s2 }]);
      expect(agg.score).toBeGreaterThanOrEqual(70);
    });

    it('empty array returns unusable', () => {
      const agg = aggregateQualityScores([]);
      expect(agg.tier).toBe('unusable');
    });
  });
});

// ── anomaly-detector ─────────────────────────────────────────────────────────

describe('anomaly-detector', () => {
  describe('detectPricingAnomalies', () => {
    it('flags suspiciously low carrelage price', () => {
      const report = detectPricingAnomalies([DEVIS_ITEMS_WITH_ANOMALIES[0]]);
      const codes = report.anomalies.map(a => a.code);
      expect(codes).toContain('PRICE_SUSPICIOUSLY_LOW');
    });

    it('flags suspiciously high fenêtre price', () => {
      const report = detectPricingAnomalies([DEVIS_ITEMS_WITH_ANOMALIES[1]]);
      const codes = report.anomalies.map(a => a.code);
      expect(codes).toContain('PRICE_SUSPICIOUSLY_HIGH');
    });

    it('flags price×quantity mismatch', () => {
      const report = detectPricingAnomalies([DEVIS_ITEMS_WITH_ANOMALIES[2]]);
      const codes = report.anomalies.map(a => a.code);
      expect(codes).toContain('PRICE_TOTAL_MISMATCH');
    });

    it('no anomalies for reasonable prices', () => {
      const report = detectPricingAnomalies([{
        description: 'Carrelage grès cérame 30x30',
        unitPrice: 55,
        unit: 'm²',
        quantity: 20,
        totalHT: 1100,
      }]);
      expect(report.hasAnomalies).toBe(false);
    });
  });

  describe('detectEnterpriseAnomalies', () => {
    it('blocks on invalid SIRET format', () => {
      const report = detectEnterpriseAnomalies(ENTERPRISE_ANOMALY_FIXTURES.invalidSIRET);
      expect(report.criticalCount).toBeGreaterThan(0);
      const blockActions = report.anomalies.filter(a => a.action === 'block');
      expect(blockActions.length).toBeGreaterThan(0);
    });

    it('blocks on SIRET/SIREN mismatch', () => {
      const report = detectEnterpriseAnomalies(ENTERPRISE_ANOMALY_FIXTURES.sirenMismatch);
      const codes = report.anomalies.map(a => a.code);
      expect(codes).toContain('SIRET_SIREN_MISMATCH');
    });

    it('blocks on inactive company', () => {
      const report = detectEnterpriseAnomalies(ENTERPRISE_ANOMALY_FIXTURES.inactive);
      const codes = report.anomalies.map(a => a.code);
      expect(codes).toContain('ENTERPRISE_INACTIVE');
    });

    it('no anomalies for valid active company', () => {
      const report = detectEnterpriseAnomalies({
        siret: '35600000059843',
        siren: '356000000',
        name: 'BOUYGUES TP',
        naf: '4120A',
        dateCreation: '1990-01-01',
        isActive: true,
        capitalSocial: 1_000_000,
      });
      expect(report.criticalCount).toBe(0);
    });
  });

  describe('detectParsingAnomalies', () => {
    it('blocks when no items parsed', () => {
      const report = detectParsingAnomalies(PARSING_EMPTY);
      expect(report.criticalCount).toBeGreaterThan(0);
      const blockCodes = report.anomalies.filter(a => a.action === 'block').map(a => a.code);
      expect(blockCodes).toContain('NO_ITEMS_PARSED');
    });

    it('flags high missing price ratio', () => {
      const report = detectParsingAnomalies(PARSING_BAD);
      const codes = report.anomalies.map(a => a.code);
      expect(codes).toContain('HIGH_MISSING_PRICE_RATIO');
    });

    it('no critical anomalies for good parse', () => {
      const report = detectParsingAnomalies(PARSING_GOOD);
      expect(report.criticalCount).toBe(0);
    });
  });

  describe('detectStatisticalOutliers', () => {
    it('detects obvious outlier', () => {
      // With few points the outlier pulls the mean; use threshold 2.0 to stay reliable
      const values = [100, 102, 99, 101, 100, 98, 1000]; // 1000 is an outlier
      const outliers = detectStatisticalOutliers(values, 2.0);
      expect(outliers.length).toBeGreaterThan(0);
      expect(outliers[0].value).toBe(1000);
    });

    it('returns empty for uniform data', () => {
      const values = [100, 100, 100, 100, 100];
      expect(detectStatisticalOutliers(values)).toEqual([]);
    });

    it('returns empty for fewer than 3 values', () => {
      expect(detectStatisticalOutliers([100, 200])).toEqual([]);
    });
  });
});

// ── fallback-chain ────────────────────────────────────────────────────────────

describe('fallback-chain', () => {
  describe('runFallbackChain', () => {
    it('returns first successful step', async () => {
      const result = await runFallbackChain([
        { name: 'Step1', reliability: 0.9, fn: async () => ({ value: 'from-step1' }) },
        { name: 'Step2', reliability: 0.7, fn: async () => ({ value: 'from-step2' }) },
      ]);

      expect(result.data).toEqual({ value: 'from-step1' });
      expect(result.source).toBe('Step1');
      expect(result.isSynthetic).toBe(false);
    });

    it('skips null results and uses next step', async () => {
      const result = await runFallbackChain([
        { name: 'Step1', reliability: 0.9, fn: async () => null },
        { name: 'Step2', reliability: 0.7, fn: async () => ({ value: 'from-step2' }) },
      ]);

      expect(result.source).toBe('Step2');
      expect(result.attemptedSources).toContain('Step1');
    });

    it('uses synthetic fallback when all steps fail', async () => {
      const result = await runFallbackChain(
        [
          { name: 'Step1', reliability: 0.9, fn: async () => null },
          { name: 'Step2', reliability: 0.7, fn: async () => null },
        ],
        { name: 'Synthetic', fn: () => ({ value: 'synthetic' }) }
      );

      expect(result.isSynthetic).toBe(true);
      expect(result.reliability).toBe(0.1);
      expect(result.data).toEqual({ value: 'synthetic' });
    });

    it('throws when all steps fail and no synthetic fallback', async () => {
      await expect(
        runFallbackChain([
          { name: 'Step1', reliability: 0.9, fn: async () => null },
        ])
      ).rejects.toThrow('All fallback steps exhausted');
    });

    it('handles thrown errors and continues to next step', async () => {
      const result = await runFallbackChain([
        { name: 'Failing', reliability: 0.9, fn: async () => { throw new Error('API down'); } },
        { name: 'Backup', reliability: 0.6, fn: async () => ({ value: 'backup' }) },
      ]);

      expect(result.source).toBe('Backup');
    });
  });

  describe('mergeFallbackResults', () => {
    it('prefers higher reliability source for overlapping fields', () => {
      const primary = {
        data: { a: 'primary-a', b: undefined as unknown as string },
        source: 'primary',
        isSynthetic: false,
        reliability: 0.9,
        attemptedSources: ['primary'],
      };
      const secondary = {
        data: { a: 'secondary-a', b: 'secondary-b' },
        source: 'secondary',
        isSynthetic: false,
        reliability: 0.6,
        attemptedSources: ['secondary'],
      };

      const merged = mergeFallbackResults(primary, secondary);
      expect(merged.data.a).toBe('primary-a');  // primary wins
      expect(merged.data.b).toBe('secondary-b'); // fill missing from secondary
    });

    it('merged reliability is the max of both', () => {
      const a = { data: {}, source: 'a', isSynthetic: false, reliability: 0.8, attemptedSources: [] };
      const b = { data: {}, source: 'b', isSynthetic: false, reliability: 0.6, attemptedSources: [] };
      const merged = mergeFallbackResults(a, b);
      expect(merged.reliability).toBe(0.8);
    });
  });
});
