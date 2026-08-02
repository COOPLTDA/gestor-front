export default {
  testEnvironment: 'node',
  testMatch: ['**/server/**/*.test.js', '**/server/**/*.spec.js'],
  transform: {},  // ESM nativo — sin transformación
  extensionsToTreatAsEsm: [],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.(js)$': '$1'
  },
};
