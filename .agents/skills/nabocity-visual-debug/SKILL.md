---
name: nabocity-visual-debug
description: Diagnose, implement, and verify visual changes in NaboCity's Vite and plain Three.js runtime with deterministic headless-browser scenes, screenshot comparison, and render-layer isolation. Use for geometry artifacts, material or shader bugs, transparency and depth issues, lighting or fog regressions, post-processing problems, camera-dependent glitches, HUD overlap, and any visual improvement that needs evidence beyond compilation or DOM assertions.
---

# NaboCity Visual Debug

Use controlled screenshots as experiments. Change one visual variable at a time, identify the owning render layer before editing, and replay the identical scene after the implementation.

## Core workflow

1. Inspect the screenshot and describe the artifact geometrically: location, shape, color, transparency, camera dependence, and the boundary where it appears.
2. Trace likely owners with `rg` before changing code. In this project, start with `src/game/Renderer.ts`, `src/game/AssetGenerator.ts`, and the relevant simulation state.
3. Run `npm run build` before editing. Record pre-existing failures separately.
4. Create a deterministic browser scenario that directly configures `window.game`, rather than relying on mouse placement or a user's local save.
5. Capture an untouched baseline at the exact viewport, camera, game state, time, and material profile used for later verification.
6. Capture diagnostic variants by hiding or isolating one render aspect at a time.
7. Form a source-level hypothesis from the captures. Prefer the smallest implementation change that repairs ownership or topology rather than covering the symptom.
8. Rebuild and replay the identical scenario. Capture the same baseline and isolation views after the change.
9. Inspect the screenshots visually, then use pixel comparison as supporting evidence when the framing is identical.
10. Test a nearby state transition that can invalidate cached geometry: add/remove a tile, change a diagonal neighbor, switch a material profile, move the camera, or resize the viewport.
11. For detailed asset, silhouette, material, or seam work, also capture at the runtime's closest supported in-game zoom. Inspect that close-up before relying on normal gameplay framing; distant views can hide faceting, intersections, thin gaps, and repeated-shape artifacts.

## Build a deterministic scene

Use the game API exposed as `window.game`. Set all relevant state explicitly:

- pause simulation and set speed to zero;
- clear or rebuild the affected region;
- assign tile types, elevations, bridge flags, and neighbor state directly;
- rebuild tile caches and renderer instances;
- rebuild every affected tile only after the final state is in place;
- set both current and desired camera target, zoom, pitch, and yaw;
- when checking detailed geometry, set the camera to the closest supported in-game zoom (currently `cameraZoom = desiredCameraZoom = 300`) and frame the affected tile directly;
- call `updateCameraPosition()` and `onWindowResize()`;
- hide `#loader` and `#hud-layer` when testing the WebGL layer alone.

Keep setup scripts and screenshots under `/tmp/nabocity-visual-debug/`. Do not overwrite `public/screenshot.png` or a user save for diagnostics.

Read [references/nabocity-runtime.md](references/nabocity-runtime.md) when authoring a scenario or choosing material/layer probes.

## Isolate the render graph

Capture the combined result first. Then use these experiments in order of cost:

1. Hide one suspect material.
2. Show only the suspect material or material family on a neutral background with fog disabled.
3. Compare opaque geometry, transparent surfaces, and DOM overlays independently.
4. Toggle a runtime property temporarily: `visible`, `opacity`, `transparent`, `depthWrite`, `depthTest`, `side`, `renderOrder`, light visibility, fog, or a post-processing pass.
5. If needed, isolate object groups by traversing `game.renderer.scene` or inspecting `game.renderer.buildingMeshes`.

Never persist a diagnostic toggle unless the experiment proves it is the intended fix.

Interpret isolation results as follows:

- Artifact remains when the material is shown alone: inspect that material's geometry, shader, normals, attributes, or merged topology.
- Artifact disappears when one layer is hidden: that layer owns the symptom, but it may still be interacting with another layer.
- Each isolated layer looks correct but the combined capture fails: inspect alpha blending, coplanar overlap, depth writes, render order, and intersecting geometry.
- Artifact changes with camera angle: inspect depth sorting, backfaces, z-fighting, normals, or near-plane clipping.
- Artifact stays at a grid corner after camera movement: inspect neighbor classification, corner ownership, cached geometry keys, and diagonal invalidation.
- Large triangles appear from a small corner: isolate transparent surfaces and underlying opaque faces; a small overlap or intersection can expose a full source triangle.

For transparent geometry, do not assume the visible color identifies the bad mesh. Capture the transparent surface alone, then the opaque substrate alone. Double alpha, an intersecting bank face, and a foam cap can all appear as a blue shoreline wedge in the combined frame.

## Use the capture tool

Call `codex_app__load_workspace_dependencies` to locate the bundled Node modules, then set `CODEX_WORKSPACE_NODE_MODULES` for Playwright resolution.

```bash
CODEX_WORKSPACE_NODE_MODULES=/path/to/node_modules \
node .agents/skills/nabocity-visual-debug/scripts/capture_visual_state.mjs \
  --config /tmp/nabocity-visual-debug/shoreline.json
```

The config points to a browser-side setup script and defines a baseline plus any material-isolation captures. See [references/nabocity-runtime.md](references/nabocity-runtime.md) for the schema and example.

Use the same config before and after. Preserve the first output directory before editing.

## Compare before and after

Always inspect both images directly. For identical dimensions and deterministic framing, also generate a diff:

```bash
CODEX_WORKSPACE_NODE_MODULES=/path/to/node_modules \
node .agents/skills/nabocity-visual-debug/scripts/compare_screenshots.mjs \
  --before /tmp/nabocity-visual-debug/before/baseline.png \
  --after /tmp/nabocity-visual-debug/after/baseline.png \
  --diff /tmp/nabocity-visual-debug/diff.png
```

Treat mismatch percentage as a locator, not a pass/fail oracle. Water waves, smoke, shadows, antialiasing, material changes, and intentional improvements can change many correct pixels.

## Implementation rules for this game

- Keep simulation state outside Three.js view objects.
- Preserve `AssetGenerator.mergeMeshesByMaterial()` attribute compatibility when adding custom geometry attributes.
- Account for the active material profile. `game.assets.materials` is the current profile; standard, soft-toon, and toon variants may each need shader uniforms or updates.
- Include every state input in geometry cache keys and renderer neighbor hashes. If a shape depends on diagonals, diagonal changes must invalidate it.
- For shared boundaries, assign one deterministic geometry owner. Separate transparent meshes must not cover the same area unless double blending is intentional.
- Prefer world-coordinate-derived shader behavior when adjacent tiles must meet.
- Verify `renderOrder`, `depthWrite`, and material identity after mesh merging.
- Do not dispose cached shared geometries or materials while replacing one scene object.
- Preserve unrelated dirty-worktree changes.

## Verification standard

Before reporting completion:

- `npm run build` succeeds;
- `git diff --check` succeeds;
- the browser has no new `pageerror` or console error;
- the exact before scene is replayed after the change;
- combined and isolated captures are reviewed;
- detailed visual work includes a reviewed capture at the closest supported in-game zoom;
- at least one convex/concave, connected/disconnected, or otherwise adjacent edge case is checked when topology is involved;
- a dynamic rebuild or neighbor mutation does not leave stale visuals;
- unrelated visual systems remain visible in one representative full-scene capture.

Report the visible cause, implementation owner, changed files, captures reviewed, and verification commands. Include a final screenshot when it materially demonstrates the result.
