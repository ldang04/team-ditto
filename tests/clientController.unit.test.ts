/**
 * Equivalence partitions for ClientController.createClient
 *
 * Inputs considered:
 * - `req.body.name` (presence, whitespace-only, padded, very long)
 * - `ClientModel.create` outcomes (success, data=null+error, rejection)
 * - `ApiKeyModel.create` outcomes (success, error)
 * - `bcrypt.hash` (success / unlikely rejection)
 *
 * Partitions (valid/invalid/boundaries) and test mapping:
 * 1. `name` missing (falsy) -> Invalid (400)
 *    -> test: "should return 400 when required fields are missing (name)"
 * 2. `name` present and well-formed (normal) -> Valid
 *    -> test: "should create a client successfully with valid input"
 * 3. `name` padded with whitespace (atypical valid) -> Valid (controller currently accepts)
 *    -> test: "should create a client with atypical but valid input (padded name + extra fields)"
 * 4. `name` whitespace-only (boundary) -> Invalid (trimmed to empty) — controller now rejects
 *    -> test: "should return 400 when name is whitespace-only (boundary)"
 * 5. Very long `name` (above expected limits) -> Not validated by controller (would be accepted)
 *    -> no dedicated test (consider adding if you enforce length limits)
 *
 */

import { Request, Response } from "express";
import { ClientController } from "../src/controllers/ClientController";
import { ClientModel } from "../src/models/ClientModel";
import { ApiKeyModel } from "../src/models/ApiKeyModel";
import bcrypt from "bcrypt";
import logger from "../src/config/logger";

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
    jest.spyOn(logger, "info").mockImplementation();
    jest.spyOn(logger, "error").mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // Valid input: required `name` present and ClientModel / ApiKeyModel succeed
  it("should create a client successfully with valid input", async () => {
    (ClientModel.create as jest.Mock).mockResolvedValue({
      data: { id: "mock-client-1" },
      error: null,
    });

    (bcrypt.hash as jest.Mock).mockResolvedValue("hashed-key");

    (ApiKeyModel.create as jest.Mock).mockResolvedValue({
      data: {},
      error: null,
    });

    const mockHandle = jest.spyOn(
      require("../src/utils/httpHandlers"),
      "handleServiceResponse"
    );

    await ClientController.createClient(req as Request, res as Response);

    expect(mockHandle).toHaveBeenCalled();
    const [response] = mockHandle.mock.calls[0] as any;
    expect(response.success).toBe(true);
    expect(response.message).toBe("Client created successfully");
  });

  // Atypical valid input: name has leading/trailing whitespace and extra fields
  it("should create a client with atypical but valid input (padded name + extra fields)", async () => {
    req = { body: { name: "  Padded Name  ", extra: "field" } };

    (ClientModel.create as jest.Mock).mockResolvedValue({
      data: { id: "mock-client-2" },
      error: null,
    });

    (bcrypt.hash as jest.Mock).mockResolvedValue("hashed-key-2");

    (ApiKeyModel.create as jest.Mock).mockResolvedValue({
      data: {},
      error: null,
    });

    const mockHandle = jest.spyOn(
      require("../src/utils/httpHandlers"),
      "handleServiceResponse"
    );

    await ClientController.createClient(req as Request, res as Response);

    expect(mockHandle).toHaveBeenCalled();
    const [response] = mockHandle.mock.calls[0] as any;
    expect(response.success).toBe(true);
    expect(response.message).toBe("Client created successfully");
  });

  // Invalid (boundary): name is whitespace-only -> trimmed to empty -> 400
  it("should return 400 when name is whitespace-only (boundary)", async () => {
    req = { body: { name: "   " } };

    const mockHandle = jest.spyOn(
      require("../src/utils/httpHandlers"),
      "handleServiceResponse"
    );

    await ClientController.createClient(req as Request, res as Response);

    expect(mockHandle).toHaveBeenCalled();
    const [serviceResponse] = mockHandle.mock.calls[0] as any;
    expect(serviceResponse.success).toBe(false);
    expect(serviceResponse.statusCode).toBe(400);
    expect(ClientModel.create).not.toHaveBeenCalled();
    expect(ApiKeyModel.create).not.toHaveBeenCalled();
  });

  // Invalid input: model creation fails (server-side error)
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

    expect(logger.error).toHaveBeenCalled();

    expect(mockHandle).toHaveBeenCalled();
    const [response] = mockHandle.mock.calls[0] as any;
    expect(response.success).toBe(false);
    expect(response.message).toBe("Internal Server Error");
  });

  // Invalid input: api key creation fails after client created
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

    expect(logger.error).toHaveBeenCalled();

    expect(mockHandle).toHaveBeenCalled();
    const [response] = mockHandle.mock.calls[0] as any;
    expect(response.success).toBe(false);
    expect(response.message).toBe("Internal Server Error");
  });

  // Invalid input: unexpected runtime rejection
  it("should handle unexpected runtime error (catch block)", async () => {
    (ClientModel.create as jest.Mock).mockRejectedValue(
      new Error("Unexpected error")
    );

    const mockHandle = jest.spyOn(
      require("../src/utils/httpHandlers"),
      "handleServiceResponse"
    );

    await ClientController.createClient(req as Request, res as Response);

    expect(logger.error).toHaveBeenCalled();

    expect(mockHandle).toHaveBeenCalled();
    const [response] = mockHandle.mock.calls[0] as any;
    expect(response.success).toBe(false);
    expect(response.message).toBe("Internal Server Error");
  });

  // Invalid input: missing required field `name`
  it("should return 400 when required fields are missing (name)", async () => {
    req = { body: {} };

    const mockHandle = jest.spyOn(
      require("../src/utils/httpHandlers"),
      "handleServiceResponse"
    );

    await ClientController.createClient(req as Request, res as Response);

    expect(logger.error).not.toHaveBeenCalled();
    expect(mockHandle).toHaveBeenCalled();
    const [response] = mockHandle.mock.calls[0] as any;
    expect(response.success).toBe(false);
    expect(response.statusCode).toBe(400);
    expect(response.message).toBe("Missing required fields");
  });
});
