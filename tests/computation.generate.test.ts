import { ComputationController } from "../src/controllers/Computation";
import { handleServiceResponse } from "../src/utils/httpHandlers";

jest.mock("../src/utils/httpHandlers", () => ({
  handleServiceResponse: jest.fn(),
}));

describe("ComputationController.generate", () => {
  const mockRes = {} as any;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should return 400 if project_id or prompt is missing", async () => {
    const mockReq = { body: {} } as any;

    await ComputationController.generate(mockReq, mockRes);

    expect(console.log).toHaveBeenCalled();

    expect(handleServiceResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: "Missing required fields: project_id and prompt",
      }),
      mockRes
    );
  });
});
