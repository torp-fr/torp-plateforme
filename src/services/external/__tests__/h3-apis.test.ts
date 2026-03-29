import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mock structured logger ────────────────────────────────────────────────────
vi.mock('@/services/observability/structured-logger', () => ({
  structuredLogger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

// ── Mock Supabase client for PappersService + AnthropicService ───────────────
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn().mockReturnValue({
      insert: vi.fn().mockResolvedValue({ error: null }),
    }),
  })),
}));

// ── Mock @anthropic-ai/sdk ────────────────────────────────────────────────────
// Use vi.hoisted so the reference is available before vi.mock factory runs.
const { mockAnthropicCreate } = vi.hoisted(() => ({
  mockAnthropicCreate: vi.fn(),
}));

vi.mock('@anthropic-ai/sdk', () => {
  // Use a regular function (not arrow) so it can be used with `new`
  const MockAnthropic = vi.fn(function MockAnthropic(this: Record<string, unknown>) {
    this.messages = { create: mockAnthropicCreate };
  });
  return { default: MockAnthropic };
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function mockFetchOk(body: unknown, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(body),
  });
}

function mockFetchFail(status: number) {
  return vi.fn().mockResolvedValue({
    ok: false,
    status,
    json: vi.fn().mockResolvedValue({}),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// SireneService
// ─────────────────────────────────────────────────────────────────────────────

describe('SireneService', () => {
  let SireneService: typeof import('../sirene.service.js').SireneService;
  let service: InstanceType<typeof SireneService>;

  beforeEach(async () => {
    vi.resetModules();
    ({ SireneService } = await import('../sirene.service.js'));
    service = new SireneService();
  });

  afterEach(() => vi.restoreAllMocks());

  // ── validateSiret ──────────────────────────────────────────────────────────

  describe('validateSiret()', () => {
    it('returns false for non-14-digit input', () => {
      expect(service.validateSiret('1234')).toBe(false);
    });

    it('returns false for non-numeric input', () => {
      expect(service.validateSiret('1234ABCD567890')).toBe(false);
    });

    it('returns true for a valid SIRET (Luhn check)', () => {
      // Computed valid SIRET: 1234567890123 + Luhn check digit 7
      expect(service.validateSiret('12345678901237')).toBe(true);
    });

    it('returns false for invalid Luhn checksum', () => {
      expect(service.validateSiret('12345678901234')).toBe(false);
    });

    it('handles SIRET with spaces', () => {
      // Spaces stripped before validation
      expect(service.validateSiret('12345 67890 12 37')).toBe(true);
    });
  });

  // ── getEntrepriseBySiret ───────────────────────────────────────────────────

  describe('getEntrepriseBySiret()', () => {
    it('throws for invalid SIRET format', async () => {
      await expect(service.getEntrepriseBySiret('12345')).rejects.toThrow('Invalid SIRET');
    });

    it('fetches from open API when no SIRENE_API_KEY', async () => {
      delete process.env.SIRENE_API_KEY;
      vi.stubGlobal('fetch', mockFetchOk({
        results: [{
          siren: '123456789',
          siret: '12345678900001',
          siege: {
            siret: '12345678900001',
            adresse: '1 rue de la Paix',
            code_postal: '75001',
            libelle_commune: 'Paris',
          },
          nom_complet: 'ACME SAS',
          etat_administratif: 'A',
        }],
      }));

      const result = await service.getEntrepriseBySiret('12345678900001');
      expect(result.source).toBe('insee-sirene');
      expect(result.siren).toBe('123456789');
    });

    it('returns est_actif=false when etat_administratif is not A', async () => {
      delete process.env.SIRENE_API_KEY;
      vi.stubGlobal('fetch', mockFetchOk({
        results: [{
          siren: '987654321',
          siege: { siret: '98765432100001' },
          nom_complet: 'DEFUNCT SARL',
          etat_administratif: 'C',
        }],
      }));

      const result = await service.getEntrepriseBySiret('98765432100001');
      expect(result.est_actif).toBe(false);
    });

    it('throws when open API returns empty results and SIREN fallback also fails', async () => {
      delete process.env.SIRENE_API_KEY;
      vi.stubGlobal('fetch', mockFetchOk({ results: [] }));
      await expect(service.getEntrepriseBySiret('12345678900001')).rejects.toThrow('non trouvée');
    });

    it('throws when API returns non-OK status', async () => {
      delete process.env.SIRENE_API_KEY;
      vi.stubGlobal('fetch', mockFetchFail(503));
      await expect(service.getEntrepriseBySiret('12345678900001')).rejects.toThrow('503');
    });
  });

  // ── searchEntreprises ─────────────────────────────────────────────────────

  describe('searchEntreprises()', () => {
    it('returns mapped SireneEntreprise array', async () => {
      vi.stubGlobal('fetch', mockFetchOk({
        results: [
          { siren: '111111111', siege: { siret: '11111111100001' }, nom_complet: 'PLOMBERIE DUPONT', etat_administratif: 'A' },
          { siren: '222222222', siege: { siret: '22222222200002' }, nom_complet: 'ELEC MARTIN', etat_administratif: 'A' },
        ],
      }));

      const results = await service.searchEntreprises('plomberie');
      expect(results).toHaveLength(2);
      expect(results[0].source).toBe('insee-sirene');
    });

    it('returns empty array on empty results', async () => {
      vi.stubGlobal('fetch', mockFetchOk({ results: [] }));
      const results = await service.searchEntreprises('xqznonexistent');
      expect(results).toHaveLength(0);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GeoplatformeGeocodingService
// ─────────────────────────────────────────────────────────────────────────────

describe('GeoplatformeGeocodingService', () => {
  let GeoplatformeGeocodingService: typeof import('../geoplateforme-geocoding.service.js').GeoplatformeGeocodingService;
  let service: InstanceType<typeof GeoplatformeGeocodingService>;

  const SAMPLE_FEATURE = {
    geometry: { type: 'Point', coordinates: [2.3522, 48.8566] },
    properties: {
      score: 0.97,
      label: '1 Rue de la Paix, 75001 Paris',
      housenumber: '1',
      street: 'Rue de la Paix',
      postcode: '75001',
      city: 'Paris',
      citycode: '75056',
      type: 'housenumber',
    },
  };

  beforeEach(async () => {
    vi.resetModules();
    ({ GeoplatformeGeocodingService } = await import('../geoplateforme-geocoding.service.js'));
    service = new GeoplatformeGeocodingService();
  });

  afterEach(() => vi.restoreAllMocks());

  describe('geocodeAddress()', () => {
    it('returns mapped GeocodingResult', async () => {
      vi.stubGlobal('fetch', mockFetchOk({ features: [SAMPLE_FEATURE] }));
      const result = await service.geocodeAddress('1 Rue de la Paix, Paris');
      expect(result.lat).toBe(48.8566);
      expect(result.lng).toBe(2.3522);
      expect(result.score).toBe(0.97);
      expect(result.source).toBe('geoplateforme');
    });

    it('includes postcode when provided', async () => {
      const fetchMock = mockFetchOk({ features: [SAMPLE_FEATURE] });
      vi.stubGlobal('fetch', fetchMock);
      await service.geocodeAddress('1 Rue de la Paix', '75001');
      const calledUrl = fetchMock.mock.calls[0][0] as string;
      expect(calledUrl).toContain('postcode=75001');
    });

    it('throws when no features returned', async () => {
      vi.stubGlobal('fetch', mockFetchOk({ features: [] }));
      await expect(service.geocodeAddress('adresse inexistante xyz')).rejects.toThrow('No geocoding result');
    });

    it('throws when API returns non-OK status', async () => {
      vi.stubGlobal('fetch', mockFetchFail(503));
      await expect(service.geocodeAddress('1 Rue de la Paix')).rejects.toThrow('503');
    });
  });

  describe('geocodeBatch()', () => {
    it('returns array with null for failed addresses', async () => {
      vi.stubGlobal('fetch', vi.fn()
        .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({ features: [SAMPLE_FEATURE] }) })
        .mockResolvedValueOnce({ ok: false, status: 503, json: () => Promise.resolve({}) })
      );

      const results = await service.geocodeBatch(['good address', 'bad address']);
      expect(results).toHaveLength(2);
      expect(results[0]).not.toBeNull();
      expect(results[1]).toBeNull();
    });
  });

  describe('reverseGeocode()', () => {
    it('returns ReverseGeocodingResult with distance_m', async () => {
      const featureWithDist = {
        ...SAMPLE_FEATURE,
        properties: { ...SAMPLE_FEATURE.properties, distance: 15 },
      };
      vi.stubGlobal('fetch', mockFetchOk({ features: [featureWithDist] }));

      const result = await service.reverseGeocode(48.8566, 2.3522);
      expect(result.distance_m).toBe(15);
      expect(result.source).toBe('geoplateforme');
    });

    it('defaults distance_m to 0 when not in response', async () => {
      vi.stubGlobal('fetch', mockFetchOk({ features: [SAMPLE_FEATURE] }));
      const result = await service.reverseGeocode(48.8566, 2.3522);
      expect(result.distance_m).toBe(0);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BdnbService
// ─────────────────────────────────────────────────────────────────────────────

describe('BdnbService', () => {
  let BdnbService: typeof import('../bdnb.service.js').BdnbService;
  let service: InstanceType<typeof BdnbService>;

  const SAMPLE_BUILDING = {
    rnb_id: 'RNB-12345',
    annee_construction: 1985,
    surface_m2_bat: 250.5,
    dpe_conso_energie: 'C',
    dpe_emission_ges: 'B',
    type_energie_principale_chauffage: 'gaz',
    nb_log: 8,
    type_batiment: 'résidentiel',
    adresse_principale: '12 rue Victor Hugo',
    code_postal_battant: '69001',
    lib_commune_battant: 'Lyon',
  };

  beforeEach(async () => {
    vi.resetModules();
    ({ BdnbService } = await import('../bdnb.service.js'));
    service = new BdnbService();
  });

  afterEach(() => vi.restoreAllMocks());

  describe('getBuildingsByLocation()', () => {
    it('returns mapped BdnbBuilding array', async () => {
      vi.stubGlobal('fetch', mockFetchOk([SAMPLE_BUILDING]));
      const results = await service.getBuildingsByLocation(45.7640, 4.8357);
      expect(results).toHaveLength(1);
      expect(results[0].building_id).toBe('RNB-12345');
      expect(results[0].energy_class).toBe('C');
      expect(results[0].source).toBe('bdnb');
    });

    it('uses correct PostGIS POINT syntax (lng lat order)', async () => {
      const fetchMock = mockFetchOk([]);
      vi.stubGlobal('fetch', fetchMock);
      await service.getBuildingsByLocation(48.8566, 2.3522);
      const calledUrl = fetchMock.mock.calls[0][0] as string;
      // PostGIS: POINT(lng lat) = POINT(2.3522 48.8566)
      expect(calledUrl).toContain('POINT(2.3522%2048.8566)');
    });

    it('returns empty array for empty response', async () => {
      vi.stubGlobal('fetch', mockFetchOk([]));
      const results = await service.getBuildingsByLocation(48, 2);
      expect(results).toHaveLength(0);
    });

    it('throws when API returns non-OK status', async () => {
      vi.stubGlobal('fetch', mockFetchFail(500));
      await expect(service.getBuildingsByLocation(48, 2)).rejects.toThrow('500');
    });
  });

  describe('getBuildingById()', () => {
    it('returns mapped building when found', async () => {
      vi.stubGlobal('fetch', mockFetchOk([SAMPLE_BUILDING]));
      const result = await service.getBuildingById('RNB-12345');
      expect(result).not.toBeNull();
      expect(result!.year_construction).toBe(1985);
      expect(result!.surface_m2).toBe(250.5);
    });

    it('returns null when not found', async () => {
      vi.stubGlobal('fetch', mockFetchOk([]));
      const result = await service.getBuildingById('NONEXISTENT');
      expect(result).toBeNull();
    });

    it('parses null fields gracefully', async () => {
      vi.stubGlobal('fetch', mockFetchOk([{ rnb_id: 'X', annee_construction: null, surface_m2_bat: null }]));
      const result = await service.getBuildingById('X');
      expect(result!.year_construction).toBeNull();
      expect(result!.surface_m2).toBeNull();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ApiCartoService
// ─────────────────────────────────────────────────────────────────────────────

describe('ApiCartoService', () => {
  let ApiCartoService: typeof import('../api-carto.service.js').ApiCartoService;
  let service: InstanceType<typeof ApiCartoService>;

  const SAMPLE_PARCEL_FEATURE = {
    id: 'parcel-abc',
    properties: {
      section:   'AB',
      numero:    '0042',
      code_insee: '75056',
      nom_commune: 'Paris',
      code_postal: '75001',
      contenance: 120,
      nature_culture: 'maison',
    },
  };

  const SAMPLE_PLU_FEATURE = {
    properties: {
      partition: 'DU_69001',
      libelle:   'UA',
      libelong:  'Zone urbaine mixte',
      typezone:  'U',
      urlfiche:  null,
      datappro:  '2020-03-15',
    },
  };

  beforeEach(async () => {
    vi.resetModules();
    ({ ApiCartoService } = await import('../api-carto.service.js'));
    service = new ApiCartoService();
  });

  afterEach(() => vi.restoreAllMocks());

  describe('getParcelsByLocation()', () => {
    it('returns CadastreResult with mapped parcels', async () => {
      vi.stubGlobal('fetch', mockFetchOk({
        features: [SAMPLE_PARCEL_FEATURE],
        numberMatched: 1,
      }));

      const result = await service.getParcelsByLocation(48.8566, 2.3522);
      expect(result.total).toBe(1);
      expect(result.parcels[0].section).toBe('AB');
      expect(result.parcels[0].source).toBe('api-carto-cadastre');
    });

    it('returns empty result when no parcels found', async () => {
      vi.stubGlobal('fetch', mockFetchOk({ features: [], numberMatched: 0 }));
      const result = await service.getParcelsByLocation(0, 0);
      expect(result.total).toBe(0);
      expect(result.parcels).toHaveLength(0);
    });

    it('throws when API returns non-OK status', async () => {
      vi.stubGlobal('fetch', mockFetchFail(500));
      await expect(service.getParcelsByLocation(48, 2)).rejects.toThrow('500');
    });
  });

  describe('getParcelByReference()', () => {
    it('returns mapped parcel when found', async () => {
      vi.stubGlobal('fetch', mockFetchOk({ features: [SAMPLE_PARCEL_FEATURE] }));
      const result = await service.getParcelByReference('75056', 'AB', '0042');
      expect(result).not.toBeNull();
      expect(result!.numero).toBe('0042');
      expect(result!.contenance).toBe(120);
    });

    it('returns null when parcel not found', async () => {
      vi.stubGlobal('fetch', mockFetchOk({ features: [] }));
      const result = await service.getParcelByReference('75056', 'ZZ', '9999');
      expect(result).toBeNull();
    });
  });

  describe('getPLUZonesByLocation()', () => {
    it('returns mapped PLUZone array', async () => {
      vi.stubGlobal('fetch', mockFetchOk({ features: [SAMPLE_PLU_FEATURE] }));
      const zones = await service.getPLUZonesByLocation(45.7640, 4.8357);
      expect(zones).toHaveLength(1);
      expect(zones[0].libelle).toBe('UA');
      expect(zones[0].typezone).toBe('U');
      expect(zones[0].source).toBe('api-carto-gpu');
    });

    it('returns empty array when no zones found', async () => {
      vi.stubGlobal('fetch', mockFetchOk({ features: [] }));
      const zones = await service.getPLUZonesByLocation(0, 0);
      expect(zones).toHaveLength(0);
    });
  });

  describe('getCommuneByInsee()', () => {
    it('returns feature when found', async () => {
      vi.stubGlobal('fetch', mockFetchOk({ features: [{ type: 'Feature', id: 'commune-75056' }] }));
      const result = await service.getCommuneByInsee('75056');
      expect(result).not.toBeNull();
    });

    it('returns null when not found', async () => {
      vi.stubGlobal('fetch', mockFetchOk({ features: [] }));
      const result = await service.getCommuneByInsee('99999');
      expect(result).toBeNull();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PappersService
// ─────────────────────────────────────────────────────────────────────────────

describe('PappersService', () => {
  let PappersService: typeof import('../pappers.service.js').PappersService;
  let service: InstanceType<typeof PappersService>;

  const SAMPLE_ENTREPRISE_RESPONSE = {
    siren: '123456789',
    siret_siege: '12345678900001',
    nom_entreprise: 'BATIMENT DUPONT SAS',
    forme_juridique: 'SAS',
    code_naf: '4391A',
    libelle_code_naf: 'Travaux de charpente',
    date_creation: '2010-03-15',
    entreprise_cessee: false,
    effectif_min: 10,
    effectif_max: 19,
    capital: 10000,
    siege: {
      adresse_ligne_1: '5 allée des artisans',
      code_postal: '69100',
      ville: 'Villeurbanne',
    },
    score: 8,
    en_liquidation: false,
    en_redressement: false,
    representants: [
      { nom: 'DUPONT', prenom: 'Jean', qualite: 'Président', date_naissance_formate: '1975-06-20', nationalite: 'Française' },
    ],
    certifications: [{ nom: 'Qualibat RGE' }],
  };

  beforeEach(async () => {
    vi.resetModules();
    process.env.PAPPERS_API_KEY = 'test-pappers-key';
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
    ({ PappersService } = await import('../pappers.service.js'));
    service = new PappersService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.PAPPERS_API_KEY;
  });

  describe('getEntrepriseBySiren()', () => {
    it('throws when PAPPERS_API_KEY is not set', async () => {
      delete process.env.PAPPERS_API_KEY;
      vi.resetModules();
      const { PappersService: Fresh } = await import('../pappers.service.js');
      const svc = new Fresh();
      await expect(svc.getEntrepriseBySiren('123456789')).rejects.toThrow('PAPPERS_API_KEY');
    });

    it('throws for invalid SIREN format', async () => {
      await expect(service.getEntrepriseBySiren('12345')).rejects.toThrow('Invalid SIREN');
    });

    it('returns mapped PappersEntreprise', async () => {
      vi.stubGlobal('fetch', mockFetchOk(SAMPLE_ENTREPRISE_RESPONSE));
      const result = await service.getEntrepriseBySiren('123456789');
      expect(result.siren).toBe('123456789');
      expect(result.nom_entreprise).toBe('BATIMENT DUPONT SAS');
      expect(result.source).toBe('pappers');
    });

    it('maps dirigeants correctly', async () => {
      vi.stubGlobal('fetch', mockFetchOk(SAMPLE_ENTREPRISE_RESPONSE));
      const result = await service.getEntrepriseBySiren('123456789');
      expect(result.dirigeants).toHaveLength(1);
      expect(result.dirigeants[0].nom).toBe('DUPONT');
      expect(result.dirigeants[0].qualite).toBe('Président');
    });

    it('maps certifications_rge correctly', async () => {
      vi.stubGlobal('fetch', mockFetchOk(SAMPLE_ENTREPRISE_RESPONSE));
      const result = await service.getEntrepriseBySiren('123456789');
      expect(result.certifications_rge).toContain('Qualibat RGE');
    });

    it('throws on 401 response', async () => {
      vi.stubGlobal('fetch', mockFetchFail(401));
      await expect(service.getEntrepriseBySiren('123456789')).rejects.toThrow('clé API');
    });

    it('throws on 404 response', async () => {
      vi.stubGlobal('fetch', mockFetchFail(404));
      await expect(service.getEntrepriseBySiren('123456789')).rejects.toThrow('non trouvée');
    });
  });

  describe('getEntrepriseBySiret()', () => {
    it('throws for invalid SIRET format', async () => {
      await expect(service.getEntrepriseBySiret('1234')).rejects.toThrow('Invalid SIRET');
    });

    it('extracts SIREN from SIRET and calls getEntrepriseBySiren', async () => {
      vi.stubGlobal('fetch', mockFetchOk(SAMPLE_ENTREPRISE_RESPONSE));
      const result = await service.getEntrepriseBySiret('12345678900001');
      expect(result.source).toBe('pappers');
    });
  });

  describe('searchEntreprises()', () => {
    it('returns mapped PappersSearchResult array', async () => {
      vi.stubGlobal('fetch', mockFetchOk({
        resultats: [
          { siren: '111', nom_entreprise: 'BTP SAS', siret_siege: '11100001', siege: { adresse_ligne_1: '1 rue test' }, code_naf: '43', entreprise_cessee: false },
        ],
      }));

      const results = await service.searchEntreprises('BTP');
      expect(results).toHaveLength(1);
      expect(results[0].nom_entreprise).toBe('BTP SAS');
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AnthropicService
// ─────────────────────────────────────────────────────────────────────────────

describe('AnthropicService', () => {
  let AnthropicService: typeof import('../anthropic.service.js').AnthropicService;

  beforeEach(async () => {
    // No vi.resetModules() — the SDK mock is module-level via vi.hoisted
    vi.clearAllMocks();
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';

    ({ AnthropicService } = await import('../anthropic.service.js'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.ANTHROPIC_API_KEY;
  });

  describe('constructor', () => {
    it('throws when ANTHROPIC_API_KEY is not set', async () => {
      delete process.env.ANTHROPIC_API_KEY;
      vi.resetModules();
      const { AnthropicService: Fresh } = await import('../anthropic.service.js');
      expect(() => new Fresh()).toThrow('ANTHROPIC_API_KEY');
    });
  });

  describe('complete()', () => {
    it('returns AnthropicCompletionResult with correct fields', async () => {
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'Réponse Claude' }],
        model: 'claude-sonnet-4-6',
        usage: { input_tokens: 100, output_tokens: 50 },
        stop_reason: 'end_turn',
      });

      const service = new AnthropicService();
      const result = await service.complete([{ role: 'user', content: 'Bonjour' }]);

      expect(result.content).toBe('Réponse Claude');
      expect(result.input_tokens).toBe(100);
      expect(result.output_tokens).toBe(50);
      expect(result.stop_reason).toBe('end_turn');
    });

    it('calculates cost_usd based on model pricing', async () => {
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'OK' }],
        model: 'claude-haiku-4-5-20251001',
        usage: { input_tokens: 1000, output_tokens: 1000 },
        stop_reason: 'end_turn',
      });

      const service = new AnthropicService();
      const result = await service.complete([{ role: 'user', content: 'test' }], { model: 'claude-haiku-4-5-20251001' });

      // 2000 tokens × $0.00025/1K = $0.0005
      expect(result.cost_usd).toBeCloseTo(0.0005, 5);
    });

    it('uses default model when not specified', async () => {
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'OK' }],
        model: 'claude-sonnet-4-6',
        usage: { input_tokens: 10, output_tokens: 10 },
        stop_reason: 'end_turn',
      });

      const service = new AnthropicService();
      await service.complete([{ role: 'user', content: 'test' }]);

      expect(mockAnthropicCreate).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'claude-sonnet-4-6' })
      );
    });

    it('propagates errors from the SDK', async () => {
      mockAnthropicCreate.mockRejectedValue(new Error('Rate limited'));
      const service = new AnthropicService();
      await expect(service.complete([{ role: 'user', content: 'test' }])).rejects.toThrow('Rate limited');
    });
  });

  describe('ask()', () => {
    it('wraps prompt in a user message', async () => {
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'Réponse' }],
        model: 'claude-sonnet-4-6',
        usage: { input_tokens: 5, output_tokens: 5 },
        stop_reason: 'end_turn',
      });

      const service = new AnthropicService();
      await service.ask('Ma question', 'Tu es un expert BTP');

      expect(mockAnthropicCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          system: 'Tu es un expert BTP',
          messages: [{ role: 'user', content: 'Ma question' }],
        })
      );
    });
  });

  describe('analyzeDocument()', () => {
    it('includes document text in user message', async () => {
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'Analyse: ...' }],
        model: 'claude-sonnet-4-6',
        usage: { input_tokens: 50, output_tokens: 100 },
        stop_reason: 'end_turn',
      });

      const service = new AnthropicService();
      await service.analyzeDocument('Contenu du devis', 'Analyse ce devis');

      const callArg = mockAnthropicCreate.mock.calls[0][0];
      expect(callArg.messages[0].content).toContain('Contenu du devis');
      expect(callArg.messages[0].content).toContain('Analyse ce devis');
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// registerDataAPIs health check functions
// ─────────────────────────────────────────────────────────────────────────────

describe('Data API health checks', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.PAPPERS_API_KEY;
  });

  describe('makeSireneHealthCheck()', () => {
    it('resolves when API returns OK', async () => {
      const { makeSireneHealthCheck } = await import('@/core/monitoring/AIAPIsHealthCheck.js');
      vi.stubGlobal('fetch', mockFetchOk({}));
      await expect(makeSireneHealthCheck()()).resolves.not.toThrow();
    });

    it('throws when API returns non-OK', async () => {
      const { makeSireneHealthCheck } = await import('@/core/monitoring/AIAPIsHealthCheck.js');
      vi.stubGlobal('fetch', mockFetchFail(503));
      await expect(makeSireneHealthCheck()()).rejects.toThrow('503');
    });
  });

  describe('makeGeoplatformeHealthCheck()', () => {
    it('resolves when API returns OK', async () => {
      const { makeGeoplatformeHealthCheck } = await import('@/core/monitoring/AIAPIsHealthCheck.js');
      vi.stubGlobal('fetch', mockFetchOk({}));
      await expect(makeGeoplatformeHealthCheck()()).resolves.not.toThrow();
    });

    it('throws when API returns non-OK', async () => {
      const { makeGeoplatformeHealthCheck } = await import('@/core/monitoring/AIAPIsHealthCheck.js');
      vi.stubGlobal('fetch', mockFetchFail(500));
      await expect(makeGeoplatformeHealthCheck()()).rejects.toThrow('500');
    });
  });

  describe('makeBdnbHealthCheck()', () => {
    it('resolves when API returns 200', async () => {
      const { makeBdnbHealthCheck } = await import('@/core/monitoring/AIAPIsHealthCheck.js');
      vi.stubGlobal('fetch', mockFetchOk([]));
      await expect(makeBdnbHealthCheck()()).resolves.not.toThrow();
    });

    it('resolves when API returns 404 (no results without filter — API is up)', async () => {
      const { makeBdnbHealthCheck } = await import('@/core/monitoring/AIAPIsHealthCheck.js');
      vi.stubGlobal('fetch', mockFetchFail(404));
      await expect(makeBdnbHealthCheck()()).resolves.not.toThrow();
    });

    it('throws when API returns 500', async () => {
      const { makeBdnbHealthCheck } = await import('@/core/monitoring/AIAPIsHealthCheck.js');
      vi.stubGlobal('fetch', mockFetchFail(500));
      await expect(makeBdnbHealthCheck()()).rejects.toThrow('500');
    });
  });

  describe('makeApiCartoHealthCheck()', () => {
    it('resolves when API returns OK', async () => {
      const { makeApiCartoHealthCheck } = await import('@/core/monitoring/AIAPIsHealthCheck.js');
      vi.stubGlobal('fetch', mockFetchOk({ features: [] }));
      await expect(makeApiCartoHealthCheck()()).resolves.not.toThrow();
    });
  });

  describe('makePappersHealthCheck()', () => {
    it('throws when PAPPERS_API_KEY is not set', async () => {
      delete process.env.PAPPERS_API_KEY;
      const { makePappersHealthCheck } = await import('@/core/monitoring/AIAPIsHealthCheck.js');
      await expect(makePappersHealthCheck()()).rejects.toThrow('PAPPERS_API_KEY');
    });

    it('throws when API returns 401', async () => {
      process.env.PAPPERS_API_KEY = 'bad-key';
      const { makePappersHealthCheck } = await import('@/core/monitoring/AIAPIsHealthCheck.js');
      vi.stubGlobal('fetch', mockFetchFail(401));
      await expect(makePappersHealthCheck()()).rejects.toThrow('invalid');
    });

    it('resolves when API returns 404 (SIREN not found, but API is up)', async () => {
      process.env.PAPPERS_API_KEY = 'valid-key';
      const { makePappersHealthCheck } = await import('@/core/monitoring/AIAPIsHealthCheck.js');
      vi.stubGlobal('fetch', mockFetchFail(404));
      await expect(makePappersHealthCheck()()).resolves.not.toThrow();
    });

    it('resolves when API returns 200', async () => {
      process.env.PAPPERS_API_KEY = 'valid-key';
      const { makePappersHealthCheck } = await import('@/core/monitoring/AIAPIsHealthCheck.js');
      vi.stubGlobal('fetch', mockFetchOk({}));
      await expect(makePappersHealthCheck()()).resolves.not.toThrow();
    });
  });

  describe('registerDataAPIs()', () => {
    it('registers exactly 5 data APIs', async () => {
      const { registerDataAPIs } = await import('@/core/monitoring/AIAPIsHealthCheck.js');
      const { APIHealthMonitor } = await import('@/core/monitoring/APIHealthMonitor.js');
      const { createClient } = await import('@supabase/supabase-js');
      const monitor = new APIHealthMonitor(createClient('https://x.co', 'key'));
      registerDataAPIs(monitor);
      expect(monitor.getAllAPIStatus()).toHaveLength(5);
      monitor.stopAll();
    });

    it('registers INSEE-SIRENE, Geoplateforme, BDNB, API-Carto, Pappers', async () => {
      const { registerDataAPIs } = await import('@/core/monitoring/AIAPIsHealthCheck.js');
      const { APIHealthMonitor } = await import('@/core/monitoring/APIHealthMonitor.js');
      const { createClient } = await import('@supabase/supabase-js');
      const monitor = new APIHealthMonitor(createClient('https://x.co', 'key'));
      registerDataAPIs(monitor);
      const names = monitor.getAllAPIStatus().map(s => s.api_name);
      expect(names).toContain('INSEE-SIRENE');
      expect(names).toContain('Geoplateforme');
      expect(names).toContain('BDNB');
      expect(names).toContain('API-Carto');
      expect(names).toContain('Pappers');
      monitor.stopAll();
    });
  });
});
