import { randomUUID } from 'node:crypto';
import { fetchPageText } from './search';
import { getSettings, saveReport } from './store';
import { ROLE_LABELS, ROUTE_LABELS } from './keywords';
import type {
  AgentId,
  AnalyzeInput,
  GapAnalysis,
  JobProfile,
  PipelineEvent,
  ProjectPlan,
  PolishResult,
  Report,
  ResearchBrief,
  ResumeProfile,
} from './types';
import { diagnose, analyzeJob, normalizeResume, parseResume, reviewQuality } from './agents/orchestrator';
import { runPolish } from './agents/polish';
import { runProjectPlan } from './agents/planner';
import { emptyResearch, runResearch } from './agents/research';

type Emit = (event: PipelineEvent) => void;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function runAnalysis(
  input: AnalyzeInput,
  emit: Emit,
  signal: AbortSignal,
): Promise<Report> {
  const startedAt = Date.now();
  const settings = await getSettings();
  const mock = settings.mockMode;
  const ctx = { mock, signal };
  const warnings: string[] = [];

  const startAgent = (agent: AgentId, label: string) =>
    emit({ type: 'agent_start', agent, label });
  const doneAgent = (agent: AgentId, summary: string) =>
    emit({ type: 'agent_done', agent, summary });
  const skipAgent = (agent: AgentId, reason: string) =>
    emit({ type: 'agent_skip', agent, reason });

  /* ------------------------------ 1. 解析简历 ------------------------------ */
  emit({ type: 'stage', stage: 'parsing_resume', label: '解析简历' });
  startAgent('parse', '解析简历');
  let profile: ResumeProfile;
  let parseDegraded = false;
  try {
    profile = await parseResume(input.resumeText, ctx);
  } catch (error) {
    const message = errorMessage(error);
    if (!settings.llm.apiKey && !mock) {
      emit({ type: 'agent_error', agent: 'parse', message });
      throw new Error(`简历解析失败：${message}`);
    }
    // PRD 降级策略：结构化失败时保留原文，按纯文本继续
    parseDegraded = true;
    warnings.push(`简历结构化失败，已降级为纯文本模式：${message}`);
    emit({
      type: 'agent_log',
      agent: 'parse',
      message: `结构化失败，降级为纯文本模式：${message}`,
    });
    profile = normalizeResume(
      {
        basic: {},
        education: [],
        internships: [],
        projects: [],
        skills: [],
        awards: [],
      },
      input.resumeText,
    );
  }
  doneAgent(
    'parse',
    parseDegraded
      ? '简历结构化失败，已降级为纯文本模式继续分析'
      : `识别到 ${profile.education.length} 段教育、${profile.internships.length} 段实习、${profile.projects.length} 个项目`,
  );

  if (signal.aborted) throw new Error('分析已取消');

  /* -------------------------------- 2. JD -------------------------------- */
  let jdText = input.jd.trim();
  if (!jdText && input.jdUrl.trim() && !mock) {
    emit({ type: 'stage', stage: 'fetching_jd', label: '抓取岗位 JD' });
    try {
      jdText = await fetchPageText(input.jdUrl.trim());
      emit({
        type: 'warning',
        message: `已从链接抓取约 ${jdText.length} 字 JD，将在岗位分析中使用。`,
      });
    } catch (error) {
      warnings.push(`JD 链接抓取失败：${errorMessage(error)}`);
      emit({
        type: 'warning',
        message: `JD 链接抓取失败：${errorMessage(error)}。将基于岗位名称与行业常识分析。`,
      });
    }
  }
  if (mock && input.jdUrl.trim() && !jdText) {
    emit({
      type: 'warning',
      message: '演示模式不会抓取 JD 链接，岗位画像使用示例数据。',
    });
  }
  if (!jdText) {
    emit({
      type: 'warning',
      message: '未提供 JD 文本，岗位画像将基于岗位名称、公司与行业常识推断。',
    });
  }

  /* ------------------------------ 3. 岗位意图 ------------------------------ */
  emit({ type: 'stage', stage: 'analyzing_job', label: '识别岗位意图' });
  startAgent('job', '识别岗位意图');
  let job: JobProfile;
  try {
    job = await analyzeJob(input, jdText, ctx);
  } catch (error) {
    const message = errorMessage(error);
    emit({ type: 'agent_error', agent: 'job', message });
    throw new Error(`岗位意图识别失败：${message}`);
  }
  doneAgent(
    'job',
    `${job.company} · ${job.title}｜${ROLE_LABELS[job.roleFamily]}｜${job.keywords.length} 个关键词`,
  );

  if (signal.aborted) throw new Error('分析已取消');

  /* ------------------------------ 4. 匹配诊断 ------------------------------ */
  emit({ type: 'stage', stage: 'diagnosing', label: '诊断匹配度' });
  startAgent('diagnose', '诊断匹配度');
  let gap: GapAnalysis;
  try {
    gap = await diagnose(profile, job, ctx);
  } catch (error) {
    const message = errorMessage(error);
    emit({ type: 'agent_error', agent: 'diagnose', message });
    throw new Error(`匹配度诊断失败：${message}`);
  }
  doneAgent('diagnose', `匹配分 ${gap.score}｜建议：${ROUTE_LABELS[gap.route]}`);

  if (signal.aborted) throw new Error('分析已取消');

  /* ------------------------------ 5. 并行执行 ------------------------------ */
  emit({ type: 'stage', stage: 'agents_running', label: '并行执行子 Agent' });
  const searchConfigured =
    settings.search.provider !== 'none' && Boolean(settings.search.apiKey);
  const hasCompany = Boolean(job.company && job.company !== '目标公司');
  const wantResearch = hasCompany && (mock || searchConfigured);
  const wantPolish = gap.route !== 'project';
  const wantPlanner = gap.route !== 'polish';

  let research: ResearchBrief = emptyResearch('未执行联网检索。');
  let polishResult: PolishResult | undefined;
  let projectPlan: ProjectPlan | undefined;

  const tasks: Promise<void>[] = [];

  if (wantResearch) {
    tasks.push(
      (async () => {
        startAgent('research', '检索公司与岗位情报');
        try {
          const brief = await runResearch({
            job,
            input,
            ctx,
            onLog: (message) => emit({ type: 'agent_log', agent: 'research', message }),
          });
          research = brief;
          if (!brief.enabled) {
            skipAgent('research', brief.error ?? '未启用联网检索');
          } else {
            if (brief.error) {
              warnings.push(brief.error);
              emit({ type: 'warning', message: brief.error });
            }
            doneAgent(
              'research',
              brief.sources.length > 0
                ? `整理 ${brief.sources.length} 条来源与岗位情报`
                : '检索完成，但未获得可用公开信息',
            );
          }
        } catch (error) {
          const message = errorMessage(error);
          research = emptyResearch(`联网检索失败：${message}`);
          warnings.push(`联网检索失败：${message}`);
          emit({ type: 'agent_error', agent: 'research', message });
        }
      })(),
    );
  } else {
    const reason = !hasCompany
      ? '未提供公司名称，已跳过联网检索'
      : '未配置检索服务，可在设置中开启 Bocha / Tavily / Serper';
    research = emptyResearch(reason);
    skipAgent('research', reason);
  }

  if (wantPolish) {
    tasks.push(
      (async () => {
        startAgent('polish', '润色简历');
        try {
          polishResult = await runPolish({
            profile,
            job,
            gap,
            ctx,
            onLog: (message) => emit({ type: 'agent_log', agent: 'polish', message }),
          });
          const kept = polishResult.edits.filter((edit) => !edit.reverted).length;
          const reverted = polishResult.edits.filter((edit) => edit.reverted).length;
          if (!polishResult.factGuard.passed) {
            warnings.push(
              `事实护栏拦截了 ${reverted} 条改写：${polishResult.factGuard.issues.join('；')}`,
            );
          }
          doneAgent(
            'polish',
            `${kept} 条改写${reverted ? `，${reverted} 条被事实护栏回退` : ''}｜事实校验${polishResult.factGuard.passed ? '通过' : '有拦截'}`,
          );
        } catch (error) {
          const message = errorMessage(error);
          warnings.push(`简历润色失败：${message}`);
          emit({ type: 'agent_error', agent: 'polish', message });
        }
      })(),
    );
  } else {
    skipAgent('polish', '匹配度诊断建议先补齐项目，暂不改写现有简历');
  }

  if (wantPlanner) {
    tasks.push(
      (async () => {
        startAgent('planner', '规划补齐项目');
        try {
          projectPlan = await runProjectPlan({ profile, job, gap, input, ctx });
          doneAgent('planner', `生成 ${projectPlan.projects.length} 个梯度项目方案`);
        } catch (error) {
          const message = errorMessage(error);
          warnings.push(`项目规划失败：${message}`);
          emit({ type: 'agent_error', agent: 'planner', message });
        }
      })(),
    );
  } else {
    skipAgent('planner', '匹配度诊断建议优先润色现有简历，无需补项目');
  }

  await Promise.all(tasks);
  if (signal.aborted) throw new Error('分析已取消');

  if (wantPolish && !polishResult) {
    warnings.push('简历润色未完成，报告仅包含诊断结果与可执行的下一步建议。');
  }
  if (wantPlanner && !projectPlan) {
    warnings.push('项目规划未完成，可稍后重试或降低模型输出长度。');
  }

  /* ------------------------------- 6. 质量审核 ------------------------------ */
  emit({ type: 'stage', stage: 'reviewing', label: '质量审核' });
  startAgent('review', '质量审核');
  const review = await reviewQuality({
    profile,
    job,
    gap,
    polish: polishResult
      ? {
          polishedResume: polishResult.polishedResume,
          summary: polishResult.summary,
          factGuard: polishResult.factGuard,
          needsUserInput: [
            ...new Set(
              polishResult.edits
                .filter((edit) => !edit.reverted)
                .flatMap((edit) => edit.needsUserInput),
            ),
          ],
        }
      : undefined,
    project: projectPlan
      ? { projects: projectPlan.projects, recommendation: projectPlan.recommendation }
      : undefined,
    ctx,
    deterministicIssues: [],
  });
  doneAgent(
    'review',
    review.passed
      ? '质量审核通过'
      : `质量审核发现 ${review.issues.length} 个问题，已列入报告`,
  );

  /* -------------------------------- 7. 报告 ------------------------------- */
  const report: Report = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    resume: profile,
    job,
    gap,
    research,
    polish: polishResult,
    project: projectPlan,
    review,
    warnings: [...new Set(warnings)],
    meta: {
      model: mock ? 'demo' : settings.llm.model,
      durationMs: Date.now() - startedAt,
      searchEnabled: research.enabled,
      mock,
    },
  };

  await saveReport(report);
  return report;
}
