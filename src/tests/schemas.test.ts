// ─────────────────────────────────────────────────────────────────────────────
// schemas.test.ts — Phase 3B Jalon 2
// Tests for all Zod schemas: valid inputs pass, invalid inputs fail with
// the expected field paths and error codes.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { ZodError } from 'zod';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function expectPass<T>(fn: () => T): T {
  const result = fn();
  expect(result).toBeDefined();
  return result;
}

function expectFail(fn: () => unknown, expectedPath?: string): ZodError {
  expect(fn).toThrow(ZodError);
  try {
    fn();
  } catch (err) {
    const zodErr = err as ZodError;
    if (expectedPath) {
      const paths = zodErr.issues.map(i => i.path.join('.'));
      expect(paths).toContain(expectedPath);
    }
    return zodErr;
  }
  throw new Error('Should not reach here');
}

// ─── common.schemas ───────────────────────────────────────────────────────────

describe('common.schemas', () => {
  it('imports without error', async () => {
    const mod = await import('../schemas/common.schemas.js');
    expect(mod.uuidSchema).toBeDefined();
    expect(mod.siretSchema).toBeDefined();
    expect(mod.emailSchema).toBeDefined();
  });

  describe('uuidSchema', () => {
    it('accepts valid UUID v4', async () => {
      const { uuidSchema } = await import('../schemas/common.schemas.js');
      expectPass(() => uuidSchema.parse('550e8400-e29b-41d4-a716-446655440000'));
    });
    it('rejects non-UUID string', async () => {
      const { uuidSchema } = await import('../schemas/common.schemas.js');
      expectFail(() => uuidSchema.parse('not-a-uuid'));
    });
    it('rejects empty string', async () => {
      const { uuidSchema } = await import('../schemas/common.schemas.js');
      expectFail(() => uuidSchema.parse(''));
    });
  });

  describe('siretSchema', () => {
    it('accepts 14-digit SIRET', async () => {
      const { siretSchema } = await import('../schemas/common.schemas.js');
      expectPass(() => siretSchema.parse('12345678901234'));
    });
    it('rejects 13 digits', async () => {
      const { siretSchema } = await import('../schemas/common.schemas.js');
      expectFail(() => siretSchema.parse('1234567890123'));
    });
    it('rejects alphanumeric string', async () => {
      const { siretSchema } = await import('../schemas/common.schemas.js');
      expectFail(() => siretSchema.parse('1234567890123X'));
    });
  });

  describe('emailSchema', () => {
    it('accepts valid email', async () => {
      const { emailSchema } = await import('../schemas/common.schemas.js');
      expectPass(() => emailSchema.parse('user@example.com'));
    });
    it('lowercases email', async () => {
      const { emailSchema } = await import('../schemas/common.schemas.js');
      const result = emailSchema.parse('USER@EXAMPLE.COM');
      expect(result).toBe('user@example.com');
    });
    it('rejects email without @', async () => {
      const { emailSchema } = await import('../schemas/common.schemas.js');
      expectFail(() => emailSchema.parse('notanemail'));
    });
    it('rejects email without domain', async () => {
      const { emailSchema } = await import('../schemas/common.schemas.js');
      expectFail(() => emailSchema.parse('user@'));
    });
  });

  describe('passwordSchema', () => {
    it('accepts 8-char password', async () => {
      const { passwordSchema } = await import('../schemas/common.schemas.js');
      expectPass(() => passwordSchema.parse('12345678'));
    });
    it('rejects 7-char password', async () => {
      const { passwordSchema } = await import('../schemas/common.schemas.js');
      expectFail(() => passwordSchema.parse('1234567'));
    });
    it('rejects password over 128 chars', async () => {
      const { passwordSchema } = await import('../schemas/common.schemas.js');
      expectFail(() => passwordSchema.parse('a'.repeat(129)));
    });
  });

  describe('telephoneSchema', () => {
    it('accepts French mobile number', async () => {
      const { telephoneSchema } = await import('../schemas/common.schemas.js');
      expectPass(() => telephoneSchema.parse('0612345678'));
    });
    it('accepts international format', async () => {
      const { telephoneSchema } = await import('../schemas/common.schemas.js');
      expectPass(() => telephoneSchema.parse('+33 6 12 34 56 78'));
    });
    it('rejects too-short number', async () => {
      const { telephoneSchema } = await import('../schemas/common.schemas.js');
      expectFail(() => telephoneSchema.parse('123'));
    });
  });

  describe('codePostalSchema', () => {
    it('accepts 5-digit code postal', async () => {
      const { codePostalSchema } = await import('../schemas/common.schemas.js');
      expectPass(() => codePostalSchema.parse('75001'));
    });
    it('rejects 4-digit postal code', async () => {
      const { codePostalSchema } = await import('../schemas/common.schemas.js');
      expectFail(() => codePostalSchema.parse('7500'));
    });
    it('rejects non-digit characters', async () => {
      const { codePostalSchema } = await import('../schemas/common.schemas.js');
      expectFail(() => codePostalSchema.parse('A5001'));
    });
  });

  describe('shortCodeSchema', () => {
    it('accepts 8-char uppercase alphanumeric', async () => {
      const { shortCodeSchema } = await import('../schemas/common.schemas.js');
      expectPass(() => shortCodeSchema.parse('AB3XK7M2'));
    });
    it('accepts 6-char code', async () => {
      const { shortCodeSchema } = await import('../schemas/common.schemas.js');
      expectPass(() => shortCodeSchema.parse('ABC123'));
    });
    it('rejects lowercase', async () => {
      const { shortCodeSchema } = await import('../schemas/common.schemas.js');
      expectFail(() => shortCodeSchema.parse('ab3xk7m2'));
    });
    it('rejects too-short code (5 chars)', async () => {
      const { shortCodeSchema } = await import('../schemas/common.schemas.js');
      expectFail(() => shortCodeSchema.parse('AB3XK'));
    });
  });

  describe('paginationSchema', () => {
    it('defaults page=1 and limit=50', async () => {
      const { paginationSchema } = await import('../schemas/common.schemas.js');
      const result = paginationSchema.parse({});
      expect(result.page).toBe(1);
      expect(result.limit).toBe(50);
    });
    it('coerces string numbers from query params', async () => {
      const { paginationSchema } = await import('../schemas/common.schemas.js');
      const result = paginationSchema.parse({ page: '2', limit: '25' });
      expect(result.page).toBe(2);
      expect(result.limit).toBe(25);
    });
    it('rejects limit > 100', async () => {
      const { paginationSchema } = await import('../schemas/common.schemas.js');
      expectFail(() => paginationSchema.parse({ limit: '200' }), 'limit');
    });
    it('rejects page < 1', async () => {
      const { paginationSchema } = await import('../schemas/common.schemas.js');
      expectFail(() => paginationSchema.parse({ page: '0' }), 'page');
    });
  });
});

