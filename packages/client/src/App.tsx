import React, { useEffect, useRef, useState } from "react";
import { TableScene } from "./graphics/tableScene.js";
import { GameClient, ClientState } from "./network/gameClient.js";
import { HUD } from "./components/HUD.js";
import { Lobby } from "./components/Lobby.js";
import { GameOverModal } from "./components/GameOverModal.js";
import { sounds } from "./audio/soundManager.js";
import { Card } from "@brisca/core";

export const App: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<TableScene | null>(null);
  const clientRef = useRef<GameClient | null>(null);

  const [gameState, setGameState] = useState<ClientState | null>(null);
  const [inLobby, setInLobby] = useState(true);
  const [waitingCode, setWaitingCode] = useState<string | null>(null);

  const [soundEnabled, setSoundEnabled] = useState(true);
  const [crtEnabled, setCrtEnabled] = useState(false);
  const [webglError, setWebglError] = useState<string | null>(null);

  // Initialize Scene and Game Client
  useEffect(() => {
    if (!containerRef.current) return;

    let scene: TableScene | null = null;
    try {
      scene = new TableScene(containerRef.current);
      sceneRef.current = scene;
    } catch (err: any) {
      console.warn("No se pudo iniciar WebGL 3D acelerado:", err);
      setWebglError(
        "Tu navegador tiene aceleración 3D limitada. La interfaz se adaptará automáticamente.",
      );
    }

    const client = new GameClient();
    clientRef.current = client;

    // Handle card click in 3D scene
    if (scene) {
      scene.onCardClick = (card: Card) => {
        if (!client.state) return;
        if (
          client.state.turn === client.state.playerId &&
          client.state.phase === "PLAYER_TURN"
        ) {
          sounds.playCardDrop(card.points > 0);
          scene?.triggerScreenShake(card.points >= 10 ? 0.35 : 0.15);
          client.playCard(card.id);
        }
      };
    }

    // Client state changes
    client.onStateUpdate = (newState) => {
      setGameState(newState);
      if (newState.phase === "PLAYER_TURN" || newState.phase === "GAME_OVER") {
        setInLobby(false);
        setWaitingCode(null);
      }

      // Update 3D scene if available
      const isMyTurn = newState.turn === newState.playerId;
      sceneRef.current?.updateGameState(
        newState.myHand,
        newState.opponentCardCount,
        newState.trumpCard,
        newState.deckCount,
        newState.currentTrick,
        isMyTurn,
      );

      // Trigger sparks if points were scored
      if (
        newState.currentTrick.points > 0 &&
        newState.currentTrick.winner === newState.playerId
      ) {
        sounds.playPointsWin();
        sceneRef.current?.triggerSparks(0, 0, 0);
      }
    };

    client.onError = (msg) => {
      alert(msg);
    };

    const params = new URLSearchParams(window.location.search);
    if (params.get("solo") === "1" || params.get("solo") === "true") {
      client.startSoloGame(params.get("name") || "Tú");
      setInLobby(false);
    }

    return () => {
      sceneRef.current?.destroy();
      client.disconnect();
    };
  }, []);

  const handleCreateOnline = (name: string) => {
    const wsUrl =
      (import.meta as any).env?.VITE_WS_URL ||
      `ws://${window.location.hostname}:8080`;
    clientRef.current?.connectOnline(wsUrl, "CREATE", undefined, name);
    // Listen for room code
    const timer = setInterval(() => {
      if (clientRef.current?.state?.roomCode) {
        setWaitingCode(clientRef.current.state.roomCode);
        clearInterval(timer);
      }
    }, 200);
  };

  const handleJoinOnline = (code: string, name: string) => {
    const wsUrl =
      (import.meta as any).env?.VITE_WS_URL ||
      `ws://${window.location.hostname}:8080`;
    clientRef.current?.connectOnline(wsUrl, "JOIN", code, name);
  };

  const handlePlaySolo = (name: string) => {
    clientRef.current?.startSoloGame(name);
    setInLobby(false);
  };

  const handleSwapTrump = () => {
    if (!gameState) return;
    const swappable = gameState.myHand.find(
      (c) => c.suit === gameState.trumpSuit && (c.rank === 7 || c.rank === 2),
    );
    if (swappable) {
      sounds.playTrumpSwap();
      sceneRef.current?.triggerSparks(-4.5, 0.2, 0);
      clientRef.current?.swapTrump(swappable.id);
    }
  };

  const handleRematch = () => {
    if (gameState?.isOnline) {
      // Send rematch or start local
      handleCreateOnline("Jugador");
    } else {
      clientRef.current?.startSoloGame();
    }
  };

  return (
    <div
      className={`relative w-full h-full overflow-hidden bg-[#080a10] ${crtEnabled ? "crt-overlay crt-vignette" : ""}`}
    >
      {/* 3D Canvas Container */}
      <div ref={containerRef} className="absolute inset-0 w-full h-full" />

      {webglError && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-50 bg-amber-500/90 text-slate-950 font-bold text-xs px-4 py-1.5 rounded-full shadow-lg">
          {webglError}
        </div>
      )}

      {/* Lobby / Menu */}
      {inLobby && (
        <Lobby
          onCreateOnline={handleCreateOnline}
          onJoinOnline={handleJoinOnline}
          onPlaySolo={handlePlaySolo}
          waitingRoomCode={waitingCode}
        />
      )}

      {/* In-Game HUD */}
      {!inLobby && gameState && (
        <HUD
          state={gameState}
          soundEnabled={soundEnabled}
          crtEnabled={crtEnabled}
          onToggleSound={() => {
            const next = !soundEnabled;
            setSoundEnabled(next);
            sounds.enabled = next;
          }}
          onToggleCRT={() => setCrtEnabled(!crtEnabled)}
          onSwapTrump={handleSwapTrump}
        />
      )}

      {/* Game Over Modal */}
      {!inLobby && gameState?.phase === "GAME_OVER" && (
        <GameOverModal
          state={gameState}
          onRematch={handleRematch}
          onExit={() => setInLobby(true)}
        />
      )}
    </div>
  );
};
