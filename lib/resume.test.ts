import { describe, expect, it } from 'vitest';
import { assembleResumeMarkdown } from './resume';
import type { PolishEdit, ResumeProfile } from './types';

const profile: ResumeProfile = {
  basic: {
    name: '林晓',
    school: '华东理工大学',
    major: '信息管理与信息系统',
    degree: '本科',
    graduation: '2027.06',
    contact: 'lin.xiao@example.com',
  },
  education: [],
  internships: [
    {
      id: 'int-1',
      title: '产品运营实习生',
      org: '星野科技',
      period: '2025.06-2025.09',
      bullets: [
        { id: 'int-1-1', text: '负责社区内容选题与发布' },
        { id: 'int-1-2', text: '参与用户调研' },
      ],
    },
  ],
  projects: [],
  skills: ['SQL', 'Python'],
  awards: ['校三等奖学金'],
  rawText: '林晓\n产品运营实习生\n负责社区内容选题与发布\n参与用户调研',
};

const bulletEdit: PolishEdit = {
  id: 'e1',
  targetType: 'bullet',
  targetId: 'int-1-1',
  section: '实习经历',
  original: '负责社区内容选题与发布',
  rewritten: '设计内容选题矩阵并周更 12 篇 [待补充：篇数]',
  rationale: '',
  keywordsAdded: [],
  needsUserInput: [],
  risk: 'low',
};

const skillsEdit: PolishEdit = {
  id: 'e2',
  targetType: 'skills',
  targetId: 'skills',
  section: '专业技能',
  original: 'SQL、Python',
  rewritten: '数据分析：SQL；脚本：Python',
  rationale: '',
  keywordsAdded: [],
  needsUserInput: [],
  risk: 'low',
};

describe('assembleResumeMarkdown', () => {
  it('applies accepted bullet edits and keeps untouched bullets', () => {
    const markdown = assembleResumeMarkdown(profile, [bulletEdit], ['e1']);
    expect(markdown).toContain('设计内容选题矩阵');
    expect(markdown).not.toContain('负责社区内容选题与发布');
    expect(markdown).toContain('参与用户调研');
  });

  it('keeps the original when the edit is not accepted', () => {
    const markdown = assembleResumeMarkdown(profile, [bulletEdit], []);
    expect(markdown).toContain('负责社区内容选题与发布');
    expect(markdown).not.toContain('设计内容选题矩阵');
  });

  it('ignores reverted edits', () => {
    const markdown = assembleResumeMarkdown(
      profile,
      [{ ...bulletEdit, reverted: true }],
      ['e1'],
    );
    expect(markdown).toContain('负责社区内容选题与发布');
  });

  it('applies skills edits and renders the header', () => {
    const markdown = assembleResumeMarkdown(profile, [skillsEdit], ['e2']);
    expect(markdown).toContain('# 林晓');
    expect(markdown).toContain('华东理工大学');
    expect(markdown).toContain('数据分析：SQL；脚本：Python');
    expect(markdown).not.toContain('SQL、Python');
  });

  it('includes sections and awards', () => {
    const markdown = assembleResumeMarkdown(profile, []);
    expect(markdown).toContain('## 实习经历');
    expect(markdown).toContain('## 荣誉奖项');
    expect(markdown).toContain('校三等奖学金');
  });
});
