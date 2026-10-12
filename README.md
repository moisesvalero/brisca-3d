# Brisca 3D Royale 🎴✨

> **Juego de Brisca Española en 3D Online para 2 jugadores, instalable como PWA y con estética arcade inspirada en _Balatro_.**

![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue?style=flat-square&logo=typescript)
![React](https://img.shields.io/badge/React-19.0-61dafb?style=flat-square&logo=react)
![Three.js](https://img.shields.io/badge/Three.js-0.174-black?style=flat-square&logo=three.js)
![pnpm](https://img.shields.io/badge/pnpm-workspace-orange?style=flat-square&logo=pnpm)
![PWA](https://img.shields.io/badge/PWA-Ready-success?style=flat-square)

---

## 🌟 Características Principales

- **Baraja Española Tradicional (40 cartas):** Generador procedural de texturas en alta resolución en HTML5 Canvas (sin descargas externas pesadas ni dependencias de internet). Incluye Oros, Copas, Espadas y Bastos con acabados dorados y relieves.
- **Estética Arcade "Balatro Vibe":**
  - Tapete de fieltro esmeralda en perspectiva isométrica con iluminación dinámica cenital.
  - Cartas 3D con grosor geométrico real, biseles y animación de abanico interactivo en mano.
  - Partículas 3D (chispas de oro al ganar bazas importantes con Ases o Triunfos).
  - _Screen shake_ (sacudida de cámara) al jugar cartas pesadas.
  - Filtro opcional CRT con scanlines y viñeta retro.
- **Multijugador en Tiempo Real sin Fricción:**
  - Salas privadas mediante código de 4 letras (ej. `B7X2`).
  - Enlace directo para compartir por WhatsApp/Telegram (sin logins ni registros obligatorios).
  - Arquitectura cliente-servidor autoritativa con ofuscación de la mano rival (anti-trampas).
- **Modo Práctica (Solo vs IA):** Motor inteligente integrado en el cliente para jugar inmediatamente sin necesidad de conexión o esperando a un rival.
- **Sonido y Sensaciones:**
  - Audio procedural sintetizado en tiempo real con **Web Audio API** (reparto, impacto de cartas, tintineo de monedas/oros, fanfarria de victoria).
  - **Vibración háptica** en móviles compatibles al lanzar y ganar bazas.
- **PWA (Progressive Web App):** Instalable en la pantalla de inicio en iOS y Android con Service Worker (Workbox) y modo de pantalla completa `standalone`.

---

## 📜 Reglas Implementadas (Brisca Clásica Española)

- **Cartas en juego:** 40 cartas (Oros, Copas, Espadas, Bastos).
- **Puntuación oficial (Total: 120 puntos):**
  - **As:** 11 puntos
  - **Tres:** 10 puntos
  - **Rey (12):** 4 puntos
  - **Caballo (11):** 3 puntos
  - **Sota (10):** 2 puntos
  - **Cartas blancas (2, 4, 5, 6, 7):** 0 puntos
  - _Condición de victoria:_ Gana el jugador que consiga **más de 60 puntos** (o empate a 60).
- **Mecánica de Ronda:**
  - Reparto inicial de 3 cartas por jugador y carta de triunfo descubierta bajo el mazo.
  - No es obligatorio asistir ni superar palo (regla clásica de brisca).
  - El ganador de cada baza se lleva las cartas y roba primero del mazo.
  - **Regla del cambio de triunfo (7 y 2):** Si la carta de triunfo descubierta es superior a 7 (con puntos), el jugador con el 7 de triunfo puede cambiarla; si es blanca (≤ 7), se puede cambiar con el 2 de triunfo antes de agotar el mazo.

---

## 🏗️ Arquitectura del Monorepo

El proyecto está estructurado con workspaces de `pnpm`:

```text
brisca-3d/
├── packages/
│   ├── core/      # Motor puro en TypeScript: reglas, 40 cartas, cálculo de puntos, bazas y TDD
│   ├── server/    # Servidor WebSocket en Node.js (ws): gestión de salas de 4 letras y sincronización
│   └── client/    # Frontend PWA: React 19, Three.js 3D, Web Audio API y Tailwind CSS
├── pnpm-workspace.yaml
└── package.json
```

---

## 🚀 Puesta en Marcha en Local

### Requisitos

- **Node.js** v20+ o v22+
- **pnpm** v10+ u 11+

### Instalación de dependencias

```bash
pnpm install
```

### Ejecución en Modo Desarrollo

Puedes arrancar todo el monorepo en paralelo:

```bash
# Arrancar servidor WebSocket y cliente Vite
pnpm dev
```

O arrancar cada paquete por separado:

```bash
# Terminal 1: Servidor WebSocket (puerto 8080)
pnpm --filter @brisca/server dev

# Terminal 2: Cliente PWA en Vite (puerto 3000)
pnpm --filter @brisca/client dev
```

- **Cliente:** [http://localhost:3000](http://localhost:3000)
- **Servidor WebSocket:** `ws://localhost:8080`

---

## 🧪 Tests y Calidad de Código

El proyecto sigue una estricta disciplina de pruebas y tipado estático:

```bash
# Ejecutar toda la batería de tests unitarios e integración (Vitest)
pnpm test

# Ejecutar el linter ultra rápido (Oxlint)
pnpm lint

# Formatear el código con Prettier
pnpm format

# Compilar para producción (TypeScript + Vite)
pnpm build
```

---

## 📦 Despliegue en Producción

1. **Cliente PWA:** La carpeta `packages/client/dist` generada con `pnpm build` es 100% estática y puede desplegarse en **Vercel**, **Cloudflare Pages**, **Netlify** o cualquier CDN estático.
2. **Servidor WebSocket:** `packages/server` puede desplegarse en cualquier entorno Node.js que soporte WebSockets persistentes (Render, Railway, Fly.io o VPS Docker).
   - Configura en el cliente la variable de entorno: `VITE_WS_URL=wss://tu-servidor.dominio.com`.

---

## 📄 Licencia

MIT © Moisés Valero
