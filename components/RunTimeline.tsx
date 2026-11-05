'use client';

import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  FileText,
  Gauge,
  Loader2,
  Rocket,
  Search,
  ShieldCheck,
  Target,
  Wand2,
  XCircle,
} from 'lucide-react';
import type { AgentId, PipelineEvent } from '@/lib/types';

type Status = 'idle' | 'running' | 'done' | 'skipped' | 'error';

interface AgentState {
  status: Status;
  summary?: string;
  reason?: string;
  logs: string[];
}

const AGENTS: Array<{
  id: AgentId;
  label: string;
  note: string;
  parallel?: boolean;
  icon: typeof FileText;
}> = [
  { id: 'parse', label: '简历解析', note: '主控 Agent', icon: FileText },
  { id: 'job', label: '岗位意图识别', note: '主控 Agent', icon: Target },
  { id: 'diagnose', label: '匹配度诊断与路由', note: '主控 Agent', icon: Gauge },
  { id: 'research', label: '联网检索情报', note: '子 Agent', parallel: true, icon: Search },
  { id: 'polish', label: '简历润色', note: '子 Agent', parallel: true, icon: Wand2 },
  { id: 'planner', label: '项目规划', note: '子 Agent', parallel: true, icon: Rocket },
  { id: 'review', label: '质量审核', note: '主控 Agent', icon: ShieldCheck },
];

const STATUS_TEXT: Record<Status, string> = {
  idle: '等待',
  running: '运行中',
  done: '完成',
  skipped: '跳过',
  error: '失败',
};

function statusClasses(status: Status): string {
  switch (status) {
    case 'running':
      return 'bg-accent-soft text-accent-deep border-accent/30';
    case 'done':
      return 'bg-accent-soft text-accent-deep border-accent/20';
    case 'skipped':
      return 'bg-paper text-faint border-line';
    case 'error':
      return 'bg-danger-soft text-danger border-danger/20';
    default:
      return 'bg-paper text-muted border-line';
  }
}

function StatusIcon({ status }: { status: Status }) {
  if (status === 'running') return <Loader2 size={13} className="animate-spin" />;
  if (status === 'done') return <CheckCircle2 size={13} />;
  if (status === 'skipped') return <CircleDashed size={13} />;
  if (status === 'error') return <XCircle size={13} />;
  return <CircleDashed size={13} />;
}

export interface RunTimelineProps {
  events: PipelineEvent[];
  error?: string;
  finished?: boolean;
  onCancel: () => void;
  onBack: () => void;
}

