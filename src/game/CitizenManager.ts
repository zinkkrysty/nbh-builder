import * as THREE from 'three';
import { Simulation, TileState, TileType, ResidentState, RoutineActivity, RoutineBlock } from './Simulation';
import { Renderer } from './Renderer';
import { CitizenRenderPool } from './CitizenRenderPool';

export interface CitizenState {
  residentId: string;
  mesh: THREE.Group | null;
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
  targetType: 'work' | 'garden' | 'park' | 'boardwalk' | 'home';
  state: 'home' | 'awaiting_arrival_access' | 'arriving_home' | 'walking_to_work' | 'working' | 'walking_to_garden' | 'gardening_in_community_green_space' | 'walking_to_park' | 'relaxing_at_park' | 'walking_to_boardwalk' | 'strolling_on_boardwalk' | 'walking_home';
  activeRoutineBlock: string | null;
  pendingRoutineActivity: RoutineActivity | null;
  routineOffsetHours: number;
  path: { x: number; y: number }[];
  pathIndex: number;
  // Preserves the exact sidewalk point when a completed segment begins a new route.
  routeStartOffset: THREE.Vector3 | null;
  progress: number; // 0 to 1 between path nodes
  speed: number;    // cells per second
  relaxTimer: number; // seconds
  sidewalkSide: number; // -1 (left) or 1 (right)
  bobTime: number;
  facingAngle: number; // current smoothed rotation angle
}

export class CitizenManager {
  sim: Simulation;
  renderer: Renderer;
  cims: CitizenState[] = [];
  private arrivalRetrySeconds = 0;
  private visualPool: CitizenRenderPool;
  private visualPoolCapacity = 512;
  private readonly hitGeometry = new THREE.SphereGeometry(0.28, 8, 6);
  private readonly hitMaterial = new THREE.MeshBasicMaterial({ visible: false });

  // Grid references
  gridSize = 50;
  gridOffset = 25;

  // Reusable scratch vectors to avoid frame allocation overhead (GC)
  tempRawOffset = new THREE.Vector3();
  tempCurrentOffset = new THREE.Vector3();
  tempPos = new THREE.Vector3();
  tempBoardwalkOffset = new THREE.Vector3();



