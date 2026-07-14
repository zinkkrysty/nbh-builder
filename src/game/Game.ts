import { Simulation, TileState, TileType } from './Simulation';
import { Renderer } from './Renderer';
import { InputManager } from './InputManager';
import { AssetGenerator } from './AssetGenerator';
import { SoundManager } from './SoundManager';
import { TrafficManager } from './TrafficManager';
import { DevMenu } from './DevMenu';
import { CitizenManager } from './CitizenManager';

export class Game {
  sim: Simulation;
  assets: AssetGenerator;
  renderer: Renderer;
  input: InputManager;
  sounds: SoundManager;
  traffic: TrafficManager;
  citizens: CitizenManager;
  devMenu: DevMenu;

  // Loop references
  lastFrameTime = performance.now();
  simTimer: any = null;

  // Selected tile for inspector
  selectedTile: { x: number; y: number } | null = null;

  constructor() {
    this.sim = new Simulation();
    this.assets = new AssetGenerator();
    this.assets.sim = this.sim;
    this.renderer = new Renderer('canvas-container', this.assets);
    this.renderer.sim = this.sim;
    this.renderer.rebuildTrees();
    
    const canvas = this.renderer.renderer.domElement;
    this.input = new InputManager(canvas, this.renderer.camera, this.renderer.scene);
    this.input.sim = this.sim;
    this.sounds = new SoundManager();
    this.traffic = new TrafficManager(this.sim, this.renderer);
    this.renderer.traffic = this.traffic;
    this.citizens = new CitizenManager(this.sim, this.renderer);
    this.renderer.citizens = this.citizens;
    this.devMenu = new DevMenu(this.assets);

    this.setupBindings();
    this.startLoops();
    this.updateAudioButtonsUI();

    // Handle splash enter screen
    const spinner = document.getElementById('loader-spinner');
    const subtitle = document.getElementById('loader-subtitle');
    const enterBtn = document.getElementById('btn-enter');
    const loader = document.getElementById('loader');

    if (spinner && subtitle && enterBtn) {
      spinner.style.display = 'none';
      subtitle.innerText = 'Neighborhood is ready!';
      enterBtn.style.display = 'block';

      enterBtn.addEventListener('click', () => {
        this.sounds.playClickSFX();
        
        // Auto-play lofi music if preferred on user consent interaction
        const playing = this.sounds.startMusicIfPreferred();
        document.getElementById('btn-music-toggle')?.classList.toggle('active', playing);

        if (loader) {
          loader.classList.add('fade-out');
        }

        // Try to auto-load saved game if exists
        let hasSave = false;
        try {
          hasSave = !!(localStorage.getItem('nabocity_save') || localStorage.getItem('serene_valley_save'));
        } catch (e) {
          console.error('Failed to access localStorage during boot:', e);
        }

        if (hasSave) {
          setTimeout(() => {
            this.loadGame();
            this.startSimulationLoop();
          }, 400);
        } else {
          this.sim.onNotification('Welcome to NaboCity! Start by laying some roads and zoning Residential zones.', 'success');
          this.startSimulationLoop();
        }
      });
    } else {
      // Fallback if elements not found
      loader?.classList.add('fade-out');
    }
  }

