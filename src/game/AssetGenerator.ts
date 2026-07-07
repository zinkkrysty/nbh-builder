import * as THREE from 'three';

export class AssetGenerator {
  // Shared materials for performance
  materials: { [key: string]: THREE.Material } = {};
  isNightMode: boolean = false;

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

    // Residential Colors (cozy pastels)
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
    this.materials.waterBlue = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.2, metalness: 0.8 });

    // Windows (Glowing at night)
    this.materials.window = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xfef08a,
      emissiveIntensity: 0.0, // Day mode: 0, Night mode: 1.0+
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
  addWindows(group: THREE.Group, size: { w: number; h: number; d: number }, rows: number, cols: number) {
    const winGeo = new THREE.BoxGeometry(0.12, 0.18, 0.03);
    const winMat = this.materials.window;

    // Window configurations for front/back and sides
    const spacingX = size.w / (cols + 1);
    const spacingY = size.h / (rows + 1);

    for (let r = 1; r <= rows; r++) {
      const y = spacingY * r - size.h / 2;
      
      // Front and Back Walls
      for (let c = 1; c <= cols; c++) {
        const x = spacingX * c - size.w / 2;

        // Front window
        const winF = new THREE.Mesh(winGeo, winMat);
        winF.position.set(x, y, size.d / 2 + 0.015);
        group.add(winF);

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
  createResidentialMesh(level: number): THREE.Group {
    const group = new THREE.Group();

    if (level === 0) {
      // Level 0: Zoned Outline
      const lineGeo = new THREE.BoxGeometry(1.9, 0.05, 1.9);
      const line = new THREE.Mesh(lineGeo, this.materials.zoneR);
      group.add(line);
      return group;
    }

    // Common Base offset for low poly building
    const addFoundation = () => {
      const foundGeo = new THREE.BoxGeometry(1.6, 0.1, 1.6);
      foundGeo.translate(0, 0.05, 0);
      const found = new THREE.Mesh(foundGeo, this.materials.dirt);
      found.receiveShadow = true;
      group.add(found);
    };

    addFoundation();

    if (level === 1) {
      // Level 1: Cozy small cottage
      const w = 1.2, h = 0.8, d = 1.2;
      const wallGeo = new THREE.BoxGeometry(w, h, d);
      wallGeo.translate(0, h / 2 + 0.1, 0);
      const wall = new THREE.Mesh(wallGeo, this.materials.wallRes1);
      wall.castShadow = true;
      wall.receiveShadow = true;
      group.add(wall);

      // Peaked Roof
      const roofGeo = new THREE.ConeGeometry(0.95, 0.6, 4);
      roofGeo.rotateY(Math.PI / 4);
      roofGeo.translate(0, h + 0.3 + 0.1, 0);
      const roof = new THREE.Mesh(roofGeo, this.materials.roof);
      roof.castShadow = true;
      group.add(roof);

      // Add small door
      const doorGeo = new THREE.BoxGeometry(0.25, 0.5, 0.04);
      const door = new THREE.Mesh(doorGeo, this.materials.trunk);
      door.position.set(0, 0.35, d / 2 + 0.01);
      group.add(door);

      // Add windows
      this.addWindows(group, { w, h, d }, 1, 2);

    } else if (level === 2) {
      // Level 2: Two-story suburban house
      const w = 1.3, h = 1.4, d = 1.3;
      const wallGeo = new THREE.BoxGeometry(w, h, d);
      wallGeo.translate(0, h / 2 + 0.1, 0);
      const wall = new THREE.Mesh(wallGeo, this.materials.wallRes2);
      wall.castShadow = true;
      wall.receiveShadow = true;
      group.add(wall);

      // Double pitched roof
      const roofGeo = new THREE.CylinderGeometry(0.01, 1.05, 1.4, 4);
      roofGeo.rotateX(Math.PI / 2);
      roofGeo.rotateY(Math.PI / 4);
      roofGeo.translate(0, h + 0.35 + 0.1, 0);
      const roof = new THREE.Mesh(roofGeo, this.materials.roof);
      roof.castShadow = true;
      group.add(roof);

      // Chimney
      const chimGeo = new THREE.BoxGeometry(0.18, 0.6, 0.18);
      chimGeo.translate(0.35, h + 0.4, 0.2);
      const chimney = new THREE.Mesh(chimGeo, this.materials.dirt);
      chimney.castShadow = true;
      group.add(chimney);

      this.addWindows(group, { w, h, d }, 2, 2);

    } else if (level >= 3) {
      // Level 3: Three-story brick/modern apartment
      const w = 1.4, h = 2.4, d = 1.4;
      const wallGeo = new THREE.BoxGeometry(w, h, d);
      wallGeo.translate(0, h / 2 + 0.1, 0);
      const wall = new THREE.Mesh(wallGeo, this.materials.wallRes3);
      wall.castShadow = true;
      wall.receiveShadow = true;
      group.add(wall);

      // Flat Roof edge
      const roofEdgeGeo = new THREE.BoxGeometry(w + 0.1, 0.15, d + 0.1);
      roofEdgeGeo.translate(0, h + 0.15, 0);
      const roofEdge = new THREE.Mesh(roofEdgeGeo, this.materials.roof);
      roofEdge.castShadow = true;
      group.add(roofEdge);

      this.addWindows(group, { w, h, d }, 3, 3);
    }

    return group;
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

      this.addWindows(group, { w, h, d }, 2, 2);

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

      this.addWindows(group, { w, h, d }, 4, 3);
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
