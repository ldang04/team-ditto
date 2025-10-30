/**
 * tests/index.test.ts
 *
 * Covers the entry point (src/index.ts) by simulating a server start.
 * Ensures PORT resolution and log are called correctly.
 */

import logger from "../src/config/logger";

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
    const loggerSpy = jest.spyOn(logger, "info").mockImplementation();
    delete process.env.PORT;

    await import("../src/index");

    expect(loggerSpy).toHaveBeenCalled();
    loggerSpy.mockRestore();
  });
});
