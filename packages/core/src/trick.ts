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
 * Checks whether a player can swap their card with the active trump card on table.
 * Standard Brisca rule:
 * - 7 of trumps can be swapped if active trump is a high card (> 7 or has points: As, 3, Rey, Caballo, Sota).
 * - 2 of trumps can be swapped if active trump is a white card (<= 7: 4, 5, 6, 7).
 */
export function canSwapTrump(
  playerCard: Card,
  currentTrumpCard: Card,
): boolean {
  if (playerCard.suit !== currentTrumpCard.suit) {
    return false;
  }

  const isHighTrump = currentTrumpCard.points > 0 || currentTrumpCard.rank > 7;

  if (isHighTrump) {
    return playerCard.rank === 7;
  } else {
    return playerCard.rank === 2;
  }
}
