// jest.config.ts
import type { Config } from "jest";
const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  globals: {
    "ts-jest": {
      tsconfig: "tsconfig.jest.json",
    },
  },
  roots: ["<rootDir>/src", "<rootDir>/tests"],
  testMatch: ["**/*.test.ts"],
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
export default config;
