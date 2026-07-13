import * as THREE from 'three';
import { AssetGenerator } from './game/AssetGenerator';

const assets = new AssetGenerator();

// Define the asset grid nodes
const cells: {
  id: number;
  rowName: string;
  colName: string;
  level: number;
  type: 'residential' | 'commercial' | 'industrial' | 'park' | 'tree' | 'turbine' | 'watertower' | 'road' | 'car' | 'water_body' | 'boardwalk' | 'bridge' | 'empty';
  label: string;
  seedX: number;
  seedY: number;
  isSeedDependent: boolean;
}[] = [
  // Row 0: Residential
  { id: 0, rowName: 'Residential', colName: 'Level 1', level: 1, type: 'residential', label: 'Cozy Cottage', seedX: 0, seedY: 0, isSeedDependent: true },
  { id: 1, rowName: 'Residential', colName: 'Level 2', level: 2, type: 'residential', label: 'Suburban Home', seedX: 0, seedY: 0, isSeedDependent: true },
  { id: 2, rowName: 'Residential', colName: 'Level 3', level: 3, type: 'residential', label: 'Alpine Chalet', seedX: 0, seedY: 0, isSeedDependent: true },

  // Row 1: Commercial
  { id: 3, rowName: 'Commercial', colName: 'Level 1', level: 1, type: 'commercial', label: 'Corner Shop', seedX: 0, seedY: 0, isSeedDependent: true },
  { id: 4, rowName: 'Commercial', colName: 'Level 2', level: 2, type: 'commercial', label: 'Medium Store', seedX: 0, seedY: 0, isSeedDependent: true },
  { id: 5, rowName: 'Commercial', colName: 'Level 3', level: 3, type: 'commercial', label: 'Office Tower', seedX: 0, seedY: 0, isSeedDependent: true },

  // Row 2: Industrial
  { id: 6, rowName: 'Industrial', colName: 'Level 1', level: 1, type: 'industrial', label: 'Warehouse', seedX: 0, seedY: 0, isSeedDependent: false },
  { id: 7, rowName: 'Industrial', colName: 'Level 2', level: 2, type: 'industrial', label: 'Processing Plant', seedX: 0, seedY: 0, isSeedDependent: false },
  { id: 8, rowName: 'Industrial', colName: 'Level 3', level: 3, type: 'industrial', label: 'Heavy Factory', seedX: 0, seedY: 0, isSeedDependent: false },

  // Row 3: Greenery & Recreation
  { id: 9, rowName: 'Recreation', colName: 'Level 1', level: 1, type: 'park', label: 'Neighborhood Park', seedX: 0, seedY: 0, isSeedDependent: false },
  { id: 10, rowName: 'Recreation', colName: 'Level 2', level: 1, type: 'tree', label: 'Foliage & Trees', seedX: 0, seedY: 0, isSeedDependent: false },
  { id: 11, rowName: 'Recreation', colName: 'Level 3', level: 1, type: 'empty', label: 'N/A', seedX: 0, seedY: 0, isSeedDependent: false },

  // Row 4: Public Utilities
  { id: 12, rowName: 'Utilities', colName: 'Level 1', level: 1, type: 'turbine', label: 'Wind Turbine', seedX: 0, seedY: 0, isSeedDependent: false },
  { id: 13, rowName: 'Utilities', colName: 'Level 2', level: 1, type: 'watertower', label: 'Water Tower', seedX: 0, seedY: 0, isSeedDependent: false },
  { id: 14, rowName: 'Utilities', colName: 'Level 3', level: 1, type: 'empty', label: 'N/A', seedX: 0, seedY: 0, isSeedDependent: false },

  // Row 5: Infrastructure
  { id: 15, rowName: 'Transport', colName: 'Level 1', level: 1, type: 'road', label: 'Road Crossing', seedX: 0, seedY: 0, isSeedDependent: false },
  { id: 16, rowName: 'Transport', colName: 'Level 2', level: 1, type: 'car', label: 'Passenger Car', seedX: 0, seedY: 0, isSeedDependent: false },
  { id: 17, rowName: 'Transport', colName: 'Level 3', level: 1, type: 'empty', label: 'N/A', seedX: 0, seedY: 0, isSeedDependent: false },

  // Row 6: Waterfront & Geography
  { id: 18, rowName: 'Waterfront', colName: 'Level 1', level: 1, type: 'water_body', label: 'Natural Water', seedX: 0, seedY: 0, isSeedDependent: true },
  { id: 19, rowName: 'Waterfront', colName: 'Level 2', level: 1, type: 'boardwalk', label: 'Cozy Boardwalk', seedX: 0, seedY: 0, isSeedDependent: true },
  { id: 20, rowName: 'Waterfront', colName: 'Level 3', level: 1, type: 'bridge', label: 'Road Bridge', seedX: 0, seedY: 0, isSeedDependent: false }
];

