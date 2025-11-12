import logger from "../src/config/logger";
import { ComputationController } from "../src/controllers/ComputationController";
import { handleServiceResponse } from "../src/utils/httpHandlers";

// Mock VertexAI
jest.mock("@google-cloud/vertexai", () => {
  return {
    VertexAI: jest.fn().mockImplementation(() => ({
      getGenerativeModel: jest.fn().mockReturnValue({
        generateContent: jest.fn().mockResolvedValue({
          response: {
            candidates: [
              { content: { parts: [{ text: "Hello from Vertex AI!" }] } },
            ],
          },
        }),
      }),
    })),
  };
});

// Mock handleServiceResponse to capture responses
jest.mock("../src/utils/httpHandlers", () => ({
  handleServiceResponse: jest.fn(),
}));

describe("ComputationController.testVertex", () => {
  const mockReq = {} as any;
  const mockRes = {} as any;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(logger, "info").mockImplementation();
    jest.spyOn(logger, "error").mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should return failure if GCP_PROJECT_ID is missing", async () => {
    delete process.env.GCP_PROJECT_ID;

    await ComputationController.testVertex(mockReq, mockRes);

    expect(logger.info).toHaveBeenCalled();

    expect(handleServiceResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: "GCP_PROJECT_ID not set",
      }),
      mockRes
    );
  });

  it("should successfully generate response from Vertex AI", async () => {
    process.env.GCP_PROJECT_ID = "mock-project";
    process.env.VERTEX_MODEL_TEXT = "mock-model";

    await ComputationController.testVertex(mockReq, mockRes);

    expect(logger.info).toHaveBeenCalled();

    expect(handleServiceResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        message: "Vertex AI test successful",
      }),
      mockRes
    );
  });

  it("should handle Vertex AI generation failure gracefully", async () => {
    process.env.GCP_PROJECT_ID = "mock-project";

    const VertexAI = require("@google-cloud/vertexai").VertexAI;
    VertexAI.mockImplementation(() => ({
      getGenerativeModel: () => ({
        generateContent: jest.fn().mockRejectedValue(new Error("API error")),
      }),
    }));

    await ComputationController.testVertex(mockReq, mockRes);

    expect(logger.info).toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalled();

    expect(handleServiceResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: "Vertex test failed",
      }),
      mockRes
    );
  });
});
