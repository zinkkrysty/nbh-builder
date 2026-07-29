# NaboCity visual-probe runtime reference

## Runtime map

- Entry point: `src/main.ts` exposes the `Game` instance as `window.game` after `DOMContentLoaded`.
- Simulation: `game.sim.grid[x][y]`, `gridSize`, `rebuildTileTypeCaches()`.
- Render adapter: `game.renderer.scene`, `camera`, `composer`, `buildingMeshes`, `groundMesh`.
- Asset factory: `game.assets`, `game.assets.materials`, `create*Mesh()`, `mergeMeshesByMaterial()`.
- Current material profile: `game.assets.materials`.
- Profile stores: `standardMaterials`, `softToonMaterials`, `toonMaterials`.
- Main commands: `npm run build`, `npm run dev -- --host 127.0.0.1 --port 5173`.
- Grid-to-world mapping: `(tile.x - 25) * 2`, elevation `(tile.elevation || 0) * 0.8`, `(tile.y - 25) * 2`.

Common material keys include `grass`, `dirt`, `waterBlue`, `waterShoreFoam`, `waterShoreFoamInner`, `road`, `roadLine`, `roadCrosswalk`, `sidewalk`, `curb`, `trunk`, and `leaves`. Confirm current names with `rg "register(Mat|BasicMat)" src/game/AssetGenerator.ts`.

## Capture config schema

Paths are resolved relative to the config file.

```json
{
  "url": "http://127.0.0.1:5173/",
  "outputDir": "before",
  "viewport": { "width": 1400, "height": 900 },
  "deviceScaleFactor": 1,
  "enterSelector": "#btn-enter",
  "waitAfterEnterMs": 500,
  "setupScript": "scenario.js",
  "hideSelectors": ["#loader", "#hud-layer"],
  "freeze": true,
  "failOnConsoleError": true,
  "captures": [
    { "name": "baseline" },
    { "name": "without-foam", "hideMaterials": ["waterShoreFoam", "waterShoreFoamInner"] },
    {
      "name": "foam-only",
      "showOnlyMaterials": ["waterShoreFoam", "waterShoreFoamInner"],
      "background": "#233040",
      "fog": false
    },
    {
      "name": "water-only",
      "showOnlyMaterials": ["waterBlue"],
      "background": "#233040",
      "fog": false
    },
    {
      "name": "bank-only",
      "showOnlyMaterials": ["grass", "dirt"],
      "background": "#c8d5df",
      "fog": false
    }
  ]
}
```

Capture entries support:

- `name`: safe output filename without extension;
- `showOnlyMaterials`: active-profile material keys to isolate;
- `hideMaterials`: material keys to remove from the combined scene;
- `background`: neutral CSS color for isolated geometry;
- `fog: false`: disable fog for that capture;
- `hideSelectors`: additional DOM selectors to hide;
- `selector`: optional element screenshot target; omit for the full viewport.

## Deterministic scenario example

The setup file is evaluated in the page as a function body with `game` supplied. Do not include imports or TypeScript syntax.

```js
game.sim.paused = true;
game.sim.speed = 0;
game.renderer.clearAllBuildings();

for (let x = 0; x < game.sim.gridSize; x += 1) {
  for (let y = 0; y < game.sim.gridSize; y += 1) {
    const tile = game.sim.grid[x][y];
    tile.type = 'empty';
    tile.bridge = false;
    if (x >= 18 && x <= 32 && y >= 18 && y <= 32) tile.elevation = 0;
  }
}

const water = [];
for (let x = 19; x <= 31; x += 1) {
  for (let y = 21; y <= 29; y += 1) {
    // Two offsets form both convex and concave shoreline corners.
    if ((x === 25 && y <= 23) || (x === 26 && y <= 22)) continue;
    const tile = game.sim.grid[x][y];
    tile.type = 'water_body';
    water.push(tile);
  }
}

game.sim.rebuildTileTypeCaches();
game.renderer.resetGroundInstances();
for (const tile of water) game.renderer.updateTileMesh(tile);

game.renderer.cameraTarget.set(0, 0, -5);
game.renderer.desiredCameraTarget.set(0, 0, -5);
game.renderer.cameraZoom = 180;
game.renderer.desiredCameraZoom = 180;
game.renderer.cameraAngleX = Math.PI / 5.5;
game.renderer.desiredAngleX = Math.PI / 5.5;
game.renderer.cameraAngleY = Math.PI / 4;
game.renderer.desiredAngleY = Math.PI / 4;
game.renderer.updateCameraPosition();
game.renderer.onWindowResize();
```

Adapt the state setup to the visual system under test. A road improvement should include intersections and ramps; a building improvement should select representative levels and palettes; a lighting change should capture day, golden hour, and night with fixed times.

## Useful manual probes

Run these only inside a temporary Playwright `page.evaluate()` experiment:

```js
const material = game.assets.materials.waterBlue;
material.depthWrite = true;
material.needsUpdate = true;
game.renderer.composer.render();
```

```js
game.renderer.scene.traverse(node => {
  if (node.isMesh || node.isInstancedMesh) {
    node.visible = node.material === game.assets.materials.waterShoreFoam;
  }
});
game.renderer.scene.fog = null;
game.renderer.composer.render();
```

Reload the page after manual probes so shared material mutations cannot leak into the next experiment.

## Choosing probes by symptom

| Symptom | First isolation | Likely owner |
|---|---|---|
| Dark transparent patch | transparent material alone, then substrate alone | overlap, depth, render order |
| Thin crack at tile boundary | both neighboring geometry families alone | coordinate mismatch, cache key |
| Corner spike or long triangle | suspect geometry alone at close zoom | bad index, intersection, cap ownership |
| Different result after editing a neighbor | mutate cardinal and diagonal neighbors | stale neighbor hash or rebuild radius |
| Changes with camera rotation | repeat at two yaws | sorting, backface, normals, clipping |
| Only fails after profile switch | capture each material profile | missing shader hook or uniform update |
| HUD obscures playfield | WebGL-only and full-page captures | DOM layout or camera framing |
| Glow or haze hides detail | disable fog/bloom/light independently | post-processing or atmosphere |