// Background offscreen WebGL renderer for generating static image previews
let bgRenderer: THREE.WebGLRenderer;
let bgScene: THREE.Scene;
let bgCamera: THREE.PerspectiveCamera;
let bgLight: THREE.DirectionalLight;
let bgAmbient: THREE.AmbientLight;

function initBgRenderer() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  bgRenderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  bgRenderer.setSize(512, 512);
  bgRenderer.shadowMap.enabled = true;
  bgRenderer.shadowMap.type = THREE.PCFSoftShadowMap;

  bgScene = new THREE.Scene();

  bgCamera = new THREE.PerspectiveCamera(38, 1, 0.1, 15);
  bgCamera.position.set(2.4, 1.8, 2.4);
  bgCamera.lookAt(0, 0.35, 0);

  bgAmbient = new THREE.AmbientLight(0xffffff, 0.55);
  bgScene.add(bgAmbient);

  bgLight = new THREE.DirectionalLight(0xffffff, 1.25);
  bgLight.position.set(1.5, 4.0, 1.2);
  bgLight.castShadow = true;
  bgLight.shadow.mapSize.width = 1024;
  bgLight.shadow.mapSize.height = 1024;
  bgLight.shadow.bias = -0.0015;
  bgScene.add(bgLight);
}

// Build the selected mesh
function createAssetMesh(cell: typeof cells[0]): THREE.Group {
  if (cell.type === 'residential') {
    return assets.createResidentialMesh(cell.level, cell.seedX, cell.seedY);
  }
  if (cell.type === 'commercial') {
    return assets.createCommercialMesh(cell.level, cell.seedX, cell.seedY);
  }
  if (cell.type === 'industrial') {
    return assets.createIndustrialMesh(cell.level);
  }
  if (cell.type === 'park') {
    return assets.createParkMesh();
  }
  if (cell.type === 'tree') {
    const group = new THREE.Group();
    // Create base plinth/foundation for trees
    const foundGeo = new THREE.BoxGeometry(1.7, 0.08, 1.7);
    foundGeo.translate(0, 0.04, 0);
    const found = new THREE.Mesh(foundGeo, assets.materials.grass);
    group.add(found);

    const tree1 = assets.createTreeMesh();
    tree1.position.set(-0.25, 0.08, 0.15);
    tree1.scale.set(0.9, 0.9, 0.9);
    group.add(tree1);

    const tree2 = assets.createTreeMesh();
    tree2.position.set(0.3, 0.08, -0.3);
    tree2.scale.set(0.7, 0.7, 0.7);
    group.add(tree2);

    return group;
  }
  if (cell.type === 'turbine') {
    return assets.createWindTurbineMesh();
  }
  if (cell.type === 'watertower') {
    return assets.createWaterTowerMesh();
  }
  if (cell.type === 'road') {
    return assets.createRoadMesh({ N: true, S: true, E: true, W: true });
  }
  if (cell.type === 'car') {
    const group = new THREE.Group();
    // Add road piece under car
    const road = assets.createRoadMesh({ N: true, S: true, E: false, W: false });
    group.add(road);

    const car = assets.createCarMesh();
    car.position.set(0, 0.05, 0);
    group.add(car);
    return group;
  }
  if (cell.type === 'water_body') {
    return assets.createWaterBodyMesh(cell.seedX, cell.seedY, { N: false, S: false, E: false, W: false });
  }
  if (cell.type === 'boardwalk') {
    const boardwalkNeighbors = { N: false, S: false, E: false, W: false };
    const waterNeighbors = { N: true, S: false, E: false, W: false };
    return assets.createBoardwalkMesh(cell.seedX, cell.seedY, boardwalkNeighbors, waterNeighbors);
  }
  if (cell.type === 'bridge') {
    const connections = { N: true, S: true, E: false, W: false };
    const waterNeighbors = { N: true, S: true, E: false, W: false };
    return assets.createRoadMesh(connections, true, waterNeighbors);
  }
  return new THREE.Group();
}

