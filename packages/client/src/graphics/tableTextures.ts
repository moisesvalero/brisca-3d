import * as THREE from "three";

const FELT_WIDTH = 2048;
const FELT_HEIGHT = Math.round((FELT_WIDTH * 10.4) / 14);

function feltCanvas(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = FELT_WIDTH;
  canvas.height = FELT_HEIGHT;
  return canvas;
}

/**
 * Hunter-green felt with a fine gold pinstripe and a discreet brisca3D stamp.
 * No medallion, rings or suit emblems: clean traditional card table.
 */
export function createFeltTexture(): THREE.CanvasTexture {
  const canvas = feltCanvas();
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(canvas);

  const w = canvas.width;
  const h = canvas.height;
  const cx = w / 2;
  const cy = h / 2;

  // Desaturated hunter green with a soft centre.
  const base = ctx.createRadialGradient(cx, cy, 40, cx, cy, w * 0.72);
  base.addColorStop(0, "#26563b");
  base.addColorStop(0.55, "#1e4a33");
  base.addColorStop(1, "#143a27");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);

  // Felt weave: very fine threads, no visible noise pattern.
  for (let y = 0; y < h; y += 2) {
    ctx.fillStyle = `rgba(196, 230, 205, ${0.006 + Math.random() * 0.008})`;
    ctx.fillRect(0, y, w, 1);
  }
  for (let x = 0; x < w; x += 2) {
    ctx.fillStyle = `rgba(0, 0, 0, ${0.005 + Math.random() * 0.007})`;
    ctx.fillRect(x, 0, 1, h);
  }

  // A few soft tonal patches, like real worn felt.
  for (let i = 0; i < 42; i += 1) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const radius = 60 + Math.random() * 220;
    const patch = ctx.createRadialGradient(x, y, 0, x, y, radius);
    patch.addColorStop(0, `rgba(0, 0, 0, ${0.012 + Math.random() * 0.018})`);
    patch.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = patch;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  // Fine gold line a few centimetres from the outer edge.
  const inset = 54;
  ctx.strokeStyle = "rgba(198, 168, 104, 0.78)";
  ctx.lineWidth = 3;
  ctx.strokeRect(inset, inset, w - inset * 2, h - inset * 2);

  // Small stamped brisca3D in the bottom-right corner.
  ctx.save();
  ctx.fillStyle = "rgba(198, 168, 104, 0.68)";
  ctx.textAlign = "right";
  ctx.textBaseline = "alphabetic";
  ctx.font = 'italic 64px Georgia, "Times New Roman", serif';
  ctx.fillText("brisca3D", w - 92, h - 64);
  ctx.restore();

  const vignette = ctx.createRadialGradient(cx, cy, w * 0.2, cx, cy, w * 0.74);
  vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
  vignette.addColorStop(0.65, "rgba(0, 0, 0, 0.05)");
  vignette.addColorStop(1, "rgba(0, 0, 0, 0.2)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, w, h);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

/** Grayscale micro-weave used as bumpMap so the felt is not plastic. */
export function createFeltBumpTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = Math.round((1024 * 10.4) / 14);
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(canvas);
  const w = canvas.width;
  const h = canvas.height;
  ctx.fillStyle = "#808080";
  ctx.fillRect(0, 0, w, h);

  for (let y = 0; y < h; y += 3) {
    ctx.fillStyle = `rgba(255,255,255,${0.06 + Math.random() * 0.08})`;
    ctx.fillRect(0, y, w, 1);
  }
  for (let x = 0; x < w; x += 3) {
    ctx.fillStyle = `rgba(0,0,0,${0.05 + Math.random() * 0.07})`;
    ctx.fillRect(x, 0, 1, h);
  }
  for (let i = 0; i < 6000; i += 1) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const a = Math.random() * 0.08;
    ctx.fillStyle =
      Math.random() > 0.5 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
    ctx.fillRect(x, y, 2, 1);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(8, 6);
  texture.anisotropy = 4;
  return texture;
}

