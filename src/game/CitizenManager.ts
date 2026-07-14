import * as THREE from 'three';
import { Simulation, TileState, TileType } from './Simulation';
import { Renderer } from './Renderer';

export interface CitizenProfile {
  firstName: string;
  lastName: string;
  age: number;
  job: string;
  happiness: number;
}

export interface CitizenState {
  id: number;
  mesh: THREE.Group | null;
  profile: CitizenProfile;
  homeX: number;
  homeY: number;
  workX: number | null;
  workY: number | null;
  currentX: number;
  currentY: number;
  targetX: number;
  targetY: number;
  prevX: number;
  prevY: number;
  targetType: 'work' | 'park' | 'boardwalk' | 'home';
  state: 'home' | 'walking_to_work' | 'working' | 'walking_to_park' | 'relaxing_at_park' | 'walking_to_boardwalk' | 'strolling_on_boardwalk' | 'walking_home';
  path: { x: number; y: number }[];
  pathIndex: number;
  progress: number; // 0 to 1 between path nodes
  speed: number;    // cells per second
  relaxTimer: number; // seconds
  sidewalkSide: number; // -1 (left) or 1 (right)
  bobTime: number;
  smoothOffset: THREE.Vector3; // persistent smoothed lateral offset (never reset)
  facingAngle: number; // current smoothed rotation angle
}

export class CitizenManager {
  sim: Simulation;
  renderer: Renderer;
  cims: CitizenState[] = [];
  nextCimId = 1;
  maxCims = 0;

  // Grid references
  gridSize = 50;
  gridOffset = 25;

  // Reusable scratch vectors to avoid frame allocation overhead (GC)
  tempStart3D = new THREE.Vector3();
  tempTarget3D = new THREE.Vector3();
  tempDir = new THREE.Vector3();
  tempPerp = new THREE.Vector3();
  tempRawOffset = new THREE.Vector3();
  tempCurrentOffset = new THREE.Vector3();
  tempPos = new THREE.Vector3();
  tempBoardwalkOffset = new THREE.Vector3();

  private firstNames = [
    'Bob', 'Alice', 'Charlie', 'Daisy', 'Ethan', 'Fiona', 'George', 'Hazel', 'Ian', 'Julia',
    'Kevin', 'Lily', 'Max', 'Nora', 'Oscar', 'Penelope', 'Quincy', 'Rose', 'Sam', 'Tina',
    'Leo', 'Maya', 'Toby', 'Sophie', 'Oliver', 'Emma', 'Jack', 'Mia', 'Henry', 'Grace'
  ];

  private lastNames = [
    'Cozy', 'Warm', 'Gentle', 'Calm', 'Soft', 'Lofi', 'Placid', 'Green', 'Wood', 'Hill',
    'Brook', 'Stone', 'Field', 'Bell', 'Lane', 'Vale', 'Forest', 'Meadow', 'Lake', 'Cove'
  ];

  private jobsList = [
    'Barista', 'Book Clerk', 'Librarian', 'Wind Tech', 'Water Engineer', 'Gardener',
    'Architect', 'Lofi Artist', 'Baker', 'Florist', 'Diner Chef', 'Studio Designer'
  ];

  constructor(sim: Simulation, renderer: Renderer) {
    this.sim = sim;
    this.renderer = renderer;
  }

  // Determine max cims based on current population
  updateMaxCims() {
    // 1 cim per 2 population, minimum 0, maximum 40 to avoid performance degradation
    const resCount = this.getZonedTiles('residential').length;
    if (resCount === 0) {
      this.maxCims = 0;
    } else {
      this.maxCims = Math.min(40, Math.max(3, Math.floor(this.sim.population / 2)));
    }
  }

