import { describe, it, expect } from "vitest";
import {
  createGame,
  playCard,
  collectTrick,
  swapTrumpCard,
  Card,
} from "../src/index.js";

describe("Game Lifecycle and Engine", () => {
  it("initializes game with 3 cards each, 1 trump and 33 remaining cards", () => {
    const game = createGame("room123");

    expect(game.hands.p1).toHaveLength(3);
    expect(game.hands.p2).toHaveLength(3);
    expect(game.deck).toHaveLength(33);
    expect(game.trumpCard).toBeDefined();
    expect(game.trumpSuit).toBe(game.trumpCard.suit);
    expect(game.scores.p1).toBe(0);
    expect(game.scores.p2).toBe(0);
    expect(game.phase).toBe("PLAYER_TURN");
    expect(game.turn).toBe("p1");
  });

  it("plays a trick and assigns points to the winner", () => {
    const mockDeck: Card[] = [
      // P1 initial hand
      { id: "o1", suit: "oros", rank: 1, points: 11 },
      { id: "c2", suit: "copas", rank: 2, points: 0 },
      { id: "b5", suit: "bastos", rank: 5, points: 0 },
      // P2 initial hand
      { id: "c1", suit: "copas", rank: 1, points: 11 },
      { id: "e2", suit: "espadas", rank: 2, points: 0 },
      { id: "b7", suit: "bastos", rank: 7, points: 0 },
      // Trump card
      { id: "o7", suit: "oros", rank: 7, points: 0 },
      // Deck draw cards
      { id: "draw1", suit: "oros", rank: 3, points: 10 },
      { id: "draw2", suit: "copas", rank: 3, points: 10 },
    ];

    const game = createGame("room-mock", "p1", mockDeck);
    expect(game.trumpSuit).toBe("oros");

    // P1 plays As de oros (11 pts, trump)
    playCard(game, "p1", "o1");
    expect(game.turn).toBe("p2");
    expect(game.currentTrick.leadCard?.id).toBe("o1");

    // P2 plays As de copas (11 pts, non-trump)
    playCard(game, "p2", "c1");

    // P1 wins because As de oros is trump
    expect(game.scores.p1).toBe(22); // 11 + 11
    expect(game.scores.p2).toBe(0);
    expect(game.leadPlayer).toBe("p1");
    expect(game.turn).toBe("p1");

    // Both players should have drawn 1 card, so hand size remains 3
    expect(game.hands.p1).toHaveLength(3);
    expect(game.hands.p2).toHaveLength(3);
    expect(game.hands.p1.some((c) => c.id === "draw1")).toBe(true);
    expect(game.hands.p2.some((c) => c.id === "draw2")).toBe(true);
  });

  it("swaps the 7 for a figure", () => {
    const mockDeck: Card[] = [
      // P1 hand with 7 of trumps
      { id: "o7", suit: "oros", rank: 7, points: 0 },
      { id: "c2", suit: "copas", rank: 2, points: 0 },
      { id: "b5", suit: "bastos", rank: 5, points: 0 },
      // P2 hand
      { id: "c1", suit: "copas", rank: 1, points: 11 },
      { id: "e2", suit: "espadas", rank: 2, points: 0 },
      { id: "b7", suit: "bastos", rank: 7, points: 0 },
      // Caballo de oros (figura): the 7 can swap it.
      { id: "o11", suit: "oros", rank: 11, points: 3 },
      // Remaining deck cards
      { id: "extra1", suit: "copas", rank: 5, points: 0 },
      { id: "extra2", suit: "espadas", rank: 6, points: 0 },
    ];

    const game = createGame("room-swap", "p1", mockDeck);

    // P1 swaps 7 de oros for Caballo de oros
    swapTrumpCard(game, "p1", "o7");

    expect(game.trumpCard.id).toBe("o7");
    expect(game.hands.p1.some((c) => c.id === "o11")).toBe(true);
    expect(game.hands.p1.some((c) => c.id === "o7")).toBe(false);
  });

  it("rejects swapping the 2 for a figure (reported exploit)", () => {
    const mockDeck: Card[] = [
      { id: "o2", suit: "oros", rank: 2, points: 0 },
      { id: "c2", suit: "copas", rank: 2, points: 0 },
      { id: "b5", suit: "bastos", rank: 5, points: 0 },
      { id: "c1", suit: "copas", rank: 1, points: 11 },
      { id: "e2", suit: "espadas", rank: 2, points: 0 },
      { id: "b7", suit: "bastos", rank: 7, points: 0 },
      { id: "o11", suit: "oros", rank: 11, points: 3 },
      { id: "extra1", suit: "copas", rank: 5, points: 0 },
      { id: "extra2", suit: "espadas", rank: 6, points: 0 },
    ];

    const game = createGame("room-exploit", "p1", mockDeck);

    expect(() => swapTrumpCard(game, "p1", "o2")).toThrow(/Cannot swap trump/);
    expect(game.trumpCard.id).toBe("o11");
    expect(game.hands.p1.some((c) => c.id === "o2")).toBe(true);
  });

  it("swaps the 2 for the 7", () => {
    const mockDeck: Card[] = [
      { id: "o2", suit: "oros", rank: 2, points: 0 },
      { id: "c2", suit: "copas", rank: 2, points: 0 },
      { id: "b5", suit: "bastos", rank: 5, points: 0 },
      { id: "c1", suit: "copas", rank: 1, points: 11 },
      { id: "e2", suit: "espadas", rank: 2, points: 0 },
      { id: "b7", suit: "bastos", rank: 7, points: 0 },
      { id: "o7", suit: "oros", rank: 7, points: 0 },
      { id: "extra1", suit: "copas", rank: 5, points: 0 },
      { id: "extra2", suit: "espadas", rank: 6, points: 0 },
    ];

    const game = createGame("room-swap-two", "p1", mockDeck);

    swapTrumpCard(game, "p1", "o2");

    expect(game.trumpCard.id).toBe("o2");
    expect(game.hands.p1.some((c) => c.id === "o7")).toBe(true);
    expect(game.hands.p1.some((c) => c.id === "o2")).toBe(false);
  });

  it("handles non-blocking trick resolution when autoCollect is false", () => {
    const mockDeck: Card[] = [
      { id: "o1", suit: "oros", rank: 1, points: 11 },
      { id: "c2", suit: "copas", rank: 2, points: 0 },
      { id: "b5", suit: "bastos", rank: 5, points: 0 },
      { id: "c1", suit: "copas", rank: 1, points: 11 },
      { id: "e2", suit: "espadas", rank: 2, points: 0 },
      { id: "b7", suit: "bastos", rank: 7, points: 0 },
      { id: "o7", suit: "oros", rank: 7, points: 0 }, // Trump
      { id: "draw1", suit: "oros", rank: 3, points: 10 },
      { id: "draw2", suit: "copas", rank: 3, points: 10 },
    ];

    const game = createGame("room-delayed", "p1", mockDeck);
    playCard(game, "p1", "o1", false);
    expect(game.phase).toBe("PLAYER_TURN");
    expect(game.turn).toBe("p2");

    // P2 plays with autoCollect = false
    playCard(game, "p2", "c1", false);
    expect(game.phase).toBe("RESOLVING_TRICK");
    expect(game.currentTrick.leadCard?.id).toBe("o1");
    expect(game.currentTrick.followCard?.id).toBe("c1");
    expect(game.currentTrick.winner).toBe("p1");
    // Scores and draws not committed yet
    expect(game.scores.p1).toBe(0);

    // Call collectTrick manually
    collectTrick(game);
    expect(game.phase).toBe("PLAYER_TURN");
    expect(game.scores.p1).toBe(22);
    expect(game.hands.p1).toHaveLength(3);
  });
});