/** Warm oak plank grain for the table base. */
export function createWoodTexture(): THREE.CanvasTexture {
  const size = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(canvas);

  const base = ctx.createLinearGradient(0, 0, 0, size);
  base.addColorStop(0, "#8c5b34");
  base.addColorStop(0.45, "#a47344");
  base.addColorStop(0.72, "#916239");
  base.addColorStop(1, "#7a4d2b");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);

  // Long, slightly wavy grain lines.
  for (let i = 0; i < 150; i += 1) {
    const y = Math.random() * size;
    const dark = Math.random() > 0.45;
    ctx.strokeStyle = dark
      ? `rgba(52, 30, 15, ${0.05 + Math.random() * 0.14})`
      : `rgba(240, 205, 160, ${0.04 + Math.random() * 0.09})`;
    ctx.lineWidth = 0.7 + Math.random() * 2.6;
    ctx.beginPath();
    ctx.moveTo(-20, y);
    const a = 6 + Math.random() * 18;
    const b = 6 + Math.random() * 18;
    ctx.bezierCurveTo(
      size * 0.3,
      y - a,
      size * 0.65,
      y + b,
      size + 20,
      y + (Math.random() - 0.5) * 14,
    );
    ctx.stroke();
  }

  // Knots.
  for (let i = 0; i < 7; i += 1) {
    const x = 80 + Math.random() * (size - 160);
    const y = 80 + Math.random() * (size - 160);
    const rx = 8 + Math.random() * 18;
    const ry = 4 + Math.random() * 9;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((Math.random() - 0.5) * 0.6);
    for (let k = 0; k < 5; k += 1) {
      ctx.strokeStyle = `rgba(48, 27, 13, ${0.22 - k * 0.035})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, 0, rx + k * 4, ry + k * 3, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 2);
  texture.anisotropy = 8;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

/** Grayscale wood grain for the bump/roughness of the base. */
export function createWoodBumpTexture(): THREE.CanvasTexture {
  const size = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(canvas);
  ctx.fillStyle = "#808080";
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 190; i += 1) {
    const y = Math.random() * size;
    const dark = Math.random() > 0.5;
    ctx.strokeStyle = dark
      ? `rgba(0, 0, 0, ${0.08 + Math.random() * 0.18})`
      : `rgba(255, 255, 255, ${0.05 + Math.random() * 0.14})`;
    ctx.lineWidth = 0.6 + Math.random() * 2.2;
    ctx.beginPath();
    ctx.moveTo(-20, y);
    const a = 6 + Math.random() * 18;
    const b = 6 + Math.random() * 18;
    ctx.bezierCurveTo(
      size * 0.3,
      y - a,
      size * 0.65,
      y + b,
      size + 20,
      y + (Math.random() - 0.5) * 14,
    );
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 2);
  texture.anisotropy = 4;
  return texture;
}

/** Off-white page edges with wear and micro-shadows for the deck side. */
export function createDeckPageTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(canvas);

  ctx.fillStyle = "#e8e0d0";
  ctx.fillRect(0, 0, size, size);

  // Stacked paper leaves: alternating dark gaps and light page edges.
  for (let y = 0; y < size; y += 3) {
    ctx.fillStyle = `rgba(72, 55, 38, ${0.08 + Math.random() * 0.1})`;
    ctx.fillRect(0, y, size, 1);
    ctx.fillStyle = `rgba(255, 252, 242, ${0.16 + Math.random() * 0.14})`;
    ctx.fillRect(0, y + 1, size, 1);
  }

  // Worn corners / age stains.
  for (let i = 0; i < 22; i += 1) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const radius = 8 + Math.random() * 45;
    const stain = ctx.createRadialGradient(x, y, 0, x, y, radius);
    stain.addColorStop(0, `rgba(95, 72, 45, ${0.04 + Math.random() * 0.08})`);
    stain.addColorStop(1, "rgba(95, 72, 45, 0)");
    ctx.fillStyle = stain;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 8;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}