// ─── auth.schemas ─────────────────────────────────────────────────────────────

describe('auth.schemas', () => {
  describe('RegisterSchema', () => {
    it('accepts valid registration', async () => {
      const { RegisterSchema } = await import('../schemas/auth.schemas.js');
      expectPass(() => RegisterSchema.parse({
        email: 'user@example.com',
        password: 'SecurePass123',
        fullName: 'Jean Dupont',
      }));
    });
    it('rejects invalid email', async () => {
      const { RegisterSchema } = await import('../schemas/auth.schemas.js');
      expectFail(() => RegisterSchema.parse({ email: 'invalid', password: 'SecurePass123', fullName: 'Jean' }), 'email');
    });
    it('rejects short password', async () => {
      const { RegisterSchema } = await import('../schemas/auth.schemas.js');
      expectFail(() => RegisterSchema.parse({ email: 'u@e.com', password: 'short', fullName: 'Jean' }), 'password');
    });
    it('rejects single-char fullName', async () => {
      const { RegisterSchema } = await import('../schemas/auth.schemas.js');
      expectFail(() => RegisterSchema.parse({ email: 'u@e.com', password: 'SecurePass123', fullName: 'J' }), 'fullName');
    });
    it('rejects missing required fields', async () => {
      const { RegisterSchema } = await import('../schemas/auth.schemas.js');
      expectFail(() => RegisterSchema.parse({}));
    });
  });

  describe('LoginSchema', () => {
    it('accepts valid credentials', async () => {
      const { LoginSchema } = await import('../schemas/auth.schemas.js');
      expectPass(() => LoginSchema.parse({ email: 'user@example.com', password: 'AnyPassword' }));
    });
    it('rejects missing email', async () => {
      const { LoginSchema } = await import('../schemas/auth.schemas.js');
      expectFail(() => LoginSchema.parse({ password: 'Pass' }), 'email');
    });
    it('rejects empty password', async () => {
      const { LoginSchema } = await import('../schemas/auth.schemas.js');
      expectFail(() => LoginSchema.parse({ email: 'u@e.com', password: '' }), 'password');
    });
  });

  describe('RefreshSchema', () => {
    it('accepts valid refresh token', async () => {
      const { RefreshSchema } = await import('../schemas/auth.schemas.js');
      expectPass(() => RefreshSchema.parse({ refreshToken: 'valid-token-string' }));
    });
    it('rejects missing refresh token', async () => {
      const { RefreshSchema } = await import('../schemas/auth.schemas.js');
      expectFail(() => RefreshSchema.parse({}), 'refreshToken');
    });
    it('rejects empty refresh token', async () => {
      const { RefreshSchema } = await import('../schemas/auth.schemas.js');
      expectFail(() => RefreshSchema.parse({ refreshToken: '' }), 'refreshToken');
    });
  });
});

