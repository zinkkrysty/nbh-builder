import * as THREE from 'three';
import { Simulation } from './Simulation';

export class AssetGenerator {
  sim: Simulation | null = null;
  // Shared materials for performance
  materials: { [key: string]: THREE.Material } = {};
  // Shared geometries for performance
  geometries: { [key: string]: THREE.BufferGeometry } = {};
  isNightMode: boolean = false;

  // Curated cozy color palettes for procedural residential blocks
  palettes: {
    wall: THREE.MeshStandardMaterial;
    roof: THREE.MeshStandardMaterial;
    trim: THREE.MeshStandardMaterial;
    brick: THREE.MeshStandardMaterial;
  }[] = [];

  // Curated color palettes for procedural commercial buildings
  commercialPalettes: {
    wall: THREE.MeshStandardMaterial;
    roof: THREE.MeshStandardMaterial;
    trim: THREE.MeshStandardMaterial;
    accent: THREE.MeshStandardMaterial;
    brick: THREE.MeshStandardMaterial;
  }[] = [];

  constructor() {
    this.initMaterials();
  }

  getGeometry(key: string, creator: () => THREE.BufferGeometry): THREE.BufferGeometry {
    if (!this.geometries[key]) {
      this.geometries[key] = creator();
    }
    return this.geometries[key];
  }

