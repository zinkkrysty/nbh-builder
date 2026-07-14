import * as THREE from 'three';
import { Simulation, TileState } from './Simulation';
import { Renderer } from './Renderer';

interface CarState {
  id: number;
  mesh: THREE.Group;
  currentX: number;
  currentY: number;
  targetX: number;
  targetY: number;
  prevX: number;
  prevY: number;
  progress: number; // 0 to 1 along the path
  speed: number;    // Tiles per second
}

export class TrafficManager {
  sim: Simulation;
  renderer: Renderer;
  cars: CarState[] = [];
  nextCarId = 1;
  maxCars = 30;

  // Grid coordinates mapping parameters
  gridSize = 50;
  gridOffset = 25;

  // Reusable vectors to avoid allocations in update loop
  private tempStart3D = new THREE.Vector3();
  private tempTarget3D = new THREE.Vector3();
  private tempDir = new THREE.Vector3();
  private tempRightOffset = new THREE.Vector3();
  private tempPos = new THREE.Vector3();

  constructor(sim: Simulation, renderer: Renderer) {
    this.sim = sim;
    this.renderer = renderer;
  }

  // Set maximum car count proportional to population (calm scale)
  updateMaxCars() {
    // 1 car per 4 citizens, starting at a minimum of 2 cars if any roads exist, up to 35 max.
    const roadCount = this.getRoadTiles().length;
    if (roadCount === 0) {
      this.maxCars = 0;
    } else {
      this.maxCars = Math.min(35, Math.max(3, Math.floor(this.sim.population / 4)));
    }
  }

  getRoadTiles(): TileState[] {
    const list: TileState[] = [];
    for (let x = 0; x < this.gridSize; x++) {
      for (let y = 0; y < this.gridSize; y++) {
        if (this.sim.grid[x][y].type === 'road') {
          list.push(this.sim.grid[x][y]);
        }
      }
    }
    return list;
  }

  getRoadCenterHeight(x: number, y: number): number {
    const tile = this.sim.grid[x][y];
    const H_C = tile.elevation || 0;
    if (tile.type !== 'road' || tile.bridge) return H_C * 0.8;

    const N = y > 0 && this.sim.grid[x][y - 1].type === 'road';
    const S = y < this.sim.gridSize - 1 && this.sim.grid[x][y + 1].type === 'road';
    const E = x < this.sim.gridSize - 1 && this.sim.grid[x + 1][y].type === 'road';
    const W = x > 0 && this.sim.grid[x - 1][y].type === 'road';

    const connectionCount = [N, S, E, W].filter(Boolean).length;
    if (connectionCount === 2) {
      if (N && S && !E && !W) {
        const H_N = this.sim.grid[x][y - 1].elevation || 0;
        const H_S = this.sim.grid[x][y + 1].elevation || 0;
        const y_N = Math.max(H_C, H_N) * 0.8;
        const y_S = Math.max(H_C, H_S) * 0.8;
        if (y_N !== y_S) {
          return (y_N + y_S) / 2;
        }
      } else if (E && W && !N && !S) {
        const H_E = this.sim.grid[x + 1][y].elevation || 0;
        const H_W = this.sim.grid[x - 1][y].elevation || 0;
        const y_E = Math.max(H_C, H_E) * 0.8;
        const y_W = Math.max(H_C, H_W) * 0.8;
        if (y_E !== y_W) {
          return (y_E + y_W) / 2;
        }
      }
    }
    return H_C * 0.8;
  }

  getTileBoundaryHeight(x1: number, y1: number, x2: number, y2: number): number {
    const tile1 = this.sim.grid[x1][y1];
    const tile2 = this.sim.grid[x2][y2];
    if (tile1.bridge || tile2.bridge) return 0.08;
    const H1 = tile1.elevation || 0;
    const H2 = tile2.elevation || 0;
    return Math.max(H1, H2) * 0.8;
  }

