import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import { Simulation } from './Simulation';
import { ROAD_LAYOUT, currentStreetscapeSettings } from './RoadLayout';

export type MaterialProfile = 'standard' | 'softToon' | 'toon';
export type EnvironmentTreeFamily = 'conifer' | 'broadleaf' | 'slender';
export type EnvironmentPlantGeometry = 'env_reed_clump' | 'env_lily_pad_rosette';

type ResidentialPalette = {
  wall: THREE.Material;
  roof: THREE.Material;
  trim: THREE.Material;
  brick: THREE.Material;
};

type CommercialPalette = ResidentialPalette & {
  accent: THREE.Material;
};

type WaterNeighbors = { N: boolean; S: boolean; E: boolean; W: boolean };
type WaterDiagonalNeighbors = { NW: boolean; NE: boolean; SE: boolean; SW: boolean };

const NO_WATER_DIAGONALS: WaterDiagonalNeighbors = {
  NW: false,
  NE: false,
  SE: false,
  SW: false,
};

export class AssetGenerator {
  sim: Simulation | null = null;
  // Shared materials for performance
  materials: { [key: string]: THREE.Material } = {};
  // Shared geometries for performance
  geometries: { [key: string]: THREE.BufferGeometry } = {};
  isNightMode: boolean = false;

  // Soft-toon keeps PBR roughness/emission while faceting the broad low-poly forms.
  materialProfile: MaterialProfile = 'softToon';
  toonGradient!: THREE.Texture;
  gradientCanvas!: HTMLCanvasElement;
  standardMaterials: { [key: string]: THREE.Material } = {};
  softToonMaterials: { [key: string]: THREE.Material } = {};
  toonMaterials: { [key: string]: THREE.Material } = {};
  standardPalettes: ResidentialPalette[] = [];
  softToonPalettes: ResidentialPalette[] = [];
  toonPalettes: ResidentialPalette[] = [];
  standardCommercialPalettes: CommercialPalette[] = [];
  softToonCommercialPalettes: CommercialPalette[] = [];
  toonCommercialPalettes: CommercialPalette[] = [];
  private materialProfileMap = new Map<THREE.Material, Record<MaterialProfile, THREE.Material>>();

  // Curated cozy color palettes for procedural residential blocks
  palettes: ResidentialPalette[] = [];

  // Curated color palettes for procedural commercial buildings
  commercialPalettes: CommercialPalette[] = [];

  constructor() {
    this.initMaterials();
  }

  mergeMeshesByMaterial(group: THREE.Group): THREE.Group {
    const mergedGroup = new THREE.Group();
    mergedGroup.position.copy(group.position);
    mergedGroup.rotation.copy(group.rotation);
    mergedGroup.scale.copy(group.scale);
    mergedGroup.name = group.name;
    Object.assign(mergedGroup.userData, group.userData);

    const materialGroups = new Map<THREE.Material, { geometries: THREE.BufferGeometry[] }>();
    const dynamicObjects: THREE.Object3D[] = [];

    const collect = (node: THREE.Object3D) => {
      if (node.name === 'turbine_rotor' || node.userData.dynamic || node.name.includes('rotor')) {
        dynamicObjects.push(node);
        return;
      }

      if ((node as any).isMesh) {
        const mesh = node as THREE.Mesh;
        const geometry = mesh.geometry;
        const material = mesh.material as THREE.Material;

        if (geometry && material) {
          node.updateMatrix();
          let relMatrix = node.matrix.clone();
          let p = node.parent;
          while (p && p !== group) {
            p.updateMatrix();
            relMatrix.premultiply(p.matrix);
            p = p.parent;
          }

          const clonedGeo = geometry.clone();
          clonedGeo.applyMatrix4(relMatrix);

          if (!materialGroups.has(material)) {
            materialGroups.set(material, { geometries: [] });
          }
          materialGroups.get(material)!.geometries.push(clonedGeo);
        }
      }

      for (const child of node.children) {
        collect(child);
      }
    };

    for (const child of group.children) {
      collect(child);
    }

    materialGroups.forEach((data, material) => {
      if (data.geometries.length > 0) {
        const processedGeoms: THREE.BufferGeometry[] = [];
        let hasUV = false;

        data.geometries.forEach(g => {
          let pg = g;
          if (g.index) {
            pg = g.toNonIndexed();
            g.dispose();
          }
          if (!pg.attributes.normal) {
            pg.computeVertexNormals();
          }
          if (pg.attributes.uv) {
            hasUV = true;
          }
          processedGeoms.push(pg);
        });

        const finalGeoms = processedGeoms.map(g => {
          if (hasUV && !g.attributes.uv) {
            const count = g.attributes.position.count;
            const uvs = new Float32Array(count * 2);
            g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
          }
          return g;
        });

        try {
          const mergedGeo = BufferGeometryUtils.mergeGeometries(finalGeoms, false);
          if (mergedGeo) {
            const mergedMesh = new THREE.Mesh(mergedGeo, material);
            mergedMesh.castShadow = true;
            mergedMesh.receiveShadow = true;
            mergedGroup.add(mergedMesh);
          }
        } catch (e) {
          console.error("Failed to merge geometries for material", material, e);
        } finally {
          finalGeoms.forEach(geo => geo.dispose());
        }
      }
    });

    dynamicObjects.forEach((obj) => {
      mergedGroup.add(obj);
    });

    return mergedGroup;
  }

  getGeometry(key: string, creator: () => THREE.BufferGeometry): THREE.BufferGeometry {
    if (!this.geometries[key]) {
      this.geometries[key] = creator();
    }
    return this.geometries[key];
  }