  initMaterials() {
    // Ground / Grass
    this.materials.grass = new THREE.MeshStandardMaterial({
      color: 0x73c088,
      roughness: 0.8,
      metalness: 0.1,
    });

    this.materials.dirt = new THREE.MeshStandardMaterial({
      color: 0xa18262,
      roughness: 0.9,
    });

    // Roads
    this.materials.road = new THREE.MeshStandardMaterial({
      color: 0x2d3139,
      roughness: 0.8,
    });

    this.materials.roadLine = new THREE.MeshBasicMaterial({
      color: 0xf59e0b, // Yellow lines
    });

    this.materials.roadCrosswalk = new THREE.MeshBasicMaterial({
      color: 0xf8fafc, // White paint for crosswalks
    });

    // Curated Cozy Palettes definition
    const COZY_PALETTES = [
      { wallColor: 0xa84c3e, roofColor: 0x2d3139, trimColor: 0xf8fafc, brickColor: 0x475569 }, // Nordic Red
      { wallColor: 0xf59e0b, roofColor: 0x78350f, trimColor: 0xfef3c7, brickColor: 0xa18262 }, // Autumn Farmhouse
      { wallColor: 0xa5f3fc, roofColor: 0x475569, trimColor: 0xf8fafc, brickColor: 0x94a3b8 }, // Coastal Cottage
      { wallColor: 0xfef3c7, roofColor: 0xb91c1c, trimColor: 0xf8fafc, brickColor: 0xa84c3e }  // Cozy Cream
    ];

    this.palettes = COZY_PALETTES.map(p => ({
      wall: new THREE.MeshStandardMaterial({ color: p.wallColor, roughness: 0.6 }),
      roof: new THREE.MeshStandardMaterial({ color: p.roofColor, roughness: 0.7 }),
      trim: new THREE.MeshStandardMaterial({ color: p.trimColor, roughness: 0.5 }),
      brick: new THREE.MeshStandardMaterial({ color: p.brickColor, roughness: 0.8 })
    }));

    // Curated Commercial Palettes
    const COMMERCIAL_PALETTES = [
      { wallColor: 0xdf8a6c, roofColor: 0x513829, trimColor: 0xfef3c7, accentColor: 0xcc5a37 }, // Bakery/Cafe: Peach/Warm wood/Cream/Orange
      { wallColor: 0x7aa874, roofColor: 0x3d5c36, trimColor: 0xf8fafc, accentColor: 0xe8db7d }, // Grocery/Flower: Sage/Forest/White/Lemon
      { wallColor: 0x486b7c, roofColor: 0x22323d, trimColor: 0xfef5e7, accentColor: 0xca8a04 }, // Bookstore: Deep blue/Slate/Warm-cream/Gold
      { wallColor: 0xe8ebeb, roofColor: 0xc2410c, trimColor: 0x1e293b, accentColor: 0xeab308 }, // Diner: Cream/Orange-red/Dark trim/Yellow
      { wallColor: 0xf3f4f6, roofColor: 0x4b5563, trimColor: 0x0ea5e9, accentColor: 0x0284c7 }  // Office Studio: Light Grey/Slate/Cyan/Blue
    ];

    this.commercialPalettes = COMMERCIAL_PALETTES.map(p => ({
      wall: new THREE.MeshStandardMaterial({ color: p.wallColor, roughness: 0.5 }),
      roof: new THREE.MeshStandardMaterial({ color: p.roofColor, roughness: 0.7 }),
      trim: new THREE.MeshStandardMaterial({ color: p.trimColor, roughness: 0.4 }),
      accent: new THREE.MeshStandardMaterial({ color: p.accentColor, roughness: 0.6 }),
      brick: new THREE.MeshStandardMaterial({ color: p.roofColor, roughness: 0.8 })
    }));

    // Residential Colors (cozy pastels - fallbacks/legacy)
    this.materials.wallRes1 = new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.6 });
    this.materials.wallRes2 = new THREE.MeshStandardMaterial({ color: 0xe0f2fe, roughness: 0.6 });
    this.materials.wallRes3 = new THREE.MeshStandardMaterial({ color: 0xfce7f3, roughness: 0.6 });
    this.materials.roof = new THREE.MeshStandardMaterial({ color: 0xe11d48, roughness: 0.7 }); // Terra cotta red

    // Commercial Colors (modern and sleek)
    this.materials.wallCom = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.4 });
    this.materials.glass = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      roughness: 0.1,
      metalness: 0.9,
      transparent: true,
      opacity: 0.7,
    });

    // Industrial Colors
    this.materials.wallInd = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.7 });
    this.materials.metal = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.3, metalness: 0.8 });

    // Zoned Empty Boundaries
    this.materials.zoneR = new THREE.MeshBasicMaterial({ color: 0x10b981, wireframe: true });
    this.materials.zoneC = new THREE.MeshBasicMaterial({ color: 0x3b82f6, wireframe: true });
    this.materials.zoneI = new THREE.MeshBasicMaterial({ color: 0xeab308, wireframe: true });

    // Wood & Leaves
    this.materials.trunk = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.9 });
    this.materials.leaves = new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.8 });
    this.materials.blossom = new THREE.MeshStandardMaterial({ color: 0xf472b6, roughness: 0.8 }); // Pink trees
    this.materials.darkVoid = new THREE.MeshStandardMaterial({ color: 0x120c08, roughness: 0.95 });

    // Utilities
    this.materials.whiteMetal = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4, metalness: 0.3 });
    this.materials.cement = new THREE.MeshStandardMaterial({
      color: 0x8e929b, // Cement gray
      roughness: 0.85,
    });
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      roughness: 0.15,
      metalness: 0.1,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    waterMat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = { value: 0 };
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
           uniform float uTime;`
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
           vec4 worldPos = modelMatrix * vec4( transformed, 1.0 );
           float wave = sin(worldPos.x * 1.5 + uTime * 2.0) * cos(worldPos.z * 1.5 + uTime * 2.0) * 0.06;
           transformed.z += wave;`
        );
      waterMat.userData.shader = shader;
    };
    this.materials.waterBlue = waterMat;

    // Vegetation Materials (Seeded water features)
    this.materials.lotusPink = new THREE.MeshStandardMaterial({ color: 0xf472b6, roughness: 0.6 });
    this.materials.lilypadGreen = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.9 });
    this.materials.cattailBrown = new THREE.MeshStandardMaterial({ color: 0x5c2d17, roughness: 0.9 });
    this.materials.reedGreen = new THREE.MeshStandardMaterial({ color: 0x166534, roughness: 0.95 });

    // Windows (Glowing at night)
    this.materials.window = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xfef08a,
      emissiveIntensity: 0.0, // Day mode: 0, Night mode: 1.0+
      roughness: 0.2,
    });

    // Fairy lights (glowing orange/yellow bulbs)
    this.materials.fairyLight = new THREE.MeshStandardMaterial({
      color: 0xfdba74,
      emissive: 0xfdba74,
      emissiveIntensity: 0.0,
      roughness: 0.2,
    });

    // Traffic Materials
    this.materials.wheel = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.9 });
    this.materials.headlight = new THREE.MeshStandardMaterial({
      color: 0xfefbaf,
      emissive: 0xfefbaf,
      emissiveIntensity: 0.0,
      roughness: 0.1,
    });
    this.materials.taillight = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0xef4444,
      emissiveIntensity: 0.0,
      roughness: 0.1,
    });
    
    // Preset car body colors
    this.materials.carRed = new THREE.MeshStandardMaterial({ color: 0xe11d48, roughness: 0.5 });
    this.materials.carBlue = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.5 });
    this.materials.carYellow = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.5 });
    this.materials.carGreen = new THREE.MeshStandardMaterial({ color: 0x059669, roughness: 0.5 });
    this.materials.carOrange = new THREE.MeshStandardMaterial({ color: 0xea580c, roughness: 0.5 });
    this.materials.carWhite = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.5 });
  }

  // Set emissive intensity of windows & headlights (0.0 for day, 1.2+ for night)
  setNightMode(isNight: boolean) {
    if (this.isNightMode === isNight) return;
    this.isNightMode = isNight;

    const winMat = this.materials.window as THREE.MeshStandardMaterial;
    gsapAnimate(winMat, 'emissiveIntensity', isNight ? 1.4 : 0.0, 1.5);

    const headMat = this.materials.headlight as THREE.MeshStandardMaterial;
    if (headMat) gsapAnimate(headMat, 'emissiveIntensity', isNight ? 2.5 : 0.0, 1.5);

    const tailMat = this.materials.taillight as THREE.MeshStandardMaterial;
    if (tailMat) gsapAnimate(tailMat, 'emissiveIntensity', isNight ? 1.8 : 0.0, 1.5);

    const fairyMat = this.materials.fairyLight as THREE.MeshStandardMaterial;
    if (fairyMat) gsapAnimate(fairyMat, 'emissiveIntensity', isNight ? 2.0 : 0.0, 1.5);
  }

  // Stable LCG random number generator helper
  getSeededRandom(x: number, y: number) {
    const initialSeed = Math.abs(Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1;
    let seed = Math.floor(initialSeed * 233280); // Scale to large integer for modulo wraparound
    return () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
  }

  // 1. Terrain Grass Tile
  createGroundGeometry(): THREE.BufferGeometry {
    // 2x2 tile size, slightly thick to show depth (low poly look)
    return this.getGeometry('ground_geo', () => {
      const geo = new THREE.BoxGeometry(2, 0.4, 2);
      // Align top of box to y=0
      geo.translate(0, -0.2, 0);
      return geo;
    });
  }

  // 2. Tree Mesh Generator
  createTreeMesh(): THREE.Group {
    const group = new THREE.Group();

    // Trunk
    const trunkGeo = this.getGeometry('tree_trunk', () => {
      const geo = new THREE.CylinderGeometry(0.1, 0.15, 0.6, 5);
      geo.translate(0, 0.3, 0);
      return geo;
    });
    const trunk = new THREE.Mesh(trunkGeo, this.materials.trunk);
    trunk.castShadow = true;
    group.add(trunk);

    // Leaves (layered cones)
    const leafMaterial = Math.random() > 0.8 ? this.materials.blossom : this.materials.leaves;
    const leafBase = Math.random() > 0.5 ? 0.35 : 0.45;

    for (let i = 0; i < 3; i++) {
      const coneGeo = this.getGeometry(`tree_leaf_${leafBase}_${i}`, () => {
        const geo = new THREE.ConeGeometry(leafBase - i * 0.08, 0.6, 5);
        geo.translate(0, 0.7 + i * 0.4, 0);
        return geo;
      });
      const cone = new THREE.Mesh(coneGeo, leafMaterial);
      cone.castShadow = true;
      group.add(cone);
    }

    const scale = 0.8 + Math.random() * 0.4;
    group.scale.set(scale, scale, scale);
    group.rotation.y = Math.random() * Math.PI;

    return group;
  }

  // 3. Road Mesh Generator based on neighbors
  isIntersection(tx: number, ty: number): boolean {
    if (!this.sim) return false;
    if (tx < 0 || tx >= this.sim.gridSize || ty < 0 || ty >= this.sim.gridSize) return false;
    const tile = this.sim.grid[tx][ty];
    if (tile.type !== 'road') return false;

    const conn = {
      N: ty > 0 && (this.sim.grid[tx][ty - 1].type === 'road' || this.sim.grid[tx][ty - 1].type === 'boardwalk'),
      S: ty < this.sim.gridSize - 1 && (this.sim.grid[tx][ty + 1].type === 'road' || this.sim.grid[tx][ty + 1].type === 'boardwalk'),
      E: tx < this.sim.gridSize - 1 && (this.sim.grid[tx + 1][ty].type === 'road' || this.sim.grid[tx + 1][ty].type === 'boardwalk'),
      W: tx > 0 && (this.sim.grid[tx - 1][ty].type === 'road' || this.sim.grid[tx - 1][ty].type === 'boardwalk')
    };
    const cnt = [conn.N, conn.S, conn.E, conn.W].filter(Boolean).length;
    return cnt >= 3;
  }

  getBoardwalkDeckSide(bx: number, by: number): 'N' | 'S' | 'E' | 'W' | null {
    if (!this.sim) return null;
    if (bx < 0 || bx >= this.sim.gridSize || by < 0 || by >= this.sim.gridSize) return null;
    const tile = this.sim.grid[bx][by];
    if (tile.type !== 'boardwalk') return null;

    const N = tile.y > 0 && (this.sim.grid[tile.x][tile.y - 1].type === 'water_body' || this.sim.grid[tile.x][tile.y - 1].bridge === true);
    const S = tile.y < this.sim.gridSize - 1 && (this.sim.grid[tile.x][tile.y + 1].type === 'water_body' || this.sim.grid[tile.x][tile.y + 1].bridge === true);
    const E = tile.x < this.sim.gridSize - 1 && (this.sim.grid[tile.x + 1][tile.y].type === 'water_body' || this.sim.grid[tile.x + 1][tile.y].bridge === true);
    const W = tile.x > 0 && (this.sim.grid[tile.x - 1][tile.y].type === 'water_body' || this.sim.grid[tile.x - 1][tile.y].bridge === true);

    if (N) return 'N';
    if (S) return 'S';
    if (E) return 'E';
    if (W) return 'W';
    return 'N';
  }

  // 3. Road Mesh Generator based on neighbors
  createRoadMesh(
    connections: { N: boolean; S: boolean; E: boolean; W: boolean },
    isBridge = false,
    neighbors = { N: false, S: false, E: false, W: false },
    tileX = 0,
    tileY = 0
  ): THREE.Group {
    const group = new THREE.Group();

    if (isBridge) {
      // 1. Water underneath (continuous plane mesh)
      group.add(this.createWaterMesh(neighbors));

      // 2. Wood deck (top of deck is at y = 0.08)
      const deckGeo = new THREE.BoxGeometry(2, 0.08, 2);
      const deck = new THREE.Mesh(deckGeo, this.materials.trunk);
      deck.position.y = 0.04;
      deck.castShadow = true;
      deck.receiveShadow = true;
      group.add(deck);
    } else {
      // Main road base
      const baseGeo = new THREE.BoxGeometry(2, 0.04, 2);
      const base = new THREE.Mesh(baseGeo, this.materials.road);
      base.receiveShadow = true;
      group.add(base);
    }

    // Add yellow lines based on connectivity
    const { N, S, E, W } = connections;
    const lineMat = this.materials.roadLine;
    const lineY = isBridge ? 0.081 : 0.021;

    // Helper to add line segment
    const addLine = (w: number, h: number, x: number, z: number, rotY = 0) => {
      const lineGeo = new THREE.PlaneGeometry(w, h);
      const line = new THREE.Mesh(lineGeo, lineMat);
      line.rotation.x = -Math.PI / 2;
      line.rotation.z = rotY;
      line.position.set(x, lineY, z);
      group.add(line);
    };

    const count = [N, S, E, W].filter(Boolean).length;

    // Find crosswalks to be painted on this road tile
    const activeCrosswalksNS: number[] = []; // Z positions for EW crosswalks
    const activeCrosswalksEW: number[] = []; // X positions for NS crosswalks

    // Only render crosswalks on road tiles exterior to intersections (count < 3) and not on bridge tiles
    if (count < 3 && !isBridge && this.sim && tileX > 0 && tileX < this.sim.gridSize - 1 && tileY > 0 && tileY < this.sim.gridSize - 1) {
      // 1. Check if connected neighbors are road intersections
      if (N && this.isIntersection(tileX, tileY - 1)) activeCrosswalksNS.push(-0.65);
      if (S && this.isIntersection(tileX, tileY + 1)) activeCrosswalksNS.push(0.65);
      if (E && this.isIntersection(tileX + 1, tileY)) activeCrosswalksEW.push(0.65);
      if (W && this.isIntersection(tileX - 1, tileY)) activeCrosswalksEW.push(-0.65);

      // 2. Check if flanked by boardwalks on both sides, and adjacent to a bridge
      if (activeCrosswalksNS.length === 0 && activeCrosswalksEW.length === 0) {
        const tileN = this.sim.grid[tileX][tileY - 1];
        const tileS = this.sim.grid[tileX][tileY + 1];
        const tileE = this.sim.grid[tileX + 1][tileY];
        const tileW = this.sim.grid[tileX - 1][tileY];

        if (tileW.type === 'boardwalk' && tileE.type === 'boardwalk') {
          // Check if North or South neighbor is a bridge
          if (tileS.type === 'road' && tileS.bridge === true) {
            activeCrosswalksNS.push(0.65);
          } else if (tileN.type === 'road' && tileN.bridge === true) {
            activeCrosswalksNS.push(-0.65);
          }
        } else if (tileN.type === 'boardwalk' && tileS.type === 'boardwalk') {
          // Check if East or West neighbor is a bridge
          if (tileE.type === 'road' && tileE.bridge === true) {
            activeCrosswalksEW.push(0.65);
          } else if (tileW.type === 'road' && tileW.bridge === true) {
            activeCrosswalksEW.push(-0.65);
          }
        }
      }
    }

    // Helper to draw a centerline with gaps at crosswalks
    const addCenterlineWithGaps = (dir: 'NS' | 'EW', crosswalks: number[]) => {
      if (crosswalks.length === 0) {
        if (dir === 'NS') addLine(0.06, 2, 0, 0);
        else addLine(0.06, 2, 0, 0, Math.PI / 2);
        return;
      }

      const sorted = [...crosswalks].sort((a, b) => a - b);
      let start = -1.0;
      for (const cwVal of sorted) {
        const cwStart = cwVal - 0.175;
        const cwEnd = cwVal + 0.175;
        if (cwStart > start) {
          const len = cwStart - start;
          const center = start + len / 2;
          if (dir === 'NS') addLine(0.06, len, 0, center);
          else addLine(0.06, len, center, 0, Math.PI / 2);
        }
        start = cwEnd;
      }
      if (start < 1.0) {
        const len = 1.0 - start;
        const center = start + len / 2;
        if (dir === 'NS') addLine(0.06, len, 0, center);
        else addLine(0.06, len, center, 0, Math.PI / 2);
      }
    };

    // Render yellow lines based on connectivity and crosswalk gaps (skip for bridges)
    if (!isBridge) {
      if (count === 0 || (N && S && !E && !W)) {
        // Straight North-South
        addCenterlineWithGaps('NS', activeCrosswalksNS);
      } else if (E && W && !N && !S) {
        // Straight East-West
        addCenterlineWithGaps('EW', activeCrosswalksEW);
      } else if (count === 1) {
        // Dead end (respecting crosswalk boundary if applicable)
        if (N) {
          if (activeCrosswalksNS.includes(-0.65)) addLine(0.06, 0.175, 0, -0.9125);
          else addLine(0.06, 1, 0, -0.5);
        } else if (S) {
          if (activeCrosswalksNS.includes(0.65)) addLine(0.06, 0.175, 0, 0.9125);
          else addLine(0.06, 1, 0, 0.5);
        } else if (E) {
          if (activeCrosswalksEW.includes(0.65)) addLine(0.06, 0.175, 0.9125, 0, Math.PI / 2);
          else addLine(0.06, 1, 0.5, 0, Math.PI / 2);
        } else if (W) {
          if (activeCrosswalksEW.includes(-0.65)) addLine(0.06, 0.175, -0.9125, 0, Math.PI / 2);
          else addLine(0.06, 1, -0.5, 0, Math.PI / 2);
        }
      } else if (count === 2) {
        // Corner turns
        if (N && E) {
          if (activeCrosswalksNS.includes(-0.65)) addLine(0.06, 0.175, 0, -0.9125);
          else addLine(0.06, 1, 0, -0.5);
          
          if (activeCrosswalksEW.includes(0.65)) addLine(0.06, 0.175, 0.9125, 0, Math.PI / 2);
          else addLine(0.06, 1, 0.5, 0, Math.PI / 2);
        } else if (N && W) {
          if (activeCrosswalksNS.includes(-0.65)) addLine(0.06, 0.175, 0, -0.9125);
          else addLine(0.06, 1, 0, -0.5);

          if (activeCrosswalksEW.includes(-0.65)) addLine(0.06, 0.175, -0.9125, 0, Math.PI / 2);
          else addLine(0.06, 1, -0.5, 0, Math.PI / 2);
        } else if (S && E) {
          if (activeCrosswalksNS.includes(0.65)) addLine(0.06, 0.175, 0, 0.9125);
          else addLine(0.06, 1, 0, 0.5);

          if (activeCrosswalksEW.includes(0.65)) addLine(0.06, 0.175, 0.9125, 0, Math.PI / 2);
          else addLine(0.06, 1, 0.5, 0, Math.PI / 2);
        } else if (S && W) {
          if (activeCrosswalksNS.includes(0.65)) addLine(0.06, 0.175, 0, 0.9125);
          else addLine(0.06, 1, 0, 0.5);

          if (activeCrosswalksEW.includes(-0.65)) addLine(0.06, 0.175, -0.9125, 0, Math.PI / 2);
          else addLine(0.06, 1, -0.5, 0, Math.PI / 2);
        }
      } else if (count >= 3) {
        // Junction/Crossroad (dot in center, short lines) - no crosswalks rendered inside the intersection
        const centerDotGeo = new THREE.BoxGeometry(0.1, 0.005, 0.1);
        const centerDot = new THREE.Mesh(centerDotGeo, lineMat);
        centerDot.position.set(0, lineY, 0);
        group.add(centerDot);

        if (N) addLine(0.06, 0.5, 0, -0.75);
        if (S) addLine(0.06, 0.5, 0, 0.75);
        if (E) addLine(0.06, 0.5, 0.75, 0, Math.PI / 2);
        if (W) addLine(0.06, 0.5, -0.75, 0, Math.PI / 2);
      }
    }

    // Helper to paint pedestrian crosswalk (Zebra stripes, extended all the way across the road width 2.0)
    const drawCrosswalk = (cx: number, cz: number, orientation: 'NS' | 'EW') => {
      const stripeMat = this.materials.roadCrosswalk;
      const stripeGeo = this.getGeometry(
        orientation === 'EW' ? 'crosswalk_stripe_ew' : 'crosswalk_stripe_ns',
        () => new THREE.PlaneGeometry(
          orientation === 'EW' ? 0.08 : 0.35,
          orientation === 'EW' ? 0.35 : 0.08
        )
      );

      const offsets = [-0.8, -0.6, -0.4, -0.2, 0, 0.2, 0.4, 0.6, 0.8];
      for (const off of offsets) {
        const stripe = new THREE.Mesh(stripeGeo, stripeMat);
        stripe.rotation.x = -Math.PI / 2;
        if (orientation === 'EW') {
          stripe.position.set(cx + off, lineY + 0.001, cz);
        } else {
          stripe.position.set(cx, lineY + 0.001, cz + off);
        }
        stripe.receiveShadow = true;
        group.add(stripe);
      }
    };

    // Draw Crosswalks on this tile
    for (const zVal of activeCrosswalksNS) {
      drawCrosswalk(0, zVal, 'EW');
    }
    for (const xVal of activeCrosswalksEW) {
      drawCrosswalk(xVal, 0, 'NS');
    }

    // Add bridge railings
    if (isBridge) {
      const railColor = this.materials.trunk;
      const railingHeight = 0.22;
      const railingY = 0.08 + railingHeight / 2;

      const addSideRailing = (xOffset: number, zOffset: number, rotY = 0) => {
        // Horizontal bar
        const barGeo = new THREE.BoxGeometry(2.0, 0.04, 0.04);
        const bar = new THREE.Mesh(barGeo, railColor);
        bar.position.set(xOffset, 0.08 + railingHeight - 0.02, zOffset);
        bar.rotation.y = rotY;
        bar.castShadow = true;
        group.add(bar);

        // Vertical posts
        const postGeo = new THREE.BoxGeometry(0.06, railingHeight, 0.06);
        const offsets = [-0.9, 0, 0.9];
        for (const off of offsets) {
          const post = new THREE.Mesh(postGeo, railColor);
          if (rotY === 0) {
            post.position.set(xOffset + off, railingY, zOffset);
          } else {
            post.position.set(xOffset, railingY, zOffset + off);
          }
          post.castShadow = true;
          group.add(post);
        }
      };

      if (N || S) {
        addSideRailing(-0.95, 0, Math.PI / 2);
        addSideRailing(0.95, 0, Math.PI / 2);
      } else if (E || W) {
        addSideRailing(0, -0.95, 0);
        addSideRailing(0, 0.95, 0);
      } else {
        const postGeo = new THREE.BoxGeometry(0.08, railingHeight, 0.08);
        const corners = [
          { x: -0.9, z: -0.9 },
          { x: 0.9, z: -0.9 },
          { x: -0.9, z: 0.9 },
          { x: 0.9, z: 0.9 }
        ];
        for (const c of corners) {
          const post = new THREE.Mesh(postGeo, railColor);
          post.position.set(c.x, railingY, c.z);
          post.castShadow = true;
          group.add(post);
        }
      }
    }

    return group;
  }

  // 3a. Segmented Water Mesh Creator
  createWaterMesh(neighbors: { N: boolean; S: boolean; E: boolean; W: boolean }): THREE.Group {
    const group = new THREE.Group();

    // 1. Top Water surface plane (subdivided 8x8 for wave vertex displacement)
    const waterGeo = this.getGeometry('water_top_plane_8x8', () => new THREE.PlaneGeometry(2, 2, 8, 8));
    const water = new THREE.Mesh(waterGeo, this.materials.waterBlue);
    water.rotation.x = -Math.PI / 2;
    water.position.y = -0.04;
    water.receiveShadow = true;
    group.add(water);

    // 2. Bottom Dirt plane (covers the bottom grid hole)
    const dirtGeo = this.getGeometry('water_bottom_plane', () => new THREE.PlaneGeometry(2, 2));
    const dirt = new THREE.Mesh(dirtGeo, this.materials.dirt);
    dirt.rotation.x = -Math.PI / 2;
    dirt.position.y = -0.4;
    dirt.receiveShadow = true;
    group.add(dirt);

    // 3. Side Walls (only draw if no adjacent water/bridge)
    const wallH = 0.36;
    const wallY = -0.22;
    const wallGeo = this.getGeometry('water_side_wall_0.36', () => new THREE.PlaneGeometry(2, wallH));
    const wallMat = this.materials.dirt;

    // North Wall (Z = -0.99)
    if (!neighbors.N) {
      const wallN = new THREE.Mesh(wallGeo, wallMat);
      wallN.position.set(0, wallY, -0.99);
      wallN.receiveShadow = true;
      group.add(wallN);
    }
    // South Wall (Z = 0.99)
    if (!neighbors.S) {
      const wallS = new THREE.Mesh(wallGeo, wallMat);
      wallS.position.set(0, wallY, 0.99);
      wallS.rotation.y = Math.PI;
      wallS.receiveShadow = true;
      group.add(wallS);
    }
    // East Wall (X = 0.99)
    if (!neighbors.E) {
      const wallE = new THREE.Mesh(wallGeo, wallMat);
      wallE.position.set(0.99, wallY, 0);
      wallE.rotation.y = -Math.PI / 2;
      wallE.receiveShadow = true;
      group.add(wallE);
    }
    // West Wall (X = -0.99)
    if (!neighbors.W) {
      const wallW = new THREE.Mesh(wallGeo, wallMat);
      wallW.position.set(-0.99, wallY, 0);
      wallW.rotation.y = Math.PI / 2;
      wallW.receiveShadow = true;
      group.add(wallW);
    }

    return group;
  }

  // 3b. Water Body Mesh Generator
  createWaterBodyMesh(tileX = 0, tileY = 0, neighbors = { N: false, S: false, E: false, W: false }): THREE.Group {
    const group = new THREE.Group();

    // Add continuous water mesh
    group.add(this.createWaterMesh(neighbors));

    // Stable Seeded Vegetation Placement
    const rand = this.getSeededRandom(tileX, tileY);
    const vegRoll = rand();

    if (vegRoll < 0.15) {
      // 15% chance for lilypads
      group.add(this.createLilypadMesh(rand));
    } else if (vegRoll >= 0.15 && vegRoll < 0.35) {
      // 20% chance for cattails/reeds
      group.add(this.createReedsMesh(rand));
    }

    return group;
  }

  getPierDirectionForTile(bx: number, by: number): 'N' | 'S' | 'E' | 'W' | null {
    if (!this.sim) return null;
    if (bx < 0 || bx >= this.sim.gridSize || by < 0 || by >= this.sim.gridSize) return null;
    const tile = this.sim.grid[bx][by];
    if (tile.type !== 'boardwalk') return null;

    // Recreate waterNeighbors for the neighboring tile
    const waterNeighbors = {
      N: tile.y > 0 && (this.sim.grid[tile.x][tile.y - 1].type === 'water_body' || this.sim.grid[tile.x][tile.y - 1].bridge === true),
      S: tile.y < this.sim.gridSize - 1 && (this.sim.grid[tile.x][tile.y + 1].type === 'water_body' || this.sim.grid[tile.x][tile.y + 1].bridge === true),
      E: tile.x < this.sim.gridSize - 1 && (this.sim.grid[tile.x + 1][tile.y].type === 'water_body' || this.sim.grid[tile.x + 1][tile.y].bridge === true),
      W: tile.x > 0 && (this.sim.grid[tile.x - 1][tile.y].type === 'water_body' || this.sim.grid[tile.x - 1][tile.y].bridge === true)
    };

    const waterDirs: ('N' | 'S' | 'E' | 'W')[] = [];
    if (waterNeighbors.N) waterDirs.push('N');
    if (waterNeighbors.S) waterDirs.push('S');
    if (waterNeighbors.E) waterDirs.push('E');
    if (waterNeighbors.W) waterDirs.push('W');

    if (waterDirs.length === 0) return null;

    const rand = this.getSeededRandom(bx, by);
    const pierRoll = rand();
    if (pierRoll < 0.35) {
      const index = Math.floor(rand() * waterDirs.length);
      return waterDirs[index];
    }
    return null;
  }

  // 3c. Boardwalk Mesh Generator
  createBoardwalkMesh(
    tileX = 0,
    tileY = 0,
    _neighbors = { N: false, S: false, E: false, W: false },
    waterNeighbors = { N: false, S: false, E: false, W: false }
  ): THREE.Group {
    const group = new THREE.Group();
    const rand = this.getSeededRandom(tileX, tileY);

    // 1. Determine active water sides
    const activeSides: ('N' | 'S' | 'E' | 'W')[] = [];
    if (waterNeighbors.N) activeSides.push('N');
    if (waterNeighbors.S) activeSides.push('S');
    if (waterNeighbors.E) activeSides.push('E');
    if (waterNeighbors.W) activeSides.push('W');
    if (activeSides.length === 0) activeSides.push('N');

    const primaryAlign = activeSides[0];

    // 2. Determine Grass Portion Center (for prop positioning when not fully surrounded by water)
    let grassX = 0, grassZ = 0;
    if (primaryAlign === 'N' || primaryAlign === 'S') {
      grassX = 0;
      grassZ = primaryAlign === 'N' ? 0.335 : -0.335;
    } else {
      grassX = primaryAlign === 'E' ? -0.335 : 0.335;
      grassZ = 0;
    }

    // 3. Render Boardwalk Deck, Planks, and Curbs for each active water side
    const curbBeamGeoX = this.getGeometry('boardwalk_curb_x_1_3', () => new THREE.BoxGeometry(2.0, 0.08, 0.06));
    const curbBeamGeoZ = this.getGeometry('boardwalk_curb_z_1_3', () => new THREE.BoxGeometry(0.06, 0.08, 2.0));

    for (const side of activeSides) {
      let deckX = 0, deckZ = 0;
      
      if (side === 'N' || side === 'S') {
        deckX = 0;
        deckZ = side === 'N' ? -0.68 : 0.68;
      } else {
        deckX = side === 'E' ? 0.68 : -0.68;
        deckZ = 0;
      }
 
      // Render 11 parallel planks on the deck (narrower: width 0.12, center spacing 2/11, keeping 0.06 gap, matching the pier)
      // Plank length increased from 0.67 to 0.70 to extend fully and overhang the water by 0.03 units.
      if (side === 'N' || side === 'S') {
        const plankGeo = this.getGeometry('boardwalk_plank_ns_1_3_narrower_thick_v4_70', () => new THREE.BoxGeometry(0.12, 0.04, 0.70));
        const spacing = 2.0 / 11;
        const start = -1.0 + spacing / 2;
        for (let i = 0; i < 11; i++) {
          const plank = new THREE.Mesh(plankGeo, this.materials.trunk);
          plank.position.set(start + i * spacing, 0.06, deckZ);
          plank.receiveShadow = true;
          plank.castShadow = true;
          group.add(plank);
        }
      } else {
        const plankGeo = this.getGeometry('boardwalk_plank_ew_1_3_narrower_thick_v4_70', () => new THREE.BoxGeometry(0.70, 0.04, 0.12));
        const spacing = 2.0 / 11;
        const start = -1.0 + spacing / 2;
        for (let i = 0; i < 11; i++) {
          const plank = new THREE.Mesh(plankGeo, this.materials.trunk);
          plank.position.set(deckX, 0.06, start + i * spacing);
          plank.receiveShadow = true;
          plank.castShadow = true;
          group.add(plank);
        }
      }
 
      // Wooden Curb Wall (grass-side) and connecting structural beam (water-side)
      if (side === 'N') {
        const curb = new THREE.Mesh(curbBeamGeoX, this.materials.trunk);
        curb.position.set(0, 0.04, -0.33);
        curb.castShadow = true;
        group.add(curb);
 
        const waterBeam = new THREE.Mesh(curbBeamGeoX, this.materials.trunk);
        waterBeam.position.set(0, 0.04, -0.97);
        waterBeam.castShadow = true;
        group.add(waterBeam);
      } else if (side === 'S') {
        const curb = new THREE.Mesh(curbBeamGeoX, this.materials.trunk);
        curb.position.set(0, 0.04, 0.33);
        curb.castShadow = true;
        group.add(curb);
 
        const waterBeam = new THREE.Mesh(curbBeamGeoX, this.materials.trunk);
        waterBeam.position.set(0, 0.04, 0.97);
        waterBeam.castShadow = true;
        group.add(waterBeam);
      } else if (side === 'E') {
        const curb = new THREE.Mesh(curbBeamGeoZ, this.materials.trunk);
        curb.position.set(0.33, 0.04, 0);
        curb.castShadow = true;
        group.add(curb);
 
        const waterBeam = new THREE.Mesh(curbBeamGeoZ, this.materials.trunk);
        waterBeam.position.set(0.97, 0.04, 0);
        waterBeam.castShadow = true;
        group.add(waterBeam);
      } else if (side === 'W') {
        const curb = new THREE.Mesh(curbBeamGeoZ, this.materials.trunk);
        curb.position.set(-0.33, 0.04, 0);
        curb.castShadow = true;
        group.add(curb);
 
        const waterBeam = new THREE.Mesh(curbBeamGeoZ, this.materials.trunk);
        waterBeam.position.set(-0.97, 0.04, 0);
        waterBeam.castShadow = true;
        group.add(waterBeam);
      }
    }

    // 4. Spawn Random Elements on the grass portion (ONLY if not surrounded by 2 or more water tiles)
    const isMultiWater = activeSides.length >= 2;
    if (!isMultiWater) {
      const elementRoll = rand();
      if (elementRoll < 0.25) {
        // Spawn a Cozy Wooden Bench facing the water
        const bench = new THREE.Group();
        // Seat
        const seatGeo = this.getGeometry('grass_bench_seat', () => new THREE.BoxGeometry(0.5, 0.02, 0.18));
        const seat = new THREE.Mesh(seatGeo, this.materials.trunk);
        seat.position.set(0, 0.08, 0);
        seat.castShadow = true;
        bench.add(seat);

        // Backrest
        const backGeo = this.getGeometry('grass_bench_back', () => new THREE.BoxGeometry(0.5, 0.16, 0.02));
        const back = new THREE.Mesh(backGeo, this.materials.trunk);
        back.position.set(0, 0.16, 0.08);
        back.castShadow = true;
        bench.add(back);

        // Legs
        const legGeo = this.getGeometry('grass_bench_leg', () => new THREE.BoxGeometry(0.04, 0.08, 0.18));
        const legL = new THREE.Mesh(legGeo, this.materials.trunk);
        legL.position.set(-0.22, 0.04, 0);
        legL.castShadow = true;
        bench.add(legL);

        const legR = new THREE.Mesh(legGeo, this.materials.trunk);
        legR.position.set(0.22, 0.04, 0);
        legR.castShadow = true;
        bench.add(legR);

        // Position bench on grass facing boardwalk
        if (primaryAlign === 'N') {
          bench.position.set(0, 0, 0.33);
          bench.rotation.y = Math.PI;
        } else if (primaryAlign === 'S') {
          bench.position.set(0, 0, -0.33);
          bench.rotation.y = 0;
        } else if (primaryAlign === 'E') {
          bench.position.set(-0.33, 0, 0);
          bench.rotation.y = -Math.PI / 2;
        } else if (primaryAlign === 'W') {
          bench.position.set(0.33, 0, 0);
          bench.rotation.y = Math.PI / 2;
        }
        group.add(bench);
      } else if (elementRoll < 0.50) {
        // Spawn a mini decorative shoreline tree
        const tree = this.createTreeMesh();
        tree.scale.set(0.55, 0.55, 0.55);
        tree.position.set(grassX, 0, grassZ);
        group.add(tree);
      } else if (elementRoll < 0.75) {
        // Spawn a low-poly green bush/shrub
        const bushGeo = this.getGeometry('grass_bush', () => new THREE.DodecahedronGeometry(0.18));
        const bush = new THREE.Mesh(bushGeo, this.materials.leaves);
        bush.position.set(grassX, 0.14, grassZ);
        bush.castShadow = true;
        group.add(bush);
      }
    }

    // 5. Shared water-pier checking logic
    const isWaterTileOccupiedByAnotherPier = (wx: number, wy: number, currentBX: number, currentBY: number): boolean => {
      if (!this.sim) return false;
      const neighbors = [
        { x: wx, y: wy - 1 }, // North of water
        { x: wx, y: wy + 1 }, // South of water
        { x: wx - 1, y: wy }, // West of water
        { x: wx + 1, y: wy }  // East of water
      ];
      for (const n of neighbors) {
        if (n.x === currentBX && n.y === currentBY) continue;
        const otherPierDir = this.getPierDirectionForTile(n.x, n.y);
        if (otherPierDir) {
          let targetX = n.x;
          let targetY = n.y;
          if (otherPierDir === 'N') targetY -= 1;
          else if (otherPierDir === 'S') targetY += 1;
          else if (otherPierDir === 'E') targetX += 1;
          else if (otherPierDir === 'W') targetX -= 1;
          
          if (targetX === wx && targetY === wy) {
            return true;
          }
        }
      }
      return false;
    };

    // Filter active water directions that don't already contain a pier from another boardwalk
    const availablePierDirs = activeSides.filter(side => {
      let wx = tileX;
      let wy = tileY;
      if (side === 'N') wy -= 1;
      else if (side === 'S') wy += 1;
      else if (side === 'E') wx += 1;
      else if (side === 'W') wx -= 1;
      return !isWaterTileOccupiedByAnotherPier(wx, wy, tileX, tileY);
    });

    let pierDir: 'N' | 'S' | 'E' | 'W' | null = null;
    if (availablePierDirs.length > 0) {
      const pierRoll = rand();
      if (pierRoll < 0.35) {
        const index = Math.floor(rand() * availablePierDirs.length);
        pierDir = availablePierDirs[index];
      }
    }

    // 6. Waterfront Rope Railings (only on water boundary sides, skipping sides with a pier)
    const addRopeRailing = (xOffset: number, zOffset: number, rotY = 0) => {
      const postGeo = this.getGeometry('boardwalk_post_1_3', () => new THREE.CylinderGeometry(0.04, 0.04, 0.24, 6));
      const offsets = [-0.95, 0, 0.95];
      for (const off of offsets) {
        const post = new THREE.Mesh(postGeo, this.materials.trunk);
        if (rotY === 0) {
          post.position.set(xOffset + off, 0.18, zOffset);
        } else {
          post.position.set(xOffset, 0.18, zOffset + off);
        }
        post.castShadow = true;
        group.add(post);
      }

      const ropeGeo = this.getGeometry('boardwalk_rope_1_3', () => new THREE.BoxGeometry(1.9, 0.02, 0.02));
      const rope = new THREE.Mesh(ropeGeo, this.materials.cement);
      rope.position.set(xOffset, 0.22, zOffset);
      rope.rotation.y = rotY;
      rope.castShadow = true;
      group.add(rope);
    };

    for (const side of activeSides) {
      if (side !== pierDir) {
        if (side === 'N') addRopeRailing(0, -0.95, 0);
        else if (side === 'S') addRopeRailing(0, 0.95, 0);
        else if (side === 'E') addRopeRailing(0.95, 0, Math.PI / 2);
        else if (side === 'W') addRopeRailing(-0.95, 0, Math.PI / 2);
      }
    }

    // 7. Spawn Pier platform & Rowboat
    if (pierDir) {
      const pier = new THREE.Group();

      // 1. Support Beams (Longitudinal)
      const beamGeo = this.getGeometry('pier_beam', () => new THREE.BoxGeometry(0.05, 0.03, 0.9));
      
      const beamL = new THREE.Mesh(beamGeo, this.materials.trunk);
      beamL.position.set(-0.24, 0.015, 1.45);
      beamL.receiveShadow = true;
      beamL.castShadow = true;
      pier.add(beamL);

      const beamR = new THREE.Mesh(beamGeo, this.materials.trunk);
      beamR.position.set(0.24, 0.015, 1.45);
      beamR.receiveShadow = true;
      beamR.castShadow = true;
      pier.add(beamR);

      // 2. Transverse Planks (5 planks with gaps showing water underneath)
      const plankGeo = this.getGeometry('pier_plank', () => new THREE.BoxGeometry(0.54, 0.02, 0.12));
      const zCoords = [1.09, 1.27, 1.45, 1.63, 1.81];
      for (const zVal of zCoords) {
        const plank = new THREE.Mesh(plankGeo, this.materials.trunk);
        plank.position.set(0, 0.04, zVal);
        plank.receiveShadow = true;
        plank.castShadow = true;
        pier.add(plank);
      }

      // Support Pilings (at the end of the shorter pier, Z = 1.8)
      const pilingGeo = this.getGeometry('boardwalk_piling', () => new THREE.CylinderGeometry(0.05, 0.05, 0.44, 6));
      const pilingL = new THREE.Mesh(pilingGeo, this.materials.trunk);
      pilingL.position.set(-0.24, -0.18, 1.8);
      pilingL.castShadow = true;
      pier.add(pilingL);

      const pilingR = new THREE.Mesh(pilingGeo, this.materials.trunk);
      pilingR.position.set(0.24, -0.18, 1.8);
      pilingR.castShadow = true;
      pier.add(pilingR);

      // Accessory (sitting on the shorter pier)
      const accRoll = rand();
      if (accRoll < 0.35) {
        // Lifebuoy
        const buoyPostGeo = this.getGeometry('buoy_post', () => new THREE.CylinderGeometry(0.015, 0.015, 0.2, 4));
        const buoyPost = new THREE.Mesh(buoyPostGeo, this.materials.trunk);
        buoyPost.position.set(0, 0.14, 1.8);
        buoyPost.castShadow = true;
        pier.add(buoyPost);

        const buoyGeo = this.getGeometry('lifebuoy', () => new THREE.TorusGeometry(0.08, 0.025, 6, 12));
        const buoy = new THREE.Mesh(buoyGeo, this.materials.lotusPink);
        buoy.position.set(0, 0.18, 1.78);
        buoy.castShadow = true;
        pier.add(buoy);
      } else if (accRoll < 0.70) {
        // Bench
        const benchSeatGeo = this.getGeometry('pier_bench_seat', () => new THREE.BoxGeometry(0.4, 0.02, 0.16));
        const benchSeat = new THREE.Mesh(benchSeatGeo, this.materials.trunk);
        benchSeat.position.set(0, 0.06, 1.55); // lowered slightly to rest on planks
        benchSeat.castShadow = true;
        pier.add(benchSeat);

        const benchBackGeo = this.getGeometry('pier_bench_back', () => new THREE.BoxGeometry(0.4, 0.12, 0.02));
        const benchBack = new THREE.Mesh(benchBackGeo, this.materials.trunk);
        benchBack.position.set(0, 0.12, 1.63);
        benchBack.castShadow = true;
        pier.add(benchBack);
      } else {
        // Bollard
        const bollardGeo = this.getGeometry('pier_bollard', () => new THREE.CylinderGeometry(0.04, 0.04, 0.1, 5));
        const bollard = new THREE.Mesh(bollardGeo, this.materials.whiteMetal);
        bollard.position.set(0, 0.09, 1.8);
        bollard.castShadow = true;
        pier.add(bollard);
      }

      // Improved Tapered Low-Poly Rowboat (positioned alongside the shorter pier)
      const boatRoll = rand();
      if (boatRoll < 0.40) {
        const boat = new THREE.Group();
        
        // Curved tapered hull using ExtrudeGeometry
        const hullGeo = this.getGeometry('rowboat_hull_shape_v2', () => {
          const shape = new THREE.Shape();
          shape.moveTo(0, 0.4);
          shape.quadraticCurveTo(0.18, 0.22, 0.18, 0.0);
          shape.lineTo(0.12, -0.4);
          shape.lineTo(-0.12, -0.4);
          shape.lineTo(-0.18, 0.0);
          shape.quadraticCurveTo(-0.18, 0.22, 0, 0.4);
          
          const extrudeSettings = {
            depth: 0.10,
            bevelEnabled: true,
            bevelSegments: 1,
            steps: 1,
            bevelSize: 0.015,
            bevelThickness: 0.015
          };
          
          const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
          geo.center();
          geo.rotateX(-Math.PI / 2);
          return geo;
        });
        const hull = new THREE.Mesh(hullGeo, this.materials.trunk);
        hull.receiveShadow = true;
        hull.castShadow = true;
        boat.add(hull);

        // Cross-plank seats inside boat
        const seatGeo = this.getGeometry('rowboat_seat_mid_v2', () => new THREE.BoxGeometry(0.30, 0.02, 0.12));
        const seatMid = new THREE.Mesh(seatGeo, this.materials.trunk);
        seatMid.position.set(0, 0.025, 0.02);
        seatMid.castShadow = true;
        boat.add(seatMid);

        const seatSternGeo = this.getGeometry('rowboat_seat_stern_v2', () => new THREE.BoxGeometry(0.24, 0.02, 0.10));
        const seatStern = new THREE.Mesh(seatSternGeo, this.materials.trunk);
        seatStern.position.set(0, 0.025, -0.22);
        seatStern.castShadow = true;
        boat.add(seatStern);

        // Oars resting on side edges
        const oarGeo = this.getGeometry('rowboat_oar_v2', () => new THREE.BoxGeometry(0.35, 0.01, 0.02));
        const oarL = new THREE.Mesh(oarGeo, this.materials.cement);
        oarL.position.set(-0.25, 0.04, -0.05);
        oarL.rotation.y = -Math.PI / 6;
        oarL.castShadow = true;
        boat.add(oarL);

        const oarR = new THREE.Mesh(oarGeo, this.materials.cement);
        oarR.position.set(0.25, 0.04, -0.05);
        oarR.rotation.y = Math.PI / 6;
        oarR.castShadow = true;
        boat.add(oarR);

        boat.position.set(0.45, -0.06, 1.55);
        boat.rotation.y = (rand() * 0.2 - 0.1) + Math.PI / 12;
        boat.castShadow = true;
        boat.receiveShadow = true;
        pier.add(boat);
      }

      if (pierDir === 'N') pier.rotation.y = Math.PI;
      else if (pierDir === 'S') pier.rotation.y = 0;
      else if (pierDir === 'E') pier.rotation.y = Math.PI / 2;
      else if (pierDir === 'W') pier.rotation.y = -Math.PI / 2;

      group.add(pier);
    }

    return group;
  }


  createLilypadMesh(rand: () => number): THREE.Group {
    const group = new THREE.Group();
    // Lilypad leaf is a very flat cylinder (cached geometry and shared material)
    const leafGeo = this.getGeometry('lilypad_leaf_flat', () => new THREE.CylinderGeometry(0.16, 0.16, 0.01, 8));
    const leafMat = this.materials.lilypadGreen;

    const count = 1 + Math.floor(rand() * 3);
    for (let i = 0; i < count; i++) {
      const leaf = new THREE.Mesh(leafGeo, leafMat);
      const angle = rand() * Math.PI * 2;
      const dist = rand() * 0.45;
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;
      const scale = 0.6 + rand() * 0.6;
      
      leaf.position.set(x, -0.035, z); // Sit slightly above the recessed water surface at y = -0.04
      leaf.scale.set(scale, 1.0, scale);
      leaf.rotation.y = rand() * Math.PI;
      leaf.castShadow = false;
      leaf.receiveShadow = true;
      group.add(leaf);

      // 35% chance for a tiny pink flower on this lilypad
      if (rand() > 0.65) {
        const flowerGroup = new THREE.Group();
        const petalGeo = this.getGeometry('lilypad_petal_cone', () => new THREE.ConeGeometry(0.03, 0.06, 5));
        const petalMat = this.materials.lotusPink;
        for (let p = 0; p < 6; p++) {
          const petal = new THREE.Mesh(petalGeo, petalMat);
          petal.rotation.z = Math.PI / 4;
          petal.rotation.y = (p * Math.PI) / 3;
          petal.position.y = 0.03;
          flowerGroup.add(petal);
        }
        flowerGroup.position.set(x, -0.03, z);
        flowerGroup.scale.set(0.7, 0.7, 0.7);
        group.add(flowerGroup);
      }
    }
    return group;
  }

  createReedsMesh(rand: () => number): THREE.Group {
    const group = new THREE.Group();
    const stemGeo = this.getGeometry('reed_stem_cyl', () => new THREE.CylinderGeometry(0.012, 0.016, 0.45, 4));
    const stemMat = this.materials.reedGreen;
    const topGeo = this.getGeometry('reed_top_cyl', () => new THREE.CylinderGeometry(0.024, 0.024, 0.1, 5));
    const topMat = this.materials.cattailBrown;

    const count = 3 + Math.floor(rand() * 4);
    for (let i = 0; i < count; i++) {
      const reed = new THREE.Group();
      
      const stem = new THREE.Mesh(stemGeo, stemMat);
      stem.position.y = 0.225;
      stem.castShadow = true;
      reed.add(stem);

      const top = new THREE.Mesh(topGeo, topMat);
      top.position.y = 0.4;
      top.castShadow = true;
      reed.add(top);

      const angle = rand() * Math.PI * 2;
      const dist = 0.6 + rand() * 0.25; // Scatter Reeds near banks/edges of the 2x2 cell
      reed.position.set(Math.cos(angle) * dist, -0.05, Math.sin(angle) * dist);

      reed.rotation.z = (rand() - 0.5) * 0.15;
      reed.rotation.x = (rand() - 0.5) * 0.15;
      reed.rotation.y = rand() * Math.PI * 2;
      reed.scale.set(0.85 + rand() * 0.3, 0.85 + rand() * 0.3, 0.85 + rand() * 0.3);

      group.add(reed);
    }
    return group;
  }


  // Helpers to add glowing window details on walls
  addWindows(group: THREE.Group, size: { w: number; h: number; d: number }, rows: number, cols: number, yOffset: number = 0.1, skipFront: boolean = false) {
    const winGeo = this.getGeometry('window', () => new THREE.BoxGeometry(0.12, 0.18, 0.03));
    const winMat = this.materials.window;

    // Window configurations for front/back and sides
    const spacingX = size.w / (cols + 1);
    const spacingY = size.h / (rows + 1);

    for (let r = 1; r <= rows; r++) {
      const y = spacingY * r + yOffset;
      
      // Front and Back Walls
      for (let c = 1; c <= cols; c++) {
        const x = spacingX * c - size.w / 2;

        if (!skipFront) {
          // Front window
          const winF = new THREE.Mesh(winGeo, winMat);
          winF.position.set(x, y, size.d / 2 + 0.015);
          group.add(winF);
        }

        // Back window
        const winB = new THREE.Mesh(winGeo, winMat);
        winB.position.set(x, y, -size.d / 2 - 0.015);
        group.add(winB);
      }

      // Left and Right Walls
      const spacingZ = size.d / (cols + 1);
      for (let c = 1; c <= cols; c++) {
        const z = spacingZ * c - size.d / 2;

        // Left window
        const winL = new THREE.Mesh(winGeo, winMat);
        winL.rotation.y = Math.PI / 2;
        winL.position.set(-size.w / 2 - 0.015, y, z);
        group.add(winL);

        // Right window
        const winR = new THREE.Mesh(winGeo, winMat);
        winR.rotation.y = Math.PI / 2;
        winR.position.set(size.w / 2 + 0.015, y, z);
        group.add(winR);
      }
    }
  }

  // 4. Residential Buildings (Levels 0-3)
  createResidentialMesh(level: number, tileX: number = 0, tileY: number = 0): THREE.Group {
    const group = new THREE.Group();

    if (level === 0) {
      // Level 0: Zoned Outline
      const lineGeo = this.getGeometry('res_geom_59_box_1_9_0_05_1_9', () => new THREE.BoxGeometry(1.9, 0.05, 1.9));
      const line = new THREE.Mesh(lineGeo, this.materials.zoneR);
      line.position.y = 0.06;
      group.add(line);
      return group;
    }

    // Seed-based random generator
    const rand = this.getSeededRandom(tileX, tileY);
    const paletteIndex = Math.floor(rand() * this.palettes.length);
    const palette = this.palettes[paletteIndex];

    const foundHeight = 0.04;
    const addFoundationAndStep = (fw: number, fd: number, doorXCoord: number | null, fx = 0, fz = 0) => {
      const foundGeo = this.getGeometry(`res_geom_58_box_${fw}_${foundHeight}_${fd}`, () => {
        const geo = new THREE.BoxGeometry(fw + 0.05, foundHeight, fd + 0.05);
        geo.translate(0, foundHeight / 2, 0);
        return geo;
      });
      const found = new THREE.Mesh(foundGeo, palette.brick);
      found.position.set(fx, 0.06, fz);
      found.castShadow = true;
      found.receiveShadow = true;
      group.add(found);

      if (doorXCoord !== null) {
        const stepGeo = this.getGeometry(`res_geom_57_box_${foundHeight}`, () => {
          const geo = new THREE.BoxGeometry(0.3, foundHeight / 2, 0.15);
          geo.translate(0, foundHeight / 4, 0);
          return geo;
        });
        const step = new THREE.Mesh(stepGeo, palette.brick);
        step.position.set(fx + doorXCoord, 0.06, fz + fd / 2 + 0.025);
        step.castShadow = true;
        step.receiveShadow = true;
        group.add(step);
      }
    };

    // Helper for grid-aligned picket fences (sturdier, better proportioned)
    const addFenceX = (z: number, xStart: number, xEnd: number, count: number) => {
      const step = (xEnd - xStart) / (count - 1);
      const postGeo = this.getGeometry('res_fence_post', () => new THREE.BoxGeometry(0.04, 0.24, 0.04));
      for (let i = 0; i < count; i++) {
        const post = new THREE.Mesh(postGeo, this.materials.whiteMetal);
        post.position.set(xStart + step * i, 0.06 + 0.12, z);
        post.castShadow = true;
        group.add(post);
      }
      const railWidth = Math.abs(xEnd - xStart) + 0.04;
      const railGeo = this.getGeometry(`res_fence_rail_x_${railWidth}`, () => new THREE.BoxGeometry(railWidth, 0.03, 0.016));
      const rail = new THREE.Mesh(railGeo, this.materials.whiteMetal);
      rail.position.set((xStart + xEnd) / 2, 0.06 + 0.17, z);
      group.add(rail);
    };

    const addFenceZ = (x: number, zStart: number, zEnd: number, count: number) => {
      const step = (zEnd - zStart) / (count - 1);
      const postGeo = this.getGeometry('res_fence_post', () => new THREE.BoxGeometry(0.04, 0.24, 0.04));
      for (let i = 0; i < count; i++) {
        const post = new THREE.Mesh(postGeo, this.materials.whiteMetal);
        post.position.set(x, 0.06 + 0.12, zStart + step * i);
        post.castShadow = true;
        group.add(post);
      }
      const railLength = Math.abs(zEnd - zStart) + 0.04;
      const railGeo = this.getGeometry(`res_fence_rail_z_${railLength}`, () => new THREE.BoxGeometry(0.016, 0.03, railLength));
      const rail = new THREE.Mesh(railGeo, this.materials.whiteMetal);
      rail.position.set(x, 0.06 + 0.17, (zStart + zEnd) / 2);
      group.add(rail);
    };

    let style = 0;

    if (level === 1) {
      // Level 1: Cozy small cottage (Well proportioned: w=1.0, h=0.45, d=0.9)
      const w = 1.0, h = 0.45, d = 0.9;
      
      // Always use open gable roof style with tiles (pyramid hip roof variation removed)
      rand(); // consume roll for sequence sync
      const isGable = true;

      // Brick Chimney side selection
      const isLeft = rand() > 0.5;

      // Door layout asymmetry
      const doorRoll = rand();
      let doorX = 0;
      let hasWinL = true;
      let hasWinR = true;
      
      if (doorRoll < 0.3) {
        doorX = -0.22;
        hasWinL = false;
      } else if (doorRoll < 0.6) {
        doorX = 0.22;
        hasWinR = false;
      }
      
      addFoundationAndStep(w, d, doorX);
      
      // Walls (Front, Back, and Extruded Left/Right Side Walls with Gable Peaks)
      const t = 0.04; // wall thickness

      // Windows cutout dimensions (larger: 0.14 x 0.20)
      const winW = 0.14;
      const winH = 0.20;
      const yWin = 0.1 + 0.22; // world y center of window
      const localYWin = 0.22;  // local y center inside wall

      // Front Wall Shape Extrusion (cutout door & windows, flat top)
      const shape = new THREE.Shape();
      shape.moveTo(-w / 2, 0);
      shape.lineTo(w / 2, 0);
      shape.lineTo(w / 2, h);
      shape.lineTo(-w / 2, h);
      shape.closePath();

      // Add door cutout hole (from bottom to door height)
      const doorPath = new THREE.Path();
      doorPath.moveTo(doorX - 0.09, 0);
      doorPath.lineTo(doorX - 0.09, 0.38);
      doorPath.lineTo(doorX + 0.09, 0.38);
      doorPath.lineTo(doorX + 0.09, 0);
      doorPath.closePath();
      shape.holes.push(doorPath);

      // Add window cutout holes
      if (hasWinL) {
        const winLPath = new THREE.Path();
        winLPath.moveTo(-0.25 - 0.07, localYWin - 0.10);
        winLPath.lineTo(-0.25 - 0.07, localYWin + 0.10);
        winLPath.lineTo(-0.25 + 0.07, localYWin + 0.10);
        winLPath.lineTo(-0.25 + 0.07, localYWin - 0.10);
        winLPath.closePath();
        shape.holes.push(winLPath);
      }

      if (hasWinR) {
        const winRPath = new THREE.Path();
        winRPath.moveTo(0.25 - 0.07, localYWin - 0.10);
        winRPath.lineTo(0.25 - 0.07, localYWin + 0.10);
        winRPath.lineTo(0.25 + 0.07, localYWin + 0.10);
        winRPath.lineTo(0.25 + 0.07, localYWin - 0.10);
        winRPath.closePath();
        shape.holes.push(winRPath);
      }

      const wallFGeo = this.getGeometry(`res_level1_wallF_${w}_${h}_${doorX}_${hasWinL}_${hasWinR}_${t}`, () => new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: false }));
      const wallF = new THREE.Mesh(wallFGeo, palette.wall);
      wallF.position.set(0, 0.1, d / 2 - t);
      wallF.castShadow = true;
      wallF.receiveShadow = true;
      group.add(wallF);

      // Back Wall with Shape Extrusion (same windows as front, no door)
      const backShape = new THREE.Shape();
      backShape.moveTo(-w / 2, 0);
      backShape.lineTo(w / 2, 0);
      backShape.lineTo(w / 2, h);
      backShape.lineTo(-w / 2, h);
      backShape.closePath();

      if (hasWinL) {
        const winLPath = new THREE.Path();
        winLPath.moveTo(-0.25 - 0.07, localYWin - 0.10);
        winLPath.lineTo(-0.25 - 0.07, localYWin + 0.10);
        winLPath.lineTo(-0.25 + 0.07, localYWin + 0.10);
        winLPath.lineTo(-0.25 + 0.07, localYWin - 0.10);
        winLPath.closePath();
        backShape.holes.push(winLPath);
      }

      if (hasWinR) {
        const winRPath = new THREE.Path();
        winRPath.moveTo(0.25 - 0.07, localYWin - 0.10);
        winRPath.lineTo(0.25 - 0.07, localYWin + 0.10);
        winRPath.lineTo(0.25 + 0.07, localYWin + 0.10);
        winRPath.lineTo(0.25 + 0.07, localYWin - 0.10);
        winRPath.closePath();
        backShape.holes.push(winRPath);
      }

      const wallBGeo = this.getGeometry(`res_level1_wallB_${w}_${h}_${hasWinL}_${hasWinR}_${t}`, () => new THREE.ExtrudeGeometry(backShape, { depth: t, bevelEnabled: false }));
      const wallB = new THREE.Mesh(wallBGeo, palette.wall);
      wallB.position.set(0, 0.1, -d / 2);
      wallB.castShadow = true;
      wallB.receiveShadow = true;
      group.add(wallB);

      // Left and Right Gable Side Walls (Pentagonal if isGable) with center window cutout
      const sideShape = new THREE.Shape();
      sideShape.moveTo(-d / 2 + t, 0);
      sideShape.lineTo(d / 2 - t, 0);
      sideShape.lineTo(d / 2 - t, h);
      if (isGable) {
        sideShape.lineTo(0, h + 0.38); // Side wall gable peak
      }
      sideShape.lineTo(-d / 2 + t, h);
      sideShape.closePath();

      const sideWinPath = new THREE.Path();
      sideWinPath.moveTo(-winW / 2, localYWin - winH / 2);
      sideWinPath.lineTo(-winW / 2, localYWin + winH / 2);
      sideWinPath.lineTo(winW / 2, localYWin + winH / 2);
      sideWinPath.lineTo(winW / 2, localYWin - winH / 2);
      sideWinPath.closePath();
      sideShape.holes.push(sideWinPath);

      const wallLGeo = this.getGeometry(`res_level1_wallL_${d}_${h}_${isGable}_${t}`, () => new THREE.ExtrudeGeometry(sideShape, { depth: t, bevelEnabled: false }));
      
      const wallL = new THREE.Mesh(wallLGeo, palette.wall);
      wallL.rotation.y = Math.PI / 2;
      wallL.position.set(-w / 2, 0.1, 0); // sits flush between front and back walls
      wallL.castShadow = true;
      wallL.receiveShadow = true;
      group.add(wallL);

      const wallR = new THREE.Mesh(wallLGeo, palette.wall);
      wallR.rotation.y = Math.PI / 2;
      wallR.position.set(w / 2 - t, 0.1, 0);
      wallR.castShadow = true;
      wallR.receiveShadow = true;
      group.add(wallR);

      // Roof (Open Gable vs Hip)
      if (isGable) {
        // Open Gable Roof built from multiple sloped vertical panels (tiles)
        const slabL = 0.72; // slope length along Z (front-to-back)
        const slabT = 0.045; // thickness of the roof board
        const slabW = w + 0.12; // width along X (overhang left and right)
        const angle = Math.atan2(0.38, 0.5);

        // Divide the roof into 4 vertical panels/tiles with a tiny gap
        const numTiles = 4;
        const tileW = slabW / numTiles;
        const tileGap = 0.012;
        const tileWidth = tileW - tileGap;

        // Front slab tiles
        for (let i = 0; i < numTiles; i++) {
          const tileGeo = this.getGeometry(`res_geom_49_box_${tileWidth}_${slabT}_${slabL}`, () => new THREE.BoxGeometry(tileWidth, slabT, slabL));
          const tileMesh = new THREE.Mesh(tileGeo, palette.roof);
          const x = -slabW / 2 + tileW / 2 + i * tileW;
          tileMesh.position.set(x, h + 0.1 + 0.20, 0.24);
          tileMesh.rotation.x = angle;
          tileMesh.castShadow = true;
          tileMesh.receiveShadow = true;
          group.add(tileMesh);
        }

        // Back slab tiles
        for (let i = 0; i < numTiles; i++) {
          const tileGeo = this.getGeometry(`res_geom_48_box_${tileWidth}_${slabT}_${slabL}`, () => new THREE.BoxGeometry(tileWidth, slabT, slabL));
          const tileMesh = new THREE.Mesh(tileGeo, palette.roof);
          const x = -slabW / 2 + tileW / 2 + i * tileW;
          tileMesh.position.set(x, h + 0.1 + 0.20, -0.24);
          tileMesh.rotation.x = -angle;
          tileMesh.castShadow = true;
          tileMesh.receiveShadow = true;
          group.add(tileMesh);
        }

        // Cylindrical ridge cap running along X axis (left-to-right)
        const ridgeCapGeo = this.getGeometry(`res_geom_47_cylinder_${slabW}`, () => {
          const geo = new THREE.CylinderGeometry(0.045, 0.045, slabW + 0.02, 8);
          geo.rotateZ(Math.PI / 2); // align with X axis
          return geo;
        });
        const ridgeCap = new THREE.Mesh(ridgeCapGeo, palette.roof);
        ridgeCap.position.set(0, h + 0.1 + 0.38 + 0.01, 0);
        ridgeCap.castShadow = true;
        group.add(ridgeCap);
      } else {
        // Pyramid Hip Roof
        const roofGeo = this.getGeometry('res_geom_46_cone_0_72_0_35_4', () => {
          const geo = new THREE.ConeGeometry(0.72, 0.35, 4);
          geo.rotateY(Math.PI / 4);
          geo.scale(1.15, 1.0, 1.15);
          geo.translate(0, h + 0.175 + 0.1, 0);
          return geo;
        });
        const roof = new THREE.Mesh(roofGeo, palette.roof);
        roof.castShadow = true;
        group.add(roof);
      }

      // Brick Chimney
      const chimX = isLeft ? -0.28 : 0.28;
      const chimGeo = this.getGeometry('res_geom_45_box_0_14_0_55_0_14', () => new THREE.BoxGeometry(0.14, 0.55, 0.14));
      const chimney = new THREE.Mesh(chimGeo, palette.brick);
      chimney.position.set(chimX, h + 0.275, -0.2);
      chimney.castShadow = true;
      group.add(chimney);

      const chimCap = new THREE.Mesh(this.getGeometry('res_geom_44_box_0_18_0_04_0_18', () => new THREE.BoxGeometry(0.18, 0.04, 0.18)), this.materials.road);
      chimCap.position.set(chimX, h + 0.55, -0.2);
      group.add(chimCap);

      // Small door and door frame casing snugly fitted inside cutout opening
      const doorInnerW = 0.15;
      const doorInnerH = 0.365;

      const doorFrameShape = new THREE.Shape();
      doorFrameShape.moveTo(-0.09, 0);
      doorFrameShape.lineTo(0.09, 0);
      doorFrameShape.lineTo(0.09, 0.38);
      doorFrameShape.lineTo(-0.09, 0.38);
      doorFrameShape.closePath();

      const doorFrameHole = new THREE.Path();
      doorFrameHole.moveTo(-0.075, 0);
      doorFrameHole.lineTo(0.075, 0);
      doorFrameHole.lineTo(0.075, 0.365);
      doorFrameHole.lineTo(-0.075, 0.365);
      doorFrameHole.closePath();
      doorFrameShape.holes.push(doorFrameHole);

      const doorFrameGeo = this.getGeometry(`res_level1_doorFrame_${t}`, () => new THREE.ExtrudeGeometry(doorFrameShape, { depth: t, bevelEnabled: false }));
      const doorFrame = new THREE.Mesh(doorFrameGeo, palette.trim); // door frame matches trim color
      doorFrame.position.set(doorX, 0.1, d / 2 - t);
      doorFrame.castShadow = true;
      group.add(doorFrame);

      const doorGeo = this.getGeometry(`res_geom_42_box_${doorInnerW}_${doorInnerH}`, () => new THREE.BoxGeometry(doorInnerW, doorInnerH, 0.02));
      const door = new THREE.Mesh(doorGeo, palette.trim); // door board matches trim color
      door.position.set(doorX, 0.1 + doorInnerH / 2, d / 2 - t / 2); // recessed inside frame
      group.add(door);

      // Windows with cutout frame details (hollow frame fitting snugly inside hole cutout)
      const fw = winW; // frame outer width equals hole width
      const fh = winH; // frame outer height equals hole height
      const winInnerW = winW - 0.03; // glass window opening width
      const winInnerH = winH - 0.03; // glass window opening height

      const frameShape = new THREE.Shape();
      frameShape.moveTo(-fw / 2, -fh / 2);
      frameShape.lineTo(fw / 2, -fh / 2);
      frameShape.lineTo(fw / 2, fh / 2);
      frameShape.lineTo(-fw / 2, fh / 2);
      frameShape.closePath();

      const frameHole = new THREE.Path();
      frameHole.moveTo(-winInnerW / 2, -winInnerH / 2);
      frameHole.lineTo(winInnerW / 2, -winInnerH / 2);
      frameHole.lineTo(winInnerW / 2, winInnerH / 2);
      frameHole.lineTo(-winInnerW / 2, winInnerH / 2);
      frameHole.closePath();
      frameShape.holes.push(frameHole);

      const frameGeo = this.getGeometry(`res_level1_winFrame_${t}`, () => new THREE.ExtrudeGeometry(frameShape, { depth: t, bevelEnabled: false }));
      const frameMat = palette.trim; // matching trim color for realistic framing
      const glassGeo = this.getGeometry(`res_geom_40_box_${winInnerW}_${winInnerH}`, () => new THREE.BoxGeometry(winInnerW, winInnerH, 0.015));
      const glassMat = this.materials.window;

      const sillGeo = this.getGeometry(`res_geom_39_box_${winW}_${t}`, () => new THREE.BoxGeometry(winW + 0.04, 0.02, t + 0.04));
      const sillMat = palette.brick;

      const addFramedWindow = (x: number) => {
        // Front Window Frame & Glass
        const frameF = new THREE.Mesh(frameGeo, frameMat);
        frameF.position.set(x, yWin, d / 2 - t);
        frameF.castShadow = true;
        group.add(frameF);

        const glassF = new THREE.Mesh(glassGeo, glassMat);
        glassF.position.set(x, yWin, d / 2 - t / 2);
        group.add(glassF);

        // Front Window Sill
        const sillF = new THREE.Mesh(sillGeo, sillMat);
        sillF.position.set(x, yWin - winH / 2, d / 2 - t / 2);
        sillF.castShadow = true;
        group.add(sillF);

        // Back Window Frame & Glass (opposite face)
        const frameB = new THREE.Mesh(frameGeo, frameMat);
        frameB.position.set(x, yWin, -d / 2);
        frameB.castShadow = true;
        group.add(frameB);

        const glassB = new THREE.Mesh(glassGeo, glassMat);
        glassB.position.set(x, yWin, -d / 2 + t / 2);
        group.add(glassB);

        // Back Window Sill
        const sillB = new THREE.Mesh(sillGeo, sillMat);
        sillB.position.set(x, yWin - winH / 2, -d / 2 + t / 2);
        sillB.castShadow = true;
        group.add(sillB);
      };

      const addFramedWindowSide = (wx: number, wy: number, wz: number) => {
        const frame = new THREE.Mesh(frameGeo, frameMat);
        frame.rotation.y = Math.PI / 2;
        frame.position.set(wx, wy, wz);
        frame.castShadow = true;
        group.add(frame);

        const glass = new THREE.Mesh(glassGeo, glassMat);
        glass.rotation.y = Math.PI / 2;
        glass.position.set(wx + t / 2, wy, wz);
        group.add(glass);

        // Side Window Sill
        const sill = new THREE.Mesh(sillGeo, sillMat);
        sill.rotation.y = Math.PI / 2;
        sill.position.set(wx + t / 2, wy - winH / 2, wz);
        sill.castShadow = true;
        group.add(sill);
      };

      if (hasWinL) {
        addFramedWindow(-0.25);
      }

      if (hasWinR) {
        addFramedWindow(0.25);
      }

      // Add Left & Right side wall center windows
      addFramedWindowSide(-w / 2, yWin, 0);
      addFramedWindowSide(w / 2 - t, yWin, 0);

      // Stepping stones walkway aligned to door
      for (let i = 0; i < 3; i++) {
        const stone = new THREE.Mesh(this.getGeometry('res_geom_38_box_0_15_0_015_0_15', () => new THREE.BoxGeometry(0.15, 0.015, 0.15)), this.materials.whiteMetal);
        stone.rotation.y = rand() * 0.5;
        stone.position.set(doorX + (rand() - 0.5) * 0.06, 0.068, d / 2 + 0.15 + i * 0.15);
        stone.receiveShadow = true;
        group.add(stone);
      }

      // Shrub
      const shrub = new THREE.Mesh(this.getGeometry('res_geom_37_sphere_0_12_5_5', () => new THREE.SphereGeometry(0.12, 5, 5)), this.materials.leaves);
      shrub.position.set(-0.5, 0.12, 0.4);
      shrub.castShadow = true;
      group.add(shrub);

      // Picket fences at front flanking the walkway
      if (rand() > 0.4) {
        if (doorX === 0) {
          addFenceX(0.75, -0.7, -0.2, 3);
          addFenceX(0.75, 0.2, 0.7, 3);
        } else if (doorX < 0) {
          addFenceX(0.75, -0.7, -0.42, 2);
          addFenceX(0.75, -0.02, 0.7, 4);
        } else {
          addFenceX(0.75, -0.7, 0.02, 4);
          addFenceX(0.75, 0.42, 0.7, 2);
        }
      }

    } else if (level === 2) {
      // Level 2: Rebuilt from Level 1 (larger footprint, 2 stories)
      const w = 1.2, h = 0.9, d = 1.0;
      style = Math.floor(rand() * 3); // used for yard style decorations
      const isLeft = rand() > 0.5;
      const doorRoll = rand();
      let doorX = 0;
      let hasWinL = true;
      let hasWinR = true;

      if (doorRoll < 0.3) {
        doorX = -0.28;
        hasWinL = false;
      } else if (doorRoll < 0.6) {
        doorX = 0.28;
        hasWinR = false;
      }

      addFoundationAndStep(w, d, doorX);

      // Walls (Front, Back, Left, Right)
      const t = 0.04;
      const winW = 0.14;
      const winH = 0.20;
      const localYWin1 = 0.22;
      const localYWin2 = 0.67;

      // Front wall shape with door and window cutouts
      const shape = new THREE.Shape();
      shape.moveTo(-w / 2, 0);
      shape.lineTo(w / 2, 0);
      shape.lineTo(w / 2, h);
      shape.lineTo(-w / 2, h);
      shape.closePath();

      // Door cutout hole
      const doorPath = new THREE.Path();
      doorPath.moveTo(doorX - 0.09, 0);
      doorPath.lineTo(doorX - 0.09, 0.38);
      doorPath.lineTo(doorX + 0.09, 0.38);
      doorPath.lineTo(doorX + 0.09, 0);
      doorPath.closePath();
      shape.holes.push(doorPath);

      // Window cutouts helper list
      const windowsList: { x: number; y: number }[] = [];
      if (doorX === 0) {
        if (hasWinL) windowsList.push({ x: -0.30, y: localYWin1 });
        if (hasWinR) windowsList.push({ x: 0.30, y: localYWin1 });
        windowsList.push({ x: -0.30, y: localYWin2 });
        windowsList.push({ x: 0, y: localYWin2 });
        windowsList.push({ x: 0.30, y: localYWin2 });
      } else if (doorX === -0.28) {
        windowsList.push({ x: 0.30, y: localYWin1 });
        windowsList.push({ x: -0.28, y: localYWin2 });
        windowsList.push({ x: 0.30, y: localYWin2 });
      } else {
        windowsList.push({ x: -0.30, y: localYWin1 });
        windowsList.push({ x: -0.30, y: localYWin2 });
        windowsList.push({ x: 0.28, y: localYWin2 });
      }

      for (const win of windowsList) {
        const winPath = new THREE.Path();
        winPath.moveTo(win.x - winW / 2, win.y - winH / 2);
        winPath.lineTo(win.x - winW / 2, win.y + winH / 2);
        winPath.lineTo(win.x + winW / 2, win.y + winH / 2);
        winPath.lineTo(win.x + winW / 2, win.y - winH / 2);
        winPath.closePath();
        shape.holes.push(winPath);
      }

      const wallFGeo = this.getGeometry(`res_level2_wallF_${w}_${h}_${doorX}_${hasWinL}_${hasWinR}_${t}`, () => new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: false }));
      const wallF = new THREE.Mesh(wallFGeo, palette.wall);
      wallF.position.set(0, 0.1, d / 2 - t);
      wallF.castShadow = true;
      wallF.receiveShadow = true;
      group.add(wallF);

      // Back Wall with windows
      const backShape = new THREE.Shape();
      backShape.moveTo(-w / 2, 0);
      backShape.lineTo(w / 2, 0);
      backShape.lineTo(w / 2, h);
      backShape.lineTo(-w / 2, h);
      backShape.closePath();

      for (const win of windowsList) {
        const winPath = new THREE.Path();
        winPath.moveTo(win.x - winW / 2, win.y - winH / 2);
        winPath.lineTo(win.x - winW / 2, win.y + winH / 2);
        winPath.lineTo(win.x + winW / 2, win.y + winH / 2);
        winPath.lineTo(win.x + winW / 2, win.y - winH / 2);
        winPath.closePath();
        backShape.holes.push(winPath);
      }

      const wallBGeo = this.getGeometry(`res_level2_wallB_${w}_${h}_${doorX}_${hasWinL}_${hasWinR}_${t}`, () => new THREE.ExtrudeGeometry(backShape, { depth: t, bevelEnabled: false }));
      const wallB = new THREE.Mesh(wallBGeo, palette.wall);
      wallB.position.set(0, 0.1, -d / 2);
      wallB.castShadow = true;
      wallB.receiveShadow = true;
      group.add(wallB);

      // Side Walls with Gable Peaks and center column windows
      const peakH = 0.456;
      const sideShape = new THREE.Shape();
      sideShape.moveTo(-d / 2 + t, 0);
      sideShape.lineTo(d / 2 - t, 0);
      sideShape.lineTo(d / 2 - t, h);
      sideShape.lineTo(0, h + peakH);
      sideShape.lineTo(-d / 2 + t, h);
      sideShape.closePath();

      const sideWindowsY = [localYWin1, localYWin2];
      for (const wy of sideWindowsY) {
        const sideWinPath = new THREE.Path();
        sideWinPath.moveTo(-winW / 2, wy - winH / 2);
        sideWinPath.lineTo(-winW / 2, wy + winH / 2);
        sideWinPath.lineTo(winW / 2, wy + winH / 2);
        sideWinPath.lineTo(winW / 2, wy - winH / 2);
        sideWinPath.closePath();
        sideShape.holes.push(sideWinPath);
      }

      const wallLGeo = this.getGeometry(`res_level2_wallL_${d}_${h}_${peakH}_${t}`, () => new THREE.ExtrudeGeometry(sideShape, { depth: t, bevelEnabled: false }));
      const wallL = new THREE.Mesh(wallLGeo, palette.wall);
      wallL.rotation.y = Math.PI / 2;
      wallL.position.set(-w / 2, 0.1, 0);
      wallL.castShadow = true;
      wallL.receiveShadow = true;
      group.add(wallL);

      const wallR = new THREE.Mesh(wallLGeo, palette.wall);
      wallR.rotation.y = Math.PI / 2;
      wallR.position.set(w / 2 - t, 0.1, 0);
      wallR.castShadow = true;
      wallR.receiveShadow = true;
      group.add(wallR);

      // Tiled Roof
      const slabL = 0.8;
      const slabT = 0.045;
      const slabW = w + 0.12;
      const angle = Math.atan2(0.38, 0.5);

      const numTiles = 4;
      const tileW = slabW / numTiles;
      const tileGap = 0.012;
      const tileWidth = tileW - tileGap;

      for (let i = 0; i < numTiles; i++) {
        const tileGeo = this.getGeometry(`res_geom_33_box_${tileWidth}_${slabT}_${slabL}`, () => new THREE.BoxGeometry(tileWidth, slabT, slabL));
        const tileMesh = new THREE.Mesh(tileGeo, palette.roof);
        const x = -slabW / 2 + tileW / 2 + i * tileW;
        tileMesh.position.set(x, h + 0.1 + 0.228, 0.26);
        tileMesh.rotation.x = angle;
        tileMesh.castShadow = true;
        tileMesh.receiveShadow = true;
        group.add(tileMesh);
      }

      for (let i = 0; i < numTiles; i++) {
        const tileGeo = this.getGeometry(`res_geom_32_box_${tileWidth}_${slabT}_${slabL}`, () => new THREE.BoxGeometry(tileWidth, slabT, slabL));
        const tileMesh = new THREE.Mesh(tileGeo, palette.roof);
        const x = -slabW / 2 + tileW / 2 + i * tileW;
        tileMesh.position.set(x, h + 0.1 + 0.228, -0.26);
        tileMesh.rotation.x = -angle;
        tileMesh.castShadow = true;
        tileMesh.receiveShadow = true;
        group.add(tileMesh);
      }

      // Cylindrical ridge cap
      const ridgeCapGeo = this.getGeometry(`res_geom_31_cylinder_${slabW}`, () => {
        const geo = new THREE.CylinderGeometry(0.045, 0.045, slabW + 0.02, 8);
        geo.rotateZ(Math.PI / 2);
        return geo;
      });
      const ridgeCap = new THREE.Mesh(ridgeCapGeo, palette.roof);
      ridgeCap.position.set(0, h + 0.1 + peakH + 0.01, 0);
      ridgeCap.castShadow = true;
      group.add(ridgeCap);

      // Chimney
      const chimX = isLeft ? -0.32 : 0.32;
      const chimGeo = this.getGeometry('res_geom_30_box_0_14_0_85_0_14', () => new THREE.BoxGeometry(0.14, 0.85, 0.14));
      const chimney = new THREE.Mesh(chimGeo, palette.brick);
      chimney.position.set(chimX, h + 0.325, -0.22);
      chimney.castShadow = true;
      group.add(chimney);

      const chimCap = new THREE.Mesh(this.getGeometry('res_geom_29_box_0_18_0_04_0_18', () => new THREE.BoxGeometry(0.18, 0.04, 0.18)), this.materials.road);
      chimCap.position.set(chimX, h + 0.75, -0.22);
      group.add(chimCap);

      // Door & Frame
      const doorInnerW = 0.15;
      const doorInnerH = 0.365;

      const doorFrameShape = new THREE.Shape();
      doorFrameShape.moveTo(-0.09, 0);
      doorFrameShape.lineTo(0.09, 0);
      doorFrameShape.lineTo(0.09, 0.38);
      doorFrameShape.lineTo(-0.09, 0.38);
      doorFrameShape.closePath();

      const doorFrameHole = new THREE.Path();
      doorFrameHole.moveTo(-0.075, 0);
      doorFrameHole.lineTo(0.075, 0);
      doorFrameHole.lineTo(0.075, 0.365);
      doorFrameHole.lineTo(-0.075, 0.365);
      doorFrameHole.closePath();
      doorFrameShape.holes.push(doorFrameHole);

      const doorFrameGeo = this.getGeometry(`res_level2_doorFrame_${t}`, () => new THREE.ExtrudeGeometry(doorFrameShape, { depth: t, bevelEnabled: false }));
      const doorFrame = new THREE.Mesh(doorFrameGeo, palette.trim);
      doorFrame.position.set(doorX, 0.1, d / 2 - t);
      doorFrame.castShadow = true;
      group.add(doorFrame);

      const doorGeo = this.getGeometry(`res_geom_27_box_${doorInnerW}_${doorInnerH}`, () => new THREE.BoxGeometry(doorInnerW, doorInnerH, 0.02));
      const door = new THREE.Mesh(doorGeo, palette.trim);
      door.position.set(doorX, 0.1 + doorInnerH / 2, d / 2 - t / 2);
      group.add(door);

      // Windows
      const fw = winW;
      const fh = winH;
      const winInnerW = winW - 0.03;
      const winInnerH = winH - 0.03;

      const frameShape = new THREE.Shape();
      frameShape.moveTo(-fw / 2, -fh / 2);
      frameShape.lineTo(fw / 2, -fh / 2);
      frameShape.lineTo(fw / 2, fh / 2);
      frameShape.lineTo(-fw / 2, fh / 2);
      frameShape.closePath();

      const frameHole = new THREE.Path();
      frameHole.moveTo(-winInnerW / 2, -winInnerH / 2);
      frameHole.lineTo(winInnerW / 2, -winInnerH / 2);
      frameHole.lineTo(winInnerW / 2, winInnerH / 2);
      frameHole.lineTo(-winInnerW / 2, winInnerH / 2);
      frameHole.closePath();
      frameShape.holes.push(frameHole);

      const frameGeo = this.getGeometry(`res_level2_winFrame_${t}`, () => new THREE.ExtrudeGeometry(frameShape, { depth: t, bevelEnabled: false }));
      const frameMat = palette.trim;
      const glassGeo = this.getGeometry(`res_geom_25_box_${winInnerW}_${winInnerH}`, () => new THREE.BoxGeometry(winInnerW, winInnerH, 0.015));
      const glassMat = this.materials.window;

      const sillGeo = this.getGeometry(`res_geom_24_box_${winW}_${t}`, () => new THREE.BoxGeometry(winW + 0.04, 0.02, t + 0.04));
      const sillMat = palette.brick;

      const addFramedWindow = (wx: number, wy: number) => {
        // Front Window
        const frameF = new THREE.Mesh(frameGeo, frameMat);
        frameF.position.set(wx, 0.1 + wy, d / 2 - t);
        frameF.castShadow = true;
        group.add(frameF);

        const glassF = new THREE.Mesh(glassGeo, glassMat);
        glassF.position.set(wx, 0.1 + wy, d / 2 - t / 2);
        group.add(glassF);

        // Front Window Sill
        const sillF = new THREE.Mesh(sillGeo, sillMat);
        sillF.position.set(wx, 0.1 + wy - winH / 2, d / 2 - t / 2);
        sillF.castShadow = true;
        group.add(sillF);

        // Back Window (opposite face)
        const frameB = new THREE.Mesh(frameGeo, frameMat);
        frameB.position.set(wx, 0.1 + wy, -d / 2);
        frameB.castShadow = true;
        group.add(frameB);

        const glassB = new THREE.Mesh(glassGeo, glassMat);
        glassB.position.set(wx, 0.1 + wy, -d / 2 + t / 2);
        group.add(glassB);

        // Back Window Sill
        const sillB = new THREE.Mesh(sillGeo, sillMat);
        sillB.position.set(wx, 0.1 + wy - winH / 2, -d / 2 + t / 2);
        sillB.castShadow = true;
        group.add(sillB);
      };

      const addFramedWindowSide = (wx: number, wy: number, wz: number) => {
        const frame = new THREE.Mesh(frameGeo, frameMat);
        frame.rotation.y = Math.PI / 2;
        frame.position.set(wx, 0.1 + wy, wz);
        frame.castShadow = true;
        group.add(frame);

        const glass = new THREE.Mesh(glassGeo, glassMat);
        glass.rotation.y = Math.PI / 2;
        glass.position.set(wx + t / 2, 0.1 + wy, wz);
        group.add(glass);

        // Side Window Sill
        const sill = new THREE.Mesh(sillGeo, sillMat);
        sill.rotation.y = Math.PI / 2;
        sill.position.set(wx + t / 2, 0.1 + wy - winH / 2, wz);
        sill.castShadow = true;
        group.add(sill);
      };

      for (const win of windowsList) {
        addFramedWindow(win.x, win.y);
      }

      // Add Left & Right side wall center windows
      for (const wy of sideWindowsY) {
        addFramedWindowSide(-w / 2, wy, 0);
        addFramedWindowSide(w / 2 - t, wy, 0);
      }

      // Flagstone walkway
      const walkwayX = (doorX === 0) ? 0.0 : doorX;
      for (let i = 0; i < 4; i++) {
        const stone = new THREE.Mesh(this.getGeometry('res_geom_23_box_0_18_0_02_0_18', () => new THREE.BoxGeometry(0.18, 0.02, 0.18)), this.materials.whiteMetal);
        stone.rotation.y = rand() * 0.4 - 0.2;
        stone.position.set(walkwayX + (rand() - 0.5) * 0.08, 0.07, d / 2 + 0.15 + i * 0.15);
        stone.receiveShadow = true;
        group.add(stone);
      }

      // Style-based yard variations
      if (style === 0) {
        // Doghouse and tree
        const doghouse = new THREE.Group();
        doghouse.position.set(0.4, 0.06, -0.45);
        const dhWalls = new THREE.Mesh(this.getGeometry('res_geom_22_box_0_18_0_15_0_18', () => new THREE.BoxGeometry(0.18, 0.15, 0.18)), palette.brick);
        dhWalls.position.y = 0.075;
        doghouse.add(dhWalls);
        const dhRoof = new THREE.Mesh(this.getGeometry('res_geom_21_cone_0_14_0_1_4', () => new THREE.ConeGeometry(0.14, 0.1, 4)), palette.roof);
        dhRoof.rotateY(Math.PI / 4);
        dhRoof.position.y = 0.2;
        doghouse.add(dhRoof);
        group.add(doghouse);

        const yardTree = this.createTreeMesh();
        yardTree.position.set(-0.55, 0.06, -0.45);
        yardTree.scale.set(0.55, 0.55, 0.55);
        group.add(yardTree);

        addFenceX(0.76, -0.75, -0.3, 3);
        addFenceZ(-0.76, -0.75, 0.75, 5);
      } else if (style === 1) {
        // Water well and tree
        const well = new THREE.Group();
        well.position.set(-0.4, 0.06, -0.4);
        const wBase = new THREE.Mesh(this.getGeometry('res_geom_20_cylinder_0_12_0_12_0_12_6', () => new THREE.CylinderGeometry(0.12, 0.12, 0.12, 6)), palette.brick);
        wBase.position.y = 0.06;
        wBase.castShadow = true;
        well.add(wBase);

        const p1 = new THREE.Mesh(this.getGeometry('res_geom_19_box_0_015_0_25_0_015', () => new THREE.BoxGeometry(0.015, 0.25, 0.015)), this.materials.trunk);
        p1.position.set(-0.09, 0.15, 0);
        well.add(p1);
        const p2 = p1.clone();
        p2.position.x = 0.09;
        well.add(p2);

        const wRoof = new THREE.Mesh(this.getGeometry('res_geom_18_box_0_2_0_02_0_18', () => new THREE.BoxGeometry(0.2, 0.02, 0.18)), palette.roof);
        wRoof.position.set(0, 0.27, 0);
        well.add(wRoof);
        group.add(well);

        const flowerbed = new THREE.Group();
        flowerbed.position.set(0.45, 0.06, 0.45);
        const bedBase = new THREE.Mesh(this.getGeometry('res_geom_17_box_0_25_0_06_0_25', () => new THREE.BoxGeometry(0.25, 0.06, 0.25)), this.materials.trunk);
        bedBase.position.y = 0.03;
        flowerbed.add(bedBase);
        const bedSoil = new THREE.Mesh(this.getGeometry('res_geom_16_box_0_22_0_06_0_22', () => new THREE.BoxGeometry(0.22, 0.06, 0.22)), this.materials.dirt);
        bedSoil.position.y = 0.04;
        flowerbed.add(bedSoil);

        const flowerColors = [this.materials.blossom, this.materials.leaves];
        for (let i = 0; i < 3; i++) {
          const f = new THREE.Mesh(this.getGeometry('res_geom_15_sphere_0_04_4_4', () => new THREE.SphereGeometry(0.04, 4, 4)), flowerColors[i % 2]);
          f.position.set(-0.06 + i * 0.06, 0.08, -0.04 + (i % 2) * 0.08);
          flowerbed.add(f);
        }
        group.add(flowerbed);

        const yardTree = this.createTreeMesh();
        yardTree.position.set(0.55, 0.06, -0.45);
        yardTree.scale.set(0.5, 0.5, 0.5);
        group.add(yardTree);

        addFenceX(-0.76, -0.75, 0.75, 5);
        addFenceX(0.76, 0.35, 0.75, 3);
        addFenceX(0.76, -0.75, -0.35, 3);
      } else {
        // Firewood stack and pine tree
        const woodpile = new THREE.Group();
        woodpile.position.set(0.4, 0.06, -0.4);
        const logGeo = this.getGeometry('res_geom_14_cylinder_0_03_0_03_0_22_5', () => {
          const geo = new THREE.CylinderGeometry(0.03, 0.03, 0.22, 5);
          geo.rotateX(Math.PI / 2);
          return geo;
        });

        const logOffsets = [
          [-0.06, 0.025, 0], [0, 0.025, 0], [0.06, 0.025, 0],
          [-0.03, 0.065, 0], [0.03, 0.065, 0],
          [0, 0.105, 0]
        ];
        for (const [lx, ly, lz] of logOffsets) {
          const log = new THREE.Mesh(logGeo, this.materials.trunk);
          log.position.set(lx, ly, lz);
          log.castShadow = true;
          woodpile.add(log);
        }
        group.add(woodpile);

        const yardTree = this.createTreeMesh();
        yardTree.position.set(-0.55, 0.06, -0.45);
        yardTree.scale.set(0.5, 0.5, 0.5);
        group.add(yardTree);

        addFenceZ(-0.76, -0.75, 0.75, 5);
        addFenceZ(0.76, -0.75, 0.75, 5);
      }

    } else if (level >= 3) {
      // Level 3: Three-story procedural apartment styles
      const w = 1.45, h = 2.45, d = 1.45;
      style = rand() > 0.5 ? 0 : 1;

      if (style === 0) {
        // SPLIT-LEVEL STEPPED MODERN APARTMENTS
        addFoundationAndStep(0.85, 1.2, 0, -0.3, 0);
        addFoundationAndStep(0.6, 1.1, null, 0.4, -0.05);

        // Main tower block (3 stories)
        const wt1 = 0.85, ht1 = 2.4, dt1 = 1.2;
        const tower1 = new THREE.Group();
        
        const brick1 = new THREE.Mesh(this.getGeometry(`res_geom_13_box_${wt1}_${ht1}_${dt1}`, () => new THREE.BoxGeometry(wt1, ht1, dt1)), palette.brick);
        brick1.position.y = ht1 / 2 + 0.1;
        brick1.castShadow = true;
        brick1.receiveShadow = true;
        tower1.add(brick1);

        // Roof trim
        const rt1 = new THREE.Mesh(this.getGeometry(`res_geom_12_box_${wt1}_${dt1}`, () => new THREE.BoxGeometry(wt1 + 0.06, 0.1, dt1 + 0.06)), palette.roof);
        rt1.position.y = ht1 + 0.15;
        tower1.add(rt1);

        this.addWindows(tower1, { w: wt1 - 0.1, h: ht1 - 0.2, d: dt1 - 0.1 }, 3, 2, 0.1);
        tower1.position.set(-0.3, 0, 0);
        group.add(tower1);

        // Stepped shorter wing block (2 stories)
        const wt2 = 0.6, ht2 = 1.6, dt2 = 1.1;
        const tower2 = new THREE.Group();

        const wall2 = new THREE.Mesh(this.getGeometry(`res_geom_11_box_${wt2}_${ht2}_${dt2}`, () => new THREE.BoxGeometry(wt2, ht2, dt2)), palette.wall);
        wall2.position.y = ht2 / 2 + 0.1;
        wall2.castShadow = true;
        wall2.receiveShadow = true;
        tower2.add(wall2);

        const rt2 = new THREE.Mesh(this.getGeometry(`res_geom_10_box_${wt2}_${dt2}`, () => new THREE.BoxGeometry(wt2 + 0.06, 0.1, dt2 + 0.06)), palette.roof);
        rt2.position.y = ht2 + 0.15;
        tower2.add(rt2);

        this.addWindows(tower2, { w: wt2 - 0.08, h: ht2 - 0.2, d: dt2 - 0.08 }, 2, 1, 0.1);
        tower2.position.set(0.4, 0, -0.05);
        group.add(tower2);

      } else {
        // BALCONY-FOCUS APARTMENT
        addFoundationAndStep(w, d, 0);

        const wall = new THREE.Mesh(this.getGeometry(`res_geom_9_box_${w}_${h}_${d}`, () => new THREE.BoxGeometry(w, h, d)), palette.wall);
        wall.position.set(0, h / 2 + 0.1, 0);
        wall.castShadow = true;
        wall.receiveShadow = true;
        group.add(wall);

        // Roof cornice
        const cornice = new THREE.Mesh(this.getGeometry(`res_geom_8_box_${w}_${d}`, () => new THREE.BoxGeometry(w + 0.08, 0.12, d + 0.08)), palette.roof);
        cornice.position.set(0, h + 0.16, 0);
        cornice.castShadow = true;
        group.add(cornice);

        // Exposed concrete columns / corners
        const colW = 0.08;
        const colOffsets = [
          [-w/2, -d/2], [w/2, -d/2], [-w/2, d/2], [w/2, d/2]
        ];
        for (const [cx, cz] of colOffsets) {
          const col = new THREE.Mesh(this.getGeometry(`res_geom_7_box_${colW}_${h}_${colW}`, () => new THREE.BoxGeometry(colW, h + 0.06, colW)), palette.trim);
          col.position.set(cx, h / 2 + 0.13, cz);
          col.castShadow = true;
          group.add(col);
        }

        // Add balconies in the front
        for (let story = 0; story < 3; story++) {
          const yPos = 0.1 + 0.35 + story * 0.75;
          const deck = new THREE.Mesh(this.getGeometry('res_geom_6_box_0_8_0_03_0_22', () => new THREE.BoxGeometry(0.8, 0.03, 0.22)), this.materials.trunk);
          deck.position.set(0, yPos, d / 2 + 0.1);
          group.add(deck);

          const rail = new THREE.Mesh(this.getGeometry('res_geom_5_box_0_82_0_16_0_02', () => new THREE.BoxGeometry(0.82, 0.16, 0.02)), palette.trim);
          rail.position.set(0, yPos + 0.08, d / 2 + 0.2);
          group.add(rail);

          // Balcony flowerbox
          if (rand() > 0.4) {
            const fBox = new THREE.Mesh(this.getGeometry('res_geom_4_box_0_3_0_05_0_06', () => new THREE.BoxGeometry(0.3, 0.05, 0.06)), this.materials.trunk);
            fBox.position.set(-0.15, yPos + 0.1, d / 2 + 0.23);
            group.add(fBox);
            const foliage = new THREE.Mesh(this.getGeometry('res_geom_3_box_0_28_0_04_0_05', () => new THREE.BoxGeometry(0.28, 0.04, 0.05)), this.materials.leaves);
            foliage.position.set(-0.15, yPos + 0.13, d / 2 + 0.23);
            group.add(foliage);
          }

          // Sliding glass doors behind balcony
          const door = new THREE.Mesh(this.getGeometry('res_geom_2_box_0_36_0_5_0_02', () => new THREE.BoxGeometry(0.36, 0.5, 0.02)), this.materials.window);
          door.position.set(0, yPos + 0.26, d / 2 + 0.015);
          group.add(door);
        }

        // Standard windows on the sides (skipFront=true to prevent clipping sliding glass doors)
        this.addWindows(group, { w, h, d }, 3, 3, 0.1, true);
      }

      // Landscaping: simple manicured bushes in front yard
      const bush1 = new THREE.Mesh(this.getGeometry('res_geom_1_box_0_22_0_22_0_22', () => new THREE.BoxGeometry(0.22, 0.22, 0.22)), this.materials.leaves);
      bush1.position.set(-0.55, 0.17, 0.85);
      bush1.castShadow = true;
      group.add(bush1);

      const bush2 = bush1.clone();
      bush2.position.x = 0.55;
      group.add(bush2);

      // Picket fence
      addFenceX(0.96, -0.9, -0.2, 3);
      addFenceX(0.96, 0.2, 0.9, 3);
    }

    return group;
  }

  // Returns chimney offset positions relative to tile center
  getResidentialChimneyPos(level: number, tileX: number, tileY: number): THREE.Vector3[] {
    const list: THREE.Vector3[] = [];
    if (level <= 0) return list;

    const rand = this.getSeededRandom(tileX, tileY);
    // Mimic the LCG consumption order of createResidentialMesh exactly
    rand(); // consume palette index
    rand(); // consume foundation roll
    
    if (level === 1) {
      rand(); // consume isGable roll
      const isLeft = rand() > 0.5; // chimney side
      rand(); // consume doorRoll
      const xOffset = isLeft ? -0.28 : 0.28;
      list.push(new THREE.Vector3(xOffset, 1.03, -0.2));
    } else if (level === 2) {
      rand(); // consume style roll for sequence sync
      const isLeft = rand() > 0.5; // keep chimney side selection sequence sync
      const xOffset = isLeft ? -0.32 : 0.32;
      list.push(new THREE.Vector3(xOffset, 1.68, -0.22));
    } else if (level >= 3) {
      const styleVal = rand() > 0.5 ? 0 : 1;
      if (styleVal === 0) {
        // split level tower 1 chimney point
        list.push(new THREE.Vector3(-0.3, 2.5, 0));
      } else {
        // flat vents
        list.push(new THREE.Vector3(-0.45, 2.65, -0.45));
        list.push(new THREE.Vector3(0.45, 2.65, 0.45));
      }
    }
    return list;
  }

  // 5. Commercial Buildings (Levels 0-3)
  createCommercialMesh(level: number, tileX: number = 0, tileY: number = 0): THREE.Group {
    const group = new THREE.Group();

    if (level === 0) {
      const lineGeo = this.getGeometry('com_level0_line', () => new THREE.BoxGeometry(1.9, 0.05, 1.9));
      const line = new THREE.Mesh(lineGeo, this.materials.zoneC);
      line.position.y = 0.06;
      group.add(line);
      return group;
    }

    // Seed-based random generator
    const rand = this.getSeededRandom(tileX, tileY);
    const paletteIndex = Math.floor(rand() * this.commercialPalettes.length);
    const palette = this.commercialPalettes[paletteIndex];

    // Paved commercial plinth / plaza
    const plinthGeo = this.getGeometry('com_plinth', () => {
      const geo = new THREE.BoxGeometry(1.8, 0.04, 1.8);
      geo.translate(0, 0.02, 0); // local center at Y=0.02, top at Y=0.04
      return geo;
    });
    const plinth = new THREE.Mesh(plinthGeo, this.materials.cement);
    plinth.position.set(0, 0.06, 0); // top at Y=0.10
    plinth.castShadow = true;
    plinth.receiveShadow = true;
    group.add(plinth);

    const addAwning = (parent: THREE.Group, aw: number, ad: number, ah: number, ax: number, ay: number, az: number) => {
      const awningGroup = new THREE.Group();
      const numStripes = 6;
      const stripeW = aw / numStripes;
      for (let i = 0; i < numStripes; i++) {
        const stripeGeo = this.getGeometry(`com_awning_stripe_${stripeW.toFixed(3)}_${ad.toFixed(3)}_${ah.toFixed(3)}`, () => {
          return new THREE.BoxGeometry(stripeW - 0.005, ah, ad);
        });
        const stripeMat = i % 2 === 0 ? palette.accent : this.materials.whiteMetal;
        const stripe = new THREE.Mesh(stripeGeo, stripeMat);
        stripe.position.set(-aw / 2 + stripeW / 2 + i * stripeW, 0, 0);
        stripe.castShadow = true;
        awningGroup.add(stripe);
      }
      awningGroup.position.set(ax, ay, az);
      awningGroup.rotation.x = Math.PI / 6; // slope down
      parent.add(awningGroup);
    };

    if (level === 1) {
      // 3 variants: 0 = Cafe/Bakery, 1 = Flower/Grocery, 2 = Bookstore
      const variant = Math.floor(rand() * 3);
      const w = 1.2, h = 0.7, d = 1.1;
      const t = 0.04;
      const yBottom = 0.1; // bottom of walls

      // Base wall shape with door and window cutouts
      const shape = new THREE.Shape();
      shape.moveTo(-w / 2, 0);
      shape.lineTo(w / 2, 0);
      shape.lineTo(w / 2, h);
      shape.lineTo(-w / 2, h);
      shape.closePath();

      // Cutout Door (on the right or left)
      const doorW = 0.22;
      const doorH = 0.48;
      const doorX = variant === 0 ? -0.3 : 0.3; // Cafe door left, others right

      const doorPath = new THREE.Path();
      doorPath.moveTo(doorX - doorW / 2, 0);
      doorPath.lineTo(doorX - doorW / 2, doorH);
      doorPath.lineTo(doorX + doorW / 2, doorH);
      doorPath.lineTo(doorX + doorW / 2, 0);
      doorPath.closePath();
      shape.holes.push(doorPath);

      // Cutout Window
      const winW = 0.45;
      const winH = 0.35;
      const winX = variant === 0 ? 0.25 : -0.25; // opposite of door
      const winY = 0.12;

      const winPath = new THREE.Path();
      winPath.moveTo(winX - winW / 2, winY);
      winPath.lineTo(winX - winW / 2, winY + winH);
      winPath.lineTo(winX + winW / 2, winY + winH);
      winPath.lineTo(winX + winW / 2, winY);
      winPath.closePath();
      shape.holes.push(winPath);

      // Front wall
      const wallFGeo = this.getGeometry(`com_l1_wallF_${variant}_${w}_${h}_${d}_${t}`, () => new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: false }));
      const wallF = new THREE.Mesh(wallFGeo, palette.wall);
      wallF.position.set(0, yBottom, d / 2 - t);
      wallF.castShadow = true;
      wallF.receiveShadow = true;
      group.add(wallF);

      // Back wall
      const backGeo = this.getGeometry(`com_l1_wallB_${w}_${h}_${t}`, () => new THREE.BoxGeometry(w, h, t));
      const wallB = new THREE.Mesh(backGeo, palette.wall);
      wallB.position.set(0, yBottom + h / 2, -d / 2 + t / 2);
      wallB.castShadow = true;
      wallB.receiveShadow = true;
      group.add(wallB);

      // Left & Right walls
      const sideW = d - t * 2;
      const sideGeo = this.getGeometry(`com_l1_wallSide_${sideW}_${h}_${t}`, () => new THREE.BoxGeometry(t, h, sideW));
      const wallL = new THREE.Mesh(sideGeo, palette.wall);
      wallL.position.set(-w / 2 + t / 2, yBottom + h / 2, 0);
      wallL.castShadow = true;
      wallL.receiveShadow = true;
      group.add(wallL);

      const wallR = new THREE.Mesh(sideGeo, palette.wall);
      wallR.position.set(w / 2 - t / 2, yBottom + h / 2, 0);
      wallR.castShadow = true;
      wallR.receiveShadow = true;
      group.add(wallR);

      // Flat cozy roof
      const roofGeo = this.getGeometry(`com_l1_roof_${w}_${d}`, () => new THREE.BoxGeometry(w + 0.08, 0.06, d + 0.08));
      const roof = new THREE.Mesh(roofGeo, palette.roof);
      roof.position.set(0, yBottom + h + 0.03, 0);
      roof.castShadow = true;
      group.add(roof);

      // Storefront glass
      const glassGeo = this.getGeometry(`com_l1_glass_${winW}_${winH}`, () => new THREE.BoxGeometry(winW, winH, 0.02));
      const glass = new THREE.Mesh(glassGeo, this.materials.window);
      glass.position.set(winX, yBottom + winY + winH / 2, d / 2 - t / 2);
      group.add(glass);

      // Storefront door
      const doorGeo = this.getGeometry(`com_l1_door_${doorW}_${doorH}`, () => new THREE.BoxGeometry(doorW, doorH, 0.02));
      const door = new THREE.Mesh(doorGeo, palette.trim);
      door.position.set(doorX, yBottom + doorH / 2, d / 2 - t / 2);
      group.add(door);

      // Awnings
      addAwning(group, winW + 0.06, 0.22, 0.02, winX, yBottom + winY + winH + 0.01, d / 2 + 0.05);

      // Signboard
      const signGeo = this.getGeometry(`com_l1_sign_${w}`, () => new THREE.BoxGeometry(0.5, 0.16, 0.04));
      const sign = new THREE.Mesh(signGeo, this.materials.whiteMetal);
      sign.position.set(0, yBottom + h + 0.03, d / 2 + 0.05);
      group.add(sign);

      // Variant Specific Props
      if (variant === 0) {
        // Cafe / Bakery: Outdoor table and chair
        const tableGroup = new THREE.Group();
        tableGroup.position.set(0.4, 0.1, 0.5);

        const legGeo = this.getGeometry('com_prop_table_leg', () => new THREE.CylinderGeometry(0.02, 0.02, 0.16, 6));
        const leg = new THREE.Mesh(legGeo, this.materials.whiteMetal);
        leg.position.y = 0.08;
        tableGroup.add(leg);

        const topGeo = this.getGeometry('com_prop_table_top', () => new THREE.CylinderGeometry(0.18, 0.18, 0.015, 8));
        const top = new THREE.Mesh(topGeo, palette.trim);
        top.position.y = 0.16;
        tableGroup.add(top);

        const chairGeo = this.getGeometry('com_prop_chair', () => new THREE.BoxGeometry(0.1, 0.1, 0.1));
        const chairMat = this.materials.trunk;
        
        const chair1 = new THREE.Mesh(chairGeo, chairMat);
        chair1.position.set(-0.2, 0.05, 0);
        tableGroup.add(chair1);

        const chair2 = chair1.clone();
        chair2.position.set(0.2, 0.05, 0);
        tableGroup.add(chair2);

        group.add(tableGroup);
      } else if (variant === 1) {
        // Grocery / Flower Shop: Crates of flowers/produce
        const crateGroup = new THREE.Group();
        crateGroup.position.set(-0.45, 0.1, 0.45);

        const crateGeo = this.getGeometry('com_prop_crate', () => new THREE.BoxGeometry(0.18, 0.06, 0.18));
        const crate = new THREE.Mesh(crateGeo, this.materials.trunk);
        crate.position.y = 0.03;
        crateGroup.add(crate);

        const appleGeo = this.getGeometry('com_prop_apple', () => new THREE.SphereGeometry(0.035, 4, 4));
        const appleColors = [this.materials.roof, this.materials.leaves, this.materials.carYellow];
        const appleMat = appleColors[Math.floor(rand() * appleColors.length)];

        for (let i = 0; i < 4; i++) {
          const apple = new THREE.Mesh(appleGeo, appleMat);
          const ox = -0.05 + (i % 2) * 0.1;
          const oz = -0.05 + Math.floor(i / 2) * 0.1;
          apple.position.set(ox, 0.07, oz);
          crateGroup.add(apple);
        }
        group.add(crateGroup);

        const shrubGeo = this.getGeometry('com_prop_shrub', () => new THREE.SphereGeometry(0.12, 5, 5));
        const shrub = new THREE.Mesh(shrubGeo, this.materials.leaves);
        shrub.position.set(0.55, 0.2, -0.2);
        shrub.castShadow = true;
        group.add(shrub);
      } else {
        // Bookstore: Small book stand
        const standGroup = new THREE.Group();
        standGroup.position.set(-0.4, 0.1, 0.45);

        const baseGeo = this.getGeometry('com_prop_stand_base', () => new THREE.BoxGeometry(0.24, 0.18, 0.14));
        const base = new THREE.Mesh(baseGeo, palette.accent);
        base.position.y = 0.09;
        base.castShadow = true;
        standGroup.add(base);

        const bookGeo = this.getGeometry('com_prop_book', () => new THREE.BoxGeometry(0.03, 0.08, 0.06));
        const bookMats = [this.materials.carRed, this.materials.carBlue, this.materials.carYellow];
        for (let i = 0; i < 5; i++) {
          const book = new THREE.Mesh(bookGeo, bookMats[i % 3]);
          book.position.set(-0.08 + i * 0.04, 0.19, 0);
          book.rotation.y = 0.1;
          standGroup.add(book);
        }
        group.add(standGroup);

        const lightGeo = this.getGeometry('com_prop_wall_light', () => new THREE.BoxGeometry(0.04, 0.06, 0.06));
        const lightFixture = new THREE.Mesh(lightGeo, this.materials.whiteMetal);
        lightFixture.position.set(doorX, yBottom + doorH + 0.06, d / 2 + 0.02);
        group.add(lightFixture);

        const bulbGeo = this.getGeometry('com_prop_bulb', () => new THREE.SphereGeometry(0.025, 4, 4));
        const bulb = new THREE.Mesh(bulbGeo, this.materials.fairyLight);
        bulb.position.set(doorX, yBottom + doorH + 0.03, d / 2 + 0.05);
        group.add(bulb);
      }
    } else if (level === 2) {
      const variant = Math.floor(rand() * 3);
      const yBottom = 0.1;

      if (variant === 0) {
        // Diner / Fast Food
        const w = 1.3, h = 0.7, d = 1.1;
        const wallGeo = this.getGeometry(`com_l2_diner_wall_${w}_${h}_${d}`, () => {
          const geo = new THREE.BoxGeometry(w, h, d);
          geo.translate(0, h / 2, 0);
          return geo;
        });
        const wall = new THREE.Mesh(wallGeo, palette.wall);
        wall.position.set(-0.1, yBottom, 0);
        wall.castShadow = true;
        wall.receiveShadow = true;
        group.add(wall);

        const glassGeo = this.getGeometry('com_l2_diner_glass', () => new THREE.BoxGeometry(0.8, 0.45, 0.02));
        const glass = new THREE.Mesh(glassGeo, this.materials.window);
        glass.position.set(-0.2, yBottom + 0.3, d / 2 + 0.01);
        group.add(glass);

        const doorGeo = this.getGeometry('com_l2_diner_door', () => new THREE.BoxGeometry(0.2, 0.45, 0.02));
        const door = new THREE.Mesh(doorGeo, palette.trim);
        door.position.set(0.3, yBottom + 0.225, d / 2 + 0.01);
        group.add(door);

        const trimGeo = this.getGeometry(`com_l2_diner_trim_${w}`, () => new THREE.BoxGeometry(w + 0.04, 0.08, d + 0.04));
        const roofTrim = new THREE.Mesh(trimGeo, palette.accent);
        roofTrim.position.set(-0.1, yBottom + h + 0.04, 0);
        roofTrim.castShadow = true;
        group.add(roofTrim);

        // Signpost
        const signpost = new THREE.Group();
        signpost.position.set(0.68, yBottom, 0.45);

        const poleGeo = this.getGeometry('com_l2_diner_pole', () => new THREE.CylinderGeometry(0.03, 0.03, 0.8, 6));
        const pole = new THREE.Mesh(poleGeo, this.materials.whiteMetal);
        pole.position.y = 0.4;
        pole.castShadow = true;
        signpost.add(pole);

        const boardGeo = this.getGeometry('com_l2_diner_board', () => new THREE.BoxGeometry(0.24, 0.24, 0.1));
        const board = new THREE.Mesh(boardGeo, palette.accent);
        board.position.y = 0.8;
        board.castShadow = true;
        signpost.add(board);

        const innerBoardGeo = this.getGeometry('com_l2_diner_board_in', () => new THREE.BoxGeometry(0.18, 0.18, 0.11));
        const innerBoard = new THREE.Mesh(innerBoardGeo, this.materials.window);
        innerBoard.position.y = 0.8;
        signpost.add(innerBoard);

        group.add(signpost);

        // Umbrella table
        const umbrellaGroup = new THREE.Group();
        umbrellaGroup.position.set(-0.55, yBottom, 0.55);

        const umPoleGeo = this.getGeometry('com_l2_diner_umpole', () => new THREE.CylinderGeometry(0.015, 0.015, 0.35, 5));
        const umPole = new THREE.Mesh(umPoleGeo, this.materials.whiteMetal);
        umPole.position.y = 0.175;
        umbrellaGroup.add(umPole);

        const umConeGeo = this.getGeometry('com_l2_diner_umcone', () => new THREE.ConeGeometry(0.25, 0.1, 8));
        const umCone = new THREE.Mesh(umConeGeo, palette.accent);
        umCone.position.y = 0.35;
        umCone.castShadow = true;
        umbrellaGroup.add(umCone);

        const tabGeo = this.getGeometry('com_l2_diner_tab', () => new THREE.CylinderGeometry(0.12, 0.12, 0.015, 6));
        const tab = new THREE.Mesh(tabGeo, palette.trim);
        tab.position.y = 0.14;
        umbrellaGroup.add(tab);

        group.add(umbrellaGroup);

      } else if (variant === 1) {
        // Boutique Design Studio / Office
        const w1 = 1.3, h1 = 0.5, d1 = 1.1;
        const w2 = 0.8, h2 = 0.45, d2 = 0.9;

        const gfGeo = this.getGeometry(`com_l2_studio_gf_${w1}_${h1}_${d1}`, () => new THREE.BoxGeometry(w1, h1, d1));
        const gf = new THREE.Mesh(gfGeo, palette.wall);
        gf.position.set(0, yBottom + h1 / 2, 0);
        gf.castShadow = true;
        gf.receiveShadow = true;
        group.add(gf);

        const ffGeo = this.getGeometry(`com_l2_studio_ff_${w2}_${h2}_${d2}`, () => new THREE.BoxGeometry(w2, h2, d2));
        const ff = new THREE.Mesh(ffGeo, palette.wall);
        ff.position.set(-0.2, yBottom + h1 + h2 / 2, -0.05);
        ff.castShadow = true;
        ff.receiveShadow = true;
        group.add(ff);

        const roofGeo = this.getGeometry(`com_l2_studio_roof_${w2}_${d2}`, () => new THREE.BoxGeometry(w2 + 0.04, 0.04, d2 + 0.04));
        const roof = new THREE.Mesh(roofGeo, palette.roof);
        roof.position.set(-0.2, yBottom + h1 + h2 + 0.02, -0.05);
        group.add(roof);

        // Balcony safety railing
        const railGroup = new THREE.Group();
        railGroup.position.set(0.4, yBottom + h1, 0);

        const railPostGeo = this.getGeometry('com_l2_studio_railpost', () => new THREE.BoxGeometry(0.015, 0.16, 0.015));
        const railBarGeo = this.getGeometry(`com_l2_studio_railbar_${d1}`, () => new THREE.BoxGeometry(0.01, 0.015, d1 - 0.08));
        
        for (let i = 0; i < 3; i++) {
          const post = new THREE.Mesh(railPostGeo, this.materials.whiteMetal);
          post.position.set(0, 0.08, -d1 / 2 + 0.08 + i * (d1 - 0.16) / 2);
          railGroup.add(post);
        }
        const bar = new THREE.Mesh(railBarGeo, this.materials.whiteMetal);
        bar.position.set(0, 0.15, 0);
        railGroup.add(bar);

        const frontRailGeo = this.getGeometry('com_l2_studio_railfront', () => new THREE.BoxGeometry(0.4, 0.015, 0.01));
        const fBar = new THREE.Mesh(frontRailGeo, this.materials.whiteMetal);
        fBar.position.set(-0.2, 0.15, d1/2 - 0.04);
        railGroup.add(fBar);

        group.add(railGroup);

        const winFGeo = this.getGeometry('com_l2_studio_winfg', () => new THREE.BoxGeometry(0.7, 0.3, 0.02));
        const winFG = new THREE.Mesh(winFGeo, this.materials.window);
        winFG.position.set(-0.2, yBottom + 0.22, d1 / 2 + 0.01);
        group.add(winFG);

        const doorGeo = this.getGeometry('com_l2_studio_doorgf', () => new THREE.BoxGeometry(0.18, 0.36, 0.02));
        const door = new THREE.Mesh(doorGeo, palette.trim);
        door.position.set(0.35, yBottom + 0.18, d1 / 2 + 0.01);
        group.add(door);

        const ffWinGeo = this.getGeometry('com_l2_studio_winff', () => new THREE.BoxGeometry(0.4, 0.22, 0.02));
        const ffWin = new THREE.Mesh(ffWinGeo, this.materials.window);
        ffWin.position.set(-0.2, yBottom + h1 + 0.22, d2 / 2 - 0.04);
        group.add(ffWin);

        const panelGroup = new THREE.Group();
        panelGroup.position.set(-0.2, yBottom + h1 + h2 + 0.04, -0.15);

        const panGeo = this.getGeometry('com_l2_studio_pan', () => new THREE.BoxGeometry(0.24, 0.015, 0.18));
        const pan = new THREE.Mesh(panGeo, this.materials.road);
        pan.rotation.x = -Math.PI / 6;
        pan.castShadow = true;
        panelGroup.add(pan);

        const supportGeo = this.getGeometry('com_l2_studio_pansupp', () => new THREE.CylinderGeometry(0.01, 0.01, 0.06, 4));
        const support = new THREE.Mesh(supportGeo, this.materials.whiteMetal);
        support.position.set(0, -0.02, 0);
        panelGroup.add(support);

        group.add(panelGroup);

      } else {
        // Commercial Plaza / Shared Complex
        const w1 = 0.65, h1 = 0.6, d1 = 1.0;
        const w2 = 0.65, h2 = 0.55, d2 = 0.9;
        const x1 = -0.36, z1 = 0.0;
        const x2 = 0.36, z2 = -0.05;

        const store1 = new THREE.Mesh(this.getGeometry(`com_l2_plaza_s1_${w1}_${h1}_${d1}`, () => new THREE.BoxGeometry(w1, h1, d1)), palette.wall);
        store1.position.set(x1, yBottom + h1 / 2, z1);
        store1.castShadow = true;
        store1.receiveShadow = true;
        group.add(store1);

        const store2 = new THREE.Mesh(this.getGeometry(`com_l2_plaza_s2_${w2}_${h2}_${d2}`, () => new THREE.BoxGeometry(w2, h2, d2)), palette.accent);
        store2.position.set(x2, yBottom + h2 / 2, z2);
        store2.castShadow = true;
        store2.receiveShadow = true;
        group.add(store2);

        const r1 = new THREE.Mesh(this.getGeometry(`com_l2_plaza_r1_${w1}_${d1}`, () => new THREE.BoxGeometry(w1 + 0.04, 0.04, d1 + 0.04)), palette.roof);
        r1.position.set(x1, yBottom + h1 + 0.02, z1);
        group.add(r1);

        const r2 = new THREE.Mesh(this.getGeometry(`com_l2_plaza_r2_${w2}_${d2}`, () => new THREE.BoxGeometry(w2 + 0.04, 0.04, d2 + 0.04)), palette.roof);
        r2.position.set(x2, yBottom + h2 + 0.02, z2);
        group.add(r2);

        const winGeo1 = this.getGeometry('com_l2_plaza_w1', () => new THREE.BoxGeometry(0.3, 0.28, 0.02));
        const wMesh1 = new THREE.Mesh(winGeo1, this.materials.window);
        wMesh1.position.set(x1 - 0.1, yBottom + 0.22, z1 + d1 / 2 + 0.01);
        group.add(wMesh1);

        const winGeo2 = this.getGeometry('com_l2_plaza_w2', () => new THREE.BoxGeometry(0.3, 0.24, 0.02));
        const wMesh2 = new THREE.Mesh(winGeo2, this.materials.window);
        wMesh2.position.set(x2 - 0.1, yBottom + 0.2, z2 + d2 / 2 + 0.01);
        group.add(wMesh2);

        const doorPlazaGeo = this.getGeometry('com_l2_plaza_door', () => new THREE.BoxGeometry(0.16, 0.32, 0.02));
        const dMesh1 = new THREE.Mesh(doorPlazaGeo, palette.trim);
        dMesh1.position.set(x1 + 0.18, yBottom + 0.16, z1 + d1 / 2 + 0.01);
        group.add(dMesh1);

        const dMesh2 = new THREE.Mesh(doorPlazaGeo, palette.trim);
        dMesh2.position.set(x2 + 0.18, yBottom + 0.16, z2 + d2 / 2 + 0.01);
        group.add(dMesh2);

        const benchGroup = new THREE.Group();
        benchGroup.position.set(0, yBottom, 0.65);

        const plankGeo = this.getGeometry('com_l2_plaza_plank', () => new THREE.BoxGeometry(0.36, 0.02, 0.08));
        const plank = new THREE.Mesh(plankGeo, this.materials.trunk);
        plank.position.y = 0.08;
        plank.castShadow = true;
        benchGroup.add(plank);

        const legPlazaGeo = this.getGeometry('com_l2_plaza_benchleg', () => new THREE.BoxGeometry(0.03, 0.08, 0.08));
        const leg1 = new THREE.Mesh(legPlazaGeo, this.materials.whiteMetal);
        leg1.position.set(-0.14, 0.04, 0);
        benchGroup.add(leg1);

        const leg2 = leg1.clone();
        leg2.position.x = 0.14;
        benchGroup.add(leg2);

        group.add(benchGroup);
      }
    } else if (level >= 3) {
      const variant = Math.floor(rand() * 2);
      const yBottom = 0.1;

      if (variant === 0) {
        // Sleek Modern Corporate HQ (3 stories)
        const w = 1.3, h = 1.9, d = 1.3;
        const hqGroup = new THREE.Group();
        hqGroup.position.set(0, 0, -0.1);

        const towerGeo = this.getGeometry(`com_l3_hq_tower_${w}_${h}_${d}`, () => new THREE.BoxGeometry(w, h, d));
        const tower = new THREE.Mesh(towerGeo, palette.wall);
        tower.position.y = yBottom + h / 2;
        tower.castShadow = true;
        tower.receiveShadow = true;
        hqGroup.add(tower);

        const stripGeo = this.getGeometry(`com_l3_hq_strip_${h}`, () => new THREE.BoxGeometry(0.35, h - 0.2, 0.04));
        const strip = new THREE.Mesh(stripGeo, this.materials.glass);
        strip.position.set(0, yBottom + h / 2, d / 2 + 0.01);
        hqGroup.add(strip);

        this.addWindows(hqGroup, { w, h, d }, 3, 3, 0.1, false);

        const roofLedgeGeo = this.getGeometry(`com_l3_hq_ledge_${w}_${d}`, () => new THREE.BoxGeometry(w + 0.06, 0.05, d + 0.06));
        const roofLedge = new THREE.Mesh(roofLedgeGeo, palette.roof);
        roofLedge.position.set(0, yBottom + h + 0.025, 0);
        hqGroup.add(roofLedge);

        const rShubGeo = this.getGeometry('com_l3_hq_rshrub', () => new THREE.BoxGeometry(0.4, 0.08, 0.4));
        const rShrub = new THREE.Mesh(rShubGeo, this.materials.leaves);
        rShrub.position.set(-0.25, yBottom + h + 0.09, -0.1);
        hqGroup.add(rShrub);

        const panelGroup = new THREE.Group();
        panelGroup.position.set(0.25, yBottom + h + 0.05, -0.1);
        const panGeo = this.getGeometry('com_l3_hq_pan', () => new THREE.BoxGeometry(0.35, 0.02, 0.25));
        const pan = new THREE.Mesh(panGeo, this.materials.road);
        pan.rotation.x = -Math.PI / 6;
        pan.castShadow = true;
        panelGroup.add(pan);
        const supportGeo = this.getGeometry('com_l3_hq_pansupp', () => new THREE.BoxGeometry(0.02, 0.08, 0.02));
        const support = new THREE.Mesh(supportGeo, this.materials.whiteMetal);
        support.position.y = -0.04;
        panelGroup.add(support);
        hqGroup.add(panelGroup);

        group.add(hqGroup);

        // Front Courtyard fountain
        const fountainGroup = new THREE.Group();
        fountainGroup.position.set(0, yBottom, 0.65);

        const fBaseGeo = this.getGeometry('com_l3_hq_fbase', () => new THREE.CylinderGeometry(0.18, 0.18, 0.04, 8));
        const fBase = new THREE.Mesh(fBaseGeo, this.materials.cement);
        fBase.position.y = 0.02;
        fBase.castShadow = true;
        fountainGroup.add(fBase);

        const fWaterGeo = this.getGeometry('com_l3_hq_fwater', () => new THREE.CylinderGeometry(0.15, 0.15, 0.04, 8));
        const fWater = new THREE.Mesh(fWaterGeo, this.materials.waterBlue);
        fWater.position.y = 0.025;
        fountainGroup.add(fWater);

        const fSprayGeo = this.getGeometry('com_l3_hq_fspray', () => new THREE.CylinderGeometry(0.015, 0.04, 0.12, 6));
        const fSpray = new THREE.Mesh(fSprayGeo, this.materials.whiteMetal);
        fSpray.position.y = 0.1;
        fSpray.castShadow = true;
        fountainGroup.add(fSpray);

        group.add(fountainGroup);

      } else {
        // Multi-Store Shopping Galleria / Complex
        const h1 = 1.3, h2 = 0.8;
        const mainBlockGroup = new THREE.Group();
        mainBlockGroup.position.set(-0.35, 0, 0);

        const mainBlockGeo = this.getGeometry('com_l3_gal_b1', () => new THREE.BoxGeometry(0.8, h1, 1.4));
        const mainBlock = new THREE.Mesh(mainBlockGeo, palette.wall);
        mainBlock.position.y = yBottom + h1 / 2;
        mainBlock.castShadow = true;
        mainBlock.receiveShadow = true;
        mainBlockGroup.add(mainBlock);

        const r1Geo = this.getGeometry('com_l3_gal_r1', () => new THREE.BoxGeometry(0.84, 0.04, 1.44));
        const r1 = new THREE.Mesh(r1Geo, palette.roof);
        r1.position.set(0, yBottom + h1 + 0.02, 0);
        mainBlockGroup.add(r1);

        this.addWindows(mainBlockGroup, { w: 0.8, h: h1, d: 1.4 }, 2, 2, 0.1, true);
        group.add(mainBlockGroup);

        const wingBlockGeo = this.getGeometry('com_l3_gal_b2', () => new THREE.BoxGeometry(0.7, h2, 0.8));
        const wingBlock = new THREE.Mesh(wingBlockGeo, palette.accent);
        wingBlock.position.set(0.4, yBottom + h2 / 2, 0.3);
        wingBlock.castShadow = true;
        wingBlock.receiveShadow = true;
        group.add(wingBlock);

        const r2Geo = this.getGeometry('com_l3_gal_r2', () => new THREE.BoxGeometry(0.74, 0.04, 0.84));
        const r2 = new THREE.Mesh(r2Geo, palette.roof);
        r2.position.set(0.4, yBottom + h2 + 0.02, 0.3);
        group.add(r2);

        const storeGlassGeo1 = this.getGeometry('com_l3_gal_glass1', () => new THREE.BoxGeometry(0.5, 0.32, 0.02));
        const sGlass1 = new THREE.Mesh(storeGlassGeo1, this.materials.window);
        sGlass1.position.set(-0.35, yBottom + 0.2, 0.71);
        group.add(sGlass1);

        const storeGlassGeo2 = this.getGeometry('com_l3_gal_glass2', () => new THREE.BoxGeometry(0.4, 0.28, 0.02));
        const sGlass2 = new THREE.Mesh(storeGlassGeo2, this.materials.window);
        sGlass2.position.set(0.4, yBottom + 0.18, 0.71);
        group.add(sGlass2);

        const doorPlazaGeo = this.getGeometry('com_l3_gal_door', () => new THREE.BoxGeometry(0.18, 0.32, 0.02));
        const dMesh = new THREE.Mesh(doorPlazaGeo, palette.trim);
        dMesh.position.set(-0.02, yBottom + 0.16, 0.71);
        group.add(dMesh);

        const treePlaza = this.createTreeMesh();
        treePlaza.position.set(0.45, yBottom, -0.4);
        treePlaza.scale.set(0.5, 0.5, 0.5);
        group.add(treePlaza);

        const flowerGeo = this.getGeometry('com_l3_gal_flower', () => new THREE.BoxGeometry(0.4, 0.05, 0.2));
        const flowerbed = new THREE.Mesh(flowerGeo, this.materials.trunk);
        flowerbed.position.set(0.4, yBottom + 0.025, -0.05);
        group.add(flowerbed);

        const flowerSoil = new THREE.Mesh(this.getGeometry('com_l3_gal_soil', () => new THREE.BoxGeometry(0.36, 0.05, 0.16)), this.materials.dirt);
        flowerSoil.position.set(0.4, yBottom + 0.03, -0.05);
        group.add(flowerSoil);

        const bulbGeo = this.getGeometry('com_l3_gal_bulb', () => new THREE.SphereGeometry(0.03, 4, 4));
        for (let i = 0; i < 3; i++) {
          const fl = new THREE.Mesh(bulbGeo, this.materials.blossom);
          fl.position.set(0.28 + i * 0.12, yBottom + 0.07, -0.05);
          group.add(fl);
        }

        const lampGroup = new THREE.Group();
        lampGroup.position.set(0.7, yBottom, 0.65);

        const lPoleGeo = this.getGeometry('com_l3_gal_lpole', () => new THREE.CylinderGeometry(0.015, 0.015, 0.35, 5));
        const lPole = new THREE.Mesh(lPoleGeo, this.materials.whiteMetal);
        lPole.position.y = 0.175;
        lPole.castShadow = true;
        lampGroup.add(lPole);

        const lHeadGeo = this.getGeometry('com_l3_gal_lhead', () => new THREE.BoxGeometry(0.05, 0.05, 0.05));
        const lHead = new THREE.Mesh(lHeadGeo, this.materials.whiteMetal);
        lHead.position.y = 0.35;
        lampGroup.add(lHead);

        const lBulb = new THREE.Mesh(this.getGeometry('com_l3_gal_lbulb', () => new THREE.SphereGeometry(0.025, 4, 4)), this.materials.fairyLight);
        lBulb.position.y = 0.31;
        lampGroup.add(lBulb);

        group.add(lampGroup);
      }
    }

    return group;
  }

  // 6. Industrial Buildings (Levels 0-3)
  createIndustrialMesh(level: number): THREE.Group {
    const group = new THREE.Group();

    if (level === 0) {
      const lineGeo = this.getGeometry('ind_level0_line', () => new THREE.BoxGeometry(1.9, 0.05, 1.9));
      const line = new THREE.Mesh(lineGeo, this.materials.zoneI);
      group.add(line);
      return group;
    }

    // Foundation
    const foundGeo = this.getGeometry('ind_foundation', () => {
      const geo = new THREE.BoxGeometry(1.7, 0.08, 1.7);
      geo.translate(0, 0.04, 0);
      return geo;
    });
    const found = new THREE.Mesh(foundGeo, this.materials.dirt);
    group.add(found);

    if (level === 1) {
      // Level 1: Small metal warehouse / workshop
      const w = 1.4, h = 0.8, d = 1.4;
      const wallGeo = this.getGeometry('ind_level1_wall', () => {
        const geo = new THREE.BoxGeometry(w, h, d);
        geo.translate(0, h / 2 + 0.08, 0);
        return geo;
      });
      const wall = new THREE.Mesh(wallGeo, this.materials.wallInd);
      wall.castShadow = true;
      group.add(wall);

      // Sawtooth industrial roof shape
      const roofGeo = this.getGeometry('ind_level1_roof', () => {
        const geo = new THREE.CylinderGeometry(0.1, 0.8, 1.4, 3);
        geo.rotateZ(Math.PI / 2);
        geo.translate(0, h + 0.2 + 0.08, 0);
        return geo;
      });
      const roof = new THREE.Mesh(roofGeo, this.materials.metal);
      group.add(roof);

      // Little exhaust pipe
      const pipeGeo = this.getGeometry('ind_level1_pipe', () => {
        const geo = new THREE.CylinderGeometry(0.06, 0.06, 0.5, 4);
        geo.translate(0.4, h + 0.3, 0.3);
        return geo;
      });
      const pipe = new THREE.Mesh(pipeGeo, this.materials.metal);
      group.add(pipe);

    } else if (level === 2) {
      // Level 2: Factory building with loading docks
      const w = 1.5, h = 1.4, d = 1.5;
      const wallGeo = this.getGeometry('ind_level2_wall', () => {
        const geo = new THREE.BoxGeometry(w, h, d);
        geo.translate(0, h / 2 + 0.08, 0);
        return geo;
      });
      const wall = new THREE.Mesh(wallGeo, this.materials.wallInd);
      wall.castShadow = true;
      group.add(wall);

      // Large metal roller door
      const doorGeo = this.getGeometry('ind_level2_door', () => new THREE.BoxGeometry(0.8, 0.8, 0.05));
      const door = new THREE.Mesh(doorGeo, this.materials.metal);
      door.position.set(0, 0.48, d / 2 + 0.01);
      group.add(door);

      // Tall chimney
      const chimneyGeo = this.getGeometry('ind_level2_chimney', () => {
        const geo = new THREE.CylinderGeometry(0.1, 0.15, 1.6, 5);
        geo.translate(-0.4, 0.88, -0.4);
        return geo;
      });
      const chimney = new THREE.Mesh(chimneyGeo, this.materials.metal);
      chimney.castShadow = true;
      group.add(chimney);

    } else if (level >= 3) {
      // Level 3: Large refinery plant with smoke stacks and pipes
      const w = 1.6, h = 2.0, d = 1.6;
      const wallGeo = this.getGeometry('ind_level3_wall', () => {
        const geo = new THREE.BoxGeometry(w, h, d);
        geo.translate(0, h / 2 + 0.08, 0);
        return geo;
      });
      const wall = new THREE.Mesh(wallGeo, this.materials.wallInd);
      wall.castShadow = true;
      group.add(wall);

      // Storage cylinders
      const tankGeo = this.getGeometry('ind_level3_tank', () => {
        const geo = new THREE.CylinderGeometry(0.3, 0.3, 1.4, 5);
        geo.translate(0.4, 0.78, 0.4);
        return geo;
      });
      const tank = new THREE.Mesh(tankGeo, this.materials.metal);
      tank.castShadow = true;
      group.add(tank);

      // Multi chimneys
      for (let i = 0; i < 2; i++) {
        const chimGeo = this.getGeometry(`ind_level3_chimney_${i}`, () => {
          const geo = new THREE.CylinderGeometry(0.08, 0.12, 2.2, 5);
          geo.translate(-0.4 + i * 0.3, 1.18, -0.4);
          return geo;
        });
        const chim = new THREE.Mesh(chimGeo, this.materials.metal);
        chim.castShadow = true;
        group.add(chim);
      }
    }

    return group;
  }

  // 7. Utility: Wind Turbine
  createWindTurbineMesh(): THREE.Group {
    const group = new THREE.Group();

    // Base support
    const baseGeo = this.getGeometry('turbine_base', () => {
      const geo = new THREE.CylinderGeometry(0.15, 0.25, 0.2, 6);
      geo.translate(0, 0.1, 0);
      return geo;
    });
    const base = new THREE.Mesh(baseGeo, this.materials.dirt);
    group.add(base);

    // Tower pole
    const towerGeo = this.getGeometry('turbine_tower', () => {
      const geo = new THREE.CylinderGeometry(0.06, 0.12, 2.5, 6);
      geo.translate(0, 1.25 + 0.2, 0);
      return geo;
    });
    const tower = new THREE.Mesh(towerGeo, this.materials.whiteMetal);
    tower.castShadow = true;
    group.add(tower);

    // Nacelle (generator head)
    const nacelleGeo = this.getGeometry('turbine_nacelle', () => {
      const geo = new THREE.BoxGeometry(0.2, 0.2, 0.4);
      geo.translate(0, 2.65, 0.05);
      return geo;
    });
    const nacelle = new THREE.Mesh(nacelleGeo, this.materials.whiteMetal);
    nacelle.castShadow = true;
    group.add(nacelle);

    // Rotor Hub
    const hubGeo = this.getGeometry('turbine_hub', () => {
      const geo = new THREE.CylinderGeometry(0.08, 0.08, 0.15, 6);
      geo.rotateX(Math.PI / 2);
      geo.translate(0, 2.65, 0.25);
      return geo;
    });
    const hub = new THREE.Mesh(hubGeo, this.materials.whiteMetal);
    group.add(hub);

    // Blades (Rotor Group to rotate dynamically)
    const rotor = new THREE.Group();
    rotor.name = 'turbine_rotor';
    rotor.position.set(0, 2.65, 0.25);

    // 3 blades spaced 120 degrees apart
    for (let i = 0; i < 3; i++) {
      const bladeGeo = this.getGeometry('turbine_blade', () => {
        const geo = new THREE.BoxGeometry(0.08, 1.0, 0.02);
        geo.translate(0, 0.5, 0); // Origin at tip
        return geo;
      });
      const blade = new THREE.Mesh(bladeGeo, this.materials.whiteMetal);
      
      const bladeRotator = new THREE.Group();
      bladeRotator.rotation.z = (i * Math.PI * 2) / 3;
      bladeRotator.add(blade);
      rotor.add(bladeRotator);
    }
    group.add(rotor);

    return group;
  }

  // 8. Utility: Water Tower
  createWaterTowerMesh(): THREE.Group {
    const group = new THREE.Group();

    // Base support
    const baseGeo = this.getGeometry('water_tower_base', () => {
      const geo = new THREE.BoxGeometry(1.6, 0.08, 1.6);
      geo.translate(0, 0.04, 0);
      return geo;
    });
    const base = new THREE.Mesh(baseGeo, this.materials.dirt);
    group.add(base);

    // Legs (4 posts)
    const legGeo = this.getGeometry('water_tower_leg', () => new THREE.BoxGeometry(0.08, 1.6, 0.08));
    const offset = 0.5;
    const positions = [
      [-offset, -offset],
      [offset, -offset],
      [-offset, offset],
      [offset, offset],
    ];

    for (const [x, z] of positions) {
      const leg = new THREE.Mesh(legGeo, this.materials.metal);
      leg.position.set(x, 0.88, z);
      leg.castShadow = true;
      group.add(leg);
    }

    // Horizontal bracing
    const ringGeo = this.getGeometry('water_tower_ring', () => new THREE.BoxGeometry(1.1, 0.08, 1.1));
    const ring1 = new THREE.Mesh(ringGeo, this.materials.metal);
    ring1.position.set(0, 0.9, 0);
    group.add(ring1);

    const ring2 = new THREE.Mesh(ringGeo, this.materials.metal);
    ring2.position.set(0, 1.5, 0);
    group.add(ring2);

    // Central pipe
    const pipeGeo = this.getGeometry('water_tower_pipe', () => new THREE.CylinderGeometry(0.12, 0.12, 1.7, 5));
    const pipe = new THREE.Mesh(pipeGeo, this.materials.metal);
    pipe.position.set(0, 0.93, 0);
    group.add(pipe);

    // Water Sphere/Tank
    const tankGeo = this.getGeometry('water_tower_tank', () => {
      const geo = new THREE.SphereGeometry(0.65, 8, 8);
      geo.scale(1.0, 0.8, 1.0);
      geo.translate(0, 2.0, 0);
      return geo;
    });
    const tank = new THREE.Mesh(tankGeo, this.materials.waterBlue);
    tank.castShadow = true;
    group.add(tank);

    // Cap on tank
    const capGeo = this.getGeometry('water_tower_cap', () => {
      const geo = new THREE.ConeGeometry(0.4, 0.2, 8);
      geo.translate(0, 2.5, 0);
      return geo;
    });
    const cap = new THREE.Mesh(capGeo, this.materials.whiteMetal);
    group.add(cap);

    return group;
  }

  // 9. Park Mesh
  createParkMesh(): THREE.Group {
    const group = new THREE.Group();

    // Grass patch
    const patchGeo = this.getGeometry('park_patch', () => {
      const geo = new THREE.BoxGeometry(1.8, 0.05, 1.8);
      geo.translate(0, 0.025, 0);
      return geo;
    });
    const patch = new THREE.Mesh(patchGeo, this.materials.grass);
    patch.receiveShadow = true;
    group.add(patch);

    // Tiny gravel path
    const pathGeo = this.getGeometry('park_path', () => {
      const geo = new THREE.BoxGeometry(0.4, 0.06, 1.8);
      geo.translate(0, 0.03, 0);
      return geo;
    });
    const path = new THREE.Mesh(pathGeo, this.materials.dirt);
    group.add(path);

    // Wooden Bench
    const benchGroup = new THREE.Group();
    benchGroup.position.set(0.5, 0.1, 0);

    const seatGeo = this.getGeometry('park_bench_seat', () => new THREE.BoxGeometry(0.18, 0.03, 0.6));
    const seat = new THREE.Mesh(seatGeo, this.materials.trunk);
    benchGroup.add(seat);

    const backGeo = this.getGeometry('park_bench_back', () => {
      const geo = new THREE.BoxGeometry(0.03, 0.15, 0.6);
      geo.translate(-0.09, 0.08, 0);
      return geo;
    });
    const back = new THREE.Mesh(backGeo, this.materials.trunk);
    benchGroup.add(back);

    const legGeo = this.getGeometry('park_bench_leg', () => new THREE.BoxGeometry(0.04, 0.1, 0.04));

    const leg1 = new THREE.Mesh(legGeo, this.materials.metal);
    leg1.position.set(0, -0.05, 0.25);
    benchGroup.add(leg1);

    const leg2 = new THREE.Mesh(legGeo, this.materials.metal);
    leg2.position.set(0, -0.05, -0.25);
    benchGroup.add(leg2);

    group.add(benchGroup);

    // Small customized trees in the park
    for (let i = 0; i < 2; i++) {
      const tree = this.createTreeMesh();
      tree.position.set(-0.5, 0.05, -0.4 + i * 0.8);
      tree.scale.set(0.6, 0.6, 0.6);
      group.add(tree);
    }

    return group;
  }

  // 10. Procedural Low-Poly Car Mesh
  createCarMesh(): THREE.Group {
    const group = new THREE.Group();

    // Select random preset color
    const colors = [
      this.materials.carRed,
      this.materials.carBlue,
      this.materials.carYellow,
      this.materials.carGreen,
      this.materials.carOrange,
      this.materials.carWhite,
    ];
    const bodyMat = colors[Math.floor(Math.random() * colors.length)];

    // Main body box (height=0.16, width=0.36, length=0.68)
    const bodyGeo = this.getGeometry('car_body', () => {
      const geo = new THREE.BoxGeometry(0.36, 0.16, 0.68);
      geo.translate(0, 0.14, 0); // lift off wheels
      return geo;
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    // Cabin glass dome / roof
    const cabGeo = this.getGeometry('car_cabin', () => {
      const geo = new THREE.BoxGeometry(0.3, 0.13, 0.38);
      geo.translate(0, 0.28, -0.05); // slightly backwards
      return geo;
    });
    const cabin = new THREE.Mesh(cabGeo, this.materials.wallCom); // Dark grey cabin
    cabin.castShadow = true;
    group.add(cabin);

    // Front Windshield glass
    const windGeo = this.getGeometry('car_windshield', () => {
      const geo = new THREE.BoxGeometry(0.28, 0.1, 0.02);
      geo.rotateX(-Math.PI / 6); // slanted
      geo.translate(0, 0.26, 0.13);
      return geo;
    });
    const windshield = new THREE.Mesh(windGeo, this.materials.glass);
    group.add(windshield);

    // Wheels (4 cylinders, radius=0.08, width=0.06)
    const wheelGeo = this.getGeometry('car_wheel', () => {
      const geo = new THREE.CylinderGeometry(0.08, 0.08, 0.06, 6);
      geo.rotateZ(Math.PI / 2); // rotate sideways
      return geo;
    });

    const wheelOffsets = [
      [-0.19, 0.08, 0.18],  // Front Left
      [0.19, 0.08, 0.18],   // Front Right
      [-0.19, 0.08, -0.18], // Back Left
      [0.19, 0.08, -0.18],  // Back Right
    ];

    for (const [x, y, z] of wheelOffsets) {
      const wheel = new THREE.Mesh(wheelGeo, this.materials.wheel);
      wheel.position.set(x, y, z);
      wheel.castShadow = true;
      group.add(wheel);
    }

    // Headlights/Taillights geometry
    const lightGeo = this.getGeometry('car_light', () => new THREE.BoxGeometry(0.06, 0.04, 0.02));
    
    const headL = new THREE.Mesh(lightGeo, this.materials.headlight);
    headL.position.set(-0.12, 0.16, 0.341);
    group.add(headL);

    const headR = new THREE.Mesh(lightGeo, this.materials.headlight);
    headR.position.set(0.12, 0.16, 0.341);
    group.add(headR);

    // Tail lights (glowing red dots at the back)
    const tailMat = this.materials.taillight;

    const tailL = new THREE.Mesh(lightGeo, tailMat);
    tailL.position.set(-0.12, 0.16, -0.341);
    group.add(tailL);

    const tailR = new THREE.Mesh(lightGeo, tailMat);
    tailR.position.set(0.12, 0.16, -0.341);
    group.add(tailR);

    // Scale down to fit nicely in lanes
    group.scale.set(0.9, 0.9, 0.9);

    return group;
  }

  // Helper to get seeds/palette/foundation for cottage variations
  getVariationSetup(tileX: number, tileY: number) {
    const rand = this.getSeededRandom(tileX, tileY);
    const paletteIndex = Math.floor(rand() * this.palettes.length);
    const palette = this.palettes[paletteIndex];

    const foundRoll = rand();
    let foundMat = this.materials.dirt;
    if (foundRoll < 0.35) {
      foundMat = this.materials.grass; // grassy green
    } else if (foundRoll < 0.70) {
      foundMat = this.materials.cement; // cement gray
    }

    return { rand, palette, foundMat };
  }
}

// Simple Helper for material animations
function gsapAnimate(material: THREE.MeshStandardMaterial, key: 'emissiveIntensity', targetValue: number, duration: number) {
  let start = material[key];
  let startTime = performance.now();

  function animate() {
    let now = performance.now();
    let elapsed = (now - startTime) / 1000;
    let t = Math.min(1, elapsed / duration);
    // Smooth ease in out
    let ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

    material[key] = start + (targetValue - start) * ease;

    if (t < 1) {
      requestAnimationFrame(animate);
    }
  }
  animate();
}
