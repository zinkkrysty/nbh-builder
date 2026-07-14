# NaboCity - Development Roadmap

This roadmap outlines proposed future phases to expand NaboCity into a richer, more detailed, and deeply immersive calm city builder.

---

## 🗺️ Completed Milestones

*   [x] **1.0: Core Foundation** — 3D scene, orthographic camera controls, procedural low-poly assets, 50x50 grid cells.
*   [x] **1.1: Simulation Engine** — RCI demand balance, weekly tax collection, maintenance budgets, utilities connectivity BFS propagation.
*   [x] **1.2: Lofi Soundscape** — Procedural Web Audio synthesizer generating calm chord progressions, vinyl noise, and spatial chimes.
*   [x] **1.3: Procedural Traffic** — Spawning cars that drive in lanes, rotate dynamically, steer at crossroads, and turn on headlights at night.
*   [x] **1.4: Polish & Performance** — FOUC prevention, AI splash screen art, smooth camera glide interpolation, remapped number hotkeys, and Local Storage saving/loading.
*   [x] **1.5: Water Bodies & Transport Bridges** — Water body placement tool, double-sided transparent water meshes, global world-space wave physics shaders, and automatic road-to-bridge rendering with double driving-lane side railings.
*   [x] **1.6: Waterfront Boardwalks & Docks** — Narrow-profile boardwalks (1/3 wood deck, 2/3 grass lawn), physical curb wood dividers, dark void under-frame gap shading, waterfront-only rope railings, random grass props (cozy benches, trees, shrubs), coordinate-seeded spread-out piers (lifebuoys, benches, bollards), moored rowboats, and residential happiness boost (+10).
*   [x] **1.7: Visual Asset Catalog Page** — Interactive 3D modal viewport with mouse drag rotations, camera framing, day/night lights, and random seed re-rolling for all assets.
*   [x] **1.8: Pedestrian Crossing Paint & Network Rebuilding** — Zebra crosswalks painted on exterior road tiles close to intersection boundaries, extended all the way across the road width, and aligned with boardwalk approaches at bridge entrances/exits. Yellow centerlines automatically split with a 0.25-unit gap to prevent overlap and are hidden on bridge decks. Rebuilding roads triggers a Manhattan-distance-of-2 update to cleanly update all adjacent road crosswalks immediately. Crosswalk material uses a soft, semi-transparent Standard Material for realistic road blending.
*   [x] **1.9: Post-Processing Bloom & Dynamic Shadow Tracking** — Integrated Three.js `EffectComposer` with `RenderPass` and `UnrealBloomPass` to create warm, cozy emissive glows on building windows and vehicle lights at night. Upgraded shadow mapping targeting to dynamically follow the camera target, maintaining sharp, non-clipped shadows across the visible viewport during camera panning. Evaluated ambient occlusion (SAO) and optimized for clean low-poly rendering, securing a stable 120 FPS runtime.
*   [x] **1.10: Pedestrian Spawning, Sidewalk Paths & Citizen Profiling (Cims)** — Added Cozy Citizens (Cims) with randomized low-poly meshes, colors, and accessories. Programmed BFS-based pathfinding over walkable roads, boardwalks, and parks, complete with realistic edge-aligned sidewalk offsets, deck-offsets, organic park wiggle paths, smooth turn/transition offset interpolation, and leg-swing walking animations. Added occupant profiles inside the inspector panel and a preview model in the Developer Menu.
*   [x] **1.11: Local Storage Fault Tolerance & Boot Safeguards** — Wrapped all `localStorage` access calls in try/catch bounds to protect the application from failing when storage access is restricted or disabled. Decoupled the background simulation loop from initial page asset loads, only starting simulation ticks once the user successfully interacts with the enter-splash trigger to enter the neighborhood.
*   [x] **1.12: Topography & Hills (Cozy Alpine Landscape)** — Elevation engine supporting multi-level terrain sculpting (0 to 4 elevation levels), procedural multi-octave sine-cosine noise-seeded hills, and custom GPU vertex shader displacement forming crack-free low-poly faceted cliff sides. Added sloped road ramps with concrete abutment skirts, snapping selection to a custom ray-box intersection cap collider, and a universal max-boundary-height slope connection rule. Upgraded locomotion paths to support piecewise linear boundary-height tracking and exact 2D XZ-normalized pitch vector matching so vehicles and citizens tilt and glide along slopes with zero clipping or side-rolling. Optimized instanced box geometries to 84 triangles per column (69% reduction).

