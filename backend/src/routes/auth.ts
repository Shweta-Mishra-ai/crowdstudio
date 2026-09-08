import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { z } from "zod";
import { prisma } from "../db";
import { config } from "../config";
import { requireAuth, AuthedRequest } from "../middleware/auth";

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  username: z
    .string()
    .min(3)
    .max(20)
    .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  displayName: z.string().max(50).optional(),
});

router.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    // Real validation errors, not a generic "Registration failed".
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
  }
  const { email, username, password, displayName } = parsed.data;

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { username }] },
  });
  if (existing) {
    const field = existing.email === email ? "Email" : "Username";
    return res.status(409).json({ error: `${field} is already taken` });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { email, username, passwordHash, displayName: displayName ?? username },
  });

  const token = jwt.sign({ userId: user.id }, config.jwtSecret, { expiresIn: config.jwtExpiry });
  return res.status(201).json({
    token,
    user: { id: user.id, email: user.email, username: user.username, displayName: user.displayName },
  });
});

const loginSchema = z.object({
  emailOrUsername: z.string().min(1),
  password: z.string().min(1),
});

router.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Email/username and password are required" });
  }
  const { emailOrUsername, password } = parsed.data;

  const user = await prisma.user.findFirst({
    where: { OR: [{ email: emailOrUsername }, { username: emailOrUsername }] },
  });
  // Deliberately same error for "no user" and "wrong password" (don't leak
  // which one it was), but it's a real, specific message either way.
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ error: "Incorrect email/username or password" });
  }

  const token = jwt.sign({ userId: user.id }, config.jwtSecret, { expiresIn: config.jwtExpiry });
  return res.json({
    token,
    user: { id: user.id, email: user.email, username: user.username, displayName: user.displayName },
  });
});

router.get("/me", requireAuth, async (req: AuthedRequest, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { id: true, email: true, username: true, displayName: true, bio: true, avatarUrl: true, createdAt: true },
  });
  if (!user) return res.status(404).json({ error: "User not found" });
  return res.json({ user });
});

/**
 * Creates a lightweight, passwordless guest account and returns a normal
 * JWT for it — used to remove the login/register wall entirely on the
 * frontend while still giving every visitor a real, stable identity for
 * attribution (track authorship, unique likes, chat usernames). No schema
 * change was needed: the guest gets an auto-generated, unguessable email
 * and a random (never-shown, never-usable) password hash, since `email`
 * and `passwordHash` remain required columns.
 *
 * Retries a handful of times on the astronomically unlikely event of a
 * username collision instead of failing outright.
 */
router.post("/guest", async (_req, res) => {
  for (let attempt = 0; attempt < 5; attempt++) {
    const id = crypto.randomBytes(5).toString("hex");
    const username = `guest_${id}`;
    const email = `${username}@guest.crowdstudio.local`;
    try {
      const passwordHash = await bcrypt.hash(crypto.randomBytes(24).toString("hex"), 10);
      const user = await prisma.user.create({
        data: { email, username, passwordHash, displayName: "Guest" },
      });
      const token = jwt.sign({ userId: user.id }, config.jwtSecret, { expiresIn: config.jwtExpiry });
      return res.status(201).json({
        token,
        user: { id: user.id, email: user.email, username: user.username, displayName: user.displayName },
      });
    } catch (err) {
      // P2002 = unique constraint violation (username/email collision) —
      // retry with a new random id. Anything else, bail out immediately.
      const isUniqueClash =
        err && typeof err === "object" && "code" in err && (err as { code: string }).code === "P2002";
      if (!isUniqueClash) throw err;
    }
  }
  return res.status(500).json({ error: "Could not create a guest identity, please try again" });
});

export default router;
