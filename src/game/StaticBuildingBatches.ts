import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Coalesce opaque, stationary tile models without changing their source objects.
 * Small spatial chunks bound rebuild work and preserve camera/shadow culling.
 * Transparent surfaces and animated models retain their existing render path.
 */
export class StaticBuildingBatches {
  private readonly sources = new Map<string, THREE.Object3D>();
  private readonly chunks = new Map<string, THREE.Group>();
  private readonly dirty = new Set<string>();

  constructor(private readonly scene: THREE.Scene) {}

  set(key: string, source: THREE.Object3D): void {
    this.remove(key);
    const type = source.userData.type;
    if (!['residential', 'commercial', 'industrial', 'park', 'water', 'boardwalk', 'road'].includes(type)
      || source.userData.constructionStatus === 'planned'
      || source.userData.constructionStatus === 'building') return;
    let eligible = true;
    source.traverse(node => {
      if (node.name.includes('rotor') || node.userData.dynamic) eligible = false;
      if (node instanceof THREE.Mesh) {
        const materials = Array.isArray(node.material) ? node.material : [node.material];
        if (Array.isArray(node.material) || materials.some(material => material.transparent)) eligible = false;
      }
    });
    if (!eligible) return;
    this.sources.set(key, source);
    source.visible = false;
    this.dirty.add(this.chunkKey(key));
  }

  remove(key: string): void {
    const source = this.sources.get(key);
    if (!source) return;
    source.visible = true;
    this.sources.delete(key);
    this.dirty.add(this.chunkKey(key));
  }

  invalidateAll(): void {
    for (const [key, source] of [...this.sources]) this.set(key, source);
  }

  refresh(): void {
    for (const key of this.dirty) this.rebuild(key);
    this.dirty.clear();
  }

  clear(): void {
    for (const source of this.sources.values()) source.visible = true;
    for (const chunk of this.chunks.values()) this.disposeChunk(chunk);
    this.sources.clear(); this.chunks.clear(); this.dirty.clear();
  }

  private chunkKey(key: string): string {
    const [x, y] = key.split(',').map(Number);
    return `${Math.floor(x / 8)},${Math.floor(y / 8)}`;
  }

  private rebuild(key: string): void {
    const previous = this.chunks.get(key);
    if (previous) this.disposeChunk(previous);
    this.chunks.delete(key);
    const group = new THREE.Group();
    group.name = `static-buildings-${key}`;
    const buckets = new Map<string, { material: THREE.Material; geometries: THREE.BufferGeometry[]; castShadow: boolean; receiveShadow: boolean; renderOrder: number }>();
    for (const [tileKey, source] of this.sources) {
      if (this.chunkKey(tileKey) !== key) continue;
      source.updateMatrixWorld(true);
      source.traverse(node => {
        if (!(node instanceof THREE.Mesh) || Array.isArray(node.material)) return;
        const geometry = node.geometry.clone().applyMatrix4(node.matrixWorld);
        const signature = Object.keys(geometry.attributes).sort().map(name => `${name}:${geometry.attributes[name].itemSize}`).join('|');
        const bucketKey = `${node.material.uuid}:${Boolean(geometry.index)}:${signature}:${node.castShadow}:${node.receiveShadow}:${node.renderOrder}`;
        let bucket = buckets.get(bucketKey);
        if (!bucket) {
          bucket = { material: node.material, geometries: [], castShadow: node.castShadow, receiveShadow: node.receiveShadow, renderOrder: node.renderOrder };
          buckets.set(bucketKey, bucket);
        }
        bucket.geometries.push(geometry);
      });
    }
    for (const bucket of buckets.values()) {
      const merged = mergeGeometries(bucket.geometries, false);
      if (merged) {
        const mesh = new THREE.Mesh(merged, bucket.material);
        mesh.castShadow = bucket.castShadow; mesh.receiveShadow = bucket.receiveShadow;
        mesh.renderOrder = bucket.renderOrder;
        merged.computeBoundingSphere();
        mesh.matrixAutoUpdate = false;
        group.add(mesh);
      } else {
        // Keep valid source geometry visible if attributes cannot be merged.
        for (const geometry of bucket.geometries) {
          const mesh = new THREE.Mesh(geometry.clone(), bucket.material);
          mesh.castShadow = bucket.castShadow; mesh.receiveShadow = bucket.receiveShadow;
          mesh.renderOrder = bucket.renderOrder; group.add(mesh);
        }
      }
      for (const geometry of bucket.geometries) geometry.dispose();
    }
    if (group.children.length) { this.scene.add(group); this.chunks.set(key, group); }
  }

  private disposeChunk(chunk: THREE.Group): void {
    this.scene.remove(chunk);
    chunk.traverse(node => { if (node instanceof THREE.Mesh) node.geometry.dispose(); });
    // Materials belong to AssetGenerator and remain shared by source models.
  }
}
