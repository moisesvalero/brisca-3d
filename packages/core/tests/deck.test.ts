import { describe, it, expect } from "vitest";
import { createDeck, getCardPoints, SUITS, RANKS } from "../src/deck.js";

describe("Deck and Card Points", () => {
  it("creates a standard Spanish deck of 40 cards", () => {
    const deck = createDeck();
    expect(deck).toHaveLength(40);

    // 10 cards per suit
    for (const suit of SUITS) {
      const suitCards = deck.filter((c) => c.suit === suit);
      expect(suitCards).toHaveLength(10);
      expect(suitCards.map((c) => c.rank).sort((a, b) => a - b)).toEqual(
        [...RANKS].sort((a, b) => a - b),
      );
    }
  });

  it("calculates the exact Brisca points for each card rank", () => {
    expect(getCardPoints(1)).toBe(11); // As
    expect(getCardPoints(3)).toBe(10); // Tres
    expect(getCardPoints(12)).toBe(4); // Rey
    expect(getCardPoints(11)).toBe(3); // Caballo
    expect(getCardPoints(10)).toBe(2); // Sota
    expect(getCardPoints(2)).toBe(0);
    expect(getCardPoints(4)).toBe(0);
    expect(getCardPoints(5)).toBe(0);
    expect(getCardPoints(6)).toBe(0);
    expect(getCardPoints(7)).toBe(0);
  });

  it("totals exactly 120 points for the complete 40-card deck", () => {
    const deck = createDeck();
    const totalPoints = deck.reduce((sum, card) => sum + card.points, 0);
    expect(totalPoints).toBe(120);
  });
});
