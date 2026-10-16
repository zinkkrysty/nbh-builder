import * as THREE from 'three';

/** Mirror the renderer's authoritative terrain instances into spatial chunks.
 * Culling skips offscreen tiles in both the scene and sun-shadow passes. Geometry
 * and topology flags are copied exactly; hidden water/bridge tiles draw nothing.
 */
export class GroundTerrainChunks {
  private readonly chunks: Array<{ mesh: THREE.InstancedMesh; indices: number[] }> = [];
  private lastVersion = '';
  private readonly matrix = new THREE.Matrix4();

  constructor(private readonly scene: THREE.Scene, private readonly source: THREE.InstancedMesh, size: number) {
    for (let x = 0; x < size; x += 8) for (let y = 0; y < size; y += 8) {
      const indices: number[] = [];
      for (let gx = x; gx < Math.min(size, x + 8); gx++)
        for (let gy = y; gy < Math.min(size, y + 8); gy++) indices.push(gx * size + gy);
      const geometry = source.geometry.clone();
      for (const [name, attribute] of Object.entries(source.geometry.attributes)) {
        if (attribute instanceof THREE.InstancedBufferAttribute) {
          geometry.setAttribute(name, new THREE.InstancedBufferAttribute(
            new Float32Array(indices.length * attribute.itemSize), attribute.itemSize, attribute.normalized,
          ));
        }
      }
      const mesh = new THREE.InstancedMesh(geometry, source.material, indices.length);
      mesh.name = `terrain-${x},${y}`;
      mesh.castShadow = source.castShadow; mesh.receiveShadow = source.receiveShadow;
      mesh.matrixAutoUpdate = false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.chunks.push({ mesh, indices }); this.scene.add(mesh);
    }
    this.source.visible = false;
    this.refresh();
  }

  refresh(): void {
    const attributes = Object.entries(this.source.geometry.attributes).filter(
      (entry): entry is [string, THREE.InstancedBufferAttribute] => entry[1] instanceof THREE.InstancedBufferAttribute,
    );
    const version = [this.source.instanceMatrix.version, ...attributes.map(([, attribute]) => attribute.version)].join(',');
    if (version === this.lastVersion) return;
    this.lastVersion = version;
    for (const { mesh, indices } of this.chunks) {
      let count = 0;
      let hasShadowCaster = false;
      for (const sourceIndex of indices) {
        // The existing renderer hides grass beneath water/bridges at y=-100.
        const y = this.source.instanceMatrix.array[sourceIndex * 16 + 13];
        if (y < -50) continue;
        if (y > 0.01) hasShadowCaster = true;
        this.source.getMatrixAt(sourceIndex, this.matrix);
        mesh.setMatrixAt(count, this.matrix);
        for (const [name, attribute] of attributes) {
          const target = mesh.geometry.getAttribute(name) as THREE.InstancedBufferAttribute;
          for (let component = 0; component < attribute.itemSize; component++) {
            target.array[count * attribute.itemSize + component] = attribute.array[sourceIndex * attribute.itemSize + component];
          }
        }
        count++;
      }
      mesh.count = count;
      mesh.castShadow = this.source.castShadow && hasShadowCaster;
      mesh.instanceMatrix.needsUpdate = true;
      for (const [name] of attributes) mesh.geometry.getAttribute(name).needsUpdate = true;
      mesh.computeBoundingSphere();
      // Terrain shader displaces cliff rims slightly beyond the authored box.
      if (mesh.boundingSphere && count > 0) mesh.boundingSphere.radius += 0.4;
    }
  }

  dispose(): void {
    for (const { mesh } of this.chunks) {
      this.scene.remove(mesh); mesh.dispose(); mesh.geometry.dispose();
    }
    this.chunks.length = 0; this.source.visible = true;
  }
}
