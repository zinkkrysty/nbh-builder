# NaboCity - Calm 3D City Builder

NaboCity is a cozy, low-poly 3D city builder game set in a peaceful neighborhood, complete with a realistic economic simulation, zoning, utility propagation grids, a day/night cycle, and a custom procedurally generated lofi soundtrack.

Built using **Three.js** and **Vite** with **TypeScript**, the game runs completely client-side in the browser.

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
