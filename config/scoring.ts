import type { ScoringConfig } from '../src/lib/types';

export const PREFS_VERSION = 1;
export const STORAGE_KEY = 'my-ai-news:prefs:v1';

export const SCORING: ScoringConfig = {
  wRecency: 1,
  wAffinity: 0.5,
  halfLifeDays: 3,
  alphaCategory: 0.5,
  betaSource: 0.3,
  explore: 0.05,
  wUp: 1,
  wDown: 1,
  wClick: 0.3,
};
