import type { DimensionScores, RouteType } from './types';

export const ROUTE_THRESHOLDS = {
  polish: 0.45,
  project: 0.2,
} as const;

/**
 * 混合路由规则：
 * - 有相关经历且关键词覆盖 >= 45% → 优先润色
 * - 无相关经历或覆盖 < 20% → 补项目
 * - 其余 → 润色 + 补项目
 */
export function decideRoute(
  hasRelevantExperience: boolean,
  coverageRate: number,
): RouteType {
  if (hasRelevantExperience && coverageRate >= ROUTE_THRESHOLDS.polish) {
    return 'polish';
  }
  if (!hasRelevantExperience || coverageRate < ROUTE_THRESHOLDS.project) {
    return 'project';
  }
  return 'both';
}

export function computeWeightedScore(dimensions: DimensionScores): number {
  return Math.round(
    dimensions.hard * 0.25 +
      dimensions.relevance * 0.3 +
      dimensions.keywords * 0.2 +
      dimensions.quantification * 0.15 +
      dimensions.expression * 0.1,
  );
}
