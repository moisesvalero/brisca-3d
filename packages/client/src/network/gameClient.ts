import {
  Card,
  createGame,
  GameState,
  PlayerId,
  playCard,
  canSwapTrump,
  swapTrumpCard,
} from "@brisca/core";

export interface ClientState {
  isOnline: boolean;
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

export class GameClient {
  private ws: WebSocket | null = null;
  private localGame: GameState | null = null;
  private isSoloMode = false;

  public state: ClientState | null = null;
  public onStateUpdate?: (state: ClientState) => void;
  public onError?: (msg: string) => void;

  // Start local game against built-in AI
  public startSoloGame(_playerName = "Tú") {
    this.isSoloMode = true;
    this.localGame = createGame("SOLO", "p1");
    this.syncLocalState();
  }

  // Create or Join Online Room via WebSocket
  public connectOnline(
    serverUrl: string,
    action: "CREATE" | "JOIN",
    roomCode?: string,
    name = "Jugador",
  ) {
    this.isSoloMode = false;
    this.ws = new WebSocket(serverUrl);

    this.ws.onopen = () => {
      if (action === "CREATE") {
        this.ws?.send(JSON.stringify({ type: "CREATE_ROOM", name }));
      } else {
        this.ws?.send(JSON.stringify({ type: "JOIN_ROOM", roomCode, name }));
      }
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "ROOM_CREATED" || msg.type === "ROOM_JOINED") {
          // Waiting for player 2 or match start
        } else if (msg.type === "GAME_STATE") {
          this.state = {
            ...msg.payload,
            isOnline: true,
          };
          this.onStateUpdate?.(this.state!);
        } else if (msg.type === "ERROR") {
          this.onError?.(msg.message);
        }
      } catch (err: any) {
        console.error("Error parsing WS message", err);
      }
    };

    this.ws.onerror = () => {
      this.onError?.("Error de conexión con el servidor de salas.");
    };
  }

  public playCard(cardId: string) {
    if (this.isSoloMode && this.localGame) {
      if (this.localGame.turn !== "p1") return;

      try {
        this.localGame = playCard(this.localGame, "p1", cardId);
        this.syncLocalState();

        // If turn passed to AI, let AI make a move after a natural delay
        if (
          this.localGame.phase === "PLAYER_TURN" &&
          (this.localGame.turn as string) === "p2"
        ) {
          setTimeout(() => this.aiMove(), 700);
        }
      } catch (err: any) {
        this.onError?.(err.message);
      }
    } else if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "PLAY_CARD", cardId }));
    }
  }

  public swapTrump(cardId: string) {
    if (this.isSoloMode && this.localGame) {
      try {
        swapTrumpCard(this.localGame, "p1", cardId);
        this.syncLocalState();
      } catch (err: any) {
        this.onError?.(err.message);
      }
    } else if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "SWAP_TRUMP", cardId }));
    }
  }

  // Simple strategic Brisca bot
  private aiMove() {
    if (
      !this.localGame ||
      this.localGame.phase !== "PLAYER_TURN" ||
      this.localGame.turn !== "p2"
    )
      return;

    const hand = this.localGame.hands.p2;
    if (hand.length === 0) return;

    // AI Trump swap check
    const swappable = hand.find((c) =>
      canSwapTrump(c, this.localGame!.trumpCard),
    );
    if (swappable && this.localGame.deck.length > 0) {
      swapTrumpCard(this.localGame, "p2", swappable.id);
    }

    // AI card choice:
    // If following and trick has big points (> 10), try to win with trump or higher card; otherwise discard lowest point card
    let chosenCard = hand[0];
    const trickLead = this.localGame.currentTrick.leadCard;

    if (trickLead) {
      // Find lowest point card by default
      chosenCard = [...hand].sort((a, b) => a.points - b.points)[0];
    } else {
      // When leading, prefer playing low white cards (rank 2, 4, 5, 6, 7 with 0 pts)
      const whiteCards = hand.filter(
        (c) => c.points === 0 && c.suit !== this.localGame!.trumpSuit,
      );
      chosenCard = whiteCards.length > 0 ? whiteCards[0] : hand[0];
    }

    playCard(this.localGame, "p2", chosenCard.id);
    this.syncLocalState();
  }

  private syncLocalState() {
    if (!this.localGame) return;

    this.state = {
      isOnline: false,
      roomCode: "SOLO",
      playerId: "p1",
      phase: this.localGame.phase,
      turn: this.localGame.turn,
      leadPlayer: this.localGame.leadPlayer,
      trumpCard: this.localGame.trumpCard,
      trumpSuit: this.localGame.trumpSuit,
      myHand: [...this.localGame.hands.p1],
      opponentCardCount: this.localGame.hands.p2.length,
      deckCount: this.localGame.deck.length,
      scores: { ...this.localGame.scores },
      currentTrick: { ...this.localGame.currentTrick },
      winner: this.localGame.winner,
    };

    this.onStateUpdate?.(this.state);
  }

  public disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
