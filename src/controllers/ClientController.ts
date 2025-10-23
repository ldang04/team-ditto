/**
 * controllers/ClientController.ts
 *
 * Controller responsible for handling client-related requests,
 * including client registration and API key generation.
 *
 */
import { Request, Response } from "express";
import bcrypt from "bcrypt";
import { generateApiKey } from "../utils";
import { ClientModel } from "../models/ClientModel";
import { ApiKeyModel } from "../models/ApiKeyModel";
import { ServiceResponse } from "../types/serviceResponse";
import { StatusCodes } from "http-status-codes";
import { handleServiceResponse } from "../utils/httpHandlers";

export const ClientController = {
  /**
   * Create a new client and issue an associated API key.
   *
   * @param req - Express Request containing client information.
   * @param res - Express Response used to send back the result.
   *
   * @returns {Object} 201 - JSON object containing the created client ID and the generated API key.
   * @throws {500} If an unexpected server error occurs.
   *
   */
  async createClient(req: Request, res: Response) {
    try {
      console.log("POST /clients/create", req.body);
      const { data: client, error: clientError } = await ClientModel.create(
        req.body
      );

      if (clientError || !client) throw clientError;

      // Generate API key
      const { key, prefix } = generateApiKey();
      const hashedKey = await bcrypt.hash(key, 10);

      // Save API key in api_keys table
      const { error: keyErr } = await ApiKeyModel.create({
        client_id: client.id,
        prefix,
        hashed_key: hashedKey,
      });

      if (keyErr) throw keyErr;

      // Return API key once
      const serviceResponse = ServiceResponse.success(
        { client_id: client.id, api_key: key },
        "Client created successfully",
        StatusCodes.CREATED
      );
      return handleServiceResponse(serviceResponse, res);
    } catch (err: any) {
      console.error("Error in ClientController.createClient:", err);
      const serviceResponse = ServiceResponse.failure(err);
      return handleServiceResponse(serviceResponse, res);
    }
  },
};
