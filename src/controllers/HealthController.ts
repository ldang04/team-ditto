/**
 * controllers/HealthController.ts
 *
 * Health check and diagnostic endpoints.
 */

import { Request, Response } from "express";
import { VertexAI } from "@google-cloud/vertexai";
import { ServiceResponse } from "../types/serviceResponse";
import { StatusCodes } from "http-status-codes";
import { handleServiceResponse } from "../utils/httpHandlers";
import logger from "../config/logger";

export const HealthController = {
  /**
   * Test Vertex AI connection
   */
  async testVertex(req: Request, res: Response) {
    try {
      logger.info(`${req.method} ${req.url} ${JSON.stringify(req.body)} `);

      if (!process.env.GCP_PROJECT_ID) {
        const serviceResponse = ServiceResponse.failure(
          {
            env_keys: Object.keys(process.env).filter(
              (k) => k.includes("GCP") || k.includes("GOOGLE")
            ),
          },
          "GCP_PROJECT_ID not set",
          StatusCodes.INTERNAL_SERVER_ERROR
        );
        return handleServiceResponse(serviceResponse, res);
      }

      const vertex = new VertexAI({
        project: process.env.GCP_PROJECT_ID,
        location: "us-central1",
      });

      const model = vertex.getGenerativeModel({
        model: process.env.VERTEX_MODEL_TEXT || "gemini-2.5-flash-lite",
      });

      const result = await model.generateContent({
        contents: [
          { role: "user", parts: [{ text: "Say hi from Vertex AI!" }] },
        ],
      });

      const response =
        result.response.candidates?.[0]?.content?.parts?.[0]?.text ||
        "No response generated";

      const serviceResponse = ServiceResponse.success(
        response,
        "Vertex AI test successful",
        StatusCodes.OK
      );
      return handleServiceResponse(serviceResponse, res);
    } catch (error: any) {
      logger.error("Error in HealthController.testVertex:", error);
      const serviceResponse = ServiceResponse.failure(
        error,
        "Vertex test failed"
      );
      return handleServiceResponse(serviceResponse, res);
    }
  },
};
