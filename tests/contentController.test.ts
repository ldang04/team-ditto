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
});
