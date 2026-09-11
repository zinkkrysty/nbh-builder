# Proposal: Deterministic low-poly natural scenery

Status: Proposed  
Date: 2026-07-29  
Scope: Renderer-side environmental presentation

## Summary

Replace the current tree-only scatter and per-water-tile vegetation with one art-directed, deterministic scenery system for trees, rocks, boulders, bushes, shrubs, reeds, and lily pads.

The system will:

- frame undeveloped land with varied low-poly vegetation and stone;
- place rare, partially submerged boulders in open water, with a small halo of water plants;
- improve tree silhouettes, palette, clustering, and rarity so the map feels composed rather than uniformly random;
- clear every natural prop as soon as its tile is used for construction, including roads, zones, utilities, parks, water, boardwalks, and bridges;
- restore the same scenery deterministically when a tile becomes eligible again;
- move land scenery by exactly the tile's elevation step whenever land is raised or lowered; and
- keep scenery as derived presentation, requiring no save migration or simulation state.

The recommended implementation is a new `EnvironmentScenery` renderer component backed by a small, fixed set of global `THREE.InstancedMesh` pools. `Simulation` remains the source of truth for the map seed, tile type, bridge state, and elevation. `AssetGenerator` remains the source of shared low-poly geometry and material profiles.

## Why this work is needed

The current environment has useful foundations but no general scenery lifecycle:

- `Renderer.rebuildTrees()` generates at most one tree recipe per tile, heavily favors the map margin, and uses one three-cone silhouette with either green or blossom foliage.
- `Renderer.updateTreesOnTile()` hides trees on non-empty tiles and restores them after demolition. However, it exits when visibility has not changed, so a visible tree is not repositioned when its empty tile is raised or lowered.
- `AssetGenerator.createWaterBodyMesh()` independently adds lily pads or reeds to some water tiles. Those props are rebuilt as part of each tile mesh, add per-tile geometry work, and use coordinates without the neighborhood seed.
- There is no shared placement language for rocks, shrubs, tree variants, and water compositions, so adding each category independently would create inconsistent density and update behavior.

This proposal turns those separate cases into one predictable system.

## Goals

1. Make untouched terrain feel natural, cozy, and recognizably low-poly without obscuring the buildable grid.
2. Give trees at least three readable silhouette families and a restrained, coordinated palette.
3. Add land rocks, occasional boulders, bushes, and shrubs in deliberate clusters rather than uniform noise.
4. Add rare open-water boulders, accompanied by reeds and/or lily pads, without colliding with shorelines, bridges, boardwalks, or piers.
5. Make all placement stable for a neighborhood seed and grid coordinate.
6. Make construction, demolition, terrain sculpting, save/load, reset, and material-profile switching update scenery correctly.
7. Bound draw calls, shadow work, instance counts, and rebuild cost.

## Non-goals

- Natural props do not block construction, movement, pathfinding, or tile selection.
- The player cannot individually select, move, harvest, or bulldoze a natural prop.
- Scenery is not a forestry, resource, ecology, biome, season, or growth simulation.
- Props do not need animation in the first slice. Water motion remains owned by the existing water shader.
- This work does not add authored GLB assets, textures, physics bodies, save fields, or a save-version bump.
- Parks and player-placed decorative details remain separate systems. Natural scatter appears only on untouched land or eligible water.

## Player-facing art direction

### Composition

The map should read in three visual scales:

1. **Trees form the frame.** Taller silhouettes gather into loose groves, especially toward the map edge, while leaving the playable center calmer.
2. **Shrubs and rocks bridge the scale.** Low clusters break up broad empty grass without making every tile busy.
3. **Water boulders form rare landmarks.** A boulder and its nearby plants should read as one small composition, not as unrelated rolls scattered across the lake.

Use negative space deliberately. An eligible tile receives at most one primary feature (tree, boulder, or rock cluster) and up to two small supporting clusters. Scenery must not make an empty tile look occupied or difficult to build on.

### Tree families

Use shared primitive geometry to produce three main silhouettes plus one rare color treatment:

| Family | Shape language | Typical placement |
|---|---|---|
| Compact conifer | Slightly tapered trunk with two or three irregular, offset conical tiers | Grove edges and cooler/darker patches |
| Rounded broadleaf | Shorter trunk with two or three overlapping faceted crowns | Most common interior and mixed-grove tree |
| Slender tree | Narrow trunk with a higher, lighter, asymmetric crown | Used sparingly to break the canopy line |
| Blossom accent | A restrained pink/cream treatment on a rounded or slender recipe, not a separate dominant forest | Roughly 4–7% of visible trees |

Variation should come from controlled proportions: height, crown width, tier spacing, slight crown offset, rotation, and two or three muted foliage shades. Avoid extreme lean, neon green, perfect repeated cones, and independent random scaling of every axis.

