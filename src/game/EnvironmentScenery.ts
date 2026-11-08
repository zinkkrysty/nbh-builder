import * as THREE from 'three';
import { AssetGenerator } from './AssetGenerator';
import { Simulation } from './Simulation';

/**
 * Renderer-owned, deterministic decoration for tiles which are not currently
 * occupied by player content.  It deliberately keeps no game state: recipes
 * are recreated from Simulation.seed and the current tile state only decides
 * whether a recipe is visible and which terrain height it sits on.
 */

const TILE_WORLD_SIZE = 2;
const ELEVATION_STEP = 0.8;

type PoolKey =
  | 'treeTrunk'
  | 'coniferCrown'
  | 'broadleafCrown'
  | 'blossomCrown'
  | 'bush'
  | 'shrub'
  | 'rock0'
  | 'rock1'
  | 'rock2'
  | 'reeds'
  | 'lilyPads';

type VisibilityKind = 'land' | 'openWater' | 'shoreWater';

interface SceneryProp {
  pool: PoolKey;
  index: number;
  drawSlot?: number;
  visibility: VisibilityKind;
  x: number;
  y: number;
  z: number;
  rotationY: number;
  scaleX: number;
  scaleY: number;
  scaleZ: number;
}

interface TileRecipe {
  x: number;
  y: number;
  props: SceneryProp[];
}

interface PoolDefinition {
  geometry: (assets: AssetGenerator) => THREE.BufferGeometry;
  material: (assets: AssetGenerator) => THREE.Material | THREE.Material[];
  castShadow: boolean;
  receiveShadow: boolean;
}

/** Stateless channel hash. Adding a new channel does not reroll existing ones. */
function hash01(seed: number, gridX: number, gridY: number, slot: number, channel: string): number {
  let value = (seed | 0) ^ Math.imul(gridX + 0x9e3779b9, 0x85ebca6b) ^ Math.imul(gridY + 0xc2b2ae35, 0x27d4eb2f);
  value ^= Math.imul(slot + 0x165667b1, 0xd3a2646c);
  for (let i = 0; i < channel.length; i++) {
    value = Math.imul(value ^ channel.charCodeAt(i), 0x5bd1e995);
    value ^= value >>> 13;
  }
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d);
  value ^= value >>> 15;
  value = Math.imul(value, 0x846ca68b);
  value ^= value >>> 16;
  return (value >>> 0) / 0x100000000;
}

export class EnvironmentScenery {
  private readonly pools = new Map<PoolKey, THREE.InstancedMesh>();
  private readonly recipes = new Map<string, TileRecipe>();
  private readonly dirtyTiles = new Set<string>();
  private readonly activeProps = new Map<PoolKey, SceneryProp[]>();
  private readonly poolCounts = new Map<PoolKey, number>();
  private readonly dummy = new THREE.Object3D();
  private readonly hiddenMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
  private initialized = false;

  constructor(
    private scene: THREE.Scene,
    private simulation: Simulation,
    private assets: AssetGenerator,
  ) {}

  /** Creates all deterministic candidates and applies the current map state. */
  initialize(): void {
    this.rebuildAll();
  }

  /** Useful after loading a different Simulation instance. */
  setSimulation(simulation: Simulation): void {
    this.simulation = simulation;
    if (this.initialized) this.rebuildAll();
  }

  /** Useful if a renderer recreates its scene or AssetGenerator. */
  setRenderDependencies(scene: THREE.Scene, assets: AssetGenerator): void {
    const sceneChanged = scene !== this.scene;
    this.scene = scene;
    this.assets = assets;
    if (this.initialized && sceneChanged) this.rebuildAll();
    else if (this.initialized) this.refreshMaterialProfile();
  }

  rebuildAll(): void {
    this.disposePools();
    this.recipes.clear();
    this.activeProps.clear();
    this.poolCounts.clear();
    this.dirtyTiles.clear();

    const size = this.simulation.gridSize;
    for (let x = 0; x < size; x++) {
      for (let y = 0; y < size; y++) {
        const recipe: TileRecipe = { x, y, props: [] };
        this.createLandRecipe(recipe);
        this.createWaterRecipe(recipe);
        this.recipes.set(this.tileKey(x, y), recipe);
      }
    }

    this.createPools();
    for (const recipe of this.recipes.values()) this.refreshTile(recipe, new Set<PoolKey>());
    for (const pool of this.pools.values()) pool.instanceMatrix.needsUpdate = true;
    this.initialized = true;
  }