export function RunTimeline({ events, error, finished, onCancel, onBack }: RunTimelineProps) {
  const states = new Map<AgentId, AgentState>();
  for (const agent of AGENTS) {
    states.set(agent.id, { status: 'idle', logs: [] });
  }

  let stageLabel = '';
  const warnings: string[] = [];
  let streamError = '';

  for (const event of events) {
    switch (event.type) {
      case 'stage':
        stageLabel = event.label;
        break;
      case 'agent_start': {
        const state = states.get(event.agent);
        if (state) {
          state.status = 'running';
          state.reason = undefined;
        }
        break;
      }
      case 'agent_log': {
        const state = states.get(event.agent);
        if (state) state.logs = [...state.logs.slice(-3), event.message];
        break;
      }
      case 'agent_done': {
        const state = states.get(event.agent);
        if (state) {
          state.status = 'done';
          state.summary = event.summary;
        }
        break;
      }
      case 'agent_skip': {
        const state = states.get(event.agent);
        if (state) {
          state.status = 'skipped';
          state.reason = event.reason;
        }
        break;
      }
      case 'agent_error': {
        const state = states.get(event.agent);
        if (state) {
          state.status = 'error';
          state.reason = event.message;
        }
        break;
      }
      case 'warning':
        warnings.push(event.message);
        break;
      case 'error':
        streamError = event.message;
        break;
      default:
        break;
    }
  }

  const hasError = Boolean(error || streamError);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Pipeline Running</p>
          <h1 className="section-title mt-1.5">
            {finished ? '报告已生成' : hasError ? '分析中断' : stageLabel || '正在启动 Agent…'}
          </h1>
          <p className="mt-2 text-[0.82rem] text-muted">
            {finished
              ? '正在跳转到报告页…'
              : hasError
                ? '已保留当前进度，可返回修改后重试。'
                : '主控 Agent 与子 Agent 正在协作，通常需要 1–3 分钟，请保持页面打开。'}
          </p>
        </div>
        {!hasError && !finished && (
          <button type="button" onClick={onCancel} className="btn btn-ghost btn-sm">
            取消分析
          </button>
        )}
      </div>

      <div className="mt-7 space-y-2.5">
        {AGENTS.map((agent, index) => {
          const state = states.get(agent.id)!;
          const Icon = agent.icon;
          const active = state.status === 'running';
          return (
            <div
              key={agent.id}
              className={`card relative overflow-hidden p-4 transition ${
                active ? 'border-accent/50 shadow-[0_0_0_3px_rgba(31,106,85,0.06)]' : ''
              }`}
            >
              <div className="flex items-start gap-3.5">
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${
                    active
                      ? 'border-accent/30 bg-accent text-white'
                      : state.status === 'done'
                        ? 'border-accent/20 bg-accent-soft text-accent-deep'
                        : 'border-line bg-paper text-muted'
                  }`}
                >
                  <Icon size={16} strokeWidth={1.9} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[0.86rem] font-semibold text-ink">{agent.label}</span>
                    <span className="font-mono text-[0.6rem] uppercase tracking-widest text-faint">
                      {agent.note}
                    </span>
                    {agent.parallel && <span className="chip">并行</span>}
                    <span
                      className={`ml-auto inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.65rem] ${statusClasses(
                        state.status,
                      )}`}
                    >
                      <StatusIcon status={state.status} />
                      {STATUS_TEXT[state.status]}
                    </span>
                  </div>

                  {state.summary && (
                    <p className="mt-1.5 text-[0.76rem] leading-6 text-muted">{state.summary}</p>
                  )}
                  {state.reason && (
                    <p
                      className={`mt-1.5 text-[0.76rem] leading-6 ${
                        state.status === 'error' ? 'text-danger' : 'text-faint'
                      }`}
                    >
                      {state.reason}
                    </p>
                  )}
                  {state.logs.length > 0 && (
                    <div className="mt-2 space-y-1 border-l border-line pl-3">
                      {state.logs.map((log, logIndex) => (
                        <p key={logIndex} className="text-[0.7rem] leading-5 text-faint">
                          {log}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
                <span className="hidden font-mono text-[0.62rem] text-faint sm:block">
                  {String(index + 1).padStart(2, '0')}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {(warnings.length > 0 || hasError) && (
        <div
          className={`mt-5 rounded-xl border p-4 ${
            hasError ? 'border-danger/25 bg-danger-soft' : 'border-amber/25 bg-amber-soft'
          }`}
        >
          <div className="flex items-start gap-2">
            <AlertTriangle
              size={15}
              className={hasError ? 'mt-0.5 text-danger' : 'mt-0.5 text-amber'}
            />
            <div className="min-w-0 flex-1">
              {hasError && (
                <p className="text-[0.8rem] font-semibold text-danger">
                  {error || streamError}
                </p>
              )}
              {warnings.map((warning, index) => (
                <p
                  key={index}
                  className={`text-[0.72rem] leading-6 ${
                    hasError ? 'text-danger/80' : 'text-amber'
                  }`}
                >
                  {warning}
                </p>
              ))}
            </div>
          </div>
          {hasError && (
            <button type="button" onClick={onBack} className="btn btn-ghost btn-sm mt-3">
              返回修改
            </button>
          )}
        </div>
      )}
    </div>
  );
}
