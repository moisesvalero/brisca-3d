import { WebSocket } from "ws";
import {
  Card,
  createGame,
  GameState,
  PlayerId,
  playCard,
  collectTrick,
  swapTrumpCard,
} from "@brisca/core";

const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateRoomCode(): string {
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += CHARS.charAt(Math.floor(Math.random() * CHARS.length));
  }
  return code;
}

export interface PlayerClient {
  id: PlayerId;
  name: string;
  ws: WebSocket;
}

export interface ClientGameState {
  roomCode: string;
  playerId: PlayerId;
  phase: GameState["phase"];
  turn: PlayerId;
  leadPlayer: PlayerId;
  trumpCard: Card;
  trumpSuit: string;
  myHand: Card[];
  opponentCardCount: number;
  deckCount: number;
  scores: Record<PlayerId, number>;
  currentTrick: GameState["currentTrick"];
  winner?: PlayerId | "draw";
}

export class Room {
  public readonly code: string;
  public p1?: PlayerClient;
  public p2?: PlayerClient;
  public game?: GameState;

  constructor(code: string) {
    this.code = code;
  }

  public isFull(): boolean {
    return Boolean(this.p1 && this.p2);
  }

  public isEmpty(): boolean {
    return !this.p1 && !this.p2;
  }

  public addPlayer(ws: WebSocket, name: string): PlayerId {
    if (!this.p1) {
      this.p1 = { id: "p1", name, ws };
      return "p1";
    } else if (!this.p2) {
      this.p2 = { id: "p2", name, ws };
      return "p2";
    }
    throw new Error("Room is already full");
  }

  public removePlayer(ws: WebSocket): PlayerId | null {
    if (this.p1?.ws === ws) {
      this.p1 = undefined;
      return "p1";
    }
    if (this.p2?.ws === ws) {
      this.p2 = undefined;
      return "p2";
    }
    return null;
  }

  public startGame(): void {
    if (!this.p1 || !this.p2) {
      throw new Error("Cannot start game without 2 players");
    }
    this.game = createGame(this.code, "p1");
    this.broadcastState();
  }

  public handlePlayCard(playerId: PlayerId, cardId: string): void {
    if (!this.game) return;
    this.game = playCard(this.game, playerId, cardId, false);
    this.broadcastState();

    if (this.game.phase === "RESOLVING_TRICK") {
      setTimeout(() => {
        if (!this.game) return;
        this.game = collectTrick(this.game);
        this.broadcastState();
      }, 1200);
    }
  }

  public handleSwapTrump(playerId: PlayerId, cardId: string): void {
    if (!this.game) return;
    this.game = swapTrumpCard(this.game, playerId, cardId);
    this.broadcastState();
  }

  public getClientState(playerId: PlayerId): ClientGameState | null {
    if (!this.game) return null;
    const opponentId: PlayerId = playerId === "p1" ? "p2" : "p1";

    return {
      roomCode: this.code,
      playerId,
      phase: this.game.phase,
      turn: this.game.turn,
      leadPlayer: this.game.leadPlayer,
      trumpCard: this.game.trumpCard,
      trumpSuit: this.game.trumpSuit,
      myHand: this.game.hands[playerId],
      opponentCardCount: this.game.hands[opponentId].length,
      deckCount: this.game.deck.length,
      scores: this.game.scores,
      currentTrick: this.game.currentTrick,
      winner: this.game.winner,
    };
  }

  public broadcastState(): void {
    if (this.p1 && this.p1.ws.readyState === WebSocket.OPEN) {
      const state = this.getClientState("p1");
      if (state) {
        this.p1.ws.send(JSON.stringify({ type: "GAME_STATE", payload: state }));
      }
    }
    if (this.p2 && this.p2.ws.readyState === WebSocket.OPEN) {
      const state = this.getClientState("p2");
      if (state) {
        this.p2.ws.send(JSON.stringify({ type: "GAME_STATE", payload: state }));
      }
    }
  }

  public broadcast(message: object): void {
    const raw = JSON.stringify(message);
    if (this.p1?.ws.readyState === WebSocket.OPEN) {
      this.p1.ws.send(raw);
    }
    if (this.p2?.ws.readyState === WebSocket.OPEN) {
      this.p2.ws.send(raw);
    }
  }
}
