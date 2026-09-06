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