// ─── admin.schemas ────────────────────────────────────────────────────────────

describe('admin.schemas', () => {
  describe('UpdateRateLimitSchema', () => {
    it('accepts partial update', async () => {
      const { UpdateRateLimitSchema } = await import('../schemas/admin.schemas.js');
      expectPass(() => UpdateRateLimitSchema.parse({ requests_per_minute: 200 }));
    });
    it('accepts full update', async () => {
      const { UpdateRateLimitSchema } = await import('../schemas/admin.schemas.js');
      expectPass(() => UpdateRateLimitSchema.parse({
        requests_per_minute: 50,
        requests_per_hour: 500,
        requests_per_day: 5000,
      }));
    });
    it('rejects empty object (need at least one field)', async () => {
      const { UpdateRateLimitSchema } = await import('../schemas/admin.schemas.js');
      expectFail(() => UpdateRateLimitSchema.parse({}));
    });
    it('rejects requests_per_minute = 0', async () => {
      const { UpdateRateLimitSchema } = await import('../schemas/admin.schemas.js');
      expectFail(() => UpdateRateLimitSchema.parse({ requests_per_minute: 0 }), 'requests_per_minute');
    });
    it('rejects extra fields (.strict)', async () => {
      const { UpdateRateLimitSchema } = await import('../schemas/admin.schemas.js');
      expectFail(() => UpdateRateLimitSchema.parse({ requests_per_minute: 100, unknown_field: 'x' }));
    });
    it('rejects non-integer values', async () => {
      const { UpdateRateLimitSchema } = await import('../schemas/admin.schemas.js');
      expectFail(() => UpdateRateLimitSchema.parse({ requests_per_minute: 1.5 }), 'requests_per_minute');
    });
  });

  describe('UserIdParamSchema', () => {
    it('accepts valid UUID', async () => {
      const { UserIdParamSchema } = await import('../schemas/admin.schemas.js');
      expectPass(() => UserIdParamSchema.parse({ userId: '550e8400-e29b-41d4-a716-446655440000' }));
    });
    it('rejects non-UUID', async () => {
      const { UserIdParamSchema } = await import('../schemas/admin.schemas.js');
      expectFail(() => UserIdParamSchema.parse({ userId: 'not-a-uuid' }), 'userId');
    });
  });
});

