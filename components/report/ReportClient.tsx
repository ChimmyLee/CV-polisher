'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { ExportButtons } from '@/components/report/ExportButtons';
import { KeywordsTab } from '@/components/report/KeywordsTab';
import { OverviewTab } from '@/components/report/OverviewTab';
import { PolishTab } from '@/components/report/PolishTab';
import { ProjectTab } from '@/components/report/ProjectTab';
import { ResearchTab } from '@/components/report/ResearchTab';
import { RouteBadge } from '@/components/RouteBadge';
import { ROLE_LABELS, SENIORITY_LABELS } from '@/lib/keywords';
import type { Report } from '@/lib/types';

type TabId = 'overview' | 'polish' | 'project' | 'research' | 'keywords';

export function ReportClient({ report }: { report: Report }) {
  const [tab, setTab] = useState<TabId>('overview');
  const [accepted, setAccepted] = useState<string[]>(
    () => report.polish?.edits.filter((edit) => !edit.reverted).map((edit) => edit.id) ?? [],
  );

  const keptPolish = report.polish?.edits.filter((edit) => !edit.reverted).length ?? 0;
  const created = new Date(report.createdAt);

  const tabs: Array<{ id: TabId; label: string; count?: number }> = [
    { id: 'overview', label: '总览' },
    { id: 'polish', label: '简历优化', count: keptPolish },
    { id: 'project', label: '项目方案', count: report.project?.projects.length },
    { id: 'research', label: '公司情报' },
    { id: 'keywords', label: '关键词', count: report.gap.keywordCoverage.total },
  ];

  return (
    <div>
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-[0.75rem] text-muted transition hover:text-accent"
      >
        <ArrowLeft size={13} /> 返回工作台
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-5">
        <div className="min-w-0">
          <p className="eyebrow" suppressHydrationWarning>
            Report ·{' '}
            {created.toLocaleString('zh-CN', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
          <h1 className="mt-2 font-serif text-[1.9rem] leading-tight font-semibold tracking-tight text-ink sm:text-[2.3rem]">
            {report.job.company}
            <span className="mx-2 text-faint">·</span>
            {report.job.title}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <RouteBadge route={report.gap.route} />
            <span className="chip">匹配分 {report.gap.score}</span>
            <span className="chip">{ROLE_LABELS[report.job.roleFamily]}</span>
            <span className="chip">{SENIORITY_LABELS[report.job.seniority]}</span>
            <span className="chip font-mono text-[0.66rem]">{report.meta.model}</span>
            <span className="chip">
              {Math.max(1, Math.round(report.meta.durationMs / 1000))}s
            </span>
            {report.meta.mock && (
              <span className="chip border-amber/25 bg-amber-soft text-amber">演示数据</span>
            )}
          </div>
        </div>
        <ExportButtons report={report} acceptedEditIds={accepted} />
      </div>

      <nav className="sticky top-16 z-30 -mx-5 mt-6 border-b border-line bg-paper/90 px-5 backdrop-blur-md sm:-mx-8 sm:px-8">
        <div className="scroll-thin flex flex-nowrap gap-1 overflow-x-auto">
          {tabs.map((item) => {
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`relative flex shrink-0 items-center gap-1.5 px-3 py-3 text-[0.8rem] font-medium transition ${
                  active ? 'text-ink' : 'text-muted hover:text-ink'
                }`}
              >
                {item.label}
                {typeof item.count === 'number' && item.count > 0 && (
                  <span className="rounded-full bg-paper px-1.5 py-0.5 font-mono text-[0.56rem] text-faint">
                    {item.count}
                  </span>
                )}
                {active && (
                  <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-accent" />
                )}
              </button>
            );
          })}
        </div>
      </nav>

      <div className="mt-5">
        {tab === 'overview' && <OverviewTab report={report} />}
        {tab === 'polish' && (
          <PolishTab report={report} accepted={accepted} setAccepted={setAccepted} />
        )}
        {tab === 'project' && <ProjectTab report={report} />}
        {tab === 'research' && <ResearchTab report={report} />}
        {tab === 'keywords' && <KeywordsTab report={report} />}
      </div>

      <p className="mt-10 text-center text-[0.68rem] leading-6 text-faint">
        报告由多个 Agent 协作生成；改写与建议请在投递前自行核对真实性。所有数据保存在本机。
      </p>
    </div>
  );
}
