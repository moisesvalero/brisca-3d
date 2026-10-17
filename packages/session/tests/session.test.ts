import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Connection, GameServer, GameServerOptions } from "../src/index.js";

interface AnyServerMessage {
  type: string;
  payload?: any;
  message?: string;
}

class FakeConnection implements Connection {
  public sent: AnyServerMessage[] = [];
  public closed = false;
  public closeCode?: number;

  public send(data: string): void {
    this.sent.push(JSON.parse(data) as AnyServerMessage);
  }

  public close(code?: number): void {
    this.closed = true;
    this.closeCode = code;
  }

  public last(type: string): AnyServerMessage | undefined {
    return [...this.sent].reverse().find((message) => message.type === type);
  }

  public all(type: string): AnyServerMessage[] {
    return this.sent.filter((message) => message.type === type);
  }

  public clear(): void {
    this.sent = [];
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitFor(
  connection: FakeConnection,
  type: string,
  predicate: (message: AnyServerMessage) => boolean = () => true,
  timeoutMs = 1000,
): Promise<AnyServerMessage> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const found = connection
      .all(type)
      .reverse()
      .find((message) => predicate(message));
    if (found) return found;
    await sleep(2);
  }
  throw new Error(
    `Timeout esperando ${type}. Recibidos: ${connection.sent.map((m) => m.type).join(", ")}`,
  );
}

