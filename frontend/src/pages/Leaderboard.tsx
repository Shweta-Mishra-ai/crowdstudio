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
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-10">
      <h1 className="mb-1 flex items-center gap-2 font-display text-2xl font-semibold text-primary sm:text-3xl">
        <Trophy className="text-primary" size={26} /> Leaderboard
      </h1>
      <p className="mb-6 text-sm text-muted">
        Ranked by a live, time-decayed "hot" score — jams and real Spotify songs vote together, so
        trending tracks can actually surface instead of old favorites freezing the board.
      </p>
      {error && <p className="mb-4 font-mono text-sm text-alert">{error}</p>}
      {!error && entries.length === 0 && (
        <div className="channel-strip p-8 text-center text-sm text-muted">
          No ranked tracks yet — the first saved jam takes the top spot.
        </div>
      )}
      <ol className="space-y-2">
        {entries.map((e) => (
          <li key={e.trackId}>
            <Link
              to={`/tracks/${e.trackId}`}
              className={`channel-strip flex items-center justify-between px-4 py-3 transition-colors hover:border-primary/40 ${
                e.rank === 1 ? "border-primary/50" : ""
              }`}
            >
              <span className="flex min-w-0 items-center gap-3">
                <span
                  className={`flex w-6 shrink-0 items-center font-mono text-sm ${
                    e.rank <= 3 ? "text-primary" : "text-muted"
                  }`}
                >
                  {e.rank === 1 ? <Flame size={16} className="fill-primary" /> : `#${e.rank}`}
                </span>
                <span className="truncate text-paper">{e.title}</span>
                {e.kind === "spotify" ? (
                  <Music4 size={12} className="shrink-0 text-accent" />
                ) : (
                  <Waves size={12} className="shrink-0 text-primary" />
                )}
                <span className="hidden shrink-0 text-sm text-muted sm:inline">
                  {e.kind === "spotify"
                    ? e.spotifyArtist ?? "unknown artist"
                    : `by ${e.author.displayName ?? e.author.username}`}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-1 font-mono text-sm text-primary">
                <Heart size={13} fill="currentColor" /> {e.likeCount}
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
