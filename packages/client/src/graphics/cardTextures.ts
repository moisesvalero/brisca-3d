import * as THREE from "three";
import { Card } from "@brisca/core";

// Bump when the card art changes so clients and the PWA cache fetch the
// restored versions instead of serving the previous deck.
const CARD_VERSION = "7";

const loader = new THREE.TextureLoader();
const textureCache = new Map<string, THREE.Texture>();

const CARD_SUITS = ["oros", "copas", "espadas", "bastos"] as const;
const CARD_RANKS = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12] as const;

/**
 * Warm every face at app start. Previously a card revealed for the first
 * time (rival's play, trump, draw) rendered with an empty map and flashed
 * black until its WebP finished loading.
 */
export function preloadCardTextures(): void {
  for (const suit of CARD_SUITS) {
    for (const rank of CARD_RANKS) {
      getCardTexture({ id: `${suit}_${rank}`, suit, rank, points: 0 });
    }
  }
  getCardBackTexture();
}

export function getCardTexture(card: Card): THREE.Texture {
  const url = `/cards/${card.suit}_${card.rank}.webp?v=${CARD_VERSION}`;
  if (textureCache.has(url)) {
    return textureCache.get(url)!;
  }

  const texture = loader.load(url);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  // Keep the old paper grain sharp when cards are seen at an angle.
  texture.anisotropy = 16;
  textureCache.set(url, texture);
  return texture;
}

export function getCardBackTexture(): THREE.Texture {
  const url = `/cards/reverso.webp?v=${CARD_VERSION}`;
  if (textureCache.has(url)) {
    return textureCache.get(url)!;
  }

  const texture = loader.load(url);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  // Keep the old paper grain sharp when cards are seen at an angle.
  texture.anisotropy = 16;
  textureCache.set(url, texture);
  return texture;
}

if (typeof window !== "undefined") {
  preloadCardTextures();
}
