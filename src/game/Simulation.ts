export type TileType =
  | 'empty'
  | 'road'
  | 'residential'
  | 'commercial'
  | 'industrial'
  | 'power'
  | 'water'
  | 'park'
  | 'water_body'
  | 'boardwalk';

import type { PlaceArchetype, PlaceTag } from './PlaceCatalog';
import { getPlace } from './PlaceCatalog';

export const CURRENT_SAVE_VERSION = 7;
export const CONSTRUCTION_TICKS = 12;

// A shared garden must be within eight pedestrian-grid tiles of its owner's home.
export const SHARED_GARDEN_RADIUS = 8;

export interface TilePosition {
  x: number;
  y: number;
}

export type HouseholdStatus = 'settled' | 'arriving' | 'unhoused';

export type RoutineActivity = 'home' | 'work' | 'garden' | 'park' | 'boardwalk';

export interface RoutineBlock {
  activity: RoutineActivity;
  startHour: number;
  endHour: number;
}

export interface ResidentState {
  id: string;
  householdId: string;
  firstName: string;
  lastName: string;
  age: number;
  occupation: string;
  home: TilePosition | null;
  appearanceSeed: number;
  routine: RoutineBlock[];
  workplacePlaceId?: string;
}

export interface HouseholdState {
  id: string;
  surname: string;
  residentIds: string[];
  home: TilePosition | null;
  status: HouseholdStatus;
  arrivalDay: number;
  matchSnapshot?: { placeId: string; acceptedDay: number; matchedFactors: string[]; softConflicts: string[] };
}

export interface HouseholdApplicationMember {
  firstName: string;
  age: number;
  occupation: string;
  appearanceSeed: number;
  authoredRole?: 'shared_garden_requester';
}

export interface HouseholdApplication {
  id: string;
  source?: 'guaranteed_shortlist' | 'interest';
  shortlistId?: string;
  surname: string;
  introduction: string;
  reasonForMoving: string;
  members: readonly HouseholdApplicationMember[];
  physicalRequirements?: string[];
  lifestyleRequirements?: string[];
  preferences?: PlaceTag[];
  contributionTags?: PlaceTag[];
  createdDay?: number;
  expiresDay?: number;
  status?: 'available' | 'deferred';
  deferredUntilDay?: number;
  suggestedHomePlaceId?: string;
  fitSummary?: string;
}

export interface PopularityState {
  score: number;
  reputation: number;
  momentum: number;
  applicationInterest: number;
  lastApplicationDay: number;
  guaranteedShortlistExpiresDay?: number;
}

export interface HomeCompatibility {
  placeId: string;
  position: TilePosition;
  score: number;
  matchedFactors: string[];
  softConflicts: string[];
}

export const APPLICATION_INTEREST_THRESHOLD = 100;
export const MIN_APPLICATION_INTERVAL_DAYS = 3;
export const APPLICATION_EXPIRY_DAYS = 14;

export interface MemoryState {
  id: string;
  type: 'arrival' | 'hope_fulfilled';
  day: number;
  title: string;
  description: string;
  residentIds: string[];
  householdIds: string[];
  tile?: TilePosition;
}

export type HopeStatus = 'active' | 'fulfilled';

export interface HopeState {
  id: string;
  type: 'shared_garden';
  ownerResidentId: string;
  householdId: string;
  status: HopeStatus;
  createdDay: number;
  fulfilledDay?: number;
  targetTile?: TilePosition;
  // The placement sequence prevents parks built before the request, including on
  // the same simulation day, from satisfying it.
  createdPlacementSequence: number;
}

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
  householdId?: string;  // Only valid for developed residential tiles
  bridge?: boolean;       // Indicates road is built over water
  elevation: number;      // Height level (0 to 4)
  placedSequence: number; // 0 for pre-v5 tiles; increments for each later placement
  // A place keeps its identity even if its presentation uses an old RCI tile type.
  placeId?: string;
  name?: string;
  archetype?: PlaceArchetype;
  tags?: PlaceTag[];
  constructionStatus?: 'planned' | 'building' | 'complete';
  constructionProgress?: number;
  constructionBlockers?: string[];
  constructionCost?: number;
  reopening?: boolean;
  residentCapacity?: number;
  reservedHouseholdId?: string;
  founderResidentId?: string;
  workerIds?: string[];
  workerCapacity?: number;
  operatingStatus?: 'opening' | 'open' | 'struggling' | 'closed';
  viability?: number;
  strugglingSinceDay?: number;
}

export class Simulation {
  seed: number;
  gridSize = 50;
  grid: TileState[][];
  money = 30000;
  taxRate = 0.12;         // 12% default
  population = 0;
  jobs = 0;
  employed = 0;
  overallHappiness = 100;

  // Persistent household data. This deliberately remains separate from aggregate occupancy.
  residents: ResidentState[] = [];
  households: HouseholdState[] = [];
  nextResidentId = 1;
  nextHouseholdId = 1;
  memories: MemoryState[] = [];
  nextMemoryId = 1;
  hopes: HopeState[] = [];
  nextHopeId = 1;
  nextPlacementSequence = 1;
  nextPlaceId = 1;
  applications: HouseholdApplication[] = [];
  nextApplicationId = 1;
  popularity: PopularityState = { score: 50, reputation: 50, momentum: 50, applicationInterest: 0, lastApplicationDay: 1 };
  picnicStatus: 'not_started' | 'gathering' | 'complete' | 'cancelled' = 'not_started';

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

  tileCaches: { [key in TileType]?: TileState[] } = {};

  rebuildTileTypeCaches() {
    const newCaches: { [key in TileType]?: TileState[] } = {
      empty: [],
      road: [],
      residential: [],
      commercial: [],
      industrial: [],
      power: [],
      water: [],
      park: [],
      water_body: [],
      boardwalk: []
    };
    for (let x = 0; x < this.gridSize; x++) {
      for (let y = 0; y < this.gridSize; y++) {
        const tile = this.grid[x][y];
        if (newCaches[tile.type]) {
          newCaches[tile.type]!.push(tile);
        }
      }
    }
    this.tileCaches = newCaches;
  }

  constructor() {
    this.seed = Math.floor(Math.random() * 1000000);
    this.grid = [];
    this.initializeGrid();
    this.initializeApplications();
  }

