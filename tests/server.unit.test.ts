/**
 * Equivalence partitions for Server startup (`src/index.ts`)
 *
 * Units covered: module initialization / server start (resolves `PORT`, initializes services,
 * calls `app.listen`).
 *
 * Inputs considered: `process.env.PORT` (string)
 *
 * Partitions:
 * - P1: PORT missing/undefined -> Valid (use default 8080)
 * - P2: PORT empty string ('') -> Treated as 0 -> falls back to default 8080
 * - P3: PORT whitespace-only ('   ') -> Number('   ')=0 -> fallback to 8080 (atypical)
 * - P4: PORT numeric string within normal range ('3000') -> Valid (use provided port)
 * - P5: PORT non-numeric ('abc') -> Number -> NaN -> fallback to 8080 (invalid)
 * - P6: PORT negative numeric ('-1') -> Number -> -1 -> accepted by code (edge case)
 * - P7: PORT above 65535 ('70000') -> Number -> accepted by code (edge case)
 *
 * Tests mapping:
 * - "should start server on default port 8080" -> P1 (missing)
 * - "should start server on provided numeric port" -> P4
 * - "should fallback to default when PORT is empty string" -> P2
 * - "should fallback to default when PORT is whitespace-only" -> P3
 * - "should fallback to default when PORT is non-numeric" -> P5
 * - "should use negative numeric PORT when provided (edge case)" -> P6
 * - "should use large numeric PORT when provided (edge case)" -> P7
 *
 * Notes:
 * - The startup code uses `Number(process.env.PORT) || 8080`, so falsy numeric
 *   values (0, NaN) fall back to 8080. Negative numbers are truthy and will be
 *   passed through to `app.listen` even though they are not valid TCP port numbers.
 */

jest.mock("../src/app", () => ({
  __esModule: true,
  default: {
    listen: jest.fn((port: number, _host: any, cb: any) => cb && cb()),
  },
}));

jest.mock("../src/services/StorageService", () => ({
  StorageService: { initialize: jest.fn().mockResolvedValue(undefined) },
}));

describe("Server startup (index.ts)", () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...OLD_ENV };
  });

  afterEach(() => {
    process.env = OLD_ENV;
    jest.restoreAllMocks();
  });

  // Valid: missing PORT should use default 8080 (P1)
  it("should start server on default port 8080 when PORT is missing", async () => {
    delete process.env.PORT;

    const appMock = require("../src/app").default;
    await import("../src/index");

    expect(appMock.listen).toHaveBeenCalledWith(
      8080,
      "0.0.0.0",
      expect.any(Function)
    );
  });

  // Valid: numeric PORT string provided should be used (P4)
  it("should start server on provided numeric PORT", async () => {
    process.env.PORT = "4000";
    const appMock = require("../src/app").default;

    await import("../src/index");

    expect(appMock.listen).toHaveBeenCalledWith(
      4000,
      "0.0.0.0",
      expect.any(Function)
    );
  });

  // Invalid (boundary): empty string -> Number('') = 0 -> falls back to default (P2)
  it("should fallback to default when PORT is empty string", async () => {
    process.env.PORT = "";
    const appMock = require("../src/app").default;

    await import("../src/index");

    expect(appMock.listen).toHaveBeenCalledWith(
      8080,
      "0.0.0.0",
      expect.any(Function)
    );
  });

  // Invalid: whitespace-only -> Number('   ')=0 -> falls back to default (P3)
  it("should fallback to default when PORT is whitespace-only", async () => {
    process.env.PORT = "   ";
    const appMock = require("../src/app").default;

    await import("../src/index");

    expect(appMock.listen).toHaveBeenCalledWith(
      8080,
      "0.0.0.0",
      expect.any(Function)
    );
  });

  // Invalid: non-numeric -> NaN -> falls back to default (P5)
  it("should fallback to default when PORT is non-numeric", async () => {
    process.env.PORT = "not-a-number";
    const appMock = require("../src/app").default;

    await import("../src/index");

    expect(appMock.listen).toHaveBeenCalledWith(
      8080,
      "0.0.0.0",
      expect.any(Function)
    );
  });

  // Atypical/edge: negative numeric passed through (-1) (P6)
  it("should use negative numeric PORT when provided (edge case)", async () => {
    process.env.PORT = "-1";
    const appMock = require("../src/app").default;

    await import("../src/index");

    expect(appMock.listen).toHaveBeenCalledWith(
      -1,
      "0.0.0.0",
      expect.any(Function)
    );
  });

  // Atypical/edge: large numeric passed through (70000) (P7)
  it("should use large numeric PORT when provided (edge case)", async () => {
    process.env.PORT = "70000";
    const appMock = require("../src/app").default;

    await import("../src/index");

    expect(appMock.listen).toHaveBeenCalledWith(
      70000,
      "0.0.0.0",
      expect.any(Function)
    );
  });
});
