import { chatJSON } from '../llm';
import {
  computeKeywordCoverage,
  DIRECTION_LABELS,
  libraryKeywordsFor,
  mergeKeywords,
  ROLE_LABELS,
  SENIORITY_LABELS,
} from '../keywords';
import { mockGap, mockJobProfile, mockResumeProfile } from '../mock';
import {
  GapLlmSchema,
  JobProfileSchema,
  ResumeProfileSchema,
  ReviewLlmSchema,
  type ResumeProfileRaw,
} from '../schemas';
import type {
  AnalyzeInput,
  Experience,
  GapAnalysis,
  JobKeyword,
  JobProfile,
  QualityReview,
  ResumeProfile,
  RoleFamily,
} from '../types';
import { assembleResumeMarkdown } from '../resume';
import { resumeLengthStats } from '../fact-guard';
import { computeWeightedScore, decideRoute } from '../routing';
import { GAP_ANALYSIS_SYSTEM } from '@/prompts/gap';
import { JOB_ANALYSIS_SYSTEM } from '@/prompts/job';
import { RESUME_PARSE_SYSTEM } from '@/prompts/parse';
import { REVIEW_SYSTEM } from '@/prompts/review';

export interface AgentContext {
  mock: boolean;
  signal?: AbortSignal;
}

function trimOptional(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function cleanList(values: string[] | undefined): string[] {
  return (values ?? []).map((value) => value.trim()).filter(Boolean);
}

function toExperiences(
  list: ResumeProfileRaw['education'] | undefined,
  prefix: 'edu' | 'int' | 'prj',
): Experience[] {
  return (list ?? [])
    .map((experience, index) => {
      const bullets = (experience.bullets ?? [])
        .map((bullet, bulletIndex) => ({
          id: `${prefix}-${index + 1}-${bulletIndex + 1}`,
          text: (bullet.text ?? '').trim(),
        }))
        .filter((bullet) => bullet.text.length > 0);

      return {
        id: `${prefix}-${index + 1}`,
        title: (experience.title ?? '').trim(),
        org: trimOptional(experience.org),
        period: trimOptional(experience.period),
        bullets,
      };
    })
    .filter((experience) => experience.bullets.length > 0 || experience.title);
}

function fallbackExperience(rawText: string): Experience[] {
  const lines = rawText
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 3)
    .slice(0, 14);
  if (lines.length === 0) return [];
  const title = lines[0].slice(0, 40);
  const bullets = lines.slice(1).map((line, index) => ({
    id: `prj-1-${index + 1}`,
    text: line.replace(/^[-•·*]\s*/, ''),
  }));
  return [{ id: 'prj-1', title, bullets }];
}

export function normalizeResume(raw: ResumeProfileRaw, rawText: string): ResumeProfile {
  const education = toExperiences(raw.education, 'edu');
  const internships = toExperiences(raw.internships, 'int');
  const projects = toExperiences(raw.projects, 'prj');

  const nonEmpty = education.length > 0 || internships.length > 0 || projects.length > 0;
  if (!nonEmpty) {
    projects.push(...fallbackExperience(rawText));
  }

  const skills = [...new Set(cleanList(raw.skills))];
  const awards = [...new Set(cleanList(raw.awards))];

  return {
    basic: {
      name: trimOptional(raw.basic?.name),
      school: trimOptional(raw.basic?.school),
      major: trimOptional(raw.basic?.major),
      degree: trimOptional(raw.basic?.degree),
      graduation: trimOptional(raw.basic?.graduation),
      contact: trimOptional(raw.basic?.contact),
    },
    education,
    internships,
    projects,
    skills,
    awards,
    selfEvaluation: trimOptional(raw.selfEvaluation),
    rawText: rawText.trim(),
  };
}

export async function parseResume(text: string, ctx: AgentContext): Promise<ResumeProfile> {
  if (ctx.mock) return mockResumeProfile();

  const raw = await chatJSON({
    system: RESUME_PARSE_SYSTEM,
    user: `请解析下面这份简历，严格按 JSON 结构返回：\n\n${text.slice(0, 24_000)}`,
    schema: ResumeProfileSchema,
    temperature: 0.1,
    maxTokens: 4000,
    signal: ctx.signal,
  });

  return normalizeResume(raw, text);
}

const DIRECTION_FAMILY: Record<AnalyzeInput['direction'], RoleFamily> = {
  tech: 'backend',
  algorithm: 'algorithm',
  product: 'product',
  design: 'design',
  other: 'other',
};

