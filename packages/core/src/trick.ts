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
 * Regla oficial del 7 y el 2:
 * - Si el triunfo descubierto es mayor que 7 (As, Tres, Rey, Caballo o Sota),
 *   el jugador que tenga el 7 de triunfo puede cambiarlo por esa carta.
 * - Si el triunfo descubierto es 7 o menor (7, 6, 5, 4 o 2), el cambio se
 *   hace con el 2 de triunfo.
 * - En ambos casos el jugador debe haber ganado al menos una baza.
 * El mazo debe conservar cartas; eso lo valida swapTrumpCard.
 * El servidor usa esta misma función, así que no depende del cliente.
 */
export function canSwapTrump(
  playerCard: Card,
  currentTrumpCard: Card,
  playerHasWonTrick: boolean,
): boolean {
  if (!playerHasWonTrick) {
    return false;
  }
  if (playerCard.suit !== currentTrumpCard.suit) {
    return false;
  }

  const currentTrumpIsHigh =
    currentTrumpCard.rank > 7 || currentTrumpCard.points > 0;

  return currentTrumpIsHigh ? playerCard.rank === 7 : playerCard.rank === 2;
}
