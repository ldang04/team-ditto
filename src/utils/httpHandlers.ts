import type { Response } from "express";

import { ServiceResponse } from "../types/serviceResponse";

export const handleServiceResponse = (
  serviceResponse: ServiceResponse<any>,
  response: Response
): void => {
  try {
    response.status(serviceResponse.statusCode).send(serviceResponse);
  } catch (error) {
    console.error("Error sending response:", error);
    response.status(500).send({ message: "Internal Server Error" });
  }
};
