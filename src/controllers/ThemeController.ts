import { Request, Response } from "express";
import { ThemeModel } from "../models/ThemeModel";

export const ThemeController = {
  /**
   * Create a new theme
   * POST /themes/create
   */
  async create(req: Request, res: Response) {
    try {
      const { user_id, name } = req.body;

      if (!user_id || !name) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const { data, error } = await ThemeModel.create(req.body);

      if (error || !data) throw error;

      res.status(201).json(data);
    } catch (err: any) {
      res.status(500).json({ error: "Internal Server Error" });
    }
  },

  /**
   * List all themes for a given user
   * GET /themes/:user_id
   */
  async listByUser(req: Request, res: Response) {
    try {
      const { user_id } = req.params;

      if (!user_id) {
        return res.status(400).json({ error: "Missing user_id" });
      }

      const { data, error } = await ThemeModel.listByUser(user_id);

      if (error) throw error;

      res.status(200).json(data);
    } catch (err: any) {
      res.status(500).json({ error: "Internal Server Error" });
    }
  },
};
