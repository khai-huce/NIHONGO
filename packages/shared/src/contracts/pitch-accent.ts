export type PitchVariant = { accent: number; labels: string[] };

export type PitchSource = {
  id: string; name: string; url: string; license: string; licenseUrl: string;
  version: string; attribution: string;
};

export type PitchConjugation = {
  formName: string; word: string; reading: string; variants: PitchVariant[];
  sourceUrl: string; sourceLine: number;
};

export type PitchEntry = {
  id: string; word: string; reading: string; variants: PitchVariant[];
  conjugations: PitchConjugation[]; source: PitchSource; sourceLine: number;
};

export type PitchSearchResponse = {
  query: string; items: PitchEntry[]; total: number; offset: number; limit: number;
  hasMore: boolean; catalogReady: boolean;
};
