import * as THREE from 'three';
import { AssetGenerator } from './AssetGenerator';
import { Simulation, TileState } from './Simulation';
import { TrafficManager } from './TrafficManager';
import { CitizenManager } from './CitizenManager';
import { ROAD_LAYOUT, StreetscapeSettings, currentStreetscapeSettings } from './RoadLayout';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';

import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

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
  ambientLight!: THREE.AmbientLight;
  currentSunOffset = new THREE.Vector3(30, 40, 15);
  renderTimeOfDay = 8.0;

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
    ambientColor: '#ffffff',
    ambientIntensity: 0.6,
  };

  // Optimizations
  groundMesh!: THREE.InstancedMesh;
  // Scattered Forest Trees
  treesData: StaticTreeData[] = [];
  trunkMesh?: THREE.InstancedMesh;
  greenLeavesMesh?: THREE.InstancedMesh;
  blossomLeavesMesh?: THREE.InstancedMesh;

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
    const sharedMaterials = new Set<THREE.Material>();
    
    // Collect all shared materials
    Object.values(this.assets.materials).forEach(m => sharedMaterials.add(m));
    this.assets.palettes.forEach(p => {
      sharedMaterials.add(p.wall);
      sharedMaterials.add(p.roof);
      sharedMaterials.add(p.trim);
      sharedMaterials.add(p.brick);
    });
    this.assets.commercialPalettes.forEach(p => {
      sharedMaterials.add(p.wall);
      sharedMaterials.add(p.roof);
      sharedMaterials.add(p.trim);
      sharedMaterials.add(p.accent);
      sharedMaterials.add(p.brick);
    });

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
    this.scene.background = new THREE.Color(0xa5f3fc); // Warm light-blue day sky
    this.scene.fog = new THREE.FogExp2(0xa5f3fc, 0.005);
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
    this.container.appendChild(this.renderer.domElement);

    // Initialize the post-processing composer
    this.composer = new EffectComposer(this.renderer);

    // 1. Render Pass (render base scene)
    const renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(renderPass);


    // 3. Unreal Bloom Pass for glowing emissive windows & vehicle headlights.
    // UnrealBloomPass creates its internal source buffers at half this supplied
    // size. EffectComposer supplies drawing-buffer dimensions on resize, so this
    // keeps those buffers at exactly 50% of the renderer resolution.
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(this.container.clientWidth, this.container.clientHeight),
      0.25, // strength (cozy and soft)
      0.3,  // radius
      0.85  // threshold (only blooms bright glow elements)
    );
    this.composer.addPass(bloomPass);
  }

  initLights() {
    // Ambient Light (soft room glow)
    this.ambientLight = new THREE.AmbientLight(0xffffff, this.shadowSettings.ambientIntensity);
    this.scene.add(this.ambientLight);

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
    groundGeo.setAttribute('aEdgeFlags', edgeFlagsAttr);
    groundGeo.setAttribute('aCornerFlags', cornerFlagsAttr);

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
        edgeFlagsAttr.setXYZW(index, edges[0], edges[1], edges[2], edges[3]);
        cornerFlagsAttr.setXYZW(index, corners[0], corners[1], corners[2], corners[3]);
        index++;
      }
    }
    edgeFlagsAttr.needsUpdate = true;
    cornerFlagsAttr.needsUpdate = true;
    this.scene.add(this.groundMesh);

    // 2. Scattered Forest Trees (around borders or randomly as environment details) using InstancedMesh
    this.rebuildTrees();

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
    const gridSize = this.sim.gridSize;

    // Check neighbors: South (y+1) is +Z, North (y-1) is -Z, East (x+1) is +X, West (x-1) is -X.
    // Order of preference: South, North, East, West.
    const hasRoadSouth = y < gridSize - 1 && this.sim.grid[x][y + 1].type === 'road';
    const hasRoadNorth = y > 0 && this.sim.grid[x][y - 1].type === 'road';
    const hasRoadEast = x < gridSize - 1 && this.sim.grid[x + 1][y].type === 'road';
    const hasRoadWest = x > 0 && this.sim.grid[x - 1][y].type === 'road';

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

  private updateGroundEdgeFlagsForTile(x: number, z: number) {
    if (!this.sim || !this.groundMesh) return;
    const size = 50;
    if (x < 0 || x >= size || z < 0 || z >= size) return;
    const index = x * size + z;
    const { edges, corners } = this.computeEdgeFlags(x, z);
    const eAttr = this.groundMesh.geometry.getAttribute('aEdgeFlags') as THREE.InstancedBufferAttribute;
    const cAttr = this.groundMesh.geometry.getAttribute('aCornerFlags') as THREE.InstancedBufferAttribute;
    if (eAttr) {
      eAttr.setXYZW(index, edges[0], edges[1], edges[2], edges[3]);
      eAttr.needsUpdate = true;
    }
    if (cAttr) {
      cAttr.setXYZW(index, corners[0], corners[1], corners[2], corners[3]);
      cAttr.needsUpdate = true;
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

    this.updateTreesOnTile(x, y);
  }

  resetGroundInstances() {
    const size = 50;
    const gridOffset = 25;
    const dummy = new THREE.Object3D();
    let index = 0;
    const eAttr = this.groundMesh ? (this.groundMesh.geometry.getAttribute('aEdgeFlags') as THREE.InstancedBufferAttribute) : null;
    const cAttr = this.groundMesh ? (this.groundMesh.geometry.getAttribute('aCornerFlags') as THREE.InstancedBufferAttribute) : null;
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
        } else {
          dummy.position.set(xPos, yPos, zPos);
          if (eAttr || cAttr) {
            const { edges, corners } = this.computeEdgeFlags(x, z);
            if (eAttr) eAttr.setXYZW(index, edges[0], edges[1], edges[2], edges[3]);
            if (cAttr) cAttr.setXYZW(index, corners[0], corners[1], corners[2], corners[3]);
          }
        }
        dummy.updateMatrix();
        this.groundMesh.setMatrixAt(index++, dummy.matrix);
      }
    }
    this.groundMesh.instanceMatrix.needsUpdate = true;
    if (eAttr) eAttr.needsUpdate = true;
    if (cAttr) cAttr.needsUpdate = true;
  }

  // Render individual zoned structures on state changes
  private createConstructionSiteMesh(): THREE.Group {
    const group = new THREE.Group();
    const foundationMaterial = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.92, metalness: 0.05 });
    const frameMaterial = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.7, metalness: 0.08 });

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
        newMesh = this.assets.createWaterBodyMesh(tile.x, tile.y, neighbors);
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
          if (child.material === this.assets.materials.waterBlue) {
            child.castShadow = false;
          } else {
            child.castShadow = true;
          }
          child.receiveShadow = true;
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

    return `N:${N}-${Nb}|S:${S}-${Sb}|E:${E}-${Eb}|W:${W}-${Wb}`;
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

  // Day/Night transitions updating lights and sky color
  updateDayNightCycle(timeOfDay: number) {
    let sunX = 40;
    let sunY = 50;
    let sunZ = 20;
    
    let skyColor = new THREE.Color(0xa5f3fc); // Day
    let ambientIntensity = 0.6;
    let sunIntensity = 1.2;
    let sunColor = new THREE.Color(0xfffaf0);
    let fogColor = new THREE.Color(0xa5f3fc);
    let ambientColor = new THREE.Color(0xffffff);

    if (this.shadowSettings.overrideSun) {
      // Calculate coordinates from azimuth & elevation
      const azimuthRad = (this.shadowSettings.sunAzimuth * Math.PI) / 180;
      const elevationRad = (this.shadowSettings.sunElevation * Math.PI) / 180;
      const sunRadius = 60;

      sunY = Math.sin(elevationRad) * sunRadius;
      const horiz = Math.cos(elevationRad) * sunRadius;
      sunX = Math.cos(azimuthRad) * horiz;
      sunZ = Math.sin(azimuthRad) * horiz;

      sunColor.setStyle(this.shadowSettings.sunColor);
      sunIntensity = this.shadowSettings.sunIntensity;
      
      ambientColor.setStyle(this.shadowSettings.ambientColor);
      ambientIntensity = this.shadowSettings.ambientIntensity;

      // Adjust sky and fog based on elevation to keep scene immersive
      const elevDeg = this.shadowSettings.sunElevation;
      if (elevDeg < 5) {
        // Night
        skyColor.setHex(0x0f172a);
        fogColor.setHex(0x0f172a);
        this.assets.setNightMode(true);
      } else if (elevDeg < 20) {
        // Sunrise / Sunset transition
        const t = (elevDeg - 5) / 15;
        skyColor.lerpColors(new THREE.Color(0x1e1b4b), new THREE.Color(0xfdba74), t);
        fogColor.copy(skyColor);
        this.assets.setNightMode(false);
      } else {
        // Day
        skyColor.setHex(0xbae6fd);
        fogColor.setHex(0xbae6fd);
        this.assets.setNightMode(false);
      }
    } else {
      // Normalise time to angle: sunrise at 6:00, noon 12:00, sunset 18:00, midnight 00:00
      const timeRad = ((timeOfDay - 6) / 24) * Math.PI * 2;

      // Rotate Sun Position
      const sunRadius = 60;
      sunX = Math.cos(timeRad) * sunRadius;
      sunY = Math.sin(timeRad) * sunRadius;
      sunZ = Math.sin(timeRad * 0.5) * 20; // Slight side wobble

      if (timeOfDay >= 18.0 && timeOfDay < 20.0) {
        // Dusk / Sunset
        const t = (timeOfDay - 18.0) / 2.0;
        skyColor.lerpColors(new THREE.Color(0xfdba74), new THREE.Color(0x1e1b4b), t); // Sunset orange to night purple
        sunColor.lerpColors(new THREE.Color(0xf97316), new THREE.Color(0x020617), t);
        fogColor.copy(skyColor);
        sunIntensity = 1.2 * (1 - t);
        ambientIntensity = 0.6 - 0.4 * t;
        this.assets.setNightMode(true);
      } else if (timeOfDay >= 20.0 || timeOfDay < 5.0) {
        // Night
        skyColor.setHex(0x0f172a); // Deep blue-black
        sunIntensity = 0.0;
        ambientIntensity = 0.15;
        fogColor.setHex(0x0f172a);
        this.assets.setNightMode(true);
      } else if (timeOfDay >= 5.0 && timeOfDay < 7.0) {
        // Dawn / Sunrise
        const t = (timeOfDay - 5.0) / 2.0;
        skyColor.lerpColors(new THREE.Color(0x1e1b4b), new THREE.Color(0xfdba74), t); // Night to dawn peach
        sunColor.lerpColors(new THREE.Color(0x0c4a6e), new THREE.Color(0xfacc15), t);
        fogColor.copy(skyColor);
        sunIntensity = 1.0 * t;
        ambientIntensity = 0.15 + 0.45 * t;
        this.assets.setNightMode(false);
      } else {
        // Day (7.0 to 18.0)
        skyColor.setHex(0xbae6fd); // Bright sunny day sky
        sunIntensity = 1.3;
        ambientIntensity = 0.65;
        sunColor.setHex(0xfffaf0);
        fogColor.setHex(0xbae6fd);
        this.assets.setNightMode(false);
      }
    }

    // Cache the calculated offset for the render loop / camera position update
    this.currentSunOffset.set(sunX, Math.max(1.0, sunY), sunZ);

    if (this.dirLight) {
      this.dirLight.position.set(
        this.cameraTarget.x + sunX,
        Math.max(1.0, sunY), // Keep sun above ground level visually
        this.cameraTarget.z + sunZ
      );
      // Ensure the light's target tracking target updates to keep shadow camera centered on view
      this.dirLight.target.position.copy(this.cameraTarget);
      this.dirLight.target.updateMatrixWorld();
    }

    if (this.scene) {
      this.scene.background = skyColor;
      if (this.scene.fog instanceof THREE.FogExp2) {
        this.scene.fog.color = fogColor;
      }
    }
    if (this.ambientLight) {
      this.ambientLight.color.copy(ambientColor);
      this.ambientLight.intensity = ambientIntensity;
    }
    if (this.dirLight) {
      this.dirLight.color.copy(sunColor);
      this.dirLight.intensity = sunIntensity;
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
      p.life++;

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

    // 5. Render composer passes
    this.composer.render();
  }

  // Camera Smoothing update method
  private cameraNeedsSmoothing(): boolean {
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
    const map = this.assets.getMaterialTransitionMap();
    this.scene.traverse((node) => {
      if (node instanceof THREE.Mesh || node instanceof THREE.InstancedMesh) {
        if (node.material) {
          if (Array.isArray(node.material)) {
            node.material = node.material.map(m => map.get(m) || m);
          } else {
            node.material = map.get(node.material) || node.material;
          }
        }
      }
    });

    if (this.groundMesh) this.groundMesh.instanceMatrix.needsUpdate = true;
    if (this.trunkMesh) this.trunkMesh.instanceMatrix.needsUpdate = true;
    if (this.greenLeavesMesh) this.greenLeavesMesh.instanceMatrix.needsUpdate = true;
    if (this.blossomLeavesMesh) this.blossomLeavesMesh.instanceMatrix.needsUpdate = true;
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
