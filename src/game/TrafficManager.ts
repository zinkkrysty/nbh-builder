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

  // Get 3D coordinate for a grid coordinate
  getTile3DPos(x: number, y: number): THREE.Vector3 {
    return new THREE.Vector3(
      (x - this.gridOffset) * 2,
      0,
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
      const start3D = this.getTile3DPos(car.currentX, car.currentY);
      const target3D = this.getTile3DPos(car.targetX, car.targetY);

      // Lerp position
      const p = new THREE.Vector3().lerpVectors(start3D, target3D, car.progress);

      // Lane Offset: offset car to the right lane of direction of travel
      const dir = new THREE.Vector3().subVectors(target3D, start3D).normalize();
      // Perpendicular vector pointing to the right
      const rightOffset = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(0.38); // 0.38m offset
      p.add(rightOffset);

      car.mesh.position.copy(p);

      // Smooth Yaw Rotation to face target direction
      const angle = Math.atan2(dir.x, dir.z);
      car.mesh.rotation.y = angle;

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

  // Remove single car safely from Three.js scene and free geometry memory
  removeCarAtIndex(idx: number) {
    const car = this.cars[idx];
    this.renderer.scene.remove(car.mesh);
    car.mesh.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
      }
    });
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
