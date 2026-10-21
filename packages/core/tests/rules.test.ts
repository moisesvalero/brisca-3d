import { describe, expect, it } from "vitest";
import {
  CARD_POINTS,
  RANK_HIERARCHY,
  RANKS,
  SUITS,
  collectTrick,
  createDeck,
  createGame,
  getCardPoints,
  playCard,
  resolveTrick,
  swapTrumpCard,
  Card,
  GameState,
  PlayerId,
} from "../src/index.js";

function card(rank: Card["rank"], suit: Card["suit"] = "oros"): Card {
  return {
    id: `${suit}_${rank}`,
    suit,
    rank,
    points: getCardPoints(rank),
  };
}

/**
 * Cards currently owned somewhere in the game. The face-up trump is added
 * separately while it is still on the table; once taken it lives in a hand.
 */
function allCardIds(game: GameState): string[] {
  return [
    ...game.hands.p1,
    ...game.hands.p2,
    ...game.deck,
    ...(game.trumpTaken ? [] : [game.trumpCard]),
    ...game.tricksWon.p1,
    ...game.tricksWon.p2,
  ].map((c) => c.id);
}

function expectAllCardsAccountedFor(game: GameState): void {
  const ids = allCardIds(game);
  expect(ids).toHaveLength(40);
  expect(new Set(ids).size).toBe(40);
}

describe("Auditoría de reglas: baraja y puntuación", () => {
  it("tiene 40 cartas únicas y suma 120 puntos", () => {
    const deck = createDeck();

    expect(deck).toHaveLength(40);
    expect(new Set(deck.map((c) => c.id)).size).toBe(40);
    expect(deck.reduce((sum, c) => sum + c.points, 0)).toBe(120);

    for (const suit of SUITS) {
      const suitCards = deck.filter((c) => c.suit === suit);
      expect(suitCards).toHaveLength(10);
      expect(suitCards.map((c) => c.rank).sort((a, b) => a - b)).toEqual(
        [...RANKS].sort((a, b) => a - b),
      );
    }
  });

  it("respeta el valor y la jerarquía oficial", () => {
    expect(CARD_POINTS).toEqual({
      1: 11,
      2: 0,
      3: 10,
      4: 0,
      5: 0,
      6: 0,
      7: 0,
      10: 2,
      11: 3,
      12: 4,
    });

    const byStrength = [...RANKS].sort(
      (a, b) => RANK_HIERARCHY[b] - RANK_HIERARCHY[a],
    );
    expect(byStrength).toEqual([1, 3, 12, 11, 10, 7, 6, 5, 4, 2]);

    for (const rank of RANKS) {
      expect(getCardPoints(rank)).toBe(CARD_POINTS[rank]);
    }
  });
});

describe("Auditoría de reglas: resolución de bazas", () => {
  it("cumple las cuatro reglas de victoria en todas las combinaciones", () => {
    const deck = createDeck();

    for (const trump of SUITS) {
      for (const leadCard of deck) {
        for (const followCard of deck) {
          const leadIsTrump = leadCard.suit === trump;
          const followIsTrump = followCard.suit === trump;
          let expected: "lead" | "follow";

          if (leadIsTrump && followIsTrump) {
            expected =
              RANK_HIERARCHY[followCard.rank] > RANK_HIERARCHY[leadCard.rank]
                ? "follow"
                : "lead";
          } else if (leadIsTrump) {
            expected = "lead";
          } else if (followIsTrump) {
            expected = "follow";
          } else if (followCard.suit === leadCard.suit) {
            expected =
              RANK_HIERARCHY[followCard.rank] > RANK_HIERARCHY[leadCard.rank]
                ? "follow"
                : "lead";
          } else {
            expected = "lead";
          }

          expect(
            resolveTrick(leadCard, followCard, trump),
            `${leadCard.id} vs ${followCard.id} con triunfo ${trump}`,
          ).toBe(expected);
        }
      }
    }
  });
});