  /**
   * Queue a tile refresh. Water rules look one cardinal tile outward, so most
   * tile changes should use the default neighbour refresh.
   */
  markTileDirty(x: number, y: number, includeNeighbors = true): void {
    if (!this.initialized) return;
    const radius = includeNeighbors ? 1 : 0;
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        const nx = x + dx;
        const ny = y + dy;
        if (this.inBounds(nx, ny)) this.dirtyTiles.add(this.tileKey(nx, ny));
      }
    }
  }

  /** Apply all queued local changes. Call once before the next render. */
  flushDirtyTiles(): void {
    if (!this.initialized || this.dirtyTiles.size === 0) return;
    const changedPools = new Set<PoolKey>();
    for (const key of this.dirtyTiles) {
      const recipe = this.recipes.get(key);
      if (recipe) this.refreshTile(recipe, changedPools);
    }
    this.dirtyTiles.clear();
    for (const key of changedPools) this.pools.get(key)!.instanceMatrix.needsUpdate = true;
  }

  /** A concise render-loop alias for flushDirtyTiles(). */
  refresh(): void {
    this.flushDirtyTiles();
  }

  /** Materials are profile-owned by AssetGenerator; recipes and matrices stay intact. */
  refreshMaterialProfile(): void {
    for (const [key, pool] of this.pools) {
      pool.material = this.materialFor(key);
      this.markMaterialNeedsUpdate(pool.material);
    }
  }

  dispose(): void {
    this.disposePools();
    this.recipes.clear();
    this.activeProps.clear();
    this.dirtyTiles.clear();
    this.poolCounts.clear();
    this.initialized = false;
  }

  private createLandRecipe(recipe: TileRecipe): void {
    const { x, y } = recipe;
    const edgeDistance = Math.min(x, y, this.simulation.gridSize - 1 - x, this.simulation.gridSize - 1 - y);
    const treeChance = edgeDistance < 15 ? 0.245 : 0.048;
    const treeRoll = this.random(x, y, 0, 'tree-category');
    const hasTree = treeRoll < treeChance;

    if (hasTree) {
      const family = this.random(x, y, 0, 'tree-family');
      const isBlossom = family > 0.93;
      const isConifer = !isBlossom && family < 0.36;
      const overallScale = 0.82 + this.random(x, y, 0, 'tree-scale') * 0.30;
      const localX = (this.random(x, y, 0, 'tree-offset-x') - 0.5) * 1.04;
      const localZ = (this.random(x, y, 0, 'tree-offset-z') - 0.5) * 1.04;
      const rotation = this.random(x, y, 0, 'tree-rotation') * Math.PI * 2;

      this.addProp(recipe, {
        pool: 'treeTrunk', visibility: 'land', x: localX, y: 0, z: localZ, rotationY: rotation,
        scaleX: overallScale, scaleY: (0.88 + this.random(x, y, 0, 'tree-height') * 0.26) * overallScale, scaleZ: overallScale,
      });

      const crownPool: PoolKey = isBlossom ? 'blossomCrown' : isConifer ? 'coniferCrown' : 'broadleafCrown';
      const slender = !isConifer && !isBlossom && family > 0.76;
      const crownScale = overallScale * (0.92 + this.random(x, y, 1, 'tree-crown-scale') * 0.18);
      this.addProp(recipe, {
        pool: crownPool, visibility: 'land', x: localX, y: 0, z: localZ,
        rotationY: rotation + this.random(x, y, 1, 'tree-crown-rotation') * 0.35,
        scaleX: crownScale * (slender ? 0.70 : 1),
        scaleY: crownScale * (slender ? 1.18 : 1),
        scaleZ: crownScale * (slender ? 0.70 : 1),
      });
    } else if (this.random(x, y, 0, 'rock-category') < 0.068) {
      const rockCount = 1 + Math.floor(this.random(x, y, 0, 'rock-count') * 3);
      const variant = Math.min(2, Math.floor(this.random(x, y, 0, 'rock-variant') * 3));
      const dominantX = (this.random(x, y, 0, 'rock-offset-x') - 0.5) * 0.95;
      const dominantZ = (this.random(x, y, 0, 'rock-offset-z') - 0.5) * 0.95;
      for (let rock = 0; rock < rockCount; rock++) {
        const isDominant = rock === 0;
        const angle = this.random(x, y, rock + 1, 'rock-cluster-angle') * Math.PI * 2;
        const distance = isDominant ? 0 : 0.22 + this.random(x, y, rock + 1, 'rock-cluster-distance') * 0.28;
        const scale = (isDominant ? 0.40 : 0.20) + this.random(x, y, rock + 1, 'rock-scale') * (isDominant ? 0.24 : 0.12);
        this.addProp(recipe, {
          pool: (`rock${(variant + rock) % 3}` as PoolKey), visibility: 'land',
          x: dominantX + Math.cos(angle) * distance, y: 0, z: dominantZ + Math.sin(angle) * distance,
          rotationY: this.random(x, y, rock + 1, 'rock-rotation') * Math.PI * 2,
          scaleX: scale * (0.85 + this.random(x, y, rock + 1, 'rock-width') * 0.32),
          scaleY: scale * (0.60 + this.random(x, y, rock + 1, 'rock-height') * 0.24),
          scaleZ: scale,
        });
      }
    }

    const understoryChance = hasTree ? 0.16 : 0.095;
    if (this.random(x, y, 1, 'understory-category') < understoryChance) {
      const count = 1 + (this.random(x, y, 1, 'understory-count') > 0.70 ? 1 : 0);
      for (let shrub = 0; shrub < count; shrub++) {
        const isBush = this.random(x, y, shrub + 1, 'understory-kind') > 0.46;
        const angle = this.random(x, y, shrub + 1, 'understory-angle') * Math.PI * 2;
        const distance = this.random(x, y, shrub + 1, 'understory-distance') * 0.54;
        const scale = 0.48 + this.random(x, y, shrub + 1, 'understory-scale') * 0.26;
        this.addProp(recipe, {
          pool: isBush ? 'bush' : 'shrub', visibility: 'land',
          x: Math.cos(angle) * distance, y: 0, z: Math.sin(angle) * distance,
          rotationY: this.random(x, y, shrub + 1, 'understory-rotation') * Math.PI * 2,
          scaleX: scale * (isBush ? 1 : 1.3), scaleY: scale, scaleZ: scale,
        });
      }
    }
  }

  private createWaterRecipe(recipe: TileRecipe): void {
    const { x, y } = recipe;
    if (this.random(x, y, 2, 'water-boulder-category') < 0.038) {
      const variant = Math.min(2, Math.floor(this.random(x, y, 2, 'water-boulder-variant') * 3));
      const boulderX = (this.random(x, y, 2, 'water-boulder-offset-x') - 0.5) * 0.68;
      const boulderZ = (this.random(x, y, 2, 'water-boulder-offset-z') - 0.5) * 0.68;
      const scale = 0.60 + this.random(x, y, 2, 'water-boulder-scale') * 0.26;
      this.addProp(recipe, {
        pool: (`rock${variant}` as PoolKey), visibility: 'openWater', x: boulderX, y: -0.20, z: boulderZ,
        rotationY: this.random(x, y, 2, 'water-boulder-rotation') * Math.PI * 2,
        scaleX: scale, scaleY: scale * 0.74, scaleZ: scale,
      });

      // Companion smaller river stone next to the main boulder
      const companionVariant = (variant + 1) % 3;
      const companionAngle = this.random(x, y, 2, 'water-boulder-comp-angle') * Math.PI * 2;
      const companionDist = 0.32 + this.random(x, y, 2, 'water-boulder-comp-dist') * 0.14;
      const companionScale = scale * (0.48 + this.random(x, y, 2, 'water-boulder-comp-scale') * 0.18);
      this.addProp(recipe, {
        pool: (`rock${companionVariant}` as PoolKey),
        visibility: 'openWater',
        x: boulderX + Math.cos(companionAngle) * companionDist,
        y: -0.24,
        z: boulderZ + Math.sin(companionAngle) * companionDist,
        rotationY: this.random(x, y, 2, 'water-boulder-comp-rot') * Math.PI * 2,
        scaleX: companionScale,
        scaleY: companionScale * 0.68,
        scaleZ: companionScale,
      });

      const haloCount = 3 + Math.floor(this.random(x, y, 2, 'water-halo-count') * 4);
      for (let plant = 0; plant < haloCount; plant++) {
        const angle = this.random(x, y, plant + 1, 'water-halo-angle') * Math.PI * 2;
        const distance = 0.52 + this.random(x, y, plant + 1, 'water-halo-distance') * 0.34;
        const isReed = this.random(x, y, plant + 1, 'water-halo-kind') > 0.44;
        const scalePlant = 0.78 + this.random(x, y, plant + 1, 'water-halo-scale') * 0.30;
        this.addProp(recipe, {
          pool: isReed ? 'reeds' : 'lilyPads', visibility: 'openWater',
          x: boulderX + Math.cos(angle) * distance, y: isReed ? -0.055 : -0.025, z: boulderZ + Math.sin(angle) * distance,
          rotationY: this.random(x, y, plant + 1, 'water-halo-rotation') * Math.PI * 2,
          scaleX: scalePlant, scaleY: scalePlant, scaleZ: scalePlant,
        });
      }
    }

    if (this.random(x, y, 3, 'shore-plants-category') < 0.24) {
      const shoreCount = 1 + (this.random(x, y, 3, 'shore-plants-pair') < 0.55 ? 1 : 0);
      for (let idx = 0; idx < shoreCount; idx++) {
        const salt = 3 + idx * 7;
        const isReed = this.random(x, y, salt, 'shore-plants-kind') > 0.38;
        this.addProp(recipe, {
          pool: isReed ? 'reeds' : 'lilyPads', visibility: 'shoreWater',
          x: (this.random(x, y, salt, 'shore-plants-offset-x') - 0.5) * 1.15,
          y: isReed ? -0.055 : -0.025,
          z: (this.random(x, y, salt, 'shore-plants-offset-z') - 0.5) * 1.15,
          rotationY: this.random(x, y, salt, 'shore-plants-rotation') * Math.PI * 2,
          scaleX: 0.80 + this.random(x, y, salt, 'shore-plants-scale') * 0.30,
          scaleY: 0.80 + this.random(x, y, salt, 'shore-plants-scale-y') * 0.30,
          scaleZ: 0.80 + this.random(x, y, salt, 'shore-plants-scale-z') * 0.30,
        });
      }
    }
  }

  private addProp(recipe: TileRecipe, prop: Omit<SceneryProp, 'index'>): void {
    const index = this.poolCounts.get(prop.pool) ?? 0;
    this.poolCounts.set(prop.pool, index + 1);
    recipe.props.push({ ...prop, index });
  }

  private createPools(): void {
    const definitions = this.poolDefinitions();
    for (const key of Object.keys(definitions) as PoolKey[]) {
      const definition = definitions[key];
      const count = this.poolCounts.get(key) ?? 0;
      const mesh = new THREE.InstancedMesh(
        definition.geometry(this.assets),
        definition.material(this.assets),
        Math.max(1, count),
      );
      mesh.count = 0;
      this.activeProps.set(key, []);
      mesh.castShadow = definition.castShadow;
      mesh.receiveShadow = definition.receiveShadow;
      mesh.frustumCulled = false;
      if (count === 0) mesh.setMatrixAt(0, this.hiddenMatrix);
      this.pools.set(key, mesh);
      this.scene.add(mesh);
    }
  }

  private refreshTile(recipe: TileRecipe, changedPools: Set<PoolKey>): void {
    const tile = this.simulation.grid[recipe.x]?.[recipe.y];
    if (!tile) return;
    const baseY = (tile.elevation || 0) * ELEVATION_STEP;
    const centerX = (recipe.x - this.simulation.gridSize / 2) * TILE_WORLD_SIZE;
    const centerZ = (recipe.y - this.simulation.gridSize / 2) * TILE_WORLD_SIZE;

    for (const prop of recipe.props) {
      const pool = this.pools.get(prop.pool);
      if (!pool) continue;
      const active = this.activeProps.get(prop.pool)!;
      if (!this.isVisible(recipe.x, recipe.y, prop.visibility)) {
        if (prop.drawSlot === undefined) continue;
        // Swap the last visible prop into the vacated slot. Hidden candidates
        // retain their deterministic recipe but submit no GPU instances.
        const slot = prop.drawSlot;
        const last = active.pop()!;
        if (last !== prop) {
          pool.getMatrixAt(last.drawSlot!, this.dummy.matrix);
          pool.setMatrixAt(slot, this.dummy.matrix);
          last.drawSlot = slot;
          active[slot] = last;
        }
        prop.drawSlot = undefined;
        pool.count = active.length;
      } else {
        if (prop.drawSlot === undefined) {
          prop.drawSlot = active.length;
          active.push(prop);
          pool.count = active.length;
        }
        this.dummy.position.set(centerX + prop.x, baseY + prop.y, centerZ + prop.z);
        this.dummy.rotation.set(0, prop.rotationY, 0);
        this.dummy.scale.set(prop.scaleX, prop.scaleY, prop.scaleZ);
        this.dummy.updateMatrix();
        pool.setMatrixAt(prop.drawSlot!, this.dummy.matrix);
      }
      changedPools.add(prop.pool);
    }
  }

  private isVisible(x: number, y: number, kind: VisibilityKind): boolean {
    const tile = this.simulation.grid[x]?.[y];
    if (!tile) return false;
    if (kind === 'land') return tile.type === 'empty';
    if (tile.type !== 'water_body' || tile.bridge === true) return false;

    const cardinal = this.cardinalTiles(x, y);
    const hasEngineeredNeighbour = cardinal.some((neighbour) => neighbour && (neighbour.type === 'boardwalk' || neighbour.bridge === true));
    if (hasEngineeredNeighbour) return false;

    if (kind === 'openWater') {
      return cardinal.filter((neighbour) => neighbour?.type === 'water_body' && neighbour.bridge !== true).length >= 3;
    }
    return cardinal.some((neighbour) => neighbour?.type === 'empty');
  }

  private cardinalTiles(x: number, y: number) {
    return [
      this.inBounds(x, y - 1) ? this.simulation.grid[x][y - 1] : undefined,
      this.inBounds(x, y + 1) ? this.simulation.grid[x][y + 1] : undefined,
      this.inBounds(x + 1, y) ? this.simulation.grid[x + 1][y] : undefined,
      this.inBounds(x - 1, y) ? this.simulation.grid[x - 1][y] : undefined,
    ];
  }

  private materialFor(key: PoolKey): THREE.Material | THREE.Material[] {
    return this.poolDefinitions()[key].material(this.assets);
  }

  private poolDefinitions(): Record<PoolKey, PoolDefinition> {
    return {
      treeTrunk: {
        geometry: (assets) => assets.getEnvironmentTreeGeometry('trunk'),
        material: (assets) => assets.materials.trunk, castShadow: true, receiveShadow: true,
      },
      coniferCrown: {
        geometry: (assets) => assets.getEnvironmentTreeGeometry('conifer'),
        material: (assets) => assets.materials.leaves, castShadow: true, receiveShadow: true,
      },
      broadleafCrown: {
        geometry: (assets) => assets.getEnvironmentTreeGeometry('broadleaf'),
        material: (assets) => assets.materials.leaves, castShadow: true, receiveShadow: true,
      },
      blossomCrown: {
        geometry: (assets) => assets.getEnvironmentTreeGeometry('blossom'),
        material: (assets) => assets.materials.blossom, castShadow: true, receiveShadow: true,
      },
      bush: {
        geometry: (assets) => assets.getEnvironmentBushGeometry('bush'),
        material: (assets) => assets.materials.bush, castShadow: false, receiveShadow: true,
      },
      shrub: {
        geometry: (assets) => assets.getEnvironmentBushGeometry('shrub'),
        material: (assets) => assets.materials.shrub, castShadow: false, receiveShadow: true,
      },
      rock0: {
        geometry: (assets) => assets.getEnvironmentRockGeometry(0),
        material: (assets) => assets.materials.stone, castShadow: true, receiveShadow: true,
      },
      rock1: {
        geometry: (assets) => assets.getEnvironmentRockGeometry(1),
        material: (assets) => assets.materials.stone, castShadow: true, receiveShadow: true,
      },
      rock2: {
        geometry: (assets) => assets.getEnvironmentRockGeometry(2),
        material: (assets) => assets.materials.stone, castShadow: true, receiveShadow: true,
      },
      reeds: {
        geometry: (assets) => assets.getEnvironmentPlantGeometry('env_reed_clump'),
        material: (assets) => assets.getEnvironmentPlantMaterials('env_reed_clump'), castShadow: false, receiveShadow: true,
      },
      lilyPads: {
        geometry: (assets) => assets.getEnvironmentPlantGeometry('env_lily_pad_rosette'),
        material: (assets) => assets.getEnvironmentPlantMaterials('env_lily_pad_rosette'), castShadow: false, receiveShadow: true,
      },
    };
  }

  private markMaterialNeedsUpdate(material: THREE.Material | THREE.Material[]): void {
    const materials = Array.isArray(material) ? material : [material];
    materials.forEach((entry) => { entry.needsUpdate = true; });
  }

  private random(x: number, y: number, slot: number, channel: string): number {
    return hash01(this.simulation.seed, x, y, slot, channel);
  }

  private tileKey(x: number, y: number): string {
    return `${x}:${y}`;
  }

  private inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.simulation.gridSize && y < this.simulation.gridSize;
  }

  private disposePools(): void {
    for (const pool of this.pools.values()) {
      this.scene.remove(pool);
      pool.dispose();
    }
    this.pools.clear();
  }
}
