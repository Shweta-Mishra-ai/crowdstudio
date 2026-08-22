import { create } from "zustand";
import { api } from "../lib/api";

export interface User {
  id: string;
  email: string;
  username: string;
  displayName: string | null;
}

interface AuthState {
  user: User | null;
  token: string | null;
  // True until we've either restored a session from localStorage or
  // finished creating a fresh guest one. Pages must wait for this before
  // treating `user` as final — checking `user` alone on the very first
  // render (before either path resolves) is what caused an old bug where
  // a logged-in user got bounced off a protected page on refresh.
  isLoading: boolean;
  bootstrapError: string | null;
  setAuth: (user: User, token: string) => void;
  /**
   * Restores a session from localStorage if one exists; otherwise silently
   * creates a passwordless guest identity via POST /auth/guest. This is
   * what removed the login/register wall — every visitor gets a real,
   * stable identity (for track authorship, likes, chat) without ever
   * seeing a login form. Idempotent per browser: the guest identity is
   * persisted to localStorage just like a real login, so refreshing the
   * page reuses the same guest instead of creating a new one every time.
   */
  bootstrap: () => Promise<void>;
  /** Discards the current identity (guest or real) and bootstraps a fresh
   * guest one — the closest equivalent to "log out" now that there's no
   * login screen to send someone back to. */
  resetIdentity: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isLoading: true,
  bootstrapError: null,

  setAuth: (user, token) => {
    localStorage.setItem("crowdjam_token", token);
    localStorage.setItem("crowdjam_user", JSON.stringify(user));
    set({ user, token, isLoading: false, bootstrapError: null });
  },

  bootstrap: async () => {
    const token = localStorage.getItem("crowdjam_token");
    const userRaw = localStorage.getItem("crowdjam_user");
    if (token && userRaw) {
      try {
        const user = JSON.parse(userRaw) as User;
        set({ user, token, isLoading: false });
        return;
      } catch {
        // corrupted storage, fall through to clear + create a fresh guest
        localStorage.removeItem("crowdjam_token");
        localStorage.removeItem("crowdjam_user");
      }
    }

    try {
      const { data } = await api.post("/auth/guest");
      get().setAuth(data.user, data.token);
    } catch {
      // No backend reachable / guest creation failed — surface this
      // instead of silently leaving the app in a broken, unexplained
      // "nothing works" state. The app still renders; features that need
      // an identity (saving jams, liking, chat) will show their own errors.
      set({
        user: null,
        token: null,
        isLoading: false,
        bootstrapError: "Could not reach the server to start a session. Some features may not work.",
      });
    }
  },

  resetIdentity: async () => {
    localStorage.removeItem("crowdjam_token");
    localStorage.removeItem("crowdjam_user");
    set({ user: null, token: null, isLoading: true, bootstrapError: null });
    await get().bootstrap();
  },
}));
