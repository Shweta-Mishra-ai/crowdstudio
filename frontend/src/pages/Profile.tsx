import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Heart, PlayCircle, Edit3, Save, X, User as UserIcon } from "lucide-react";
import { api, apiErrorMessage } from "../lib/api";
import { useAuthStore } from "../stores/authStore";

interface ProfileData {
  id: string;
  username: string;
  displayName: string | null;
  bio: string | null;
  trackCount: number;
  createdAt: string;
}

interface ProfileTrack {
  id: string;
  title: string;
  playCount: number;
  likeCount: number;
  commentCount: number;
}

export default function Profile() {
  const { username } = useParams<{ username: string }>();
  const currentUser = useAuthStore((s) => s.user);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [tracks, setTracks] = useState<ProfileTrack[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Edit profile state
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const isOwnProfile = currentUser && profile && currentUser.username === profile.username;

  useEffect(() => {
    if (!username) return;
    setLoading(true);
    api
      .get(`/users/${username}`)
      .then(({ data }) => {
        setProfile(data.user);
        setTracks(data.tracks);
        setDisplayName(data.user.displayName ?? "");
        setBio(data.user.bio ?? "");
      })
      .catch((err) => setError(apiErrorMessage(err, "Could not load this profile")))
      .finally(() => setLoading(false));
  }, [username]);

  async function handleSaveProfile() {
    setSaving(true);
    setSaveError(null);
    try {
      const { data } = await api.patch("/users/me", { displayName, bio });
      setProfile((prev) => (prev ? { ...prev, displayName: data.user.displayName, bio: data.user.bio } : null));
      // update currentUser displayName in authStore as well
      if (currentUser) {
        useAuthStore.getState().setAuth(
          { ...currentUser, displayName: data.user.displayName },
          useAuthStore.getState().token || ""
        );
      }
      setIsEditing(false);
    } catch (err) {
      setSaveError(apiErrorMessage(err, "Could not save profile"));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-10 text-center text-muted font-mono">Loading profile…</div>;
  if (error || !profile) return <div className="p-10 text-center text-alert">{error ?? "User not found"}</div>;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="glass-card mb-8 p-6 rounded-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 h-32 w-32 rounded-full bg-primary/10 blur-2xl pointer-events-none" />

        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface/90 border border-white/10 shadow-glow">
              <UserIcon size={28} className="text-accent" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold text-white">
                {profile.displayName ?? profile.username}
              </h1>
              <p className="text-sm font-mono text-muted">
                @{profile.username} · <span className="text-accent font-semibold">{profile.trackCount} tracks</span>
              </p>
            </div>
          </div>
          {isOwnProfile && !isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3.5 py-2 text-xs font-semibold text-paper hover:border-accent hover:text-accent transition-all shadow-sm"
            >
              <Edit3 size={13} /> Edit Profile
            </button>
          )}
        </div>

        {isEditing ? (
          <div className="mt-5 border-t border-white/10 pt-5 space-y-3">
            {saveError && <p className="text-xs text-alert bg-alert/15 p-2.5 rounded-lg">{saveError}</p>}
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">Display Name</label>
              <input
                className="w-full rounded-xl border border-white/15 bg-bg/80 px-3.5 py-2 text-sm text-white focus:border-accent focus:outline-none"
                value={displayName}
                maxLength={50}
                placeholder="Your producer or stage name"
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">Bio</label>
              <textarea
                className="w-full rounded-xl border border-white/15 bg-bg/80 px-3.5 py-2 text-sm text-white focus:border-accent focus:outline-none"
                rows={3}
                maxLength={280}
                placeholder="Tell the community about your sound, instruments, or inspirations..."
                value={bio}
                onChange={(e) => setBio(e.target.value)}
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleSaveProfile}
                disabled={saving}
                className="flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-xs font-bold text-bg hover:brightness-110 disabled:opacity-50 transition-all shadow-glow-cyan"
              >
                <Save size={13} /> {saving ? "Saving…" : "Save Profile"}
              </button>
              <button
                onClick={() => setIsEditing(false)}
                className="flex items-center gap-1.5 rounded-xl border border-white/15 px-3.5 py-2 text-xs font-semibold text-muted hover:text-paper transition-colors"
              >
                <X size={13} /> Cancel
              </button>
            </div>
          </div>
        ) : (
          profile.bio && <p className="mt-4 text-sm text-paper/90 leading-relaxed border-t border-white/5 pt-4">{profile.bio}</p>
        )}
      </div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-xl font-bold text-white">Tracks by {profile.displayName ?? profile.username}</h2>
        <span className="font-mono text-xs text-muted">{tracks.length} published</span>
      </div>

      <div className="space-y-3">
        {tracks.length === 0 && (
          <div className="channel-strip p-8 text-center text-sm text-muted">
            No tracks published yet.
          </div>
        )}
        {tracks.map((t) => (
          <Link
            key={t.id}
            to={`/tracks/${t.id}`}
            className="glass-card block px-5 py-4 rounded-xl transition-all hover:border-accent/40"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="font-semibold text-paper hover:text-accent transition-colors">{t.title}</span>
              <span className="flex shrink-0 items-center gap-4 font-mono text-xs text-muted">
                <span className="flex items-center gap-1 text-primary"><Heart size={13} fill="currentColor" /> {t.likeCount}</span>
                <span className="flex items-center gap-1 text-accent"><PlayCircle size={13} /> {t.playCount}</span>
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