### Rocks, bushes, and shrubs

- Rocks use three cached faceted geometry variants, from flattened chips to shoulder-high boulders.
- Each rock geometry is generated once from an icosahedron or dodecahedron by applying seeded radial deformation, flattening its base, and recomputing flat normals.
- Land rock clusters use one dominant stone plus zero to two smaller companions, with a cool-gray/taupe palette that remains distinct from terrain cliffs and concrete.
- Bushes are compact clusters of two or three faceted lobes. Shrubs are lower and wider, with a slightly duller green than tree crowns.
- Understory colors should sit between the terrain grass and tree canopy rather than competing with buildings or blossom accents.

### Water compositions

- Large water boulders are partially submerged and stay comfortably within the tile footprint.
- A qualifying boulder receives a deterministic halo of three to six plant clumps chosen from reeds, cattails, and lily pads.
- Plant clumps use angular spacing with small seeded offsets so the arrangement reads as a composition around the rock.
- Reeds and lily pads that are not associated with a boulder remain possible near natural shores, but at a lower density than the current independent 35% vegetation roll.
- Water scenery is opaque geometry placed around the transparent water surface. Its vertical offsets must be tuned so lower rock faces and plant stems remain visibly submerged while their tops stay legible through the animated water.

## Deterministic generation

Scenery recipes are derived from `Simulation.seed`, tile coordinates, a stable slot number, and a named random channel. Use a stateless hash such as:

```text
hash01(seed, gridX, gridY, slot, channel)
```

Named channels such as `category`, `variant`, `offset-x`, `offset-z`, `rotation`, `scale`, and `color` prevent a newly inserted random choice from rerolling every later property. This is more stable than advancing one sequential random stream.

Generation happens in two layers:

- **Recipe generation** is based only on the seed and coordinates. It decides the potential props and assigns stable instance-pool indices.
- **Visibility and placement** are derived from current tile state. They decide whether each recipe is shown and at what world-space height.

Recipes are not persisted. Loading the same save regenerates the same candidates, then applies the loaded tile types and elevations.

### Distribution rules

Initial tuning should use ranges rather than treating these values as final art constants:

| Feature | Candidate rule | Eligibility rule | Initial target |
|---|---|---|---|
| Trees | Low-frequency grove field plus a seeded per-tile roll; denser toward the map frame | `tile.type === 'empty'` | 20–30% of edge-region tiles, 3–7% of calm interior tiles |
| Bush/shrub cluster | Independent understory channel, biased toward grove boundaries | `tile.type === 'empty'` | 10–18% of land candidates |
| Land rock cluster | Independent stone channel, negatively correlated with dense tree crowns | `tile.type === 'empty'` | 4–8% of land candidates |
| Open-water boulder | Rare water-landmark channel | `water_body`, at least three cardinal water neighbors, no adjacent boardwalk or bridge | 1.5–3% of eligible open-water tiles |
| Shore plants | Shore-oriented channel | `water_body`, natural land/water adjacency, no adjacent boardwalk or bridge | 4–10% of eligible shoreline tiles |
| Boulder plant halo | Generated as part of an eligible water-boulder recipe | Same as owning boulder | Three to six clumps per visible boulder |

All local centers and extents must remain inside a conservative tile-safe area. Primary centers should stay within approximately `±0.55` units of the tile center, with the final geometry footprint inside approximately `±0.78`. This keeps scenery away from the jagged terrain rim, neighboring lots, and engineered edges.

The water-boulder rule deliberately requires open water. A one-tile pond, narrow canal, bridge approach, or boardwalk edge should remain readable and unobstructed. If playtesting shows that the three-neighbor rule is too restrictive, relax it only after adding an explicit shoreline-clearance check.

## Architecture

### `EnvironmentScenery.ts`

Add a renderer-side component with this responsibility boundary:

```text
EnvironmentScenery
  initialize(simulation, scene, assets)
  rebuildAll()
  markTileDirty(x, y, includeNeighbors)
  flushDirtyTiles()
  refreshMaterialProfile()
  dispose()
```

It owns:

- deterministic scenery recipes indexed by tile;
- stable handles into global instanced pools;
- visibility rules for land and water recipes;
- matrix/color updates for changed tiles; and
- disposal of its `InstancedMesh` pools.

It does not own tile state, gameplay rules, water topology, save data, or UI.

### `AssetGenerator.ts`

Keep reusable visual assets here:

- three cached procedural rock geometries;
- shared tree trunk and canopy primitives;
- a merged bush-cluster geometry and a merged shrub-cluster geometry;
- a merged reed/cattail clump and a low-poly lily-pad rosette;
- shared stone, bark, foliage, blossom, reed, cattail, and lily-pad material triplets for standard, soft-toon, and toon profiles.