// Generate base64 screenshot image for cell card
function generateCellImage(cell: typeof cells[0]): string {
  if (cell.type === 'empty') return '';

  const mesh = createAssetMesh(cell);
  bgScene.add(mesh);

  // Position adjustments based on type for framing
  if (cell.type === 'turbine') {
    bgCamera.position.set(3.4, 2.5, 3.4);
    bgCamera.lookAt(0, 0.9, 0);
  } else if (cell.type === 'car' || cell.type === 'road') {
    bgCamera.position.set(2.2, 1.4, 2.2);
    bgCamera.lookAt(0, 0.1, 0);
  } else if (cell.type === 'boardwalk') {
    bgCamera.position.set(2.8, 2.0, 2.8);
    bgCamera.lookAt(0, 0.1, 0.4);
  } else if (cell.type === 'water_body' || cell.type === 'bridge') {
    bgCamera.position.set(2.4, 1.6, 2.4);
    bgCamera.lookAt(0, -0.1, 0);
  } else {
    bgCamera.position.set(2.4, 1.8, 2.4);
    bgCamera.lookAt(0, 0.35, 0);
  }

  bgRenderer.render(bgScene, bgCamera);
  const url = bgRenderer.domElement.toDataURL('image/png');

  bgScene.remove(mesh);

  return url;
}

// Render Grid
const gridEl = document.getElementById('grid') as HTMLElement;
const loadingScreen = document.getElementById('loading-screen') as HTMLElement;

function buildHTMLGrid() {
  gridEl.innerHTML = '';
  
  cells.forEach((cell) => {
    if (cell.type === 'empty') {
      const placeholder = document.createElement('div');
      placeholder.className = 'cell-empty';
      placeholder.textContent = 'N/A';
      gridEl.appendChild(placeholder);
      return;
    }

    const card = document.createElement('div');
    card.className = 'cell';
    card.id = `cell-${cell.id}`;

    // Show category label indicator
    if (cell.colName === 'Level 1') {
      const label = document.createElement('div');
      label.className = 'row-indicator';
      label.textContent = cell.rowName;
      card.appendChild(label);
    }

    const previewContainer = document.createElement('div');
    previewContainer.className = 'cell-preview-container';
    previewContainer.onclick = () => openInteractiveModal(cell);

    const img = document.createElement('img');
    img.id = `img-${cell.id}`;
    img.src = generateCellImage(cell);
    img.alt = cell.label;
    previewContainer.appendChild(img);

    const meta = document.createElement('div');
    meta.className = 'cell-meta';

    const details = document.createElement('div');
    details.className = 'meta-details';
    details.innerHTML = `
      <h3>${cell.label}</h3>
      <p>${cell.isSeedDependent ? `Seed: (${cell.seedX}, ${cell.seedY})` : 'Static Model'}</p>
    `;

    const actions = document.createElement('div');
    actions.className = 'cell-actions';
    if (cell.isSeedDependent) {
      actions.innerHTML = `
        <button class="btn-icon" title="Roll Random Seed" id="regen-cell-${cell.id}">
          🎲
        </button>
      `;
    }

    meta.appendChild(details);
    meta.appendChild(actions);
    card.appendChild(previewContainer);
    card.appendChild(meta);
    gridEl.appendChild(card);

    if (cell.isSeedDependent) {
      const btnRegen = document.getElementById(`regen-cell-${cell.id}`) as HTMLButtonElement;
      btnRegen.onclick = (e) => {
        e.stopPropagation();
        cell.seedX = Math.floor(Math.random() * 1000);
        cell.seedY = Math.floor(Math.random() * 1000);
        details.querySelector('p')!.textContent = `Seed: (${cell.seedX}, ${cell.seedY})`;
        img.src = generateCellImage(cell);
      };
    }
  });

  setTimeout(() => {
    loadingScreen.style.opacity = '0';
    setTimeout(() => {
      loadingScreen.style.display = 'none';
    }, 500);
  }, 300);
}

