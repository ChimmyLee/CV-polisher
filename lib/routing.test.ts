import { describe, expect, it } from 'vitest';
import { computeWeightedScore, decideRoute, ROUTE_THRESHOLDS } from './routing';

describe('decideRoute', () => {
  it('routes to polish when relevant and coverage is high', () => {
    expect(decideRoute(true, 0.45)).toBe('polish');
    expect(decideRoute(true, 0.8)).toBe('polish');
  });

  it('routes to project when there is no relevant experience', () => {
    expect(decideRoute(false, 0.9)).toBe('project');
  });

  it('routes to project when coverage is very low', () => {
    expect(decideRoute(true, 0.19)).toBe('project');
    expect(decideRoute(true, 0)).toBe('project');
  });

  it('routes to both for partial matches', () => {
    expect(decideRoute(true, 0.2)).toBe('both');
    expect(decideRoute(true, 0.44)).toBe('both');
  });

  it('exposes thresholds used by the PRD', () => {
    expect(ROUTE_THRESHOLDS.polish).toBe(0.45);
    expect(ROUTE_THRESHOLDS.project).toBe(0.2);
  });
});

describe('computeWeightedScore', () => {
  it('applies the documented weights', () => {
    const score = computeWeightedScore({
      hard: 80,
      relevance: 60,
      keywords: 50,
      quantification: 40,
      expression: 70,
    });
    // 80*.25 + 60*.3 + 50*.2 + 40*.15 + 70*.1 = 20 + 18 + 10 + 6 + 7 = 61
    expect(score).toBe(61);
  });

  it('rounds to the nearest integer', () => {
    const score = computeWeightedScore({
      hard: 77,
      relevance: 55,
      keywords: 33,
      quantification: 44,
      expression: 66,
    });
    expect(Number.isInteger(score)).toBe(true);
  });
});
