# ADR 0002: Jagged terrain edges and natural shorelines via instanced column vertex displacement

Status: Accepted
Date: 2026-07-24
Source proposal: `docs/proposals/jagged-terrain-edges.md`

## Context

NaboCity's terrain sculpting and waterfront systems support expressive hills, terraces, ponds, canals, bridges, and boardwalks. However, cliff rims and natural shorelines previously followed perfectly straight two-unit square tile boundaries. Adjacent straight edges produced long, regular stair-step shorelines, making natural terrain read as constructed grid tiles.

Constraints:

- Preserve the tile-based simulation (`Simulation`), grid elevation levels (0 to 4), pathfinding, save format, and axis-aligned mathematical tile picking (`InputManager`).
- Keep generated shapes 100% deterministic across redraws, save/load, and tile updates.
- Avoid cracks or visible holes between upper land, cliff walls, lower land, and water.
- Maintain a single `InstancedMesh` ground draw call for all 2,500 map tiles.
- Keep engineered edges (boardwalks, bridges, and sloped road ramps) unobstructed and visually straight.
- Render natural low-poly silhouettes without introducing presentation state into `Simulation`.

## Decision

Terrain edges along cliffs and shorelines are given irregular low-poly silhouettes by **subdividing the shared ground box geometry (Option 2) and displacing top/side perimeter vertices laterally in the vertex shader**.

As implemented (deltas from the original proposal are noted):

- **Delta from proposal (Option choice):** The proposal recommended Option 3 (separate procedural rim and skirt geometries). Option 2 (subdivide and displace ground box columns) was selected and implemented instead, preserving the single `InstancedMesh` ground draw call.
- **Delta from proposal (Subdivision density):** `AssetGenerator.createGroundGeometry()` uses 2 horizontal subdivisions per side and remaps ten vertical rows to `0, -0.4, …, -3.2, -12.0`. This preserves a dense 0.4-unit grid through the maximum 3.2-unit terrain drop while retaining a single deep underfill band, for ~400k ground triangles across 2,500 instances.
- **Delta from proposal (Selective edge flags):** Rather than displacing all column vertices, displacement applies **only to exposed cliff edges and water boundaries**. Two `InstancedBufferAttribute` vectors (`aEdgeFlags` for cardinal edges N/E/S/W, `aCornerFlags` for 4-way grid intersections NW/NE/SE/SW) indicate exposed edges. Flat interior ground fields remain 100% flat and un-displaced.
- **Delta from proposal (Height and corner alignment):** To eliminate gaps between tile tiers and corners, horizontal displacement uses canonical world-space coordinates `worldPos.xz`. The remapped vertex rows place real vertices at every 0.8-unit elevation tier, where `sin(worldPos.y * (π / 0.8))` evaluates to `0.0`, and at every 0.4-unit midpoint, where the wobble peaks; cliff faces and lower terrain tops therefore share the same displacement at every tier boundary.
- **Delta from proposal (Road and ramp suppression):** Displacements on edges or corners touching roads, bridges, boardwalks, or descending ramps (`isSlopedRoad`) are anchored to `0.0`, preventing terrain or grass from protruding through road surfaces while preserving full jagged silhouettes elsewhere.
- **Delta from proposal (Water overlap):** Water top and bottom plane geometries (`getWaterTopGeometry`) extend selectively (+0.3 units) only on sides bordering land, preventing holes under displaced grass rims while keeping water-to-water tile boundaries at `2.0` units to avoid double-alpha colored bands.

The crucial design boundary: **the simulation owns grid elevations and tile types, while vertex shaders and instance attributes derive the irregular presentation layer deterministically without extra draw calls.**

## Alternatives considered

| Candidate | Why not selected |
|---|---|
| Option 1: Edge decoration only | Adds scenery (rocks, tufts) but leaves the ground and water top silhouettes completely square and step-like. |
| Option 3: Procedural rim & skirt meshes | Recommended by original proposal, but requires building/updating separate grass-cap and skirt geometries per dirty tile update, adding extra draw calls and CPU mesh generation complexity compared to Option 2 shader displacement. |
| Option 4: Cached tile variants | Requires authoring and managing 16–256 corner/neighbor geometry variants; inflexible for multi-level height transitions. |
| Option 5: Continuous contour / Marching Squares mesh | Rewrites terrain, normals, UVs, and picking into a continuous mesh. Breaks the constructed grid style and adds high regression risk for lot placement and roads. |

## Consequences

Easier:

- Cliff tops and shorelines feature organic, low-poly silhouettes without changing simulation, pathfinding, or save formats.
- Ground rendering retains a single `InstancedMesh` draw call for all 2,500 tiles.
- Terrain modifications (raising, lowering, water, roads) update instantly by recalculating per-instance `aEdgeFlags` and `aCornerFlags`.

Harder / ruled out:

- Mathematical axis-aligned tile selection (`InputManager`) remains tile-bound; clicking a visual protrusion up to ~0.22 units outside a logical tile selects the logical tile beneath it.
- Water surface top plane geometry requires selective neighbor-aware boundary expansion (`getWaterTopGeometry`) to prevent both land underfill gaps and overlapping semi-transparent water bands.
