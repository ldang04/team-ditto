/**
 * tests/authMiddleware.test.ts
 *
 * Full coverage for middleware/auth.ts
 */
import request from "supertest";
import express from "express";
import { authMiddleware } from "../src/middleware/auth";
import { ApiKeyModel } from "../src/models/ApiKeyModel";
import bcrypt from "bcrypt";
import logger from "../src/config/logger";

const app = express();
app.use(express.json());
app.get("/protected", authMiddleware, (_req, res) => res.json({ ok: true }));

jest.mock("../src/models/ApiKeyModel");
jest.mock("bcrypt");

const mockList = ApiKeyModel.list as jest.Mock;
const mockUpdate = ApiKeyModel.update as jest.Mock;
const mockCompare = bcrypt.compare as jest.Mock;

describe("authMiddleware", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(logger, "info").mockImplementation();
    jest.spyOn(logger, "error").mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should return 401 if Authorization header is missing", async () => {
    const res = await request(app).get("/protected");
    expect(logger.error).toHaveBeenCalled();
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/Missing API key/i);
  });

  it("should return 403 if keyRecord has no id", async () => {
    mockList.mockResolvedValueOnce({ data: {}, error: null });
    const res = await request(app)
      .get("/protected")
      .set("Authorization", "Bearer testkey123");
    expect(logger.error).toHaveBeenCalled();
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/Invalid API key/i);
  });

  it("should return 403 if ApiKeyModel.list returns error", async () => {
    mockList.mockResolvedValueOnce({
      data: null,
      error: { message: "db err" },
    });
    const res = await request(app)
      .get("/protected")
      .set("Authorization", "Bearer testkey123");
    expect(logger.error).toHaveBeenCalled();
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/Invalid API key/i);
  });

  it("should return 403 if bcrypt.compare fails", async () => {
    mockList.mockResolvedValueOnce({
      data: { id: "id1", hashed_key: "hash", client_id: "client1" },
      error: null,
    });
    mockCompare.mockResolvedValueOnce(false);

    const res = await request(app)
      .get("/protected")
      .set("Authorization", "Bearer testkey123");

    expect(logger.error).toHaveBeenCalled();
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/Invalid API key/i);
  });

  it("should call next() when key is valid", async () => {
    mockList.mockResolvedValueOnce({
      data: { id: "id1", hashed_key: "hash", client_id: "client1" },
      error: null,
    });
    mockCompare.mockResolvedValueOnce(true);
    mockUpdate.mockResolvedValueOnce({ data: {}, error: null });

    const res = await request(app)
      .get("/protected")
      .set("Authorization", "Bearer validkey123");

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(mockUpdate).toHaveBeenCalled();
  });
});
