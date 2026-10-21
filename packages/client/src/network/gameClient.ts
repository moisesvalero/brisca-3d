import {
  GameState,
  PlayerId,
  canSwapTrump,
  collectTrick,
  createGame,
  playCard,
  swapTrumpCard,
} from "@brisca/core";
import type {
  ClientGameState,
  CloseReason,
  RoomInfoPayload,
} from "@brisca/session";
import { readStoredToken, resolveWsUrl, storeToken } from "./config.js";

export type ClientState = Omit<ClientGameState, "isOnline"> & {
  isOnline: boolean;
};

export type ConnectionStatus =
  "idle" | "connecting" | "waiting" | "playing" | "reconnecting" | "error";

type ClientMessage =
  | { type: "CREATE_ROOM"; name: string }
  | { type: "JOIN_ROOM"; roomCode: string; name: string; token?: string }
  | { type: "PLAY_CARD"; cardId: string }
  | { type: "SWAP_TRUMP"; cardId: string }
  | { type: "REMATCH" }
  | { type: "LEAVE_ROOM" };

interface ServerEnvelope {
  type: string;
  payload?: any;
  message?: string;
}

const ACK_TIMEOUT_MS = 12_000;
const CONNECT_TIMEOUT_MS = 15_000;
const MAX_RECONNECT_ATTEMPTS = 6;

export class GameClient {
  private ws: WebSocket | null = null;
  private localGame: GameState | null = null;
  private isSoloMode = false;
  private serverUrl = "";
  private playerName = "Jugador";

  private intentionalClose = false;
  private roomClosedReceived = false;
  private awaitingAck = false;
  private reconnectAttempts = 0;

  private connectTimer: ReturnType<typeof setTimeout> | null = null;
  private ackTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  public state: ClientState | null = null;
  public status: ConnectionStatus = "idle";
  public roomCode = "";
  public playerId: PlayerId = "p1";
  public token = "";

  public onStateUpdate?: (state: ClientState) => void;
  public onRoomInfo?: (info: RoomInfoPayload) => void;
  public onStatus?: (status: ConnectionStatus, message?: string) => void;
  public onError?: (message: string) => void;
  public onOpponentDisconnected?: (info: {
    name: string;
    graceSeconds: number;
  }) => void;
  public onOpponentReconnected?: (name: string) => void;
  public onRematchRequested?: (playerId: PlayerId) => void;
  public onRoomClosed?: (reason: CloseReason) => void;

  public setServerUrl(url: string): void {
    this.serverUrl = url;
  }

  public connectOnline(
    action: "CREATE" | "JOIN",
    roomCode?: string,
    name = "Jugador",
  ): void {
    this.isSoloMode = false;
    this.localGame = null;
    this.intentionalClose = false;
    this.roomClosedReceived = false;
    this.reconnectAttempts = 0;
    this.playerName = name.trim() || "Jugador";
    this.roomCode =
      action === "CREATE" ? "" : (roomCode ?? "").toUpperCase().trim();
    this.token = this.roomCode ? readStoredToken(this.roomCode) : "";
    this.state = null;

    this.setStatus(
      "connecting",
      action === "CREATE" ? "Creando sala…" : "Conectando a la sala…",
    );
    this.openSocket(action);
  }

