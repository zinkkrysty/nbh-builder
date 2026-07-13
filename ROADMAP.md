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

---

## 🚀 Future Development Phases

### Phase 1: Dynamic Life & Pedestrians
*   **Pedestrian Spawning**: Little low-poly citizen figures (capsules or simple jointed blocks) that walk out of houses, go to work in commercial offices, or relax on park benches/boardwalk decks.
*   **Waterfront & Park Walkers**: Spawning citizens walking along the wooden boardwalks and relaxing on the grass-side benches or pier ends.
*   **Intelligent Traffic Behaviors**:
    *   Add basic yielding at intersections (first-to-arrive goes first).
    *   Introduce traffic lights that toggle green/red, causing cars to stop.
    *   Traffic density: Spawn count scales directly with commercial and industrial productivity.

### Phase 2: Environment & Geography
*   **Forestry Management**: Wild trees gradually mature, grow, and drop leaf particles. Demolishing trees yields minor wood resources instead of land cost.
*   **Topography & Hills**: Adding simple landscape elevation (flat hills and sloped road ramps) to create cozy alpine towns.

### Phase 3: Public Services & Landmarks
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
*   **Seasonal Transitions**: Gradually shift ground/tree colors over time. Winter overlays snow on rooftops, while Spring triggers pink cherry blossom petals.
*   **Calm Community Events**:
    *   *Confetti Festivals*: Citizens gather at parks and set off colorful floating paper particles.

### Phase 5: Cozy Community & Synergy
*   **Neighborhood Synergy & Curb Appeal**:
    *   *Cul-de-sac & Co-housing*: Clustering residential zones grants happiness and decreases utility demand.
    *   *Corner Store Synergy*: Adjacent commercial/residential zones boost sales and resident happiness.
    *   *Procedural Curb Appeal*: Happy residences sprout flowerbeds, swings, mailboxes, and fences.
*   **Cooperative Agriculture**:
    *   *Agricultural Zoning*: Establish community gardens with procedural rows of crops, scarecrows, and compost piles.
    *   *Farm-to-Table Loop*: Adjacent gardens boost local home happiness and supply nearby stores with locally grown produce.
*   **Calm Community Events**:
    *   *Neighborhood Block Parties*: Residential streets temporarily close, spawning barbecues, string lights, and redirecting traffic.
    *   *Saturday Yard Sales*: Happy homes spawn front-lawn sale tables, creating small citizen flows and tax contributions.
    *   *Farmers Markets*: Park stalls sell garden produce on Sunday mornings.
*   **Citizen Projects & Crowdfunding**:
    *   *Neighborhood Request Board*: Notepad listing local requests (e.g. library, parks, power).
    *   *Community Fund*: Happy citizens pool savings to fund zero-maintenance landmarks (Gazebos, Libraries, Cafes).

