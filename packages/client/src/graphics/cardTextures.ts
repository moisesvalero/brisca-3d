import * as THREE from "three";
import { Card, Suit } from "@brisca/core";

const textureCache = new Map<string, THREE.CanvasTexture>();

function drawCardBack(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
) {
  // Base dark navy blue
  ctx.fillStyle = "#0a192f";
  ctx.fillRect(0, 0, width, height);

  // Outer gold border
  ctx.lineWidth = 14;
  ctx.strokeStyle = "#d4af37";
  ctx.strokeRect(18, 18, width - 36, height - 36);

  // Inner border
  ctx.lineWidth = 4;
  ctx.strokeStyle = "#f59e0b";
  ctx.strokeRect(30, 30, width - 60, height - 60);

  // Intricate Spanish geometric lattice pattern
  ctx.save();
  ctx.strokeStyle = "#1e3a5f";
  ctx.lineWidth = 3;
  const step = 32;
  for (let x = 40; x < width - 40; x += step) {
    for (let y = 40; y < height - 40; y += step) {
      ctx.beginPath();
      ctx.moveTo(x + step / 2, y);
      ctx.lineTo(x + step, y + step / 2);
      ctx.lineTo(x + step / 2, y + step);
      ctx.lineTo(x, y + step / 2);
      ctx.closePath();
      ctx.stroke();

      // Golden center dot
      ctx.fillStyle = "#b45309";
      ctx.fillRect(x + step / 2 - 2, y + step / 2 - 2, 4, 4);
    }
  }
  ctx.restore();

  // Central ornate medallion
  const cx = width / 2;
  const cy = height / 2;
  ctx.beginPath();
  ctx.arc(cx, cy, 70, 0, Math.PI * 2);
  ctx.fillStyle = "#0f2744";
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = "#f59e0b";
  ctx.stroke();

  // Star in center
  ctx.fillStyle = "#fbbf24";
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI) / 4;
    const r = i % 2 === 0 ? 45 : 20;
    const px = cx + Math.cos(angle) * r;
    const py = cy + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}

