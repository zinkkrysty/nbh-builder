import * as THREE from 'three';
import { AssetGenerator } from './AssetGenerator';
import { Simulation, TileState } from './Simulation';
import { TrafficManager } from './TrafficManager';
import { CitizenManager } from './CitizenManager';
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

  // Optimizations
  groundMesh!: THREE.InstancedMesh;
  // Scattered Forest Trees
  treesData: StaticTreeData[] = [];
  trunkMesh?: THREE.InstancedMesh;
  greenLeavesMesh?: THREE.InstancedMesh;
  blossomLeavesMesh?: THREE.InstancedMesh;

  // Active Building Meshes
  buildingMeshes: Map<string, THREE.Object3D> = new Map();
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

  // Smooth camera destination states
  desiredCameraTarget = new THREE.Vector3(0, 0, 0);
  desiredCameraZoom = 25;
  desiredAngleX = Math.PI / 6;
  desiredAngleY = Math.PI / 4;
  keysPressed: { [key: string]: boolean } = {};

  // Drag interaction
  isDragging = false;
  previousMousePosition = { x: 0, y: 0 };

  constructor(containerId: string, assets: AssetGenerator) {
    this.container = document.getElementById(containerId)!;
    this.assets = assets;

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


    // 3. Unreal Bloom Pass for glowing emissive windows & vehicle headlights
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
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(this.ambientLight);

    // Directional Sun Light (casts shadows)
    this.dirLight = new THREE.DirectionalLight(0xfffaf0, 1.2);
    this.dirLight.position.set(40, 50, 20);
    this.dirLight.castShadow = true;

    // High quality soft shadows settings
    this.dirLight.shadow.mapSize.width = 2048;
    this.dirLight.shadow.mapSize.height = 2048;
    this.dirLight.shadow.camera.near = 0.5;
    this.dirLight.shadow.camera.far = 200;

    const d = 60;
    this.dirLight.shadow.camera.left = -d;
    this.dirLight.shadow.camera.right = d;
    this.dirLight.shadow.camera.top = d;
    this.dirLight.shadow.camera.bottom = -d;
    this.dirLight.shadow.bias = -0.0005;

    this.scene.add(this.dirLight);
  }

  // Populate Instanced Ground Tiles and Scattered Trees
  initEnvironment() {
    const size = 50;
    const gridOffset = size / 2;

    // 1. Ground Tiles (Grass)
    const groundGeo = this.assets.createGroundGeometry();
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
        this.groundMesh.setMatrixAt(index++, dummy.matrix);
      }
    }
    this.scene.add(this.groundMesh);

    // 2. Scattered Forest Trees (around borders or randomly as environment details) using InstancedMesh
    this.rebuildTrees();
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
      this.dirLight.target.position.copy(this.cameraTarget);
      this.dirLight.position.set(
        this.cameraTarget.x + 30,
        this.cameraTarget.y + 40,
        this.cameraTarget.z + 15
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

    this.updateTreesOnTile(x, y);
  }

  resetGroundInstances() {
    const size = 50;
    const gridOffset = 25;
    const dummy = new THREE.Object3D();
    let index = 0;
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
        } else {
          dummy.position.set(xPos, yPos, zPos);
        }
        dummy.updateMatrix();
        this.groundMesh.setMatrixAt(index++, dummy.matrix);
      }
    }
    this.groundMesh.instanceMatrix.needsUpdate = true;
  }

  // Render individual zoned structures on state changes
  updateTileMesh(tile: TileState) {
    const key = `${tile.x},${tile.y}`;
    const oldMesh = this.buildingMeshes.get(key);
    const targetRotation = this.calculateTileRotation(tile);
    const neighborsHash = this.computeNeighborsHash(tile);

    if (oldMesh) {
      // Visuals are already up to date, avoid rebuilding and flickering!
      if (
        oldMesh.userData &&
        oldMesh.userData.type === tile.type &&
        oldMesh.userData.level === tile.level &&
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

    switch (tile.type) {
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
    const roadMesh = this.assets.createRoadMesh(connections, isBridge, neighbors, x, y);
    
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
    // Normalise time to angle: sunrise at 6:00, noon 12:00, sunset 18:00, midnight 00:00
    const timeRad = ((timeOfDay - 6) / 24) * Math.PI * 2;

    // Rotate Sun Position
    const sunRadius = 60;
    const sunX = Math.cos(timeRad) * sunRadius;
    const sunY = Math.sin(timeRad) * sunRadius;
    const sunZ = Math.sin(timeRad * 0.5) * 20; // Slight side wobble

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

    // Determine phase for colors
    let skyColor = new THREE.Color(0xa5f3fc); // Day
    let ambientIntensity = 0.6;
    let sunIntensity = 1.2;
    let sunColor = new THREE.Color(0xfffaf0);
    let fogColor = new THREE.Color(0xa5f3fc);

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

    if (this.scene) {
      this.scene.background = skyColor;
      if (this.scene.fog instanceof THREE.FogExp2) {
        this.scene.fog.color = fogColor;
      }
    }
    if (this.ambientLight) {
      this.ambientLight.color.setHex(0xffffff);
      this.ambientLight.intensity = ambientIntensity;
    }
    if (this.dirLight) {
      this.dirLight.color.copy(sunColor);
      this.dirLight.intensity = sunIntensity;
    }
  }

  // Animation ticks for particles and spinning turbines
  animate(timeStep: number) {
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
    const waterMat = this.assets.materials.waterBlue as THREE.MeshStandardMaterial;
    if (waterMat && waterMat.userData && waterMat.userData.shader) {
      waterMat.userData.shader.uniforms.uTime.value += timeStep;
    }

    // 3. Smooth Camera Pan, Zoom, and Rotation Updates
    this.updateCameraSmoothing(timeStep);

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
  updateCameraSmoothing(timeStep: number) {
    // 1. Process Keyboard Panning
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

    // 2. Exponential decay interpolation (lerp) for smooth gliding
    const targetLerp = 1 - Math.exp(-12 * timeStep);
    const zoomLerp = 1 - Math.exp(-8 * timeStep);
    const angleLerp = 1 - Math.exp(-8 * timeStep);

    this.cameraTarget.lerp(this.desiredCameraTarget, targetLerp);
    this.cameraZoom += (this.desiredCameraZoom - this.cameraZoom) * zoomLerp;
    this.cameraAngleX += (this.desiredAngleX - this.cameraAngleX) * angleLerp;
    this.cameraAngleY += (this.desiredAngleY - this.cameraAngleY) * angleLerp;

    // 3. Update Orthographic frustum based on smooth zoom
    const aspect = this.container.clientWidth / this.container.clientHeight;
    const frustumSize = 1000 / this.cameraZoom;
    this.camera.left = (frustumSize * aspect) / -2;
    this.camera.right = (frustumSize * aspect) / 2;
    this.camera.top = frustumSize / 2;
    this.camera.bottom = frustumSize / -2;

    // 4. Update scene positions
    this.updateCameraPosition();
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
  }
}
