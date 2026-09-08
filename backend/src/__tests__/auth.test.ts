import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";

vi.mock("../db", () => ({ prisma: createMockPrisma() }));

import { createMockPrisma } from "./mockPrisma";
import { prisma } from "../db";
import { buildApp } from "../index";

const mockPrisma = prisma as unknown as ReturnType<typeof createMockPrisma>;
const app = buildApp();

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /auth/register", () => {
  it("rejects a password shorter than 8 characters", async () => {
    const res = await request(app).post("/auth/register").send({
      email: "a@b.com",
      username: "alice",
      password: "short",
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/at least 8 characters/i);
  });

  it("rejects a username with invalid characters", async () => {
    const res = await request(app).post("/auth/register").send({
      email: "a@b.com",
      username: "al ice!",
      password: "longenoughpassword",
    });
    expect(res.status).toBe(400);
  });

  it("returns a specific 409 when the email is already taken", async () => {
    mockPrisma.user.findFirst.mockResolvedValue({ id: "1", email: "a@b.com", username: "someoneelse" });
    const res = await request(app).post("/auth/register").send({
      email: "a@b.com",
      username: "newuser",
      password: "longenoughpassword",
    });
    expect(res.status).toBe(409);
    // This is the specific-error-message fix from the crowdstudio audit —
    // must say WHICH field conflicted, not a generic "Registration failed".
    expect(res.body.error).toBe("Email is already taken");
  });

  it("creates a user and returns a token on valid input", async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue({
      id: "1",
      email: "a@b.com",
      username: "alice",
      displayName: "alice",
    });
    const res = await request(app).post("/auth/register").send({
      email: "a@b.com",
      username: "alice",
      password: "longenoughpassword",
    });
    expect(res.status).toBe(201);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.username).toBe("alice");
  });
});

describe("POST /auth/login", () => {
  it("returns a specific error for wrong credentials, not a silent failure", async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);
    const res = await request(app).post("/auth/login").send({
      emailOrUsername: "nobody",
      password: "whatever123",
    });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Incorrect email/username or password");
  });

  it("logs in successfully with correct credentials", async () => {
    const passwordHash = await bcrypt.hash("correcthorse", 12);
    mockPrisma.user.findFirst.mockResolvedValue({
      id: "1",
      email: "a@b.com",
      username: "alice",
      displayName: "Alice",
      passwordHash,
    });
    const res = await request(app).post("/auth/login").send({
      emailOrUsername: "alice",
      password: "correcthorse",
    });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
  });

  it("rejects malformed JSON body cleanly instead of crashing", async () => {
    const res = await request(app)
      .post("/auth/login")
      .set("Content-Type", "application/json")
      .send("{not valid json");
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/malformed json/i);
  });
});

describe("GET /auth/me", () => {
  it("requires authentication", async () => {
    const res = await request(app).get("/auth/me");
    expect(res.status).toBe(401);
  });

  it("rejects an invalid token instead of failing open", async () => {
    const res = await request(app).get("/auth/me").set("Authorization", "Bearer not-a-real-token");
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Invalid or expired token");
  });
});

describe("POST /auth/guest", () => {
  it("creates a passwordless guest account and returns a usable token", async () => {
    mockPrisma.user.create.mockResolvedValue({
      id: "g1",
      email: "guest_abc123@guest.crowdstudio.local",
      username: "guest_abc123",
      displayName: "Guest",
    });
    const res = await request(app).post("/auth/guest").send({});
    expect(res.status).toBe(201);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.username).toMatch(/^guest_/);
    expect(res.body.user.displayName).toBe("Guest");
  });

  it("requires no request body at all", async () => {
    mockPrisma.user.create.mockResolvedValue({
      id: "g2",
      email: "guest_xyz@guest.crowdstudio.local",
      username: "guest_xyz",
      displayName: "Guest",
    });
    const res = await request(app).post("/auth/guest");
    expect(res.status).toBe(201);
  });

  it("retries on a username collision instead of failing the request", async () => {
    const clash = Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
    mockPrisma.user.create
      .mockRejectedValueOnce(clash)
      .mockResolvedValueOnce({
        id: "g3",
        email: "guest_retry@guest.crowdjam.local",
        username: "guest_retry",
        displayName: "Guest",
      });
    const res = await request(app).post("/auth/guest").send({});
    expect(res.status).toBe(201);
    expect(mockPrisma.user.create).toHaveBeenCalledTimes(2);
  });

  it("surfaces a non-collision database error instead of retrying forever", async () => {
    mockPrisma.user.create.mockRejectedValue(new Error("database is down"));
    const res = await request(app).post("/auth/guest").send({});
    expect(res.status).toBe(500);
  });
});
