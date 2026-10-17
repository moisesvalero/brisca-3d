import {
  ClientMessage,
  CloseReason,
  Connection,
  RoomError,
  ServerMessage,
  isClientMessage,
} from "./protocol.js";
import {
  DEFAULT_GRACE_MS,
  DEFAULT_NOTIFY_GRACE_MS,
  DEFAULT_TRICK_DELAY_MS,
  Room,
} from "./room.js";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const DEFAULT_MAX_MESSAGE_BYTES = 8 * 1024;
const DEFAULT_RATE_LIMIT = 60;
const DEFAULT_RATE_WINDOW_MS = 5_000;

export interface GameServerOptions {
  graceMs?: number;
  trickDelayMs?: number;
  notifyGraceMs?: number;
  generateCode?: () => string;
  maxMessageBytes?: number;
  rateLimit?: number;
  rateWindowMs?: number;
}

interface Session {
  connection: Connection;
  room: Room | null;
  playerId: "p1" | "p2" | null;
  windowStart: number;
  messageCount: number;
}

export function generateRoomCode(): string {
  let code = "";
  for (let i = 0; i < 4; i += 1) {
    code += CODE_ALPHABET.charAt(
      Math.floor(Math.random() * CODE_ALPHABET.length),
    );
  }
  return code;
}

/**
 * Transport-agnostic room orchestrator. The Node server and the Cloudflare
 * Durable Object both drive this class with their own socket adapters.
 */
export class GameServer {
  public readonly rooms = new Map<string, Room>();
  private readonly sessions = new Map<Connection, Session>();

  private readonly graceMs: number;
  private readonly trickDelayMs: number;
  private readonly notifyGraceMs: number;
  private readonly generateCode: () => string;
  private readonly maxMessageBytes: number;
  private readonly rateLimit: number;
  private readonly rateWindowMs: number;

  constructor(options: GameServerOptions = {}) {
    this.graceMs = options.graceMs ?? DEFAULT_GRACE_MS;
    this.trickDelayMs = options.trickDelayMs ?? DEFAULT_TRICK_DELAY_MS;
    this.notifyGraceMs = options.notifyGraceMs ?? DEFAULT_NOTIFY_GRACE_MS;
    this.generateCode = options.generateCode ?? generateRoomCode;
    this.maxMessageBytes = options.maxMessageBytes ?? DEFAULT_MAX_MESSAGE_BYTES;
    this.rateLimit = options.rateLimit ?? DEFAULT_RATE_LIMIT;
    this.rateWindowMs = options.rateWindowMs ?? DEFAULT_RATE_WINDOW_MS;
  }

  public connect(connection: Connection): void {
    this.sessions.set(connection, {
      connection,
      room: null,
      playerId: null,
      windowStart: Date.now(),
      messageCount: 0,
    });
  }

  public handleMessage(connection: Connection, raw: unknown): void {
    const session = this.sessions.get(connection);
    if (!session) return;

    if (typeof raw !== "string") {
      this.sendError(connection, "INVALID_MESSAGE", "Mensaje inválido");
      return;
    }
    if (raw.length > this.maxMessageBytes) {
      this.sendError(connection, "INVALID_MESSAGE", "Mensaje demasiado largo");
      return;
    }
    if (!this.checkRateLimit(session)) {
      this.sendError(
        connection,
        "RATE_LIMITED",
        "Demasiados mensajes, espera un momento",
      );
      try {
        connection.close(1008, "rate limited");
      } catch {
        // ignore
      }
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      this.sendError(connection, "INVALID_MESSAGE", "Mensaje inválido");
      return;
    }
    if (!isClientMessage(parsed)) {
      this.sendError(connection, "INVALID_MESSAGE", "Mensaje inválido");
      return;
    }

    try {
      this.dispatch(session, parsed);
    } catch (error) {
      if (error instanceof RoomError) {
        this.sendError(connection, error.code, error.message);
      } else {
        console.error("[Brisca] Unhandled room error:", error);
        this.sendError(
          connection,
          "INTERNAL",
          "Ha ocurrido un error inesperado",
        );
      }
    }
  }

  public handleClose(connection: Connection): void {
    const session = this.sessions.get(connection);
    if (!session) return;
    this.sessions.delete(connection);

    const room = session.room;
    if (room && !room.isClosed()) {
      room.disconnect(connection);
    }
  }

  public stats(): { rooms: number; connections: number } {
    return {
      rooms: this.rooms.size,
      connections: this.sessions.size,
    };
  }

  /** Removes rooms that have no sockets and nobody coming back. */
  public sweep(maxIdleMs: number): number {
    const now = Date.now();
    let removed = 0;
    for (const [code, room] of this.rooms) {
      if (room.isClosed()) {
        this.rooms.delete(code);
        removed += 1;
        continue;
      }
      if (!room.hasConnections() && !room.hasGame()) {
        if (now - room.createdAt > maxIdleMs) {
          room.close("expired");
          removed += 1;
        }
      }
    }
    return removed;
  }

