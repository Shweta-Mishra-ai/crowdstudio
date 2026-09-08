import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { config } from "../config";
import { requireAuth, AuthedRequest } from "../middleware/auth";
import { writeLimiter } from "../middleware/rateLimit";

const router = Router();

const exportSchema = z.object({
  prompt: z.string().min(1).max(500),
});

/**
 * Renders a live jam into a downloadable AI-produced track.
 *
 * IMPORTANT: this only works when AI_EXPORT_API_KEY + AI_EXPORT_PROVIDER
 * are set. If not configured, it returns a clear 501 instead of the old
 * crowdstudio behavior of silently returning a random stock mp3. We never
 * fake the output here.
 */
router.post("/:trackId/export", requireAuth, writeLimiter, async (req: AuthedRequest, res) => {
  if (!config.aiExportApiKey || !config.aiExportProvider) {
    return res.status(501).json({
      error: "AI export is not configured on this server. Set AI_EXPORT_API_KEY and AI_EXPORT_PROVIDER.",
    });
  }

  const parsed = exportSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "A prompt describing the desired export is required" });
  }

  const track = await prisma.track.findUnique({ where: { id: req.params.trackId } });
  if (!track) return res.status(404).json({ error: "Track not found" });
  if (track.authorId !== req.userId) {
    return res.status(403).json({ error: "You can only export your own tracks" });
  }

  await prisma.track.update({ where: { id: track.id }, data: { aiExportStatus: "pending" } });

  try {
    // Real call out to whichever provider is configured. Kept generic here
    // since the exact request/response shape depends on the provider chosen
    // (e.g. Suno, ElevenLabs Music). Swap the URL/payload for the real one.
    const providerUrl = process.env.AI_EXPORT_ENDPOINT;
    if (!providerUrl) {
      throw new Error("AI_EXPORT_ENDPOINT is not set");
    }

    // Without a timeout, a hung provider ties up this request indefinitely
    // — the client, this server's connection pool, and (worst case) other
    // requests waiting behind it all pay for one bad upstream call.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.aiExportTimeoutMs);

    let response: Response;
    try {
      response = await fetch(providerUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.aiExportApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: parsed.data.prompt,
          jamConfig: track.jamConfig,
        }),
        signal: controller.signal,
      });
    } catch (fetchErr) {
      if (fetchErr instanceof Error && fetchErr.name === "AbortError") {
        throw new Error("Provider did not respond within 30s");
      }
      throw fetchErr;
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      throw new Error(`Provider returned ${response.status}`);
    }
    const data = (await response.json()) as { audioUrl?: string };
    if (!data.audioUrl) {
      throw new Error("Provider response missing audioUrl");
    }

    await prisma.track.update({
      where: { id: track.id },
      data: { aiExportUrl: data.audioUrl, aiExportStatus: "ready" },
    });
    return res.json({ aiExportUrl: data.audioUrl, status: "ready" });
  } catch (err) {
    await prisma.track.update({ where: { id: track.id }, data: { aiExportStatus: "failed" } });
    const message = err instanceof Error ? err.message : "Unknown error";
    return res.status(502).json({ error: `AI export failed: ${message}` });
  }
});

export default router;
