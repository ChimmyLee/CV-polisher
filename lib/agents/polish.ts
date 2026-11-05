import { chatJSON } from '../llm';
import { guardEdits } from '../fact-guard';
import { assembleResumeMarkdown } from '../resume';
import { mockPolish } from '../mock';
import { FactGuardLlmSchema, PolishLlmSchema } from '../schemas';
import type { GapAnalysis, JobProfile, PolishEdit, PolishResult, ResumeProfile } from '../types';
import { FACT_GUARD_SYSTEM, POLISH_SYSTEM } from '@/prompts/polish';
import type { AgentContext } from './orchestrator';

function compactProfile(profile: ResumeProfile) {
  const mapExperience = (experience: ResumeProfile['education'][number]) => ({
    id: experience.id,
    title: experience.title,
    org: experience.org,
    period: experience.period,
    bullets: experience.bullets,
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

function sectionForBullet(profile: ResumeProfile, targetId?: string): string {
  for (const [label, group] of [
    ['教育经历', profile.education],
    ['实习经历', profile.internships],
    ['项目经历', profile.projects],
  ] as const) {
    for (const experience of group) {
      if (experience.bullets.some((bullet) => bullet.id === targetId)) {
        return `${label} · ${experience.title}${experience.org ? ` · ${experience.org}` : ''}`;
      }
    }
  }
  return '简历内容';
}

function buildPrompt(profile: ResumeProfile, job: JobProfile, gap: GapAnalysis): string {
  const missing = gap.keywordCoverage.missing
    .slice(0, 12)
    .map((keyword) => `${keyword.term}(${keyword.weight})`)
    .join('、');
  return `请改写下面这份简历。

【原简历（结构化，bullet 含 id）】
${JSON.stringify(compactProfile(profile), null, 2).slice(0, 18_000)}

【目标岗位】
${JSON.stringify(
    {
      company: job.company,
      title: job.title,
      roleFamily: job.roleFamily,
      seniority: job.seniority,
      mustHave: job.mustHave,
      responsibilities: job.responsibilities,
      hiddenRequirements: job.hiddenRequirements,
      summary: job.summary,
    },
    null,
    2,
  ).slice(0, 6_000)}

【匹配诊断】
总分：${gap.score}
路由建议：${gap.route}
诊断理由：${gap.routeReason}
关键差距：
${gap.gaps.map((item) => `- [${item.severity}] ${item.item}：${item.suggestion}`).join('\n')}

【关键词覆盖】
总覆盖率：${Math.round(gap.keywordCoverage.rate * 100)}%
缺失关键词（按权重）：${missing || '无'}

请逐条改写，输出 edits 与 summary。记住：不得编造任何事实或数字，缺失数据用 [待补充：...] 占位。`;
}

function fillOriginals(
  edits: PolishEdit[],
  profile: ResumeProfile,
): PolishEdit[] {
  const bulletMap = new Map<string, string>();
  for (const group of [profile.education, profile.internships, profile.projects]) {
    for (const experience of group) {
      for (const bullet of experience.bullets) {
        bulletMap.set(bullet.id, bullet.text);
      }
    }
  }

  return edits.map((edit) => {
    const next = { ...edit };
    if (edit.targetType === 'bullet' && edit.targetId && bulletMap.has(edit.targetId)) {
      next.original = bulletMap.get(edit.targetId)!;
      if (!next.section || next.section === '简历内容') {
        next.section = sectionForBullet(profile, edit.targetId);
      }
    } else if (edit.targetType === 'skills') {
      next.targetId = 'skills';
      next.section = next.section || '专业技能';
      next.original = profile.skills.join('、');
    } else if (edit.targetType === 'summary') {
      next.targetId = 'self-evaluation';
      next.section = next.section || '自我评价';
      next.original = profile.selfEvaluation ?? '';
    }
    return next;
  });
}

async function auditWithModel(
  profile: ResumeProfile,
  edits: PolishEdit[],
  ctx: AgentContext,
  onLog?: (message: string) => void,
): Promise<{ issues: string[]; reverted: Set<string> }> {
  const candidates = edits.filter((edit) => !edit.reverted);
  if (candidates.length === 0 || ctx.mock) {
    return { issues: [], reverted: new Set() };
  }

  try {
    onLog?.('正在进行事实一致性审核…');
    const payload = candidates.map((edit) => ({
      editId: edit.id,
      bulletId: edit.targetId,
      section: edit.section,
      original: edit.original,
      rewritten: edit.rewritten,
      needsUserInput: edit.needsUserInput,
    }));

    const audit = await chatJSON({
      system: FACT_GUARD_SYSTEM,
      user: `【原简历全文】\n${profile.rawText.slice(0, 24_000)}\n\n【改写结果列表】\n${JSON.stringify(payload, null, 2).slice(0, 12_000)}`,
      schema: FactGuardLlmSchema,
      temperature: 0.1,
      maxTokens: 1500,
      signal: ctx.signal,
    });

    const issues: string[] = [];
    const reverted = new Set<string>();
    for (const issue of audit.issues) {
      const problem = issue.problem?.trim();
      if (!problem) continue;
      const target =
        candidates.find((edit) => edit.id === issue.targetId) ??
        candidates.find((edit) => edit.targetId === issue.targetId);
      if (target) {
        reverted.add(target.id);
        issues.push(`${target.section}：${problem}（已回退该条改写）`);
      } else {
        issues.push(`事实审核：${problem}`);
      }
    }
    if (!audit.passed && issues.length === 0) {
      issues.push('事实审核未通过，但未给出具体条目，请人工复核。');
    }
    return { issues, reverted };
  } catch {
    onLog?.('事实审核模型调用失败，已采用规则校验结果。');
    return { issues: [], reverted: new Set() };
  }
}

export async function runPolish(params: {
  profile: ResumeProfile;
  job: JobProfile;
  gap: GapAnalysis;
  ctx: AgentContext;
  onLog?: (message: string) => void;
}): Promise<PolishResult> {
  const { profile, job, gap, ctx, onLog } = params;

  if (ctx.mock) {
    const mock = mockPolish(profile, job);
    const guarded = guardEdits(mock.edits, profile);
    return {
      ...mock,
      edits: guarded.edits,
      polishedResume: assembleResumeMarkdown(profile, guarded.edits),
      factGuard: { passed: guarded.issues.length === 0, issues: guarded.issues },
    };
  }

  const prompt = buildPrompt(profile, job, gap);
  const bulletCount = [profile.education, profile.internships, profile.projects]
    .flat()
    .reduce((total, experience) => total + experience.bullets.length, 0);
  const minEdits = Math.max(1, Math.min(3, bulletCount));
  let rawEdits: PolishEdit[] = [];
  let summary = '';

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const raw = await chatJSON({
      system: POLISH_SYSTEM,
      user:
        attempt === 0
          ? prompt
          : `${prompt}\n\n注意：上一次返回的有效改写不足。请至少给出 ${minEdits} 条针对 bullet 的改写（使用输入中真实存在的 targetId），不要返回空数组。`,
      schema: PolishLlmSchema,
      temperature: 0.25,
      maxTokens: 6000,
      signal: ctx.signal,
    });

    summary = raw.summary;
    rawEdits = raw.edits
      .map((edit, index) => ({
        id: `e${index + 1}`,
        targetType: edit.targetType,
        targetId: edit.targetId,
        section: edit.section,
        original: edit.original,
        rewritten: edit.rewritten?.trim() ?? '',
        rationale: edit.rationale?.trim() || '对齐岗位要求，强化动作与结果表达。',
        keywordsAdded: edit.keywordsAdded.filter(Boolean),
        needsUserInput: edit.needsUserInput.filter(Boolean),
        risk: edit.risk,
      }))
      .filter((edit) => edit.rewritten.length > 0);

    if (rawEdits.length >= minEdits) break;
  }

  if (rawEdits.length === 0) {
    throw new Error('模型未返回任何可用的简历改写，请重试或更换模型。');
  }

  const filled = fillOriginals(rawEdits, profile);
  const prepared = filled.map((edit) =>
    edit.targetType === 'skills' && profile.skills.length === 0
      ? {
          ...edit,
          reverted: true,
          guardNote: '原简历没有技能列表，已回退该改写',
        }
      : edit,
  );
  const preIssues = prepared
    .filter((edit) => edit.reverted && edit.guardNote)
    .map((edit) => `${edit.section}：${edit.guardNote}`);
  const guarded = guardEdits(prepared, profile);

  const audit = await auditWithModel(profile, guarded.edits, ctx, onLog);
  const auditIssues = [...audit.issues];
  const edits = guarded.edits.map((edit) => {
    if (!audit.reverted.has(edit.id)) return edit;
    return {
      ...edit,
      reverted: true,
      guardNote: edit.guardNote ?? '事实审核发现新增信息，已回退',
    };
  });

  const issues = [...new Set([...preIssues, ...guarded.issues, ...auditIssues])];
  const polishedResume = assembleResumeMarkdown(profile, edits);
  const needsUserInput = [
    ...new Set(
      edits
        .filter((edit) => !edit.reverted)
        .flatMap((edit) => edit.needsUserInput)
        .filter(Boolean),
    ),
  ];

  return {
    edits,
    polishedResume,
    summary:
      summary ||
      `共改写 ${edits.filter((edit) => !edit.reverted).length} 条内容；请补充标记为待补充的数据后再导出。`,
    factGuard: { passed: issues.length === 0, issues },
  };
}