  setupBindings() {
    // 1. Simulator events bindings
    this.sim.onNotification = (msg, type) => this.showNotification(msg, type);
    
    // When a tile develops or changes, update its visual mesh
    this.sim.onTileUpdate = (tile) => {
      this.rebuildRoadNetworkAround(tile.x, tile.y);
      this.updateInspectorIfNeeded(tile);
    };

    // 2. Input Manager bindings
    this.input.onBuild = (x, y, tool) => {
      if (tool === 'raise') {
        const tile = this.sim.grid[x][y];
        if (tile.type !== 'empty') {
          this.sim.onNotification("Cannot raise land under structures! Bulldoze them first.", "warning");
          this.sounds.playWarningSFX();
          return;
        }
        const cost = 50;
        if (this.sim.money < cost) {
          this.sim.onNotification("Not enough money to sculpt land!", "danger");
          this.sounds.playWarningSFX();
          return;
        }
        const currentElev = tile.elevation || 0;
        if (currentElev >= 4) {
          this.sim.onNotification("Maximum terrain height reached!", "warning");
          this.sounds.playWarningSFX();
          return;
        }
        this.sim.money -= cost;
        tile.elevation = currentElev + 1;
        this.sounds.playBuildSFX();
        this.renderer.updateGroundInstance(x, y);
        this.renderer.triggerPlacementParticles(x, y);
        this.rebuildRoadNetworkAround(x, y);
        this.sim.onNotification(`Raised land at (${x}, ${y})`, 'success');
        this.sim.onTileUpdate(tile);
        return;
      }

      if (tool === 'lower') {
        const tile = this.sim.grid[x][y];
        if (tile.type !== 'empty') {
          this.sim.onNotification("Cannot lower land under structures! Bulldoze them first.", "warning");
          this.sounds.playWarningSFX();
          return;
        }
        const cost = 50;
        if (this.sim.money < cost) {
          this.sim.onNotification("Not enough money to sculpt land!", "danger");
          this.sounds.playWarningSFX();
          return;
        }
        const currentElev = tile.elevation || 0;
        if (currentElev <= 0) {
          this.sim.onNotification("Minimum terrain height reached!", "warning");
          this.sounds.playWarningSFX();
          return;
        }
        this.sim.money -= cost;
        tile.elevation = currentElev - 1;
        this.sounds.playBuildSFX();
        this.renderer.updateGroundInstance(x, y);
        this.renderer.triggerPlacementParticles(x, y);
        this.rebuildRoadNetworkAround(x, y);
        this.sim.onNotification(`Lowered land at (${x}, ${y})`, 'success');
        this.sim.onTileUpdate(tile);
        return;
      }

      if (tool === 'bulldoze') {
        const tile = this.sim.grid[x][y];
        if (tile.type !== 'empty') {
          const wasRoad = tile.type === 'road';
          const success = this.sim.demolish(x, y);
          if (success) {
            this.sounds.playDemolishSFX();
            this.renderer.triggerPlacementParticles(x, y);
            if (wasRoad) {
              this.traffic.handleRoadDemolish(x, y);
              this.citizens.handleRoadDemolish(x, y);
            }
            this.rebuildRoadNetworkAround(x, y);
          }
        }
      } else {
        // Place zone or utility structure
        const cost = this.sim.getBuildCost(tool);
        const tile = this.sim.grid[x][y];

        if ((tile.type === 'empty' || (tool === 'road' && tile.type === 'water_body') || (tool === 'boardwalk' && tile.type === 'water_body')) && this.sim.money >= cost) {
          const success = this.sim.build(x, y, tool);
          if (success) {
            this.sounds.playBuildSFX();
            this.renderer.triggerPlacementParticles(x, y);
            if (tool === 'road') {
              this.rebuildRoadNetworkAround(x, y);
            }
          }
        } else if (tile.type !== 'empty') {
          // Cell occupied
        } else {
          this.sim.onNotification("Not enough funds!", "danger");
          this.sounds.playWarningSFX();
        }
      }
    };

    this.input.onBuildLine = (cells, tool) => {
      const validCells = cells.filter(cell => {
        if (cell.x < 0 || cell.x >= this.sim.gridSize || cell.y < 0 || cell.y >= this.sim.gridSize) return false;
        const tile = this.sim.grid[cell.x][cell.y];
        if (tool === 'water_body' || tool === 'boardwalk') {
          if (tile.elevation !== 0) return false;
        }
        return tile.type === 'empty' || (tool === 'road' && tile.type === 'water_body') || (tool === 'boardwalk' && tile.type === 'water_body');
      });

      if (validCells.length === 0) return;

      const success = this.sim.buildLine(cells, tool);
      if (success) {
        this.sounds.playBuildSFX();
        for (const cell of validCells) {
          this.renderer.triggerPlacementParticles(cell.x, cell.y);
        }
      }
    };

    this.input.onSelect = (x, y) => {
      this.sounds.playClickSFX();
      this.selectedTile = { x, y };
      this.updateInspector();
    };

    this.input.onHover = (x, y, coordsList) => {
      // Dynamic placement feedback
      const tool = this.input.activeTool;
      if (tool !== 'select' && tool !== 'bulldoze') {
        let isValid = true;
        if (tool === 'raise' || tool === 'lower') {
          const tile = this.sim.grid[x][y];
          const cost = 50;
          const currentElev = tile.elevation || 0;
          const heightValid = tool === 'raise' ? currentElev < 4 : currentElev > 0;
          isValid = tile.type === 'empty' && this.sim.money >= cost && heightValid;
        } else if (coordsList && coordsList.length > 0) {
          let emptyCount = 0;
          for (const cell of coordsList) {
            const tile = this.sim.grid[cell.x][cell.y];
            if (tool === 'water_body' || tool === 'boardwalk') {
              if (tile.elevation !== 0) {
                isValid = false;
                break;
              }
            }
            if (tile.type === 'empty') {
              emptyCount++;
            }
          }
          if (isValid) {
            const totalCost = emptyCount * this.sim.getBuildCost(tool);
            isValid = this.sim.money >= totalCost;
          }
        } else {
          const cost = this.sim.getBuildCost(tool);
          const tile = this.sim.grid[x][y];
          if (tool === 'water_body' || tool === 'boardwalk') {
            isValid = tile.elevation === 0 && (tile.type === 'empty' || (tool === 'boardwalk' && tile.type === 'water_body')) && this.sim.money >= cost;
          } else {
            isValid = (tile.type === 'empty' || (tool === 'road' && tile.type === 'water_body')) && this.sim.money >= cost;
          }
        }
        this.input.setPlacementValidity(isValid);
      }
    };

    // 3. UI Buttons Event Handlers
    // Toolbar Selection
    const toolButtons = document.querySelectorAll('.tool-btn');
    toolButtons.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const tool = target.getAttribute('data-tool') as TileType | 'select' | 'bulldoze' | 'raise' | 'lower';
        
        toolButtons.forEach(b => b.classList.remove('active'));
        target.classList.add('active');

        this.sounds.playClickSFX();
        this.input.setTool(tool);

        // Hide inspector when choosing a build tool
        if (tool !== 'select') {
          this.closeInspector();
        }
      });
    });

    // Speed controls
    const speedButtons = [
      { id: 'btn-speed-pause', val: 0 },
      { id: 'btn-speed-normal', val: 1 },
      { id: 'btn-speed-fast', val: 2 },
    ];

    speedButtons.forEach((cfg) => {
      const btn = document.getElementById(cfg.id);
      btn?.addEventListener('click', () => {
        this.sounds.playClickSFX();
        this.sim.setSpeed(cfg.val);
        
        speedButtons.forEach(c => document.getElementById(c.id)?.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    // Sound toggle buttons
    const btnMusic = document.getElementById('btn-music-toggle');
    btnMusic?.addEventListener('click', () => {
      const playing = this.sounds.toggleMusic();
      btnMusic.classList.toggle('active', playing);
      this.sounds.playClickSFX();
    });

    const btnSfx = document.getElementById('btn-sfx-toggle');
    btnSfx?.addEventListener('click', () => {
      const enabled = this.sounds.toggleSfx();
      btnSfx.classList.toggle('active', enabled);
      this.sounds.playClickSFX();
    });

    // Tax Control
    document.getElementById('btn-tax-down')?.addEventListener('click', () => {
      this.sim.changeTaxRate(-0.01);
      this.sounds.playClickSFX();
      this.updateTaxUI();
    });
    document.getElementById('btn-tax-up')?.addEventListener('click', () => {
      this.sim.changeTaxRate(0.01);
      this.sounds.playClickSFX();
      this.updateTaxUI();
    });

    // Inspector close button
    document.getElementById('btn-inspect-close')?.addEventListener('click', () => {
      this.sounds.playClickSFX();
      this.closeInspector();
    });

    // Save / Load / Reset Control
    document.getElementById('btn-save')?.addEventListener('click', () => {
      this.saveGame();
    });
    document.getElementById('btn-load')?.addEventListener('click', () => {
      this.loadGame();
    });
    document.getElementById('btn-reset')?.addEventListener('click', () => {
      this.resetGame();
    });

    // Keyboard Shortcuts (1-9, 0, b)
    window.addEventListener('keydown', (e) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
      let toolId = '';
      const key = e.key.toLowerCase();
      switch (key) {
        case '1': toolId = 'tool-select'; break;
        case '2': toolId = 'tool-road'; break;
        case '3': toolId = 'tool-residential'; break;
        case '4': toolId = 'tool-commercial'; break;
        case '5': toolId = 'tool-industrial'; break;
        case '6': toolId = 'tool-power'; break;
        case '7': toolId = 'tool-water'; break;
        case '8': toolId = 'tool-park'; break;
        case '9': toolId = 'tool-boardwalk'; break;
        case '0': toolId = 'tool-water-body'; break;
        case 'b': toolId = 'tool-bulldoze'; break;
        case '[': toolId = 'tool-raise'; break;
        case ']': toolId = 'tool-lower'; break;
      }
      if (toolId) {
        const btn = document.getElementById(toolId);
        btn?.click();
      }
    });
  }

  // Recalculates road direction meshes for cell and its neighbors within Manhattan distance 2
  rebuildRoadNetworkAround(x: number, y: number) {
    const list: { x: number; y: number }[] = [];
    for (let dx = -2; dx <= 2; dx++) {
      for (let dy = -2; dy <= 2; dy++) {
        if (Math.abs(dx) + Math.abs(dy) <= 2) {
          list.push({ x: x + dx, y: y + dy });
        }
      }
    }

    for (const item of list) {
      if (item.x >= 0 && item.x < this.sim.gridSize && item.y >= 0 && item.y < this.sim.gridSize) {
        const tile = this.sim.grid[item.x][item.y];
        if (tile.type === 'road') {
          // Tally adjacency connections
          const N = item.y > 0 && this.sim.grid[item.x][item.y - 1].type === 'road';
          const S = item.y < this.sim.gridSize - 1 && this.sim.grid[item.x][item.y + 1].type === 'road';
          const E = item.x < this.sim.gridSize - 1 && this.sim.grid[item.x + 1][item.y].type === 'road';
          const W = item.x > 0 && this.sim.grid[item.x - 1][item.y].type === 'road';

          this.renderer.updateRoadMesh(item.x, item.y, { N, S, E, W });
        } else {
          // Redraw empty/other tile if it was road
          this.renderer.updateTileMesh(tile);
        }
      }
    }
  }

  startLoops() {
    // 1. Render Loop (at 60fps)
    const animateLoop = () => {
      requestAnimationFrame(animateLoop);

      const now = performance.now();
      const deltaTime = (now - this.lastFrameTime) / 1000;
      this.lastFrameTime = now;

      // Animate 3D renderer updates (particles, turbines)
      this.renderer.animate(deltaTime);

      // Trigger random industrial chimney smoke
      this.processIndustrialSmoke();

      // Trigger random residential chimney smoke
      this.processResidentialSmoke();
    };
    requestAnimationFrame(animateLoop);
  }

  startSimulationLoop() {
    if (this.simTimer) return; // Prevent duplicate loops

    // 2. Simulation Tick (Ticks every 2 seconds)
    const runSimTick = () => {
      const prevTime = this.sim.timeOfDay;
      this.sim.tick();
      this.updateHUD();
      
      // Autosave every day at 6:00 AM
      if (prevTime < 6.0 && this.sim.timeOfDay >= 6.0) {
        this.autosaveGame();
      }
      
      // Reschedule according to speed
      const baseInterval = 2000;
      const interval = this.sim.speed === 0 ? baseInterval : baseInterval / this.sim.speed;
      this.simTimer = setTimeout(runSimTick, interval);
    };
    runSimTick();
  }

  // Generate smoke particles dynamically for functioning factories
  processIndustrialSmoke() {
    if (this.sim.speed === 0) return;

    for (let x = 0; x < this.sim.gridSize; x++) {
      for (let y = 0; y < this.sim.gridSize; y++) {
        const tile = this.sim.grid[x][y];
        if (tile.type === 'industrial' && tile.level > 0 && !tile.abandoned && tile.powered && tile.watered) {
          // Random probability per frame to puff smoke
          if (Math.random() > 0.98) {
            const gridOffset = 25;
            const xPos = (tile.x - gridOffset) * 2;
            const zPos = (tile.y - gridOffset) * 2;

            if (tile.level === 1) {
              // Single exhaust pipe
              this.renderer.emitChimneySmoke(xPos + 0.4, 1.1, zPos + 0.3);
            } else if (tile.level === 2) {
              // Chimney
              this.renderer.emitChimneySmoke(xPos - 0.4, 1.7, zPos - 0.4);
            } else {
              // Level 3 double chimney
              this.renderer.emitChimneySmoke(xPos - 0.4, 2.2, zPos - 0.4);
              this.renderer.emitChimneySmoke(xPos - 0.1, 2.2, zPos - 0.4);
            }
          }
        }
      }
    }
  }

  // Generate smoke particles dynamically for functioning residential buildings
  processResidentialSmoke() {
    if (this.sim.speed === 0) return;

    for (let x = 0; x < this.sim.gridSize; x++) {
      for (let y = 0; y < this.sim.gridSize; y++) {
        const tile = this.sim.grid[x][y];
        if (tile.type === 'residential' && tile.level > 0 && !tile.abandoned && tile.powered && tile.watered) {
          // Residential chimney smoke (less frequent than factories to look calmer)
          if (Math.random() > 0.992) {
            const gridOffset = 25;
            const xPos = (tile.x - gridOffset) * 2;
            const zPos = (tile.y - gridOffset) * 2;

            const chimneyOffsets = this.renderer.assets.getResidentialChimneyPos(tile.level, tile.x, tile.y);
            const targetRotation = this.renderer.calculateTileRotation(tile);
            const cos = Math.cos(targetRotation);
            const sin = Math.sin(targetRotation);

            for (const offset of chimneyOffsets) {
              const rx = offset.x * cos - offset.z * sin;
              const rz = offset.x * sin + offset.z * cos;
              const ry = offset.y - 0.06;
              this.renderer.emitChimneySmoke(xPos + rx, ry, zPos + rz);
            }
          }
        }
      }
    }
  }

  // Update HTML overlay elements
  updateHUD() {
    // 1. Stats Bar
    const moneyEl = document.getElementById('stat-money');
    if (moneyEl) moneyEl.innerText = `$${this.sim.money.toLocaleString()}`;

    const incomeEl = document.getElementById('stat-income');
    if (incomeEl) {
      const inc = this.sim.weeklyNetIncome;
      incomeEl.innerText = `${inc >= 0 ? '+' : '-'}$${Math.abs(inc).toLocaleString()}/wk`;
      incomeEl.className = `stat-trend ${inc >= 0 ? 'positive' : 'negative'}`;
    }

    const popEl = document.getElementById('stat-population');
    if (popEl) popEl.innerText = this.sim.population.toString();

    const popTrendEl = document.getElementById('stat-pop-trend');
    if (popTrendEl) {
      const demand = this.sim.demandR;
      popTrendEl.innerText = demand > 15 ? '▲' : demand < -15 ? '▼' : '→';
      popTrendEl.className = `stat-trend ${demand > 15 ? 'positive' : demand < -15 ? 'negative' : ''}`;
    }

    const happyEl = document.getElementById('stat-happiness');
    if (happyEl) happyEl.innerText = `${this.sim.overallHappiness}%`;

    // Time & Day clock format
    const timeEl = document.getElementById('stat-time');
    const timeIconEl = document.getElementById('time-icon');
    if (timeEl) {
      const hrs = Math.floor(this.sim.timeOfDay);
      const mins = Math.floor((this.sim.timeOfDay - hrs) * 60);
      const ampm = hrs >= 12 ? 'PM' : 'AM';
      const formattedHrs = hrs % 12 === 0 ? 12 : hrs % 12;
      const formattedMins = mins < 10 ? `0${mins}` : mins;
      
      timeEl.innerText = `${formattedHrs}:${formattedMins} ${ampm}`;

      // Update sun/moon icons
      if (timeIconEl) {
        const timeIconImg = timeIconEl as HTMLImageElement;
        if (hrs >= 19 || hrs < 5) timeIconImg.src = '/moon_icon.png';
        else if (hrs >= 5 && hrs < 7) timeIconImg.src = '/dawn_icon.png';
        else if (hrs >= 17 && hrs < 19) timeIconImg.src = '/dusk_icon.png';
        else timeIconImg.src = '/sun_icon.png';
      }
    }

    const dayEl = document.getElementById('stat-day');
    if (dayEl) dayEl.innerText = `Day ${this.sim.dayCount}`;

    // 2. Demand Progress bars
    const fillR = document.getElementById('demand-r');
    if (fillR) fillR.style.width = `${Math.max(0, Math.min(100, (this.sim.demandR + 100) / 2))}%`;

    const fillC = document.getElementById('demand-c');
    if (fillC) fillC.style.width = `${Math.max(0, Math.min(100, (this.sim.demandC + 100) / 2))}%`;

    const fillI = document.getElementById('demand-i');
    if (fillI) fillI.style.width = `${Math.max(0, Math.min(100, (this.sim.demandI + 100) / 2))}%`;

    // 3. Status card metrics
    const powerEl = document.getElementById('status-power');
    if (powerEl) {
      // Basic check: percentage of zoned cells powered
      let total = 0, powered = 0;
      this.sim.grid.forEach(row => row.forEach(tile => {
        if (tile.type !== 'empty' && tile.type !== 'road') {
          total++;
          if (tile.powered) powered++;
        }
      }));
      const pct = total > 0 ? Math.round((powered / total) * 100) : 100;
      powerEl.innerText = `${pct}%`;
      powerEl.className = pct < 90 ? 'negative' : '';
    }

    const waterEl = document.getElementById('status-water');
    if (waterEl) {
      let total = 0, watered = 0;
      this.sim.grid.forEach(row => row.forEach(tile => {
        if (tile.type !== 'empty' && tile.type !== 'road') {
          total++;
          if (tile.watered) watered++;
        }
      }));
      const pct = total > 0 ? Math.round((watered / total) * 100) : 100;
      waterEl.innerText = `${pct}%`;
      waterEl.className = pct < 90 ? 'negative' : '';
    }

    // Trigger Day/Night Renderer update
    this.renderer.updateDayNightCycle(this.sim.timeOfDay);

    // Dynamic inspector update
    if (this.selectedTile) {
      const tile = this.sim.grid[this.selectedTile.x][this.selectedTile.y];
      this.updateInspectorDetails(tile);
    }
  }

  updateTaxUI() {
    const taxEl = document.getElementById('stat-tax-rate');
    if (taxEl) taxEl.innerText = `${Math.round(this.sim.taxRate * 100)}%`;
  }

  // Notification Banner
  showNotification(msg: string, type: 'success' | 'info' | 'warning' | 'danger') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'warning') icon = '⚠️';
    if (type === 'danger') icon = '🚨';

    toast.innerHTML = `
      <span class="toast-icon">${icon}</span>
      <span class="toast-message">${msg}</span>
    `;

    container.appendChild(toast);

    // Auto-remove after 5 seconds matching fadeout CSS
    setTimeout(() => {
      toast.remove();
    }, 5000);
  }

  // Inspector Panel Management
  updateInspector() {
    if (!this.selectedTile) {
      this.closeInspector();
      return;
    }

    const tile = this.sim.grid[this.selectedTile.x][this.selectedTile.y];
    
    // Position marker or spotlight if needed, but let's just populate UI
    const panel = document.getElementById('inspector-panel');
    panel?.classList.remove('hidden');

    const titleEl = document.getElementById('inspect-title');
    if (titleEl) titleEl.innerText = `Inspect Tile`;

    const coordsEl = document.getElementById('inspect-coords');
    if (coordsEl) coordsEl.innerText = `${tile.x}, ${tile.y}`;

    const typeEl = document.getElementById('inspect-type');
    if (typeEl) {
      let displayName = tile.type.toUpperCase();
      if (tile.type === 'power') displayName = 'WIND TURBINE';
      if (tile.type === 'water') displayName = 'WATER TOWER';
      typeEl.innerText = displayName;
    }

    this.updateInspectorDetails(tile);
  }

  updateInspectorIfNeeded(tile: TileState) {
    if (this.selectedTile && this.selectedTile.x === tile.x && this.selectedTile.y === tile.y) {
      this.updateInspectorDetails(tile);
    }
  }

  updateInspectorDetails(tile: TileState) {
    const detailsContainer = document.getElementById('inspect-simulation-details');
    if (!detailsContainer) return;

    if (tile.type === 'empty') {
      detailsContainer.innerHTML = `<p style="color: #8e9aab;">Nothing built here. Select a tool from the toolbar below to construct zones, roads or utility grids.</p>`;
      return;
    }

    let utilitiesHtml = `
      <div class="inspect-row">
        <span class="inspect-label">Power connected:</span>
        <span class="inspect-value ${tile.powered ? 'inspect-badge success' : 'inspect-badge danger'}">${tile.powered ? 'Yes' : 'No'}</span>
      </div>
      <div class="inspect-row">
        <span class="inspect-label">Water connected:</span>
        <span class="inspect-value ${tile.watered ? 'inspect-badge success' : 'inspect-badge danger'}">${tile.watered ? 'Yes' : 'No'}</span>
      </div>
    `;

    if (tile.type === 'road') {
      detailsContainer.innerHTML = `
        <div class="inspect-row">
          <span class="inspect-label">Type:</span>
          <span class="inspect-value">${tile.bridge ? 'Bridge' : 'Standard Road'}</span>
        </div>
        <div class="inspect-row">
          <span class="inspect-label">Weekly Maintenance:</span>
          <span class="inspect-value">$${this.sim.getMaintenanceCost('road')}</span>
        </div>
        ${utilitiesHtml}
      `;
      return;
    }

    if (tile.type === 'water_body') {
      detailsContainer.innerHTML = `
        <div class="inspect-row">
          <span class="inspect-label">Type:</span>
          <span class="inspect-value inspect-badge info" style="background: rgba(2, 132, 199, 0.15); color: #38bdf8; border-color: rgba(2, 132, 199, 0.2); font-weight: 600;">Natural Water</span>
        </div>
        <p style="color: #8e9aab; margin-top: 0.5rem; line-height: 1.4;">A peaceful body of water. Build roads over it to create bridges, or bulldoze it to restore land.</p>
      `;
      return;
    }

    if (tile.type === 'boardwalk') {
      detailsContainer.innerHTML = `
        <div class="inspect-row">
          <span class="inspect-label">Type:</span>
          <span class="inspect-value inspect-badge info" style="background: rgba(253, 186, 116, 0.15); color: #ffedd5; border-color: rgba(253, 186, 116, 0.2); font-weight: 600;">Waterfront Boardwalk</span>
        </div>
        <div class="inspect-row">
          <span class="inspect-label">Weekly Upkeep:</span>
          <span class="inspect-value">$${this.sim.getMaintenanceCost('boardwalk')}</span>
        </div>
        <p style="color: #8e9aab; margin-top: 0.5rem; line-height: 1.4;">A cozy wooden deck built along the waterfront. Generates dynamic piers/docks on adjacent water tiles and boosts nearby residential happiness.</p>
      `;
      return;
    }

    if (tile.type === 'power' || tile.type === 'water' || tile.type === 'park') {
      detailsContainer.innerHTML = `
        <div class="inspect-row">
          <span class="inspect-label">Status:</span>
          <span class="inspect-value inspect-badge success">Active</span>
        </div>
        <div class="inspect-row">
          <span class="inspect-label">Weekly Maintenance:</span>
          <span class="inspect-value">$${this.sim.getMaintenanceCost(tile.type)}</span>
        </div>
      `;
      return;
    }

    // Zoned buildings details
    let occupancyLabel = 'Residents';
    if (tile.type === 'commercial') {
      occupancyLabel = 'Jobs Filled';
    } else if (tile.type === 'industrial') {
      occupancyLabel = 'Workers';
    }

    const statusBadge = tile.abandoned 
      ? `<span class="inspect-badge danger">Abandoned</span>`
      : tile.level === 0 
        ? `<span class="inspect-badge info">Zoned / Developing</span>`
        : `<span class="inspect-badge success">Grown (Lvl ${tile.level})</span>`;

    let citizensHtml = '';
    const occupants = this.citizens ? this.citizens.getCitizensAtTile(tile.x, tile.y) : [];
    if (occupants.length > 0) {
      citizensHtml = `
        <hr class="panel-divider" style="margin: 0.75rem 0; border-color: rgba(255,255,255,0.06);">
        <h3 style="font-size: 0.95rem; font-weight: 600; color: #94a3b8; margin: 0 0 0.5rem 0;">Occupants Profile</h3>
        <div class="occupants-list" style="display: flex; flex-direction: column; gap: 8px; max-height: 150px; overflow-y: auto; padding-right: 4px;">
          ${occupants.map(c => `
            <div class="occupant-card" style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.04); border-radius: 8px; padding: 6px 10px; display: flex; flex-direction: column; gap: 2px;">
              <div style="display: flex; justify-content: space-between; font-weight: 500; font-size: 0.95rem; color: #f1f3f5;">
                <span>${c.profile.firstName} ${c.profile.lastName}</span>
                <span style="color: #60a5fa; font-size: 0.8rem;">Age ${c.profile.age}</span>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 0.78rem; color: #94a3b8;">
                <span>Job: ${c.profile.job}</span>
                <span style="color: ${c.profile.happiness >= 75 ? '#4ade80' : c.profile.happiness >= 50 ? '#f59e0b' : '#ef4444'};">😊 ${c.profile.happiness}%</span>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    }

    detailsContainer.innerHTML = `
      <div class="inspect-row">
        <span class="inspect-label">Status:</span>
        <span class="inspect-value">${statusBadge}</span>
      </div>
      <div class="inspect-row">
        <span class="inspect-label">Development:</span>
        <span class="inspect-value">${Math.round(tile.progress)}%</span>
      </div>
      <div class="inspect-row">
        <span class="inspect-label">${occupancyLabel}:</span>
        <span class="inspect-value">${tile.occupancy} / ${tile.maxOccupancy}</span>
      </div>
      <div class="inspect-row">
        <span class="inspect-label">Happiness:</span>
        <span class="inspect-value">${tile.happiness}%</span>
      </div>
      ${utilitiesHtml}
      ${citizensHtml}
    `;
  }

  closeInspector() {
    this.selectedTile = null;
    const panel = document.getElementById('inspector-panel');
    panel?.classList.add('hidden');
  }

  saveGame() {
    this.sounds.playClickSFX();
    const saveData = this.sim.saveState();
    try {
      localStorage.setItem('nabocity_save', saveData);
      this.sim.onNotification('Neighborhood saved successfully to Local Storage!', 'success');
    } catch (e) {
      console.error('Failed to save game to localStorage:', e);
      this.sim.onNotification('Failed to save neighborhood: storage quota exceeded or disabled.', 'danger');
      this.sounds.playWarningSFX();
    }
  }

  autosaveGame() {
    const saveData = this.sim.saveState();
    try {
      localStorage.setItem('nabocity_save', saveData);
      this.sim.onNotification('Neighborhood autosaved successfully!', 'success');
    } catch (e) {
      console.error('Failed to autosave game to localStorage:', e);
      this.sim.onNotification('Autosave failed: storage quota exceeded or disabled.', 'warning');
    }
  }

  loadGame() {
    this.sounds.playClickSFX();
    let saveData: string | null = null;
    try {
      saveData = localStorage.getItem('nabocity_save');
      if (!saveData) {
        saveData = localStorage.getItem('serene_valley_save');
      }
    } catch (e) {
      console.error('Failed to load game from localStorage:', e);
      this.sim.onNotification('Failed to load neighborhood: storage access disabled.', 'danger');
      this.sounds.playWarningSFX();
      return;
    }

    if (!saveData) {
      this.sim.onNotification('No saved neighborhood data found in this browser!', 'warning');
      this.sounds.playWarningSFX();
      return;
    }

    // 1. Clear active traffic & citizens
    if (this.traffic) {
      this.traffic.clearAll();
    }
    if (this.citizens) {
      this.citizens.clearAll();
    }

    // 2. Remove all old building meshes from scene
    this.renderer.buildingMeshes.forEach((mesh) => {
      this.renderer.scene.remove(mesh);
    });
    this.renderer.buildingMeshes.clear();

    // 3. Load simulation state
    const success = this.sim.loadState(saveData);

    if (success) {
      this.renderer.resetGroundInstances();
      this.renderer.rebuildTrees();
      // 4. Rebuild all roads and structures in the 3D scene
      for (let x = 0; x < this.sim.gridSize; x++) {
        for (let y = 0; y < this.sim.gridSize; y++) {
          const tile = this.sim.grid[x][y];
          if (tile.type === 'road') {
            this.rebuildRoadNetworkAround(x, y);
          } else if (tile.type !== 'empty') {
            this.renderer.updateTileMesh(tile);
          }
        }
      }

      this.updateHUD();
      this.updateTaxUI();
      this.closeInspector();

      this.sim.onNotification('Neighborhood loaded successfully!', 'success');
    } else {
      this.sim.onNotification('Failed to load saved neighborhood data.', 'danger');
      this.sounds.playWarningSFX();
    }
  }

  resetGame() {
    this.sounds.playClickSFX();
    if (confirm('Are you sure you want to start a new neighborhood? All current progress will be lost.')) {
      this.sim.seed = Math.floor(Math.random() * 1000000);
      this.sim.initializeGrid();
      this.sim.money = 30000;
      this.sim.taxRate = 0.12;
      this.sim.population = 0;
      this.sim.jobs = 0;
      this.sim.employed = 0;
      this.sim.overallHappiness = 100;
      this.sim.demandR = 50;
      this.sim.demandC = 30;
      this.sim.demandI = 20;
      this.sim.dayCount = 1;
      this.sim.timeOfDay = 8.0;
      this.sim.weeklyTaxes = 0;
      this.sim.weeklyMaintenance = 0;
      this.sim.weeklyNetIncome = 0;

      // Clear traffic & citizens
      if (this.traffic) {
        this.traffic.clearAll();
      }
      if (this.citizens) {
        this.citizens.clearAll();
      }

      // Clear 3D building meshes
      this.renderer.buildingMeshes.forEach((mesh) => {
        this.renderer.scene.remove(mesh);
      });
      this.renderer.buildingMeshes.clear();
      this.renderer.resetGroundInstances();
      this.renderer.rebuildTrees();

      this.sim.updateUtilities();
      this.updateHUD();
      this.updateTaxUI();
      this.closeInspector();

      this.sim.onNotification('Neighborhood reset. Start fresh!', 'info');
      this.sounds.playDemolishSFX();
    }
  }

  updateAudioButtonsUI() {
    const btnMusic = document.getElementById('btn-music-toggle');
    if (btnMusic) {
      btnMusic.classList.toggle('active', this.sounds.isMusicPlaying);
    }
    const btnSfx = document.getElementById('btn-sfx-toggle');
    if (btnSfx) {
      btnSfx.classList.toggle('active', this.sounds.isSfxEnabled);
    }
  }
}
