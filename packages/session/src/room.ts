import {
  GameState,
  PlayerId,
  canSwapTrump,
  collectTrick,
  createGame,
  playCard,
  swapTrumpCard,
} from "@brisca/core";
import {
  ClientGameState,
  CloseReason,
  Connection,
  RoomError,
  ServerMessage,
} from "./protocol.js";

export const DEFAULT_GRACE_MS = 60_000;
export const DEFAULT_TRICK_DELAY_MS = 1_200;
export const DEFAULT_NOTIFY_GRACE_MS = 2_500;

export interface RoomOptions {
  graceMs?: number;
  trickDelayMs?: number;
  notifyGraceMs?: number;
  onClosed?: (room: Room, reason: CloseReason) => void;
}

interface Player {
  id: PlayerId;
  name: string;
  token: string;
  connection: Connection | null;
  disconnectedAt: number | null;
  graceTimer: ReturnType<typeof setTimeout> | null;
  notifyTimer: ReturnType<typeof setTimeout> | null;
  disconnectNotified: boolean;
}

export interface JoinResult {
  playerId: PlayerId;
  token: string;
  name: string;
  reconnected: boolean;
  announcedDisconnect: boolean;
}

export function sanitizeName(raw: unknown, fallback = "Jugador"): string {
  if (typeof raw !== "string") return fallback;
  const cleaned = Array.from(raw, (char) => {
    const code = char.codePointAt(0) ?? 0;
    return code < 32 || code === 127 ? "" : char;
  }).join("");
  const name = cleaned.trim().slice(0, 15);
  return name.length > 0 ? name : fallback;
}