Per-instance color may vary within a narrow palette. Material-profile changes must continue to work through `Renderer.refreshSceneMaterials()` without rebuilding recipes.

### Instance pools

Use a small fixed set of map-wide pools rather than a `THREE.Group` per prop or per tile. A practical first budget is:

1. trunks;
2. conifer crowns;
3. rounded/slender crowns;
4. blossom crowns;
5. bushes/shrubs;
6–8. three rock geometry variants, shared by land and water recipes;
9. reed/cattail clumps; and
10. lily-pad/flower rosettes.

A recipe stores the pool index for each of its parts. Hidden candidates receive a zero-scale matrix, just as the current trees do. Recipes are indexed by tile so an update does not scan every tree or regenerate unrelated scenery.

Small shrubs, reeds, and lily pads do not cast shadows. Trees and rocks may cast, but the number of shadow-casting pools must remain bounded. All pools receive or cast shadows consistently with their scale and material.

## Tile lifecycle and update rules

Replace the tree-specific update path with one scenery refresh path.

| Tile event | Required result |
|---|---|
| Empty land becomes any non-empty tile | Hide every land recipe on that tile immediately, before the new structure reads as complete |
| Empty land becomes `water_body` | Hide land recipes; show eligible water recipes after topology is updated |
| `water_body` becomes a road bridge or boardwalk | Hide the water boulder and every associated plant on that tile |
| A built tile is demolished to `empty` | Restore the exact seed-derived land recipes at the tile's current elevation |
| A bridge is demolished back to `water_body` | Restore eligible water recipes and reevaluate neighboring water eligibility |
| Empty land is raised or lowered | Rewrite every visible recipe matrix on the tile with `baseY = tile.elevation * 0.8` |
| Load or reset | Rebuild recipes from the active neighborhood seed, then apply all loaded/current tile state |
| Material profile changes | Swap shared pool materials without changing recipes or matrices |

`Renderer.updateGroundInstance()` currently ends in `updateTreesOnTile()`. Replace that call with `environmentScenery.markTileDirty(x, y, true)`. Dirty tiles should be deduplicated and flushed once before the next render. The 3×3 refresh is needed because open-water eligibility and boardwalk/bridge clearance depend on neighboring tiles.

The elevation update must not depend on a visibility transition. This explicitly fixes the current tree early-return bug: a prop that remains visible still receives a new matrix after sculpting.

The old `treesData`, tree meshes, `rebuildTrees()`, `updateTreesOnTile()`, and water-tile `createLilypadMesh()` / `createReedsMesh()` placement path should be retired once parity is reached. Keeping both paths would double-scatter vegetation and split lifecycle ownership.

## Construction and interaction contract

Natural scenery is decorative and never changes build validity or price. Construction clears it visually; it does not require a separate clearing action.

The clear rule is based on tile state, not on structure level:

- zones at level 0 clear scenery;
- planned and in-progress construction clears scenery;
- roads, utilities, parks, and boardwalks clear scenery;
- a water tool replaces land scenery with the water eligibility path; and
- bridges clear water scenery even though water remains visually beneath the bridge.

Scenery must not be added to raycast targets. Clicking through a prop continues to select the mathematical tile or an existing resident/building target.

## Performance budget

The first implementation should meet these budgets in the representative 50×50, 1080p scene used for visual-fidelity checks:

- no more than 10 total environment-scenery main-pass draw calls, replacing the current three tree draw calls;
- no more than five environment-scenery shadow-pass draw calls;
- no per-frame recipe generation or matrix updates while the map is unchanged;
- local changes update only deduplicated dirty tiles and their immediate neighbors;
- typical visible instance count below 3,500 component instances, with deterministic per-pool caps; and
- no more than a 2 ms p95 frame-time regression relative to the current representative scene.

Build success or a visually pleasing screenshot is not sufficient evidence for the frame-time target. Record renderer draw-call counts and a before/after p95 measurement before calling the feature complete.

## Implementation sequence

### Phase 1: Scenery foundation and tree parity

- Add `EnvironmentScenery` and the stateless channel hash.
- Move current tree ownership out of `Renderer` into indexed instance pools.
- Preserve deterministic map framing and construction clearing.
- Fix elevation refresh, load/reset rebuild, and material-profile switching.
- Add the three tree families and restrained foliage palette.

Exit criterion: trees alone satisfy all lifecycle tests and are at least draw-call neutral with the current implementation.

### Phase 2: Land understory and rocks

- Add cached procedural rock variants.
- Add bush and shrub cluster geometry.
- Tune clustering, negative space, tile-safe bounds, palette, and shadow policy.
- Verify props do not overlap roads, structures, cliff rims, or neighboring tiles.

