import React, { useCallback, useEffect, useRef, useState } from "react";
import { TableScene } from "./graphics/tableScene.js";
import {
  ClientState,
  ConnectionStatus,
  GameClient,
} from "./network/gameClient.js";
import { HUD } from "./components/HUD.js";
import { Lobby } from "./components/Lobby.js";
import { WaitingRoom } from "./components/WaitingRoom.js";
import { GameOverModal } from "./components/GameOverModal.js";
import { Toast, ToastTone } from "./components/Toast.js";
import { ConfirmDialog } from "./components/ConfirmDialog.js";
import { InstallBanner } from "./components/InstallBanner.js";
import { RulesModal } from "./components/RulesModal.js";
import { sounds } from "./audio/soundManager.js";
import { Card, canSwapTrump } from "@brisca/core";
import type { CloseReason, RoomInfoPayload } from "@brisca/session";
import {
  loadRuntimeConfig,
  readInviteCode,
  readStoredName,
  resolveWsUrl,
  storeName,
} from "./network/config.js";

type View = "menu" | "waiting" | "game";

const roomClosedText = (reason: CloseReason): string => {
  switch (reason) {
    case "opponent_left":
      return "Tu rival ha abandonado la partida.";
    case "timeout":
      return "Se agotó el tiempo de espera y la sala se ha cerrado.";
    case "expired":
      return "La sala ha caducado o el servidor se ha reiniciado.";
    case "server_closed":
      return "El servidor se ha reiniciado. Crea una sala nueva para jugar.";
    case "player_left":
      return "Has salido de la sala.";
    default:
      return "La sala se ha cerrado.";
  }
};

