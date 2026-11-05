import { chatJSON } from '../llm';
import { mockProjectPlan } from '../mock';
import { ProjectPlanSchema } from '../schemas';
import { ROLE_LABELS, SENIORITY_LABELS } from '../keywords';
import type {
  AnalyzeInput,
  GapAnalysis,
  JobProfile,
  ProjectIdea,
  ProjectPlan,
  ResumeProfile,
} from '../types';
import { PLANNER_SYSTEM } from '@/prompts/planner';
import type { AgentContext } from './orchestrator';

const TIER_ORDER: Record<string, number> = { sprint: 0, standard: 1, advanced: 2 };

function backgroundSummary(profile: ResumeProfile): string {
  const lines: string[] = [];
  if (profile.basic.school || profile.basic.major) {
    lines.push(`学校/专业：${profile.basic.school ?? '未知'} · ${profile.basic.major ?? '未知'}`);
  }
  if (profile.basic.degree || profile.basic.graduation) {
    lines.push(`学历/毕业时间：${profile.basic.degree ?? '未知'} · ${profile.basic.graduation ?? '未知'}`);
  }
  if (profile.skills.length > 0) lines.push(`已有技能：${profile.skills.join('、')}`);
  const experiences = [
    ...profile.internships.map((item) => `实习：${item.title}${item.org ? ` @ ${item.org}` : ''}`),
    ...profile.projects.map((item) => `项目：${item.title}`),
  ];
  if (experiences.length > 0) lines.push(`已有经历：${experiences.join('；')}`);
  if (lines.length === 0) lines.push('候选人未提供详细背景信息');
  return lines.join('\n');
}

export async function runProjectPlan(params: {
  profile: ResumeProfile;
  job: JobProfile;
  gap: GapAnalysis;
  input: AnalyzeInput;
  ctx: AgentContext;
}): Promise<ProjectPlan> {
  const { profile, job, gap, input, ctx } = params;

  if (ctx.mock) {
    return mockProjectPlan(job, input);
  }

  const user = `请为候选人设计 3 个梯度项目方案。

【目标岗位】
${job.company} · ${job.title}
方向：${ROLE_LABELS[job.roleFamily]}
场景：${SENIORITY_LABELS[job.seniority]}
岗位画像：${job.summary}
核心职责：
${job.responsibilities.map((item) => `- ${item}`).join('\n')}
核心关键词：
${job.keywords
    .slice(0, 15)
    .map((keyword) => `${keyword.term}(${keyword.weight})`)
    .join('、')}

【候选人背景】
${backgroundSummary(profile)}

【匹配诊断】
总分：${gap.score}
关键差距：
${gap.gaps.map((item) => `- [${item.severity}] ${item.item}`).join('\n')}
缺失关键词：${gap.keywordCoverage.missing
    .slice(0, 10)
    .map((keyword) => keyword.term)
    .join('、') || '无'}

【时间预算】
候选人每周可投入约 6-12 小时，总可用时间约 ${input.weeks} 周。请仍然输出 sprint（1-2 周）、standard（3-4 周）、advanced（6-8 周）三个梯度，供候选人选择。

请输出 projects 与 recommendation。`;

  const raw = await chatJSON({
    system: PLANNER_SYSTEM,
    user,
    schema: ProjectPlanSchema,
    temperature: 0.6,
    maxTokens: 8000,
    signal: ctx.signal,
  });

  const projects = raw.projects
    .filter((project) => project.name.trim().length > 0)
    .map((project) => ({
      ...project,
      weeks: [...project.weeks].sort((a, b) => a.week - b.week),
    }));

  // 保证三个梯度唯一：模型偶尔会重复 tier，按索引回退到缺失的档位
  const tierOrder: Array<ProjectIdea['tier']> = ['sprint', 'standard', 'advanced'];
  const usedTiers = new Set<ProjectIdea['tier']>();
  const normalized = projects.map((project, index) => {
    let tier = project.tier;
    const fallback = tierOrder.find((candidate) => !usedTiers.has(candidate));
    if (usedTiers.has(tier) && fallback) tier = fallback;
    usedTiers.add(tier);
    return { ...project, tier };
  });

  const sorted = normalized.sort(
    (a, b) => (TIER_ORDER[a.tier] ?? 9) - (TIER_ORDER[b.tier] ?? 9),
  );

  if (sorted.length === 0) {
    throw new Error('模型未返回可用的项目方案，请重试。');
  }

  return {
    projects: sorted,
    recommendation:
      raw.recommendation ||
      '建议优先完成标准版项目：周期可控，且能覆盖岗位的核心关键词。',
  };
}
