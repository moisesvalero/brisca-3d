import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { AddressInfo } from "node:net";
import { WebSocket } from "ws";
import { createBriscaServer, ServerInstance } from "../src/index.js";

interface ServerMessage {
  type: string;
  payload?: any;
  message?: string;
}

class TestClient {
  public readonly ws: WebSocket;
  public messages: ServerMessage[] = [];
  public state: any = null;
  public stateVersion = 0;
  private pending: Array<{
    predicate: (message: ServerMessage) => boolean;
    resolve: (message: ServerMessage) => void;
  }> = [];
  private consumed = new Set<ServerMessage>();

  constructor(port: number) {
    this.ws = new WebSocket(`ws://127.0.0.1:${port}`);
    this.ws.on("message", (raw) => {
      const message = JSON.parse(raw.toString()) as ServerMessage;
      this.messages.push(message);
      if (message.type === "GAME_STATE") {
        this.state = message.payload;
        this.stateVersion += 1;
      }
      const index = this.pending.findIndex((waiter) =>
        waiter.predicate(message),
      );
      if (index >= 0) {
        const [waiter] = this.pending.splice(index, 1);
        this.consumed.add(message);
        waiter.resolve(message);
      }
    });
  }

  public open(): Promise<void> {
    if (this.ws.readyState === WebSocket.OPEN) return Promise.resolve();
    return new Promise((resolve, reject) => {
      this.ws.once("open", resolve);
      this.ws.once("error", reject);
    });
  }

  public send(message: object): void {
    this.ws.send(JSON.stringify(message));
  }

  public waitFor(
    type: string,
    predicate: (message: ServerMessage) => boolean = () => true,
    timeoutMs = 4000,
  ): Promise<ServerMessage> {
    const existing = this.messages.find(
      (message) =>
        message.type === type &&
        !this.consumed.has(message) &&
        predicate(message),
    );
    if (existing) {
      this.consumed.add(existing);
      return Promise.resolve(existing);
    }

    return new Promise((resolve, reject) => {
      const waiter = {
        predicate: (message: ServerMessage) =>
          message.type === type && predicate(message),
        resolve: (message: ServerMessage) => {
          clearTimeout(timer);
          resolve(message);
        },
      };

      const timer = setTimeout(() => {
        this.pending = this.pending.filter((item) => item !== waiter);
        reject(
          new Error(
            `Timeout esperando ${type}. Recibidos: ${this.messages.map((m) => m.type).join(", ")}`,
          ),
        );
      }, timeoutMs);

      this.pending.push(waiter);
    });
  }

  public close(): void {
    try {
      this.ws.close();
    } catch {
      // ignore
    }
  }
}

async function waitForState(
  client: TestClient,
  predicate: (state: any) => boolean,
  timeoutMs = 4000,
): Promise<any> {
  if (client.state && predicate(client.state)) return client.state;
  const message = await client.waitFor(
    "GAME_STATE",
    (candidate) => predicate(candidate.payload),
    timeoutMs,
  );
  return message.payload;
}

