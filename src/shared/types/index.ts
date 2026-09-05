// --- Dice & Rolls ---
export interface RolledDie {
  sides: number;
  value: number;
  counted: boolean;
  source: string;
  is_highest: boolean;
  is_lowest: boolean;
}

export interface RollResult {
  dice: RolledDie[];
  rolls: number[];
  total_sum: number;
  highest: number;
  lowest: number;
  highest_index: number;
  lowest_index: number;
  dropped_index: number | null;
  is_critical_success: boolean;
  is_critical_failure: boolean;
  label: string;
  secret: boolean;
}

// --- Rules & Tests ---
export interface TestRequest {
  attribute?: string;
  skill_id?: string;
  triggered: string[];
  help?: number;
  extra_dice: number[];
  secret: boolean;
  dt?: number; // Added DT for automatic failure detection
}

export interface ResolvedDie {
  sides: number;
  source: string;
  base: boolean;
}

export interface ResolvedPool {
  dice: ResolvedDie[];
  excluded: ResolvedDie[];
  applied: string[];
  ignored: string[];
  label: string;
  secret: boolean;
}

export interface TestOutcome {
  pool: ResolvedPool;
  result: RollResult;
}

// --- Resources & Outcomes ---
export interface ResourceChange {
  kind: 'hp' | 'dp';
  previous: number;
  current: number;
  triggered_save: boolean;
  recovered: boolean;
}

export interface ResourceOutcome {
  character: CharacterSheet;
  change: ResourceChange;
  save_skill: string | null;
  save_dc: number | null;
}

export interface SaveState {
  dc: number;
  failed: boolean;
}

export interface DeathSaves {
  hp: SaveState;
  dp: SaveState;
}

export interface DeathSaveOutcome {
  resource: 'hp' | 'dp';
  result: RollResult;
  dc: number;
  success: boolean;
  state: SaveState;
  character: CharacterSheet;
}

// --- Character Sheet ---
export interface ResourceStat {
  current: number;
  max: number;
}

export interface BaseAttributes {
  physical: number;
  mind: number;
  emotion: number;
}

export interface Skill {
  id: string;
  name: string;
  governed_by: string;
  value: number;
  parent?: string;
}

export interface Effect {
  operation: string;
  quantity: number;
  unit: any;
  target?: string;
}

export interface Entry {
  id: string;
  name: string;
  description: string;
  active: boolean;
  effects: Effect[];
}

export interface ActiveEffect {
  id: string;
  name: string;
  source: string;
  effects: Effect[];
}

export interface CharacterSheet {
  sheet_type: string;
  name: string;
  profile: string;
  occupation: string;
  level: number;
  color?: string;
  /** Campaign-relative path to the portrait, e.g. `assets/portraits/alan.png`. */
  portrait?: string;
  resources: {
    hp: ResourceStat;
    dp: ResourceStat;
    impeto?: ResourceStat;
  };
  attributes: BaseAttributes;
  skills: Skill[];
  abilities: Entry[];
  inventory: Entry[];
  active_effects: ActiveEffect[];
  accessible_sheets: string[];
  death_saves: DeathSaves;
}

export interface ParsedDocument {
  data: CharacterSheet;
  body: string;
  notes: string[];
}

export interface Handout {
  id: string;
  title: string;
  category: string;
  content_type: string;
  is_public: boolean;
  shared_with: string[];
  content: string;
}

// --- Maps & Tokens ---

export interface MapDefinition {
  /** File stem of the map document, e.g. `mansao_terreo`. */
  id: string;
  title: string;
  /** Campaign-relative path to the PNG/JPEG. */
  image: string;
  /** Side of one grid square in image pixels; `0` hides the grid. */
  grid_size: number;
  /** Exactly one map is active; that is the one the table is looking at. */
  is_active: boolean;
}

/** Which death-save track a token's marker refers to. */
export type SaveIndicator = 'hp' | 'dp' | 'both';

export interface MapToken {
  id: string;
  map_id: string;
  owner_client_id: string;
  sheet_id?: string | null;
  label: string;
  color: string;
  /** Position in map-image coordinates, so it is identical on every screen. */
  x: number;
  y: number;
  grayscale: boolean;
  save_indicator?: SaveIndicator | null;
}
