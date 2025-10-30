import logger from "../src/config/logger";
import { ComputationController } from "../src/controllers/Computation";
import { ContentModel } from "../src/models/ContentModel";
import { ProjectModel } from "../src/models/ProjectModel";
import { ThemeModel } from "../src/models/ThemeModel";
import { EmbeddingService } from "../src/services/EmbeddingService";
import { handleServiceResponse } from "../src/utils/httpHandlers";

jest.setTimeout(20000);

jest.mock("../src/utils/httpHandlers", () => ({
  handleServiceResponse: jest.fn(),
}));
jest.mock("../src/models/ProjectModel");
jest.mock("../src/models/ThemeModel");
jest.mock("../src/models/ContentModel");
jest.mock("../src/services/EmbeddingService");

describe("ComputationController.generate", () => {
  const mockRes = {} as any;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(logger, "info").mockImplementation(() => logger);
    jest.spyOn(logger, "error").mockImplementation(() => logger);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should return 400 if project_id or prompt is missing", async () => {
    const mockReq = { body: {} } as any;

    await ComputationController.generate(mockReq, mockRes);

    expect(logger.info).toHaveBeenCalled();

    expect(handleServiceResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: "Missing required fields: project_id and prompt",
      }),
      mockRes
    );
  });

  it("should return 404 if theme not found", async () => {
    (ProjectModel.getById as jest.Mock).mockResolvedValue({
      data: { id: "p1", theme_id: "t1" },
      error: null,
    });
    (ThemeModel.getById as jest.Mock).mockResolvedValue({
      data: null,
      error: new Error("Theme not found"),
    });

    const mockReq = {
      body: { project_id: "p1", prompt: "Test content" },
    } as any;

    await ComputationController.generate(mockReq, mockRes);

    expect(handleServiceResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: "Theme not found",
      }),
      mockRes
    );
  });

  it("should generate content successfully", async () => {
    (ProjectModel.getById as jest.Mock).mockResolvedValue({
      data: {
        id: "p1",
        name: "Proj",
        description: "Desc",
        goals: "Goals",
        customer_type: "Audience",
        theme_id: "t1",
      },
      error: null,
    });
    (ThemeModel.getById as jest.Mock).mockResolvedValue({
      data: {
        id: "t1",
        name: "Theme",
        font: "Arial",
        tags: ["tag1"],
        inspirations: ["insp1"],
      },
      error: null,
    });

    // Mock VertexAI and generation
    const mockModel = {
      generateContent: jest.fn().mockResolvedValue({
        response: {
          candidates: [
            {
              content: {
                parts: [{ text: "---VARIANT_START---Hello---VARIANT_END---" }],
              },
            },
          ],
        },
      }),
    };
    const mockVertexAI = jest.fn().mockReturnValue({
      getGenerativeModel: jest.fn(() => mockModel),
    });
    jest.mock("@google-cloud/vertexai", () => ({
      VertexAI: mockVertexAI,
    }));

    (ContentModel.create as jest.Mock).mockResolvedValue({
      data: { id: "c1" },
      error: null,
    });
    (EmbeddingService.generateAndStore as jest.Mock).mockResolvedValue([]);

    const mockReq = {
      body: { project_id: "p1", prompt: "Make content" },
    } as any;

    await ComputationController.generate(mockReq, mockRes);

    expect(handleServiceResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        message: "Content generated successfully",
      }),
      mockRes
    );
  });
});