// ─── entreprises.schemas ─────────────────────────────────────────────────────

describe('entreprises.schemas', () => {
  describe('RegisterEntrepriseSchema', () => {
    it('accepts SIRET only (minimal)', async () => {
      const { RegisterEntrepriseSchema } = await import('../schemas/entreprises.schemas.js');
      expectPass(() => RegisterEntrepriseSchema.parse({ siret: '12345678901234' }));
    });
    it('accepts full registration data', async () => {
      const { RegisterEntrepriseSchema } = await import('../schemas/entreprises.schemas.js');
      expectPass(() => RegisterEntrepriseSchema.parse({
        siret: '12345678901234',
        raison_sociale: 'ACME Construction SARL',
        email: 'contact@acme.fr',
        telephone: '0145678901',
        code_postal: '75001',
        ville: 'Paris',
      }));
    });
    it('rejects invalid SIRET (13 digits)', async () => {
      const { RegisterEntrepriseSchema } = await import('../schemas/entreprises.schemas.js');
      expectFail(() => RegisterEntrepriseSchema.parse({ siret: '1234567890123' }), 'siret');
    });
    it('rejects invalid email format', async () => {
      const { RegisterEntrepriseSchema } = await import('../schemas/entreprises.schemas.js');
      expectFail(() => RegisterEntrepriseSchema.parse({ siret: '12345678901234', email: 'not-email' }), 'email');
    });
    it('rejects invalid code postal', async () => {
      const { RegisterEntrepriseSchema } = await import('../schemas/entreprises.schemas.js');
      expectFail(() => RegisterEntrepriseSchema.parse({ siret: '12345678901234', code_postal: '1234' }), 'code_postal');
    });
    it('rejects invalid URL for website', async () => {
      const { RegisterEntrepriseSchema } = await import('../schemas/entreprises.schemas.js');
      expectFail(() => RegisterEntrepriseSchema.parse({ siret: '12345678901234', website: 'not-a-url' }), 'website');
    });
  });
});

// ─── clients.schemas ─────────────────────────────────────────────────────────

describe('clients.schemas', () => {
  describe('CreateClientSchema', () => {
    it('accepts minimal required fields', async () => {
      const { CreateClientSchema } = await import('../schemas/clients.schemas.js');
      expectPass(() => CreateClientSchema.parse({
        entreprise_id: '550e8400-e29b-41d4-a716-446655440000',
        nom: 'Dupont',
        telephone: '0612345678',
      }));
    });
    it('accepts full client data', async () => {
      const { CreateClientSchema } = await import('../schemas/clients.schemas.js');
      expectPass(() => CreateClientSchema.parse({
        entreprise_id: '550e8400-e29b-41d4-a716-446655440000',
        nom: 'Dupont',
        prenom: 'Jean',
        email: 'jean.dupont@example.com',
        telephone: '0612345678',
        adresse: '1 rue de la Paix, 75001 Paris',
      }));
    });
    it('rejects missing entreprise_id', async () => {
      const { CreateClientSchema } = await import('../schemas/clients.schemas.js');
      expectFail(() => CreateClientSchema.parse({ nom: 'Dupont', telephone: '0612345678' }), 'entreprise_id');
    });
    it('rejects missing nom', async () => {
      const { CreateClientSchema } = await import('../schemas/clients.schemas.js');
      expectFail(() => CreateClientSchema.parse({
        entreprise_id: '550e8400-e29b-41d4-a716-446655440000',
        telephone: '0612345678',
      }), 'nom');
    });
    it('rejects missing telephone', async () => {
      const { CreateClientSchema } = await import('../schemas/clients.schemas.js');
      expectFail(() => CreateClientSchema.parse({
        entreprise_id: '550e8400-e29b-41d4-a716-446655440000',
        nom: 'Dupont',
      }), 'telephone');
    });
    it('rejects invalid email format', async () => {
      const { CreateClientSchema } = await import('../schemas/clients.schemas.js');
      expectFail(() => CreateClientSchema.parse({
        entreprise_id: '550e8400-e29b-41d4-a716-446655440000',
        nom: 'Dupont',
        telephone: '0612345678',
        email: 'bad-email',
      }), 'email');
    });
    it('rejects invalid entreprise_id UUID', async () => {
      const { CreateClientSchema } = await import('../schemas/clients.schemas.js');
      expectFail(() => CreateClientSchema.parse({
        entreprise_id: 'not-a-uuid',
        nom: 'Dupont',
        telephone: '0612345678',
      }), 'entreprise_id');
    });
  });
});

