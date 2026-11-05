import { describe, expect, it } from 'vitest';
import { computeKeywordCoverage, hasTerm, mergeKeywords } from './keywords';

describe('hasTerm', () => {
  it('matches Chinese terms as substrings', () => {
    expect(hasTerm('负责用户调研与需求分析', '用户调研')).toBe(true);
    expect(hasTerm('负责用户调研与需求分析', '竞品分析')).toBe(false);
  });

  it('does not match short English terms inside longer words', () => {
    expect(hasTerm('曾在 Google 实习', 'Go')).toBe(false);
    expect(hasTerm('熟悉 Golang', 'Go')).toBe(false);
    expect(hasTerm('我们用 Go 写服务', 'Go')).toBe(true);
  });

  it('matches English terms case-insensitively with boundaries', () => {
    expect(hasTerm('熟悉 react 和 typescript', 'React')).toBe(true);
    expect(hasTerm('使用 Node.js 开发', 'Node.js')).toBe(true);
    expect(hasTerm('使用 Node.js 开发', 'Node')).toBe(true);
  });
});

describe('computeKeywordCoverage', () => {
  const keywords = [
    { term: 'React', weight: 3, aliases: [] as string[] },
    { term: 'Vue', weight: 2, aliases: [] as string[] },
    { term: 'TypeScript', weight: 2, aliases: [] as string[] },
    { term: 'Webpack', weight: 1, aliases: [] as string[] },
  ];

  it('computes weighted coverage and missing keywords', () => {
    const coverage = computeKeywordCoverage(
      '熟悉 React 与 TypeScript，使用 Webpack 构建',
      keywords,
    );
    expect(coverage.total).toBe(4);
    expect(coverage.covered.map((item) => item.term)).toEqual([
      'React',
      'TypeScript',
      'Webpack',
    ]);
    expect(coverage.missing.map((item) => item.term)).toEqual(['Vue']);
    expect(coverage.rate).toBeCloseTo(6 / 8);
  });

  it('matches aliases and reports the alias used', () => {
    const coverage = computeKeywordCoverage('用数据驱动的方式做增长实验', [
      { term: '数据分析', weight: 2, aliases: ['数据驱动'] },
    ]);
    expect(coverage.rate).toBe(1);
    expect(coverage.covered[0]?.matchedVia).toBe('数据驱动');
  });

  it('returns 0 for an empty keyword list', () => {
    const coverage = computeKeywordCoverage('任意简历内容', []);
    expect(coverage.rate).toBe(0);
    expect(coverage.total).toBe(0);
  });
});

describe('mergeKeywords', () => {
  it('deduplicates by normalized term and keeps the higher weight', () => {
    const merged = mergeKeywords(
      [{ term: 'SQL', weight: 1, aliases: ['MySQL'] }],
      [
        { term: 'sql', weight: 3, aliases: ['结构化查询'] },
        { term: 'Python', weight: 2, aliases: [] },
      ],
    );

    expect(merged).toHaveLength(2);
    const sql = merged.find((keyword) => keyword.term.toLowerCase() === 'sql');
    expect(sql?.weight).toBe(3);
    expect(sql?.aliases).toContain('MySQL');
    expect(sql?.aliases).toContain('结构化查询');
    expect(merged[0]?.weight).toBeGreaterThanOrEqual(merged[1]?.weight ?? 0);
  });

  it('clamps weights into 1..3', () => {
    const merged = mergeKeywords(
      [
        { term: 'A', weight: 0, aliases: [] },
        { term: 'B', weight: 99, aliases: [] },
      ],
      [],
    );
    expect(merged.find((item) => item.term === 'A')?.weight).toBe(1);
    expect(merged.find((item) => item.term === 'B')?.weight).toBe(3);
  });
});
