import { describe, it, expect } from "vitest";
import {
  resolveTrick,
  canSwapTrump,
  Card,
  RANKS,
  CARD_POINTS,
} from "../src/index.js";

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

describe("Trump Card Swap (regla oficial del 7 y 2)", () => {
  const makeCard = (rank: Card["rank"], suit: Card["suit"] = "oros"): Card => ({
    id: `${suit}_${rank}`,
    suit,
    rank,
    points: CARD_POINTS[rank],
  });
  const highRanks = new Set([1, 3, 10, 11, 12]);
  const lowRanks = new Set([2, 4, 5, 6, 7]);

  it("aplica 7 contra triunfo alto y 2 contra triunfo de 7 o menor", () => {
    for (const trumpRank of RANKS) {
      for (const playerRank of [2, 7] as const) {
        const expected =
          playerRank === 7 ? highRanks.has(trumpRank) : lowRanks.has(trumpRank);

        expect(
          canSwapTrump(makeCard(playerRank), makeCard(trumpRank), true),
          `${playerRank} contra ${trumpRank} con baza ganada`,
        ).toBe(expected);
        expect(
          canSwapTrump(makeCard(playerRank), makeCard(trumpRank), false),
          `${playerRank} contra ${trumpRank} sin baza ganada`,
        ).toBe(false);
      }
    }
  });

  it("rechaza el 2 contra una figura aunque ya haya ganado baza", () => {
    for (const rank of [1, 3, 10, 11, 12] as const) {
      expect(canSwapTrump(makeCard(2), makeCard(rank), true)).toBe(false);
    }
  });

  it("permite el 7 contra As, Tres y figuras", () => {
    for (const rank of [1, 3, 10, 11, 12] as const) {
      expect(canSwapTrump(makeCard(7), makeCard(rank), true)).toBe(true);
    }
  });

  it("permite el 2 contra triunfos de 7 o menor", () => {
    for (const rank of [4, 5, 6, 7] as const) {
      expect(canSwapTrump(makeCard(2), makeCard(rank), true)).toBe(true);
    }
  });

  it("rechaza el 7 contra triunfos de 7 o menor", () => {
    for (const rank of [2, 4, 5, 6, 7] as const) {
      expect(canSwapTrump(makeCard(7), makeCard(rank), true)).toBe(false);
    }
  });

  it("exige haber ganado al menos una baza", () => {
    expect(canSwapTrump(makeCard(7), makeCard(11), false)).toBe(false);
    expect(canSwapTrump(makeCard(2), makeCard(7), false)).toBe(false);
    expect(canSwapTrump(makeCard(7), makeCard(11), true)).toBe(true);
    expect(canSwapTrump(makeCard(2), makeCard(7), true)).toBe(true);
  });

  it("rechaza cartas distintas del 2 o el 7", () => {
    expect(canSwapTrump(makeCard(3), makeCard(11), true)).toBe(false);
    expect(canSwapTrump(makeCard(10), makeCard(7), true)).toBe(false);
  });

  it("rechaza si la carta no es del palo del triunfo", () => {
    expect(canSwapTrump(makeCard(7, "copas"), makeCard(1), true)).toBe(false);
    expect(canSwapTrump(makeCard(2, "copas"), makeCard(7), true)).toBe(false);
  });
});
