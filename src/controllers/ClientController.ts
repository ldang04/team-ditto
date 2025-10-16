import { Request, Response } from "express";
import bcrypt from "bcrypt";
import { generateApiKey } from "../utils";
import { ClientModel } from "../models/ClientModel";
import { ApiKeyModel } from "../models/ApiKeyModel";

export const ClientController = {
  /**
   * Create a new client and generate API key
   * POST /clients/create
   */
  async createClient(req: Request, res: Response) {
    try {
      const { data: client, error } = await ClientModel.create(req.body);

      if (error || !client) throw error;

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
      res.status(201).json({
        message: "Client created successfully",
        client_id: client.id,
        api_key: key,
      });
    } catch (err: any) {
      res.status(500).json({ error: "Internal Server Error" });
    }
  },
};
