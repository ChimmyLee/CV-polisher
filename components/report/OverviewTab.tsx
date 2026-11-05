'use client';

import {
  AlertTriangle,
  CheckCircle2,
  CircleAlert,
  Gauge,
  ListChecks,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { ScoreRing } from '@/components/ScoreRing';
import { RouteBadge } from '@/components/RouteBadge';
import { ROLE_LABELS } from '@/lib/keywords';
import type { GapItem, Report } from '@/lib/types';

const SEVERITY: Record<GapItem['severity'], { label: string; className: string }> = {
  high: { label: '高', className: 'bg-danger-soft text-danger border-danger/20' },
  medium: { label: '中', className: 'bg-amber-soft text-amber border-amber/20' },
  low: { label: '低', className: 'bg-paper text-muted border-line' },
};

const DIMENSIONS: Array<{ key: keyof Report['gap']['dimensions']; label: string; weight: string }> = [
  { key: 'hard', label: '硬性条件', weight: '25%' },
  { key: 'relevance', label: '经历相关性', weight: '30%' },
  { key: 'keywords', label: '关键词覆盖', weight: '20%' },
  { key: 'quantification', label: '成果量化', weight: '15%' },
  { key: 'expression', label: '表达质量', weight: '10%' },
];

function scoreVerdict(score: number): string {
  if (score >= 75) return '匹配度高，重点打磨表达';
  if (score >= 55) return '有基础，补齐短板后可冲';
  return '差距明显，建议先补关键项目';
}

function barColor(value: number): string {
  if (value >= 70) return 'var(--color-accent)';
  if (value >= 45) return 'var(--color-amber)';
  return 'var(--color-danger)';
}

export function OverviewTab({ report }: { report: Report }) {
  const { gap, job, review } = report;
  const coverageAfter = Math.round(review.keywordCoverageAfter * 100);
  const coverageBefore = Math.round(review.keywordCoverageBefore * 100);

  return (
    <div className="space-y-5">
      {report.warnings.length > 0 && (
        <div className="rounded-xl border border-amber/25 bg-amber-soft p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle size={15} className="text-amber" />
            <p className="text-[0.8rem] font-semibold text-amber">流程提示</p>
          </div>
          <ul className="mt-2 space-y-1">
            {report.warnings.map((warning, index) => (
              <li key={index} className="text-[0.74rem] leading-6 text-amber">
                · {warning}
              </li>
            ))}
          </ul>
        </div>
      )}

      {report.meta.mock && (
        <div className="flex items-start gap-2 rounded-xl border border-amber/25 bg-amber-soft px-4 py-3">
          <Sparkles size={15} className="mt-0.5 shrink-0 text-amber" />
          <p className="text-[0.76rem] leading-6 text-amber">
            本报告来自演示模式：简历、诊断、改写与项目方案均为示例数据，用于展示完整结构与界面。
            配置真实模型后重新分析即可获得针对你简历的结果。
          </p>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-5">
          <section className="card p-6">
            <div className="flex flex-wrap items-center gap-6">
              <ScoreRing score={gap.score} />
              <div className="min-w-[180px] flex-1">
                <p className="eyebrow">Match Score</p>
                <h2 className="mt-1.5 font-serif text-[1.35rem] font-semibold text-ink">
                  {scoreVerdict(gap.score)}
                </h2>
                <p className="mt-2 text-[0.78rem] leading-6 text-muted">
                  基于硬性条件、经历相关性、关键词覆盖、成果量化与表达质量加权计算。
                </p>
                <div className="mt-3">
                  <RouteBadge route={gap.route} />
                </div>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              {DIMENSIONS.map((dimension) => {
                const value = Math.round(gap.dimensions[dimension.key]);
                return (
                  <div key={dimension.key}>
                    <div className="flex items-center justify-between text-[0.75rem]">
                      <span className="text-muted">
                        {dimension.label}
                        <span className="ml-1.5 font-mono text-[0.6rem] text-faint">
                          {dimension.weight}
                        </span>
                      </span>
                      <span className="font-mono text-[0.72rem] font-semibold text-ink">
                        {value}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${value}%`, backgroundColor: barColor(value) }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="card p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Gauge size={16} className="text-accent" />
                <h3 className="text-[0.92rem] font-semibold text-ink">岗位画像</h3>
              </div>
              <span className="chip">{ROLE_LABELS[job.roleFamily]}</span>
            </div>
            <p className="mt-3 text-[0.82rem] leading-7 text-ink/90">{job.summary}</p>

            {job.mustHave.length > 0 && (
              <div className="mt-4">
                <p className="label">硬性要求</p>
                <ul className="space-y-1.5">
                  {job.mustHave.map((item, index) => (
                    <li key={index} className="flex gap-2 text-[0.76rem] leading-6 text-muted">
                      <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-accent" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {job.hiddenRequirements.length > 0 && (
              <div className="mt-4">
                <p className="label">隐性偏好</p>
                <div className="flex flex-wrap gap-1.5">
                  {job.hiddenRequirements.map((item, index) => (
                    <span key={index} className="chip">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {job.responsibilities.length > 0 && (
              <details className="mt-4 rounded-xl border border-line bg-paper/40 px-3 py-2.5">
                <summary className="cursor-pointer select-none text-[0.78rem] font-semibold text-ink">
                  核心职责（{job.responsibilities.length}）
                </summary>
                <ul className="mt-2 space-y-1.5">
                  {job.responsibilities.map((item, index) => (
                    <li
                      key={index}
                      className="flex gap-2 text-[0.76rem] leading-6 text-muted"
                    >
                      <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-accent" />
                      {item}
                    </li>
                  ))}
                </ul>
              </details>
            )}

            <div className="mt-4">
              <p className="label">高权重关键词</p>
              <div className="flex flex-wrap gap-1.5">
                {job.keywords.slice(0, 14).map((keyword) => (
                  <span
                    key={keyword.term}
                    className={`chip ${
                      gap.keywordCoverage.covered.some((item) => item.term === keyword.term)
                        ? 'border-accent/20 bg-accent-soft text-accent-deep'
                        : ''
                    }`}
                  >
                    {keyword.term}
                    <span className="font-mono text-[0.6rem] opacity-60">{keyword.weight}</span>
                  </span>
                ))}
              </div>
            </div>
          </section>
        </div>

        <div className="space-y-5">
          <section className="card p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CircleAlert size={16} className="text-amber" />
                <h3 className="text-[0.92rem] font-semibold text-ink">诊断结论</h3>
              </div>
              <RouteBadge route={gap.route} />
            </div>
            <p className="mt-3 text-[0.8rem] leading-7 text-muted">{gap.routeReason}</p>
            <p className="mt-2 text-[0.76rem] leading-6 text-faint">{gap.relevanceReason}</p>

            <div className="mt-4 border-t border-line pt-4">
              <p className="label">关键差距</p>
              <div className="space-y-2.5">
                {gap.gaps.map((gapItem, index) => (
                  <div
                    key={index}
                    className="rounded-xl border border-line bg-paper/40 px-3 py-2.5"
                  >
                    <div className="flex items-start gap-2">
                      <span
                        className={`mt-0.5 inline-flex shrink-0 rounded-full border px-1.5 py-0.5 text-[0.6rem] font-semibold ${SEVERITY[gapItem.severity].className}`}
                      >
                        {SEVERITY[gapItem.severity].label}
                      </span>
                      <p className="text-[0.78rem] leading-6 font-medium text-ink">
                        {gapItem.item}
                      </p>
                    </div>
                    <p className="mt-1 pl-7 text-[0.72rem] leading-6 text-muted">
                      {gapItem.suggestion}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="card p-6">
            <div className="flex items-center gap-2">
              <ShieldCheck size={16} className="text-accent" />
              <h3 className="text-[0.92rem] font-semibold text-ink">审核与下一步</h3>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              <div className="rounded-xl bg-paper/60 px-2 py-3 text-center">
                <p className="font-mono text-[0.6rem] uppercase tracking-wider text-faint">
                  coverage
                </p>
                <p className="mt-1 text-[0.85rem] font-semibold text-ink">
                  {coverageBefore}% → {coverageAfter}%
                </p>
              </div>
              <div className="rounded-xl bg-paper/60 px-2 py-3 text-center">
                <p className="font-mono text-[0.6rem] uppercase tracking-wider text-faint">
                  fact guard
                </p>
                <p
                  className={`mt-1 flex items-center justify-center gap-1 text-[0.78rem] font-semibold ${
                    report.polish
                      ? report.polish.factGuard.passed
                        ? 'text-accent'
                        : 'text-danger'
                      : 'text-muted'
                  }`}
                >
                  {report.polish ? (
                    report.polish.factGuard.passed ? (
                      <>
                        <CheckCircle2 size={12} /> 通过
                      </>
                    ) : (
                      <>
                        <AlertTriangle size={12} /> 有拦截
                      </>
                    )
                  ) : (
                    '未执行'
                  )}
                </p>
              </div>
              <div className="rounded-xl bg-paper/60 px-2 py-3 text-center">
                <p className="font-mono text-[0.6rem] uppercase tracking-wider text-faint">
                  length
                </p>
                <p
                  className={`mt-1 text-[0.78rem] font-semibold ${
                    review.lengthCheck.overOnePage ? 'text-amber' : 'text-ink'
                  }`}
                >
                  {review.lengthCheck.characters} 字
                </p>
              </div>
            </div>

            <div className="mt-4">
              <p className="label flex items-center gap-1.5">
                <ListChecks size={12} /> 下一步行动
              </p>
              <ol className="space-y-1.5">
                {review.nextActions.map((action, index) => (
                  <li key={index} className="flex gap-2 text-[0.76rem] leading-6 text-muted">
                    <span className="font-mono text-[0.62rem] text-accent">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    {action}
                  </li>
                ))}
              </ol>
            </div>

            {review.issues.length > 0 && (
              <div className="mt-4 rounded-xl border border-amber/25 bg-amber-soft px-3 py-2.5">
                <p className="text-[0.72rem] font-semibold text-amber">审核发现</p>
                <ul className="mt-1 space-y-1">
                  {review.issues.map((issue, index) => (
                    <li key={index} className="text-[0.7rem] leading-5 text-amber">
                      · {issue}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
