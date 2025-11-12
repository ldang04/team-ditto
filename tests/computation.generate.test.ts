import logger from "../src/config/logger";
import { TextGenerationController } from "../src/controllers/TextGenerationController";
import { ContentModel } from "../src/models/ContentModel";
import { ProjectThemeService } from "../src/services/ProjectThemeService";
import { EmbeddingService } from "../src/services/EmbeddingService";
import { handleServiceResponse } from "../src/utils/httpHandlers";

jest.setTimeout(20000);

jest.mock("../src/utils/httpHandlers", () => ({
  handleServiceResponse: jest.fn(),
}));
jest.mock("../src/models/ContentModel");
jest.mock("../src/services/ProjectThemeService");
jest.mock("../src/services/EmbeddingService");

describe("TextGenerationController.generate", () => {
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

    await TextGenerationController.generate(mockReq, mockRes);

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
    (ProjectThemeService.getProjectAndTheme as jest.Mock).mockResolvedValue(null);

    const mockReq = {
      body: { project_id: "p1", prompt: "Test content" },
    } as any;

    await TextGenerationController.generate(mockReq, mockRes);

    expect(handleServiceResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: "Project or theme not found",
      }),
      mockRes
    );
  });

  it("should generate content successfully", async () => {
    (ProjectThemeService.getProjectAndTheme as jest.Mock).mockResolvedValue({
      project: {
        id: "p1",
        name: "Proj",
        description: "Desc",
        goals: "Goals",
        customer_type: "Audience",
        theme_id: "t1",
      },
      theme: {
        id: "t1",
        name: "Theme",
        font: "Arial",
        tags: ["tag1"],
        inspirations: ["insp1"],
      },
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

    await TextGenerationController.generate(mockReq, mockRes);

    expect(handleServiceResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        message: "Content generated successfully",
      }),
      mockRes
    );
  });
});
