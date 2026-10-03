# Visual and performance refresh

The game keeps its procedural low-poly style, with warmer daylight, readable night lighting, smoother edges through FXAA, and compact paper-colored controls. Named shops now have framed windows, gabled roofs, striped awnings and recognizable displays. Workshops, gardens, benches and the water tower have more architectural detail using shared geometry and materials.

## Rendering changes

- Residents upload transforms only when their pose or position changes. Draw counts track occupied slots; removal and slot reuse clear old transforms.
- Scenery pools pack visible props and swap slots on removal, avoiding rendering hidden candidates.
- Completed opaque stationary buildings merge by material within 8×8 tile chunks. Transparent models, construction sites and moving utilities retain their original rendering path. Material profile changes rebuild eligibility.
- Terrain mirrors authoritative matrices and topology flags into 8×8 chunks. Camera and shadow frustums cull them independently; unchanged frames skip copying. Hidden water/bridge ground instances are omitted.
- FXAA smooths the composer output without the measured cost of a multisampled render target. Bloom remains reduced resolution.

## Verification

Run `npm run check:render` and `npm run build`.

Regression checks cover resident animation/pause/removal/reuse/capacity, scenery restoration and shorelines, building transforms/demolition/material changes/resource ownership, and terrain elevation/topology/water/chunk boundaries/idle uploads/disposal.

Browser review covered all named place models in standard, soft-toon and toon profiles; daylight, golden hour and night; closest supported zoom; resident and utility details; shoreline/sculpt changes; construction and completed inspectors; household dialogs; speed/pause; save/load; and 1440/980/720/390px layouts. Small screens can collapse the neighborhood overview. Clean UI and active-gameplay runs reported no browser errors.

Deterministic reference comparisons preserved building appearance (38 of 1,024,000 pixels differed by more than 8/255) and produced pixel-identical terrain before/after chunking in the initial reference scene. Reference draw calls decreased from 583 to 477 with building batching; terrain culling reduced rendered triangles from 1,039,319 to 774,359 across passes.

Final active gameplay measurement used the actual Game loop in Chromium with hardware-backed ANGLE on integrated AMD Radeon Graphics, at 1280×800. The developed 17×15 tile neighborhood contained roughly 170 homes, 120 residents, 24 walking citizens and active traffic. The camera moved inside the neighborhood. Across 336 rendered frames after warm-up, median frame interval was 16.7ms and p95 was 16.9ms; median rendering CPU submission was 5.5ms. This supports about 60 FPS for this tested workload; it is not a guarantee for every machine or city size.

Temporary browser scripts and screenshots are in `/tmp/nabocity-visual-debug/`; browser tooling is outside project dependencies. The build retains its existing large-bundle warning.
