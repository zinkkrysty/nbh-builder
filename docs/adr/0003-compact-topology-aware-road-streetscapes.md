# ADR 0003: Compact topology-aware road streetscapes

Status: Accepted
Date: 2026-07-26
Source proposal: [cozy-road-streetscapes.md](../proposals/cozy-road-streetscapes.md)

## Context

Roads previously rendered as full two-unit asphalt slabs, despite carrying cars and pedestrians at narrower lateral offsets. They read as oversized traffic space rather than neighborhood streets, and gave neither walkers nor cliff edges a visible engineered boundary.

Constraints:

- Preserve the two-unit grid, construction, utilities, pathfinding, tile picking, road/bridge/elevation simulation state, and save format.
- Derive all streetscape presentation from existing tile state; do not persist curbs, sidewalks, lamps, rails, or fascia.
- Cover cardinal road topology, bridges, and straight elevation ramps in both standard and toon material modes.
- Keep repeated furniture bounded on a 50×50 map and avoid per-lamp real-time lights.

## Decision

Roads are rendered as **topology-derived compact streetscapes inside the existing tile graph**. `AssetGenerator.createRoadMesh()` builds a 1.28-unit asphalt core and arms from cardinal road neighbors, with sidewalk pads/strips, beveled curbs, clipped centre lines, and seven-stripe crosswalks. Bridges retain a wood deck with separate pedestrian strips and charcoal rails; straight ramps tilt their carriageway, curbs, sidewalks, marking, and concrete support together. `CitizenManager` uses the shared sidewalk offset and surface height, while `TrafficManager` uses the shared 0.31 lane offset.

`Renderer` merges static per-road geometry by material and rebuilds global instanced pools for lamp poles, arms, bulbs, rails, and retaining fascia through a dirty flag. Lamps use the existing paired emissive material and night-mode transition, not `PointLight`s. `Simulation` and save v7 continue to store only the existing road, bridge, and elevation fields.

- **Delta from proposal (selected dimensions):** the shipped defaults are 0.04-unit curbs, 0.16-unit sidewalk settings, a 0.85 pedestrian offset, and a 0.98 car scale—not the proposed 0.08-unit curbs, 0.28-unit sidewalks, 0.86 offset, and 0.84 scale. The generated sidewalk pads are further widened to 0.34 units (`sidewalkWidth + 0.18`), so `RoadLayout` is not a literal cross-section specification.
- **Delta from proposal (layout ownership and footprint):** the module centralizes lane, pedestrian, and several height constants, but mesh construction still contains literal curb/arm/rail offsets. Some sidewalks and ramp decks are 2.04 units long, slightly exceeding the proposed strict two-unit footprint to avoid seams.
- **Delta from proposal (lamps):** lamps are deterministic for a given grid scan, development pattern, and scan order, with a 2.5-unit spacing check; they do not use the simulation seed, canonical shared anchors, or the proposed sparse density rule. Their location may therefore change when nearby development changes.
- **Delta from proposal (edge treatments):** bridges use locally merged railing meshes rather than the global rail pool. Ramps retain a broad concrete abutment, and crosswalk curbs are not lowered or omitted. Cliff rails/fascia are instanced and appear for water, map-boundary, or lower-elevation non-connected sides.
- **Delta from proposal (tuning and validation):** a streetscape tuning sandbox can rebuild every road and change visual settings at runtime. No automated road-topology or road-heavy performance benchmark was added, so the intended draw-call and frame-time budget remains a manual verification responsibility.

## Alternatives considered

| Candidate | Why not selected |
|---|---|
| Overlay sidewalks on the full asphalt tile | Leaves the broad asphalt silhouette and creates layering/z-fighting risk at corners and intersections. |
| Widen roads into neighboring tiles | Conflicts with the one-tile construction contract, adjacent buildings, terrain, water, and save/UI assumptions. |
| Multiple persisted road types | Adds tools, compatibility rules, UI, and save state before one standard neighborhood street is proven. |
| Per-prop meshes or per-lamp lights | Makes dense roads needlessly expensive; instanced furniture and emissive bulbs give bounded draw calls without a local-light budget. |

## Consequences

Easier:

- Roads now visibly separate vehicles and pedestrians while retaining existing traffic and pedestrian routing.
- Streetscape details survive save/load and terrain rebuilds without migration because they are derived.
- Standard/toon material switching and night glow cover lamps as well as roads, and repeated furniture is pooled globally.

Harder / ruled out:

- The current constants and hard-coded mesh offsets can drift apart; future proportion changes must update and visually verify both paths together.
- Lamp placement is not seed-keyed or anchor-owned, so nearby construction can rearrange a previously rendered street. Add canonical seeded anchors before treating decoration as stable across unrelated edits.
- The slight tile overrun and unchanged crosswalk curbs need visual regression checks at junctions, ramps, and borders. Performance and all-16-mask coverage remain unautomated and should be profiled before increasing streetscape detail.
