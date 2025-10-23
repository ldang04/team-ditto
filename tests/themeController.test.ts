import { ThemeController } from "../src/controllers/ThemeController";
import { ThemeModel } from "../src/models/ThemeModel";
import { handleServiceResponse } from "../src/utils/httpHandlers";

// Mock external dependencies
jest.mock("../src/models/ThemeModel");
jest.mock("../src/utils/httpHandlers");

describe("ThemeController", () => {
  let req: any;
  let res: any;

  beforeEach(() => {
    req = { body: { name: "Test Theme" }, clientId: "mock-client-1" };
    res = {};
    jest.clearAllMocks();
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  describe("create()", () => {
    it("should create a theme successfully", async () => {
      (ThemeModel.create as jest.Mock).mockResolvedValue({
        data: { id: "mock-theme-1", name: "Test Theme" },
        error: null,
      });

      await ThemeController.create(req, res);

      expect(ThemeModel.create).toHaveBeenCalled();
      expect(handleServiceResponse).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalled();
      const [serviceResponse] = (handleServiceResponse as jest.Mock).mock
        .calls[0];
      expect(serviceResponse.success).toBe(true);
      expect(serviceResponse.message).toBe("Theme created successfully");
    });

    it("should return 400 if name is missing", async () => {
      req.body = {}; // missing name
      await ThemeController.create(req, res);

      expect(console.log).toHaveBeenCalled();
      expect(handleServiceResponse).toHaveBeenCalled();
      const [serviceResponse] = (handleServiceResponse as jest.Mock).mock
        .calls[0];
      expect(serviceResponse.success).toBe(false);
      expect(serviceResponse.statusCode).toBe(400);
      expect(serviceResponse.message).toBe("Missing required fields");
    });

    it("should handle ThemeModel.create error", async () => {
      (ThemeModel.create as jest.Mock).mockResolvedValue({
        data: null,
        error: new Error("Insert failed"),
      });

      await ThemeController.create(req, res);

      expect(console.log).toHaveBeenCalled();
      expect(handleServiceResponse).toHaveBeenCalled();
      const [serviceResponse] = (handleServiceResponse as jest.Mock).mock
        .calls[0];
      expect(serviceResponse.success).toBe(false);
    });

    it("should handle unexpected exception in create()", async () => {
      (ThemeModel.create as jest.Mock).mockImplementation(() => {
        throw new Error("Unexpected crash");
      });

      await ThemeController.create(req, res);

      expect(console.log).toHaveBeenCalled();
      expect(handleServiceResponse).toHaveBeenCalled();
      const [serviceResponse] = (handleServiceResponse as jest.Mock).mock
        .calls[0];
      expect(serviceResponse.success).toBe(false);
      expect(serviceResponse.message).toBe("Internal Server Error");
    });
  });

  describe("listByClient()", () => {
    it("should list themes successfully", async () => {
      (ThemeModel.listByClient as jest.Mock).mockResolvedValue({
        data: [{ id: "theme-1", name: "Light Mode" }],
        error: null,
      });

      await ThemeController.listByClient(req, res);

      expect(console.log).toHaveBeenCalled();
      expect(handleServiceResponse).toHaveBeenCalled();
      const [serviceResponse] = (handleServiceResponse as jest.Mock).mock
        .calls[0];
      expect(serviceResponse.success).toBe(true);
      expect(serviceResponse.message).toBe("Retrieved themes");
      expect(Array.isArray(serviceResponse.data)).toBe(true);
    });

    it("should return 401 if client_id is missing", async () => {
      req.clientId = undefined;

      await ThemeController.listByClient(req, res);

      expect(console.log).toHaveBeenCalled();
      expect(handleServiceResponse).toHaveBeenCalled();
      const [serviceResponse] = (handleServiceResponse as jest.Mock).mock
        .calls[0];
      expect(serviceResponse.success).toBe(false);
      expect(serviceResponse.statusCode).toBe(401);
      expect(serviceResponse.message).toBe("Unauthorized");
    });

    it("should handle ThemeModel.listByClient error", async () => {
      (ThemeModel.listByClient as jest.Mock).mockResolvedValue({
        data: null,
        error: new Error("DB query failed"),
      });

      await ThemeController.listByClient(req, res);

      expect(console.log).toHaveBeenCalled();
      expect(handleServiceResponse).toHaveBeenCalled();
      const [serviceResponse] = (handleServiceResponse as jest.Mock).mock
        .calls[0];
      expect(serviceResponse.success).toBe(false);
    });

    it("should catch unexpected exception in listByClient()", async () => {
      (ThemeModel.listByClient as jest.Mock).mockImplementation(() => {
        throw new Error("Unexpected crash");
      });

      await ThemeController.listByClient(req, res);

      expect(console.log).toHaveBeenCalled();
      expect(handleServiceResponse).toHaveBeenCalled();
      const [serviceResponse] = (handleServiceResponse as jest.Mock).mock
        .calls[0];
      expect(serviceResponse.success).toBe(false);
      expect(serviceResponse.message).toBe("Internal Server Error");
    });
  });
});
