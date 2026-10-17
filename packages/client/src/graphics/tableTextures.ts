import * as THREE from "three";

/**
 * Hand-painted (procedural) felt for the retro casino table. Drawn at
 * 2048px so the weave, medallion and inlays stay crisp in the 3D scene.
 */
export function createFeltTexture(): THREE.CanvasTexture {
  const width = 2048;
  const height = Math.round((width * 36) / 50);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(canvas);

  const cx = width / 2;
  const cy = height / 2;
  const unit = width / 50; // pixels per world unit

  // 1. Deep emerald base with a soft centre glow
  const base = ctx.createRadialGradient(cx, cy, 40, cx, cy, width * 0.74);
  base.addColorStop(0, "#0f4c2c");
  base.addColorStop(0.52, "#0a3b21");
  base.addColorStop(1, "#041d10");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, width, height);

  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, width * 0.42);
  glow.addColorStop(0, "rgba(255, 204, 128, 0.03)");
  glow.addColorStop(1, "rgba(255, 204, 128, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  // 2. Woven felt grain (fine horizontal/vertical threads)
  for (let y = 0; y < height; y += 2) {
    const alpha = 0.008 + Math.random() * 0.013;
    ctx.fillStyle = `rgba(190, 255, 214, ${alpha})`;
    ctx.fillRect(0, y, width, 1);
  }
  for (let x = 0; x < width; x += 2) {
    const alpha = 0.006 + Math.random() * 0.012;
    ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
    ctx.fillRect(x, 0, 1, height);
  }

  // 3. Subtle mottling / worn felt
  for (let i = 0; i < 75; i += 1) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const radius = 30 + Math.random() * 170;
    const stain = ctx.createRadialGradient(x, y, 0, x, y, radius);
    stain.addColorStop(0, `rgba(0, 0, 0, ${0.018 + Math.random() * 0.035})`);
    stain.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = stain;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  // 4. Central art-deco medallion (behind the trick)
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = "rgba(214, 172, 96, 0.23)";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(0, 0, 3.1 * unit, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = "rgba(214, 172, 96, 0.15)";
  ctx.lineWidth = 2;
  for (let i = 0; i < 64; i += 1) {
    const angle = (i / 64) * Math.PI * 2;
    const inner = (i % 2 === 0 ? 2.35 : 2.55) * unit;
    const outer = 3.0 * unit;
    ctx.beginPath();
    ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
    ctx.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(234, 198, 124, 0.26)";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(0, 0, 1.5 * unit, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = "rgba(234, 198, 124, 0.18)";
  ctx.lineWidth = 2;
  for (let i = 0; i < 8; i += 1) {
    const angle = (i / 8) * Math.PI * 2;
    const outer = (i % 2 === 0 ? 1.35 : 0.9) * unit;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
    ctx.stroke();
  }
  ctx.restore();

  // 5. Four suit emblems around the medallion
  const suitColor = "rgba(230, 194, 126, 0.24)";
  const suitRadius = 3.8 * unit;
  const suits: Array<"oro" | "copa" | "espada" | "basto"> = [
    "oro",
    "copa",
    "espada",
    "basto",
  ];
  suits.forEach((suit, index) => {
    const angle = (Math.PI / 4) * (index * 2 + 1);
    drawSuit(
      ctx,
      suit,
      cx + Math.cos(angle) * suitRadius,
      cy + Math.sin(angle) * suitRadius,
      1.0 * unit,
      suitColor,
    );
  });

  // 6. Art-deco inlaid rectangle framing the play area
  const bx = 7.9 * unit;
  const bz = 5.25 * unit;
  ctx.strokeStyle = "rgba(210, 168, 94, 0.17)";
  ctx.lineWidth = 3;
  ctx.strokeRect(cx - bx, cy - bz, bx * 2, bz * 2);
  ctx.strokeStyle = "rgba(236, 204, 138, 0.1)";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(cx - bx + 11, cy - bz + 11, bx * 2 - 22, bz * 2 - 22);

  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      ctx.save();
      ctx.translate(cx + sx * bx, cy + sy * bz);
      ctx.rotate(Math.PI / 4);
      ctx.strokeStyle = "rgba(230, 192, 116, 0.24)";
      ctx.lineWidth = 2;
      ctx.strokeRect(-11, -11, 22, 22);
      ctx.restore();
    }
  }

  // 7. Vignette towards the outer felt
  const vignette = ctx.createRadialGradient(
    cx,
    cy,
    width * 0.22,
    cx,
    cy,
    width * 0.72,
  );
  vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
  vignette.addColorStop(0.58, "rgba(0, 0, 0, 0.08)");
  vignette.addColorStop(1, "rgba(0, 0, 0, 0.42)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

function drawSuit(
  ctx: CanvasRenderingContext2D,
  suit: "oro" | "copa" | "espada" | "basto",
  x: number,
  y: number,
  size: number,
  color: string,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(1.6, size * 0.06);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (suit === "oro") {
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.52, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 4; i += 1) {
      const angle = (i / 4) * Math.PI * 2;
      ctx.beginPath();
      ctx.ellipse(
        Math.cos(angle) * size * 0.2,
        Math.sin(angle) * size * 0.2,
        size * 0.2,
        size * 0.1,
        angle,
        0,
        Math.PI * 2,
      );
      ctx.stroke();
    }
  } else if (suit === "copa") {
    ctx.beginPath();
    ctx.moveTo(-size * 0.42, -size * 0.42);
    ctx.quadraticCurveTo(-size * 0.5, size * 0.16, 0, size * 0.3);
    ctx.quadraticCurveTo(size * 0.5, size * 0.16, size * 0.42, -size * 0.42);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, size * 0.3);
    ctx.lineTo(0, size * 0.52);
    ctx.moveTo(-size * 0.26, size * 0.54);
    ctx.lineTo(size * 0.26, size * 0.54);
    ctx.stroke();
  } else if (suit === "espada") {
    ctx.beginPath();
    ctx.moveTo(0, -size * 0.6);
    ctx.lineTo(0, size * 0.44);
    ctx.moveTo(-size * 0.27, size * 0.02);
    ctx.lineTo(size * 0.27, size * 0.02);
    ctx.moveTo(-size * 0.13, size * 0.52);
    ctx.lineTo(size * 0.13, size * 0.52);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(-size * 0.32, size * 0.58);
    ctx.quadraticCurveTo(0, size * 0.06, size * 0.34, -size * 0.58);
    ctx.stroke();
    for (const t of [0.12, 0.34]) {
      ctx.beginPath();
      ctx.moveTo(size * 0.04, size * 0.3 - size * 0.5 * t);
      ctx.lineTo(-size * 0.2, size * 0.32 - size * 0.5 * t);
      ctx.stroke();
    }
  }

  ctx.restore();
}