const FAMILY_ALIASES: Record<string, RoleFamily> = {
  后端: 'backend',
  服务端: 'backend',
  前端: 'frontend',
  客户端: 'client',
  算法: 'algorithm',
  数据: 'data',
  数据分析: 'data',
  产品: 'product',
  产品经理: 'product',
  运营: 'operations',
  产品运营: 'operations',
  用户运营: 'operations',
  设计: 'design',
  交互设计: 'design',
  测试: 'test',
  测试开发: 'test',
  其他: 'other',
};

export function coerceRoleFamily(value: string, direction: AnalyzeInput['direction']): RoleFamily {
  const normalized = value?.trim().toLowerCase();
  const valid: RoleFamily[] = [
    'backend',
    'frontend',
    'client',
    'algorithm',
    'data',
    'product',
    'operations',
    'design',
    'test',
    'other',
  ];
  if (valid.includes(normalized as RoleFamily) && normalized !== 'other') {
    return normalized as RoleFamily;
  }
  if (value && FAMILY_ALIASES[value.trim()]) return FAMILY_ALIASES[value.trim()];
  return DIRECTION_FAMILY[direction] ?? 'other';
}

export function normalizeJob(
  raw: {
    company: string;
    title: string;
    roleFamily: RoleFamily;
    seniority: JobProfile['seniority'];
    mustHave: string[];
    niceToHave: string[];
    responsibilities: string[];
    keywords: Array<{ term: string; weight: number; aliases: string[] }>;
    hiddenRequirements: string[];
    summary: string;
  },
  input: AnalyzeInput,
  jdText: string,
): JobProfile {
  const roleFamily = coerceRoleFamily(raw.roleFamily, input.direction);
  const modelKeywords: JobKeyword[] = (raw.keywords ?? [])
    .map((keyword) => ({
      term: keyword.term?.trim() ?? '',
      weight: Number.isFinite(keyword.weight) ? Math.max(1, Math.min(3, Math.round(keyword.weight))) : 2,
      aliases: cleanList(keyword.aliases),
    }))
    .filter((keyword) => keyword.term.length > 0);

  const keywords = mergeKeywords(modelKeywords, libraryKeywordsFor(roleFamily, jdText));
  const inputSeniority: JobProfile['seniority'] =
    input.seniority === 'intern' ? 'intern' : input.seniority === 'campus' ? 'campus' : 'social';

  return {
    company: raw.company?.trim() || input.company.trim() || '目标公司',
    title: raw.title?.trim() || input.title.trim() || `${ROLE_LABELS[roleFamily]}（方向）`,
    roleFamily,
    seniority: raw.seniority === 'other' ? inputSeniority : raw.seniority,
    mustHave: cleanList(raw.mustHave),
    niceToHave: cleanList(raw.niceToHave),
    responsibilities: cleanList(raw.responsibilities),
    keywords: keywords.length > 0 ? keywords : libraryKeywordsFor(roleFamily, ''),
    hiddenRequirements: cleanList(raw.hiddenRequirements),
    summary: raw.summary?.trim() || `${ROLE_LABELS[roleFamily]}方向岗位`,
  };
}

function compactResume(profile: ResumeProfile) {
  const mapExperience = (experience: Experience) => ({
    id: experience.id,
    title: experience.title,
    org: experience.org,
    period: experience.period,
    bullets: experience.bullets.map((bullet) => ({ id: bullet.id, text: bullet.text })),
  });
  return {
    basic: profile.basic,
    education: profile.education.map(mapExperience),
    internships: profile.internships.map(mapExperience),
    projects: profile.projects.map(mapExperience),
    skills: profile.skills,
    awards: profile.awards,
    selfEvaluation: profile.selfEvaluation,
  };
}

export async function analyzeJob(
  input: AnalyzeInput,
  jdText: string,
  ctx: AgentContext,
): Promise<JobProfile> {
  if (ctx.mock) return mockJobProfile(input);

  const user = `请分析以下目标岗位的意图画像。

公司：${input.company.trim() || '未提供'}
岗位名称：${input.title.trim() || '未提供'}
求职场景：${SENIORITY_LABELS[input.seniority] ?? input.seniority}
目标方向：${DIRECTION_LABELS[input.direction] ?? input.direction}
可投入准备时间：${input.weeks} 周

JD 原文：
${jdText.trim() ? jdText.slice(0, 12_000) : '（未提供 JD；请基于岗位名称、公司类型与行业常识推断，并在 summary 末尾注明"（基于岗位名称推断）"）'}`;

  const raw = await chatJSON({
    system: JOB_ANALYSIS_SYSTEM,
    user,
    schema: JobProfileSchema,
    temperature: 0.2,
    maxTokens: 3000,
    signal: ctx.signal,
  });

  return normalizeJob(raw, input, jdText);
}

