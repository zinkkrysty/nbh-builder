/**
 * Cozy Road Streetscapes layout constants and cardinal topology helpers.
 * Reference: docs/proposals/cozy-road-streetscapes.md
 */

export const ROAD_LAYOUT = {
  // Tile dimensions (meters / local world units)
  TILE_SIZE: 2.0,
  HALF_TILE: 1.0,

  // Cross-section dimensions
  CARRIAGEWAY_WIDTH: 1.28,
  HALF_CARRIAGEWAY: 0.64,

  SIDEWALK_WIDTH: 0.16,

  // Vertical offsets above tile elevation datum
  CARRIAGEWAY_THICKNESS: 0.04,
  CARRIAGEWAY_Y: 0.02,        // Box center
  CARRIAGEWAY_SURFACE_Y: 0.04,
  SIDEWALK_Y: 0.04,           // Default box center; its surface follows sidewalkHeight

  // Carriageway topology
  CARRIAGEWAY_ARM_LENGTH: 0.36,
  CARRIAGEWAY_ARM_CENTER_OFFSET: 0.82,

  // Simulation & path offsets
  LANE_OFFSET: 0.31,
  SIDEWALK_OFFSET: 0.85,
  CAR_SCALE: 0.98,

} as const;

export interface StreetscapeSettings {
  sidewalkWidth: number;
  sidewalkHeight: number;
  sidewalkOffset: number;
  sidewalkColor: string;
  curbWidth: number;
  curbHeight: number;
  curbBevel: number;
  curbColor: string;
  asphaltColor: string;
  lineColor: string;
  showCrosswalks: boolean;
}

export const DEFAULT_STREETSCAPE_SETTINGS: StreetscapeSettings = {
  sidewalkWidth: ROAD_LAYOUT.SIDEWALK_WIDTH,
  sidewalkHeight: 0.04,
  sidewalkOffset: ROAD_LAYOUT.SIDEWALK_OFFSET,
  sidewalkColor: '#a0a0a0',
  curbWidth: 0.04,
  curbHeight: 0.03,
  curbBevel: 0.00,
  curbColor: '#dfd7cd',
  asphaltColor: '#334155',
  lineColor: '#ffffff',
  showCrosswalks: true,
};

export const currentStreetscapeSettings: StreetscapeSettings = { ...DEFAULT_STREETSCAPE_SETTINGS };

export interface CardinalConnections {
  N: boolean;
  S: boolean;
  E: boolean;
  W: boolean;
}

export function countConnections(conn: CardinalConnections): number {
  return (conn.N ? 1 : 0) + (conn.S ? 1 : 0) + (conn.E ? 1 : 0) + (conn.W ? 1 : 0);
}
