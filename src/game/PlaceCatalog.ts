import type { TileType } from './Simulation';

export type PlaceArchetype =
  | 'cozy_cottage' | 'family_home' | 'alpine_chalet'
  | 'bakery' | 'cafe' | 'florist' | 'grocer' | 'bookshop' | 'repair_shop' | 'community_studio'
  | 'pottery_workshop' | 'carpenter_workshop' | 'bike_workshop' | 'maker_space' | 'production_depot'
  | 'community_park' | 'community_garden';

export type PlaceTag = 'garden' | 'family' | 'quiet' | 'food' | 'craft' | 'culture' | 'nature' | 'waterfront' | 'repair';

export interface PlaceDefinition {
  archetype: PlaceArchetype;
  label: string;
  tileType: Extract<TileType, 'residential' | 'commercial' | 'industrial' | 'park'>;
  meshLevel: 1 | 2 | 3;
  cost: number;
  residentCapacity?: number;
  workerCapacity?: number;
  tags: PlaceTag[];
  availability: 'basic' | 'proposal';
  nameWords: [string, string];
}

export const PLACE_CATALOG: Record<PlaceArchetype, PlaceDefinition> = {
  cozy_cottage: { archetype: 'cozy_cottage', label: 'Cozy Cottage', tileType: 'residential', meshLevel: 1, cost: 400, residentCapacity: 2, tags: ['quiet', 'nature'], availability: 'basic', nameWords: ['Willow', 'Cottage'] },
  family_home: { archetype: 'family_home', label: 'Family Home', tileType: 'residential', meshLevel: 2, cost: 700, residentCapacity: 4, tags: ['family', 'garden'], availability: 'basic', nameWords: ['Maple', 'House'] },
  alpine_chalet: { archetype: 'alpine_chalet', label: 'Alpine Chalet', tileType: 'residential', meshLevel: 3, cost: 1100, residentCapacity: 6, tags: ['quiet', 'nature'], availability: 'basic', nameWords: ['Pine', 'Chalet'] },
  bakery: { archetype: 'bakery', label: 'Bakery', tileType: 'commercial', meshLevel: 1, cost: 550, workerCapacity: 2, tags: ['food'], availability: 'basic', nameWords: ['Golden', 'Bakery'] },
  cafe: { archetype: 'cafe', label: 'Café', tileType: 'commercial', meshLevel: 1, cost: 500, workerCapacity: 2, tags: ['food', 'culture'], availability: 'basic', nameWords: ['Corner', 'Café'] },
  florist: { archetype: 'florist', label: 'Florist', tileType: 'commercial', meshLevel: 1, cost: 450, workerCapacity: 1, tags: ['garden', 'nature'], availability: 'basic', nameWords: ['Bloom', 'Florist'] },
  grocer: { archetype: 'grocer', label: 'Grocer', tileType: 'commercial', meshLevel: 1, cost: 650, workerCapacity: 3, tags: ['food'], availability: 'basic', nameWords: ['Harbor', 'Grocer'] },
  bookshop: { archetype: 'bookshop', label: 'Bookshop', tileType: 'commercial', meshLevel: 2, cost: 700, workerCapacity: 2, tags: ['culture', 'quiet'], availability: 'proposal', nameWords: ['Chapter', 'Bookshop'] },
  repair_shop: { archetype: 'repair_shop', label: 'Repair Shop', tileType: 'commercial', meshLevel: 1, cost: 500, workerCapacity: 2, tags: ['repair'], availability: 'basic', nameWords: ['Fix-It', 'Repair'] },
  community_studio: { archetype: 'community_studio', label: 'Community Studio', tileType: 'commercial', meshLevel: 2, cost: 750, workerCapacity: 3, tags: ['culture', 'craft'], availability: 'proposal', nameWords: ['Common', 'Studio'] },
  pottery_workshop: { archetype: 'pottery_workshop', label: 'Pottery Workshop', tileType: 'industrial', meshLevel: 1, cost: 600, workerCapacity: 2, tags: ['craft'], availability: 'basic', nameWords: ['Clay', 'Works'] },
  carpenter_workshop: { archetype: 'carpenter_workshop', label: 'Carpenter Workshop', tileType: 'industrial', meshLevel: 1, cost: 600, workerCapacity: 2, tags: ['craft'], availability: 'basic', nameWords: ['Timber', 'Works'] },
  bike_workshop: { archetype: 'bike_workshop', label: 'Bicycle Workshop', tileType: 'industrial', meshLevel: 1, cost: 550, workerCapacity: 2, tags: ['repair'], availability: 'basic', nameWords: ['Wheel', 'Workshop'] },
  maker_space: { archetype: 'maker_space', label: 'Shared Maker Space', tileType: 'industrial', meshLevel: 2, cost: 900, workerCapacity: 4, tags: ['craft', 'culture'], availability: 'proposal', nameWords: ['Makers', 'Hall'] },
  production_depot: { archetype: 'production_depot', label: 'Production Depot', tileType: 'industrial', meshLevel: 2, cost: 950, workerCapacity: 4, tags: ['craft'], availability: 'proposal', nameWords: ['North', 'Depot'] },
  community_park: { archetype: 'community_park', label: 'Community Park', tileType: 'park', meshLevel: 1, cost: 300, tags: ['nature'], availability: 'basic', nameWords: ['Meadow', 'Park'] },
  community_garden: { archetype: 'community_garden', label: 'Community Garden', tileType: 'park', meshLevel: 1, cost: 350, tags: ['garden', 'nature'], availability: 'basic', nameWords: ['Shared', 'Garden'] },
};

export const getPlace = (archetype: PlaceArchetype) => PLACE_CATALOG[archetype];