async function waitForStateAfter(
  client: TestClient,
  version: number,
  predicate: (state: any) => boolean,
  timeoutMs = 4000,
): Promise<any> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (
      client.stateVersion > version &&
      client.state &&
      predicate(client.state)
    ) {
      return client.state;
    }
    await sleep(5);
  }
  throw new Error(
    `Timeout esperando un estado nuevo. Último: ${JSON.stringify(client.state?.phase)}`,
  );
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("Brisca Server Integration", () => {
  let server: ServerInstance;
  let port = 0;
  const clients: TestClient[] = [];

  const newClient = async (): Promise<TestClient> => {
    const client = new TestClient(port);
    clients.push(client);
    await client.open();
    return client;
  };

  beforeAll(async () => {
    server = createBriscaServer(0, {
      trickDelayMs: 5,
      graceMs: 500,
      notifyGraceMs: 0,
    });
    await server.ready;
    port = (server.httpServer.address() as AddressInfo).port;
  });

  afterAll(async () => {
    for (const client of clients) client.close();
    await server.close();
  });

  it("creates a room, joins with the code and starts a game", async () => {
    const p1 = await newClient();
    p1.send({ type: "CREATE_ROOM", name: "Ana" });
    const created = await p1.waitFor("ROOM_CREATED");
    const code = created.payload.roomCode as string;

    expect(code).toMatch(/^[A-Z2-9]{4}$/);
    expect(created.payload.playerId).toBe("p1");
    expect(created.payload.token).toBeTruthy();

    const p2 = await newClient();
    p2.send({ type: "JOIN_ROOM", roomCode: code, name: "Luis" });
    const joined = await p2.waitFor("ROOM_JOINED");

    expect(joined.payload.roomCode).toBe(code);
    expect(joined.payload.playerId).toBe("p2");
    expect(joined.payload.opponentName).toBe("Ana");
    expect(joined.payload.token).toBeTruthy();

    const p1State = await waitForState(
      p1,
      (state) => state.phase === "PLAYER_TURN",
    );
    const p2State = await waitForState(
      p2,
      (state) => state.phase === "PLAYER_TURN",
    );

    expect(p1State.myHand).toHaveLength(3);
    expect(p1State.opponentName).toBe("Luis");
    expect(p1State.opponentConnected).toBe(true);
    expect(p1State.deckCount).toBe(33);
    expect(p2State.myHand).toHaveLength(3);
    expect(p1State.myHand.map((c: any) => c.id)).not.toEqual(
      p2State.myHand.map((c: any) => c.id),
    );
  });

  it("rejects unknown rooms and full rooms", async () => {
    const lonely = await newClient();
    lonely.send({ type: "JOIN_ROOM", roomCode: "ZZZZ", name: "Nadie" });
    const error = await lonely.waitFor("ERROR");
    expect(error.payload.code).toBe("ROOM_NOT_FOUND");

    const p1 = await newClient();
    p1.send({ type: "CREATE_ROOM", name: "A" });
    const created = await p1.waitFor("ROOM_CREATED");

    const p2 = await newClient();
    p2.send({
      type: "JOIN_ROOM",
      roomCode: created.payload.roomCode,
      name: "B",
    });
    await p2.waitFor("ROOM_JOINED");

    const third = await newClient();
    third.send({
      type: "JOIN_ROOM",
      roomCode: created.payload.roomCode,
      name: "C",
    });
    const fullError = await third.waitFor("ERROR");
    expect(fullError.payload.code).toBe("ROOM_FULL");
  });

  it("plays a complete 120-point game and supports rematch", async () => {
    const p1 = await newClient();
    p1.send({ type: "CREATE_ROOM", name: "Ana" });
    const created = await p1.waitFor("ROOM_CREATED");
    const p2 = await newClient();
    p2.send({
      type: "JOIN_ROOM",
      roomCode: created.payload.roomCode,
      name: "Luis",
    });
    await p2.waitFor("ROOM_JOINED");

    await waitForState(p1, (s) => s.phase === "PLAYER_TURN");
    const deadline = Date.now() + 15_000;

    while (Date.now() < deadline) {
      const finished = [p1.state, p2.state].find(
        (state) => state?.phase === "GAME_OVER",
      );
      if (finished) break;

      const actor = [p1, p2].find(
        (client) =>
          client.state?.phase === "PLAYER_TURN" &&
          client.state.turn === client.state.playerId,
      );
      if (!actor) {
        await sleep(5);
        continue;
      }

      const versionBefore = actor.stateVersion;
      const card = actor.state.myHand[0];
      actor.send({ type: "PLAY_CARD", cardId: card.id });

      const waitStart = Date.now();
      while (
        actor.stateVersion === versionBefore &&
        Date.now() - waitStart < 2000
      ) {
        await sleep(5);
      }
      if (actor.stateVersion === versionBefore) {
        throw new Error(
          `El estado no avanzó para ${actor.state.playerId}: ${JSON.stringify(actor.state.phase)}`,
        );
      }
    }

    const finished = [p1.state, p2.state].find(
      (state) => state?.phase === "GAME_OVER",
    );
    expect(finished).toBeTruthy();
    const finalState = await waitForState(p1, (s) => s.phase === "GAME_OVER");
    expect(finalState.scores.p1 + finalState.scores.p2).toBe(120);
    expect(finalState.myHand).toHaveLength(0);
    expect(finalState.trumpTaken).toBe(true);

    // Both players must request the rematch.
    const voteVersion = p1.stateVersion;
    p1.send({ type: "REMATCH" });
    await waitForStateAfter(p1, voteVersion, (s) =>
      s.rematchVotes.includes("p1"),
    );

    const rematchVersion = p1.stateVersion;
    p2.send({ type: "REMATCH" });
    const rematchState = await waitForStateAfter(
      p1,
      rematchVersion,
      (s) => s.phase === "PLAYER_TURN" && s.scores.p1 === 0,
    );
    expect(rematchState.myHand).toHaveLength(3);
    expect(rematchState.deckCount).toBe(33);
  });

  it("reconnects with the session token and keeps the same seat", async () => {
    const p1 = await newClient();
    p1.send({ type: "CREATE_ROOM", name: "Ana" });
    const created = await p1.waitFor("ROOM_CREATED");

    const p2 = await newClient();
    p2.send({
      type: "JOIN_ROOM",
      roomCode: created.payload.roomCode,
      name: "Luis",
    });
    const joined = await p2.waitFor("ROOM_JOINED");
    await waitForState(p2, (s) => s.phase === "PLAYER_TURN");

    p2.close();
    const disconnected = await p1.waitFor("PLAYER_DISCONNECTED");
    expect(disconnected.payload.playerId).toBe("p2");

    const p2b = await newClient();
    p2b.send({
      type: "JOIN_ROOM",
      roomCode: created.payload.roomCode,
      name: "Luis",
      token: joined.payload.token,
    });

    const rejoined = await p2b.waitFor("ROOM_JOINED");
    expect(rejoined.payload.playerId).toBe("p2");
    expect(rejoined.payload.token).toBe(joined.payload.token);
    const reconnectedNotice = await p1.waitFor("PLAYER_RECONNECTED");
    expect(reconnectedNotice.payload.playerId).toBe("p2");
    const state = await waitForState(p2b, (s) => s.phase === "PLAYER_TURN");
    expect(state.opponentConnected).toBe(true);
  });

  it("serves a health endpoint", async () => {
    const response = await fetch(`http://127.0.0.1:${port}/health`);
    expect(response.status).toBe(200);
    const body = (await response.json()) as { status: string };
    expect(body.status).toBe("ok");
  });
});