Exit criterion: empty terrain gains variety without reducing build-grid legibility at normal gameplay zoom.

### Phase 3: Water boulders and plants

- Move existing lily-pad and reed concepts into global pools.
- Add sparse open-water boulder recipes and plant halos.
- Add open-water, shoreline, boardwalk, bridge, and pier clearances.
- Verify transparent-water ordering and submerged vertical offsets at all camera rotations and times of day.

Exit criterion: boulder compositions appear rarely, remain readable, and never conflict with engineered waterfront features.

### Phase 4: Tuning and verification

- Add deterministic debug scenes for land grove, high/low terrain, natural shore, open water, bridge, and boardwalk cases.
- Capture normal, maximum-zoom, and four-camera-rotation screenshots.
- Measure draw calls, shadow calls, visible instances, and p95 frame time.
- Tune density constants without changing hash-channel identities.

## Acceptance criteria

### Determinism

- The same seed and unchanged grid produce identical recipe types, transforms, colors, and visibility after reset and save/load.
- Editing or rebuilding an unrelated tile does not reroll existing scenery.
- Adding a new random property channel does not change established properties.

### Clearing and restoration

- Every buildable tile type clears all natural scenery on the tile at placement time.
- A water tile converted to a bridge or boardwalk clears its boulder and plant composition.
- Demolishing back to empty land or water restores the same eligible composition, not a new roll.
- Drag-building and drag-demolishing leave no orphaned instances.

### Elevation

- Raising or lowering empty land moves trunks, crowns, rocks, bushes, and shrubs together by exactly `0.8` world units per elevation step.
- Repeated up/down sculpting returns every prop to its original world transform without drift.
- No hidden matrix from a prior built state reappears at the wrong elevation.

### Visual quality

- Three tree silhouette families are distinguishable at normal gameplay zoom.
- Blossom trees read as accents rather than a dominant species.
- Rock deformation looks intentionally faceted and does not expose an unflattened floating base.
- Water boulders are rare, partially submerged, and visually grouped with nearby plants.
- Natural props do not obscure roads, ramps, construction previews, shoreline bands, boardwalks, bridges, docks, or resident readability.

### Performance and compatibility

- The production build passes.
- Standard, soft-toon, and toon profiles all render the new pools correctly.
- Environment draw-call and shadow-call budgets are met.
- The representative p95 frame-time regression is at or below 2 ms.
- Existing saves load without migration and regenerate scenery from the saved seed and tile state.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Dense scatter makes the map noisy or hides the grid | Enforce one primary feature per tile, conservative footprints, sparse interior density, and explicit negative space |
| Sequential randomness causes visual churn during iteration | Use stable named hash channels rather than an advancing random stream |
| Water props intersect piers or engineered edges | Require open-water topology for boulders and suppress water scenery beside boardwalks/bridges; include neighboring tiles in dirty refreshes |
| Transparent water makes submerged parts sort incorrectly | Keep scenery opaque, tune base heights against the existing `-0.04` water plane and wave bounds, and verify camera rotations in browser captures |
| Too many geometry/material combinations increase draw calls | Reuse a small number of shared geometries, use instance scale/rotation/color, and enforce the 10-pool budget |
| Hidden instances or stale matrices reappear incorrectly | Give every recipe stable pool handles and update visibility and transform together in the same tile refresh |
| Large map-wide instance pools waste GPU work | Generate only sparse candidate recipes, cap each pool deterministically, and measure submitted instance counts rather than relying on zero-scale hiding alone |

## Alternatives considered

| Alternative | Why it is not recommended |
|---|---|
| Add rocks and bushes directly to `Renderer.rebuildTrees()` | Extends an already tree-specific lifecycle, preserves the elevation bug, and makes water topology awkward |
| Add props inside each tile's `THREE.Group` | Easy to implement, but repeats geometry work, increases draw calls with developed water/land tiles, and splits clearing behavior across mesh factories |
| Persist a scenery list in `Simulation` | Adds save migrations and gameplay coupling for presentation that is fully reproducible from existing state |
| Generate one unique mesh per prop | Provides maximum shape freedom but scales draw calls, allocation, disposal, and rebuild cost with density |
| Use authored GLB prop packs | Viable later for hero assets, but unnecessary for a small low-poly vocabulary that can be generated consistently from shared primitives |
| Animate all foliage and reeds | Adds per-frame shader or CPU work before static composition, lifecycle correctness, and performance are validated |

## Definition of done

This proposal is complete when untouched land and open water have coherent, varied, deterministic natural scenery; every construction and demolition path clears or restores it correctly; terrain sculpting repositions all land props without drift; tree generation has the intended silhouette and palette variety; existing water vegetation has been consolidated into the same system; and screenshot plus measured performance evidence satisfies the acceptance criteria above.
