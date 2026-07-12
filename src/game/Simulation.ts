export type TileType =
  | 'empty'
  | 'road'
  | 'residential'
  | 'commercial'
  | 'industrial'
  | 'power'
  | 'water'
  | 'park';

export interface TileState {
  x: number;
  y: number;
  type: TileType;
  level: number;          // 0 (zoned), 1, 2, 3 (grown densities)
  progress: number;       // 0 to 100 (growth progression)
  powered: boolean;
  watered: boolean;
  occupancy: number;      // Residents or Workers
  maxOccupancy: number;
  happiness: number;      // 0 to 100
  abandoned: boolean;
}

export class Simulation {
  gridSize = 50;
  grid: TileState[][];
  money = 50000;
  taxRate = 0.12;         // 12% default
  population = 0;
  jobs = 0;
  employed = 0;
  overallHappiness = 100;

  // Demands scale from -100 to 100
  demandR = 50;
  demandC = 30;
  demandI = 20;

  dayCount = 1;
  timeOfDay = 8.0;        // Start at 8:00 AM
  speed = 1;              // 0 = paused, 1 = normal, 2 = fast

  // Metrics
  weeklyTaxes = 0;
  weeklyMaintenance = 0;
  weeklyNetIncome = 0;

  // Callbacks for events
  onNotification: (msg: string, type: 'success' | 'info' | 'warning' | 'danger') => void = () => {};
  onTileUpdate: (tile: TileState) => void = () => {};

  constructor() {
    this.grid = [];
    this.initializeGrid();
  }

  initializeGrid() {
    this.grid = [];
    for (let x = 0; x < this.gridSize; x++) {
      this.grid[x] = [];
      for (let y = 0; y < this.gridSize; y++) {
        this.grid[x][y] = {
          x,
          y,
          type: 'empty',
          level: 0,
          progress: 0,
          powered: false,
          watered: false,
          occupancy: 0,
          maxOccupancy: 0,
          happiness: 100,
          abandoned: false,
        };
      }
    }
  }

  setSpeed(s: number) {
    this.speed = Math.max(0, Math.min(3, s));
  }

  changeTaxRate(delta: number) {
    this.taxRate = Math.max(0.01, Math.min(0.25, parseFloat((this.taxRate + delta).toFixed(2))));
    this.onNotification(`Tax rate adjusted to ${Math.round(this.taxRate * 100)}%`, 'info');
  }

  // Cost to build structures
  getBuildCost(type: TileType): number {
    switch (type) {
      case 'road': return 10;
      case 'residential': return 20;
      case 'commercial': return 30;
      case 'industrial': return 40;
      case 'power': return 500;   // Wind Turbine
      case 'water': return 400;   // Water Tower
      case 'park': return 300;
      default: return 0;
    }
  }

  // Cost to demolish
  getDemolishCost(): number {
    return 5;
  }

  // Monthly/Weekly maintenance costs
  getMaintenanceCost(type: TileType, _level = 1): number {
    switch (type) {
      case 'road': return 1;
      case 'power': return 15;
      case 'water': return 12;
      case 'park': return 8;
      case 'residential': return 0;
      case 'commercial': return 0;
      case 'industrial': return 0;
      default: return 0;
    }
  }

  build(x: number, y: number, type: TileType): boolean {
    if (x < 0 || x >= this.gridSize || y < 0 || y >= this.gridSize) return false;
    const tile = this.grid[x][y];

    // Cannot build on top of existing non-empty without demolishing first
    if (tile.type !== 'empty') {
      return false;
    }

    const cost = this.getBuildCost(type);
    if (this.money < cost) {
      this.onNotification("Not enough money to build this!", "danger");
      return false;
    }

    this.money -= cost;
    tile.type = type;
    tile.level = 0;
    tile.progress = 0;
    tile.powered = false;
    tile.watered = false;
    tile.occupancy = 0;
    tile.maxOccupancy = 0;
    tile.happiness = 100;
    tile.abandoned = false;

    this.updateUtilities();
    this.onTileUpdate(tile);

    return true;
  }

  buildLine(cells: { x: number; y: number }[], type: TileType): boolean {
    const emptyCells = cells.filter(cell => {
      if (cell.x < 0 || cell.x >= this.gridSize || cell.y < 0 || cell.y >= this.gridSize) return false;
      return this.grid[cell.x][cell.y].type === 'empty';
    });
    if (emptyCells.length === 0) return false;

    const cost = emptyCells.length * this.getBuildCost(type);
    if (this.money < cost) {
      this.onNotification("Not enough money to build this!", "danger");
      return false;
    }

    this.money -= cost;
    for (const cell of emptyCells) {
      const tile = this.grid[cell.x][cell.y];
      tile.type = type;
      tile.level = 0;
      tile.progress = 0;
      tile.powered = false;
      tile.watered = false;
      tile.occupancy = 0;
      tile.maxOccupancy = 0;
      tile.happiness = 100;
      tile.abandoned = false;
    }

    this.updateUtilities();

    for (const cell of emptyCells) {
      this.onTileUpdate(this.grid[cell.x][cell.y]);
    }

    return true;
  }


