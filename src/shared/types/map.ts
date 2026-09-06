export interface MapDefinition {
  id: string;
  title: string;
  image: string;
  grid_size: number;
  is_active: boolean;
}

export type SaveIndicator = 'hp' | 'dp' | 'both';

export interface MapToken {
  id: string;
  map_id: string;
  owner_client_id: string;
  sheet_id?: string | null;
  label: string;
  color: string;
  x: number;
  y: number;
  grayscale: boolean;
  save_indicator?: SaveIndicator | null;
}
