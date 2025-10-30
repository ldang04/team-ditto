import { Request, Response } from "express";
import { ProjectController } from "../src/controllers/ProjectController";
import { ProjectModel } from "../src/models/ProjectModel";
import { handleServiceResponse } from "../src/utils/httpHandlers";
import logger from "../src/config/logger";

jest.mock("../src/models/ProjectModel");
jest.mock("../src/utils/httpHandlers");

describe("ProjectController", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;

  beforeEach(() => {
    req = { body: {}, params: {}, clientId: "mock-client-1" } as any;
    res = {};
    jest.clearAllMocks();
    jest.spyOn(logger, "info").mockImplementation();
    jest.spyOn(logger, "error").mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("create", () => {
    it("should create project successfully with valid input", async () => {
      const localReq = { ...req, body: { name: "Valid Project" } } as any;

      (ProjectModel.create as jest.Mock).mockResolvedValue({
        data: { id: "mock-project-1", name: "Valid Project" },
        error: null,
      });

      await ProjectController.create(localReq as Request, res as Response);

      expect(logger.info).toHaveBeenCalled();
      expect(handleServiceResponse).toHaveBeenCalled();
      const [response] = (handleServiceResponse as jest.Mock).mock.calls[0];

      expect(response.success).toBe(true);
      expect(response.message).toBe("Project created successfully");
    });

    it("should throw if model returns error or null data", async () => {
      (ProjectModel.create as jest.Mock).mockResolvedValue({
        data: null,
        error: new Error("Insert failed"),
      });

      await ProjectController.create(req as Request, res as Response);

      expect(logger.info).toHaveBeenCalled();
      expect(handleServiceResponse).toHaveBeenCalled();
      const [serviceResponse] = (handleServiceResponse as jest.Mock).mock
        .calls[0];
      expect(serviceResponse.success).toBe(false);
    });

    it("should hit catch block when rejected", async () => {
      (ProjectModel.create as jest.Mock).mockRejectedValue(
        new Error("Unexpected failure")
      );

      await ProjectController.create(req as Request, res as Response);

      expect(logger.info).toHaveBeenCalled();
      expect(handleServiceResponse).toHaveBeenCalled();
      const [serviceResponse] = (handleServiceResponse as jest.Mock).mock
        .calls[0];
      expect(serviceResponse.success).toBe(false);
    });
  });

  describe("listByClient", () => {
    it("should return list of projects successfully", async () => {
      (ProjectModel.listByClient as jest.Mock).mockResolvedValue({
        data: [{ id: "p1", name: "Test Project" }],
        error: null,
      });

      await ProjectController.listByClient(req as Request, res as Response);

      const [response] = (handleServiceResponse as jest.Mock).mock.calls[0];
      expect(response.success).toBe(true);
      expect(response.message).toBe("Retrieved projects");
    });

    it("should handle missing client_id (Unauthorized)", async () => {
      (req as any).clientId = undefined;
      await ProjectController.listByClient(req as Request, res as Response);

      expect(logger.info).toHaveBeenCalled();
      expect(handleServiceResponse).toHaveBeenCalled();
      const [serviceResponse] = (handleServiceResponse as jest.Mock).mock
        .calls[0];
      expect(serviceResponse.message).toBe("Unauthorized");
    });

    it("should handle model error (throws)", async () => {
      (ProjectModel.listByClient as jest.Mock).mockResolvedValue({
        data: null,
        error: new Error("DB failure"),
      });

      await ProjectController.listByClient(req as Request, res as Response);

      expect(logger.info).toHaveBeenCalled();
      expect(handleServiceResponse).toHaveBeenCalled();
      const [serviceResponse] = (handleServiceResponse as jest.Mock).mock
        .calls[0];
      expect(serviceResponse.success).toBe(false);
    });

    it("should hit catch block when rejected", async () => {
      (ProjectModel.listByClient as jest.Mock).mockRejectedValue(
        new Error("Rejected promise")
      );

      await ProjectController.listByClient(req as Request, res as Response);

      expect(logger.info).toHaveBeenCalled();
      expect(handleServiceResponse).toHaveBeenCalled();
      const [serviceResponse] = (handleServiceResponse as jest.Mock).mock
        .calls[0];
      expect(serviceResponse.success).toBe(false);
    });
  });

  describe("update", () => {
    it("should update project successfully", async () => {
      req.params = { id: "mock-project-1" };
      (ProjectModel.update as jest.Mock).mockResolvedValue({
        data: { id: "mock-project-1", name: "Updated Project" },
        error: null,
      });

      await ProjectController.update(req as Request, res as Response);

      const [response] = (handleServiceResponse as jest.Mock).mock.calls[0];
      expect(response.success).toBe(true);
      expect(response.message).toBe("Updated project successfully");
    });

    it("should handle missing id param", async () => {
      req.params = {};

      await ProjectController.update(req as Request, res as Response);

      expect(logger.info).toHaveBeenCalled();
      expect(handleServiceResponse).toHaveBeenCalled();
      const [serviceResponse] = (handleServiceResponse as jest.Mock).mock
        .calls[0];
      expect(serviceResponse.message).toBe("Missing project id");
    });

    it("should handle model error", async () => {
      req.params = { id: "mock-project-1" };
      (ProjectModel.update as jest.Mock).mockResolvedValue({
        data: null,
        error: new Error("Update failed"),
      });

      await ProjectController.update(req as Request, res as Response);

      expect(logger.info).toHaveBeenCalled();
      expect(handleServiceResponse).toHaveBeenCalled();
      const [serviceResponse] = (handleServiceResponse as jest.Mock).mock
        .calls[0];
      expect(serviceResponse.success).toBe(false);
    });

    it("should hit catch block when rejected", async () => {
      req.params = { id: "mock-project-1" };
      (ProjectModel.update as jest.Mock).mockRejectedValue(
        new Error("Unexpected rejection")
      );

      await ProjectController.update(req as Request, res as Response);

      expect(logger.info).toHaveBeenCalled();
      expect(handleServiceResponse).toHaveBeenCalled();
      const [serviceResponse] = (handleServiceResponse as jest.Mock).mock
        .calls[0];
      expect(serviceResponse.success).toBe(false);
    });
  });
});
