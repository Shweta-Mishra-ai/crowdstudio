import { NavLink } from "react-router-dom";
import type { ReactNode } from "react";
import { Home, Trophy, Mic2, User, RefreshCw, Radio } from "lucide-react";
import { useAuthStore } from "../stores/authStore";
import { usePresence } from "../hooks/usePresence";
import { VUMeter } from "./VUMeter";

const navItems = [
  { to: "/", label: "Feed", icon: Home, end: true },
  { to: "/leaderboard", label: "Leaderboard", icon: Trophy, end: true },
  { to: "/studio", label: "Jam Studio", icon: Mic2, end: false },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const resetIdentity = useAuthStore((s) => s.resetIdentity);
  const presence = usePresence();

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
      isActive ? "bg-primary/15 text-primary" : "text-muted hover:bg-paper/5 hover:text-paper"
    }`;

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-paper/10 bg-surface/60 px-4 py-6 sm:flex">
        <div className="mb-8 flex items-center gap-2 px-2">
          <Radio className="text-primary" size={22} />
          <span className="font-display text-lg font-semibold tracking-tight neon-text">
            CrowdJam
          </span>
        </div>

        <nav className="flex flex-1 flex-col gap-1">
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

        <div className="mt-auto space-y-3 border-t border-paper/10 pt-4">
          <div className="flex items-center gap-2 px-2 font-mono text-xs text-muted">
            <VUMeter active={presence.connected} bars={3} />
            {presence.connected ? `${presence.totalOnline} live` : "reconnecting…"}
          </div>
          {user && (
            <div className="flex items-center justify-between gap-2 px-2">
              <span className="truncate font-mono text-xs text-muted" title={user.username}>
                {user.displayName ?? user.username}
              </span>
              <button
                onClick={() => resetIdentity()}
                title="Start a fresh guest identity"
                className="shrink-0 rounded p-1 text-muted transition-colors hover:text-primary"
              >
                <RefreshCw size={14} />
              </button>
            </div>
          )}
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="glass flex items-center justify-between px-4 py-3 sm:hidden">
          <NavLink to="/" className="flex items-center gap-2 font-display text-lg font-semibold">
            <Radio size={20} className="text-primary" />
            <span className="neon-text">CrowdJam</span>
          </NavLink>
          <div className="flex items-center gap-3 text-sm">
            <NavLink to="/leaderboard" className="text-muted">
              <Trophy size={18} />
            </NavLink>
            <NavLink to="/studio" className="text-muted">
              <Mic2 size={18} />
            </NavLink>
            {user && (
              <NavLink to={`/profile/${user.username}`} className="text-muted">
                <User size={18} />
              </NavLink>
            )}
          </div>
        </header>
        <div className="signal-line sm:hidden" />

        <main className="flex flex-1 flex-col">{children}</main>
      </div>
    </div>
  );
}
