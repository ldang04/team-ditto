import { Request, Response } from "express";
import { ClientController } from "../src/controllers/ClientController";
import { ClientModel } from "../src/models/ClientModel";
import { ApiKeyModel } from "../src/models/ApiKeyModel";
import bcrypt from "bcrypt";

jest.mock("../src/models/ClientModel");
jest.mock("../src/models/ApiKeyModel");
jest.mock("bcrypt");
jest.mock("../src/utils/httpHandlers");

describe("ClientController.createClient", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;

  beforeEach(() => {
    req = { body: { name: "Mock Client" } };
    res = {};
    jest.clearAllMocks();
  });

  it("should handle client creation error (clientError or null client)", async () => {
    (ClientModel.create as jest.Mock).mockResolvedValue({
      data: null,
      error: new Error("Client create failed"),
    });

    const mockHandle = jest.spyOn(
      require("../src/utils/httpHandlers"),
      "handleServiceResponse"
    );

    await ClientController.createClient(req as Request, res as Response);

    expect(mockHandle).toHaveBeenCalled();
    const [response] = mockHandle.mock.calls[0] as any;
    expect(response.success).toBe(false);
    expect(response.message).toBe("Internal Server Error");
  });

  it("should handle API key creation error (keyErr)", async () => {
    (ClientModel.create as jest.Mock).mockResolvedValue({
      data: { id: "mock-client-1" },
      error: null,
    });

    (bcrypt.hash as jest.Mock).mockResolvedValue("hashed-key");

    (ApiKeyModel.create as jest.Mock).mockResolvedValue({
      error: new Error("Key insert failed"),
    });

    const mockHandle = jest.spyOn(
      require("../src/utils/httpHandlers"),
      "handleServiceResponse"
    );

    await ClientController.createClient(req as Request, res as Response);

    expect(mockHandle).toHaveBeenCalled();
    const [response] = mockHandle.mock.calls[0] as any;
    expect(response.success).toBe(false);
    expect(response.message).toBe("Internal Server Error");
  });

  it("should handle unexpected runtime error (catch block)", async () => {
    (ClientModel.create as jest.Mock).mockRejectedValue(
      new Error("Unexpected error")
    );

    const mockHandle = jest.spyOn(
      require("../src/utils/httpHandlers"),
      "handleServiceResponse"
    );

    await ClientController.createClient(req as Request, res as Response);

    expect(mockHandle).toHaveBeenCalled();
    const [response] = mockHandle.mock.calls[0] as any;
    expect(response.success).toBe(false);
    expect(response.message).toBe("Internal Server Error");
  });
});
