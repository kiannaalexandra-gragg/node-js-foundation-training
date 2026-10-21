// Module 9 output: the Jest configuration for the integration tests.
// Nothing to run here. Read by `npm test`. Success: `npm test` finds and runs every file in tests/.

// package.json says "type": "module", so this file is an ES module and Jest runs the tests as ESM.
// `npm test` starts Jest with --experimental-vm-modules, which Jest needs to load ES modules.
export default {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],

  // Jest treats .js files as ESM because of "type": "module". It must be told that .ts files are too.
  extensionsToTreatAsEsm: ['.ts'],

  // @swc/jest strips the types and leaves the import and export lines alone. It does not check types:
  // `npm run typecheck` does that, locally and in CI.
  transform: {
    '^.+\\.ts$': [
      '@swc/jest',
      {
        jsc: { parser: { syntax: 'typescript' }, target: 'es2024' },
        module: { type: 'es6' },
      },
    ],
  },

  // Runs once, in the Jest parent process, before any test file. It loads .env.test, gives the run its
  // own database and migrates it. Test files start after it, so they inherit the settings it made:
  // DATABASE_URL and API_KEY are set by the time config.ts and db.ts read them.
  globalSetup: '<rootDir>/tests/global-setup.ts',
  // Runs once, after the last test file: deletes this run's database.
  globalTeardown: '<rootDir>/tests/global-teardown.ts',

  // Fresh spies and mocks for every test, so no test inherits another's.
  restoreMocks: true,

  // Coverage is measured on the code the tests are about: routes, handlers and services.
  collectCoverageFrom: ['src/routes/**/*.ts', 'src/handlers/**/*.ts', 'src/services/**/*.ts'],
  coverageProvider: 'v8',
  coverageThreshold: {
    global: { statements: 80, branches: 80, functions: 80, lines: 80 },
  },
};
