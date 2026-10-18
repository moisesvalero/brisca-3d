import { describe, it, expect } from "vitest";
import { resolveTrick, canSwapTrump, Card } from "../src/index.js";

describe("Trick Resolution", () => {
  const trump = "oros";

  it("winner is lead player if follow player plays non-trump of different suit", () => {
    const lead: Card = { id: "c1", suit: "copas", rank: 7, points: 0 };
    const follow: Card = { id: "e1", suit: "espadas", rank: 1, points: 11 };

    const winner = resolveTrick(lead, follow, trump);
    expect(winner).toBe("lead"); // Lead played copas, follow played espadas (not trump), lead wins
  });

  it("winner is highest card of lead suit if neither plays trump", () => {
    const lead: Card = { id: "c1", suit: "copas", rank: 7, points: 0 };
    const follow: Card = { id: "c2", suit: "copas", rank: 3, points: 10 }; // 3 is higher than 7

    const winner = resolveTrick(lead, follow, trump);
    expect(winner).toBe("follow");
  });

  it("trump beats any non-trump card", () => {
    const lead: Card = { id: "e1", suit: "espadas", rank: 1, points: 11 }; // As de espadas
    const follow: Card = { id: "o2", suit: "oros", rank: 2, points: 0 }; // 2 de oros (triunfo)

    const winner = resolveTrick(lead, follow, trump);
    expect(winner).toBe("follow"); // Trump wins even if points are 0 vs 11
  });

  it("highest trump wins when both players play trump", () => {
    const lead: Card = { id: "o12", suit: "oros", rank: 12, points: 4 }; // Rey de oros
    const follow: Card = { id: "o3", suit: "oros", rank: 3, points: 10 }; // 3 de oros

    const winner = resolveTrick(lead, follow, trump);
    expect(winner).toBe("follow"); // 3 is higher hierarchy than Rey
  });
});

describe("Trump Card Swap (Regla del 7 y 2)", () => {
  it("allows swapping with 2 if trump card has points or rank > 7", () => {
    const trumpCard: Card = { id: "o1", suit: "oros", rank: 1, points: 11 }; // As de oros
    const sevenTrump: Card = { id: "o7", suit: "oros", rank: 7, points: 0 };
    const twoTrump: Card = { id: "o2", suit: "oros", rank: 2, points: 0 };

    expect(canSwapTrump(twoTrump, trumpCard)).toBe(true);
    expect(canSwapTrump(sevenTrump, trumpCard)).toBe(false);
  });

  it("allows swapping with 7 if trump card is white card <= 7", () => {
    const trumpCard: Card = { id: "o5", suit: "oros", rank: 5, points: 0 };
    const twoTrump: Card = { id: "o2", suit: "oros", rank: 2, points: 0 };
    const sevenTrump: Card = { id: "o7", suit: "oros", rank: 7, points: 0 };

    expect(canSwapTrump(sevenTrump, trumpCard)).toBe(true);
    expect(canSwapTrump(twoTrump, trumpCard)).toBe(false);
  });

  it("allows the 7 against a 6 trump (the reported case)", () => {
    const trumpCard: Card = { id: "o6", suit: "oros", rank: 6, points: 0 };
    const sevenTrump: Card = { id: "o7", suit: "oros", rank: 7, points: 0 };
    const twoTrump: Card = { id: "o2", suit: "oros", rank: 2, points: 0 };

    expect(canSwapTrump(sevenTrump, trumpCard)).toBe(true);
    expect(canSwapTrump(twoTrump, trumpCard)).toBe(false);
  });

  it("rejects swap if player card is not of trump suit", () => {
    const trumpCard: Card = { id: "o1", suit: "oros", rank: 1, points: 11 };
    const wrongSuitSeven: Card = {
      id: "c7",
      suit: "copas",
      rank: 7,
      points: 0,
    };

    expect(canSwapTrump(wrongSuitSeven, trumpCard)).toBe(false);
  });
});
