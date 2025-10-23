/**
 * tests/supabaseClient.test.ts
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

  it("should throw error if SUPABASE_URL is missing", async () => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_KEY;

    // Disable dotenv before importing
    jest.doMock("dotenv", () => ({ config: jest.fn() }));

    await expect(import("../src/config/supabaseClient")).rejects.toThrow(
      "SUPABASE_URL is required"
    );
  });

  it("should throw error if SUPABASE_SERVICE_KEY is missing", async () => {
    process.env.SUPABASE_URL = "https://example.supabase.co";
    delete process.env.SUPABASE_SERVICE_KEY;

    jest.doMock("dotenv", () => ({ config: jest.fn() }));

    await expect(import("../src/config/supabaseClient")).rejects.toThrow(
      "SUPABASE_SERVICE_KEY is required"
    );
  });

  it("should create Supabase client successfully when env vars are set", async () => {
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_KEY = "test-service-key";

    jest.doMock("dotenv", () => ({ config: jest.fn() }));

    const mod = await import("../src/config/supabaseClient");
    expect(mod.supabase).toBeDefined();
  });
});
