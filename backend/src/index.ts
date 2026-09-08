import "express-async-errors"; // must be imported before routes are registered
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { createServer } from "http";
import { config } from "./config";
import { attachSocket } from "./socket";
import { generalLimiter, authLimiter, writeLimiter } from "./middleware/rateLimit";
import authRoutes from "./routes/auth";
import trackRoutes from "./routes/tracks";
import aiExportRoutes from "./routes/aiExport";
import userRoutes from "./routes/users";
import spotifyRoutes from "./routes/spotify";
import { prisma } from "./db";

// Exported (not just run as a side effect) so tests can import the app
// directly with supertest, without binding a real port or socket server.
export function buildApp() {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: (origin, callback) => {
        if (
          !origin ||
          config.corsOrigin === "*" ||
          origin.endsWith(".vercel.app") ||
          origin.endsWith(".onrender.com") ||
          origin === "http://localhost:5173" ||
          origin === "http://localhost:3000"
        ) {
          return callback(null, true);
        }
        callback(null, origin === config.corsOrigin);
      },
      credentials: true,
    })
  );
  // Cap request body size — protects against oversized-payload DoS attempts,
  // e.g. someone posting a multi-MB "jamConfig" blob.
  app.use(express.json({ limit: "256kb" }));

  // JSON body parse failures (malformed request bodies) land here instead
  // of crashing / hanging — express.json() throws synchronously, and this
  // dedicated handler catches specifically that case before it reaches the
  // generic error handler, so clients get a clean 400.
  app.use((err: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err instanceof SyntaxError && "body" in err) {
      return res.status(400).json({ error: "Malformed JSON in request body" });
    }
    next(err);
  });

  app.use(generalLimiter);

  app.get("/health", (_req, res) => res.json({ status: "ok" }));

  app.use("/auth", authLimiter, authRoutes);
  // Mounted before trackRoutes so "/tracks/spotify" never risks being
  // shadowed by trackRoutes' "GET /tracks/:id" wildcard (which would
  // otherwise treat "spotify" as a track id).
  app.use("/tracks/spotify", writeLimiter, spotifyRoutes);
  app.use("/tracks", writeLimiter, trackRoutes);
  app.use("/tracks", writeLimiter, aiExportRoutes);
  app.use("/users", writeLimiter, userRoutes);

  // 404 for anything unmatched — without this, unknown routes fall through
  // to Express's default HTML error page instead of a clean JSON response.
  app.use((_req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  // Central error handler — catches anything an async route handler throws
  // instead of crashing the process or hanging the request.
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err);

    // Errors that already carry a real HTTP status (body-parser's
    // "payload too large" is exactly this — status 413) were previously
    // falling through to a generic 500 here, which is both the wrong
    // status code and hides the actual, more useful error from the client.
    const status = (err as { status?: unknown; statusCode?: unknown } | null)?.status ??
      (err as { statusCode?: unknown } | null)?.statusCode;
    if (typeof status === "number" && status >= 400 && status < 500) {
      const rawMessage = err instanceof Error ? err.message : "Request error";
      const message = status === 413 ? "Request body is too large (max 256kb)" : rawMessage;
      return res.status(status).json({ error: message });
    }

    // Prisma known-request errors (e.g. unique constraint violations that
    // slip past an application-level check under race conditions) get a
    // clean 409 instead of leaking a raw Prisma error message/stack.
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      typeof (err as { code?: unknown }).code === "string" &&
      (err as { code: string }).code.startsWith("P")
    ) {
      const code = (err as { code: string }).code;
      if (code === "P2002") {
        return res.status(409).json({ error: "A record with that value already exists" });
      }
      if (code === "P2025") {
        return res.status(404).json({ error: "Record not found" });
      }
      return res.status(500).json({ error: "Database error" });
    }

    const message = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: message });
  });

  return app;
}

if (require.main === module) {
  const app = buildApp();
  const httpServer = createServer(app);
  attachSocket(httpServer);

  httpServer.listen(config.port, () => {
    console.log(`CrowdJam backend listening on :${config.port} (${config.nodeEnv})`);
  });

  // Graceful shutdown — finish in-flight requests and close the DB pool
  // cleanly instead of dropping connections mid-request on deploy/restart.
  async function shutdown(signal: string) {
    console.log(`Received ${signal}, shutting down gracefully...`);
    httpServer.close(async () => {
      await prisma.$disconnect();
      process.exit(0);
    });
    // Force-exit if graceful shutdown hangs for too long.
    setTimeout(() => process.exit(1), 10_000).unref();
  }
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  process.on("unhandledRejection", (reason) => {
    console.error("Unhandled promise rejection:", reason);
  });
  process.on("uncaughtException", (err) => {
    console.error("Uncaught exception:", err);
    // Exit after logging — an uncaught exception means state may be
    // corrupted; let the process manager (Render/Docker) restart it clean
    // rather than limping on.
    process.exit(1);
  });
}
