/**
 * controllers/ComputationController.ts
 * 
 * Main computation controller - thin routing layer.
 */

import { Request, Response } from "express";
import { VertexAI } from "@google-cloud/vertexai";
import { ProjectModel } from "../models/ProjectModel";
import { ThemeModel } from "../models/ThemeModel";
import { TextGenerationController } from "./TextGenerationController";
import { ImageGenerationController } from "./ImageGenerationController";
import { ValidationController } from "./ValidationController";
import { ServiceResponse } from "../types/serviceResponse";
import { StatusCodes } from "http-status-codes";
import { handleServiceResponse } from "../utils/httpHandlers";
import logger from "../config/logger";

export const ComputationController = {
  /**
   * Main generate endpoint - routes to text or image generation
   */
  async generate(req: Request, res: Response) {
    try {
      logger.info(`${req.method} ${req.url} ${req.body}`);
      const {
        project_id,
        prompt,
        media_type = "text",
        style_preferences = {},
        target_audience = "general",
        variantCount = 3,
        aspectRatio = "1:1",
      } = req.body;

      // Validation
      if (!project_id || !prompt) {
        const serviceResponse = ServiceResponse.failure(
          null,
          "Missing required fields: project_id and prompt",
          StatusCodes.BAD_REQUEST
        );
        return handleServiceResponse(serviceResponse, res);
      }

      // Fetch project and theme
      const { project, theme } = await this.getProjectAndTheme(project_id);

      if (!project || !theme) {
        const serviceResponse = ServiceResponse.failure(
          null,
          !project ? "Project not found" : "Theme not found",
          StatusCodes.NOT_FOUND
        );
        return handleServiceResponse(serviceResponse, res);
      }

      // Route to appropriate controller
      if (media_type === "image") {
        return await ImageGenerationController.generate(
          req,
          res,
          project,
          theme,
          prompt,
          style_preferences,
          target_audience,
          variantCount,
          aspectRatio
        );
      } else {
        return await TextGenerationController.generate(
          req,
          res,
          project,
          theme,
          prompt,
          style_preferences,
          target_audience,
          variantCount,
          media_type
        );
      }
    } catch (error: any) {
      logger.error("Error in ComputationController.generate:", error);
      const serviceResponse = ServiceResponse.failure(error);
      return handleServiceResponse(serviceResponse, res);
    }
  },

  /**
   * Validate content against brand guidelines
   */
  async validate(req: Request, res: Response) {
    return ValidationController.validate(req, res);
  },

  /**
   * Test Vertex AI connection
   */
  async testVertex(req: Request, res: Response) {
    try {
      logger.info(`${req.method} ${req.url} ${req.body}`);

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

  /**
   * Helper: Get project and theme data
   */
  async getProjectAndTheme(project_id: string) {
    const { data: project, error: projectError } = await ProjectModel.getById(
      project_id
    );
    if (projectError || !project) {
      return { project: null, theme: null };
    }

    const { data: theme, error: themeError } = await ThemeModel.getById(
      project.theme_id
    );
    if (themeError || !theme) {
      return { project, theme: null };
    }

    return { project, theme };
  },
};

