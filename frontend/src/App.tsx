import { useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { VUMeter } from "./components/VUMeter";
import { useAuthStore } from "./stores/authStore";
import Feed from "./pages/Feed";
import Studio from "./pages/Studio";
import Leaderboard from "./pages/Leaderboard";
import TrackDetail from "./pages/TrackDetail";
import Profile from "./pages/Profile";
import Login from "./pages/Login";
import Register from "./pages/Register";
import NotFound from "./pages/NotFound";

export default function App() {
  const isLoading = useAuthStore((s) => s.isLoading);
  const bootstrapError = useAuthStore((s) => s.bootstrapError);
  const bootstrap = useAuthStore((s) => s.bootstrap);

  // Runs once on app boot: restores a session from localStorage, or
  // silently creates a passwordless guest identity if none exists. There
  // is no login/register wall — every route below is reachable
  // immediately once this resolves.
  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-muted">
        <VUMeter active bars={4} />
        <span className="font-mono text-xs">Starting session…</span>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <AppShell>
        {bootstrapError && (
          <div className="bg-alert/15 px-4 py-2 text-center text-xs text-alert" role="alert">
            {bootstrapError}
          </div>
        )}
        <Routes>
          <Route path="/" element={<Feed />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/tracks/:id" element={<TrackDetail />} />
          <Route path="/profile/:username" element={<Profile />} />
          <Route path="/studio" element={<Studio />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AppShell>
    </BrowserRouter>
  );
}
