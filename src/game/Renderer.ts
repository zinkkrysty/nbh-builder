import * as THREE from 'three';
import { AssetGenerator } from './AssetGenerator';
import { Simulation, TileState } from './Simulation';
import { TrafficManager } from './TrafficManager';
import { CitizenManager } from './CitizenManager';
import { ROAD_LAYOUT, StreetscapeSettings, currentStreetscapeSettings } from './RoadLayout';
import { EnvironmentScenery } from './EnvironmentScenery';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

// Keep scene/output buffers sharp; only the soft glow is sampled more cheaply.
// Override setSize so EffectComposer also preserves this ratio after resizing.
class QuarterResolutionBloomPass extends UnrealBloomPass {
  override setSize(width: number, height: number) {
    super.setSize(Math.max(1, Math.round(width / 2)), Math.max(1, Math.round(height / 2)));
  }
}

interface StaticTreeData {
  gridX: number;
  gridZ: number;
  x: number;
  z: number;
  scale: number;
  rotationY: number;
  isBlossom: boolean;
  leafBase: number;
  trunkIndex: number;
  leafStartIndex: number;
  isHidden: boolean;
}

interface AtmosphereProfile {
  skyColor: number;
  fogColor: number;
  fogDensity: number;
  skyFillColor: number;
  groundFillColor: number;
  fillIntensity: number;
  sunColor: number;
  sunIntensity: number;
}

// These are deliberately small, global lighting controls rather than extra
// scene lights. The directional key gives the town its form; the hemisphere
// fill keeps shade readable; fog separates the near town from the distance.
const DAY_ATMOSPHERE: AtmosphereProfile = {
  skyColor: 0xb9dcf4,
  fogColor: 0xc5d9e2,
  fogDensity: 0.0045,
  skyFillColor: 0xb8d7ef,
  groundFillColor: 0x5d6b5d,
  fillIntensity: 0.76,
  sunColor: 0xfff5df,
  sunIntensity: 1.35,
};

const GOLDEN_HOUR_ATMOSPHERE: AtmosphereProfile = {
  skyColor: 0xe8a477,
  fogColor: 0xd7a590,
  fogDensity: 0.0055,
  skyFillColor: 0xe5afa4,
  groundFillColor: 0x66534a,
  fillIntensity: 0.58,
  sunColor: 0xf6a35d,
  sunIntensity: 1.05,
};

const DAWN_ATMOSPHERE: AtmosphereProfile = {
  skyColor: 0xe4b9a1,
  fogColor: 0xd3b4a8,
  fogDensity: 0.0054,
  skyFillColor: 0xd9b9c6,
  groundFillColor: 0x625960,
  fillIntensity: 0.58,
  sunColor: 0xffd99e,
  sunIntensity: 1.05,
};

const NIGHT_ATMOSPHERE: AtmosphereProfile = {
  // Night needs to stay blue and legible at the gameplay camera. The sun is
  // absent, so this moonlit sky fill carries the low-poly forms without
  // needing any local lights or a second shadow-casting key.
  skyColor: 0x1d2f4d,
  fogColor: 0x3c5878,
  fogDensity: 0.0048,
  skyFillColor: 0x5f8cbd,
  groundFillColor: 0x344b66,
  fillIntensity: 0.78,
  sunColor: 0x0b1020,
  sunIntensity: 0,
};

export class Renderer {
  container: HTMLElement;
  scene!: THREE.Scene;
  camera!: THREE.OrthographicCamera;
  renderer!: THREE.WebGLRenderer;
  composer!: EffectComposer;
  assets: AssetGenerator;
  sim?: Simulation;

  // Lights
  dirLight!: THREE.DirectionalLight;
  skyFillLight!: THREE.HemisphereLight;
  currentSunOffset = new THREE.Vector3(30, 40, 15);
  renderTimeOfDay = 8.0;
  private atmosphereSkyColor = new THREE.Color();
  private atmosphereFogColor = new THREE.Color();
  private atmosphereSkyFillColor = new THREE.Color();
  private atmosphereGroundFillColor = new THREE.Color();
  private atmosphereSunColor = new THREE.Color();
  private atmosphereBlendTarget = new THREE.Color();

  // Simulation tick interpolation tracking
  lastTickTime = 0;
  tickDuration = 2000;
  lastTickTimeOfDay = 8.0;
  targetTickTimeOfDay = 8.0;
  isInterpolating = false;

  // Shadow Settings State
  shadowSettings = {
    castShadows: true,
    shadowMapType: THREE.PCFSoftShadowMap as THREE.ShadowMapType,
    shadowMapSize: 1024,
    bias: 0.0004,
    normalBias: 0.1,
    frustumSize: 10,
    near: 0.5,
    far: 130,
    autoFitFrustum: true,
    overrideSun: false,
    sunAzimuth: 45,
    sunElevation: 50,
    sunColor: '#fffaf0',
    sunIntensity: 1.2,
    ambientColor: '#c5def5',
    ambientIntensity: 0.6,
  };

  // Optimizations
  groundMesh!: THREE.InstancedMesh;
  // Scattered Forest Trees
  treesData: StaticTreeData[] = [];
  trunkMesh?: THREE.InstancedMesh;
  greenLeavesMesh?: THREE.InstancedMesh;
  blossomLeavesMesh?: THREE.InstancedMesh;
  environmentScenery?: EnvironmentScenery;

  // Instanced Street Furniture GPU Pools (Phase 5)
  lampPolesMesh?: THREE.InstancedMesh;
  lampArmsMesh?: THREE.InstancedMesh;
  lampBulbsMesh?: THREE.InstancedMesh;
  railBarsMesh?: THREE.InstancedMesh;
  railPostsMesh?: THREE.InstancedMesh;
  retainingFasciaMesh?: THREE.InstancedMesh;
  streetFurnitureDirty = true;

  // Active Building Meshes
  buildingMeshes: Map<string, THREE.Object3D> = new Map();
  private constructionOverlays = new Map<string, HTMLDivElement>();
  private overlayWorldPosition = new THREE.Vector3();
  private constructionOverlaysDirty = true;
  turbineRotors: Map<string, THREE.Object3D> = new Map();
  traffic!: TrafficManager;
  citizens!: CitizenManager;

  clearAllBuildings() {
    this.buildingMeshes.forEach((mesh) => {
      this.scene.remove(mesh);
      this.disposeObject3D(mesh);
    });
    this.buildingMeshes.clear();
    this.turbineRotors.clear();
    this.clearConstructionOverlays();
  }

  updateShadowSettings(updates: Partial<typeof this.shadowSettings>) {
    this.shadowSettings = { ...this.shadowSettings, ...updates };

    if (!this.dirLight || !this.renderer) return;

    if (updates.castShadows !== undefined) {
      this.dirLight.castShadow = this.shadowSettings.castShadows;
    }

    if (updates.shadowMapType !== undefined) {
      this.renderer.shadowMap.type = this.shadowSettings.shadowMapType;
      
      // Force all materials in scene to recompile to take new shadow mapping shader path
      this.scene.traverse((node) => {
        if (node instanceof THREE.Mesh || node instanceof THREE.InstancedMesh) {
          if (node.material) {
            if (Array.isArray(node.material)) {
              node.material.forEach(m => m.needsUpdate = true);
            } else {
              node.material.needsUpdate = true;
            }
          }
        }
      });
    }

    if (updates.shadowMapSize !== undefined) {
      if (this.dirLight.shadow.map) {
        this.dirLight.shadow.map.dispose();
        this.dirLight.shadow.map = null as any;
      }
      this.dirLight.shadow.mapSize.width = this.shadowSettings.shadowMapSize;
      this.dirLight.shadow.mapSize.height = this.shadowSettings.shadowMapSize;
    }

    if (updates.bias !== undefined) {
      this.dirLight.shadow.bias = this.shadowSettings.bias;
    }
    if (updates.normalBias !== undefined) {
      this.dirLight.shadow.normalBias = this.shadowSettings.normalBias;
    }

    let camNeedsUpdate = false;
    if (updates.frustumSize !== undefined && !this.shadowSettings.autoFitFrustum) {
      const d = this.shadowSettings.frustumSize;
      this.dirLight.shadow.camera.left = -d;
      this.dirLight.shadow.camera.right = d;
      this.dirLight.shadow.camera.top = d;
      this.dirLight.shadow.camera.bottom = -d;
      camNeedsUpdate = true;
    }
    if (updates.near !== undefined) {
      this.dirLight.shadow.camera.near = this.shadowSettings.near;
      camNeedsUpdate = true;
    }
    if (updates.far !== undefined) {
      this.dirLight.shadow.camera.far = this.shadowSettings.far;
      camNeedsUpdate = true;
    }

    if (camNeedsUpdate) {
      this.dirLight.shadow.camera.updateProjectionMatrix();
    }

    if (updates.autoFitFrustum !== undefined) {
      if (this.shadowSettings.autoFitFrustum) {
        this.updateShadowFrustum();
      } else {
        // Fall back to current manual frustumSize setting
        const d = this.shadowSettings.frustumSize;
        this.dirLight.shadow.camera.left = -d;
        this.dirLight.shadow.camera.right = d;
        this.dirLight.shadow.camera.top = d;
        this.dirLight.shadow.camera.bottom = -d;
        this.dirLight.shadow.camera.updateProjectionMatrix();
      }
    }

    // Update coordinates and illumination intensities instantly
    this.updateDayNightCycle(this.renderTimeOfDay);
  }

  updateShadowFrustum() {
    if (!this.dirLight || !this.renderer) return;

    if (this.shadowSettings.autoFitFrustum) {
      // Calculate screen dimensions in world space based on orthographic zoom and aspect ratio
      const aspect = this.container.clientWidth / this.container.clientHeight;
      const screenFrustum = 1000 / this.cameraZoom;

      const halfWidth = (screenFrustum * aspect) / 2;
      const halfHeight = screenFrustum / 2;
      const maxHalfDim = Math.max(halfWidth, halfHeight);

      // Add a 20% margin to prevent edge-clipping of tall buildings casting offscreen shadows
      const d = maxHalfDim * 1.2;
      
      this.shadowSettings.frustumSize = Math.round(d);

      this.dirLight.shadow.camera.left = -d;
      this.dirLight.shadow.camera.right = d;
      this.dirLight.shadow.camera.top = d;
      this.dirLight.shadow.camera.bottom = -d;
      this.dirLight.shadow.camera.updateProjectionMatrix();
    }
  }

  updateStreetscapeSettings(updates: Partial<StreetscapeSettings>) {
    Object.assign(currentStreetscapeSettings, updates);

    const updateMatColor = (key: string, colorStr: string) => {
      const color = new THREE.Color(colorStr);
      if (this.assets.materials[key] && (this.assets.materials[key] as any).color) {
        (this.assets.materials[key] as any).color.copy(color);
      }
      if (this.assets.standardMaterials[key] && (this.assets.standardMaterials[key] as any).color) {
        (this.assets.standardMaterials[key] as any).color.copy(color);
      }
      if (this.assets.toonMaterials[key] && (this.assets.toonMaterials[key] as any).color) {
        (this.assets.toonMaterials[key] as any).color.copy(color);
      }
      if (this.assets.softToonMaterials[key] && (this.assets.softToonMaterials[key] as any).color) {
        (this.assets.softToonMaterials[key] as any).color.copy(color);
      }
    };

    if (updates.sidewalkColor) updateMatColor('sidewalk', updates.sidewalkColor);
    if (updates.curbColor) updateMatColor('curb', updates.curbColor);
    if (updates.asphaltColor) updateMatColor('road', updates.asphaltColor);
    if (updates.lineColor) updateMatColor('roadLine', updates.lineColor);

    this.rebuildAllRoads();
  }

