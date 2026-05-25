"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import PartySocket from "partysocket";
import type { ClientMessage, RoomState, ServerMessage } from "./quizProtocol";

/**
 * Thin wrapper around partysocket that connects to a single quiz room and
 * exposes:
 *   - `state`: the latest RoomState snapshot the server has broadcast.
 *     `null` until the first state arrives after connect.
 *   - `send`: send a typed ClientMessage to the server. No-op while
 *     disconnected.
 *   - `error`: most recent error reason string from the server (e.g.
 *     "not-host", "host-already-claimed", "answers-closed"), or null.
 *   - `kicked`: set true when the server has sent a {type:"kicked"}
 *     message before closing the socket.
 *   - `connected`: live WebSocket readyState === OPEN.
 *
 * All three role pages (host / play / watch) use this same hook —
 * differences live only in which messages they send and which parts of
 * `state` they render.
 */
export function usePartyRoom(roomCode: string | null): {
  state: RoomState | null;
  send: (msg: ClientMessage) => void;
  error: string | null;
  kicked: boolean;
  connected: boolean;
} {
  const [state, setState] = useState<RoomState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [kicked, setKicked] = useState(false);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<PartySocket | null>(null);

  useEffect(() => {
    if (!roomCode) return;
    // Resolve the PartyKit host. In production this is the deployed
    // *.partykit.dev URL from NEXT_PUBLIC_PARTYKIT_HOST. In dev it
    // defaults to localhost:1999 (the `partykit dev` default port).
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
      party: "quiz",
    });
    socketRef.current = socket;

    const onOpen = () => setConnected(true);
    const onClose = () => setConnected(false);
    const onMessage = (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data) as ServerMessage;
        if (msg.type === "state") {
          setState(msg.state);
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

  return { state, send, error, kicked, connected };
}
