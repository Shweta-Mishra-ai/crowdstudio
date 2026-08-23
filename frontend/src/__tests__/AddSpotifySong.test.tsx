import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AxiosError } from "axios";
import { AddSpotifySong } from "../components/AddSpotifySong";
import { api } from "../lib/api";

vi.mock("../lib/api", async () => {
  const actual = await vi.importActual<typeof import("../lib/api")>("../lib/api");
  return { ...actual, api: { post: vi.fn() } };
});

const mockedApi = api as unknown as { post: ReturnType<typeof vi.fn> };

beforeEach(() => {
  mockedApi.post.mockReset();
});

describe("AddSpotifySong", () => {
  it("submits the pasted URL and calls onAdded on success", async () => {
    mockedApi.post.mockResolvedValue({ data: { track: { id: "t1" } } });
    const onAdded = vi.fn();
    render(<AddSpotifySong onAdded={onAdded} />);

    const input = screen.getByLabelText(/spotify track link/i);
    await userEvent.type(input, "https://open.spotify.com/track/abc123");
    await userEvent.click(screen.getByRole("button", { name: /add/i }));

    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith("/tracks/spotify", {
        spotifyUrl: "https://open.spotify.com/track/abc123",
      });
      expect(onAdded).toHaveBeenCalled();
    });
    expect(input).toHaveValue("");
  });

  it("shows the backend's specific error message on failure", async () => {
    const err = new AxiosError("Request failed");
    err.response = {
      data: { error: "That doesn't look like a Spotify track link" },
      status: 400,
      statusText: "",
      headers: {},
      config: {} as never,
    };
    mockedApi.post.mockRejectedValue(err);
    render(<AddSpotifySong onAdded={vi.fn()} />);

    await userEvent.type(screen.getByLabelText(/spotify track link/i), "not a real link");
    await userEvent.click(screen.getByRole("button", { name: /add/i }));

    await waitFor(() => {
      expect(screen.getByText(/doesn't look like a spotify track link/i)).toBeInTheDocument();
    });
  });

  it("disables the submit button while the input is empty", () => {
    render(<AddSpotifySong onAdded={vi.fn()} />);
    expect(screen.getByRole("button", { name: /add/i })).toBeDisabled();
  });
});
