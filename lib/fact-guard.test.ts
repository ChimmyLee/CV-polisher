import { describe, expect, it } from 'vitest';
import { findUnsupportedNumbers, guardEdits, resumeLengthStats } from './fact-guard';
import type { PolishEdit, ResumeProfile } from './types';

const profile: ResumeProfile = {
  basic: { name: '林晓' },
  education: [],
  internships: [
    {
      id: 'int-1',
      title: '产品运营实习生',
      org: '星野科技',
      period: '2025.06-2025.09',
      bullets: [
        { id: 'int-1-1', text: '负责社区内容选题，互动量提升 30%' },
      ],
    },
  ],
  projects: [],
  skills: ['SQL'],
  awards: [],
  rawText:
    '林晓\n产品运营实习生\n负责社区内容选题，互动量提升 30%\n设计问卷并回收 120 份有效样本',
};

function makeEdit(overrides: Partial<PolishEdit>): PolishEdit {
  return {
    id: 'e1',
    targetType: 'bullet',
    targetId: 'int-1-1',
    section: '实习经历 · 星野科技',
    original: '负责社区内容选题，互动量提升 30%',
    rewritten: '负责社区内容选题与发布，互动量提升 30%',
    rationale: '补全动作',
    keywordsAdded: [],
    needsUserInput: [],
    risk: 'low',
    ...overrides,
  };
}

describe('findUnsupportedNumbers', () => {
  it('flags numbers not present in the original resume', () => {
    expect(findUnsupportedNumbers('互动量提升 30%', '互动量提升 50%')).toEqual(['50%']);
  });

  it('keeps numbers that exist in the original', () => {
    expect(findUnsupportedNumbers('互动量提升 30%', '互动量提升 30%')).toEqual([]);
  });

  it('ignores [待补充] placeholders', () => {
    expect(
      findUnsupportedNumbers(
        '样本 120 份，互动量提升 30%',
        '互动量提升 [待补充：百分比]，样本 120 份',
      ),
    ).toEqual([]);
  });
});

describe('guardEdits', () => {
  it('keeps a grounded rewrite', () => {
    const result = guardEdits([makeEdit({})], profile);
    expect(result.issues).toEqual([]);
    expect(result.edits[0]?.reverted).toBeUndefined();
    expect(result.edits[0]?.original).toBe('负责社区内容选题，互动量提升 30%');
  });

  it('reverts a rewrite that introduces a new number', () => {
    const result = guardEdits([makeEdit({ rewritten: '互动量提升 50%' })], profile);
    expect(result.edits[0]?.reverted).toBe(true);
    expect(result.edits[0]?.guardNote).toContain('50%');
    expect(result.issues).toHaveLength(1);
  });

  it('reverts a bullet edit with an unknown target id', () => {
    const result = guardEdits([makeEdit({ targetId: 'int-9-9' })], profile);
    expect(result.edits[0]?.reverted).toBe(true);
    expect(result.issues[0]).toContain('未找到对应原文条目');
  });

  it('allows placeholders in a rewrite', () => {
    const result = guardEdits(
      [makeEdit({ rewritten: '互动量提升 [待补充：百分比]，样本 120 份' })],
      profile,
    );
    expect(result.issues).toEqual([]);
    expect(result.edits[0]?.reverted).toBeUndefined();
  });

  it('reverts empty rewrites', () => {
    const result = guardEdits([makeEdit({ rewritten: '   ' })], profile);
    expect(result.edits[0]?.reverted).toBe(true);
  });
});

describe('resumeLengthStats', () => {
  it('counts bullets and non-whitespace characters outside headings', () => {
    const stats = resumeLengthStats('# 林晓\n## 实习经历\n- 第一项\n- 第二项');
    expect(stats.bullets).toBe(2);
    expect(stats.characters).toBe(8); // “-第一项-第二项”.length = 8
  });
});
