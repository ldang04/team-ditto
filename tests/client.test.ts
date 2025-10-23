import request from "supertest";
import app from "../src/app";
import { resetMockTables } from "../__mocks__/supabase";

describe("Client API", () => {
  beforeAll(() => {
    resetMockTables();
  });

  it("should create a client and return an API key", async () => {
    const res = await request(app)
      .post("/api/clients/create")
      .send({ name: "Test Client Jest" });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("success", true);
    expect(res.body).toHaveProperty("data.client_id");
    expect(res.body).toHaveProperty("message", "Client created successfully");
  });
});
