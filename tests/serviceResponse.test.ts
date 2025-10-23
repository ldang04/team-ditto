import { ServiceResponse } from "../src/types/serviceResponse";
import { StatusCodes } from "http-status-codes";

describe("ServiceResponse", () => {
  it("should create a success response with defaults", () => {
    const data = { id: 1, name: "Test" };
    const response = ServiceResponse.success(data, "OK");

    expect(response.success).toBe(true);
    expect(response.message).toBe("OK");
    expect(response.statusCode).toBe(StatusCodes.OK);
    expect(response.data).toEqual(data);
  });

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

  it("should create a failure response with default message and code", () => {
    const response = ServiceResponse.failure();

    expect(response.success).toBe(false);
    expect(response.message).toBe("Internal Server Error");
    expect(response.statusCode).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
    expect(response.data).toBeUndefined();
  });

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
});
