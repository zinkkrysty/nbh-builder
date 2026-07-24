export type SkinToneId = 'porcelain' | 'honey' | 'umber' | 'deep' | 'olive';
export type HairColorId = 'espresso' | 'chestnut' | 'auburn' | 'blonde' | 'silver';
export type HairStyleId = 'bald' | 'crop' | 'block' | 'bob' | 'bun' | 'cap';
export type PresentationId = 'feminine' | 'masculine' | 'neutral';
export type OutfitFamilyId = 'everyday' | 'apron' | 'jacket' | 'overalls' | 'cardigan' | 'dress' | 'skirt';
export type ClothingColorId = 'sage' | 'terracotta' | 'teal' | 'mustard' | 'plum' | 'navy' | 'rose' | 'cream' | 'forest' | 'slate' | 'charcoal' | 'rust' | 'coral' | 'sky';
export type SignaturePartId = 'none' | 'seed pouch' | 'satchel' | 'book bag';

export interface ResidentAppearance {
  version: 1;
  presentation: PresentationId;
  body: {
    height: number;
    shoulderWidth: number;
    waistWidth: number;
    hipWidth: number;
    headScale: number;
    legRatio: number;
  };
  skin: SkinToneId;
  hair: {
    style: HairStyleId;
    color: HairColorId;
  };
  outfit: {
    family: OutfitFamilyId;
    top: ClothingColorId;
    bottom: ClothingColorId;
    accent: ClothingColorId;
    shoes: ClothingColorId;
  };
  face: {
    glasses: boolean;
    moustache: boolean;
  };
  signature: SignaturePartId;
}

export interface PrototypeResident {
  id: string;
  seed: number;
  name: string;
  age: number;
  occupation: string;
  appearance: ResidentAppearance;
}

const SKIN_COLORS: Record<SkinToneId, string> = {
  porcelain: '#f4d2b2',
  honey: '#c98b5e',
  umber: '#9c613f',
  deep: '#6e412f',
  olive: '#c18a62',
};

const HAIR_COLORS: Record<HairColorId, string> = {
  espresso: '#2e2022',
  chestnut: '#643b2b',
  auburn: '#873f32',
  blonde: '#d8aa5b',
  silver: '#a7a4a4',
};

const CLOTHING_COLORS: Record<ClothingColorId, string> = {
  sage: '#6e8b63',
  terracotta: '#c46245',
  teal: '#257c7a',
  mustard: '#d39d37',
  plum: '#735469',
  navy: '#3f5d82',
  rose: '#ba6470',
  cream: '#e8d6b4',
  forest: '#4f6e52',
  slate: '#526270',
  charcoal: '#3f3c3a',
  rust: '#bd6133',
  coral: '#d66c58',
  sky: '#87acc3',
};

const FIRST_NAMES = ['Avery', 'Bela', 'Cleo', 'Dara', 'Emil', 'Farah', 'Gio', 'Hana', 'Iris', 'Jules', 'Kian', 'Lina', 'Miro', 'Nora', 'Oren', 'Pia'];
const OCCUPATIONS = ['Gardener', 'Baker', 'Courier', 'Harbor worker', 'Librarian', 'Teacher', 'Carpenter', 'Designer', 'Student', 'Retired'];
const SKIN_IDS = Object.keys(SKIN_COLORS) as SkinToneId[];
const HAIR_IDS = Object.keys(HAIR_COLORS) as HairColorId[];
const CLOTHING_IDS = Object.keys(CLOTHING_COLORS) as ClothingColorId[];

function mix32(value: number): number {
  let mixed = value >>> 0;
  mixed = Math.imul(mixed ^ (mixed >>> 16), 0x7feb352d);
  mixed = Math.imul(mixed ^ (mixed >>> 15), 0x846ca68b);
  return (mixed ^ (mixed >>> 16)) >>> 0;
}

function sample01(seed: number, salt: number): number {
  return mix32(seed ^ salt) / 0x100000000;
}

function choose<T>(items: readonly T[], seed: number, salt: number): T {
  return items[Math.min(items.length - 1, Math.floor(sample01(seed, salt) * items.length))]!;
}

function chooseClothing(seed: number, salt: number, disallowed: ClothingColorId[] = []): ClothingColorId {
  const eligible = CLOTHING_IDS.filter(color => !disallowed.includes(color));
  return choose(eligible, seed, salt);
}

function outfitForOccupation(occupation: string, presentation: PresentationId, seed: number): OutfitFamilyId {
  if (presentation === 'feminine' && sample01(seed, 0xf53d) < 0.7) return choose(['dress', 'skirt'] as const, seed, 0x72ab);
  // Aprons are temporarily out of the resident wardrobe; these occupations
  // retain their identity through their accessories instead.
  if (occupation === 'Gardener' || occupation === 'Baker') return 'everyday';
  if (occupation === 'Courier' || occupation === 'Designer' || occupation === 'Student') return 'jacket';
  if (occupation === 'Harbor worker' || occupation === 'Carpenter') return 'overalls';
  if (occupation === 'Librarian' || occupation === 'Teacher') return 'cardigan';
  return choose(presentation === 'feminine'
    ? ['everyday', 'cardigan', 'jacket', 'dress', 'skirt'] as const
    : ['everyday', 'cardigan', 'jacket'] as const, seed, 0x40e1);
}

