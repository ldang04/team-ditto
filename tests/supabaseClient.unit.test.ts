/**
 * Equivalence partitions for Supabase client initialization
 *
 * Units covered: module initialization in `src/config/supabaseClient.ts`
 *
 * Inputs considered: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`
 *
 * Partitions (per env var):
 * - S1: missing / undefined -> Invalid (throws on import)
 * - S2: empty string ('') -> Invalid (falsy -> treated as missing)
 * - S3: whitespace-only ('   ') -> Atypical: truthy at module-level but may be rejected by downstream validators
 * - S4: well-formed string -> Valid (client created)
 *
 * Tests mapping:
 * - "should throw error if SUPABASE_URL is missing" -> S1 for `SUPABASE_URL`
 * - "should throw error if SUPABASE_SERVICE_KEY is missing" -> S1 for `SUPABASE_SERVICE_KEY`
 * - "should create Supabase client successfully when env vars are set" -> S4 (both vars present)
 * - "should throw if SUPABASE_URL is empty string" -> S2 for `SUPABASE_URL`
 * - "should reject when SUPABASE_URL is whitespace-only (boundary)" -> S3 for `SUPABASE_URL` (rejected by Supabase client)
 * - "should throw if SUPABASE_SERVICE_KEY is empty string" -> S2 for `SUPABASE_SERVICE_KEY`
 * - "should create client when SUPABASE_SERVICE_KEY is whitespace-only (atypical valid)" -> S3 for `SUPABASE_SERVICE_KEY`
 *
 */
describe("Supabase Client Initialization", () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...OLD_ENV };
  });

  afterEach(() => {
    process.env = OLD_ENV;
  });

  //Valid input
  it("should create Supabase client successfully when env vars are set", async () => {
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_KEY = "test-service-key";

    jest.doMock("dotenv", () => ({ config: jest.fn() }));

    const mod = await import("../src/config/supabaseClient");
    expect(mod.supabase).toBeDefined();
  });

  //Atypical valid input
  it("should create client when SUPABASE_SERVICE_KEY is whitespace-only (atypical valid)", async () => {
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_KEY = "   ";

    jest.doMock("dotenv", () => ({ config: jest.fn() }));

    const mod = await import("../src/config/supabaseClient");
    expect(mod.supabase).toBeDefined();
  });

  //Invalid input
  it("should throw error if SUPABASE_URL is missing", async () => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_KEY;

    // Disable dotenv before importing
    jest.doMock("dotenv", () => ({ config: jest.fn() }));

    await expect(import("../src/config/supabaseClient")).rejects.toThrow(
      "SUPABASE_URL is required"
    );
  });

  //Invalid input
  it("should throw error if SUPABASE_SERVICE_KEY is missing", async () => {
    process.env.SUPABASE_URL = "https://example.supabase.co";
    delete process.env.SUPABASE_SERVICE_KEY;

    jest.doMock("dotenv", () => ({ config: jest.fn() }));

    await expect(import("../src/config/supabaseClient")).rejects.toThrow(
      "SUPABASE_SERVICE_KEY is required"
    );
  });

  //Invalid input
  it("should throw if SUPABASE_URL is empty string", async () => {
    process.env.SUPABASE_URL = "";
    process.env.SUPABASE_SERVICE_KEY = "test-service-key";

    jest.doMock("dotenv", () => ({ config: jest.fn() }));

    await expect(import("../src/config/supabaseClient")).rejects.toThrow(
      /SUPABASE_URL is required/i
    );
  });

  //Invalid input
  it("should reject when SUPABASE_URL is whitespace-only (boundary)", async () => {
    process.env.SUPABASE_URL = "   ";
    process.env.SUPABASE_SERVICE_KEY = "test-service-key";

    jest.doMock("dotenv", () => ({ config: jest.fn() }));

    await expect(import("../src/config/supabaseClient")).rejects.toThrow(
      /supabaseUrl is required/i
    );
  });

  //Invalid input
  it("should throw if SUPABASE_SERVICE_KEY is empty string", async () => {
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_KEY = "";

    jest.doMock("dotenv", () => ({ config: jest.fn() }));

    await expect(import("../src/config/supabaseClient")).rejects.toThrow(
      /SUPABASE_SERVICE_KEY is required/i
    );
  });
});