export const App: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<TableScene | null>(null);
  const clientRef = useRef<GameClient | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const [view, setView] = useState<View>("menu");
  const [gameState, setGameState] = useState<ClientState | null>(null);
  const [roomInfo, setRoomInfo] = useState<RoomInfoPayload | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [statusMessage, setStatusMessage] = useState("");
  const [toast, setToast] = useState<{
    message: string;
    tone: ToastTone;
  } | null>(null);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [roomClosedMessage, setRoomClosedMessage] = useState<string | null>(
    null,
  );
  const [rematchWaiting, setRematchWaiting] = useState(false);
  const [rematchOffered, setRematchOffered] = useState(false);

  const [soundEnabled, setSoundEnabled] = useState(true);
  const [crtEnabled, setCrtEnabled] = useState(false);
  const [webglError, setWebglError] = useState<string | null>(null);

  const showToast = useCallback((message: string, tone: ToastTone = "info") => {
    setToast({ message, tone });
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(
      () => setToast(null),
      tone === "error" ? 7_000 : 5_000,
    );
  }, []);

  const openRules = useCallback(() => setRulesOpen(true), []);
  const closeRules = useCallback(() => setRulesOpen(false), []);

  const resetToMenu = useCallback(() => {
    setView("menu");
    setGameState(null);
    setRoomInfo(null);
    setRematchWaiting(false);
    setRematchOffered(false);
    setStatus("idle");
    setStatusMessage("");
  }, []);

  const playCardFromUi = useCallback((card: Card) => {
    const current = clientRef.current?.state;
    if (!current) return;
    if (current.phase !== "PLAYER_TURN" || current.turn !== current.playerId) {
      return;
    }
    sounds.playCardDrop(card.points > 0);
    sceneRef.current?.triggerScreenShake(card.points >= 10 ? 0.35 : 0.15);
    clientRef.current?.playCard(card.id);
  }, []);

  useEffect(() => {
    const unlock = () => sounds.unlock();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    let scene: TableScene | null = null;
    try {
      scene = new TableScene(containerRef.current);
      sceneRef.current = scene;
    } catch (error) {
      console.warn("No se pudo iniciar WebGL 3D:", error);
      setWebglError(
        "Tu navegador tiene aceleración 3D limitada. La interfaz se adaptará.",
      );
    }

    const client = new GameClient();
    clientRef.current = client;

    if (scene) {
      scene.onCardClick = (card: Card) => {
        playCardFromUi(card);
      };
    }

    client.onRoomInfo = (info) => {
      setRoomInfo(info);
      storeName(info.name);
      if (info.isCreator) {
        setView("waiting");
        setStatus("waiting");
      } else {
        setView("waiting");
      }

      const url = new URL(window.location.href);
      url.searchParams.delete("room");
      url.searchParams.delete("solo");
      if (url.search !== window.location.search) {
        window.history.replaceState({}, "", url.toString());
      }
    };

    client.onStateUpdate = (state) => {
      setGameState(state);
      setView("game");
      if (state.phase !== "GAME_OVER") {
        setRematchWaiting(false);
        setRematchOffered(false);
      }

      const isMyTurn = state.turn === state.playerId;
      sceneRef.current?.updateGameState(
        state.myHand,
        state.opponentCardCount,
        state.trumpTaken ? null : state.trumpCard,
        state.deckCount,
        state.currentTrick,
        isMyTurn,
        state.playerId,
      );

      if (
        state.phase === "RESOLVING_TRICK" &&
        state.currentTrick.points > 0 &&
        state.currentTrick.winner === state.playerId
      ) {
        sounds.playPointsWin();
        sceneRef.current?.triggerSparks(0, 0, 0);
      }
    };

    client.onStatus = (next, message) => {
      setStatus(next);
      setStatusMessage(message ?? "");
      if (next === "error") {
        resetToMenu();
      }
    };

    client.onError = (message) => {
      showToast(message, "error");
    };

    client.onOpponentDisconnected = ({ name, graceSeconds }) => {
      showToast(
        `${name} se ha desconectado. Esperando su reconexión (${graceSeconds}s)…`,
        "info",
      );
    };

    client.onOpponentReconnected = (name) => {
      showToast(`${name} ha vuelto a la partida.`, "success");
    };

    client.onRematchRequested = (playerId) => {
      if (playerId !== client.playerId) {
        setRematchOffered(true);
        showToast("Tu rival quiere la revancha.", "info");
      }
    };

    client.onRoomClosed = (reason) => {
      resetToMenu();
      setRoomClosedMessage(roomClosedText(reason));
    };

    const params = new URLSearchParams(window.location.search);
    const invite = readInviteCode(window.location.search);
    if (invite) setInviteCode(invite);

    const soloParam = params.get("solo");
    const isSolo = soloParam === "1" || soloParam === "true";
    if (isSolo) {
      // Keep ?solo=1 in the URL: React StrictMode mounts the effect twice in
      // development, and the second mount must start the practice game on the
      // client instance that stays alive.
      client.startSoloGame(readStoredName() || "Tú");
      setView("game");
    }

    loadRuntimeConfig().then((config) => {
      const url = config.wsUrl?.trim() || resolveWsUrl();
      client.setServerUrl(url);
    });

    return () => {
      sceneRef.current?.destroy();
      sceneRef.current = null;
      client.disconnect();
      clientRef.current = null;
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    };
  }, [resetToMenu, showToast, playCardFromUi]);

  const handleCreate = (name: string) => {
    storeName(name);
    setToast(null);
    setRoomClosedMessage(null);
    setRoomInfo(null);
    setGameState(null);
    setInviteCode(null);
    setRematchWaiting(false);
    setView("waiting");
    clientRef.current?.connectOnline("CREATE", undefined, name);
  };

  const handleJoin = (code: string, name: string) => {
    storeName(name);
    setToast(null);
    setRoomClosedMessage(null);
    setRoomInfo(null);
    setGameState(null);
    setInviteCode(null);
    setRematchWaiting(false);
    setView("waiting");
    clientRef.current?.connectOnline("JOIN", code, name);
  };

  const handleSolo = (name: string) => {
    storeName(name);
    setToast(null);
    setRoomClosedMessage(null);
    setRoomInfo(null);
    setGameState(null);
    setInviteCode(null);
    setView("game");
    clientRef.current?.startSoloGame(name);
  };

  const handleCancel = () => {
    clientRef.current?.leaveRoom();
    resetToMenu();
  };

  const handleConfirmLeave = () => {
    setConfirmLeave(false);
    clientRef.current?.leaveRoom();
    resetToMenu();
  };

  const handleRematch = () => {
    setRematchWaiting(true);
    clientRef.current?.requestRematch();
  };

  const handleSwapTrump = () => {
    const current = clientRef.current?.state;
    if (!current) return;
    const canSwap = current.myHand.some((card) =>
      canSwapTrump(card, current.trumpCard),
    );
    if (!canSwap) return;
    sounds.playTrumpSwap();
    sceneRef.current?.triggerSparks(-4.5, 0.2, 0);
    clientRef.current?.swapTrump();
  };

  const handleExitGame = () => {
    clientRef.current?.leaveRoom();
    resetToMenu();
  };

  const busy = status === "connecting";

  return (
    <div
      className={`relative w-full h-full overflow-hidden bg-[#080a10] ${
        crtEnabled ? "crt-overlay crt-vignette" : ""
      }`}
    >
      <div
        ref={containerRef}
        aria-hidden="true"
        className="absolute inset-0 w-full h-full"
      />
      <div className="retro-vignette" aria-hidden="true" />
      <div className="retro-grain" aria-hidden="true" />

      {webglError && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-50 bg-amber-500/90 text-slate-950 font-bold text-xs px-4 py-1.5 rounded-full shadow-lg">
          {webglError}
        </div>
      )}

      {view === "menu" && (
        <Lobby
          onCreate={handleCreate}
          onJoin={handleJoin}
          onPlaySolo={handleSolo}
          onOpenRules={openRules}
          inviteCode={inviteCode}
          busy={busy}
        />
      )}

      <InstallBanner show={view === "menu"} />

      {view === "waiting" && (
        <WaitingRoom
          code={roomInfo?.roomCode ?? ""}
          status={status}
          statusMessage={statusMessage}
          onCancel={handleCancel}
        />
      )}

      {view === "game" && gameState && (
        <>
          <HUD
            state={gameState}
            status={status}
            statusMessage={statusMessage}
            soundEnabled={soundEnabled}
            crtEnabled={crtEnabled}
            onToggleSound={() => {
              const next = !soundEnabled;
              setSoundEnabled(next);
              sounds.enabled = next;
            }}
            onToggleCRT={() => setCrtEnabled(!crtEnabled)}
            onSwapTrump={handleSwapTrump}
            onLeave={() => setConfirmLeave(true)}
            onOpenRules={openRules}
            onPlayCard={playCardFromUi}
            onZoomIn={() => sceneRef.current?.zoomBy(0.1)}
            onZoomOut={() => sceneRef.current?.zoomBy(-0.1)}
          />
          {gameState.phase === "GAME_OVER" && (
            <GameOverModal
              state={gameState}
              rematchWaiting={rematchWaiting}
              rematchOffered={rematchOffered}
              onRematch={handleRematch}
              onExit={handleExitGame}
            />
          )}
        </>
      )}

      {toast && (
        <Toast
          message={toast.message}
          tone={toast.tone}
          onClose={() => setToast(null)}
        />
      )}

      {confirmLeave && (
        <ConfirmDialog
          title="¿Salir de la partida?"
          message={
            gameState?.isOnline
              ? "La partida se cerrará para los dos jugadores."
              : "Perderás el progreso de esta partida."
          }
          confirmLabel="Sí, salir"
          cancelLabel="Seguir jugando"
          danger
          onConfirm={handleConfirmLeave}
          onCancel={() => setConfirmLeave(false)}
        />
      )}

      {roomClosedMessage && (
        <ConfirmDialog
          title="Sala cerrada"
          message={roomClosedMessage}
          confirmLabel="Volver al menú"
          onConfirm={() => setRoomClosedMessage(null)}
        />
      )}

      <RulesModal open={rulesOpen} onClose={closeRules} />
    </div>
  );
};
