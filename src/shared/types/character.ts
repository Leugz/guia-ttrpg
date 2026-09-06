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

export interface SaveState {
  dc: number;
  failed: boolean;
}

export interface DeathSaves {
  hp: SaveState;
  dp: SaveState;
}

export interface CharacterSheet {
  sheet_type: string;
  name: string;
  profile: string;
  occupation: string;
  level: number;
  color?: string;
  portrait?: string;
  token_image?: string;
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
