import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Heart, PlayCircle, Sparkles, Music4, Waves } from "lucide-react";
import { api, apiErrorMessage } from "../lib/api";
import { useAuthStore } from "../stores/authStore";
import { usePresence } from "../hooks/usePresence";
import { VUMeter } from "../components/VUMeter";
import { AddSpotifySong } from "../components/AddSpotifySong";

interface Track {
  id: string;
  title: string;
  description: string | null;
  kind: "jam" | "spotify";
  playCount: number;
  likeCount: number;
  likedByMe: boolean;
  author: { username: string; displayName: string | null };
}

export default function Feed() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const user = useAuthStore((s) => s.user);
  const presence = usePresence();

  const loadFeed = useCallback(() => {
    api
      .get("/tracks")
      .then(({ data }) => setTracks(data.tracks))
      .catch((err) => setError(apiErrorMessage(err, "Could not load feed")))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  async function toggleLike(trackId: string) {
    if (!user) return;
    try {
      const { data } = await api.post(`/tracks/${trackId}/like`);
      setTracks((prev) =>
        prev.map((t) => (t.id === trackId ? { ...t, likedByMe: data.liked, likeCount: data.likeCount } : t))
      );
    } catch {
      // Non-critical UI action — fail silently, like state just won't update.
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
      <section className="mb-6">
        <p className="mb-2 flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-muted">
          <VUMeter active={presence.inJamRoom > 0} bars={3} />
          {presence.inJamRoom > 0 ? `${presence.inJamRoom} jamming right now` : "the room is quiet"}
        </p>
        <h1 className="font-display text-3xl font-semibold text-paper sm:text-4xl">
          What the crowd is building
        </h1>
        <p className="mt-2 max-w-xl text-sm text-muted">
          Live CrowdJam sessions and real songs from Spotify, ranked and voted on together.
        </p>
        <div className="signal-line mt-6" />
      </section>

      <AddSpotifySong onAdded={loadFeed} />

      {loading && <FeedSkeleton />}

      {!loading && error && (
        <div className="channel-strip p-6 text-center text-sm text-alert">{error}</div>
      )}

      {!loading && !error && tracks.length === 0 && (
        <div className="channel-strip flex flex-col items-center gap-3 p-10 text-center">
          <Sparkles className="text-primary" size={28} />
          <p className="text-paper">Nothing here yet.</p>
          <p className="text-sm text-muted">
            Open the Studio and jam, or add a real song above — be the first on the board.
          </p>
          <Link to="/studio" className="mt-2 rounded bg-primary px-4 py-2 text-sm font-semibold text-bg">
            Go to Jam Studio
          </Link>
        </div>
      )}

      {!loading && !error && tracks.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {tracks.map((t) => (
            <div key={t.id} className="channel-strip flex flex-col justify-between p-5">
              <div>
                <div className="mb-1 flex items-start justify-between gap-2">
                  <Link
                    to={`/tracks/${t.id}`}
                    className="flex items-center gap-1.5 font-semibold text-paper hover:text-primary"
                  >
                    {t.kind === "spotify" ? (
                      <Music4 size={13} className="shrink-0 text-accent" />
                    ) : (
                      <Waves size={13} className="shrink-0 text-primary" />
                    )}
                    {t.title}
                  </Link>
                  <button
                    onClick={() => toggleLike(t.id)}
                    disabled={!user}
                    title={user ? "Like this track" : "Starting a session…"}
                    className={`flex shrink-0 items-center gap-1 font-mono text-sm transition-colors ${
                      t.likedByMe ? "text-primary" : "text-muted"
                    } disabled:opacity-40`}
                  >
                    <Heart size={14} fill={t.likedByMe ? "currentColor" : "none"} />
                    {t.likeCount}
                  </button>
                </div>
                {t.description && <p className="mb-2 text-sm text-muted">{t.description}</p>}
              </div>
              <p className="mt-3 flex items-center gap-1.5 font-mono text-xs text-muted">
                by{" "}
                <Link to={`/profile/${t.author.username}`} className="text-accent hover:underline">
                  {t.author.displayName ?? t.author.username}
                </Link>
                <span className="flex items-center gap-1">
                  <PlayCircle size={12} /> {t.playCount}
                </span>
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FeedSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2" aria-hidden="true">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="channel-strip animate-pulse p-5">
          <div className="mb-3 h-4 w-2/3 rounded bg-paper/10" />
          <div className="mb-2 h-3 w-full rounded bg-paper/5" />
          <div className="h-3 w-1/3 rounded bg-paper/5" />
        </div>
      ))}
    </div>
  );
}