// ─── projets.schemas ──────────────────────────────────────────────────────────

describe('projets.schemas', () => {
  const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';

  describe('CreateProjetSchema', () => {
    it('accepts minimal required fields', async () => {
      const { CreateProjetSchema } = await import('../schemas/projets.schemas.js');
      expectPass(() => CreateProjetSchema.parse({
        client_id: VALID_UUID,
        entreprise_id: VALID_UUID,
        type: 'renovation',
      }));
    });
    it('accepts all project types', async () => {
      const { CreateProjetSchema, PROJECT_TYPES } = await import('../schemas/projets.schemas.js');
      for (const type of PROJECT_TYPES) {
        expectPass(() => CreateProjetSchema.parse({ client_id: VALID_UUID, entreprise_id: VALID_UUID, type }));
      }
    });
    it('rejects invalid project type', async () => {
      const { CreateProjetSchema } = await import('../schemas/projets.schemas.js');
      expectFail(() => CreateProjetSchema.parse({
        client_id: VALID_UUID,
        entreprise_id: VALID_UUID,
        type: 'unknown_type',
      }), 'type');
    });
    it('accepts full projet with coordinates', async () => {
      const { CreateProjetSchema } = await import('../schemas/projets.schemas.js');
      expectPass(() => CreateProjetSchema.parse({
        client_id: VALID_UUID,
        entreprise_id: VALID_UUID,
        type: 'piscine',
        description: 'Piscine extérieure 10x5m',
        adresse: '5 allée des Roses, 06400 Cannes',
        lat: 43.5528,
        lng: 7.0174,
        code_postal: '06400',
        budget_estime: 45000,
      }));
    });
    it('rejects lat without lng', async () => {
      const { CreateProjetSchema } = await import('../schemas/projets.schemas.js');
      expectFail(() => CreateProjetSchema.parse({
        client_id: VALID_UUID,
        entreprise_id: VALID_UUID,
        type: 'renovation',
        lat: 43.5528,
        // lng missing
      }), 'lat');
    });
    it('rejects invalid latitude (> 90)', async () => {
      const { CreateProjetSchema } = await import('../schemas/projets.schemas.js');
      expectFail(() => CreateProjetSchema.parse({
        client_id: VALID_UUID,
        entreprise_id: VALID_UUID,
        type: 'renovation',
        lat: 91,
        lng: 7,
      }), 'lat');
    });
    it('rejects negative budget', async () => {
      const { CreateProjetSchema } = await import('../schemas/projets.schemas.js');
      expectFail(() => CreateProjetSchema.parse({
        client_id: VALID_UUID,
        entreprise_id: VALID_UUID,
        type: 'renovation',
        budget_estime: -100,
      }), 'budget_estime');
    });
  });
});

// ─── devis.schemas ────────────────────────────────────────────────────────────