  constructor(sim: Simulation, renderer: Renderer) {
    this.sim = sim;
    this.renderer = renderer;
    this.visualPool = new CitizenRenderPool(renderer.scene, this.visualPoolCapacity);
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



  getSelectableMeshes(): THREE.Object3D[] {
    return this.cims.flatMap(cim => cim.mesh ? [cim.mesh] : []);
  }

  getCitizen(residentId: string): CitizenState | undefined {
    return this.cims.find(cim => cim.residentId === residentId);
  }

  getActivityLabel(residentId: string): string {
    const state = this.getCitizen(residentId)?.state ?? 'home';
    const labels: Record<CitizenState['state'], string> = {
      home: 'At home',
      arriving_home: 'Arriving home',
      awaiting_arrival_access: 'Waiting for road access',
      walking_to_work: 'Walking to work',
      working: 'Working',
      walking_to_garden: 'Walking to a garden',
      gardening_in_community_green_space: 'Gardening in a community green space',
      walking_to_park: 'Walking to a park',
      relaxing_at_park: 'Visiting a park',
      walking_to_boardwalk: 'Walking to the boardwalk',
      strolling_on_boardwalk: 'Strolling on the boardwalk',
      walking_home: 'Walking home',
    };
    return labels[state] ?? 'At home';
  }

  // Find all citizens residing or working at a tile
  getCitizensAtTile(x: number, y: number): CitizenState[] {
    return this.cims.filter(c => {
      const settled = this.sim.getHousehold(this.sim.getResident(c.residentId)?.householdId ?? '')?.status === 'settled';
      return settled && ((c.homeX === x && c.homeY === y) || (c.workX === x && c.workY === y));
    });
  }

  private isValidResident(resident: ResidentState): boolean {
    const household = this.sim.getHousehold(resident.householdId);
    const home = resident.home;
    if (!household || (household.status !== 'settled' && household.status !== 'arriving') || !home
      || household.home?.x !== home.x || household.home?.y !== home.y
      || home.x < 0 || home.x >= this.sim.gridSize || home.y < 0 || home.y >= this.sim.gridSize) return false;

    const tile = this.sim.grid[home.x][home.y];
    return tile.type === 'residential' && tile.constructionStatus === 'complete' && !tile.abandoned && (tile.householdId === household.id || tile.reservedHouseholdId === household.id);
  }

  private createRuntimeCitizen(resident: ResidentState): CitizenState {
    const home = resident.home!;

    return {
      residentId: resident.id,
      mesh: null,
      homeX: home.x,
      homeY: home.y,
      workX: null,
      workY: null,
      currentX: home.x,
      currentY: home.y,
      targetX: home.x,
      targetY: home.y,
      prevX: home.x,
      prevY: home.y,
      targetType: 'home',
      state: 'home',
      activeRoutineBlock: null,
      pendingRoutineActivity: null,
      routineOffsetHours: this.getRoutineOffsetHours(resident),
      path: [],
      pathIndex: 0,
      routeStartOffset: null,
      progress: 0.0,
      speed: 0.45 + Math.random() * 0.2,
      relaxTimer: 0,
      sidewalkSide: Math.random() > 0.5 ? 1 : -1,
      bobTime: Math.random() * Math.PI * 2,
      facingAngle: 0,
    };
  }

  // Spread routine transitions over an hour while keeping each resident's
  // schedule stable across runtime recreations and reloads.
  private getRoutineOffsetHours(resident: ResidentState): number {
    let hash = resident.appearanceSeed >>> 0;
    for (let index = 0; index < resident.id.length; index++) {
      hash = Math.imul(hash ^ resident.id.charCodeAt(index), 16777619) >>> 0;
    }
    return (hash / 0xFFFFFFFF - 0.5) * 1.0;
  }

  // Reconcile transient runtime state with persistent simulation residents without resetting movement.
  syncResidents() {
    const validResidents = new Map(
      this.sim.residents.filter(resident => this.isValidResident(resident)).map(resident => [resident.id, resident])
    );

    for (let index = this.cims.length - 1; index >= 0; index--) {
      const cim = this.cims[index];
      if (!validResidents.has(cim.residentId)) {
        this.despawnCimMesh(cim);
        this.cims.splice(index, 1);
      }
    }

    const runtimeIds = new Set(this.cims.map(cim => cim.residentId));
    for (const resident of validResidents.values()) {
      if (!runtimeIds.has(resident.id)) this.cims.push(this.createRuntimeCitizen(resident));
    }
  }

  stageHouseholdArrival(householdId: string) {
    const household = this.sim.getHousehold(householdId);
    if (!household || household.status !== 'arriving' || !household.home) return;
    this.syncResidents();

    const entries: { x: number; y: number }[] = [];
    for (let x = 0; x < this.gridSize; x++) for (let y = 0; y < this.gridSize; y++) {
      if (x !== 0 && y !== 0 && x !== this.gridSize - 1 && y !== this.gridSize - 1) continue;
      const tile = this.sim.grid[x][y];
      if (tile.type === 'road' || tile.type === 'boardwalk') entries.push({ x, y });
    }
    entries.sort((a, b) => a.x - b.x || a.y - b.y);

    let selectedPath: { x: number; y: number }[] | null = null;
    for (const entry of entries) {
      const path = this.findWalkwayPath(entry, household.home);
      if (path && (!selectedPath || path.length < selectedPath.length)) selectedPath = path;
    }

    for (const residentId of household.residentIds) {
      const cim = this.getCitizen(residentId);
      if (!cim) continue;
      if (!selectedPath) {
        this.despawnCimMesh(cim);
        cim.path = [];
        cim.pathIndex = 0;
        cim.progress = 0;
        cim.state = 'awaiting_arrival_access';
        cim.activeRoutineBlock = null;
        continue;
      }
      cim.currentX = selectedPath[0].x;
      cim.currentY = selectedPath[0].y;
      cim.prevX = selectedPath[0].x;
      cim.prevY = selectedPath[0].y;
      cim.activeRoutineBlock = null;
      this.startWalkingOnPath(cim, selectedPath, 'arriving_home', 'home');
    }
  }

  // BFS pathfinding on walkable tiles (road, boardwalk, park) plus the source/target building nodes
  findWalkwayPath(start: { x: number; y: number }, end: { x: number; y: number }): { x: number; y: number }[] | null {
    if (start.x === end.x && start.y === end.y) {
      return [start];
    }

    const queue: { x: number; y: number }[] = [];
    const parentGrid = new Int16Array(this.gridSize * this.gridSize);
    parentGrid.fill(-1);
    
    const startIndex = start.y * this.gridSize + start.x;
    queue.push(start);
    parentGrid[startIndex] = -2; // Unique identifier for start node

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

    let reached = false;

    while (head < queue.length && visitedCount < maxVisited) {
      const curr = queue[head++];
      visitedCount++;

      if (curr.x === end.x && curr.y === end.y) {
        reached = true;
        break;
      }

      const neighbors = [
        { x: curr.x + 1, y: curr.y },
        { x: curr.x - 1, y: curr.y },
        { x: curr.x, y: curr.y + 1 },
        { x: curr.x, y: curr.y - 1 }
      ];

      const currIdx = curr.y * this.gridSize + curr.x;

      for (const n of neighbors) {
        if (n.x >= 0 && n.x < this.gridSize && n.y >= 0 && n.y < this.gridSize) {
          const idx = n.y * this.gridSize + n.x;
          if (parentGrid[idx] === -1 && isWalkable(n.x, n.y)) {
            parentGrid[idx] = currIdx;
            queue.push(n);
          }
        }
      }
    }

    if (reached) {
      const path: { x: number; y: number }[] = [];
      let currX = end.x;
      let currY = end.y;
      
      while (true) {
        path.push({ x: currX, y: currY });
        const currIdx = currY * this.gridSize + currX;
        const parentIdx = parentGrid[currIdx];
        
        if (parentIdx === -2) {
          break;
        }
        
        currX = parentIdx % this.gridSize;
        currY = Math.floor(parentIdx / this.gridSize);
      }
      
      return path.reverse();
    }

    return null;
  }

  // Create citizen 3D mesh and add to scene
  instantiateCimMesh(cim: CitizenState) {
    if (cim.mesh) return;

    const resident = this.sim.getResident(cim.residentId);
    if (!resident) return;

    this.ensureVisualPoolCapacity();
    cim.mesh = new THREE.Group();
    cim.mesh.userData.residentId = resident.id;
    const hitTarget = new THREE.Mesh(this.hitGeometry, this.hitMaterial);
    hitTarget.userData.residentId = resident.id;
    cim.mesh.add(hitTarget);
    const pos = this.getTile3DPos(cim.currentX, cim.currentY);
    cim.mesh.position.copy(pos);
    this.renderer.scene.add(cim.mesh);
    this.visualPool.registerResident(resident.id, resident.appearanceSeed);
    this.visualPool.setResidentTransform(resident.id, pos, cim.facingAngle, 0.28, false);
  }

  // Grow the shared instance buffers before registering another visible resident.
  // A city is not capped at 512 residents, and many schedules can overlap.
  private ensureVisualPoolCapacity() {
    const visibleResidents = this.cims.filter(cim => cim.mesh).length;
    if (visibleResidents < this.visualPoolCapacity) return;

    const previousPool = this.visualPool;
    this.visualPoolCapacity *= 2;
    this.visualPool = new CitizenRenderPool(this.renderer.scene, this.visualPoolCapacity);

    for (const visibleCim of this.cims) {
      if (!visibleCim.mesh) continue;
      const visibleResident = this.sim.getResident(visibleCim.residentId);
      if (!visibleResident) continue;
      this.visualPool.registerResident(visibleResident.id, visibleResident.appearanceSeed);
      const walking = visibleCim.state.startsWith('walking') || visibleCim.state === 'arriving_home';
      this.visualPool.setResidentTransform(
        visibleResident.id,
        visibleCim.mesh.position,
        visibleCim.mesh.rotation.y,
        0.28,
        walking
      );
    }
    previousPool.dispose();
  }

  // Despawn/remove mesh safely
  despawnCimMesh(cim: CitizenState) {
    if (cim.mesh) {
      this.renderer.scene.remove(cim.mesh);
      cim.mesh = null;
    }
    this.visualPool.unregisterResident(cim.residentId);
  }

  // Main update loop
  update(deltaTime: number) {
    this.syncResidents();
    if (this.sim.speed === 0) {
      this.visualPool.update(0);
      return;
    }
    this.arrivalRetrySeconds -= deltaTime;
    if (this.arrivalRetrySeconds <= 0) {
      this.arrivalRetrySeconds = 5;
      for (const household of this.sim.households) {
        if (household.status !== 'arriving') continue;
        const isWalkingIn = household.residentIds.some(id => this.getCitizen(id)?.state === 'arriving_home');
        if (!isWalkingIn) this.stageHouseholdArrival(household.id);
      }
    }
    const timeStep = deltaTime * this.sim.speed;
    for (let i = this.cims.length - 1; i >= 0; i--) {
      const cim = this.cims[i];
      const resident = this.sim.getResident(cim.residentId);
      if (!resident) continue;

      // Arrival is presentation-only and takes priority over routine scheduling.
      if (cim.state === 'arriving_home') {
        this.updateWalking(cim, timeStep);
        continue;
      }
      if (cim.state === 'awaiting_arrival_access') continue;

      const active = this.resolveRoutineBlock(resident.routine, this.sim.timeOfDay + cim.routineOffsetHours);
      const blockId = active ? `${active.index}:${active.block.activity}:${active.block.startHour}:${active.block.endHour}` : 'home-fallback';
      if (cim.activeRoutineBlock !== blockId) {
        cim.activeRoutineBlock = blockId;
        this.requestRoutineActivity(cim, active?.block.activity ?? 'home');
      }

      switch (cim.state) {
        case 'walking_to_work': // Compatibility for runtime citizens created before schedules were introduced.
        case 'walking_to_garden':
        case 'walking_to_park':
        case 'walking_to_boardwalk':
        case 'walking_home':
          this.updateWalking(cim, timeStep);
          break;
      }
    }
    this.visualPool.update(timeStep);
  }

  private resolveRoutineBlock(routine: RoutineBlock[], timeOfDay: number): { block: RoutineBlock; index: number } | null {
    const hour = ((timeOfDay % 24) + 24) % 24;
    let selected: { block: RoutineBlock; index: number; elapsed: number } | null = null;
    for (let index = 0; index < routine.length; index++) {
      const block = routine[index];
      const duration = block.endHour - block.startHour > 0
        ? block.endHour - block.startHour
        : block.endHour - block.startHour + 24;
      const elapsed = (hour - block.startHour + 24) % 24;
      if (duration > 0 && elapsed < duration && (!selected || elapsed < selected.elapsed || (elapsed === selected.elapsed && index < selected.index))) {
        selected = { block, index, elapsed };
      }
    }
    return selected ? { block: selected.block, index: selected.index } : null;
  }

  private requestRoutineActivity(cim: CitizenState, activity: RoutineActivity) {
    if (cim.state.startsWith('walking')) {
      // Do not replace a route while its visible position lies between nodes.
      // The most recent schedule change wins if another block starts first.
      cim.pendingRoutineActivity = activity;
      return;
    }
    cim.pendingRoutineActivity = null;
    this.beginRoutineActivity(cim, activity);
  }

  private beginRoutineActivity(cim: CitizenState, activity: RoutineActivity, routeStartOffset: THREE.Vector3 | null = null) {
    const destination = this.resolveRoutineDestination(cim, activity);
    if (!destination) {
      this.sendCimHome(cim, routeStartOffset);
      return;
    }

    if (cim.currentX === destination.x && cim.currentY === destination.y) {
      cim.routeStartOffset = null;
      this.enterRoutineActivity(cim, activity);
      return;
    }

    const path = this.findWalkwayPath({ x: cim.currentX, y: cim.currentY }, destination);
    if (!path) {
      this.sendCimHome(cim, routeStartOffset);
      return;
    }

    const walkState: Record<RoutineActivity, CitizenState['state']> = {
      home: 'walking_home',
      work: 'walking_to_work',
      garden: 'walking_to_garden',
      park: 'walking_to_park',
      boardwalk: 'walking_to_boardwalk',
    };
    this.startWalkingOnPath(cim, path, walkState[activity], activity, routeStartOffset);
  }

  private resolveRoutineDestination(cim: CitizenState, activity: RoutineActivity): { x: number; y: number } | null {
    if (activity === 'home') return { x: cim.homeX, y: cim.homeY };
    if (activity === 'work') {
      const resident = this.sim.getResident(cim.residentId);
      const place = resident?.workplacePlaceId ? this.sim.findPlace(resident.workplacePlaceId) : undefined;
      return place?.constructionStatus === 'complete' && place.operatingStatus !== 'closed'
        ? { x: place.x, y: place.y } : { x: cim.homeX, y: cim.homeY };
    }

    // A fulfilled personal garden request takes precedence over the general green-space fallback.
    if (activity === 'garden') {
      const hope = this.sim.getHopeForResident(cim.residentId);
      const target = hope?.status === 'fulfilled' ? hope.targetTile : undefined;
      if (target) {
        const tile = this.sim.grid[target.x]?.[target.y];
        const path = tile?.type === 'park' && !tile.abandoned
          ? this.findWalkwayPath({ x: cim.currentX, y: cim.currentY }, target)
          : null;
        if (path) return { x: target.x, y: target.y };
      }
    }

    // Gardens otherwise use reachable park tiles as community green spaces.
    const destinationType: TileType = activity === 'boardwalk' ? 'boardwalk' : 'park';
    const candidates = this.getZonedTiles(destinationType)
      .sort((a, b) => (Math.abs(cim.currentX - a.x) + Math.abs(cim.currentY - a.y))
        - (Math.abs(cim.currentX - b.x) + Math.abs(cim.currentY - b.y)) || a.x - b.x || a.y - b.y);
    let best: { tile: TileState; pathLength: number } | null = null;
    for (const tile of candidates) {
      const path = this.findWalkwayPath({ x: cim.currentX, y: cim.currentY }, { x: tile.x, y: tile.y });
      if (path && (!best || path.length < best.pathLength
        || (path.length === best.pathLength && (tile.x < best.tile.x || (tile.x === best.tile.x && tile.y < best.tile.y))))) {
        best = { tile, pathLength: path.length };
      }
    }
    return best ? { x: best.tile.x, y: best.tile.y } : null;
  }

  private enterRoutineActivity(cim: CitizenState, activity: RoutineActivity) {
    if (activity === 'home') {
      this.despawnCimMesh(cim);
      cim.state = 'home';
    } else if (activity === 'work') {
      cim.state = 'working';
      this.instantiateCimMesh(cim);
      this.resetLegRotations(cim);
    } else if (activity === 'garden') {
      cim.state = 'gardening_in_community_green_space';
      this.instantiateCimMesh(cim);
      this.resetLegRotations(cim);
    } else if (activity === 'park') {
      cim.state = 'relaxing_at_park';
      this.instantiateCimMesh(cim);
      this.resetLegRotations(cim);
    } else {
      cim.state = 'strolling_on_boardwalk';
      this.instantiateCimMesh(cim);
      this.resetLegRotations(cim);
    }
  }

  // Helper to start a cim walking along a path
  private startWalkingOnPath(
    cim: CitizenState,
    path: { x: number; y: number }[],
    walkState: CitizenState['state'],
    targetType: CitizenState['targetType'],
    routeStartOffset: THREE.Vector3 | null = null
  ) {
    cim.path = path;
    cim.routeStartOffset = routeStartOffset;
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
    // Keep facingAngle across path changes so reroutes do not pop rotation.
    this.instantiateCimMesh(cim);
  }



  // Sends the citizen back home
  sendCimHome(cim: CitizenState, routeStartOffset: THREE.Vector3 | null = null) {
    if (cim.currentX === cim.homeX && cim.currentY === cim.homeY) {
      cim.routeStartOffset = null;
      this.enterRoutineActivity(cim, 'home');
      return;
    }
    const path = this.findWalkwayPath({ x: cim.currentX, y: cim.currentY }, { x: cim.homeX, y: cim.homeY });
    if (path) {
      this.startWalkingOnPath(cim, path, 'walking_home', 'home', routeStartOffset);
    } else {
      // Teleport home as safety fallback
      this.despawnCimMesh(cim);
      cim.currentX = cim.homeX;
      cim.currentY = cim.homeY;
      cim.routeStartOffset = null;
      cim.state = 'home';
    }
  }

  // Compute the lateral offset at a path vertex. Road vertices use the exact
  // intersection of the incoming and outgoing sidewalk lines, so an inside
  // corner turns early and an outside corner continues around the full corner.
  // Keeping one sidewalk side for the route also means a citizen never changes
  // sides in the middle of the road.
  private computePathVertexOffset(cim: CitizenState, pathIndex: number, out: THREE.Vector3): THREE.Vector3 {
    out.set(0, 0, 0);
    const point = cim.path[pathIndex];
    if (!point) return out;
    if (pathIndex === 0 && cim.routeStartOffset) return out.copy(cim.routeStartOffset);

    const tile = this.sim.grid[point.x][point.y];
    if (tile.type === 'road') {
      const previous = pathIndex > 0 ? cim.path[pathIndex - 1] : null;
      const next = pathIndex + 1 < cim.path.length ? cim.path[pathIndex + 1] : null;

      let incomingX = 0;
      let incomingZ = 0;
      let outgoingX = 0;
      let outgoingZ = 0;

      if (previous) {
        const dx = point.x - previous.x;
        const dz = point.y - previous.y;
        const length = Math.hypot(dx, dz);
        if (length > 0.0001) {
          incomingX = dx / length;
          incomingZ = dz / length;
        }
      }
      if (next) {
        const dx = next.x - point.x;
        const dz = next.y - point.y;
        const length = Math.hypot(dx, dz);
        if (length > 0.0001) {
          outgoingX = dx / length;
          outgoingZ = dz / length;
        }
      }

      const hasIncoming = incomingX !== 0 || incomingZ !== 0;
      const hasOutgoing = outgoingX !== 0 || outgoingZ !== 0;
      const sidewalkOffset = cim.sidewalkSide * 0.85;

      if (hasIncoming && hasOutgoing) {
        const directionDot = incomingX * outgoingX + incomingZ * outgoingZ;
        if (Math.abs(directionDot) < 0.001) {
          // Orthogonal turn: the sum of the two perpendiculars is the miter
          // where both offset sidewalk lines meet.
          out.x = (-incomingZ - outgoingZ) * sidewalkOffset;
          out.z = (incomingX + outgoingX) * sidewalkOffset;
        } else {
          // Straight paths (and defensive U-turn handling) use the incoming
          // sidewalk line without doubling its offset.
          out.x = -incomingZ * sidewalkOffset;
          out.z = incomingX * sidewalkOffset;
        }
      } else {
        const directionX = hasOutgoing ? outgoingX : incomingX;
        const directionZ = hasOutgoing ? outgoingZ : incomingZ;
        out.x = -directionZ * sidewalkOffset;
        out.z = directionX * sidewalkOffset;
      }
    } else if (tile.type === 'boardwalk') {
      this.calculateBoardwalkWoodOffset(point.x, point.y, out);
    } else if (tile.type === 'park') {
      const previous = pathIndex > 0 ? cim.path[pathIndex - 1] : null;
      const next = pathIndex + 1 < cim.path.length ? cim.path[pathIndex + 1] : null;
      const neighbor = next ?? previous;
      if (!neighbor) return out;
      const directionX = next ? next.x - point.x : point.x - neighbor.x;
      const directionZ = next ? next.y - point.y : point.y - neighbor.y;
      const length = Math.hypot(directionX, directionZ);
      if (length <= 0.0001) return out;
      const wiggle = Math.sin(cim.bobTime * 2) * 0.15;
      out.x = -(directionZ / length) * wiggle;
      out.z = (directionX / length) * wiggle;
    }
    return out;
  }

  // Process walking movement step and animations
  updateWalking(cim: CitizenState, timeStep: number) {
    if (!cim.mesh) {
      this.instantiateCimMesh(cim);
    }
    const mesh = cim.mesh!;

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

    // Each logical path node has one stable visual position. Interpolating
    // between those positions follows the offset sidewalk polyline exactly,
    // including the shared miter point at a corner.
    const prevTileOffset = this.tempRawOffset;
    this.computePathVertexOffset(cim, cim.pathIndex - 1, prevTileOffset);

    const targetTileOffset = this.tempCurrentOffset;
    this.computePathVertexOffset(cim, cim.pathIndex, targetTileOffset);
    const interpolatedOffset = this.tempBoardwalkOffset.lerpVectors(
      prevTileOffset,
      targetTileOffset,
      clampedProgress
    );

    // Calculate final position
    const pos = this.tempPos.set(
      (cim.prevX - this.gridOffset) * 2 + ((cim.targetX - cim.prevX) * 2) * clampedProgress,
      height,
      (cim.prevY - this.gridOffset) * 2 + ((cim.targetY - cim.prevY) * 2) * clampedProgress
    );
    pos.add(interpolatedOffset);

    // Height offset based on current tile type (interpolated)
    const prevTileType = this.sim.grid[cim.prevX][cim.prevY].type;
    const targetTileType = this.sim.grid[cim.targetX][cim.targetY].type;
    const prevHeightOff = prevTileType === 'road' ? 0.04 : prevTileType === 'boardwalk' ? 0.08 : prevTileType === 'park' ? 0.03 : 0.02;
    const targetHeightOff = targetTileType === 'road' ? 0.04 : targetTileType === 'boardwalk' ? 0.08 : targetTileType === 'park' ? 0.03 : 0.02;
    pos.y += prevHeightOff + (targetHeightOff - prevHeightOff) * clampedProgress;

    mesh.position.copy(pos);

    // Face along the visual sidewalk segment, including any building/park
    // transition that is not parallel to the grid-center path.
    const visualDirX = (cim.targetX - cim.prevX) * 2 + targetTileOffset.x - prevTileOffset.x;
    const visualDirZ = (cim.targetY - cim.prevY) * 2 + targetTileOffset.z - prevTileOffset.z;
    if (visualDirX * visualDirX + visualDirZ * visualDirZ > 0.0001) {
      const targetAngle = Math.atan2(visualDirX, visualDirZ);
      // Compute shortest angular delta
      let delta = targetAngle - cim.facingAngle;
      // Wrap to [-PI, PI]
      delta = delta - Math.round(delta / (Math.PI * 2)) * (Math.PI * 2);
      // Exponential smooth
      const smoothRate = 1.0 - Math.exp(-8.0 * timeStep);
      cim.facingAngle += delta * smoothRate;
      mesh.rotation.y = cim.facingAngle;
    }

    // Walking is rendered by the instanced visual pool; this proxy only carries
    // position, facing, and selection metadata for the rest of the game.
    cim.bobTime += timeStep * 11.0;
    this.visualPool.setResidentTransform(cim.residentId, mesh.position, mesh.rotation.y, 0.28, true);

    // Reach path node — carry over excess progress instead of discarding it
    if (cim.progress >= 1.0) {
      const excess = cim.progress - 1.0;
      cim.prevX = cim.targetX;
      cim.prevY = cim.targetY;
      cim.currentX = cim.targetX;
      cim.currentY = cim.targetY;

      cim.pathIndex++;
      cim.routeStartOffset = null;

      if (cim.pendingRoutineActivity) {
        const pendingActivity = cim.pendingRoutineActivity;
        cim.pendingRoutineActivity = null;
        cim.progress = 0.0;
        const currentCenterX = (cim.currentX - this.gridOffset) * 2;
        const currentCenterZ = (cim.currentY - this.gridOffset) * 2;
        const routeStartOffset = new THREE.Vector3(
          mesh.position.x - currentCenterX,
          0,
          mesh.position.z - currentCenterZ
        );
        this.beginRoutineActivity(cim, pendingActivity, routeStartOffset);
        return;
      }

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

    if (cim.state === 'arriving_home') {
      const resident = this.sim.getResident(cim.residentId);
      if (resident) this.sim.completeHouseholdArrival(resident.householdId);
      this.enterRoutineActivity(cim, 'home');
      // Resume the saved routine on the next update, after the arrival presentation finishes.
      cim.activeRoutineBlock = null;
    } else if (cim.state === 'walking_to_work') {
      // Preserve the legacy runtime state safely; schedules replace it on the next block change.
      this.despawnCimMesh(cim);
      cim.state = 'working';
    } else if (cim.state === 'walking_to_garden') {
      this.enterRoutineActivity(cim, 'garden');
    } else if (cim.state === 'walking_to_park') {
      this.enterRoutineActivity(cim, 'park');
    } else if (cim.state === 'walking_to_boardwalk') {
      this.enterRoutineActivity(cim, 'boardwalk');
    } else if (cim.state === 'walking_home') {
      this.enterRoutineActivity(cim, 'home');
    }
  }

  resetLegRotations(cim: CitizenState) {
    if (cim.mesh) {
      this.visualPool.setResidentTransform(cim.residentId, cim.mesh.position, cim.mesh.rotation.y, 0.28, false);
    }
  }

  // Demolish event handler to check road network changes
  handleRoadDemolish(x: number, y: number) {
    for (const cim of this.cims) {
      if (cim.state.startsWith('walking') || cim.state === 'arriving_home') {
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
