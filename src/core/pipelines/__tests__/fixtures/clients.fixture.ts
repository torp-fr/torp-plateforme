// ─────────────────────────────────────────────────────────────────────────────
// fixtures/clients.fixture.ts — Test fixtures for client/enterprise data
// ─────────────────────────────────────────────────────────────────────────────

import type { PipelineContext } from '../../types/index.js';
import type { AddressQualityInput, EnterpriseQualityInput } from '../../utils/quality-scorer.js';
import type { EnterpriseAnomalyInput } from '../../utils/anomaly-detector.js';

export const makePipelineContext = (overrides?: Partial<PipelineContext>): PipelineContext => ({
  pipelineName: 'test-pipeline',
  entityId: 'test-entity-123',
  entityType: 'client',
  startedAt: new Date('2026-01-01T00:00:00Z'),
  timeout: 30_000,
  ...overrides,
});

// ── Address fixtures ─────────────────────────────────────────────────────────

export const ADDRESS_FIXTURES = {
  /** Full geocoded address from BANO — highest quality */
  fullGeocodedBANO: {
    raw: '12 rue de la Paix, 75001 Paris',
    street: '12 rue de la Paix',
    city: 'Paris',
    postalCode: '75001',
    lat: 48.8698,
    lon: 2.3309,
    source: 'bano',
    geocoderScore: 0.92,
  } satisfies AddressQualityInput,

  /** Nominatim fallback — good quality */
  nominatimFallback: {
    raw: '10 avenue Victor Hugo, 69100 Villeurbanne',
    street: '10 avenue Victor Hugo',
    city: 'Villeurbanne',
    postalCode: '69100',
    lat: 45.771,
    lon: 4.879,
    source: 'nominatim',
    geocoderScore: 0.71,
  } satisfies AddressQualityInput,

  /** Minimal — only postal code */
  postalCodeOnly: {
    raw: '75001',
    postalCode: '75001',
    source: 'user_input',
  } satisfies AddressQualityInput,

  /** Empty — nothing provided */
  empty: {} satisfies AddressQualityInput,
};

// ── Enterprise fixtures ──────────────────────────────────────────────────────

export const ENTERPRISE_FIXTURES = {
  /** Active BTP company — full data from Pappers */
  activeBTP: {
    siret: '35600000059843',
    siren: '356000000',
    name: 'BOUYGUES TRAVAUX PUBLICS',
    raisonSociale: 'BOUYGUES TRAVAUX PUBLICS',
    naf: '4120A',
    dateCreation: '1990-01-15',
    isActive: true,
    capitalSocial: 100_000_000,
    source: 'pappers',
  } satisfies EnterpriseQualityInput,

  /** Young company — created 3 months ago */
  youngCompany: {
    siret: '12345678901234',
    siren: '123456789',
    name: 'STARTUP BATIMENT',
    naf: '4321A',
    dateCreation: new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString(),
    isActive: true,
    capitalSocial: 500,
    source: 'insee',
  } satisfies EnterpriseQualityInput,

  /** Inactive / struck off */
  inactive: {
    siret: '99999999999999',
    siren: '999999999',
    name: 'SOCIETE RADIEE SAS',
    naf: '4120B',
    dateCreation: '2010-06-01',
    isActive: false,
    source: 'pappers',
  } satisfies EnterpriseQualityInput,

  /** Non-BTP NAF code */
  nonBTP: {
    siret: '55550000100018',
    siren: '555500001',
    name: 'RESTAURANT DU COIN SARL',
    naf: '5610A',
    dateCreation: '2015-03-12',
    isActive: true,
    capitalSocial: 10_000,
    source: 'pappers',
  } satisfies EnterpriseQualityInput,
};

// ── Enterprise anomaly fixtures ──────────────────────────────────────────────

export const ENTERPRISE_ANOMALY_FIXTURES = {
  invalidSIRET: {
    siret: '123ABC',
    name: 'TEST SAS',
  } satisfies EnterpriseAnomalyInput,

  sirenMismatch: {
    siret: '35600000059843',
    siren: '999999999',
    name: 'MISMATCH SA',
    isActive: true,
  } satisfies EnterpriseAnomalyInput,

  inactive: {
    siret: '35600000059843',
    siren: '356000000',
    name: 'INACTIVE SARL',
    isActive: false,
  } satisfies EnterpriseAnomalyInput,
};
