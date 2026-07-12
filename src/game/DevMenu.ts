import * as THREE from 'three';
import { AssetGenerator } from './AssetGenerator';

export class DevMenu {
  assets: AssetGenerator;
  isOpen = false;
  isAutoRotating = true;
  isNightMode = false;

  // DOM Elements
  devMenuEl: HTMLElement | null = null;
  toggleBtn: HTMLElement | null = null;
  closeBtn: HTMLElement | null = null;
  assetSelect: HTMLSelectElement | null = null;
  levelSelect: HTMLSelectElement | null = null;
  rotateBtn: HTMLElement | null = null;
  timeBtn: HTMLElement | null = null;
  canvasContainer: HTMLElement | null = null;

  // Three.js Elements
  scene!: THREE.Scene;
  camera!: THREE.PerspectiveCamera;
  renderer!: THREE.WebGLRenderer;
  ambientLight!: THREE.AmbientLight;
  dirLight!: THREE.DirectionalLight;
  plinth!: THREE.Mesh;
  currentMesh: THREE.Group | null = null;
  animationFrameId: number | null = null;

  // Drag interaction state
  isDragging = false;
  previousMousePosition = { x: 0, y: 0 };

  constructor(assets: AssetGenerator) {
    this.assets = assets;

    // Cache elements
    this.devMenuEl = document.getElementById('dev-menu');
    this.toggleBtn = document.getElementById('btn-dev-toggle');
    this.closeBtn = document.getElementById('btn-dev-close');
    this.assetSelect = document.getElementById('dev-asset-select') as HTMLSelectElement;
    this.levelSelect = document.getElementById('dev-level-select') as HTMLSelectElement;
    this.rotateBtn = document.getElementById('btn-preview-rotate');
    this.timeBtn = document.getElementById('btn-preview-time');
    this.canvasContainer = document.getElementById('dev-preview-canvas-container');

    this.setupEventListeners();
  }

  initThree() {
    if (!this.canvasContainer || this.renderer) return;

    const width = this.canvasContainer.clientWidth;
    const height = this.canvasContainer.clientHeight;

    // 1. Scene setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x151922); // Cozy dark slate day background
    this.scene.fog = new THREE.FogExp2(0x151922, 0.01);

    // 2. Camera setup
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    this.camera.position.set(2.2, 1.8, 2.2);
    this.camera.lookAt(0, 0.4, 0);

    // 3. Renderer setup
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.canvasContainer.appendChild(this.renderer.domElement);

    // 4. Lights
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    this.scene.add(this.ambientLight);

    this.dirLight = new THREE.DirectionalLight(0xfffaf0, 1.2);
    this.dirLight.position.set(5, 8, 5);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.width = 512;
    this.dirLight.shadow.mapSize.height = 512;
    this.dirLight.shadow.camera.near = 0.5;
    this.dirLight.shadow.camera.far = 25;
    this.dirLight.shadow.bias = -0.001;
    this.scene.add(this.dirLight);

    // 5. Plinth (museum-like round platform)
    const plinthGeo = new THREE.CylinderGeometry(1.1, 1.1, 0.06, 32);
    const plinthMat = new THREE.MeshStandardMaterial({
      color: 0x1f2937,
      roughness: 0.8,
      metalness: 0.2
    });
    this.plinth = new THREE.Mesh(plinthGeo, plinthMat);
    this.plinth.position.y = 0.03; // Sit flush
    this.plinth.receiveShadow = true;
    this.plinth.castShadow = true;
    this.scene.add(this.plinth);

    this.setupDragInteraction();
    this.updatePreview();
    this.animate();
  }

  setupEventListeners() {
    // Open/Close bindings
    this.toggleBtn?.addEventListener('click', () => this.toggleOpen());
    this.closeBtn?.addEventListener('click', () => this.toggleOpen());

    // Selection changes
    this.assetSelect?.addEventListener('change', () => {
      this.updateControlsVisibility();
      this.updatePreview();
    });
    this.levelSelect?.addEventListener('change', () => this.updatePreview());

    // Road connection checkboxes
    const connN = document.getElementById('dev-road-n');
    const connS = document.getElementById('dev-road-s');
    const connE = document.getElementById('dev-road-e');
    const connW = document.getElementById('dev-road-w');
    [connN, connS, connE, connW].forEach(el => {
      el?.addEventListener('change', () => this.updatePreview());
    });

    // Control buttons
    this.rotateBtn?.addEventListener('click', () => this.toggleRotation());
    this.timeBtn?.addEventListener('click', () => this.toggleTimeMode());

    // Resize event
    window.addEventListener('resize', () => this.onResize());
  }

  setupDragInteraction() {
    const container = this.canvasContainer;
    if (!container) return;

    container.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      this.previousMousePosition = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.isDragging || !this.currentMesh) return;

      const deltaX = e.clientX - this.previousMousePosition.x;
      const deltaY = e.clientY - this.previousMousePosition.y;

      this.currentMesh.rotation.y += deltaX * 0.01;
      this.currentMesh.rotation.x += deltaY * 0.01;

      // Restrict pitch to avoid turning model completely upside down
      this.currentMesh.rotation.x = Math.max(-Math.PI / 4, Math.min(Math.PI / 4, this.currentMesh.rotation.x));

      this.previousMousePosition = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener('mouseup', () => {
      this.isDragging = false;
    });

