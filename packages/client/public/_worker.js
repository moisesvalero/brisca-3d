// Cloudflare Pages advanced mode.
// Sirve la PWA y hace de puente para el WebSocket, que vive en el Worker
// (workers.dev está bloqueado en algunas redes; pages.dev no).
const WS_ORIGIN = "https://brisca-3d-ws.brisca3d-moises.workers.dev";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return Response.json({ status: "ok", edge: "pages" });
    }

    if (url.pathname === "/ws") {
      const upgrade = request.headers.get("Upgrade");
      if (!upgrade || upgrade.toLowerCase() !== "websocket") {
        return new Response("Expected a WebSocket upgrade", { status: 426 });
      }
      // Runs inside Cloudflare, so it does not depend on the visitor's ISP
      // being able to reach the workers.dev IP range.
      return fetch(`${WS_ORIGIN}/ws`, request);
    }

    return env.ASSETS.fetch(request);
  },
};
