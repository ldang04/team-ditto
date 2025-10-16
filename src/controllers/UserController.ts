import { Request, Response } from "express";
import { UserModel } from "../models/UserModel";
import { User } from "../types";

export const UserController = {
  /**
   * List all users for the authenticated client
   * GET /users
   */
  async list(req: Request, res: Response) {
    try {
      const clientId = req.clientId;

      if (!clientId) {
        return res.status(401).json({ error: "Missing client context" });
      }

      const { data, error } = await UserModel.listByClient(clientId);

      if (error) throw error;

      res.status(200).json(data);
    } catch (err: any) {
      res.status(500).json({ error: "Internal Server Error" });
    }
  },

  /**
   * Create a new user for the authenticated client
   * POST /users/create
   */
  async create(req: Request, res: Response) {
    try {
      const clientId = req.clientId;
      if (!clientId) {
        return res.status(401).json({ error: "Missing client context" });
      }

      const { name, email } = req.body;
      if (!name || !email) {
        return res.status(400).json({ error: "Missing name or email" });
      }

      const newUser: User = { name, email, client_id: clientId };

      const { data, error } = await UserModel.create(newUser);

      if (error || !data) throw error;

      res.status(201).json(data);
    } catch (err: any) {
      res.status(500).json({ error: "Internal Server Error" });
    }
  },

  /**
   * Update an existing user
   * PATCH /users/:id
   */
  async update(req: Request, res: Response) {
    try {
      const clientId = req.clientId;
      if (!clientId) {
        return res.status(401).json({ error: "Missing client context" });
      }

      const { id } = req.params;
      const updates: Partial<User> = req.body;

      if (!id) {
        return res.status(400).json({ error: "Missing user id" });
      }

      const { data, error } = await UserModel.update(id, updates);

      if (error) throw error;

      res.status(200).json(data);
    } catch (err: any) {
      res.status(500).json({ error: "Internal Server Error" });
    }
  },
};
