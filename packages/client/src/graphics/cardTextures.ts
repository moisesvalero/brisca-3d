import * as THREE from "three";
import { Card } from "@brisca/core";

const loader = new THREE.TextureLoader();
const textureCache = new Map<string, THREE.Texture>();

export function getCardTexture(card: Card): THREE.Texture {
  const url = `/cards/${card.suit}_${card.rank}.png`;
  if (textureCache.has(url)) {
    return textureCache.get(url)!;
  }

  const texture = loader.load(url);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  textureCache.set(url, texture);
  return texture;
}

export function getCardBackTexture(): THREE.Texture {
  const url = "/cards/reverso.png";
  if (textureCache.has(url)) {
    return textureCache.get(url)!;
  }

  const texture = loader.load(url);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  textureCache.set(url, texture);
  return texture;
}
