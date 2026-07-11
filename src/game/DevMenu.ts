import * as THREE from 'three';
import { AssetGenerator } from './AssetGenerator';

export class DevMenu {
  assets: AssetGenerator;
  isOpen = false;
  isAutoRotating = true;
  isNightMode = false;
  cameraDistance = 3.41;

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

  updateCameraPosition() {
    if (!this.camera) return;
    const dir = new THREE.Vector3(2.2, 1.4, 2.2).normalize();
    const target = new THREE.Vector3(0, 0.4, 0);
    this.camera.position.copy(target).addScaledVector(dir, this.cameraDistance);
    this.camera.lookAt(target);
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
    this.updateCameraPosition();

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
    
    // Seed changes
    const seedX = document.getElementById('dev-seed-x');
    const seedY = document.getElementById('dev-seed-y');
    [seedX, seedY].forEach(el => {
      el?.addEventListener('input', () => this.updatePreview());
    });

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

    // Generate Grid button
    document.getElementById('dev-gen-grid-btn')?.addEventListener('click', () => this.generateGridImage());

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

    // Zoom support via scroll/wheel interaction
    container.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomSpeed = 0.002;
      this.cameraDistance += e.deltaY * zoomSpeed;
      this.cameraDistance = Math.max(1.0, Math.min(8.0, this.cameraDistance));
      this.updateCameraPosition();
    }, { passive: false });
  }

  toggleOpen() {
    window.location.href = '/assets.html';
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
    const hasSeed = assetType === 'residential';

    const levelGroup = document.getElementById('dev-level-group');
    const roadGroup = document.getElementById('dev-road-group');
    const seedGroup = document.getElementById('dev-seed-group');

    if (levelGroup) {
      levelGroup.classList.toggle('hidden', !hasLevels);
    }
    if (roadGroup) {
      roadGroup.classList.toggle('hidden', !isRoad);
    }
    if (seedGroup) {
      seedGroup.classList.toggle('hidden', !hasSeed);
    }
  }

  updatePreview() {
    if (!this.scene) return;

    // Dispose old mesh
    if (this.currentMesh) {
      this.disposeMesh(this.currentMesh);
    }

    const assetType = this.assetSelect?.value;
    const level = parseInt(this.levelSelect?.value || '1');

    const seedX = parseInt((document.getElementById('dev-seed-x') as HTMLInputElement)?.value || '0');
    const seedY = parseInt((document.getElementById('dev-seed-y') as HTMLInputElement)?.value || '0');

    let newMesh: THREE.Group;

    switch (assetType) {
      case 'residential':
        newMesh = this.assets.createResidentialMesh(level, seedX, seedY);
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
    mesh.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        // Shared materials (from AssetGenerator) should NOT be disposed
      }
    });
  }

  async generateGridImage() {
    if (!this.scene || !this.renderer || !this.camera) return;

    // Stop auto-rotation and save current state
    const wasAutoRotating = this.isAutoRotating;
    this.isAutoRotating = false;

    // Dispose current mesh
    if (this.currentMesh) {
      this.disposeMesh(this.currentMesh);
    }

    // Setup a temporary grid canvas (size: 2048 x 2048 for high res)
    const gridCanvas = document.createElement('canvas');
    gridCanvas.width = 2048;
    gridCanvas.height = 2048;
    const ctx = gridCanvas.getContext('2d')!;

    // Fill background
    ctx.fillStyle = '#111827'; // Dark gray
    ctx.fillRect(0, 0, 2048, 2048);

    // Fix camera distance and angle for uniform view
    this.cameraDistance = 3.2;
    this.updateCameraPosition();

    const level = 1;
    const cellSize = 512;

    // Generate a 4x4 grid of 16 different seeds
    const seeds = [
      { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 },
      { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 1 },
      { x: 0, y: 2 }, { x: 1, y: 2 }, { x: 2, y: 2 }, { x: 3, y: 2 },
      { x: 0, y: 3 }, { x: 1, y: 3 }, { x: 2, y: 3 }, { x: 3, y: 3 }
    ];

    for (let i = 0; i < 16; i++) {
      const seed = seeds[i];
      const col = i % 4;
      const row = Math.floor(i / 4);

      // Build the mesh for this seed
      const mesh = this.assets.createResidentialMesh(level, seed.x, seed.y);
      mesh.position.set(0, 0.06, 0);
      mesh.rotation.set(0.18, Math.PI / 4, 0); // 3/4 axonometric view
      this.scene.add(mesh);

      // Render the frame
      this.renderer.render(this.scene, this.camera);

      // Extract the image from the WebGL canvas
      const frameImg = new Image();
      frameImg.src = this.renderer.domElement.toDataURL('image/png');
      
      // Wait for image load
      await new Promise(resolve => frameImg.onload = resolve);

      // Draw cell to the grid canvas
      const dx = col * cellSize;
      const dy = row * cellSize;
      ctx.drawImage(frameImg, dx, dy, cellSize, cellSize);

      // Draw overlay text label
      ctx.fillStyle = '#f3f4f6';
      ctx.font = 'bold 24px sans-serif';
      ctx.fillText(`House #${i + 1}`, dx + 20, dy + 40);
      ctx.fillStyle = '#9ca3af';
      ctx.font = '18px sans-serif';
      ctx.fillText(`Seed: (${seed.x}, ${seed.y})`, dx + 20, dy + 70);

      // Clean up mesh
      this.disposeMesh(mesh);
    }

    // Restore original state
    this.isAutoRotating = wasAutoRotating;
    this.updatePreview();

    // Send grid canvas to local save server
    const dataUrl = gridCanvas.toDataURL('image/png');
    try {
      const res = await fetch('http://localhost:8080/upload-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: dataUrl })
      });
      const result = await res.json();
      if (result.success) {
        console.log('Grid image generated and saved successfully!');
      } else {
        console.error('Failed to save grid image:', result.error);
      }
    } catch (err) {
      console.error('Error sending grid image to server:', err);
    }
  }
}