function buildRouteReason(
  route: GapAnalysis['route'],
  coverageRate: number,
  hasRelevant: boolean,
  relevanceReason: string,
): string {
  const percent = Math.round(coverageRate * 100);
  const shortReason = relevanceReason.split(/[。；]/)[0]?.slice(0, 90) ?? '';
  if (route === 'polish') {
    return `岗位关键词覆盖 ${percent}%，且已有可直接迁移的经历${shortReason ? `（${shortReason}）` : ''}。建议优先润色现有简历，把已有经历对齐岗位要求。`;
  }
  if (route === 'project') {
    return `岗位关键词覆盖仅 ${percent}%，${hasRelevant ? '相关经历的深度不足' : '缺少与岗位直接相关的实习或项目'}。建议先补一个能直接对应 JD 的项目，再回头润色简历。`;
  }
  return `已有部分可迁移经历，但岗位关键词覆盖 ${percent}%，仍未达到有竞争力的水平。建议双线推进：先润色已有经历，同时补一个能覆盖核心关键词的桥接项目。`;
}

export async function diagnose(
  profile: ResumeProfile,
  job: JobProfile,
  ctx: AgentContext,
): Promise<GapAnalysis> {
  if (ctx.mock) return mockGap(profile, job);

  const coverage = computeKeywordCoverage(profile.rawText, job.keywords);
  const coveredPreview = coverage.covered.slice(0, 12).map((item) => item.term).join('、') || '无';
  const missingPreview =
    coverage.missing.slice(0, 12).map((item) => `${item.term}(${item.weight})`).join('、') || '无';

  const user = `请评估候选人与目标岗位的匹配度。

【结构化简历】
${JSON.stringify(compactResume(profile), null, 2).slice(0, 18_000)}

【目标岗位画像】
${JSON.stringify(
    {
      company: job.company,
      title: job.title,
      roleFamily: ROLE_LABELS[job.roleFamily],
      seniority: SENIORITY_LABELS[job.seniority],
      mustHave: job.mustHave,
      niceToHave: job.niceToHave,
      responsibilities: job.responsibilities,
      hiddenRequirements: job.hiddenRequirements,
      summary: job.summary,
    },
    null,
    2,
  ).slice(0, 6_000)}

【关键词覆盖（系统计算）】
总覆盖率：${Math.round(coverage.rate * 100)}%
已覆盖：${coveredPreview}
缺失：${missingPreview}

请输出 dimensions、hasRelevantExperience、relevanceReason 与 gaps。`;

  const raw = await chatJSON({
    system: GAP_ANALYSIS_SYSTEM,
    user,
    schema: GapLlmSchema,
    temperature: 0.2,
    maxTokens: 3000,
    signal: ctx.signal,
  });

  const rawDimensions = {
    hard: raw.dimensions.hard,
    relevance: raw.dimensions.relevance,
    quantification: raw.dimensions.quantification,
    expression: raw.dimensions.expression,
  };
  const usesUnitScale = Object.values(rawDimensions).every(
    (value) => value >= 0 && value <= 1,
  );
  const scale = usesUnitScale ? 100 : 1;
  const clampScore = (value: number) => Math.max(0, Math.min(100, Math.round(value * scale)));

  const dimensions = {
    hard: clampScore(rawDimensions.hard),
    relevance: clampScore(rawDimensions.relevance),
    keywords: Math.round(coverage.rate * 100),
    quantification: clampScore(rawDimensions.quantification),
    expression: clampScore(rawDimensions.expression),
  };

  const score = computeWeightedScore(dimensions);

  const route = decideRoute(raw.hasRelevantExperience, coverage.rate);

  const gaps = [...raw.gaps];
  const gapText = gaps.map((gap) => gap.item).join(' ');
  for (const missing of coverage.missing.filter((item) => item.weight >= 3).slice(0, 2)) {
    if (gapText.includes(missing.term)) continue;
    gaps.push({
      item: `高权重关键词「${missing.term}」在简历中缺乏对应内容`,
      severity: 'high',
      suggestion: `先检查现有经历中是否有能自然体现「${missing.term}」的部分；若确实没有，优先用项目方案补齐，而不是在简历中硬塞关键词。`,
    });
  }

  return {
    score,
    dimensions,
    gaps: gaps.slice(0, 8),
    keywordCoverage: coverage,
    route,
    routeReason: buildRouteReason(route, coverage.rate, raw.hasRelevantExperience, raw.relevanceReason),
    hasRelevantExperience: raw.hasRelevantExperience,
    relevanceReason: raw.relevanceReason,
  };
}

