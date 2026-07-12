import * as THREE from 'three';

export class AssetGenerator {
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

    // Utilities
    this.materials.whiteMetal = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4, metalness: 0.3 });
    this.materials.cement = new THREE.MeshStandardMaterial({
      color: 0x8e929b, // Cement gray
      roughness: 0.85,
    });
    this.materials.waterBlue = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.2, metalness: 0.8 });

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
  createRoadMesh(connections: { N: boolean; S: boolean; E: boolean; W: boolean }): THREE.Group {
    const group = new THREE.Group();

    // Main road base
    const baseGeo = new THREE.BoxGeometry(2, 0.04, 2);
    const base = new THREE.Mesh(baseGeo, this.materials.road);
    base.receiveShadow = true;
    group.add(base);

    // Add yellow lines based on connectivity
    const { N, S, E, W } = connections;
    const lineMat = this.materials.roadLine;

    // Helper to add line segment
    const addLine = (w: number, h: number, x: number, z: number, rotY = 0) => {
      const lineGeo = new THREE.PlaneGeometry(w, h);
      const line = new THREE.Mesh(lineGeo, lineMat);
      line.rotation.x = -Math.PI / 2;
      line.rotation.z = rotY;
      line.position.set(x, 0.021, z);
      group.add(line);
    };

    const count = [N, S, E, W].filter(Boolean).length;

    if (count === 0 || (N && S && !E && !W)) {
      // Straight North-South
      addLine(0.06, 2, 0, 0);
    } else if (E && W && !N && !S) {
      // Straight East-West
      addLine(0.06, 2, 0, 0, Math.PI / 2);
    } else if (count === 1) {
      // Dead end
      if (N) addLine(0.06, 1, 0, -0.5);
      else if (S) addLine(0.06, 1, 0, 0.5);
      else if (E) addLine(0.06, 1, 0.5, 0, Math.PI / 2);
      else if (W) addLine(0.06, 1, -0.5, 0, Math.PI / 2);
    } else if (count === 2) {
      // Corner turns
      if (N && E) {
        addLine(0.06, 1, 0, -0.5);
        addLine(0.06, 1, 0.5, 0, Math.PI / 2);
      } else if (N && W) {
        addLine(0.06, 1, 0, -0.5);
        addLine(0.06, 1, -0.5, 0, Math.PI / 2);
      } else if (S && E) {
        addLine(0.06, 1, 0, 0.5);
        addLine(0.06, 1, 0.5, 0, Math.PI / 2);
      } else if (S && W) {
        addLine(0.06, 1, 0, 0.5);
        addLine(0.06, 1, -0.5, 0, Math.PI / 2);
      }
    } else if (count >= 3) {
      // Junction/Crossroad (just dot in center or small lines)
      const centerDotGeo = new THREE.BoxGeometry(0.1, 0.005, 0.1);
      const centerDot = new THREE.Mesh(centerDotGeo, lineMat);
      centerDot.position.set(0, 0.021, 0);
      group.add(centerDot);

      if (N) addLine(0.06, 0.5, 0, -0.75);
      if (S) addLine(0.06, 0.5, 0, 0.75);
      if (E) addLine(0.06, 0.5, 0.75, 0, Math.PI / 2);
      if (W) addLine(0.06, 0.5, -0.75, 0, Math.PI / 2);
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
      group.add(line);
      return group;
    }

    // Seed-based random generator
    const rand = this.getSeededRandom(tileX, tileY);
    const paletteIndex = Math.floor(rand() * this.palettes.length);
    const palette = this.palettes[paletteIndex];

    const foundHeight = 0.04;
    const addFoundationAndStep = (fw: number, fd: number, doorXCoord: number | null, fx = 0, fz = 0) => {
      const foundGeo = this.getGeometry(`res_geom_58_box_${fw}_${foundHeight}_${fd}`, () => new THREE.BoxGeometry(fw + 0.05, foundHeight, fd + 0.05));
      foundGeo.translate(0, foundHeight / 2, 0);
      const found = new THREE.Mesh(foundGeo, palette.brick);
      found.position.set(fx, 0.06, fz);
      found.castShadow = true;
      found.receiveShadow = true;
      group.add(found);

      if (doorXCoord !== null) {
        const stepGeo = this.getGeometry(`res_geom_57_box_${foundHeight}`, () => new THREE.BoxGeometry(0.3, foundHeight / 2, 0.15));
        stepGeo.translate(0, foundHeight / 4, 0);
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

      const wallFGeo = this.getGeometry(`res_geom_52_extrude_${shape}_${t}`, () => new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: false }));
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

      const wallBGeo = this.getGeometry(`res_geom_51_extrude_${backShape}_${t}`, () => new THREE.ExtrudeGeometry(backShape, { depth: t, bevelEnabled: false }));
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

      const wallLGeo = this.getGeometry(`res_geom_50_extrude_${sideShape}_${t}`, () => new THREE.ExtrudeGeometry(sideShape, { depth: t, bevelEnabled: false }));
      
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
        const ridgeCapGeo = this.getGeometry(`res_geom_47_cylinder_${slabW}`, () => new THREE.CylinderGeometry(0.045, 0.045, slabW + 0.02, 8));
        ridgeCapGeo.rotateZ(Math.PI / 2); // align with X axis
        const ridgeCap = new THREE.Mesh(ridgeCapGeo, palette.roof);
        ridgeCap.position.set(0, h + 0.1 + 0.38 + 0.01, 0);
        ridgeCap.castShadow = true;
        group.add(ridgeCap);
      } else {
        // Pyramid Hip Roof
        const roofGeo = this.getGeometry('res_geom_46_cone_0_72_0_35_4', () => new THREE.ConeGeometry(0.72, 0.35, 4));
        roofGeo.rotateY(Math.PI / 4);
        roofGeo.scale(1.15, 1.0, 1.15);
        roofGeo.translate(0, h + 0.175 + 0.1, 0);
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

      const doorFrameGeo = this.getGeometry(`res_geom_43_extrude_${doorFrameShape}_${t}`, () => new THREE.ExtrudeGeometry(doorFrameShape, { depth: t, bevelEnabled: false }));
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

      const frameGeo = this.getGeometry(`res_geom_41_extrude_${frameShape}_${t}`, () => new THREE.ExtrudeGeometry(frameShape, { depth: t, bevelEnabled: false }));
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

      const wallFGeo = this.getGeometry(`res_geom_36_extrude_${shape}_${t}`, () => new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: false }));
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

      const wallBGeo = this.getGeometry(`res_geom_35_extrude_${backShape}_${t}`, () => new THREE.ExtrudeGeometry(backShape, { depth: t, bevelEnabled: false }));
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

      const wallLGeo = this.getGeometry(`res_geom_34_extrude_${sideShape}_${t}`, () => new THREE.ExtrudeGeometry(sideShape, { depth: t, bevelEnabled: false }));
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
      const ridgeCapGeo = this.getGeometry(`res_geom_31_cylinder_${slabW}`, () => new THREE.CylinderGeometry(0.045, 0.045, slabW + 0.02, 8));
      ridgeCapGeo.rotateZ(Math.PI / 2);
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

      const doorFrameGeo = this.getGeometry(`res_geom_28_extrude_${doorFrameShape}_${t}`, () => new THREE.ExtrudeGeometry(doorFrameShape, { depth: t, bevelEnabled: false }));
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

      const frameGeo = this.getGeometry(`res_geom_26_extrude_${frameShape}_${t}`, () => new THREE.ExtrudeGeometry(frameShape, { depth: t, bevelEnabled: false }));
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
        const logGeo = this.getGeometry('res_geom_14_cylinder_0_03_0_03_0_22_5', () => new THREE.CylinderGeometry(0.03, 0.03, 0.22, 5));
        logGeo.rotateX(Math.PI / 2);

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
        
        const brick1 = new THREE.Mesh(this.getGeometry('res_geom_13_box_wt1_ht1_dt1', () => new THREE.BoxGeometry(wt1, ht1, dt1)), palette.brick);
        brick1.position.y = ht1 / 2 + 0.1;
        brick1.castShadow = true;
        brick1.receiveShadow = true;
        tower1.add(brick1);

        // Roof trim
        const rt1 = new THREE.Mesh(this.getGeometry('res_geom_12_box_wt1_0_06_0_1_dt1_0_06', () => new THREE.BoxGeometry(wt1 + 0.06, 0.1, dt1 + 0.06)), palette.roof);
        rt1.position.y = ht1 + 0.15;
        tower1.add(rt1);

        this.addWindows(tower1, { w: wt1 - 0.1, h: ht1 - 0.2, d: dt1 - 0.1 }, 3, 2, 0.1);
        tower1.position.set(-0.3, 0, 0);
        group.add(tower1);

        // Stepped shorter wing block (2 stories)
        const wt2 = 0.6, ht2 = 1.6, dt2 = 1.1;
        const tower2 = new THREE.Group();

        const wall2 = new THREE.Mesh(this.getGeometry('res_geom_11_box_wt2_ht2_dt2', () => new THREE.BoxGeometry(wt2, ht2, dt2)), palette.wall);
        wall2.position.y = ht2 / 2 + 0.1;
        wall2.castShadow = true;
        wall2.receiveShadow = true;
        tower2.add(wall2);

        const rt2 = new THREE.Mesh(this.getGeometry('res_geom_10_box_wt2_0_06_0_1_dt2_0_06', () => new THREE.BoxGeometry(wt2 + 0.06, 0.1, dt2 + 0.06)), palette.roof);
        rt2.position.y = ht2 + 0.15;
        tower2.add(rt2);

        this.addWindows(tower2, { w: wt2 - 0.08, h: ht2 - 0.2, d: dt2 - 0.08 }, 2, 1, 0.1);
        tower2.position.set(0.4, 0, -0.05);
        group.add(tower2);

      } else {
        // BALCONY-FOCUS APARTMENT
        addFoundationAndStep(w, d, 0);

        const wall = new THREE.Mesh(this.getGeometry('res_geom_9_box_w_h_d', () => new THREE.BoxGeometry(w, h, d)), palette.wall);
        wall.position.set(0, h / 2 + 0.1, 0);
        wall.castShadow = true;
        wall.receiveShadow = true;
        group.add(wall);

        // Roof cornice
        const cornice = new THREE.Mesh(this.getGeometry('res_geom_8_box_w_0_08_0_12_d_0_08', () => new THREE.BoxGeometry(w + 0.08, 0.12, d + 0.08)), palette.roof);
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
  createCommercialMesh(level: number): THREE.Group {
    const group = new THREE.Group();

    if (level === 0) {
      const lineGeo = this.getGeometry('com_level0_line', () => new THREE.BoxGeometry(1.9, 0.05, 1.9));
      const line = new THREE.Mesh(lineGeo, this.materials.zoneC);
      group.add(line);
      return group;
    }

    // Foundation
    const foundGeo = this.getGeometry('com_foundation', () => {
      const geo = new THREE.BoxGeometry(1.7, 0.08, 1.7);
      geo.translate(0, 0.04, 0);
      return geo;
    });
    const found = new THREE.Mesh(foundGeo, this.materials.dirt);
    group.add(found);

    if (level === 1) {
      // Level 1: Shop with glass storefront
      const w = 1.3, h = 0.9, d = 1.3;
      const wallGeo = this.getGeometry('com_level1_wall', () => {
        const geo = new THREE.BoxGeometry(w, h, d);
        geo.translate(0, h / 2 + 0.08, 0);
        return geo;
      });
      const wall = new THREE.Mesh(wallGeo, this.materials.wallCom);
      wall.castShadow = true;
      group.add(wall);

      // Storefront glass window
      const glassGeo = this.getGeometry('com_level1_glass', () => new THREE.BoxGeometry(0.9, 0.5, 0.1));
      const glass = new THREE.Mesh(glassGeo, this.materials.glass);
      glass.position.set(0, 0.38, d / 2 + 0.02);
      group.add(glass);

      // Sign board on top
      const signGeo = this.getGeometry('com_level1_sign', () => new THREE.BoxGeometry(0.8, 0.2, 0.15));
      const sign = new THREE.Mesh(signGeo, this.materials.whiteMetal);
      sign.position.set(0, h + 0.1, d / 2 - 0.1);
      group.add(sign);

    } else if (level === 2) {
      // Level 2: Two-story mall/office block
      const w = 1.4, h = 1.6, d = 1.4;
      const wallGeo = this.getGeometry('com_level2_wall', () => {
        const geo = new THREE.BoxGeometry(w, h, d);
        geo.translate(0, h / 2 + 0.08, 0);
        return geo;
      });
      const wall = new THREE.Mesh(wallGeo, this.materials.wallCom);
      wall.castShadow = true;
      group.add(wall);

      // Glass corners
      const glassCornerGeo = this.getGeometry('com_level2_glass_corner', () => new THREE.BoxGeometry(0.4, h - 0.2, 0.4));
      const gc = new THREE.Mesh(glassCornerGeo, this.materials.glass);
      gc.position.set(w / 2 - 0.2, h / 2 + 0.08, d / 2 - 0.2);
      group.add(gc);

      this.addWindows(group, { w, h, d }, 2, 2, 0.08);

    } else if (level >= 3) {
      // Level 3: Modern corporate skyscraper
      const w = 1.5, h = 3.6, d = 1.5;
      const wallGeo = this.getGeometry('com_level3_wall', () => {
        const geo = new THREE.BoxGeometry(w, h, d);
        geo.translate(0, h / 2 + 0.08, 0);
        return geo;
      });
      const wall = new THREE.Mesh(wallGeo, this.materials.wallCom);
      wall.castShadow = true;
      group.add(wall);

      // Huge vertical glass strip in front
      const stripGeo = this.getGeometry('com_level3_strip', () => new THREE.BoxGeometry(0.4, h - 0.4, 0.1));
      const strip = new THREE.Mesh(stripGeo, this.materials.glass);
      strip.position.set(0, h / 2 + 0.08, d / 2 + 0.01);
      group.add(strip);

      this.addWindows(group, { w, h, d }, 4, 3, 0.08);
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
      windGeo.rotateX(-Math.PI / 6); // slanted
      windGeo.translate(0, 0.26, 0.13);
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
