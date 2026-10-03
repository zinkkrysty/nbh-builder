import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const dir = await mkdtemp(join(tmpdir(), 'nabocity-scenery-'));
try {
  const outfile = join(dir, 'scenery.mjs');
  await build({ stdin: { contents: `export { EnvironmentScenery } from './src/game/EnvironmentScenery'; export * from 'three';`, resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'esm', outfile });
  const { EnvironmentScenery, Scene, BoxGeometry, MeshBasicMaterial, Matrix4 } = await import(pathToFileURL(outfile));
  const material = new MeshBasicMaterial();
  const geometry = new BoxGeometry();
  const assets = {
    materials: new Proxy({}, { get: () => material }),
    getEnvironmentTreeGeometry: () => geometry,
    getEnvironmentBushGeometry: () => geometry,
    getEnvironmentRockGeometry: () => geometry,
    getEnvironmentPlantGeometry: () => geometry,
    getEnvironmentPlantMaterials: () => material,
  };
  const size = 20;
  const sim = { gridSize: size, seed: 12345, grid: Array.from({ length: size }, (_, x) => Array.from({ length: size }, (_, y) => ({ x, y, type: 'empty', elevation: 0 }))) };
  const scene = new Scene();
  const scenery = new EnvironmentScenery(scene, sim, assets);
  scenery.initialize();
  const matrix = new Matrix4();
  const snapshot = () => scene.children.map(pool => Array.from({ length: pool.count }, (_, index) => { pool.getMatrixAt(index, matrix); return Array.from(matrix.elements).join(','); }).sort());
  const initial = snapshot();
  assert.ok(initial.some(entries => entries.length > 0));
  const mutateAll = type => { for (const column of sim.grid) for (const tile of column) { tile.type = type; scenery.markTileDirty(tile.x, tile.y); } scenery.refresh(); };
  mutateAll('road');
  assert.ok(scene.children.every(pool => pool.count === 0), 'occupied land draws no decorations');
  mutateAll('empty');
  assert.deepEqual(snapshot(), initial, 'land recipes return without missing or duplicate props');
  mutateAll('water_body');
  assert.ok(scene.children.some(pool => pool.count > 0), 'open water decorations appear');
  assert.ok(scene.children.slice(0, 6).every(pool => pool.count === 0), 'land props disappear underwater');
  const water = snapshot();
  sim.grid[10][10].type = 'road'; scenery.markTileDirty(10, 10); scenery.refresh();
  sim.grid[10][10].type = 'water_body'; scenery.markTileDirty(10, 10); scenery.refresh();
  assert.deepEqual(snapshot(), water, 'shoreline removal and restoration preserve other slots');
  scenery.rebuildAll();
  assert.deepEqual(snapshot(), water, 'save/load rebuild preserves decorations');
  mutateAll('empty');
  assert.deepEqual(snapshot(), initial);
  scenery.dispose();
  assert.equal(scene.children.length, 0);
  console.log('Scenery checks passed: construction, restoration, shoreline, rebuild, disposal.');
} finally { await rm(dir, { recursive: true, force: true }); }
