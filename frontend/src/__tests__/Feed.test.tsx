import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { AxiosError } from "axios";
import Feed from "../pages/Feed";
import { api } from "../lib/api";
import { useAuthStore } from "../stores/authStore";

vi.mock("../lib/api", async () => {
  const actual = await vi.importActual<typeof import("../lib/api")>("../lib/api");
  return {
    ...actual,
    api: { get: vi.fn(), post: vi.fn() },
  };
});

vi.mock("../hooks/usePresence", () => ({
  usePresence: () => ({ totalOnline: 0, inJamRoom: 0, usernames: [], connected: true }),
}));

const mockedApi = api as unknown as { get: ReturnType<typeof vi.fn>; post: ReturnType<typeof vi.fn> };

function renderFeed() {
  return render(
    <MemoryRouter>
      <Feed />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ user: null, token: null, isLoading: false });
});

describe("Feed", () => {
  it("shows the backend's specific error message on failure, not a generic one", async () => {
    const err = new AxiosError("Request failed");
    err.response = {
      data: { error: "Database temporarily unavailable" },
      status: 500,
      statusText: "",
      headers: {},
      config: {} as never,
    };
    mockedApi.get.mockRejectedValue(err);
    renderFeed();
    await waitFor(() => {
      expect(screen.getByText(/database temporarily unavailable/i)).toBeInTheDocument();
    });
  });

  it("shows an actionable empty state when there are no tracks", async () => {
    mockedApi.get.mockResolvedValue({ data: { tracks: [] } });
    renderFeed();
    await waitFor(() => {
      expect(screen.getByText(/nothing here yet/i)).toBeInTheDocument();
    });
    expect(screen.getByRole("link", { name: /go to jam studio/i })).toHaveAttribute("href", "/studio");
  });

  it("renders tracks and disables the like button for logged-out users", async () => {
    mockedApi.get.mockResolvedValue({
      data: {
        tracks: [
          {
            id: "t1",
            title: "Late Night Jam",
            description: null,
            playCount: 3,
            likeCount: 2,
            likedByMe: false,
            author: { username: "alice", displayName: "Alice" },
          },
        ],
      },
    });
    renderFeed();
    await waitFor(() => {
      expect(screen.getByText("Late Night Jam")).toBeInTheDocument();
    });
    const likeButton = screen.getByRole("button", { name: /2/ });
    expect(likeButton).toBeDisabled();
  });

  it("lets a logged-in user toggle a like and updates the count from the response", async () => {
    mockedApi.get.mockResolvedValue({
      data: {
        tracks: [
          {
            id: "t1",
            title: "Late Night Jam",
            description: null,
            playCount: 3,
            likeCount: 2,
            likedByMe: false,
            author: { username: "alice", displayName: "Alice" },
          },
        ],
      },
    });
    mockedApi.post.mockResolvedValue({ data: { liked: true, likeCount: 3 } });
    useAuthStore.setState({
      user: { id: "u1", email: "a@b.com", username: "bob", displayName: "Bob" },
      token: "tok",
      isLoading: false,
    });

    renderFeed();
    await waitFor(() => expect(screen.getByText("Late Night Jam")).toBeInTheDocument());

    const likeButton = screen.getByRole("button", { name: /2/ });
    expect(likeButton).toBeEnabled();
    await userEvent.click(likeButton);

    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith("/tracks/t1/like");
      expect(screen.getByRole("button", { name: /3/ })).toBeInTheDocument();
    });
  });
});
