# NaboCity - Development Roadmap

This roadmap outlines proposed future phases to expand NaboCity into a richer, more detailed, and deeply immersive calm city builder.

---

## 🗺️ Completed Milestones

*   [x] **1.0: Core Foundation** — 3D scene, orthographic camera controls, procedural low-poly assets, 50x50 grid cells.
*   [x] **1.1: Simulation Engine** — RCI demand balance, weekly tax collection, maintenance budgets, utilities connectivity BFS propagation.
*   [x] **1.2: Lofi Soundscape** — Procedural Web Audio synthesizer generating calm chord progressions, vinyl noise, and spatial chimes.
*   [x] **1.3: Procedural Traffic** — Spawning cars that drive in lanes, rotate dynamically, steer at crossroads, and turn on headlights at night.
*   [x] **1.4: Polish & Performance** — FOUC prevention, AI splash screen art, smooth camera glide interpolation, remapped number hotkeys, and Local Storage saving/loading.

---

## 🚀 Future Development Phases

### Phase 1: Dynamic Life & Pedestrians
*   **Pedestrian Spawning**: Little low-poly citizen figures (capsules or simple jointed blocks) that walk out of houses, go to work in commercial offices, or relax on park benches.
*   **Intelligent Traffic Behaviors**:
    *   Add basic yielding at intersections (first-to-arrive goes first).
    *   Introduce traffic lights that toggle green/red, causing cars to stop.
    *   Traffic density: Spawn count scales directly with commercial and industrial productivity.

### Phase 2: Water Bodies, Geography & Bridges
*   **Water Placement Tool**: A tool to create lakes, rivers, or coastlines. Zoned structures cannot be placed on water.
*   **Procedural Bridges**: Laying road tiles over water cells automatically generates a low-poly wooden bridge or a steel arch bridge.
*   **Forestry Management**: Trees in parks or wild borders will gradually mature and drop leaf particles. Demolishing trees yields minor wood resources.

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

