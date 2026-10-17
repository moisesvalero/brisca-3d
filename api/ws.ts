import http from "node:http";
import { WebSocketServer, WebSocket } from "ws";

/**
 * Vercel WebSocket relay.
 *
 * Algunos ISP (como el de este proyecto) bloquean el rango de IPs de
 * workers.dev/pages.dev. Vercel sí es accesible, y su red puede hablar con
 * Cloudflare. Este endpoint acepta el WebSocket del navegador y lo conecta
 * al Durable Object de Cloudflare, que sigue siendo el servidor autoritativo.
 */
const UPSTREAM =
  process.env.WS_UPSTREAM ??
  "wss://brisca-3d-ws.brisca3d-moises.workers.dev/ws";

const server = http.createServer((_request, response) => {
  response.writeHead(426, { "content-type": "text/plain; charset=utf-8" });
  response.end("Expected a WebSocket upgrade\n");
});

const wss = new WebSocketServer({ server, maxPayload: 8 * 1024 });

wss.on("connection", (client) => {
  const upstream = new WebSocket(UPSTREAM);
  const pending: string[] = [];

  const closeClient = (code?: number, reason?: string) => {
    try {
      if (client.readyState === WebSocket.OPEN) client.close(code, reason);
    } catch {
      // ignore
    }
  };

  upstream.on("open", () => {
    for (const message of pending.splice(0)) {
      if (upstream.readyState === WebSocket.OPEN) upstream.send(message);
    }
  });

  client.on("message", (data) => {
    const text = data.toString();
    if (upstream.readyState === WebSocket.OPEN) {
      upstream.send(text);
    } else if (upstream.readyState === WebSocket.CONNECTING) {
      // The browser sends CREATE_ROOM/JOIN_ROOM immediately; buffer until
      // the upstream handshake finishes.
      pending.push(text);
    }
  });

  upstream.on("message", (data) => {
    if (client.readyState === WebSocket.OPEN) client.send(data.toString());
  });

  client.on("close", () => {
    try {
      upstream.close();
    } catch {
      // ignore
    }
  });
  client.on("error", () => {
    try {
      upstream.close();
    } catch {
      // ignore
    }
  });

  upstream.on("close", () => closeClient());
  upstream.on("error", () => closeClient(1011, "upstream error"));
});

export default server;
