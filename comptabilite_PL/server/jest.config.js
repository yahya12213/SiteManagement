export default {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.js'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js',
    '!src/migrations/**',
    '!src/routes/migration-*.js'
  ],
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50
    }
  },
  testTimeout: 10000,
  verbose: true,
  // Ne pas exécuter les tests sur les fichiers de migration
  testPathIgnorePatterns: [
    '/node_modules/',
    '/migrations/',
    'migration-'
  ],
  transform: {}
};
