import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LiveVoting } from "../components/LiveVoting";

const handlers = new Map<string, (payload: unknown) => void>();
const emitMock = vi.fn();

vi.mock("../lib/socket", () => ({
  getSocket: () => ({
    on: (event: string, cb: (payload: unknown) => void) => handlers.set(event, cb),
    off: (event: string) => handlers.delete(event),
    emit: emitMock,
  }),
}));

function triggerServerEvent(event: string, payload: unknown) {
  act(() => {
    handlers.get(event)?.(payload);
  });
}

beforeEach(() => {
  handlers.clear();
  emitMock.mockClear();
});

describe("LiveVoting", () => {
  it("joins the track's reaction room on mount", () => {
    render(<LiveVoting trackId="t1" />);
    expect(emitMock).toHaveBeenCalledWith("join-track", { trackId: "t1" });
  });

  it("shows a neutral message before any votes come in", () => {
    render(<LiveVoting trackId="t1" />);
    expect(screen.getByText(/be the first to vote/i)).toBeInTheDocument();
  });

  it("updates live counts from a server broadcast", async () => {
    render(<LiveVoting trackId="t1" />);
    triggerServerEvent("track-reactions", { trackId: "t1", counts: { fire: 7, music: 3 } });
    await waitFor(() => {
      expect(screen.getByText("7")).toBeInTheDocument();
      expect(screen.getByText("3")).toBeInTheDocument();
    });
  });

  it("shows which reaction is winning based on live counts", async () => {
    render(<LiveVoting trackId="t1" />);
    triggerServerEvent("track-reactions", { trackId: "t1", counts: { fire: 8, music: 2 } });
    await waitFor(() => {
      expect(screen.getByText(/🔥 is winning/i)).toBeInTheDocument();
    });
  });

  it("ignores reaction updates for a different track (room-scoping check)", async () => {
    render(<LiveVoting trackId="t1" />);
    triggerServerEvent("track-reactions", { trackId: "some-other-track", counts: { fire: 99, music: 99 } });
    await waitFor(() => {
      expect(screen.getByText(/be the first to vote/i)).toBeInTheDocument();
    });
  });

  it("emits a react event when the fire button is clicked", async () => {
    render(<LiveVoting trackId="t1" />);
    const fireButton = screen.getByText("🔥").closest("button")!;
    await userEvent.click(fireButton);
    expect(emitMock).toHaveBeenCalledWith("track-react", { trackId: "t1", type: "fire" });
  });

  it("leaves the room on unmount", () => {
    const { unmount } = render(<LiveVoting trackId="t1" />);
    unmount();
    expect(emitMock).toHaveBeenCalledWith("leave-track", { trackId: "t1" });
  });
});
