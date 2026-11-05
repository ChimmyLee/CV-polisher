'use client';

import { useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import {
  AlertTriangle,
  Check,
  Eye,
  FileWarning,
  RotateCcw,
  Sparkles,
  Wand2,
} from 'lucide-react';
import { Markdown } from '@/components/Markdown';
import { assembleResumeMarkdown } from '@/lib/resume';
import type { PolishEdit, Report } from '@/lib/types';

const RISK: Record<PolishEdit['risk'], { label: string; className: string }> = {
  low: { label: '低风险', className: 'text-accent border-accent/20 bg-accent-soft' },
  medium: { label: '中风险', className: 'text-amber border-amber/20 bg-amber-soft' },
  high: { label: '高风险', className: 'text-danger border-danger/20 bg-danger-soft' },
};

function HighlightPlaceholders({ text }: { text: string }) {
  const parts = text.split(/(\[待补充[^\]]*\])/g);
  return (
    <>
      {parts.map((part, index) =>
        part.startsWith('[待补充') ? (
          <mark
            key={index}
            className="rounded bg-amber-soft px-0.5 text-amber"
            title="需要你补充真实数据"
          >
            {part}
          </mark>
        ) : (
          <span key={index}>{part}</span>
        ),
      )}
    </>
  );
}

export function PolishTab({
  report,
  accepted,
  setAccepted,
}: {
  report: Report;
  accepted: string[];
  setAccepted: Dispatch<SetStateAction<string[]>>;
}) {
  const [onlyPending, setOnlyPending] = useState(false);
  const polish = report.polish;
  const edits = polish?.edits ?? [];
  const activeEdits = edits.filter((edit) => !edit.reverted);
  const pendingCount = activeEdits.filter((edit) => edit.needsUserInput.length > 0).length;

  const preview = useMemo(
    () => assembleResumeMarkdown(report.resume, edits, accepted),
    [report.resume, edits, accepted],
  );

  if (!polish) {
    return (
      <div className="rounded-2xl border border-dashed border-line-strong bg-card/40 px-6 py-16 text-center">
        <FileWarning size={24} className="mx-auto text-faint" />
        <p className="mt-3 text-[0.92rem] font-medium text-ink">本次没有生成简历改写</p>
        <p className="mx-auto mt-1.5 max-w-md text-[0.78rem] leading-6 text-muted">
          {report.gap.route === 'project'
            ? '匹配度诊断建议先补齐项目，因此本次跳过了润色。你可以在「项目方案」查看可执行的项目计划。'
            : '润色 Agent 未完成或未返回可用改写，可回到工作台重新分析一次。'}
        </p>
      </div>
    );
  }

  const visible = onlyPending
    ? edits.filter((edit) => edit.needsUserInput.length > 0 || edit.reverted)
    : edits;

  function toggle(id: string) {
    setAccepted((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
      <div className="space-y-4">
        <div className="card p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-deep">
              <Wand2 size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-[0.9rem] font-semibold text-ink">改写思路</h3>
              <p className="mt-1.5 text-[0.78rem] leading-7 text-muted">{polish.summary}</p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="chip">共 {edits.length} 条改写</span>
            <span className="chip">已采纳 {accepted.filter((id) => activeEdits.some((edit) => edit.id === id)).length} 条</span>
            {pendingCount > 0 && (
              <span className="chip border-amber/25 bg-amber-soft text-amber">
                {pendingCount} 条待补充数据
              </span>
            )}
            {edits.some((edit) => edit.reverted) && (
              <span className="chip border-danger/20 bg-danger-soft text-danger">
                {edits.filter((edit) => edit.reverted).length} 条已回退
              </span>
            )}
          </div>
          {!polish.factGuard.passed && (
            <div className="mt-3 rounded-xl border border-danger/20 bg-danger-soft px-3 py-2.5">
              <p className="flex items-center gap-1.5 text-[0.72rem] font-semibold text-danger">
                <AlertTriangle size={12} /> 事实护栏发现风险，以下改写已自动回退或需要人工确认
              </p>
              <ul className="mt-1 space-y-0.5">
                {polish.factGuard.issues.map((issue, index) => (
                  <li key={index} className="text-[0.68rem] leading-5 text-danger">
                    · {issue}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => setOnlyPending(false)}
              className={`rounded-full border px-3 py-1 text-[0.72rem] transition ${
                !onlyPending
                  ? 'border-accent bg-accent-soft text-accent-deep'
                  : 'border-line text-muted'
              }`}
            >
              全部 {edits.length}
            </button>
            <button
              type="button"
              onClick={() => setOnlyPending(true)}
              className={`rounded-full border px-3 py-1 text-[0.72rem] transition ${
                onlyPending
                  ? 'border-accent bg-accent-soft text-accent-deep'
                  : 'border-line text-muted'
              }`}
            >
              待补充 {pendingCount}
            </button>
          </div>
          <button
            type="button"
            onClick={() => setAccepted(activeEdits.map((edit) => edit.id))}
            className="flex items-center gap-1 text-[0.72rem] text-faint hover:text-accent"
          >
            <RotateCcw size={12} /> 全部采纳
          </button>
        </div>

        <div className="space-y-3">
          {visible.map((edit) => {
            const isAccepted = accepted.includes(edit.id);
            return (
              <div
                key={edit.id}
                className={`card p-4 transition ${
                  edit.reverted
                    ? 'border-danger/20 opacity-80'
                    : isAccepted
                      ? 'border-accent/30'
                      : 'opacity-90'
                }`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[0.6rem] uppercase tracking-widest text-faint">
                    {edit.id}
                  </span>
                  <span className="text-[0.74rem] font-semibold text-ink">{edit.section}</span>
                  <span
                    className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[0.6rem] ${RISK[edit.risk].className}`}
                  >
                    {RISK[edit.risk].label}
                  </span>
                  {edit.reverted ? (
                    <span className="ml-auto rounded-full border border-danger/20 bg-danger-soft px-2 py-0.5 text-[0.62rem] font-semibold text-danger">
                      已回退
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => toggle(edit.id)}
                      className={`ml-auto inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[0.68rem] font-semibold transition ${
                        isAccepted
                          ? 'border-accent bg-accent text-white'
                          : 'border-line-strong text-muted hover:border-accent hover:text-accent'
                      }`}
                    >
                      {isAccepted && <Check size={11} />}
                      {isAccepted ? '已采纳' : '采纳'}
                    </button>
                  )}
                </div>

                <div className="mt-3 rounded-lg bg-paper/70 px-3 py-2">
                  <p className="font-mono text-[0.55rem] uppercase tracking-widest text-faint">
                    原文
                  </p>
                  <p className="mt-0.5 text-[0.76rem] leading-6 text-muted">{edit.original}</p>
                </div>

                <div className="mt-2 rounded-lg border border-accent/15 bg-accent-soft/50 px-3 py-2">
                  <p className="font-mono text-[0.55rem] uppercase tracking-widest text-accent/70">
                    改写
                  </p>
                  <p className="mt-0.5 text-[0.8rem] leading-6 text-ink">
                    <HighlightPlaceholders text={edit.rewritten} />
                  </p>
                </div>

                <p className="mt-2.5 flex gap-1.5 text-[0.72rem] leading-6 text-muted">
                  <Sparkles size={12} className="mt-1.5 shrink-0 text-accent" />
                  {edit.rationale}
                </p>

                {edit.guardNote && (
                  <p className="mt-2 rounded-lg bg-danger-soft px-2.5 py-1.5 text-[0.68rem] leading-5 text-danger">
                    {edit.guardNote}
                  </p>
                )}

                {edit.keywordsAdded.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {edit.keywordsAdded.map((keyword) => (
                      <span key={keyword} className="chip text-accent-deep">
                        + {keyword}
                      </span>
                    ))}
                  </div>
                )}

                {edit.needsUserInput.length > 0 && (
                  <div className="mt-2 rounded-lg border border-amber/20 bg-amber-soft px-2.5 py-2">
                    <p className="text-[0.65rem] font-semibold text-amber">需要你补充真实数据</p>
                    <ul className="mt-1 space-y-0.5">
                      {edit.needsUserInput.map((item, index) => (
                        <li key={index} className="text-[0.68rem] leading-5 text-amber">
                          · {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="lg:sticky lg:top-36 lg:self-start">
        <div className="card max-h-[calc(100vh-10rem)] overflow-auto scroll-thin p-5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <Eye size={14} className="text-accent" />
              <p className="text-[0.82rem] font-semibold text-ink">最终简历预览</p>
            </div>
            <span className="chip">
              {accepted.filter((id) => activeEdits.some((edit) => edit.id === id)).length}/
              {activeEdits.length} 采纳
            </span>
          </div>
          <p className="mt-1 text-[0.68rem] text-faint">
            导出 Markdown / DOCX 时会使用当前采纳结果。
          </p>
          <div className="mt-3 border-t border-line pt-3">
            <Markdown>{preview}</Markdown>
          </div>
        </div>
      </div>
    </div>
  );
}