  createToonGradientTexture(steps: number = 10): THREE.Texture {
    const canvas = document.createElement('canvas');
    canvas.width = steps;
    canvas.height = 1;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const values = [5, 5, 5, 30, 30, 80, 80, 130, 190, 255]; // 10-step high-contrast default light bands
      for (let i = 0; i < steps; i++) {
        const v = values[i] !== undefined ? values[i] : Math.floor((i / (steps - 1)) * 255);
        ctx.fillStyle = `rgb(${v}, ${v}, ${v})`;
        ctx.fillRect(i, 0, 1, 1);
      }
    }
    this.gradientCanvas = canvas;
    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.NearestFilter;
    texture.magFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
    return texture;
  }

  updateToonGradient(values: number[]) {
    const canvas = this.gradientCanvas;
    if (!canvas) {
      console.warn("Cel Shading updateToonGradient: gradientCanvas is null!");
      return;
    }
    const steps = values.length;
    canvas.width = steps;
    canvas.height = 1;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      for (let i = 0; i < steps; i++) {
        const v = values[i];
        ctx.fillStyle = `rgb(${v}, ${v}, ${v})`;
        ctx.fillRect(i, 0, 1, 1);
      }
    }

    console.log("Cel Shading updateToonGradient called with values:", values, "Canvas size:", canvas.width, "x", canvas.height);

    // Force Three.js to destroy WebGL texture and re-upload from scratch to guarantee real-time updates
    this.toonGradient.dispose();
    this.toonGradient.needsUpdate = true;
  }

  initMaterials() {
    this.toonGradient = this.createToonGradientTexture(10);

    this.standardMaterials = {};
    this.softToonMaterials = {};
    this.toonMaterials = {};
    this.materialProfileMap = new Map();

    const registerProfileTriplet = (standard: THREE.Material, softToon: THREE.Material, toon: THREE.Material) => {
      const profiles = { standard, softToon, toon };
      this.materialProfileMap.set(standard, profiles);
      this.materialProfileMap.set(softToon, profiles);
      this.materialProfileMap.set(toon, profiles);
    };

    const softenMaterial = (key: string, material: THREE.Material) => {
      // Preserve continuous highlights for glass, water, lamps, and metal. Other
      // standard materials use their existing PBR settings with faceted normals.
      const smoothSurfaces = new Set([
        'waterBlue', 'glass', 'metal', 'whiteMetal', 'charcoalMetal',
        'lampBulb', 'window', 'fairyLight', 'headlight', 'taillight',
      ]);
      if (material instanceof THREE.MeshStandardMaterial && !smoothSurfaces.has(key)) {
        material.flatShading = true;
        material.needsUpdate = true;
      }
      material.userData.materialProfile = 'softToon';
      return material;
    };

    const registerMat = (key: string, creator: (type: 'standard' | 'toon') => THREE.Material) => {
      const std = creator('standard');
      const softToon = softenMaterial(key, creator('standard'));
      const toon = creator('toon');
      this.standardMaterials[key] = std;
      this.softToonMaterials[key] = softToon;
      this.toonMaterials[key] = toon;
      registerProfileTriplet(std, softToon, toon);
    };

    const registerBasicMat = (key: string, mat: THREE.Material) => {
      this.standardMaterials[key] = mat;
      this.softToonMaterials[key] = mat;
      this.toonMaterials[key] = mat;
      registerProfileTriplet(mat, mat, mat);
    };

    // Ground / Grass
    const applyGrassOnBeforeCompile = (shader: any) => {
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
           attribute vec4 aEdgeFlags;
           attribute vec4 aCornerFlags;
           attribute vec4 aCliffEdgeRoles;
           attribute vec4 aCliffCornerRoles;
           attribute float aTerrainFacet;
           varying vec3 vTerrainLocalNormal;
           varying vec3 vTerrainWorldPos;
           varying vec2 vTerrainTileLocalXZ;
           varying vec4 vTerrainEdgeFlags;
           varying vec4 vTerrainCliffEdgeRoles;
           varying vec4 vTerrainCliffCornerRoles;
           varying float vTerrainEdgeWeight;
           varying float vTerrainFacet;
           varying vec2 vTerrainTileIndex;`
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
           vTerrainLocalNormal = normal;
           #ifdef USE_INSTANCING
             vec4 worldPos = modelMatrix * instanceMatrix * vec4(position, 1.0);
             vec4 tileOrigin = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
           #else
             vec4 worldPos = modelMatrix * vec4(position, 1.0);
             vec4 tileOrigin = modelMatrix * vec4(0.0, 0.0, 0.0, 1.0);
           #endif

           float edgeWeight = 0.0;
           #ifdef USE_INSTANCING
             bool isNorth = position.z < -0.99;
             bool isSouth = position.z > 0.99;
             bool isEast  = position.x > 0.99;
             bool isWest  = position.x < -0.99;

             if (isNorth && isWest) {
               edgeWeight = aCornerFlags.x; // NW
             } else if (isNorth && isEast) {
               edgeWeight = aCornerFlags.y; // NE
             } else if (isSouth && isEast) {
               edgeWeight = aCornerFlags.z; // SE
             } else if (isSouth && isWest) {
               edgeWeight = aCornerFlags.w; // SW
             } else if (isNorth) {
               edgeWeight = aEdgeFlags.x;   // N
             } else if (isEast) {
               edgeWeight = aEdgeFlags.y;   // E
             } else if (isSouth) {
               edgeWeight = aEdgeFlags.z;   // S
             } else if (isWest) {
               edgeWeight = aEdgeFlags.w;   // W
             }
           #endif

           // Keep terrain colour variation entirely coordinate-derived. This makes
           // every open lot and cliff deterministic without a tile material, a
           // texture lookup, or simulation/save-state data.
           vTerrainWorldPos = worldPos.xyz;
           vTerrainTileLocalXZ = worldPos.xz - tileOrigin.xz;
           vTerrainEdgeWeight = edgeWeight;
           vTerrainFacet = aTerrainFacet;
           vTerrainTileIndex = tileOrigin.xz * 0.5;
           #ifdef USE_INSTANCING
             vTerrainEdgeFlags = aEdgeFlags;
             vTerrainCliffEdgeRoles = aCliffEdgeRoles;
             vTerrainCliffCornerRoles = aCliffCornerRoles;
           #else
             vTerrainEdgeFlags = vec4(0.0);
             vTerrainCliffEdgeRoles = vec4(0.0);
             vTerrainCliffCornerRoles = vec4(0.0);
           #endif

           vec3 topDisplace = vec3(
             sin(worldPos.z * 2.5 + worldPos.x * 0.8) * cos(worldPos.x * 1.2) * 0.22,
             0.0,
             cos(worldPos.x * 2.5 + worldPos.z * 0.8) * sin(worldPos.z * 1.2) * 0.22
           );

           // Vertical cliff face wobble that vanishes at every tile elevation step (y = k * 0.8)
           float yWobble = sin(worldPos.y * (3.14159265 / 0.8));
           vec3 faceWobble = vec3(
             yWobble * cos(worldPos.x * 1.5 + worldPos.z * 0.5) * 0.12,
             0.0,
             yWobble * sin(worldPos.z * 1.5 + worldPos.x * 0.5) * 0.12
           );

           transformed.xyz += (topDisplace + faceWobble) * edgeWeight;`
        );

      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
           varying vec3 vTerrainLocalNormal;
           varying vec3 vTerrainWorldPos;
           varying vec2 vTerrainTileLocalXZ;
           varying vec4 vTerrainEdgeFlags;
           varying vec4 vTerrainCliffEdgeRoles;
           varying vec4 vTerrainCliffCornerRoles;
           varying float vTerrainEdgeWeight;
           varying float vTerrainFacet;
           varying vec2 vTerrainTileIndex;

           float terrainFacetHash(vec2 p) {
             return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
           }

           `
        )
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
           // Each top triangle gets one deterministic shade. Keep it entirely
           // facet-local: earlier macro waves made visible bands across large
           // maps. Coordinate-seeded values do not repeat when zooming out,
           // while the tighter palette keeps the land quiet and buildable.
           float grassPatch = floor(terrainFacetHash(
             vTerrainTileIndex + vec2(vTerrainFacet * 17.0, vTerrainFacet * 31.0)
           ) * 3.0) * 0.5;

           // Match the game's five sculpting steps instead of painting a smooth
           // gradient across the landscape. Low ground stays a fuller, cooler
           // green, while exposed high ground shifts toward a lighter, drier
           // sage. This gives terraces a readable low-poly value
           // hierarchy without making altitude look like a biome boundary.
           float elevationStep = floor(clamp(vTerrainWorldPos.y / 0.8, 0.0, 4.0) + 0.5) / 4.0;
           vec3 grassAtElevation = mix(
             vec3(0.415, 0.675, 0.455),
             vec3(0.525, 0.735, 0.385),
             elevationStep
           );
           vec3 grassShade = grassAtElevation * mix(0.945, 1.055, grassPatch);

           // Exposed vertical terrain faces use three soft elevation-relative
           // bands. The lower contact shade is intentionally restrained: it
           // helps stacked tiles read as banks/cliffs without drawing a hard
           // outline around every lot.
           float tier = fract(-vTerrainWorldPos.y / 0.8 + 0.0001);
           vec3 bankShade = mix(vec3(0.515, 0.405, 0.285), vec3(0.575, 0.465, 0.335), smoothstep(0.18, 0.48, tier));
           bankShade = mix(bankShade, vec3(0.625, 0.515, 0.385), smoothstep(0.54, 0.84, tier));
           float bankStain = terrainFacetHash(vTerrainTileIndex + vec2(7.3, 12.7));
           bankShade *= mix(0.965, 1.035, bankStain);
           float contactShade = smoothstep(0.78, 0.98, tier) * vTerrainEdgeWeight;
           bankShade *= 1.0 - contactShade * 0.075;

           float topFace = smoothstep(0.42, 0.68, vTerrainLocalNormal.y);
           vec3 customColor = mix(bankShade, grassShade, topFace);

           // Use crisp, flat bands on the grass cap: the upper tile gets a
           // narrow lit lip and the lower tile a matching contact shadow. The
           // signed roles prevent the highlight from appearing on both sides.
           vec4 grassEdgeBand = vec4(
             step(0.93, -vTerrainTileLocalXZ.y),
             step(0.93,  vTerrainTileLocalXZ.x),
             step(0.93,  vTerrainTileLocalXZ.y),
             step(0.93, -vTerrainTileLocalXZ.x)
           );
           vec4 grassCornerBand = vec4(
             grassEdgeBand.w * grassEdgeBand.x,
             grassEdgeBand.x * grassEdgeBand.y,
             grassEdgeBand.y * grassEdgeBand.z,
             grassEdgeBand.z * grassEdgeBand.w
           );
           vec4 upperCliffEdge = max(vTerrainCliffEdgeRoles, vec4(0.0));
           vec4 lowerCliffEdge = max(-vTerrainCliffEdgeRoles, vec4(0.0));
           float upperEdgeLip = max(max(upperCliffEdge.x * grassEdgeBand.x, upperCliffEdge.y * grassEdgeBand.y), max(upperCliffEdge.z * grassEdgeBand.z, upperCliffEdge.w * grassEdgeBand.w));
           vec4 upperConcaveCorner = max(vTerrainCliffCornerRoles, vec4(0.0));
           float upperConcaveCornerLip = max(max(upperConcaveCorner.x * grassCornerBand.x, upperConcaveCorner.y * grassCornerBand.y), max(upperConcaveCorner.z * grassCornerBand.z, upperConcaveCorner.w * grassCornerBand.w));
           vec4 lowerConcaveCorner = max(-vTerrainCliffCornerRoles, vec4(0.0));
           float lowerConcaveCornerShadow = max(max(lowerConcaveCorner.x * grassCornerBand.x, lowerConcaveCorner.y * grassCornerBand.y), max(lowerConcaveCorner.z * grassCornerBand.z, lowerConcaveCorner.w * grassCornerBand.w));
           float upperGrassLip = max(upperEdgeLip, upperConcaveCornerLip) * topFace;
           float lowerEdgeShadow = max(max(lowerCliffEdge.x * grassEdgeBand.x, lowerCliffEdge.y * grassEdgeBand.y), max(lowerCliffEdge.z * grassEdgeBand.z, lowerCliffEdge.w * grassEdgeBand.w));
           float lowerGrassShadow = max(lowerEdgeShadow, lowerConcaveCornerShadow) * topFace;
           customColor = mix(customColor, customColor * 0.78, lowerGrassShadow);
           customColor = mix(customColor, vec3(0.690, 0.805, 0.510), upperGrassLip * 0.52);

           diffuseColor = vec4(customColor, opacity);`
        );
    };

    registerMat('grass', (type) => {
      if (type === 'standard') {
        const mat = new THREE.MeshStandardMaterial({
          roughness: 0.8,
          metalness: 0.1,
          flatShading: true,
        });
        mat.onBeforeCompile = applyGrassOnBeforeCompile;
        return mat;
      } else {
        const mat = new THREE.MeshToonMaterial({
          gradientMap: this.toonGradient,
        });
        (mat as any).flatShading = true;
        mat.onBeforeCompile = applyGrassOnBeforeCompile;
        return mat;
      }
    });

    registerMat('dirt', (type) => {
      if (type === 'standard') {
        return new THREE.MeshStandardMaterial({ color: 0xa18262, roughness: 0.9 });
      } else {
        return new THREE.MeshToonMaterial({ color: 0xa18262, gradientMap: this.toonGradient });
      }
    });

    // Roads
    registerMat('road', (type) => {
      if (type === 'standard') {
        return new THREE.MeshStandardMaterial({ color: 0x2d3139, roughness: 0.8 });
      } else {
        return new THREE.MeshToonMaterial({ color: 0x2d3139, gradientMap: this.toonGradient });
      }
    });

    registerBasicMat('roadLine', new THREE.MeshBasicMaterial({
      color: 0xf59e0b, // Yellow lines
    }));

    registerMat('roadCrosswalk', (type) => {
      if (type === 'standard') {
        return new THREE.MeshStandardMaterial({
          color: 0xdddddd,      // Slightly brighter off-white
          roughness: 0.9,
          transparent: true,
          opacity: 0.75,        // Increased opacity for better visibility
        });
      } else {
        return new THREE.MeshToonMaterial({
          color: 0xdddddd,
          gradientMap: this.toonGradient,
          transparent: true,
          opacity: 0.75,
        });
      }
    });

    registerMat('sidewalk', (type) => {
      if (type === 'standard') {
        return new THREE.MeshStandardMaterial({ color: 0xb0a89e, roughness: 0.7 });
      } else {
        return new THREE.MeshToonMaterial({ color: 0xb0a89e, gradientMap: this.toonGradient });
      }
    });

    registerMat('curb', (type) => {
      if (type === 'standard') {
        return new THREE.MeshStandardMaterial({ color: 0xdfd7cd, roughness: 0.5 });
      } else {
        return new THREE.MeshToonMaterial({ color: 0xdfd7cd, gradientMap: this.toonGradient });
      }
    });

    registerMat('charcoalMetal', (type) => {
      if (type === 'standard') {
        return new THREE.MeshStandardMaterial({ color: 0x33373e, roughness: 0.5, metalness: 0.3 });
      } else {
        return new THREE.MeshToonMaterial({ color: 0x33373e, gradientMap: this.toonGradient });
      }
    });

    registerMat('lampBulb', (type) => {
      if (type === 'standard') {
        return new THREE.MeshStandardMaterial({
          color: 0xfef08a,
          emissive: 0xfef08a,
          emissiveIntensity: 0.0,
          roughness: 0.2,
        });
      } else {
        return new THREE.MeshToonMaterial({
          color: 0xfef08a,
          emissive: 0xfef08a,
          emissiveIntensity: 0.0,
          gradientMap: this.toonGradient,
        });
      }
    });

    // Curated Cozy Palettes definition
    const COZY_PALETTES = [
      { wallColor: 0xb96350, roofColor: 0x38434c, trimColor: 0xf3e8cd, brickColor: 0x8e8170 }, // Terracotta and slate
      { wallColor: 0xd9b972, roofColor: 0x655345, trimColor: 0xffefd5, brickColor: 0x918374 }, // Warm ochre
      { wallColor: 0x92b9aa, roofColor: 0x3c5058, trimColor: 0xf4eddc, brickColor: 0x8c9088 }, // Sage and blue slate
      { wallColor: 0xe9dabe, roofColor: 0xa45e47, trimColor: 0xfff3db, brickColor: 0x988575 }  // Limestone and clay
    ];

    this.standardPalettes = COZY_PALETTES.map(p => ({
      wall: new THREE.MeshStandardMaterial({ color: p.wallColor, roughness: 0.6 }),
      roof: new THREE.MeshStandardMaterial({ color: p.roofColor, roughness: 0.7 }),
      trim: new THREE.MeshStandardMaterial({ color: p.trimColor, roughness: 0.5 }),
      brick: new THREE.MeshStandardMaterial({ color: p.brickColor, roughness: 0.8 })
    }));

    this.softToonPalettes = COZY_PALETTES.map(p => ({
      wall: softenMaterial('wall', new THREE.MeshStandardMaterial({ color: p.wallColor, roughness: 0.6 })),
      roof: softenMaterial('roof', new THREE.MeshStandardMaterial({ color: p.roofColor, roughness: 0.7 })),
      trim: softenMaterial('trim', new THREE.MeshStandardMaterial({ color: p.trimColor, roughness: 0.5 })),
      brick: softenMaterial('brick', new THREE.MeshStandardMaterial({ color: p.brickColor, roughness: 0.8 })),
    }));

    this.toonPalettes = COZY_PALETTES.map(p => ({
      wall: new THREE.MeshToonMaterial({ color: p.wallColor, gradientMap: this.toonGradient }),
      roof: new THREE.MeshToonMaterial({ color: p.roofColor, gradientMap: this.toonGradient }),
      trim: new THREE.MeshToonMaterial({ color: p.trimColor, gradientMap: this.toonGradient }),
      brick: new THREE.MeshToonMaterial({ color: p.brickColor, gradientMap: this.toonGradient })
    }));

    for (let i = 0; i < COZY_PALETTES.length; i++) {
      const std = this.standardPalettes[i];
      const softToon = this.softToonPalettes[i];
      const toon = this.toonPalettes[i];
      registerProfileTriplet(std.wall, softToon.wall, toon.wall);
      registerProfileTriplet(std.roof, softToon.roof, toon.roof);
      registerProfileTriplet(std.trim, softToon.trim, toon.trim);
      registerProfileTriplet(std.brick, softToon.brick, toon.brick);
    }

    // Curated Commercial Palettes
    const COMMERCIAL_PALETTES = [
      { wallColor: 0xdf8a6c, roofColor: 0x513829, trimColor: 0xfef3c7, accentColor: 0xcc5a37 }, // Bakery/Cafe: Peach/Warm wood/Cream/Orange
      { wallColor: 0x7aa874, roofColor: 0x3d5c36, trimColor: 0xf8fafc, accentColor: 0xe8db7d }, // Grocery/Flower: Sage/Forest/White/Lemon
      { wallColor: 0x486b7c, roofColor: 0x22323d, trimColor: 0xfef5e7, accentColor: 0xca8a04 }, // Bookstore: Deep blue/Slate/Warm-cream/Gold
      { wallColor: 0xe8ebeb, roofColor: 0xc2410c, trimColor: 0x1e293b, accentColor: 0xeab308 }, // Diner: Cream/Orange-red/Dark trim/Yellow
      { wallColor: 0xf3f4f6, roofColor: 0x4b5563, trimColor: 0x0ea5e9, accentColor: 0x0284c7 }  // Office Studio: Light Grey/Slate/Cyan/Blue
    ];

    this.standardCommercialPalettes = COMMERCIAL_PALETTES.map(p => ({
      wall: new THREE.MeshStandardMaterial({ color: p.wallColor, roughness: 0.5 }),
      roof: new THREE.MeshStandardMaterial({ color: p.roofColor, roughness: 0.7 }),
      trim: new THREE.MeshStandardMaterial({ color: p.trimColor, roughness: 0.4 }),
      accent: new THREE.MeshStandardMaterial({ color: p.accentColor, roughness: 0.6 }),
      brick: new THREE.MeshStandardMaterial({ color: p.roofColor, roughness: 0.8 })
    }));

    this.softToonCommercialPalettes = COMMERCIAL_PALETTES.map(p => ({
      wall: softenMaterial('wall', new THREE.MeshStandardMaterial({ color: p.wallColor, roughness: 0.5 })),
      roof: softenMaterial('roof', new THREE.MeshStandardMaterial({ color: p.roofColor, roughness: 0.7 })),
      trim: softenMaterial('trim', new THREE.MeshStandardMaterial({ color: p.trimColor, roughness: 0.4 })),
      accent: softenMaterial('accent', new THREE.MeshStandardMaterial({ color: p.accentColor, roughness: 0.6 })),
      brick: softenMaterial('brick', new THREE.MeshStandardMaterial({ color: p.roofColor, roughness: 0.8 })),
    }));

    this.toonCommercialPalettes = COMMERCIAL_PALETTES.map(p => ({
      wall: new THREE.MeshToonMaterial({ color: p.wallColor, gradientMap: this.toonGradient }),
      roof: new THREE.MeshToonMaterial({ color: p.roofColor, gradientMap: this.toonGradient }),
      trim: new THREE.MeshToonMaterial({ color: p.trimColor, gradientMap: this.toonGradient }),
      accent: new THREE.MeshToonMaterial({ color: p.accentColor, gradientMap: this.toonGradient }),
      brick: new THREE.MeshToonMaterial({ color: p.roofColor, gradientMap: this.toonGradient })
    }));

    for (let i = 0; i < COMMERCIAL_PALETTES.length; i++) {
      const std = this.standardCommercialPalettes[i];
      const softToon = this.softToonCommercialPalettes[i];
      const toon = this.toonCommercialPalettes[i];
      registerProfileTriplet(std.wall, softToon.wall, toon.wall);
      registerProfileTriplet(std.roof, softToon.roof, toon.roof);
      registerProfileTriplet(std.trim, softToon.trim, toon.trim);
      registerProfileTriplet(std.accent, softToon.accent, toon.accent);
      registerProfileTriplet(std.brick, softToon.brick, toon.brick);
    }

    // Residential Colors (cozy pastels - fallbacks/legacy)
    registerMat('wallRes1', (type) => type === 'standard' ? new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.6 }) : new THREE.MeshToonMaterial({ color: 0xfef3c7, gradientMap: this.toonGradient }));
    registerMat('wallRes2', (type) => type === 'standard' ? new THREE.MeshStandardMaterial({ color: 0xe0f2fe, roughness: 0.6 }) : new THREE.MeshToonMaterial({ color: 0xe0f2fe, gradientMap: this.toonGradient }));
    registerMat('wallRes3', (type) => type === 'standard' ? new THREE.MeshStandardMaterial({ color: 0xfce7f3, roughness: 0.6 }) : new THREE.MeshToonMaterial({ color: 0xfce7f3, gradientMap: this.toonGradient }));
    registerMat('roof', (type) => type === 'standard' ? new THREE.MeshStandardMaterial({ color: 0xe11d48, roughness: 0.7 }) : new THREE.MeshToonMaterial({ color: 0xe11d48, gradientMap: this.toonGradient }));

    // Commercial Colors (modern and sleek)
    registerMat('wallCom', (type) => type === 'standard' ? new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.4 }) : new THREE.MeshToonMaterial({ color: 0x64748b, gradientMap: this.toonGradient }));

    registerMat('glass', (type) => {
      if (type === 'standard') {
        return new THREE.MeshStandardMaterial({
          color: 0x38bdf8,
          roughness: 0.1,
          metalness: 0.9,
          transparent: true,
          opacity: 0.7,
        });
      } else {
        return new THREE.MeshToonMaterial({
          color: 0x38bdf8,
          gradientMap: this.toonGradient,
          transparent: true,
          opacity: 0.7,
        });
      }
    });

    // Industrial Colors
    registerMat('wallInd', (type) => type === 'standard' ? new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.7 }) : new THREE.MeshToonMaterial({ color: 0x475569, gradientMap: this.toonGradient }));
    registerMat('metal', (type) => type === 'standard' ? new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.3, metalness: 0.8 }) : new THREE.MeshToonMaterial({ color: 0x94a3b8, gradientMap: this.toonGradient }));

    // Zoned Empty Boundaries
    registerBasicMat('zoneR', new THREE.MeshBasicMaterial({ color: 0x10b981, wireframe: true }));
    registerBasicMat('zoneC', new THREE.MeshBasicMaterial({ color: 0x3b82f6, wireframe: true }));
    registerBasicMat('zoneI', new THREE.MeshBasicMaterial({ color: 0xeab308, wireframe: true }));

    // Wood & Leaves
    registerMat('trunk', (type) => type === 'standard' ? new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.9 }) : new THREE.MeshToonMaterial({ color: 0x78350f, gradientMap: this.toonGradient }));
    registerMat('leaves', (type) => type === 'standard' ? new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.8 }) : new THREE.MeshToonMaterial({ color: 0x16a34a, gradientMap: this.toonGradient }));
    registerMat('blossom', (type) => type === 'standard' ? new THREE.MeshStandardMaterial({ color: 0xf472b6, roughness: 0.8 }) : new THREE.MeshToonMaterial({ color: 0xf472b6, gradientMap: this.toonGradient }));
    registerMat('darkVoid', (type) => type === 'standard' ? new THREE.MeshStandardMaterial({ color: 0x120c08, roughness: 0.95 }) : new THREE.MeshToonMaterial({ color: 0x120c08, gradientMap: this.toonGradient }));

    // Environment scenery uses a deliberately restrained palette so procedural
    // understory sits between grass and tree canopies instead of competing with
    // buildings. These stay in the normal profile registry: instanced scenery
    // pools therefore switch standard/soft-toon/toon without a recipe rebuild.
    registerMat('bush', (type) => type === 'standard'
      ? new THREE.MeshStandardMaterial({ color: 0x72bd62, roughness: 0.9 })
      : new THREE.MeshToonMaterial({ color: 0x72bd62, gradientMap: this.toonGradient }));
    registerMat('shrub', (type) => type === 'standard'
      ? new THREE.MeshStandardMaterial({ color: 0x91cf70, roughness: 0.94 })
      : new THREE.MeshToonMaterial({ color: 0x91cf70, gradientMap: this.toonGradient }));
    registerMat('stone', (type) => type === 'standard'
      ? new THREE.MeshStandardMaterial({ color: 0x70716d, roughness: 0.96 })
      : new THREE.MeshToonMaterial({ color: 0x70716d, gradientMap: this.toonGradient }));

    // Utilities
    registerMat('whiteMetal', (type) => type === 'standard' ? new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4, metalness: 0.3 }) : new THREE.MeshToonMaterial({ color: 0xf8fafc, gradientMap: this.toonGradient }));
    registerMat('cement', (type) => type === 'standard' ? new THREE.MeshStandardMaterial({ color: 0x8e929b, roughness: 0.85 }) : new THREE.MeshToonMaterial({ color: 0x8e929b, gradientMap: this.toonGradient }));
    registerMat('constructionFoundation', (type) => type === 'standard' ? new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.92, metalness: 0.05 }) : new THREE.MeshToonMaterial({ color: 0x64748b, gradientMap: this.toonGradient }));
    registerMat('constructionFrame', (type) => type === 'standard' ? new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.7, metalness: 0.08 }) : new THREE.MeshToonMaterial({ color: 0xf59e0b, gradientMap: this.toonGradient }));

    const applyWaterOnBeforeCompile = (shader: any, mat: THREE.Material) => {
      if (!mat.userData.uTime) {
        mat.userData.uTime = { value: 0 };
      }
      shader.uniforms.uTime = mat.userData.uTime;
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
           uniform float uTime;
           varying vec3 vWaterWorldPos;`
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
           vec4 worldPos = modelMatrix * vec4( transformed, 1.0 );
           float rawWave = sin(worldPos.x * 1.35 + worldPos.z * 0.72 + uTime * 1.70) * 0.028
             + cos(worldPos.z * 1.62 - worldPos.x * 0.48 + uTime * 1.25) * 0.023;
           // The water plane sits 0.04 below terrain. Compress crests so even
           // the theoretical maximum stays submerged, while extending troughs
           // to preserve strong faceted motion without flooding the bank.
           float wave = max(rawWave, 0.0) * 0.58 + min(rawWave, 0.0) * 1.25;
           transformed += normal * wave;
           vWaterWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
           uniform float uTime;
           varying vec3 vWaterWorldPos;
           vec3 waterFaceNormal;

           float waterFacetHash(vec2 p) {
             // Interleaved gradient noise: stable pseudo-random variation made
             // from dot/fract only, avoiding a trigonometric call per fragment.
             return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715))));
           }`
        )
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
           // A world-space triangular mosaic gives the flat surface the same
           // chunky visual language as the terrain. It remains seamless across
           // water tiles and costs only scalar arithmetic: no texture lookup,
           // reflection, noise octave, or per-pixel sine wave.
           vec2 facetGrid = vec2(
             dot(vWaterWorldPos.xz, vec2(0.72, 0.25)),
             dot(vWaterWorldPos.xz, vec2(-0.25, 0.72))
           );
           vec2 facetCell = floor(facetGrid);
           vec2 facetLocal = fract(facetGrid);
           float triangle = step(facetLocal.x, facetLocal.y);
           vec2 triangleId = facetCell + vec2(triangle * 0.43, triangle * 0.71);
           float facetBand = floor(waterFacetHash(triangleId) * 3.0) * 0.5;

           vec3 coolFacet = vec3(0.87, 0.96, 1.06);
           vec3 warmFacet = vec3(1.03, 1.02, 0.94);
           vec3 waterTint = mix(coolFacet, warmFacet, facetBand);

           diffuseColor.rgb *= waterTint;
           // Use the displaced triangle itself as the detail. Its derivative
           // normal gives rising and falling wave faces contrasting tones,
           // without drawn marks, normal maps, or texture reads.
           waterFaceNormal = normalize(cross(dFdx(vWaterWorldPos), dFdy(vWaterWorldPos)));
           if (waterFaceNormal.y < 0.0) waterFaceNormal *= -1.0;
           float faceTilt = dot(waterFaceNormal.xz, normalize(vec2(-0.72, 0.69)));
           float faceContrast = clamp(faceTilt * 1.35, -0.12, 0.12);
           diffuseColor.rgb *= 1.0 + faceContrast;`
        )
        .replace(
          '#include <normal_fragment_begin>',
          `#include <normal_fragment_begin>
           // Feed the real displaced face normal into Standard and Toon
           // lighting so the animated geometry, rather than a decal, reads.
           normal = gl_FrontFacing ? waterFaceNormal : -waterFaceNormal;`
        );
    };

    const applyWaterShoreFoamOnBeforeCompile = (shader: any, mat: THREE.Material, style: 'outer' | 'inner') => {
      if (!mat.userData.uTime) {
        mat.userData.uTime = { value: 0 };
      }
      shader.uniforms.uTime = mat.userData.uTime;
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
           uniform float uTime;
           attribute float aShoreFoamFade;
           attribute float aShoreBandCoord;
           attribute float aShoreEndFade;
           varying vec3 vShoreWorldPos;
           varying float vShoreBandCoord;
           varying float vShoreEndFade;

           vec2 shoreTerrainContour(vec2 p) {
             return vec2(
               sin(p.y * 2.5 + p.x * 0.8) * cos(p.x * 1.2) * 0.22,
               cos(p.x * 2.5 + p.y * 0.8) * sin(p.y * 1.2) * 0.22
             );
           }`
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
           // Lock both shoreline layers to the same deterministic horizontal
           // contour as the exposed grass edge; synchronized vertical motion
           // is applied below.
           vec4 shoreWorldPos = modelMatrix * vec4(transformed, 1.0);
           vShoreBandCoord = aShoreBandCoord;
           vShoreEndFade = aShoreEndFade;
           transformed.xz += shoreTerrainContour(shoreWorldPos.xz) * aShoreFoamFade;`
        );
      shader.vertexShader = shader.vertexShader.replace(
        'transformed.xz += shoreTerrainContour(shoreWorldPos.xz) * aShoreFoamFade;',
        `transformed.xz += shoreTerrainContour(shoreWorldPos.xz) * aShoreFoamFade;
         vec4 wavedShorePos = modelMatrix * vec4(transformed, 1.0);
         // Both shoreline layers use the exact bounded surface displacement,
         // keeping the contact lip synchronized with passing wave faces.
         float rawShoreWave = (
           sin(wavedShorePos.x * 1.35 + wavedShorePos.z * 0.72 + uTime * 1.70) * 0.028
           + cos(wavedShorePos.z * 1.62 - wavedShorePos.x * 0.48 + uTime * 1.25) * 0.023
         );
         float shoreWave = (
           max(rawShoreWave, 0.0) * 0.58 + min(rawShoreWave, 0.0) * 1.25
         );
         transformed += normal * shoreWave;
         vShoreWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`
      );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
           uniform float uTime;
           varying vec3 vShoreWorldPos;
           varying float vShoreBandCoord;
           varying float vShoreEndFade;

           float shorePulseHash(float cell) {
             return fract(52.9829189 * fract(cell * 0.06711056));
           }`
        )
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
           // World-coordinate modulation stays continuous across separately
           // merged tile strips and around convex or concave shoreline turns.
           float shoreCoord = (vShoreWorldPos.x + vShoreWorldPos.z) * 0.92 - uTime * 0.075;
           float shoreCell = floor(shoreCoord);
           float shorePhase = fract(shoreCoord + shorePulseHash(shoreCell) * 0.28);
           float shorePulse = smoothstep(0.08, 0.24, shorePhase)
             * (1.0 - smoothstep(0.62, 0.84, shorePhase));

           ${style === 'inner'
             ? `// The inset wash resolves into drifting turquoise segments,
           // suggesting water rolling back from the bank rather than a second outline.
           float bandProfile = smoothstep(0.02, 0.24, vShoreBandCoord)
             * (1.0 - smoothstep(0.76, 0.98, vShoreBandCoord));
           float washPulse = smoothstep(0.14, 0.28, shorePhase)
             * (1.0 - smoothstep(0.42, 0.60, shorePhase));
           diffuseColor.rgb *= mix(vec3(0.80, 1.01, 1.08), vec3(1.04, 1.13, 1.08), washPulse);
           diffuseColor.a *= bandProfile * vShoreEndFade * (0.03 + washPulse * 0.66);`
             : `// The bank-contact lip always remains present, with warmer
           // pulses travelling through it so the edge feels alive but stable.
           float bandCenter = 1.0 - abs(vShoreBandCoord * 2.0 - 1.0);
           diffuseColor.rgb *= mix(vec3(0.94, 1.01, 1.03), vec3(1.09, 1.09, 0.99), shorePulse * 0.42 + bandCenter * 0.10);
           diffuseColor.a *= 0.76 + shorePulse * 0.24;`}`
        );
    };

    registerMat('waterBlue', (type) => {
      if (type === 'standard') {
        const mat = new THREE.MeshStandardMaterial({
          color: 0x0588bd,
          roughness: 0.40,
          metalness: 0.04,
          transparent: true,
          opacity: 0.87,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        mat.userData.uTime = { value: 0 };
        mat.onBeforeCompile = (shader) => applyWaterOnBeforeCompile(shader, mat);
        return mat;
      } else {
        const mat = new THREE.MeshToonMaterial({
          color: 0x0588bd,
          gradientMap: this.toonGradient,
          transparent: true,
          opacity: 0.87,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        mat.userData.uTime = { value: 0 };
        mat.onBeforeCompile = (shader) => applyWaterOnBeforeCompile(shader, mat);
        return mat;
      }
    });

    // A solid, faceted shoreline light edge. It is instanced along every
    // exposed water edge, including boardwalk-facing edges; water-to-water
    // joins and bridge spans remain uninterrupted.
    registerMat('waterShoreFoam', (type) => {
      const material = type === 'standard'
        ? new THREE.MeshStandardMaterial({
          color: 0xb9e3e8,
          roughness: 0.72,
          metalness: 0,
          transparent: true,
          opacity: 0.84,
          depthWrite: false,
          side: THREE.DoubleSide,
        })
        : new THREE.MeshToonMaterial({
          color: 0xb9e3e8,
          gradientMap: this.toonGradient,
          transparent: true,
          opacity: 0.84,
          depthWrite: false,
          side: THREE.DoubleSide,
        });
      material.userData.uTime = { value: 0 };
      material.onBeforeCompile = (shader) => applyWaterShoreFoamOnBeforeCompile(shader, material, 'outer');
      return material;
    });

    // A quieter companion band sits one line-width into the water. It shares
    // the same shader and geometry budget as the shoreline line, but its lower
    // alpha makes it read as a soft shallow-water transition rather than foam.
    registerMat('waterShoreFoamInner', (type) => {
      const material = type === 'standard'
        ? new THREE.MeshStandardMaterial({
          color: 0x3fa9bf,
          roughness: 0.72,
          metalness: 0,
          transparent: true,
          opacity: 0.32,
          depthWrite: false,
          side: THREE.DoubleSide,
        })
        : new THREE.MeshToonMaterial({
          color: 0x3fa9bf,
          gradientMap: this.toonGradient,
          transparent: true,
          opacity: 0.32,
          depthWrite: false,
          side: THREE.DoubleSide,
        });
      material.userData.uTime = { value: 0 };
      material.onBeforeCompile = (shader) => applyWaterShoreFoamOnBeforeCompile(shader, material, 'inner');
      return material;
    });

    // Vegetation Materials (Seeded water features)
    registerMat('lotusPink', (type) => type === 'standard' ? new THREE.MeshStandardMaterial({ color: 0xf472b6, roughness: 0.6 }) : new THREE.MeshToonMaterial({ color: 0xf472b6, gradientMap: this.toonGradient }));
    registerMat('lilypadGreen', (type) => type === 'standard' ? new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.9 }) : new THREE.MeshToonMaterial({ color: 0x15803d, gradientMap: this.toonGradient }));
    registerMat('cattailBrown', (type) => type === 'standard' ? new THREE.MeshStandardMaterial({ color: 0x5c2d17, roughness: 0.9 }) : new THREE.MeshToonMaterial({ color: 0x5c2d17, gradientMap: this.toonGradient }));
    registerMat('reedGreen', (type) => type === 'standard' ? new THREE.MeshStandardMaterial({ color: 0x166534, roughness: 0.95 }) : new THREE.MeshToonMaterial({ color: 0x166534, gradientMap: this.toonGradient }));

    // Windows (Glowing at night)
    registerMat('window', (type) => {
      if (type === 'standard') {
        return new THREE.MeshStandardMaterial({
          color: 0xfef08a,
          emissive: 0xfef08a,
          emissiveIntensity: 0.0, // Day mode: 0, Night mode: 1.0+
          roughness: 0.2,
        });
      } else {
        return new THREE.MeshToonMaterial({
          color: 0xfef08a,
          emissive: 0xfef08a,
          emissiveIntensity: 0.0,
          gradientMap: this.toonGradient,
        });
      }
    });

    // Fairy lights (glowing orange/yellow bulbs)
    registerMat('fairyLight', (type) => {
      if (type === 'standard') {
        return new THREE.MeshStandardMaterial({
          color: 0xfdba74,
          emissive: 0xfdba74,
          emissiveIntensity: 0.0,
          roughness: 0.2,
        });
      } else {
        return new THREE.MeshToonMaterial({
          color: 0xfdba74,
          emissive: 0xfdba74,
          emissiveIntensity: 0.0,
          gradientMap: this.toonGradient,
        });
      }
    });

    // Traffic Materials
    registerMat('wheel', (type) => type === 'standard' ? new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.9 }) : new THREE.MeshToonMaterial({ color: 0x1e293b, gradientMap: this.toonGradient }));

    registerMat('headlight', (type) => {
      if (type === 'standard') {
        return new THREE.MeshStandardMaterial({
          color: 0xfefbaf,
          emissive: 0xfefbaf,
          emissiveIntensity: 0.0,
          roughness: 0.1,
        });
      } else {
        return new THREE.MeshToonMaterial({
          color: 0xfefbaf,
          emissive: 0xfefbaf,
          emissiveIntensity: 0.0,
          gradientMap: this.toonGradient,
        });
      }
    });

    registerMat('taillight', (type) => {
      if (type === 'standard') {
        return new THREE.MeshStandardMaterial({
          color: 0xef4444,
          emissive: 0xef4444,
          emissiveIntensity: 0.0,
          roughness: 0.1,
        });
      } else {
        return new THREE.MeshToonMaterial({
          color: 0xef4444,
          emissive: 0xef4444,
          emissiveIntensity: 0.0,
          gradientMap: this.toonGradient,
        });
      }
    });

    // Preset car body colors
    registerMat('carRed', (type) => type === 'standard' ? new THREE.MeshStandardMaterial({ color: 0xe11d48, roughness: 0.5 }) : new THREE.MeshToonMaterial({ color: 0xe11d48, gradientMap: this.toonGradient }));
    registerMat('carBlue', (type) => type === 'standard' ? new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.5 }) : new THREE.MeshToonMaterial({ color: 0x2563eb, gradientMap: this.toonGradient }));
    registerMat('carYellow', (type) => type === 'standard' ? new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.5 }) : new THREE.MeshToonMaterial({ color: 0xd97706, gradientMap: this.toonGradient }));
    registerMat('carGreen', (type) => type === 'standard' ? new THREE.MeshStandardMaterial({ color: 0x059669, roughness: 0.5 }) : new THREE.MeshToonMaterial({ color: 0x059669, gradientMap: this.toonGradient }));
    registerMat('carOrange', (type) => type === 'standard' ? new THREE.MeshStandardMaterial({ color: 0xea580c, roughness: 0.5 }) : new THREE.MeshToonMaterial({ color: 0xea580c, gradientMap: this.toonGradient }));
    registerMat('carWhite', (type) => type === 'standard' ? new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.5 }) : new THREE.MeshToonMaterial({ color: 0xe2e8f0, gradientMap: this.toonGradient }));

    // Citizen Materials
    registerMat('citizenSkinLight', (type) => type === 'standard' ? new THREE.MeshStandardMaterial({ color: 0xfddcb4, roughness: 0.8 }) : new THREE.MeshToonMaterial({ color: 0xfddcb4, gradientMap: this.toonGradient }));
    registerMat('citizenSkinDark', (type) => type === 'standard' ? new THREE.MeshStandardMaterial({ color: 0x8d5b4c, roughness: 0.8 }) : new THREE.MeshToonMaterial({ color: 0x8d5b4c, gradientMap: this.toonGradient }));
    registerMat('citizenHairBrown', (type) => type === 'standard' ? new THREE.MeshStandardMaterial({ color: 0x452a1e, roughness: 0.8 }) : new THREE.MeshToonMaterial({ color: 0x452a1e, gradientMap: this.toonGradient }));
    registerMat('citizenHairBlack', (type) => type === 'standard' ? new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 }) : new THREE.MeshToonMaterial({ color: 0x111111, gradientMap: this.toonGradient }));
    registerMat('citizenHairBlonde', (type) => type === 'standard' ? new THREE.MeshStandardMaterial({ color: 0xf5dd90, roughness: 0.8 }) : new THREE.MeshToonMaterial({ color: 0xf5dd90, gradientMap: this.toonGradient }));
    registerMat('citizenJeans', (type) => type === 'standard' ? new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.7 }) : new THREE.MeshToonMaterial({ color: 0x3b82f6, gradientMap: this.toonGradient }));

    this.setMaterialProfile(this.materialProfile);
  }

  setMaterialProfile(profile: MaterialProfile) {
    this.materialProfile = profile;
    if (profile === 'toon') {
      this.materials = this.toonMaterials;
      this.palettes = this.toonPalettes;
      this.commercialPalettes = this.toonCommercialPalettes;
    } else if (profile === 'standard') {
      this.materials = this.standardMaterials;
      this.palettes = this.standardPalettes;
      this.commercialPalettes = this.standardCommercialPalettes;
    } else {
      this.materials = this.softToonMaterials;
      this.palettes = this.softToonPalettes;
      this.commercialPalettes = this.softToonCommercialPalettes;
    }
  }

  // Retained for callers that only need the legacy standard/toon comparison.
  setCelShading(enabled: boolean) {
    this.setMaterialProfile(enabled ? 'toon' : 'standard');
  }

  getMaterialForProfile(material: THREE.Material, profile = this.materialProfile): THREE.Material {
    return this.materialProfileMap.get(material)?.[profile] ?? material;
  }

  getAllSharedMaterials(): Set<THREE.Material> {
    const materials = new Set<THREE.Material>();
    [this.standardMaterials, this.softToonMaterials, this.toonMaterials].forEach(collection => {
      Object.values(collection).forEach(material => materials.add(material));
    });
    [
      this.standardPalettes, this.softToonPalettes, this.toonPalettes,
      this.standardCommercialPalettes, this.softToonCommercialPalettes, this.toonCommercialPalettes,
    ].forEach(palettes => palettes.forEach(palette => Object.values(palette).forEach(material => materials.add(material))));
    return materials;
  }

  // Set emissive intensity of windows & headlights (0.0 for day, 1.2+ for night)
  setNightMode(isNight: boolean) {
    if (this.isNightMode === isNight) return;
    this.isNightMode = isNight;

    // Animate standard materials
    const winMatStd = this.standardMaterials.window as any;
    if (winMatStd) gsapAnimate(winMatStd, 'emissiveIntensity', isNight ? 1.4 : 0.0, 1.5);
    const headMatStd = this.standardMaterials.headlight as any;
    if (headMatStd) gsapAnimate(headMatStd, 'emissiveIntensity', isNight ? 2.5 : 0.0, 1.5);
    const tailMatStd = this.standardMaterials.taillight as any;
    if (tailMatStd) gsapAnimate(tailMatStd, 'emissiveIntensity', isNight ? 1.8 : 0.0, 1.5);
    const fairyMatStd = this.standardMaterials.fairyLight as any;
    if (fairyMatStd) gsapAnimate(fairyMatStd, 'emissiveIntensity', isNight ? 2.0 : 0.0, 1.5);
    const lampMatStd = this.standardMaterials.lampBulb as any;
    if (lampMatStd) gsapAnimate(lampMatStd, 'emissiveIntensity', isNight ? 2.2 : 0.0, 1.5);

    // Animate toon materials
    const winMatToon = this.toonMaterials.window as any;
    if (winMatToon) gsapAnimate(winMatToon, 'emissiveIntensity', isNight ? 1.4 : 0.0, 1.5);
    const headMatToon = this.toonMaterials.headlight as any;
    if (headMatToon) gsapAnimate(headMatToon, 'emissiveIntensity', isNight ? 2.5 : 0.0, 1.5);
    const tailMatToon = this.toonMaterials.taillight as any;
    if (tailMatToon) gsapAnimate(tailMatToon, 'emissiveIntensity', isNight ? 1.8 : 0.0, 1.5);
    const fairyMatToon = this.toonMaterials.fairyLight as any;
    if (fairyMatToon) gsapAnimate(fairyMatToon, 'emissiveIntensity', isNight ? 2.0 : 0.0, 1.5);
    const lampMatToon = this.toonMaterials.lampBulb as any;
    if (lampMatToon) gsapAnimate(lampMatToon, 'emissiveIntensity', isNight ? 2.2 : 0.0, 1.5);

    const winMatSoftToon = this.softToonMaterials.window as any;
    if (winMatSoftToon) gsapAnimate(winMatSoftToon, 'emissiveIntensity', isNight ? 1.4 : 0.0, 1.5);
    const headMatSoftToon = this.softToonMaterials.headlight as any;
    if (headMatSoftToon) gsapAnimate(headMatSoftToon, 'emissiveIntensity', isNight ? 2.5 : 0.0, 1.5);
    const tailMatSoftToon = this.softToonMaterials.taillight as any;
    if (tailMatSoftToon) gsapAnimate(tailMatSoftToon, 'emissiveIntensity', isNight ? 1.8 : 0.0, 1.5);
    const fairyMatSoftToon = this.softToonMaterials.fairyLight as any;
    if (fairyMatSoftToon) gsapAnimate(fairyMatSoftToon, 'emissiveIntensity', isNight ? 2.0 : 0.0, 1.5);
    const lampMatSoftToon = this.softToonMaterials.lampBulb as any;
    if (lampMatSoftToon) gsapAnimate(lampMatSoftToon, 'emissiveIntensity', isNight ? 2.2 : 0.0, 1.5);
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
    // Dense only across the maximum 3.2-unit terrain drop; the final row preserves deep underfill.
    return this.getGeometry('ground_geo_sub2_nonuniform_vertical_facets', () => {
      const boxHeight = 12.0;
      const verticalLevels = [0, -0.4, -0.8, -1.2, -1.6, -2.0, -2.4, -2.8, -3.2, -boxHeight];
      const verticalSegments = verticalLevels.length - 1;
      // Give each triangle its own vertices so the shader can assign a stable
      // flat facet value. This geometry is shared by all terrain instances,
      // so the small vertex increase does not scale with map size.
      const indexedGeo = new THREE.BoxGeometry(2, boxHeight, 2, 2, verticalSegments, 2);
      const geo = indexedGeo.toNonIndexed();
      indexedGeo.dispose();
      // Align top of box to y=0
      geo.translate(0, -boxHeight / 2, 0);

      // BoxGeometry creates evenly spaced rows. Remap them so terrain tiers and their
      // 0.4-unit wobble midpoints have real vertices without subdividing the deep underfill.
      const positions = geo.getAttribute('position') as THREE.BufferAttribute;
      const sourceStep = boxHeight / verticalSegments;
      for (let index = 0; index < positions.count; index++) {
        const row = Math.round(-positions.getY(index) / sourceStep);
        positions.setY(index, verticalLevels[Math.max(0, Math.min(verticalSegments, row))]);
      }
      positions.needsUpdate = true;
      const facetIds = new Float32Array(positions.count);
      for (let vertex = 0; vertex < positions.count; vertex += 3) {
        const facet = vertex / 3;
        facetIds[vertex] = facet;
        facetIds[vertex + 1] = facet;
        facetIds[vertex + 2] = facet;
      }
      geo.setAttribute('aTerrainFacet', new THREE.BufferAttribute(facetIds, 1));
      geo.computeBoundingBox();
      geo.computeBoundingSphere();
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

  /**
   * Shared, baked-at-origin parts for the renderer-owned environment pools.
   * The geometry is intentionally cached here rather than in EnvironmentScenery:
   * it has the same lifecycle as every other procedural asset and is included in
   * Renderer.disposeObject3D's shared-geometry exclusion set.
   */
  getEnvironmentTreeGeometry(part: 'trunk' | 'conifer' | 'broadleaf' | 'blossom'): THREE.BufferGeometry {
    const key = part === 'trunk'
      ? 'env_tree_trunk'
      : part === 'conifer'
        ? 'env_conifer_crown'
        : part === 'broadleaf'
          ? 'env_broadleaf_crown'
          : 'env_blossom_crown';

    return this.getGeometry(key, () => {
      if (part === 'trunk') {
        const geometry = new THREE.CylinderGeometry(0.095, 0.145, 0.86, 5);
        geometry.translate(0, 0.43, 0);
        return geometry;
      }

      if (part === 'conifer') {
        const tiers = [
          { radius: 0.44, height: 0.56, y: 0.86, x: 0.015, z: -0.025 },
          { radius: 0.34, height: 0.54, y: 1.18, x: -0.025, z: 0.018 },
          { radius: 0.23, height: 0.50, y: 1.48, x: 0.018, z: 0.010 },
        ].map(tier => {
          const geometry = new THREE.ConeGeometry(tier.radius, tier.height, 6);
          geometry.translate(tier.x, tier.y, tier.z);
          return geometry;
        });
        const merged = BufferGeometryUtils.mergeGeometries(tiers, false);
        tiers.forEach(geometry => geometry.dispose());
        if (!merged) throw new Error('Unable to merge conifer crown geometry');
        merged.computeVertexNormals();
        return merged;
      }

      const crowns = [
        { radius: 0.38, x: -0.19, y: 1.10, z: -0.04 },
        { radius: 0.46, x: 0.14, y: 1.16, z: 0.03 },
        { radius: 0.32, x: 0.01, y: 1.42, z: -0.02 },
      ].map(crown => {
        const geometry = new THREE.DodecahedronGeometry(crown.radius, 0);
        geometry.scale(1, 0.92, 0.94);
        geometry.translate(crown.x, crown.y, crown.z);
        return geometry;
      });
      const merged = BufferGeometryUtils.mergeGeometries(crowns, false);
      crowns.forEach(geometry => geometry.dispose());
      if (!merged) throw new Error('Unable to merge broadleaf crown geometry');
      merged.computeVertexNormals();
      return merged;
    });
  }

  /** Returns the crown asset appropriate for an environment tree family. */
  getEnvironmentTreeCrownGeometry(family: EnvironmentTreeFamily, blossom = false): THREE.BufferGeometry {
    if (blossom) return this.getEnvironmentTreeGeometry('blossom');
    return this.getEnvironmentTreeGeometry(family === 'conifer' ? 'conifer' : 'broadleaf');
  }

  /**
   * Convenience factory for non-instanced callers (parks and previews). World
   * scenery should use the cached geometry getters above with InstancedMesh.
   */
  createEnvironmentTreeMesh(family: EnvironmentTreeFamily = 'broadleaf', blossom = false): THREE.Group {
    const group = new THREE.Group();
    const trunk = new THREE.Mesh(this.getEnvironmentTreeGeometry('trunk'), this.materials.trunk);
    const crown = new THREE.Mesh(this.getEnvironmentTreeCrownGeometry(family, blossom), blossom ? this.materials.blossom : this.materials.leaves);
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    crown.castShadow = true;
    crown.receiveShadow = true;
    if (family === 'slender') {
      crown.scale.set(0.68, 1.22, 0.68);
      crown.position.y = 0.15;
    }
    group.add(trunk, crown);
    return group;
  }

  getEnvironmentBushGeometry(kind: 'bush' | 'shrub'): THREE.BufferGeometry {
    const key = kind === 'bush' ? 'env_bush_cluster' : 'env_shrub_cluster';
    return this.getGeometry(key, () => {
      // A radial cluster of pointed leaves reads as a planted bush at gameplay
      // distance. The previous dodecahedron lobes read more like green rocks.
      const leafCount = kind === 'bush' ? 7 : 6;
      const leafHeight = kind === 'bush' ? 0.46 : 0.34;
      const leafRadius = kind === 'bush' ? 0.115 : 0.105;
      const baseRadius = kind === 'bush' ? 0.10 : 0.15;
      const lean = kind === 'bush' ? 0.58 : 0.82;
      const geometries: THREE.BufferGeometry[] = [];

      for (let index = 0; index < leafCount; index++) {
        const angle = (index / leafCount) * Math.PI * 2 + (kind === 'bush' ? 0.14 : 0.34);
        const height = leafHeight * (0.82 + (index % 3) * 0.09);
        const leaf = new THREE.ConeGeometry(leafRadius * (0.88 + (index % 2) * 0.12), height, 5);
        // Put the base at the local origin before tilting, so every leaf grows
        // outward from the cluster rather than orbiting around its centre.
        leaf.translate(0, height / 2, 0);
        leaf.rotateZ(-Math.cos(angle) * lean);
        leaf.rotateX(Math.sin(angle) * lean);
        leaf.translate(Math.cos(angle) * baseRadius, 0, Math.sin(angle) * baseRadius);
        geometries.push(leaf);
      }

      // One shorter upright leaf gives the cluster a visible centre without
      // returning to the rounded, stone-like silhouette.
      const centerLeaf = new THREE.ConeGeometry(leafRadius * 0.86, leafHeight * 0.78, 5);
      centerLeaf.translate(0, leafHeight * 0.39, 0);
      geometries.push(centerLeaf);

      const merged = BufferGeometryUtils.mergeGeometries(geometries, false);
      geometries.forEach(geometry => geometry.dispose());
      if (!merged) throw new Error(`Unable to merge ${kind} cluster geometry`);
      merged.computeVertexNormals();
      return merged;
    });
  }

  getEnvironmentRockGeometry(variant: 0 | 1 | 2): THREE.BufferGeometry {
    return this.getGeometry(`env_rock_${variant}`, () => {
      const source = new THREE.IcosahedronGeometry(1, 1).toNonIndexed();
      const position = source.getAttribute('position') as THREE.BufferAttribute;
      const shape = [
        { sx: 0.54, sy: 0.31, sz: 0.46, floor: -0.58 },
        { sx: 0.47, sy: 0.54, sz: 0.43, floor: -0.62 },
        { sx: 0.64, sy: 0.44, sz: 0.54, floor: -0.60 },
      ][variant];

      for (let i = 0; i < position.count; i++) {
        const x = position.getX(i);
        const y = position.getY(i);
        const z = position.getZ(i);
        // Coordinate-derived deformation gives three repeatable faceted stones
        // without retaining a per-instance random state or texture.
        const radial = 0.87 + 0.16 * Math.sin(x * 19.7 + y * 11.3 + z * (7.1 + variant * 2.9));
        position.setXYZ(
          i,
          x * radial * shape.sx,
          Math.max(y * radial, shape.floor) * shape.sy,
          z * radial * shape.sz,
        );
      }
      position.needsUpdate = true;
      source.computeVertexNormals();
      source.computeBoundingBox();
      // All environment props use their tile elevation as the instance origin.
      // Put the flattened stone base exactly on that origin so lowering/raising
      // land cannot leave a visible seam below it.
      source.translate(0, -(source.boundingBox?.min.y ?? 0), 0);
      source.computeBoundingBox();
      source.computeBoundingSphere();
      return source;
    });
  }

  /**
   * One grouped geometry for a small cattail/reed composition. Group 0 is
   * reedGreen and group 1 is cattailBrown; this maps directly to an
   * InstancedMesh material array.
   */
  getEnvironmentPlantGeometry(kind: EnvironmentPlantGeometry): THREE.BufferGeometry {
    const key = kind;
    return this.getGeometry(key, () => {
      if (kind === 'env_reed_clump') {
        const reedParts: THREE.BufferGeometry[] = [];
        const cattailParts: THREE.BufferGeometry[] = [];
        const layout = [
          [-0.20, -0.05, 0.67, -0.13], [-0.06, 0.10, 0.78, 0.10],
          [0.14, -0.10, 0.61, -0.08], [0.23, 0.13, 0.72, 0.14],
          [0.02, -0.20, 0.57, 0.05],
        ] as const;
        layout.forEach(([x, z, height, lean]) => {
          const stem = new THREE.CylinderGeometry(0.012, 0.017, height, 4);
          stem.rotateZ(lean);
          stem.translate(x, height * 0.5, z);
          reedParts.push(stem);
        });
        layout.slice(0, 3).forEach(([x, z, height, lean]) => {
          const head = new THREE.CylinderGeometry(0.032, 0.027, 0.16, 5);
          head.rotateZ(lean);
          head.translate(x + Math.sin(lean) * 0.035, height - 0.045, z);
          cattailParts.push(head);
        });
        return this.mergeEnvironmentMaterialGroups(reedParts, cattailParts, 'reed/cattail clump');
      }

      const leafParts: THREE.BufferGeometry[] = [];
      const flowerParts: THREE.BufferGeometry[] = [];
      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2 + 0.18;
        const radius = i % 2 === 0 ? 0.19 : 0.15;
        const leaf = new THREE.CylinderGeometry(radius, radius * 0.92, 0.018, 7);
        leaf.scale(1.22, 1, 0.83);
        leaf.rotateY(angle);
        leaf.translate(Math.cos(angle) * 0.16, 0.01, Math.sin(angle) * 0.16);
        leafParts.push(leaf);
      }
      for (let i = 0; i < 5; i++) {
        const petal = new THREE.ConeGeometry(0.045, 0.10, 5);
        petal.rotateZ(Math.PI / 3);
        petal.rotateY((i / 5) * Math.PI * 2);
        petal.translate(0, 0.06, 0);
        flowerParts.push(petal);
      }
      return this.mergeEnvironmentMaterialGroups(leafParts, flowerParts, 'lily-pad rosette');
    });
  }

  getEnvironmentPlantMaterials(kind: EnvironmentPlantGeometry): THREE.Material[] {
    return kind === 'env_reed_clump'
      ? [this.materials.reedGreen, this.materials.cattailBrown]
      : [this.materials.lilypadGreen, this.materials.lotusPink];
  }

  private mergeEnvironmentMaterialGroups(
    primary: THREE.BufferGeometry[],
    accent: THREE.BufferGeometry[],
    name: string,
  ): THREE.BufferGeometry {
    const primaryMerged = BufferGeometryUtils.mergeGeometries(primary, false);
    const accentMerged = BufferGeometryUtils.mergeGeometries(accent, false);
    primary.forEach(geometry => geometry.dispose());
    accent.forEach(geometry => geometry.dispose());
    if (!primaryMerged || !accentMerged) {
      primaryMerged?.dispose();
      accentMerged?.dispose();
      throw new Error(`Unable to merge ${name} geometry`);
    }
    const combined = BufferGeometryUtils.mergeGeometries([primaryMerged, accentMerged], true);
    primaryMerged.dispose();
    accentMerged.dispose();
    if (!combined) throw new Error(`Unable to combine ${name} geometry`);
    combined.computeVertexNormals();
    combined.computeBoundingBox();
    combined.computeBoundingSphere();
    return combined;
  }

  // 3. Road Mesh Generator based on neighbors
  isIntersection(tx: number, ty: number): boolean {
    if (!this.sim) return false;
    if (tx < 0 || tx >= this.sim.gridSize || ty < 0 || ty >= this.sim.gridSize) return false;
    const tile = this.sim.grid[tx][ty];
    if (tile.type !== 'road') return false;

    const conn = {
      N: ty > 0 && this.sim.grid[tx][ty - 1].type === 'road',
      S: ty < this.sim.gridSize - 1 && this.sim.grid[tx][ty + 1].type === 'road',
      E: tx < this.sim.gridSize - 1 && this.sim.grid[tx + 1][ty].type === 'road',
      W: tx > 0 && this.sim.grid[tx - 1][ty].type === 'road'
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

    // Layout constants
    const {
      CARRIAGEWAY_WIDTH,
      CARRIAGEWAY_THICKNESS,
      CARRIAGEWAY_SURFACE_Y,
      CARRIAGEWAY_Y,
      CARRIAGEWAY_ARM_CENTER_OFFSET,
      CARRIAGEWAY_ARM_LENGTH,
      SIDEWALK_Y,
    } = ROAD_LAYOUT;

    // 1. Detect if this is a sloped straight road ramp
    let isRamp = false;
    let tiltX = 0;
    let tiltZ = 0;
    let scaleLen = 1.0;
    let deltaY = 0;

    const { N, S, E, W } = connections;
    const count = [N, S, E, W].filter(Boolean).length;

    if (!isBridge && this.sim && count === 2) {
      const H_C = this.sim.grid[tileX][tileY].elevation || 0;
      if (N && S && !E && !W) {
        const H_N = this.sim.grid[tileX][tileY - 1].elevation || 0;
        const H_S = this.sim.grid[tileX][tileY + 1].elevation || 0;
        const y_N = Math.max(H_C, H_N) * 0.8;
        const y_S = Math.max(H_C, H_S) * 0.8;
        if (y_N !== y_S) {
          isRamp = true;
          deltaY = y_N - y_S;
          tiltX = Math.atan2(deltaY, 2.0);
          scaleLen = Math.sqrt(4.0 + deltaY * deltaY) / 2.0;
        }
      } else if (E && W && !N && !S) {
        const H_E = this.sim.grid[tileX + 1][tileY].elevation || 0;
        const H_W = this.sim.grid[tileX - 1][tileY].elevation || 0;
        const y_E = Math.max(H_C, H_E) * 0.8;
        const y_W = Math.max(H_C, H_W) * 0.8;
        if (y_E !== y_W) {
          isRamp = true;
          deltaY = y_E - y_W;
          tiltZ = Math.atan2(deltaY, 2.0);
          scaleLen = Math.sqrt(4.0 + deltaY * deltaY) / 2.0;
        }
      }
    }

    if (isRamp) {
      // 100.00% Mathematical Alignment Equations:
      // scaleLen = sqrt(4.0 + ΔY²) / 2.0 = 1 / cos(theta)
      // Extended boundary deck length: 2.04 * scaleLen (spans exactly ±1.02m in world space, matching flat tile 2.04m span)
      const deckLen = scaleLen * 2.04;

      // 1. Sloped Carriageway Asphalt Base
      const asphaltH = CARRIAGEWAY_THICKNESS * scaleLen;
      const asphaltTopSurfaceFlat = CARRIAGEWAY_SURFACE_Y;
      const asphaltPosY = (asphaltTopSurfaceFlat * scaleLen) - (asphaltH / 2);
      const baseGeo = new THREE.BoxGeometry(
        tiltX !== 0 ? CARRIAGEWAY_WIDTH : deckLen,
        asphaltH,
        tiltX !== 0 ? deckLen : CARRIAGEWAY_WIDTH
      );
      const base = new THREE.Mesh(baseGeo, this.materials.road);
      base.position.y = asphaltPosY;
      base.receiveShadow = true;
      group.add(base);

      // 2. Sloped Sidewalks (top surface matches flat sidewalk surface Y = SIDEWALK_Y + swH/2 exactly at boundary)
      const swW = currentStreetscapeSettings.sidewalkWidth;
      const swH = currentStreetscapeSettings.sidewalkHeight;
      const swOff = currentStreetscapeSettings.sidewalkOffset;
      const quadSize = swW + 0.18;
      const swBoxH = 0.18 * scaleLen;
      const swTopSurfaceFlat = SIDEWALK_Y + swH / 2; // Flat top surface elevation
      const swPosY = (swTopSurfaceFlat * scaleLen) - (swBoxH / 2); // Local center Y position

      const sideGeoL = new THREE.BoxGeometry(
        tiltX !== 0 ? quadSize : deckLen,
        swBoxH,
        tiltX !== 0 ? deckLen : quadSize
      );
      const sideL = new THREE.Mesh(sideGeoL, this.materials.sidewalk);
      const sideR = new THREE.Mesh(sideGeoL, this.materials.sidewalk);
      if (tiltX !== 0) {
        sideL.position.set(-swOff, swPosY, 0);
        sideR.position.set(swOff, swPosY, 0);
      } else {
        sideL.position.set(0, swPosY, -swOff);
        sideR.position.set(0, swPosY, swOff);
      }
      sideL.receiveShadow = true;
      sideR.receiveShadow = true;
      group.add(sideL);
      group.add(sideR);

      // 3. Sloped Curbs (top surface matches sidewalk top surface Y = SIDEWALK_Y + swH/2 exactly at boundary)
      const cW = currentStreetscapeSettings.curbWidth;
      const curbBoxH = 0.14 * scaleLen;
      const curbPosY = (swTopSurfaceFlat * scaleLen) - curbBoxH; // Local Y position for ExtrudeGeometry (0 to curbBoxH)
      const rampCurbMat = this.materials.curb;

      let curbLGeo: THREE.BufferGeometry;
      let curbRGeo: THREE.BufferGeometry;
      if (tiltX !== 0) {
        curbLGeo = this.createBeveledCurbGeometry(cW, curbBoxH, deckLen, '+X');
        curbRGeo = this.createBeveledCurbGeometry(cW, curbBoxH, deckLen, '-X');
      } else {
        curbLGeo = this.createBeveledCurbGeometry(deckLen, curbBoxH, cW, '+Z');
        curbRGeo = this.createBeveledCurbGeometry(deckLen, curbBoxH, cW, '-Z');
      }
      const curbL = new THREE.Mesh(curbLGeo, rampCurbMat);
      const curbR = new THREE.Mesh(curbRGeo, rampCurbMat);
      if (tiltX !== 0) {
        const curbCenter = CARRIAGEWAY_WIDTH / 2 + cW / 2;
        curbL.position.set(-curbCenter, curbPosY, 0);
        curbR.position.set(curbCenter, curbPosY, 0);
      } else {
        const curbCenter = CARRIAGEWAY_WIDTH / 2 + cW / 2;
        curbL.position.set(0, curbPosY, -curbCenter);
        curbR.position.set(0, curbPosY, curbCenter);
      }
      curbL.receiveShadow = true;
      curbR.receiveShadow = true;
      group.add(curbL);
      group.add(curbR);

      // Concrete retaining abutment
      const skirtHeight = 1.6;
      const skirtGeo = new THREE.BoxGeometry(
        tiltX !== 0 ? 1.95 : deckLen,
        skirtHeight,
        tiltX !== 0 ? deckLen : 1.95
      );
      const skirt = new THREE.Mesh(skirtGeo, this.materials.cement);
      skirt.position.y = -skirtHeight / 2;
      skirt.receiveShadow = true;
      skirt.castShadow = true;
      group.add(skirt);

      // Yellow centerline 1mm above the sloped carriageway surface.
      const lineMat = this.materials.roadLine;
      const lineY = CARRIAGEWAY_SURFACE_Y * scaleLen + 0.001;
      const lineGeo = new THREE.PlaneGeometry(0.06, deckLen);
      const line = new THREE.Mesh(lineGeo, lineMat);
      line.rotation.x = -Math.PI / 2;
      if (tiltZ !== 0) {
        line.rotation.z = Math.PI / 2;
      }
      line.position.set(0, lineY, 0);
      group.add(line);

      // Apply tilt rotations
      if (tiltX !== 0) group.rotation.x = tiltX;
      if (tiltZ !== 0) group.rotation.z = tiltZ;

      return group;
    }

    if (isBridge) {
      // 1. Water underneath
      group.add(this.createWaterMesh(neighbors));

      // 2. A bridge follows its road connection. The old fixed north/south
      // layout made east/west sidewalks sit at the approach ends instead of
      // beside the carriageway.
      const runsNorthSouth = (N || S) && !(E || W);
      const bridgeLength = 2;
      const bridgeWidth = 2;
      const deckWidth = 1.36;
      const pedestrianWidth = (bridgeWidth - deckWidth) / 2;
      const sidewalkOffset = deckWidth / 2 + pedestrianWidth / 2;
      const plankCount = 9;
      const plankLength = 0.20;
      const plankPitch = 0.225;
      const sidewalkBaseHeight = 0.035;
      const sidewalkPaverHeight = 0.04;
      const sidewalkPaverY = sidewalkBaseHeight + sidewalkPaverHeight / 2;

      const addBridgePart = (
        width: number,
        height: number,
        length: number,
        x: number,
        y: number,
        z: number,
        material: THREE.Material,
      ) => {
        const geometry = new THREE.BoxGeometry(
          runsNorthSouth ? width : length,
          height,
          runsNorthSouth ? length : width,
        );
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(x, y, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);
      };

      // Keep a pair of dark stringers beneath the open plank deck: the narrow
      // gaps make the warm timber readable from the normal isometric camera.
      for (const offset of [-deckWidth / 2 + 0.16, deckWidth / 2 - 0.16]) {
        addBridgePart(0.08, 0.055, bridgeLength, runsNorthSouth ? offset : 0, 0.0275, runsNorthSouth ? 0 : offset, this.materials.charcoalMetal);
      }

      // Transverse planks are individually modelled rather than painted onto a
      // single slab, so the wood grain rhythm remains clear at gameplay zoom.
      for (let index = 0; index < plankCount; index += 1) {
        const along = (index - (plankCount - 1) / 2) * plankPitch;
        addBridgePart(deckWidth - 0.05, 0.09, plankLength, runsNorthSouth ? 0 : along, 0.072, runsNorthSouth ? along : 0, this.materials.trunk);
      }

      // 3. Low, continuous sidewalks use tight paver joints. Together with the
      // central deck they fill the entire two-metre tile width edge-to-edge.
      for (const side of [-1, 1]) {
        const sideOffset = side * sidewalkOffset;
        addBridgePart(pedestrianWidth, sidewalkBaseHeight, bridgeLength, runsNorthSouth ? sideOffset : 0, sidewalkBaseHeight / 2, runsNorthSouth ? 0 : sideOffset, this.materials.trunk);
        for (let index = 0; index < 6; index += 1) {
          const along = (index - 2.5) * 0.33;
          addBridgePart(pedestrianWidth - 0.01, sidewalkPaverHeight, 0.32, runsNorthSouth ? sideOffset : along, sidewalkPaverY, runsNorthSouth ? along : sideOffset, this.materials.sidewalk);
        }
      }
    } else {
      // Standard Cozy Road Surface
      // 1. Central carriageway core (1.28 x 1.28)
      const coreGeo = new THREE.BoxGeometry(CARRIAGEWAY_WIDTH, CARRIAGEWAY_THICKNESS, CARRIAGEWAY_WIDTH);
      const core = new THREE.Mesh(coreGeo, this.materials.road);
      core.position.y = CARRIAGEWAY_Y;
      core.receiveShadow = true;
      group.add(core);

      // 2. Carriageway arms for connected directions
      const armLength = CARRIAGEWAY_ARM_LENGTH; // spans from 0.64 to 1.0
      const armGeoV = new THREE.BoxGeometry(CARRIAGEWAY_WIDTH, CARRIAGEWAY_THICKNESS, armLength);
      const armGeoH = new THREE.BoxGeometry(armLength, CARRIAGEWAY_THICKNESS, CARRIAGEWAY_WIDTH);

      if (N) {
        const armN = new THREE.Mesh(armGeoV, this.materials.road);
        armN.position.set(0, CARRIAGEWAY_Y, -CARRIAGEWAY_ARM_CENTER_OFFSET);
        armN.receiveShadow = true;
        group.add(armN);
      }
      if (S) {
        const armS = new THREE.Mesh(armGeoV, this.materials.road);
        armS.position.set(0, CARRIAGEWAY_Y, CARRIAGEWAY_ARM_CENTER_OFFSET);
        armS.receiveShadow = true;
        group.add(armS);
      }
      if (E) {
        const armE = new THREE.Mesh(armGeoH, this.materials.road);
        armE.position.set(CARRIAGEWAY_ARM_CENTER_OFFSET, CARRIAGEWAY_Y, 0);
        armE.receiveShadow = true;
        group.add(armE);
      }
      if (W) {
        const armW = new THREE.Mesh(armGeoH, this.materials.road);
        armW.position.set(-CARRIAGEWAY_ARM_CENTER_OFFSET, CARRIAGEWAY_Y, 0);
        armW.receiveShadow = true;
        group.add(armW);
      }

      // Isolated stub handling
      if (count === 0) {
        const stubN = new THREE.Mesh(armGeoV, this.materials.road);
        stubN.position.set(0, CARRIAGEWAY_Y, -CARRIAGEWAY_ARM_CENTER_OFFSET);
        const stubS = new THREE.Mesh(armGeoV, this.materials.road);
        stubS.position.set(0, CARRIAGEWAY_Y, CARRIAGEWAY_ARM_CENTER_OFFSET);
        stubN.receiveShadow = true;
        stubS.receiveShadow = true;
        group.add(stubN);
        group.add(stubS);
      }

      // 3. Sidewalks: corner quads and side strips (dynamic settings)
      const swW = currentStreetscapeSettings.sidewalkWidth;
      const swH = currentStreetscapeSettings.sidewalkHeight;
      const swOff = currentStreetscapeSettings.sidewalkOffset;
      const quadSize = swW + 0.18;

      const swQuadGeo = new THREE.BoxGeometry(quadSize, swH, quadSize);
      const addSidewalkQuad = (qx: number, qz: number) => {
        const sw = new THREE.Mesh(swQuadGeo, this.materials.sidewalk);
        sw.position.set(qx * swOff, SIDEWALK_Y, qz * swOff);
        sw.receiveShadow = true;
        group.add(sw);
      };

      addSidewalkQuad(-1, -1); // NW
      addSidewalkQuad(1, -1);  // NE
      addSidewalkQuad(-1, 1);  // SW
      addSidewalkQuad(1, 1);   // SE

      if (!N) {
        const swN = new THREE.Mesh(new THREE.BoxGeometry(2.04, swH, quadSize), this.materials.sidewalk);
        swN.position.set(0, SIDEWALK_Y, -swOff);
        swN.receiveShadow = true;
        group.add(swN);
      }
      if (!S) {
        const swS = new THREE.Mesh(new THREE.BoxGeometry(2.04, swH, quadSize), this.materials.sidewalk);
        swS.position.set(0, SIDEWALK_Y, swOff);
        swS.receiveShadow = true;
        group.add(swS);
      }
      if (!E) {
        const swE = new THREE.Mesh(new THREE.BoxGeometry(quadSize, swH, 2.04), this.materials.sidewalk);
        swE.position.set(swOff, SIDEWALK_Y, 0);
        swE.receiveShadow = true;
        group.add(swE);
      }
      if (!W) {
        const swW = new THREE.Mesh(new THREE.BoxGeometry(quadSize, swH, 2.04), this.materials.sidewalk);
        swW.position.set(-swOff, SIDEWALK_Y, 0);
        swW.receiveShadow = true;
        group.add(swW);
      }

      // 4. Curbs along carriageway boundaries (beveled top-inner edge facing carriageway)
      const curbMat = this.materials.curb;
      const curbHeight = currentStreetscapeSettings.curbHeight;
      const cW = currentStreetscapeSettings.curbWidth;
      const curbCenter = CARRIAGEWAY_WIDTH / 2 + cW / 2;
      const sidewalkTopY = SIDEWALK_Y + swH / 2; // Flat sidewalk top surface (0.060m)
      const curbPosY = sidewalkTopY - curbHeight; // Top of ExtrudeGeometry (0 to curbHeight) aligns 100% flush at sidewalkTopY

      const addCurbSegment = (x: number, z: number, w: number, d: number, facing: '+X' | '-X' | '+Z' | '-Z') => {
        const curbGeo = this.createBeveledCurbGeometry(w, curbHeight, d, facing);
        const curb = new THREE.Mesh(curbGeo, curbMat);
        curb.position.set(x, curbPosY, z);
        curb.receiveShadow = true;
        group.add(curb);
      };

      if (N) {
        addCurbSegment(-curbCenter, -CARRIAGEWAY_ARM_CENTER_OFFSET, cW, armLength, '+X');
        addCurbSegment(curbCenter, -CARRIAGEWAY_ARM_CENTER_OFFSET, cW, armLength, '-X');
      } else {
        addCurbSegment(0, -curbCenter, CARRIAGEWAY_WIDTH, cW, '+Z');
      }

      if (S) {
        addCurbSegment(-curbCenter, CARRIAGEWAY_ARM_CENTER_OFFSET, cW, armLength, '+X');
        addCurbSegment(curbCenter, CARRIAGEWAY_ARM_CENTER_OFFSET, cW, armLength, '-X');
      } else {
        addCurbSegment(0, curbCenter, CARRIAGEWAY_WIDTH, cW, '-Z');
      }

      if (E) {
        addCurbSegment(CARRIAGEWAY_ARM_CENTER_OFFSET, -curbCenter, armLength, cW, '+Z');
        addCurbSegment(CARRIAGEWAY_ARM_CENTER_OFFSET, curbCenter, armLength, cW, '-Z');
      } else {
        addCurbSegment(curbCenter, 0, cW, CARRIAGEWAY_WIDTH, '-X');
      }

      if (W) {
        addCurbSegment(-CARRIAGEWAY_ARM_CENTER_OFFSET, -curbCenter, armLength, cW, '+Z');
        addCurbSegment(-CARRIAGEWAY_ARM_CENTER_OFFSET, curbCenter, armLength, cW, '-Z');
      } else {
        addCurbSegment(-curbCenter, 0, cW, CARRIAGEWAY_WIDTH, '+X');
      }
    }

    const lineMat = this.materials.roadLine;
    const lineY = isRamp ? (CARRIAGEWAY_SURFACE_Y * scaleLen + 0.001) : (isBridge ? 0.081 : CARRIAGEWAY_SURFACE_Y + 0.001);

    // Helper to add line segment
    const addLine = (w: number, h: number, x: number, z: number, rotY = 0) => {
      const lineLen = isRamp ? h * scaleLen : h;
      const lineGeo = new THREE.PlaneGeometry(w, lineLen);
      const line = new THREE.Mesh(lineGeo, lineMat);
      line.rotation.x = -Math.PI / 2;
      line.rotation.z = rotY;
      line.position.set(x, lineY, z);
      group.add(line);
    };

    // Active crosswalks
    const activeCrosswalksNS: number[] = []; // Z positions
    const activeCrosswalksEW: number[] = []; // X positions

    if (count < 3 && !isBridge && this.sim && tileX > 0 && tileX < this.sim.gridSize - 1 && tileY > 0 && tileY < this.sim.gridSize - 1) {
      if (N && this.isIntersection(tileX, tileY - 1)) activeCrosswalksNS.push(-0.78);
      if (S && this.isIntersection(tileX, tileY + 1)) activeCrosswalksNS.push(0.78);
      if (E && this.isIntersection(tileX + 1, tileY)) activeCrosswalksEW.push(0.78);
      if (W && this.isIntersection(tileX - 1, tileY)) activeCrosswalksEW.push(-0.78);

      if (activeCrosswalksNS.length === 0 && activeCrosswalksEW.length === 0) {
        const tileN = this.sim.grid[tileX][tileY - 1];
        const tileS = this.sim.grid[tileX][tileY + 1];
        const tileE = this.sim.grid[tileX + 1][tileY];
        const tileW = this.sim.grid[tileX - 1][tileY];

        if (tileW.type === 'boardwalk' && tileE.type === 'boardwalk') {
          if (tileS.type === 'road' && tileS.bridge === true) activeCrosswalksNS.push(0.78);
          else if (tileN.type === 'road' && tileN.bridge === true) activeCrosswalksNS.push(-0.78);
        } else if (tileN.type === 'boardwalk' && tileS.type === 'boardwalk') {
          if (tileE.type === 'road' && tileE.bridge === true) activeCrosswalksEW.push(0.78);
          else if (tileW.type === 'road' && tileW.bridge === true) activeCrosswalksEW.push(-0.78);
        }
      }
    }

    const addCenterlineWithGaps = (dir: 'NS' | 'EW', crosswalks: number[]) => {
      if (crosswalks.length === 0) {
        if (dir === 'NS') addLine(0.06, 2, 0, 0);
        else addLine(0.06, 2, 0, 0, Math.PI / 2);
        return;
      }

      const sorted = [...crosswalks].sort((a, b) => a - b);
      let start = -1.0;
      for (const cwVal of sorted) {
        const cwStart = cwVal - 0.2;
        const cwEnd = cwVal + 0.2;
        if (cwStart > start) {
          const len = cwStart - start;
          const mid = (start + cwStart) / 2;
          if (dir === 'NS') addLine(0.06, len, 0, mid);
          else addLine(0.06, len, mid, 0, Math.PI / 2);
        }
        start = cwEnd;
      }
      if (start < 1.0) {
        const len = 1.0 - start;
        const mid = (start + 1.0) / 2;
        if (dir === 'NS') addLine(0.06, len, 0, mid);
        else addLine(0.06, len, mid, 0, Math.PI / 2);
      }
    };

    if (!isBridge && count === 2 && N && S) {
      addCenterlineWithGaps('NS', activeCrosswalksNS);
    } else if (!isBridge && count === 2 && E && W) {
      addCenterlineWithGaps('EW', activeCrosswalksEW);
    } else if (!isBridge && count === 1) {
      // A dead-end may face an adjacent intersection. Keep only the edge stub
      // beyond its crosswalk so the centre line never paints through zebra stripes.
      if (N) {
        if (activeCrosswalksNS.includes(-0.78)) addLine(0.06, 0.1, 0, -0.95);
        else addLine(0.06, 1, 0, -0.5);
      }
      if (S) {
        if (activeCrosswalksNS.includes(0.78)) addLine(0.06, 0.1, 0, 0.95);
        else addLine(0.06, 1, 0, 0.5);
      }
      if (E) {
        if (activeCrosswalksEW.includes(0.78)) addLine(0.06, 0.1, 0.95, 0, Math.PI / 2);
        else addLine(0.06, 1, 0.5, 0, Math.PI / 2);
      }
      if (W) {
        if (activeCrosswalksEW.includes(-0.78)) addLine(0.06, 0.1, -0.95, 0, Math.PI / 2);
        else addLine(0.06, 1, -0.5, 0, Math.PI / 2);
      }
    } else if (!isBridge && count === 2) {
      if (N && E) {
        if (activeCrosswalksNS.includes(-0.78)) addLine(0.06, 0.1, 0, -0.95);
        else addLine(0.06, 1, 0, -0.5);
        if (activeCrosswalksEW.includes(0.78)) addLine(0.06, 0.1, 0.95, 0, Math.PI / 2);
        else addLine(0.06, 1, 0.5, 0, Math.PI / 2);
      } else if (N && W) {
        if (activeCrosswalksNS.includes(-0.78)) addLine(0.06, 0.1, 0, -0.95);
        else addLine(0.06, 1, 0, -0.5);
        if (activeCrosswalksEW.includes(-0.78)) addLine(0.06, 0.1, -0.95, 0, Math.PI / 2);
        else addLine(0.06, 1, -0.5, 0, Math.PI / 2);
      } else if (S && E) {
        if (activeCrosswalksNS.includes(0.78)) addLine(0.06, 0.1, 0, 0.95);
        else addLine(0.06, 1, 0, 0.5);
        if (activeCrosswalksEW.includes(0.78)) addLine(0.06, 0.1, 0.95, 0, Math.PI / 2);
        else addLine(0.06, 1, 0.5, 0, Math.PI / 2);
      } else if (S && W) {
        if (activeCrosswalksNS.includes(0.78)) addLine(0.06, 0.1, 0, 0.95);
        else addLine(0.06, 1, 0, 0.5);
        if (activeCrosswalksEW.includes(-0.78)) addLine(0.06, 0.1, -0.95, 0, Math.PI / 2);
        else addLine(0.06, 1, -0.5, 0, Math.PI / 2);
      }
    } else if (!isBridge && count >= 3) {
      const centerDotGeo = new THREE.BoxGeometry(0.1, 0.005, 0.1);
      const centerDot = new THREE.Mesh(centerDotGeo, lineMat);
      centerDot.position.set(0, lineY, 0);
      group.add(centerDot);

      if (N) addLine(0.06, 0.5, 0, -0.75);
      if (S) addLine(0.06, 0.5, 0, 0.75);
      if (E) addLine(0.06, 0.5, 0.75, 0, Math.PI / 2);
      if (W) addLine(0.06, 0.5, -0.75, 0, Math.PI / 2);
    }

    // Paint Zebra Crosswalks (spanning carriageway width)
    if (!isBridge && currentStreetscapeSettings.showCrosswalks) {
      const drawCrosswalk = (cx: number, cz: number, orientation: 'NS' | 'EW') => {
        const stripeMat = this.materials.roadCrosswalk;
        const stripeGeo = this.getGeometry(
          orientation === 'EW' ? 'crosswalk_stripe_ew' : 'crosswalk_stripe_ns',
          () => new THREE.PlaneGeometry(
            orientation === 'EW' ? 0.08 : 0.28,
            orientation === 'EW' ? 0.28 : 0.08
          )
        );

        const offsets = [-0.48, -0.32, -0.16, 0, 0.16, 0.32, 0.48];
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

      for (const zVal of activeCrosswalksNS) drawCrosswalk(0, zVal, 'EW');
      for (const xVal of activeCrosswalksEW) drawCrosswalk(xVal, 0, 'NS');
    }

    // Bridge Railings (using charcoalMetal)
    if (isBridge) {
      const railColor = this.materials.charcoalMetal;
      const railingHeight = 0.26;
      const railOffset = 0.965;
      const sidewalkSurfaceY = 0.075;
      const railingY = sidewalkSurfaceY + railingHeight / 2;

      const addSideRailing = (xOffset: number, zOffset: number, rotY = 0) => {
        const barGeo = new THREE.BoxGeometry(2.0, 0.04, 0.04);
        const bar = new THREE.Mesh(barGeo, railColor);
        bar.position.set(xOffset, sidewalkSurfaceY + railingHeight - 0.02, zOffset);
        bar.rotation.y = rotY;
        bar.castShadow = true;
        group.add(bar);

        const postGeo = new THREE.BoxGeometry(0.06, railingHeight, 0.06);
        const footingGeo = new THREE.BoxGeometry(0.12, 0.025, 0.12);
        for (const off of [-0.9, 0, 0.9]) {
          const post = new THREE.Mesh(postGeo, railColor);
          const footing = new THREE.Mesh(footingGeo, railColor);
          if (rotY === 0) {
            post.position.set(xOffset + off, railingY, zOffset);
            footing.position.set(xOffset + off, sidewalkSurfaceY + 0.0125, zOffset);
          } else {
            post.position.set(xOffset, railingY, zOffset + off);
            footing.position.set(xOffset, sidewalkSurfaceY + 0.0125, zOffset + off);
          }
          post.castShadow = true;
          footing.castShadow = true;
          footing.receiveShadow = true;
          group.add(post);
          group.add(footing);
        }
      };

      if (N || S) {
        addSideRailing(-railOffset, 0, Math.PI / 2);
        addSideRailing(railOffset, 0, Math.PI / 2);
      } else if (E || W) {
        addSideRailing(0, -railOffset, 0);
        addSideRailing(0, railOffset, 0);
      } else {
        const postGeo = new THREE.BoxGeometry(0.08, railingHeight, 0.08);
        for (const c of [{ x: -0.9, z: -0.9 }, { x: 0.9, z: -0.9 }, { x: -0.9, z: 0.9 }, { x: 0.9, z: 0.9 }]) {
          const post = new THREE.Mesh(postGeo, railColor);
          post.position.set(c.x, railingY, c.z);
          post.castShadow = true;
          group.add(post);
        }
      }
    }

    return group;
  }

  createBeveledCurbGeometry(
    width: number,
    height: number,
    depth: number,
    facing: '+X' | '-X' | '+Z' | '-Z'
  ): THREE.BufferGeometry {
    const bevel = currentStreetscapeSettings.curbBevel;
    const key = `curb_beveled_${width.toFixed(3)}_${height.toFixed(3)}_${depth.toFixed(3)}_${facing}_${bevel.toFixed(3)}`;
    return this.getGeometry(key, () => {
      const shape = new THREE.Shape();

      if (facing === '-X' || facing === '+X') {
        const halfW = width / 2;
        shape.moveTo(-halfW, 0);
        shape.lineTo(halfW, 0);
        if (facing === '-X') {
          // Bevel on top-left (-X side facing West)
          shape.lineTo(halfW, height);
          shape.lineTo(-halfW + bevel, height);
          shape.lineTo(-halfW, height - bevel);
        } else {
          // Bevel on top-right (+X side facing East)
          shape.lineTo(halfW, height - bevel);
          shape.lineTo(halfW - bevel, height);
          shape.lineTo(-halfW, height);
        }
        shape.closePath();

        const geo = new THREE.ExtrudeGeometry(shape, { steps: 1, depth: depth, bevelEnabled: false });
        geo.translate(0, 0, -depth / 2);
        return geo;
      } else {
        // facing is '-Z' or '+Z' (transverse curb running along X, depth is CURB_WIDTH)
        const halfD = depth / 2;
        shape.moveTo(-halfD, 0);
        shape.lineTo(halfD, 0);
        if (facing === '-Z') {
          // Bevel on -Z side (facing North)
          shape.lineTo(halfD, height);
          shape.lineTo(-halfD + bevel, height);
          shape.lineTo(-halfD, height - bevel);
        } else {
          // Bevel on +Z side (facing South)
          shape.lineTo(halfD, height - bevel);
          shape.lineTo(halfD - bevel, height);
          shape.lineTo(-halfD, height);
        }
        shape.closePath();

        const geo = new THREE.ExtrudeGeometry(shape, { steps: 1, depth: width, bevelEnabled: false });
        geo.translate(0, 0, -width / 2);
        geo.rotateY(Math.PI / 2);
        return geo;
      }
    });
  }

  private getExpandedWaterPlaneGeometry(
    keyPrefix: string,
    neighbors: WaterNeighbors,
    diagonalNeighbors: WaterDiagonalNeighbors,
    segments: number,
  ): THREE.BufferGeometry {
    const key = `${keyPrefix}_${neighbors.N ? 1 : 0}_${neighbors.S ? 1 : 0}_${neighbors.E ? 1 : 0}_${neighbors.W ? 1 : 0}_${diagonalNeighbors.NW ? 1 : 0}_${diagonalNeighbors.NE ? 1 : 0}_${diagonalNeighbors.SE ? 1 : 0}_${diagonalNeighbors.SW ? 1 : 0}`;
    return this.getGeometry(key, () => {
      const parts: THREE.BufferGeometry[] = [];
      const addPlane = (minX: number, maxX: number, minY: number, maxY: number, segmentsX: number, segmentsY: number) => {
        const geometry = new THREE.PlaneGeometry(maxX - minX, maxY - minY, segmentsX, segmentsY);
        geometry.translate((minX + maxX) * 0.5, (minY + maxY) * 0.5, 0);
        parts.push(geometry);
      };

      // Keep the shared 2x2 tile core exact. Only the land-facing underfill is
      // added outside it, so connected water tiles never overlap each other.
      addPlane(-1, 1, -1, 1, segments, segments);

      // Horizontal strips own all 0.3x0.3 corner underfill squares. At a
      // concave turn their normal [-1, 1] span already covers that square;
      // only the perpendicular strip needs trimming below. This deterministic
      // ownership avoids the double-alpha diamonds made by expanded rectangles.
      if (!neighbors.N) {
        const minX = !neighbors.W ? -1.3 : -1;
        const maxX = !neighbors.E ? 1.3 : 1;
        addPlane(minX, maxX, 1, 1.3, segments, 1);
      }
      if (!neighbors.S) {
        const minX = !neighbors.W ? -1.3 : -1;
        const maxX = !neighbors.E ? 1.3 : 1;
        addPlane(minX, maxX, -1.3, -1, segments, 1);
      }

      if (!neighbors.E) {
        const minY = (!neighbors.S || diagonalNeighbors.SE) ? -0.7 : -1;
        const maxY = (!neighbors.N || diagonalNeighbors.NE) ? 0.7 : 1;
        addPlane(1, 1.3, minY, maxY, 1, segments);
      }
      if (!neighbors.W) {
        const minY = (!neighbors.S || diagonalNeighbors.SW) ? -0.7 : -1;
        const maxY = (!neighbors.N || diagonalNeighbors.NW) ? 0.7 : 1;
        addPlane(-1.3, -1, minY, maxY, 1, segments);
      }

      const merged = BufferGeometryUtils.mergeGeometries(parts, false);
      parts.forEach(part => part.dispose());
      if (!merged) throw new Error(`Failed to build ${keyPrefix} geometry`);
      return merged;
    });
  }

  getWaterTopGeometry(neighbors: WaterNeighbors, diagonalNeighbors = NO_WATER_DIAGONALS): THREE.BufferGeometry {
    return this.getExpandedWaterPlaneGeometry('water_top_exp', neighbors, diagonalNeighbors, 8);
  }

  getWaterBottomGeometry(neighbors: WaterNeighbors, diagonalNeighbors = NO_WATER_DIAGONALS): THREE.BufferGeometry {
    return this.getExpandedWaterPlaneGeometry('water_bottom_exp', neighbors, diagonalNeighbors, 1);
  }

  private getWaterShoreFoamGeometry(
    direction: 'N' | 'S' | 'E' | 'W',
    trimStart = false,
    trimEnd = false,
    inset = 0,
    bandWidth = 0.10,
    extendStart = false,
    extendEnd = false,
    taperEnds = false,
  ): THREE.BufferGeometry {
    // A cap is one full band-width wide. Trimming only half that width made the
    // cap overlap both adjoining strips, producing darker diamonds and pale
    // tabs after alpha blending.
    const trimStartAmount = trimStart ? bandWidth + inset : 0;
    const trimEndAmount = trimEnd ? bandWidth + inset : 0;
    const extendStartAmount = extendStart ? inset : 0;
    const extendEndAmount = extendEnd ? inset : 0;
    const runsAlongX = direction === 'N' || direction === 'S';
    const length = 2.0 - trimStartAmount - trimEndAmount + extendStartAmount + extendEndAmount;
    const key = `water_shore_foam_${direction.toLowerCase()}_${trimStart ? 1 : 0}_${trimEnd ? 1 : 0}_${inset}_${bandWidth}_${extendStart ? 1 : 0}_${extendEnd ? 1 : 0}_${taperEnds ? 1 : 0}`;

    return this.getGeometry(key, () => {
      const geometry = new THREE.PlaneGeometry(
        runsAlongX ? length : bandWidth,
        runsAlongX ? bandWidth : length,
        runsAlongX ? (taperEnds ? 4 : 2) : 1,
        runsAlongX ? 1 : (taperEnds ? 4 : 2),
      );

      // Shorten only the ends that are joined by another exposed edge. The
      // matching corner cap below fills that square exactly, avoiding alpha
      // overlap (darker corners) and tiny gaps (broken corners).
      if (runsAlongX) {
        geometry.translate((trimStartAmount - extendStartAmount - trimEndAmount + extendEndAmount) * 0.5, 0, 0);
      } else {
        // Plane local Y becomes world -Z after the horizontal rotation.
        geometry.translate(0, (trimEndAmount - extendEndAmount - trimStartAmount + extendStartAmount) * 0.5, 0);
      }

      const uv = geometry.getAttribute('uv') as THREE.BufferAttribute;
      const fade = new Float32Array(uv.count);
      const bandCoord = new Float32Array(uv.count);
      const endFade = new Float32Array(uv.count);

      for (let index = 0; index < uv.count; index++) {
        // This is intentionally a solid low-poly waterline, so every vertex
        // follows the terrain contour rather than fading across its width.
        fade[index] = 1;
        bandCoord[index] = runsAlongX ? uv.getY(index) : uv.getX(index);
        const along = runsAlongX ? uv.getX(index) : uv.getY(index);
        // Vertical strips reverse their local UV direction when rotated into
        // world Z, so map the semantic start/end flags accordingly.
        const fromStart = runsAlongX ? along : 1 - along;
        const fromEnd = runsAlongX ? 1 - along : along;
        endFade[index] = Math.min(
          taperEnds && trimStart ? Math.min(fromStart * 4, 1) : 1,
          taperEnds && trimEnd ? Math.min(fromEnd * 4, 1) : 1,
        );
      }
      geometry.setAttribute('aShoreFoamFade', new THREE.BufferAttribute(fade, 1));
      geometry.setAttribute('aShoreBandCoord', new THREE.BufferAttribute(bandCoord, 1));
      geometry.setAttribute('aShoreEndFade', new THREE.BufferAttribute(endFade, 1));
      // Bake the plane horizontal so the shader's contour offset operates in
      // the same local X/Z axes as the terrain rather than rotated plane axes.
      geometry.rotateX(-Math.PI / 2);
      return geometry;
    });
  }

  private getWaterShoreFoamCornerGeometry(size: number): THREE.BufferGeometry {
    return this.getGeometry(`water_shore_foam_corner_${size}`, () => {
      const geometry = new THREE.PlaneGeometry(size, size, 1, 1);
      const fade = new Float32Array(geometry.getAttribute('position').count).fill(1);
      const bandCoord = new Float32Array(geometry.getAttribute('position').count).fill(0.5);
      const endFade = new Float32Array(geometry.getAttribute('position').count).fill(1);
      geometry.setAttribute('aShoreFoamFade', new THREE.BufferAttribute(fade, 1));
      geometry.setAttribute('aShoreBandCoord', new THREE.BufferAttribute(bandCoord, 1));
      geometry.setAttribute('aShoreEndFade', new THREE.BufferAttribute(endFade, 1));
      geometry.rotateX(-Math.PI / 2);
      return geometry;
    });
  }

  private addWaterShoreFoam(
    group: THREE.Group,
    shoreEdges: { N: boolean; S: boolean; E: boolean; W: boolean },
    innerCorners: { NW: boolean; NE: boolean; SE: boolean; SW: boolean },
    innerJoinCorners: { NW: boolean; NE: boolean; SE: boolean; SW: boolean },
  ) {
    const foamMat = this.materials.waterShoreFoam;
    const innerFoamMat = this.materials.waterShoreFoamInner;
    // The contact lip sits just above the water plane but far enough below the
    // terrain that its bounded crest cannot rise through grass.
    const foamY = -0.036;

    const addFoam = (
      material: THREE.Material,
      direction: 'N' | 'S' | 'E' | 'W',
      x: number,
      z: number,
      trimStart = false,
      trimEnd = false,
      inset = 0,
      bandWidth = 0.10,
      extendStart = false,
      extendEnd = false,
      taperEnds = false,
    ) => {
      const geometry = this.getWaterShoreFoamGeometry(direction, trimStart, trimEnd, inset, bandWidth, extendStart, extendEnd, taperEnds);
      const foam = new THREE.Mesh(geometry, material);
      // The quieter wash sits just below the contact lip. Both share the same
      // displacement phase and remain safely beneath the terrain at crest.
      foam.position.set(x, material === innerFoamMat ? -0.045 : foamY, z);
      foam.castShadow = false;
      foam.receiveShadow = false;
      group.add(foam);
    };

    const addCorner = (material: THREE.Material, x: number, z: number, size: number) => {
      const foam = new THREE.Mesh(this.getWaterShoreFoamCornerGeometry(size), material);
      foam.position.set(x, foamY, z);
      foam.castShadow = false;
      foam.receiveShadow = false;
      group.add(foam);
    };

    const addBand = (
      material: THREE.Material,
      inset: number,
      bandWidth: number,
      trimAtCorners: boolean,
      addCorners: boolean,
      taperEnds: boolean,
    ) => {
      // Inset is measured from the shoreline to the band's outside edge. This
      // allows the contact lip and inset wash to have distinct visual weights.
      const center = 1 - inset - bandWidth * 0.5;
      if (shoreEdges.N) addFoam(material, 'N', 0, -center, trimAtCorners && shoreEdges.W, trimAtCorners && shoreEdges.E, inset, bandWidth, addCorners && innerJoinCorners.NW, addCorners && innerJoinCorners.NE, taperEnds);
      if (shoreEdges.S) addFoam(material, 'S', 0, center, trimAtCorners && shoreEdges.W, trimAtCorners && shoreEdges.E, inset, bandWidth, addCorners && innerJoinCorners.SW, addCorners && innerJoinCorners.SE, taperEnds);
      if (shoreEdges.E) addFoam(material, 'E', center, 0, trimAtCorners && shoreEdges.N, trimAtCorners && shoreEdges.S, inset, bandWidth, addCorners && innerJoinCorners.NE, addCorners && innerJoinCorners.SE, taperEnds);
      if (shoreEdges.W) addFoam(material, 'W', -center, 0, trimAtCorners && shoreEdges.N, trimAtCorners && shoreEdges.S, inset, bandWidth, addCorners && innerJoinCorners.NW, addCorners && innerJoinCorners.SW, taperEnds);

      const corner = center;
      // Convex / outside shoreline turns: this tile owns both line segments.
      if (addCorners && shoreEdges.N && shoreEdges.W) addCorner(material, -corner, -corner, bandWidth);
      if (addCorners && shoreEdges.N && shoreEdges.E) addCorner(material, corner, -corner, bandWidth);
      if (addCorners && shoreEdges.S && shoreEdges.E) addCorner(material, corner, corner, bandWidth);
      if (addCorners && shoreEdges.S && shoreEdges.W) addCorner(material, -corner, corner, bandWidth);

      // Concave / inside turns are owned by the water tile diagonally opposite
      // the land or boardwalk corner.
      if (addCorners && innerCorners.NW) addCorner(material, -corner, -corner, bandWidth);
      if (addCorners && innerCorners.NE) addCorner(material, corner, -corner, bandWidth);
      if (addCorners && innerCorners.SE) addCorner(material, corner, corner, bandWidth);
      if (addCorners && innerCorners.SW) addCorner(material, -corner, corner, bandWidth);
    };

    addBand(foamMat, 0, 0.075, true, true, false);
    addBand(innerFoamMat, 0.08, 0.14, true, false, true);
  }

  // 3a. Segmented Water Mesh Creator
  createWaterMesh(
    neighbors: WaterNeighbors,
    diagonalNeighbors = NO_WATER_DIAGONALS,
    shoreEdges = { N: false, S: false, E: false, W: false },
    innerCorners = { NW: false, NE: false, SE: false, SW: false },
    innerJoinCorners = { NW: false, NE: false, SE: false, SW: false },
  ): THREE.Group {
    const group = new THREE.Group();

    // 1. Top Water surface plane (expanded towards land sides only to avoid overlapping water plane bands)
    const waterGeo = this.getWaterTopGeometry(neighbors, diagonalNeighbors);
    const water = new THREE.Mesh(waterGeo, this.materials.waterBlue);
    water.rotation.x = -Math.PI / 2;
    water.position.y = -0.04;
    water.receiveShadow = true;
    group.add(water);

    this.addWaterShoreFoam(group, shoreEdges, innerCorners, innerJoinCorners);

    // 2. Bottom Dirt plane (covers bottom grid hole, expanded towards land sides only)
    const dirtGeo = this.getWaterBottomGeometry(neighbors, diagonalNeighbors);
    const dirt = new THREE.Mesh(dirtGeo, this.materials.dirt);
    dirt.rotation.x = -Math.PI / 2;
    dirt.position.y = -0.4;
    dirt.receiveShadow = true;
    group.add(dirt);

    // The adjacent ground column already supplies the complete dirt bank down
    // past the lakebed, including the same displaced contour as the grass rim.
    // A second square wall here intersected that bank at shoreline turns and
    // showed through the transparent water as large triangular fins.

    return group;
  }

  // 3b. Water Body Mesh Generator
  createWaterBodyMesh(
    tileX = 0,
    tileY = 0,
    neighbors = { N: false, S: false, E: false, W: false },
    diagonalNeighbors = NO_WATER_DIAGONALS,
    shoreEdges = { N: false, S: false, E: false, W: false },
    innerCorners = { NW: false, NE: false, SE: false, SW: false },
    innerJoinCorners = { NW: false, NE: false, SE: false, SW: false },
  ): THREE.Group {
    const group = new THREE.Group();

    // Add continuous water mesh
    group.add(this.createWaterMesh(neighbors, diagonalNeighbors, shoreEdges, innerCorners, innerJoinCorners));

    // Water vegetation is owned by EnvironmentScenery's global instanced
    // pools. Keeping it out of this per-tile mesh prevents double scatter and
    // lets boulders, reeds, and lily pads share one deterministic lifecycle.
    void tileX;
    void tileY;

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
    boardwalkNeighbors = { N: false, S: false, E: false, W: false },
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

    const isOutsideCorner = activeSides.length === 2;
    let isInsideCorner = false;

    // If no direct water neighbors, check diagonal water tiles for corners
    if (activeSides.length === 0 && this.sim) {
      const isNWorSEPattern = (boardwalkNeighbors.N && boardwalkNeighbors.W) || (boardwalkNeighbors.S && boardwalkNeighbors.E);
      const isNEorSWPattern = (boardwalkNeighbors.N && boardwalkNeighbors.E) || (boardwalkNeighbors.S && boardwalkNeighbors.W);

      // NW corner: water is at NW
      if (isNWorSEPattern) {
        if (
          tileX > 0 && tileY > 0 &&
          (this.sim.grid[tileX - 1][tileY - 1].type === 'water_body' || this.sim.grid[tileX - 1][tileY - 1].bridge)
        ) {
          activeSides.push('N', 'W');
          isInsideCorner = true;
        }
      }
      // NE corner: water is at NE
      if (activeSides.length === 0 && isNEorSWPattern) {
        if (
          tileX < this.sim.gridSize - 1 && tileY > 0 &&
          (this.sim.grid[tileX + 1][tileY - 1].type === 'water_body' || this.sim.grid[tileX + 1][tileY - 1].bridge)
        ) {
          activeSides.push('N', 'E');
          isInsideCorner = true;
        }
      }
      // SW corner: water is at SW
      if (activeSides.length === 0 && isNEorSWPattern) {
        if (
          tileX > 0 && tileY < this.sim.gridSize - 1 &&
          (this.sim.grid[tileX - 1][tileY + 1].type === 'water_body' || this.sim.grid[tileX - 1][tileY + 1].bridge)
        ) {
          activeSides.push('S', 'W');
          isInsideCorner = true;
        }
      }
      // SE corner: water is at SE
      if (activeSides.length === 0 && isNWorSEPattern) {
        if (
          tileX < this.sim.gridSize - 1 && tileY < this.sim.gridSize - 1 &&
          (this.sim.grid[tileX + 1][tileY + 1].type === 'water_body' || this.sim.grid[tileX + 1][tileY + 1].bridge)
        ) {
          activeSides.push('S', 'E');
          isInsideCorner = true;
        }
      }
    }

    if (activeSides.length === 0) activeSides.push('N');

    // Check if we are rendering a custom L-shape corner
    let isCorner = isOutsideCorner || isInsideCorner;
    let cornerType: 'NW' | 'NE' | 'SW' | 'SE' | null = null;
    if (activeSides.length === 2) {
      const s0 = activeSides[0];
      const s1 = activeSides[1];
      if ((s0 === 'N' && s1 === 'W') || (s0 === 'W' && s1 === 'N')) { cornerType = 'NW'; }
      else if ((s0 === 'N' && s1 === 'E') || (s0 === 'E' && s1 === 'N')) { cornerType = 'NE'; }
      else if ((s0 === 'S' && s1 === 'W') || (s0 === 'W' && s1 === 'S')) { cornerType = 'SW'; }
      else if ((s0 === 'S' && s1 === 'E') || (s0 === 'E' && s1 === 'S')) { cornerType = 'SE'; }
    }

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
    for (const side of activeSides) {
      let deckX = 0, deckZ = 0;

      if (side === 'N' || side === 'S') {
        deckX = 0;
        deckZ = side === 'N' ? -0.68 : 0.68;
      } else {
        deckX = side === 'E' ? 0.68 : -0.68;
        deckZ = 0;
      }

      // Render 11 parallel planks on the deck
      if (side === 'N' || side === 'S') {
        const plankGeo = this.getGeometry('boardwalk_plank_ns_1_3_narrower_thick_v4_70', () => new THREE.BoxGeometry(0.12, 0.04, 0.70));
        const spacing = 2.0 / 11;
        const start = -1.0 + spacing / 2;
        for (let i = 0; i < 11; i++) {
          const x = start + i * spacing;
          if (isInsideCorner) {
            if (side === 'N') {
              if (cornerType === 'NW' && x > -0.33) continue;
              if (cornerType === 'NE' && x < 0.33) continue;
            } else if (side === 'S') {
              if (cornerType === 'SW' && x > -0.33) continue;
              if (cornerType === 'SE' && x < 0.33) continue;
            }
          }
          const plank = new THREE.Mesh(plankGeo, this.materials.trunk);
          plank.position.set(x, 0.06, deckZ);
          plank.receiveShadow = true;
          plank.castShadow = true;
          group.add(plank);
        }
      } else {
        // Skip E/W planks completely on inside corners to avoid rendering wood on land
        if (!isInsideCorner) {
          const plankGeo = this.getGeometry('boardwalk_plank_ew_1_3_narrower_thick_v4_70', () => new THREE.BoxGeometry(0.70, 0.04, 0.12));
          const spacing = 2.0 / 11;
          const start = -1.0 + spacing / 2;
          for (let i = 0; i < 11; i++) {
            const z = start + i * spacing;
            if (isCorner) {
              if (side === 'W') {
                if (cornerType === 'NW' && z < -0.33) continue;
                if (cornerType === 'SW' && z > 0.33) continue;
              } else if (side === 'E') {
                if (cornerType === 'NE' && z < -0.33) continue;
                if (cornerType === 'SE' && z > 0.33) continue;
              }
            }
            const plank = new THREE.Mesh(plankGeo, this.materials.trunk);
            plank.position.set(deckX, 0.06, z);
            plank.receiveShadow = true;
            plank.castShadow = true;
            group.add(plank);
          }
        }
      }

      // Wooden Curb Wall (grass-side) and connecting structural beam (water-side)
      let curbGeo!: THREE.BufferGeometry;
      let curbPos = new THREE.Vector3(0, 0.04, 0);
      let waterBeamGeo!: THREE.BufferGeometry;
      let waterBeamPos = new THREE.Vector3(0, 0.04, 0);

      if (side === 'N') {
        let length = 2.0;
        let centerX = 0;
        if (isInsideCorner) {
          length = 0.67;
          centerX = cornerType === 'NW' ? -0.665 : 0.665;
        } else if (isOutsideCorner) {
          if (cornerType === 'NW') { length = 1.30; centerX = 0.35; }
          else if (cornerType === 'NE') { length = 1.30; centerX = -0.35; }
        }
        curbGeo = this.getGeometry(`boardwalk_curb_n_${length}`, () => new THREE.BoxGeometry(length, 0.08, 0.06));
        curbPos.set(centerX, 0.04, -0.33);

        let wLength = 2.0;
        let wCenterX = 0;
        if (isInsideCorner) {
          if (cornerType === 'NW') { wLength = 0.67; wCenterX = -0.665; }
          else if (cornerType === 'NE') { wLength = 0.67; wCenterX = 0.665; }
        } else if (isOutsideCorner) {
          wLength = 1.94;
          wCenterX = cornerType === 'NW' ? 0.03 : -0.03;
        }
        waterBeamGeo = this.getGeometry(`boardwalk_wbeam_n_${wLength}`, () => new THREE.BoxGeometry(wLength, 0.08, 0.06));
        waterBeamPos.set(wCenterX, 0.04, -0.97);
      } else if (side === 'S') {
        let length = 2.0;
        let centerX = 0;
        if (isInsideCorner) {
          length = 0.67;
          centerX = cornerType === 'SW' ? -0.665 : 0.665;
        } else if (isOutsideCorner) {
          if (cornerType === 'SW') { length = 1.30; centerX = 0.35; }
          else if (cornerType === 'SE') { length = 1.30; centerX = -0.35; }
        }
        curbGeo = this.getGeometry(`boardwalk_curb_s_${length}`, () => new THREE.BoxGeometry(length, 0.08, 0.06));
        curbPos.set(centerX, 0.04, 0.33);

        let wLength = 2.0;
        let wCenterX = 0;
        if (isInsideCorner) {
          if (cornerType === 'SW') { wLength = 0.67; wCenterX = -0.665; }
          else if (cornerType === 'SE') { wLength = 0.67; wCenterX = 0.665; }
        } else if (isOutsideCorner) {
          wLength = 1.94;
          wCenterX = cornerType === 'SW' ? 0.03 : -0.03;
        }
        waterBeamGeo = this.getGeometry(`boardwalk_wbeam_s_${wLength}`, () => new THREE.BoxGeometry(wLength, 0.08, 0.06));
        waterBeamPos.set(wCenterX, 0.04, 0.97);
      } else if (side === 'E') {
        let length = 2.0;
        let centerZ = 0;
        if (isInsideCorner) {
          length = 0.67;
          centerZ = cornerType === 'NE' ? -0.665 : 0.665;
        } else if (isOutsideCorner) {
          if (cornerType === 'NE') { length = 1.33; centerZ = 0.335; }
          else if (cornerType === 'SE') { length = 1.33; centerZ = -0.335; }
        }
        curbGeo = this.getGeometry(`boardwalk_curb_e_${length}`, () => new THREE.BoxGeometry(0.06, 0.08, length));
        curbPos.set(0.33, 0.04, centerZ);

        let wLength = 2.0;
        let wCenterZ = 0;
        if (isInsideCorner) {
          if (cornerType === 'NE') { wLength = 0.67; wCenterZ = -0.665; }
          else if (cornerType === 'SE') { wLength = 0.67; wCenterZ = 0.665; }
        }
        waterBeamGeo = this.getGeometry(`boardwalk_wbeam_e_${wLength}`, () => new THREE.BoxGeometry(0.06, 0.08, wLength));
        waterBeamPos.set(0.97, 0.04, wCenterZ);
      } else if (side === 'W') {
        let length = 2.0;
        let centerZ = 0;
        if (isInsideCorner) {
          length = 0.67;
          centerZ = cornerType === 'NW' ? -0.665 : 0.665;
        } else if (isOutsideCorner) {
          if (cornerType === 'NW') { length = 1.33; centerZ = 0.335; }
          else if (cornerType === 'SW') { length = 1.33; centerZ = -0.335; }
        }
        curbGeo = this.getGeometry(`boardwalk_curb_w_${length}`, () => new THREE.BoxGeometry(0.06, 0.08, length));
        curbPos.set(-0.33, 0.04, centerZ);

        let wLength = 2.0;
        let wCenterZ = 0;
        if (isInsideCorner) {
          if (cornerType === 'NW') { wLength = 0.67; wCenterZ = -0.665; }
          else if (cornerType === 'SW') { wLength = 0.67; wCenterZ = 0.665; }
        }
        waterBeamGeo = this.getGeometry(`boardwalk_wbeam_w_${wLength}`, () => new THREE.BoxGeometry(0.06, 0.08, wLength));
        waterBeamPos.set(-0.97, 0.04, wCenterZ);
      }

      const curb = new THREE.Mesh(curbGeo, this.materials.trunk);
      curb.position.copy(curbPos);
      curb.castShadow = true;
      group.add(curb);

      const waterBeam = new THREE.Mesh(waterBeamGeo, this.materials.trunk);
      waterBeam.position.copy(waterBeamPos);
      waterBeam.castShadow = true;
      group.add(waterBeam);
    }

    // 4. Spawn Random Elements on the grass portion (ONLY if it is an outside corner surrounded by water)
    const isMultiWater = isOutsideCorner;
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
    const availablePierDirs = isInsideCorner ? [] : activeSides.filter(side => {
      let wx = tileX;
      let wy = tileY;
      if (side === 'N') wy -= 1;
      else if (side === 'S') wy += 1;
      else if (side === 'E') wx += 1;
      else if (side === 'W') wx -= 1;

      // Safety check: ensure target tile is water or a bridge
      if (this.sim) {
        if (wx < 0 || wx >= this.sim.gridSize || wy < 0 || wy >= this.sim.gridSize) return false;
        const targetTile = this.sim.grid[wx][wy];
        if (targetTile.type !== 'water_body' && !targetTile.bridge) return false;
      }

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
    const placedPostPositions: { x: number, z: number }[] = [];
    const addRopeRailing = (xOffset: number, zOffset: number, rotY = 0) => {
      const postGeo = this.getGeometry('boardwalk_post_1_3', () => new THREE.CylinderGeometry(0.04, 0.04, 0.24, 6));
      const offsets = [-0.95, 0, 0.95];
      for (const off of offsets) {
        let px = 0, pz = 0;
        if (rotY === 0) {
          px = xOffset + off;
          pz = zOffset;
        } else {
          px = xOffset;
          pz = zOffset + off;
        }

        // Check if a post is already placed at or very close to (px, pz)
        const duplicate = placedPostPositions.some(pos => Math.abs(pos.x - px) < 0.01 && Math.abs(pos.z - pz) < 0.01);
        if (duplicate) continue;

        placedPostPositions.push({ x: px, z: pz });
        const post = new THREE.Mesh(postGeo, this.materials.trunk);
        post.position.set(px, 0.18, pz);
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

    if (!isInsideCorner) {
      for (const side of activeSides) {
        if (side !== pierDir) {
          if (side === 'N') addRopeRailing(0, -0.95, 0);
          else if (side === 'S') addRopeRailing(0, 0.95, 0);
          else if (side === 'E') addRopeRailing(0.95, 0, Math.PI / 2);
          else if (side === 'W') addRopeRailing(-0.95, 0, Math.PI / 2);
        }
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
  private residentialDesign(level: number, tileX: number, tileY: number) {
    const rand = this.getSeededRandom(tileX, tileY);
    const paletteIndex = Math.floor(rand() * this.palettes.length);
    const side = rand() > 0.5 ? 1 : -1;
    const tier = Math.min(3, Math.max(1, level));
    return {
      paletteIndex, side, tier,
      w: [1.08, 1.3, 1.44][tier - 1],
      d: [0.92, 1.04, 1.16][tier - 1],
      h: [0.56, 0.98, 1.02][tier - 1],
      rise: [0.44, 0.48, 0.66][tier - 1],
      doorX: side * (tier === 1 ? 0.25 : 0.32),
      chimneyX: -side * 0.3,
    };
  }

  createResidentialMesh(level: number, tileX: number = 0, tileY: number = 0): THREE.Group {
    const group = new THREE.Group();
    const cube = this.getGeometry('house_unit_box', () => new THREE.BoxGeometry(1, 1, 1));
    const box = (w: number, h: number, d: number, x: number, y: number, z: number, material: THREE.Material, parent: THREE.Group = group) => {
      const mesh = new THREE.Mesh(cube, material);
      mesh.scale.set(w, h, d);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      parent.add(mesh);
      return mesh;
    };
    if (level <= 0) {
      box(1.9, 0.05, 1.9, 0, 0.06, 0, this.materials.zoneR);
      return group;
    }

    const design = this.residentialDesign(level, tileX, tileY);
    const {w, h, d, rise, doorX, chimneyX, tier} = design;
    const p = this.palettes[design.paletteIndex];
    const timber = this.materials.trunk;
    const base = 0.16;
    const eave = base + h;
    const front = d / 2;
    const trim = tier === 3 ? timber : p.trim;

    // A solid, closed shell prevents light leaks; window recesses are layered
    // outward with a dark reveal, glass and a separate frame, never coplanar.
    box(w + 0.07, 0.1, d + 0.07, 0, 0.11, 0, p.brick);
    box(w, h, d, 0, base + h / 2, 0, p.wall);
    box(w + 0.025, 0.035, d + 0.025, 0, base + 0.025, 0, trim);

    const gable = this.getGeometry(`house_gable_${w}_${rise}_${d}`, () => {
      const shape = new THREE.Shape();
      shape.moveTo(-w / 2, 0);shape.lineTo(w / 2, 0);shape.lineTo(0, rise);shape.closePath();
      const geo = new THREE.ExtrudeGeometry(shape, {depth: d, bevelEnabled: false, steps: 1});
      geo.translate(0, 0, -d / 2);
      return geo;
    });
    const gableMesh = new THREE.Mesh(gable, tier === 3 ? timber : p.wall);
    gableMesh.position.y = eave;gableMesh.castShadow = true;gableMesh.receiveShadow = true;group.add(gableMesh);

    // Two continuous roof planes with generous eaves, crisp bargeboards and
    // raised standing seams. No gaps between individual roof tiles.
    const roof = (rw: number, rd: number, roofRise: number, y: number, x = 0, z = 0, seams = true) => {
      const half = rw / 2;
      const slope = Math.hypot(half, roofRise);
      const angle = Math.atan2(roofRise, half);
      for (const side of [-1, 1]) {
        const panel = box(slope + 0.018, 0.045, rd, x + side * half / 2, y + roofRise / 2, z, p.roof);
        panel.rotation.z = -side * angle;
        for (const end of [-1, 1]) {
          const fascia = box(slope + 0.035, 0.045, 0.035, x + side * half / 2, y + roofRise / 2 - 0.02, z + end * rd / 2, trim);
          fascia.rotation.z = -side * angle;
        }
        if (seams) for (let i = 1; i < 5; i++) {
          const seam = box(slope, 0.012, 0.012, x + side * (half / 2 + Math.sin(angle) * 0.026), y + roofRise / 2 + Math.cos(angle) * 0.026, z - rd / 2 + rd * i / 5, p.roof);
          seam.rotation.z = -side * angle;
        }
        box(0.045, 0.05, rd, x + side * half, y - 0.014, z, trim);
      }
      box(0.075, 0.045, rd + 0.035, x, y + roofRise + 0.018, z, p.roof);
    };
    const overhang = tier === 3 ? 0.16 : 0.1;
    const roofRise = rise * (w / 2 + overhang) / (w / 2);
    roof(w + overhang * 2, d + 0.24, roofRise, eave + rise - roofRise);

    // Corner boards give the plaster body a readable architectural frame.
    for (const x of [-w / 2, w / 2]) for (const z of [-front, front]) {
      box(0.045, h, 0.045, x, base + h / 2, z, trim);
    }
    if (tier > 1) box(w + 0.045, 0.055, d + 0.045, 0, base + 0.53, 0, trim);

    const window = (x: number, y: number, z: number, rotation = 0, width = 0.23, height = 0.25, shutters = false, flowers = false) => {
      const frame = new THREE.Group();frame.position.set(x, y, z);frame.rotation.y = rotation;group.add(frame);
      box(width + 0.055, height + 0.055, 0.024, 0, 0, 0.012, p.roof, frame);
      box(width, height, 0.012, 0, 0, 0.027, this.materials.window, frame).castShadow = false;
      for (const side of [-1, 1]) {
        box(0.022, height + 0.05, 0.028, side * (width / 2 + 0.011), 0, 0.038, p.trim, frame);
        box(width + 0.065, 0.022, 0.028, 0, side * (height / 2 + 0.011), 0.038, p.trim, frame);
        if (shutters) {
          box(0.073, height + 0.035, 0.026, side * (width / 2 + 0.068), 0, 0.02, p.roof, frame);
          for (const yy of [-0.065, 0.065]) box(0.073, 0.016, 0.018, side * (width / 2 + 0.068), yy, 0.041, trim, frame);
        }
      }
      box(0.016, height, 0.02, 0, 0, 0.045, p.trim, frame);
      box(width, 0.016, 0.02, 0, 0.012, 0.045, p.trim, frame);
      box(width + 0.085, 0.03, 0.085, 0, -height / 2 - 0.025, 0.038, p.trim, frame);
      if (flowers) {
        box(width + 0.05, 0.055, 0.075, 0, -height / 2 - 0.075, 0.045, timber, frame);
        for (const offset of [-0.07, 0, 0.07]) {
          box(0.065, 0.04, 0.06, offset, -height / 2 - 0.043, 0.05, this.materials.leaves, frame);
          box(0.03, 0.03, 0.035, offset, -height / 2 - 0.014, 0.065, this.materials.blossom, frame);
        }
      }
    };
    window(-doorX, base + 0.3, front + 0.002, 0, tier === 1 ? 0.24 : 0.3, 0.25, true, true);
    for (const side of [-1, 1]) {
      window(side * (w / 2 + 0.002), base + 0.3, -0.16, side * Math.PI / 2);
      if (tier > 1) window(side * (w / 2 + 0.002), base + 0.77, -0.16, side * Math.PI / 2);
      window(side * w * 0.25, base + 0.3, -front - 0.002, Math.PI);
      if (tier > 1) window(side * w * 0.25, base + 0.77, -front - 0.002, Math.PI);
    }
    if (tier > 1) {
      for (const x of [-0.32, 0.32]) window(x, base + 0.77, front + 0.002, 0, 0.23, 0.25, tier === 2);
    }
    window(0, eave + rise * 0.38, front + 0.004, 0, 0.15, 0.17);

    // Contrasting entrance, glazed upper panel, brass-sized handle and porch.
    box(0.235, 0.405, 0.045, doorX, base + 0.2025, front + 0.014, p.trim);
    box(0.185, 0.365, 0.025, doorX, base + 0.1825, front + 0.045, p.roof);
    box(0.115, 0.11, 0.015, doorX, base + 0.275, front + 0.062, this.materials.window);
    box(0.11, 0.1, 0.012, doorX, base + 0.09, front + 0.063, trim);
    box(0.017, 0.035, 0.018, doorX + 0.061, base + 0.17, front + 0.07, p.trim);
    box(0.42, 0.08, 0.27, doorX, 0.12, front + 0.11, p.brick);
    box(0.46, 0.04, 0.14, doorX, 0.08, front + 0.3, p.brick);
    if (tier < 3) {
      roof(0.48, 0.33, 0.13, base + 0.43, doorX, front + 0.105, false);
      for (const side of [-1, 1]) box(0.032, 0.42, 0.032, doorX + side * 0.195, base + 0.21, front + 0.23, trim);
    } else {
      // The chalet's broad balcony doubles as a shelter for its entrance.
      box(w - 0.14, 0.055, 0.25, 0, base + 0.53, front + 0.11, timber);
      for (const x of [-0.55, -0.275, 0, 0.275, 0.55]) box(0.035, 0.21, 0.035, x, base + 0.66, front + 0.23, timber);
      box(1.14, 0.035, 0.05, 0, base + 0.77, front + 0.23, timber);
      for (const x of [-0.55, 0.55]) box(0.055, 0.53, 0.055, x, base + 0.265, front + 0.22, timber);
      for (const z of [-front - 0.016, front + 0.016]) box(0.045, rise * 0.86, 0.035, 0, eave + rise * 0.43, z, p.trim);
    }

    // Chimney outlet and smoke both derive from the same design parameters.
    const chimneyTop = eave + rise + 0.13;
    box(0.14, 0.48, 0.16, chimneyX, chimneyTop - 0.24, -0.18, p.brick);
    box(0.185, 0.035, 0.205, chimneyX, chimneyTop, -0.18, p.trim);
    box(0.095, 0.009, 0.11, chimneyX, chimneyTop + 0.021, -0.18, p.roof);
    for (let i = 0; i < 3; i++) box(0.148, 0.016, 0.168, chimneyX, chimneyTop - 0.08 - i * 0.09, -0.18, p.trim);

    // Deliberate front garden: path, planted borders and a short open fence.
    for (let z = front + 0.4; z <= 0.88; z += 0.14) box(0.25, 0.018, 0.12, doorX, 0.071, z, p.brick);
    const leafGeo = this.getGeometry('house_garden_facet', () => new THREE.IcosahedronGeometry(1, 0));
    for (const x of [-w / 2 - 0.07, w / 2 + 0.07]) {
      box(0.2, 0.045, 0.36, x, 0.085, 0.29, p.brick);
      for (const z of [0.17, 0.34]) {
        const shrub = new THREE.Mesh(leafGeo, this.materials.leaves);
        shrub.scale.set(0.13, 0.14, 0.14);shrub.position.set(x, 0.18, z);shrub.castShadow = true;group.add(shrub);
      }
    }
    for (const side of [-1, 1]) {
      const start = side < 0 ? -0.87 : doorX + 0.23;
      const end = side < 0 ? doorX - 0.23 : 0.87;
      if (end - start < 0.12) continue;
      box(end - start, 0.035, 0.027, (start + end) / 2, 0.19, 0.93, trim);
      for (let i = 0; i < 3; i++) box(0.035, 0.22, 0.035, start + (end - start) * i / 2, 0.17, 0.93, trim);
    }
    return group;
  }

  // Local outlet location; the renderer applies the tile's rotation/elevation.
  getResidentialChimneyPos(level: number, tileX: number, tileY: number): THREE.Vector3[] {
    if (level <= 0) return [];
    const {h, rise, chimneyX} = this.residentialDesign(level, tileX, tileY);
    return [new THREE.Vector3(chimneyX, 0.16 + h + rise + 0.155, -0.18)];
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
    group.scale.set(ROAD_LAYOUT.CAR_SCALE, ROAD_LAYOUT.CAR_SCALE, ROAD_LAYOUT.CAR_SCALE);

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
function gsapAnimate(material: any, key: 'emissiveIntensity', targetValue: number, duration: number) {
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