describe("Auditoría de reglas: reparto y partida completa", () => {
  it("reparte 3+3, descubre una carta y deja 33 en el mazo", () => {
    const deck = createDeck();
    const game = createGame("audit-deal", "p1", deck);

    expect(game.hands.p1).toHaveLength(3);
    expect(game.hands.p2).toHaveLength(3);
    expect(game.deck).toHaveLength(33);
    expect(game.trumpCard).toBeDefined();
    expect(game.trumpSuit).toBe(game.trumpCard.suit);
    expect(game.trumpTaken).toBe(false);
    expect(game.phase).toBe("PLAYER_TURN");
    expect(game.turn).toBe("p1");
    expect(game.leadPlayer).toBe("p1");

    expect(game.hands.p1.map((c) => c.id)).toEqual(
      deck.slice(0, 3).map((c) => c.id),
    );
    expect(game.hands.p2.map((c) => c.id)).toEqual(
      deck.slice(3, 6).map((c) => c.id),
    );
    expect(game.trumpCard.id).toBe(deck[6].id);
    expect(game.deck.map((c) => c.id)).toEqual(deck.slice(7).map((c) => c.id));
    expectAllCardsAccountedFor(game);
  });

  it("permite fallar sin asistir ni superar el palo", () => {
    const custom: Card[] = [
      card(1, "oros"),
      card(2, "copas"),
      card(3, "espadas"),
      card(4, "oros"),
      card(5, "copas"),
      card(6, "espadas"),
      card(7, "bastos"),
      card(10, "copas"),
      card(11, "espadas"),
    ];
    let game = createGame("audit-follow", "p1", custom);

    // p1 sale de oros y p2 falla con copas: la carta de otro palo es legal.
    game = playCard(game, "p1", "oros_1", false);
    game = playCard(game, "p2", "copas_5", false);

    expect(game.phase).toBe("RESOLVING_TRICK");
    expect(game.currentTrick.followCard?.id).toBe("copas_5");
    expect(game.currentTrick.winner).toBe("p1");
  });

  it("juega una partida completa sin perder ni duplicar cartas", () => {
    let game = createGame("audit-full", "p1", createDeck());
    let tricks = 0;
    let guard = 0;

    expectAllCardsAccountedFor(game);

    while (game.phase !== "GAME_OVER" && guard < 100) {
      guard += 1;

      // Both hands stay balanced and the previous winner opens the trick.
      expect(game.hands.p1).toHaveLength(game.hands.p2.length);
      expect(game.turn).toBe(game.leadPlayer);
      expect(game.currentTrick.leadCard).toBeUndefined();

      const leader = game.turn;
      const leadCard = game.hands[leader][0];
      game = playCard(game, leader, leadCard.id, false);

      expect(game.currentTrick.leadCard?.id).toBe(leadCard.id);
      expect(game.currentTrick.leadPlayer).toBe(leader);
      expect(game.currentTrick.points).toBe(leadCard.points);

      const follower: PlayerId = leader === "p1" ? "p2" : "p1";
      const followCard = game.hands[follower][0];
      game = playCard(game, follower, followCard.id, false);

      expect(game.phase).toBe("RESOLVING_TRICK");
      expect(game.currentTrick.followCard?.id).toBe(followCard.id);
      expect(game.currentTrick.points).toBe(
        leadCard.points + followCard.points,
      );

      const expectedSide = resolveTrick(leadCard, followCard, game.trumpSuit);
      const expectedWinner: PlayerId =
        expectedSide === "lead" ? leader : follower;
      expect(game.currentTrick.winner).toBe(expectedWinner);

      const scoresBefore = { ...game.scores };
      const tricksBefore = {
        p1: game.tricksWon.p1.length,
        p2: game.tricksWon.p2.length,
      };
      const deckBefore = game.deck.length;
      const deckTop = game.deck[0];
      const deckSecond = game.deck[1];
      const trumpBefore = game.trumpCard;
      const trumpTakenBefore = game.trumpTaken;
      const trickPoints = game.currentTrick.points;

      game = collectTrick(game);
      tricks += 1;

      expect(game.scores[expectedWinner]).toBe(
        scoresBefore[expectedWinner] + trickPoints,
      );

      const loser: PlayerId = expectedWinner === "p1" ? "p2" : "p1";
      expect(game.scores[loser]).toBe(scoresBefore[loser]);
      expect(game.tricksWon[expectedWinner]).toHaveLength(
        tricksBefore[expectedWinner] + 2,
      );

      if (deckBefore > 1) {
        expect(trumpTakenBefore).toBe(false);
        expect(game.trumpTaken).toBe(false);
        expect(game.deck).toHaveLength(deckBefore - 2);
        expect(
          game.hands[expectedWinner].some((c) => c.id === deckTop.id),
        ).toBe(true);
        expect(game.hands[loser].some((c) => c.id === deckSecond.id)).toBe(
          true,
        );
      } else if (deckBefore === 1) {
        expect(trumpTakenBefore).toBe(false);
        expect(game.trumpTaken).toBe(true);
        expect(game.deck).toHaveLength(0);
        expect(
          game.hands[expectedWinner].some((c) => c.id === deckTop.id),
        ).toBe(true);
        expect(game.hands[loser].some((c) => c.id === trumpBefore.id)).toBe(
          true,
        );
      } else {
        expect(game.deck).toHaveLength(0);
      }

      if (game.phase !== "GAME_OVER") {
        expect(game.leadPlayer).toBe(expectedWinner);
        expect(game.turn).toBe(expectedWinner);
      }

      expectAllCardsAccountedFor(game);
    }

    expect(guard).toBeLessThan(100);
    expect(tricks).toBe(20);
    expect(game.phase).toBe("GAME_OVER");
    expect(game.deck).toHaveLength(0);
    expect(game.hands.p1).toHaveLength(0);
    expect(game.hands.p2).toHaveLength(0);
    expect(game.trumpTaken).toBe(true);
    expect(game.tricksWon.p1.length + game.tricksWon.p2.length).toBe(40);
    expect(game.scores.p1 + game.scores.p2).toBe(120);

    const totalScored = [...game.tricksWon.p1, ...game.tricksWon.p2].reduce(
      (sum, c) => sum + c.points,
      0,
    );
    expect(totalScored).toBe(120);

    if (game.scores.p1 > game.scores.p2) {
      expect(game.winner).toBe("p1");
    } else if (game.scores.p2 > game.scores.p1) {
      expect(game.winner).toBe("p2");
    } else {
      expect(game.winner).toBe("draw");
    }
  });
});

