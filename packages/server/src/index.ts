import { WebSocketServer, WebSocket } from "ws";
import { generateRoomCode, Room } from "./room.js";

export interface ServerInstance {
  wss: WebSocketServer;
  close: () => Promise<void>;
  rooms: Map<string, Room>;
}

export function createBriscaServer(port: number = 8080): ServerInstance {
  const wss = new WebSocketServer({ port });
  const rooms = new Map<string, Room>();

  wss.on("connection", (ws: WebSocket) => {
    let currentRoom: Room | null = null;
    let assignedPlayerId: "p1" | "p2" | null = null;

    ws.on("message", (data: string) => {
      try {
        const msg = JSON.parse(data.toString());

        switch (msg.type) {
          case "CREATE_ROOM": {
            let code = generateRoomCode();
            while (rooms.has(code)) {
              code = generateRoomCode();
            }
            const room = new Room(code);
            rooms.set(code, room);
            currentRoom = room;
            assignedPlayerId = room.addPlayer(ws, msg.name || "Jugador 1");

            ws.send(
              JSON.stringify({
                type: "ROOM_CREATED",
                payload: { roomCode: code, playerId: assignedPlayerId },
              }),
            );
            break;
          }

          case "JOIN_ROOM": {
            const requestedCode = (msg.roomCode || "").toUpperCase().trim();
            const room = rooms.get(requestedCode);

            if (!room) {
              ws.send(
                JSON.stringify({
                  type: "ERROR",
                  message: `Sala ${requestedCode} no encontrada`,
                }),
              );
              return;
            }
            if (room.isFull()) {
              ws.send(
                JSON.stringify({
                  type: "ERROR",
                  message: `La sala ${requestedCode} está llena`,
                }),
              );
              return;
            }

            currentRoom = room;
            assignedPlayerId = room.addPlayer(ws, msg.name || "Jugador 2");

            ws.send(
              JSON.stringify({
                type: "ROOM_JOINED",
                payload: {
                  roomCode: requestedCode,
                  playerId: assignedPlayerId,
                },
              }),
            );

            // Both players joined, start match!
            room.startGame();
            break;
          }

          case "PLAY_CARD": {
            if (!currentRoom || !assignedPlayerId) return;
            try {
              currentRoom.handlePlayCard(assignedPlayerId, msg.cardId);
            } catch (err: any) {
              ws.send(JSON.stringify({ type: "ERROR", message: err.message }));
            }
            break;
          }

          case "SWAP_TRUMP": {
            if (!currentRoom || !assignedPlayerId) return;
            try {
              currentRoom.handleSwapTrump(assignedPlayerId, msg.cardId);
            } catch (err: any) {
              ws.send(JSON.stringify({ type: "ERROR", message: err.message }));
            }
            break;
          }

          case "REMATCH": {
            if (!currentRoom || !currentRoom.isFull()) return;
            currentRoom.startGame();
            break;
          }
        }
      } catch {
        ws.send(JSON.stringify({ type: "ERROR", message: "Mensaje inválido" }));
      }
    });

    ws.on("close", () => {
      if (currentRoom) {
        const removed = currentRoom.removePlayer(ws);
        if (removed) {
          currentRoom.broadcast({
            type: "PLAYER_DISCONNECTED",
            playerId: removed,
            message: "El otro jugador se ha desconectado.",
          });
        }
        if (currentRoom.isEmpty()) {
          rooms.delete(currentRoom.code);
        }
      }
    });
  });

  return {
    wss,
    rooms,
    close: () =>
      new Promise<void>((resolve, reject) => {
        for (const client of wss.clients) {
          try {
            client.terminate();
          } catch {
            // ignore
          }
        }
        wss.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}

// Start standalone if executed directly
if (process.env.NODE_ENV !== "test" && !process.env.VITEST) {
  const PORT = Number(process.env.PORT) || 8080;
  createBriscaServer(PORT);
  console.log(
    `[Brisca Server] Servidor en tiempo real escuchando en ws://localhost:${PORT}`,
  );
}