describe("GameServer (shared session logic)", () => {
  let server: GameServer;
  let p1: FakeConnection;
  let p2: FakeConnection;

  const makeServer = (options: GameServerOptions = {}) => {
    server = new GameServer({
      generateCode: () => "ABCD",
      graceMs: 60_000,
      notifyGraceMs: 0,
      trickDelayMs: 1,
      ...options,
    });
    p1 = new FakeConnection();
    p2 = new FakeConnection();
    server.connect(p1);
    server.connect(p2);
  };

  beforeEach(() => makeServer());

  afterEach(() => {
    server.closeAll();
  });

  const createAndJoin = async () => {
    server.handleMessage(
      p1,
      JSON.stringify({ type: "CREATE_ROOM", name: "Ana" }),
    );
    const created = await waitFor(p1, "ROOM_CREATED");
    server.handleMessage(
      p2,
      JSON.stringify({
        type: "JOIN_ROOM",
        roomCode: created.payload!.roomCode,
        name: "Luis",
      }),
    );
    const joined = await waitFor(p2, "ROOM_JOINED");
    return { created, joined };
  };

  it("creates a room and joins it with the code", async () => {
    const { created, joined } = await createAndJoin();

    expect(created.payload).toMatchObject({
      roomCode: "ABCD",
      playerId: "p1",
      name: "Ana",
      isCreator: true,
    });
    expect(created.payload!.token).toBeTruthy();
    expect(joined.payload).toMatchObject({
      roomCode: "ABCD",
      playerId: "p2",
      name: "Luis",
      opponentName: "Ana",
    });

    const state = await waitFor(p2, "GAME_STATE");
    expect(state.payload).toMatchObject({
      phase: "PLAYER_TURN",
      myName: "Luis",
      opponentName: "Ana",
      opponentConnected: true,
      deckCount: 33,
    });
    expect(state.payload.myHand).toHaveLength(3);
    expect(state.payload.trumpTaken).toBe(false);
  });

  it("rejects a full room", async () => {
    await createAndJoin();
    const p3 = new FakeConnection();
    server.connect(p3);
    server.handleMessage(
      p3,
      JSON.stringify({ type: "JOIN_ROOM", roomCode: "ABCD", name: "Eva" }),
    );
    const error = await waitFor(p3, "ERROR");
    expect(error.payload!.code).toBe("ROOM_FULL");
  });

  it("rejects unknown room codes", async () => {
    server.handleMessage(
      p2,
      JSON.stringify({ type: "JOIN_ROOM", roomCode: "ZZZZ", name: "Luis" }),
    );
    const error = await waitFor(p2, "ERROR");
    expect(error.payload!.code).toBe("ROOM_NOT_FOUND");
  });

  it("enforces turns and reports invalid moves", async () => {
    await createAndJoin();
    const state = (await waitFor(p2, "GAME_STATE")).payload!;
    // p2 tries to play out of turn.
    server.handleMessage(
      p2,
      JSON.stringify({ type: "PLAY_CARD", cardId: state.myHand[0].id }),
    );
    const error = await waitFor(p2, "ERROR");
    expect(error.payload!.code).toBe("INVALID_MOVE");
    expect(error.payload!.message).toContain("turn");
  });

  it("plays a complete game to 120 points", async () => {
    await createAndJoin();
    await waitFor(p1, "GAME_STATE");
    await waitFor(p2, "GAME_STATE");

    const deadline = Date.now() + 5000;
    let state: any = null;

    while (Date.now() < deadline) {
      const s1 = p1.last("GAME_STATE")?.payload as any;
      const s2 = p2.last("GAME_STATE")?.payload as any;
      state = s2?.phase === "GAME_OVER" ? s2 : s1;
      if (state?.phase === "GAME_OVER") break;

      const actor = [p1, p2].find(
        (connection) =>
          (connection.last("GAME_STATE")?.payload as any)?.phase ===
            "PLAYER_TURN" &&
          (connection.last("GAME_STATE")?.payload as any)?.turn ===
            (connection.last("GAME_STATE")?.payload as any)?.playerId,
      );
      if (!actor) {
        await sleep(5);
        continue;
      }
      const actorState = actor.last("GAME_STATE")!.payload as any;
      server.handleMessage(
        actor,
        JSON.stringify({
          type: "PLAY_CARD",
          cardId: actorState.myHand[0].id,
        }),
      );
      await sleep(5);
    }

    expect(state?.phase).toBe("GAME_OVER");
    expect(state.scores.p1 + state.scores.p2).toBe(120);
    expect(state.trumpTaken).toBe(true);

    // Rematch requires both players.
    server.handleMessage(p1, JSON.stringify({ type: "REMATCH" }));
    await sleep(10);
    expect((p1.last("GAME_STATE")!.payload as any).rematchVotes).toEqual([
      "p1",
    ]);

    server.handleMessage(p2, JSON.stringify({ type: "REMATCH" }));
    await sleep(10);
    const rematch = p2.last("GAME_STATE")!.payload as any;
    expect(rematch.phase).toBe("PLAYER_TURN");
    expect(rematch.scores).toEqual({ p1: 0, p2: 0 });
    expect(rematch.myHand).toHaveLength(3);
  });

  it("notifies the rival and allows reconnecting with the token", async () => {
    await createAndJoin();
    const joined = p2.last("ROOM_JOINED")!;

    server.handleClose(p2);
    const notice = await waitFor(p1, "PLAYER_DISCONNECTED");
    expect(notice.payload).toMatchObject({ playerId: "p2", name: "Luis" });
    expect((p1.last("GAME_STATE")!.payload as any).opponentConnected).toBe(
      false,
    );

    const reconnected = new FakeConnection();
    server.connect(reconnected);
    server.handleMessage(
      reconnected,
      JSON.stringify({
        type: "JOIN_ROOM",
        roomCode: "ABCD",
        token: joined.payload!.token,
        name: "Luis",
      }),
    );

    const rejoined = await waitFor(reconnected, "ROOM_JOINED");
    expect(rejoined.payload!.playerId).toBe("p2");
    expect(rejoined.payload!.token).toBe(joined.payload!.token);
    const back = await waitFor(p1, "PLAYER_RECONNECTED");
    expect(back.payload!.playerId).toBe("p2");
    const state = await waitFor(reconnected, "GAME_STATE");
    expect(state.payload!.opponentConnected).toBe(true);
  });

  it("closes the room when the grace window expires", async () => {
    makeServer({ graceMs: 30 });
    await createAndJoin();
    server.handleClose(p2);
    await sleep(80);
    const closed = await waitFor(p1, "ROOM_CLOSED");
    expect(closed.payload!.reason).toBe("opponent_left");
    expect(p1.closed).toBe(true);
    expect(server.rooms.size).toBe(0);
  });

  it("keeps the room when the rival leaves explicitly", async () => {
    await createAndJoin();
    server.handleMessage(p2, JSON.stringify({ type: "LEAVE_ROOM" }));
    const closed = await waitFor(p1, "ROOM_CLOSED");
    expect(closed.payload!.reason).toBe("player_left");
    expect(server.rooms.size).toBe(0);
  });

  it("rate limits abusive clients", async () => {
    makeServer({ rateLimit: 3, rateWindowMs: 10_000 });
    for (let i = 0; i < 5; i += 1) {
      server.handleMessage(
        p1,
        JSON.stringify({ type: "CREATE_ROOM", name: "Ana" }),
      );
    }
    const error = await waitFor(p1, "ERROR");
    expect(error.payload!.code).toBe("RATE_LIMITED");
    expect(p1.closed).toBe(true);
  });

  it("ignores malformed and oversized messages", async () => {
    server.handleMessage(p1, "not-json");
    const invalid = await waitFor(p1, "ERROR");
    expect(invalid.payload!.code).toBe("INVALID_MESSAGE");

    server.handleMessage(p1, "x".repeat(20_000));
    const tooLong = await waitFor(p1, "ERROR");
    expect(tooLong.payload!.code).toBe("INVALID_MESSAGE");
  });

  it("does not let a stranger steal a disconnected seat", async () => {
    await createAndJoin();
    server.handleClose(p2);
    const stranger = new FakeConnection();
    server.connect(stranger);
    server.handleMessage(
      stranger,
      JSON.stringify({ type: "JOIN_ROOM", roomCode: "ABCD", name: "Eva" }),
    );
    const error = await waitFor(stranger, "ERROR");
    expect(error.payload!.code).toBe("ROOM_FULL");
  });
});
