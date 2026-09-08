import { useState, type FormEvent } from "react";
import { Link2, Loader2 } from "lucide-react";
import { api, apiErrorMessage } from "../lib/api";

interface Props {
  onAdded: () => void;
}

export function AddSpotifySong({ onAdded }: Props) {
  const [url, setUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.post("/tracks/spotify", { spotifyUrl: url.trim() });
      setUrl("");
      onAdded();
    } catch (err) {
      setError(apiErrorMessage(err, "Could not add that song"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="channel-strip mb-6 p-4">
      <h2 className="mb-2 flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-muted">
        <Link2 size={14} /> Add a real song from Spotify
      </h2>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <label htmlFor="spotify-url" className="sr-only">Spotify track link</label>
        <input
          id="spotify-url"
          name="spotifyUrl"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://open.spotify.com/track/…"
          className="flex-1 rounded border border-paper/15 bg-bg/60 px-3 py-2 text-sm transition-colors focus:border-primary"
        />
        <button
          type="submit"
          disabled={submitting || !url.trim()}
          className="flex items-center gap-2 rounded bg-neon-gradient px-4 py-2 text-sm font-semibold text-white shadow-glow disabled:opacity-50"
        >
          {submitting ? <Loader2 size={14} className="animate-spin" /> : null}
          {submitting ? "Adding…" : "Add"}
        </button>
      </form>
      {error && <p className="mt-2 text-xs text-alert" role="alert">{error}</p>}
      <p className="mt-2 text-xs text-muted">
        Paste any Spotify track link. Playback uses Spotify's own player — full playback if you're
        logged into Spotify Premium in your browser, otherwise a preview where Spotify allows it.
      </p>
    </div>
  );
}
