/**
 * Jest Setup File
 * Configuration globale et mocks pour les tests
 */

// ============================================================================
// GLOBAL TEST CONFIGURATION
// ============================================================================

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.DEBUG = 'false';

// ============================================================================
// MOCK SUPABASE CLIENT
// ============================================================================

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn().mockResolvedValue({
            data: { id: 1, weighted_score: 85, grade_letter: 'A' },
            error: null,
          }),
          then: jest.fn((callback) => callback({
            data: [{ id: 1, weighted_score: 85 }],
            error: null,
          })),
        })),
        filter: jest.fn(() => ({
          then: jest.fn((callback) => callback({
            data: [{ id: 1 }],
            error: null,
          })),
        })),
      })),
      insert: jest.fn(() => ({
        then: jest.fn((callback) => callback({
          data: [{ id: 1 }],
          error: null,
        })),
      })),
      update: jest.fn(() => ({
        eq: jest.fn(() => ({
          then: jest.fn((callback) => callback({
            data: [{ id: 1 }],
            error: null,
          })),
        })),
      })),
    })),
    auth: {
      signUp: jest.fn().mockResolvedValue({
        data: { user: { id: 'user-1' } },
        error: null,
      }),
      signIn: jest.fn().mockResolvedValue({
        data: { user: { id: 'user-1' } },
        error: null,
      }),
    },
  })),
}));

// ============================================================================
// MOCK DATABASE CLIENT (PostgreSQL/MySQL)
// ============================================================================

jest.mock('../src/adapters/scoringPersistenceAdapter', () => ({
  createScoringPersistenceAdapter: (database) => {
    return async ({ projectId, devisId, result }) => {
      // Mock persistence - return the result with a fake DB ID
      return {
        id: Math.floor(Math.random() * 10000),
        weighted_score: result.weightedScore,
        bonus_points: result.bonusPoints,
        grade_letter: result.gradeLetter,
      };
    };
  },
  SCORING_PROFILES_MIGRATION: 'MOCK_MIGRATION_SQL',
  SCORING_PROFILES_UPGRADE_MIGRATION: 'MOCK_UPGRADE_SQL',
}));

jest.mock('../src/adapters/auditReportPersistenceAdapter', () => ({
  createAuditReportPersistenceAdapter: (database) => {
    return async (report) => {
      return {
        audit_id: report.auditId,
        weighted_score: report.scoringProfile.weightedScore,
        grade_letter: report.scoringProfile.gradeLetter,
      };
    };
  },
  createAuditReportReader: (database) => ({
    getByAuditId: jest.fn().mockResolvedValue({
      audit_id: 'AUDIT-123',
      weighted_score: 85,
      grade_letter: 'A',
    }),
    getByDevisId: jest.fn().mockResolvedValue([
      {
        audit_id: 'AUDIT-123',
        weighted_score: 85,
        grade_letter: 'A',
      },
    ]),
  }),
  AUDIT_REPORTS_MIGRATION: 'MOCK_MIGRATION_SQL',
}));

// ============================================================================
// MOCK LLM PROVIDER (OpenAI/Anthropic)
// ============================================================================

const mockLLMProvider = async (report, input) => {
  // Mock LLM enrichment - add language-enriched narratives
  return {
    executiveSummary: `${report.executiveSummary} [Enriched by LLM]`,
    strengths: report.strengths,
    weaknesses: report.weaknesses,
    recommendations: report.recommendations,
    llmEnriched: true,
  };
};

jest.mock('openai', () => ({
  OpenAI: jest.fn(() => ({
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [
            {
              message: {
                content: 'This is a mock LLM response',
              },
            },
          ],
        }),
      },
    },
  })),
}));

// ============================================================================
// GLOBAL TEST UTILITIES
// ============================================================================

global.mockDatabase = {
  query: jest.fn().mockResolvedValue({
    rows: [{ id: 1, weighted_score: 85, grade_letter: 'A' }],
  }),
  connect: jest.fn().mockResolvedValue(true),
  end: jest.fn().mockResolvedValue(true),
};

global.mockLLMProvider = mockLLMProvider;

// ============================================================================
// EXTENDED MATCHERS
// ============================================================================

expect.extend({
  toBeValidScore(received) {
    const pass = typeof received === 'number' && received >= 0 && received <= 100;
    return {
      pass,
      message: () =>
        pass
          ? `expected ${received} not to be a valid score (0-100)`
          : `expected ${received} to be a valid score (0-100)`,
    };
  },

  toBeValidGrade(received) {
    const validGrades = ['A', 'B', 'C', 'D', 'E'];
    const pass = validGrades.includes(received);
    return {
      pass,
      message: () =>
        pass
          ? `expected ${received} not to be a valid grade`
          : `expected ${received} to be a valid grade (A-E)`,
    };
  },

  toBeBetween(received, floor, ceil) {
    const pass = received >= floor && received <= ceil;
    return {
      pass,
      message: () =>
        pass
          ? `expected ${received} not to be between ${floor} and ${ceil}`
          : `expected ${received} to be between ${floor} and ${ceil}`,
    };
  },

  toBeRoundedTo(received, decimals) {
    const rounded = Math.round(received * Math.pow(10, decimals)) / Math.pow(10, decimals);
    const pass = received === rounded;
    return {
      pass,
      message: () =>
        pass
          ? `expected ${received} not to be rounded to ${decimals} decimals`
          : `expected ${received} to be rounded to ${decimals} decimals`,
    };
  },
});

// ============================================================================
// SUPPRESS CONSOLE WARNINGS IN TESTS
// ============================================================================

const originalLog = console.log;
const originalWarn = console.warn;
const originalError = console.error;

beforeAll(() => {
  // Suppress INFO and DEBUG logs during tests
  console.log = (...args) => {
    if (process.env.VERBOSE_TESTS) {
      originalLog(...args);
    }
  };

  // Keep WARN and ERROR visible
  console.warn = originalWarn;
  console.error = originalError;
});

afterAll(() => {
  console.log = originalLog;
});

// ============================================================================
// CLEANUP AFTER EACH TEST
// ============================================================================

afterEach(() => {
  jest.clearAllMocks();
});

module.exports = {
  mockDatabase: global.mockDatabase,
  mockLLMProvider: global.mockLLMProvider,
};
