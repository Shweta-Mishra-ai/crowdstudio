import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth, optionalAuth, AuthedRequest } from "../middleware/auth";
import { hotScore } from "../lib/ranking";

const router = Router();

const createTrackSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  jamConfig: z.record(z.any()), // Tone.js session params captured client-side
  durationSec: z.number().int().min(0).max(3600).optional(),
});

// Query param validation for pagination. Without this, `?page=abc` becomes
// NaN after Number() coercion, which Prisma's `skip` rejects with a raw
// 500 — this returns a clean 400 instead. Page is also capped: without a
// ceiling, `?page=999999999` forces Postgres to walk and discard millions
// of rows before returning anything, which is a real, easy DoS vector on
// an unauthenticated GET route.
const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).max(5000).optional().default(1),
});

// GET /tracks - global feed, paginated, newest first
router.get("/", optionalAuth, async (req: AuthedRequest, res) => {
  const parsed = paginationSchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid page parameter" });
  }
  const page = parsed.data.page;
  const pageSize = 20;

  const tracks = await prisma.track.findMany({
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * pageSize,
    take: pageSize,
    include: {
      author: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
      _count: { select: { likes: true, comments: true } },
      likes: req.userId ? { where: { userId: req.userId }, select: { id: true } } : false,
    },
  });

  const shaped = tracks.map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description,
    kind: t.kind,
    jamConfig: t.jamConfig,
    spotifyTrackId: t.spotifyTrackId,
    spotifyArtist: t.spotifyArtist,
    aiExportUrl: t.aiExportUrl,
    aiExportStatus: t.aiExportStatus,
    durationSec: t.durationSec,
    playCount: t.playCount,
    createdAt: t.createdAt,
    author: t.author,
    likeCount: t._count.likes,
    commentCount: t._count.comments,
    likedByMe: req.userId ? (t.likes?.length ?? 0) > 0 : false,
  }));

  return res.json({ tracks: shaped, page, pageSize });
});

// GET /tracks/leaderboard - real, DB-backed, ranked by a time-decayed "hot"
// score (see lib/ranking.ts) rather than raw like count, so new tracks can
// actually surface instead of old ones permanently occupying the top spots.
router.get("/leaderboard", async (_req, res) => {
  // Pull a candidate pool larger than the final list so the score-based
  // re-rank has something real to work with, but still bounded — this
  // isn't a full table scan. Ordering the initial fetch by likes desc
  // means we're very unlikely to miss a track that could plausibly end up
  // in the top 50 after decay (a track with few likes and enormous decay
  // was never going to make the cut anyway).
  const candidates = await prisma.track.findMany({
    orderBy: [{ likes: { _count: "desc" } }, { playCount: "desc" }],
    take: 300,
    include: {
      author: { select: { username: true, displayName: true, avatarUrl: true } },
      _count: { select: { likes: true } },
    },
  });

  const now = new Date();
  const ranked = candidates
    .map((t) => ({
      trackId: t.id,
      title: t.title,
      kind: t.kind,
      spotifyArtist: t.spotifyArtist,
      author: t.author,
      likeCount: t._count.likes,
      playCount: t.playCount,
      score: hotScore(t._count.likes, t.playCount, t.createdAt, now),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 50);

  return res.json({
    leaderboard: ranked.map((t, i) => ({
      rank: i + 1,
      trackId: t.trackId,
      title: t.title,
      kind: t.kind,
      spotifyArtist: t.spotifyArtist,
      author: t.author,
      likeCount: t.likeCount,
      playCount: t.playCount,
    })),
  });
});

router.post("/", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = createTrackSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid track data" });
  }
  const track = await prisma.track.create({
    data: {
      title: parsed.data.title,
      description: parsed.data.description,
      jamConfig: parsed.data.jamConfig,
      durationSec: parsed.data.durationSec ?? 0,
      authorId: req.userId!,
    },
    include: { author: { select: { id: true, username: true, displayName: true, avatarUrl: true } } },
  });
  return res.status(201).json({ track });
});

// GET /tracks/:id - single track detail
router.get("/:id", optionalAuth, async (req: AuthedRequest, res) => {
  const track = await prisma.track.findUnique({
    where: { id: req.params.id },
    include: {
      author: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
      _count: { select: { likes: true, comments: true } },
      likes: req.userId ? { where: { userId: req.userId }, select: { id: true } } : false,
    },
  });
  if (!track) return res.status(404).json({ error: "Track not found" });

  return res.json({
    track: {
      id: track.id,
      title: track.title,
      description: track.description,
      kind: track.kind,
      jamConfig: track.jamConfig,
      spotifyTrackId: track.spotifyTrackId,
      spotifyArtist: track.spotifyArtist,
      aiExportUrl: track.aiExportUrl,
      aiExportStatus: track.aiExportStatus,
      durationSec: track.durationSec,
      playCount: track.playCount,
      createdAt: track.createdAt,
      author: track.author,
      likeCount: track._count.likes,
      commentCount: track._count.comments,
      likedByMe: req.userId ? (track.likes?.length ?? 0) > 0 : false,
    },
  });
});

router.post("/:id/play", async (req, res) => {
  const track = await prisma.track.update({
    where: { id: req.params.id },
    data: { playCount: { increment: 1 } },
  }).catch(() => null);
  if (!track) return res.status(404).json({ error: "Track not found" });
  return res.json({ playCount: track.playCount });
});

router.post("/:id/like", requireAuth, async (req: AuthedRequest, res) => {
  const trackId = req.params.id;
  const existing = await prisma.like.findUnique({
    where: { userId_trackId: { userId: req.userId!, trackId } },
  });

  if (existing) {
    await prisma.like.delete({ where: { id: existing.id } });
    const count = await prisma.like.count({ where: { trackId } });
    return res.json({ liked: false, likeCount: count });
  } else {
    try {
      await prisma.like.create({ data: { userId: req.userId!, trackId } });
    } catch {
      return res.status(404).json({ error: "Track not found" });
    }
    const count = await prisma.like.count({ where: { trackId } });
    return res.json({ liked: true, likeCount: count });
  }
});

const commentSchema = z.object({ body: z.string().min(1).max(500) });

router.post("/:id/comments", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = commentSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Comment cannot be empty" });
  }
  const comment = await prisma.comment
    .create({
      data: { body: parsed.data.body, userId: req.userId!, trackId: req.params.id },
      include: { user: { select: { username: true, displayName: true, avatarUrl: true } } },
    })
    .catch(() => null);
  if (!comment) return res.status(404).json({ error: "Track not found" });
  return res.status(201).json({ comment });
});

router.get("/:id/comments", async (req, res) => {
  const comments = await prisma.comment.findMany({
    where: { trackId: req.params.id },
    orderBy: { createdAt: "asc" },
    // Capped — without this, a heavily-commented track forces the DB and
    // this endpoint to return an unbounded result set on every page view.
    take: 200,
    include: { user: { select: { username: true, displayName: true, avatarUrl: true } } },
  });
  return res.json({ comments });
});

export default router;
