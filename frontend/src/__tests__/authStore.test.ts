import { describe, it, expect, beforeEach, vi } from "vitest";
import { useAuthStore } from "../stores/authStore";
import { api } from "../lib/api";

vi.mock("../lib/api", async () => {
  const actual = await vi.importActual<typeof import("../lib/api")>("../lib/api");
  return { ...actual, api: { post: vi.fn() } };
});

const mockedApi = api as unknown as { post: ReturnType<typeof vi.fn> };

beforeEach(() => {
  localStorage.clear();
  mockedApi.post.mockReset();
  useAuthStore.setState({ user: null, token: null, isLoading: true, bootstrapError: null });
});

describe("authStore", () => {
  it("starts in a loading state before bootstrap resolves", () => {
    expect(useAuthStore.getState().isLoading).toBe(true);
    expect(useAuthStore.getState().user).toBeNull();
  });

  it("bootstrap() restores a session from localStorage without calling the backend", async () => {
    const user = { id: "1", email: "a@b.com", username: "alice", displayName: "Alice" };
    localStorage.setItem("crowdjam_token", "tok123");
    localStorage.setItem("crowdjam_user", JSON.stringify(user));

    await useAuthStore.getState().bootstrap();

    const state = useAuthStore.getState();
    expect(state.isLoading).toBe(false);
    expect(state.token).toBe("tok123");
    expect(state.user).toEqual(user);
    expect(mockedApi.post).not.toHaveBeenCalled();
  });

  it("bootstrap() creates a guest identity when nothing is stored — this is what replaces the login wall", async () => {
    const guestUser = { id: "g1", email: "guest_abc@guest.crowdjam.local", username: "guest_abc", displayName: "Guest" };
    mockedApi.post.mockResolvedValue({ data: { user: guestUser, token: "guest-tok" } });

    await useAuthStore.getState().bootstrap();

    expect(mockedApi.post).toHaveBeenCalledWith("/auth/guest");
    const state = useAuthStore.getState();
    expect(state.isLoading).toBe(false);
    expect(state.user).toEqual(guestUser);
    expect(localStorage.getItem("crowdjam_token")).toBe("guest-tok");
  });

  it("bootstrap() clears corrupted localStorage and falls back to a fresh guest instead of crashing", async () => {
    localStorage.setItem("crowdjam_token", "tok123");
    localStorage.setItem("crowdjam_user", "{not valid json");
    mockedApi.post.mockResolvedValue({
      data: { user: { id: "g2", email: "x@y.z", username: "guest_x", displayName: "Guest" }, token: "new-tok" },
    });

    await expect(useAuthStore.getState().bootstrap()).resolves.not.toThrow();
    expect(useAuthStore.getState().user?.username).toBe("guest_x");
  });

  it("bootstrap() surfaces an error instead of leaving the app silently broken when the backend is unreachable", async () => {
    mockedApi.post.mockRejectedValue(new Error("Network Error"));

    await useAuthStore.getState().bootstrap();

    const state = useAuthStore.getState();
    expect(state.isLoading).toBe(false);
    expect(state.user).toBeNull();
    expect(state.bootstrapError).toMatch(/could not reach the server/i);
  });

  it("resetIdentity() clears the current session and bootstraps a new guest", async () => {
    useAuthStore.getState().setAuth(
      { id: "1", email: "a@b.com", username: "alice", displayName: null },
      "tok123"
    );
    mockedApi.post.mockResolvedValue({
      data: { user: { id: "g3", email: "x@y.z", username: "guest_new", displayName: "Guest" }, token: "fresh-tok" },
    });

    await useAuthStore.getState().resetIdentity();

    const state = useAuthStore.getState();
    expect(state.user?.username).toBe("guest_new");
    expect(localStorage.getItem("crowdjam_token")).toBe("fresh-tok");
  });
});
