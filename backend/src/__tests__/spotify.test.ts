import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";

vi.mock("../db", () => ({ prisma: createMockPrisma() }));

import { createMockPrisma } from "./mockPrisma";
import { prisma } from "../db";
import { buildApp } from "../index";
import { config } from "../config";

const mockPrisma = prisma as unknown as ReturnType<typeof createMockPrisma>;
const app = buildApp();

function tokenFor(userId: string) {
  return jwt.sign({ userId }, config.jwtSecret, { expiresIn: config.jwtExpiry });
}

const originalFetch = global.fetch;

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  global.fetch = originalFetch;
});

describe("POST /tracks/spotify", () => {
  it("requires authentication", async () => {
    const res = await request(app)
      .post("/tracks/spotify")
      .send({ spotifyUrl: "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC" });
    expect(res.status).toBe(401);
  });

  it("rejects a non-Spotify URL", async () => {
    const res = await request(app)
      .post("/tracks/spotify")
      .set("Authorization", `Bearer ${tokenFor("u1")}`)
      .send({ spotifyUrl: "https://example.com/not-spotify" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/doesn't look like a spotify/i);
  });

  it("rejects a non-URL value entirely", async () => {
    const res = await request(app)
      .post("/tracks/spotify")
      .set("Authorization", `Bearer ${tokenFor("u1")}`)
      .send({ spotifyUrl: "not a url" });
    expect(res.status).toBe(400);
  });

  it("extracts the track ID and fetches a real title via oEmbed", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ title: "Never Gonna Give You Up" }),
    }) as unknown as typeof fetch;
    mockPrisma.track.create.mockResolvedValue({
      id: "t1",
      title: "Never Gonna Give You Up",
      kind: "spotify",
      spotifyTrackId: "4uLU6hMCjMI75M1A2tKUQC",
      author: { id: "u1", username: "alice", displayName: "Alice", avatarUrl: null },
    });

    const res = await request(app)
      .post("/tracks/spotify")
      .set("Authorization", `Bearer ${tokenFor("u1")}`)
      .send({ spotifyUrl: "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC?si=abc123" });

    expect(res.status).toBe(201);
    expect(res.body.track.title).toBe("Never Gonna Give You Up");
    expect(mockPrisma.track.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ kind: "spotify", spotifyTrackId: "4uLU6hMCjMI75M1A2tKUQC" }),
      })
    );
  });

  it("still adds the track with a generic title when oEmbed fails, instead of failing the request", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("network down")) as unknown as typeof fetch;
    mockPrisma.track.create.mockResolvedValue({
      id: "t2",
      title: "Spotify track",
      kind: "spotify",
      spotifyTrackId: "abc123",
      author: { id: "u1", username: "alice", displayName: "Alice", avatarUrl: null },
    });

    const res = await request(app)
      .post("/tracks/spotify")
      .set("Authorization", `Bearer ${tokenFor("u1")}`)
      .send({ spotifyUrl: "https://open.spotify.com/track/abc123" });

    expect(res.status).toBe(201);
    expect(res.body.track.title).toBe("Spotify track");
  });

  it("still adds the track when oEmbed returns a non-ok response", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 }) as unknown as typeof fetch;
    mockPrisma.track.create.mockResolvedValue({
      id: "t3",
      title: "Spotify track",
      kind: "spotify",
      spotifyTrackId: "xyz789",
      author: { id: "u1", username: "alice", displayName: "Alice", avatarUrl: null },
    });

    const res = await request(app)
      .post("/tracks/spotify")
      .set("Authorization", `Bearer ${tokenFor("u1")}`)
      .send({ spotifyUrl: "https://open.spotify.com/track/xyz789" });

    expect(res.status).toBe(201);
  });
});
