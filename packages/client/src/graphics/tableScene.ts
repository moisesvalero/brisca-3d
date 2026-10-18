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

// ---------------------------------------------------------------------------
// Card and table constants
// ---------------------------------------------------------------------------
// The card geometry is already built flat in the XZ plane (its top face points
// towards +Y), so an identity rotation is the equivalent of lying it on the
// table with rotation.x = -Math.PI / 2. Hand/deck rotations must therefore be
// yaw only, and all height separation must come from an explicit Y stack.
const CARD_WIDTH = 1.96;
const CARD_HEIGHT = 3.1;
const CARD_THICKNESS = 0.024;
const CARD_RADIUS = 0.12;
const CARD_HALF_THICKNESS = CARD_THICKNESS / 2;

const TABLE_TOP_Y = 0.002; // Felt surface.
const CARD_GROUND_CLEARANCE = 0.001;
const HAND_STACK_STEP = CARD_THICKNESS + 0.004;
const HAND_BASE_Y = TABLE_TOP_Y + CARD_GROUND_CLEARANCE + CARD_HALF_THICKNESS;
const HAND_BASE_Z = 3.4;
const HAND_SPREAD_X = 1.9;
const HAND_FAN_YAW = 0.13;
const HAND_HOVER_LIFT_Y = 0.34;
const OPPONENT_BASE_Z = -6.0;
const OPPONENT_FAN_YAW = 0.1;

const DECK_X = -4.7;
const DECK_Z = -0.5;
// The trump rests flat on the felt and the block starts right above its top.
const TRUMP_CARD_Y = TABLE_TOP_Y + CARD_HALF_THICKNESS;
const DECK_BASE_Y = TABLE_TOP_Y + CARD_THICKNESS + 0.002;
const DECK_TOP_STACK_GAP = 0.002;
const DECK_TOP_STACK_STEP = CARD_THICKNESS + DECK_TOP_STACK_GAP;
const DECK_YAW = 0.026;
const DECK_TOP_JITTER = 0.022;
const DECK_TOP_YAW_JITTER = 0.02;

function deckHeightFor(deckCount: number): number {
  return Math.max(0.03, deckCount * 0.018);
}

export interface InteractiveCard {
  mesh: THREE.Mesh;
  card: Card;
  targetPos: THREE.Vector3;
  targetRot: THREE.Euler;
  isHovered: boolean;
  isPlayerHand: boolean;
  pendingFlip?: boolean;
  isTrick?: boolean;
  collecting?: {
    start: THREE.Vector3;
    target: THREE.Vector3;
    startTime: number;
    duration: number;
  };
  flip?: {
    to: THREE.Quaternion;
    startTime: number;
    duration: number;
  };
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
    // Outward winding for the rounded edge. The previous order pointed these
    // quads inwards: the near faces were culled and the inside of the far
    // faces rendered as two sharp fins sticking out of the deck block.
    indices.push(base, base + 2, base + 1, base, base + 3, base + 2);
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

const CARD_GEOMETRY = createRoundedCardGeometry(
  CARD_WIDTH,
  CARD_HEIGHT,
  CARD_THICKNESS,
  CARD_RADIUS,
);

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
  private zoom = 1.3;
  private targetZoom = 1.3;
  private lastFrameTime = 0;
  private localPlayerId = "";
  private trickWinner = "";
  private resizeObserver: ResizeObserver | null = null;
  private deckBlockMesh: THREE.Mesh | null = null;
  private currentHand: Card[] = [];
  private handIsPlayable = false;

  public onCardClick?: (card: Card) => void;

  public zoomBy(delta: number) {
    // The current framing is the minimum. The control can only get closer.
    this.targetZoom = THREE.MathUtils.clamp(this.targetZoom + delta, 1.3, 1.65);
  }

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
    const fitHalfWidth = 8.2;
    const fitHalfDepth = 10.8;
    const distanceForWidth = fitHalfWidth / Math.tan(hfov / 2);
    const distanceForDepth = fitHalfDepth / Math.tan(vfov / 2);
    const distance = Math.max(baseDistance, distanceForWidth, distanceForDepth);

