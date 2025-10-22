// jest.config.ts
import type { Config } from "jest";
const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  // 👇 tell ts-jest to use the dedicated tsconfig for tests
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.jest.json'
    }
  },
  roots: ["<rootDir>/src", "<rootDir>/tests"],
  testMatch: ["**/*.test.ts"],
  moduleFileExtensions: ["ts", "js", "json"],
  collectCoverageFrom: ["src/**/*.ts", "!src/**/__tests__/**", "!src/**/types.ts"],
  coverageReporters: ["text-summary", "lcov", "html"],
  coverageDirectory: "coverage"
};
export default config;
