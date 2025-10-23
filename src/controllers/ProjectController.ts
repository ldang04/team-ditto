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
      const { name } = req.body;
      const client_id = req.clientId; // From auth middleware

      if (!name) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const { data, error } = await ProjectModel.create({
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
   * List all projects for the authenticated client
   * GET /projects
   */
  async listByClient(req: Request, res: Response) {
    try {
      const client_id = req.clientId; // From auth middleware

      if (!client_id) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { data, error } = await ProjectModel.listByClient(client_id);

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
