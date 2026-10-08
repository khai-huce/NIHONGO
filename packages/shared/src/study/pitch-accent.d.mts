export type PitchMora = { text: string; high: boolean; drop: boolean };
export type PitchContour = {
  moras: PitchMora[];
  particleHigh: boolean;
  type: 'heiban' | 'atamadaka' | 'nakadaka' | 'odaka';
};

export function normalizePitchReading(input: string): string;
export function splitMoras(input: string): string[];
export function getPitchContour(reading: string, accent: number): PitchContour;