// --- Interactive 3D Modal Viewport ---
let activeCell: typeof cells[0] | null = null;
let modalRenderer: THREE.WebGLRenderer | null = null;
let modalScene: THREE.Scene;
let modalCamera: THREE.PerspectiveCamera;
let modalGroup: THREE.Group;
let modalAmbient: THREE.AmbientLight;
let modalDirLight: THREE.DirectionalLight;
let isNightMode = false;
let animationId = 0;

let isDragging = false;
let previousMousePosition = { x: 0, y: 0 };
let currentRotation = { x: 0.15, y: Math.PI / 4 };
let cameraZoom = 3.6;

const modalOverlay = document.getElementById('modal') as HTMLElement;
const canvasContainer = document.getElementById('modal-canvas-container') as HTMLElement;

function initModalRenderer() {
  if (modalRenderer) return;

  const width = canvasContainer.clientWidth;
  const height = canvasContainer.clientHeight;

  modalRenderer = new THREE.WebGLRenderer({ antialias: true });
  modalRenderer.setSize(width, height);
  modalRenderer.shadowMap.enabled = true;
  modalRenderer.shadowMap.type = THREE.PCFSoftShadowMap;
  canvasContainer.appendChild(modalRenderer.domElement);

  modalScene = new THREE.Scene();
  modalScene.background = new THREE.Color(0x1e293b);

  modalCamera = new THREE.PerspectiveCamera(40, width / height, 0.1, 30);
  updateCameraPosition();

  modalAmbient = new THREE.AmbientLight(0xffffff, 0.55);
  modalScene.add(modalAmbient);

  modalDirLight = new THREE.DirectionalLight(0xffffff, 1.25);
  modalDirLight.position.set(3, 6, 2);
  modalDirLight.castShadow = true;
  modalDirLight.shadow.mapSize.width = 1024;
  modalDirLight.shadow.mapSize.height = 1024;
  modalDirLight.shadow.bias = -0.001;
  modalScene.add(modalDirLight);

  modalGroup = new THREE.Group();
  modalScene.add(modalGroup);

  // Mouse Drag rotation
  canvasContainer.addEventListener('mousedown', (e) => {
    isDragging = true;
    previousMousePosition = { x: e.clientX, y: e.clientY };
  });

  canvasContainer.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const deltaMove = {
      x: e.clientX - previousMousePosition.x,
      y: e.clientY - previousMousePosition.y
    };

    currentRotation.y += deltaMove.x * 0.006;
    currentRotation.x = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, currentRotation.x + deltaMove.y * 0.006));

    modalGroup.rotation.y = currentRotation.y;
    modalGroup.rotation.x = currentRotation.x;

    previousMousePosition = { x: e.clientX, y: e.clientY };
  });

  window.addEventListener('mouseup', () => {
    isDragging = false;
  });

  canvasContainer.addEventListener('wheel', (e) => {
    e.preventDefault();
    cameraZoom = Math.max(0.8, Math.min(10.0, cameraZoom + e.deltaY * 0.004));
    updateCameraPosition();
  }, { passive: false });

  window.addEventListener('resize', () => {
    if (!modalRenderer) return;
    const w = canvasContainer.clientWidth;
    const h = canvasContainer.clientHeight;
    modalCamera.aspect = w / h;
    modalCamera.updateProjectionMatrix();
    modalRenderer.setSize(w, h);
  });
}