    this.baseCameraPos
      .copy(basePos)
      .sub(target)
      .multiplyScalar(distance / baseDistance / this.zoom)
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
      new THREE.BoxGeometry(24, 0.6, 20),
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
    const felt = new THREE.Mesh(new THREE.PlaneGeometry(16, 16), feltMat);
    felt.rotation.x = -Math.PI / 2;
    felt.position.y = TABLE_TOP_Y;
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
    mesh.rotation.order = "YXZ";
    mesh.castShadow = true;
    mesh.receiveShadow = false;
    return mesh;
  }

  private deckSpawnPosition(deckCount: number): THREE.Vector3 {
    // Only the spawn point floats above the pile. Resting heights are computed
    // from DECK_BASE_Y so the deck stays aligned with the trump underneath.
    return new THREE.Vector3(
      DECK_X,
      DECK_BASE_Y + deckHeightFor(deckCount) + CARD_HALF_THICKNESS + 0.14,
      DECK_Z,
    );
  }

  /**
   * Lays the player's cards flat on the table.
   *
   * The old fan mixed yaw with roll (`rotation.z`) and a variable base Y, so
   * the borders of adjacent cards crossed each other. Now the only rotation is
   * yaw around the vertical axis, and every card owns a different Y plane:
   * card N always sits above card N-1, which removes mesh clipping entirely.
   */
  private layoutHand() {
    const count = this.currentHand.length;
    const spreadX = count > 3 ? 1.85 : HAND_SPREAD_X;

    this.currentHand.forEach((card, index) => {
      const entry = this.cardsMap.get(card.id);
      if (!entry) return;

      const fan = index - (count - 1) / 2;
      const hovered = entry.isHovered && this.handIsPlayable;
      const stackY = HAND_BASE_Y + index * HAND_STACK_STEP;

      entry.targetPos.set(
        fan * spreadX,
        stackY + (hovered ? HAND_HOVER_LIFT_Y : 0),
        HAND_BASE_Z - (hovered ? 0.2 : 0),
      );
      entry.targetRot.set(0, fan * HAND_FAN_YAW * (hovered ? 0.5 : 1), 0);
    });
  }

  private startCardFlight(entry: InteractiveCard) {
    // Never restart the same flight on every authoritative update: that was
    // the visible stutter/jumping. Only a new destination starts a new curve.
    if (
      entry.flight &&
      entry.flight.target.distanceTo(entry.targetPos) < 0.03
    ) {
      return;
    }
    if (entry.mesh.position.distanceTo(entry.targetPos) < 0.2) return;
    entry.flight = {
      start: entry.mesh.position.clone(),
      target: entry.targetPos.clone(),
      startTime: performance.now(),
      duration: 380,
      arc: 0.12,
    };
  }

  public updateGameState(
    myHand: Card[],
    opponentCount: number,
    trumpCard: Card | null,
    deckCount: number,
    currentTrick: { leadCard?: Card; followCard?: Card; winner?: string },
    isMyTurn: boolean,
    myPlayerId = "",
  ) {
    const activeIds = new Set<string>();
    this.localPlayerId = myPlayerId;
    if (currentTrick.winner) this.trickWinner = currentTrick.winner;

    // 1. My hand (bottom)
    myHand.forEach((card) => {
      activeIds.add(card.id);
      let entry = this.cardsMap.get(card.id);
      if (!entry) {
        const mesh = this.createCardMesh(card);
        mesh.position.copy(this.deckSpawnPosition(deckCount));
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
    });

    this.currentHand = [...myHand];
    this.handIsPlayable = isMyTurn;
    this.layoutHand();

    // 2. Opponent hand (top, facing down)
    for (let i = 0; i < opponentCount; i++) {
      const oppId = `opp_${i}`;
      activeIds.add(oppId);
      let entry = this.cardsMap.get(oppId);
      if (!entry) {
        const dummyCard: Card = { id: oppId, suit: "oros", rank: 1, points: 0 };
        const mesh = this.createCardMesh(dummyCard);
        mesh.position.copy(this.deckSpawnPosition(deckCount));
        mesh.rotation.set(Math.PI, 0, 0);
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

      // Mirror of the player's hand: flat cards, strict Y stack, yaw only.
      const spreadX = opponentCount > 3 ? 1.85 : HAND_SPREAD_X;
      const fan = i - (opponentCount - 1) / 2;
      entry.targetPos.set(
        fan * spreadX,
        HAND_BASE_Y + i * HAND_STACK_STEP,
        OPPONENT_BASE_Z,
      );
      entry.targetRot.set(Math.PI, fan * OPPONENT_FAN_YAW, 0);
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
      entry.targetPos.set(-4.0, TRUMP_CARD_Y, DECK_Z);
      entry.targetRot.set(0, Math.PI / 2, 0);
    }

    // 4. Deck block: a real 3D stack whose height follows the remaining cards.
    if (deckCount > 0) {
      const deckHeight = deckHeightFor(deckCount);
      const deckTopY = DECK_BASE_Y + deckHeight;
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
        // Use the exact rounded card silhouette for the whole stack, so
        // every visible layer has the same 0.12 corner radius as the cards.
        this.deckBlockMesh = new THREE.Mesh(CARD_GEOMETRY.clone(), [
          topMat,
          topMat,
          sideMat,
        ]);
        this.deckBlockMesh.castShadow = true;
        this.deckBlockMesh.receiveShadow = false;
        this.scene.add(this.deckBlockMesh);
      }
      // CARD_GEOMETRY is CARD_THICKNESS thick; stretch only that axis.
      this.deckBlockMesh.scale.set(1, deckHeight / CARD_THICKNESS, 1);
      this.deckBlockMesh.position.set(
        DECK_X,
        DECK_BASE_Y + deckHeight / 2,
        DECK_Z,
      );
      // A tiny yaw keeps the pile natural without tilting it off the table.
      this.deckBlockMesh.rotation.set(0, DECK_YAW, 0);

      // A few slightly misaligned top cards so the pile looks shuffled.
      // Strict Y steps prevent contact, and the deterministic yaw jitter
      // stops the pile from twitching on every server update.
      const topCardBaseY = deckTopY + CARD_HALF_THICKNESS + DECK_TOP_STACK_GAP;
      for (let i = 0; i < 5; i += 1) {
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
          mesh.position.copy(this.deckSpawnPosition(deckCount));
          mesh.rotation.set(Math.PI, DECK_YAW, 0);
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
        const jitterX = Math.sin(i * 2.399) * DECK_TOP_JITTER;
        const jitterZ = Math.cos(i * 1.731) * DECK_TOP_JITTER;
        const cosYaw = Math.cos(DECK_YAW);
        const sinYaw = Math.sin(DECK_YAW);
        entry.targetPos.set(
          DECK_X + jitterX * cosYaw + jitterZ * sinYaw,
          topCardBaseY + i * DECK_TOP_STACK_STEP,
          DECK_Z - jitterX * sinYaw + jitterZ * cosYaw,
        );
        entry.targetRot.set(
          Math.PI,
          DECK_YAW + Math.sin(i * 1.117) * DECK_TOP_YAW_JITTER,
          0,
        );
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
        mesh.position.set(0, 0.03, -6.0);
        mesh.rotation.set(Math.PI, 0, 0);
        entry = {
          mesh,
          card: currentTrick.leadCard,
          targetPos: new THREE.Vector3(),
          targetRot: new THREE.Euler(),
          isHovered: false,
          isPlayerHand: false,
          pendingFlip: true,
        };
        this.cardsMap.set(currentTrick.leadCard.id, entry);
        this.scene.add(mesh);
      }
      entry.isPlayerHand = false;
      entry.isTrick = true;
      entry.targetPos.set(-1.05, 0.09, -2.4);
      entry.targetRot.set(0, 0, -0.03);
      this.startCardFlight(entry);
    }

    if (currentTrick.followCard) {
      activeIds.add(currentTrick.followCard.id);
      let entry = this.cardsMap.get(currentTrick.followCard.id);
      if (!entry) {
        const mesh = this.createCardMesh(currentTrick.followCard);
        mesh.position.set(0, 0.03, -6.0);
        mesh.rotation.set(Math.PI, 0, 0);
        entry = {
          mesh,
          card: currentTrick.followCard,
          targetPos: new THREE.Vector3(),
          targetRot: new THREE.Euler(),
          isHovered: false,
          isPlayerHand: false,
          pendingFlip: true,
        };
        this.cardsMap.set(currentTrick.followCard.id, entry);
        this.scene.add(mesh);
      }
      entry.isPlayerHand = false;
      entry.isTrick = true;
      entry.targetPos.set(1.05, 0.115, -2.45);
      entry.targetRot.set(0, 0, 0.03);
      this.startCardFlight(entry);
    }

    // Cleanup cards no longer in play. Trick cards are collected toward the
    // winner instead of vanishing from one frame to the next.
    for (const [id, entry] of this.cardsMap.entries()) {
      if (activeIds.has(id)) continue;
      if (entry.collecting) continue;
      if (entry.isTrick) {
        entry.isTrick = false;
        const localWon = this.trickWinner === this.localPlayerId;
        entry.collecting = {
          start: entry.mesh.position.clone(),
          target: new THREE.Vector3(5.2, 0.07, localWon ? 3.2 : -6.0),
          startTime: performance.now(),
          duration: 380,
        };
        continue;
      }
      this.scene.remove(entry.mesh);
      this.cardsMap.delete(id);
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

    if (newlyHoveredId !== this.hoveredCardId) {
      if (newlyHoveredId) sounds.playCardHover();
      this.hoveredCardId = newlyHoveredId;
      // Hover only changes the target layout; re-apply it so the lifted card
      // rises on the pointer event instead of waiting for the next move.
      this.layoutHand();
    }
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

    const now = performance.now();
    const dt = this.lastFrameTime
      ? Math.min(0.05, (now - this.lastFrameTime) / 1000)
      : 1 / 60;
    this.lastFrameTime = now;
    const handBlend = 1 - Math.exp(-4.5 * dt);
    const zoomBlend = 1 - Math.exp(-9 * dt);

    if (Math.abs(this.zoom - this.targetZoom) > 0.0005) {
      this.zoom += (this.targetZoom - this.zoom) * zoomBlend;
      if (Math.abs(this.zoom - this.targetZoom) < 0.001) {
        this.zoom = this.targetZoom;
      }
      this.updateCameraResponsive(
        this.container.clientWidth || window.innerWidth || 800,
        this.container.clientHeight || window.innerHeight || 600,
      );
    }

    // Parabolic flight for moving cards, gentle settle otherwise.
    for (const [id, entry] of this.cardsMap.entries()) {
      if (entry.collecting) {
        const ct = Math.min(
          1,
          (now - entry.collecting.startTime) / entry.collecting.duration,
        );
        const ce = ct * ct * (3 - 2 * ct);
        entry.mesh.position.lerpVectors(
          entry.collecting.start,
          entry.collecting.target,
          ce,
        );
        entry.mesh.rotation.z = 0.04;
        entry.mesh.scale.setScalar(1 - ce * 0.92);
        if (ct >= 1) {
          this.scene.remove(entry.mesh);
          this.cardsMap.delete(id);
        }
        continue;
      }
      if (entry.flight) {
        // Follow the current hand slot so the card never snaps when the
        // hand re-spaces while it is still being drawn.
        entry.flight.target.copy(entry.targetPos);
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
        entry.mesh.position.lerp(entry.targetPos, handBlend);
      }
      const targetQuat = new THREE.Quaternion().setFromEuler(entry.targetRot);
      if (entry.pendingFlip && !entry.flight) {
        entry.flip = {
          to: targetQuat,
          startTime: now,
          duration: 300,
        };
        entry.pendingFlip = false;
      }
      if (entry.flight && entry.pendingFlip) {
        // Keep the rival card face down while it travels to the trick.
      } else if (entry.flip) {
        const ft = Math.min(
          1,
          (now - entry.flip.startTime) / entry.flip.duration,
        );
        if (ft < 0.5) {
          entry.mesh.scale.x = Math.max(0.02, 1 - ft * 2);
        } else {
          entry.mesh.quaternion.copy(entry.flip.to);
          entry.mesh.scale.x = Math.max(0.02, (ft - 0.5) * 2);
        }
        if (ft >= 1) {
          entry.mesh.scale.x = 1;
          entry.mesh.quaternion.copy(entry.flip.to);
          entry.flip = undefined;
        }
      } else {
        entry.mesh.quaternion.slerp(targetQuat, handBlend);
        entry.mesh.scale.x = 1;
      }
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
