/**
 * tests/index.test.ts
 *
 * Covers the entry point (src/index.ts) by simulating a server start.
 * Ensures PORT resolution and console.log are called correctly.
 */

jest.mock("../src/app", () => ({
  __esModule: true,
  default: {
    listen: jest.fn((port: number, cb: any) => cb && cb()),
  },
}));

describe("Server startup (index.ts)", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeAll(() => {
    originalEnv = { ...process.env };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("should start server on default port 3000", async () => {
    const consoleSpy = jest.spyOn(console, "log").mockImplementation();
    delete process.env.PORT;

    await import("../src/index");

    expect(consoleSpy).toHaveBeenCalledWith("Server running on port 3000");
    consoleSpy.mockRestore();
  });

  it("should start server on custom PORT if provided", async () => {
    const consoleSpy = jest.spyOn(console, "log").mockImplementation();
    process.env.PORT = "8080";

    // Clear module cache so import re-executes
    jest.resetModules();
    await import("../src/index");

    expect(consoleSpy).toHaveBeenCalledWith("Server running on port 8080");
    consoleSpy.mockRestore();
  });
});
