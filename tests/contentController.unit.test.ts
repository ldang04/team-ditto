/**
 * Equivalence partitions for ContentController.list
 *
 * Inputs considered:
 * - `req.params.project_id` (missing, empty string, whitespace-only, normal id)
 * - `ContentModel.listByProject` outcomes (data+null error, null data+error, rejection)
 *
 * Partitions and mapping:
 * 1. project_id missing (params {}) -> Invalid (400)
 *    -> test: "should handle missing project_id (400)"
 * 2. project_id empty string ('') -> Invalid (400) (boundary)
 *    -> test: "should return 400 when project_id is empty string (boundary)"
 * 3. project_id whitespace-only ('   ') -> Atypical valid (controller treats as present)
 *    -> test: "should accept whitespace-only project_id (atypical valid)"
 * 4. project_id normal string -> Valid
 *    -> test: "should return success when data is retrieved"
 * 5. ContentModel returns error -> Invalid (500)
 *    -> test: "should handle model error (throws inside try)"
 * 6. ContentModel rejects -> Invalid (500/catch)
 *    -> test: "should handle unexpected error (catch block)"
 */

import { Request, Response } from "express";
import { ContentController } from "../src/controllers/ContentController";
import { ContentModel } from "../src/models/ContentModel";
import { handleServiceResponse } from "../src/utils/httpHandlers";
import logger from "../src/config/logger";

jest.mock("../src/models/ContentModel");
jest.mock("../src/utils/httpHandlers");

describe("ContentController.list", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;

  beforeEach(() => {
    req = { params: { project_id: "mock-project-1" } };
    res = {};
    jest.clearAllMocks();
    jest.spyOn(logger, "info").mockImplementation();
    jest.spyOn(logger, "error").mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // Valid input: project_id present and model returns data
  it("should return success when data is retrieved", async () => {
    const mockData = [{ id: "c1", text: "content" }];
    (ContentModel.listByProject as jest.Mock).mockResolvedValue({
      data: mockData,
      error: null,
    });

    await ContentController.list(req as Request, res as Response);

    expect(logger.info).toHaveBeenCalled();
    expect(handleServiceResponse).toHaveBeenCalled();
    const [serviceResponse] = (handleServiceResponse as jest.Mock).mock
      .calls[0];
    expect(serviceResponse.success).toBe(true);
    expect(serviceResponse.message).toBe("Retrieved contents");
    expect(serviceResponse.data).toEqual(mockData);
  });

  // Atypical valid input: whitespace-only project_id (controller currently treats as present)
  it("should accept whitespace-only project_id (atypical valid)", async () => {
    const mockData = [{ id: "c-ws", text: "content-ws" }];
    req = { params: { project_id: "   " } } as Partial<Request>;

    (ContentModel.listByProject as jest.Mock).mockResolvedValue({
      data: mockData,
      error: null,
    });

    await ContentController.list(req as Request, res as Response);

    expect(logger.info).toHaveBeenCalled();
    expect(handleServiceResponse).toHaveBeenCalled();
    const [serviceResponse] = (handleServiceResponse as jest.Mock).mock
      .calls[0];
    expect(serviceResponse.success).toBe(true);
    expect(serviceResponse.message).toBe("Retrieved contents");
    expect(serviceResponse.data).toEqual(mockData);
  });

  // Invalid input: missing `project_id` (treated as 400)
  it("should handle missing project_id (400)", async () => {
    req = { params: {} }; // simulate missing project_id

    await ContentController.list(req as Request, res as Response);

    expect(logger.info).toHaveBeenCalled();
    expect(handleServiceResponse).toHaveBeenCalled();
    const [serviceResponse] = (handleServiceResponse as jest.Mock).mock
      .calls[0];
    expect(serviceResponse.success).toBe(false);
    expect(serviceResponse.message).toBe("Missing project_id");
  });

  // Invalid input: ContentModel returns an error (server-side)
  it("should handle model error (throws inside try)", async () => {
    (ContentModel.listByProject as jest.Mock).mockResolvedValue({
      data: null,
      error: new Error("DB error"),
    });

    await ContentController.list(req as Request, res as Response);

    expect(logger.info).toHaveBeenCalled();
    expect(handleServiceResponse).toHaveBeenCalled();
    const [serviceResponse] = (handleServiceResponse as jest.Mock).mock
      .calls[0];
    expect(serviceResponse.success).toBe(false);
    expect(serviceResponse.message).toBe("Internal Server Error");
  });

  // Invalid input (boundary): project_id provided but is empty string
  it("should return 400 when project_id is empty string (boundary)", async () => {
    req = { params: { project_id: "" } } as Partial<Request>;

    await ContentController.list(req as Request, res as Response);

    expect(logger.info).toHaveBeenCalled();
    expect(handleServiceResponse).toHaveBeenCalled();
    const [serviceResponse] = (handleServiceResponse as jest.Mock).mock
      .calls[0];
    expect(serviceResponse.success).toBe(false);
    expect(serviceResponse.message).toBe("Missing project_id");
  });

  // Invalid input: ContentModel rejects (runtime/catch)
  it("should handle unexpected error (catch block)", async () => {
    (ContentModel.listByProject as jest.Mock).mockRejectedValue(
      new Error("Unexpected failure")
    );

    await ContentController.list(req as Request, res as Response);

    expect(logger.info).toHaveBeenCalled();
    expect(handleServiceResponse).toHaveBeenCalled();
    const [serviceResponse] = (handleServiceResponse as jest.Mock).mock
      .calls[0];
    expect(serviceResponse.success).toBe(false);
    expect(serviceResponse.message).toBe("Internal Server Error");
  });
});
