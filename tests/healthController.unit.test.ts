/**
 * HealthController - Equivalence partitions and test mapping
 *
 * Unit under test:
 * - HealthController.testVertex(req, res)
 *
 * Partitions (inputs):
 * - T1 (Valid): `process.env.GCP_PROJECT_ID` set and Vertex model returns a candidate with text.
 * - T2 (Invalid): `process.env.GCP_PROJECT_ID` missing OR model throws an exception.
 * - T3 (Atypical-but-valid): model returns no candidates / empty response -> uses fallback text "No response generated".
 *
 * Mapping:
 * - testVertex: success response when Vertex responds (T1). Missing env (T2). Model error (T2).
 *   Empty candidates -> fallback string (T3).
 */

// Mock the VertexAI module so tests do not call the real Google SDK.
const VertexAIMock = jest.fn();
jest.mock("@google-cloud/vertexai", () => ({ VertexAI: VertexAIMock }));

import { HealthController } from "../src/controllers/HealthController";
import logger from "../src/config/logger";

// Silence logger
jest.spyOn(logger, "info").mockImplementation(() => ({} as any));
jest.spyOn(logger, "error").mockImplementation(() => ({} as any));

describe("HealthController.testVertex (partitioned)", () => {
  let generateMock: jest.Mock;
  let req: any;
  let res: any;

  beforeEach(() => {
    jest.clearAllMocks();
    // default request/response mocks
    req = { method: "GET", url: "/health/test-vertex", body: {} } as any;
    res = { status: jest.fn().mockReturnThis(), send: jest.fn() } as any;
  });

  afterEach(() => {
    delete process.env.GCP_PROJECT_ID;
    delete process.env.VERTEX_MODEL_TEXT;
  });

  // valid T1: - Vertex returns a candidate text
  it("returns 200 and generated text when Vertex responds (T1)", async () => {
    process.env.GCP_PROJECT_ID = "project-1";
    generateMock = jest.fn().mockResolvedValue({
      response: {
        candidates: [{ content: { parts: [{ text: "Hello from Vertex" }] } }],
      },
    });

    VertexAIMock.mockImplementation(() => ({
      getGenerativeModel: () => ({ generateContent: generateMock }),
    }));

    await HealthController.testVertex(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const sent = res.send.mock.calls[0][0];
    expect(sent.success).toBe(true);
    expect(sent.data).toBe("Hello from Vertex");
  });

  // atypical T3: - empty candidates -> fallback string
  it("returns 200 and fallback text when Vertex returns no candidates (T3)", async () => {
    process.env.GCP_PROJECT_ID = "proj-1";
    generateMock = jest.fn().mockResolvedValue({ response: {} });

    VertexAIMock.mockImplementation(() => ({
      getGenerativeModel: () => ({ generateContent: generateMock }),
    }));

    await HealthController.testVertex(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const sent = res.send.mock.calls[0][0];
    expect(sent.success).toBe(true);
    expect(sent.data).toBe("No response generated");
  });

  // invalid T2: - missing GCP_PROJECT_ID env
  it("returns 500 when GCP_PROJECT_ID is not set (T2)", async () => {
    // ensure env missing
    delete process.env.GCP_PROJECT_ID;

    await HealthController.testVertex(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    const sent = res.send.mock.calls[0][0];
    expect(sent.success).toBe(false);
    expect(sent.message).toMatch(/GCP_PROJECT_ID not set/);
  });

  // invalid T2: - model throws
  it("returns 500 when Vertex generateContent throws (T2)", async () => {
    process.env.GCP_PROJECT_ID = "proj-1";
    generateMock = jest.fn().mockRejectedValue(new Error("boom"));

    VertexAIMock.mockImplementation(() => ({
      getGenerativeModel: () => ({ generateContent: generateMock }),
    }));

    await HealthController.testVertex(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    const sent = res.send.mock.calls[0][0];
    expect(sent.success).toBe(false);
    expect(sent.message).toMatch(/Vertex test failed/);
  });
});
