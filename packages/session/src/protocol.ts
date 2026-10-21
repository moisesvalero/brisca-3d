import type { Card, GameState, PlayerId } from "@brisca/core";

export type CloseReason =
  "player_left" | "opponent_left" | "timeout" | "expired" | "server_closed";

export type ClientMessage =
  | { type: "CREATE_ROOM"; name?: string }
  | {
      type: "JOIN_ROOM";
      roomCode: string;
      name?: string;
      token?: string;
    }
  | { type: "PLAY_CARD"; cardId: string }
  | { type: "SWAP_TRUMP"; cardId: string }
  | { type: "REMATCH" }
  | { type: "LEAVE_ROOM" };

export interface ClientGameState {
  isOnline: true;
  roomCode: string;
  playerId: PlayerId;
  myName: string;
  opponentName: string;
  opponentConnected: boolean;
  phase: GameState["phase"];
  turn: PlayerId;
  leadPlayer: PlayerId;
  trumpCard: Card;
  trumpSuit: string;
  trumpTaken: boolean;
  /** El jugador que recibe el estado ya ha ganado al menos una baza. */
  hasWonTrick: boolean;
  myHand: Card[];
  opponentCardCount: number;
  deckCount: number;
  scores: Record<PlayerId, number>;
  currentTrick: GameState["currentTrick"];
  winner?: PlayerId | "draw";
  rematchVotes: PlayerId[];
}

export interface RoomInfoPayload {
  roomCode: string;
  playerId: PlayerId;
  token: string;
  name: string;
  opponentName?: string;
  isCreator: boolean;
}

export type ServerMessage =
  | ({ type: "ROOM_CREATED" } & { payload: RoomInfoPayload })
  | ({ type: "ROOM_JOINED" } & { payload: RoomInfoPayload })
  | { type: "OPPONENT_JOINED"; payload: { name: string } }
  | { type: "GAME_STATE"; payload: ClientGameState }
  | {
      type: "PLAYER_DISCONNECTED";
      payload: { playerId: PlayerId; name: string; graceSeconds: number };
    }
  | {
      type: "PLAYER_RECONNECTED";
      payload: { playerId: PlayerId; name: string };
    }
  | { type: "REMATCH_REQUESTED"; payload: { playerId: PlayerId } }
  | { type: "ROOM_CLOSED"; payload: { reason: CloseReason } }
  | { type: "ERROR"; payload: { code: string; message: string } };

export class RoomError extends Error {
  public readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "RoomError";
    this.code = code;
  }
}

export function isClientMessage(value: unknown): value is ClientMessage {
  if (!value || typeof value !== "object") return false;
  const type = (value as { type?: unknown }).type;
  return typeof type === "string";
}

/** Serializable socket abstraction shared by Node (ws) and Workers. */
export interface Connection {
  send(data: string): void;
  close(code?: number, reason?: string): void;
}