  private openSocket(action: "CREATE" | "JOIN"): void {
    this.clearSocketTimers();
    const url = resolveWsUrl(this.serverUrl);
    if (!url) {
      this.fail(
        "El servidor online no está configurado. Revisa config.json o VITE_WS_URL.",
      );
      return;
    }

    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch {
      this.fail("No se pudo abrir la conexión con el servidor.");
      return;
    }

    this.ws = ws;
    this.awaitingAck = true;
    this.intentionalClose = false;

    this.connectTimer = setTimeout(() => {
      if (ws.readyState !== WebSocket.OPEN) {
        this.fail(
          "El servidor de salas no responde. Comprueba tu conexión e inténtalo de nuevo.",
        );
      }
    }, CONNECT_TIMEOUT_MS);

    ws.onopen = () => {
      if (this.connectTimer) clearTimeout(this.connectTimer);
      this.connectTimer = null;

      const message: ClientMessage =
        action === "CREATE"
          ? { type: "CREATE_ROOM", name: this.playerName }
          : {
              type: "JOIN_ROOM",
              roomCode: this.roomCode,
              name: this.playerName,
              token: this.token || undefined,
            };
      ws.send(JSON.stringify(message));

      this.ackTimer = setTimeout(() => {
        if (this.awaitingAck) {
          this.fail(
            "El servidor no ha respondido. Puede estar reiniciándose: vuelve a intentarlo.",
          );
        }
      }, ACK_TIMEOUT_MS);
    };

    ws.onmessage = (event) => {
      this.handleMessage(event.data);
    };

    ws.onclose = () => {
      this.handleClose();
    };

    ws.onerror = () => {
      // onclose always follows; the reconnect logic lives there.
    };
  }

  private handleMessage(raw: unknown): void {
    let message: ServerEnvelope;
    try {
      message = JSON.parse(String(raw)) as ServerEnvelope;
    } catch {
      return;
    }

    switch (message.type) {
      case "ROOM_CREATED":
      case "ROOM_JOINED": {
        const info = message.payload as RoomInfoPayload;
        this.awaitingAck = false;
        if (this.ackTimer) clearTimeout(this.ackTimer);
        this.ackTimer = null;
        this.roomCode = info.roomCode;
        this.playerId = info.playerId;
        this.token = info.token;
        storeToken(info.roomCode, info.token);
        this.reconnectAttempts = 0;
        this.setStatus(
          info.isCreator ? "waiting" : "playing",
          info.isCreator ? "Esperando rival…" : "Conectado",
        );
        this.onRoomInfo?.(info);
        break;
      }

      case "GAME_STATE": {
        const payload = message.payload as ClientGameState;
        this.state = { ...payload, isOnline: true };
        this.setStatus("playing");
        this.onStateUpdate?.(this.state);
        break;
      }

      case "PLAYER_DISCONNECTED": {
        if (this.state) {
          this.state = { ...this.state, opponentConnected: false };
          this.onStateUpdate?.(this.state);
        }
        this.onOpponentDisconnected?.({
          name: message.payload.name,
          graceSeconds: message.payload.graceSeconds,
        });
        break;
      }

      case "PLAYER_RECONNECTED": {
        if (this.state) {
          this.state = { ...this.state, opponentConnected: true };
          this.onStateUpdate?.(this.state);
        }
        this.onOpponentReconnected?.(message.payload.name);
        break;
      }

      case "REMATCH_REQUESTED": {
        this.onRematchRequested?.(message.payload.playerId as PlayerId);
        break;
      }

      case "ROOM_CLOSED": {
        this.roomClosedReceived = true;
        this.intentionalClose = true;
        this.closeSocket();
        this.resetRoom();
        this.setStatus("idle");
        this.onRoomClosed?.(message.payload.reason as CloseReason);
        break;
      }

      case "ERROR": {
        const code = message.payload?.code as string | undefined;
        const text = message.payload?.message ?? "Error del servidor";
        this.awaitingAck = false;
        if (this.ackTimer) clearTimeout(this.ackTimer);
        this.ackTimer = null;

        if (code === "ROOM_NOT_FOUND" && this.reconnectAttempts > 0) {
          this.intentionalClose = true;
          this.closeSocket();
          this.resetRoom();
          this.setStatus("idle");
          this.onRoomClosed?.("expired");
          break;
        }

        this.onError?.(text);
        if (!this.roomCode || this.awaitingAck) {
          this.intentionalClose = true;
          this.closeSocket();
          this.setStatus("error");
        }
        break;
      }

      default:
        break;
    }
  }

