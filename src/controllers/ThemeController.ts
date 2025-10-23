import { Request, Response } from "express";
import { ThemeModel } from "../models/ThemeModel";

export const ThemeController = {
  /**
   * Create a new theme
   * POST /themes/create
   */
  async create(req: Request, res: Response) {
    try {
      const { name } = req.body;
      const client_id = req.clientId; // From auth middleware

      if (!name) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const { data, error } = await ThemeModel.create({
        ...req.body,
        client_id
      });

      if (error || !data) throw error;

      res.status(201).json(data);
    } catch (err: any) {
      res.status(500).json({ error: "Internal Server Error" });
    }
  },

  /**
   * List all themes for the authenticated client
   * GET /themes
   */
  async listByClient(req: Request, res: Response) {
    try {
      const client_id = req.clientId; // From auth middleware

      if (!client_id) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { data, error } = await ThemeModel.listByClient(client_id);

      if (error) throw error;

      res.status(200).json(data);
    } catch (err: any) {
      res.status(500).json({ error: "Internal Server Error" });
    }
  },
};