  demolish(x: number, y: number): boolean {
    if (x < 0 || x >= this.gridSize || y < 0 || y >= this.gridSize) return false;
    const tile = this.grid[x][y];

    if (tile.type === 'empty') return false;

    const cost = this.getDemolishCost();
    if (this.money < cost) {
      this.onNotification("Not enough money to demolish!", "danger");
      return false;
    }

    this.money -= cost;
    tile.type = 'empty';
    tile.level = 0;
    tile.progress = 0;
    tile.powered = false;
    tile.watered = false;
    tile.occupancy = 0;
    tile.maxOccupancy = 0;
    tile.happiness = 100;
    tile.abandoned = false;

    this.updateUtilities();
    this.onTileUpdate(tile);
    return true;
  }

  // Update utilities propagation along the 100x100 grid
  updateUtilities() {
    // Store previous utility states before resetting
    const prevStates = this.grid.map(row => row.map(tile => ({
      powered: tile.powered,
      watered: tile.watered
    })));

    // Reset power and water for all cells
    for (let x = 0; x < this.gridSize; x++) {
      for (let y = 0; y < this.gridSize; y++) {
        this.grid[x][y].powered = false;
        this.grid[x][y].watered = false;
      }
    }

    const powerSources: TileState[] = [];
    const waterSources: TileState[] = [];

    // Find all turbines and water towers
    for (let x = 0; x < this.gridSize; x++) {
      for (let y = 0; y < this.gridSize; y++) {
        const tile = this.grid[x][y];
        if (tile.type === 'power') {
          tile.powered = true;
          powerSources.push(tile);
        } else if (tile.type === 'water') {
          tile.watered = true;
          waterSources.push(tile);
        }
      }
    }

    // BFS Queue propagation helper
    const propagate = (sources: TileState[], propKey: 'powered' | 'watered') => {
      const queue: TileState[] = [...sources];
      const visited = new Uint8Array(this.gridSize * this.gridSize);

      for (const s of sources) {
        visited[s.y * this.gridSize + s.x] = 1;
      }

      let head = 0;
      while (head < queue.length) {
        const curr = queue[head++];

        // Adjacency checking (4-way neighbors)
        const neighbors = [
          { x: curr.x + 1, y: curr.y },
          { x: curr.x - 1, y: curr.y },
          { x: curr.x, y: curr.y + 1 },
          { x: curr.x, y: curr.y - 1 }
        ];

        for (const n of neighbors) {
          if (n.x >= 0 && n.x < this.gridSize && n.y >= 0 && n.y < this.gridSize) {
            const index = n.y * this.gridSize + n.x;

            if (visited[index] === 0) {
              const neighborTile = this.grid[n.x][n.y];
              // Roads propagate power and water perfectly.
              // Other zoned structures also conduct power/water if they are constructed (level > 0)
              // empty tiles and parks do not conduct utilities.
              const conducts = neighborTile.type === 'road' || 
                               neighborTile.type === 'power' ||
                               neighborTile.type === 'water' ||
                               (neighborTile.type !== 'empty' && neighborTile.type !== 'park' && neighborTile.level > 0);

              if (conducts) {
                neighborTile[propKey] = true;
                visited[index] = 1;
                queue.push(neighborTile);
              } else if (neighborTile.type !== 'empty') {
                // If it's a zone that is adjacent but doesn't conduct itself (e.g. level 0),
                // it still receives power/water from the adjacent conduit.
                neighborTile[propKey] = true;
                visited[index] = 1;
              }
            }
          }
        }
      }
    };

    // Propagate both power and water
    propagate(powerSources, 'powered');
    propagate(waterSources, 'watered');

    // Notify updates only for tiles whose utility status actually changed
    for (let x = 0; x < this.gridSize; x++) {
      for (let y = 0; y < this.gridSize; y++) {
        const tile = this.grid[x][y];
        if (tile.type !== 'empty' && tile.type !== 'road') {
          const prev = prevStates[x][y];
          if (tile.powered !== prev.powered || tile.watered !== prev.watered) {
            this.onTileUpdate(tile);
          }
        }
      }
    }
  }

