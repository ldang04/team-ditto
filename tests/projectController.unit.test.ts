/**
 * Equivalence partitions for ProjectController
 *
 * Units covered: `create`, `listByClient`, `update`
 *
 * create(req.body.name, req.clientId, ProjectModel.create outcome):
 * - P1: name missing (undefined) -> Invalid (400)
 *     -> test: add/expect: "should return 400 when name is missing"
 * - P2: name empty string ('') -> Invalid (boundary)
 *     -> test: "should return 400 when name is empty string (boundary)"
 * - P3: name whitespace-only ('   ') -> Invalid (boundary: trimmed to empty)
 *     -> test: "should return 400 when name is whitespace-only (boundary)"
 * - P4: clientId missing/undefined -> Atypical valid (controller currently does not validate clientId)
 *     -> test: "should create project when clientId is missing (atypical valid)"
 * - P5: ProjectModel.create returns { data: null, error } -> Invalid (server error)
 *     -> test: "should throw if model returns error or null data"
 * - P6: ProjectModel.create rejects -> Invalid (runtime)
 *     -> test: "should hit catch block when rejected"
 *
 * listByClient(req.clientId, ProjectModel.listByClient outcome):
 * - L1: clientId missing/undefined -> Invalid (Unauthorized)
 *     -> test: "should handle missing client_id (Unauthorized)"
 * - L2: clientId whitespace-only ('   ') -> Atypical valid (controller treats as present)
 *     -> test: "should accept whitespace-only clientId (atypical valid)"
 * - L3: Model returns { data: null, error } -> Invalid (server error)
 *     -> test: "should handle model error (throws)"
 * - L4: Model rejects -> Invalid (runtime)
 *     -> test: "should hit catch block when rejected"
 * - L5: Model returns data -> Valid
 *     -> test: "should return list of projects successfully"
 *
 * update(req.params.id, ProjectModel.update outcome):
 * - U1: id missing/undefined -> Invalid (400)
 *     -> test: "should handle missing id param"
 * - U2: id empty string ('') -> Invalid (boundary)
 *     -> test: "should return 400 when id is empty string (boundary)"
 * - U3: id whitespace-only ('   ') -> Invalid (boundary: trimmed to empty)
 *     -> test: "should return 400 when id is whitespace-only (boundary)"
 * - U4: Model returns { data: null, error } -> Invalid (server error)
 *     -> test: "should handle model error"
 * - U5: Model rejects -> Invalid (runtime)
 *     -> test: "should hit catch block when rejected"
 * - U6: Model returns data -> Valid
 *     -> test: "should update project successfully"
 *
 * Notes:
 * - Current behavior:
 *   - `create` and `update` now trim inputs and reject whitespace-only values (return 400).
 *   - `listByClient` still treats whitespace-only `clientId` as present (atypical valid).
 */

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
    // Valid input: name present and ProjectModel.create succeeds
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

    // Atypical valid: clientId missing (controller does not validate clientId)
    it("should create project when clientId is missing (atypical valid)", async () => {
      const localReq = {
        ...req,
        body: { name: "No Client" },
        clientId: undefined,
      } as any;

      (ProjectModel.create as jest.Mock).mockResolvedValue({
        data: { id: "p-noclient", name: "No Client" },
        error: null,
      });

      await ProjectController.create(localReq as Request, res as Response);

      expect(handleServiceResponse).toHaveBeenCalled();
      const [response] = (handleServiceResponse as jest.Mock).mock.calls[0];
      expect(response.success).toBe(true);
    });

    // Invalid (boundary): name is whitespace-only -> trimmed to empty -> 400
    it("should return 400 when name is whitespace-only (boundary)", async () => {
      const localReq = { ...req, body: { name: "   " } } as any;

      await ProjectController.create(localReq as Request, res as Response);

      expect(handleServiceResponse).toHaveBeenCalled();
      const [serviceResponse] = (handleServiceResponse as jest.Mock).mock
        .calls[0];
      expect(serviceResponse.success).toBe(false);
      expect(serviceResponse.statusCode).toBe(400);
      expect(ProjectModel.create).not.toHaveBeenCalled();
    });

    // Invalid input: ProjectModel.create returns error/null (server-side)
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

    // Invalid input: ProjectModel.create rejects (runtime)
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

    // Invalid input: name missing (undefined) -> should return 400
    it("should return 400 when name is missing (undefined)", async () => {
      const localReq = { ...req, body: {} } as any;

      await ProjectController.create(localReq as Request, res as Response);

      expect(logger.info).toHaveBeenCalled();
      expect(handleServiceResponse).toHaveBeenCalled();
      const [serviceResponse] = (handleServiceResponse as jest.Mock).mock
        .calls[0];
      expect(serviceResponse.success).toBe(false);
      expect(serviceResponse.message).toBe("Missing required fields");
      expect(serviceResponse.statusCode).toBe(400);
    });

    // Invalid input (boundary): name provided but empty string
    it("should return 400 when name is empty string (boundary)", async () => {
      const localReq = { ...req, body: { name: "" } } as any;

      await ProjectController.create(localReq as Request, res as Response);

      expect(logger.info).toHaveBeenCalled();
      expect(handleServiceResponse).toHaveBeenCalled();
      const [serviceResponse] = (handleServiceResponse as jest.Mock).mock
        .calls[0];
      expect(serviceResponse.success).toBe(false);
    });
  });

  describe("listByClient", () => {
    // Valid input: clientId present and model returns projects
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

    // Atypical valid: clientId whitespace-only (controller treats as present)
    it("should accept whitespace-only clientId (atypical valid)", async () => {
      (req as any).clientId = "   ";
      (ProjectModel.listByClient as jest.Mock).mockResolvedValue({
        data: [{ id: "p-ws", name: "WS Project" }],
        error: null,
      });

      await ProjectController.listByClient(req as Request, res as Response);

      const [response] = (handleServiceResponse as jest.Mock).mock.calls[0];
      expect(response.success).toBe(true);
    });

    // Invalid input: missing clientId -> Unauthorized
    it("should handle missing client_id (Unauthorized)", async () => {
      (req as any).clientId = undefined;
      await ProjectController.listByClient(req as Request, res as Response);

      expect(logger.info).toHaveBeenCalled();
      expect(handleServiceResponse).toHaveBeenCalled();
      const [serviceResponse] = (handleServiceResponse as jest.Mock).mock
        .calls[0];
      expect(serviceResponse.message).toBe("Unauthorized");
    });

    // Invalid input: model returns error
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

    // Invalid input: model rejects (runtime)
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
    // Valid input: id present and update succeeds
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

    // Atypical valid: id has surrounding whitespace but is otherwise valid
    it("should update project when id has surrounding whitespace (atypical valid)", async () => {
      req.params = { id: "  mock-project-1  " } as any;
      (ProjectModel.update as jest.Mock).mockResolvedValue({
        data: { id: "mock-project-1", name: "Trimmed Update" },
        error: null,
      });

      await ProjectController.update(req as Request, res as Response);

      const [response] = (handleServiceResponse as jest.Mock).mock.calls[0];
      expect(response.success).toBe(true);
      // controller currently passes the raw `id` through to the model
      expect(ProjectModel.update).toHaveBeenCalledWith(
        "  mock-project-1  ",
        expect.any(Object)
      );
    });

    // Invalid (boundary): whitespace-only id -> trimmed to empty -> 400
    it("should return 400 when id is whitespace-only (boundary)", async () => {
      req.params = { id: "   " } as any;

      await ProjectController.update(req as Request, res as Response);

      expect(handleServiceResponse).toHaveBeenCalled();
      const [serviceResponse] = (handleServiceResponse as jest.Mock).mock
        .calls[0];
      expect(serviceResponse.success).toBe(false);
      expect(serviceResponse.statusCode).toBe(400);
      expect(ProjectModel.update).not.toHaveBeenCalled();
    });

    // Invalid input: missing id param -> 400
    it("should handle missing id param", async () => {
      req.params = {};

      await ProjectController.update(req as Request, res as Response);

      expect(logger.info).toHaveBeenCalled();
      expect(handleServiceResponse).toHaveBeenCalled();
      const [serviceResponse] = (handleServiceResponse as jest.Mock).mock
        .calls[0];
      expect(serviceResponse.message).toBe("Missing project id");
    });

    // Invalid input: model returns error on update
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

    // Invalid input: model rejects (runtime)
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

    // Invalid input (boundary): id provided but is empty string
    it("should return 400 when id is empty string (boundary)", async () => {
      req.params = { id: "" } as any;

      await ProjectController.update(req as Request, res as Response);

      expect(logger.info).toHaveBeenCalled();
      expect(handleServiceResponse).toHaveBeenCalled();
      const [serviceResponse] = (handleServiceResponse as jest.Mock).mock
        .calls[0];
      expect(serviceResponse.success).toBe(false);
    });
  });
});
