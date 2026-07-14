import * as THREE from 'three';
import { AssetGenerator } from '/Users/cristianandrei/MyFiles/Projects/Vibecoded/nabocity/src/game/AssetGenerator';
import * as fs from 'fs';

// Mock requestAnimationFrame for any animations to load cleanly
if (typeof global !== 'undefined') {
  (global as any).requestAnimationFrame = (cb: any) => setTimeout(cb, 16);
}

const assets = new AssetGenerator();
const faces: any[] = [];
const texts: any[] = [];

// Isometric axonometric angles: 45° yaw, 30° pitch down
const angleY = Math.PI / 4;
const angleX = Math.PI / 6;
const lightDir = new THREE.Vector3(0.5, 1.2, 0.8).normalize();

const seeds = [
  { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 },
  { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 1 },
  { x: 0, y: 2 }, { x: 1, y: 2 }, { x: 2, y: 2 }, { x: 3, y: 2 },
  { x: 0, y: 3 }, { x: 1, y: 3 }, { x: 2, y: 3 }, { x: 3, y: 3 }
];

const cellSize = 500;
const scale = 280;

for (let i = 0; i < 16; i++) {
  const seed = seeds[i];
  const col = i % 4;
  const row = Math.floor(i / 4);

  // Compute centers for this cell
  const cellOffsetX = col * cellSize + 250;
  const cellOffsetY = row * cellSize + 290;

  // Add cell text label metadata
  texts.push({
    text1: `House #${i + 1}`,
    text2: `Seed: (${seed.x}, ${seed.y})`,
    x: col * cellSize + 30,
    y: row * cellSize + 50
  });

  function project(v: THREE.Vector3) {
    const rotated = v.clone()
      .applyAxisAngle(new THREE.Vector3(0, 1, 0), angleY)
      .applyAxisAngle(new THREE.Vector3(1, 0, 0), angleX);
    
    return {
      x: rotated.x * scale + cellOffsetX,
      y: -rotated.y * scale + cellOffsetY,
      z: rotated.z
    };
  }

  // Generate cottage mesh
  const group = assets.createResidentialMesh(1, seed.x, seed.y);
  group.updateMatrixWorld(true);

  const meshes: any[] = [];
  function collectMeshes(object: THREE.Object3D, parentMatrix = new THREE.Matrix4()) {
    const localMatrix = new THREE.Matrix4().multiplyMatrices(parentMatrix, object.matrix);
    if (object instanceof THREE.Mesh) {
      meshes.push({
        mesh: object,
        worldMatrix: localMatrix,
        geometry: object.geometry,
        material: object.material
      });
    }
    object.children.forEach(child => {
      collectMeshes(child, localMatrix);
    });
  }
  collectMeshes(group);

  meshes.forEach(({ mesh, worldMatrix, geometry, material }) => {
    const posAttr = geometry.attributes.position;
    const indexAttr = geometry.index;
    const count = indexAttr ? indexAttr.count : posAttr.count;

    const box = new THREE.Box3().setFromObject(mesh);
    const center = new THREE.Vector3();
    box.getCenter(center);
    const layer = center.y < 0.08 ? 0 : 1;

    for (let j = 0; j < count; j += 3) {
      const idx0 = indexAttr ? indexAttr.getX(j) : j;
      const idx1 = indexAttr ? indexAttr.getX(j+1) : j+1;
      const idx2 = indexAttr ? indexAttr.getX(j+2) : j+2;

      const v0 = new THREE.Vector3().fromBufferAttribute(posAttr, idx0).applyMatrix4(worldMatrix);
      const v1 = new THREE.Vector3().fromBufferAttribute(posAttr, idx1).applyMatrix4(worldMatrix);
      const v2 = new THREE.Vector3().fromBufferAttribute(posAttr, idx2).applyMatrix4(worldMatrix);

      const normal = new THREE.Vector3();
      const e1 = new THREE.Vector3().subVectors(v1, v0);
      const e2 = new THREE.Vector3().subVectors(v2, v0);
      normal.crossVectors(e1, e2).normalize();

      const p0 = project(v0);
      const p1 = project(v1);
      const p2 = project(v2);

      const depth = (p0.z + p1.z + p2.z) / 3;

      faces.push({
        points: [p0, p1, p2],
        depth,
        layer,
        color: getColorHex(material),
        normal
      });
    }
  });
}

function getColorHex(material: any): number {
  if (Array.isArray(material)) {
    material = material[0];
  }
  if (material.name === 'window' || material.color === undefined) {
    return 0xfef08a;
  }
  return material.color.getHex();
}

function getShadedColor(hex: number, normal: THREE.Vector3): string {
  const r = (hex >> 16) & 255;
  const g = (hex >> 8) & 255;
  const b = hex & 255;

  const dot = normal.dot(lightDir);
  let shading = 0.55 + 0.45 * Math.max(0, dot);

  if (normal.y > 0.5) {
    shading = Math.min(1.0, shading + 0.15);
  } else if (normal.y < -0.5) {
    shading = 0.35;
  } else {
    if (normal.x < -0.1) {
      shading = Math.max(0.42, shading - 0.08);
    }
  }

  const sr = Math.min(255, Math.floor(r * shading));
  const sg = Math.min(255, Math.floor(g * shading));
  const sb = Math.min(255, Math.floor(b * shading));

  return `rgb(${sr},${sg},${sb})`;
}

// Sort all faces by layer, then depth
faces.sort((a, b) => {
  if (a.layer !== b.layer) {
    return a.layer - b.layer;
  }
  return a.depth - b.depth;
});

// Build 4x4 Grid SVG Content
let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2000 2000" width="2000" height="2000" style="background:#111827;">\n`;

faces.forEach(face => {
  const pointsStr = face.points.map((p: any) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const colorStr = getShadedColor(face.color, face.normal);
  svgContent += `  <polygon points="${pointsStr}" fill="${colorStr}" stroke="${colorStr}" stroke-width="0.5" />\n`;
});

// Add metadata texts
texts.forEach(t => {
  svgContent += `  <text x="${t.x}" y="${t.y}" fill="#f3f4f6" font-family="system-ui, -apple-system, sans-serif" font-size="24" font-weight="bold">${t.text1}</text>\n`;
  svgContent += `  <text x="${t.x}" y="${t.y + 30}" fill="#9ca3af" font-family="system-ui, -apple-system, sans-serif" font-size="18">${t.text2}</text>\n`;
});

svgContent += `</svg>\n`;

const outputPath = '/Users/cristianandrei/.gemini/antigravity/brain/eba3f64e-63b5-4ba8-92af-70d1812ddff9/house_grid.svg';
fs.writeFileSync(outputPath, svgContent);
console.log('SVG grid generated successfully!');
