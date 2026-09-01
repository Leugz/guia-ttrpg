export const ATRIBUTO_PERICIA_MAP = {
  fisico: [
    'Acrobacia', 'Atletismo', 'Crime', 'Furtividade', 
    'Luta', 'Pontaria', 'Vigor'
  ],
  mente: [
    'Aptidão', 'Máquinas', 'Medicina', 'Ocultismo', 
    'Percepção', 'Pesquisar', 'Sobrevivência', 'Tecnologia'
  ],
  emocao: [
    'Disciplina', 'Enganação', 'Intimidar', 'Intuição', 'Persuasão'
  ],
} as const;

export enum StepDice {
  D4 = "D4",
  D6 = "D6",
  D8 = "D8",
  D10 = "D10",
  D12 = "D12",
}

export interface RollResult {
  rolls: number[];
  total_sum: number;
  highest: number;
  lowest: number;
  is_critical_success: boolean;
  is_critical_failure: boolean;
}
