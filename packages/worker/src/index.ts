import { DurableObject } from "cloudflare:workers";
import { Connection, GameServer } from "@brisca/session";

export interface Env {
  BRISCA: DurableObjectNamespace;
  ASSETS: Fetcher;
}

/**
 * A single, globally unique Durable Object keeps all rooms in memory. It is
 * always reachable (no cold starts) and websocket messages are cheap on the
 * Workers free plan. Fine for a two-player card game.
 */
export class BriscaRoom extends DurableObject<Env> {
  private readonly gameServer: GameServer;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.gameServer = new GameServer({ trickDelayMs: 1_200 });
  }

  public async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return new Response("Expected a WebSocket upgrade", { status: 426 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket];
    server.accept();

    const connection: Connection = {
      send: (data: string) => {
        try {
          server.send(data);
        } catch {
          // The close event will clean this connection up.
        }
      },
      close: (code?: number, reason?: string) => {
        try {
          server.close(code, reason);
        } catch {
          // ignore
        }
      },
    };

    this.gameServer.connect(connection);

    server.addEventListener("message", (event: MessageEvent) => {
      const raw = typeof event.data === "string" ? event.data : "";
      this.gameServer.handleMessage(connection, raw);
    });

    const cleanup = () => {
      this.gameServer.handleClose(connection);
    };
    server.addEventListener("close", cleanup);
    server.addEventListener("error", cleanup);

    return new Response(null, { status: 101, webSocket: client });
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return Response.json({
        status: "ok",
        service: "brisca-3d",
        timestamp: new Date().toISOString(),
      });
    }

    if (url.pathname === "/ws") {
      if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
        return new Response("Expected a WebSocket upgrade", { status: 426 });
      }
      const id = env.BRISCA.idFromName("brisca-lobby");
      return env.BRISCA.get(id).fetch(request);
    }

    // Everything else is the static PWA (HTML, JS, CSS, cards, icons).
    return env.ASSETS.fetch(request);
  },
};
