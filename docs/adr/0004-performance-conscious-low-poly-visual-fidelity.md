# ADR 0004: Performance-conscious low-poly visual fidelity through shared profiles and derived surfaces

Status: Proposed
Date: 2026-07-28
Source proposal: [performance-conscious-visual-fidelity.md](../proposals/performance-conscious-visual-fidelity.md)

## Context

NaboCity's low-poly geometry and orthographic camera were coherent, but broad surfaces read uniformly: ambient fill weakened form, grass did not communicate elevation, water relied on a small displacement with little face definition, and the hard toon profile flattened material differences. Recent visual mock-ups established a richer but still calm target. The goal is improved plausibility through light, color, facets, and a few strong silhouettes rather than photorealism or asset density.

Constraints:

- Preserve the 50x50 tile simulation, save format, construction rules, pathfinding, mathematical picking, and orthographic camera.
- Keep all visual variation deterministic and derived from existing coordinates, topology, elevation, and seeds.
- Use one shadow-casting directional light; add no local real-time lights, reflections, render targets, required textures, or new full-screen passes.
- Preserve standard, soft-toon, and hard-toon development comparisons while making soft toon the production default.
- Target no more than a 2 ms p95 frame-time regression, 12 new always-visible main-pass draw calls, and 6 new shadow-pass draw calls in the proposal's representative 1080p scene.

## Decision

NaboCity will improve visual fidelity through **shared renderer/material profiles and deterministic presentation derived at render time, not through denser assets or new simulation state**.

- `AssetGenerator` owns triplets of shared `standard`, `softToon`, and `toon` materials and palettes. Soft toon is the default; scene meshes and the five instanced resident pools can switch profiles without changing geometry or identity.
- `Renderer` uses explicit sRGB output, ACES filmic tone mapping at `0.95` exposure, the existing bloom path followed by `OutputPass`, one directional key, and one non-shadowing hemisphere fill. Day, golden-hour, dawn, and night profiles interpolate sky, fog, fill, key color, and intensity.
- The instanced terrain shader derives three close facet shades, five discrete altitude tints, broad cliff strata, and topology-aware grass-cap treatment. Signed cardinal and concave-corner roles create a flat `0.07`-unit light lip on upper grass and a darker strip on lower grass without extra terrain draw calls.
- Water keeps one shared animated material family. Two crossing world-space waves displace its faceted geometry; derivative normals make tilted faces carry the contrast instead of drawn ripple decals. Positive displacement is compressed and negative displacement amplified: from a base plane at `y = -0.04`, theoretical crests remain near `y = -0.0104` while troughs reach about `y = -0.1038`.
- Shorelines are derived from cardinal and diagonal water topology. A continuous contact lip and a quieter inset wash reuse the water's bounded displacement and deterministic terrain contour. Explicit corner ownership, diagonal rebuild hashes, selective underfill, and render order prevent double-alpha diamonds, stale joins, bank fins, and grass flooding.
- Residential buildings receive shallow shared-material foundations and door steps as the first silhouette upgrade. Further building and environment detail remains incremental and must use shared geometry/materials or instance pools.

Implementation deltas from the proposal and conversation history:

- **Delta from proposal:** soft toon is flat-shaded `MeshStandardMaterial` for broad matte surfaces, with smooth PBR treatment retained for water, glass, lights, and metal. The proposed diffuse-quantization shader was not needed.
- **Delta from proposal:** presentation constants remain in `Renderer.ts` and `AssetGenerator.ts`; there is no `VisualStyle.ts`, low/balanced/high quality system, automatic quality selection, or renderer-statistics panel.
- **Delta from proposal:** grass variation is a deterministic per-facet shader hash plus elevation tint, not neighborhood-scale `instanceColor` patches.
- **Delta from proposal:** water remains transparent (`opacity 0.87`) and tile-local so the dirt bottom and localized rebuild model continue to work. The two transparent shoreline layers require explicit painter order and do not satisfy the proposal's preference for opaque water in a small fixed number of render items.
- **Delta from conversation:** the experimented unified per-tile indexed shoreline strips were replaced by cached per-edge ribbons and outer corner caps. Correctness now comes from full-width trimming, deterministic convex/concave ownership, matching terrain samples, and tapered cap-free inner-wash endpoints.
- **Delta from proposal:** the first visual slice is implemented and screenshot-tested, but quality profiles, pooled environmental accents, the broader silhouette kit, deterministic fixed benchmark scenes, and the proposed frame-time/draw-call measurements are not implemented. The numerical performance targets therefore remain unverified.

## Alternatives considered

| Candidate | Why not selected |
|---|---|
| Photoreal materials, texture packs, reflections, refraction, SSAO, or dense props | They add GPU, memory, sorting, authoring, and visual-noise costs while working against the calm low-poly direction. |
| Keep the hard toon gradient and uniform ambient light | It preserves the old look but flattens roughness, subtle palette separation, terrain facets, and time-of-day form. |
| Custom diffuse-quantized PBR soft-toon shader | It adds shader maintenance and permutation risk; flat-shaded standard materials produced the intended middle ground with less code. |
| Persist grass, shoreline, or atmosphere variants in `Simulation` | Presentation can be reproduced from coordinates and topology; persisted state would require migrations and couple saves to art tuning. |
| Continuous world water or terrain meshes | They could reduce seams and render items but would replace localized tile rebuilds and threaten grid picking, construction, and the established tile silhouette. |
| Unified shoreline strips as the final topology | Shared vertices solved one overlap class, but later maximum-zoom work needed independently trimmed/tapered layers; cached ribbons with explicit ownership fit the two-band behavior more directly. |

## Consequences

Easier:

- The whole scene, including instanced residents, can be compared under three material profiles while sharing one art direction.
- Terrain elevation, cliff depth, water motion, and time of day read more clearly without textures, local lights, or save-state changes.
- Coordinate-derived effects remain stable across save/load and localized tile rebuilds; deterministic headless layer-isolation captures provide a repeatable visual regression workflow.

Harder / ruled out:

- `onBeforeCompile` patches depend on Three.js shader chunks and need runtime browser compilation checks during upgrades.
- Three material families increase material memory and disposal responsibilities even though geometry stays shared.
- Transparent water remains sensitive to overdraw, sorting, corner ownership, and per-tile draw-call growth; explicit render order and topology mutation tests are load-bearing mitigations.
- Visual constants are split between renderer and asset code and can drift until a shared style module is justified.
- No performance claim should be made from build success or screenshot tests alone; the proposal's frame-time and draw-call budgets still require measurement before this ADR moves to Accepted.