  // Simulation tick (called every 2 seconds by Game loop)
  tick() {
    if (this.speed === 0) return;

    // 1. Update Time & Days
    // Tick speed factors
    const hoursPerTick = 0.5 * this.speed;
    this.timeOfDay += hoursPerTick;
    if (this.timeOfDay >= 24) {
      this.timeOfDay = 0;
      this.dayCount++;
      // Weekly checks
      if (this.dayCount % 7 === 1) {
        this.processWeeklyEconomy();
      }
    }

    // 2. Perform Grid Simulation Ticks
    let totalRLevel = 0;
    let totalCLevel = 0;
    let totalILevel = 0;

    let localPop = 0;
    let localJobs = 0;
    let localComJobs = 0;
    let happySum = 0;
    let zonedCount = 0;

    // Loop through grid and update zone state
    for (let x = 0; x < this.gridSize; x++) {
      for (let y = 0; y < this.gridSize; y++) {
        const tile = this.grid[x][y];
        if (tile.type === 'empty' || tile.type === 'road' || tile.type === 'power' || tile.type === 'water') {
          continue;
        }

        zonedCount++;

        // Verify utilities
        const hasUtilities = tile.powered && tile.watered;

        if (!hasUtilities && tile.level > 0) {
          // Decay if no utilities
          tile.progress -= 5;
          if (tile.progress <= 0) {
            tile.progress = 70; // 70% progress buffer on downgrade for hysteresis stability
            tile.level = Math.max(0, tile.level - 1);
            if (tile.level === 0) {
              tile.abandoned = true;
              tile.occupancy = 0;
              this.onNotification(`A building at (${tile.x}, ${tile.y}) has been abandoned due to lack of utilities!`, 'warning');
            }
            this.onTileUpdate(tile);
          }
          tile.happiness = Math.max(10, tile.happiness - 10);
        } else if (hasUtilities) {
          tile.abandoned = false;
          // Apply zoning growth base rate
          let growthRate = 0;
          let demand = 0;

          if (tile.type === 'residential') {
            demand = this.demandR;
            growthRate = demand > 0 ? 4 : demand < -20 ? -4 : 0;
          } else if (tile.type === 'commercial') {
            demand = this.demandC;
            growthRate = demand > 0 ? 3 : demand < -20 ? -3 : 0;
          } else if (tile.type === 'industrial') {
            demand = this.demandI;
            growthRate = demand > 0 ? 3 : demand < -20 ? -3 : 0;
          } else if (tile.type === 'park') {
            growthRate = 0;
            tile.level = 1;
            tile.happiness = 100;
          }

          if (growthRate > 0 && tile.level < 3) {
            tile.progress += growthRate * this.speed;
            if (tile.progress >= 100) {
              tile.progress = 30; // 30% progress buffer on upgrade for hysteresis stability
              tile.level++;
              this.onTileUpdate(tile);
            }
          } else if (growthRate < 0 && tile.level > 0) {
            tile.progress += growthRate * this.speed;
            if (tile.progress <= 0) {
              tile.progress = 70; // 70% progress buffer on downgrade for hysteresis stability
              tile.level--;
              this.onTileUpdate(tile);
            }
          }

          // Update capacity/occupancy based on building level
          if (tile.level > 0) {
            tile.maxOccupancy = tile.level * 4; // Res: 4, 8, 12. Com: 4, 8, 12 workers.
            
            // Occupancy catches up to max occupancy gradually
            if (tile.occupancy < tile.maxOccupancy && demand > 0) {
              tile.occupancy += Math.min(this.speed, tile.maxOccupancy - tile.occupancy);
            } else if (demand < -20 && tile.occupancy > 0) {
              tile.occupancy -= Math.min(this.speed, tile.occupancy);
            }

            // Happiness increases with parks nearby
            const parkBonus = this.hasParkNearby(tile.x, tile.y) ? 15 : 0;
            const taxPenalty = this.taxRate > 0.15 ? -15 : this.taxRate < 0.08 ? 10 : 0;
            tile.happiness = Math.max(20, Math.min(100, 80 + parkBonus + taxPenalty));
          } else {
            tile.occupancy = 0;
            tile.maxOccupancy = 0;
          }
        }

        // Tally totals
        if (tile.type === 'residential') {
          totalRLevel += tile.level;
          localPop += tile.occupancy;
        } else if (tile.type === 'commercial') {
          totalCLevel += tile.level;
          localJobs += tile.occupancy;
          localComJobs += tile.occupancy;
        } else if (tile.type === 'industrial') {
          totalILevel += tile.level;
          localJobs += tile.occupancy;
        }

        happySum += tile.happiness;
      }
    }

    this.population = localPop;
    this.jobs = localJobs;
    this.overallHappiness = zonedCount > 0 ? Math.round(happySum / zonedCount) : 100;

    // 3. Update Demand Indices
    // Residential demand: driven by vacant jobs (jobs > pop) and overall happiness
    const jobMarketR = this.jobs - this.population;
    const targetR = Math.max(-100, Math.min(100, Math.round(jobMarketR * 1.5 + (this.overallHappiness - 70) * 0.5)));
    this.demandR = Math.round(this.demandR * 0.7 + targetR * 0.3);

    // Commercial demand: driven by population (customers) and job supply
    const comRatio = this.population > 0 ? localComJobs / this.population : 0.5;
    const targetC = Math.max(-100, Math.min(100, Math.round((0.15 - comRatio) * 200 + (this.overallHappiness - 50) * 0.2)));
    this.demandC = Math.round(this.demandC * 0.7 + targetC * 0.3);

    // Industrial demand: driven by unemployment (pop > jobs) and low tax rates
    const laborSupply = this.population - this.jobs;
    const targetI = Math.max(-100, Math.min(100, Math.round(laborSupply * 1.0 + (0.15 - this.taxRate) * 300)));
    this.demandI = Math.round(this.demandI * 0.7 + targetI * 0.3);
  }

