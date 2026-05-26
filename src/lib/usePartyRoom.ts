"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import PartySocket from "partysocket";
import type { ClientMessage, RoomState, ServerMessage } from "./quizProtocol";

/**
 * Thin wrapper around partysocket that connects to a single quiz room
 * and exposes:
 *   - `state`: latest RoomState snapshot from the server.
 *   - `send`: typed message sender. No-op while disconnected.
 *   - `error`: most recent server-sent error reason, or null.
 *   - `kicked`: true after the server has sent a kick before closing.
 *   - `connected`: live WebSocket readyState === OPEN.
 *   - `myId`: this connection's id (sent by server in the "identity"
 *     message that fires after a successful host-claim or join). Used
 *     to locate "me" in state.participants without name-matching.
 *
 * All three role pages share this hook — differences live only in which
 * messages they send and which parts of `state` they render.
 */
export function usePartyRoom(roomCode: string | null): {
  state: RoomState | null;
  send: (msg: ClientMessage) => void;
  error: string | null;
  kicked: boolean;
  connected: boolean;
  myId: string | null;
} {
  const [state, setState] = useState<RoomState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [kicked, setKicked] = useState(false);
  const [connected, setConnected] = useState(false);
  const [myId, setMyId] = useState<string | null>(null);
  const socketRef = useRef<PartySocket | null>(null);

  useEffect(() => {
    if (!roomCode) return;
    const host =
      process.env.NEXT_PUBLIC_PARTYKIT_HOST ??
      (typeof window !== "undefined" && window.location.hostname === "localhost"
        ? "localhost:1999"
        : "");
    if (!host) {
      setError("missing-partykit-host");
      return;
    }
    const socket = new PartySocket({
      host,
      room: roomCode,
    });
    socketRef.current = socket;

    const onOpen = () => setConnected(true);
    const onClose = () => setConnected(false);
    const onMessage = (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data) as ServerMessage;
        if (msg.type === "state") {
          setState(msg.state);
        } else if (msg.type === "identity") {
          setMyId(msg.id);
        } else if (msg.type === "error") {
          setError(msg.reason);
        } else if (msg.type === "kicked") {
          setKicked(true);
        }
      } catch {
        // ignore malformed payloads
      }
    };

    socket.addEventListener("open", onOpen);
    socket.addEventListener("close", onClose);
    socket.addEventListener("message", onMessage);

    return () => {
      socket.removeEventListener("open", onOpen);
      socket.removeEventListener("close", onClose);
      socket.removeEventListener("message", onMessage);
      socket.close();
      socketRef.current = null;
      setConnected(false);
    };
  }, [roomCode]);

  const send = useCallback((msg: ClientMessage) => {
    const sock = socketRef.current;
    if (!sock || sock.readyState !== WebSocket.OPEN) return;
    sock.send(JSON.stringify(msg));
  }, []);

  return { state, send, error, kicked, connected, myId };
}
