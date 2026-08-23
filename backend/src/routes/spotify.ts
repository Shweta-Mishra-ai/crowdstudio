import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth, AuthedRequest } from "../middleware/auth";

const router = Router();

const addSpotifySchema = z.object({
  spotifyUrl: z.string().url(),
});

const SPOTIFY_TRACK_ID_RE = /spotify\.com\/track\/([a-zA-Z0-9]+)/;
const OEMBED_TIMEOUT_MS = 8000;

/**
 * Adds a real Spotify song to the feed/leaderboard by pasted link.
 *
 * Deliberately uses Spotify's public oEmbed endpoint
 * (open.spotify.com/oembed) instead of the full Web API — oEmbed is
 * unauthenticated and requires no Client ID/Secret/OAuth at all, unlike
 * Search or Playback endpoints. We only use it to fetch a display title;
 * actual playback later happens entirely through Spotify's own official
 * embed iframe (see the frontend), so this app never stores, proxies, or
 * streams any actual audio — fully within Spotify's embed terms.
 */
router.post("/", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = addSpotifySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "A valid Spotify link is required" });
  }

  const match = parsed.data.spotifyUrl.match(SPOTIFY_TRACK_ID_RE);
  if (!match) {
    return res.status(400).json({ error: "That doesn't look like a Spotify track link (open.spotify.com/track/...)" });
  }
  const spotifyTrackId = match[1];

  // Fetch a display title via oEmbed. Best-effort: if Spotify's oEmbed is
  // slow, down, or the track is region-restricted, we still add the track
  // with a generic title rather than failing the whole request over
  // metadata — the embed player itself will show the real title anyway.
  let title = "Spotify track";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OEMBED_TIMEOUT_MS);
  try {
    const oembedRes = await fetch(
      `https://open.spotify.com/oembed?url=${encodeURIComponent(parsed.data.spotifyUrl)}`,
      { signal: controller.signal }
    );
    if (oembedRes.ok) {
      const data = (await oembedRes.json()) as { title?: string };
      if (typeof data.title === "string" && data.title.trim()) {
        title = data.title.trim();
      }
    }
  } catch {
    // Network error or timeout — proceed with the generic title.
  } finally {
    clearTimeout(timeout);
  }

  const track = await prisma.track.create({
    data: {
      title,
      kind: "spotify",
      spotifyTrackId,
      spotifyUrl: parsed.data.spotifyUrl,
      authorId: req.userId!,
    },
    include: { author: { select: { id: true, username: true, displayName: true, avatarUrl: true } } },
  });

  return res.status(201).json({ track });
});

export default router;
