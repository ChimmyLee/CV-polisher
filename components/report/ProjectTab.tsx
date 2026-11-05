'use client';

import { useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  CalendarDays,
  Check,
  Copy,
  ExternalLink,
  Layers,
  ListChecks,
  Rocket,
  Sparkles,
  Target,
  Wrench,
} from 'lucide-react';
import type { ProjectIdea, Report } from '@/lib/types';
import { safeExternalUrl } from '@/lib/url';

const TIER_META: Record<
  ProjectIdea['tier'],
  { label: string; range: string; note: string; className: string }
> = {
  sprint: {
    label: '速成版',
    range: '1–2 周',
    note: '最小可写进简历的闭环',
    className: 'border-line bg-card',
  },
  standard: {
    label: '标准版',
    range: '3–4 周',
    note: '主推：完整链路 + 量化结果',
    className: 'border-accent/40 bg-accent-soft',
  },
  advanced: {
    label: '进阶版',
    range: '6–8 周',
    note: '差异化亮点，冲核心岗位',
    className: 'border-line bg-card',
  },
};

function InfoCard({
  title,
  icon: Icon,
  children,
  tone = 'default',
}: {
  title: string;
  icon: typeof Target;
  children: ReactNode;
  tone?: 'default' | 'amber';
}) {
  return (
    <section
      className={`card p-4 ${tone === 'amber' ? 'border-amber/25 bg-amber-soft/40' : ''}`}
    >
      <div className="flex items-center gap-1.5">
        <Icon size={13} className={tone === 'amber' ? 'text-amber' : 'text-accent'} />
        <h4 className="text-[0.8rem] font-semibold text-ink">{title}</h4>
      </div>
      <div className="mt-2.5">{children}</div>
    </section>
  );
}

