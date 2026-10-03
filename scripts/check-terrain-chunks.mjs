import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
const dir=await mkdtemp(join(tmpdir(),'nabocity-terrain-'));
try {
 const outfile=join(dir,'terrain.mjs');
 await build({stdin:{contents:`export {GroundTerrainChunks} from './src/game/GroundTerrainChunks'; export * from 'three';`,resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',outfile});
 const {GroundTerrainChunks,Scene,InstancedMesh,BoxGeometry,MeshBasicMaterial,InstancedBufferAttribute,Matrix4}=await import(pathToFileURL(outfile));
 const scene=new Scene(),geometry=new BoxGeometry(2,12,2),material=new MeshBasicMaterial();
 const size=10,source=new InstancedMesh(geometry,material,size*size),matrix=new Matrix4();
 const flags=new InstancedBufferAttribute(new Float32Array(size*size*4),4);geometry.setAttribute('aEdgeFlags',flags);
 for(let x=0;x<size;x++)for(let y=0;y<size;y++){const i=x*size+y;source.setMatrixAt(i,matrix.makeTranslation(x*2,0,y*2));flags.setXYZW(i,i,1,2,3);}
 const chunks=new GroundTerrainChunks(scene,source,size);
 assert.equal(source.visible,false);assert.equal(scene.children.length,4);
 const snapshot=()=>scene.children.flatMap(mesh=>Array.from({length:mesh.count},(_,i)=>{mesh.getMatrixAt(i,matrix);return [matrix.elements[12],matrix.elements[13],matrix.elements[14],mesh.geometry.getAttribute('aEdgeFlags').getX(i)];})).sort((a,b)=>a[0]-b[0]||a[2]-b[2]);
 const initial=snapshot();assert.equal(initial.length,100);
 assert.ok(initial.every(([x,,y,flag])=>flag===(x/2)*size+y/2),'topology flags follow their tile');
 const versions=scene.children.map(mesh=>mesh.instanceMatrix.version);chunks.refresh();assert.deepEqual(scene.children.map(mesh=>mesh.instanceMatrix.version),versions,'idle frames do not upload');
 source.setMatrixAt(77,matrix.makeTranslation(14,3.2,14));source.instanceMatrix.needsUpdate=true;flags.setXYZW(77,900,0,0,0);flags.needsUpdate=true;chunks.refresh();
 assert.deepEqual(snapshot().find(([x,,y])=>x===14&&y===14),[14,Math.fround(3.2),14,900]);
 source.setMatrixAt(77,matrix.makeTranslation(0,-100,0));source.instanceMatrix.needsUpdate=true;chunks.refresh();assert.equal(snapshot().length,99,'water hides grass without submitting it');
 source.setMatrixAt(77,matrix.makeTranslation(14,0,14));source.instanceMatrix.needsUpdate=true;flags.setXYZW(77,77,1,2,3);flags.needsUpdate=true;chunks.refresh();assert.deepEqual(snapshot(),initial,'terrain returns with correct neighbor flags');
 for(const mesh of scene.children)assert.ok(mesh.boundingSphere.radius>0,'culling bounds are valid');
 let disposed=0;geometry.addEventListener('dispose',()=>disposed++);material.addEventListener('dispose',()=>disposed++);chunks.dispose();assert.equal(scene.children.length,0);assert.equal(source.visible,true);assert.equal(disposed,0);
 console.log('Terrain checks passed: chunk boundaries, flags, elevation, water, idle uploads, bounds, disposal.');
} finally {await rm(dir,{recursive:true,force:true});}