function updateCameraPosition() {
  let targetY = 0.35;
  if (activeCell) {
    if (activeCell.type === 'turbine') targetY = 0.9;
    else if (activeCell.type === 'car' || activeCell.type === 'road') targetY = 0.1;
    else if (activeCell.type === 'water_body' || activeCell.type === 'boardwalk' || activeCell.type === 'bridge') targetY = -0.1;
  }
  modalCamera.position.set(0, targetY + 0.1, cameraZoom);
  modalCamera.lookAt(0, targetY, 0);
}

function renderModalLoop() {
  if (!modalRenderer || !activeCell) return;
  modalRenderer.render(modalScene, modalCamera);
  animationId = requestAnimationFrame(renderModalLoop);
}

function openInteractiveModal(cell: typeof cells[0]) {
  activeCell = cell;
  initModalRenderer();

  // Modal titles
  document.getElementById('modal-house-title')!.textContent = cell.label;
  document.getElementById('modal-house-subtitle')!.textContent = cell.isSeedDependent 
    ? `Seed: (${cell.seedX}, ${cell.seedY})` 
    : `Category: ${cell.rowName} (Static Model)`;
  
  // Fill sidebar details
  document.getElementById('info-arch-type')!.textContent = cell.rowName;
  document.getElementById('info-seed-x')!.textContent = cell.isSeedDependent ? cell.seedX.toString() : 'N/A';
  document.getElementById('info-seed-y')!.textContent = cell.isSeedDependent ? cell.seedY.toString() : 'N/A';

  // Toggle seed button visibility
  const regenBtn = document.getElementById('modal-regen-btn') as HTMLButtonElement;
  regenBtn.style.display = cell.isSeedDependent ? 'block' : 'none';

  // Render modal mesh
  modalGroup.clear();
  const mesh = createAssetMesh(cell);
  modalGroup.add(mesh);

  // Dynamic Details based on asset type
  const rowWall = document.getElementById('row-info-wall-mat') as HTMLElement;
  const rowFound = document.getElementById('row-info-found-mat') as HTMLElement;

  if (cell.isSeedDependent) {
    rowWall.style.display = 'flex';
    rowFound.style.display = 'flex';

    const { palette, foundMat } = assets.getVariationSetup(cell.seedX, cell.seedY);
    const wallMat = palette.wall as THREE.MeshStandardMaterial;
    let wallColorName = "Cozy Cream";
    const wallHex = wallMat.color.getHex();
    if (wallHex === 0xa84c3e) wallColorName = "Nordic Red";
    if (wallHex === 0xf59e0b) wallColorName = "Autumn Farmhouse";
    if (wallHex === 0xa5f3fc) wallColorName = "Coastal Cottage";
    if (wallHex === 0xfef3c7) wallColorName = "Cozy Cream";
    document.getElementById('info-wall-mat')!.textContent = wallColorName;

    const fMat = foundMat as THREE.MeshStandardMaterial;
    let foundName = "Concrete Gray";
    const foundHex = fMat.color.getHex();
    if (foundHex === 0x73c088) foundName = "Grassy Green";
    if (foundHex === 0xa18262) foundName = "Dirt Brown";
    if (foundHex === 0x8e929b) foundName = "Concrete Gray";
    document.getElementById('info-found-mat')!.textContent = foundName;
  } else {
    rowWall.style.display = 'none';
    rowFound.style.display = 'none';
  }

  updateDayNightLighting();

  // Reset zoom & pitch based on object bounds
  currentRotation = { x: 0.15, y: Math.PI / 4 };
  modalGroup.rotation.set(currentRotation.x, currentRotation.y, 0);

  if (cell.type === 'turbine') {
    cameraZoom = 5.2;
  } else if (cell.type === 'car' || cell.type === 'road') {
    cameraZoom = 2.4;
  } else if (cell.type === 'boardwalk') {
    cameraZoom = 4.2;
  } else if (cell.type === 'water_body' || cell.type === 'bridge') {
    cameraZoom = 3.0;
  } else {
    cameraZoom = 3.6;
  }
  updateCameraPosition();

  modalOverlay.classList.add('active');
  cancelAnimationFrame(animationId);
  renderModalLoop();
}

