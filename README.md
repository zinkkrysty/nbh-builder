# NaboCity — Cozy Neighborhood Builder

NaboCity is a cozy, low-poly 3D neighborhood-building game about creating a small place where people know one another, help shape their surroundings, and make stories worth remembering.

Built using **Three.js** and **Vite** with **TypeScript**, the game runs completely client-side in the browser.

## North Star

> **Build a small place where people know one another, help shape their surroundings, and create stories the player wants to remember.**

The player should feel like a **caretaker, designer, and participant** in a community—not a distant mayor optimizing statistics. Growth is measured by attachment, expression, belonging, and the history of a place rather than population or urban scale. A tiny five-home neighborhood with deep relationships should be every bit as successful as a larger town.

### Design Principles

Every major feature should support at least two of these principles:

1. **Help the player know a resident.** People are persistent characters with homes, preferences, routines, relationships, and memories—not anonymous population units.
2. **Help the player express themselves.** Building and decorating should create recognizable, personal places rather than only solve coverage or efficiency problems.
3. **Create a visible neighborhood moment.** Systems should produce scenes the player can watch: visits, picnics, markets, celebrations, favors, and everyday routines.
4. **Make existing places more meaningful.** Prefer deepening homes, streets, gardens, shops, and gathering places over encouraging endless expansion.
5. **Create stories worth remembering.** Important arrivals, projects, friendships, events, and changes should become part of the neighborhood's persistent history.
6. **Support multiple valid play styles.** A compact garden village, creative waterfront, crafting community, or bustling market street should all be successful outcomes.
7. **Create delight without demanding optimization.** Friction should invite care, creativity, and compromise rather than punish the player with collapse or irreversible failure.

When evaluating work, the key question is not “does this make the simulation more realistic?” but **“does this help the neighborhood feel more personal, expressive, connected, or memorable?”**

---

## 📸 Screenshot

![NaboCity Gameplay Screenshot](public/screenshot.png)

---

## 🎮 Key Features

*   **Cozy 3D Visuals**: A beautiful low-poly style featuring dynamic lighting, warm sunsets, glowing home windows at night, and industrial puffing smoke particles.
*   **Realistic Neighborhood Simulation**:
    *   **Zoning**: Establish Residential (green), Commercial (blue), and Industrial (yellow) zones that grow dynamically through 3 density levels based on RCI demand.
    *   **Utilities Propagation**: Build wind turbines (power) and water towers (water). Grid connections propagate dynamically along adjacent roads and zoned structures using a Breadth-First Search (BFS) algorithm.
    *   **Realistic Economy**: Balance weekly tax revenues from residents and offices against structure maintenance costs (roads, turbines, water, parks).
*   **Procedural Audio Soundscape**: Synthesizes custom triangle-wave lofi jazz chord loops (`Fmaj7` - `Em7` - `Dm7` - `Cmaj7`), wind noise, vinyl record crackling, echoing pentatonic chime melodies, and build/bulldoze sound effects in real-time using the **Web Audio API**.
*   **Procedural Traffic**: Spawns little colorful low-poly cars that steer through junctions, drive on the right lane of roads, and turn on their yellow headlights at night.
*   **Save/Load & Auto-Save**: Save/load neighborhood layout and stats manually, or let the game auto-load your progress on boot from browser `localStorage`.
*   **Buttery Smooth Pan/Zoom/Rotate Controls**: Glide around the map with inertia/momentum using WASD/Arrow keys or right-click drags.

---

## 🛠️ Controls Reference

### Building Tools Hotkeys
*   `1`: **Inspect** — Click a tile to check coordinates, zoning level, occupancy, happiness, and power/water connectivity.
*   `2`: **Road** ($10) — Connect structures. Drag-building is fully supported!
*   `3`: **Res Zone** ($20) — Zoned land for cottages and apartments.
*   `4`: **Com Zone** ($30) — Zoned land for local businesses and skyscrapers.
*   `5`: **Ind Zone** ($40) — Zoned land for workshops and factories.
*   `6`: **Turbine** ($500) — Wind turbine supplying power.
*   `7`: **Water Tower** ($400) — Cylindrical tank supplying water.
*   `8`: **Park** ($300) — Cozy green spaces that boost local happiness by 15%.
*   `9`: **Demolish** ($5) — Bulldozer tool to clear tiles. Drag-demolishing is supported!

### Mouse & Camera Navigation
*   **Move Camera**: Use **Arrow Keys** or **WASD** to slide around, or hold **Right Mouse Button** and drag.
*   **Rotate/Orbit Camera**: Hold **Shift + Right Mouse Button** and drag to rotate horizontal/vertical angles.
*   **Zoom**: Scroll the **Mouse Wheel** to slide in and out smoothly with damping.

---

## 🚀 Getting Started

### Prerequisites
*   Node.js (v18.0 or higher recommended, fully compatible with v16.13+)
*   NPM

### Installation
1.  Clone the repository or navigate to the directory:
    ```bash
    cd nabocity
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Start the local development server:
    ```bash
    npm run dev
    ```
4.  Open your browser and navigate to the address shown (usually `http://localhost:5173/`).

### Building for Production
To build and optimize the project for hosting:
```bash
npm run build
```
The output files will be built in the `dist/` directory.

---

## 📁 Project Structure
```
nabocity/
├── index.html            # Entry markup and inline splash screen styling
├── package.json          # Dependency configurations
├── tsconfig.json         # TypeScript configuration
├── public/
│   └── splash.jpg        # Low-poly splash screen artwork
└── src/
    ├── main.ts           # Entry bootloader script
    ├── index.css         # Glassmorphism UI styles
    └── game/
        ├── Game.ts       # Coordinator: UI binds, game states, and tick loops
        ├── Renderer.ts   # Three.js: scene, shadows, camera lerps, cycles
        ├── Simulation.ts # Logic: zoning growth, economy, utilities BFS
        ├── InputManager.ts # Raycasting: snaps, clicks, drag-to-build
        ├── AssetGenerator.ts # Meshes: low-poly models & emissive lights
        ├── TrafficManager.ts # Cars: steering path paths & lane offsets
        └── SoundManager.ts # Synthesizers: lofi chords, chimes, SFX
```
