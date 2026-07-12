import * as THREE from 'three';
import { TileType } from './Simulation';

export class InputManager {
  rendererElement: HTMLCanvasElement;
  camera: THREE.OrthographicCamera;
  scene: THREE.Scene;

  // Selected tool state
  activeTool: TileType | 'select' | 'bulldoze' = 'select';

  // Raycasting
  raycaster = new THREE.Raycaster();
  mouse = new THREE.Vector2();

  // Grid references
  gridSize = 50;
  gridOffset = 25;

  // Hover state
  hoveredCell: { x: number; y: number } | null = null;
  isBuildingDrag = false;
  lastBuiltCell: { x: number; y: number } | null = null;
  dragStartCell: { x: number; y: number } | null = null;

  // Ghost indicators
  ghostMesh: THREE.Object3D | null = null;
  ghostMaterials: { [key: string]: THREE.Material } = {};

  // Event handlers
  onBuild: (x: number, y: number, tool: TileType | 'bulldoze') => void = () => {};
  onBuildLine: (cells: { x: number; y: number }[], tool: TileType) => void = () => {};
  onSelect: (x: number, y: number) => void = () => {};
  onHover: (x: number, y: number, coordsList?: { x: number; y: number }[]) => void = () => {};

  constructor(rendererElement: HTMLCanvasElement, camera: THREE.OrthographicCamera, scene: THREE.Scene) {
    this.rendererElement = rendererElement;
    this.camera = camera;
    this.scene = scene;

    this.initGhostMaterials();
    this.setupListeners();
  }

  initGhostMaterials() {
    this.ghostMaterials.valid = new THREE.MeshBasicMaterial({
      color: 0x22c55e, // Green
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    });
    this.ghostMaterials.invalid = new THREE.MeshBasicMaterial({
      color: 0xef4444, // Red
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    });
  }

  setTool(tool: TileType | 'select' | 'bulldoze') {
    this.activeTool = tool;
    this.dragStartCell = null;
    this.updateGhostMesh();
  }

  // Generate ghost mesh overlay snapping to cursor
  updateGhostMesh() {
    if (this.ghostMesh) {
      this.scene.remove(this.ghostMesh);
      this.ghostMesh = null;
    }

    if (this.activeTool === 'select') return;

    // Create simple ghost visuals based on tool
    const group = new THREE.Group();
    const mat = this.ghostMaterials.valid;

    if (this.activeTool === 'road') {
      const geo = new THREE.BoxGeometry(1.9, 0.08, 1.9);
      const mesh = new THREE.Mesh(geo, mat);
      group.add(mesh);
    } else if (this.activeTool === 'residential') {
      const geo = new THREE.BoxGeometry(1.6, 0.6, 1.6);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.y = 0.3;
      group.add(mesh);
    } else if (this.activeTool === 'commercial') {
      const geo = new THREE.BoxGeometry(1.5, 0.9, 1.5);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.y = 0.45;
      group.add(mesh);
    } else if (this.activeTool === 'industrial') {
      const geo = new THREE.BoxGeometry(1.6, 0.7, 1.6);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.y = 0.35;
      group.add(mesh);
    } else if (this.activeTool === 'power' || this.activeTool === 'water') {
      const geo = new THREE.CylinderGeometry(0.5, 0.5, 1.8, 8);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.y = 0.9;
      group.add(mesh);
    } else if (this.activeTool === 'park') {
      const geo = new THREE.BoxGeometry(1.8, 0.1, 1.8);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.y = 0.05;
      group.add(mesh);
    } else if (this.activeTool === 'water_body') {
      const geo = new THREE.BoxGeometry(1.9, 0.05, 1.9);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.y = 0.025;
      group.add(mesh);
    } else if (this.activeTool === 'bulldoze') {
      const geo = new THREE.BoxGeometry(2.0, 0.8, 2.0);
      const mesh = new THREE.Mesh(geo, this.ghostMaterials.invalid);
      mesh.position.y = 0.4;
      group.add(mesh);
    }

    this.ghostMesh = group;
    this.scene.add(this.ghostMesh);
  }

  setupListeners() {
    this.rendererElement.addEventListener('mousemove', this.onMouseMove.bind(this));
    this.rendererElement.addEventListener('mousedown', this.onMouseDown.bind(this));
    window.addEventListener('mouseup', this.onMouseUp.bind(this));
  }

  // Map mouse coordinate to grid (X, Y)
  getIntersectionCoords(e: MouseEvent): { x: number; y: number } | null {
    const rect = this.rendererElement.getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);

    // Raycast against the ground grid plane
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const target = new THREE.Vector3();

