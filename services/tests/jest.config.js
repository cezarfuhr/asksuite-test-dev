module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>'],
  testMatch: ['**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js'],
  collectCoverageFrom: [
    '../**/src/**/*.ts',
    '!../**/src/**/*.d.ts',
    '!../**/node_modules/**'
  ],
  coverageDirectory: './coverage',
  verbose: true,
  testTimeout: 120000
};
