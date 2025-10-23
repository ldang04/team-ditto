/**
 * controllers/ProjectController.ts
 *
 * Controller responsible for managing project-related operations.
 * Handles creation, retrieval, and updates of project records associated
 * with clients and users.
 *
 */
import { Request, Response } from "express";
import { ProjectModel } from "../models/ProjectModel";
import { Project } from "../types";
import { ServiceResponse } from "../types/serviceResponse";
import { StatusCodes } from "http-status-codes";
import { handleServiceResponse } from "../utils/httpHandlers";

export const ProjectController = {
  /**
   * Create a new project for a client.
   *
   * @param req - Express Request containing project information and authenticated clientId
   * @param res - Express Response used to send back the result
   *
   * @returns {Object} 201 - JSON object containing the created project details
   * @throws {400} If required fields are missing
   * @throws {500} If an unexpected server error occurs
   */
  async create(req: Request, res: Response) {
    try {
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

      const { data, error } = await ProjectModel.create({
        ...req.body,
        client_id,
      });

      if (error || !data) throw error;

      serviceResponse = ServiceResponse.success(
        data,
        "Project created successfully",
        StatusCodes.CREATED
      );
      return handleServiceResponse(serviceResponse, res);
    } catch (err: any) {
      const serviceResponse = ServiceResponse.failure(err);
      return handleServiceResponse(serviceResponse, res);
    }
  },

  /**
   * List all projects belonging to the authenticated client.
   *
   * @param req - Express Request with authenticated clientId
   * @param res - Express Response used to send back the result
   *
   * @returns {Object} 200 - JSON array of projects belonging to the client
   * @throws {401} If client is not authenticated
   * @throws {500} If an unexpected server error occurs
   */
  async listByClient(req: Request, res: Response) {
    try {
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

      const { data, error } = await ProjectModel.listByClient(client_id);

      if (error) throw error;

      serviceResponse = ServiceResponse.success(
        data,
        "Retrieved projects",
        StatusCodes.OK
      );
      return handleServiceResponse(serviceResponse, res);
    } catch (err: any) {
      const serviceResponse = ServiceResponse.failure(err);
      return handleServiceResponse(serviceResponse, res);
    }
  },

  /**
   * Update an existing project by ID.
   *
   * @param req - Express Request containing project updates and project ID in params
   * @param res - Express Response used to send back the result
   *
   * @returns {Object} 200 - JSON object containing the updated project
   * @throws {400} If project ID is missing
   * @throws {500} If an unexpected server error occurs
   */
  async update(req: Request, res: Response) {
    try {
      let serviceResponse;
      const { id } = req.params;
      const updates: Partial<Project> = req.body;

      if (!id) {
        serviceResponse = ServiceResponse.failure(
          null,
          "Missing project id",
          StatusCodes.BAD_REQUEST
        );
        return handleServiceResponse(serviceResponse, res);
      }

      const { data, error } = await ProjectModel.update(id, updates);

      if (error) throw error;

      serviceResponse = ServiceResponse.success(
        data,
        "Updated project successfully",
        StatusCodes.OK
      );
      return handleServiceResponse(serviceResponse, res);
    } catch (err: any) {
      const serviceResponse = ServiceResponse.failure(err);
      return handleServiceResponse(serviceResponse, res);
    }
  },
};