function signatureFor(occupation: string, family: OutfitFamilyId, seed: number): SignaturePartId {
  if (occupation === 'Gardener') return 'seed pouch';
  if (occupation === 'Librarian') return 'book bag';
  if (occupation === 'Courier' || occupation === 'Student') return 'satchel';
  if (sample01(seed, 0xc7f8) < 0.42 && family !== 'overalls') return choose(['none', 'seed pouch', 'satchel', 'book bag'] as const, seed, 0x2fc1);
  return 'none';
}

function hairStyleFor(age: number, occupation: string, seed: number): HairStyleId {
  if (occupation === 'Harbor worker' && sample01(seed, 0x8190) < 0.85) return 'cap';
  if (age > 63 && sample01(seed, 0x8190) < 0.25) return 'bald';
  return choose(['crop', 'block', 'bob', 'bun', 'cap'] as const, seed, 0x8190);
}

export function createPrototypeResident(baseSeed: number, index: number): PrototypeResident {
  const seed = mix32(baseSeed + Math.imul(index + 1, 0x9e3779b1));
  const name = choose(FIRST_NAMES, seed, 0x11a3);
  const occupation = choose(OCCUPATIONS, seed, 0x8cf1);
  const age = occupation === 'Student'
    ? 18 + Math.floor(sample01(seed, 0x1204) * 8)
    : occupation === 'Retired'
      ? 63 + Math.floor(sample01(seed, 0x1204) * 20)
      : 24 + Math.floor(sample01(seed, 0x1204) * 39);
  const presentationRoll = sample01(seed, 0xe6a9);
  const presentation: PresentationId = presentationRoll < 0.42
    ? 'feminine'
    : presentationRoll < 0.73
      ? 'masculine'
      : 'neutral';
  const family = outfitForOccupation(occupation, presentation, seed);
  const top = chooseClothing(seed, 0x3421);
  const bottom = chooseClothing(seed, 0xa12d, [top]);
  const accent = chooseClothing(seed, 0xd6e1, [top, bottom]);
  const hairStyle = hairStyleFor(age, occupation, seed);
  const hairColor = age > 62 && sample01(seed, 0xb008) < 0.62
    ? 'silver'
    : choose(HAIR_IDS, seed, 0xb008);

  const silhouette = choose(['compact', 'balanced', 'tall'] as const, seed, 0x7d13);
  const baseBody = presentation === 'feminine'
    ? { shoulderWidth: 0.92, waistWidth: 0.76, hipWidth: 1.12 }
    : presentation === 'masculine'
      ? { shoulderWidth: 1.12, waistWidth: 0.95, hipWidth: 0.91 }
      : { shoulderWidth: 1, waistWidth: 0.87, hipWidth: 1 };
  const silhouetteScale = silhouette === 'compact' ? 1.1 : silhouette === 'tall' ? 0.93 : 1;
  const body = {
    height: silhouette === 'compact' ? 0.9 : silhouette === 'tall' ? 1.1 : 1,
    shoulderWidth: baseBody.shoulderWidth * silhouetteScale,
    waistWidth: baseBody.waistWidth * silhouetteScale,
    hipWidth: baseBody.hipWidth * silhouetteScale,
    headScale: silhouette === 'compact' ? 1.04 : silhouette === 'tall' ? 0.94 : 1,
    legRatio: silhouette === 'compact' ? 0.88 : silhouette === 'tall' ? 1.11 : 1,
  };

  const appearance: ResidentAppearance = {
    version: 1,
    presentation,
    body,
    skin: choose(SKIN_IDS, seed, 0x05d2),
    hair: { style: hairStyle, color: hairColor },
    outfit: {
      family,
      top,
      // Overalls are a single garment: keeping the serialized lower half equal
      // to the bib/strap accent ensures previews, asset details, and rendering
      // all agree on the same trouser color.
      bottom: family === 'overalls' ? accent : bottom,
      accent,
      shoes: choose(['charcoal', 'rust', 'navy', 'cream'] as const, seed, 0x5291),
    },
    face: {
      glasses: occupation === 'Librarian' || (occupation === 'Teacher' && sample01(seed, 0x19f2) < 0.55) || sample01(seed, 0x19f2) > 0.91,
      moustache: age > 35 && sample01(seed, 0x6b73) > 0.74,
    },
    signature: signatureFor(occupation, family, seed),
  };

  return { id: `prototype-resident-${index}`, seed, name, age, occupation, appearance };
}

export function getResidentColor(id: SkinToneId | HairColorId | ClothingColorId | 'ink'): string {
  if (id === 'ink') return '#292a30';
  if (id in SKIN_COLORS) return SKIN_COLORS[id as SkinToneId];
  if (id in HAIR_COLORS) return HAIR_COLORS[id as HairColorId];
  return CLOTHING_COLORS[id as ClothingColorId];
}

export function describeAppearance(resident: PrototypeResident): string {
  const { appearance } = resident;
  const family = appearance.outfit.family === 'everyday' ? 'everyday layers' : appearance.outfit.family;
  return `${resident.age}-year-old ${resident.occupation.toLowerCase()} · ${appearance.hair.style} ${appearance.hair.color} hair · ${appearance.presentation} ${family}`;
}
