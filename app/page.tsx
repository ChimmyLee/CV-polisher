'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowUpRight,
  PenLine,
  Rocket,
  Sparkles,
  Target,
  Trash2,
} from 'lucide-react';
import { ROUTE_LABELS } from '@/lib/keywords';
import type { ReportSummary } from '@/lib/types';

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const FEATURES = [
  {
    icon: Target,
    title: '岗位意图识别',
    desc: '拆解 JD 的硬性要求、隐性偏好与带权关键词，先搞清楚岗位真正在筛什么。',
  },
  {
    icon: PenLine,
    title: '简历润色',
    desc: '逐条 before / after 改写，STAR 结构 + 关键词对齐，事实护栏拦住编造。',
  },
  {
    icon: Rocket,
    title: '项目补齐',
    desc: '三档项目方案：周计划、验收标准、量化口径与可直接套用的 bullet 模板。',
  },
];

const PIPELINE = [
  { label: '主控 Agent', note: '意图识别 · 诊断 · 路由', accent: true },
  { label: '联网检索 Agent', note: '公司 / 岗位情报' },
  { label: '简历润色 Agent', note: '逐条改写 + 事实校验' },
  { label: '项目规划 Agent', note: '可执行的补齐方案' },
];

export default function HomePage() {
  const [reports, setReports] = useState<ReportSummary[] | null>(null);

  useEffect(() => {
    let alive = true;
    fetch('/api/history', { cache: 'no-store' })
      .then((response) => response.json())
      .then((data) => {
        if (alive) setReports(Array.isArray(data.reports) ? data.reports : []);
      })
      .catch(() => {
        if (alive) setReports([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  async function removeReport(id: string) {
    if (!window.confirm('删除这份报告？删除后不可恢复。')) return;
    const response = await fetch(`/api/history?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (response.ok) {
      setReports((current) => (current ?? []).filter((item) => item.id !== id));
    }
  }

  return (
    <div className="pb-6">
      <section className="grid items-end gap-10 pt-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="fade-up">
          <p className="eyebrow">Resume Atelier · 互联网校招 & 实习</p>
          <h1 className="mt-4 font-serif text-[2.7rem] leading-[1.12] font-semibold tracking-tight text-ink sm:text-[3.4rem]">
            把简历，调到
            <br />
            <span className="text-accent">岗位的频道</span>上。
          </h1>
          <p className="mt-5 max-w-xl text-[0.95rem] leading-7 text-muted">
            上传简历、填入目标岗位。主控 Agent 识别岗位意图、诊断匹配度，再按需调度润色、项目规划与
            联网检索三个子 Agent，给出能直接执行的下一步。
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link href="/analyze" className="btn btn-primary">
              开始一次分析
              <ArrowUpRight size={16} />
            </Link>
            <Link href="/settings" className="btn btn-ghost">
              配置模型与检索
            </Link>
            <span className="ml-1 hidden items-center gap-1.5 text-[0.75rem] text-faint sm:flex">
              <Sparkles size={13} /> 无 Key 可用演示模式
            </span>
          </div>
        </div>

        <div className="card relative overflow-hidden p-6 fade-up fade-up-1">
          <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-accent/10 blur-2xl" />
          <div className="flex items-center justify-between">
            <p className="eyebrow">Agent Pipeline</p>
            <span className="chip">并行执行</span>
          </div>
          <div className="mt-5 space-y-2.5">
            {PIPELINE.map((node, index) => (
              <div key={node.label} className="flex items-center gap-3">
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-mono text-[0.65rem] ${
                    node.accent
                      ? 'bg-accent text-white'
                      : 'border border-line bg-paper text-muted'
                  }`}
                >
                  {index === 0 ? 'M' : index}
                </span>
                <div className="min-w-0 flex-1 rounded-lg border border-line/80 bg-paper/60 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[0.82rem] font-semibold text-ink">
                      {node.label}
                    </span>
                    <span className="truncate font-mono text-[0.62rem] text-faint">
                      {node.note}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 rounded-xl bg-accent-soft px-4 py-3 text-[0.78rem] leading-6 text-accent-deep">
            主控 Agent 先做「匹配度诊断」，再决定是润色、补项目，还是两者并行——不是二选一。
          </div>
        </div>
      </section>

      <section className="mt-14 grid gap-4 md:grid-cols-3">
        {FEATURES.map((feature, index) => {
          const Icon = feature.icon;
          return (
            <div
              key={feature.title}
              className="card p-5 fade-up"
              style={{ animationDelay: `${60 * (index + 1)}ms` }}
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-soft text-accent-deep">
                <Icon size={17} strokeWidth={1.9} />
              </div>
              <h3 className="mt-4 text-[0.95rem] font-semibold text-ink">{feature.title}</h3>
              <p className="mt-1.5 text-[0.8rem] leading-6 text-muted">{feature.desc}</p>
            </div>
          );
        })}
      </section>

      <section className="mt-14">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Recent</p>
            <h2 className="section-title mt-1.5">最近的分析</h2>
          </div>
          <Link
            href="/analyze"
            className="flex items-center gap-1 text-[0.8rem] font-semibold text-accent hover:text-accent-deep"
          >
            新建分析 <ArrowUpRight size={14} />
          </Link>
        </div>

        <div className="mt-5">
          {reports === null ? (
            <div className="grid gap-4 md:grid-cols-2">
              {[0, 1].map((item) => (
                <div key={item} className="card h-32 animate-pulse bg-card/60" />
              ))}
            </div>
          ) : reports.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-line-strong bg-card/40 px-6 py-12 text-center">
              <p className="text-[0.92rem] font-medium text-ink">还没有分析记录</p>
              <p className="mt-1.5 text-[0.8rem] text-muted">
                从一份简历和一个目标岗位开始，大约两分钟得到第一份报告。
              </p>
              <Link href="/analyze" className="btn btn-soft mt-5">
                开始第一次分析
              </Link>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {reports.slice(0, 6).map((report) => (
                <div
                  key={report.id}
                  className="card group relative flex items-center gap-4 p-5 transition hover:-translate-y-0.5 hover:border-accent/40"
                >
                  <Link
                    href={`/report/${report.id}`}
                    className="flex min-w-0 flex-1 items-center gap-4"
                  >
                  <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-accent-soft">
                    <span className="font-serif text-[1.35rem] leading-none font-semibold text-accent-deep">
                      {report.score}
                    </span>
                    <span className="mt-0.5 font-mono text-[0.52rem] uppercase tracking-widest text-accent/70">
                      score
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-[0.9rem] font-semibold text-ink">
                        {report.company}
                      </p>
                      <span className="text-faint">·</span>
                      <p className="truncate text-[0.85rem] text-muted">{report.title}</p>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="chip">{ROUTE_LABELS[report.route]}</span>
                      {report.mock && <span className="chip text-amber">演示</span>}
                      <span className="text-[0.7rem] text-faint">
                        {formatDate(report.createdAt)}
                      </span>
                    </div>
                  </div>
                  </Link>
                  <button
                    type="button"
                    aria-label="删除报告"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      void removeReport(report.id);
                    }}
                    className="rounded-full p-2 text-faint opacity-0 transition hover:bg-danger-soft hover:text-danger group-hover:opacity-100"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="mt-14 grid gap-4 rounded-2xl border border-line bg-card/60 p-6 md:grid-cols-3">
        {[
          ['01', '输入简历与目标', '支持 PDF / DOCX / 文本粘贴；填写公司、岗位与 JD。'],
          ['02', '诊断与执行', '识别岗位意图、计算匹配度与关键词覆盖，再决定任务路由。'],
          ['03', '拿到可执行报告', '简历改写、项目方案、公司情报与下一步行动，一键导出。'],
        ].map(([number, title, desc]) => (
          <div key={number} className="flex gap-3">
            <span className="font-mono text-[0.7rem] text-accent">{number}</span>
            <div>
              <p className="text-[0.85rem] font-semibold text-ink">{title}</p>
              <p className="mt-1 text-[0.76rem] leading-6 text-muted">{desc}</p>
            </div>
          </div>
        ))}
      </section>

      <p className="mt-10 text-center text-[0.7rem] leading-6 text-faint">
        所有简历与报告仅保存在本机 data/ 目录；API Key 只存服务端，不会下发浏览器。
      </p>
    </div>
  );
}
