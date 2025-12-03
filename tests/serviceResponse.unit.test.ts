/**
 * Equivalence partitions for `ServiceResponse` factory methods
 *
 * Partitions (for `message` and `statusCode`):
 * - M1: message present, non-empty -> Valid
 * - M2: message empty string ('') -> Atypical valid
 *
 * - C1: statusCode omitted -> Default used (200 for success, 500 for failure)
 * - C2: statusCode normal (e.g., 200, 201) -> Valid
 * - C3: statusCode boundary/atypical (0, negative, >65535) -> Atypical
 */

import { ServiceResponse } from "../src/types/serviceResponse";
import { StatusCodes } from "http-status-codes";

describe("ServiceResponse", () => {
  // Valid: success with data and normal message (M1, C1)
  it("should create a success response with defaults", () => {
    const data = { id: 1, name: "Test" };
    const response = ServiceResponse.success(data, "OK");

    expect(response.success).toBe(true);
    expect(response.message).toBe("OK");
    expect(response.statusCode).toBe(StatusCodes.OK);
    expect(response.data).toEqual(data);
  });

  // Valid: success with explicit custom status code (M1, C2)
  it("should create a success response with custom status code", () => {
    const response = ServiceResponse.success(
      "done",
      "Created",
      StatusCodes.CREATED
    );

    expect(response.statusCode).toBe(StatusCodes.CREATED);
    expect(response.success).toBe(true);
    expect(response.message).toBe("Created");
    expect(response.data).toBe("done");
  });

  // Atypical: success with empty message (M2, C1)
  it("should allow success response with empty message (atypical)", () => {
    const response = ServiceResponse.success({ ok: true }, "");

    expect(response.success).toBe(true);
    expect(response.message).toBe("");
    expect(response.statusCode).toBe(StatusCodes.OK);
  });

  // Atypical: success with statusCode 0 (boundary/atypical C3)
  it("should accept atypical statusCode 0 for success", () => {
    const response = ServiceResponse.success(null, "Zero", 0);
    expect(response.success).toBe(true);
    expect(response.statusCode).toBe(0);
  });

  // Valid: failure with defaults (no args) -> default message/code (M1 implicit, C1)
  it("should create a failure response with default message and code", () => {
    const response = ServiceResponse.failure();

    expect(response.success).toBe(false);
    expect(response.message).toBe("Internal Server Error");
    expect(response.statusCode).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
    expect(response.data).toBeUndefined();
  });

  // Valid: failure with custom message and code (M1, C2)
  it("should create a failure response with custom message and code", () => {
    const response = ServiceResponse.failure(
      "error-data",
      "Bad Request",
      StatusCodes.BAD_REQUEST
    );

    expect(response.success).toBe(false);
    expect(response.message).toBe("Bad Request");
    expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
    expect(response.data).toBe("error-data");
  });

  // Atypical: failure with empty message (M2, C1)
  it("should allow failure response with empty message (atypical)", () => {
    const response = ServiceResponse.failure(undefined, "");
    expect(response.success).toBe(false);
    expect(response.message).toBe("");
    expect(response.statusCode).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
  });

  // Atypical: failure with very large status code (C3)
  it("should accept large atypical status code for failure", () => {
    const response = ServiceResponse.failure(undefined, "Large", 70000);
    expect(response.success).toBe(false);
    expect(response.statusCode).toBe(70000);
  });
});