describe('devis.schemas', () => {
  const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
  // Small valid base64 string
  const VALID_BASE64 = 'JVBERi0xLjQKJcOkw7zDtsOfCjIgMCBvYmoKPDwvTGVuZ3RoIDMgMCBSL0ZpbHRlci9GbGF0ZURlY29kZT4+CnN0cmVhbQp4nGNgYGBg'.repeat(3);

  describe('UploadDevisSchema', () => {
    it('accepts valid upload', async () => {
      const { UploadDevisSchema } = await import('../schemas/devis.schemas.js');
      expectPass(() => UploadDevisSchema.parse({
        projet_id: VALID_UUID,
        format: 'pdf',
        file_base64: VALID_BASE64,
      }));
    });
    it('accepts all valid formats', async () => {
      const { UploadDevisSchema, DEVIS_FORMATS } = await import('../schemas/devis.schemas.js');
      for (const format of DEVIS_FORMATS) {
        expectPass(() => UploadDevisSchema.parse({ projet_id: VALID_UUID, format, file_base64: VALID_BASE64 }));
      }
    });
    it('rejects invalid format', async () => {
      const { UploadDevisSchema } = await import('../schemas/devis.schemas.js');
      expectFail(() => UploadDevisSchema.parse({ projet_id: VALID_UUID, format: 'txt', file_base64: VALID_BASE64 }), 'format');
    });
    it('rejects missing projet_id', async () => {
      const { UploadDevisSchema } = await import('../schemas/devis.schemas.js');
      expectFail(() => UploadDevisSchema.parse({ format: 'pdf', file_base64: VALID_BASE64 }), 'projet_id');
    });
    it('rejects invalid UUID for projet_id', async () => {
      const { UploadDevisSchema } = await import('../schemas/devis.schemas.js');
      expectFail(() => UploadDevisSchema.parse({ projet_id: 'bad-id', format: 'pdf', file_base64: VALID_BASE64 }), 'projet_id');
    });
    it('rejects invalid base64 content', async () => {
      const { UploadDevisSchema } = await import('../schemas/devis.schemas.js');
      expectFail(() => UploadDevisSchema.parse({
        projet_id: VALID_UUID,
        format: 'pdf',
        file_base64: 'not-base64-!!!',
      }), 'file_base64');
    });
  });

  describe('DevisIdParamSchema', () => {
    it('accepts valid UUID param', async () => {
      const { DevisIdParamSchema } = await import('../schemas/devis.schemas.js');
      expectPass(() => DevisIdParamSchema.parse({ id: VALID_UUID }));
    });
    it('rejects non-UUID param', async () => {
      const { DevisIdParamSchema } = await import('../schemas/devis.schemas.js');
      expectFail(() => DevisIdParamSchema.parse({ id: 'abc123' }), 'id');
    });
  });

  describe('DevisStatusQuerySchema', () => {
    it('defaults to false for optional booleans', async () => {
      const { DevisStatusQuerySchema } = await import('../schemas/devis.schemas.js');
      const result = DevisStatusQuerySchema.parse({});
      expect(result.includeAudit).toBe(false);
      expect(result.includeMeta).toBe(false);
    });
    it('coerces string "true" to boolean', async () => {
      const { DevisStatusQuerySchema } = await import('../schemas/devis.schemas.js');
      const result = DevisStatusQuerySchema.parse({ includeAudit: 'true', includeMeta: '1' });
      expect(result.includeAudit).toBe(true);
      expect(result.includeMeta).toBe(true);
    });
  });
});

// ─── audit.schemas ────────────────────────────────────────────────────────────

