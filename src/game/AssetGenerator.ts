import * as THREE from 'three';

export class AssetGenerator {
  // Shared materials for performance
  materials: { [key: string]: THREE.Material } = {};
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
    const geo = new THREE.BoxGeometry(2, 0.4, 2);
    // Align top of box to y=0
    geo.translate(0, -0.2, 0);
    return geo;
  }

  // 2. Tree Mesh Generator
  createTreeMesh(): THREE.Group {
    const group = new THREE.Group();

    // Trunk
    const trunkGeo = new THREE.CylinderGeometry(0.1, 0.15, 0.6, 5);
    trunkGeo.translate(0, 0.3, 0);
    const trunk = new THREE.Mesh(trunkGeo, this.materials.trunk);
    trunk.castShadow = true;
    group.add(trunk);

    // Leaves (layered cones)
    const leafMaterial = Math.random() > 0.8 ? this.materials.blossom : this.materials.leaves;
    const leafBase = Math.random() > 0.5 ? 0.35 : 0.45;

    for (let i = 0; i < 3; i++) {
      const coneGeo = new THREE.ConeGeometry(leafBase - i * 0.08, 0.6, 5);
      coneGeo.translate(0, 0.7 + i * 0.4, 0);
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
    const winGeo = new THREE.BoxGeometry(0.12, 0.18, 0.03);
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
      const lineGeo = new THREE.BoxGeometry(1.9, 0.05, 1.9);
      const line = new THREE.Mesh(lineGeo, this.materials.zoneR);
      group.add(line);
      return group;
    }

    // Seed-based random generator
    const rand = this.getSeededRandom(tileX, tileY);
    const paletteIndex = Math.floor(rand() * this.palettes.length);
    const palette = this.palettes[paletteIndex];

    // Foundation material selection roll
    const foundRoll = rand();
    let foundMat = this.materials.dirt;
    if (foundRoll < 0.35) {
      foundMat = this.materials.grass; // grassy green
    } else if (foundRoll < 0.70) {
      foundMat = this.materials.cement; // cement gray
    }

    // Common Base offset for low poly building
    const addFoundation = () => {
      const foundGeo = new THREE.BoxGeometry(1.6, 0.1, 1.6);
      foundGeo.translate(0, 0.05, 0);
      const found = new THREE.Mesh(foundGeo, foundMat);
      found.receiveShadow = true;
      group.add(found);
    };

    addFoundation();

    // Helper for grid-aligned picket fences (sturdier, better proportioned)
    const addFenceX = (z: number, xStart: number, xEnd: number, count: number) => {
      const step = (xEnd - xStart) / (count - 1);
      for (let i = 0; i < count; i++) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.24, 0.04), this.materials.whiteMetal);
        post.position.set(xStart + step * i, 0.1 + 0.12, z);
        post.castShadow = true;
        group.add(post);
      }
      const rail = new THREE.Mesh(new THREE.BoxGeometry(Math.abs(xEnd - xStart) + 0.04, 0.03, 0.016), this.materials.whiteMetal);
      rail.position.set((xStart + xEnd) / 2, 0.1 + 0.17, z);
      group.add(rail);
    };

    const addFenceZ = (x: number, zStart: number, zEnd: number, count: number) => {
      const step = (zEnd - zStart) / (count - 1);
      for (let i = 0; i < count; i++) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.24, 0.04), this.materials.whiteMetal);
        post.position.set(x, 0.1 + 0.12, zStart + step * i);
        post.castShadow = true;
        group.add(post);
      }
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.03, Math.abs(zEnd - zStart) + 0.04), this.materials.whiteMetal);
      rail.position.set(x, 0.1 + 0.17, (zStart + zEnd) / 2);
      group.add(rail);
    };

    // Helper to add strings of glowing fairy lights
    const addFairyLights = (points: THREE.Vector3[]) => {
      for (const pt of points) {
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.025, 4, 4), this.materials.fairyLight);
        bulb.position.copy(pt);
        group.add(bulb);
      }
    };

    let style = 0;

    if (level === 1) {
      // Level 1: Cozy small cottage (Well proportioned: w=1.0, h=0.45, d=0.9)
      const w = 1.0, h = 0.45, d = 0.9;
      
      // Mostly open gable roof (65%), some pyramid hip roof (35%)
      const isGable = rand() > 0.35;

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

      const wallFGeo = new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: false });
      const wallF = new THREE.Mesh(wallFGeo, palette.wall);
      wallF.position.set(0, 0.1, d / 2 - t);
      wallF.castShadow = true;
      wallF.receiveShadow = true;
      group.add(wallF);

      // Back Wall with Shape Extrusion (no cutouts, flat top)
      const backShape = new THREE.Shape();
      backShape.moveTo(-w / 2, 0);
      backShape.lineTo(w / 2, 0);
      backShape.lineTo(w / 2, h);
      backShape.lineTo(-w / 2, h);
      backShape.closePath();

      const wallBGeo = new THREE.ExtrudeGeometry(backShape, { depth: t, bevelEnabled: false });
      const wallB = new THREE.Mesh(wallBGeo, palette.wall);
      wallB.position.set(0, 0.1, -d / 2);
      wallB.castShadow = true;
      wallB.receiveShadow = true;
      group.add(wallB);

      // Left and Right Gable Side Walls (Pentagonal if isGable)
      const sideShape = new THREE.Shape();
      sideShape.moveTo(-d / 2 + t, 0);
      sideShape.lineTo(d / 2 - t, 0);
      sideShape.lineTo(d / 2 - t, h);
      if (isGable) {
        sideShape.lineTo(0, h + 0.38); // Side wall gable peak
      }
      sideShape.lineTo(-d / 2 + t, h);
      sideShape.closePath();

      const wallLGeo = new THREE.ExtrudeGeometry(sideShape, { depth: t, bevelEnabled: false });
      
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
        // Open Gable Roof built from two sloped slabs of a certain thickness
        const slabL = 0.72; // slope length along Z (front-to-back)
        const slabT = 0.045; // thickness of the roof board
        const slabW = w + 0.12; // width along X (overhang left and right)
        const angle = Math.atan2(0.38, 0.5);

        // Front slab (slopes towards door)
        const frontSlab = new THREE.Mesh(new THREE.BoxGeometry(slabW, slabT, slabL), palette.roof);
        frontSlab.rotation.x = angle;
        frontSlab.position.set(0, h + 0.1 + 0.20, 0.24);
        frontSlab.castShadow = true;
        group.add(frontSlab);

        // Back slab
        const backSlab = new THREE.Mesh(new THREE.BoxGeometry(slabW, slabT, slabL), palette.roof);
        backSlab.rotation.x = -angle;
        backSlab.position.set(0, h + 0.1 + 0.20, -0.24);
        backSlab.castShadow = true;
        group.add(backSlab);

        // Tiny ridge cap box to cover the peak seam along X (left-to-right)
        const ridge = new THREE.Mesh(new THREE.BoxGeometry(slabW + 0.01, 0.04, 0.04), palette.roof);
        ridge.position.set(0, h + 0.1 + 0.38 + 0.01, 0);
        group.add(ridge);
      } else {
        // Pyramid Hip Roof
        const roofGeo = new THREE.ConeGeometry(0.72, 0.35, 4);
        roofGeo.rotateY(Math.PI / 4);
        roofGeo.scale(1.15, 1.0, 1.15);
        roofGeo.translate(0, h + 0.175 + 0.1, 0);
        const roof = new THREE.Mesh(roofGeo, palette.roof);
        roof.castShadow = true;
        group.add(roof);
      }

      // Brick Chimney
      const chimX = isLeft ? -0.28 : 0.28;
      const chimGeo = new THREE.BoxGeometry(0.1, 0.35, 0.1);
      const chimney = new THREE.Mesh(chimGeo, palette.brick);
      chimney.position.set(chimX, h + 0.175, -0.2);
      chimney.castShadow = true;
      group.add(chimney);

      const chimCap = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.03, 0.14), this.materials.road);
      chimCap.position.set(chimX, h + 0.35, -0.2);
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

      const doorFrameGeo = new THREE.ExtrudeGeometry(doorFrameShape, { depth: t, bevelEnabled: false });
      const doorFrame = new THREE.Mesh(doorFrameGeo, palette.trim); // door frame matches trim color
      doorFrame.position.set(doorX, 0.1, d / 2 - t);
      doorFrame.castShadow = true;
      group.add(doorFrame);

      const doorGeo = new THREE.BoxGeometry(doorInnerW, doorInnerH, 0.02);
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

      const frameGeo = new THREE.ExtrudeGeometry(frameShape, { depth: t, bevelEnabled: false });
      const frameMat = palette.trim; // matching trim color for realistic framing
      const glassGeo = new THREE.BoxGeometry(winInnerW, winInnerH, 0.015);
      const glassMat = this.materials.window;

      const addFramedWindow = (x: number) => {
        // Frame sits snugly inside the wall cutout opening (flush with front and back face)
        const frame = new THREE.Mesh(frameGeo, frameMat);
        frame.position.set(x, yWin, d / 2 - t); // spans from d/2-t to d/2
        frame.castShadow = true;
        group.add(frame);

        // Recessed Glass sits physically inside the frame opening channels
        const glass = new THREE.Mesh(glassGeo, glassMat);
        glass.position.set(x, yWin, d / 2 - t / 2); // centered at d/2 - 0.02
        group.add(glass);
      };

      if (hasWinL) {
        addFramedWindow(-0.25);
      }

      if (hasWinR) {
        addFramedWindow(0.25);
      }

      // Stepping stones walkway aligned to door
      for (let i = 0; i < 3; i++) {
        const stone = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.015, 0.15), this.materials.whiteMetal);
        stone.rotation.y = rand() * 0.5;
        stone.position.set(doorX + (rand() - 0.5) * 0.06, 0.108, d / 2 + 0.15 + i * 0.15);
        stone.receiveShadow = true;
        group.add(stone);
      }

      // Shrub
      const shrub = new THREE.Mesh(new THREE.SphereGeometry(0.12, 5, 5), this.materials.leaves);
      shrub.position.set(-0.5, 0.16, 0.4);
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
      // Level 2: High-fidelity procedural cozy house variations
      style = Math.floor(rand() * 3);

      if (style === 0) {
        // STYLE 0: L-SHAPE FARMHOUSE (w1=0.95, h1=1.25, d1=0.75)
        const mainBlock = new THREE.Group();
        const w1 = 0.95, h1 = 1.25, d1 = 0.75;

        // Foundation / Split wall lower
        const hBrick1 = 0.25;
        const wallBrickGeo1 = new THREE.BoxGeometry(w1, hBrick1, d1);
        wallBrickGeo1.translate(0, hBrick1 / 2 + 0.1, 0);
        const wallBrick1 = new THREE.Mesh(wallBrickGeo1, palette.brick);
        wallBrick1.castShadow = true;
        wallBrick1.receiveShadow = true;
        mainBlock.add(wallBrick1);

        // Wall upper split
        const hCream1 = 1.0;
        const wallCreamGeo1 = new THREE.BoxGeometry(w1, hCream1, d1);
        wallCreamGeo1.translate(0, hCream1 / 2 + 0.1 + hBrick1, 0);
        const wallCream1 = new THREE.Mesh(wallCreamGeo1, palette.wall);
        wallCream1.castShadow = true;
        wallCream1.receiveShadow = true;
        mainBlock.add(wallCream1);

        // Main roof (Gable)
        const roofGeo1 = new THREE.ConeGeometry(0.7, 0.55, 4);
        roofGeo1.rotateY(Math.PI / 4);
        roofGeo1.translate(0, h1 + 0.275 + 0.1, 0);
        const roof1 = new THREE.Mesh(roofGeo1, palette.roof);
        roof1.scale.set(1.22, 1.0, 1.02);
        roof1.castShadow = true;
        mainBlock.add(roof1);

        // Chimney
        const chimGeo = new THREE.BoxGeometry(0.14, 0.55, 0.14);
        const chimney = new THREE.Mesh(chimGeo, palette.brick);
        chimney.position.set(-0.25, h1 + 0.15, -0.15);
        chimney.castShadow = true;
        mainBlock.add(chimney);

        const chimCap = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.04, 0.18), this.materials.road);
        chimCap.position.set(-0.25, h1 + 0.41, -0.15);
        mainBlock.add(chimCap);

        // Side Wing (Perpendicular L-extension)
        const w2 = 0.65, h2 = 0.85, d2 = 0.65;
        const hBrick2 = 0.2;
        const wallBrick2 = new THREE.Mesh(new THREE.BoxGeometry(w2, hBrick2, d2), palette.brick);
        wallBrick2.position.set(0.35, hBrick2 / 2 + 0.1, 0.2);
        wallBrick2.castShadow = true;
        mainBlock.add(wallBrick2);

        const wallCream2 = new THREE.Mesh(new THREE.BoxGeometry(w2, h2 - hBrick2, d2), palette.wall);
        wallCream2.position.set(0.35, (h2 - hBrick2) / 2 + 0.1 + hBrick2, 0.2);
        wallCream2.castShadow = true;
        mainBlock.add(wallCream2);

        // Wing Roof
        const roofGeo2 = new THREE.ConeGeometry(0.48, 0.4, 4);
        roofGeo2.rotateY(Math.PI / 4);
        roofGeo2.scale(1.1, 1.0, 1.1);
        const roof2 = new THREE.Mesh(roofGeo2, palette.roof);
        roof2.position.set(0.35, h2 + 0.2 + 0.1, 0.2);
        roof2.castShadow = true;
        mainBlock.add(roof2);

        // Front porch awning & deck in the corner
        const porchDeck = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.03, 0.22), this.materials.trunk);
        porchDeck.position.set(-0.15, 0.115, d1 / 2 + 0.11);
        porchDeck.receiveShadow = true;
        mainBlock.add(porchDeck);

        // Two columns to support the awning
        const col1 = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.46, 4), this.materials.whiteMetal);
        col1.position.set(-0.35, 0.36, d1 / 2 + 0.19);
        col1.castShadow = true;
        mainBlock.add(col1);

        const col2 = col1.clone();
        col2.position.x = 0.05;
        mainBlock.add(col2);

        const porchRoof = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.03, 0.26), palette.roof);
        porchRoof.rotation.x = 0.15;
        porchRoof.position.set(-0.15, 0.58, d1 / 2 + 0.13);
        porchRoof.castShadow = true;
        mainBlock.add(porchRoof);

        // Porch light bulb
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.024, 4, 4), this.materials.window);
        bulb.position.set(-0.1, 0.52, d1 / 2 + 0.12);
        mainBlock.add(bulb);

        // Add door
        const door = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.45, 0.04), this.materials.trunk);
        door.position.set(-0.15, 0.325, d1 / 2 + 0.01);
        mainBlock.add(door);

        // Custom front windows to prevent door clipping, standard windows elsewhere
        this.addWindows(mainBlock, { w: w1, h: h1, d: d1 }, 2, 2, 0.1, true);
        this.addWindows(mainBlock, { w: w2 - 0.1, h: h2 - 0.1, d: d2 - 0.1 }, 1, 1, 0.1);

        const winGeo = new THREE.BoxGeometry(0.12, 0.18, 0.03);
        const winMat = this.materials.window;
        
        // Front top windows (2)
        const winTopL = new THREE.Mesh(winGeo, winMat);
        winTopL.position.set(-0.18, 0.9 + 0.1, d1 / 2 + 0.015);
        mainBlock.add(winTopL);

        const winTopR = new THREE.Mesh(winGeo, winMat);
        winTopR.position.set(0.18, 0.9 + 0.1, d1 / 2 + 0.015);
        mainBlock.add(winTopR);

        // Front bottom right window (1)
        const winBotR = new THREE.Mesh(winGeo, winMat);
        winBotR.position.set(0.18, 0.45 + 0.1, d1 / 2 + 0.015);
        mainBlock.add(winBotR);

        // Flower box under the bottom window
        const fBox = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.04, 0.08), this.materials.trunk);
        fBox.position.set(0.18, 0.43, d1 / 2 + 0.04);
        fBox.castShadow = true;
        mainBlock.add(fBox);
        const fLeaves = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.04, 0.06), this.materials.leaves);
        fLeaves.position.set(0.18, 0.46, d1 / 2 + 0.04);
        mainBlock.add(fLeaves);

        mainBlock.position.set(-0.15, 0, 0.0);
        group.add(mainBlock);

        // Siding Accents
        for (let i = 0; i < 6; i++) {
          const trim = new THREE.Mesh(new THREE.BoxGeometry(w1 + 0.02, 0.015, 0.015), palette.trim);
          trim.position.set(-0.15, 0.35 + i * 0.15, 0);
          group.add(trim);
        }

        // Picket fence
        addFenceX(0.76, -0.75, -0.3, 3);
        addFenceZ(-0.76, -0.75, 0.75, 5);

        // Fairy lights under porch awning
        addFairyLights([
          new THREE.Vector3(-0.4, 0.56, d1 / 2 + 0.13),
          new THREE.Vector3(-0.25, 0.56, d1 / 2 + 0.13),
          new THREE.Vector3(-0.1, 0.56, d1 / 2 + 0.13),
          new THREE.Vector3(0.05, 0.56, d1 / 2 + 0.13)
        ]);

        // Backyard Doghouse
        const doghouse = new THREE.Group();
        doghouse.position.set(0.4, 0.1, -0.45);
        const dhWalls = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.15, 0.18), palette.brick);
        dhWalls.position.y = 0.075;
        doghouse.add(dhWalls);
        const dhRoof = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.1, 4), palette.roof);
        dhRoof.rotateY(Math.PI / 4);
        dhRoof.position.y = 0.2;
        doghouse.add(dhRoof);
        group.add(doghouse);

        // Backyard Tree
        const yardTree = this.createTreeMesh();
        yardTree.position.set(-0.55, 0.1, -0.45);
        yardTree.scale.set(0.55, 0.55, 0.55);
        group.add(yardTree);

      } else if (style === 1) {
        // STYLE 1: DORMER COTTAGE (Tall cozy cottage: w=1.05, h=1.15, d=0.95)
        const w = 1.05, h = 1.15, d = 0.95;
        
        // Foundation & Walls
        const hBrick = 0.25;
        const wallBrick = new THREE.Mesh(new THREE.BoxGeometry(w, hBrick, d), palette.brick);
        wallBrick.position.set(0, hBrick / 2 + 0.1, 0);
        wallBrick.castShadow = true;
        wallBrick.receiveShadow = true;
        group.add(wallBrick);

        const wallCream = new THREE.Mesh(new THREE.BoxGeometry(w, h - hBrick, d), palette.wall);
        wallCream.position.set(0, (h - hBrick) / 2 + 0.1 + hBrick, 0);
        wallCream.castShadow = true;
        wallCream.receiveShadow = true;
        group.add(wallCream);

        // Hipped roof
        const roofGeo = new THREE.ConeGeometry(0.72, 0.55, 4);
        roofGeo.rotateY(Math.PI / 4);
        roofGeo.scale(1.22, 1.0, 1.12);
        roofGeo.translate(0, h + 0.275 + 0.1, 0);
        const roof = new THREE.Mesh(roofGeo, palette.roof);
        roof.castShadow = true;
        group.add(roof);

        // Dormer windows on front roof
        const dormer = new THREE.Group();
        dormer.position.set(-0.22, h + 0.15, d / 2 - 0.18);
        const dWall = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.18), palette.wall);
        dWall.castShadow = true;
        dormer.add(dWall);
        const dRoof = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.1, 4), palette.roof);
        dRoof.rotateY(Math.PI / 4);
        dRoof.position.y = 0.14;
        dormer.add(dRoof);
        const dWin = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.09, 0.01), this.materials.window);
        dWin.position.set(0, 0, 0.091);
        dormer.add(dWin);
        group.add(dormer);

        const dormer2 = dormer.clone();
        dormer2.position.x = 0.22;
        group.add(dormer2);

        // Add standard windows on sides and back, custom on front with shutters
        this.addWindows(group, { w, h, d }, 1, 2, 0.1, true);

        const winGeo = new THREE.BoxGeometry(0.12, 0.18, 0.03);
        const winMat = this.materials.window;
        const yWin = 0.45 + 0.1;

        // Front window Left
        const winFL = new THREE.Mesh(winGeo, winMat);
        winFL.position.set(-0.167, yWin, d / 2 + 0.015);
        group.add(winFL);

        // Front window Right
        const winFR = new THREE.Mesh(winGeo, winMat);
        winFR.position.set(0.167, yWin, d / 2 + 0.015);
        group.add(winFR);

        // Add decorative shutters on the front windows
        const shutterGeo = new THREE.BoxGeometry(0.04, 0.18, 0.015);
        const addShuttersOnly = (x: number) => {
          const shutL = new THREE.Mesh(shutterGeo, palette.trim);
          shutL.position.set(x - 0.08, yWin, d / 2 + 0.02);
          group.add(shutL);

          const shutR = new THREE.Mesh(shutterGeo, palette.trim);
          shutR.position.set(x + 0.08, yWin, d / 2 + 0.02);
          group.add(shutR);
        };
        addShuttersOnly(-0.167);
        addShuttersOnly(0.167);

        // Door
        const door = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.45, 0.03), this.materials.trunk);
        door.position.set(0, 0.325, d / 2 + 0.01);
        group.add(door);

        // Small door awning (corrected coordinates!)
        const doorRoof = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.03, 0.18), palette.roof);
        doorRoof.rotation.x = 0.15;
        doorRoof.position.set(0, 0.58, d / 2 + 0.09);
        doorRoof.castShadow = true;
        group.add(doorRoof);

        // Chimney
        const chimGeo = new THREE.BoxGeometry(0.14, 0.6, 0.14);
        const chimney = new THREE.Mesh(chimGeo, palette.brick);
        chimney.position.set(0.35, h + 0.25, -0.25);
        chimney.castShadow = true;
        group.add(chimney);

        const chimCap = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.04, 0.18), this.materials.road);
        chimCap.position.set(0.35, h + 0.55, -0.25);
        group.add(chimCap);

        // Backyard Water Well
        const well = new THREE.Group();
        well.position.set(-0.4, 0.1, -0.4);
        const wBase = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.12, 6), palette.brick);
        wBase.position.y = 0.06;
        wBase.castShadow = true;
        well.add(wBase);

        const p1 = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.25, 0.015), this.materials.trunk);
        p1.position.set(-0.09, 0.15, 0);
        well.add(p1);
        const p2 = p1.clone();
        p2.position.x = 0.09;
        well.add(p2);

        const wRoof = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.02, 0.18), palette.roof);
        wRoof.position.set(0, 0.27, 0);
        well.add(wRoof);
        group.add(well);

        // Flowerbed / Planter
        const flowerbed = new THREE.Group();
        flowerbed.position.set(0.45, 0.1, 0.45);
        const bedBase = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.06, 0.25), this.materials.trunk);
        bedBase.position.y = 0.03;
        flowerbed.add(bedBase);
        const bedSoil = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.06, 0.22), this.materials.dirt);
        bedSoil.position.y = 0.04;
        flowerbed.add(bedSoil);
        
        const flowerColors = [this.materials.blossom, this.materials.leaves];
        for (let i = 0; i < 3; i++) {
          const f = new THREE.Mesh(new THREE.SphereGeometry(0.04, 4, 4), flowerColors[i % 2]);
          f.position.set(-0.06 + i * 0.06, 0.08, -0.04 + (i%2)*0.08);
          flowerbed.add(f);
        }
        group.add(flowerbed);

        // Backyard tree
        const yardTree = this.createTreeMesh();
        yardTree.position.set(0.55, 0.1, -0.45);
        yardTree.scale.set(0.5, 0.5, 0.5);
        group.add(yardTree);

        // Fences
        addFenceX(-0.76, -0.75, 0.75, 5);
        addFenceX(0.76, 0.35, 0.75, 3);
        addFenceX(0.76, -0.75, -0.35, 3);

        // Fairy lights under front roof eaves
        addFairyLights([
          new THREE.Vector3(-0.5, h + 0.12, d / 2 - 0.05),
          new THREE.Vector3(-0.25, h + 0.16, d / 2 - 0.05),
          new THREE.Vector3(0.0, h + 0.18, d / 2 - 0.05),
          new THREE.Vector3(0.25, h + 0.16, d / 2 - 0.05),
          new THREE.Vector3(0.5, h + 0.12, d / 2 - 0.05)
        ]);

      } else {
        // STYLE 2: ALPINE A-FRAME CHALET
        const w = 1.1, h = 0.4, d = 1.1;
        
        // Low base walls
        const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), palette.brick);
        wall.position.set(0, h / 2 + 0.1, 0);
        wall.castShadow = true;
        wall.receiveShadow = true;
        group.add(wall);

        // Giant steep A-frame roof (represented by scaled triangular prism/cone)
        const roofGeo = new THREE.ConeGeometry(0.85, 1.25, 4);
        roofGeo.rotateY(Math.PI / 4);
        roofGeo.scale(1.15, 1.0, 1.25);
        roofGeo.translate(0, h + 0.625 + 0.05, 0);
        const roof = new THREE.Mesh(roofGeo, palette.roof);
        roof.castShadow = true;
        group.add(roof);

        // Balcony deck in front (at height 0.42)
        const bal = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.03, 0.2), this.materials.trunk);
        bal.position.set(0, 0.42, d / 2 + 0.08);
        bal.castShadow = true;
        group.add(bal);

        // Balcony railing posts
        for (let i = 0; i < 4; i++) {
          const post = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.14, 0.015), palette.trim);
          post.position.set(-0.3 + i * 0.2, 0.49, d / 2 + 0.17);
          group.add(post);
        }
        const topRail = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.015, 0.015), palette.trim);
        topRail.position.set(0, 0.56, d / 2 + 0.17);
        group.add(topRail);

        // Door
        const door = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.4, 0.03), this.materials.trunk);
        door.position.set(0, 0.26, d / 2 + 0.01);
        group.add(door);

        // Upper window (above balcony - placed on the sloped gable face)
        const uWin = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.02), this.materials.window);
        uWin.position.set(0, 0.68, d / 2 - 0.03);
        group.add(uWin);

        // Stone Chimney running up the left wall
        const stoneChim = new THREE.Group();
        stoneChim.position.set(-0.35, 0, 0.1);
        const baseChim = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.4, 0.15), palette.brick);
        baseChim.position.y = 0.7;
        baseChim.castShadow = true;
        stoneChim.add(baseChim);
        const scCap = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.04, 0.2), this.materials.road);
        scCap.position.y = 1.42;
        stoneChim.add(scCap);
        group.add(stoneChim);

        // Backyard Firewood stack (sturdier logs)
        const woodpile = new THREE.Group();
        woodpile.position.set(0.4, 0.1, -0.4);
        const logGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.22, 5);
        logGeo.rotateX(Math.PI / 2);
        
        // Stack 3 on bottom, 2 in mid, 1 on top
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

        // Backyard pine tree
        const yardTree = this.createTreeMesh();
        yardTree.position.set(-0.55, 0.1, -0.45);
        yardTree.scale.set(0.5, 0.5, 0.5);
        group.add(yardTree);

        // Fences
        addFenceZ(-0.76, -0.75, 0.75, 5);
        addFenceZ(0.76, -0.75, 0.75, 5);

        // Fairy lights outlining the A-frame front edges
        addFairyLights([
          new THREE.Vector3(-0.4, 0.5, d / 2 + 0.05),
          new THREE.Vector3(-0.2, 0.8, d / 2 + 0.0),
          new THREE.Vector3(0.0, 1.1, d / 2 - 0.05),
          new THREE.Vector3(0.2, 0.8, d / 2 + 0.0),
          new THREE.Vector3(0.4, 0.5, d / 2 + 0.05)
        ]);
      }

      // Flagstone walkway - Aligned with door dynamically!
      const walkwayX = (style === 0) ? -0.3 : 0.0;
      for (let i = 0; i < 4; i++) {
        const stone = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.02, 0.18), this.materials.whiteMetal);
        stone.rotation.y = rand() * 0.4 - 0.2;
        stone.position.set(walkwayX + (rand() - 0.5) * 0.08, 0.11, 0.55 + i * 0.13);
        stone.receiveShadow = true;
        group.add(stone);
      }

    } else if (level >= 3) {
      // Level 3: Three-story procedural apartment styles
      const w = 1.45, h = 2.45, d = 1.45;
      style = rand() > 0.5 ? 0 : 1;

      if (style === 0) {
        // SPLIT-LEVEL STEPPED MODERN APARTMENTS
        // Main tower block (3 stories)
        const wt1 = 0.85, ht1 = 2.4, dt1 = 1.2;
        const tower1 = new THREE.Group();
        
        const brick1 = new THREE.Mesh(new THREE.BoxGeometry(wt1, ht1, dt1), palette.brick);
        brick1.position.y = ht1 / 2 + 0.1;
        brick1.castShadow = true;
        brick1.receiveShadow = true;
        tower1.add(brick1);

        // Roof trim
        const rt1 = new THREE.Mesh(new THREE.BoxGeometry(wt1 + 0.06, 0.1, dt1 + 0.06), palette.roof);
        rt1.position.y = ht1 + 0.15;
        tower1.add(rt1);

        this.addWindows(tower1, { w: wt1 - 0.1, h: ht1 - 0.2, d: dt1 - 0.1 }, 3, 2, 0.1);
        tower1.position.set(-0.3, 0, 0);
        group.add(tower1);

        // Stepped shorter wing block (2 stories)
        const wt2 = 0.6, ht2 = 1.6, dt2 = 1.1;
        const tower2 = new THREE.Group();

        const wall2 = new THREE.Mesh(new THREE.BoxGeometry(wt2, ht2, dt2), palette.wall);
        wall2.position.y = ht2 / 2 + 0.1;
        wall2.castShadow = true;
        wall2.receiveShadow = true;
        tower2.add(wall2);

        const rt2 = new THREE.Mesh(new THREE.BoxGeometry(wt2 + 0.06, 0.1, dt2 + 0.06), palette.roof);
        rt2.position.y = ht2 + 0.15;
        tower2.add(rt2);

        this.addWindows(tower2, { w: wt2 - 0.08, h: ht2 - 0.2, d: dt2 - 0.08 }, 2, 1, 0.1);
        tower2.position.set(0.4, 0, -0.05);
        group.add(tower2);

      } else {
        // BALCONY-FOCUS APARTMENT
        const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), palette.wall);
        wall.position.set(0, h / 2 + 0.1, 0);
        wall.castShadow = true;
        wall.receiveShadow = true;
        group.add(wall);

        // Roof cornice
        const cornice = new THREE.Mesh(new THREE.BoxGeometry(w + 0.08, 0.12, d + 0.08), palette.roof);
        cornice.position.set(0, h + 0.16, 0);
        cornice.castShadow = true;
        group.add(cornice);

        // Exposed concrete columns / corners
        const colW = 0.08;
        const colOffsets = [
          [-w/2, -d/2], [w/2, -d/2], [-w/2, d/2], [w/2, d/2]
        ];
        for (const [cx, cz] of colOffsets) {
          const col = new THREE.Mesh(new THREE.BoxGeometry(colW, h + 0.06, colW), palette.trim);
          col.position.set(cx, h / 2 + 0.13, cz);
          col.castShadow = true;
          group.add(col);
        }

        // Add balconies in the front
        for (let story = 0; story < 3; story++) {
          const yPos = 0.1 + 0.35 + story * 0.75;
          const deck = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.03, 0.22), this.materials.trunk);
          deck.position.set(0, yPos, d / 2 + 0.1);
          group.add(deck);

          const rail = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.16, 0.02), palette.trim);
          rail.position.set(0, yPos + 0.08, d / 2 + 0.2);
          group.add(rail);

          // Balcony flowerbox
          if (rand() > 0.4) {
            const fBox = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 0.06), this.materials.trunk);
            fBox.position.set(-0.15, yPos + 0.1, d / 2 + 0.23);
            group.add(fBox);
            const foliage = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.04, 0.05), this.materials.leaves);
            foliage.position.set(-0.15, yPos + 0.13, d / 2 + 0.23);
            group.add(foliage);
          }

          // Sliding glass doors behind balcony
          const door = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.5, 0.02), this.materials.window);
          door.position.set(0, yPos + 0.26, d / 2 + 0.015);
          group.add(door);
        }

        // Standard windows on the sides (skipFront=true to prevent clipping sliding glass doors)
        this.addWindows(group, { w, h, d }, 3, 3, 0.1, true);
      }

      // Landscaping: simple manicured bushes in front yard
      const bush1 = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.22), this.materials.leaves);
      bush1.position.set(-0.55, 0.21, 0.85);
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
      list.push(new THREE.Vector3(xOffset, 0.92, -0.2));
    } else if (level === 2) {
      const styleVal = Math.floor(rand() * 3); // L-Shape, Dormer, Alpine
      if (styleVal === 0) {
        list.push(new THREE.Vector3(-0.4, 1.85, -0.15)); // main block X is offset by -0.15, chimney inside is at -0.25 -> total X = -0.4
      } else if (styleVal === 1) {
        list.push(new THREE.Vector3(0.35, 1.8, -0.25));
      } else {
        list.push(new THREE.Vector3(-0.35, 1.55, 0.1));
      }
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
      const lineGeo = new THREE.BoxGeometry(1.9, 0.05, 1.9);
      const line = new THREE.Mesh(lineGeo, this.materials.zoneC);
      group.add(line);
      return group;
    }

    // Foundation
    const foundGeo = new THREE.BoxGeometry(1.7, 0.08, 1.7);
    foundGeo.translate(0, 0.04, 0);
    const found = new THREE.Mesh(foundGeo, this.materials.dirt);
    group.add(found);

    if (level === 1) {
      // Level 1: Shop with glass storefront
      const w = 1.3, h = 0.9, d = 1.3;
      const wallGeo = new THREE.BoxGeometry(w, h, d);
      wallGeo.translate(0, h / 2 + 0.08, 0);
      const wall = new THREE.Mesh(wallGeo, this.materials.wallCom);
      wall.castShadow = true;
      group.add(wall);

      // Storefront glass window
      const glassGeo = new THREE.BoxGeometry(0.9, 0.5, 0.1);
      const glass = new THREE.Mesh(glassGeo, this.materials.glass);
      glass.position.set(0, 0.38, d / 2 + 0.02);
      group.add(glass);

      // Sign board on top
      const signGeo = new THREE.BoxGeometry(0.8, 0.2, 0.15);
      const sign = new THREE.Mesh(signGeo, this.materials.whiteMetal);
      sign.position.set(0, h + 0.1, d / 2 - 0.1);
      group.add(sign);

    } else if (level === 2) {
      // Level 2: Two-story mall/office block
      const w = 1.4, h = 1.6, d = 1.4;
      const wallGeo = new THREE.BoxGeometry(w, h, d);
      wallGeo.translate(0, h / 2 + 0.08, 0);
      const wall = new THREE.Mesh(wallGeo, this.materials.wallCom);
      wall.castShadow = true;
      group.add(wall);

      // Glass corners
      const glassCornerGeo = new THREE.BoxGeometry(0.4, h - 0.2, 0.4);
      const gc = new THREE.Mesh(glassCornerGeo, this.materials.glass);
      gc.position.set(w / 2 - 0.2, h / 2 + 0.08, d / 2 - 0.2);
      group.add(gc);

      this.addWindows(group, { w, h, d }, 2, 2, 0.08);

    } else if (level >= 3) {
      // Level 3: Modern corporate skyscraper
      const w = 1.5, h = 3.6, d = 1.5;
      const wallGeo = new THREE.BoxGeometry(w, h, d);
      wallGeo.translate(0, h / 2 + 0.08, 0);
      const wall = new THREE.Mesh(wallGeo, this.materials.wallCom);
      wall.castShadow = true;
      group.add(wall);

      // Huge vertical glass strip in front
      const stripGeo = new THREE.BoxGeometry(0.4, h - 0.4, 0.1);
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
      const lineGeo = new THREE.BoxGeometry(1.9, 0.05, 1.9);
      const line = new THREE.Mesh(lineGeo, this.materials.zoneI);
      group.add(line);
      return group;
    }

    // Foundation
    const foundGeo = new THREE.BoxGeometry(1.7, 0.08, 1.7);
    foundGeo.translate(0, 0.04, 0);
    const found = new THREE.Mesh(foundGeo, this.materials.dirt);
    group.add(found);

    if (level === 1) {
      // Level 1: Small metal warehouse / workshop
      const w = 1.4, h = 0.8, d = 1.4;
      const wallGeo = new THREE.BoxGeometry(w, h, d);
      wallGeo.translate(0, h / 2 + 0.08, 0);
      const wall = new THREE.Mesh(wallGeo, this.materials.wallInd);
      wall.castShadow = true;
      group.add(wall);

      // Sawtooth industrial roof shape
      const roofGeo = new THREE.CylinderGeometry(0.1, 0.8, 1.4, 3);
      roofGeo.rotateZ(Math.PI / 2);
      roofGeo.translate(0, h + 0.2 + 0.08, 0);
      const roof = new THREE.Mesh(roofGeo, this.materials.metal);
      group.add(roof);

      // Little exhaust pipe
      const pipeGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.5, 4);
      pipeGeo.translate(0.4, h + 0.3, 0.3);
      const pipe = new THREE.Mesh(pipeGeo, this.materials.metal);
      group.add(pipe);

    } else if (level === 2) {
      // Level 2: Factory building with loading docks
      const w = 1.5, h = 1.4, d = 1.5;
      const wallGeo = new THREE.BoxGeometry(w, h, d);
      wallGeo.translate(0, h / 2 + 0.08, 0);
      const wall = new THREE.Mesh(wallGeo, this.materials.wallInd);
      wall.castShadow = true;
      group.add(wall);

      // Large metal roller door
      const doorGeo = new THREE.BoxGeometry(0.8, 0.8, 0.05);
      const door = new THREE.Mesh(doorGeo, this.materials.metal);
      door.position.set(0, 0.48, d / 2 + 0.01);
      group.add(door);

      // Tall chimney
      const chimneyGeo = new THREE.CylinderGeometry(0.1, 0.15, 1.6, 5);
      chimneyGeo.translate(-0.4, 0.88, -0.4);
      const chimney = new THREE.Mesh(chimneyGeo, this.materials.metal);
      chimney.castShadow = true;
      group.add(chimney);

    } else if (level >= 3) {
      // Level 3: Large refinery plant with smoke stacks and pipes
      const w = 1.6, h = 2.0, d = 1.6;
      const wallGeo = new THREE.BoxGeometry(w, h, d);
      wallGeo.translate(0, h / 2 + 0.08, 0);
      const wall = new THREE.Mesh(wallGeo, this.materials.wallInd);
      wall.castShadow = true;
      group.add(wall);

      // Storage cylinders
      const tankGeo = new THREE.CylinderGeometry(0.3, 0.3, 1.4, 5);
      tankGeo.translate(0.4, 0.78, 0.4);
      const tank = new THREE.Mesh(tankGeo, this.materials.metal);
      tank.castShadow = true;
      group.add(tank);

      // Multi chimneys
      for (let i = 0; i < 2; i++) {
        const chimGeo = new THREE.CylinderGeometry(0.08, 0.12, 2.2, 5);
        chimGeo.translate(-0.4 + i * 0.3, 1.18, -0.4);
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
    const baseGeo = new THREE.CylinderGeometry(0.15, 0.25, 0.2, 6);
    baseGeo.translate(0, 0.1, 0);
    const base = new THREE.Mesh(baseGeo, this.materials.dirt);
    group.add(base);

    // Tower pole
    const towerGeo = new THREE.CylinderGeometry(0.06, 0.12, 2.5, 6);
    towerGeo.translate(0, 1.25 + 0.2, 0);
    const tower = new THREE.Mesh(towerGeo, this.materials.whiteMetal);
    tower.castShadow = true;
    group.add(tower);

    // Nacelle (generator head)
    const nacelleGeo = new THREE.BoxGeometry(0.2, 0.2, 0.4);
    nacelleGeo.translate(0, 2.65, 0.05);
    const nacelle = new THREE.Mesh(nacelleGeo, this.materials.whiteMetal);
    nacelle.castShadow = true;
    group.add(nacelle);

    // Rotor Hub
    const hubGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.15, 6);
    hubGeo.rotateX(Math.PI / 2);
    hubGeo.translate(0, 2.65, 0.25);
    const hub = new THREE.Mesh(hubGeo, this.materials.whiteMetal);
    group.add(hub);

    // Blades (Rotor Group to rotate dynamically)
    const rotor = new THREE.Group();
    rotor.name = 'turbine_rotor';
    rotor.position.set(0, 2.65, 0.25);

    // 3 blades spaced 120 degrees apart
    for (let i = 0; i < 3; i++) {
      const bladeGeo = new THREE.BoxGeometry(0.08, 1.0, 0.02);
      bladeGeo.translate(0, 0.5, 0); // Origin at tip
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
    const baseGeo = new THREE.BoxGeometry(1.6, 0.08, 1.6);
    baseGeo.translate(0, 0.04, 0);
    const base = new THREE.Mesh(baseGeo, this.materials.dirt);
    group.add(base);

    // Legs (4 posts)
    const legGeo = new THREE.BoxGeometry(0.08, 1.6, 0.08);
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
    const ringGeo = new THREE.BoxGeometry(1.1, 0.08, 1.1);
    const ring1 = new THREE.Mesh(ringGeo, this.materials.metal);
    ring1.position.set(0, 0.9, 0);
    group.add(ring1);

    const ring2 = new THREE.Mesh(ringGeo, this.materials.metal);
    ring2.position.set(0, 1.5, 0);
    group.add(ring2);

    // Central pipe
    const pipeGeo = new THREE.CylinderGeometry(0.12, 0.12, 1.7, 5);
    const pipe = new THREE.Mesh(pipeGeo, this.materials.metal);
    pipe.position.set(0, 0.93, 0);
    group.add(pipe);

    // Water Sphere/Tank
    const tankGeo = new THREE.SphereGeometry(0.65, 8, 8);
    tankGeo.scale(1.0, 0.8, 1.0);
    tankGeo.translate(0, 2.0, 0);
    const tank = new THREE.Mesh(tankGeo, this.materials.waterBlue);
    tank.castShadow = true;
    group.add(tank);

    // Cap on tank
    const capGeo = new THREE.ConeGeometry(0.4, 0.2, 8);
    capGeo.translate(0, 2.5, 0);
    const cap = new THREE.Mesh(capGeo, this.materials.whiteMetal);
    group.add(cap);

    return group;
  }

  // 9. Park Mesh
  createParkMesh(): THREE.Group {
    const group = new THREE.Group();

    // Grass patch
    const patchGeo = new THREE.BoxGeometry(1.8, 0.05, 1.8);
    patchGeo.translate(0, 0.025, 0);
    const patch = new THREE.Mesh(patchGeo, this.materials.grass);
    patch.receiveShadow = true;
    group.add(patch);

    // Tiny gravel path
    const pathGeo = new THREE.BoxGeometry(0.4, 0.06, 1.8);
    pathGeo.translate(0, 0.03, 0);
    const path = new THREE.Mesh(pathGeo, this.materials.dirt);
    group.add(path);

    // Wooden Bench
    const benchGroup = new THREE.Group();
    benchGroup.position.set(0.5, 0.1, 0);

    const seatGeo = new THREE.BoxGeometry(0.18, 0.03, 0.6);
    const seat = new THREE.Mesh(seatGeo, this.materials.trunk);
    benchGroup.add(seat);

    const backGeo = new THREE.BoxGeometry(0.03, 0.15, 0.6);
    backGeo.translate(-0.09, 0.08, 0);
    const back = new THREE.Mesh(backGeo, this.materials.trunk);
    benchGroup.add(back);

    const leg1 = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.1, 0.04), this.materials.metal);
    leg1.position.set(0, -0.05, 0.25);
    benchGroup.add(leg1);

    const leg2 = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.1, 0.04), this.materials.metal);
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
    const bodyGeo = new THREE.BoxGeometry(0.36, 0.16, 0.68);
    bodyGeo.translate(0, 0.14, 0); // lift off wheels
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    // Cabin glass dome / roof
    const cabGeo = new THREE.BoxGeometry(0.3, 0.13, 0.38);
    cabGeo.translate(0, 0.28, -0.05); // slightly backwards
    const cabin = new THREE.Mesh(cabGeo, this.materials.wallCom); // Dark grey cabin
    cabin.castShadow = true;
    group.add(cabin);

    // Front Windshield glass
    const windGeo = new THREE.BoxGeometry(0.28, 0.1, 0.02);
    windGeo.rotateX(-Math.PI / 6); // slanted
    windGeo.translate(0, 0.26, 0.13);
    const windshield = new THREE.Mesh(windGeo, this.materials.glass);
    group.add(windshield);

    // Wheels (4 cylinders, radius=0.08, width=0.06)
    const wheelGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.06, 6);
    wheelGeo.rotateZ(Math.PI / 2); // rotate sideways

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

    // Headlights (glowing yellow dots at the front)
    const headGeo = new THREE.BoxGeometry(0.06, 0.04, 0.02);
    
    const headL = new THREE.Mesh(headGeo, this.materials.headlight);
    headL.position.set(-0.12, 0.16, 0.341);
    group.add(headL);

    const headR = new THREE.Mesh(headGeo, this.materials.headlight);
    headR.position.set(0.12, 0.16, 0.341);
    group.add(headR);

    // Tail lights (glowing red dots at the back)
    const tailGeo = new THREE.BoxGeometry(0.06, 0.04, 0.02);
    const tailMat = this.materials.taillight;

    const tailL = new THREE.Mesh(tailGeo, tailMat);
    tailL.position.set(-0.12, 0.16, -0.341);
    group.add(tailL);

    const tailR = new THREE.Mesh(tailGeo, tailMat);
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
