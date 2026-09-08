import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth, AuthedRequest } from "../middleware/auth";
import { writeLimiter } from "../middleware/rateLimit";

const router = Router();

router.get("/:username", async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { username: req.params.username },
    select: {
      id: true,
      username: true,
      displayName: true,
      bio: true,
      avatarUrl: true,
      createdAt: true,
      _count: { select: { tracks: true } },
    },
  });
  if (!user) return res.status(404).json({ error: "User not found" });

  const tracks = await prisma.track.findMany({
    where: { authorId: user.id },
    orderBy: { createdAt: "desc" },
    // Capped for the same reason as the comments list — a prolific user's
    // profile shouldn't force an unbounded query on every page view.
    take: 100,
    include: { _count: { select: { likes: true, comments: true } } },
  });

  return res.json({
    user: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      bio: user.bio,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
      trackCount: user._count.tracks,
    },
    tracks: tracks.map((t) => ({
      id: t.id,
      title: t.title,
      createdAt: t.createdAt,
      playCount: t.playCount,
      likeCount: t._count.likes,
      commentCount: t._count.comments,
    })),
  });
});

const updateProfileSchema = z.object({
  displayName: z.string().max(50).optional(),
  bio: z.string().max(280).optional(),
});

router.patch("/me", requireAuth, writeLimiter, async (req: AuthedRequest, res) => {
  const parsed = updateProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
  }
  const user = await prisma.user.update({
    where: { id: req.userId },
    data: parsed.data,
    select: { id: true, username: true, displayName: true, bio: true, avatarUrl: true },
  });
  return res.json({ user });
});

export default router;
