// jest.config.ts
import type { Config } from "jest";

const unitAndApiProject: Config = {
  displayName: "unit-and-api",
  preset: "ts-jest",
  testEnvironment: "node",
  globals: {
    "ts-jest": {
      tsconfig: "tsconfig.jest.json",
    },
  },
  roots: ["<rootDir>/src", "<rootDir>/tests"],
  testMatch: ["**/*.unit.test.ts", "**/*.class.test.ts", "**/*.api.test.ts"],
  moduleFileExtensions: ["ts", "js", "json"],
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/**/__tests__/**",
    "!src/**/types.ts",
  ],
  coverageReporters: ["text-summary", "lcov", "html"],
  coverageDirectory: "coverage",
  moduleNameMapper: {
    "^../config/supabaseClient$": "<rootDir>/__mocks__/supabase.ts",
    "^bcrypt$": "<rootDir>/__mocks__/bcrypt.ts",
  },
};

const integrationProject: Config = {
  displayName: "integration",
  preset: "ts-jest",
  testEnvironment: "node",
  globals: {
    "ts-jest": {
      tsconfig: "tsconfig.jest.json",
    },
  },
  roots: ["<rootDir>/src", "<rootDir>/tests"],
  testMatch: ["<rootDir>/tests/integration/**/*.test.ts"],
  moduleFileExtensions: ["ts", "js", "json"],
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/**/__tests__/**",
    "!src/**/types.ts",
  ],
  coverageReporters: ["text-summary", "lcov", "html"],
  coverageDirectory: "coverage",
  // IMPORTANT: No moduleNameMapper here so DB and other externals are NOT mocked
};

const config: Config = {
  projects: [unitAndApiProject, integrationProject],
};

export default config;
