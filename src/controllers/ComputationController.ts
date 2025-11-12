/**
 * controllers/ComputationController.ts
 *
 * @deprecated This controller is maintained for backward compatibility only.
 * Use the new endpoints instead:
 * - POST /api/text/generate for text generation
 * - POST /api/images/generate for image generation
 * - POST /api/validate for content validation
 */

import { Request, Response } from "express";
import { VertexAI } from "@google-cloud/vertexai";
import { TextGenerationController } from "./TextGenerationController";
import { ImageGenerationController } from "./ImageGenerationController";
import { ValidationController } from "./ValidationController";
import { ServiceResponse } from "../types/serviceResponse";
import { StatusCodes } from "http-status-codes";
import { handleServiceResponse } from "../utils/httpHandlers";
import logger from "../config/logger";

export const ComputationController = {
  /**
   * @deprecated Use POST /api/text/generate or POST /api/images/generate instead
   * Main generate endpoint - routes to text or image generation
   */
  async generate(req: Request, res: Response) {
    try {
      logger.warn(
        "DEPRECATED: /api/generate is deprecated. Use /api/text/generate or /api/images/generate instead."
      );

      const { media_type = "text" } = req.body;

      // Route to appropriate controller
      if (media_type === "image") {
        return await ImageGenerationController.generate(req, res);
      } else {
        return await TextGenerationController.generate(req, res);
      }
    } catch (error: any) {
      logger.error("Error in ComputationController.generate:", error);
      const serviceResponse = ServiceResponse.failure(error);
      return handleServiceResponse(serviceResponse, res);
    }
  },

  /**
   * @deprecated Use POST /api/validate instead
   * Validate content against brand guidelines
   */
  async validate(req: Request, res: Response) {
    logger.warn("DEPRECATED: /api/validate endpoint called via ComputationController");
    return ValidationController.validate(req, res);
  },

  /**
   * Test Vertex AI connection
   */
  async testVertex(req: Request, res: Response) {
    try {
      logger.info(`${req.method} ${req.url}`, req.body);

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
      logger.error("Error in ComputationController.testVertex:", error);
      const serviceResponse = ServiceResponse.failure(
        error,
        "Vertex test failed"
      );
      return handleServiceResponse(serviceResponse, res);
    }
  },
};

