import { Card, Suit } from "./types.js";
import { RANK_HIERARCHY } from "./deck.js";

export type TrickWinner = "lead" | "follow";

/**
 * Determines whether the lead card or the follow card wins the trick.
 */
export function resolveTrick(
  leadCard: Card,
  followCard: Card,
  trumpSuit: Suit,
): TrickWinner {
  const leadIsTrump = leadCard.suit === trumpSuit;
  const followIsTrump = followCard.suit === trumpSuit;

  // Case 1: Both are trumps
  if (leadIsTrump && followIsTrump) {
    return RANK_HIERARCHY[followCard.rank] > RANK_HIERARCHY[leadCard.rank]
      ? "follow"
      : "lead";
  }

  // Case 2: One is trump and the other is not
  if (followIsTrump && !leadIsTrump) {
    return "follow";
  }
  if (leadIsTrump && !followIsTrump) {
    return "lead";
  }

  // Case 3: Neither is trump
  // If follow matches lead suit, compare hierarchy
  if (followCard.suit === leadCard.suit) {
    return RANK_HIERARCHY[followCard.rank] > RANK_HIERARCHY[leadCard.rank]
      ? "follow"
      : "lead";
  }

  // If follow does not match lead suit and is not trump, lead always wins
  return "lead";
}

/**
 * Regla del 7 y 2 de esta versión:
 * - El 7 de triunfo solo puede cambiar una carta alta
 *   (As, Tres, Rey, Caballo o Sota).
 * - El 2 de triunfo solo puede cambiar el 7 de triunfo.
 * Cualquier otro intercambio se rechaza. El servidor valida con esta misma
 * función, así que no depende de lo que haga el cliente.
 */
export function canSwapTrump(
  playerCard: Card,
  currentTrumpCard: Card,
): boolean {
  if (playerCard.suit !== currentTrumpCard.suit) {
    return false;
  }

  if (playerCard.rank === 7) {
    return currentTrumpCard.points > 0 || currentTrumpCard.rank > 7;
  }

  if (playerCard.rank === 2) {
    return currentTrumpCard.rank === 7;
  }

  return false;
}
