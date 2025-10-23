import { StatusCodes } from "http-status-codes";

export class ServiceResponse<T = null> {
  readonly success: boolean;
  readonly message: string;
  readonly statusCode: number;
  readonly data?: T;

  private constructor(
    success: boolean,
    message: string,
    statusCode: number,
    data?: T
  ) {
    this.success = success;
    this.message = message;
    this.data = data;
    this.statusCode = statusCode;
  }

  static success<T>(
    data: T,
    message: string,
    statusCode: number = StatusCodes.OK
  ) {
    return new ServiceResponse(true, message, statusCode, data);
  }

  static failure<T>(
    data?: T,
    message: string = "Internal Server Error",
    statusCode: number = StatusCodes.INTERNAL_SERVER_ERROR
  ) {
    return new ServiceResponse(false, message, statusCode, data);
  }
}
