import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Heart, PlayCircle, Send } from "lucide-react";
import { api, apiErrorMessage } from "../lib/api";
import { useAuthStore } from "../stores/authStore";
import { LiveVoting } from "../components/LiveVoting";

interface Track {
  id: string;
  title: string;
  description: string | null;
  kind: "jam" | "spotify";
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

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([api.get(`/tracks/${id}`), api.get(`/tracks/${id}/comments`)])
      .then(([trackRes, commentsRes]) => {
        setTrack(trackRes.data.track);
        setComments(commentsRes.data.comments);
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

  if (loading) return <div className="p-10 text-center text-muted">Loading…</div>;
  if (error || !track) return <div className="p-10 text-center text-alert">{error ?? "Track not found"}</div>;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-10">
      <Link to="/" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-primary">
        <ArrowLeft size={14} /> Back to feed
      </Link>
      <div className="channel-strip mb-6 p-6">
        <h1 className="mb-1 font-display text-2xl font-semibold text-primary">{track.title}</h1>
        <p className="mb-4 flex items-center gap-1.5 text-sm text-muted">
          by {track.author.displayName ?? track.author.username} ·{" "}
          <span className="flex items-center gap-1 font-mono"><PlayCircle size={13} /> {track.playCount}</span>
        </p>
        {track.description && <p className="mb-4 text-sm">{track.description}</p>}

        <button
          onClick={toggleLike}
          disabled={!user}
          className={`flex items-center gap-1.5 rounded border px-4 py-2 text-sm transition-colors disabled:opacity-40 ${
            track.likedByMe ? "border-primary text-primary" : "border-paper/15 text-muted"
          }`}
        >
          <Heart size={15} fill={track.likedByMe ? "currentColor" : "none"} />
          <span className="font-mono">{track.likeCount}</span> {track.likedByMe ? "Liked" : "Like"}
        </button>

        {track.kind === "spotify" && track.spotifyTrackId ? (
          <div className="mt-4">
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
              Playing via Spotify's own embedded player — real audio, real licensing, nothing
              proxied or re-hosted here.
            </p>
          </div>
        ) : (
          <>
            {track.aiExportStatus === "ready" && track.aiExportUrl && (
              <audio controls src={track.aiExportUrl} className="mt-4 w-full" />
            )}
            {track.aiExportStatus === "pending" && (
              <p className="mt-4 text-sm text-muted">AI export rendering…</p>
            )}
            {track.aiExportStatus === "failed" && (
              <p className="mt-4 text-sm text-alert">AI export failed — try again from the studio.</p>
            )}
          </>
        )}
      </div>

      <div className="mb-6">
        <LiveVoting trackId={track.id} />
      </div>

      <div className="channel-strip p-6">
        <h2 className="mb-4 font-semibold">Comments ({comments.length})</h2>
        <div className="mb-4 space-y-3">
          {comments.length === 0 && <p className="text-sm text-muted">No comments yet.</p>}
          {comments.map((c) => (
            <div key={c.id} className="border-b border-paper/10 pb-2 text-sm">
              <span className="text-primary">{c.user.displayName ?? c.user.username}</span>{" "}
              <span className="text-muted">{new Date(c.createdAt).toLocaleDateString()}</span>
              <p>{c.body}</p>
            </div>
          ))}
        </div>

        {user ? (
          <div>
            {commentError && <p className="mb-2 text-sm text-alert" role="alert">{commentError}</p>}
            <label htmlFor="new-comment" className="sr-only">Add a comment</label>
            <textarea
              id="new-comment"
              name="comment"
              className="mb-2 w-full rounded border border-paper/15 bg-bg/60 px-3 py-2 text-sm transition-colors focus:border-primary"
              rows={2}
              maxLength={500}
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Add a comment…"
            />
            <button
              onClick={postComment}
              disabled={posting || !newComment.trim()}
              className="flex items-center gap-1.5 rounded bg-primary px-4 py-1.5 text-sm font-semibold text-bg disabled:opacity-50"
            >
              <Send size={13} />
              {posting ? "Posting…" : "Post"}
            </button>
          </div>
        ) : (
          <p className="text-sm text-muted">
            Couldn't start a session, so commenting isn't available right now — try refreshing.
          </p>
        )}
      </div>
    </div>
  );
}