  // Search adjacent tiles (5-tile radius) for parks
  hasParkNearby(x: number, y: number): boolean {
    const radius = 5;
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && nx < this.gridSize && ny >= 0 && ny < this.gridSize) {
          if (this.grid[nx][ny].type === 'park') return true;
        }
      }
    }
    return false;
  }

  // Weekly economic report process
  processWeeklyEconomy() {
    let maintenanceTotal = 0;
    let taxesCollected = 0;

    for (let x = 0; x < this.gridSize; x++) {
      for (let y = 0; y < this.gridSize; y++) {
        const tile = this.grid[x][y];
        if (tile.type === 'empty') continue;

        // Add maintenance fees
        maintenanceTotal += this.getMaintenanceCost(tile.type, tile.level);

        // Add tax revenue
        if (tile.level > 0 && !tile.abandoned) {
          if (tile.type === 'residential') {
            // $10 base tax per resident per week adjusted by taxRate & happiness
            taxesCollected += Math.round(tile.occupancy * 10 * (this.taxRate / 0.12) * (tile.happiness / 100));
          } else if (tile.type === 'commercial') {
            taxesCollected += Math.round(tile.occupancy * 15 * (this.taxRate / 0.12) * (tile.happiness / 100));
          } else if (tile.type === 'industrial') {
            taxesCollected += Math.round(tile.occupancy * 12 * (this.taxRate / 0.12) * (tile.happiness / 100));
          }
        }
      }
    }

    this.weeklyTaxes = taxesCollected;
    this.weeklyMaintenance = maintenanceTotal;
    this.weeklyNetIncome = taxesCollected - maintenanceTotal;

    this.money += this.weeklyNetIncome;

    if (this.weeklyNetIncome >= 0) {
      this.onNotification(`Weekly Financial Report: Net Profit +$${this.weeklyNetIncome}!`, 'success');
    } else {
      this.onNotification(`Weekly Financial Report: Net Deficit -$${Math.abs(this.weeklyNetIncome)}!`, 'danger');
    }
  }

  saveState(): string {
    const state = {
      money: this.money,
      taxRate: this.taxRate,
      population: this.population,
      jobs: this.jobs,
      employed: this.employed,
      overallHappiness: this.overallHappiness,
      demandR: this.demandR,
      demandC: this.demandC,
      demandI: this.demandI,
      dayCount: this.dayCount,
      timeOfDay: this.timeOfDay,
      grid: this.grid.map(row => row.map(tile => ({
        x: tile.x,
        y: tile.y,
        type: tile.type,
        level: tile.level,
        progress: tile.progress,
        occupancy: tile.occupancy,
        maxOccupancy: tile.maxOccupancy,
        happiness: tile.happiness,
        abandoned: tile.abandoned,
      }))),
    };
    return JSON.stringify(state);
  }

  loadState(jsonString: string): boolean {
    try {
      const state = JSON.parse(jsonString);
      if (!state || !state.grid) return false;

      this.money = state.money;
      this.taxRate = state.taxRate;
      this.population = state.population;
      this.jobs = state.jobs;
      this.employed = state.employed;
      this.overallHappiness = state.overallHappiness;
      this.demandR = state.demandR;
      this.demandC = state.demandC;
      this.demandI = state.demandI;
      this.dayCount = state.dayCount;
      this.timeOfDay = state.timeOfDay;

      for (let x = 0; x < this.gridSize; x++) {
        for (let y = 0; y < this.gridSize; y++) {
          const loadedTile = state.grid[x][y];
          const tile = this.grid[x][y];

          tile.type = loadedTile.type;
          tile.level = loadedTile.level;
          tile.progress = loadedTile.progress;
          tile.powered = false;
          tile.watered = false;
          tile.occupancy = loadedTile.occupancy;
          tile.maxOccupancy = loadedTile.maxOccupancy;
          tile.happiness = loadedTile.happiness;
          tile.abandoned = loadedTile.abandoned || false;
        }
      }

      this.updateUtilities();
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  }
}
