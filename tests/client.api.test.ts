/**
 * Client API — Internal Integration Test + Partitions Mapping
 *
 * Scope and integrations:
 * - Route/controller: `clientRoutes` mounts `POST /clients/create` and invokes
 *   controller logic to validate payload and persist the client.
 * - Middleware: Express JSON body parser; auth is not required for client creation.
 * - Models/storage: Client persistence path is exercised indirectly via routes
 *   (mocked by the test server setup); shared data is the request payload and
 *   response body.
 * - Logger: `src/config/logger` emits info/error in controllers; not asserted here.
 *
 * At least one valid case per integrated interface/shared data path:
 * - Valid creation flow (route + controller + JSON body): C1.
 * - Atypical allowed flows (missing/invalid email): C5, C6.
 * - Boundary handling (very long fields): C7.
 * - Invalid name paths (missing/empty/whitespace): C2, C3, C4.
 *
 * Partitions:
 * - C1 (Valid): Proper name and email; optional fields present or absent.
 * - C2 (Invalid): name missing.
 * - C3 (Invalid - boundary): name empty string "".
 * - C4 (Atypical): name whitespace-only "   ".
 * - C5 (Atypical): email missing (allowed by controller).
 * - C6 (Atypical): email bad format (allowed by controller; stored as-is).
 * - C7 (Boundary): extremely long name/email near limit (e.g., 256 chars) — expect 400 if rejected, or 201 if allowed.
 *
 * Mapping:
 * - "Valid: creates client with proper payload" -> C1
 * - "Invalid: 400 when name missing" -> C2
 * - "Invalid: 400 when name empty string" -> C3
 * - "Atypical: 400 when name is whitespace-only" -> C4
 * - "Atypical: 201 when email missing" -> C5
 * - "Atypical: 201 when email format is bad" -> C6
 * - "Boundary: handles very long fields" -> C7
 */

import express from "express";
import request from "supertest";
import clientRoutes from "../src/routes/clientRoutes";

// Build a minimal app mounting the client routes
const testServer = express();
testServer.use(express.json());
testServer.use(clientRoutes);

describe("POST /clients/create - Client registration API", () => {
  // C1 Valid: proper payload -> expect 201
  // Integrates: Express route/controller (clientRoutes) with JSON body parser.
  // Shares data: request payload {name,email,organization} -> controller persists, response body returns created client.
  it("Valid: creates client with proper payload (C1)", async () => {
    const res = await request(testServer)
      .post("/clients/create")
      .send({ name: "Acme", email: "team@acme.com", organization: "Acme Inc" });
    // status expectation depends on controller; 201 is typical for creation
    expect([200, 201]).toContain(res.status);
    expect(res.body).toBeDefined();
  });

  // C2 Invalid: name missing -> 400
  // Integrates: route/controller validation path rejecting missing required field.
  // Shares data: request payload missing name; response communicates validation error.
  it("Invalid: returns 400 when name is missing (C2)", async () => {
    const res = await request(testServer)
      .post("/clients/create")
      .send({ email: "team@acme.com" });
    expect(res.status).toBe(400);
  });

  // C3 Invalid (boundary): name empty string -> 400
  // Integrates: route/controller input normalization/validation.
  // Shares data: request payload with empty name; response error mapping.
  it("Invalid: returns 400 when name is empty string (C3)", async () => {
    const res = await request(testServer)
      .post("/clients/create")
      .send({ name: "", email: "team@acme.com" });
    expect(res.status).toBe(400);
  });

  // C4 Atypical: name whitespace-only -> 400
  // Integrates: controller trim/validation against whitespace-only name.
  // Shares data: request payload name "   "; response validation error.
  it("Atypical: returns 400 when name is whitespace-only (C4)", async () => {
    const res = await request(testServer)
      .post("/clients/create")
      .send({ name: "   ", email: "team@acme.com" });
    expect(res.status).toBe(400);
  });

  // C5 Atypical: email missing -> still succeeds (controller only requires name)
  // Integrates: route/controller creation flow with optional fields.
  // Shares data: request payload {name} only; response returns created client without email.
  it("Atypical: returns 201 when email is missing (C5)", async () => {
    const res = await request(testServer)
      .post("/clients/create")
      .send({ name: "Acme" });
    expect([200, 201]).toContain(res.status);
  });

  // C6 Atypical: email bad format -> still succeeds (controller does not validate email format)
  // Integrates: controller creation path storing provided email as-is.
  // Shares data: request payload with malformed email; response returns created client reflecting input.
  it("Atypical: returns 201 when email format is bad (C6)", async () => {
    const res = await request(testServer)
      .post("/clients/create")
      .send({ name: "Acme", email: "not-an-email" });
    expect([200, 201]).toContain(res.status);
  });

  // C7 Boundary: very long fields (at/above typical limits)
  // Integrates: controller limits/validation handling, persistence constraints.
  // Shares data: request payload with long name/email; response indicates success or rejection.
  it("Boundary: handles very long name/email (C7)", async () => {
    const longName = "A".repeat(256);
    const longLocal = "a".repeat(64);
    const longDomain = "b".repeat(180);
    const longEmail = `${longLocal}@${longDomain}.com`;

    const res = await request(testServer)
      .post("/clients/create")
      .send({ name: longName, email: longEmail });
    expect([200, 201, 400]).toContain(res.status);
  });
});
