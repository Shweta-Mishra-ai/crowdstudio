import { NavLink, useNavigate } from "react-router-dom";
import type { ReactNode } from "react";
import { Home, Trophy, Mic2, User, RefreshCw, Disc3, LogOut, LogIn, Zap } from "lucide-react";
import { useAuthStore } from "../stores/authStore";
import { usePresence } from "../hooks/usePresence";
import { VUMeter } from "./VUMeter";

const navItems = [
  { to: "/", label: "Feed", icon: Home, end: true },
  { to: "/leaderboard", label: "Leaderboard", icon: Trophy, end: true },
  { to: "/studio", label: "Jam Studio", icon: Mic2, end: false },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { user, resetIdentity, logout, demoLogin } = useAuthStore();
  const presence = usePresence();
  const navigate = useNavigate();

  const isGuest = !user || user.username.startsWith("guest_") || user.displayName === "Guest";

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-all ${
      isActive
        ? "bg-accent/15 text-accent border border-accent/30 shadow-glow-cyan"
        : "text-muted hover:bg-white/5 hover:text-paper"
    }`;

  async function handleQuickDemo() {
    try {
      await demoLogin();
      navigate("/studio");
    } catch {
      navigate("/login");
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* Sidebar Navigation */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-white/10 bg-surface/90 backdrop-blur-xl px-5 py-6 sm:flex">
        {/* Brand Logo Header */}
        <NavLink to="/" className="mb-8 flex items-center gap-3 px-1 group">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-accent via-primary to-neon shadow-glow group-hover:scale-105 transition-transform">
            <Disc3 className="text-bg animate-spin-slow" size={22} />
          </div>
          <div>
            <span className="font-display text-xl font-bold tracking-tight text-white">
              Crowd<span className="neon-text-cyan">Studio</span>
            </span>
            <span className="block text-[9px] font-mono text-muted tracking-widest uppercase">AUDIO ENGINE</span>
          </div>
        </NavLink>

        {/* Navigation Links */}
        <nav className="flex flex-1 flex-col gap-1.5">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={linkClass}>
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}
          {user && (
            <NavLink to={`/profile/${user.username}`} className={linkClass}>
              <User size={18} />
              Profile
            </NavLink>
          )}
        </nav>

        {/* Presence & User Identity Drawer */}
        <div className="mt-auto space-y-3.5 border-t border-white/10 pt-4">
          <div className="flex items-center justify-between rounded-xl bg-bg/80 border border-white/10 px-3 py-2 font-mono text-xs text-muted">
            <div className="flex items-center gap-2">
              <VUMeter active={presence.connected} bars={3} />
              <span>{presence.connected ? `${presence.totalOnline} live online` : "reconnecting…"}</span>
            </div>
            {presence.connected && (
              <span className="inline-block h-2 w-2 rounded-full bg-accent animate-pulse" />
            )}
          </div>

          {isGuest ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2 px-1">
                <span className="truncate font-mono text-xs text-muted">
                  Guest Session ({user?.username?.slice(0, 10) ?? "anon"})
                </span>
                <button
                  onClick={() => resetIdentity()}
                  title="New guest session"
                  className="rounded p-1 text-muted transition-colors hover:text-accent"
                >
                  <RefreshCw size={13} />
                </button>
              </div>
              <div className="flex gap-1.5">
                <button
                  onClick={handleQuickDemo}
                  title="Instant 1-Click Demo Login"
                  className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-gradient-to-r from-accent to-primary py-2 text-xs font-bold text-bg shadow-glow-cyan hover:brightness-110 transition-all"
                >
                  <Zap size={13} fill="currentColor" /> Demo Login
                </button>
                <NavLink
                  to="/login"
                  className="flex items-center justify-center rounded-xl border border-white/15 bg-white/5 px-2.5 py-2 text-xs font-semibold text-paper hover:border-accent hover:text-accent transition-all"
                >
                  <LogIn size={13} />
                </NavLink>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2 px-1">
                <div className="truncate">
                  <span className="block truncate font-semibold text-xs text-white">
                    {user?.displayName ?? user?.username}
                  </span>
                  <span className="block truncate font-mono text-[10px] text-muted">
                    @{user?.username}
                  </span>
                </div>
                <button
                  onClick={() => {
                    logout();
                    navigate("/login");
                  }}
                  title="Log out"
                  className="rounded p-1.5 text-muted transition-colors hover:text-alert"
                >
                  <LogOut size={15} />
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Mobile Top Navigation */}
      <div className="flex flex-1 flex-col">
        <header className="glass flex items-center justify-between px-4 py-3 sm:hidden">
          <NavLink to="/" className="flex items-center gap-2 font-display text-lg font-bold">
            <Disc3 className="text-accent animate-spin-slow" size={20} />
            <span className="text-white">Crowd<span className="neon-text-cyan">Studio</span></span>
          </NavLink>
          <div className="flex items-center gap-3 text-sm">
            <NavLink to="/leaderboard" className="text-muted hover:text-paper">
              <Trophy size={18} />
            </NavLink>
            <NavLink to="/studio" className="text-muted hover:text-accent">
              <Mic2 size={18} />
            </NavLink>
            {user && (
              <NavLink to={`/profile/${user.username}`} className="text-muted hover:text-paper">
                <User size={18} />
              </NavLink>
            )}
            {isGuest ? (
              <NavLink to="/login" className="text-accent text-xs font-bold">
                Log In
              </NavLink>
            ) : (
              <button onClick={() => { logout(); navigate("/login"); }} className="text-alert">
                <LogOut size={16} />
              </button>
            )}
          </div>
        </header>
        <div className="signal-line sm:hidden" />

        <main className="flex flex-1 flex-col">{children}</main>
      </div>
    </div>
  );
}
