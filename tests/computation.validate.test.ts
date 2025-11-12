import { ValidationController } from "../src/controllers/ValidationController";
import { handleServiceResponse } from "../src/utils/httpHandlers";
import { ContentModel } from "../src/models/ContentModel";
import { ProjectModel } from "../src/models/ProjectModel";
import { ThemeModel } from "../src/models/ThemeModel";
import logger from "../src/config/logger";

jest.setTimeout(20000);

jest.mock("../src/utils/httpHandlers", () => ({
  handleServiceResponse: jest.fn(),
}));
jest.mock("../src/models/ContentModel");
jest.mock("../src/models/ProjectModel");
jest.mock("../src/models/ThemeModel");

describe("ValidationController.validate", () => {
  const mockRes = {} as any;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(logger, "info").mockImplementation();
    jest.spyOn(logger, "error").mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // Invalid input
  it("should return 400 when missing all required fields", async () => {
    const mockReq = { body: {} } as any;

    await ValidationController.validate(mockReq, mockRes);

    expect(logger.info).toHaveBeenCalled();
    expect(handleServiceResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: "Must provide either content_id OR (content + project_id)",
      }),
      mockRes
    );
  });

  // Atypical valid input: content_id provided but not found
  it("should return 500 when content_id not found", async () => {
    (ContentModel.getById as jest.Mock).mockResolvedValue({
      data: null,
      error: new Error("Not found"),
    });

    const mockReq = { body: { content_id: "missing-id" } } as any;

    await ValidationController.validate(mockReq, mockRes);

    expect(logger.info).toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalled();
    expect(handleServiceResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
      }),
      mockRes
    );
  });

  // Typical valid input: everything resolves successfully
  it("should return success when validating new content", async () => {
    // Mock project/theme via service
    jest.spyOn(ValidationController, "getContentData").mockResolvedValue({
      projectId: "p1",
      textContent: "Great product for developers!",
      contentEmbedding: [0.1, 0.2, 0.3],
      actualMediaType: "text",
    });

    jest.spyOn(ValidationController, "calculateBrandConsistency").mockResolvedValue(85);
    jest.spyOn(ValidationController, "generateValidationInsights").mockReturnValue({
      overall_score: 85,
      brand_consistency_score: 85,
      quality_score: 85,
      passes_validation: true,
      strengths: [],
      issues: [],
      recommendations: [],
      summary: "Content passes validation",
    });

    (ProjectModel.getById as jest.Mock).mockResolvedValue({
      data: {
        id: "p1",
        name: "My Project",
        description: "Builds innovative software",
        goals: "Reach developers",
        customer_type: "tech-savvy professionals",
        theme_id: "t1",
      },
      error: null,
    });

    (ThemeModel.getById as jest.Mock).mockResolvedValue({
      data: {
        id: "t1",
        name: "Modern Theme",
        font: "Roboto",
        tags: ["modern", "clean"],
        inspirations: ["Apple", "Google"],
      },
      error: null,
    });

    const mockReq = {
      body: {
        content: "Great product for developers!",
        project_id: "p1",
      },
    } as any;

    await ValidationController.validate(mockReq, mockRes);

    expect(logger.info).toHaveBeenCalled();
    expect(handleServiceResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
      }),
      mockRes
    );
  });
});
