import { Simulation, TileState, TileType } from './Simulation';
import { Renderer } from './Renderer';
import { InputManager } from './InputManager';
import { AssetGenerator } from './AssetGenerator';
import { SoundManager } from './SoundManager';
import { TrafficManager } from './TrafficManager';
import { CitizenManager } from './CitizenManager';
import * as THREE from 'three';

function escapeHTML(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export class Game {
  sim: Simulation;
  assets: AssetGenerator;
  renderer: Renderer;
  input: InputManager;
  sounds: SoundManager;
  traffic: TrafficManager;
  citizens: CitizenManager;

  // Loop references
  lastFrameTime = performance.now();
  simTimer: ReturnType<typeof setTimeout> | null = null;

  // Selected tile for inspector
  selectedTile: { x: number; y: number } | null = null;

  constructor() {
    this.migrateSaveKeys();
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

    this.setupBindings();
    this.initCelSandbox();
    this.initShadowSandbox();
    this.initDevDropdown();
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
          hasSave = !!localStorage.getItem('nabocity_save');
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

    // Keyboard shortcuts
    window.addEventListener('keydown', (e: KeyboardEvent) => {
      // Ignore shortcuts when typing in an input/textarea
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement).isContentEditable
      ) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        const isPaused = this.sim.speed === 0;
        const newSpeed = isPaused ? 1 : 0;
        this.sim.setSpeed(newSpeed);
        speedButtons.forEach(c => document.getElementById(c.id)?.classList.remove('active'));
        const activeId = newSpeed === 0 ? 'btn-speed-pause' : 'btn-speed-normal';
        document.getElementById(activeId)?.classList.add('active');
      }

      else if (e.code === 'Tab') {
        e.preventDefault();
        // Cycle: 1 → 2 → 0 → 1 (skip 0 from 2, wrap through pause)
        const cycle: { [key: number]: number } = { 0: 1, 1: 2, 2: 0 };
        const newSpeed = cycle[this.sim.speed] ?? 1;
        this.sim.setSpeed(newSpeed);
        speedButtons.forEach(c => document.getElementById(c.id)?.classList.remove('active'));
        const btnId = speedButtons.find(c => c.val === newSpeed)?.id;
        if (btnId) document.getElementById(btnId)?.classList.add('active');
      }

      else {
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
      }
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
  }

  initCelSandbox() {
    const bandsSelect = document.getElementById('sandbox-bands-select') as HTMLSelectElement | null;
    const slidersContainer = document.getElementById('sandbox-sliders-container');
    
    if (!bandsSelect || !slidersContainer) return;

    // Close button click listener
    const btnClose = document.getElementById('btn-sandbox-close');
    btnClose?.addEventListener('click', () => {
      this.sounds.playClickSFX();
      const celSandbox = document.getElementById('cel-sandbox');
      if (celSandbox) {
        celSandbox.classList.add('hidden');
      }
      
      // Update dropdown active styling
      const menuItem = document.getElementById('item-toggle-cel-sandbox');
      if (menuItem) {
        menuItem.classList.remove('active');
      }
    });

    // Enable/Disable Cel Shading switch inside panel
    const panelToggle = document.getElementById('panel-cel-toggle') as HTMLInputElement | null;
    if (panelToggle) {
      panelToggle.checked = this.assets.useCelShading;
      panelToggle.addEventListener('change', () => {
        const isCel = panelToggle.checked;
        this.assets.setCelShading(isCel);
        this.renderer.refreshSceneMaterials();
        this.sounds.playClickSFX();
      });
    }
    
    const presetLinear = document.getElementById('btn-sandbox-preset-linear');
    const presetBell = document.getElementById('btn-sandbox-preset-bell');
    const presetUShape = document.getElementById('btn-sandbox-preset-ushape');
    
    let currentValues = [5, 5, 5, 30, 30, 80, 80, 130, 190, 255]; 
    
    const renderSliders = () => {
      slidersContainer.innerHTML = '';
      const steps = parseInt(bandsSelect.value);
      
      if (currentValues.length !== steps) {
        const newValues = [];
        for (let i = 0; i < steps; i++) {
          const t = i / (steps - 1);
          newValues.push(Math.round(20 + t * 235));
        }
        currentValues = newValues;
      }
      
      for (let i = 0; i < steps; i++) {
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.flexDirection = 'column';
        row.style.gap = '2px';
        
        const labelRow = document.createElement('div');
        labelRow.style.display = 'flex';
        labelRow.style.justifyContent = 'space-between';
        labelRow.style.fontSize = '0.75rem';
        labelRow.style.color = '#94a3b8';
        
        const label = document.createElement('span');
        label.innerText = `Band ${i + 1}`;
        
        const valText = document.createElement('span');
        valText.innerText = currentValues[i].toString();
        valText.id = `sandbox-val-text-${i}`;
        
        labelRow.appendChild(label);
        labelRow.appendChild(valText);
        
        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = '0';
        slider.max = '255';
        slider.value = currentValues[i].toString();
        slider.style.width = '100%';
        slider.style.cursor = 'pointer';
        
        slider.addEventListener('input', () => {
          const val = parseInt(slider.value);
          currentValues[i] = val;
          valText.innerText = val.toString();
          
          this.assets.updateToonGradient(currentValues);
        });
        
        row.appendChild(labelRow);
        row.appendChild(slider);
        slidersContainer.appendChild(row);
      }
      
      this.assets.updateToonGradient(currentValues);
    };
    
    bandsSelect.addEventListener('change', () => {
      renderSliders();
    });
    
    presetLinear?.addEventListener('click', () => {
      const steps = parseInt(bandsSelect.value);
      const newVals = [];
      for (let i = 0; i < steps; i++) {
        const t = i / (steps - 1);
        newVals.push(Math.round(20 + t * 235));
      }
      currentValues = newVals;
      renderSliders();
    });
    
    presetBell?.addEventListener('click', () => {
      const steps = parseInt(bandsSelect.value);
      const newVals = [];
      if (steps === 7) {
        currentValues = [20, 100, 120, 128, 136, 156, 255];
      } else if (steps === 5) {
        currentValues = [20, 110, 128, 146, 255];
      } else {
        for (let i = 0; i < steps; i++) {
          const t = i / (steps - 1);
          const x = t * 2 - 1;
          const sign = x < 0 ? -1 : 1;
          const v = 128 + 108 * sign * Math.pow(Math.abs(x), 2.2);
          newVals.push(Math.round(Math.max(20, Math.min(255, v))));
        }
        currentValues = newVals;
      }
      renderSliders();
    });
    
    presetUShape?.addEventListener('click', () => {
      const steps = parseInt(bandsSelect.value);
      const newVals = [];
      if (steps === 10) {
        currentValues = [5, 5, 5, 30, 30, 80, 80, 130, 190, 255];
      } else if (steps === 7) {
        currentValues = [20, 30, 50, 135, 220, 240, 255];
      } else if (steps === 5) {
        currentValues = [20, 40, 70, 210, 255];
      } else {
        for (let i = 0; i < steps; i++) {
          const t = i / (steps - 1);
          const x = t * 2 - 1;
          const v = 128 + 108 * Math.pow(x, 3);
          newVals.push(Math.round(Math.max(20, Math.min(255, v))));
        }
        currentValues = newVals;
      }
      renderSliders();
    });
    
    renderSliders();
  }

  initShadowSandbox() {
    const shadowSandbox = document.getElementById('shadow-sandbox');
    const btnClose = document.getElementById('btn-shadow-close');
    const panelToggle = document.getElementById('panel-shadow-toggle') as HTMLInputElement | null;
    const typeSelect = document.getElementById('shadow-type-select') as HTMLSelectElement | null;
    const resSelect = document.getElementById('shadow-res-select') as HTMLSelectElement | null;

    const sliderBias = document.getElementById('slider-shadow-bias') as HTMLInputElement | null;
    const valBias = document.getElementById('val-shadow-bias');

    const sliderNormalBias = document.getElementById('slider-shadow-normal-bias') as HTMLInputElement | null;
    const valNormalBias = document.getElementById('val-shadow-normal-bias');

    const sliderFrustum = document.getElementById('slider-shadow-frustum') as HTMLInputElement | null;
    const valFrustum = document.getElementById('val-shadow-frustum');
    const toggleAutoFitFrustum = document.getElementById('panel-autofit-frustum') as HTMLInputElement | null;
    const frustumControlGroup = document.getElementById('shadow-frustum-control-group');

    const sliderNear = document.getElementById('slider-shadow-near') as HTMLInputElement | null;
    const valNear = document.getElementById('val-shadow-near');

    const sliderFar = document.getElementById('slider-shadow-far') as HTMLInputElement | null;
    const valFar = document.getElementById('val-shadow-far');

    const toggleOverride = document.getElementById('panel-override-sun') as HTMLInputElement | null;
    const overrideGroup = document.getElementById('sun-override-group');

    const sliderAzimuth = document.getElementById('slider-sun-azimuth') as HTMLInputElement | null;
    const valAzimuth = document.getElementById('val-sun-azimuth');

    const sliderElevation = document.getElementById('slider-sun-elevation') as HTMLInputElement | null;
    const valElevation = document.getElementById('val-sun-elevation');

    const sliderSunIntensity = document.getElementById('slider-sun-intensity') as HTMLInputElement | null;
    const valSunIntensity = document.getElementById('val-sun-intensity');

    const sliderAmbientIntensity = document.getElementById('slider-ambient-intensity') as HTMLInputElement | null;
    const valAmbientIntensity = document.getElementById('val-ambient-intensity');

    const pickerSunColor = document.getElementById('picker-sun-color') as HTMLInputElement | null;
    const textSunColor = document.getElementById('text-sun-color');

    const pickerAmbientColor = document.getElementById('picker-ambient-color') as HTMLInputElement | null;
    const textAmbientColor = document.getElementById('text-ambient-color');

    // Close button
    btnClose?.addEventListener('click', () => {
      this.sounds.playClickSFX();
      shadowSandbox?.classList.add('hidden');
      document.getElementById('item-toggle-shadow-sandbox')?.classList.remove('active');
    });

    // Toggle shadows
    if (panelToggle) {
      panelToggle.checked = this.renderer.shadowSettings.castShadows;
      panelToggle.addEventListener('change', () => {
        this.renderer.updateShadowSettings({ castShadows: panelToggle.checked });
        this.sounds.playClickSFX();
      });
    }

    // Shadow Type
    if (typeSelect) {
      const typeMap: { [key: string]: THREE.ShadowMapType } = {
        basic: THREE.BasicShadowMap,
        pcf: THREE.PCFShadowMap,
        pcfsoft: THREE.PCFSoftShadowMap,
        vsm: THREE.VSMShadowMap,
      };
      
      typeSelect.addEventListener('change', () => {
        const type = typeMap[typeSelect.value];
        if (type !== undefined) {
          this.renderer.updateShadowSettings({ shadowMapType: type });
          this.sounds.playClickSFX();
        }
      });
    }

    // Shadow Resolution
    if (resSelect) {
      resSelect.addEventListener('change', () => {
        const size = parseInt(resSelect.value);
        if (!isNaN(size)) {
          this.renderer.updateShadowSettings({ shadowMapSize: size });
          this.sounds.playClickSFX();
        }
      });
    }

    // Bias
    if (sliderBias && valBias) {
      sliderBias.value = this.renderer.shadowSettings.bias.toString();
      valBias.innerText = this.renderer.shadowSettings.bias.toString();
      sliderBias.addEventListener('input', () => {
        const val = parseFloat(sliderBias.value);
        valBias.innerText = val.toFixed(4);
        this.renderer.updateShadowSettings({ bias: val });
      });
      sliderBias.addEventListener('change', () => {
        this.sounds.playClickSFX();
      });
    }

    // Normal Bias
    if (sliderNormalBias && valNormalBias) {
      sliderNormalBias.value = this.renderer.shadowSettings.normalBias.toString();
      valNormalBias.innerText = this.renderer.shadowSettings.normalBias.toString();
      sliderNormalBias.addEventListener('input', () => {
        const val = parseFloat(sliderNormalBias.value);
        valNormalBias.innerText = val.toFixed(3);
        this.renderer.updateShadowSettings({ normalBias: val });
      });
      sliderNormalBias.addEventListener('change', () => {
        this.sounds.playClickSFX();
      });
    }

    // Helper function to update the visual state of the manual frustum group based on auto-fit state
    const updateFrustumUIState = () => {
      if (!toggleAutoFitFrustum || !sliderFrustum || !frustumControlGroup || !valFrustum) return;
      const isAuto = toggleAutoFitFrustum.checked;
      sliderFrustum.disabled = isAuto;
      if (isAuto) {
        frustumControlGroup.style.opacity = '0.5';
        frustumControlGroup.style.pointerEvents = 'none';
        // Immediately sync display with dynamic frustum size
        valFrustum.innerText = this.renderer.shadowSettings.frustumSize.toString();
        sliderFrustum.value = this.renderer.shadowSettings.frustumSize.toString();
      } else {
        frustumControlGroup.style.opacity = '1';
        frustumControlGroup.style.pointerEvents = 'auto';
      }
    };

    if (toggleAutoFitFrustum) {
      toggleAutoFitFrustum.checked = this.renderer.shadowSettings.autoFitFrustum;
      toggleAutoFitFrustum.addEventListener('change', () => {
        this.sounds.playClickSFX();
        this.renderer.updateShadowSettings({ autoFitFrustum: toggleAutoFitFrustum.checked });
        updateFrustumUIState();
      });
    }

    // Frustum Size
    if (sliderFrustum && valFrustum) {
      sliderFrustum.value = this.renderer.shadowSettings.frustumSize.toString();
      valFrustum.innerText = this.renderer.shadowSettings.frustumSize.toString();
      sliderFrustum.addEventListener('input', () => {
        const val = parseInt(sliderFrustum.value);
        valFrustum.innerText = val.toString();
        this.renderer.updateShadowSettings({ frustumSize: val });
      });
      sliderFrustum.addEventListener('change', () => {
        this.sounds.playClickSFX();
      });
    }

    updateFrustumUIState();

    // Near
    if (sliderNear && valNear) {
      sliderNear.value = this.renderer.shadowSettings.near.toString();
      valNear.innerText = this.renderer.shadowSettings.near.toString();
      sliderNear.addEventListener('input', () => {
        const val = parseFloat(sliderNear.value);
        valNear.innerText = val.toFixed(1);
        this.renderer.updateShadowSettings({ near: val });
      });
      sliderNear.addEventListener('change', () => {
        this.sounds.playClickSFX();
      });
    }

    // Far
    if (sliderFar && valFar) {
      sliderFar.value = this.renderer.shadowSettings.far.toString();
      valFar.innerText = this.renderer.shadowSettings.far.toString();
      sliderFar.addEventListener('input', () => {
        const val = parseInt(sliderFar.value);
        valFar.innerText = val.toString();
        this.renderer.updateShadowSettings({ far: val });
      });
      sliderFar.addEventListener('change', () => {
        this.sounds.playClickSFX();
      });
    }

    // Override Sun
    if (toggleOverride && overrideGroup) {
      toggleOverride.checked = this.renderer.shadowSettings.overrideSun;
      const updateOverrideState = () => {
        const over = toggleOverride.checked;
        this.renderer.updateShadowSettings({ overrideSun: over });
        if (over) {
          overrideGroup.style.opacity = '1';
          overrideGroup.style.pointerEvents = 'auto';
        } else {
          overrideGroup.style.opacity = '0.5';
          overrideGroup.style.pointerEvents = 'none';
        }
      };
      
      // Initialize state on boot
      updateOverrideState();
      
      toggleOverride.addEventListener('change', () => {
        updateOverrideState();
        this.sounds.playClickSFX();
      });
    }

    // Azimuth
    if (sliderAzimuth && valAzimuth) {
      sliderAzimuth.value = this.renderer.shadowSettings.sunAzimuth.toString();
      valAzimuth.innerText = `${this.renderer.shadowSettings.sunAzimuth}°`;
      sliderAzimuth.addEventListener('input', () => {
        const val = parseInt(sliderAzimuth.value);
        valAzimuth.innerText = `${val}°`;
        this.renderer.updateShadowSettings({ sunAzimuth: val });
      });
      sliderAzimuth.addEventListener('change', () => {
        this.sounds.playClickSFX();
      });
    }

    // Elevation
    if (sliderElevation && valElevation) {
      sliderElevation.value = this.renderer.shadowSettings.sunElevation.toString();
      valElevation.innerText = `${this.renderer.shadowSettings.sunElevation}°`;
      sliderElevation.addEventListener('input', () => {
        const val = parseInt(sliderElevation.value);
        valElevation.innerText = `${val}°`;
        this.renderer.updateShadowSettings({ sunElevation: val });
      });
      sliderElevation.addEventListener('change', () => {
        this.sounds.playClickSFX();
      });
    }

    // Sun Intensity
    if (sliderSunIntensity && valSunIntensity) {
      sliderSunIntensity.value = this.renderer.shadowSettings.sunIntensity.toString();
      valSunIntensity.innerText = this.renderer.shadowSettings.sunIntensity.toString();
      sliderSunIntensity.addEventListener('input', () => {
        const val = parseFloat(sliderSunIntensity.value);
        valSunIntensity.innerText = val.toFixed(1);
        this.renderer.updateShadowSettings({ sunIntensity: val });
      });
      sliderSunIntensity.addEventListener('change', () => {
        this.sounds.playClickSFX();
      });
    }

    // Ambient Intensity
    if (sliderAmbientIntensity && valAmbientIntensity) {
      sliderAmbientIntensity.value = this.renderer.shadowSettings.ambientIntensity.toString();
      valAmbientIntensity.innerText = this.renderer.shadowSettings.ambientIntensity.toString();
      sliderAmbientIntensity.addEventListener('input', () => {
        const val = parseFloat(sliderAmbientIntensity.value);
        valAmbientIntensity.innerText = val.toFixed(1);
        this.renderer.updateShadowSettings({ ambientIntensity: val });
      });
      sliderAmbientIntensity.addEventListener('change', () => {
        this.sounds.playClickSFX();
      });
    }

    // Sun Color Picker
    if (pickerSunColor && textSunColor) {
      pickerSunColor.value = this.renderer.shadowSettings.sunColor;
      textSunColor.innerText = this.renderer.shadowSettings.sunColor;
      pickerSunColor.addEventListener('input', () => {
        const val = pickerSunColor.value;
        textSunColor.innerText = val;
        this.renderer.updateShadowSettings({ sunColor: val });
      });
    }

    // Ambient Color Picker
    if (pickerAmbientColor && textAmbientColor) {
      pickerAmbientColor.value = this.renderer.shadowSettings.ambientColor;
      textAmbientColor.innerText = this.renderer.shadowSettings.ambientColor;
      pickerAmbientColor.addEventListener('input', () => {
        const val = pickerAmbientColor.value;
        textAmbientColor.innerText = val;
        this.renderer.updateShadowSettings({ ambientColor: val });
      });
    }
  }

  initDevDropdown() {
    const devDropdown = document.getElementById('dev-dropdown');
    const btnDevToggle = document.getElementById('btn-dev-toggle');
    const itemToggleCelSandbox = document.getElementById('item-toggle-cel-sandbox');
    const itemToggleShadowSandbox = document.getElementById('item-toggle-shadow-sandbox');
    
    if (!devDropdown || !btnDevToggle) return;
    
    btnDevToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      devDropdown.classList.toggle('hidden');
    });
    
    window.addEventListener('click', () => {
      if (!devDropdown.classList.contains('hidden')) {
        devDropdown.classList.add('hidden');
      }
    });
    
    itemToggleCelSandbox?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.sounds.playClickSFX();
      
      const celSandbox = document.getElementById('cel-sandbox');
      if (celSandbox) {
        const isHidden = celSandbox.classList.toggle('hidden');
        itemToggleCelSandbox.classList.toggle('active', !isHidden);
      }
    });

    itemToggleShadowSandbox?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.sounds.playClickSFX();
      
      const shadowSandbox = document.getElementById('shadow-sandbox');
      if (shadowSandbox) {
        const isHidden = shadowSandbox.classList.toggle('hidden');
        itemToggleShadowSandbox.classList.toggle('active', !isHidden);
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

      // If shadow sandbox is open and auto-fit frustum is active, keep slider in sync
      const shadowSandbox = document.getElementById('shadow-sandbox');
      if (shadowSandbox && shadowSandbox.style.display !== 'none') {
        const toggleAutoFitFrustum = document.getElementById('panel-autofit-frustum') as HTMLInputElement | null;
        if (toggleAutoFitFrustum && toggleAutoFitFrustum.checked) {
          const sliderFrustum = document.getElementById('slider-shadow-frustum') as HTMLInputElement | null;
          const valFrustum = document.getElementById('val-shadow-frustum');
          if (sliderFrustum && valFrustum) {
            sliderFrustum.value = this.renderer.shadowSettings.frustumSize.toString();
            valFrustum.innerText = this.renderer.shadowSettings.frustumSize.toString();
          }
        }
      }

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
      this.renderer.onSimulationTick(prevTime, this.sim.timeOfDay);
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

    const industrialTiles = this.sim.tileCaches['industrial'] || [];
    for (const tile of industrialTiles) {
      if (tile.level > 0 && !tile.abandoned && tile.powered && tile.watered) {
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

  // Generate smoke particles dynamically for functioning residential buildings
  processResidentialSmoke() {
    if (this.sim.speed === 0) return;

    const residentialTiles = this.sim.tileCaches['residential'] || [];
    for (const tile of residentialTiles) {
      if (tile.level > 0 && !tile.abandoned && tile.powered && tile.watered) {
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
    let total = 0;
    let powered = 0;
    let watered = 0;

    for (const key in this.sim.tileCaches) {
      if (key !== 'empty' && key !== 'road') {
        const list = this.sim.tileCaches[key as TileType];
        if (list) {
          total += list.length;
          for (let i = 0; i < list.length; i++) {
            const tile = list[i];
            if (tile.powered) powered++;
            if (tile.watered) watered++;
          }
        }
      }
    }

    const powerEl = document.getElementById('status-power');
    if (powerEl) {
      const pct = total > 0 ? Math.round((powered / total) * 100) : 100;
      powerEl.innerText = `${pct}%`;
      powerEl.className = pct < 90 ? 'negative' : '';
    }

    const waterEl = document.getElementById('status-water');
    if (waterEl) {
      const pct = total > 0 ? Math.round((watered / total) * 100) : 100;
      waterEl.innerText = `${pct}%`;
      waterEl.className = pct < 90 ? 'negative' : '';
    }



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
                <span>${escapeHTML(c.profile.firstName)} ${escapeHTML(c.profile.lastName)}</span>
                <span style="color: #60a5fa; font-size: 0.8rem;">Age ${c.profile.age}</span>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 0.78rem; color: #94a3b8;">
                <span>Job: ${escapeHTML(c.profile.job)}</span>
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

  migrateSaveKeys() {
    try {
      const sereneSave = localStorage.getItem('serene_valley_save');
      const naboSave = localStorage.getItem('nabocity_save');
      if (sereneSave && !naboSave) {
        localStorage.setItem('nabocity_save', sereneSave);
        localStorage.removeItem('serene_valley_save');
        console.log('Migrated serene_valley_save to nabocity_save');
      } else if (sereneSave && naboSave) {
        localStorage.removeItem('serene_valley_save');
        console.log('Consolidated and removed duplicate serene_valley_save');
      }
    } catch (e) {
      console.error('Failed to migrate/consolidate legacy save keys:', e);
    }
  }

  loadGame() {
    this.sounds.playClickSFX();
    let saveData: string | null = null;
    try {
      saveData = localStorage.getItem('nabocity_save');
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
    this.renderer.clearAllBuildings();

    // 3. Load simulation state
    const success = this.sim.loadState(saveData);

    if (success) {
      this.renderer.resetInterpolation(this.sim.timeOfDay);
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
      this.renderer.resetInterpolation(8.0);
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
      this.renderer.clearAllBuildings();
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
