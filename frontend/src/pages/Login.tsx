import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Disc3, ArrowRight, Mic2, Zap } from "lucide-react";
import { api, apiErrorMessage } from "../lib/api";
import { useAuthStore } from "../stores/authStore";

export default function Login() {
  const [emailOrUsername, setEmailOrUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const setAuth = useAuthStore((s) => s.setAuth);
  const demoLogin = useAuthStore((s) => s.demoLogin);
  const navigate = useNavigate();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { data } = await api.post("/auth/login", { emailOrUsername, password });
      setAuth(data.user, data.token);
      navigate("/studio");
    } catch (err) {
      setError(apiErrorMessage(err, "Login failed"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDemoLogin() {
    setSubmitting(true);
    setError(null);
    try {
      await demoLogin();
      navigate("/studio");
    } catch (err) {
      setError(apiErrorMessage(err, "Could not start demo session"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="glass-card w-full max-w-md rounded-2xl p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 h-36 w-36 rounded-full bg-accent/20 blur-3xl pointer-events-none" />

        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent/15 text-accent border border-accent/30 shadow-glow">
            <Disc3 size={24} className="animate-spin-slow" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-white">Log In</h1>
            <p className="text-xs text-muted">Welcome to CrowdStudio Audio Console</p>
          </div>
        </div>

        {/* 1-Click Demo Login Banner */}
        <button
          type="button"
          onClick={handleDemoLogin}
          disabled={submitting}
          className="mb-6 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-accent via-primary to-neon p-3.5 text-sm font-bold text-bg shadow-glow hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
        >
          <Zap size={18} fill="currentColor" />
          <span>🚀 1-Click Instant Demo Login</span>
        </button>

        <div className="relative mb-6 text-center">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10" /></div>
          <span className="relative bg-surface px-3 text-xs font-mono text-muted uppercase">or sign in with credentials</span>
        </div>

        {error && (
          <div className="mb-6 rounded-xl bg-alert/20 border border-alert/40 p-3.5 text-sm text-alert font-medium" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label htmlFor="login-id" className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">
              Email or Username
            </label>
            <input
              id="login-id"
              name="identifier"
              autoComplete="username"
              className="w-full rounded-xl border border-white/15 bg-bg/90 px-4 py-3 text-sm text-white transition-all focus:border-accent focus:shadow-glow focus:outline-none"
              placeholder="e.g. demo_producer or musician@example.com"
              value={emailOrUsername}
              onChange={(e) => setEmailOrUsername(e.target.value)}
              required
            />
          </div>

          <div>
            <label htmlFor="login-password" className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">
              Password
            </label>
            <input
              id="login-password"
              name="password"
              type="password"
              autoComplete="current-password"
              className="w-full rounded-xl border border-white/15 bg-bg/90 px-4 py-3 text-sm text-white transition-all focus:border-accent focus:shadow-glow focus:outline-none"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-white/10 border border-white/20 py-3 text-sm font-bold text-white hover:bg-white/20 transition-all disabled:opacity-50"
          >
            {submitting ? "Authenticating…" : "Sign In"} <ArrowRight size={16} />
          </button>
        </form>

        <div className="mt-6 border-t border-white/10 pt-4 text-center space-y-3">
          <p className="text-sm text-muted">
            Don't have an account? <Link to="/register" className="text-accent font-semibold hover:underline">Register here</Link>
          </p>

          <Link
            to="/studio"
            className="inline-flex items-center gap-2 rounded-lg bg-accent/10 border border-accent/30 px-4 py-2 text-xs font-bold text-accent hover:bg-accent/20 transition-colors"
          >
            <Mic2 size={14} /> Open Jam Studio as Guest (No Login Required)
          </Link>
        </div>
      </div>
    </div>
  );
}