    // Touch support for trackpads / mobile layout
    container.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        this.isDragging = true;
        this.previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
    });

    window.addEventListener('touchmove', (e) => {
      if (!this.isDragging || !this.currentMesh || e.touches.length !== 1) return;

      const deltaX = e.touches[0].clientX - this.previousMousePosition.x;
      const deltaY = e.touches[0].clientY - this.previousMousePosition.y;

      this.currentMesh.rotation.y += deltaX * 0.01;
      this.currentMesh.rotation.x += deltaY * 0.01;
      this.currentMesh.rotation.x = Math.max(-Math.PI / 4, Math.min(Math.PI / 4, this.currentMesh.rotation.x));

      this.previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    });

    window.addEventListener('touchend', () => {
      this.isDragging = false;
    });
  }

  toggleOpen() {
    this.isOpen = !this.isOpen;
    this.devMenuEl?.classList.toggle('hidden', !this.isOpen);
    this.toggleBtn?.classList.toggle('active', this.isOpen);

    if (this.isOpen) {
      // Lazy init Three.js when first opened
      setTimeout(() => {
        this.initThree();
        this.onResize();
      }, 50);
    } else {
      this.stopAnimation();
    }
  }

  toggleRotation() {
    this.isAutoRotating = !this.isAutoRotating;
    this.rotateBtn?.classList.toggle('active', this.isAutoRotating);
  }

  toggleTimeMode() {
    this.isNightMode = !this.isNightMode;
    if (this.timeBtn) {
      this.timeBtn.innerText = this.isNightMode ? 'Night Mode' : 'Day Mode';
      this.timeBtn.classList.toggle('active', this.isNightMode);
    }

    // Toggle lighting environment
    if (this.isNightMode) {
      this.scene.background = new THREE.Color(0x0c0f16);
      this.scene.fog = new THREE.FogExp2(0x0c0f16, 0.01);
      this.ambientLight.color.setHex(0x38bdf8);
      this.ambientLight.intensity = 0.2;
      this.dirLight.intensity = 0.15;
      this.dirLight.color.setHex(0x1e293b);
    } else {
      this.scene.background = new THREE.Color(0x151922);
      this.scene.fog = new THREE.FogExp2(0x151922, 0.01);
      this.ambientLight.color.setHex(0xffffff);
      this.ambientLight.intensity = 0.7;
      this.dirLight.intensity = 1.2;
      this.dirLight.color.setHex(0xfffaf0);
    }

    // Toggle shared emissive states in Asset Generator
    this.assets.setNightMode(this.isNightMode);
  }

  updateControlsVisibility() {
    const assetType = this.assetSelect?.value;
    if (!assetType) return;

    const hasLevels = ['residential', 'commercial', 'industrial'].includes(assetType);
    const isRoad = assetType === 'road';

    const levelGroup = document.getElementById('dev-level-group');
    const roadGroup = document.getElementById('dev-road-group');

    if (levelGroup) {
      levelGroup.classList.toggle('hidden', !hasLevels);
    }
    if (roadGroup) {
      roadGroup.classList.toggle('hidden', !isRoad);
    }
  }

  updatePreview() {
    if (!this.scene) return;

    // Dispose old mesh
    if (this.currentMesh) {
      this.disposeMesh(this.currentMesh);
    }

    const assetType = this.assetSelect?.value;
    const level = parseInt(this.levelSelect?.value || '2');

    let newMesh: THREE.Group;

    switch (assetType) {
      case 'residential':
        newMesh = this.assets.createResidentialMesh(level);
        break;
      case 'commercial':
        newMesh = this.assets.createCommercialMesh(level);
        break;
      case 'industrial':
        newMesh = this.assets.createIndustrialMesh(level);
        break;
      case 'turbine':
        newMesh = this.assets.createWindTurbineMesh();
        break;
      case 'water':
        newMesh = this.assets.createWaterTowerMesh();
        break;
      case 'park':
        newMesh = this.assets.createParkMesh();
        break;
      case 'tree':
        newMesh = this.assets.createTreeMesh();
        break;
      case 'car':
        newMesh = this.assets.createCarMesh();
        break;
      case 'road':
        const n = (document.getElementById('dev-road-n') as HTMLInputElement)?.checked || false;
        const s = (document.getElementById('dev-road-s') as HTMLInputElement)?.checked || false;
        const e = (document.getElementById('dev-road-e') as HTMLInputElement)?.checked || false;
        const w = (document.getElementById('dev-road-w') as HTMLInputElement)?.checked || false;
        newMesh = this.assets.createRoadMesh({ N: n, S: s, E: e, W: w });
        break;
      default:
        newMesh = new THREE.Group();
    }

    this.currentMesh = newMesh;
    
    // Position asset to sit perfectly on top of the plinth
    this.currentMesh.position.set(0, 0.06, 0);
    this.currentMesh.rotation.set(0, 0, 0); // Reset drag rotations

    this.scene.add(this.currentMesh);
  }

  animate() {
    this.animationFrameId = requestAnimationFrame(() => this.animate());

    if (this.currentMesh && this.isAutoRotating && !this.isDragging) {
      this.currentMesh.rotation.y += 0.005;
      // Gently return X rotation to horizontal default during auto-rotate
      this.currentMesh.rotation.x += (0 - this.currentMesh.rotation.x) * 0.05;
    }

    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  stopAnimation() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  onResize() {
    if (!this.canvasContainer || !this.renderer || !this.camera) return;

    const width = this.canvasContainer.clientWidth;
    const height = this.canvasContainer.clientHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  disposeMesh(mesh: THREE.Object3D) {
    this.scene.remove(mesh);
  }
}
