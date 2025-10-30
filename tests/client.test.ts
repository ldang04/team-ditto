import request from "supertest";
import app from "../src/app";
import { resetMockTables } from "../__mocks__/supabase";
import logger from "../src/config/logger";

describe("Client API", () => {
  beforeAll(() => {
    resetMockTables();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(logger, "info").mockImplementation();
    jest.spyOn(logger, "error").mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should create a client and return an API key", async () => {
    const res = await request(app)
      .post("/api/clients/create")
      .send({ name: "Test Client Jest" });

    expect(logger.info).toHaveBeenCalled();

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("success", true);
    expect(res.body).toHaveProperty("data.client_id");
    expect(res.body).toHaveProperty("message", "Client created successfully");
  });

  it("should handle atypical valid input (short name)", async () => {
    const res = await request(app)
      .post("/api/clients/create")
      .send({ name: "A" });

    expect(logger.info).toHaveBeenCalled();
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  it("should return 400 for missing client name", async () => {
    const res = await request(app).post("/api/clients/create").send({});
    expect(logger.info).toHaveBeenCalled();
    expect(res.status).toBe(400);
  });
});