    if (this.raycaster.ray.intersectPlane(plane, target)) {
      // Grid cells are 2x2. Align coordinate division
      const x = Math.floor((target.x + 1) / 2) + this.gridOffset;
      const y = Math.floor((target.z + 1) / 2) + this.gridOffset;

      if (x >= 0 && x < this.gridSize && y >= 0 && y < this.gridSize) {
        return { x, y };
      }
    }
    return null;
  }

  getPathCoordinates(start: { x: number; y: number }, end: { x: number; y: number }): { x: number; y: number }[] {
    const coordsList: { x: number; y: number }[] = [];
    const dx = end.x - start.x;
    const dy = end.y - start.y;

    if (Math.abs(dx) >= Math.abs(dy)) {
      // Horizontal line
      const step = dx >= 0 ? 1 : -1;
      const length = Math.abs(dx);
      for (let i = 0; i <= length; i++) {
        coordsList.push({ x: start.x + i * step, y: start.y });
      }
    } else {
      // Vertical line
      const step = dy >= 0 ? 1 : -1;
      const length = Math.abs(dy);
      for (let i = 0; i <= length; i++) {
        coordsList.push({ x: start.x, y: start.y + i * step });
      }
    }
    return coordsList;
  }

  updateGhostMeshLine(cells: { x: number; y: number }[]) {
    if (this.ghostMesh) {
      this.scene.remove(this.ghostMesh);
      this.ghostMesh = null;
    }

    if (this.activeTool !== 'road') return;

    const group = new THREE.Group();
    const mat = this.ghostMaterials.valid;

    for (const cell of cells) {
      const geo = new THREE.BoxGeometry(1.9, 0.08, 1.9);
      const mesh = new THREE.Mesh(geo, mat);
      const xPos = (cell.x - this.gridOffset) * 2;
      const zPos = (cell.y - this.gridOffset) * 2;
      mesh.position.set(xPos, 0, zPos);
      group.add(mesh);
    }

    this.ghostMesh = group;
    this.scene.add(this.ghostMesh);
  }

  onMouseMove(e: MouseEvent) {
    const coords = this.getIntersectionCoords(e);

    if (coords) {
      this.hoveredCell = coords;

      if (this.isBuildingDrag && this.activeTool === 'road' && this.dragStartCell) {
        const cells = this.getPathCoordinates(this.dragStartCell, coords);
        this.updateGhostMeshLine(cells);
        this.onHover(coords.x, coords.y, cells);
      } else {
        this.onHover(coords.x, coords.y);

        if (this.ghostMesh) {
          // If we are not dragging, ensure position snaps to single hovered cell
          const xPos = (coords.x - this.gridOffset) * 2;
          const zPos = (coords.y - this.gridOffset) * 2;
          this.ghostMesh.position.set(xPos, 0, zPos);
        }

        if (this.isBuildingDrag && this.activeTool !== 'select') {
          if (!this.lastBuiltCell || this.lastBuiltCell.x !== coords.x || this.lastBuiltCell.y !== coords.y) {
            this.onBuild(coords.x, coords.y, this.activeTool);
            this.lastBuiltCell = coords;
          }
        }
      }
    } else {
      this.hoveredCell = null;
      if (this.ghostMesh) {
        this.ghostMesh.position.set(0, -500, 0); // Hide off-screen
      }
    }
  }

  onMouseDown(e: MouseEvent) {
    if (e.button !== 0) return; // Only process left click

    const coords = this.getIntersectionCoords(e);
    if (coords) {
      if (this.activeTool === 'select') {
        this.onSelect(coords.x, coords.y);
      } else {
        this.isBuildingDrag = true;
        if (this.activeTool === 'road') {
          this.dragStartCell = coords;
          this.onMouseMove(e);
        } else {
          this.onBuild(coords.x, coords.y, this.activeTool);
          this.lastBuiltCell = coords;
        }
      }
    }
  }

  onMouseUp() {
    if (this.isBuildingDrag && this.activeTool === 'road' && this.dragStartCell && this.hoveredCell) {
      const cells = this.getPathCoordinates(this.dragStartCell, this.hoveredCell);
      this.onBuildLine(cells, 'road');
    }

    this.isBuildingDrag = false;
    this.lastBuiltCell = null;
    this.dragStartCell = null;
    this.updateGhostMesh();
  }

  // Dynamic status feedback to color ghost valid/invalid
  setPlacementValidity(isValid: boolean) {
    if (!this.ghostMesh || this.activeTool === 'bulldoze') return;

    this.ghostMesh.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.material = isValid ? this.ghostMaterials.valid : this.ghostMaterials.invalid;
      }
    });
  }
}