  initializeGrid() {
    this.grid = [];
    for (let x = 0; x < this.gridSize; x++) {
      this.grid[x] = [];
      for (let y = 0; y < this.gridSize; y++) {
        // Seeded procedural rolling hills generator (multi-octave sine waves)
        const nx = x / this.gridSize;
        const ny = y / this.gridSize;
        
        // Sum 3 octaves of sine waves with seed offset
        const s1 = Math.sin(nx * 2.5 * Math.PI + this.seed * 0.001) * Math.cos(ny * 2.5 * Math.PI - this.seed * 0.002);
        const s2 = Math.sin(nx * 6.0 * Math.PI + this.seed * 0.003) * Math.cos(ny * 6.0 * Math.PI + this.seed * 0.001) * 0.45;
        const s3 = Math.sin(nx * 12.0 * Math.PI) * Math.cos(ny * 12.0 * Math.PI) * 0.15;
        
        const total = s1 + s2 + s3;
        
        // Map total to elevation levels (0 to 3)
        let elevation = Math.floor((total + 1.25) * 1.4);
        elevation = Math.max(0, Math.min(3, elevation));

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
          elevation,
          placedSequence: 0,
        };
      }
    }
    this.rebuildTileTypeCaches();
  }

  private static readonly FIRST_NAMES = ['Alex', 'Casey', 'Jordan', 'Morgan', 'Riley', 'Sam'];
  private static readonly SURNAMES = ['Bennett', 'Carter', 'Diaz', 'Kim', 'Patel', 'Walker'];
  private static readonly OCCUPATIONS = ['Teacher', 'Designer', 'Technician', 'Cook', 'Student', 'Retired'];
  getResident(id: string): ResidentState | undefined {
    return this.residents.find(resident => resident.id === id);
  }

  getHousehold(id: string): HouseholdState | undefined {
    return this.households.find(household => household.id === id);
  }

  getAvailableApplications(): readonly HouseholdApplication[] {
    return this.applications.filter(application => application.status !== 'deferred' || (application.deferredUntilDay ?? 0) <= this.dayCount);
  }

  getActiveApplications(): readonly HouseholdApplication[] {
    return this.applications;
  }

  initializeApplications() {
    this.applications = Array.from({ length: 3 }, (_, index) => {
      const application = this.generateApplication();
      application.source = 'guaranteed_shortlist';
      application.shortlistId = 'first-neighbors';
      application.expiresDay = undefined;
      application.preferences = index === 0 ? ['quiet'] : index === 1 ? ['family'] : ['garden', 'nature'];
      if (index === 2 && application.members[0]) application.members[0].authoredRole = 'shared_garden_requester';
      return application;
    });
    this.popularity.lastApplicationDay = this.dayCount;
  }

  private generateApplication(): HouseholdApplication {
    const seed = this.deterministicValue(this.nextApplicationId * 19 + this.dayCount);
    const size = 1 + (seed % 4);
    const members = Array.from({ length: size }, (_, index) => {
      const memberSeed = this.deterministicValue(seed + index + 1);
      const age = index === size - 1 && size > 2 ? 10 + memberSeed % 8 : 23 + memberSeed % 45;
      return {
        firstName: Simulation.FIRST_NAMES[memberSeed % Simulation.FIRST_NAMES.length],
        age,
        occupation: age < 16 ? 'Student' : Simulation.OCCUPATIONS[memberSeed % Simulation.OCCUPATIONS.length],
        appearanceSeed: memberSeed,
      };
    });
    const surname = Simulation.SURNAMES[seed % Simulation.SURNAMES.length];
    return { id: `application-${this.nextApplicationId++}`, source: 'interest', surname, introduction: `The ${surname} household is looking for a place to contribute.`, reasonForMoving: 'They heard this neighborhood is taking shape with care.', members, physicalRequirements: [`capacity_${size}`, 'utilities', 'access'], lifestyleRequirements: [], preferences: seed % 2 ? ['nature'] : ['food'], contributionTags: seed % 2 ? ['craft'] : ['food'], createdDay: this.dayCount, expiresDay: this.dayCount + APPLICATION_EXPIRY_DAYS, status: 'available' };
  }

  getCompatibleHomes(application: HouseholdApplication): HomeCompatibility[] {
    const homes = this.grid.flat().filter(tile => tile.type === 'residential' && tile.constructionStatus === 'complete' && !tile.abandoned && !tile.householdId && !tile.reservedHouseholdId);
    return homes.flatMap(home => {
      const reasons: string[] = [];
      if ((home.residentCapacity ?? 0) < application.members.length) return [];
      if (!home.powered || !home.watered) return [];
      if (!this.hasRoadAccess(home)) return [];
      reasons.push(`Fits ${application.members.length} neighbors`, 'Utilities and access ready');
      let score = 50;
      const softConflicts: string[] = [];
      for (const tag of application.preferences ?? []) {
        if (home.tags?.includes(tag) || this.grid.flat().some(tile => tile.constructionStatus === 'complete' && tile.tags?.includes(tag) && Math.abs(tile.x - home.x) + Math.abs(tile.y - home.y) <= 8)) {
          score += 15; reasons.push(`Matches ${tag} preference`);
        } else { softConflicts.push(`Would like more ${tag} nearby`); }
      }
      return [{ placeId: home.placeId!, position: { x: home.x, y: home.y }, score, matchedFactors: reasons, softConflicts }];
    }).sort((a, b) => b.score - a.score || a.placeId.localeCompare(b.placeId));
  }

  /** The actionable reasons a completed home cannot currently receive a household. */
  getHomeReadinessIssues(tile: TileState): string[] {
    const issues: string[] = [];
    if (tile.type !== 'residential' || tile.constructionStatus !== 'complete') issues.push('Finish construction first');
    if (tile.abandoned) issues.push('Restore this home first');
    if (tile.householdId || tile.reservedHouseholdId) issues.push('This home is already assigned');
    if (!tile.powered) issues.push('Connect power');
    if (!tile.watered) issues.push('Connect water');
    if (!this.hasRoadAccess(tile)) issues.push('Connect a road route to the map edge');
    return issues;
  }

  /** Explains why a particular application may or may not be welcomed into a home. */
  getApplicationCompatibilityIssues(application: HouseholdApplication, tile: TileState): string[] {
    const issues = this.getHomeReadinessIssues(tile);
    if ((tile.residentCapacity ?? 0) < application.members.length) {
      issues.unshift(`Needs room for ${application.members.length} neighbors; this home fits ${tile.residentCapacity ?? 0}`);
    }
    return issues;
  }

  deferApplication(id: string): boolean {
    const application = this.applications.find(candidate => candidate.id === id);
    if (!application) return false;
    application.status = 'deferred';
    application.deferredUntilDay = this.dayCount + 3;
    return true;
  }

  private updateApplicationsForDay() {
    for (const application of this.applications) if (application.status === 'deferred' && (application.deferredUntilDay ?? 0) <= this.dayCount) application.status = 'available';
    this.applications = this.applications.filter(application => !application.expiresDay || application.expiresDay >= this.dayCount);
    const shortlist = this.applications.filter(application => application.source === 'guaranteed_shortlist');
    if (!this.popularity.guaranteedShortlistExpiresDay && shortlist.some(application => this.getCompatibleHomes(application).length > 0)) {
      const deadline = this.dayCount + APPLICATION_EXPIRY_DAYS;
      this.popularity.guaranteedShortlistExpiresDay = deadline;
      shortlist.forEach(application => { application.expiresDay = deadline; });
    }
    this.popularity.score = Math.round(this.popularity.reputation * .6 + this.popularity.momentum * .4);
    this.popularity.applicationInterest = Math.min(APPLICATION_INTEREST_THRESHOLD * 2, this.popularity.applicationInterest + 8 + this.popularity.score * .12);
    if (this.applications.length < 5 && this.popularity.applicationInterest >= APPLICATION_INTEREST_THRESHOLD && this.dayCount - this.popularity.lastApplicationDay >= MIN_APPLICATION_INTERVAL_DAYS) {
      this.applications.push(this.generateApplication());
      this.popularity.applicationInterest -= APPLICATION_INTEREST_THRESHOLD;
      this.popularity.lastApplicationDay = this.dayCount;
      this.onNotification('A new household application has arrived.', 'success');
    }
  }

  private updateGardenPicnic() {
    if (this.picnicStatus !== 'not_started') return;
    const garden = this.grid.flat().find(tile => tile.archetype === 'community_garden' && tile.constructionStatus === 'complete');
    const households = this.households.filter(household => household.status === 'settled' && household.home && garden && this.isSharedGardenTargetReachable(household.home, garden));
    if (!garden || households.length < 2) return;
    this.picnicStatus = 'gathering';
    this.onNotification(`Garden picnic gathering at ${garden.name}.`, 'info');
    this.picnicStatus = 'complete';
    this.popularity.applicationInterest = Math.min(APPLICATION_INTEREST_THRESHOLD * 2, this.popularity.applicationInterest + 25);
    this.popularity.reputation = Math.min(100, this.popularity.reputation + 4);
    this.memories.push({ id: `memory-${this.nextMemoryId++}`, type: 'hope_fulfilled', day: this.dayCount, title: 'Garden picnic', description: `Neighbors gathered at ${garden.name}.`, residentIds: households.flatMap(h => h.residentIds), householdIds: households.map(h => h.id), tile: { x: garden.x, y: garden.y } });
    this.onNotification(`The garden picnic was a success at ${garden.name}.`, 'success');
  }

  resetResidentData() {
    this.residents = [];
    this.households = [];
    this.nextResidentId = 1;
    this.nextHouseholdId = 1;
    this.memories = [];
    this.nextMemoryId = 1;
    this.hopes = [];
    this.nextHopeId = 1;
    this.nextPlacementSequence = 1;
    for (const row of this.grid) {
      for (const tile of row) delete tile.householdId;
    }
  }

  private positionIsValid(position: TilePosition | null): boolean {
    return position === null || (Number.isInteger(position.x) && Number.isInteger(position.y)
      && position.x >= 0 && position.x < this.gridSize && position.y >= 0 && position.y < this.gridSize);
  }

  private unhousehold(household: HouseholdState) {
    household.status = 'unhoused';
    household.home = null;
    for (const residentId of household.residentIds) {
      const resident = this.getResident(residentId);
      if (resident) resident.home = null;
    }
  }

  clearHouseholdHome(householdId: string) {
    const household = this.getHousehold(householdId);
    if (!household) return;
    if (household.home && this.positionIsValid(household.home)) {
      const tile = this.grid[household.home.x][household.home.y];
      if (tile.householdId === householdId) delete tile.householdId;
    }
    this.unhousehold(household);
  }

  private deterministicValue(salt: number): number {
    const value = Math.sin(this.seed * 12.9898 + salt * 78.233) * 43758.5453;
    return Math.floor((value - Math.floor(value)) * 0x7fffffff);
  }

  private defaultRoutine(appearanceSeed: number): RoutineBlock[] {
    // This only depends on persistent appearance data, so new and migrated residents
    // receive the same routine without relying on runtime random state.
    const morningActivity: RoutineActivity = appearanceSeed % 2 === 0 ? 'garden' : 'park';
    const afternoonActivity: RoutineActivity = appearanceSeed % 3 === 0 ? 'boardwalk' : (morningActivity === 'garden' ? 'park' : 'garden');
    return [
      { activity: 'home', startHour: 0, endHour: 7 },
      { activity: morningActivity, startHour: 7, endHour: 10 },
      { activity: 'work', startHour: 10, endHour: 16 },
      { activity: afternoonActivity, startHour: 16, endHour: 19 },
      { activity: 'home', startHour: 19, endHour: 24 },
    ];
  }

  private isValidRoutine(value: unknown): value is RoutineBlock[] {
    if (!Array.isArray(value) || value.length === 0) return false;
    return value.every(block => {
      if (!block || typeof block !== 'object') return false;
      const routineBlock = block as RoutineBlock;
      return (routineBlock.activity === 'home' || routineBlock.activity === 'work' || routineBlock.activity === 'garden'
        || routineBlock.activity === 'park' || routineBlock.activity === 'boardwalk')
        && Number.isFinite(routineBlock.startHour) && routineBlock.startHour >= 0 && routineBlock.startHour <= 24
        && Number.isFinite(routineBlock.endHour) && routineBlock.endHour >= 0 && routineBlock.endHour <= 24
        && routineBlock.startHour !== routineBlock.endHour
        && (routineBlock.endHour - routineBlock.startHour > 0
          ? routineBlock.endHour - routineBlock.startHour
          : routineBlock.endHour - routineBlock.startHour + 24) > 0;
    });
  }

  createHousehold(memberCount: number, home: TilePosition | null = null, deterministicSalt?: number): HouseholdState {
    const requestedCount = Number.isFinite(memberCount) ? Math.floor(memberCount) : 1;
    const count = Math.max(1, Math.min(4, requestedCount));
    const salt = deterministicSalt ?? Math.floor(Math.random() * 0x7fffffff);
    const surname = Simulation.SURNAMES[this.deterministicValue(salt) % Simulation.SURNAMES.length];
    const household: HouseholdState = {
      id: `household-${this.nextHouseholdId++}`,
      surname,
      residentIds: [],
      home: null,
      status: 'unhoused',
      arrivalDay: this.dayCount,
    };
    this.households.push(household);
    for (let index = 0; index < count; index++) {
      const value = this.deterministicValue(salt + index + 1);
      const resident: ResidentState = {
        id: `resident-${this.nextResidentId++}`,
        householdId: household.id,
        firstName: Simulation.FIRST_NAMES[value % Simulation.FIRST_NAMES.length],
        lastName: surname,
        age: 18 + (value % 63),
        occupation: Simulation.OCCUPATIONS[Math.floor(value / 7) % Simulation.OCCUPATIONS.length],
        home: null,
        appearanceSeed: value,
        routine: this.defaultRoutine(value),
      };
      household.residentIds.push(resident.id);
      this.residents.push(resident);
    }
    if (home) this.settleHousehold(household, home);
    return household;
  }

  private settleHousehold(household: HouseholdState, home: TilePosition) {
    if (!this.positionIsValid(home)) return false;
    const tile = this.grid[home.x][home.y];
    if (tile.type !== 'residential' || tile.constructionStatus !== 'complete' || tile.abandoned || (tile.householdId && tile.householdId !== household.id)) return false;
    household.home = { x: home.x, y: home.y };
    household.status = 'settled';
    tile.householdId = household.id;
    for (const residentId of household.residentIds) {
      const resident = this.getResident(residentId);
      if (resident) resident.home = { x: home.x, y: home.y };
    }
    return true;
  }

  private clearTileHousehold(tile: TileState) {
    if (tile.householdId) this.clearHouseholdHome(tile.householdId);
    if (tile.reservedHouseholdId) {
      const household = this.getHousehold(tile.reservedHouseholdId);
      if (household) this.unhousehold(household);
    }
    delete tile.householdId;
    delete tile.reservedHouseholdId;
  }

  getActiveHopes(): readonly HopeState[] {
    return this.hopes.filter(hope => hope.status === 'active');
  }

  getHopeForResident(residentId: string): HopeState | undefined {
    return this.hopes.find(hope => hope.ownerResidentId === residentId);
  }

  getGardenName(hope: HopeState): string {
    return `${this.getHousehold(hope.householdId)?.surname ?? 'Neighborhood'} Community Garden`;
  }

  private createSharedGardenHope(owner: ResidentState, household: HouseholdState) {
    // This first authored hope is globally unique, even if an application is later reused.
    if (this.hopes.some(hope => hope.type === 'shared_garden') || this.getHopeForResident(owner.id)) return;
    this.hopes.push({
      id: `hope-${this.nextHopeId++}`,
      type: 'shared_garden',
      ownerResidentId: owner.id,
      householdId: household.id,
      status: 'active',
      createdDay: this.dayCount,
      createdPlacementSequence: this.nextPlacementSequence - 1,
    });
  }

  private recordArrival(household: HouseholdState) {
    const residentIds = [...household.residentIds];
    this.memories.push({
      id: `memory-${this.nextMemoryId++}`,
      type: 'arrival',
      day: this.dayCount,
      title: `Welcome, ${household.surname} household!`,
      description: `The ${household.surname} household settled at (${household.home!.x}, ${household.home!.y}).`,
      residentIds,
      householdIds: [household.id],
    });
  }

  inviteHousehold(applicationId: string, home: TilePosition): HouseholdState | null {
    const application = this.applications.find(candidate => candidate.id === applicationId);
    if (!application || application.status !== 'available' || !this.positionIsValid(home)) return null;
    const tile = this.grid[home.x][home.y];
    if (tile.type !== 'residential' || tile.constructionStatus !== 'complete' || tile.abandoned || tile.householdId || tile.reservedHouseholdId || !tile.powered || !tile.watered
      || application.members.length > (tile.residentCapacity ?? 0)) return null;
    if (!this.getCompatibleHomes(application).some(candidate => candidate.placeId === tile.placeId)) return null;

    const household: HouseholdState = {
      id: `household-${this.nextHouseholdId++}`,
      surname: application.surname,
      residentIds: [],
      home: { x: home.x, y: home.y },
      status: 'arriving',
      arrivalDay: this.dayCount,
      matchSnapshot: (() => { const fit = this.getCompatibleHomes(application).find(candidate => candidate.placeId === tile.placeId); return fit ? { placeId: fit.placeId, acceptedDay: this.dayCount, matchedFactors: fit.matchedFactors, softConflicts: fit.softConflicts } : undefined; })(),
    };
    const residents: ResidentState[] = application.members.map(member => ({
      id: `resident-${this.nextResidentId++}`,
      householdId: household.id,
      firstName: member.firstName,
      lastName: application.surname,
      age: member.age,
      occupation: member.occupation,
      home: { x: home.x, y: home.y },
      appearanceSeed: member.appearanceSeed,
      routine: this.defaultRoutine(member.appearanceSeed),
    }));
    household.residentIds = residents.map(resident => resident.id);
    this.households.push(household);
    this.residents.push(...residents);
    tile.reservedHouseholdId = household.id;
    this.applications = this.applications.filter(candidate => candidate.id !== applicationId);
    for (let index = 0; index < application.members.length; index++) {
      if (application.members[index].authoredRole === 'shared_garden_requester') {
        this.createSharedGardenHope(residents[index], household);
      }
    }
    this.onTileUpdate(tile);
    return household;
  }

  completeHouseholdArrival(householdId: string): boolean {
    const household = this.getHousehold(householdId);
    if (!household || household.status !== 'arriving' || !household.home) return false;
    const tile = this.grid[household.home.x][household.home.y];
    if (tile.reservedHouseholdId !== household.id || !this.hasRoadAccess(tile)) return false;
    tile.reservedHouseholdId = undefined;
    tile.householdId = household.id;
    household.status = 'settled';
    this.recordArrival(household);
    this.recalculateAuthoritativeTotals();
    this.onTileUpdate(tile);
    return true;
  }

  private isSharedGardenTargetReachable(home: TilePosition, target: TilePosition): boolean {
    const queue: TilePosition[] = [{ ...home }];
    const visited = new Uint8Array(this.gridSize * this.gridSize);
    visited[home.y * this.gridSize + home.x] = 1;
    let head = 0;
    while (head < queue.length) {
      const current = queue[head++];
      if (current.x === target.x && current.y === target.y) return true;
      for (const next of [{ x: current.x + 1, y: current.y }, { x: current.x - 1, y: current.y }, { x: current.x, y: current.y + 1 }, { x: current.x, y: current.y - 1 }]) {
        if (next.x < 0 || next.x >= this.gridSize || next.y < 0 || next.y >= this.gridSize) continue;
        const index = next.y * this.gridSize + next.x;
        if (visited[index]) continue;
        const tile = this.grid[next.x][next.y];
        if (next.x !== target.x || next.y !== target.y) {
          if (tile.type !== 'road' && tile.type !== 'boardwalk' && tile.type !== 'park') continue;
        }
        visited[index] = 1;
        queue.push(next);
      }
    }
    return false;
  }

  evaluateSharedGardenHopes() {
    for (const hope of this.hopes) {
      if (hope.status !== 'active') continue;
      const owner = this.getResident(hope.ownerResidentId);
      const household = this.getHousehold(hope.householdId);
      if (!owner || !household || owner.householdId !== household.id || !owner.home || household.status !== 'settled') continue;
      const target = this.tileCaches.park?.find(tile => tile.archetype === 'community_garden' && tile.constructionStatus === 'complete' && tile.placedSequence > hope.createdPlacementSequence
        && !tile.abandoned
        && Math.abs(tile.x - owner.home!.x) + Math.abs(tile.y - owner.home!.y) <= SHARED_GARDEN_RADIUS
        && this.isSharedGardenTargetReachable(owner.home!, tile));
      if (!target) continue;
      hope.status = 'fulfilled';
      hope.fulfilledDay = this.dayCount;
      hope.targetTile = { x: target.x, y: target.y };
      this.memories.push({
        id: `memory-${this.nextMemoryId++}`,
        type: 'hope_fulfilled',
        day: this.dayCount,
        title: `${this.getGardenName(hope)} opened`,
        description: `${owner.firstName} ${owner.lastName}'s shared-garden hope was fulfilled at (${target.x}, ${target.y}).`,
        residentIds: [owner.id],
        householdIds: [household.id],
        tile: { x: target.x, y: target.y },
      });
      this.onNotification(`${this.getGardenName(hope)} is ready for the neighborhood!`, 'success');
      this.popularity.reputation = Math.min(100, this.popularity.reputation + 5);
      this.popularity.momentum = Math.min(100, this.popularity.momentum + 8);
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
      case 'water_body': return 10;
      case 'boardwalk': return 10;
      default: return 0;
    }
  }

  getBuildCostForArchetype(archetype: PlaceArchetype): number {
    return getPlace(archetype).cost;
  }

  private defaultArchetypeFor(type: TileType): PlaceArchetype | undefined {
    if (type === 'residential') return 'cozy_cottage';
    if (type === 'commercial') return 'bakery';
    if (type === 'industrial') return 'pottery_workshop';
    if (type === 'park') return 'community_park';
    return undefined;
  }

  private placeName(archetype: PlaceArchetype): string {
    const place = getPlace(archetype);
    return `${place.nameWords[0]} ${place.nameWords[1]}`;
  }

  buildPlace(x: number, y: number, archetype: PlaceArchetype, founderResidentId?: string): boolean {
    if (x < 0 || x >= this.gridSize || y < 0 || y >= this.gridSize) return false;
    const tile = this.grid[x][y];
    const place = getPlace(archetype);
    if (tile.type !== 'empty' || this.money < place.cost) return false;
    this.money -= place.cost;
    tile.type = place.tileType;
    tile.level = place.meshLevel;
    tile.progress = 0;
    tile.occupancy = 0;
    tile.maxOccupancy = place.residentCapacity ?? place.workerCapacity ?? 0;
    tile.happiness = 100;
    tile.abandoned = false;
    tile.bridge = false;
    tile.placedSequence = this.nextPlacementSequence++;
    tile.placeId = `place-${this.nextPlaceId++}`;
    tile.name = this.placeName(archetype);
    tile.archetype = archetype;
    tile.tags = [...place.tags];
    tile.constructionStatus = 'planned';
    tile.constructionProgress = 0;
    tile.constructionBlockers = [];
    tile.constructionCost = place.cost;
    tile.reopening = false;
    tile.residentCapacity = place.residentCapacity;
    tile.reservedHouseholdId = undefined;
    tile.householdId = undefined;
    tile.founderResidentId = founderResidentId;
    tile.workerIds = [];
    tile.workerCapacity = place.workerCapacity;
    tile.operatingStatus = place.workerCapacity ? 'opening' : undefined;
    tile.viability = place.workerCapacity ? 0 : undefined;
    tile.strugglingSinceDay = undefined;
    this.updateUtilities();
    this.onTileUpdate(tile);
    return true;
  }

  renamePlace(placeId: string, name: string): boolean {
    const tile = this.findPlace(placeId);
    if (!tile || !name.trim()) return false;
    tile.name = name.trim().slice(0, 48);
    this.onTileUpdate(tile);
    return true;
  }

  findPlace(placeId: string): TileState | undefined {
    return this.grid.flat().find(tile => tile.placeId === placeId);
  }

  isHomeReadyForMatching(tile: TileState): boolean {
    return this.getHomeReadinessIssues(tile).length === 0;
  }

  /** The infrastructure that must be available before a project can break ground. */
  getConstructionReadinessIssues(tile: TileState): string[] {
    const issues: string[] = [];
    if (!this.hasRoadAccess(tile)) issues.push('Connect a road route to the map edge');

    // Utility projects provide the network's first connection, while parks are
    // intentionally light-touch public spaces. Homes and workplaces require both.
    const needsUtilities = tile.type === 'residential' || tile.type === 'commercial' || tile.type === 'industrial';
    if (needsUtilities && !tile.powered) issues.push('Connect power');
    if (needsUtilities && !tile.watered) issues.push('Connect water');
    return issues;
  }

  cancelConstruction(x: number, y: number): boolean {
    const tile = this.grid[x]?.[y];
    if (!tile || !tile.placeId || (tile.constructionStatus !== 'planned' && tile.constructionStatus !== 'building')) return false;
    const refund = Math.round((tile.constructionCost ?? 0) * 0.8);
    this.money += refund;
    if (tile.reopening) {
      tile.constructionStatus = 'complete';
      tile.constructionProgress = 100;
      tile.progress = 100;
      tile.constructionCost = undefined;
      tile.reopening = false;
      tile.operatingStatus = 'closed';
      this.onTileUpdate(tile);
      this.onNotification(`Reopening cancelled. $${refund} returned; ${tile.name ?? 'the place'} remains closed.`, 'info');
      return true;
    }
    this.clearTileHousehold(tile);
    Object.assign(tile, {
      type: 'empty' as TileType, level: 0, progress: 0, occupancy: 0, maxOccupancy: 0,
      happiness: 100, abandoned: false, bridge: false, placeId: undefined, name: undefined,
      archetype: undefined, tags: undefined, constructionStatus: undefined, constructionProgress: undefined, constructionBlockers: undefined,
      constructionCost: undefined, reopening: undefined, residentCapacity: undefined, reservedHouseholdId: undefined,
      founderResidentId: undefined, workerIds: undefined, workerCapacity: undefined,
      operatingStatus: undefined, viability: undefined, strugglingSinceDay: undefined,
    });
    this.updateUtilities();
    this.onTileUpdate(tile);
    this.onNotification(`Project cancelled. $${refund} returned; the initial commitment remains spent.`, 'info');
    return true;
  }

  beginReopening(x: number, y: number): boolean {
    const tile = this.grid[x]?.[y];
    if (!tile?.placeId || tile.operatingStatus !== 'closed' || !tile.archetype) return false;
    const cost = getPlace(tile.archetype).cost;
    if (this.money < cost) return false;
    this.money -= cost;
    tile.constructionStatus = 'planned';
    tile.constructionProgress = 0;
    tile.constructionBlockers = [];
    tile.constructionCost = cost;
    tile.reopening = true;
    this.updateUtilities();
    this.onTileUpdate(tile);
    return true;
  }

  // Cost to demolish
  getDemolishCost(): number {
    return 5;
  }

  // Monthly/Weekly maintenance costs
  getMaintenanceCost(type: TileType, _level = 1): number {
    switch (type) {
      case 'road': return 2;
      case 'power': return 35;
      case 'water': return 25;
      case 'park': return 15;
      case 'boardwalk': return 2;
      case 'residential': return 0;
      case 'commercial': return 0;
      case 'industrial': return 0;
      default: return 0;
    }
  }

  build(x: number, y: number, type: TileType): boolean {
    if (x < 0 || x >= this.gridSize || y < 0 || y >= this.gridSize) return false;
    const archetype = this.defaultArchetypeFor(type);
    if (archetype) return this.buildPlace(x, y, archetype);
    const tile = this.grid[x][y];

    // Water bodies and boardwalks can only be placed at sea level (elevation 0)
    if ((type === 'water_body' || type === 'boardwalk') && tile.elevation !== 0) {
      this.onNotification("Water and boardwalks can only be placed at sea level (elevation 0)!", "danger");
      return false;
    }

    // Cannot build on top of existing non-empty without demolishing first
    if (tile.type !== 'empty') {
      if (type === 'road' && tile.type === 'water_body') {
        const cost = this.getBuildCost('road');
        if (this.money < cost) {
          this.onNotification("Not enough money to build this!", "danger");
          return false;
        }
        this.money -= cost;
        this.clearTileHousehold(tile);
        tile.type = 'road';
        tile.bridge = true;
        tile.level = 0;
        tile.progress = 0;
        tile.powered = false;
        tile.watered = false;
        tile.occupancy = 0;
        tile.maxOccupancy = 0;
        tile.happiness = 100;
        tile.abandoned = false;
        tile.placedSequence = this.nextPlacementSequence++;

        this.updateUtilities();
        this.onTileUpdate(tile);
        return true;
      }
      if (type === 'boardwalk' && tile.type === 'water_body') {
        const hasWaterAccess = [
          y > 0 && (this.grid[x][y - 1].type === 'water_body' || this.grid[x][y - 1].bridge || this.grid[x][y - 1].type === 'boardwalk'),
          y < this.gridSize - 1 && (this.grid[x][y + 1].type === 'water_body' || this.grid[x][y + 1].bridge || this.grid[x][y + 1].type === 'boardwalk'),
          x < this.gridSize - 1 && (this.grid[x + 1][y].type === 'water_body' || this.grid[x + 1][y].bridge || this.grid[x + 1][y].type === 'boardwalk'),
          x > 0 && (this.grid[x - 1][y].type === 'water_body' || this.grid[x - 1][y].bridge || this.grid[x - 1][y].type === 'boardwalk')
        ].some(Boolean);
        if (!hasWaterAccess) {
          this.onNotification("Boardwalks must be built adjacent to water or other boardwalks!", "danger");
          return false;
        }

        const cost = this.getBuildCost('boardwalk');
        if (this.money < cost) {
          this.onNotification("Not enough money to build this!", "danger");
          return false;
        }
        this.money -= cost;
        this.clearTileHousehold(tile);
        tile.type = 'boardwalk';
        tile.level = 0;
        tile.progress = 0;
        tile.powered = false;
        tile.watered = false;
        tile.occupancy = 0;
        tile.maxOccupancy = 0;
        tile.happiness = 100;
        tile.abandoned = false;
        tile.bridge = false;
        tile.placedSequence = this.nextPlacementSequence++;

        this.updateUtilities();
        this.onTileUpdate(tile);
        return true;
      }
      return false;
    }

    // Waterfront access check for boardwalks
    if (type === 'boardwalk') {
      const hasWaterAccess = [
        y > 0 && (this.grid[x][y - 1].type === 'water_body' || this.grid[x][y - 1].bridge || this.grid[x][y - 1].type === 'boardwalk'),
        y < this.gridSize - 1 && (this.grid[x][y + 1].type === 'water_body' || this.grid[x][y + 1].bridge || this.grid[x][y + 1].type === 'boardwalk'),
        x < this.gridSize - 1 && (this.grid[x + 1][y].type === 'water_body' || this.grid[x + 1][y].bridge || this.grid[x + 1][y].type === 'boardwalk'),
        x > 0 && (this.grid[x - 1][y].type === 'water_body' || this.grid[x - 1][y].bridge || this.grid[x - 1][y].type === 'boardwalk')
      ].some(Boolean);
      if (!hasWaterAccess) {
        this.onNotification("Boardwalks must be built adjacent to water or other boardwalks!", "danger");
        return false;
      }
    }

    const cost = this.getBuildCost(type);
    if (this.money < cost) {
      this.onNotification("Not enough money to build this!", "danger");
      return false;
    }

    this.money -= cost;
    this.clearTileHousehold(tile);
    tile.type = type;
    tile.level = 0;
    tile.progress = 0;
    tile.powered = false;
    tile.watered = false;
    tile.occupancy = 0;
    tile.maxOccupancy = 0;
    tile.happiness = 100;
    tile.abandoned = false;
    tile.bridge = false;
    tile.placedSequence = this.nextPlacementSequence++;

    this.updateUtilities();
    this.onTileUpdate(tile);

    return true;
  }

  buildLine(cells: { x: number; y: number }[], type: TileType): boolean {
    const validCells = cells.filter(cell => {
      if (cell.x < 0 || cell.x >= this.gridSize || cell.y < 0 || cell.y >= this.gridSize) return false;
      const tile = this.grid[cell.x][cell.y];
      if (type === 'road') {
        return tile.type === 'empty' || tile.type === 'water_body';
      }
      if (type === 'water_body') {
        return tile.type === 'empty' && tile.elevation === 0;
      }
      if (type === 'boardwalk') {
        const x = cell.x;
        const y = cell.y;
        if (tile.elevation !== 0) return false;
        const hasWaterAccess = [
          y > 0 && (this.grid[x][y - 1].type === 'water_body' || this.grid[x][y - 1].bridge || this.grid[x][y - 1].type === 'boardwalk'),
          y < this.gridSize - 1 && (this.grid[x][y + 1].type === 'water_body' || this.grid[x][y + 1].bridge || this.grid[x][y + 1].type === 'boardwalk'),
          x < this.gridSize - 1 && (this.grid[x + 1][y].type === 'water_body' || this.grid[x + 1][y].bridge || this.grid[x + 1][y].type === 'boardwalk'),
          x > 0 && (this.grid[x - 1][y].type === 'water_body' || this.grid[x - 1][y].bridge || this.grid[x - 1][y].type === 'boardwalk'),
          cells.some(c => c !== cell && Math.abs(c.x - x) + Math.abs(c.y - y) === 1)
        ].some(Boolean);
        return (tile.type === 'empty' || tile.type === 'water_body') && hasWaterAccess;
      }
      return tile.type === 'empty';
    });
    if (validCells.length === 0) return false;

    if (type === 'boardwalk') {
      const lineHasWater = validCells.some(cell => {
        const x = cell.x;
        const y = cell.y;
        return [
          y > 0 && (this.grid[x][y - 1].type === 'water_body' || this.grid[x][y - 1].bridge || this.grid[x][y - 1].type === 'boardwalk'),
          y < this.gridSize - 1 && (this.grid[x][y + 1].type === 'water_body' || this.grid[x][y + 1].bridge || this.grid[x][y + 1].type === 'boardwalk'),
          x < this.gridSize - 1 && (this.grid[x + 1][y].type === 'water_body' || this.grid[x + 1][y].bridge || this.grid[x + 1][y].type === 'boardwalk'),
          x > 0 && (this.grid[x - 1][y].type === 'water_body' || this.grid[x - 1][y].bridge || this.grid[x - 1][y].type === 'boardwalk')
        ].some(Boolean);
      });
      if (!lineHasWater) {
        this.onNotification("Boardwalks must be built adjacent to water or other boardwalks!", "danger");
        return false;
      }
    }

    const cost = validCells.length * this.getBuildCost(type);
    if (this.money < cost) {
      this.onNotification("Not enough money to build this!", "danger");
      return false;
    }

    this.money -= cost;
    for (const cell of validCells) {
      const tile = this.grid[cell.x][cell.y];
      this.clearTileHousehold(tile);
      if (type === 'road' && tile.type === 'water_body') {
        tile.type = 'road';
        tile.bridge = true;
      } else {
        tile.type = type;
        tile.bridge = false;
      }
      tile.level = 0;
      tile.progress = 0;
      tile.powered = false;
      tile.watered = false;
      tile.occupancy = 0;
      tile.maxOccupancy = 0;
      tile.happiness = 100;
      tile.abandoned = false;
      tile.placedSequence = this.nextPlacementSequence++;
    }

    this.updateUtilities();

    for (const cell of validCells) {
      this.onTileUpdate(this.grid[cell.x][cell.y]);
    }

    return true;
  }


  demolish(x: number, y: number): boolean {
    if (x < 0 || x >= this.gridSize || y < 0 || y >= this.gridSize) return false;
    const tile = this.grid[x][y];

    if (tile.type === 'empty') return false;
    if (tile.constructionStatus === 'planned' || tile.constructionStatus === 'building') {
      return this.cancelConstruction(x, y);
    }

    const cost = this.getDemolishCost();
    if (this.money < cost) {
      this.onNotification("Not enough money to demolish!", "danger");
      return false;
    }

    this.money -= cost;
    this.clearTileHousehold(tile);
    for (const resident of this.residents) {
      if (resident.workplacePlaceId === tile.placeId) delete resident.workplacePlaceId;
    }
    if (tile.bridge) {
      tile.type = 'water_body';
      tile.bridge = false;
    } else {
      tile.type = 'empty';
    }
    tile.level = 0;
    tile.progress = 0;
    tile.powered = false;
    tile.watered = false;
    tile.occupancy = 0;
    tile.maxOccupancy = 0;
    tile.happiness = 100;
    tile.abandoned = false;
    tile.placeId = undefined;
    tile.name = undefined;
    tile.archetype = undefined;
    tile.tags = undefined;
    tile.constructionStatus = undefined;
    tile.constructionProgress = undefined;
    tile.constructionBlockers = undefined;
    tile.constructionCost = undefined;
    tile.residentCapacity = undefined;
    tile.reservedHouseholdId = undefined;
    tile.founderResidentId = undefined;
    tile.workerIds = undefined;
    tile.workerCapacity = undefined;
    tile.operatingStatus = undefined;
    tile.viability = undefined;
    tile.strugglingSinceDay = undefined;

    this.updateUtilities();
    this.onTileUpdate(tile);
    return true;
  }

  // Update utilities propagation along the 100x100 grid
  updateUtilities() {
    this.rebuildTileTypeCaches();
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
                               (neighborTile.type !== 'empty' && neighborTile.type !== 'park' && neighborTile.constructionStatus === 'complete');

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
    this.refreshConstructionReadiness();
    this.evaluateSharedGardenHopes();
  }

  private refreshConstructionReadiness() {
    for (const row of this.grid) for (const tile of row) {
      if (tile.constructionStatus !== 'planned' && tile.constructionStatus !== 'building') continue;
      const blockers = this.getConstructionReadinessIssues(tile);
      const blockersChanged = blockers.length !== (tile.constructionBlockers?.length ?? 0)
        || blockers.some((blocker, index) => blocker !== tile.constructionBlockers?.[index]);
      if (blockersChanged) tile.constructionBlockers = blockers;
      const paused = blockers.length > 0 && tile.constructionStatus === 'building';
      if (paused) tile.constructionStatus = 'planned';
      if (blockersChanged || paused) this.onTileUpdate(tile);
    }
  }

  private advanceConstruction() {
    this.refreshConstructionReadiness();
    for (const row of this.grid) for (const tile of row) {
      if (tile.constructionStatus !== 'planned' && tile.constructionStatus !== 'building') continue;
      if ((tile.constructionBlockers?.length ?? 0) > 0) continue;
      tile.constructionStatus = 'building';
      tile.constructionProgress = Math.min(100, (tile.constructionProgress ?? 0) + (100 / CONSTRUCTION_TICKS) * this.speed);
      tile.progress = tile.constructionProgress;
      if (tile.constructionProgress < 100) {
        this.onTileUpdate(tile);
        continue;
      }
      tile.constructionProgress = 100;
      tile.progress = 100;
      tile.constructionStatus = 'complete';
      if (tile.workerCapacity) {
        tile.operatingStatus = 'opening';
        tile.viability = 0;
      }
      this.onNotification(`${tile.name ?? 'A new place'} is complete.`, 'success');
      this.onTileUpdate(tile);
    }
    this.updateUtilities();
  }

  private isWorkingAge(resident: ResidentState) {
    return resident.age >= 16 && resident.age < 76;
  }

  private hasRoadAccess(tile: TileState): boolean {
    const starts = [{ x: tile.x + 1, y: tile.y }, { x: tile.x - 1, y: tile.y }, { x: tile.x, y: tile.y + 1 }, { x: tile.x, y: tile.y - 1 }]
      .filter(point => {
        const candidate = this.grid[point.x]?.[point.y];
        return candidate?.type === 'road' || candidate?.type === 'boardwalk';
      });
    const queue = [...starts];
    const visited = new Set(starts.map(point => `${point.x},${point.y}`));
    while (queue.length) {
      const current = queue.shift()!;
      if (current.x === 0 || current.y === 0 || current.x === this.gridSize - 1 || current.y === this.gridSize - 1) return true;
      for (const next of [{ x: current.x + 1, y: current.y }, { x: current.x - 1, y: current.y }, { x: current.x, y: current.y + 1 }, { x: current.x, y: current.y - 1 }]) {
        const key = `${next.x},${next.y}`;
        const candidate = this.grid[next.x]?.[next.y];
        if (!visited.has(key) && (candidate?.type === 'road' || candidate?.type === 'boardwalk')) {
          visited.add(key);
          queue.push(next);
        }
      }
    }
    return false;
  }

  private isSettledResident(resident: ResidentState): boolean {
    return this.getHousehold(resident.householdId)?.status === 'settled';
  }

  private assignWorkers() {
    const employed = new Set(this.residents
      .filter(resident => this.isSettledResident(resident) && !!resident.workplacePlaceId)
      .map(resident => resident.id));
    const workplaces = this.grid.flat().filter(tile => tile.constructionStatus === 'complete' && !!tile.workerCapacity && tile.operatingStatus !== 'closed');
    for (const place of workplaces) {
      const valid = (place.workerIds ?? []).filter(id => {
        const resident = this.getResident(id);
        return !!resident && this.isSettledResident(resident) && resident.workplacePlaceId === place.placeId && this.isWorkingAge(resident);
      });
      place.workerIds = valid;
      for (const resident of this.residents) if (resident.workplacePlaceId === place.placeId && !valid.includes(resident.id)) delete resident.workplacePlaceId;
      if (place.founderResidentId && place.workerIds.length < (place.workerCapacity ?? 0)) {
        const founder = this.getResident(place.founderResidentId);
        if (founder && this.isSettledResident(founder) && this.isWorkingAge(founder) && !founder.workplacePlaceId) {
          place.workerIds.push(founder.id);
          founder.workplacePlaceId = place.placeId;
          employed.add(founder.id);
        }
      }
      const preferredOccupation: Partial<Record<PlaceArchetype, string>> = {
        bakery: 'Baker', cafe: 'Cook', florist: 'Florist', grocer: 'Grocer', bookshop: 'Librarian',
        repair_shop: 'Technician', pottery_workshop: 'Potter', carpenter_workshop: 'Carpenter',
        bike_workshop: 'Mechanic', maker_space: 'Designer', production_depot: 'Technician', community_studio: 'Designer',
      };
      const preference = place.archetype ? preferredOccupation[place.archetype] : undefined;
      const available = this.residents
        .filter(resident => this.isSettledResident(resident) && this.isWorkingAge(resident) && !employed.has(resident.id))
        .sort((a, b) => Number(b.occupation.includes(preference ?? '')) - Number(a.occupation.includes(preference ?? '')));
      for (const resident of available) {
        if (place.workerIds.length >= (place.workerCapacity ?? 0)) break;
        place.workerIds.push(resident.id);
        resident.workplacePlaceId = place.placeId;
        employed.add(resident.id);
      }
    }
  }

  private evaluateBusinesses() {
    this.assignWorkers();
    const settledHouseholds = this.households.filter(household => household.status === 'settled').length;
    for (const tile of this.grid.flat()) {
      if (!tile.workerCapacity || tile.constructionStatus !== 'complete') continue;
      if (tile.operatingStatus === 'closed') continue;
      if (!tile.powered || !tile.watered || !this.hasRoadAccess(tile)) {
        tile.viability = 0;
      } else {
        const workerFactor = Math.min(1, (tile.workerIds?.length ?? 0) / tile.workerCapacity);
        const customerFactor = Math.min(1, settledHouseholds / Math.max(1, tile.workerCapacity));
        tile.viability = workerFactor === 0 ? 0 : Math.round((workerFactor * 50 + customerFactor * 50));
      }
      if ((tile.viability ?? 0) >= 45) {
        tile.operatingStatus = 'open';
        tile.strugglingSinceDay = undefined;
      } else {
        if (!tile.strugglingSinceDay) {
          tile.strugglingSinceDay = this.dayCount;
          this.onNotification(`${tile.name ?? 'A local place'} is struggling: it needs workers, customers, and access.`, 'warning');
        }
        tile.operatingStatus = 'struggling';
        if (this.dayCount - tile.strugglingSinceDay >= 7) {
          tile.operatingStatus = 'closed';
          for (const id of tile.workerIds ?? []) {
            const resident = this.getResident(id);
            if (resident && resident.workplacePlaceId === tile.placeId) delete resident.workplacePlaceId;
          }
          tile.workerIds = [];
          this.onNotification(`${tile.name ?? 'A local place'} has closed after a sustained struggle.`, 'warning');
        }
      }
      this.onTileUpdate(tile);
    }
    this.recalculateAuthoritativeTotals();
  }

  recalculateAuthoritativeTotals() {
    this.population = this.residents.filter(resident => this.getHousehold(resident.householdId)?.status === 'settled').length;
    const operating = this.grid.flat().filter(tile => tile.constructionStatus === 'complete' && !!tile.workerCapacity && tile.operatingStatus !== 'closed');
    this.jobs = operating.reduce((total, tile) => total + (tile.workerCapacity ?? 0), 0);
    this.employed = operating.reduce((total, tile) => total + (tile.workerIds?.filter(id => {
      const resident = this.getResident(id);
      return !!resident && this.isSettledResident(resident) && resident.workplacePlaceId === tile.placeId;
    }).length ?? 0), 0);
    for (const tile of this.grid.flat()) {
      if (tile.type === 'residential') {
        const household = tile.householdId ? this.getHousehold(tile.householdId) : undefined;
        tile.occupancy = household?.status === 'settled' ? household.residentIds.length : 0;
        tile.maxOccupancy = tile.residentCapacity ?? tile.maxOccupancy;
      } else if (tile.workerCapacity) {
        tile.occupancy = tile.workerIds?.length ?? 0;
        tile.maxOccupancy = tile.workerCapacity;
      }
    }
  }

  // Simulation tick (called every 2 seconds by Game loop)
  tick() {
    if (this.speed === 0) return;
    const hoursPerTick = 0.5 * this.speed;
    this.timeOfDay += hoursPerTick;
    let newDay = false;
    if (this.timeOfDay >= 24) {
      this.timeOfDay = 0;
      this.dayCount++;
      newDay = true;
      if (this.dayCount % 7 === 1) {
        this.processWeeklyEconomy();
      }
    }

    this.advanceConstruction();
    this.recalculateAuthoritativeTotals();
    if (newDay) {
      this.evaluateBusinesses();
      this.updateApplicationsForDay();
      this.updateGardenPicnic();
    }
    return;

    /* Retired RCI growth loop retained in source history only.
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
        if (tile.type === 'empty' || tile.type === 'road' || tile.type === 'power' || tile.type === 'water' || tile.type === 'water_body') {
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
            needsUtilityUpdate = true;
            if (tile.level === 0) {
              if (tile.type === 'residential') this.clearTileHousehold(tile);
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
          let baseGrowth = 0;
          let baseDecay = 0;
          let demand = 0;

          if (tile.type === 'residential') {
            demand = this.demandR;
            baseGrowth = demand > 0 ? Math.min(4.0, demand / 25) : 0;
            baseDecay = demand < -20 ? Math.max(-4.0, (demand + 20) / 20) : 0;
          } else if (tile.type === 'commercial') {
            demand = this.demandC;
            baseGrowth = demand > 0 ? Math.min(3.0, demand / 33) : 0;
            baseDecay = demand < -20 ? Math.max(-3.0, (demand + 20) / 20) : 0;
          } else if (tile.type === 'industrial') {
            demand = this.demandI;
            baseGrowth = demand > 0 ? Math.min(3.0, demand / 33) : 0;
            baseDecay = demand < -20 ? Math.max(-3.0, (demand + 20) / 20) : 0;
          } else if (tile.type === 'park') {
            baseGrowth = 0;
            tile.level = 1;
            tile.happiness = 100;
          }

          let effectiveGrowthRate = 0;

          if (baseGrowth > 0 && tile.level < 3) {
            if (tile.level === 0) {
              effectiveGrowthRate = baseGrowth * 2.5; // Make the initial building (lvl0 -> lvl1) faster
            } else if (tile.level === 1) {
              if (tile.happiness >= 80) {
                const happinessScale = (tile.happiness - 80) / 20; // 0 to 1
                const speedModifier = 0.12 + 0.18 * happinessScale; // 0.12 to 0.30
                effectiveGrowthRate = baseGrowth * speedModifier;
              } else {
                effectiveGrowthRate = 0; // stuck at level 1 due to low happiness
              }
            } else if (tile.level === 2) {
              if (tile.happiness >= 90) {
                const happinessScale = (tile.happiness - 90) / 10; // 0 to 1
                const speedModifier = 0.03 + 0.05 * happinessScale; // 0.03 to 0.08
                effectiveGrowthRate = baseGrowth * speedModifier;
              } else {
                effectiveGrowthRate = 0; // stuck at level 2 due to low happiness
              }
            }
          }

          let effectiveDecayRate = baseDecay;

          // Check for happiness-related decay
          if (tile.level === 3 && tile.happiness < 85) {
            effectiveDecayRate = Math.min(effectiveDecayRate, -2.0);
          } else if (tile.level === 2 && tile.happiness < 75) {
            effectiveDecayRate = Math.min(effectiveDecayRate, -1.5);
          }

          if (effectiveGrowthRate > 0 && tile.level < 3) {
            tile.progress += effectiveGrowthRate * this.speed;
            if (tile.progress >= 100) {
              tile.progress = 30; // 30% progress buffer on upgrade for hysteresis stability
              tile.level++;

              needsUtilityUpdate = true;
              this.onTileUpdate(tile);
            }
          } else if (effectiveDecayRate < 0 && tile.level > 0) {
            tile.progress += effectiveDecayRate * this.speed;
            if (tile.progress <= 0) {
              tile.progress = 70; // 70% progress buffer on downgrade for hysteresis stability
              tile.level--;
              if (tile.level === 0 && tile.type === 'residential') this.clearTileHousehold(tile);
              needsUtilityUpdate = true;
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

            // Happiness increases with parks and boardwalks nearby
            const parkBonus = this.hasParkNearby(tile.x, tile.y) ? 15 : 0;
            const boardwalkBonus = this.hasBoardwalkNearby(tile.x, tile.y) ? 10 : 0;
            const taxPenalty = this.taxRate > 0.15 ? -15 : this.taxRate < 0.08 ? 10 : 0;
            tile.happiness = Math.max(20, Math.min(100, 80 + parkBonus + boardwalkBonus + taxPenalty));
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

    if (needsUtilityUpdate) {
      this.updateUtilities();
    }
  }

    */
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

  // Search adjacent tiles (5-tile radius) for boardwalks
  hasBoardwalkNearby(x: number, y: number): boolean {
    const radius = 5;
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && nx < this.gridSize && ny >= 0 && ny < this.gridSize) {
          if (this.grid[nx][ny].type === 'boardwalk') return true;
        }
      }
    }
    return false;
  }

  // Weekly economic report process
  processWeeklyEconomy() {
    const completed = this.grid.flat().filter(tile => tile.constructionStatus === 'complete');
    const maintenanceTotal = completed.reduce((total, tile) => total + this.getMaintenanceCost(tile.type, tile.level), 0);
    const residential = this.residents.filter(resident => this.getHousehold(resident.householdId)?.status === 'settled').length;
    const employedAt = (tile: TileState) => tile.workerIds?.filter(id => {
      const resident = this.getResident(id);
      return !!resident && this.isSettledResident(resident) && resident.workplacePlaceId === tile.placeId;
    }).length ?? 0;
    const commercialWorkers = completed.filter(tile => tile.type === 'commercial' && tile.operatingStatus !== 'closed')
      .reduce((total, tile) => total + employedAt(tile), 0);
    const workshopWorkers = completed.filter(tile => tile.type === 'industrial' && tile.operatingStatus !== 'closed')
      .reduce((total, tile) => total + employedAt(tile), 0);
    const scale = this.taxRate / 0.12;
    this.weeklyTaxes = Math.round(residential * 10 * scale + commercialWorkers * 15 * scale + workshopWorkers * 12 * scale);
    this.weeklyMaintenance = maintenanceTotal;
    this.weeklyNetIncome = this.weeklyTaxes - maintenanceTotal;
    this.money += this.weeklyNetIncome;
    this.onNotification(`Weekly Financial Report: ${this.weeklyNetIncome >= 0 ? 'Net Profit' : 'Net Deficit'} ${this.weeklyNetIncome >= 0 ? '+' : '-'}$${Math.abs(this.weeklyNetIncome)}.`, this.weeklyNetIncome >= 0 ? 'success' : 'danger');
    return;
    /* Retired occupancy/happiness tax calculation.
    let maintenanceTotal = 0;
    let taxesCollected = 0;

    for (let x = 0; x < this.gridSize; x++) {
      for (let y = 0; y < this.gridSize; y++) {
        const tile = this.grid[x][y];
        if (tile.type === 'empty' || tile.type === 'water_body') continue;

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

    */
  }

  saveState(): string {
    const state = {
      version: CURRENT_SAVE_VERSION,
      seed: this.seed,
      money: this.money,
      taxRate: this.taxRate,
      population: this.population,
      jobs: this.jobs,
      employed: this.employed,
      overallHappiness: this.overallHappiness,
      dayCount: this.dayCount,
      timeOfDay: this.timeOfDay,
      nextResidentId: this.nextResidentId,
      nextHouseholdId: this.nextHouseholdId,
      memories: this.memories,
      nextMemoryId: this.nextMemoryId,
      hopes: this.hopes,
      nextHopeId: this.nextHopeId,
      nextPlacementSequence: this.nextPlacementSequence,
      nextPlaceId: this.nextPlaceId,
      applications: this.applications,
      nextApplicationId: this.nextApplicationId,
      popularity: this.popularity,
      picnicStatus: this.picnicStatus,
      residents: this.residents,
      households: this.households,
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
        householdId: tile.householdId,
        bridge: tile.bridge,
        elevation: tile.elevation || 0,
        placedSequence: tile.placedSequence,
        placeId: tile.placeId,
        name: tile.name,
        archetype: tile.archetype,
        tags: tile.tags,
        constructionStatus: tile.constructionStatus,
        constructionProgress: tile.constructionProgress,
        constructionCost: tile.constructionCost,
        reopening: tile.reopening,
        residentCapacity: tile.residentCapacity,
        reservedHouseholdId: tile.reservedHouseholdId,
        founderResidentId: tile.founderResidentId,
        workerIds: tile.workerIds,
        workerCapacity: tile.workerCapacity,
        operatingStatus: tile.operatingStatus,
        viability: tile.viability,
        strugglingSinceDay: tile.strugglingSinceDay,
      }))),
    };
    return JSON.stringify(state);
  }

  private validLoadedPosition(value: unknown): value is TilePosition | null {
    if (value === null) return true;
    if (!value || typeof value !== 'object') return false;
    const position = value as TilePosition;
    return Number.isInteger(position.x) && Number.isInteger(position.y)
      && position.x >= 0 && position.x < this.gridSize && position.y >= 0 && position.y < this.gridSize;
  }

  private validateLoadedEntities(state: any, requireRoutine: boolean): boolean {
    if (!Array.isArray(state.residents) || !Array.isArray(state.households)
      || !Number.isInteger(state.nextResidentId) || state.nextResidentId < 1
      || !Number.isInteger(state.nextHouseholdId) || state.nextHouseholdId < 1) return false;
    const residentIds = new Set<string>();
    const householdIds = new Set<string>();
    let highestResident = 0;
    let highestHousehold = 0;
    for (const household of state.households) {
      if (!household || typeof household.id !== 'string' || !/^household-\d+$/.test(household.id)
        || householdIds.has(household.id) || typeof household.surname !== 'string'
        || !Array.isArray(household.residentIds) || !this.validLoadedPosition(household.home)
        || (household.status !== 'settled' && household.status !== 'arriving' && household.status !== 'unhoused')
        || !Number.isInteger(household.arrivalDay)) return false;
      householdIds.add(household.id);
      highestHousehold = Math.max(highestHousehold, Number(household.id.slice(10)));
      if (household.residentIds.some((id: unknown) => typeof id !== 'string')) return false;
    }
    for (const resident of state.residents) {
      if (!resident || typeof resident.id !== 'string' || !/^resident-\d+$/.test(resident.id)
        || residentIds.has(resident.id) || typeof resident.householdId !== 'string'
        || !householdIds.has(resident.householdId) || typeof resident.firstName !== 'string'
        || typeof resident.lastName !== 'string' || !Number.isInteger(resident.age) || resident.age < 0
        || typeof resident.occupation !== 'string' || !this.validLoadedPosition(resident.home)
        || !Number.isInteger(resident.appearanceSeed)
        || (requireRoutine && !this.isValidRoutine(resident.routine))) return false;
      residentIds.add(resident.id);
      highestResident = Math.max(highestResident, Number(resident.id.slice(9)));
    }
    return state.nextResidentId > highestResident && state.nextHouseholdId > highestHousehold;
  }

  private validateLoadedMemories(state: any): boolean {
    if (!Array.isArray(state.memories) || !Number.isInteger(state.nextMemoryId) || state.nextMemoryId < 1) return false;
    const residentIds = new Set<string>(state.residents.map((resident: ResidentState) => resident.id));
    const householdIds = new Set<string>(state.households.map((household: HouseholdState) => household.id));
    const memoryIds = new Set<string>();
    let highestMemory = 0;
    for (const memory of state.memories) {
      if (!memory || typeof memory.id !== 'string' || !/^memory-\d+$/.test(memory.id) || memoryIds.has(memory.id)
        || (memory.type !== 'arrival' && memory.type !== 'hope_fulfilled') || !Number.isInteger(memory.day)
        || typeof memory.title !== 'string' || typeof memory.description !== 'string'
        || !Array.isArray(memory.residentIds) || !Array.isArray(memory.householdIds)
        || memory.residentIds.some((id: unknown) => typeof id !== 'string' || !residentIds.has(id))
        || memory.householdIds.some((id: unknown) => typeof id !== 'string' || !householdIds.has(id))
        || (memory.tile !== undefined && !this.validLoadedPosition(memory.tile))
        || (memory.type === 'hope_fulfilled' && (!this.validLoadedPosition(memory.tile) || memory.tile === null))) return false;
      memoryIds.add(memory.id);
      highestMemory = Math.max(highestMemory, Number(memory.id.slice(7)));
    }
    return state.nextMemoryId > highestMemory;
  }

  private validateLoadedHopes(state: any): boolean {
    if (!Array.isArray(state.hopes) || !Number.isInteger(state.nextHopeId) || state.nextHopeId < 1
      || !Number.isInteger(state.nextPlacementSequence) || state.nextPlacementSequence < 1) return false;
    const residents = new Map(state.residents.map((resident: ResidentState) => [resident.id, resident]));
    const households = new Set(state.households.map((household: HouseholdState) => household.id));
    const ids = new Set<string>();
    let highestHope = 0;
    let highestPlacement = 0;
    let highestPlace = 0;
    const placeIds = new Set<string>();
    for (const row of state.grid) for (const tile of row) {
      if (!Number.isInteger(tile.placedSequence) || tile.placedSequence < 0) return false;
      highestPlacement = Math.max(highestPlacement, tile.placedSequence);
      if (tile.placeId !== undefined) {
        if (typeof tile.placeId !== 'string' || !/^place-\d+$/.test(tile.placeId) || placeIds.has(tile.placeId)) return false;
        placeIds.add(tile.placeId);
        highestPlace = Math.max(highestPlace, Number(tile.placeId.slice(6)));
      }
    }
    for (const hope of state.hopes) {
      const owner = hope && residents.get(hope.ownerResidentId);
      if (!hope || typeof hope.id !== 'string' || !/^hope-\d+$/.test(hope.id) || ids.has(hope.id)
        || hope.type !== 'shared_garden' || (hope.status !== 'active' && hope.status !== 'fulfilled')
        || !Number.isInteger(hope.createdDay) || hope.createdDay < 1
        || !Number.isInteger(hope.createdPlacementSequence) || hope.createdPlacementSequence < 0
        || !owner || !households.has(hope.householdId) || owner.householdId !== hope.householdId) return false;
      if (hope.status === 'active' && (hope.fulfilledDay !== undefined || hope.targetTile !== undefined)) return false;
      if (hope.status === 'fulfilled' && (!Number.isInteger(hope.fulfilledDay) || hope.fulfilledDay < hope.createdDay
        || !this.validLoadedPosition(hope.targetTile) || hope.targetTile === null)) return false;
      ids.add(hope.id);
      highestHope = Math.max(highestHope, Number(hope.id.slice(5)));
    }
    return state.nextHopeId > highestHope && state.nextPlacementSequence > highestPlacement
      && Number.isInteger(state.nextPlaceId) && state.nextPlaceId > highestPlace;
  }

  private reconcileHopes() {
    this.hopes = this.hopes.filter(hope => {
      const owner = this.getResident(hope.ownerResidentId);
      const household = this.getHousehold(hope.householdId);
      return !!owner && !!household && owner.householdId === household.id;
    });
  }

  private reconcileHouseholds(): boolean {
    for (const resident of this.residents) {
      if (!this.isValidRoutine(resident.routine)) resident.routine = this.defaultRoutine(resident.appearanceSeed);
    }

    const residents = new Map(this.residents.map(resident => [resident.id, resident]));
    const households = new Map(this.households.map(household => [household.id, household]));
    if (residents.size !== this.residents.length || households.size !== this.households.length) return false;

    for (const row of this.grid) for (const tile of row) {
      if (tile.type !== 'residential' || tile.level <= 0 || tile.abandoned || !tile.householdId || !households.has(tile.householdId)) {
        delete tile.householdId;
      }
      if (tile.type !== 'residential' || tile.constructionStatus !== 'complete' || tile.abandoned || !tile.reservedHouseholdId || !households.has(tile.reservedHouseholdId)) {
        delete tile.reservedHouseholdId;
      }
    }
    for (const household of this.households) {
      household.residentIds = [...new Set(household.residentIds.filter(id => residents.get(id)?.householdId === household.id))];
    }
    for (const resident of this.residents) {
      const household = households.get(resident.householdId);
      if (!household) return false;
      if (!household.residentIds.includes(resident.id)) household.residentIds.push(resident.id);
    }

    const claimedHomes = new Set<string>();
    for (const household of this.households) {
      const home = household.home;
      const validHome = (household.status === 'settled' || household.status === 'arriving') && home !== null && this.positionIsValid(home)
        && this.grid[home.x][home.y].type === 'residential' && this.grid[home.x][home.y].level > 0
        && !this.grid[home.x][home.y].abandoned
        && (household.status === 'settled'
          ? (!this.grid[home.x][home.y].householdId || this.grid[home.x][home.y].householdId === household.id)
          : (!this.grid[home.x][home.y].reservedHouseholdId || this.grid[home.x][home.y].reservedHouseholdId === household.id));
      const key = home ? `${home.x},${home.y}` : '';
      if (!validHome || claimedHomes.has(key)) {
        this.unhousehold(household);
        continue;
      }
      claimedHomes.add(key);
      const tile = this.grid[home.x][home.y];
      if (household.status === 'settled') tile.householdId = household.id;
      else tile.reservedHouseholdId = household.id;
      for (const residentId of household.residentIds) residents.get(residentId)!.home = { x: home.x, y: home.y };
    }
    for (const row of this.grid) for (const tile of row) {
      const household = tile.householdId ? households.get(tile.householdId) : undefined;
      if (!household || household.status !== 'settled' || !household.home
        || household.home.x !== tile.x || household.home.y !== tile.y) delete tile.householdId;
      const arriving = tile.reservedHouseholdId ? households.get(tile.reservedHouseholdId) : undefined;
      if (!arriving || arriving.status !== 'arriving' || !arriving.home
        || arriving.home.x !== tile.x || arriving.home.y !== tile.y) delete tile.reservedHouseholdId;
    }

    return this.hasHouseholdIntegrity();
  }

  private hasHouseholdIntegrity(): boolean {
    const households = new Map(this.households.map(household => [household.id, household]));
    const highestResident = Math.max(0, ...this.residents.map(resident => Number(resident.id.slice(9))));
    const highestHousehold = Math.max(0, ...this.households.map(household => Number(household.id.slice(10))));
    if (!Number.isInteger(this.nextResidentId) || !Number.isInteger(this.nextHouseholdId)
      || this.nextResidentId <= highestResident || this.nextHouseholdId <= highestHousehold) return false;
    const residentCounts = new Map<string, number>();
    for (const household of this.households) {
      if (household.status === 'unhoused') {
        if (household.home !== null) return false;
      } else if (!household.home || !this.positionIsValid(household.home)) return false;
      for (const residentId of household.residentIds) residentCounts.set(residentId, (residentCounts.get(residentId) ?? 0) + 1);
    }
    for (const resident of this.residents) {
      const household = households.get(resident.householdId);
      if (!household || residentCounts.get(resident.id) !== 1 || !household.residentIds.includes(resident.id)) return false;
      if (household.status === 'unhoused') {
        if (resident.home !== null) return false;
      } else if (!household.home || !resident.home || resident.home.x !== household.home.x || resident.home.y !== household.home.y) return false;
    }
    for (const row of this.grid) for (const tile of row) {
      if (!tile.householdId) continue;
      const household = households.get(tile.householdId);
      if (!household || tile.type !== 'residential' || tile.level <= 0 || tile.abandoned
        || household.status !== 'settled' || !household.home || household.home.x !== tile.x || household.home.y !== tile.y) return false;
    }
    return true;
  }

  loadState(jsonString: string): boolean {
    try {
      const state = JSON.parse(jsonString);
      if (!state || !Array.isArray(state.grid)) return false;
      const version = state.version !== undefined ? state.version : 0;
      if (!Number.isInteger(version) || version !== CURRENT_SAVE_VERSION) {
        this.onNotification(version > CURRENT_SAVE_VERSION
          ? `Failed to load: save file is from a newer version (v${version}) of the game.`
          : 'This save uses the retired zoning simulation and cannot be loaded. Start a new neighborhood after confirming the reset.', 'danger');
        return false;
      }
      if (state.grid.length < this.gridSize) return false;
      for (let x = 0; x < this.gridSize; x++) {
        if (!Array.isArray(state.grid[x]) || state.grid[x].length < this.gridSize) return false;
        for (let y = 0; y < this.gridSize; y++) if (!state.grid[x][y]) return false;
      }
      if (!this.validateLoadedEntities(state, true) || !this.validateLoadedMemories(state) || !this.validateLoadedHopes(state)) return false;
      if (!Array.isArray(state.applications) || !Number.isInteger(state.nextApplicationId) || !state.popularity) return false;

      this.seed = state.seed !== undefined ? state.seed : Math.floor(Math.random() * 1000000);
      this.money = state.money;
      this.taxRate = state.taxRate;
      this.population = state.population;
      this.jobs = state.jobs;
      this.employed = state.employed;
      this.overallHappiness = state.overallHappiness;
      this.dayCount = state.dayCount;
      this.timeOfDay = state.timeOfDay;
      for (let x = 0; x < this.gridSize; x++) for (let y = 0; y < this.gridSize; y++) {
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
        tile.householdId = typeof loadedTile.householdId === 'string' ? loadedTile.householdId : undefined;
        tile.bridge = loadedTile.bridge || false;
        tile.elevation = loadedTile.elevation !== undefined ? loadedTile.elevation : 0;
        tile.placedSequence = version >= 5 ? loadedTile.placedSequence : 0;
        tile.placeId = typeof loadedTile.placeId === 'string' ? loadedTile.placeId : undefined;
        tile.name = typeof loadedTile.name === 'string' ? loadedTile.name : undefined;
        tile.archetype = loadedTile.archetype;
        tile.tags = Array.isArray(loadedTile.tags) ? loadedTile.tags : undefined;
        tile.constructionStatus = loadedTile.constructionStatus;
        tile.constructionProgress = Number.isFinite(loadedTile.constructionProgress) ? loadedTile.constructionProgress : undefined;
        tile.constructionCost = Number.isFinite(loadedTile.constructionCost) ? loadedTile.constructionCost : undefined;
        tile.reopening = loadedTile.reopening === true;
        tile.residentCapacity = Number.isFinite(loadedTile.residentCapacity) ? loadedTile.residentCapacity : undefined;
        tile.reservedHouseholdId = typeof loadedTile.reservedHouseholdId === 'string' ? loadedTile.reservedHouseholdId : undefined;
        tile.founderResidentId = typeof loadedTile.founderResidentId === 'string' ? loadedTile.founderResidentId : undefined;
        tile.workerIds = Array.isArray(loadedTile.workerIds) ? loadedTile.workerIds.filter((id: unknown) => typeof id === 'string') : undefined;
        tile.workerCapacity = Number.isFinite(loadedTile.workerCapacity) ? loadedTile.workerCapacity : undefined;
        tile.operatingStatus = loadedTile.operatingStatus;
        tile.viability = Number.isFinite(loadedTile.viability) ? loadedTile.viability : undefined;
        tile.strugglingSinceDay = Number.isFinite(loadedTile.strugglingSinceDay) ? loadedTile.strugglingSinceDay : undefined;
      }
      {
        this.residents = state.residents.map((resident: ResidentState) => ({
          ...resident,
          occupation: resident.age < 16 ? 'Student' : resident.occupation,
          home: resident.home && { ...resident.home },
          routine: this.isValidRoutine(resident.routine)
            ? resident.routine.map(block => ({ ...block }))
            : this.defaultRoutine(resident.appearanceSeed),
        }));
        this.households = state.households.map((household: HouseholdState) => ({ ...household, residentIds: [...household.residentIds], home: household.home && { ...household.home } }));
        this.nextResidentId = state.nextResidentId;
        this.nextHouseholdId = state.nextHouseholdId;
        this.memories = state.memories.map((memory: MemoryState) => ({
          ...memory,
          residentIds: [...memory.residentIds],
          householdIds: [...memory.householdIds],
        }));
        this.nextMemoryId = state.nextMemoryId;
        this.hopes = state.hopes.map((hope: HopeState) => ({ ...hope, targetTile: hope.targetTile && { ...hope.targetTile } }));
        this.nextHopeId = state.nextHopeId;
        this.nextPlacementSequence = state.nextPlacementSequence;
        this.nextPlaceId = state.nextPlaceId;
        this.applications = state.applications.map((application: HouseholdApplication) => ({
          ...application,
          members: application.members.map(member => ({
            ...member,
            occupation: member.age < 16 ? 'Student' : member.occupation,
          })),
          physicalRequirements: application.physicalRequirements && [...application.physicalRequirements],
          lifestyleRequirements: application.lifestyleRequirements && [...application.lifestyleRequirements],
          preferences: application.preferences && [...application.preferences],
          contributionTags: application.contributionTags && [...application.contributionTags],
        }));
        this.nextApplicationId = state.nextApplicationId;
        this.popularity = state.popularity;
        this.picnicStatus = state.picnicStatus === 'gathering' || state.picnicStatus === 'complete' || state.picnicStatus === 'cancelled' ? state.picnicStatus : 'not_started';
      }
      if (!this.reconcileHouseholds()) return false;
      this.reconcileHopes();
      this.updateUtilities();
      this.evaluateSharedGardenHopes();
      this.recalculateAuthoritativeTotals();
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  }
}
