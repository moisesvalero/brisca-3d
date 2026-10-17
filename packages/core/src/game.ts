import { Card, GameState, PlayerId } from "./types.js";
import { createDeck, shuffleDeck } from "./deck.js";
import { resolveTrick, canSwapTrump } from "./trick.js";

export function createGame(
  id: string,
  initialLead: PlayerId = "p1",
  customDeck?: Card[],
): GameState {
  const fullDeck = customDeck ? [...customDeck] : shuffleDeck(createDeck());

  const handP1 = fullDeck.splice(0, 3);
  const handP2 = fullDeck.splice(0, 3);
  const trumpCard = fullDeck.shift()!;
  const trumpSuit = trumpCard.suit;

  return {
    id,
    phase: "PLAYER_TURN",
    turn: initialLead,
    leadPlayer: initialLead,
    trumpCard,
    trumpSuit,
    trumpTaken: false,
    deck: fullDeck,
    hands: {
      p1: handP1,
      p2: handP2,
    },
    scores: {
      p1: 0,
      p2: 0,
    },
    tricksWon: {
      p1: [],
      p2: [],
    },
    currentTrick: {
      leadPlayer: initialLead,
      points: 0,
    },
  };
}

export function playCard(
  game: GameState,
  playerId: PlayerId,
  cardId: string,
  autoCollect: boolean = true,
): GameState {
  if (game.phase !== "PLAYER_TURN") {
    throw new Error(`Cannot play card in phase: ${game.phase}`);
  }
  if (game.turn !== playerId) {
    throw new Error(`Not ${playerId}'s turn`);
  }

  const hand = game.hands[playerId];
  const cardIndex = hand.findIndex((c) => c.id === cardId);
  if (cardIndex === -1) {
    throw new Error(`Player ${playerId} does not have card ${cardId}`);
  }

  const [playedCard] = hand.splice(cardIndex, 1);
  const otherPlayer: PlayerId = playerId === "p1" ? "p2" : "p1";

  // If this is the lead card of the trick
  if (!game.currentTrick.leadCard) {
    game.currentTrick.leadCard = playedCard;
    game.currentTrick.leadPlayer = playerId;
    game.currentTrick.points = playedCard.points;
    game.turn = otherPlayer;
    return game;
  }

  // Follow card played: Resolve trick
  game.currentTrick.followCard = playedCard;
  game.currentTrick.points += playedCard.points;

  const leadCard = game.currentTrick.leadCard;
  const winnerSide = resolveTrick(leadCard, playedCard, game.trumpSuit);
  const trickWinner: PlayerId =
    winnerSide === "lead" ? game.currentTrick.leadPlayer : playerId;

  game.currentTrick.winner = trickWinner;
  game.phase = "RESOLVING_TRICK";

  if (autoCollect) {
    return collectTrick(game);
  }

  return game;
}

export function collectTrick(game: GameState): GameState {
  if (game.phase !== "RESOLVING_TRICK" && !game.currentTrick.winner) {
    return game;
  }

  const trickWinner = game.currentTrick.winner!;
  const leadCard = game.currentTrick.leadCard!;
  const followCard = game.currentTrick.followCard!;

  game.scores[trickWinner] += game.currentTrick.points;
  game.tricksWon[trickWinner].push(leadCard, followCard);

  // Draw cards if deck still has cards
  if (game.deck.length > 0) {
    // Winner draws first
    const winnerCard = game.deck.shift()!;
    game.hands[trickWinner].push(winnerCard);

    // Loser draws second: either next card from deck or the trump card if deck emptied
    const loser: PlayerId = trickWinner === "p1" ? "p2" : "p1";
    if (game.deck.length > 0) {
      game.hands[loser].push(game.deck.shift()!);
    } else {
      // Last card is the trump card on table
      game.hands[loser].push(game.trumpCard);
      game.trumpTaken = true;
    }
  }

  // Check game over
  const p1HandEmpty = game.hands.p1.length === 0;
  const p2HandEmpty = game.hands.p2.length === 0;

  if (p1HandEmpty && p2HandEmpty && game.deck.length === 0) {
    game.phase = "GAME_OVER";
    if (game.scores.p1 > game.scores.p2) {
      game.winner = "p1";
    } else if (game.scores.p2 > game.scores.p1) {
      game.winner = "p2";
    } else {
      game.winner = "draw";
    }
  } else {
    // Prepare next trick
    game.phase = "PLAYER_TURN";
    game.leadPlayer = trickWinner;
    game.turn = trickWinner;
    game.currentTrick = {
      leadPlayer: trickWinner,
      points: 0,
    };
  }

  return game;
}

export function swapTrumpCard(
  game: GameState,
  playerId: PlayerId,
  cardId: string,
): GameState {
  if (game.phase !== "PLAYER_TURN") {
    throw new Error("Can only swap trump during active player turn");
  }
  if (game.deck.length === 0) {
    throw new Error("Cannot swap trump card once deck is exhausted");
  }

  const hand = game.hands[playerId];
  const cardIndex = hand.findIndex((c) => c.id === cardId);
  if (cardIndex === -1) {
    throw new Error(`Player does not have card ${cardId}`);
  }

  const card = hand[cardIndex];
  if (!canSwapTrump(card, game.trumpCard)) {
    throw new Error(
      `Cannot swap trump card ${game.trumpCard.id} with ${card.id}`,
    );
  }

  // Swap
  const oldTrump = game.trumpCard;
  game.trumpCard = card;
  game.trumpTaken = false;
  game.hands[playerId][cardIndex] = oldTrump;

  return game;
}