function closeInteractiveModal() {
  modalOverlay.classList.remove('active');
  cancelAnimationFrame(animationId);
  activeCell = null;
}

document.getElementById('modal-close-btn')!.onclick = closeInteractiveModal;
modalOverlay.onclick = (e) => {
  if (e.target === modalOverlay) closeInteractiveModal();
};

function updateDayNightLighting() {
  if (!modalRenderer) return;
  const winMat = assets.materials.window as THREE.MeshStandardMaterial;

  if (isNightMode) {
    modalScene.background = new THREE.Color(0x090f1d);
    modalAmbient.color.setHex(0x38bdf8);
    modalAmbient.intensity = 0.25;
    modalDirLight.color.setHex(0x60a5fa);
    modalDirLight.intensity = 0.35;
    if (winMat) winMat.emissiveIntensity = 1.4;
  } else {
    modalScene.background = new THREE.Color(0x1e293b);
    modalAmbient.color.setHex(0xffffff);
    modalAmbient.intensity = 0.55;
    modalDirLight.color.setHex(0xffffff);
    modalDirLight.intensity = 1.25;
    if (winMat) winMat.emissiveIntensity = 0.0;
  }
}

document.getElementById('tod-day-btn')!.onclick = () => {
  isNightMode = false;
  document.getElementById('tod-day-btn')!.classList.add('active');
  document.getElementById('tod-night-btn')!.classList.remove('active');
  updateDayNightLighting();
};

document.getElementById('tod-night-btn')!.onclick = () => {
  isNightMode = true;
  document.getElementById('tod-day-btn')!.classList.remove('active');
  document.getElementById('tod-night-btn')!.classList.add('active');
  updateDayNightLighting();
};

document.getElementById('modal-reset-btn')!.onclick = () => {
  currentRotation = { x: 0.15, y: Math.PI / 4 };
  modalGroup.rotation.set(currentRotation.x, currentRotation.y, 0);
  if (activeCell) {
    if (activeCell.type === 'turbine') cameraZoom = 5.2;
    else if (activeCell.type === 'car' || activeCell.type === 'road') cameraZoom = 2.4;
    else if (activeCell.type === 'boardwalk') cameraZoom = 4.2;
    else if (activeCell.type === 'water_body' || activeCell.type === 'bridge') cameraZoom = 3.0;
    else cameraZoom = 3.6;
  }
  updateCameraPosition();
};

document.getElementById('modal-regen-btn')!.onclick = () => {
  if (!activeCell) return;
  activeCell.seedX = Math.floor(Math.random() * 1000);
  activeCell.seedY = Math.floor(Math.random() * 1000);
  
  openInteractiveModal(activeCell);

  const img = document.getElementById(`img-${activeCell.id}`) as HTMLImageElement;
  img.src = generateCellImage(activeCell);
  
  const card = document.getElementById(`cell-${activeCell.id}`) as HTMLDivElement;
  card.querySelector('.meta-details p')!.textContent = `Seed: (${activeCell.seedX}, ${activeCell.seedY})`;
};

// Global controls: Re-roll seeds for seed-dependent assets
document.getElementById('regen-all-btn')!.onclick = () => {
  loadingScreen.style.display = 'flex';
  loadingScreen.style.opacity = '1';
  
  setTimeout(() => {
    cells.forEach((cell) => {
      if (cell.isSeedDependent) {
        cell.seedX = Math.floor(Math.random() * 1000);
        cell.seedY = Math.floor(Math.random() * 1000);
      }
    });
    buildHTMLGrid();
  }, 100);
};

window.onload = () => {
  initBgRenderer();
  buildHTMLGrid();
};
