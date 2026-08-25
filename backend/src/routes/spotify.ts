import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth, AuthedRequest } from "../middleware/auth";

const router = Router();

const addSpotifySchema = z.object({
  spotifyUrl: z.string().url(),
});

const SPOTIFY_TRACK_ID_RE = /spotify\.com\/track\/([a-zA-Z0-9]+)/;
const FETCH_TIMEOUT_MS = 8000;

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Adds a real Spotify song to the feed/leaderboard by pasted link.
 *
 * Deliberately uses only unauthenticated, public Spotify endpoints —
 * oEmbed for the title, and the public track page's Open Graph tags for
 * the artist name — instead of the full Web API, which needs a Client
 * ID/Secret and OAuth. Actual playback happens entirely through Spotify's
 * own official embed iframe (see the frontend), so this app never stores,
 * proxies, or streams any actual audio.
 *
 * Both metadata fetches are best-effort with a hard timeout: if Spotify's
 * endpoints are slow, down, or a track is region-restricted, the song is
 * still added (with a generic title/no artist) rather than failing the
 * whole request over metadata — the embed player shows the real title
 * either way once it loads.
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

  let title = "Spotify track";
  const oembedRes = await fetchWithTimeout(
    `https://open.spotify.com/oembed?url=${encodeURIComponent(parsed.data.spotifyUrl)}`,
    FETCH_TIMEOUT_MS
  );
  if (oembedRes?.ok) {
    try {
      const data = (await oembedRes.json()) as { title?: string };
      if (typeof data.title === "string" && data.title.trim()) {
        title = data.title.trim();
      }
    } catch {
      // Malformed JSON from oEmbed — keep the generic title.
    }
  }

  // Spotify's oEmbed response has no artist field at all, so the artist
  // was previously just never captured (a real bug: the frontend was
  // falling back to showing the CrowdJam user who *added* the song as if
  // they were the song's artist). The public track page's Open Graph
  // description tag is in the form "Artist · Song · Listeners" and is
  // accessible without any authentication, so we parse it from there.
  let artist: string | null = null;
  const pageRes = await fetchWithTimeout(parsed.data.spotifyUrl, FETCH_TIMEOUT_MS);
  if (pageRes?.ok) {
    try {
      const html = await pageRes.text();
      const ogDescMatch = html.match(/<meta property="og:description" content="([^"]*)"/i);
      if (ogDescMatch) {
        const candidate = ogDescMatch[1].split("·")[0].trim();
        // Guard against picking up an empty or clearly-not-a-name value.
        if (candidate && candidate.length < 100) {
          artist = candidate;
        }
      }
    } catch {
      // Fetched but couldn't parse — leave artist unset rather than guess.
    }
  }

  const track = await prisma.track.create({
    data: {
      title,
      kind: "spotify",
      spotifyTrackId,
      spotifyArtist: artist,
      spotifyUrl: parsed.data.spotifyUrl,
      authorId: req.userId!,
    },
    include: { author: { select: { id: true, username: true, displayName: true, avatarUrl: true } } },
  });

  return res.status(201).json({ track });
});

export default router;
