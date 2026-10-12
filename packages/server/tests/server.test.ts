import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { WebSocket } from "ws";
import { createBriscaServer, ServerInstance } from "../src/index.js";

describe("Brisca Server Integration Test", () => {
  let server: ServerInstance;
  const TEST_PORT = 9988;

  beforeAll(async () => {
    server = createBriscaServer(TEST_PORT);
    await new Promise<void>((resolve) => {
      if (server.wss.address()) {
        resolve();
      } else {
        server.wss.on("listening", resolve);
      }
    });
  });

  afterAll(async () => {
    await server.close();
  });

  it("creates room, allows player 2 to join, and starts game", async () => {
    const ws1 = new WebSocket(`ws://127.0.0.1:${TEST_PORT}`);
    const ws2 = new WebSocket(`ws://127.0.0.1:${TEST_PORT}`);

    await new Promise((res) => ws1.on("open", res));
    await new Promise((res) => ws2.on("open", res));

    let roomCode = "";

    // Step 1: P1 creates room
    const p1Created = new Promise<void>((resolve) => {
      ws1.on("message", (raw) => {
        const msg = JSON.parse(raw.toString());
        if (msg.type === "ROOM_CREATED") {
          roomCode = msg.payload.roomCode;
          expect(roomCode).toHaveLength(4);
          resolve();
        }
      });
    });

    ws1.send(JSON.stringify({ type: "CREATE_ROOM", name: "Moisés" }));
    await p1Created;

    // Step 2: P2 joins room
    const p1GameStarted = new Promise<any>((resolve) => {
      ws1.on("message", (raw) => {
        const msg = JSON.parse(raw.toString());
        if (msg.type === "GAME_STATE") {
          resolve(msg.payload);
        }
      });
    });

    const p2GameStarted = new Promise<any>((resolve) => {
      ws2.on("message", (raw) => {
        const msg = JSON.parse(raw.toString());
        if (msg.type === "GAME_STATE") {
          resolve(msg.payload);
        }
      });
    });

    ws2.send(JSON.stringify({ type: "JOIN_ROOM", roomCode, name: "Amigo" }));

    const [p1State, p2State] = await Promise.all([
      p1GameStarted,
      p2GameStarted,
    ]);

    expect(p1State.roomCode).toBe(roomCode);
    expect(p1State.myHand).toHaveLength(3);
    expect(p1State.opponentCardCount).toBe(3);
    expect(p1State.deckCount).toBe(33);
    expect(p1State.trumpCard).toBeDefined();

    expect(p2State.roomCode).toBe(roomCode);
    expect(p2State.myHand).toHaveLength(3);

    // Step 3: P1 plays their first card
    const firstCardId = p1State.myHand[0].id;
    const trickUpdated = new Promise<any>((resolve) => {
      ws2.on("message", (raw) => {
        const msg = JSON.parse(raw.toString());
        if (
          msg.type === "GAME_STATE" &&
          msg.payload.currentTrick?.leadCard?.id === firstCardId
        ) {
          resolve(msg.payload);
        }
      });
    });

    ws1.send(JSON.stringify({ type: "PLAY_CARD", cardId: firstCardId }));
    const updatedState = await trickUpdated;

    expect(updatedState.currentTrick.leadCard.id).toBe(firstCardId);
    expect(updatedState.turn).toBe("p2");

    ws1.close();
    ws2.close();
  });
});
