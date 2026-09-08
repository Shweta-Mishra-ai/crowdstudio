import rateLimit from "express-rate-limit";

// Generous general limit — protects against basic abuse/load spikes
// without punishing normal browsing of the feed.
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === "test",
  message: { error: "Too many requests. Please slow down and try again shortly." },
});

// Tighter limit specifically on auth routes — this is the endpoint most
// exposed to brute-force / credential-stuffing attempts, so it gets its
// own stricter budget independent of general API traffic.
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === "test",
  message: { error: "Too many auth attempts. Please wait a few minutes and try again." },
});

// Even tighter limit on writes that create DB rows (tracks, comments) to
// prevent spam/flood under load.
export const writeLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === "test",
  message: { error: "Too many submissions. Please wait a moment before posting again." },
});
