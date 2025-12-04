/**
 * Equivalence partitions for ThemeController
 *
 * Functions: `create`, `listByClient`
 *
 * Inputs and partitions:
 * create(req.body.name, req.body.tags, req.body.inspirations, req.clientId, ThemeModel.create outcome):
 * - T1: name missing (undefined / body = {}) -> Invalid (400)
 *     -> test: "should return 400 if name is missing"
 * - T2: name empty string ('') -> Invalid (boundary)
 *     -> test: "should return 400 when name is empty string (boundary)" (added)
 * - T3: name whitespace-only ('   ') -> Invalid (boundary: trimmed to empty)
 *     -> test: "should return 400 when name is whitespace-only (boundary)" (updated)
 * - T4: tags missing / not array / empty -> Invalid (400)
 *     -> tests: "should return 400 if tags are missing", "should return 400 if tags is not array or empty"
 * - T5: inspirations missing or not array -> Atypical valid (normalized to [])
 *     -> test: "should normalize inspirations to empty array when missing or not array"
 * - T6: clientId missing/undefined -> Atypical valid (controller does not validate clientId)
 *     -> test: "should create theme when clientId is missing (atypical valid)"
 * - T7: ThemeModel.create returns { data: null, error } -> Invalid (server error)
 *     -> test: "should handle ThemeModel.create error"
 * - T8: ThemeModel.create throws/rejects -> Invalid (runtime)
 *     -> test: "should handle unexpected exception in create()"
 *
 * listByClient(req.clientId, ThemeModel.listByClient outcome):
 * - L1: clientId missing/undefined -> Invalid (401 Unauthorized)
 *     -> test: "should return 401 if client_id is missing"
 * - L2: clientId whitespace-only ('   ') -> Atypical valid (controller treats as present)
 *     -> test: "should accept whitespace-only clientId (atypical valid)" (added)
 * - L3: ThemeModel.listByClient throws/rejects -> Invalid (runtime)
 *     -> test: "should catch unexpected exception in listByClient()"
 * - L4: ThemeModel.listByClient returns data -> Valid
 *     -> test: "should list themes successfully"
 */

import logger from "../src/config/logger";
import { ThemeController } from "../src/controllers/ThemeController";
import { ThemeModel } from "../src/models/ThemeModel";
import { handleServiceResponse } from "../src/utils/httpHandlers";
import { ThemeAnalysisService } from "../src/services/ThemeAnalysisService";

// Mock external dependencies
jest.mock("../src/models/ThemeModel");
jest.mock("../src/utils/httpHandlers");

