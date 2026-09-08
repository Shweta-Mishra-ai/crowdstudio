import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Heart, PlayCircle, Send, Waves, Music4, Sparkles } from "lucide-react";
import { api, apiErrorMessage } from "../lib/api";
import { useAuthStore } from "../stores/authStore";
import { LiveVoting } from "../components/LiveVoting";
import { renderJamToWav } from "../lib/renderJamToWav";
import { DEFAULT_MIXER, type JamParams } from "../hooks/useJamEngine";

interface Track {
  id: string;
  title: string;
  description: string | null;
  kind: "jam" | "spotify";
  jamConfig: JamParams | null;
  spotifyTrackId: string | null;
  spotifyArtist: string | null;
  playCount: number;
  likeCount: number;
  likedByMe: boolean;
  aiExportUrl: string | null;
  aiExportStatus: string;
  author: { username: string; displayName: string | null };
}

interface Comment {
  id: string;
  body: string;
  createdAt: string;
  user: { username: string; displayName: string | null };
}

export default function TrackDetail() {
  const { id } = useParams<{ id: string }>();
  const user = useAuthStore((s) => s.user);
  const [track, setTrack] = useState<Track | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [jamAudioUrl, setJamAudioUrl] = useState<string | null>(null);
  const [renderingJam, setRenderingJam] = useState(false);

  useEffect(() => {
    return () => {
      if (jamAudioUrl) URL.revokeObjectURL(jamAudioUrl);
    };
  }, [jamAudioUrl]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([api.get(`/tracks/${id}`), api.get(`/tracks/${id}/comments`)])
      .then(([trackRes, commentsRes]) => {
        setTrack(trackRes.data.track);
        setComments(commentsRes.data.comments);
        // Record play count on backend asynchronously
        api.post(`/tracks/${id}/play`)
          .then(({ data }) => {
            setTrack((prev) => (prev ? { ...prev, playCount: data.playCount } : null));
          })
          .catch(() => {});
      })
      .catch((err) => setError(apiErrorMessage(err, "Could not load this track")))
      .finally(() => setLoading(false));
  }, [id]);

  async function toggleLike() {
    if (!user || !track) return;
    try {
      const { data } = await api.post(`/tracks/${track.id}/like`);
      setTrack({ ...track, likedByMe: data.liked, likeCount: data.likeCount });
    } catch {
      // Non-critical UI action — fail silently, like state just won't update.
    }
  }

  async function postComment() {
    if (!id || !newComment.trim()) return;
    setPosting(true);
    setCommentError(null);
    try {
      const { data } = await api.post(`/tracks/${id}/comments`, { body: newComment });
      setComments((prev) => [...prev, data.comment]);
      setNewComment("");
    } catch (err) {
      setCommentError(apiErrorMessage(err, "Could not post comment"));
    } finally {
      setPosting(false);
    }
  }

  async function handlePlayJam() {
    if (jamAudioUrl) return;
    if (!track?.jamConfig) return;
    setRenderingJam(true);
    try {
      const blob = await renderJamToWav(track.jamConfig, DEFAULT_MIXER, 8);
      const url = URL.createObjectURL(blob);
      setJamAudioUrl(url);
      api.post(`/tracks/${track.id}/play`).then(({ data }) => {
        setTrack((prev) => (prev ? { ...prev, playCount: data.playCount } : null));
      }).catch(() => {});
    } catch {
      // non-critical audio fallback
    } finally {
      setRenderingJam(false);
    }
  }

  if (loading) return <div className="p-10 text-center text-muted font-mono">Loading track details…</div>;
  if (error || !track) return <div className="p-10 text-center text-alert">{error ?? "Track not found"}</div>;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      <Link to="/" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-accent transition-colors">
        <ArrowLeft size={14} /> Back to feed
      </Link>
      <div className="glass-card mb-6 p-6 rounded-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 h-36 w-36 rounded-full bg-accent/15 blur-3xl pointer-events-none" />

        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="mb-1 font-display text-2xl sm:text-3xl font-bold text-white flex items-center gap-2">
              {track.kind === "spotify" ? (
                <Music4 size={20} className="shrink-0 text-accent" />
              ) : (
                <Waves size={20} className="shrink-0 text-primary" />
              )}
              {track.title}
            </h1>
            {track.kind === "spotify" ? (
              <p className="mb-3 flex items-center gap-1.5 text-sm text-muted font-mono">
                {track.spotifyArtist ? (
                  <span className="text-paper font-semibold">{track.spotifyArtist}</span>
                ) : (
                  <span className="italic">Artist unavailable</span>
                )}
                <span>·</span>
                <span>
                  added by{" "}
                  <Link to={`/profile/${track.author.username}`} className="text-accent hover:underline">
                    {track.author.displayName ?? track.author.username}
                  </Link>
                </span>
              </p>
            ) : (
              <p className="mb-3 flex items-center gap-2 text-sm text-muted font-mono">
                by{" "}
                <Link to={`/profile/${track.author.username}`} className="text-accent hover:underline font-semibold">
                  {track.author.displayName ?? track.author.username}
                </Link>{" "}
                ·{" "}
                <span className="flex items-center gap-1 text-paper">
                  <PlayCircle size={13} className="text-accent" /> {track.playCount} plays
                </span>
              </p>
            )}
          </div>

          <button
            onClick={toggleLike}
            disabled={!user}
            className={`flex items-center gap-1.5 rounded-xl border px-4 py-2 text-sm font-semibold transition-all disabled:opacity-40 shadow-sm ${
              track.likedByMe
                ? "border-primary bg-primary/10 text-primary shadow-glow"
                : "border-white/15 bg-white/5 text-muted hover:border-primary hover:text-primary"
            }`}
          >
            <Heart size={15} fill={track.likedByMe ? "currentColor" : "none"} />
            <span className="font-mono">{track.likeCount}</span> {track.likedByMe ? "Liked" : "Like"}
          </button>
        </div>

        {track.description && <p className="mb-4 text-sm text-paper/80 leading-relaxed">{track.description}</p>}

        {track.kind === "spotify" && track.spotifyTrackId ? (
          <div className="mt-5 rounded-2xl bg-bg/80 border border-white/10 p-4">
            <iframe
              title={`Spotify player — ${track.title}`}
              src={`https://open.spotify.com/embed/track/${track.spotifyTrackId}?theme=0`}
              width="100%"
              height="152"
              style={{ borderRadius: 12, border: "none" }}
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              loading="lazy"
            />
            <p className="mt-2 text-xs text-muted">
              Official Spotify audio embed player — licensed, real audio streaming.
            </p>
          </div>
        ) : (
          <div className="mt-5 rounded-2xl bg-bg/80 border border-white/10 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase tracking-wider text-muted flex items-center gap-1.5">
                <Waves size={15} className="text-accent" /> Synthesized Jam Session
              </span>
              {track.jamConfig?.tempo && (
                <span className="font-mono text-xs text-accent">
                  {track.jamConfig.tempo} BPM · {track.jamConfig.scale}
                </span>
              )}
            </div>

            {jamAudioUrl ? (
              <div className="space-y-2">
                <audio controls autoPlay src={jamAudioUrl} className="w-full" />
                <p className="text-[11px] font-mono text-muted">Tone.js offline rendered audio • playing session in browser</p>
              </div>
            ) : (
              <button
                onClick={handlePlayJam}
                disabled={renderingJam || !track.jamConfig}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-accent to-primary py-3 text-sm font-bold text-bg shadow-glow-cyan hover:brightness-110 disabled:opacity-50 transition-all"
              >
                <PlayCircle size={18} />
                {renderingJam ? "Synthesizing Jam Audio…" : "Play Live Jam Audio"}
              </button>
            )}

            {track.aiExportStatus === "ready" && track.aiExportUrl && (
              <div className="pt-3 border-t border-white/10">
                <span className="text-xs font-semibold text-muted flex items-center gap-1.5 mb-2">
                  <Sparkles size={14} className="text-neon" /> AI Cloud Mastered Render
                </span>
                <audio controls src={track.aiExportUrl} className="w-full" />
              </div>
            )}
            {track.aiExportStatus === "pending" && (
              <p className="text-sm text-muted">AI export is currently rendering…</p>
            )}
          </div>
        )}
      </div>

      <div className="mb-6">
        <LiveVoting trackId={track.id} />
      </div>

      <div className="glass-card p-6 rounded-2xl">
        <h2 className="mb-4 font-display text-lg font-bold text-white">Community Feedback ({comments.length})</h2>
        <div className="mb-5 space-y-3">
          {comments.length === 0 && <p className="text-sm text-muted">No comments yet. Share your thoughts on this jam!</p>}
          {comments.map((c) => (
            <div key={c.id} className="border-b border-white/10 pb-3 text-sm">
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-accent">{c.user.displayName ?? c.user.username}</span>
                <span className="text-xs text-muted font-mono">{new Date(c.createdAt).toLocaleDateString()}</span>
              </div>
              <p className="text-paper/90 text-sm leading-relaxed">{c.body}</p>
            </div>
          ))}
        </div>

        {user ? (
          <div>
            {commentError && <p className="mb-2 text-sm text-alert bg-alert/15 p-2 rounded-lg" role="alert">{commentError}</p>}
            <label htmlFor="new-comment" className="sr-only">Add a comment</label>
            <textarea
              id="new-comment"
              name="comment"
              className="mb-3 w-full rounded-xl border border-white/15 bg-bg/80 px-3.5 py-2.5 text-sm text-white transition-colors focus:border-accent focus:outline-none"
              rows={2}
              maxLength={500}
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Drop a vibe or critique…"
            />
            <button
              onClick={postComment}
              disabled={posting || !newComment.trim()}
              className="flex items-center gap-1.5 rounded-xl bg-white/10 border border-white/20 px-4 py-2 text-sm font-semibold text-white hover:bg-white/20 disabled:opacity-50 transition-all"
            >
              <Send size={14} />
              {posting ? "Posting…" : "Post Comment"}
            </button>
          </div>
        ) : (
          <p className="text-sm text-muted">Log in to leave a comment.</p>
        )}
      </div>
    </div>
  );
}
