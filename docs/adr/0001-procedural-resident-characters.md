# ADR 0001: Procedural resident characters via seeded appearance generation and instanced primitive pools

Status: Accepted
Date: 2026-07-24
Source proposal: `docs/procedural-resident-characters.md`

## Context

NaboCity's residents were originally rendered as one `THREE.Group` per resident containing separate torso, leg, head, hair, and backpack meshes. Draw calls grew with population × parts per resident, so visual quality and population scale competed directly. The old generator also had very little identity range (two skin colors, three hair colors, one torso shape), and used a sequential random stream, so inserting a new random choice silently rerolled later traits for existing seeds.

Constraints:

- Residents are persistent people: a named resident must look the same across despawn, save/load, and browser sessions.
- The ultra-low-poly character-sheet look must be preserved (`docs/character-sheet-residents-ultra-low-poly.png`).
- The renderer must handle ~500 visible residents without per-resident or per-part draw calls.
- Walking animation, pop-in, day/night shading, shadows, and direct selection must keep working.
- No external modeling pipeline or new dependencies; deterministic seeded generation must remain compatible with existing resident/routine systems.

## Decision

Residents are rendered through **shared primitive `InstancedMesh` pools driven by deterministic seeded appearance generation**.

As implemented (deltas from the original proposal are noted):

- `ResidentState` still persists only an integer `appearanceSeed`. The full appearance recipe (`ResidentAppearance`: presentation, body proportions, skin, hair, outfit family/colors, face details, one signature part) is derived deterministically from that seed via salted 32-bit mixing (`mix32`/`sample01` in `src/prototype/ResidentAppearance.ts`), so each trait is independent and inserting new traits never rerolls existing ones. **Delta from proposal:** the recipe is *recomputed* from the seed rather than serialized; identity stability therefore depends on generator stability, which the `version: 1` field on the recipe type reserves room to manage.
- Recipes are **semantic** (style/family/color IDs, not transforms or raw RGB values), so geometry proportions and palette definitions can evolve without changing who a resident is.
- At runtime the recipe expands into a fixed grammar of parts built from shared geometries: unit boxes, two tapered-prism variants, a chamfered block, and a low-segment torus (glasses) — five `InstancedMesh` pools (`CitizenPreviewPool`, exposed game-side as `CitizenRenderPool`), giving a fixed 5-pool draw-call budget regardless of population. Per-instance matrices and colors provide all variation.
- Animation is CPU-driven part matrices with a per-resident phase offset (no skeleton); scratch vectors/matrices are reused so the frame loop performs zero allocations.
- **Delta from proposal:** slot allocation uses a free-list (`layouts` array + `slots` map) with tombstoned slots instead of swap compaction; freed instances are hidden via a zero-scale matrix. No generation counters were needed because slots are never reused while occupied.
- **Delta from proposal:** selection does not use instanced proxy meshes. Each visible resident keeps an invisible `THREE.Group` carrying an invisible sphere hit target with `userData.residentId`; raycasting walks up the parent chain. The instanced pool is purely visual.
- Pool capacity starts at 512 visible residents and doubles on demand by rebuilding the pool and re-registering residents. Activity-based spawn/despawn remains the first population optimization.

The crucial design boundary: **the seed decides identity once, while instanced rendering expresses that identity cheaply every frame.**

## Alternatives considered

| Candidate | Why not selected |
|---|---|
| One mesh group per resident (status quo) | Draw calls grow by parts × residents; retained only as the invisible selection hit target, not for visuals. |
| Merge each resident into one geometry | Still one draw call per resident; breaks independent limb swing and future gestures; requires per-appearance geometry or a large archetype cache. |
| One Three.js `BatchedMesh` for every part | Its low-draw-call path depends on the `WEBGL_multi_draw` extension; without it the renderer falls back to issuing draws in a loop, making performance least predictable exactly on the mobile/integrated-GPU devices this work targets. May be reconsidered if target-device telemetry shows broad extension support. |
| GPU-skinned instancing with custom shaders | Excellent scaling and animation, but very high implementation risk — premature for block characters. |
| 2D sprites or billboards | Limited identity and animation; reserved as a possible future far-distance LOD only. |

## Consequences

Easier:

- Resident identity costs 4 bytes per resident (the seed); visual variety and population scale are decoupled, with a fixed 5-pool draw-call budget.
- No asset pipeline, skeletons, or new dependencies.
- The same pool implementation serves both the game and the asset-catalog previews, so appearances can never drift between surfaces.

Harder / ruled out:

- First version excludes GLTF characters, skeletal animation, and sprite impostors; realistic anatomy, cloth, and facial animation are non-goals.
- The generator must stay curated (occupation/age-weighted outfit families, clothing-color exclusion rules, one-signature-detail limit) or combinations look random instead of authored.
- **Backward-compat risk introduced by the seed-recompute delta:** any change to the generator (salt values, trait tables, probabilities) changes the appearance of every existing saved resident. Palette and geometry tuning is safe; generator logic changes require a versioned migration path.
- Per-frame CPU matrix updates are the potential bottleneck at high populations; mitigated by reusable scratch objects, one buffer upload per pool per frame, and activity-based spawning.
- Each visible resident still carries a lightweight `Group` + sphere mesh for selection; this is a fixed, small overhead but means selection cost still scales with population.
