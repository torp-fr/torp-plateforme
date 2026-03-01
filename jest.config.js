/**
 * Jest Configuration
 * Configuration for testing Thematic Scoring Engine and Audit Narrative Engine
 */

module.exports = {
  // Test environment
  testEnvironment: 'node',

  // Test root directory
  testMatch: ['**/tests/**/*.test.js'],

  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/examples/**',
    '!src/**/*.example.js',
  ],

  coverageDirectory: 'coverage',

  coverageThresholds: {
    global: {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85,
    },
    './src/engines/': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },
  },

  // Timeout for tests
  testTimeout: 10000,

  // Verbose output
  verbose: true,

  // Module name mapper for path aliases (if needed)
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },

  // Setup files
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],

  // Transform configuration
  transform: {
    '^.+\\.js$': 'babel-jest',
  },

  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
  ],

  // Reporter configuration
  reporters: [
    'default',
    [
      'jest-junit',
      {
        outputDirectory: 'test-results',
        outputName: 'junit.xml',
        classNameTemplate: '{classname}',
        titleTemplate: '{title}',
        ancestorSeparator: ' › ',
        usePathAsClassName: 'true',
      },
    ],
  ],

  // Coverage reporters
  coverageReporters: [
    'text',
    'text-summary',
    'html',
    'json-summary',
    'lcov',
  ],
};