  // Get all tiles of a certain type
  getZonedTiles(type: TileType): TileState[] {
    return (this.sim.tileCaches[type] || []).filter(tile => tile.level > 0);
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

  // Get 3D coordinate for a grid coordinate
  getTile3DPos(x: number, y: number): THREE.Vector3 {
    const height = this.getRoadCenterHeight(x, y);
    return new THREE.Vector3(
      (x - this.gridOffset) * 2,
      height,
      (y - this.gridOffset) * 2
    );
  }

  // Generate a random citizen profile
  generateProfile(happiness: number): CitizenProfile {
    const firstName = this.firstNames[Math.floor(Math.random() * this.firstNames.length)];
    const lastName = this.lastNames[Math.floor(Math.random() * this.lastNames.length)];
    const age = 18 + Math.floor(Math.random() * 63); // 18 to 80
    const job = this.jobsList[Math.floor(Math.random() * this.jobsList.length)];
    return {
      firstName,
      lastName,
      age,
      job,
      happiness: Math.round(happiness),
    };
  }

  // Find all citizens residing or working at a tile
  getCitizensAtTile(x: number, y: number): CitizenState[] {
    return this.cims.filter(c => 
      (c.homeX === x && c.homeY === y) || 
      (c.workX === x && c.workY === y)
    );
  }

  // Spawn a citizen from a residential house
  spawnCim(): boolean {
    const residences = this.getZonedTiles('residential');
    if (residences.length === 0) return false;

    // Pick random residence
    const home = residences[Math.floor(Math.random() * residences.length)];
    
    // Find job site if any commercial or industrial tiles exist
    const workSites = [...this.getZonedTiles('commercial'), ...this.getZonedTiles('industrial')];
    let workX: number | null = null;
    let workY: number | null = null;
    let jobTitle = 'Unemployed';

    if (workSites.length > 0 && Math.random() > 0.15) {
      const site = workSites[Math.floor(Math.random() * workSites.length)];
      workX = site.x;
      workY = site.y;
      if (site.type === 'commercial') {
        jobTitle = site.level === 1 ? 'Shop Barista' : site.level === 2 ? 'Store Clerk' : 'Studio Designer';
      } else {
        jobTitle = site.level === 1 ? 'Factory Helper' : site.level === 2 ? 'Machinist' : 'Plant Engineer';
      }
    }

    const profile = this.generateProfile(home.happiness);
    if (workX !== null) {
      profile.job = jobTitle;
    } else {
      profile.job = 'Unemployed';
    }

    const cim: CitizenState = {
      id: this.nextCimId++,
      mesh: null,
      profile,
      homeX: home.x,
      homeY: home.y,
      workX,
      workY,
      currentX: home.x,
      currentY: home.y,
      targetX: home.x,
      targetY: home.y,
      prevX: home.x,
      prevY: home.y,
      targetType: 'home',
      state: 'home',
      path: [],
      pathIndex: 0,
      progress: 0.0,
      speed: 0.45 + Math.random() * 0.2, // Calm walk speed: 0.45 to 0.65 cells per second
      relaxTimer: 0,
      sidewalkSide: Math.random() > 0.5 ? 1 : -1,
      bobTime: Math.random() * Math.PI * 2,
      smoothOffset: new THREE.Vector3(),
      facingAngle: 0,
    };

    this.cims.push(cim);
    return true;
  }

  // BFS pathfinding on walkable tiles (road, boardwalk, park) plus the source/target building nodes
  findWalkwayPath(start: { x: number; y: number }, end: { x: number; y: number }): { x: number; y: number }[] | null {
    if (start.x === end.x && start.y === end.y) {
      return [start];
    }

    const queue: { x: number; y: number; path: { x: number; y: number }[] }[] = [];
    const visited = new Uint8Array(this.gridSize * this.gridSize);

    queue.push({ x: start.x, y: start.y, path: [{ x: start.x, y: start.y }] });
    visited[start.y * this.gridSize + start.x] = 1;

    let head = 0;
    const maxVisited = 1500; // prevent lockups
    let visitedCount = 0;

    const isWalkable = (x: number, y: number): boolean => {
      // End tile is always considered walkable for entry
      if (x === end.x && y === end.y) return true;
      // Start tile is walkable for exit
      if (x === start.x && y === start.y) return true;

      const tile = this.sim.grid[x][y];
      return tile.type === 'road' || tile.type === 'boardwalk' || tile.type === 'park';
    };

    while (head < queue.length && visitedCount < maxVisited) {
      const curr = queue[head++];
      visitedCount++;

      if (curr.x === end.x && curr.y === end.y) {
        return curr.path;
      }

      const neighbors = [
        { x: curr.x + 1, y: curr.y },
        { x: curr.x - 1, y: curr.y },
        { x: curr.x, y: curr.y + 1 },
        { x: curr.x, y: curr.y - 1 }
      ];

      for (const n of neighbors) {
        if (n.x >= 0 && n.x < this.gridSize && n.y >= 0 && n.y < this.gridSize) {
          const idx = n.y * this.gridSize + n.x;
          if (visited[idx] === 0 && isWalkable(n.x, n.y)) {
            visited[idx] = 1;
            queue.push({
              x: n.x,
              y: n.y,
              path: [...curr.path, { x: n.x, y: n.y }]
            });
          }
        }
      }
    }

    return null;
  }

  // Create citizen 3D mesh and add to scene
  instantiateCimMesh(cim: CitizenState) {
    if (cim.mesh) return;

    cim.mesh = this.renderer.assets.createCitizenMesh();
    const pos = this.getTile3DPos(cim.currentX, cim.currentY);
    cim.mesh.position.copy(pos);
    cim.mesh.scale.set(0.001, 0.001, 0.001); // start small to scale up (pop effect)
    this.renderer.scene.add(cim.mesh);
  }

  // Despawn/remove mesh safely
  despawnCimMesh(cim: CitizenState) {
    if (cim.mesh) {
      this.renderer.scene.remove(cim.mesh);
      cim.mesh = null;
    }
  }

  // Main update loop
  update(deltaTime: number) {
    if (this.sim.speed === 0) return;

    this.updateMaxCims();

    // 1. Maintain citizen count
    if (this.cims.length < this.maxCims && Math.random() > 0.8) {
      this.spawnCim();
    }
    // Remove citizens if the population declines
    while (this.cims.length > this.maxCims && this.cims.length > 0) {
      const idx = Math.floor(Math.random() * this.cims.length);
      this.despawnCimMesh(this.cims[idx]);
      this.cims.splice(idx, 1);
    }

    const timeStep = deltaTime * this.sim.speed;
    const hours = this.sim.timeOfDay;
    const isNightTime = hours >= 19.5 || hours < 7.0;

    for (let i = this.cims.length - 1; i >= 0; i--) {
      const cim = this.cims[i];

      // Validate home and work site still exist
      const homeTile = this.sim.grid[cim.homeX][cim.homeY];
      if (homeTile.type !== 'residential' || homeTile.level === 0) {
        // Find new home or delete
        const residences = this.getZonedTiles('residential');
        if (residences.length > 0) {
          const newHome = residences[Math.floor(Math.random() * residences.length)];
          cim.homeX = newHome.x;
          cim.homeY = newHome.y;
        } else {
          this.despawnCimMesh(cim);
          this.cims.splice(i, 1);
          continue;
        }
      }

      if (cim.workX !== null && cim.workY !== null) {
        const workTile = this.sim.grid[cim.workX][cim.workY];
        if ((workTile.type !== 'commercial' && workTile.type !== 'industrial') || workTile.level === 0) {
          cim.workX = null;
          cim.workY = null;
          cim.profile.job = 'Unemployed';
          if (cim.state === 'working' || cim.state === 'walking_to_work') {
            this.sendCimHome(cim);
          }
        }
      }

      // Update states
      switch (cim.state) {
        case 'home':
          // Day starts: exit home and go somewhere
          if (!isNightTime && Math.random() > 0.985) {
            this.decideDayActivity(cim);
          }
          break;

        case 'working':
          cim.relaxTimer -= timeStep;
          // Night time or shift ended: walk home
          if (cim.relaxTimer <= 0 || isNightTime) {
            this.sendCimHome(cim);
          }
          break;

        case 'relaxing_at_park':
        case 'strolling_on_boardwalk':
          cim.relaxTimer -= timeStep;
          if (cim.relaxTimer <= 0 || isNightTime) {
            this.sendCimHome(cim);
          }
          break;

        // Walking states
        case 'walking_to_work':
        case 'walking_to_park':
        case 'walking_to_boardwalk':
        case 'walking_home':
          this.updateWalking(cim, timeStep);
          break;
      }
    }
  }

  // Helper to start a cim walking along a path
  private startWalkingOnPath(cim: CitizenState, path: { x: number; y: number }[], walkState: CitizenState['state'], targetType: CitizenState['targetType']) {
    cim.path = path;
    cim.progress = 0.0;

    if (path.length >= 2) {
      // Skip the starting node — it's the tile we're already on
      cim.pathIndex = 1;
      cim.prevX = path[0].x;
      cim.prevY = path[0].y;
      cim.targetX = path[1].x;
      cim.targetY = path[1].y;
    } else {
      // Single-node path (destination == origin)
      cim.pathIndex = 0;
      cim.prevX = path[0].x;
      cim.prevY = path[0].y;
      cim.targetX = path[0].x;
      cim.targetY = path[0].y;
    }

    cim.state = walkState;
    cim.targetType = targetType;
    // NOTE: smoothOffset and facingAngle are intentionally NOT reset —
    // they persist across path changes to prevent position/rotation pops
    this.instantiateCimMesh(cim);
  }

  // Decides what a citizen does during the day
  decideDayActivity(cim: CitizenState) {
    // 1. Work site target (if employed)
    if (cim.workX !== null && cim.workY !== null && Math.random() > 0.4) {
      const path = this.findWalkwayPath({ x: cim.homeX, y: cim.homeY }, { x: cim.workX, y: cim.workY });
      if (path) {
        this.startWalkingOnPath(cim, path, 'walking_to_work', 'work');
        return;
      }
    }

    // 2. Park site target
    const parks = this.getZonedTiles('park');
    if (parks.length > 0 && Math.random() > 0.5) {
      const park = parks[Math.floor(Math.random() * parks.length)];
      const path = this.findWalkwayPath({ x: cim.homeX, y: cim.homeY }, { x: park.x, y: park.y });
      if (path) {
        this.startWalkingOnPath(cim, path, 'walking_to_park', 'park');
        return;
      }
    }

    // 3. Boardwalk site target
    const boardwalks = this.getZonedTiles('boardwalk');
    if (boardwalks.length > 0) {
      const bw = boardwalks[Math.floor(Math.random() * boardwalks.length)];
      const path = this.findWalkwayPath({ x: cim.homeX, y: cim.homeY }, { x: bw.x, y: bw.y });
      if (path) {
        this.startWalkingOnPath(cim, path, 'walking_to_boardwalk', 'boardwalk');
        return;
      }
    }
  }

  // Sends the citizen back home
  sendCimHome(cim: CitizenState) {
    const path = this.findWalkwayPath({ x: cim.currentX, y: cim.currentY }, { x: cim.homeX, y: cim.homeY });
    if (path) {
      this.startWalkingOnPath(cim, path, 'walking_home', 'home');
    } else {
      // Teleport home as safety fallback
      this.despawnCimMesh(cim);
      cim.currentX = cim.homeX;
      cim.currentY = cim.homeY;
      cim.state = 'home';
    }
  }

  // Compute the raw lateral offset for a given tile type and direction
  private computeTileOffset(tileX: number, tileY: number, perp: THREE.Vector3, cim: CitizenState, out: THREE.Vector3): THREE.Vector3 {
    out.set(0, 0, 0);
    const tile = this.sim.grid[tileX][tileY];
    if (tile.type === 'road') {
      out.addScaledVector(perp, cim.sidewalkSide * 0.85);
    } else if (tile.type === 'boardwalk') {
      this.calculateBoardwalkWoodOffset(tileX, tileY, out);
    } else if (tile.type === 'park') {
      const wiggle = Math.sin(cim.bobTime * 2) * 0.15;
      out.addScaledVector(perp, wiggle);
    }
    return out;
  }

  // Process walking movement step and animations
  updateWalking(cim: CitizenState, timeStep: number) {
    if (!cim.mesh) {
      this.instantiateCimMesh(cim);
    }
    const mesh = cim.mesh!;

    // Visual scale-up pop-in animation
    if (mesh.scale.x < 0.9) {
      const s = Math.min(0.9, mesh.scale.x + timeStep * 4.0);
      mesh.scale.set(s, s, s);
    }

    // Advance path progress
    cim.progress += cim.speed * timeStep;

    // Clamp progress so we process at most one tile transition per frame
    const clampedProgress = Math.min(cim.progress, 1.0);

    const startHeight = this.getRoadCenterHeight(cim.prevX, cim.prevY);
    const targetHeight = this.getRoadCenterHeight(cim.targetX, cim.targetY);
    const boundaryHeight = this.getTileBoundaryHeight(cim.prevX, cim.prevY, cim.targetX, cim.targetY);

    // Smooth height interpolation via boundary midpoint
    let height: number;
    if (clampedProgress < 0.5) {
      const t = clampedProgress * 2;
      height = startHeight + (boundaryHeight - startHeight) * t;
    } else {
      const t = (clampedProgress - 0.5) * 2;
      height = boundaryHeight + (targetHeight - boundaryHeight) * t;
    }

    // Direction vectors — safe even when prevX==targetX (handled by path init skipping start node)
    const start3D = this.tempStart3D.set(
      (cim.prevX - this.gridOffset) * 2,
      startHeight,
      (cim.prevY - this.gridOffset) * 2
    );
    const target3D = this.tempTarget3D.set(
      (cim.targetX - this.gridOffset) * 2,
      targetHeight,
      (cim.targetY - this.gridOffset) * 2
    );

    const dir = this.tempDir.subVectors(target3D, start3D);
    const dirLenSq = dir.lengthSq();
    if (dirLenSq > 0.0001) {
      dir.normalize();
    }
    
    // Perpendicular vector for sidewalk offset
    const perp = this.tempPerp.set(-dir.z, 0, dir.x);

    // Compute offsets for BOTH tiles and interpolate based on progress
    // This prevents the hard snap that occurred when switching tile type at progress=0.5
    const prevTileOffset = this.tempRawOffset;
    this.computeTileOffset(cim.prevX, cim.prevY, perp, cim, prevTileOffset);
    
    const targetTileOffset = this.tempCurrentOffset;
    this.computeTileOffset(cim.targetX, cim.targetY, perp, cim, targetTileOffset);

    // Blend between the two tile offsets across the full 0→1 range using smoothstep
    const blendT = clampedProgress * clampedProgress * (3 - 2 * clampedProgress); // smoothstep
    const desiredOffset = this.tempBoardwalkOffset.lerpVectors(prevTileOffset, targetTileOffset, blendT);

    // Exponential smoothing: smoothOffset asymptotically approaches desiredOffset
    // This provides continuous, natural-looking transitions with no window artifacts
    const smoothRate = 1.0 - Math.exp(-8.0 * timeStep); // ~8 Hz time constant
    cim.smoothOffset.lerp(desiredOffset, smoothRate);

    // Calculate final position
    const pos = this.tempPos.set(
      (cim.prevX - this.gridOffset) * 2 + ((cim.targetX - cim.prevX) * 2) * clampedProgress,
      height,
      (cim.prevY - this.gridOffset) * 2 + ((cim.targetY - cim.prevY) * 2) * clampedProgress
    );
    pos.add(cim.smoothOffset);

    // Height offset based on current tile type (interpolated)
    const prevTileType = this.sim.grid[cim.prevX][cim.prevY].type;
    const targetTileType = this.sim.grid[cim.targetX][cim.targetY].type;
    const prevHeightOff = prevTileType === 'road' ? 0.04 : prevTileType === 'boardwalk' ? 0.08 : prevTileType === 'park' ? 0.03 : 0.02;
    const targetHeightOff = targetTileType === 'road' ? 0.04 : targetTileType === 'boardwalk' ? 0.08 : targetTileType === 'park' ? 0.03 : 0.02;
    pos.y += prevHeightOff + (targetHeightOff - prevHeightOff) * clampedProgress;

    mesh.position.copy(pos);

    // Smooth rotation facing target direction (shortest-arc angular interpolation)
    if (dirLenSq > 0.0001) {
      const targetAngle = Math.atan2(dir.x, dir.z);
      // Compute shortest angular delta
      let delta = targetAngle - cim.facingAngle;
      // Wrap to [-PI, PI]
      delta = delta - Math.round(delta / (Math.PI * 2)) * (Math.PI * 2);
      // Exponential smooth
      cim.facingAngle += delta * smoothRate;
      mesh.rotation.y = cim.facingAngle;
    }

    // Walking leg swing and body bobbing animation
    cim.bobTime += timeStep * 11.0;
    
    const legL = mesh.getObjectByName('leg_left') as THREE.Mesh;
    const legR = mesh.getObjectByName('leg_right') as THREE.Mesh;
    const torso = mesh.children[0] as THREE.Mesh;

    if (legL && legR) {
      legL.rotation.x = Math.sin(cim.bobTime) * 0.6;
      legR.rotation.x = -Math.sin(cim.bobTime) * 0.6;
    }
    
    if (torso) {
      // Bob up and down slightly
      torso.position.y = 0.18 + Math.abs(Math.sin(cim.bobTime)) * 0.02;
    }

    // Reach path node — carry over excess progress instead of discarding it
    if (cim.progress >= 1.0) {
      const excess = cim.progress - 1.0;
      cim.prevX = cim.targetX;
      cim.prevY = cim.targetY;
      cim.currentX = cim.targetX;
      cim.currentY = cim.targetY;

      cim.pathIndex++;

      if (cim.pathIndex >= cim.path.length) {
        // Arrived at destination!
        cim.progress = 0.0;
        this.handleArrival(cim);
      } else {
        cim.targetX = cim.path[cim.pathIndex].x;
        cim.targetY = cim.path[cim.pathIndex].y;
        cim.progress = excess; // carry over for seamless movement
      }
    }
  }

  // Calculate wood offset based on adjacent water tiles (writes into provided vector to avoid GC)
  calculateBoardwalkWoodOffset(x: number, y: number, out: THREE.Vector3): THREE.Vector3 {
    out.set(0, 0, 0);
    const adjacentWater = [
      y > 0 && (this.sim.grid[x][y - 1].type === 'water_body' || this.sim.grid[x][y - 1].bridge) ? 'N' : null,
      y < this.gridSize - 1 && (this.sim.grid[x][y + 1].type === 'water_body' || this.sim.grid[x][y + 1].bridge) ? 'S' : null,
      x < this.gridSize - 1 && (this.sim.grid[x + 1][y].type === 'water_body' || this.sim.grid[x + 1][y].bridge) ? 'E' : null,
      x > 0 && (this.sim.grid[x - 1][y].type === 'water_body' || this.sim.grid[x - 1][y].bridge) ? 'W' : null
    ].filter(Boolean);

    if (adjacentWater.length > 0) {
      const primary = adjacentWater[0];
      if (primary === 'N') out.z = -0.68;
      else if (primary === 'S') out.z = 0.68;
      else if (primary === 'E') out.x = 0.68;
      else if (primary === 'W') out.x = -0.68;
    }
    return out;
  }

  // Handle final node arrival behavior
  handleArrival(cim: CitizenState) {
    cim.path = [];
    cim.pathIndex = 0;

    if (cim.state === 'walking_to_work') {
      // Enter workplace: hide mesh
      this.despawnCimMesh(cim);
      cim.state = 'working';
      cim.relaxTimer = 4.0 + Math.random() * 6.0; // 4 to 10 seconds of shift work
    } else if (cim.state === 'walking_to_park') {
      cim.state = 'relaxing_at_park';
      cim.relaxTimer = 8.0 + Math.random() * 12.0; // 8 to 20 seconds relaxing in park
      // Reset legs
      this.resetLegRotations(cim);
    } else if (cim.state === 'walking_to_boardwalk') {
      cim.state = 'strolling_on_boardwalk';
      cim.relaxTimer = 6.0 + Math.random() * 10.0;
      this.resetLegRotations(cim);
    } else if (cim.state === 'walking_home') {
      this.despawnCimMesh(cim);
      cim.state = 'home';
    }
  }

  resetLegRotations(cim: CitizenState) {
    if (cim.mesh) {
      const legL = cim.mesh.getObjectByName('leg_left');
      const legR = cim.mesh.getObjectByName('leg_right');
      if (legL) legL.rotation.x = 0;
      if (legR) legR.rotation.x = 0;
      const torso = cim.mesh.children[0];
      if (torso) torso.position.y = 0.18;
    }
  }

  // Demolish event handler to check road network changes
  handleRoadDemolish(x: number, y: number) {
    for (const cim of this.cims) {
      if (cim.state.startsWith('walking')) {
        const containsTile = cim.path.some(p => p.x === x && p.y === y);
        if (containsTile) {
          // Re-route or send home
          this.sendCimHome(cim);
        }
      }
    }
  }

  clearAll() {
    for (const cim of this.cims) {
      this.despawnCimMesh(cim);
    }
    this.cims = [];
  }
}
