import { Card, Rank, Suit } from "./types.js";

export const SUITS: Suit[] = ["oros", "copas", "espadas", "bastos"];
export const RANKS: Rank[] = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12];

export const CARD_POINTS: Record<Rank, number> = {
  1: 11, // As
  3: 10, // Tres
  12: 4, // Rey
  11: 3, // Caballo
  10: 2, // Sota
  7: 0,
  6: 0,
  5: 0,
  4: 0,
  2: 0,
};

// Hierarchy from strongest (10) to weakest (1) within the same suit
export const RANK_HIERARCHY: Record<Rank, number> = {
  1: 10, // As (strongest)
  3: 9, // Tres
  12: 8, // Rey
  11: 7, // Caballo
  10: 6, // Sota
  7: 5, // Siete
  6: 4, // Seis
  5: 3, // Cinco
  4: 2, // Cuatro
  2: 1, // Dos (weakest)
};

export function getCardPoints(rank: Rank): number {
  return CARD_POINTS[rank] ?? 0;
}

export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({
        id: `${suit}_${rank}`,
        suit,
        rank,
        points: getCardPoints(rank),
      });
    }
  }
  return deck;
}

export function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
