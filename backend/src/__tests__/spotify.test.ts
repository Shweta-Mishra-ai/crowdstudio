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

// The route now makes two fetches per request: oEmbed (title) and the
// public track page (artist, via Open Graph). This mock dispatches based
// on the URL so each test can control both responses independently.
function mockFetchByUrl(handlers: { oembed?: unknown; page?: unknown }) {
  global.fetch = vi.fn((url: string) => {
    if (url.includes("/oembed")) {
      if (handlers.oembed === "reject") return Promise.reject(new Error("network down"));
      return Promise.resolve(handlers.oembed as Response);
    }
    if (handlers.page === "reject") return Promise.reject(new Error("network down"));
    return Promise.resolve(handlers.page as Response);
  }) as unknown as typeof fetch;
}

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

  it("extracts the track ID, real title (oEmbed), and real artist (Open Graph) — the artist bug fix", async () => {
    mockFetchByUrl({
      oembed: { ok: true, json: async () => ({ title: "Never Gonna Give You Up" }) },
      page: {
        ok: true,
        text: async () =>
          `<html><head><meta property="og:description" content="Rick Astley · Song · 1987"></head></html>`,
      },
    });
    mockPrisma.track.create.mockResolvedValue({
      id: "t1",
      title: "Never Gonna Give You Up",
      kind: "spotify",
      spotifyTrackId: "4uLU6hMCjMI75M1A2tKUQC",
      spotifyArtist: "Rick Astley",
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
        data: expect.objectContaining({
          kind: "spotify",
          spotifyTrackId: "4uLU6hMCjMI75M1A2tKUQC",
          spotifyArtist: "Rick Astley",
        }),
      })
    );
  });

  it("still adds the track with a generic title and null artist when both fetches fail, instead of failing the request", async () => {
    mockFetchByUrl({ oembed: "reject", page: "reject" });
    mockPrisma.track.create.mockResolvedValue({
      id: "t2",
      title: "Spotify track",
      kind: "spotify",
      spotifyTrackId: "abc123",
      spotifyArtist: null,
      author: { id: "u1", username: "alice", displayName: "Alice", avatarUrl: null },
    });

    const res = await request(app)
      .post("/tracks/spotify")
      .set("Authorization", `Bearer ${tokenFor("u1")}`)
      .send({ spotifyUrl: "https://open.spotify.com/track/abc123" });

    expect(res.status).toBe(201);
    expect(res.body.track.title).toBe("Spotify track");
    expect(mockPrisma.track.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ spotifyArtist: null }) })
    );
  });

  it("still adds the track when either fetch returns a non-ok response", async () => {
    mockFetchByUrl({ oembed: { ok: false, status: 404 }, page: { ok: false, status: 404 } });
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

  it("doesn't crash and leaves artist null when the page HTML has no matching Open Graph tag", async () => {
    mockFetchByUrl({
      oembed: { ok: true, json: async () => ({ title: "Some Song" }) },
      page: { ok: true, text: async () => `<html><head></head></html>` },
    });
    mockPrisma.track.create.mockResolvedValue({
      id: "t4",
      title: "Some Song",
      kind: "spotify",
      spotifyTrackId: "noog",
      spotifyArtist: null,
      author: { id: "u1", username: "alice", displayName: "Alice", avatarUrl: null },
    });

    const res = await request(app)
      .post("/tracks/spotify")
      .set("Authorization", `Bearer ${tokenFor("u1")}`)
      .send({ spotifyUrl: "https://open.spotify.com/track/noog" });

    expect(res.status).toBe(201);
    expect(mockPrisma.track.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ spotifyArtist: null }) })
    );
  });
});