export async function reviewQuality(params: {
  profile: ResumeProfile;
  job: JobProfile;
  gap: GapAnalysis;
  polish?: { polishedResume: string; summary: string; factGuard: { passed: boolean; issues: string[] }; needsUserInput: string[] };
  project?: { projects: unknown[]; recommendation: string };
  ctx: AgentContext;
  deterministicIssues: string[];
}): Promise<QualityReview> {
  const { profile, job, gap, polish, ctx } = params;
  const finalText = polish?.polishedResume ?? profile.rawText;
  const coverageAfter = computeKeywordCoverage(finalText, job.keywords);
  const stats = resumeLengthStats(finalText);
  const overOnePage = stats.characters > 1800 || stats.bullets > 20;

  const issues = [...params.deterministicIssues];
  if (overOnePage) {
    issues.push(`简历约 ${stats.characters} 字、${stats.bullets} 条 bullet，超过一页建议阈值，建议压缩。`);
  }
  if (!profile.basic.contact) {
    issues.push('未识别到联系方式，请在简历顶部补充邮箱/电话。');
  }
  if (polish && !polish.factGuard.passed) {
    issues.push(...polish.factGuard.issues);
  }

  const base: QualityReview = {
    passed: issues.length === 0,
    issues: [...new Set(issues)],
    keywordCoverageBefore: gap.keywordCoverage.rate,
    keywordCoverageAfter: coverageAfter.rate,
    lengthCheck: {
      characters: stats.characters,
      bullets: stats.bullets,
      overOnePage,
    },
    nextActions: [],
  };

  if (ctx.mock) {
    return {
      ...base,
      nextActions: [
        '补充改写中标记为 [待补充] 的真实数据，再导出正式简历。',
        '按目标岗位调整经历顺序，把最相关的实习放在最前。',
        '完成项目方案中的速成版或标准版，并把可量化结果写回简历。',
        '投递前用一页纸检查：联系方式、教育时间、岗位关键词是否齐全。',
      ],
    };
  }

  const fallbackActions = [
    ...new Set([
      ...(polish?.needsUserInput.map((item) => `补充数据：${item}`).slice(0, 4) ?? []),
      ...gap.gaps.slice(0, 3).map((item) => item.suggestion),
    ]),
  ].slice(0, 6);

  if (!polish) {
    return {
      ...base,
      nextActions:
        fallbackActions.length > 0
          ? fallbackActions
          : ['按项目方案完成一个可量化项目，并把结果写回简历。', '投递前检查联系方式与教育时间。'],
    };
  }

  try {
    const user = `请审核以下简历润色结果。

【目标岗位】${job.company} · ${job.title}
岗位画像：${job.summary}
核心关键词：${job.keywords
      .slice(0, 12)
      .map((keyword) => `${keyword.term}(${keyword.weight})`)
      .join('、')}

【原简历】
${profile.rawText.slice(0, 8000)}

【润色后简历】
${polish.polishedResume.slice(0, 8000)}

【系统检查】
- 关键词覆盖率：${Math.round(gap.keywordCoverage.rate * 100)}% → ${Math.round(coverageAfter.rate * 100)}%
- 长度：${stats.characters} 字，${stats.bullets} 条 bullet，${overOnePage ? '超过一页建议阈值' : '在一页范围内'}
- 事实护栏：${polish.factGuard.passed ? '通过' : `未通过：${polish.factGuard.issues.join('；')}`}
- 已发现问题：${issues.length > 0 ? issues.join('；') : '无'}
- 润色摘要：${polish.summary}
- 待用户补充：${polish.needsUserInput.join('；') || '无'}

请给出 passed、issues、nextActions。`;

    const raw = await chatJSON({
      system: REVIEW_SYSTEM,
      user,
      schema: ReviewLlmSchema,
      temperature: 0.15,
      maxTokens: 2000,
      signal: ctx.signal,
    });

    const mergedIssues = [...new Set([...base.issues, ...raw.issues.filter(Boolean)])];
    return {
      passed: raw.passed && polish.factGuard.passed,
      issues: mergedIssues,
      keywordCoverageBefore: gap.keywordCoverage.rate,
      keywordCoverageAfter: coverageAfter.rate,
      lengthCheck: base.lengthCheck,
      nextActions: [...new Set([...raw.nextActions.filter(Boolean), ...fallbackActions])].slice(0, 8),
    };
  } catch {
    return {
      ...base,
      nextActions: fallbackActions.length > 0 ? fallbackActions : ['补充待补数据后再投递。'],
    };
  }
}

export function resumeToPlainMarkdown(profile: ResumeProfile): string {
  return assembleResumeMarkdown(profile, []);
}
