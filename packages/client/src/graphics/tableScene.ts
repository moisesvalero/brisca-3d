import * as THREE from "three";
import { Card } from "@brisca/core";
import { getCardTexture, getCardBackTexture } from "./cardTextures.js";
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
  private mouse = new THREE.Vector2(-1000, -1000);

  private cardsMap = new Map<string, InteractiveCard>();
  private particles: THREE.Points | null = null;
  private particlePositions: Float32Array = new Float32Array(0);
  private particleVelocities: Float32Array = new Float32Array(0);

  private trumpSpotlight: THREE.SpotLight | null = null;
  private screenShakeAmount = 0;
  private baseCameraPos = new THREE.Vector3(0, 13, 9.5);

  public onCardClick?: (card: Card) => void;

  constructor(container: HTMLElement) {
    this.container = container;

    // 1. Scene setup: Clean, bright, elegant casino room
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color("#0c1527");

    // 2. Camera setup with isometric angle
    const width = container.clientWidth || window.innerWidth || 800;
    const height = container.clientHeight || window.innerHeight || 600;
    const aspect = width / height;
    this.camera = new THREE.PerspectiveCamera(40, aspect, 0.1, 100);
    this.camera.position.copy(this.baseCameraPos);
    this.camera.lookAt(0, 0, 0.1);

    // 3. WebGL Renderer
    try {
      this.renderer = new THREE.WebGLRenderer({
        antialias: false,
        alpha: false,
        powerPreference: "default",
        failIfMajorPerformanceCaveat: false,
      });
    } catch {
      this.renderer = new THREE.WebGLRenderer({ antialias: false });
    }

    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));

    try {
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.BasicShadowMap;
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

  private setupLights() {
    // 1. Rich Hemisphere light for uniform, bright, natural illumination
    const hemiLight = new THREE.HemisphereLight("#ffffff", "#1e293b", 1.8);
    this.scene.add(hemiLight);

    // 2. Main Key Light: Warm, bright spotlight above the table
    const keyLight = new THREE.DirectionalLight("#fffbeb", 1.6);
    keyLight.position.set(4, 14, 6);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.bias = -0.0005;
    this.scene.add(keyLight);

    // 3. Fill Light: Cool fill light to illuminate all card faces evenly
    const fillLight = new THREE.DirectionalLight("#93c5fd", 0.85);
    fillLight.position.set(-4, 10, -4);
    this.scene.add(fillLight);

    // 4. Trump spotlight: Warm amber accent pool on the trump card
    this.trumpSpotlight = new THREE.SpotLight(
      "#f59e0b",
      3.0,
      14,
      Math.PI / 4,
      0.5,
    );
    this.trumpSpotlight.position.set(-4.3, 6, -0.6);
    this.trumpSpotlight.target.position.set(-4.3, 0, -0.6);
    this.scene.add(this.trumpSpotlight);
    this.scene.add(this.trumpSpotlight.target);
  }

  private setupTable() {
    // Vibrant casino emerald felt mat
    const feltGeo = new THREE.PlaneGeometry(16, 12, 32, 32);
    const feltMat = new THREE.MeshStandardMaterial({
      color: "#166534", // Rich casino green felt
      roughness: 0.6,
      metalness: 0.05,
    });
    const felt = new THREE.Mesh(feltGeo, feltMat);
    felt.rotation.x = -Math.PI / 2;
    felt.receiveShadow = true;
    this.scene.add(felt);

    // Golden decorative border line on the felt
    const lineGeo = new THREE.RingGeometry(4.2, 4.25, 48);
    const lineMat = new THREE.MeshBasicMaterial({
      color: "#f59e0b",
      side: THREE.DoubleSide,
    });
    const line = new THREE.Mesh(lineGeo, lineMat);
    line.rotation.x = -Math.PI / 2;
    line.position.y = 0.005;
    this.scene.add(line);

    // Table wooden border / rail (polished mahogany)
    const borderGeo = new THREE.BoxGeometry(17, 0.45, 13);
    const borderMat = new THREE.MeshStandardMaterial({
      color: "#2b1408",
      roughness: 0.35,
      metalness: 0.1,
    });
    const border = new THREE.Mesh(borderGeo, borderMat);
    border.position.y = -0.25;
    border.receiveShadow = true;
    this.scene.add(border);
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
    // Authentic Spanish deck card aspect ratio (208x319 -> 1:1.533)
    const cardWidth = 1.95;
    const cardHeight = 3.0;
    const cardThick = 0.03;

    const geo = new THREE.BoxGeometry(cardWidth, cardThick, cardHeight);
    const frontTex = getCardTexture(card);
    const backTex = getCardBackTexture();

    const edgeMat = new THREE.MeshStandardMaterial({
      color: "#f8fafc",
      roughness: 0.4,
    });
    const frontMat = new THREE.MeshStandardMaterial({
      map: frontTex,
      roughness: 0.25,
      metalness: 0.02,
      transparent: true,
      alphaTest: 0.5,
    });
    const backMat = new THREE.MeshStandardMaterial({
      map: backTex,
      roughness: 0.3,
      metalness: 0.02,
      transparent: true,
      alphaTest: 0.5,
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
    trumpCard: Card,
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
      const spreadX = 2.3;
      const offsetX = (idx - (count - 1) / 2) * spreadX;

      const baseZ = 2.4;
      const baseY = 0.12 + idx * 0.02;

      if (entry.isHovered && isMyTurn) {
        entry.targetPos.set(offsetX, baseY + 0.55, baseZ - 0.4);
        entry.targetRot.set(-0.25, 0, (idx - (count - 1) / 2) * -0.04);
      } else {
        entry.targetPos.set(offsetX, baseY, baseZ);
        entry.targetRot.set(-0.15, 0, (idx - (count - 1) / 2) * -0.06);
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

      const spreadX = 2.3;
      const offsetX = (i - (opponentCount - 1) / 2) * spreadX;
      entry.targetPos.set(offsetX, 0.12 + i * 0.02, -3.8);
      // Face down
      entry.targetRot.set(Math.PI, 0, 0);
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
      entry.targetPos.set(-4.3, 0.06, -0.6);
      entry.targetRot.set(0, Math.PI / 2, 0);
    }

    // 4. Deck stack (on top of trump card)
    if (deckCount > 0) {
      const deckId = "deck_stack";
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
      entry.targetPos.set(-4.3, 0.2 + deckCount * 0.015, -0.6);
      entry.targetRot.set(Math.PI, 0, 0.05);
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
      entry.targetPos.set(-1.1, 0.08, -0.6);
      entry.targetRot.set(0, 0, -0.06);
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
      entry.targetPos.set(1.1, 0.1, -0.6);
      entry.targetRot.set(0, 0, 0.06);
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
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const meshes = Array.from(this.cardsMap.values())
      .filter((c) => c.isPlayerHand)
      .map((c) => c.mesh);

    const intersects = this.raycaster.intersectObjects(meshes);

    for (const entry of this.cardsMap.values()) {
      if (entry.isPlayerHand) {
        const hit =
          intersects.length > 0 && intersects[0].object === entry.mesh;
        entry.isHovered = hit;
      }
    }
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
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  private animate = () => {
    requestAnimationFrame(this.animate);

    // Smooth lerp card positions and rotations
    for (const entry of this.cardsMap.values()) {
      entry.mesh.position.lerp(entry.targetPos, 0.15);
      entry.mesh.quaternion.slerp(
        new THREE.Quaternion().setFromEuler(entry.targetRot),
        0.15,
      );
    }

    // Camera tilt reacting to cursor + Screen Shake
    let camX = this.baseCameraPos.x + this.mouse.x * 0.4;
    let camZ = this.baseCameraPos.z + this.mouse.y * 0.3;

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
      this.trumpSpotlight.intensity = 3.0 + Math.sin(Date.now() * 0.003) * 0.6;
    }

    this.renderer.render(this.scene, this.camera);
  };

  public destroy() {
    window.removeEventListener("resize", this.onResize);
    this.container.removeEventListener("pointermove", this.onPointerMove);
    this.container.removeEventListener("pointerdown", this.onPointerDown);
    this.renderer.dispose();
    if (this.container.contains(this.renderer.domElement)) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
