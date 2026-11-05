'use client';

import { CircleDashed, CheckCircle2, Info, KeyRound } from 'lucide-react';
import type { KeywordHit, Report } from '@/lib/types';

function WeightDots({ weight }: { weight: number }) {
  return (
    <span className="flex items-center gap-0.5" title={`权重 ${weight}`}>
      {[1, 2, 3].map((level) => (
        <span
          key={level}
          className={`h-1 w-1 rounded-full ${level <= weight ? 'bg-current opacity-70' : 'bg-line-strong'}`}
        />
      ))}
    </span>
  );
}

function KeywordChip({ keyword, tone }: { keyword: KeywordHit; tone: 'covered' | 'missing' }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.72rem] ${
        tone === 'covered'
          ? 'border-accent/20 bg-accent-soft text-accent-deep'
          : 'border-amber/25 bg-amber-soft text-amber'
      }`}
    >
      {keyword.term}
      <WeightDots weight={keyword.weight} />
      {keyword.matchedVia && (
        <span className="text-[0.6rem] opacity-60">via {keyword.matchedVia}</span>
      )}
    </span>
  );
}

export function KeywordsTab({ report }: { report: Report }) {
  const coverage = report.gap.keywordCoverage;
  const percent = Math.round(coverage.rate * 100);

  return (
    <div className="space-y-5">
      <section className="card p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <KeyRound size={16} className="text-accent" />
              <h2 className="text-[0.95rem] font-semibold text-ink">岗位关键词覆盖</h2>
            </div>
            <p className="mt-1 text-[0.75rem] text-muted">
              按 JD 权重加权计算，同义词已归并。覆盖率为确定性规则，不依赖模型打分。
            </p>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="font-serif text-[2.6rem] leading-none font-semibold text-accent">
              {percent}
            </span>
            <span className="text-[0.8rem] text-muted">%</span>
          </div>
        </div>

        <div className="mt-5 h-2 overflow-hidden rounded-full bg-line">
          <div
            className="h-full rounded-full bg-accent transition-all duration-700"
            style={{ width: `${percent}%` }}
          />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            ['关键词总数', coverage.total],
            ['已覆盖', coverage.covered.length],
            ['缺失', coverage.missing.length],
            ['加权覆盖率', `${percent}%`],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl bg-paper/60 px-3 py-2.5">
              <p className="font-mono text-[0.58rem] uppercase tracking-widest text-faint">
                {label}
              </p>
              <p className="mt-0.5 text-[0.9rem] font-semibold text-ink">{value}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-4 rounded-lg bg-paper/60 px-3 py-2 text-[0.66rem] text-faint">
          <span className="flex items-center gap-1">
            <WeightDots weight={3} /> 权重 3：核心要求
          </span>
          <span className="flex items-center gap-1">
            <WeightDots weight={2} /> 权重 2：重要能力
          </span>
          <span className="flex items-center gap-1">
            <WeightDots weight={1} /> 权重 1：加分项
          </span>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="card p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={15} className="text-accent" />
              <h3 className="text-[0.88rem] font-semibold text-ink">已覆盖</h3>
            </div>
            <span className="chip">{coverage.covered.length} 个</span>
          </div>
          {coverage.covered.length === 0 ? (
            <p className="mt-3 text-[0.75rem] text-muted">简历中暂未匹配到岗位关键词。</p>
          ) : (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {coverage.covered.map((keyword) => (
                <KeywordChip key={keyword.term} keyword={keyword} tone="covered" />
              ))}
            </div>
          )}
        </section>

        <section className="card p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CircleDashed size={15} className="text-amber" />
              <h3 className="text-[0.88rem] font-semibold text-ink">缺失</h3>
            </div>
            <span className="chip">{coverage.missing.length} 个</span>
          </div>
          {coverage.missing.length === 0 ? (
            <p className="mt-3 text-[0.75rem] text-muted">
              岗位关键词已全部覆盖，接下来重点打磨量化结果与表达。
            </p>
          ) : (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {coverage.missing.map((keyword) => (
                <KeywordChip key={keyword.term} keyword={keyword} tone="missing" />
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-line bg-card/60 px-4 py-3">
        <Info size={14} className="mt-0.5 shrink-0 text-faint" />
        <p className="text-[0.72rem] leading-6 text-muted">
          缺失关键词不代表要在简历里硬塞。优先检查现有经历中是否有能自然体现的部分；确实没有真实经历的，
          通过「项目方案」补齐，再回到简历中表达。虚构关键词会在面试追问中暴露，也会被事实护栏拦截。
        </p>
      </div>
    </div>
  );
}