---

## 🚀 Future Development Phases

### Phase 1: Dynamic Life & Pedestrians (Next Step Priority)
*   **A* Commute Pathfinding (High Priority)**: Upgrade the random pathing system for both traffic vehicles and pedestrian Cims to destination-based A* routing, connecting specific Residential homes and Commercial/Industrial workplaces.
*   **Intelligent Traffic Behaviors**:
    *   Add basic yielding at intersections (first-to-arrive goes first).
    *   Introduce traffic lights that toggle green/red, causing cars to stop.
    *   Traffic density: Spawn count scales directly with commercial and industrial productivity.
*   **Direct Citizen Raycasting**: Support clicking directly on moving citizens in the 3D canvas viewport using mouse raycasting to open their inspector profile cards.

### Phase 2: Environment & Geography
*   **Forestry Management**: Wild trees gradually mature, grow, and drop leaf particles. Demolishing trees yields minor wood resources instead of land cost.

### Phase 3: Public Services, Utilities & Landmarks
*   **Municipal Streetlighting**: Place cozy low-poly streetlights along roads that light up with warm point lights during the night cycle.
*   **Public Services**:
    *   *Fire Station*: Prevents or extinguishes fire hazards in a local radius.
    *   *Clinic/Hospital*: Keeps citizens healthy, boosting neighborhood growth rates.
    *   *Library*: Promotes education, upgrading residential structures to higher luxury yields.
*   **Landmark Structures**: High-cost cosmetic assets (e.g. lighthouse on water edges, central clock tower, neighborhood cafe) that significantly boost local land value and happiness.
*   **Agricultural Zoning**: A new farming zone type ($15) creating fields of gold wheat, barns, and slow wind pumps.

### Phase 4: Weather, Seasons & Cozy Events
*   **Weather Cycle**:
    *   *Rainy Days*: Sky turns cozy overcast gray. Rain particles fall, boosting water towers capacity but slowing citizen walking speeds.
    *   *Cozy Fog*: Misty fog rolls in, reducing rendering view distance and increasing cozy lofi synthesizer wind noise.
*   **Seasonal Transitions**: Gradually shift ground/tree colors over time. Winter overlays snow on rooftops and ground using a custom snow accumulation shader, while Spring triggers pink cherry blossom petals.
*   **Calm Community Events**:
    *   *Confetti Festivals*: Citizens gather at parks and set off colorful floating paper particles.

### Phase 5: Cozy Community & Synergy
*   **Neighborhood Synergy & Curb Appeal**:
    *   *Cul-de-sac & Co-housing*: Clustering residential zones grants happiness and decreases utility demand.
    *   *Corner Store Synergy*: Adjacent commercial/residential zones boost sales and resident happiness.
    *   *Procedural Yard Appeal*: Happy residences sprout flowerbeds, swings, mailboxes, chimneys puffing active smoke particles, and fences.
*   **Cooperative Agriculture**:
    *   *Agricultural Zoning*: Establish community gardens with procedural rows of crops, scarecrows, and compost piles.
*   **Farm-to-Table Loop**: Adjacent gardens boost local home happiness and supply nearby stores with locally grown produce.
*   **Calm Community Events**:
    *   *Neighborhood Block Parties*: Residential streets temporarily close, spawning barbecues, string lights, and redirecting traffic.
    *   *Saturday Yard Sales*: Happy homes spawn front-lawn sale tables, creating small citizen flows and tax contributions.
    *   *Farmers Markets*: Park stalls sell garden produce on Sunday mornings.
*   **Citizen Projects & Crowdfunding**:
    *   *Neighborhood Request Board*: Notepad listing local requests (e.g. library, parks, power).
    *   *Community Fund*: Happy citizens pool savings to fund zero-maintenance landmarks (Gazebos, Libraries, Cafes).
