export type Suit = "oros" | "copas" | "espadas" | "bastos";
export type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 10 | 11 | 12;

export interface Card {
  id: string;
  suit: Suit;
  rank: Rank;
  points: number;
}

export type PlayerId = "p1" | "p2";

export interface TrickState {
  leadPlayer: PlayerId;
  leadCard?: Card;
  followCard?: Card;
  winner?: PlayerId;
  points: number;
}

export type GamePhase =
  | "WAITING_PLAYERS"
  | "DEALING"
  | "PLAYER_TURN"
  | "RESOLVING_TRICK"
  | "GAME_OVER";

export interface GameState {
  id: string;
  phase: GamePhase;
  turn: PlayerId;
  leadPlayer: PlayerId;
  trumpCard: Card;
  trumpSuit: Suit;
  deck: Card[];
  hands: Record<PlayerId, Card[]>;
  scores: Record<PlayerId, number>;
  tricksWon: Record<PlayerId, Card[]>;
  currentTrick: TrickState;
  winner?: PlayerId | "draw";
}