describe("ThemeController", () => {
  let req: any;
  let res: any;

  beforeEach(() => {
    req = {
      body: { name: "Test Theme", tags: ["modern"], inspirations: ["Apple"] },
      clientId: "mock-client-1",
    };
    res = {};
    jest.clearAllMocks();
    jest.spyOn(logger, "log").mockImplementation();
    jest.spyOn(logger, "info").mockImplementation();
    jest.spyOn(logger, "error").mockImplementation();

    // Mock ThemeAnalysisService.analyzeTheme to avoid running heavy logic
    jest.spyOn(ThemeAnalysisService, "analyzeTheme").mockReturnValue({
      color_palette: {
        primary: [],
        secondary: [],
        accent: [],
        mood: "neutral",
      },
      style_score: 0,
      dominant_styles: [],
      visual_mood: "balanced",
      complexity_score: 0,
      brand_strength: 0,
    } as any);

    // Mock updateAnalysis on ThemeModel (called after analysis)
    (ThemeModel.updateAnalysis as jest.Mock) = jest
      .fn()
      .mockResolvedValue({ data: {}, error: null });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("create()", () => {
    // Valid input: name present and ThemeModel.create succeeds
    it("should create a theme successfully", async () => {
      (ThemeModel.create as jest.Mock).mockResolvedValue({
        data: {
          id: "mock-theme-1",
          name: "Test Theme",
          tags: ["modern"],
          inspirations: ["Apple"],
        },
        error: null,
      });

      await ThemeController.create(req, res);

      expect(ThemeModel.create).toHaveBeenCalled();
      expect(handleServiceResponse).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalled();
      const [serviceResponse] = (handleServiceResponse as jest.Mock).mock
        .calls[0];
      expect(serviceResponse.success).toBe(true);
      expect(serviceResponse.message).toBe("Theme created successfully");
    });

    // Atypical valid: clientId missing (controller does not validate clientId)
    it("should create theme when clientId is missing (atypical valid)", async () => {
      req.body = {
        name: "Theme No Client",
        tags: ["modern"],
        inspirations: ["Apple"],
      };
      req.clientId = undefined;
      (ThemeModel.create as jest.Mock).mockResolvedValue({
        data: {
          id: "t-noclient",
          name: "Theme No Client",
          tags: ["modern"],
          inspirations: ["Apple"],
        },
        error: null,
      });

      await ThemeController.create(req, res);

      expect(handleServiceResponse).toHaveBeenCalled();
      const [serviceResponse] = (handleServiceResponse as jest.Mock).mock
        .calls[0];
      expect(serviceResponse.success).toBe(true);
    });

    // Invalid input: missing name (undefined)
    it("should return 400 if name is missing", async () => {
      req.body = { tags: ["modern"] }; // missing name
      await ThemeController.create(req, res);

      expect(logger.info).toHaveBeenCalled();
      expect(handleServiceResponse).toHaveBeenCalled();
      const [serviceResponse] = (handleServiceResponse as jest.Mock).mock
        .calls[0];
      expect(serviceResponse.success).toBe(false);
      expect(serviceResponse.statusCode).toBe(400);
      expect(serviceResponse.message).toBe("Missing required fields");
    });

    // Invalid input: ThemeModel.create returns error/null (server-side)
    it("should handle ThemeModel.create error", async () => {
      (ThemeModel.create as jest.Mock).mockResolvedValue({
        data: null,
        error: new Error("Insert failed"),
      });

      await ThemeController.create(req, res);

      expect(logger.error).toHaveBeenCalled();
      expect(handleServiceResponse).toHaveBeenCalled();
      const [serviceResponse] = (handleServiceResponse as jest.Mock).mock
        .calls[0];
      expect(serviceResponse.success).toBe(false);
    });

    // Invalid input: ThemeModel.create throws/rejects (runtime)
    it("should handle unexpected exception in create()", async () => {
      (ThemeModel.create as jest.Mock).mockImplementation(() => {
        throw new Error("Unexpected crash");
      });

      await ThemeController.create(req, res);

      expect(logger.error).toHaveBeenCalled();
      expect(handleServiceResponse).toHaveBeenCalled();
      const [serviceResponse] = (handleServiceResponse as jest.Mock).mock
        .calls[0];
      expect(serviceResponse.success).toBe(false);
      expect(serviceResponse.message).toBe("Internal Server Error");
    });

    // Invalid input (boundary): name provided but empty string
    it("should return 400 when name is empty string (boundary)", async () => {
      req.body = { name: "", tags: ["modern"] };

      await ThemeController.create(req, res);

      expect(handleServiceResponse).toHaveBeenCalled();
      const [serviceResponse] = (handleServiceResponse as jest.Mock).mock
        .calls[0];
      expect(serviceResponse.success).toBe(false);
      expect(serviceResponse.statusCode).toBe(400);
    });

    // Invalid input (boundary): name is whitespace-only -> after trim becomes empty
    it("should return 400 when name is whitespace-only (boundary)", async () => {
      req.body = { name: "   ", tags: ["modern"] };
      await ThemeController.create(req, res);
      expect(handleServiceResponse).toHaveBeenCalled();
      const [serviceResponse] = (handleServiceResponse as jest.Mock).mock
        .calls[0];
      expect(serviceResponse.success).toBe(false);
      expect(serviceResponse.statusCode).toBe(400);
      expect(serviceResponse.message).toBe("Missing required fields");
      expect(ThemeModel.create).not.toHaveBeenCalled();
    });

    // Invalid input: tags missing / empty / not array
    it("should return 400 if tags are missing", async () => {
      req.body = { name: "No Tags" };
      await ThemeController.create(req, res);
      const [serviceResponse] = (handleServiceResponse as jest.Mock).mock
        .calls[0];
      expect(serviceResponse.success).toBe(false);
      expect(serviceResponse.statusCode).toBe(400);
    });

    it("should return 400 if tags is not array or empty", async () => {
      for (const invalid of [
        { name: "Empty", tags: [] },
        { name: "NotArray", tags: "modern" },
      ]) {
        req.body = invalid as any;
        await ThemeController.create(req, res);
        const [serviceResponse] = (
          handleServiceResponse as jest.Mock
        ).mock.calls.pop();
        expect(serviceResponse.success).toBe(false);
        expect(serviceResponse.statusCode).toBe(400);
      }
    });

    // Atypical valid: inspirations missing or not array should normalize to [] and succeed
    it("should normalize inspirations to empty array when missing or not array", async () => {
      req.body = {
        name: "Theme Insp",
        tags: ["modern"],
        inspirations: "not-array",
      } as any;
      (ThemeModel.create as jest.Mock).mockResolvedValue({
        data: { id: "insp-1", name: "Theme Insp" },
        error: null,
      });
      await ThemeController.create(req, res);
      expect(ThemeModel.create).toHaveBeenCalled();
      const callArg = (ThemeModel.create as jest.Mock).mock.calls[0][0];
      expect(Array.isArray(callArg.inspirations)).toBe(true);
      expect(callArg.inspirations).toEqual([]);
    });
  });

  describe("listByClient()", () => {
    // Valid input: clientId present and ThemeModel returns data
    it("should list themes successfully", async () => {
      (ThemeModel.listByClient as jest.Mock).mockResolvedValue({
        data: [{ id: "theme-1", name: "Light Mode" }],
        error: null,
      });

      await ThemeController.listByClient(req, res);

      expect(logger.info).toHaveBeenCalled();
      expect(handleServiceResponse).toHaveBeenCalled();
      const [serviceResponse] = (handleServiceResponse as jest.Mock).mock
        .calls[0];
      expect(serviceResponse.success).toBe(true);
      expect(serviceResponse.message).toBe("Retrieved themes");
      expect(Array.isArray(serviceResponse.data)).toBe(true);
    });

    // Atypical valid: clientId whitespace-only (controller treats as present)
    it("should accept whitespace-only clientId (atypical valid)", async () => {
      req.clientId = "   ";
      (ThemeModel.listByClient as jest.Mock).mockResolvedValue({
        data: [{ id: "t-ws", name: "WS Theme" }],
        error: null,
      });

      await ThemeController.listByClient(req, res);

      expect(handleServiceResponse).toHaveBeenCalled();
      const [serviceResponse] = (handleServiceResponse as jest.Mock).mock
        .calls[0];
      expect(serviceResponse.success).toBe(true);
    });

    // Invalid input: missing clientId -> Unauthorized
    it("should return 401 if client_id is missing", async () => {
      req.clientId = undefined;

      await ThemeController.listByClient(req, res);

      expect(handleServiceResponse).toHaveBeenCalled();
      const [serviceResponse] = (handleServiceResponse as jest.Mock).mock
        .calls[0];
      expect(serviceResponse.success).toBe(false);
      expect(serviceResponse.statusCode).toBe(401);
      expect(serviceResponse.message).toBe("Unauthorized");
    });

    // Invalid input: ThemeModel.listByClient throws/rejects (runtime)
    it("should catch unexpected exception in listByClient()", async () => {
      (ThemeModel.listByClient as jest.Mock).mockImplementation(() => {
        throw new Error("Unexpected crash");
      });

      await ThemeController.listByClient(req, res);

      expect(logger.error).toHaveBeenCalled();
      expect(handleServiceResponse).toHaveBeenCalled();
      const [serviceResponse] = (handleServiceResponse as jest.Mock).mock
        .calls[0];
      expect(serviceResponse.success).toBe(false);
      expect(serviceResponse.message).toBe("Internal Server Error");
    });
  });
});