  public closeAll(reason: CloseReason = "server_closed"): void {
    for (const room of this.rooms.values()) {
      room.close(reason);
    }
    this.sessions.clear();
  }

  private dispatch(session: Session, message: ClientMessage): void {
    switch (message.type) {
      case "CREATE_ROOM":
        this.createRoom(session, message.name);
        return;
      case "JOIN_ROOM":
        this.joinRoom(session, message.roomCode, message.name, message.token);
        return;
      case "PLAY_CARD":
        this.withRoom(session, (room, playerId) => {
          room.handlePlayCard(playerId, String(message.cardId ?? ""));
        });
        return;
      case "SWAP_TRUMP":
        this.withRoom(session, (room, playerId) => {
          room.handleSwapTrump(playerId, String(message.cardId ?? ""));
        });
        return;
      case "REMATCH":
        this.withRoom(session, (room, playerId) => {
          room.requestRematch(playerId);
        });
        return;
      case "LEAVE_ROOM":
        this.leaveRoom(session);
        return;
      default:
        this.sendError(
          session.connection,
          "UNKNOWN_MESSAGE",
          "Tipo de mensaje desconocido",
        );
    }
  }

  private createRoom(session: Session, name: unknown): void {
    if (session.room) {
      throw new RoomError("ALREADY_IN_ROOM", "Ya estás en una sala");
    }

    let code = "";
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const candidate = this.generateCode().toUpperCase();
      if (!this.rooms.has(candidate)) {
        code = candidate;
        break;
      }
    }
    if (!code) {
      throw new RoomError(
        "NO_CODES",
        "No hay salas disponibles, inténtalo de nuevo",
      );
    }

    const room = new Room(code, {
      graceMs: this.graceMs,
      trickDelayMs: this.trickDelayMs,
      notifyGraceMs: this.notifyGraceMs,
      onClosed: (closedRoom) => {
        this.rooms.delete(closedRoom.code);
      },
    });
    this.rooms.set(code, room);

    const info = room.addPlayer(session.connection, name);
    session.room = room;
    session.playerId = info.playerId;

    this.send(session.connection, {
      type: "ROOM_CREATED",
      payload: {
        roomCode: code,
        playerId: info.playerId,
        token: info.token,
        name: info.name,
        isCreator: true,
      },
    });
  }

  private joinRoom(
    session: Session,
    rawCode: unknown,
    name: unknown,
    token: unknown,
  ): void {
    if (session.room) {
      throw new RoomError("ALREADY_IN_ROOM", "Ya estás en una sala");
    }

    const code = String(rawCode ?? "")
      .toUpperCase()
      .trim();
    if (!/^[A-Z2-9]{4}$/.test(code)) {
      throw new RoomError(
        "INVALID_CODE",
        "El código de sala debe tener 4 caracteres",
      );
    }

    const room = this.rooms.get(code);
    if (!room || room.isClosed()) {
      throw new RoomError(
        "ROOM_NOT_FOUND",
        `La sala ${code} no existe o ha caducado`,
      );
    }

    const info = room.addPlayer(
      session.connection,
      name,
      typeof token === "string" ? token : undefined,
    );
    session.room = room;
    session.playerId = info.playerId;

    const opponent = room.getPlayer(info.playerId === "p1" ? "p2" : "p1");
    this.send(session.connection, {
      type: "ROOM_JOINED",
      payload: {
        roomCode: code,
        playerId: info.playerId,
        token: info.token,
        name: info.name,
        opponentName: opponent?.name,
        isCreator: info.playerId === "p1",
      },
    });

    if (info.reconnected) {
      if (info.announcedDisconnect) {
        room.announceOpponentStatus(info.playerId, true);
      }
      room.broadcastState();
    } else {
      room.announceOpponentStatus(info.playerId, false);
      room.ensureStarted();
    }
  }

  private leaveRoom(session: Session): void {
    const room = session.room;
    const playerId = session.playerId;
    session.room = null;
    session.playerId = null;
    if (room && playerId) {
      room.leave(playerId);
    }
  }

  private withRoom(
    session: Session,
    action: (room: Room, playerId: "p1" | "p2") => void,
  ): void {
    if (!session.room || !session.playerId) {
      throw new RoomError(
        "NOT_IN_ROOM",
        "Primero debes crear o unirte a una sala",
      );
    }
    action(session.room, session.playerId);
  }

  private checkRateLimit(session: Session): boolean {
    const now = Date.now();
    if (now - session.windowStart > this.rateWindowMs) {
      session.windowStart = now;
      session.messageCount = 0;
    }
    session.messageCount += 1;
    return session.messageCount <= this.rateLimit;
  }

  private send(connection: Connection, message: ServerMessage): void {
    try {
      connection.send(JSON.stringify(message));
    } catch {
      // ignore broken sockets
    }
  }

  private sendError(
    connection: Connection,
    code: string,
    message: string,
  ): void {
    this.send(connection, { type: "ERROR", payload: { code, message } });
  }
}

export { Room } from "./room.js";
export * from "./protocol.js";
