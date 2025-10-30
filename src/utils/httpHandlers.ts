import type { Response } from "express";

import { ServiceResponse } from "../types/serviceResponse";
import logger from "../config/logger";

export const handleServiceResponse = (
  serviceResponse: ServiceResponse<any>,
  response: Response
): void => {
  try {
    response.status(serviceResponse.statusCode).send(serviceResponse);
  } catch (error) {
    logger.error("Error sending response:", error);
    response.status(500).send({ message: "Internal Server Error" });
  }
};