describe("Auditoría de reglas: fin de partida", () => {
  function finalGame(
    scores: { p1: number; p2: number },
    leadPoints: number,
    followPoints: number,
  ): GameState {
    const game = createGame("audit-final", "p1", createDeck());

    game.phase = "RESOLVING_TRICK";
    game.hands = { p1: [], p2: [] };
    game.deck = [];
    game.trumpTaken = true;
    game.scores = { ...scores };
    game.tricksWon = { p1: [], p2: [] };
    game.currentTrick = {
      leadPlayer: "p1",
      leadCard: {
        id: "final-lead",
        suit: "oros",
        rank: leadPoints === 11 ? 1 : 7,
        points: leadPoints,
      },
      followCard: {
        id: "final-follow",
        suit: "copas",
        rank: followPoints === 10 ? 3 : 2,
        points: followPoints,
      },
      winner: "p1",
      points: leadPoints + followPoints,
    };

    return game;
  }

  it("declara empate a 60 y no puntúa dos veces la última baza", () => {
    const once = collectTrick(finalGame({ p1: 49, p2: 60 }, 11, 0));

    expect(once.phase).toBe("GAME_OVER");
    expect(once.scores).toEqual({ p1: 60, p2: 60 });
    expect(once.winner).toBe("draw");
    expect(once.tricksWon.p1).toHaveLength(2);

    const twice = collectTrick(once);
    expect(twice).toBe(once);
    expect(twice.scores).toEqual({ p1: 60, p2: 60 });
    expect(twice.tricksWon.p1).toHaveLength(2);
    expect(twice.winner).toBe("draw");
  });

  it("declara ganador a quien supera 60", () => {
    const p1Win = collectTrick(finalGame({ p1: 55, p2: 54 }, 11, 0));
    expect(p1Win.scores).toEqual({ p1: 66, p2: 54 });
    expect(p1Win.winner).toBe("p1");

    const p2Win = collectTrick(finalGame({ p1: 40, p2: 70 }, 0, 0));
    expect(p2Win.scores).toEqual({ p1: 40, p2: 70 });
    expect(p2Win.winner).toBe("p2");
  });
});