  rebuildAllRoads() {
    if (!this.sim) return;
    // Cached road geometries must not be retained across a settings rebuild.
    // Keep geometry still referenced by non-road scene objects alive; removing
    // the cache first lets updateRoadMesh dispose each outgoing road safely.
    const liveGeometries = new Set<THREE.BufferGeometry>();
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh || object instanceof THREE.InstancedMesh) {
        liveGeometries.add(object.geometry);
      }
    });
    for (const geometry of Object.values(this.assets.geometries)) {
      if (!liveGeometries.has(geometry)) geometry.dispose();
    }
    this.assets.geometries = {};
    for (let x = 0; x < this.sim.gridSize; x++) {
      for (let y = 0; y < this.sim.gridSize; y++) {
        const tile = this.sim.grid[x][y];
        if (tile.type === 'road') {
          this.updateRoadMesh(x, y, this.getRoadConnections(x, y));
        }
      }
    }
    this.streetFurnitureDirty = true;
  }

  getRoadConnections(x: number, y: number): { N: boolean; S: boolean; E: boolean; W: boolean } {
    if (!this.sim) return { N: false, S: false, E: false, W: false };
    const size = this.sim.gridSize;
    return {
      N: y > 0 && this.sim.grid[x][y - 1].type === 'road',
      S: y < size - 1 && this.sim.grid[x][y + 1].type === 'road',
      E: x < size - 1 && this.sim.grid[x + 1][y].type === 'road',
      W: x > 0 && this.sim.grid[x - 1][y].type === 'road',
    };
  }

  onSimulationTick(lastTime: number, targetTime: number) {
    this.lastTickTime = performance.now();
    this.lastTickTimeOfDay = lastTime;
    this.targetTickTimeOfDay = targetTime;
    this.isInterpolating = true;
  }

  resetInterpolation(time: number) {
    this.renderTimeOfDay = time;
    this.lastTickTimeOfDay = time;
    this.targetTickTimeOfDay = time;
    this.isInterpolating = false;
  }

  disposeObject3D(object: THREE.Object3D) {
    const sharedGeometries = new Set(Object.values(this.assets.geometries));
    const sharedMaterials = this.assets.getAllSharedMaterials();

    object.traverse((node) => {
      if (node instanceof THREE.Mesh) {
        if (node.geometry && !sharedGeometries.has(node.geometry)) {
          node.geometry.dispose();
        }
        
        if (node.material) {
          const mats = Array.isArray(node.material) ? node.material : [node.material];
          mats.forEach(mat => {
            if (!sharedMaterials.has(mat)) {
              mat.dispose();
            }
          });
        }
      }
    });
  }

  // Particle System (Chimney Smoke)
  particles: { mesh: THREE.Mesh; velocity: THREE.Vector3; life: number; maxLife: number }[] = [];
  smokeGeometry = new THREE.DodecahedronGeometry(0.12, 0);
  smokeMaterials: THREE.MeshBasicMaterial[] = [];

  // Camera State
  cameraTarget = new THREE.Vector3(0, 0, 0);
  cameraZoom = 25; // Zoom scale factor for Orthographic
  cameraAngleX = Math.PI / 6; // Pitch (30 degrees)
  cameraAngleY = Math.PI / 4; // Yaw (45 degrees)

  // Reusable vectors to avoid allocations in update loop
  private tempForward = new THREE.Vector3();
  private tempRight = new THREE.Vector3();
  private tempMoveDir = new THREE.Vector3();
  private tempLightMatrix = new THREE.Matrix4();
  private tempTargetLightSpace = new THREE.Vector3();
  private tempUp = new THREE.Vector3(0, 1, 0);

  // Smooth camera destination states
  desiredCameraTarget = new THREE.Vector3(0, 0, 0);
  desiredCameraZoom = 25;
  desiredAngleX = Math.PI / 6;
  desiredAngleY = Math.PI / 4;
  keysPressed: { [key: string]: boolean } = {};

  // Drag interaction
  isDragging = false;
  previousMousePosition = { x: 0, y: 0 };

  constructor(containerId: string, assets: AssetGenerator, sim: Simulation) {
    this.container = document.getElementById(containerId)!;
    this.assets = assets;
    this.sim = sim;
    this.assets.sim = sim;

    this.initParticles();
    this.initScene();
    this.initCamera();
    this.initRenderer();
    this.initLights();
    this.initEnvironment();
    this.initInteraction();

    // Resize listener
    window.addEventListener('resize', this.onWindowResize.bind(this));
  }

  initParticles() {
    this.smokeMaterials = [];
    for (let i = 0; i <= 15; i++) {
      this.smokeMaterials.push(new THREE.MeshBasicMaterial({
        color: 0x8a9296,
        transparent: true,
        opacity: 0.4 * (i / 15),
      }));
    }
  }

  initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(DAY_ATMOSPHERE.skyColor);
    this.scene.fog = new THREE.FogExp2(DAY_ATMOSPHERE.fogColor, DAY_ATMOSPHERE.fogDensity);
  }

  initCamera() {
    const aspect = this.container.clientWidth / this.container.clientHeight;
    const frustumSize = 1000 / this.cameraZoom;

    this.camera = new THREE.OrthographicCamera(
      (frustumSize * aspect) / -2,
      (frustumSize * aspect) / 2,
      frustumSize / 2,
      frustumSize / -2,
      0.1,
      1000
    );

    this.updateCameraPosition();
  }

  initRenderer() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    // Keep authored palette values in sRGB while lighting and bloom are
    // calculated linearly. OutputPass applies the final display conversion.
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.95;
    this.container.appendChild(this.renderer.domElement);

    // Initialize the post-processing composer
    this.composer = new EffectComposer(this.renderer);

    // 1. Render Pass (render base scene)
    const renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(renderPass);


    // 3. Unreal Bloom Pass for glowing emissive windows & vehicle headlights.
    // Quarter-resolution bloom reduces blur work without lowering scene detail.
    // UnrealBloomPass itself halves the size supplied by the subclass above.
    const bloomPass = new QuarterResolutionBloomPass(
      new THREE.Vector2(this.container.clientWidth, this.container.clientHeight),
      0.25, // strength (cozy and soft)
      0.3,  // radius
      0.85  // threshold (only blooms bright glow elements)
    );
    this.composer.addPass(bloomPass);

    // This must remain the final composer pass so ACES tone mapping and the
    // sRGB display conversion are each applied exactly once after bloom.
    this.composer.addPass(new OutputPass());
  }

  initLights() {
    // A hemisphere fill approximates the cool outdoor sky above and subdued
    // ground bounce below. It never casts shadows, so the directional key is
    // the scene's only shadow-map cost.
    this.skyFillLight = new THREE.HemisphereLight(
      DAY_ATMOSPHERE.skyFillColor,
      DAY_ATMOSPHERE.groundFillColor,
      DAY_ATMOSPHERE.fillIntensity,
    );
    this.scene.add(this.skyFillLight);

    // Directional Sun Light (casts shadows)
    this.dirLight = new THREE.DirectionalLight(0xfffaf0, this.shadowSettings.sunIntensity);
    this.dirLight.position.set(40, 50, 20);
    this.dirLight.castShadow = this.shadowSettings.castShadows;

    // High quality soft shadows settings
    this.dirLight.shadow.mapSize.width = this.shadowSettings.shadowMapSize;
    this.dirLight.shadow.mapSize.height = this.shadowSettings.shadowMapSize;
    this.dirLight.shadow.camera.near = this.shadowSettings.near;
    this.dirLight.shadow.camera.far = this.shadowSettings.far;

    const d = this.shadowSettings.frustumSize;
    this.dirLight.shadow.camera.left = -d;
    this.dirLight.shadow.camera.right = d;
    this.dirLight.shadow.camera.top = d;
    this.dirLight.shadow.camera.bottom = -d;
    this.dirLight.shadow.bias = this.shadowSettings.bias;
    this.dirLight.shadow.normalBias = this.shadowSettings.normalBias;

    this.scene.add(this.dirLight);
  }

  // Populate Instanced Ground Tiles and Scattered Trees
  initEnvironment() {
    const size = 50;
    const gridOffset = size / 2;

    // 1. Ground Tiles (Grass)
    const groundGeo = this.assets.createGroundGeometry();
    const edgeFlagsAttr = new THREE.InstancedBufferAttribute(new Float32Array(size * size * 4), 4);
    const cornerFlagsAttr = new THREE.InstancedBufferAttribute(new Float32Array(size * size * 4), 4);
    const cliffEdgeRolesAttr = new THREE.InstancedBufferAttribute(new Float32Array(size * size * 4), 4);
    const cliffCornerRolesAttr = new THREE.InstancedBufferAttribute(new Float32Array(size * size * 4), 4);
    groundGeo.setAttribute('aEdgeFlags', edgeFlagsAttr);
    groundGeo.setAttribute('aCornerFlags', cornerFlagsAttr);
    groundGeo.setAttribute('aCliffEdgeRoles', cliffEdgeRolesAttr);
    groundGeo.setAttribute('aCliffCornerRoles', cliffCornerRolesAttr);

    const groundMat = this.assets.materials.grass;
    this.groundMesh = new THREE.InstancedMesh(groundGeo, groundMat, size * size);
    this.groundMesh.castShadow = true;
    this.groundMesh.receiveShadow = true;

    const dummy = new THREE.Object3D();
    let index = 0;

    for (let x = 0; x < size; x++) {
      for (let z = 0; z < size; z++) {
        const xPos = (x - gridOffset) * 2;
        const zPos = (z - gridOffset) * 2;

        const tile = this.sim ? this.sim.grid[x][z] : null;
        const elevation = tile ? (tile.elevation || 0) : 0;
        const yPos = elevation * 0.8;

        dummy.position.set(xPos, yPos, zPos);
        dummy.updateMatrix();
        this.groundMesh.setMatrixAt(index, dummy.matrix);

        const { edges, corners } = this.computeEdgeFlags(x, z);
        const cliffEdgeRoles = this.computeCliffEdgeRoles(x, z);
        const cliffCornerRoles = this.computeCliffCornerRoles(x, z);
        edgeFlagsAttr.setXYZW(index, edges[0], edges[1], edges[2], edges[3]);
        cornerFlagsAttr.setXYZW(index, corners[0], corners[1], corners[2], corners[3]);
        cliffEdgeRolesAttr.setXYZW(index, cliffEdgeRoles[0], cliffEdgeRoles[1], cliffEdgeRoles[2], cliffEdgeRoles[3]);
        cliffCornerRolesAttr.setXYZW(index, cliffCornerRoles[0], cliffCornerRoles[1], cliffCornerRoles[2], cliffCornerRoles[3]);
        index++;
      }
    }
    edgeFlagsAttr.needsUpdate = true;
    cornerFlagsAttr.needsUpdate = true;
    cliffEdgeRolesAttr.needsUpdate = true;
    cliffCornerRolesAttr.needsUpdate = true;
    this.scene.add(this.groundMesh);

    // 2. Deterministic, renderer-owned natural scenery. It derives recipes from
    // the neighborhood seed and tile state, so it adds no save data.
    this.environmentScenery = new EnvironmentScenery(this.scene, this.sim!, this.assets);
    this.environmentScenery.initialize();

    // 3. Global Instanced Street Furniture Pools (Phase 5)
    this.initStreetFurniture();
  }

  initStreetFurniture() {
    const disposePool = (mesh?: THREE.InstancedMesh) => {
      if (!mesh) return;
      this.scene.remove(mesh);
      mesh.dispose();
    };
    disposePool(this.lampPolesMesh);
    disposePool(this.lampArmsMesh);
    disposePool(this.lampBulbsMesh);
    disposePool(this.railBarsMesh);
    disposePool(this.railPostsMesh);
    disposePool(this.retainingFasciaMesh);

    const charcoalMat = this.assets.materials.charcoalMetal;
    const bulbMat = this.assets.materials.lampBulb;
    const cementMat = this.assets.materials.cement;

    const maxLamps = 1500;
    const maxRails = 12000;
    const maxFascia = 6000;

    const poleGeo = this.assets.getGeometry('lamp_pole_inst', () => new THREE.BoxGeometry(0.05, 0.85, 0.05));
    this.lampPolesMesh = new THREE.InstancedMesh(poleGeo, charcoalMat, maxLamps);
    this.lampPolesMesh.castShadow = true;
    this.lampPolesMesh.frustumCulled = false;
    this.scene.add(this.lampPolesMesh);

    const armGeo = this.assets.getGeometry('lamp_arm_inst', () => new THREE.BoxGeometry(0.18, 0.04, 0.04));
    this.lampArmsMesh = new THREE.InstancedMesh(armGeo, charcoalMat, maxLamps);
    this.lampArmsMesh.frustumCulled = false;
    this.scene.add(this.lampArmsMesh);

    const bulbGeo = this.assets.getGeometry('lamp_bulb_inst', () => new THREE.BoxGeometry(0.08, 0.08, 0.08));
    this.lampBulbsMesh = new THREE.InstancedMesh(bulbGeo, bulbMat, maxLamps);
    this.lampBulbsMesh.frustumCulled = false;
    this.scene.add(this.lampBulbsMesh);

    const barGeo = this.assets.getGeometry('rail_bar_inst', () => new THREE.BoxGeometry(2.0, 0.03, 0.03));
    this.railBarsMesh = new THREE.InstancedMesh(barGeo, charcoalMat, maxRails);
    this.railBarsMesh.castShadow = true;
    this.railBarsMesh.frustumCulled = false;
    this.scene.add(this.railBarsMesh);

    const postGeo = this.assets.getGeometry('rail_post_inst', () => new THREE.BoxGeometry(0.05, 0.30, 0.05));
    this.railPostsMesh = new THREE.InstancedMesh(postGeo, charcoalMat, maxRails * 3);
    this.railPostsMesh.castShadow = true;
    this.railPostsMesh.frustumCulled = false;
    this.scene.add(this.railPostsMesh);

    const fasciaGeo = this.assets.getGeometry('retaining_fascia_inst', () => new THREE.BoxGeometry(2.0, 1.2, 0.06));
    this.retainingFasciaMesh = new THREE.InstancedMesh(fasciaGeo, cementMat, maxFascia);
    this.retainingFasciaMesh.receiveShadow = true;
    this.retainingFasciaMesh.frustumCulled = false;
    this.scene.add(this.retainingFasciaMesh);

    this.streetFurnitureDirty = true;
  }

  rebuildStreetFurniture() {
    if (!this.sim || !this.lampPolesMesh || !this.railBarsMesh) return;

    const dummy = new THREE.Object3D();
    const size = this.sim.gridSize;
    const gridOffset = size / 2;
    const SIDEWALK_Y = ROAD_LAYOUT.SIDEWALK_Y; // 0.05

    let lampCount = 0;
    let railBarCount = 0;
    let railPostCount = 0;
    let fasciaCount = 0;
    const lampSpacing = 2.5;
    const lampSpatialHash = new Map<string, Array<{ x: number; z: number }>>();

    const getLampCellKey = (cellX: number, cellZ: number) => `${cellX},${cellZ}`;

    for (let x = 0; x < size; x++) {
      for (let y = 0; y < size; y++) {
        const tile = this.sim.grid[x][y];
        if (tile.type !== 'road') continue;

        const isBridge = tile.bridge || false;
        if (isBridge) continue; // Bridges render their own deck railings in createRoadMesh and do not get cliff rails or fascia over water
        const tileH = tile.elevation || 0;
        const xPos = (x - gridOffset) * 2;
        const zPos = (y - gridOffset) * 2;

        const N = y > 0 && this.sim.grid[x][y - 1].type === 'road';
        const S = y < size - 1 && this.sim.grid[x][y + 1].type === 'road';
        const E = x < size - 1 && this.sim.grid[x + 1][y].type === 'road';
        const W = x > 0 && this.sim.grid[x - 1][y].type === 'road';

        // Check slope / ramp
        const connectionCount = [N, S, E, W].filter(Boolean).length;
        let yPos = tileH * 0.8;
        let tiltX = 0;
        let tiltZ = 0;
        let isRamp = false;

        if (connectionCount === 2 && !isBridge) {
          if (N && S) {
            const H_N = this.sim.grid[x][y - 1].elevation || 0;
            const H_S = this.sim.grid[x][y + 1].elevation || 0;
            const y_N = Math.max(tileH, H_N) * 0.8;
            const y_S = Math.max(tileH, H_S) * 0.8;
            if (y_N !== y_S) {
              yPos = (y_N + y_S) / 2;
              tiltX = Math.atan2(y_N - y_S, 2.0);
              isRamp = true;
            }
          } else if (E && W) {
            const H_E = this.sim.grid[x + 1][y].elevation || 0;
            const H_W = this.sim.grid[x - 1][y].elevation || 0;
            const y_E = Math.max(tileH, H_E) * 0.8;
            const y_W = Math.max(tileH, H_W) * 0.8;
            if (y_E !== y_W) {
              yPos = (y_E + y_W) / 2;
              tiltZ = Math.atan2(y_E - y_W, 2.0);
              isRamp = true;
            }
          }
        }

        // 1. Cliff Guard Rails and Retaining Edge
        const checkCliff = (dir: 'N' | 'S' | 'E' | 'W', isConnected: boolean, nx: number, ny: number) => {
          if (isConnected) return;
          const isNS = dir === 'N' || dir === 'S';
          const isLateralRamp = isRamp && ((tiltX !== 0 && (dir === 'W' || dir === 'E')) || (tiltZ !== 0 && (dir === 'N' || dir === 'S')));

          let isCliff = false;
          let nH = 0;
          if (nx < 0 || ny < 0 || nx >= size || ny >= size) {
            isCliff = true;
          } else {
            const nTile = this.sim!.grid[nx][ny];
            nH = (nTile.elevation || 0) * 0.8;
            if (nTile.type === 'water_body' || nH < tileH * 0.8) {
              isCliff = true;
            }
          }

          if (isCliff) {
            const railY = yPos + (isBridge ? 0.08 : SIDEWALK_Y) + 0.15;
            const offset = (dir === 'N' || dir === 'W') ? -0.94 : 0.94;

            // Flat rails are only emitted for non-ramp edges (ramp lateral sides get tilted rails below)
            if (!isLateralRamp) {
              // Bar 1 & Bar 2
              for (const barYOff of [0, 0.12]) {
                dummy.position.set(
                  isNS ? xPos : xPos + offset,
                  railY + barYOff,
                  isNS ? zPos + offset : zPos
                );
                dummy.rotation.set(0, isNS ? 0 : Math.PI / 2, 0);
                dummy.scale.set(1, 1, 1);
                dummy.updateMatrix();
                this.railBarsMesh!.setMatrixAt(railBarCount++, dummy.matrix);
              }

              // Posts (3 posts per bar run)
              for (const step of [-0.85, 0, 0.85]) {
                dummy.position.set(
                  isNS ? xPos + step : xPos + offset,
                  railY + 0.05,
                  isNS ? zPos + offset : zPos + step
                );
                dummy.rotation.set(0, 0, 0);
                dummy.scale.set(1, 1, 1);
                dummy.updateMatrix();
                this.railPostsMesh!.setMatrixAt(railPostCount++, dummy.matrix);
              }
            }

            // Concrete Retaining Fascia (scaled dynamically to actual elevation drop)
            const dropH = Math.max(1.2, tileH * 0.8 - nH);
            dummy.position.set(
              isNS ? xPos : xPos + offset,
              yPos + 0.05 - dropH / 2,
              isNS ? zPos + offset : zPos
            );
            dummy.rotation.set(0, isNS ? 0 : Math.PI / 2, 0);
            dummy.scale.set(1, dropH / 1.2, 1);
            dummy.updateMatrix();
            this.retainingFasciaMesh!.setMatrixAt(fasciaCount++, dummy.matrix);
          }
        };

        checkCliff('N', N, x, y - 1);
        checkCliff('S', S, x, y + 1);
        checkCliff('E', E, x + 1, y);
        checkCliff('W', W, x - 1, y);

        // 2. Ramp Guard Rails (only on non-connected lateral sides)
        if (isRamp) {
          const deckLen = 2.0;
          const baseRailHeight = 0.22;
          const angle = tiltX !== 0 ? tiltX : tiltZ;
          const postHeight = baseRailHeight / Math.cos(angle);
          const railY = SIDEWALK_Y + baseRailHeight / 2;

          const rampGroup = new THREE.Object3D();
          rampGroup.position.set(xPos, yPos, zPos);
          if (tiltX !== 0) rampGroup.rotation.x = tiltX;
          if (tiltZ !== 0) rampGroup.rotation.z = tiltZ;

          const worldPos = new THREE.Vector3();

          const addRampRailInst = (xOff: number, zOff: number, isVertical: boolean) => {
            // Horizontal bars (2 bars)
            for (const barYOff of [0, 0.12]) {
              const barDummy = new THREE.Object3D();
              barDummy.position.set(xOff, railY + barYOff, zOff);
              if (isVertical) barDummy.rotation.y = Math.PI / 2;
              rampGroup.add(barDummy);
              rampGroup.updateMatrixWorld(true);
              this.railBarsMesh!.setMatrixAt(railBarCount++, barDummy.matrixWorld);
              rampGroup.remove(barDummy);
            }

            // Posts (3 posts, un-sheared 100% vertical in world space)
            for (const step of [-0.85, 0, 0.85]) {
              const postDummy = new THREE.Object3D();
              if (isVertical) {
                postDummy.position.set(xOff, railY + 0.02, zOff + step * (deckLen / 2));
              } else {
                postDummy.position.set(xOff + step * (deckLen / 2), railY + 0.02, zOff);
              }
              rampGroup.add(postDummy);
              rampGroup.updateMatrixWorld(true);
              postDummy.getWorldPosition(worldPos);
              rampGroup.remove(postDummy);

              dummy.position.copy(worldPos);
              dummy.rotation.set(0, 0, 0); // 100% unrotated world orientation
              dummy.scale.set(1, postHeight / 0.30, 1);
              dummy.updateMatrix();
              this.railPostsMesh!.setMatrixAt(railPostCount++, dummy.matrix);
            }
          };

          if (tiltX !== 0) {
            if (!W) addRampRailInst(-0.94, 0, true);
            if (!E) addRampRailInst(0.94, 0, true);
          } else if (tiltZ !== 0) {
            if (!N) addRampRailInst(0, -0.94, false);
            if (!S) addRampRailInst(0, 0.94, false);
          }
        }

        // 3. Lamps near development (deterministic corner placement & min 2.5m spacing; skip bridges and ramps)
        if (!isBridge && !isRamp) {
          let devX = -1;
          let devY = -1;
          for (let dx = -2; dx <= 2 && devX < 0; dx++) {
            for (let dy = -2; dy <= 2 && devX < 0; dy++) {
              const nx = x + dx;
              const ny = y + dy;
              if (nx >= 0 && ny >= 0 && nx < size && ny < size) {
                const type = this.sim.grid[nx][ny].type;
                if (type !== 'empty' && type !== 'road' && type !== 'water_body') {
                  devX = nx;
                  devY = ny;
                }
              }
            }
          }

          if (devX >= 0) {
            const cornerX = devX > x ? 0.80 : (devX < x ? -0.80 : 0.80);
            const cornerZ = devY > y ? 0.80 : (devY < y ? -0.80 : 0.80);
            const candX = xPos + cornerX;
            const candZ = zPos + cornerZ;

            // Candidates are grid-aligned, so only nearby spatial-hash cells can
            // contain lamps within the 2.5m exclusion radius.
            const cellX = Math.floor(candX / lampSpacing);
            const cellZ = Math.floor(candZ / lampSpacing);
            let tooClose = false;
            for (let dx = -1; dx <= 1 && !tooClose; dx++) {
              for (let dz = -1; dz <= 1 && !tooClose; dz++) {
                const nearbyLamps = lampSpatialHash.get(getLampCellKey(cellX + dx, cellZ + dz));
                if (!nearbyLamps) continue;
                for (const lamp of nearbyLamps) {
                  const distSq = (lamp.x - candX) * (lamp.x - candX) + (lamp.z - candZ) * (lamp.z - candZ);
                  if (distSq < lampSpacing * lampSpacing) {
                    tooClose = true;
                    break;
                  }
                }
              }
            }

            if (!tooClose) {
              const armDirX = cornerX > 0 ? -1 : 1;

              // Pole
              dummy.position.set(candX, yPos + SIDEWALK_Y + 0.425, candZ);
              dummy.rotation.set(0, 0, 0);
              dummy.scale.set(1, 1, 1);
              dummy.updateMatrix();
              this.lampPolesMesh!.setMatrixAt(lampCount, dummy.matrix);

              // Arm
              dummy.position.set(candX + armDirX * 0.07, yPos + SIDEWALK_Y + 0.82, candZ);
              dummy.rotation.set(0, 0, 0);
              dummy.scale.set(1, 1, 1);
              dummy.updateMatrix();
              this.lampArmsMesh!.setMatrixAt(lampCount, dummy.matrix);

              // Bulb
              dummy.position.set(candX + armDirX * 0.14, yPos + SIDEWALK_Y + 0.78, candZ);
              dummy.rotation.set(0, 0, 0);
              dummy.scale.set(1, 1, 1);
              dummy.updateMatrix();
              this.lampBulbsMesh!.setMatrixAt(lampCount, dummy.matrix);

              const cellKey = getLampCellKey(cellX, cellZ);
              const lampsInCell = lampSpatialHash.get(cellKey) ?? [];
              lampsInCell.push({ x: candX, z: candZ });
              lampSpatialHash.set(cellKey, lampsInCell);
              lampCount++;
            }
          }
        }
      }
    }

    // Set counts & mark instanceMatrix dirty
    this.lampPolesMesh.count = lampCount;
    this.lampPolesMesh.instanceMatrix.needsUpdate = true;
    if (this.lampArmsMesh) {
      this.lampArmsMesh.count = lampCount;
      this.lampArmsMesh.instanceMatrix.needsUpdate = true;
    }
    if (this.lampBulbsMesh) {
      this.lampBulbsMesh.count = lampCount;
      this.lampBulbsMesh.instanceMatrix.needsUpdate = true;
    }

    this.railBarsMesh.count = railBarCount;
    this.railBarsMesh.instanceMatrix.needsUpdate = true;
    if (this.railPostsMesh) {
      this.railPostsMesh.count = railPostCount;
      this.railPostsMesh.instanceMatrix.needsUpdate = true;
    }

    if (this.retainingFasciaMesh) {
      this.retainingFasciaMesh.count = fasciaCount;
      this.retainingFasciaMesh.instanceMatrix.needsUpdate = true;
    }
  }

  getSeededRandomForCoords(seed: number, x: number, y: number) {
    const initialSeed = Math.abs(Math.sin(x * 12.9898 + y * 78.233 + seed * 137.456) * 43758.5453) % 1;
    let s = Math.floor(initialSeed * 233280);
    return () => {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };
  }

  rebuildTrees() {
    if (this.trunkMesh) {
      this.scene.remove(this.trunkMesh);
    }
    if (this.greenLeavesMesh) {
      this.scene.remove(this.greenLeavesMesh);
    }
    if (this.blossomLeavesMesh) {
      this.scene.remove(this.blossomLeavesMesh);
    }

    const size = 50;
    const gridOffset = size / 2;
    this.treesData = [];

    let greenTreeCount = 0;
    let blossomTreeCount = 0;

    const gameSeed = this.sim ? this.sim.seed : 0;

    for (let x = 0; x < size; x++) {
      for (let z = 0; z < size; z++) {
        const rand = this.getSeededRandomForCoords(gameSeed, x, z);

        const nearMargin = x < 15 || x > size - 15 || z < 15 || z > size - 15;
        const threshold = nearMargin ? 0.27 : 0.02;

        if (rand() > threshold) continue;

        const xPos = (x - gridOffset) * 2 + (rand() - 0.5) * 1.2;
        const zPos = (z - gridOffset) * 2 + (rand() - 0.5) * 1.2;

        const scale = 0.8 + rand() * 0.4;
        const rotationY = rand() * Math.PI;
        const isBlossom = rand() > 0.8;
        const leafBase = rand() > 0.5 ? 0.35 : 0.45;

        const tile = this.sim ? this.sim.grid[x][z] : null;
        const isHidden = tile ? tile.type !== 'empty' : false;

        const trunkIndex = this.treesData.length;
        const leafStartIndex = isBlossom ? blossomTreeCount * 3 : greenTreeCount * 3;

        this.treesData.push({
          gridX: x,
          gridZ: z,
          x: xPos,
          z: zPos,
          scale,
          rotationY,
          isBlossom,
          leafBase,
          trunkIndex,
          leafStartIndex,
          isHidden
        });

        if (isBlossom) {
          blossomTreeCount++;
        } else {
          greenTreeCount++;
        }
      }
    }

    this.trunkMesh = new THREE.InstancedMesh(
      this.assets.getGeometry('tree_trunk', () => {
        const geo = new THREE.CylinderGeometry(0.1, 0.15, 0.6, 5);
        geo.translate(0, 0.3, 0);
        return geo;
      }),
      this.assets.materials.trunk,
      this.treesData.length
    );
    this.trunkMesh.castShadow = true;
    this.trunkMesh.receiveShadow = true;

    const leafBaseGeo = this.assets.getGeometry('tree_leaf_base', () => {
      const geo = new THREE.ConeGeometry(1, 0.6, 5);
      geo.translate(0, 0.3, 0);
      return geo;
    });

    this.greenLeavesMesh = new THREE.InstancedMesh(
      leafBaseGeo,
      this.assets.materials.leaves,
      3 * greenTreeCount
    );
    this.greenLeavesMesh.castShadow = true;
    this.greenLeavesMesh.receiveShadow = true;

    this.blossomLeavesMesh = new THREE.InstancedMesh(
      leafBaseGeo,
      this.assets.materials.blossom,
      3 * blossomTreeCount
    );
    this.blossomLeavesMesh.castShadow = true;
    this.blossomLeavesMesh.receiveShadow = true;

    const tempTree = new THREE.Object3D();
    const tempLeaf = new THREE.Object3D();

    let greenLeafIndex = 0;
    let blossomLeafIndex = 0;

    for (let i = 0; i < this.treesData.length; i++) {
      const tree = this.treesData[i];

      if (tree.isHidden) {
        tempTree.position.set(0, -100, 0);
        tempTree.scale.set(0, 0, 0);
        tempTree.updateMatrix();
        this.trunkMesh.setMatrixAt(i, tempTree.matrix);

        const zeroMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
        for (let l = 0; l < 3; l++) {
          if (tree.isBlossom) {
            this.blossomLeavesMesh.setMatrixAt(blossomLeafIndex++, zeroMatrix);
          } else {
            this.greenLeavesMesh.setMatrixAt(greenLeafIndex++, zeroMatrix);
          }
        }
      } else {
        const tileElevation = this.sim ? (this.sim.grid[tree.gridX][tree.gridZ].elevation || 0) : 0;
        tempTree.position.set(tree.x, tileElevation * 0.8, tree.z);
        tempTree.rotation.set(0, tree.rotationY, 0);
        tempTree.scale.set(tree.scale, tree.scale, tree.scale);
        tempTree.updateMatrix();
        this.trunkMesh.setMatrixAt(i, tempTree.matrix);

        for (let l = 0; l < 3; l++) {
          const radius = tree.leafBase - l * 0.08;
          const localY = 0.7 + l * 0.4;

          tempLeaf.position.set(0, localY, 0);
          tempLeaf.rotation.set(0, 0, 0);
          tempLeaf.scale.set(radius, 1.0, radius);
          tempLeaf.updateMatrix();

          const worldMatrix = new THREE.Matrix4().multiplyMatrices(tempTree.matrix, tempLeaf.matrix);

          if (tree.isBlossom) {
            this.blossomLeavesMesh.setMatrixAt(blossomLeafIndex++, worldMatrix);
          } else {
            this.greenLeavesMesh.setMatrixAt(greenLeafIndex++, worldMatrix);
          }
        }
      }
    }

    this.scene.add(this.trunkMesh);
    this.scene.add(this.greenLeavesMesh);
    this.scene.add(this.blossomLeavesMesh);
  }

  updateTreesOnTile(gridX: number, gridZ: number) {
    if (!this.sim || !this.trunkMesh || !this.greenLeavesMesh || !this.blossomLeavesMesh) return;

    const tile = this.sim.grid[gridX][gridZ];
    const isBuilt = tile.type !== 'empty';

    const trees = this.treesData.filter(t => t.gridX === gridX && t.gridZ === gridZ);
    if (trees.length === 0) return;

    const tempTree = new THREE.Object3D();
    const tempLeaf = new THREE.Object3D();
    let updated = false;

    for (const tree of trees) {
      if (tree.isHidden === isBuilt) continue;

      tree.isHidden = isBuilt;
      updated = true;

      if (isBuilt) {
        tempTree.position.set(0, -100, 0);
        tempTree.scale.set(0, 0, 0);
        tempTree.updateMatrix();
        this.trunkMesh.setMatrixAt(tree.trunkIndex, tempTree.matrix);

        const zeroMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
        for (let l = 0; l < 3; l++) {
          if (tree.isBlossom) {
            this.blossomLeavesMesh.setMatrixAt(tree.leafStartIndex + l, zeroMatrix);
          } else {
            this.greenLeavesMesh.setMatrixAt(tree.leafStartIndex + l, zeroMatrix);
          }
        }
      } else {
        const tileElevation = tile.elevation || 0;
        tempTree.position.set(tree.x, tileElevation * 0.8, tree.z);
        tempTree.rotation.set(0, tree.rotationY, 0);
        tempTree.scale.set(tree.scale, tree.scale, tree.scale);
        tempTree.updateMatrix();
        this.trunkMesh.setMatrixAt(tree.trunkIndex, tempTree.matrix);

        for (let l = 0; l < 3; l++) {
          const radius = tree.leafBase - l * 0.08;
          const localY = 0.7 + l * 0.4;

          tempLeaf.position.set(0, localY, 0);
          tempLeaf.rotation.set(0, 0, 0);
          tempLeaf.scale.set(radius, 1.0, radius);
          tempLeaf.updateMatrix();

          const worldMatrix = new THREE.Matrix4().multiplyMatrices(tempTree.matrix, tempLeaf.matrix);

          if (tree.isBlossom) {
            this.blossomLeavesMesh.setMatrixAt(tree.leafStartIndex + l, worldMatrix);
          } else {
            this.greenLeavesMesh.setMatrixAt(tree.leafStartIndex + l, worldMatrix);
          }
        }
      }
    }

    if (updated) {
      this.trunkMesh.instanceMatrix.needsUpdate = true;
      this.greenLeavesMesh.instanceMatrix.needsUpdate = true;
      this.blossomLeavesMesh.instanceMatrix.needsUpdate = true;
    }
  }

  // Camera Pan/Rotate controls
  updateCameraPosition() {
    // Trigonometry to offset camera relative to target
    // Keep a minimum radius of 30 units to prevent near-plane clipping at close zoom levels
    const radius = Math.max(30, 1000 / this.cameraZoom);

    const xOffset = radius * Math.cos(this.cameraAngleX) * Math.sin(this.cameraAngleY);
    const yOffset = radius * Math.sin(this.cameraAngleX);
    const zOffset = radius * Math.cos(this.cameraAngleX) * Math.cos(this.cameraAngleY);

    this.camera.position.set(
      this.cameraTarget.x + xOffset,
      this.cameraTarget.y + yOffset,
      this.cameraTarget.z + zOffset
    );

    this.camera.lookAt(this.cameraTarget);
    this.camera.updateProjectionMatrix();

    // Adjust shadow camera to follow target area
    if (this.dirLight) {
      this.updateShadowFrustum();
      // 1. Establish basic direction vectors by pointing light at camera target
      this.dirLight.target.position.copy(this.cameraTarget);
      this.dirLight.position.set(
        this.cameraTarget.x + this.currentSunOffset.x,
        this.cameraTarget.y + this.currentSunOffset.y,
        this.cameraTarget.z + this.currentSunOffset.z
      );
      this.dirLight.target.updateMatrixWorld();

      // 2. Perform Texel Snapping to align shadow map grid with screen pixels during camera movement/rotation
      // Compute the orientation matrix of the light
      this.tempLightMatrix.lookAt(this.dirLight.position, this.dirLight.target.position, this.tempUp);

      // Transform camera target position to light space
      this.tempTargetLightSpace.copy(this.cameraTarget).applyMatrix4(this.tempLightMatrix);

      // Calculate size of one shadow map texel in world space units
      const d = this.shadowSettings.frustumSize;
      const texelSize = (d * 2) / this.shadowSettings.shadowMapSize;

      // Snap coordinates to nearest texel boundaries
      this.tempTargetLightSpace.x = Math.round(this.tempTargetLightSpace.x / texelSize) * texelSize;
      this.tempTargetLightSpace.y = Math.round(this.tempTargetLightSpace.y / texelSize) * texelSize;

      // Convert the snapped coordinates back to world space
      const snappedTarget = this.tempTargetLightSpace.applyMatrix4(this.tempLightMatrix.invert());

      // Update light target and light position to snapped coordinates
      this.dirLight.target.position.copy(snappedTarget);
      this.dirLight.position.set(
        snappedTarget.x + this.currentSunOffset.x,
        snappedTarget.y + this.currentSunOffset.y,
        snappedTarget.z + this.currentSunOffset.z
      );
      
      this.dirLight.target.updateMatrixWorld();
    }
  }

  initInteraction() {
    const dom = this.renderer.domElement;

    // Right drag / Space+Left Drag to Pan, Middle Drag to Rotate
    dom.addEventListener('mousedown', (e) => {
      // Right button (2) or Left Button (0) with Space/Shift key
      if (e.button === 2 || (e.button === 0 && (e.shiftKey || e.ctrlKey))) {
        this.isDragging = true;
        this.previousMousePosition = { x: e.clientX, y: e.clientY };
        e.preventDefault();
      }
    });

    dom.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return;

      const deltaX = e.clientX - this.previousMousePosition.x;
      const deltaY = e.clientY - this.previousMousePosition.y;

      // Rotate view on Shift Drag
      if (e.shiftKey) {
        this.desiredAngleY -= deltaX * 0.005;
        this.desiredAngleX = Math.max(0.15, Math.min(Math.PI / 2.2, this.desiredAngleX + deltaY * 0.005));
      } else {
        const panSpeed = (40 / this.cameraZoom) * 0.0025; // Scales with zoom

        // Project panning coordinates relative to camera angle
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);

        forward.y = 0;
        right.y = 0;
        forward.normalize();
        right.normalize();

        this.desiredCameraTarget.addScaledVector(right, -deltaX * panSpeed);
        this.desiredCameraTarget.addScaledVector(forward, deltaY * panSpeed);

        // Clamping target to grid boundary (50x50 board)
        this.desiredCameraTarget.x = Math.max(-50, Math.min(50, this.desiredCameraTarget.x));
        this.desiredCameraTarget.z = Math.max(-50, Math.min(50, this.desiredCameraTarget.z));
      }

      this.previousMousePosition = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener('mouseup', () => {
      if (this.isDragging) {
        // Snap desiredAngleY to the nearest Math.PI / 4 + k * Math.PI / 2 to maintain isometric views
        const angleStep = Math.PI / 2;
        const offset = Math.PI / 4;
        const k = Math.round((this.desiredAngleY - offset) / angleStep);
        this.desiredAngleY = offset + k * angleStep;
      }
      this.isDragging = false;
    });

    // Prevent context menu
    dom.addEventListener('contextmenu', e => e.preventDefault());

    // Mouse Zoom (Smooth & Touchpad-friendly)
    dom.addEventListener('wheel', (e) => {
      e.preventDefault();
      const sensitivity = 0.0015;
      this.desiredCameraZoom = Math.min(300, Math.max(5, this.desiredCameraZoom * Math.exp(-e.deltaY * sensitivity)));
    }, { passive: false });

    // Keyboard Pan & Rotate Listeners
    window.addEventListener('keydown', (e) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
      const key = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowleft', 'arrowdown', 'arrowright'].includes(key)) {
        this.keysPressed[key] = true;
      } else if (key === 'q' && !e.repeat) {
        this.desiredAngleY -= Math.PI / 2;
      } else if (key === 'e' && !e.repeat) {
        this.desiredAngleY += Math.PI / 2;
      }
    });

    window.addEventListener('keyup', (e) => {
      const key = e.key.toLowerCase();
      if (key in this.keysPressed) {
        this.keysPressed[key] = false;
      }
    });
  }

  calculateTileRotation(tile: TileState): number {
    if (!this.sim) return 0;
    if (tile.type !== 'residential' && tile.type !== 'commercial' && tile.type !== 'industrial') {
      return 0;
    }
    const x = tile.x;
    const y = tile.y;
    const tileElevation = tile.elevation || 0;
    const gridSize = this.sim.gridSize;

    const isMatchingRoad = (nx: number, ny: number): boolean => {
      const neighbor = this.sim!.grid[nx][ny];
      if (neighbor.type !== 'road') return false;
      const neighborElev = neighbor.elevation || 0;
      if (neighborElev !== tileElevation) return false;
      if (this.isSlopedRoad(nx, ny)) return false;
      return true;
    };

    // Check neighbors: South (y+1) is +Z, North (y-1) is -Z, East (x+1) is +X, West (x-1) is -X.
    // Order of preference: South, North, East, West.
    const hasRoadSouth = y < gridSize - 1 && isMatchingRoad(x, y + 1);
    const hasRoadNorth = y > 0 && isMatchingRoad(x, y - 1);
    const hasRoadEast = x < gridSize - 1 && isMatchingRoad(x + 1, y);
    const hasRoadWest = x > 0 && isMatchingRoad(x - 1, y);

    if (hasRoadSouth) return 0;
    if (hasRoadNorth) return Math.PI;
    if (hasRoadEast) return Math.PI / 2;
    if (hasRoadWest) return -Math.PI / 2;

    return 0;
  }

  isSlopedRoad(x: number, y: number): boolean {
    if (!this.sim) return false;
    const tile = this.sim.grid[x][y];
    if (tile.type !== 'road' || tile.bridge) return false;

    const N = y > 0 && this.sim.grid[x][y - 1].type === 'road';
    const S = y < this.sim.gridSize - 1 && this.sim.grid[x][y + 1].type === 'road';
    const E = x < this.sim.gridSize - 1 && this.sim.grid[x + 1][y].type === 'road';
    const W = x > 0 && this.sim.grid[x - 1][y].type === 'road';

    const connectionCount = [N, S, E, W].filter(Boolean).length;
    if (connectionCount === 2) {
      const H_C = tile.elevation || 0;
      if (N && S && !E && !W) {
        const H_N = this.sim.grid[x][y - 1].elevation || 0;
        const H_S = this.sim.grid[x][y + 1].elevation || 0;
        const y_N = Math.max(H_C, H_N) * 0.8;
        const y_S = Math.max(H_C, H_S) * 0.8;
        if (y_N !== y_S) return true;
      } else if (E && W && !N && !S) {
        const H_E = this.sim.grid[x + 1][y].elevation || 0;
        const H_W = this.sim.grid[x - 1][y].elevation || 0;
        const y_E = Math.max(H_C, H_E) * 0.8;
        const y_W = Math.max(H_C, H_W) * 0.8;
        if (y_E !== y_W) return true;
      }
    }

    return false;
  }

  computeEdgeFlags(x: number, z: number): {
    edges: [number, number, number, number];
    corners: [number, number, number, number];
  } {
    const sim = this.sim;
    if (!sim) return { edges: [0, 0, 0, 0], corners: [0, 0, 0, 0] };
    const size = 50;
    if (x < 0 || x >= size || z < 0 || z >= size) {
      return { edges: [0, 0, 0, 0], corners: [0, 0, 0, 0] };
    }

    const isRoadTile = (tx: number, tz: number): boolean => {
      if (tx < 0 || tx >= size || tz < 0 || tz >= size) return false;
      const t = sim.grid[tx][tz];
      return t.type === 'road' || t.type === 'boardwalk' || t.bridge === true || this.isSlopedRoad(tx, tz);
    };

    const tile = sim.grid[x][z];
    const isWaterOrBridge = tile.type === 'water_body' || tile.bridge === true || this.isSlopedRoad(x, z);
    if (isWaterOrBridge) {
      return { edges: [0, 0, 0, 0], corners: [0, 0, 0, 0] };
    }

    const isBoundaryExposed = (x1: number, z1: number, x2: number, z2: number): boolean => {
      const in1 = x1 >= 0 && x1 < size && z1 >= 0 && z1 < size;
      const in2 = x2 >= 0 && x2 < size && z2 >= 0 && z2 < size;
      if (!in1 && !in2) return false;
      if (!in1) return (sim.grid[x2][z2].elevation || 0) > 0;
      if (!in2) return (sim.grid[x1][z1].elevation || 0) > 0;

      // Only the edge where the road slopes down is flat
      if (this.isSlopedRoad(x1, z1) || this.isSlopedRoad(x2, z2)) {
        return false;
      }

      const t1 = sim.grid[x1][z1];
      const t2 = sim.grid[x2][z2];

      const w1 = t1.type === 'water_body' || t1.bridge === true;
      const w2 = t2.type === 'water_body' || t2.bridge === true;

      if (w1 !== w2) return true;
      if (w1 && w2) return false;
      return (t1.elevation || 0) !== (t2.elevation || 0);
    };

    const N = isBoundaryExposed(x, z, x, z - 1) ? 1 : 0;
    const E = isBoundaryExposed(x, z, x + 1, z) ? 1 : 0;
    const S = isBoundaryExposed(x, z, x, z + 1) ? 1 : 0;
    const W = isBoundaryExposed(x, z, x - 1, z) ? 1 : 0;

    const isCornerExposed = (gx: number, gz: number): number => {
      // Anchor corners touching road/ramp boundaries to 0.0 so corner grass triangles don't poke into roads
      if (isRoadTile(gx - 1, gz - 1) || isRoadTile(gx, gz - 1) || isRoadTile(gx - 1, gz) || isRoadTile(gx, gz)) {
        return 0.0;
      }
      const b1 = isBoundaryExposed(gx - 1, gz - 1, gx, gz - 1);
      const b2 = isBoundaryExposed(gx, gz - 1, gx, gz);
      const b3 = isBoundaryExposed(gx - 1, gz, gx, gz);
      const b4 = isBoundaryExposed(gx - 1, gz - 1, gx - 1, gz);
      return (b1 || b2 || b3 || b4) ? 1.0 : 0.0;
    };

    const NW = isCornerExposed(x, z);
    const NE = isCornerExposed(x + 1, z);
    const SE = isCornerExposed(x + 1, z + 1);
    const SW = isCornerExposed(x, z + 1);

    return {
      edges: [N, E, S, W],
      corners: [NW, NE, SE, SW]
    };
  }

  /**
   * Per-side elevation role for the grass-cap shader: +1 means this tile is
   * the upper lip of a drop, -1 means it is the lower receiving tile.
   */
  private computeCliffEdgeRoles(x: number, z: number): [number, number, number, number] {
    const sim = this.sim;
    if (!sim) return [0, 0, 0, 0];

    const size = sim.gridSize;
    const tile = sim.grid[x][z];
    if (tile.type === 'water_body' || tile.bridge || this.isSlopedRoad(x, z)) {
      return [0, 0, 0, 0];
    }

    const roleAt = (nx: number, nz: number): number => {
      if (nx < 0 || nx >= size || nz < 0 || nz >= size) {
        return (tile.elevation || 0) > 0 ? 1 : 0;
      }
      if (this.isSlopedRoad(nx, nz)) return 0;

      const neighbor = sim.grid[nx][nz];
      if (neighbor.bridge) return 0;
      const elevationDelta = (tile.elevation || 0) - (neighbor.elevation || 0);
      return elevationDelta > 0 ? 1 : elevationDelta < 0 ? -1 : 0;
    };

    return [
      roleAt(x, z - 1),
      roleAt(x + 1, z),
      roleAt(x, z + 1),
      roleAt(x - 1, z),
    ];
  }

  /**
   * Concave corners use complementary diagonal roles: the upper diagonal tile
   * closes the light lip, while the recessed lower tile closes the shadow.
   */
  private computeCliffCornerRoles(x: number, z: number): [number, number, number, number] {
    const sim = this.sim;
    if (!sim) return [0, 0, 0, 0];

    const size = sim.gridSize;
    const tile = sim.grid[x][z];
    if (tile.type === 'water_body' || tile.bridge || this.isSlopedRoad(x, z)) {
      return [0, 0, 0, 0];
    }

    const concaveCornerRole = (dx: number, dz: number): number => {
      const diagonalX = x + dx;
      const diagonalZ = z + dz;
      const cardinalAX = x + dx;
      const cardinalAZ = z;
      const cardinalBX = x;
      const cardinalBZ = z + dz;
      if (
        diagonalX < 0 || diagonalX >= size || diagonalZ < 0 || diagonalZ >= size ||
        cardinalAX < 0 || cardinalAX >= size || cardinalAZ < 0 || cardinalAZ >= size ||
        cardinalBX < 0 || cardinalBX >= size || cardinalBZ < 0 || cardinalBZ >= size
      ) return 0;

      const diagonal = sim.grid[diagonalX][diagonalZ];
      const cardinalA = sim.grid[cardinalAX][cardinalAZ];
      const cardinalB = sim.grid[cardinalBX][cardinalBZ];
      if (diagonal.bridge || cardinalA.bridge || cardinalB.bridge) return 0;

      const elevation = tile.elevation || 0;
      const diagonalElevation = diagonal.elevation || 0;
      const cardinalAElevation = cardinalA.elevation || 0;
      const cardinalBElevation = cardinalB.elevation || 0;

      // The high tile diagonally across a recessed corner fills the light-lip
      // gap. A shadow corner is instead defined by its two higher cardinal
      // neighbors, whether the diagonal continues the low ground or not.
      if (elevation > diagonalElevation &&
        elevation === cardinalAElevation &&
        elevation === cardinalBElevation) return 1;
      if (elevation < cardinalAElevation &&
        elevation < cardinalBElevation) return -1;
      return 0;
    };

    return [
      concaveCornerRole(-1, -1),
      concaveCornerRole(1, -1),
      concaveCornerRole(1, 1),
      concaveCornerRole(-1, 1),
    ];
  }

  private updateGroundEdgeFlagsForTile(x: number, z: number) {
    if (!this.sim || !this.groundMesh) return;
    const size = 50;
    if (x < 0 || x >= size || z < 0 || z >= size) return;
    const index = x * size + z;
    const { edges, corners } = this.computeEdgeFlags(x, z);
    const cliffEdgeRoles = this.computeCliffEdgeRoles(x, z);
    const cliffCornerRoles = this.computeCliffCornerRoles(x, z);
    const eAttr = this.groundMesh.geometry.getAttribute('aEdgeFlags') as THREE.InstancedBufferAttribute;
    const cAttr = this.groundMesh.geometry.getAttribute('aCornerFlags') as THREE.InstancedBufferAttribute;
    const cliffRoleAttr = this.groundMesh.geometry.getAttribute('aCliffEdgeRoles') as THREE.InstancedBufferAttribute;
    const cliffCornerRoleAttr = this.groundMesh.geometry.getAttribute('aCliffCornerRoles') as THREE.InstancedBufferAttribute;
    if (eAttr) {
      eAttr.setXYZW(index, edges[0], edges[1], edges[2], edges[3]);
      eAttr.needsUpdate = true;
    }
    if (cAttr) {
      cAttr.setXYZW(index, corners[0], corners[1], corners[2], corners[3]);
      cAttr.needsUpdate = true;
    }
    if (cliffRoleAttr) {
      cliffRoleAttr.setXYZW(index, cliffEdgeRoles[0], cliffEdgeRoles[1], cliffEdgeRoles[2], cliffEdgeRoles[3]);
      cliffRoleAttr.needsUpdate = true;
    }
    if (cliffCornerRoleAttr) {
      cliffCornerRoleAttr.setXYZW(index, cliffCornerRoles[0], cliffCornerRoles[1], cliffCornerRoles[2], cliffCornerRoles[3]);
      cliffCornerRoleAttr.needsUpdate = true;
    }
  }

  updateGroundInstance(x: number, y: number) {
    if (!this.sim) return;
    const tile = this.sim.grid[x][y];
    const isWaterOrBridge = tile.type === 'water_body' || tile.bridge === true || this.isSlopedRoad(x, y);
    
    const size = 50;
    const gridOffset = 25;
    const index = x * size + y;
    
    const dummy = new THREE.Object3D();
    if (isWaterOrBridge) {
      dummy.position.set(0, -100, 0); // Hide the grass tile underground
    } else {
      const xPos = (x - gridOffset) * 2;
      const zPos = (y - gridOffset) * 2;
      const elevation = tile.elevation || 0;
      dummy.position.set(xPos, elevation * 0.8, zPos);
    }
    dummy.updateMatrix();
    this.groundMesh.setMatrixAt(index, dummy.matrix);
    this.groundMesh.instanceMatrix.needsUpdate = true;

    // Update edge and corner flags for tile and surrounding 3x3 block
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        this.updateGroundEdgeFlagsForTile(x + dx, y + dy);
      }
    }

    // Scenery visibility and terrain height are both tile-derived. The queued
    // 3x3 refresh also covers water-boulder and shore-plant topology rules.
    this.environmentScenery?.markTileDirty(x, y, true);
  }

  rebuildEnvironmentScenery() {
    this.environmentScenery?.rebuildAll();
  }

  resetGroundInstances() {
    const size = 50;
    const gridOffset = 25;
    const dummy = new THREE.Object3D();
    let index = 0;
    const eAttr = this.groundMesh ? (this.groundMesh.geometry.getAttribute('aEdgeFlags') as THREE.InstancedBufferAttribute) : null;
    const cAttr = this.groundMesh ? (this.groundMesh.geometry.getAttribute('aCornerFlags') as THREE.InstancedBufferAttribute) : null;
    const cliffRoleAttr = this.groundMesh ? (this.groundMesh.geometry.getAttribute('aCliffEdgeRoles') as THREE.InstancedBufferAttribute) : null;
    const cliffCornerRoleAttr = this.groundMesh ? (this.groundMesh.geometry.getAttribute('aCliffCornerRoles') as THREE.InstancedBufferAttribute) : null;
    for (let x = 0; x < size; x++) {
      for (let z = 0; z < size; z++) {
        const tile = this.sim ? this.sim.grid[x][z] : null;
        const elevation = tile ? (tile.elevation || 0) : 0;
        const yPos = elevation * 0.8;
        const isWaterOrBridge = tile ? (tile.type === 'water_body' || tile.bridge === true || this.isSlopedRoad(x, z)) : false;

        const xPos = (x - gridOffset) * 2;
        const zPos = (z - gridOffset) * 2;
        
        if (isWaterOrBridge) {
          dummy.position.set(0, -100, 0);
          if (eAttr) eAttr.setXYZW(index, 0, 0, 0, 0);
          if (cAttr) cAttr.setXYZW(index, 0, 0, 0, 0);
          if (cliffRoleAttr) cliffRoleAttr.setXYZW(index, 0, 0, 0, 0);
          if (cliffCornerRoleAttr) cliffCornerRoleAttr.setXYZW(index, 0, 0, 0, 0);
        } else {
          dummy.position.set(xPos, yPos, zPos);
          if (eAttr || cAttr || cliffRoleAttr || cliffCornerRoleAttr) {
            const { edges, corners } = this.computeEdgeFlags(x, z);
            const cliffEdgeRoles = this.computeCliffEdgeRoles(x, z);
            const cliffCornerRoles = this.computeCliffCornerRoles(x, z);
            if (eAttr) eAttr.setXYZW(index, edges[0], edges[1], edges[2], edges[3]);
            if (cAttr) cAttr.setXYZW(index, corners[0], corners[1], corners[2], corners[3]);
            if (cliffRoleAttr) cliffRoleAttr.setXYZW(index, cliffEdgeRoles[0], cliffEdgeRoles[1], cliffEdgeRoles[2], cliffEdgeRoles[3]);
            if (cliffCornerRoleAttr) cliffCornerRoleAttr.setXYZW(index, cliffCornerRoles[0], cliffCornerRoles[1], cliffCornerRoles[2], cliffCornerRoles[3]);
          }
        }
        dummy.updateMatrix();
        this.groundMesh.setMatrixAt(index++, dummy.matrix);
      }
    }
    this.groundMesh.instanceMatrix.needsUpdate = true;
    if (eAttr) eAttr.needsUpdate = true;
    if (cAttr) cAttr.needsUpdate = true;
    if (cliffRoleAttr) cliffRoleAttr.needsUpdate = true;
    if (cliffCornerRoleAttr) cliffCornerRoleAttr.needsUpdate = true;
  }

  // Render individual zoned structures on state changes
  private createConstructionSiteMesh(): THREE.Group {
    const group = new THREE.Group();
    const foundationMaterial = this.assets.materials.constructionFoundation;
    const frameMaterial = this.assets.materials.constructionFrame;

    const foundation = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.08, 1.7), foundationMaterial);
    foundation.position.y = 0.04;
    group.add(foundation);

    for (const [x, z] of [[-0.62, -0.62], [0.62, -0.62], [-0.62, 0.62], [0.62, 0.62]]) {
      const stake = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.62, 0.09), frameMaterial);
      stake.position.set(x, 0.35, z);
      group.add(stake);
    }

    return group;
  }

  private clearConstructionOverlays() {
    this.constructionOverlays.forEach(overlay => overlay.remove());
    this.constructionOverlays.clear();
    this.constructionOverlaysDirty = true;
  }

  /**
   * Construction progress is simulation-driven, while its screen placement is
   * camera-driven. Keep both updates off the render loop until one changes.
   */
  private markConstructionOverlaysDirty() {
    this.constructionOverlaysDirty = true;
  }

  private updateConstructionOverlays() {
    if (!this.constructionOverlaysDirty) return;
    if (!this.sim) return;
    const root = document.getElementById('construction-progress-overlays');
    if (!root) return;
    this.constructionOverlaysDirty = false;
    this.camera.updateMatrixWorld();
    const activeKeys = new Set<string>();
    const canvasBounds = this.renderer.domElement.getBoundingClientRect();
    const gridOffset = 25;
    const overlayMode = this.cameraZoom >= 18 ? 'full' : this.cameraZoom >= 11 ? 'compact' : 'hidden';

    for (const row of this.sim.grid) for (const tile of row) {
      if (tile.constructionStatus !== 'planned' && tile.constructionStatus !== 'building') continue;
      const key = `${tile.x},${tile.y}`;
      activeKeys.add(key);
      let overlay = this.constructionOverlays.get(key);
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'construction-progress-overlay';
        overlay.innerHTML = `<span class="construction-compact-icon" aria-hidden="true">⚒</span><span class="construction-warning-icon" aria-hidden="true">⚠</span><span class="construction-progress-label"></span><div class="construction-progress-track"><div class="construction-progress-fill"></div></div>`;
        root.appendChild(overlay);
        this.constructionOverlays.set(key, overlay);
      }
      const percent = Math.round(tile.constructionProgress ?? 0);
      const label = overlay.querySelector<HTMLElement>('.construction-progress-label');
      const fill = overlay.querySelector<HTMLElement>('.construction-progress-fill');
      const compactIcon = overlay.querySelector<HTMLElement>('.construction-compact-icon');
      const waitingFor = tile.constructionStatus === 'planned' ? (tile.constructionBlockers ?? []) : [];
      const blocked = waitingFor.length > 0;
      overlay.classList.toggle('is-blocked', blocked);
      overlay.classList.toggle('is-compact', overlayMode === 'compact');
      if (compactIcon) compactIcon.textContent = blocked ? '⚠' : '⚒';
      if (label) label.textContent = blocked ? `Waiting: ${waitingFor.join(' · ')}` : `Building ${percent}%`;
      if (fill) fill.style.width = blocked ? '0%' : `${percent}%`;

      this.overlayWorldPosition.set((tile.x - gridOffset) * 2, (tile.elevation || 0) * 0.8 + 1.05, (tile.y - gridOffset) * 2).project(this.camera);
      const inViewport =
        this.overlayWorldPosition.x >= -1 && this.overlayWorldPosition.x <= 1 &&
        this.overlayWorldPosition.y >= -1 && this.overlayWorldPosition.y <= 1 &&
        this.overlayWorldPosition.z >= -1 && this.overlayWorldPosition.z <= 1;
      const visible = overlayMode !== 'hidden' && inViewport;
      overlay.style.display = visible ? '' : 'none';
      if (visible) {
        overlay.style.left = `${canvasBounds.left + (this.overlayWorldPosition.x * 0.5 + 0.5) * canvasBounds.width}px`;
        overlay.style.top = `${canvasBounds.top + (-this.overlayWorldPosition.y * 0.5 + 0.5) * canvasBounds.height}px`;
        // DOM overlays are outside WebGL's depth buffer, so mirror its depth order.
        // Nearer tiles receive a larger stacking value and remain readable on top.
        overlay.style.zIndex = String(Math.round((1 - this.overlayWorldPosition.z) * 10_000));
      }
    }
    for (const [key, overlay] of this.constructionOverlays) {
      if (!activeKeys.has(key)) {
        overlay.remove();
        this.constructionOverlays.delete(key);
      }
    }
  }

  updateTileMesh(tile: TileState) {
    const key = `${tile.x},${tile.y}`;
    const oldMesh = this.buildingMeshes.get(key);
    // A new or completed construction site can add or remove its HTML overlay.
    // Other tile mesh changes do not affect this overlay layer.
    if (
      tile.constructionStatus === 'planned' ||
      tile.constructionStatus === 'building' ||
      this.constructionOverlays.has(key)
    ) {
      this.markConstructionOverlaysDirty();
    }
    const targetRotation = this.calculateTileRotation(tile);
    const neighborsHash = this.computeNeighborsHash(tile);

    if (oldMesh) {
      // Visuals are already up to date, avoid rebuilding and flickering!
      if (
        oldMesh.userData &&
        oldMesh.userData.type === tile.type &&
        oldMesh.userData.level === tile.level &&
        oldMesh.userData.constructionStatus === tile.constructionStatus &&
        oldMesh.userData.rotation === targetRotation &&
        oldMesh.userData.neighborsHash === neighborsHash
      ) {
        return;
      }

      this.scene.remove(oldMesh);
      this.disposeObject3D(oldMesh);
      this.buildingMeshes.delete(key);
      this.turbineRotors.delete(key);
    }

    this.updateGroundInstance(tile.x, tile.y);

    if (tile.type === 'empty') return;

    let newMesh: THREE.Group | null = null;
    const gridOffset = 25;
    const xPos = (tile.x - gridOffset) * 2;
    const zPos = (tile.y - gridOffset) * 2;

    if (tile.constructionStatus === 'planned' || tile.constructionStatus === 'building') {
      newMesh = this.createConstructionSiteMesh();
    } else switch (tile.type) {
      case 'road':
        // Determine road neighbors (we will delegate connection computation in input or coordinator)
        break;
      case 'residential':
        newMesh = this.assets.createResidentialMesh(tile.level, tile.x, tile.y);
        break;
      case 'commercial':
        newMesh = this.assets.createCommercialMesh(tile.level, tile.x, tile.y);
        break;
      case 'industrial':
        newMesh = this.assets.createIndustrialMesh(tile.level);
        break;
      case 'power':
        newMesh = this.assets.createWindTurbineMesh();
        break;
      case 'water':
        newMesh = this.assets.createWaterTowerMesh();
        break;
      case 'park':
        newMesh = this.assets.createParkMesh();
        break;
      case 'water_body':
        const neighbors = {
          N: tile.y > 0 && (this.sim ? (this.sim.grid[tile.x][tile.y - 1].type === 'water_body' || this.sim.grid[tile.x][tile.y - 1].bridge === true) : false),
          S: tile.y < (this.sim ? this.sim.gridSize - 1 : 49) && (this.sim ? (this.sim.grid[tile.x][tile.y + 1].type === 'water_body' || this.sim.grid[tile.x][tile.y + 1].bridge === true) : false),
          E: tile.x < (this.sim ? this.sim.gridSize - 1 : 49) && (this.sim ? (this.sim.grid[tile.x + 1][tile.y].type === 'water_body' || this.sim.grid[tile.x + 1][tile.y].bridge === true) : false),
          W: tile.x > 0 && (this.sim ? (this.sim.grid[tile.x - 1][tile.y].type === 'water_body' || this.sim.grid[tile.x - 1][tile.y].bridge === true) : false)
        };
        const hasExposedWaterEdge = (x: number, y: number) => {
          if (!this.sim || x < 0 || x >= this.sim.gridSize || y < 0 || y >= this.sim.gridSize) return true;
          const neighbor = this.sim.grid[x][y];
          // Any exposed water edge receives the shared shoreline line, including
          // boardwalk-facing edges. Continuous water and bridge spans remain
          // unlined so they keep their uninterrupted surface.
          return neighbor.type !== 'water_body' && !neighbor.bridge;
        };
        const hasWaterConnection = (x: number, y: number) => {
          if (!this.sim || x < 0 || x >= this.sim.gridSize || y < 0 || y >= this.sim.gridSize) return false;
          const neighbor = this.sim.grid[x][y];
          return neighbor.type === 'water_body' || neighbor.bridge === true;
        };
        const shoreEdges = {
          N: hasExposedWaterEdge(tile.x, tile.y - 1),
          S: hasExposedWaterEdge(tile.x, tile.y + 1),
          E: hasExposedWaterEdge(tile.x + 1, tile.y),
          W: hasExposedWaterEdge(tile.x - 1, tile.y)
        };
        const diagonalNeighbors = {
          NW: hasWaterConnection(tile.x - 1, tile.y - 1),
          NE: hasWaterConnection(tile.x + 1, tile.y - 1),
          SE: hasWaterConnection(tile.x + 1, tile.y + 1),
          SW: hasWaterConnection(tile.x - 1, tile.y + 1),
        };
        // A concave shoreline turn has water on both cardinal sides of a
        // corner and land/boardwalk on the diagonal. The two line strips are
        // emitted by those cardinal water tiles, so this diagonal water tile
        // contributes the precise inset cap that joins them.
        const innerCorners = {
          NW: hasWaterConnection(tile.x, tile.y - 1) && hasWaterConnection(tile.x - 1, tile.y) && !diagonalNeighbors.NW,
          NE: hasWaterConnection(tile.x, tile.y - 1) && hasWaterConnection(tile.x + 1, tile.y) && !diagonalNeighbors.NE,
          SE: hasWaterConnection(tile.x, tile.y + 1) && hasWaterConnection(tile.x + 1, tile.y) && !diagonalNeighbors.SE,
          SW: hasWaterConnection(tile.x, tile.y + 1) && hasWaterConnection(tile.x - 1, tile.y) && !diagonalNeighbors.SW,
        };
        // A one-edge corner feeds into an inset concave cap owned by another
        // water tile. The secondary, inward band extends by one band width at
        // that end so it reaches the cap without a visible break.
        const innerJoinCorners = {
          NW: !hasWaterConnection(tile.x - 1, tile.y - 1) && shoreEdges.N !== shoreEdges.W,
          NE: !hasWaterConnection(tile.x + 1, tile.y - 1) && shoreEdges.N !== shoreEdges.E,
          SE: !hasWaterConnection(tile.x + 1, tile.y + 1) && shoreEdges.S !== shoreEdges.E,
          SW: !hasWaterConnection(tile.x - 1, tile.y + 1) && shoreEdges.S !== shoreEdges.W,
        };
        newMesh = this.assets.createWaterBodyMesh(tile.x, tile.y, neighbors, diagonalNeighbors, shoreEdges, innerCorners, innerJoinCorners);
        break;
      case 'boardwalk':
        const boardwalkNeighbors = {
          N: tile.y > 0 && (this.sim ? this.sim.grid[tile.x][tile.y - 1].type === 'boardwalk' : false),
          S: tile.y < (this.sim ? this.sim.gridSize - 1 : 49) && (this.sim ? this.sim.grid[tile.x][tile.y + 1].type === 'boardwalk' : false),
          E: tile.x < (this.sim ? this.sim.gridSize - 1 : 49) && (this.sim ? this.sim.grid[tile.x + 1][tile.y].type === 'boardwalk' : false),
          W: tile.x > 0 && (this.sim ? this.sim.grid[tile.x - 1][tile.y].type === 'boardwalk' : false)
        };
        const waterNeighbors = {
          N: tile.y > 0 && (this.sim ? (this.sim.grid[tile.x][tile.y - 1].type === 'water_body' || this.sim.grid[tile.x][tile.y - 1].bridge === true) : false),
          S: tile.y < (this.sim ? this.sim.gridSize - 1 : 49) && (this.sim ? (this.sim.grid[tile.x][tile.y + 1].type === 'water_body' || this.sim.grid[tile.x][tile.y + 1].bridge === true) : false),
          E: tile.x < (this.sim ? this.sim.gridSize - 1 : 49) && (this.sim ? (this.sim.grid[tile.x + 1][tile.y].type === 'water_body' || this.sim.grid[tile.x + 1][tile.y].bridge === true) : false),
          W: tile.x > 0 && (this.sim ? (this.sim.grid[tile.x - 1][tile.y].type === 'water_body' || this.sim.grid[tile.x - 1][tile.y].bridge === true) : false)
        };
        newMesh = this.assets.createBoardwalkMesh(tile.x, tile.y, boardwalkNeighbors, waterNeighbors);
        break;
    }

    if (newMesh) {
      if (tile.constructionStatus !== 'planned' && tile.constructionStatus !== 'building') newMesh = this.assets.mergeMeshesByMaterial(newMesh);
      const tileElevation = tile.elevation || 0;
      const baseHeight = tileElevation * 0.8;
      const yOffset = tile.type === 'residential' ? -0.06 : 0;
      newMesh.position.set(xPos, baseHeight + yOffset, zPos);
      if (tile.type === 'residential' || tile.type === 'commercial' || tile.type === 'industrial') {
        newMesh.rotation.y = targetRotation;
      }
      newMesh.userData = { 
        type: tile.type, 
        level: tile.level, 
        constructionStatus: tile.constructionStatus,
        rotation: targetRotation,
        neighborsHash: neighborsHash
      };
      
      // Shadow casting configurations
      newMesh.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          const isWater = child.material === this.assets.materials.waterBlue;
          const isShoreFoam = child.material === this.assets.materials.waterShoreFoam;
          const isInnerShoreFoam = child.material === this.assets.materials.waterShoreFoamInner;
          const isWaterSurface = isWater || isShoreFoam || isInnerShoreFoam;
          child.castShadow = !isWaterSurface;
          child.receiveShadow = !isWaterSurface;

          // Both surfaces are transparent and are material-merged into the same
          // tile group. Make their painter order explicit so the water cannot
          // blend over the shallow shoreline ribbon and hide it.
          if (isWater) child.renderOrder = 1;
          if (isInnerShoreFoam) child.renderOrder = 2;
          if (isShoreFoam) child.renderOrder = 3;
        }
      });

      this.scene.add(newMesh);
      this.buildingMeshes.set(key, newMesh);
      this.streetFurnitureDirty = true;
      const rotor = newMesh.getObjectByName('turbine_rotor');
      if (rotor) {
        this.turbineRotors.set(key, rotor);
      }
    }
  }

  computeNeighborsHash(tile: TileState): string {
    if (tile.type !== 'water_body' && tile.type !== 'boardwalk') {
      return '';
    }

    if (!this.sim) return '';

    const N = tile.y > 0 ? this.sim.grid[tile.x][tile.y - 1].type : 'none';
    const S = tile.y < this.sim.gridSize - 1 ? this.sim.grid[tile.x][tile.y + 1].type : 'none';
    const E = tile.x < this.sim.gridSize - 1 ? this.sim.grid[tile.x + 1][tile.y].type : 'none';
    const W = tile.x > 0 ? this.sim.grid[tile.x - 1][tile.y].type : 'none';

    const Nb = tile.y > 0 ? (this.sim.grid[tile.x][tile.y - 1].bridge ? '1' : '0') : '0';
    const Sb = tile.y < this.sim.gridSize - 1 ? (this.sim.grid[tile.x][tile.y + 1].bridge ? '1' : '0') : '0';
    const Eb = tile.x < this.sim.gridSize - 1 ? (this.sim.grid[tile.x + 1][tile.y].bridge ? '1' : '0') : '0';
    const Wb = tile.x > 0 ? (this.sim.grid[tile.x - 1][tile.y].bridge ? '1' : '0') : '0';

    const diagonalMarker = (x: number, y: number) => {
      if (x < 0 || x >= this.sim!.gridSize || y < 0 || y >= this.sim!.gridSize) return 'none-0';
      const neighbor = this.sim!.grid[x][y];
      return `${neighbor.type}-${neighbor.bridge ? '1' : '0'}`;
    };

    // Shoreline underfill and both kinds of corner cap depend on diagonals as
    // well as cardinal neighbors. Including them prevents an unchanged water
    // tile from retaining stale corner geometry when a diagonal tile changes.
    const NW = diagonalMarker(tile.x - 1, tile.y - 1);
    const NE = diagonalMarker(tile.x + 1, tile.y - 1);
    const SE = diagonalMarker(tile.x + 1, tile.y + 1);
    const SW = diagonalMarker(tile.x - 1, tile.y + 1);

    return `N:${N}-${Nb}|S:${S}-${Sb}|E:${E}-${Eb}|W:${W}-${Wb}|NW:${NW}|NE:${NE}|SE:${SE}|SW:${SW}`;
  }

  // Special separate handler for roads since they connect
  updateRoadMesh(x: number, y: number, connections: { N: boolean; S: boolean; E: boolean; W: boolean }) {
    const key = `${x},${y}`;
    const oldMesh = this.buildingMeshes.get(key);

    if (oldMesh) {
      this.scene.remove(oldMesh);
      this.disposeObject3D(oldMesh);
      this.buildingMeshes.delete(key);
      this.turbineRotors.delete(key);
    }

    this.updateGroundInstance(x, y);

    const gridOffset = 25;
    const xPos = (x - gridOffset) * 2;
    const zPos = (y - gridOffset) * 2;

    const isBridge = this.sim ? (this.sim.grid[x][y].bridge || false) : false;
    const neighbors = {
      N: y > 0 && (this.sim ? (this.sim.grid[x][y - 1].type === 'water_body' || this.sim.grid[x][y - 1].bridge === true) : false),
      S: y < (this.sim ? this.sim.gridSize - 1 : 49) && (this.sim ? (this.sim.grid[x][y + 1].type === 'water_body' || this.sim.grid[x][y + 1].bridge === true) : false),
      E: x < (this.sim ? this.sim.gridSize - 1 : 49) && (this.sim ? (this.sim.grid[x + 1][y].type === 'water_body' || this.sim.grid[x + 1][y].bridge === true) : false),
      W: x > 0 && (this.sim ? (this.sim.grid[x - 1][y].type === 'water_body' || this.sim.grid[x - 1][y].bridge === true) : false)
    };
    let roadMesh = this.assets.createRoadMesh(connections, isBridge, neighbors, x, y);
    roadMesh = this.assets.mergeMeshesByMaterial(roadMesh);
    
    let yPos = this.sim ? (this.sim.grid[x][y].elevation || 0) * 0.8 : 0;
    if (this.sim) {
      const H_C = this.sim.grid[x][y].elevation || 0;
      const N_road = y > 0 && this.sim.grid[x][y - 1].type === 'road' && connections.N;
      const S_road = y < this.sim.gridSize - 1 && this.sim.grid[x][y + 1].type === 'road' && connections.S;
      const E_road = x < this.sim.gridSize - 1 && this.sim.grid[x + 1][y].type === 'road' && connections.E;
      const W_road = x > 0 && this.sim.grid[x - 1][y].type === 'road' && connections.W;
      const connectionCount = [N_road, S_road, E_road, W_road].filter(Boolean).length;
      if (connectionCount === 2 && !isBridge) {
        if (N_road && S_road) {
          const H_N = this.sim.grid[x][y - 1].elevation || 0;
          const H_S = this.sim.grid[x][y + 1].elevation || 0;
          const y_N = Math.max(H_C, H_N) * 0.8;
          const y_S = Math.max(H_C, H_S) * 0.8;
          if (y_N !== y_S) {
            yPos = (y_N + y_S) / 2;
          }
        } else if (E_road && W_road) {
          const H_E = this.sim.grid[x + 1][y].elevation || 0;
          const H_W = this.sim.grid[x - 1][y].elevation || 0;
          const y_E = Math.max(H_C, H_E) * 0.8;
          const y_W = Math.max(H_C, H_W) * 0.8;
          if (y_E !== y_W) {
            yPos = (y_E + y_W) / 2;
          }
        }
      }
    }

    roadMesh.position.set(xPos, yPos, zPos);
    this.scene.add(roadMesh);
    this.buildingMeshes.set(key, roadMesh);

    this.streetFurnitureDirty = true;
  }

  // Trigger building placement dust particles
  triggerPlacementParticles(x: number, y: number) {
    const gridOffset = 25;
    const xPos = (x - gridOffset) * 2;
    const zPos = (y - gridOffset) * 2;

    for (let i = 0; i < 8; i++) {
      const p = new THREE.Mesh(this.smokeGeometry, this.smokeMaterials[15]);
      p.position.set(
        xPos + (Math.random() - 0.5) * 1.5,
        0.1 + Math.random() * 0.4,
        zPos + (Math.random() - 0.5) * 1.5
      );
      this.scene.add(p);

      this.particles.push({
        mesh: p,
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 0.5,
          0.8 + Math.random() * 0.6,
          (Math.random() - 0.5) * 0.5
        ),
        life: 0,
        maxLife: 30 + Math.floor(Math.random() * 20),
      });
    }
  }

  // Trigger smoke particle for active factory chimneys
  emitChimneySmoke(xPos: number, yPos: number, zPos: number) {
    const p = new THREE.Mesh(this.smokeGeometry, this.smokeMaterials[15]);
    p.position.set(xPos, yPos, zPos);
    this.scene.add(p);

    this.particles.push({
      mesh: p,
      velocity: new THREE.Vector3(
        0.05 + (Math.random() - 0.5) * 0.1,
        0.3 + Math.random() * 0.2,
        0.05 + (Math.random() - 0.5) * 0.1
      ),
      life: 0,
      maxLife: 60 + Math.floor(Math.random() * 40),
    });
  }

  private applyAtmosphereProfile(
    from: AtmosphereProfile,
    to: AtmosphereProfile = from,
    transition = 0,
  ) {
    const t = THREE.MathUtils.clamp(transition, 0, 1);
    const blendColor = (output: THREE.Color, start: number, end: number) => {
      output.setHex(start);
      if (t > 0) output.lerp(this.atmosphereBlendTarget.setHex(end), t);
    };

    blendColor(this.atmosphereSkyColor, from.skyColor, to.skyColor);
    blendColor(this.atmosphereFogColor, from.fogColor, to.fogColor);
    blendColor(this.atmosphereSkyFillColor, from.skyFillColor, to.skyFillColor);
    blendColor(this.atmosphereGroundFillColor, from.groundFillColor, to.groundFillColor);
    blendColor(this.atmosphereSunColor, from.sunColor, to.sunColor);

    return {
      fogDensity: THREE.MathUtils.lerp(from.fogDensity, to.fogDensity, t),
      fillIntensity: THREE.MathUtils.lerp(from.fillIntensity, to.fillIntensity, t),
      sunIntensity: THREE.MathUtils.lerp(from.sunIntensity, to.sunIntensity, t),
    };
  }

  // Day/night transitions use one key, one non-shadowing sky fill, and fog.
  // The profiles change color, intensity, and depth together so distant terrain
  // continues to sit naturally in the same atmosphere as the sky.
  updateDayNightCycle(timeOfDay: number) {
    let sunX = 40;
    let sunY = 50;
    let sunZ = 20;
    let profileFrom = DAY_ATMOSPHERE;
    let profileTo = DAY_ATMOSPHERE;
    let profileTransition = 0;
    let isNight = false;

    if (this.shadowSettings.overrideSun) {
      // Preserve the sandbox's direct sun controls while keeping its backdrop
      // and fog consistent with the selected elevation.
      const azimuthRad = (this.shadowSettings.sunAzimuth * Math.PI) / 180;
      const elevationRad = (this.shadowSettings.sunElevation * Math.PI) / 180;
      const sunRadius = 60;

      sunY = Math.sin(elevationRad) * sunRadius;
      const horizontalDistance = Math.cos(elevationRad) * sunRadius;
      sunX = Math.cos(azimuthRad) * horizontalDistance;
      sunZ = Math.sin(azimuthRad) * horizontalDistance;

      const elevation = this.shadowSettings.sunElevation;
      if (elevation < 5) {
        profileFrom = NIGHT_ATMOSPHERE;
        isNight = true;
      } else if (elevation < 20) {
        profileFrom = NIGHT_ATMOSPHERE;
        profileTo = GOLDEN_HOUR_ATMOSPHERE;
        profileTransition = (elevation - 5) / 15;
      } else if (elevation < 45) {
        profileFrom = GOLDEN_HOUR_ATMOSPHERE;
        profileTo = DAY_ATMOSPHERE;
        profileTransition = (elevation - 20) / 25;
      }
    } else {
      // Sunrise at 06:00, solar noon at 12:00, and sunset at 18:00.
      const timeRad = ((timeOfDay - 6) / 24) * Math.PI * 2;
      const sunRadius = 60;
      sunX = Math.cos(timeRad) * sunRadius;
      sunY = Math.sin(timeRad) * sunRadius;
      sunZ = Math.sin(timeRad * 0.5) * 20;

      if (timeOfDay >= 18 && timeOfDay < 20) {
        profileFrom = GOLDEN_HOUR_ATMOSPHERE;
        profileTo = NIGHT_ATMOSPHERE;
        profileTransition = (timeOfDay - 18) / 2;
        isNight = true;
      } else if (timeOfDay >= 20 || timeOfDay < 5) {
        profileFrom = NIGHT_ATMOSPHERE;
        isNight = true;
      } else if (timeOfDay < 7) {
        profileFrom = NIGHT_ATMOSPHERE;
        profileTo = DAWN_ATMOSPHERE;
        profileTransition = (timeOfDay - 5) / 2;
      } else if (timeOfDay < 8) {
        profileFrom = DAWN_ATMOSPHERE;
        profileTo = DAY_ATMOSPHERE;
        profileTransition = timeOfDay - 7;
      } else if (timeOfDay >= 17) {
        profileFrom = DAY_ATMOSPHERE;
        profileTo = GOLDEN_HOUR_ATMOSPHERE;
        profileTransition = timeOfDay - 17;
      }
    }

    const atmosphere = this.applyAtmosphereProfile(profileFrom, profileTo, profileTransition);

    if (this.shadowSettings.overrideSun) {
      this.atmosphereSunColor.setStyle(this.shadowSettings.sunColor);
      this.atmosphereSkyFillColor.setStyle(this.shadowSettings.ambientColor);
      // Ground bounce stays intentionally muted even with a bright user-selected sky fill.
      this.atmosphereGroundFillColor.setHex(0x4d5a4b).lerp(this.atmosphereSkyFillColor, 0.22);
      atmosphere.sunIntensity = this.shadowSettings.sunIntensity;
      atmosphere.fillIntensity = this.shadowSettings.ambientIntensity;
    }

    this.assets.setNightMode(isNight);

    // Cache the calculated offset for the render loop / camera position update.
    this.currentSunOffset.set(sunX, Math.max(1.0, sunY), sunZ);

    if (this.dirLight) {
      this.dirLight.position.set(
        this.cameraTarget.x + sunX,
        Math.max(1.0, sunY),
        this.cameraTarget.z + sunZ,
      );
      this.dirLight.target.position.copy(this.cameraTarget);
      this.dirLight.target.updateMatrixWorld();
      this.dirLight.color.copy(this.atmosphereSunColor);
      this.dirLight.intensity = atmosphere.sunIntensity;
    }

    if (this.skyFillLight) {
      this.skyFillLight.color.copy(this.atmosphereSkyFillColor);
      this.skyFillLight.groundColor.copy(this.atmosphereGroundFillColor);
      this.skyFillLight.intensity = atmosphere.fillIntensity;
    }

    if (this.scene) {
      if (this.scene.background instanceof THREE.Color) {
        this.scene.background.copy(this.atmosphereSkyColor);
      } else {
        this.scene.background = this.atmosphereSkyColor.clone();
      }
      if (this.scene.fog instanceof THREE.FogExp2) {
        this.scene.fog.color.copy(this.atmosphereFogColor);
        this.scene.fog.density = atmosphere.fogDensity;
      }
    }
  }

  // Animation ticks for particles and spinning turbines
  animate(timeStep: number) {
    if (this.streetFurnitureDirty) {
      this.rebuildStreetFurniture();
      this.streetFurnitureDirty = false;
    }

    // 0. Smoothly interpolate renderTimeOfDay to catch up with simulation timeOfDay in real-time
    if (this.sim) {
      if (this.sim.speed === 0) {
        this.renderTimeOfDay = this.sim.timeOfDay;
        this.isInterpolating = false;
      } else {
        const baseInterval = 2000;
        this.tickDuration = baseInterval / this.sim.speed;

        if (this.isInterpolating) {
          const now = performance.now();
          const elapsed = now - this.lastTickTime;
          const progress = Math.min(1.0, elapsed / this.tickDuration);

          // Calculate circular diff
          let diff = this.targetTickTimeOfDay - this.lastTickTimeOfDay;
          if (diff > 12) {
            diff -= 24;
          } else if (diff < -12) {
            diff += 24;
          }

          this.renderTimeOfDay = this.lastTickTimeOfDay + progress * diff;

          // Enforce 0-24 bounds
          if (this.renderTimeOfDay >= 24) this.renderTimeOfDay -= 24;
          if (this.renderTimeOfDay < 0) this.renderTimeOfDay += 24;

          if (progress >= 1.0) {
            this.isInterpolating = false;
          }
        } else {
          this.renderTimeOfDay = this.sim.timeOfDay;
        }
      }
      
      // Update lights, colors, sky, fog and shadow coordinates at 60 FPS
      this.updateDayNightCycle(this.renderTimeOfDay);
    }

    // 1. Update particles (physics simulation)
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.mesh.position.addScaledVector(p.velocity, timeStep);
      p.life += timeStep * 60;

      // Fade out opacity by assigning a pre-created material of the closest opacity level
      const opacityFraction = Math.max(0, Math.min(1, 1.0 - p.life / p.maxLife));
      const matIdx = Math.floor(opacityFraction * 15);
      p.mesh.material = this.smokeMaterials[matIdx];

      // Grow slightly
      p.mesh.scale.addScalar(timeStep * 0.12);

      if (p.life >= p.maxLife) {
        this.scene.remove(p.mesh);
        this.particles.splice(i, 1);
      }
    }

    // 2. Animate rotating elements (wind turbine blades)
    this.turbineRotors.forEach((rotor) => {
      rotor.rotation.z += 2.0 * timeStep;
    });

    // Animate water waves (uTime uniform update)
    if (this.assets.standardMaterials.waterBlue?.userData?.uTime) {
      this.assets.standardMaterials.waterBlue.userData.uTime.value += timeStep;
    }
    if (this.assets.toonMaterials.waterBlue?.userData?.uTime) {
      this.assets.toonMaterials.waterBlue.userData.uTime.value += timeStep;
    }
    if (this.assets.softToonMaterials.waterBlue?.userData?.uTime) {
      this.assets.softToonMaterials.waterBlue.userData.uTime.value += timeStep;
    }
    if (this.assets.standardMaterials.waterShoreFoam?.userData?.uTime) {
      this.assets.standardMaterials.waterShoreFoam.userData.uTime.value += timeStep;
    }
    if (this.assets.toonMaterials.waterShoreFoam?.userData?.uTime) {
      this.assets.toonMaterials.waterShoreFoam.userData.uTime.value += timeStep;
    }
    if (this.assets.softToonMaterials.waterShoreFoam?.userData?.uTime) {
      this.assets.softToonMaterials.waterShoreFoam.userData.uTime.value += timeStep;
    }
    if (this.assets.standardMaterials.waterShoreFoamInner?.userData?.uTime) {
      this.assets.standardMaterials.waterShoreFoamInner.userData.uTime.value += timeStep;
    }
    if (this.assets.toonMaterials.waterShoreFoamInner?.userData?.uTime) {
      this.assets.toonMaterials.waterShoreFoamInner.userData.uTime.value += timeStep;
    }
    if (this.assets.softToonMaterials.waterShoreFoamInner?.userData?.uTime) {
      this.assets.softToonMaterials.waterShoreFoamInner.userData.uTime.value += timeStep;
    }

    // 3. Smooth Camera Pan, Zoom, and Rotation Updates. Once the camera has
    // settled, skip the math, projection update, shadow fitting, and overlay
    // repositioning until another camera input arrives.
    if (this.cameraNeedsSmoothing() && this.updateCameraSmoothing(timeStep)) {
      this.markConstructionOverlaysDirty();
    }
    this.updateConstructionOverlays();

    // 4. Update procedural traffic
    if (this.traffic) {
      this.traffic.update(timeStep);
    }

    // 5. Update procedural citizens
    if (this.citizens) {
      this.citizens.update(timeStep);
    }

    // Apply coalesced construction, demolition, and terrain-sculpting updates
    // immediately before rendering. No scenery matrices change on idle frames.
    this.environmentScenery?.refresh();

    // 6. Render composer passes
    this.composer.render();
  }

  // Camera Smoothing update method
  cameraNeedsSmoothing(): boolean {
    const isPanningWithKeyboard = Boolean(
      this.keysPressed['w'] || this.keysPressed['arrowup'] ||
      this.keysPressed['a'] || this.keysPressed['arrowleft'] ||
      this.keysPressed['s'] || this.keysPressed['arrowdown'] ||
      this.keysPressed['d'] || this.keysPressed['arrowright']
    );
    return isPanningWithKeyboard ||
      this.cameraTarget.distanceToSquared(this.desiredCameraTarget) >= 0.000001 ||
      Math.abs(this.desiredCameraZoom - this.cameraZoom) >= 0.0001 ||
      Math.abs(this.desiredAngleX - this.cameraAngleX) >= 0.0001 ||
      Math.abs(this.desiredAngleY - this.cameraAngleY) >= 0.0001;
  }

  updateCameraSmoothing(timeStep: number): boolean {
    const isPanningWithKeyboard = Boolean(
      this.keysPressed['w'] || this.keysPressed['arrowup'] ||
      this.keysPressed['a'] || this.keysPressed['arrowleft'] ||
      this.keysPressed['s'] || this.keysPressed['arrowdown'] ||
      this.keysPressed['d'] || this.keysPressed['arrowright']
    );
    const targetDeltaSq = this.cameraTarget.distanceToSquared(this.desiredCameraTarget);
    const zoomDelta = Math.abs(this.desiredCameraZoom - this.cameraZoom);
    const angleXDelta = Math.abs(this.desiredAngleX - this.cameraAngleX);
    const angleYDelta = Math.abs(this.desiredAngleY - this.cameraAngleY);
    const targetSettled = targetDeltaSq < 0.000001;
    const zoomSettled = zoomDelta < 0.0001;
    const anglesSettled = angleXDelta < 0.0001 && angleYDelta < 0.0001;

    if (!isPanningWithKeyboard && targetSettled && zoomSettled && anglesSettled) {
      return false;
    }

    // 1. Process Keyboard Panning
    if (isPanningWithKeyboard) {
      const forward = this.tempForward.set(0, 0, -1).applyQuaternion(this.camera.quaternion);
      const right = this.tempRight.set(1, 0, 0).applyQuaternion(this.camera.quaternion);
      forward.y = 0;
      right.y = 0;
      forward.normalize();
      right.normalize();

      const moveDir = this.tempMoveDir.set(0, 0, 0);
      if (this.keysPressed['w'] || this.keysPressed['arrowup']) moveDir.add(forward);
      if (this.keysPressed['s'] || this.keysPressed['arrowdown']) moveDir.addScaledVector(forward, -1);
      if (this.keysPressed['d'] || this.keysPressed['arrowright']) moveDir.add(right);
      if (this.keysPressed['a'] || this.keysPressed['arrowleft']) moveDir.addScaledVector(right, -1);

      if (moveDir.lengthSq() > 0) {
        moveDir.normalize();
        // Pan speed scales with zoom: pan faster when zoomed out, slower when zoomed in
        const panBaseSpeed = 35; // units per second
        const speed = panBaseSpeed * timeStep * (25 / this.cameraZoom);
        this.desiredCameraTarget.addScaledVector(moveDir, speed);

        // Clamp target to grid boundary (50x50 board)
        this.desiredCameraTarget.x = Math.max(-50, Math.min(50, this.desiredCameraTarget.x));
        this.desiredCameraTarget.z = Math.max(-50, Math.min(50, this.desiredCameraTarget.z));
      }
    }

    // A held pan key can be clamped at the map edge. In that case it does not
    // change the camera state, so avoid falling through to projection/shadow
    // work just because input is still active.
    if (
      this.cameraTarget.distanceToSquared(this.desiredCameraTarget) < 0.000001 &&
      Math.abs(this.desiredCameraZoom - this.cameraZoom) < 0.0001 &&
      Math.abs(this.desiredAngleX - this.cameraAngleX) < 0.0001 &&
      Math.abs(this.desiredAngleY - this.cameraAngleY) < 0.0001
    ) {
      return false;
    }

    // 2. Exponential decay interpolation (lerp) for smooth gliding
    const targetLerp = 1 - Math.exp(-12 * timeStep);
    const zoomLerp = 1 - Math.exp(-8 * timeStep);
    const angleLerp = 1 - Math.exp(-8 * timeStep);

    this.cameraTarget.lerp(this.desiredCameraTarget, targetLerp);
    this.cameraZoom += (this.desiredCameraZoom - this.cameraZoom) * zoomLerp;
    this.cameraAngleX += (this.desiredAngleX - this.cameraAngleX) * angleLerp;
    this.cameraAngleY += (this.desiredAngleY - this.cameraAngleY) * angleLerp;

    // End the asymptotic interpolation exactly so future idle frames can take
    // the fast path without imperceptible camera or DOM work.
    if (this.cameraTarget.distanceToSquared(this.desiredCameraTarget) < 0.000001) {
      this.cameraTarget.copy(this.desiredCameraTarget);
    }
    if (Math.abs(this.desiredCameraZoom - this.cameraZoom) < 0.0001) {
      this.cameraZoom = this.desiredCameraZoom;
    }
    if (Math.abs(this.desiredAngleX - this.cameraAngleX) < 0.0001) {
      this.cameraAngleX = this.desiredAngleX;
    }
    if (Math.abs(this.desiredAngleY - this.cameraAngleY) < 0.0001) {
      this.cameraAngleY = this.desiredAngleY;
    }

    // 3. Update Orthographic frustum based on smooth zoom
    const aspect = this.container.clientWidth / this.container.clientHeight;
    const frustumSize = 1000 / this.cameraZoom;
    this.camera.left = (frustumSize * aspect) / -2;
    this.camera.right = (frustumSize * aspect) / 2;
    this.camera.top = frustumSize / 2;
    this.camera.bottom = frustumSize / -2;

    // 4. Update scene positions
    this.updateCameraPosition();
    return true;
  }

  refreshSceneMaterials() {
    this.scene.traverse((node) => {
      if (node instanceof THREE.Mesh || node instanceof THREE.InstancedMesh) {
        if (node.material) {
          if (Array.isArray(node.material)) {
            node.material = node.material.map(material => this.assets.getMaterialForProfile(material));
          } else {
            node.material = this.assets.getMaterialForProfile(node.material);
          }
        }
      }
    });

    if (this.groundMesh) this.groundMesh.instanceMatrix.needsUpdate = true;
    if (this.trunkMesh) this.trunkMesh.instanceMatrix.needsUpdate = true;
    if (this.greenLeavesMesh) this.greenLeavesMesh.instanceMatrix.needsUpdate = true;
    if (this.blossomLeavesMesh) this.blossomLeavesMesh.instanceMatrix.needsUpdate = true;
    this.environmentScenery?.refreshMaterialProfile();
    this.citizens?.setMaterialProfile(this.assets.materialProfile);
  }

  onWindowResize() {
    const aspect = this.container.clientWidth / this.container.clientHeight;
    const frustumSize = 1000 / this.cameraZoom;

    this.camera.left = (frustumSize * aspect) / -2;
    this.camera.right = (frustumSize * aspect) / 2;
    this.camera.top = frustumSize / 2;
    this.camera.bottom = frustumSize / -2;

    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    if (this.composer) {
      this.composer.setSize(this.container.clientWidth, this.container.clientHeight);
    }
    this.updateShadowFrustum();
    this.markConstructionOverlaysDirty();
  }
}