describe('audit.schemas', () => {
  describe('AuditShortCodeParamSchema', () => {
    it('accepts valid 8-char uppercase short code', async () => {
      const { AuditShortCodeParamSchema } = await import('../schemas/audit.schemas.js');
      expectPass(() => AuditShortCodeParamSchema.parse({ short_code: 'AB3XK7M2' }));
    });
    it('accepts 6-char short code', async () => {
      const { AuditShortCodeParamSchema } = await import('../schemas/audit.schemas.js');
      expectPass(() => AuditShortCodeParamSchema.parse({ short_code: 'ABC123' }));
    });
    it('rejects lowercase short code', async () => {
      const { AuditShortCodeParamSchema } = await import('../schemas/audit.schemas.js');
      expectFail(() => AuditShortCodeParamSchema.parse({ short_code: 'ab3xk7m2' }), 'short_code');
    });
    it('rejects short code with special chars', async () => {
      const { AuditShortCodeParamSchema } = await import('../schemas/audit.schemas.js');
      expectFail(() => AuditShortCodeParamSchema.parse({ short_code: 'AB3X-7M2' }), 'short_code');
    });
    it('rejects 5-char code (too short)', async () => {
      const { AuditShortCodeParamSchema } = await import('../schemas/audit.schemas.js');
      expectFail(() => AuditShortCodeParamSchema.parse({ short_code: 'AB3XK' }), 'short_code');
    });
  });
});

// ─── validation.utils ────────────────────────────────────────────────────────

describe('validation.utils', () => {
  it('exports validateBody, validateParams, validateQuery', async () => {
    const mod = await import('../utils/validation.utils.js');
    expect(typeof mod.validateBody).toBe('function');
    expect(typeof mod.validateParams).toBe('function');
    expect(typeof mod.validateQuery).toBe('function');
  });

  it('validateBody calls next() on valid input', async () => {
    const { validateBody } = await import('../utils/validation.utils.js');
    const { z } = await import('zod');

    const schema = z.object({ name: z.string() });
    const middleware = validateBody(schema);

    const req = { body: { name: 'test' } } as Parameters<typeof middleware>[0];
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Parameters<typeof middleware>[1];
    const next = vi.fn();

    await middleware(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.body).toEqual({ name: 'test' });
  });

  it('validateBody returns 400 on invalid input', async () => {
    const { validateBody } = await import('../utils/validation.utils.js');
    const { z } = await import('zod');

    const schema = z.object({ name: z.string().email() });
    const middleware = validateBody(schema);

    const req = { body: { name: 'not-an-email' } } as Parameters<typeof middleware>[0];
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Parameters<typeof middleware>[1];
    const next = vi.fn();

    await middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();

    const responseBody = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(responseBody.code).toBe('VALIDATION_ERROR');
    expect(responseBody.details).toBeInstanceOf(Array);
    expect(responseBody.details[0]).toHaveProperty('path');
    expect(responseBody.details[0]).toHaveProperty('message');
  });

  it('validateParams returns 400 for invalid UUID param', async () => {
    const { validateParams } = await import('../utils/validation.utils.js');
    const { uuidSchema } = await import('../schemas/common.schemas.js');
    const { z } = await import('zod');

    const middleware = validateParams(z.object({ id: uuidSchema }));
    const req = { params: { id: 'not-uuid' } } as unknown as Parameters<typeof middleware>[0];
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Parameters<typeof middleware>[1];
    const next = vi.fn();

    await middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  it('validateQuery coerces and defaults values', async () => {
    const { validateQuery } = await import('../utils/validation.utils.js');
    const { paginationSchema } = await import('../schemas/common.schemas.js');

    const middleware = validateQuery(paginationSchema);
    const req = { query: { page: '3' } } as unknown as Parameters<typeof middleware>[0];
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Parameters<typeof middleware>[1];
    const next = vi.fn();

    await middleware(req, res, next);
    expect(next).toHaveBeenCalled();
    // page should be coerced to 3, limit should default to 50
    expect((req.query as unknown as { page: number; limit: number }).page).toBe(3);
    expect((req.query as unknown as { page: number; limit: number }).limit).toBe(50);
  });
});