describe("Auditoría de reglas: cambio de triunfo", () => {
  function swapGame(
    handRank: Card["rank"],
    trumpRank: Card["rank"],
    wonTrick = true,
  ): GameState {
    const custom: Card[] = [
      card(handRank),
      card(2, "copas"),
      card(5, "bastos"),
      card(1, "copas"),
      card(2, "espadas"),
      card(7, "bastos"),
      card(trumpRank),
      card(5, "copas"),
      card(6, "espadas"),
    ];
    const game = createGame("audit-swap", "p1", custom);
    if (wonTrick) {
      game.tricksWon.p1 = [card(4, "copas"), card(5, "copas")];
    }
    return game;
  }

  it("exige haber ganado al menos una baza", () => {
    expect(() => swapTrumpCard(swapGame(7, 11, false), "p1", "oros_7")).toThrow(
      /Cannot swap trump/,
    );
    expect(() => swapTrumpCard(swapGame(2, 7, false), "p1", "oros_2")).toThrow(
      /Cannot swap trump/,
    );
  });

  it("mantiene el palo, el turno y el tamaño de la mano al cambiar", () => {
    const game = swapGame(7, 11);
    const turnBefore = game.turn;
    const handSize = game.hands.p1.length;
    const oldTrump = game.trumpCard;

    swapTrumpCard(game, "p1", `oros_7`);

    expect(game.trumpCard.id).toBe("oros_7");
    expect(game.trumpSuit).toBe("oros");
    expect(game.trumpTaken).toBe(false);
    expect(game.turn).toBe(turnBefore);
    expect(game.hands.p1).toHaveLength(handSize);
    expect(game.hands.p1.some((c) => c.id === oldTrump.id)).toBe(true);
    expect(game.hands.p1.some((c) => c.id === "oros_7")).toBe(false);

    // El triunfo viejo es jugable y el nuevo sigue en la mesa.
    const afterLead = playCard(game, "p1", oldTrump.id, false);
    expect(afterLead.currentTrick.leadCard?.id).toBe(oldTrump.id);
    expect(afterLead.currentTrick.points).toBe(oldTrump.points);
    expect(afterLead.trumpCard.id).toBe("oros_7");
  });

  it("rechaza el 2 contra una figura y el 7 contra una blanca", () => {
    expect(() => swapTrumpCard(swapGame(2, 11), "p1", "oros_2")).toThrow(
      /Cannot swap trump/,
    );
    expect(() => swapTrumpCard(swapGame(7, 6), "p1", "oros_7")).toThrow(
      /Cannot swap trump/,
    );
  });

  it("permite cambiar el 7 durante la resolución antes del último robo", () => {
    const custom: Card[] = [
      card(1),
      card(7),
      card(5, "bastos"),
      card(2),
      card(2, "espadas"),
      card(7, "bastos"),
      card(11),
      card(5, "copas"),
    ];
    const game = createGame("audit-last-draw", "p1", custom);

    playCard(game, "p1", "oros_1", false);
    playCard(game, "p2", "oros_2", false);

    expect(game.phase).toBe("RESOLVING_TRICK");
    expect(game.deck).toHaveLength(1);
    expect(game.tricksWon.p1).toHaveLength(0);
    expect(game.currentTrick.winner).toBe("p1");

    // Gana la baza actual y cambia antes del último robo.
    swapTrumpCard(game, "p1", "oros_7");
    expect(game.trumpCard.id).toBe("oros_7");

    const collected = collectTrick(game);
    expect(collected.deck).toHaveLength(0);
    expect(collected.trumpTaken).toBe(true);
    expect(collected.hands.p2.some((c) => c.id === "oros_7")).toBe(true);
    expect(collected.hands.p1.some((c) => c.id === "copas_5")).toBe(true);
    expect(collected.scores.p1).toBe(11);
  });

  it("bloquea el cambio cuando el mazo está agotado", () => {
    const game = swapGame(7, 11);
    game.deck = [];

    expect(() => swapTrumpCard(game, "p1", "oros_7")).toThrow(
      /deck is exhausted/,
    );
  });
});
