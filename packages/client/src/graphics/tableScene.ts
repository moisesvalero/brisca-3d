import * as THREE from "three";
import { Card } from "@brisca/core";
import { getCardTexture, getCardBackTexture } from "./cardTextures.js";
import { createFeltTexture } from "./tableTextures.js";
import { sounds } from "../audio/soundManager.js";

export interface InteractiveCard {
  mesh: THREE.Mesh;
  card: Card;
  targetPos: THREE.Vector3;
  targetRot: THREE.Euler;
  isHovered: boolean;
  isPlayerHand: boolean;
}

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

    // 5. Events
    window.addEventListener("resize", this.onResize);
    this.container.addEventListener("pointermove", this.onPointerMove);
    this.container.addEventListener("pointerdown", this.onPointerDown);

    // 6. Start Loop
    this.animate();
  }

  private updateCameraResponsive(width: number, height: number) {
    const aspect = width / Math.max(1, height);

    // Calculate required vertical FOV so that horizontal width [-5.5, +4.5] always fits
    const baseFovY = 40;
    const baseTan = Math.tan((baseFovY * Math.PI) / 360);

    if (aspect < 1.5) {
      const targetTan = baseTan * (1.5 / Math.max(0.48, aspect));
      const neededFov = (2 * Math.atan(targetTan) * 180) / Math.PI;
      this.camera.fov = Math.min(neededFov, 62);

      // On narrow mobile screens, smoothly pull back camera height & distance
      const mobileFactor = Math.max(0, 0.95 - aspect);
      const camY = 13 + mobileFactor * 6.5;
      const camZ = 9.5 + mobileFactor * 4.8;
      this.baseCameraPos.set(0, camY, camZ);
    } else {
      this.camera.fov = 40;
      this.baseCameraPos.set(0, 13, 9.5);
    }

    this.camera.aspect = aspect;
    this.camera.position.copy(this.baseCameraPos);
    this.camera.lookAt(0, 0, 0.1);
    this.camera.updateProjectionMatrix();
    if (this.renderer) {
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
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 30;
    keyLight.shadow.camera.left = -10;
    keyLight.shadow.camera.right = 10;
    keyLight.shadow.camera.top = 10;
    keyLight.shadow.camera.bottom = -10;
    keyLight.shadow.bias = -0.0005;
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
    // 1. Deep room floor plane so there is never an empty void
    const floorGeo = new THREE.PlaneGeometry(80, 80);
    const floorMat = new THREE.MeshStandardMaterial({
      color: "#0a0705",
      roughness: 0.95,
      metalness: 0.05,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.5;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // 2. Expansive casino emerald felt mat
    const feltGeo = new THREE.PlaneGeometry(50, 36, 32, 32);
    const feltMat = new THREE.MeshStandardMaterial({
      map: createFeltTexture(),
      color: "#ffffff",
      roughness: 0.84,
      metalness: 0.02,
    });
    const felt = new THREE.Mesh(feltGeo, feltMat);
    felt.rotation.x = -Math.PI / 2;
    felt.receiveShadow = true;
    this.scene.add(felt);

    // 3. Double antique-gold ring with a cream inlay and brass studs
    const goldMat = new THREE.MeshStandardMaterial({
      color: "#c9963f",
      metalness: 0.35,
      roughness: 0.42,
      emissive: "#3a2308",
      emissiveIntensity: 0.4,
      side: THREE.DoubleSide,
    });
    const goldBand = new THREE.Mesh(
      new THREE.RingGeometry(4.56, 4.72, 128),
      goldMat,
    );
    goldBand.rotation.x = -Math.PI / 2;
    goldBand.position.y = 0.006;
    this.scene.add(goldBand);

    const creamMat = new THREE.MeshBasicMaterial({
      color: "#ead7a8",
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
    });
    const creamLine = new THREE.Mesh(
      new THREE.RingGeometry(4.34, 4.37, 128),
      creamMat,
    );
    creamLine.rotation.x = -Math.PI / 2;
    creamLine.position.y = 0.007;
    this.scene.add(creamLine);

    const outerMat = new THREE.MeshBasicMaterial({
      color: "#8a6424",
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide,
    });
    const outerLine = new THREE.Mesh(
      new THREE.RingGeometry(4.95, 4.97, 128),
      outerMat,
    );
    outerLine.rotation.x = -Math.PI / 2;
    outerLine.position.y = 0.0065;
    this.scene.add(outerLine);

    const studGeo = new THREE.SphereGeometry(0.045, 10, 10);
    const studMat = new THREE.MeshStandardMaterial({
      color: "#e0b96b",
      metalness: 0.5,
      roughness: 0.32,
      emissive: "#4a2c08",
      emissiveIntensity: 0.3,
    });
    for (let i = 0; i < 8; i += 1) {
      const angle = (i / 8) * Math.PI * 2;
      const stud = new THREE.Mesh(studGeo, studMat);
      stud.position.set(Math.cos(angle) * 4.64, 0.026, Math.sin(angle) * 4.64);
      this.scene.add(stud);
    }

    // 3b. Low mahogany rail with a brass inlay around the play area
    const railMat = new THREE.MeshStandardMaterial({
      color: "#2a150b",
      roughness: 0.42,
      metalness: 0.08,
    });
    const inlayMat = new THREE.MeshStandardMaterial({
      color: "#b8863a",
      metalness: 0.45,
      roughness: 0.35,
      emissive: "#2a1806",
      emissiveIntensity: 0.25,
    });
    const railHeight = 0.18;
    const railWidth = 0.24;
    const railY = 0.09;
    const railDefs = [
      { w: 16.3, d: railWidth, x: 0, z: -5.25 },
      { w: 16.3, d: railWidth, x: 0, z: 5.25 },
      { w: railWidth, d: 10.5, x: -7.85, z: 0 },
      { w: railWidth, d: 10.5, x: 7.85, z: 0 },
    ];
    for (const def of railDefs) {
      const rail = new THREE.Mesh(
        new THREE.BoxGeometry(def.w, railHeight, def.d),
        railMat,
      );
      rail.position.set(def.x, railY, def.z);
      rail.castShadow = true;
      rail.receiveShadow = true;
      this.scene.add(rail);

      const inlay = new THREE.Mesh(
        new THREE.BoxGeometry(def.w + 0.006, 0.015, def.d + 0.006),
        inlayMat,
      );
      inlay.position.set(def.x, railY + railHeight / 2 + 0.008, def.z);
      this.scene.add(inlay);
    }

    // 4. Table wooden border / rail (polished mahogany)
    const borderGeo = new THREE.BoxGeometry(52, 0.45, 38);
    const borderMat = new THREE.MeshStandardMaterial({
      color: "#241108",
      roughness: 0.35,
      metalness: 0.08,
    });
    const border = new THREE.Mesh(borderGeo, borderMat);
    border.position.y = -0.25;
    border.receiveShadow = true;
    this.scene.add(border);

    // 5. Outer padded armrest rim (dark leather)
    const armrestGeo = new THREE.BoxGeometry(53, 0.55, 39);
    const armrestMat = new THREE.MeshStandardMaterial({
      color: "#140a05",
      roughness: 0.55,
      metalness: 0.02,
    });
    const armrest = new THREE.Mesh(armrestGeo, armrestMat);
    armrest.position.y = -0.32;
    this.scene.add(armrest);
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
    // Fournier 1878 deck: real 60x94 mm (1:1.567)
    const cardWidth = 1.96;
    const cardHeight = 3.1;
    const cardThick = 0.024;

    const geo = new THREE.BoxGeometry(cardWidth, cardThick, cardHeight);
    const frontTex = getCardTexture(card);
    const backTex = getCardBackTexture();

    const edgeMat = new THREE.MeshStandardMaterial({
      color: "#c9c4b8",
      roughness: 0.45,
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

    // Box materials order: [right, left, top(front), bottom(back), front_edge, back_edge]
    const materials = [edgeMat, edgeMat, frontMat, backMat, edgeMat, edgeMat];
    const mesh = new THREE.Mesh(geo, materials);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
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
      // Held hand: the cards stand up in a fan at the bottom edge, facing the
      // camera. The table groups (trick, deck, trump, rival) stay flat.
      const spreadX = count === 2 ? 3.4 : 3.0;
      const offsetX = (idx - (count - 1) / 2) * spreadX;
      const fan = idx - (count - 1) / 2;
      const baseZ = 4.9 + (count === 3 && idx === 1 ? 0.08 : 0);
      const baseY = 1.5 + (count === 3 && idx === 1 ? 0.1 : 0);
      const tilt = THREE.MathUtils.degToRad(66);
      const yaw = fan * -0.1;
      const roll = fan * -0.07;

      if (entry.isHovered && isMyTurn) {
        entry.targetPos.set(offsetX, baseY + 0.35, baseZ + 0.25);
        entry.targetRot.set(THREE.MathUtils.degToRad(50), yaw, roll);
      } else {
        entry.targetPos.set(offsetX, baseY, baseZ);
        entry.targetRot.set(tilt, yaw, roll);
      }
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

      // Rival hand: a held fan of backs at the far edge, mirroring the player.
      const spreadX = opponentCount === 2 ? 3.4 : 3.0;
      const offsetX = (i - (opponentCount - 1) / 2) * spreadX;
      const fan = i - (opponentCount - 1) / 2;
      entry.targetPos.set(
        offsetX,
        1.35 + (opponentCount === 3 && i === 1 ? 0.1 : 0),
        -3.6,
      );
      // Face down + tilt back, so the back faces the camera.
      entry.targetRot.set(
        Math.PI + THREE.MathUtils.degToRad(66),
        fan * 0.1,
        fan * 0.07,
      );
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

    // 4. Deck stack (three cards on top of the face-up trump)
    if (deckCount > 0) {
      for (let layer = 0; layer < 3; layer += 1) {
        const deckId = layer === 0 ? "deck_stack" : `deck_stack_${layer}`;
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
          -4.7 + layer * 0.025,
          0.046 + layer * 0.026 + Math.min(deckCount, 30) * 0.0003,
          -0.5 + layer * 0.02,
        );
        entry.targetRot.set(Math.PI, 0, 0.04 + layer * 0.012);
      }
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
    const width = this.container.clientWidth || window.innerWidth || 800;
    const height = this.container.clientHeight || window.innerHeight || 600;
    this.updateCameraResponsive(width, height);
  };

  private animate = () => {
    if (this.isDestroyed) return;
    this.animFrameId = requestAnimationFrame(this.animate);

    // Smooth lerp card positions and rotations
    for (const entry of this.cardsMap.values()) {
      entry.mesh.position.lerp(entry.targetPos, 0.16);
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
    this.container.removeEventListener("pointermove", this.onPointerMove);
    this.container.removeEventListener("pointerdown", this.onPointerDown);
    this.renderer.dispose();
    if (this.container.contains(this.renderer.domElement)) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