export function ProjectTab({ report }: { report: Report }) {
  const projects = report.project?.projects ?? [];
  const [tier, setTier] = useState<ProjectIdea['tier']>(() => {
    if (projects.some((project) => project.tier === 'standard')) return 'standard';
    return projects[0]?.tier ?? 'standard';
  });
  const [copied, setCopied] = useState<string | null>(null);

  const selected = projects.find((project) => project.tier === tier) ?? projects[0];

  async function copyText(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 1600);
    } catch {
      setCopied(null);
    }
  }

  if (!report.project || projects.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-line-strong bg-card/40 px-6 py-16 text-center">
        <Rocket size={24} className="mx-auto text-faint" />
        <p className="mt-3 text-[0.92rem] font-medium text-ink">本次没有生成项目方案</p>
        <p className="mx-auto mt-1.5 max-w-md text-[0.78rem] leading-6 text-muted">
          {report.gap.route === 'polish'
            ? '匹配度诊断建议优先润色现有简历，因此本次跳过了项目规划。你可以在「简历优化」查看逐条改写。'
            : '项目规划 Agent 未完成或未返回可用方案，可回到工作台重新分析一次。'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-2 rounded-xl border border-accent/20 bg-accent-soft px-4 py-3">
        <Sparkles size={15} className="mt-0.5 shrink-0 text-accent-deep" />
        <p className="text-[0.78rem] leading-6 text-accent-deep">{report.project.recommendation}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {projects.map((project, index) => {
          const meta = TIER_META[project.tier] ?? TIER_META.standard;
          const active = selected?.tier === project.tier;
          return (
            <button
              key={`${project.tier}-${index}`}
              type="button"
              onClick={() => setTier(project.tier)}
              className={`rounded-2xl border p-4 text-left transition ${
                active
                  ? 'border-accent bg-accent-soft shadow-[0_0_0_3px_rgba(31,106,85,0.06)]'
                  : 'border-line bg-card hover:border-line-strong'
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`rounded-full border px-2 py-0.5 text-[0.62rem] font-semibold ${
                    active
                      ? 'border-accent/30 bg-card text-accent-deep'
                      : 'border-line text-muted'
                  }`}
                >
                  {meta.label}
                </span>
                <span className="font-mono text-[0.62rem] text-faint">{meta.range}</span>
              </div>
              <p className="mt-2 text-[0.82rem] font-semibold leading-6 text-ink">
                {project.name}
              </p>
              <p className="mt-1 text-[0.68rem] leading-5 text-muted">{meta.note}</p>
            </button>
          );
        })}
      </div>

      {selected && (
        <>
          <section className="card p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="eyebrow">
                    {TIER_META[selected.tier]?.label ?? '项目'} ·{' '}
                    {TIER_META[selected.tier]?.range ?? ''}
                  </span>
                  <span className="chip">
                    <CalendarDays size={11} /> {selected.weeks.length} 个阶段
                  </span>
                </div>
                <h2 className="mt-2 font-serif text-[1.45rem] font-semibold leading-8 text-ink">
                  {selected.name}
                </h2>
                <p className="mt-2 max-w-2xl text-[0.84rem] leading-7 text-muted">
                  {selected.valueProposition}
                </p>
              </div>
            </div>

            {selected.stack.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {selected.stack.map((item) => (
                  <span key={item} className="chip font-mono text-[0.68rem]">
                    {item}
                  </span>
                ))}
              </div>
            )}

            {selected.features.length > 0 && (
              <div className="mt-4 border-t border-line pt-4">
                <p className="label flex items-center gap-1.5">
                  <Layers size={12} /> 核心功能
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {selected.features.map((feature) => (
                    <span
                      key={feature.name}
                      className={`chip ${
                        feature.required ? 'border-accent/20 bg-accent-soft text-accent-deep' : ''
                      }`}
                    >
                      {feature.name}
                      {feature.required ? ' · 必须' : ' · 可选'}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </section>

          <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
            <section className="card p-6">
              <div className="flex items-center gap-2">
                <CalendarDays size={16} className="text-accent" />
                <h3 className="text-[0.92rem] font-semibold text-ink">按周执行计划</h3>
              </div>

              <ol className="mt-5 space-y-5 border-l border-line pl-6">
                {selected.weeks.map((week) => (
                  <li key={week.week} className="relative">
                    <span className="absolute -left-[31px] flex h-6 w-6 items-center justify-center rounded-full border border-accent/25 bg-accent-soft font-mono text-[0.6rem] font-semibold text-accent-deep">
                      {week.week}
                    </span>
                    <div className="rounded-xl border border-line bg-paper/40 p-3.5">
                      <p className="text-[0.82rem] font-semibold leading-6 text-ink">
                        {week.goal}
                      </p>
                      {week.tasks.length > 0 && (
                        <ul className="mt-2 space-y-1">
                          {week.tasks.map((task, index) => (
                            <li
                              key={index}
                              className="flex gap-2 text-[0.75rem] leading-6 text-muted"
                            >
                              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-accent/60" />
                              {task}
                            </li>
                          ))}
                        </ul>
                      )}
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {week.deliverable && (
                          <div className="rounded-lg bg-card px-2.5 py-2">
                            <p className="font-mono text-[0.55rem] uppercase tracking-widest text-faint">
                              交付物
                            </p>
                            <p className="mt-0.5 text-[0.7rem] leading-5 text-ink">
                              {week.deliverable}
                            </p>
                          </div>
                        )}
                        {week.acceptance && (
                          <div className="rounded-lg bg-accent-soft/60 px-2.5 py-2">
                            <p className="font-mono text-[0.55rem] uppercase tracking-widest text-accent/70">
                              验收标准
                            </p>
                            <p className="mt-0.5 text-[0.7rem] leading-5 text-accent-deep">
                              {week.acceptance}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </section>

            <div className="space-y-4">
              {selected.jdMapping.length > 0 && (
                <InfoCard title="对接 JD 关键词" icon={Target}>
                  <div className="space-y-2">
                    {selected.jdMapping.map((mapping, index) => (
                      <div key={index}>
                        <span className="inline-flex rounded-full bg-accent-soft px-2 py-0.5 text-[0.65rem] font-semibold text-accent-deep">
                          {mapping.keyword}
                        </span>
                        <p className="mt-1 text-[0.7rem] leading-5 text-muted">{mapping.how}</p>
                      </div>
                    ))}
                  </div>
                </InfoCard>
              )}

              {selected.metrics.length > 0 && (
                <InfoCard title="量化指标口径" icon={ListChecks}>
                  <ul className="space-y-1.5">
                    {selected.metrics.map((metric, index) => (
                      <li key={index} className="flex gap-1.5 text-[0.72rem] leading-5 text-muted">
                        <span className="font-mono text-[0.6rem] text-accent">
                          {String(index + 1).padStart(2, '0')}
                        </span>
                        {metric}
                      </li>
                    ))}
                  </ul>
                </InfoCard>
              )}

              {selected.resumeBullets.length > 0 && (
                <InfoCard title="简历 bullet 模板" icon={Wrench}>
                  <div className="space-y-2">
                    {selected.resumeBullets.map((bullet, index) => (
                      <div
                        key={index}
                        className="rounded-lg border border-line bg-paper/60 px-2.5 py-2"
                      >
                        <p className="text-[0.72rem] leading-6 text-ink">{bullet}</p>
                        <button
                          type="button"
                          onClick={() => void copyText(bullet, `bullet-${index}`)}
                          className="mt-1.5 inline-flex items-center gap-1 text-[0.62rem] text-faint hover:text-accent"
                        >
                          {copied === `bullet-${index}` ? (
                            <>
                              <Check size={11} /> 已复制
                            </>
                          ) : (
                            <>
                              <Copy size={11} /> 复制模板
                            </>
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                </InfoCard>
              )}

              {selected.showcase && (
                <InfoCard title="展示方式" icon={Layers}>
                  <p className="text-[0.72rem] leading-6 text-muted">{selected.showcase}</p>
                </InfoCard>
              )}

              {selected.resources.length > 0 && (
                <InfoCard title="参考资源" icon={ExternalLink}>
                  <ul className="space-y-1.5">
                    {selected.resources.map((resource, index) => {
                      const href = safeExternalUrl(resource.url);
                      return (
                        <li key={index} className="text-[0.72rem] leading-5">
                          {href ? (
                            <a
                              href={href}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-accent hover:underline"
                            >
                              {resource.title}
                              <ExternalLink size={10} />
                            </a>
                          ) : (
                            <span className="text-muted">{resource.title}</span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </InfoCard>
              )}

              {selected.pitfalls && (
                <InfoCard title="避坑与差异化" icon={AlertTriangle} tone="amber">
                  <p className="text-[0.72rem] leading-6 text-amber">{selected.pitfalls}</p>
                </InfoCard>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