  private handleClose(): void {
    this.clearSocketTimers();
    this.ws = null;

    if (this.intentionalClose || this.roomClosedReceived || this.isSoloMode) {
      return;
    }

    if (this.roomCode && this.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      this.reconnectAttempts += 1;
      const delay = Math.min(1_000 * 2 ** (this.reconnectAttempts - 1), 8_000);
      this.setStatus(
        "reconnecting",
        `Reconectando… (${this.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`,
      );
      this.reconnectTimer = setTimeout(() => {
        this.openSocket("JOIN");
      }, delay);
      return;
    }

    if (this.roomCode) {
      this.resetRoom();
      this.setStatus("idle");
      this.onRoomClosed?.("timeout");
      return;
    }

    this.setStatus("error");
  }

  private fail(message: string): void {
    this.intentionalClose = true;
    this.closeSocket();
    this.resetRoom();
    this.setStatus("error");
    this.onError?.(message);
  }

  public playCard(cardId: string): void {
    if (this.isSoloMode && this.localGame) {
      this.playSoloCard(cardId);
      return;
    }
    if (!this.state) return;
    if (this.state.phase !== "PLAYER_TURN") return;
    if (this.state.turn !== this.playerId) return;
    this.send({ type: "PLAY_CARD", cardId });
  }

  public swapTrump(): void {
    const state = this.state;
    if (!state) return;
    const card = state.myHand.find((candidate) =>
      canSwapTrump(candidate, state.trumpCard, state.hasWonTrick),
    );
    if (!card) {
      this.onError?.("No tienes ninguna carta válida para cambiar el triunfo.");
      return;
    }

    if (this.isSoloMode && this.localGame) {
      try {
        swapTrumpCard(this.localGame, "p1", card.id);
        this.syncLocalState();
      } catch (error) {
        this.onError?.(errorMessage(error));
      }
      return;
    }

    this.send({ type: "SWAP_TRUMP", cardId: card.id });
  }

  public requestRematch(): void {
    if (this.isSoloMode) {
      this.startSoloGame(this.playerName);
      return;
    }
    this.send({ type: "REMATCH" });
  }