  getRoadSlope(x: number, y: number): { x: number; z: number } {
    const tile = this.sim.grid[x][y];
    if (tile.type !== 'road' || tile.bridge) return { x: 0, z: 0 };
    
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
        return { x: 0, z: (y_S - y_N) / 2.0 };
      } else if (E && W && !N && !S) {
        const H_E = this.sim.grid[x + 1][y].elevation || 0;
        const H_W = this.sim.grid[x - 1][y].elevation || 0;
        const y_E = Math.max(H_C, H_E) * 0.8;
        const y_W = Math.max(H_C, H_W) * 0.8;
        return { x: (y_E - y_W) / 2.0, z: 0 };
      }
    }
    return { x: 0, z: 0 };
  }

  // Get 3D coordinate for a grid coordinate
  getTile3DPos(x: number, y: number): THREE.Vector3 {
    const height = this.getRoadCenterHeight(x, y);
    return new THREE.Vector3(
      (x - this.gridOffset) * 2,
      height,
      (y - this.gridOffset) * 2
    );
  }

  // Query valid adjacent road neighbors
  getRoadNeighbors(x: number, y: number): { x: number; y: number }[] {
    const list = [
      { x: x + 1, y },
      { x: x - 1, y },
      { x, y: y + 1 },
      { x, y: y - 1 }
    ];

    return list.filter(n => 
      n.x >= 0 && n.x < this.gridSize && 
      n.y >= 0 && n.y < this.gridSize && 
      this.sim.grid[n.x][n.y].type === 'road'
    );
  }

  spawnCar(): boolean {
    const roads = this.getRoadTiles();
    if (roads.length < 2) return false;

    // Pick random starting road
    const startTile = roads[Math.floor(Math.random() * roads.length)];
    const neighbors = this.getRoadNeighbors(startTile.x, startTile.y);

    if (neighbors.length === 0) return false;

    // Pick random target neighbor
    const target = neighbors[Math.floor(Math.random() * neighbors.length)];

    // Generate mesh from Assets
    const carMesh = this.renderer.assets.createCarMesh();
    
    // Position at start
    const start3D = this.getTile3DPos(startTile.x, startTile.y);
    carMesh.position.copy(start3D);
    this.renderer.scene.add(carMesh);

    const car: CarState = {
      id: this.nextCarId++,
      mesh: carMesh,
      currentX: startTile.x,
      currentY: startTile.y,
      targetX: target.x,
      targetY: target.y,
      prevX: startTile.x,
      prevY: startTile.y,
      progress: 0.0,
      speed: 1.0 + Math.random() * 0.5, // 1 to 1.5 cells per second
    };

    this.cars.push(car);
    return true;
  }

  // Update positions, pathing steps, and rotations
  update(deltaTime: number) {
    if (this.sim.speed === 0) return;

    this.updateMaxCars();

    // Spawn cars if needed
    if (this.cars.length < this.maxCars && Math.random() > 0.95) {
      this.spawnCar();
    }

    // Despawn excess cars if roads are cleared or maxCars decreases
    while (this.cars.length > this.maxCars && this.cars.length > 0) {
      this.removeCarAtIndex(0);
    }

    const timeStep = deltaTime * this.sim.speed;

    for (let i = this.cars.length - 1; i >= 0; i--) {
      const car = this.cars[i];

      // Validate road network is still active under car
      const currentTile = this.sim.grid[car.currentX][car.currentY];
      const targetTile = this.sim.grid[car.targetX][car.targetY];
      
      if (currentTile.type !== 'road' || targetTile.type !== 'road') {
        this.removeCarAtIndex(i);
        continue;
      }

      // Progress movement
      car.progress += car.speed * timeStep;

      // 3D positioning
      const startHeight = this.getRoadCenterHeight(car.currentX, car.currentY);
      const targetHeight = this.getRoadCenterHeight(car.targetX, car.targetY);
      const boundaryHeight = this.getTileBoundaryHeight(car.currentX, car.currentY, car.targetX, car.targetY);

      let height = 0;
      let currentSlope = { x: 0, z: 0 };
      if (car.progress < 0.5) {
        const t = car.progress * 2;
        height = startHeight + (boundaryHeight - startHeight) * t;
        currentSlope = this.getRoadSlope(car.currentX, car.currentY);
      } else {
        const t = (car.progress - 0.5) * 2;
        height = boundaryHeight + (targetHeight - boundaryHeight) * t;
        currentSlope = this.getRoadSlope(car.targetX, car.targetY);
      }

      const p = this.tempPos.set(
        (car.currentX - this.gridOffset) * 2 + ((car.targetX - car.currentX) * 2) * car.progress,
        height,
        (car.currentY - this.gridOffset) * 2 + ((car.targetY - car.currentY) * 2) * car.progress
      );

      // Lane Offset: offset car to the right lane of direction of travel
      const start3D = this.tempStart3D.set(
        (car.currentX - this.gridOffset) * 2,
        startHeight,
        (car.currentY - this.gridOffset) * 2
      );
      const target3D = this.tempTarget3D.set(
        (car.targetX - this.gridOffset) * 2,
        targetHeight,
        (car.targetY - this.gridOffset) * 2
      );
      const dir = this.tempDir.subVectors(target3D, start3D).normalize();
      const rightOffset = this.tempRightOffset.set(-dir.z, 0, dir.x).multiplyScalar(0.38); // 0.38m offset
      p.add(rightOffset);

      car.mesh.position.copy(p);

      // Smooth Yaw and Pitch Rotation based on direction and current tile slope
      const dx = target3D.x - start3D.x;
      const dz = target3D.z - start3D.z;
      const lenXZ = Math.sqrt(dx * dx + dz * dz);
      const dirXZ_x = lenXZ > 0.0001 ? dx / lenXZ : 0;
      const dirXZ_z = lenXZ > 0.0001 ? dz / lenXZ : 0;

      const angle = Math.atan2(dirXZ_x, dirXZ_z);
      const pitch = Math.atan2(currentSlope.x * dirXZ_x + currentSlope.z * dirXZ_z, 1.0);
      car.mesh.rotation.order = 'YXZ';
      car.mesh.rotation.set(-pitch, angle, 0);

      // Transition to next road cell
      if (car.progress >= 1.0) {
        car.progress = 0.0;
        car.prevX = car.currentX;
        car.prevY = car.currentY;
        car.currentX = car.targetX;
        car.currentY = car.targetY;

        // Choose next target
        const nextNeighbors = this.getRoadNeighbors(car.currentX, car.currentY);

        if (nextNeighbors.length === 0) {
          // Road cut off
          this.removeCarAtIndex(i);
          continue;
        }

        // Filter out immediate U-turn unless it's a dead-end road
        let choices = nextNeighbors.filter(n => n.x !== car.prevX || n.y !== car.prevY);
        if (choices.length === 0) {
          choices = nextNeighbors; // Force U-turn
        }

        const nextTarget = choices[Math.floor(Math.random() * choices.length)];
        car.targetX = nextTarget.x;
        car.targetY = nextTarget.y;
      }
    }
  }

  // Remove single car safely from Three.js scene
  removeCarAtIndex(idx: number) {
    const car = this.cars[idx];
    this.renderer.scene.remove(car.mesh);
    this.cars.splice(idx, 1);
  }

  // Safety trigger when player bulldozes road tile
  handleRoadDemolish(x: number, y: number) {
    for (let i = this.cars.length - 1; i >= 0; i--) {
      const car = this.cars[i];
      if (
        (car.currentX === x && car.currentY === y) || 
        (car.targetX === x && car.targetY === y)
      ) {
        this.removeCarAtIndex(i);
      }
    }
  }

  // Dispose all traffic on game reset
  clearAll() {
    while (this.cars.length > 0) {
      this.removeCarAtIndex(0);
    }
  }
}
