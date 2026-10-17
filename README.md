# Brisca 3D Royale 🎴✨

> **Juego de Brisca Española en 3D Online para 2 jugadores, instalable como PWA y con estética arcade inspirada en _Balatro_.**

**Online:** <https://brisca-3d.vercel.app> · **Práctica:** <https://brisca-3d.vercel.app/?solo=1>

![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue?style=flat-square&logo=typescript)
![React](https://img.shields.io/badge/React-19.0-61dafb?style=flat-square&logo=react)
![Three.js](https://img.shields.io/badge/Three.js-0.174-black?style=flat-square&logo=three.js)
![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?style=flat-square&logo=cloudflare)
![Vercel](https://img.shields.io/badge/Vercel-Hobby-black?style=flat-square&logo=vercel)
![PWA](https://img.shields.io/badge/PWA-Ready-success?style=flat-square)

---

## 🌟 Características

- **Baraja Española (40 cartas)** con texturas procedurales en canvas.
- **Estética arcade Balatro**: mesa 3D, cartas con volumen, partículas, _screen shake_ y filtro CRT.
- **Online en tiempo real**:
  - Salas privadas con código de 4 letras y enlace directo (`?room=ABCD`).
  - Servidor **autoritativo**: la mano rival nunca se envía al cliente.
  - **Reconexión automática** con token de sesión y 60 s de gracia.
  - Aviso de desconexión retrasado 2,5 s para que las reconexiones cortas sean invisibles.
  - **Revancha** cuando ambos jugadores la aceptan.
- **Modo Práctica (solo vs IA)** sin conexión.
- **Audio procedural**, vibración háptica y **PWA** instalable.
- **Accesibilidad**: mano jugable con teclado/lector de pantalla.

---

## 📜 Reglas implementadas

- **40 cartas** (oros, copas, espadas, bastos).
- **Puntuación oficial (total 120):** As = 11 · Tres = 10 · Rey = 4 · Caballo = 3 · Sota = 2 · blancas = 0.
- Gana quien consiga **más de 60 puntos**; a 60 exactos, empate.
- Reparto de 3 cartas por jugador y triunfo descubierto bajo el mazo.
- No es obligatorio asistir ni superar palo.
- El ganador de la baza roba primero; al agotarse el mazo se recoge el triunfo.
- **Regla del 7 y 2** para cambiar el triunfo mientras quede mazo.

---

## 🏗️ Arquitectura

```text
Navegador  ──wss──▶  Vercel (PWA + /api/ws)  ──wss──▶  Cloudflare Worker
                                                         │
                                                         ▼
                                                Durable Object (BriscaRoom)
                                                         │
                                                         ▼
                                          @brisca/session (GameServer)
                                                         │
                                                         ▼
                                                    @brisca/core
```

- **Cliente + puente WebSocket:** Vercel (plan Hobby). El cliente está en `brisca-3d.vercel.app` y `/api/ws` reenvía el socket al servidor de juego.
- **Servidor de juego autoritativo:** Cloudflare Worker + Durable Object. Guarda las salas, los turnos y las manos; el cliente nunca ve la mano rival.
- **`@brisca/session`:** lógica compartida entre el servidor Node local y el Durable Object (sin duplicar reglas).
- **`@brisca/core`:** motor puro de reglas con tests.

El puente de Vercel existe porque algunos ISP bloquean el rango de IPs de `workers.dev`/`pages.dev`. Vercel sí es accesible y su red habla con Cloudflare; el Durable Object sigue siendo la única autoridad.

### Estructura

```text
brisca-3d/
├── api/ws.ts          # Puente WebSocket de Vercel
├── packages/
│   ├── core/          # Baraja, reglas, bazas, puntos (14 tests)
│   ├── session/       # Salas, turnos, reconexión, protocolo (11 tests)
│   ├── server/        # Servidor Node + ws para desarrollo local
│   ├── worker/        # Cloudflare Worker + Durable Object
│   └── client/        # React 19 + Three.js + Tailwind + PWA
├── pnpm-workspace.yaml
└── vercel.json
```

---

## 🚀 Desarrollo local

Requisitos: **Node 20+** y **pnpm 10+** (`corepack enable`).

```bash
pnpm install
pnpm dev
```

- Cliente: <http://localhost:3000>
- Servidor WebSocket: `ws://localhost:8080` · health: <http://localhost:8080/health>

Abre dos pestañas: una crea la sala y la otra se une con el código. Práctica: <http://localhost:3000/?solo=1>.

### Worker de producción en local

```bash
pnpm dev:worker   # wrangler dev en http://127.0.0.1:8787
```

Abre el cliente con `http://localhost:3000/?ws=ws://127.0.0.1:8787/ws`.

### Scripts

```bash
pnpm test         # core + session + servidor
pnpm check        # TypeScript en todos los paquetes
pnpm lint         # oxlint
pnpm format       # prettier
pnpm build        # cliente + servidor Node
pnpm deploy:worker# Cloudflare: worker + assets
pnpm deploy:web   # Vercel: cliente + /api/ws
pnpm release      # ambos
```

---

## 🌍 Despliegue (gratis)

| Componente                     | Plataforma              | Plan           |
| ------------------------------ | ----------------------- | -------------- |
| PWA + puente WebSocket         | Vercel                  | Hobby (gratis) |
| Salas + WebSocket autoritativo | Cloudflare Workers + DO | Free (gratis)  |

### Cloudflare

```bash
# Una vez: autoriza Wrangler (navegador) o exporta CLOUDFLARE_API_TOKEN
pnpm --filter @brisca/worker exec wrangler login
pnpm deploy:worker
```

El Worker queda en `https://brisca-3d-ws.<tu-subdominio>.workers.dev` (health: `/health`).

Si cambias el nombre o el subdominio, actualiza `WS_UPSTREAM`:

- En local: variable de entorno.
- En Vercel: _Project → Settings → Environment Variables_.
- O edita el valor por defecto en `api/ws.ts`.

### Vercel

```bash
pnpm dlx vercel@latest login   # si no tienes sesión
pnpm deploy:web
```

El cliente detecta automáticamente el puente:

- `*.vercel.app` → `wss://<host>/api/ws`
- `*.workers.dev` / `*.pages.dev` → `wss://<host>/ws`
- Local → `ws://<host>:8080`
- `config.json` o `VITE_WS_URL` mandan si están definidos.

### Límites del plan gratuito

- **Vercel Hobby:** cada conexión WebSocket dura como máximo **300 s**. El cliente reconecta solo y el Durable Object conserva la sala 60 s; el aviso al rival se retrasa 2,5 s, así que la partida continúa sin que se note.
- **Cloudflare Free:** 100.000 peticiones/día y 13.000 GB-s/día. Una partida completa usa ~100 mensajes; sobran partidas.
- El token de Cloudflare solo se usa para desplegar. Puedes revocarlo en <https://dash.cloudflare.com/profile/api-tokens>.

---

## 🔐 Configuración

| Variable      | Dónde                | Uso                                                    |
| ------------- | -------------------- | ------------------------------------------------------ |
| `WS_UPSTREAM` | Vercel               | URL `wss` del Worker (por defecto la de este proyecto) |
| `VITE_WS_URL` | Vercel / `.env`      | URL del WebSocket en build                             |
| `wsUrl`       | `public/config.json` | URL en runtime (prioridad)                             |
| `PORT`        | Servidor Node        | Puerto HTTP/WS (8080)                                  |
| `?ws=`        | URL del cliente      | Override puntual para pruebas                          |
| `?room=ABCD`  | URL del cliente      | Invitación directa a una sala                          |
| `?solo=1`     | URL del cliente      | Modo práctica                                          |

El token de reconexión se guarda en `sessionStorage` por sala; el apodo en `localStorage`. No hay cuentas ni datos personales en el servidor.

---

## 🧪 Calidad

- **30 tests**: motor, sesión y servidor (partida completa, revancha, reconexión, sala llena, rate limit, mensajes inválidos).
- TypeScript estricto, `oxlint` y `prettier` con Husky + lint-staged.
- CI en `.github/workflows/ci.yml`.
- E2E manual verificado en navegador real: crear/unirse, partida completa, revancha, enlace de invitación, modo IA y reconexión.

### Endurecimiento

- Salas de 4 caracteres sin ambigüedades y control de colisiones.
- Validación de turnos y cartas en el servidor (autoritativo).
- Límite de mensaje (8 KB), rate limit por conexión y validación de tipos.
- Token de sesión para reconectar; nadie puede ocupar una silla en gracia sin él.
- Cierre de sala al expirar la gracia de 60 s.
- Heartbeat ping/pong en Node; Cloudflare mantiene vivas las conexiones.

---

## 📄 Licencia

MIT © Moisés Valero
