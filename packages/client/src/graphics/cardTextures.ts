import * as THREE from "three";
import { Card } from "@brisca/core";

const loader = new THREE.TextureLoader();
const textureCache = new Map<string, THREE.Texture>();

export function getCardTexture(card: Card): THREE.Texture {
  const url = `/cards/${card.suit}_${card.rank}.webp`;
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
  const url = "/cards/reverso.webp";
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
