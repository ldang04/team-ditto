import { ComputationController } from "../src/controllers/Computation";
import { handleServiceResponse } from "../src/utils/httpHandlers";
import { ContentModel } from "../src/models/ContentModel";
import { EmbeddingsModel } from "../src/models/EmbeddingsModel";
import { ProjectModel } from "../src/models/ProjectModel";
import { ThemeModel } from "../src/models/ThemeModel";
import { EmbeddingService } from "../src/services/EmbeddingService";
import logger from "../src/config/logger";

jest.setTimeout(20000);

jest.mock("../src/utils/httpHandlers", () => ({
  handleServiceResponse: jest.fn(),
}));
jest.mock("../src/models/ContentModel");
jest.mock("../src/models/EmbeddingsModel");
jest.mock("../src/models/ProjectModel");
jest.mock("../src/models/ThemeModel");
jest.mock("../src/services/EmbeddingService");

describe("ComputationController.validate", () => {
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

    await ComputationController.validate(mockReq, mockRes);

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
  it("should return 404 when content_id not found", async () => {
    (ContentModel.getById as jest.Mock).mockResolvedValue({
      data: null,
      error: new Error("Not found"),
    });

    const mockReq = { body: { content_id: "missing-id" } } as any;

    await ComputationController.validate(mockReq, mockRes);

    expect(logger.info).toHaveBeenCalled();
    expect(handleServiceResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: "Content not found",
      }),
      mockRes
    );
  });

  // Typical valid input: everything resolves successfully
  it("should return success when content and project found", async () => {
    // Mock content fetch
    (ContentModel.getById as jest.Mock).mockResolvedValue({
      data: {
        id: "c1",
        text_content: "Great product for developers!",
        project_id: "p1",
      },
      error: null,
    });

    // Mock embedding retrieval
    (EmbeddingsModel.getByContentId as jest.Mock).mockResolvedValue({
      data: [{ embedding: [0.1, 0.2, 0.3] }],
      error: null,
    });

    // Mock project/theme
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

    // Mock embedding services
    (EmbeddingService.generateDocumentEmbedding as jest.Mock).mockResolvedValue(
      [0.1, 0.2, 0.3]
    );
    (EmbeddingService.cosineSimilarity as jest.Mock).mockReturnValue(0.8);
    jest
      .spyOn(ComputationController, "calculateQualityScore")
      .mockReturnValue(80);

    const mockReq = { body: { content_id: "c1" } } as any;

    await ComputationController.validate(mockReq, mockRes);

    expect(logger.info).toHaveBeenCalled();
    expect(handleServiceResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        message: "Success",
      }),
      mockRes
    );
  });
});
