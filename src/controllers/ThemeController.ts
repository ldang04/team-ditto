/**
 * controllers/ThemeController.ts
 *
 * Controller responsible for managing theme-related operations.
 * Handles creation and retrieval of theme records associated
 * with clients. Themes define visual and behavioral customization
 * options for client projects.
 *
 */
import { Request, Response } from "express";
import { ThemeModel } from "../models/ThemeModel";
import { ServiceResponse } from "../types/serviceResponse";
import { StatusCodes } from "http-status-codes";
import { handleServiceResponse } from "../utils/httpHandlers";
import logger from "../config/logger";
import { ThemeAnalysisService } from "../services/ThemeAnalysisService";

export const ThemeController = {
  /**
   * Create a new theme for a client and update with analysis.
   *
   * @param req - Express Request containing theme information and authenticated clientId
   * @param res - Express Response used to send back the result
   *
   * @returns {Object} 201 - JSON object containing the created theme details
   * @throws {400} If required fields (name) are missing
   * @throws {500} If an unexpected server error occurs
   */
  async create(req: Request, res: Response) {
    try {
      logger.info(`${req.method} ${req.url} ${req.body} `);
      let serviceResponse;
      const { name } = req.body;
      const client_id = req.clientId;

      if (!name) {
        serviceResponse = ServiceResponse.failure(
          null,
          "Missing required fields",
          StatusCodes.BAD_REQUEST
        );
        return handleServiceResponse(serviceResponse, res);
      }

      const { data, error } = await ThemeModel.create({
        ...req.body,
        client_id,
      });

      if (error || !data) throw error;

      const analysis = ThemeAnalysisService.analyzeTheme(data);
      const { data: themeWithAnalytic } = await ThemeModel.updateAnalysis(
        data.id!,
        analysis
      ).catch((error) => logger.error("Error in saving theme analysis", error));

      serviceResponse = ServiceResponse.success(
        themeWithAnalytic || data,
        "Theme created successfully",
        StatusCodes.CREATED
      );
      return handleServiceResponse(serviceResponse, res);
    } catch (err: any) {
      logger.error("Error in ThemeController.create:", err);
      const serviceResponse = ServiceResponse.failure(err);
      return handleServiceResponse(serviceResponse, res);
    }
  },

  /**
   * List all themes belonging to the authenticated client.
   *
   * @param req - Express Request with authenticated clientId
   * @param res - Express Response used to send back the result
   *
   * @returns {Object} 200 - JSON array of themes belonging to the client
   * @throws {401} If client is not authenticated
   * @throws {500} If an unexpected server error occurs
   */
  async listByClient(req: Request, res: Response) {
    try {
      logger.info(`${req.method} ${req.url} ${req.body} `);
      let serviceResponse;
      const client_id = req.clientId;

      if (!client_id) {
        serviceResponse = ServiceResponse.failure(
          null,
          "Unauthorized",
          StatusCodes.UNAUTHORIZED
        );
        return handleServiceResponse(serviceResponse, res);
      }

      const { data, error } = await ThemeModel.listByClient(client_id);

      if (error) throw error;

      serviceResponse = ServiceResponse.success(
        data,
        "Retrieved themes",
        StatusCodes.OK
      );
      return handleServiceResponse(serviceResponse, res);
    } catch (err: any) {
      logger.error("Error in ThemeController.listByClient:", err);
      const serviceResponse = ServiceResponse.failure(err);
      return handleServiceResponse(serviceResponse, res);
    }
  },
};