function createToken(): string {
  const cryptoRef = (globalThis as { crypto?: { randomUUID?: () => string } })
    .crypto;
  if (cryptoRef?.randomUUID) return cryptoRef.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export class Room {
  public readonly code: string;
  public readonly createdAt = Date.now();

  private p1: Player | null = null;
  private p2: Player | null = null;
  private game: GameState | null = null;
  private closed = false;
  private rematchVotes = new Set<PlayerId>();
  private trickTimer: ReturnType<typeof setTimeout> | null = null;

  private readonly graceMs: number;
  private readonly trickDelayMs: number;
  private readonly notifyGraceMs: number;
  private readonly onClosed?: (room: Room, reason: CloseReason) => void;

  constructor(code: string, options: RoomOptions = {}) {
    this.code = code;
    this.graceMs = options.graceMs ?? DEFAULT_GRACE_MS;
    this.trickDelayMs = options.trickDelayMs ?? DEFAULT_TRICK_DELAY_MS;
    this.notifyGraceMs = options.notifyGraceMs ?? DEFAULT_NOTIFY_GRACE_MS;
    this.onClosed = options.onClosed;
  }

  public isClosed(): boolean {
    return this.closed;
  }

  public isFull(): boolean {
    return Boolean(this.p1 && this.p2);
  }

  public hasConnections(): boolean {
    return Boolean(this.p1?.connection || this.p2?.connection);
  }

  public hasGame(): boolean {
    return Boolean(this.game);
  }

  public getGame(): GameState | null {
    return this.game;
  }

  public getPlayer(id: PlayerId): { name: string } | null {
    const player = this.playerById(id);
    return player ? { name: player.name } : null;
  }

  /** Tells the rival whether the other seat just joined or came back. */
  public announceOpponentStatus(
    playerId: PlayerId,
    reconnected: boolean,
  ): void {
    const player = this.playerById(playerId);
    const opponent = this.opponentOf(playerId);
    if (!player || !opponent?.connection) return;
    this.sendRaw(
      opponent,
      reconnected
        ? {
            type: "PLAYER_RECONNECTED",
            payload: { playerId, name: player.name },
          }
        : {
            type: "OPPONENT_JOINED",
            payload: { name: player.name },
          },
    );
  }

  public addPlayer(
    connection: Connection,
    rawName: unknown,
    token?: string,
  ): JoinResult {
    if (this.closed) {
      throw new RoomError("ROOM_NOT_FOUND", "La sala ya no está disponible");
    }

    // Reconnection: the token identifies the slot even while the player is
    // inside the grace window (or still holds a stale socket).
    if (token) {
      for (const player of [this.p1, this.p2]) {
        if (player && player.token === token) {
          if (player.connection && player.connection !== connection) {
            try {
              player.connection.close(4000, "replaced");
            } catch {
              // ignore
            }
          }
          const announcedDisconnect = player.disconnectNotified;
          player.connection = connection;
          player.disconnectedAt = null;
          player.disconnectNotified = false;
          this.clearGrace(player);
          return {
            playerId: player.id,
            token: player.token,
            name: player.name,
            reconnected: true,
            announcedDisconnect,
          };
        }
      }
    }

    const name = sanitizeName(rawName);

    let player: Player | null = null;
    if (!this.p1) {
      player = this.makePlayer("p1", name, connection);
      this.p1 = player;
    } else if (!this.p2) {
      player = this.makePlayer("p2", name, connection);
      this.p2 = player;
    }

    if (!player) {
      // A disconnected slot must be reclaimed with its token, never stolen.
      throw new RoomError("ROOM_FULL", "La sala ya está completa");
    }

    return {
      playerId: player.id,
      token: player.token,
      name: player.name,
      reconnected: false,
      announcedDisconnect: false,
    };
  }

  /** Starts the match once both seats are taken. Safe to call repeatedly. */
  public ensureStarted(): boolean {
    if (this.closed || this.game || !this.p1 || !this.p2) return false;
    this.startGame();
    return true;
  }

  public startGame(): void {
    if (!this.p1 || !this.p2) {
      throw new RoomError("WAITING_PLAYERS", "Faltan jugadores");
    }
    if (this.closed) {
      throw new RoomError("ROOM_NOT_FOUND", "La sala ya no está disponible");
    }
    this.game = createGame(this.code, "p1");
    this.rematchVotes.clear();
    this.broadcastState();
  }

  public handlePlayCard(playerId: PlayerId, cardId: string): void {
    if (this.closed) throw new RoomError("ROOM_NOT_FOUND", "Sala cerrada");
    if (!this.game) throw new RoomError("NO_GAME", "La partida no ha empezado");
    this.assertPlayer(playerId);

    try {
      this.game = playCard(this.game, playerId, cardId, false);
    } catch (error) {
      throw new RoomError("INVALID_MOVE", errorMessage(error));
    }

    this.broadcastState();

    if (this.game.phase === "RESOLVING_TRICK") {
      this.scheduleCollect();
    }
  }

  public handleSwapTrump(playerId: PlayerId, cardId: string): void {
    if (this.closed) throw new RoomError("ROOM_NOT_FOUND", "Sala cerrada");
    if (!this.game) throw new RoomError("NO_GAME", "La partida no ha empezado");
    this.assertPlayer(playerId);

    const card = this.game.hands[playerId].find((c) => c.id === cardId);
    if (!card) {
      throw new RoomError("INVALID_MOVE", "No tienes esa carta");
    }
    const hasWonTrick =
      this.game.tricksWon[playerId].length > 0 ||
      (this.game.phase === "RESOLVING_TRICK" &&
        this.game.currentTrick.winner === playerId);
    if (!hasWonTrick) {
      throw new RoomError(
        "INVALID_MOVE",
        "Solo puedes cambiar el triunfo después de ganar una baza",
      );
    }
    if (!canSwapTrump(card, this.game.trumpCard, hasWonTrick)) {
      throw new RoomError(
        "INVALID_MOVE",
        "Esa carta no puede cambiar el triunfo",
      );
    }

    try {
      this.game = swapTrumpCard(this.game, playerId, cardId);
    } catch (error) {
      throw new RoomError("INVALID_MOVE", errorMessage(error));
    }

    this.broadcastState();
  }

  public requestRematch(playerId: PlayerId): void {
    if (this.closed) throw new RoomError("ROOM_NOT_FOUND", "Sala cerrada");
    if (!this.game) throw new RoomError("NO_GAME", "La partida no ha empezado");
    if (this.game.phase !== "GAME_OVER") {
      throw new RoomError(
        "INVALID_MOVE",
        "La revancha solo está disponible al terminar la partida",
      );
    }
    const player = this.assertPlayer(playerId);
    if (!player.connection) {
      throw new RoomError("DISCONNECTED", "No estás conectado");
    }

    this.rematchVotes.add(playerId);
    this.broadcast({
      type: "REMATCH_REQUESTED",
      payload: { playerId },
    });

    const bothWantRematch = Boolean(
      this.rematchVotes.has("p1") && this.rematchVotes.has("p2"),
    );
    if (bothWantRematch) {
      this.startGame();
    } else {
      this.broadcastState();
    }
  }

  /** Explicit leave: notifies the rival immediately and closes the room. */
  public leave(playerId: PlayerId): void {
    const player = this.playerById(playerId);
    if (!player) return;
    this.close("player_left");
  }

  /**
   * Marks a player as disconnected and starts the reconnection grace window.
   * Returns the player id when the connection belonged to this room.
   */
  public disconnect(connection: Connection): PlayerId | null {
    if (this.closed) return null;

    let player: Player | null = null;
    if (this.p1?.connection === connection) player = this.p1;
    else if (this.p2?.connection === connection) player = this.p2;
    if (!player) return null;

    player.connection = null;
    player.disconnectedAt = Date.now();
    this.clearGrace(player);
    player.graceTimer = setTimeout(() => {
      this.expirePlayer(player!);
    }, this.graceMs);

    // Hide short reconnects (for example, a hosting provider rotating the
    // socket every few minutes) behind a small notification grace window.
    player.notifyTimer = setTimeout(() => {
      player!.notifyTimer = null;
      if (this.closed || player!.connection) return;
      player!.disconnectNotified = true;
      this.notifyOpponent(player!.id, {
        type: "PLAYER_DISCONNECTED",
        payload: {
          playerId: player!.id,
          name: player!.name,
          graceSeconds: Math.round(this.graceMs / 1000),
        },
      });
      this.broadcastState();
    }, this.notifyGraceMs);

    return player.id;
  }

  public close(reason: CloseReason): void {
    if (this.closed) return;
    this.closed = true;
    this.clearTrickTimer();
    for (const player of [this.p1, this.p2]) {
      if (player) this.clearGrace(player);
    }

    const message: ServerMessage = {
      type: "ROOM_CLOSED",
      payload: { reason },
    };
    for (const player of [this.p1, this.p2]) {
      if (!player?.connection) continue;
      this.sendRaw(player, message);
      try {
        player.connection.close(1000, "room closed");
      } catch {
        // ignore
      }
      player.connection = null;
    }

    this.onClosed?.(this, reason);
  }

  public getClientState(playerId: PlayerId): ClientGameState | null {
    if (!this.game) return null;
    const me = this.playerById(playerId);
    if (!me) return null;
    const opponent = this.opponentOf(playerId);

    return {
      isOnline: true,
      roomCode: this.code,
      playerId,
      myName: me.name,
      opponentName: opponent?.name ?? "Rival",
      opponentConnected: Boolean(opponent?.connection),
      phase: this.game.phase,
      turn: this.game.turn,
      leadPlayer: this.game.leadPlayer,
      trumpCard: this.game.trumpCard,
      trumpSuit: this.game.trumpSuit,
      trumpTaken: this.game.trumpTaken,
      hasWonTrick:
        this.game.tricksWon[playerId].length > 0 ||
        (this.game.phase === "RESOLVING_TRICK" &&
          this.game.currentTrick.winner === playerId),
      myHand: this.game.hands[playerId],
      opponentCardCount: opponent ? this.game.hands[opponent.id].length : 0,
      deckCount: this.game.deck.length,
      scores: this.game.scores,
      currentTrick: this.game.currentTrick,
      winner: this.game.winner,
      rematchVotes: [...this.rematchVotes],
    };
  }

  public broadcastState(): void {
    if (!this.game) return;
    for (const player of [this.p1, this.p2]) {
      if (!player?.connection) continue;
      const state = this.getClientState(player.id);
      if (state) {
        this.sendRaw(player, { type: "GAME_STATE", payload: state });
      }
    }
  }

  public broadcast(message: ServerMessage): void {
    for (const player of [this.p1, this.p2]) {
      if (player?.connection) this.sendRaw(player, message);
    }
  }

  private makePlayer(
    id: PlayerId,
    name: string,
    connection: Connection,
  ): Player {
    return {
      id,
      name,
      token: createToken(),
      connection,
      disconnectedAt: null,
      graceTimer: null,
      notifyTimer: null,
      disconnectNotified: false,
    };
  }

  private playerById(id: PlayerId): Player | null {
    return id === "p1" ? this.p1 : this.p2;
  }

  private opponentOf(id: PlayerId): Player | null {
    return id === "p1" ? this.p2 : this.p1;
  }

  private assertPlayer(id: PlayerId): Player {
    const player = this.playerById(id);
    if (!player) throw new RoomError("NOT_IN_ROOM", "No estás en esta sala");
    if (!player.connection) {
      throw new RoomError("DISCONNECTED", "No estás conectado");
    }
    return player;
  }

  private notifyOpponent(from: PlayerId, message: ServerMessage): void {
    const opponent = this.opponentOf(from);
    if (opponent?.connection) this.sendRaw(opponent, message);
  }

  private sendRaw(player: Player, message: ServerMessage): void {
    if (!player.connection) return;
    try {
      player.connection.send(JSON.stringify(message));
    } catch {
      // A broken socket is handled by the adapter's close event.
    }
  }

  private scheduleCollect(): void {
    this.clearTrickTimer();
    this.trickTimer = setTimeout(() => {
      this.trickTimer = null;
      if (this.closed || !this.game) return;
      if (this.game.phase !== "RESOLVING_TRICK") return;
      try {
        this.game = collectTrick(this.game);
        this.broadcastState();
      } catch (error) {
        this.broadcast({
          type: "ERROR",
          payload: {
            code: "INTERNAL",
            message: errorMessage(error),
          },
        });
      }
    }, this.trickDelayMs);
  }

  private clearTrickTimer(): void {
    if (this.trickTimer) {
      clearTimeout(this.trickTimer);
      this.trickTimer = null;
    }
  }

  private clearGrace(player: Player): void {
    if (player.graceTimer) {
      clearTimeout(player.graceTimer);
      player.graceTimer = null;
    }
    if (player.notifyTimer) {
      clearTimeout(player.notifyTimer);
      player.notifyTimer = null;
    }
  }

  private expirePlayer(player: Player): void {
    player.graceTimer = null;
    if (this.closed || player.connection) return;
    // The player did not come back within the grace window.
    const other = this.opponentOf(player.id);
    const reason: CloseReason = other?.connection ? "opponent_left" : "timeout";
    this.close(reason);
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Error inesperado";
}
