import type { Report } from './types';
import {
  ROLE_LABELS,
  ROUTE_LABELS,
  SENIORITY_LABELS,
} from './keywords';
import { assembleResumeMarkdown } from './resume';
import { safeExternalUrl } from './url';

const TIER_LABELS = {
  sprint: '速成版（1–2 周）',
  standard: '标准版（3–4 周）',
  advanced: '进阶版（6–8 周）',
} as const;

const SEVERITY_LABELS = {
  high: '高',
  medium: '中',
  low: '低',
} as const;

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function reportToMarkdown(
  report: Report,
  acceptedEditIds?: string[],
): string {
  const { job, gap, research, polish, project, review } = report;
  const lines: string[] = [];

  lines.push(`# ${job.company} · ${job.title} — 简历打磨报告`);
  lines.push(
    [
      `> 生成时间：${report.createdAt}`,
      `匹配分：**${gap.score}**`,
      `建议：**${ROUTE_LABELS[gap.route]}**`,
      `方向：${ROLE_LABELS[job.roleFamily]}｜场景：${SENIORITY_LABELS[job.seniority]}`,
      report.meta.mock ? '> 演示模式：本报告为示例数据。' : '',
    ]
      .filter(Boolean)
      .join('  \n> '),
  );

  /* -------------------------------- 诊断 -------------------------------- */
  lines.push('## 一、匹配度诊断');
  lines.push(
    [
      `- 硬性条件：${gap.dimensions.hard}`,
      `- 经历相关性：${gap.dimensions.relevance}`,
      `- 关键词覆盖：${gap.dimensions.keywords}`,
      `- 成果量化：${gap.dimensions.quantification}`,
      `- 表达质量：${gap.dimensions.expression}`,
    ].join('\n'),
  );
  lines.push(`**路由理由**：${gap.routeReason}`);
  lines.push(`**相关性判断**：${gap.relevanceReason}`);

  if (gap.gaps.length > 0) {
    lines.push('### 关键差距');
    lines.push(
      gap.gaps
        .map(
          (item, index) =>
            `${index + 1}. **[${SEVERITY_LABELS[item.severity]}] ${item.item}**\n   ${item.suggestion}`,
        )
        .join('\n'),
    );
  }

  lines.push('### 关键词覆盖');
  lines.push(
    `加权覆盖率：**${pct(gap.keywordCoverage.rate)}**（共 ${gap.keywordCoverage.total} 个关键词）`,
  );
  lines.push(
    `- 已覆盖：${gap.keywordCoverage.covered.map((item) => item.term).join('、') || '无'}`,
  );
  lines.push(
    `- 缺失：${gap.keywordCoverage.missing.map((item) => item.term).join('、') || '无'}`,
  );

  /* -------------------------------- 润色 -------------------------------- */
  lines.push('## 二、简历优化');
  if (polish) {
    lines.push(polish.summary);
    if (!polish.factGuard.passed) {
      lines.push(
        `> **事实护栏提示**：\n> ${polish.factGuard.issues.map((issue) => `- ${issue}`).join('\n> ')}`,
      );
    }
    lines.push('### 逐条改写');
    for (const [index, edit] of polish.edits.entries()) {
      lines.push(
        `#### ${index + 1}. ${edit.section}${edit.reverted ? '（已回退）' : ''}\n\n` +
          `- 原文：${edit.original}\n` +
          `- 改写：${edit.rewritten}\n` +
          `- 理由：${edit.rationale}\n` +
          (edit.keywordsAdded.length > 0
            ? `- 融入关键词：${edit.keywordsAdded.join('、')}\n`
            : '') +
          (edit.needsUserInput.length > 0
            ? `- 待补充：${edit.needsUserInput.join('；')}\n`
            : '') +
          (edit.guardNote ? `- 护栏说明：${edit.guardNote}\n` : ''),
      );
    }
    lines.push('### 最终简历');
    lines.push(assembleResumeMarkdown(report.resume, polish.edits, acceptedEditIds));
  } else {
    lines.push('本次未生成简历改写（路由建议先补齐项目，或润色 Agent 未完成）。');
  }

  /* -------------------------------- 项目 -------------------------------- */
  lines.push('## 三、项目补齐方案');
  if (project && project.projects.length > 0) {
    lines.push(project.recommendation);
    for (const idea of project.projects) {
      lines.push(`### ${TIER_LABELS[idea.tier]}：${idea.name}`);
      lines.push(`> ${idea.valueProposition}`);
      lines.push(`- 技术栈 / 工具：${idea.stack.join('、') || '按方案'}`);
      if (idea.jdMapping.length > 0) {
        lines.push(
          `- 对应 JD：${idea.jdMapping.map((mapping) => `${mapping.keyword}（${mapping.how}）`).join('；')}`,
        );
      }
      if (idea.features.length > 0) {
        lines.push(
          `- 核心功能：${idea.features.map((feature) => feature.name).join('、')}`,
        );
      }
      if (idea.metrics.length > 0) {
        lines.push(`- 量化口径：${idea.metrics.join('；')}`);
      }
      if (idea.weeks.length > 0) {
        lines.push('#### 执行计划');
        for (const week of idea.weeks) {
          lines.push(
            `**第 ${week.week} 周：${week.goal}**\n` +
              (week.tasks.length > 0 ? `- 任务：${week.tasks.join('；')}\n` : '') +
              (week.deliverable ? `- 交付物：${week.deliverable}\n` : '') +
              (week.acceptance ? `- 验收：${week.acceptance}\n` : ''),
          );
        }
      }
      if (idea.resumeBullets.length > 0) {
        lines.push(`#### 简历 bullet 模板\n${idea.resumeBullets.map((bullet) => `- ${bullet}`).join('\n')}`);
      }
      if (idea.showcase) lines.push(`- 展示方式：${idea.showcase}`);
      if (idea.pitfalls) lines.push(`- 避坑与差异化：${idea.pitfalls}`);
      if (idea.resources.length > 0) {
        lines.push(
          `- 参考资源：${idea.resources
            .map((resource) => {
              const href = safeExternalUrl(resource.url);
              return href ? `[${resource.title}](${href})` : resource.title;
            })
            .join('；')}`,
        );
      }
    }
  } else {
    lines.push('本次未生成项目方案。');
  }

  /* -------------------------------- 情报 -------------------------------- */
  lines.push('## 四、公司 / 岗位情报');
  if (research.enabled) {
    if (research.companyOverview) lines.push(`### 公司 / 业务概况\n${research.companyOverview}`);
    if (research.roleInsight) lines.push(`### 岗位真实画像\n${research.roleInsight}`);
    if (research.interviewProcess) lines.push(`### 面试流程与考察点\n${research.interviewProcess}`);
    if (research.recentNews.length > 0) {
      lines.push(`### 近期动态\n${research.recentNews.map((news) => `- ${news}`).join('\n')}`);
    }
    if (research.applicationTips.length > 0) {
      lines.push(
        `### 投递与面试建议\n${research.applicationTips.map((tip) => `- ${tip}`).join('\n')}`,
      );
    }
    if (research.sources.length > 0) {
      lines.push(
        `### 来源\n${research.sources
          .map((source) => {
            const href = safeExternalUrl(source.url);
            return href ? `${source.id}. [${source.title}](${href})` : `${source.id}. ${source.title}`;
          })
          .join('\n')}`,
      );
    }
    if (research.error) lines.push(`> 检索提示：${research.error}`);
  } else {
    lines.push(`未启用联网检索：${research.error ?? '未配置检索服务'}`);
  }

  /* -------------------------------- 审核 -------------------------------- */
  lines.push('## 五、质量审核与下一步');
  lines.push(
    `- 事实护栏：${report.polish ? (report.polish.factGuard.passed ? '通过' : '有拦截') : '未执行'}\n` +
      `- 关键词覆盖：${pct(review.keywordCoverageBefore)} → ${pct(review.keywordCoverageAfter)}\n` +
      `- 简历长度：${review.lengthCheck.characters} 字、${review.lengthCheck.bullets} 条 bullet${review.lengthCheck.overOnePage ? '（超过一页建议值）' : ''}\n` +
      `- 审核结论：${review.passed ? '通过' : '待处理'}`,
  );
  if (review.issues.length > 0) {
    lines.push(`### 审核问题\n${review.issues.map((issue) => `- ${issue}`).join('\n')}`);
  }
  if (review.nextActions.length > 0) {
    lines.push(
      `### 下一步行动\n${review.nextActions
        .map((action, index) => `${index + 1}. ${action}`)
        .join('\n')}`,
    );
  }
  if (report.warnings.length > 0) {
    lines.push(`### 流程提示\n${report.warnings.map((warning) => `- ${warning}`).join('\n')}`);
  }

  return lines.join('\n\n');
}
