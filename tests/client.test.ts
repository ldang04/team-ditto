import request from "supertest";
import app from "../src/app";
import { resetMockTables } from "../__mocks__/supabase";

describe("Client API", () => {
  beforeAll(() => {
    resetMockTables();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should create a client and return an API key", async () => {
    const res = await request(app)
      .post("/api/clients/create")
      .send({ name: "Test Client Jest" });

    expect(console.log).toHaveBeenCalled();

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("success", true);
    expect(res.body).toHaveProperty("data.client_id");
    expect(res.body).toHaveProperty("message", "Client created successfully");
  });

  it("should handle atypical valid input (short name)", async () => {
    const res = await request(app)
      .post("/api/clients/create")
      .send({ name: "A" });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  it("should return 400 for missing client name", async () => {
    const res = await request(app).post("/api/clients/create").send({});
    expect(res.status).toBe(400);
  });
});
