import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Trophy, Heart, Flame, Music4, Waves } from "lucide-react";
import { api, apiErrorMessage } from "../lib/api";

interface Entry {
  rank: number;
  trackId: string;
  title: string;
  kind: "jam" | "spotify";
  spotifyArtist: string | null;
  likeCount: number;
  playCount: number;
  author: { username: string; displayName: string | null };
}

export default function Leaderboard() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get("/tracks/leaderboard")
      .then(({ data }) => setEntries(data.leaderboard))
      .catch((err) => setError(apiErrorMessage(err, "Could not load leaderboard")));
  }, []);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="mb-6">
        <h1 className="mb-1 flex items-center gap-2.5 font-display text-2xl font-bold text-white sm:text-3xl">
          <Trophy className="text-amber" size={28} /> Community Leaderboard
        </h1>
        <p className="text-sm text-muted">
          Ranked by a live, time-decayed "hot" algorithm — AI synthesizers and curated Spotify tracks vote together in real time.
        </p>
        <div className="signal-line mt-5" />
      </div>

      {error && <p className="mb-4 font-mono text-sm text-alert bg-alert/15 p-3 rounded-xl">{error}</p>}
      {!error && entries.length === 0 && (
        <div className="glass-card p-10 rounded-2xl text-center text-sm text-muted">
          No ranked tracks yet — save the first jam from Studio to take the top spot!
        </div>
      )}
      <ol className="space-y-2.5">
        {entries.map((e) => (
          <li key={e.trackId}>
            <Link
              to={`/tracks/${e.trackId}`}
              className={`glass-card flex items-center justify-between px-5 py-4 rounded-xl transition-all hover:border-accent/40 ${
                e.rank === 1 ? "border-amber/50 shadow-amberGlow" : e.rank === 2 ? "border-accent/40" : e.rank === 3 ? "border-primary/40" : ""
              }`}
            >
              <span className="flex min-w-0 items-center gap-3.5">
                <span
                  className={`flex w-7 shrink-0 items-center font-mono font-bold text-sm ${
                    e.rank === 1 ? "text-amber" : e.rank === 2 ? "text-accent" : e.rank === 3 ? "text-primary" : "text-muted"
                  }`}
                >
                  {e.rank === 1 ? <Flame size={18} className="fill-amber text-amber" /> : `#${e.rank}`}
                </span>
                <span className="truncate font-semibold text-white">{e.title}</span>
                {e.kind === "spotify" ? (
                  <Music4 size={14} className="shrink-0 text-accent" />
                ) : (
                  <Waves size={14} className="shrink-0 text-primary" />
                )}
                <span className="hidden shrink-0 text-xs text-muted sm:inline font-mono">
                  {e.kind === "spotify"
                    ? e.spotifyArtist ?? "Spotify Song"
                    : `by ${e.author.displayName ?? e.author.username}`}
                </span>
              </span>
              <div className="flex shrink-0 items-center gap-3 font-mono text-xs">
                <span className="flex items-center gap-1 text-accent">
                  <Flame size={13} /> {e.playCount} plays
                </span>
                <span className="flex items-center gap-1 text-primary font-bold">
                  <Heart size={13} fill="currentColor" /> {e.likeCount}
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