function drawSuitIcon(
  ctx: CanvasRenderingContext2D,
  suit: Suit,
  x: number,
  y: number,
  size: number,
) {
  ctx.save();
  ctx.translate(x, y);

  if (suit === "oros") {
    // Golden coin with radiating beams
    const grad = ctx.createRadialGradient(0, 0, 5, 0, 0, size);
    grad.addColorStop(0, "#fef08a");
    grad.addColorStop(0.6, "#eab308");
    grad.addColorStop(1, "#a16207");

    ctx.beginPath();
    ctx.arc(0, 0, size, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.lineWidth = size * 0.15;
    ctx.strokeStyle = "#78350f";
    ctx.stroke();

    // Inner flower / sun motif
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.55, 0, Math.PI * 2);
    ctx.strokeStyle = "#fef9c3";
    ctx.lineWidth = 3;
    ctx.stroke();
  } else if (suit === "copas") {
    // Red & Gold Chalice
    ctx.fillStyle = "#dc2626";
    ctx.beginPath();
    ctx.arc(0, -size * 0.2, size * 0.7, 0, Math.PI);
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#b91c1c";
    ctx.stroke();

    // Stem and base
    ctx.fillStyle = "#f59e0b";
    ctx.fillRect(-size * 0.15, size * 0.45, size * 0.3, size * 0.4);
    ctx.beginPath();
    ctx.ellipse(0, size * 0.85, size * 0.6, size * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (suit === "espadas") {
    // Curved Spanish Scimitar / Rapier
    ctx.lineWidth = size * 0.22;
    ctx.strokeStyle = "#94a3b8";
    ctx.beginPath();
    ctx.moveTo(0, size * 0.9);
    ctx.quadraticCurveTo(-size * 0.4, 0, 0, -size * 0.9);
    ctx.stroke();

    // Guard & pommel
    ctx.fillStyle = "#d97706";
    ctx.fillRect(-size * 0.4, size * 0.4, size * 0.8, size * 0.15);
    ctx.beginPath();
    ctx.arc(0, size * 0.95, size * 0.18, 0, Math.PI * 2);
    ctx.fill();
  } else if (suit === "bastos") {
    // Knotted wooden Cudgel
    ctx.lineWidth = size * 0.3;
    ctx.strokeStyle = "#78350f";
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(0, size * 0.85);
    ctx.lineTo(0, -size * 0.85);
    ctx.stroke();

    // Knots
    ctx.fillStyle = "#16a34a";
    ctx.beginPath();
    ctx.arc(-size * 0.25, -size * 0.3, size * 0.18, 0, Math.PI * 2);
    ctx.arc(size * 0.25, size * 0.1, size * 0.18, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, w, h, r);
  } else {
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
  }
}

function drawCardFront(
  ctx: CanvasRenderingContext2D,
  card: Card,
  width: number,
  height: number,
) {
  // Parchment cream card stock with subtle gradient
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  bgGrad.addColorStop(0, "#fdfbf7");
  bgGrad.addColorStop(1, "#f4ece1");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Elegant decorative border
  ctx.lineWidth = 8;
  ctx.strokeStyle = "#cbd5e1";
  ctx.strokeRect(16, 16, width - 32, height - 32);

  ctx.lineWidth = 2;
  ctx.strokeStyle = "#e2e8f0";
  ctx.strokeRect(26, 26, width - 52, height - 52);

  // Top-left and bottom-right indices
  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 44px -apple-system, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(`${card.rank}`, 40, 75);

  drawSuitIcon(ctx, card.suit, 55, 125, 26);

  // Mirrored bottom-right
  ctx.save();
  ctx.translate(width, height);
  ctx.rotate(Math.PI);
  ctx.fillText(`${card.rank}`, 40, 75);
  drawSuitIcon(ctx, card.suit, 55, 125, 26);
  ctx.restore();

  // Center art
  const cx = width / 2;
  const cy = height / 2;

  if (card.rank >= 10) {
    // Royal court figure emblem
    const circleGrad = ctx.createRadialGradient(cx, cy, 20, cx, cy, 140);
    circleGrad.addColorStop(0, "#fef3c7");
    circleGrad.addColorStop(1, "#fde68a");
    ctx.fillStyle = circleGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, 140, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = "#d97706";
    ctx.stroke();

    // Central title badge
    ctx.fillStyle = "#1e293b";
    ctx.font = "bold 36px -apple-system, sans-serif";
    ctx.textAlign = "center";
    const title =
      card.rank === 12 ? "REY" : card.rank === 11 ? "CABALLO" : "SOTA";
    ctx.fillText(title, cx, cy - 30);

    drawSuitIcon(ctx, card.suit, cx, cy + 45, 60);
  } else {
    // Number card center pips
    drawSuitIcon(ctx, card.suit, cx, cy, 80);
  }

  // Points banner for Brisca (Balatro style badge)
  if (card.points > 0) {
    ctx.save();
    const bx = width / 2;
    const by = height - 70;
    ctx.fillStyle = "#0f172a";
    ctx.beginPath();
    drawRoundRect(ctx, bx - 80, by - 24, 160, 48, 12);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#f59e0b";
    ctx.stroke();

    ctx.fillStyle = "#fbbf24";
    ctx.font = "bold 26px -apple-system, monospace";
    ctx.textAlign = "center";
    ctx.fillText(`+${card.points} PTS`, bx, by + 8);
    ctx.restore();
  }
}

export function getCardTexture(card: Card): THREE.CanvasTexture {
  const key = `front_${card.id}`;
  if (textureCache.has(key)) {
    return textureCache.get(key)!;
  }

  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 768;
  const ctx = canvas.getContext("2d")!;

  drawCardFront(ctx, card, 512, 768);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  textureCache.set(key, texture);
  return texture;
}

export function getCardBackTexture(): THREE.CanvasTexture {
  const key = "back_spanish_deck";
  if (textureCache.has(key)) {
    return textureCache.get(key)!;
  }

  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 768;
  const ctx = canvas.getContext("2d")!;

  drawCardBack(ctx, 512, 768);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  textureCache.set(key, texture);
  return texture;
}
