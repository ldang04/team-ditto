import { Request, Response } from "express";
import { ContentModel } from "../models/ContentModel";
import { Content } from "../types";

export const ContentController = {
  /**
   * List all content for a given project.
   * GET /contents/:project_id
   */
  async list(req: Request, res: Response) {
    try {
      const { project_id } = req.params;
      if (!project_id) {
        return res.status(400).json({ error: "Missing project_id" });
      }

      const { data, error } = await ContentModel.listByProject(project_id);

      if (error) throw error;

      res.status(200).json(data);
    } catch (err: any) {
      res.status(500).json({ error: "Internal Server Error" });
    }
  },

  /**
   * Create a new content record.
   * POST /contents/create
   */
  async create(req: Request, res: Response) {
    try {
      const content: Content = req.body;

      if (!content.project_id) {
        return res
          .status(400)
          .json({ error: "Missing project_id in content body" });
      }

      const { data, error } = await ContentModel.create(content);

      if (error || !data) throw error;

      res.status(201).json(data);
    } catch (err: any) {
      res.status(500).json({ error: "Internal Server Error" });
    }
  },
};
