/**
 * controllers/ContentController.ts
 *
 * Controller responsible for handling content-related API requests.
 * Provides endpoints for retrieving generated contents
 * linked to specific projects.
 *
 */
import { Request, Response } from "express";
import { ContentModel } from "../models/ContentModel";
import { ServiceResponse } from "../types/serviceResponse";
import { StatusCodes } from "http-status-codes";
import { handleServiceResponse } from "../utils/httpHandlers";

export const ContentController = {
  /**
   * Retrieve all content records for a given project.
   *
   * @param req - Express Request containing `project_id` in params.
   * @param res - Express Response used to send the result.
   *
   * @returns JSON response containing an array of content objects or an error message.
   * @returns {Object} 200 - JSON response containing an array of content objects.
   * @throws {400} If missing project_id.
   * @throws {500} If an unexpected server error occurs.
   *
   */
  async list(req: Request, res: Response) {
    try {
      let serviceResponse;
      const { project_id } = req.params;
      if (!project_id) {
        serviceResponse = ServiceResponse.failure(
          null,
          "Missing project_id",
          StatusCodes.BAD_REQUEST
        );
        return handleServiceResponse(serviceResponse, res);
      }

      const { data, error } = await ContentModel.listByProject(project_id);

      if (error) throw error;

      serviceResponse = ServiceResponse.success(
        data,
        "Retrieved contents",
        StatusCodes.OK
      );
      return handleServiceResponse(serviceResponse, res);
    } catch (err: any) {
      console.log(err);
      const serviceResponse = ServiceResponse.failure(err);
      return handleServiceResponse(serviceResponse, res);
    }
  },
};
