import * as THREE from "three";
import { Card } from "@brisca/core";

// Bump when the card art changes so clients and the PWA cache fetch the
// restored versions instead of serving the previous deck.
const CARD_VERSION = "3";

const loader = new THREE.TextureLoader();
const textureCache = new Map<string, THREE.Texture>();

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
  texture.anisotropy = 8;
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
  texture.anisotropy = 8;
  textureCache.set(url, texture);
  return texture;
}
