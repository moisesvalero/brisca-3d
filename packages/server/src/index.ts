import http from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import {
  Connection,
  GameServer,
  GameServerOptions,
  Room,
} from "@brisca/session";

export interface ServerInstance {
  wss: WebSocketServer;
  httpServer: http.Server;
  gameServer: GameServer;
  rooms: Map<string, Room>;
  ready: Promise<void>;
  close: () => Promise<void>;
}

interface AliveWebSocket extends WebSocket {
  isAlive: boolean;
}

const HEARTBEAT_MS = 30_000;
const SWEEP_MS = 10 * 60_000;
const ROOM_TTL_MS = 2 * 60 * 60_000;

export function createBriscaServer(
  port: number = 8080,
  options: GameServerOptions = {},
): ServerInstance {
  const gameServer = new GameServer(options);

  const httpServer = http.createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");

    if (url.pathname === "/health") {
      const stats = gameServer.stats();
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          status: "ok",
          uptime: Math.round(process.uptime()),
          ...stats,
        }),
      );
      return;
    }

    if (url.pathname === "/") {
      res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
      res.end("Brisca 3D Royale · WebSocket server\n");
      return;
    }

    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not found\n");
  });

  const wss = new WebSocketServer({
    server: httpServer,
    maxPayload: 8 * 1024,
  });

  wss.on("connection", (ws: AliveWebSocket) => {
    ws.isAlive = true;
    ws.on("pong", () => {
      ws.isAlive = true;
    });

    const connection: Connection = {
      send: (data: string) => {
        if (ws.readyState === WebSocket.OPEN) ws.send(data);
      },
      close: (code?: number, reason?: string) => {
        try {
          ws.close(code, reason);
        } catch {
          // ignore
        }
      },
    };

    gameServer.connect(connection);

    ws.on("message", (data) => {
      gameServer.handleMessage(connection, data.toString());
    });
    ws.on("close", () => {
      gameServer.handleClose(connection);
    });
    ws.on("error", () => {
      gameServer.handleClose(connection);
    });
  });

  const heartbeat = setInterval(() => {
    for (const client of wss.clients) {
      const ws = client as AliveWebSocket;
      if (!ws.isAlive) {
        ws.terminate();
        continue;
      }
      ws.isAlive = false;
      try {
        ws.ping();
      } catch {
        ws.terminate();
      }
    }
  }, HEARTBEAT_MS);
  heartbeat.unref?.();

  const sweeper = setInterval(() => {
    gameServer.sweep(ROOM_TTL_MS);
  }, SWEEP_MS);
  sweeper.unref?.();

  const ready = new Promise<void>((resolve, reject) => {
    httpServer.once("listening", () => resolve());
    httpServer.once("error", reject);
    httpServer.listen(port, "0.0.0.0");
  });

  const close = (): Promise<void> =>
    new Promise<void>((resolve, reject) => {
      clearInterval(heartbeat);
      clearInterval(sweeper);
      gameServer.closeAll();
      for (const client of wss.clients) {
        try {
          client.terminate();
        } catch {
          // ignore
        }
      }
      wss.close(() => {
        httpServer.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      });
    });

  return {
    wss,
    httpServer,
    gameServer,
    rooms: gameServer.rooms,
    ready,
    close,
  };
}

// Start standalone if executed directly
if (process.env.NODE_ENV !== "test" && !process.env.VITEST) {
  const PORT = Number(process.env.PORT) || 8080;
  const server = createBriscaServer(PORT);
  server.ready
    .then(() => {
      console.log(
        `[Brisca Server] WebSocket escuchando en ws://0.0.0.0:${PORT} · health http://0.0.0.0:${PORT}/health`,
      );
    })
    .catch((error) => {
      console.error("[Brisca Server] No se pudo arrancar:", error);
      process.exit(1);
    });

  const shutdown = () => {
    server.close().then(
      () => process.exit(0),
      () => process.exit(1),
    );
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
