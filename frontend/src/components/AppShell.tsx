import { NavLink, useNavigate } from "react-router-dom";
import type { ReactNode } from "react";
import { Home, Trophy, Mic2, User, LogOut, LogIn, Radio } from "lucide-react";
import { useAuthStore } from "../stores/authStore";
import { usePresence } from "../hooks/usePresence";
import { VUMeter } from "./VUMeter";

const navItems = [
  { to: "/", label: "Feed", icon: Home, end: true },
  { to: "/leaderboard", label: "Leaderboard", icon: Trophy, end: true },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuthStore();
  const presence = usePresence();
  const navigate = useNavigate();

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
      isActive ? "bg-primary/15 text-primary" : "text-muted hover:bg-paper/5 hover:text-paper"
    }`;

  return (
    <div className="flex min-h-screen">
      {/* Sidebar — the app-shell pattern real platforms use (Spotify,
          Linear, most DAWs), replacing what used to be a single thin top
          navbar with plain text links. */}
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
            <NavLink to="/studio" className={linkClass}>
              <Mic2 size={18} />
              Jam Studio
            </NavLink>
          )}
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
          {user ? (
            <button
              onClick={() => {
                logout();
                navigate("/login");
              }}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted transition-colors hover:bg-paper/5 hover:text-paper"
            >
              <LogOut size={18} />
              Log out
            </button>
          ) : (
            <NavLink to="/login" className={linkClass}>
              <LogIn size={18} />
              Log in
            </NavLink>
          )}
        </div>
      </aside>

      {/* Mobile top bar — sidebar collapses on small screens, condensed
          header takes its place instead of being squeezed in. */}
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
            {user ? (
              <>
                <NavLink to="/studio" className="text-muted">
                  <Mic2 size={18} />
                </NavLink>
                <NavLink to={`/profile/${user.username}`} className="text-muted">
                  <User size={18} />
                </NavLink>
                <button onClick={() => { logout(); navigate("/login"); }} className="text-muted">
                  <LogOut size={18} />
                </button>
              </>
            ) : (
              <NavLink to="/login" className="text-muted">
                <LogIn size={18} />
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
