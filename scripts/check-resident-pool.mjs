import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = await mkdtemp(join(tmpdir(), 'nabocity-pool-'));
try {
  const outfile = join(dir, 'pool.mjs');
  await build({
    stdin: {
      contents: `export { CitizenRenderPool } from './src/game/CitizenRenderPool'; export { Object3D, Vector3 } from 'three';`,
      resolveDir: process.cwd(),
    },
    bundle: true, platform: 'node', format: 'esm', outfile,
  });
  const { CitizenRenderPool, Object3D, Vector3 } = await import(pathToFileURL(outfile));
  const parent = new Object3D();
  const pool = new CitizenRenderPool(parent, 512);
  const meshes = parent.children;
  assert.ok(meshes.every(mesh => mesh.count === 0), 'empty pools draw no instances');
  pool.registerResident('a', 1);
  pool.registerResident('b', 2);
  pool.setResidentTransform('a', new Vector3(1, 0, 2), 0, 1, false);
  pool.update(1 / 60);
  assert.deepEqual(meshes.map(mesh => mesh.count), [36, 24, 10, 6, 4]);
  const versions = meshes.map(mesh => mesh.instanceMatrix.version);
  const matrices = meshes.map(mesh => mesh.instanceMatrix.array.slice());
  pool.update(1 / 60);
  assert.deepEqual(meshes.map(mesh => mesh.instanceMatrix.version), versions, 'idle poses do not upload');
  pool.setResidentTransform('a', new Vector3(1, 0, 2), 0, 1, true);
  pool.update(1 / 60);
  assert.notDeepEqual(meshes[0].instanceMatrix.array, matrices[0], 'walking animates');
  const walkingVersion = meshes[0].instanceMatrix.version;
  pool.update(0);
  assert.equal(meshes[0].instanceMatrix.version, walkingVersion, 'pause preserves pose without uploads');
  pool.setResidentTransform('a', new Vector3(1, 0, 2), 0, 1, false);
  pool.update(0);
  assert.deepEqual(meshes[0].instanceMatrix.array, matrices[0], 'stopping restores resting pose');
  pool.unregisterResident('a');
  pool.update(0);
  assert.equal(meshes[0].instanceMatrix.array[0], Math.fround(0.00001), 'removed slot is hidden');
  pool.registerResident('c', 3);
  pool.update(0);
  assert.notEqual(meshes[0].instanceMatrix.array[0], Math.fround(0.00001), 'reused slot is visible');
  pool.unregisterResident('b');
  pool.update(0);
  assert.deepEqual(meshes.map(mesh => mesh.count), [18, 12, 5, 3, 2], 'trailing empty slots stop drawing');
  pool.unregisterResident('c');
  assert.ok(meshes.every(mesh => mesh.count === 0));
  for (let i = 0; i < 512; i++) pool.registerResident(String(i), i);
  assert.throws(() => pool.registerResident('overflow', 0), /capacity/);
  pool.update(0);
  assert.deepEqual(meshes.map(mesh => mesh.count), [9216, 6144, 2560, 1536, 1024]);
  pool.dispose();
  assert.equal(parent.children.length, 0);
  console.log('Resident pool checks passed: animation, pause, removal, slot reuse, capacity, disposal.');
} finally {
  await rm(dir, { recursive: true, force: true });
}