  public leaveRoom(): void {
    if (this.isSoloMode) {
      this.disconnect();
      return;
    }
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.send({ type: "LEAVE_ROOM" });
    }
    this.disconnect();
  }

  public disconnect(): void {
    this.intentionalClose = true;
    this.roomClosedReceived = true;
    this.isSoloMode = false;
    this.localGame = null;
    this.clearAllTimers();
    this.closeSocket();
    this.resetRoom();
    this.setStatus("idle");
  }

  public startSoloGame(name = "Tú"): void {
    this.isSoloMode = true;
    this.intentionalClose = true;
    this.clearAllTimers();
    this.closeSocket();
    this.state = null;
    this.roomCode = "SOLO";
    this.playerId = "p1";
    this.token = "";
    this.playerName = name.trim() || "Tú";
    this.localGame = createGame("SOLO", "p1");
    this.syncLocalState();
    this.setStatus("playing");
    this.maybeScheduleAi();
  }

  private playSoloCard(cardId: string): void {
    const game = this.localGame;
    if (!game || game.turn !== "p1" || game.phase !== "PLAYER_TURN") return;

    try {
      this.localGame = playCard(game, "p1", cardId, false);
      this.syncLocalState();

      if (this.localGame.phase === "RESOLVING_TRICK") {
        setTimeout(() => {
          if (!this.isSoloMode || !this.localGame) return;
          this.localGame = collectTrick(this.localGame);
          this.syncLocalState();
          this.maybeScheduleAi();
        }, 1_200);
      } else {
        this.maybeScheduleAi();
      }
    } catch (error) {
      this.onError?.(errorMessage(error));
    }
  }

  private maybeScheduleAi(): void {
    if (!this.isSoloMode || !this.localGame) return;
    if (
      this.localGame.phase === "PLAYER_TURN" &&
      this.localGame.turn === "p2"
    ) {
      setTimeout(() => this.aiMove(), 750);
    }
  }

  private aiMove(): void {
    const game = this.localGame;
    if (
      !this.isSoloMode ||
      !game ||
      game.phase !== "PLAYER_TURN" ||
      game.turn !== "p2"
    ) {
      return;
    }

    const hand = game.hands.p2;
    if (hand.length === 0) return;

    // The bot only swaps if it has won a trick and holds a legal change.
    const swappable = hand.find((card) =>
      canSwapTrump(card, game.trumpCard, game.tricksWon.p2.length > 0),
    );
    if (swappable && game.deck.length > 0) {
      try {
        swapTrumpCard(game, "p2", swappable.id);
      } catch {
        // ignore, the bot will just play
      }
    }

    let chosen = hand[0];
    if (game.currentTrick.leadCard) {
      chosen = [...hand].sort((a, b) => a.points - b.points)[0];
    } else {
      const whiteCards = hand.filter(
        (card) => card.points === 0 && card.suit !== game.trumpSuit,
      );
      chosen = whiteCards.length > 0 ? whiteCards[0] : hand[0];
    }

    try {
      this.localGame = playCard(game, "p2", chosen.id, false);
      this.syncLocalState();

      if (this.localGame.phase === "RESOLVING_TRICK") {
        setTimeout(() => {
          if (!this.isSoloMode || !this.localGame) return;
          this.localGame = collectTrick(this.localGame);
          this.syncLocalState();
          this.maybeScheduleAi();
        }, 1_200);
      } else {
        this.maybeScheduleAi();
      }
    } catch (error) {
      this.onError?.(errorMessage(error));
    }
  }

  private syncLocalState(): void {
    const game = this.localGame;
    if (!game) return;

    this.state = {
      isOnline: false,
      roomCode: "SOLO",
      playerId: "p1",
      myName: this.playerName,
      opponentName: "IA",
      opponentConnected: true,
      phase: game.phase,
      turn: game.turn,
      leadPlayer: game.leadPlayer,
      trumpCard: game.trumpCard,
      trumpSuit: game.trumpSuit,
      trumpTaken: game.trumpTaken,
      hasWonTrick:
        game.tricksWon.p1.length > 0 ||
        (game.phase === "RESOLVING_TRICK" && game.currentTrick.winner === "p1"),
      myHand: [...game.hands.p1],
      opponentCardCount: game.hands.p2.length,
      deckCount: game.deck.length,
      scores: { ...game.scores },
      currentTrick: { ...game.currentTrick },
      winner: game.winner,
      rematchVotes: [],
    };

    this.onStateUpdate?.(this.state);
  }

  private send(message: ClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  private setStatus(status: ConnectionStatus, message?: string): void {
    this.status = status;
    this.onStatus?.(status, message);
  }

  private resetRoom(): void {
    this.roomCode = "";
    this.token = "";
    this.state = null;
    this.awaitingAck = false;
  }

  private closeSocket(): void {
    if (this.connectTimer) clearTimeout(this.connectTimer);
    if (this.ackTimer) clearTimeout(this.ackTimer);
    this.connectTimer = null;
    this.ackTimer = null;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;

    if (this.ws) {
      const socket = this.ws;
      this.ws = null;
      socket.onclose = null;
      socket.onerror = null;
      socket.onmessage = null;
      try {
        socket.close();
      } catch {
        // ignore
      }
    }
  }

  private clearSocketTimers(): void {
    if (this.connectTimer) clearTimeout(this.connectTimer);
    if (this.ackTimer) clearTimeout(this.ackTimer);
    this.connectTimer = null;
    this.ackTimer = null;
  }

  private clearAllTimers(): void {
    this.clearSocketTimers();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Error inesperado";
}
