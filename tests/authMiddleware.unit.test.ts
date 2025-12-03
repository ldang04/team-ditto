/**
 * Equivalence partitions for authMiddleware
 *
 * Inputs considered:
 * - Authorization header
 * - ApiKeyModel.list(prefix) outcomes (error, data, missing id)
 * - bcrypt.compare result (true/false)
 *
 * Partitions and test mapping:
 * 1. Header missing (Invalid)
 *    -> test: "should return 401 if Authorization header is missing"
 * 2. Header present but not 'Bearer ' (Invalid)
 *    -> test: "should return 401 if Authorization header doesn't start with Bearer"
 * 3. 'Bearer ' with empty token (Invalid) - middleware treats as missing (401)
 *    -> test: "should return 401 if Bearer header has an empty token"
 * 4. Multiple spaces after 'Bearer' (Invalid due to split)
 *    -> test: "should return 403 when multiple spaces follow 'Bearer' (split edge)"
 * 5. Token length < 8 (prefix shorter than expected) (Invalid/boundary)
 *    -> test: "should return 403 for token shorter than 8 characters (prefix boundary)"
 * 6. ApiKeyModel.list returns error (Invalid)
 *    -> test: "should return 403 if ApiKeyModel.list returns error"
 * 7. ApiKeyModel.list returns data without id (Invalid)
 *    -> test: "should return 403 if keyRecord has no id"
 * 8. bcrypt.compare => false (Invalid)
 *    -> test: "should return 403 if bcrypt.compare fails"
 * 9. bcrypt.compare => true (Valid)
 *    -> tests: "should call next() when key is valid", "should accept atypical but valid Authorization header (trailing space)"
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

  // Valid input: well-formed Bearer header and matching key
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

  // Atypical valid input: token followed by an extra trailing space
  it("should accept atypical but valid Authorization header (trailing space)", async () => {
    mockList.mockResolvedValueOnce({
      data: { id: "id1", hashed_key: "hash", client_id: "client1" },
      error: null,
    });
    mockCompare.mockResolvedValueOnce(true);
    mockUpdate.mockResolvedValueOnce({ data: {}, error: null });

    const res = await request(app)
      .get("/protected")
      .set("Authorization", "Bearer validkey123 ");

    // Should pass and call next()
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(mockUpdate).toHaveBeenCalled();
  });

  // Invalid input: header present but not using 'Bearer ' scheme
  it("should return 401 if Authorization header doesn't start with Bearer", async () => {
    const res = await request(app)
      .get("/protected")
      .set("Authorization", "Token abc123");

    expect(logger.error).toHaveBeenCalled();
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/Missing API key/i);
  });

  // Invalid input: header uses 'Bearer ' but token is empty
  it("should return 401 if Bearer header has an empty token", async () => {
    mockList.mockResolvedValueOnce({ data: null, error: null });

    const res = await request(app)
      .get("/protected")
      .set("Authorization", "Bearer ");

    expect(logger.error).toHaveBeenCalled();
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/Missing API key/i);
  });

  // Invalid input: token shorter than prefix length (boundary case)
  it("should return 403 for token shorter than 8 characters (prefix boundary)", async () => {
    mockList.mockResolvedValueOnce({ data: null, error: null });

    const res = await request(app)
      .get("/protected")
      .set("Authorization", "Bearer short");

    expect(logger.error).toHaveBeenCalled();
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/Invalid API key/i);
  });

  // Invalid input: 'Bearer   token' leads to empty providedKey when splitting
  it("should return 403 when multiple spaces follow 'Bearer' (split edge)", async () => {
    mockList.mockResolvedValueOnce({ data: null, error: null });

    const res = await request(app)
      .get("/protected")
      .set("Authorization", "Bearer   token");

    expect(logger.error).toHaveBeenCalled();
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/Invalid API key/i);
  });

  // Invalid input: missing Authorization header
  it("should return 401 if Authorization header is missing", async () => {
    const res = await request(app).get("/protected");
    expect(logger.error).toHaveBeenCalled();
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/Missing API key/i);
  });

  // Invalid input: database returned an object without an id
  it("should return 403 if keyRecord has no id", async () => {
    mockList.mockResolvedValueOnce({ data: {}, error: null });
    const res = await request(app)
      .get("/protected")
      .set("Authorization", "Bearer testkey123");
    expect(logger.error).toHaveBeenCalled();
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/Invalid API key/i);
  });

  // Invalid input: provided key does not match stored hash
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

  //Invalid input
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
});
