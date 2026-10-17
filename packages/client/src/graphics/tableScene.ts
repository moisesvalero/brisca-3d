import * as THREE from "three";
import { Card } from "@brisca/core";
import { getCardTexture, getCardBackTexture } from "./cardTextures.js";
import {
  createFeltBumpTexture,
  createFeltTexture,
  createWoodBumpTexture,
  createWoodTexture,
  createDeckPageTexture,
} from "./tableTextures.js";
import { sounds } from "../audio/soundManager.js";

export interface InteractiveCard {
  mesh: THREE.Mesh;
  card: Card;
  targetPos: THREE.Vector3;
  targetRot: THREE.Euler;
  isHovered: boolean;
  isPlayerHand: boolean;
  flight?: {
    start: THREE.Vector3;
    target: THREE.Vector3;
    startTime: number;
    duration: number;
    arc: number;
  };
}

function createRoundedCardGeometry(
  width: number,
  height: number,
  thickness: number,
  radius: number,
  segments = 6,
): THREE.BufferGeometry {
  const hw = width / 2;
  const hh = height / 2;
  const hd = thickness / 2;
  const corners = [
    { x: hw - radius, z: -hh + radius, a0: -Math.PI / 2, a1: 0 },
    { x: hw - radius, z: hh - radius, a0: 0, a1: Math.PI / 2 },
    { x: -hw + radius, z: hh - radius, a0: Math.PI / 2, a1: Math.PI },
    { x: -hw + radius, z: -hh + radius, a0: Math.PI, a1: (3 * Math.PI) / 2 },
  ];
  const outline: Array<[number, number]> = [];
  for (const c of corners) {
    for (let i = 0; i <= segments; i += 1) {
      const a = c.a0 + ((c.a1 - c.a0) * i) / segments;
      outline.push([c.x + Math.cos(a) * radius, c.z + Math.sin(a) * radius]);
    }
  }

  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const topCenter = 0;
  positions.push(0, hd, 0);
  normals.push(0, 1, 0);
  uvs.push(0.5, 0.5);
  const topStart = 1;
  for (const [x, z] of outline) {
    positions.push(x, hd, z);
    normals.push(0, 1, 0);
    uvs.push((x + hw) / width, (hh - z) / height);
  }
  for (let i = 0; i < outline.length; i += 1) {
    const a = topStart + i;
    const b = topStart + ((i + 1) % outline.length);
    indices.push(topCenter, b, a);
  }
  const topCount = indices.length;

  const bottomCenter = positions.length / 3;
  positions.push(0, -hd, 0);
  normals.push(0, -1, 0);
  uvs.push(0.5, 0.5);
  const bottomStart = positions.length / 3;
  for (const [x, z] of outline) {
    positions.push(x, -hd, z);
    normals.push(0, -1, 0);
    uvs.push((x + hw) / width, (hh - z) / height);
  }
  for (let i = 0; i < outline.length; i += 1) {
    const a = bottomStart + i;
    const b = bottomStart + ((i + 1) % outline.length);
    indices.push(bottomCenter, a, b);
  }
  const bottomCount = indices.length - topCount;

  for (let i = 0; i < outline.length; i += 1) {
    const [xa, za] = outline[i];
    const [xb, zb] = outline[(i + 1) % outline.length];
    const la = Math.hypot(xa, za) || 1;
    const lb = Math.hypot(xb, zb) || 1;
    const base = positions.length / 3;
    positions.push(xa, hd, za, xa, -hd, za, xb, -hd, zb, xb, hd, zb);
    normals.push(
      xa / la,
      0,
      za / la,
      xa / la,
      0,
      za / la,
      xb / lb,
      0,
      zb / lb,
      xb / lb,
      0,
      zb / lb,
    );
    uvs.push(
      i / outline.length,
      1,
      i / outline.length,
      0,
      (i + 1) / outline.length,
      0,
      (i + 1) / outline.length,
      1,
    );
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.addGroup(0, topCount, 0);
  geo.addGroup(topCount, bottomCount, 1);
  geo.addGroup(
    topCount + bottomCount,
    indices.length - topCount - bottomCount,
    2,
  );
  geo.computeBoundingSphere();
  return geo;
}

const CARD_GEOMETRY = createRoundedCardGeometry(1.96, 3.1, 0.024, 0.12);

export class TableScene {
  private container: HTMLElement;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2(0, 0);
  private hoverMouse = new THREE.Vector2(-1000, -1000);

  private cardsMap = new Map<string, InteractiveCard>();
  private particles: THREE.Points | null = null;
  private particlePositions: Float32Array = new Float32Array(0);
  private particleVelocities: Float32Array = new Float32Array(0);

  private trumpSpotlight: THREE.SpotLight | null = null;
  private screenShakeAmount = 0;
  private baseCameraPos = new THREE.Vector3(0, 13, 9.5);
  private hoveredCardId: string | null = null;
  private animFrameId: number | null = null;
  private isDestroyed = false;
  private resizeObserver: ResizeObserver | null = null;
  private deckBlockMesh: THREE.Mesh | null = null;

  public onCardClick?: (card: Card) => void;

  constructor(container: HTMLElement) {
    this.container = container;

    // 1. Scene setup: Premium casino room atmosphere
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color("#0a0705");
    this.scene.fog = new THREE.FogExp2("#0a0705", 0.022);

    // 2. Camera setup with isometric perspective
    const width = container.clientWidth || window.innerWidth || 800;
    const height = container.clientHeight || window.innerHeight || 600;
    const aspect = width / height;
    this.camera = new THREE.PerspectiveCamera(40, aspect, 0.1, 100);
    this.updateCameraResponsive(width, height);

    // 3. WebGL Renderer
    try {
      this.renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: "high-performance",
        failIfMajorPerformanceCaveat: false,
      });
    } catch {
      this.renderer = new THREE.WebGLRenderer({ antialias: false });
    }

    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    try {
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    } catch {
      this.renderer.shadowMap.enabled = false;
    }

    this.renderer.toneMapping = THREE.LinearToneMapping;
    this.renderer.toneMappingExposure = 1.15;

    container.appendChild(this.renderer.domElement);

    // 4. Lights & Table
    this.setupLights();
    this.setupTable();
    this.setupParticles();

    // 5. Events: window resize, orientation changes and container size.
    window.addEventListener("resize", this.onResize);
    window.addEventListener("orientationchange", this.onResize);
    window.visualViewport?.addEventListener("resize", this.onResize);
    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(() => this.onResize());
      this.resizeObserver.observe(this.container);
    }
    this.container.addEventListener("pointermove", this.onPointerMove);
    this.container.addEventListener("pointerdown", this.onPointerDown);

    // 6. Start Loop
    this.animate();
  }

  private updateCameraResponsive(width: number, height: number) {
    const aspect = width / Math.max(1, height);
    const target = new THREE.Vector3(0, 0, 0.7);
    const basePos = new THREE.Vector3(0, 13, 9.5);
    const baseFov = 40;
    const maxFov = 68;

    // Open the FOV on narrow screens, then move the camera back until both
    // the table width (left deck) and depth (hands) fit with a safe margin.
    let fov = baseFov;
    if (aspect < 1.5) {
      const neededFov =
        (2 *
          Math.atan(
            Math.tan((baseFov * Math.PI) / 360) * (1.5 / Math.max(0.4, aspect)),
          ) *
          180) /
        Math.PI;
      fov = Math.min(Math.max(baseFov, neededFov), maxFov);
    }

    const vfov = (fov * Math.PI) / 180;
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * aspect);
    const baseDistance = basePos.distanceTo(target);
    // Deck at x=-4.7 (left edge -5.68); rail at ±5.25; hand near z=+5.5.
    const fitHalfWidth = 6.9;
    const fitHalfDepth = 8.4;
    const distanceForWidth = fitHalfWidth / Math.tan(hfov / 2);
    const distanceForDepth = fitHalfDepth / Math.tan(vfov / 2);
    const distance = Math.max(baseDistance, distanceForWidth, distanceForDepth);

    this.baseCameraPos
      .copy(basePos)
      .sub(target)
      .multiplyScalar(distance / baseDistance)
      .add(target);

    this.camera.fov = fov;
    this.camera.aspect = aspect;
    this.camera.position.copy(this.baseCameraPos);
    this.camera.lookAt(target);
    this.camera.updateProjectionMatrix();

    if (this.renderer) {
      // Retina/OLED sharpness without letting a phone GPU render at 3x/4x.
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.renderer.setSize(width, height);
    }
  }

  private setupLights() {
    // 1. Rich Hemisphere light for uniform, bright, natural illumination
    const hemiLight = new THREE.HemisphereLight("#ffe9c9", "#140f08", 1.15);
    this.scene.add(hemiLight);

    // 2. Main Key Light: Warm, bright spotlight above the table
    const keyLight = new THREE.DirectionalLight("#fff1d6", 1.75);
    keyLight.position.set(4, 14, 6);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(2048, 2048);
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 30;
    keyLight.shadow.camera.left = -10;
    keyLight.shadow.camera.right = 10;
    keyLight.shadow.camera.top = 10;
    keyLight.shadow.camera.bottom = -10;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.05;
    this.scene.add(keyLight);

    // 3. Fill Light: Cool fill light to illuminate all card faces evenly
    const fillLight = new THREE.DirectionalLight("#8fc7b0", 0.35);
    fillLight.position.set(-4, 10, -4);
    this.scene.add(fillLight);

    // 4. Trump spotlight: Warm amber accent pool on the trump card
    this.trumpSpotlight = new THREE.SpotLight(
      "#ffb84d",
      2.8,
      16,
      Math.PI / 4,
      0.55,
    );
    this.trumpSpotlight.position.set(-4.0, 6, -0.5);
    this.trumpSpotlight.target.position.set(-4.0, 0, -0.5);
    this.scene.add(this.trumpSpotlight);
    this.scene.add(this.trumpSpotlight.target);
  }

  private setupTable() {
    // Dark room floor so the table is grounded.
    const floorMat = new THREE.MeshStandardMaterial({
      color: "#0a0705",
      roughness: 0.95,
      metalness: 0.05,
    });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.5;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // Large natural-oak table base with real grain relief.
    const woodMap = createWoodTexture();
    const woodBump = createWoodBumpTexture();
    const woodMat = new THREE.MeshStandardMaterial({
      map: woodMap,
      bumpMap: woodBump,
      bumpScale: 0.03,
      roughness: 0.52,
      metalness: 0.03,
    });
    const woodBase = new THREE.Mesh(
      new THREE.BoxGeometry(22, 0.6, 16),
      woodMat,
    );
    woodBase.position.y = -0.3;
    woodBase.castShadow = true;
    woodBase.receiveShadow = true;
    this.scene.add(woodBase);

    // Rectangular hunter-green felt mat sitting on the wood.
    const feltMat = new THREE.MeshStandardMaterial({
      map: createFeltTexture(),
      bumpMap: createFeltBumpTexture(),
      bumpScale: 0.014,
      roughness: 0.96,
      metalness: 0,
    });
    const felt = new THREE.Mesh(new THREE.PlaneGeometry(14, 10.4), feltMat);
    felt.rotation.x = -Math.PI / 2;
    felt.position.y = 0.002;
    felt.receiveShadow = true;
    this.scene.add(felt);
  }

  private setupParticles() {
    const count = 120;
    this.particlePositions = new Float32Array(count * 3);
    this.particleVelocities = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      this.particlePositions[i * 3 + 1] = -100; // Hidden initially
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      "position",
      new THREE.BufferAttribute(this.particlePositions, 3),
    );

    const mat = new THREE.PointsMaterial({
      color: "#fbbf24",
      size: 0.25,
      blending: THREE.AdditiveBlending,
      transparent: true,
      opacity: 0.9,
    });

    this.particles = new THREE.Points(geo, mat);
    this.scene.add(this.particles);
  }

  public triggerSparks(x: number, y: number, z: number) {
    if (!this.particles) return;
    const count = this.particlePositions.length / 3;

    for (let i = 0; i < count; i++) {
      this.particlePositions[i * 3] = x + (Math.random() - 0.5) * 0.4;
      this.particlePositions[i * 3 + 1] = y + 0.2;
      this.particlePositions[i * 3 + 2] = z + (Math.random() - 0.5) * 0.4;

      this.particleVelocities[i * 3] = (Math.random() - 0.5) * 4;
      this.particleVelocities[i * 3 + 1] = Math.random() * 5 + 2;
      this.particleVelocities[i * 3 + 2] = (Math.random() - 0.5) * 4;
    }
    this.particles.geometry.attributes.position.needsUpdate = true;
    this.screenShakeAmount = 0.25;
  }

  public triggerScreenShake(intensity: number = 0.2) {
    this.screenShakeAmount = intensity;
  }

  private createCardMesh(card: Card): THREE.Mesh {
    // Fournier 1878 proportions, rounded silhouette.
    const geo = CARD_GEOMETRY;
    const frontTex = getCardTexture(card);
    const backTex = getCardBackTexture();

    const edgeMat = new THREE.MeshStandardMaterial({
      color: "#c9c4b8",
      roughness: 0.45,
      side: THREE.FrontSide,
    });
    const frontMat = new THREE.MeshStandardMaterial({
      map: frontTex,
      roughness: 0.28,
      metalness: 0.0,
      transparent: false,
    });
    const backMat = new THREE.MeshStandardMaterial({
      map: backTex,
      roughness: 0.32,
      metalness: 0.0,
      transparent: false,
    });

    // Geometry groups: top/front, bottom/back, rounded side.
    const materials = [frontMat, backMat, edgeMat];
    const mesh = new THREE.Mesh(geo, materials);
    mesh.castShadow = true;
    mesh.receiveShadow = false;
    return mesh;
  }

  private startCardFlight(entry: InteractiveCard) {
    const distance = entry.mesh.position.distanceTo(entry.targetPos);
    if (distance < 0.35) return;
    entry.flight = {
      start: entry.mesh.position.clone(),
      target: entry.targetPos.clone(),
      startTime: performance.now(),
      duration: 430,
      arc: 0.55,
    };
  }

  public updateGameState(
    myHand: Card[],
    opponentCount: number,
    trumpCard: Card | null,
    deckCount: number,
    currentTrick: { leadCard?: Card; followCard?: Card },
    isMyTurn: boolean,
  ) {
    const activeIds = new Set<string>();

    // 1. My hand (bottom)
    myHand.forEach((card, idx) => {
      activeIds.add(card.id);
      let entry = this.cardsMap.get(card.id);
      if (!entry) {
        const mesh = this.createCardMesh(card);
        mesh.position.set(0, 2, 0); // Spawn from center
        this.scene.add(mesh);
        entry = {
          mesh,
          card,
          targetPos: new THREE.Vector3(),
          targetRot: new THREE.Euler(),
          isHovered: false,
          isPlayerHand: true,
        };
        this.cardsMap.set(card.id, entry);
        sounds.playDeal();
      }

      entry.isPlayerHand = true;
      const count = myHand.length;
      // Bottom-edge pivot: the base stays on the felt when the card tilts.
      const spreadX = count === 2 ? 5.2 : 2.2;
      const offsetX = (idx - (count - 1) / 2) * spreadX;
      const fan = idx - (count - 1) / 2;
      const baseZ = 2.4;
      const baseY = 0.06;
      const tiltX = 0;

      if (entry.isHovered && isMyTurn) {
        entry.targetPos.set(offsetX, baseY + 0.3, baseZ - 0.25);
        entry.targetRot.set(tiltX, 0, fan * -0.03);
      } else {
        entry.targetPos.set(offsetX, baseY, baseZ);
        entry.targetRot.set(tiltX, 0, fan * -0.05);
      }
      this.startCardFlight(entry);
    });

    // 2. Opponent hand (top, facing down)
    for (let i = 0; i < opponentCount; i++) {
      const oppId = `opp_${i}`;
      activeIds.add(oppId);
      let entry = this.cardsMap.get(oppId);
      if (!entry) {
        const dummyCard: Card = { id: oppId, suit: "oros", rank: 1, points: 0 };
        const mesh = this.createCardMesh(dummyCard);
        mesh.position.set(0, 2, -2);
        this.scene.add(mesh);
        entry = {
          mesh,
          card: dummyCard,
          targetPos: new THREE.Vector3(),
          targetRot: new THREE.Euler(),
          isHovered: false,
          isPlayerHand: false,
        };
        this.cardsMap.set(oppId, entry);
      }

      // Rival hand flat, face down, in its own top zone.
      const spreadX = opponentCount === 2 ? 5.2 : 2.2;
      const offsetX = (i - (opponentCount - 1) / 2) * spreadX;
      entry.targetPos.set(offsetX, 0.03 + i * 0.004, -3.8);
      entry.targetRot.set(Math.PI, 0, 0);
      this.startCardFlight(entry);
    }

    // 3. Trump card (left, face up at 90 deg)
    if (trumpCard && deckCount >= 0) {
      activeIds.add(trumpCard.id);
      let entry = this.cardsMap.get(trumpCard.id);
      if (!entry) {
        const mesh = this.createCardMesh(trumpCard);
        this.scene.add(mesh);
        entry = {
          mesh,
          card: trumpCard,
          targetPos: new THREE.Vector3(),
          targetRot: new THREE.Euler(),
          isHovered: false,
          isPlayerHand: false,
        };
        this.cardsMap.set(trumpCard.id, entry);
      }
      // The trump is face up UNDER the deck: the stack covers its left side
      // and the right part (rank/face) peeks out, as in the real game.
      entry.targetPos.set(-4.0, 0.02, -0.5);
      entry.targetRot.set(0, Math.PI / 2, 0);
    }

    // 4. Deck block: a real 3D stack whose height follows the remaining cards.
    if (deckCount > 0) {
      const deckHeight = Math.max(0.03, deckCount * 0.018);
      const deckBottom = 0.034;
      if (!this.deckBlockMesh) {
        const backTex = getCardBackTexture();
        const pageTex = createDeckPageTexture();
        const topMat = new THREE.MeshStandardMaterial({
          map: backTex,
          roughness: 0.36,
          metalness: 0,
        });
        const sideMat = new THREE.MeshStandardMaterial({
          map: pageTex,
          roughness: 0.82,
          metalness: 0,
        });
        this.deckBlockMesh = new THREE.Mesh(
          new THREE.BoxGeometry(1.96, 1, 3.1),
          [sideMat, sideMat, topMat, topMat, sideMat, sideMat],
        );
        this.deckBlockMesh.castShadow = true;
        this.deckBlockMesh.receiveShadow = false;
        this.scene.add(this.deckBlockMesh);
      }
      this.deckBlockMesh.scale.y = deckHeight;
      this.deckBlockMesh.position.set(-4.7, deckBottom + deckHeight / 2, -0.5);
      this.deckBlockMesh.rotation.set(0, 0, 0.026);

      // A few slightly misaligned top cards so the pile looks shuffled.
      for (let i = 0; i < 3; i += 1) {
        const deckId = `deck_top_${i}`;
        activeIds.add(deckId);
        let entry = this.cardsMap.get(deckId);
        if (!entry) {
          const dummyCard: Card = {
            id: deckId,
            suit: "copas",
            rank: 1,
            points: 0,
          };
          const mesh = this.createCardMesh(dummyCard);
          mesh.position.set(0, 2, 0);
          this.scene.add(mesh);
          entry = {
            mesh,
            card: dummyCard,
            targetPos: new THREE.Vector3(),
            targetRot: new THREE.Euler(),
            isHovered: false,
            isPlayerHand: false,
          };
          this.cardsMap.set(deckId, entry);
        }
        entry.targetPos.set(
          -4.7 + (Math.random() - 0.5) * 0.035,
          deckBottom + deckHeight + 0.002 + i * 0.024,
          -0.5 + (Math.random() - 0.5) * 0.035,
        );
        entry.targetRot.set(Math.PI, 0, 0.03 + (Math.random() - 0.5) * 0.025);
      }
    } else if (this.deckBlockMesh) {
      this.scene.remove(this.deckBlockMesh);
      this.deckBlockMesh = null;
    }

    // 5. Current Trick (Center table)
    if (currentTrick.leadCard) {
      activeIds.add(currentTrick.leadCard.id);
      let entry = this.cardsMap.get(currentTrick.leadCard.id);
      if (!entry) {
        const mesh = this.createCardMesh(currentTrick.leadCard);
        this.scene.add(mesh);
        entry = {
          mesh,
          card: currentTrick.leadCard,
          targetPos: new THREE.Vector3(),
          targetRot: new THREE.Euler(),
          isHovered: false,
          isPlayerHand: false,
        };
        this.cardsMap.set(currentTrick.leadCard.id, entry);
      }
      // Trick cards lie flat and side by side in the centre zone.
      entry.targetPos.set(-0.35, 0.015, -0.5);
      entry.targetRot.set(0, 0, -0.03);
    }

    if (currentTrick.followCard) {
      activeIds.add(currentTrick.followCard.id);
      let entry = this.cardsMap.get(currentTrick.followCard.id);
      if (!entry) {
        const mesh = this.createCardMesh(currentTrick.followCard);
        this.scene.add(mesh);
        entry = {
          mesh,
          card: currentTrick.followCard,
          targetPos: new THREE.Vector3(),
          targetRot: new THREE.Euler(),
          isHovered: false,
          isPlayerHand: false,
        };
        this.cardsMap.set(currentTrick.followCard.id, entry);
      }
      entry.targetPos.set(0.35, 0.045, -0.55);
      entry.targetRot.set(0, 0, 0.03);
    }

    // Cleanup cards no longer in play
    for (const [id, entry] of this.cardsMap.entries()) {
      if (!activeIds.has(id)) {
        this.scene.remove(entry.mesh);
        this.cardsMap.delete(id);
      }
    }
  }

  private onPointerMove = (e: PointerEvent) => {
    const rect = this.container.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.mouse.set(
      Math.max(-1, Math.min(1, nx)),
      Math.max(-1, Math.min(1, ny)),
    );
    this.hoverMouse.set(nx, ny);

    this.raycaster.setFromCamera(this.hoverMouse, this.camera);
    const meshes = Array.from(this.cardsMap.values())
      .filter((c) => c.isPlayerHand)
      .map((c) => c.mesh);

    const intersects = this.raycaster.intersectObjects(meshes);

    let newlyHoveredId: string | null = null;
    for (const entry of this.cardsMap.values()) {
      if (entry.isPlayerHand) {
        const hit =
          intersects.length > 0 && intersects[0].object === entry.mesh;
        entry.isHovered = hit;
        if (hit) {
          newlyHoveredId = entry.card.id;
        }
      }
    }

    if (newlyHoveredId && newlyHoveredId !== this.hoveredCardId) {
      sounds.playCardHover();
    }
    this.hoveredCardId = newlyHoveredId;
    this.container.style.cursor = newlyHoveredId ? "pointer" : "default";
  };

  private onPointerDown = (e: PointerEvent) => {
    this.onPointerMove(e);

    const meshes = Array.from(this.cardsMap.values())
      .filter((c) => c.isPlayerHand)
      .map((c) => c.mesh);

    const intersects = this.raycaster.intersectObjects(meshes);
    if (intersects.length > 0) {
      const hitMesh = intersects[0].object;
      for (const entry of this.cardsMap.values()) {
        if (entry.mesh === hitMesh && this.onCardClick) {
          this.onCardClick(entry.card);
          break;
        }
      }
    }
  };

  private onResize = () => {
    if (this.isDestroyed) return;
    const width = this.container.clientWidth || window.innerWidth || 800;
    const height = this.container.clientHeight || window.innerHeight || 600;
    if (width < 2 || height < 2) return;
    this.updateCameraResponsive(width, height);
  };

  private animate = () => {
    if (this.isDestroyed) return;
    this.animFrameId = requestAnimationFrame(this.animate);

    // Parabolic flight for moving cards, gentle settle otherwise.
    const now = performance.now();
    for (const entry of this.cardsMap.values()) {
      if (entry.flight) {
        const t = Math.min(
          1,
          (now - entry.flight.startTime) / entry.flight.duration,
        );
        const ease = t * t * (3 - 2 * t);
        entry.mesh.position.x = THREE.MathUtils.lerp(
          entry.flight.start.x,
          entry.flight.target.x,
          ease,
        );
        entry.mesh.position.z = THREE.MathUtils.lerp(
          entry.flight.start.z,
          entry.flight.target.z,
          ease,
        );
        entry.mesh.position.y =
          THREE.MathUtils.lerp(
            entry.flight.start.y,
            entry.flight.target.y,
            ease,
          ) +
          Math.sin(Math.PI * t) * entry.flight.arc;
        if (t >= 1) entry.flight = undefined;
      } else {
        entry.mesh.position.lerp(entry.targetPos, 0.16);
      }
      entry.mesh.quaternion.slerp(
        new THREE.Quaternion().setFromEuler(entry.targetRot),
        0.16,
      );
    }

    // Camera tilt reacting to cursor + Screen Shake
    let camX = this.baseCameraPos.x + this.mouse.x * 0.3;
    let camZ = this.baseCameraPos.z + this.mouse.y * 0.2;

    if (this.screenShakeAmount > 0.001) {
      camX += (Math.random() - 0.5) * this.screenShakeAmount;
      camZ += (Math.random() - 0.5) * this.screenShakeAmount;
      this.screenShakeAmount *= 0.88;
    }

    this.camera.position.x = THREE.MathUtils.lerp(
      this.camera.position.x,
      camX,
      0.05,
    );
    this.camera.position.z = THREE.MathUtils.lerp(
      this.camera.position.z,
      camZ,
      0.05,
    );
    this.camera.lookAt(0, 0, 0.1);

    // Particles update
    if (this.particles) {
      const count = this.particlePositions.length / 3;
      let hasAlive = false;
      for (let i = 0; i < count; i++) {
        if (this.particlePositions[i * 3 + 1] > -10) {
          this.particlePositions[i * 3] +=
            this.particleVelocities[i * 3] * 0.016;
          this.particlePositions[i * 3 + 1] +=
            this.particleVelocities[i * 3 + 1] * 0.016;
          this.particlePositions[i * 3 + 2] +=
            this.particleVelocities[i * 3 + 2] * 0.016;
          this.particleVelocities[i * 3 + 1] -= 9.8 * 0.016; // gravity
          hasAlive = true;
        }
      }
      if (hasAlive) {
        this.particles.geometry.attributes.position.needsUpdate = true;
      }
    }

    // Pulse trump light gently
    if (this.trumpSpotlight) {
      this.trumpSpotlight.intensity = 3.2 + Math.sin(Date.now() * 0.003) * 0.5;
    }

    this.renderer.render(this.scene, this.camera);
  };

  public destroy() {
    this.isDestroyed = true;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    window.removeEventListener("resize", this.onResize);
    window.removeEventListener("orientationchange", this.onResize);
    window.visualViewport?.removeEventListener("resize", this.onResize);
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.container.removeEventListener("pointermove", this.onPointerMove);
    this.container.removeEventListener("pointerdown", this.onPointerDown);
    if (this.deckBlockMesh) {
      this.scene.remove(this.deckBlockMesh);
      this.deckBlockMesh = null;
    }
    this.renderer.dispose();
    if (this.container.contains(this.renderer.domElement)) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
