import { Request, Response } from "express";
import { ProjectModel } from "../models/ProjectModel";
import { Project } from "../types";

export const ProjectController = {
  /**
   * Create a new project
   * POST /projects/create
   */
  async create(req: Request, res: Response) {
    try {
      const { user_id, name } = req.body;

      if (!user_id || !name) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const { data, error } = await ProjectModel.create(req.body);

      if (error || !data) throw error;

      res.status(201).json(data);
    } catch (err: any) {
      res.status(500).json({ error: "Internal Server Error" });
    }
  },

  /**
   * List all projects for a given user
   * GET /projects/:user_id
   */
  async listByUser(req: Request, res: Response) {
    try {
      const { user_id } = req.params;

      if (!user_id) {
        return res.status(400).json({ error: "Missing user_id" });
      }

      const { data, error } = await ProjectModel.listByUser(user_id);

      if (error) throw error;

      res.status(200).json(data);
    } catch (err: any) {
      res.status(500).json({ error: "Internal Server Error" });
    }
  },

  /**
   * Update an existing project
   * PATCH /projects/:id
   */
  async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const updates: Partial<Project> = req.body;

      if (!id) {
        return res.status(400).json({ error: "Missing project id" });
      }

      const { data, error } = await ProjectModel.update(id, updates);

      if (error) throw error;

      res.status(200).json(data);
    } catch (err: any) {
      res.status(500).json({ error: "Internal Server Error" });
    }
  },
};
