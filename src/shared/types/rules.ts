import type { CharacterSheet, SaveState } from './character';
import type { RollResult } from './dice';

export interface TestRequest {
  attribute?: string;
  skill_id?: string;
  triggered: string[];
  help?: number;
  extra_dice: number[];
  secret: boolean;
  dt?: number;
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

export interface DeathSaveOutcome {
  resource: 'hp' | 'dp';
  result: RollResult;
  dc: number;
  success: boolean;
  state: SaveState;
  character: CharacterSheet;
}
