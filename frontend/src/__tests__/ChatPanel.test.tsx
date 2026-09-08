import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChatPanel } from "../components/ChatPanel";
import { useAuthStore } from "../stores/authStore";

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
  useAuthStore.setState({ user: null, token: null, isLoading: false });
});

describe("ChatPanel", () => {
  it("prompts logged-out users to log in instead of showing an input they can't use", () => {
    render(<ChatPanel />);
    expect(screen.getByText(/log in to chat/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/chat message/i)).not.toBeInTheDocument();
  });

  it("renders chat history received on mount", async () => {
    useAuthStore.setState({
      user: { id: "u1", email: "a@b.com", username: "alice", displayName: "Alice" },
      token: "tok",
      isLoading: false,
    });
    render(<ChatPanel />);
    triggerServerEvent("chat-history", [
      { id: "1", username: "bob", body: "hey!", at: new Date().toISOString() },
    ]);
    await waitFor(() => expect(screen.getByText("hey!")).toBeInTheDocument());
  });

  it("appends a live incoming message without needing a page reload", async () => {
    useAuthStore.setState({
      user: { id: "u1", email: "a@b.com", username: "alice", displayName: "Alice" },
      token: "tok",
      isLoading: false,
    });
    render(<ChatPanel />);
    triggerServerEvent("chat-message", { id: "2", username: "bob", body: "nice groove", at: new Date().toISOString() });
    await waitFor(() => expect(screen.getByText("nice groove")).toBeInTheDocument());
  });

  it("sends a message and clears the input", async () => {
    useAuthStore.setState({
      user: { id: "u1", email: "a@b.com", username: "alice", displayName: "Alice" },
      token: "tok",
      isLoading: false,
    });
    render(<ChatPanel />);
    const input = screen.getByLabelText(/chat message/i);
    await userEvent.type(input, "hello room");
    await userEvent.click(screen.getByRole("button"));

    expect(emitMock).toHaveBeenCalledWith("chat-message", { body: "hello room" });
    expect(input).toHaveValue("");
  });

  it("shows the server's flood-guard error message", async () => {
    useAuthStore.setState({
      user: { id: "u1", email: "a@b.com", username: "alice", displayName: "Alice" },
      token: "tok",
      isLoading: false,
    });
    render(<ChatPanel />);
    triggerServerEvent("chat-error", { error: "You're sending messages too fast." });
    await waitFor(() => {
      expect(screen.getByText(/sending messages too fast/i)).toBeInTheDocument();
    });
  });
});
