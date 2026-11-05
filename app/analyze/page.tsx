'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  FileText,
  FileUp,
  Info,
  Link2,
  Loader2,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  UploadCloud,
} from 'lucide-react';
import { RunTimeline } from '@/components/RunTimeline';
import { DIRECTION_LABELS, SENIORITY_LABELS } from '@/lib/keywords';
import type { Direction, PipelineEvent, Seniority } from '@/lib/types';

const STEPS = ['简历', '目标岗位', '启动'];

const DIRECTIONS: Array<{ value: Direction; label: string; hint: string }> = [
  { value: 'tech', label: '技术研发', hint: '后端 / 前端 / 客户端 / 测试' },
  { value: 'algorithm', label: '算法与数据', hint: '算法 / 数据 / 数据分析' },
  { value: 'product', label: '产品与运营', hint: '产品经理 / 用户运营' },
  { value: 'design', label: '设计', hint: 'UI / UX / 视觉' },
  { value: 'other', label: '其他', hint: '通用方向' },
];

const SENIORITIES: Array<{ value: Seniority; label: string }> = [
  { value: 'intern', label: '实习' },
  { value: 'campus', label: '校招' },
  { value: 'social', label: '社招' },
];

type Phase = 'form' | 'running' | 'finished' | 'error';

interface SettingsInfo {
  mockMode: boolean;
  llmReady: boolean;
  searchReady: boolean;
}

function parseSseBlock(block: string): PipelineEvent | null {
  const data = block
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trim())
    .join('\n');
  if (!data) return null;
  try {
    return JSON.parse(data) as PipelineEvent;
  } catch {
    return null;
  }
}

export default function AnalyzePage() {
  const router = useRouter();
  const abortRef = useRef<AbortController | null>(null);
  const redirectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [step, setStep] = useState(0);
  const [phase, setPhase] = useState<Phase>('form');
  const [events, setEvents] = useState<PipelineEvent[]>([]);
  const [runError, setRunError] = useState('');

  const [resumeText, setResumeText] = useState('');
  const [fileName, setFileName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [dragging, setDragging] = useState(false);

  const [company, setCompany] = useState('');
  const [title, setTitle] = useState('');
  const [direction, setDirection] = useState<Direction>('product');
  const [seniority, setSeniority] = useState<Seniority>('intern');
  const [jd, setJd] = useState('');
  const [jdUrl, setJdUrl] = useState('');
  const [weeks, setWeeks] = useState(4);
  const [notice, setNotice] = useState('');

  const [settingsInfo, setSettingsInfo] = useState<SettingsInfo | null>(null);

  useEffect(() => {
    let alive = true;
    fetch('/api/settings', { cache: 'no-store' })
      .then((response) => response.json())
      .then((data) => {
        if (!alive) return;
        setSettingsInfo({
          mockMode: Boolean(data.mockMode),
          llmReady: Boolean(data.llm?.hasApiKey),
          searchReady:
            Boolean(data.search?.hasApiKey) && data.search?.provider !== 'none',
        });
      })
      .catch(() => {
        if (alive) setSettingsInfo(null);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (redirectTimer.current) clearTimeout(redirectTimer.current);
    };
  }, []);

  async function handleFile(file: File) {
    setUploading(true);
    setUploadError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch('/api/parse', { method: 'POST', body: formData });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error ?? '文件解析失败');
      }
      setResumeText(data.text ?? '');
      setFileName(data.fileName ?? file.name);
      setNotice('');
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : '文件解析失败');
    } finally {
      setUploading(false);
    }
  }

  function nextFromResume() {
    if (resumeText.trim().length < 50) {
      setNotice('简历内容过少。请至少提供 50 个字符，或上传完整简历后继续。');
      return;
    }
    setNotice('');
    setStep(1);
  }

  function nextFromJob() {
    if (!title.trim() && !jd.trim() && !jdUrl.trim()) {
      setNotice('请至少填写岗位名称、JD 文本或 JD 链接中的一项，Agent 才能识别岗位意图。');
      return;
    }
    setNotice('');
    setStep(2);
  }

  async function startAnalysis() {
    setPhase('running');
    setEvents([]);
    setRunError('');
    setNotice('');

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resumeText,
          company,
          title,
          direction,
          seniority,
          jd,
          jdUrl,
          weeks,
        }),
        signal: controller.signal,
      });

      const contentType = response.headers.get('content-type') ?? '';
      if (!response.ok || contentType.includes('application/json')) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error ?? `请求失败（${response.status}）`);
      }

      if (!response.body) {
        throw new Error('浏览器不支持流式响应，请更换 Chrome / Edge 后重试。');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let sawFinal = false;
      let sawError = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const blocks = buffer.split('\n\n');
        buffer = blocks.pop() ?? '';

        for (const block of blocks) {
          const event = parseSseBlock(block);
          if (!event) continue;
          setEvents((current) => [...current, event]);

          if (event.type === 'error') {
            sawError = true;
            setRunError(event.message);
            setPhase('error');
          }
          if (event.type === 'final') {
            sawFinal = true;
            setPhase('finished');
            redirectTimer.current = setTimeout(() => {
              router.push(`/report/${event.reportId}`);
            }, 900);
          }
        }
      }

      if (!sawFinal && !sawError) {
        setRunError('连接意外结束，未收到完整报告。请重试。');
        setPhase('error');
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }
      setRunError(error instanceof Error ? error.message : '分析失败，请重试');
      setPhase('error');
    }
  }

  function cancelRun() {
    abortRef.current?.abort();
    setPhase('form');
    setEvents([]);
    setRunError('');
  }

  function backToForm() {
    setPhase('form');
    setEvents([]);
    setRunError('');
  }

  if (phase !== 'form') {
    return (
      <RunTimeline
        events={events}
        error={runError}
        finished={phase === 'finished'}
        onCancel={cancelRun}
        onBack={backToForm}
      />
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">New Analysis</p>
          <h1 className="section-title mt-1.5">新建一次简历分析</h1>
          <p className="mt-2 text-[0.84rem] text-muted">
            三步完成：提供简历、锁定目标岗位，剩下的交给 Agent。
          </p>
        </div>
        <Link href="/settings" className="btn btn-ghost btn-sm">
          模型与检索设置
        </Link>
      </div>

      {/* 步骤条 */}
      <div className="mt-7 flex items-center gap-2">
        {STEPS.map((label, index) => {
          const active = index === step;
          const done = index < step;
          return (
            <div key={label} className="flex flex-1 items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (index < step) setStep(index);
                }}
                className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-[0.75rem] font-medium transition ${
                  active
                    ? 'border-accent bg-accent text-white'
                    : done
                      ? 'border-accent/25 bg-accent-soft text-accent-deep'
                      : 'border-line bg-card text-faint'
                }`}
              >
                <span
                  className={`flex h-4 w-4 items-center justify-center rounded-full font-mono text-[0.55rem] ${
                    active ? 'bg-white/20' : done ? 'bg-accent/15' : 'bg-paper'
                  }`}
                >
                  {done ? <Check size={10} /> : index + 1}
                </span>
                {label}
              </button>
              {index < STEPS.length - 1 && <div className="h-px flex-1 bg-line" />}
            </div>
          );
        })}
      </div>

      {step === 0 && (
        <section className="card mt-5 p-6 fade-up">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-[1rem] font-semibold text-ink">你的简历</h2>
              <p className="mt-1 text-[0.78rem] text-muted">
                支持 PDF / DOCX / TXT / MD，也可以直接粘贴文本。
              </p>
            </div>
            <span className="chip">
              <ShieldCheck size={12} /> 仅存本机
            </span>
          </div>

          <div
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              const file = event.dataTransfer.files?.[0];
              if (file) void handleFile(file);
            }}
            className={`mt-5 rounded-xl border border-dashed px-4 py-4 transition ${
              dragging ? 'border-accent bg-accent-soft' : 'border-line-strong bg-paper/40'
            }`}
          >
            <div className="flex flex-wrap items-center gap-3">
              <label className="btn btn-soft cursor-pointer">
                {uploading ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <UploadCloud size={15} />
                )}
                {uploading ? '解析中…' : '上传文件'}
                <input
                  type="file"
                  accept=".pdf,.docx,.txt,.md,.markdown"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void handleFile(file);
                    event.target.value = '';
                  }}
                />
              </label>
              <span className="text-[0.75rem] text-muted">
                {fileName ? `已导入：${fileName}` : '或将文件拖到这里'}
              </span>
              {fileName && (
                <button
                  type="button"
                  onClick={() => {
                    setFileName('');
                    setResumeText('');
                    setUploadError('');
                  }}
                  className="text-[0.72rem] text-faint underline underline-offset-2 hover:text-danger"
                >
                  清除
                </button>
              )}
            </div>
            {uploadError && (
              <p className="mt-2 text-[0.75rem] leading-6 text-danger">{uploadError}</p>
            )}
          </div>

          <div className="mt-4">
            <div className="mb-1.5 flex items-center justify-between">
              <label className="label mb-0" htmlFor="resume-text">
                简历正文
              </label>
              <span className="font-mono text-[0.65rem] text-faint">
                {resumeText.length} 字符
              </span>
            </div>
            <textarea
              id="resume-text"
              value={resumeText}
              onChange={(event) => setResumeText(event.target.value)}
              rows={13}
              placeholder={`粘贴简历全文，例如：

林晓
华东理工大学 · 信息管理与信息系统 · 本科 · 2027.06
lin.xiao@example.com

教育经历
2023.09-2027.06  华东理工大学  信息管理与信息系统
GPA 3.7/4.0，专业前 15%

实习经历
2025.06-2025.09  星野科技  产品运营实习生
- 负责社区内容选题与发布
- 参与用户调研，整理访谈记录`}
              className="field scroll-thin resize-y font-mono text-[0.78rem] leading-6"
            />
          </div>

          <div className="mt-4 flex items-start gap-2 rounded-lg bg-paper/70 px-3 py-2.5">
            <Info size={14} className="mt-0.5 shrink-0 text-faint" />
            <p className="text-[0.7rem] leading-5 text-faint">
              简历只在本机解析与保存。调用模型时，仅发送简历文本与目标岗位信息；不会发送文件名、账号或无关个人信息。
            </p>
          </div>

          <div className="mt-5 flex items-center justify-between">
            <p className="text-[0.75rem] text-danger">{notice}</p>
            <button type="button" onClick={nextFromResume} className="btn btn-primary">
              下一步
              <ArrowRight size={15} />
            </button>
          </div>
        </section>
      )}

      {step === 1 && (
        <section className="card mt-5 p-6 fade-up">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-[1rem] font-semibold text-ink">目标岗位</h2>
              <p className="mt-1 text-[0.78rem] text-muted">
                信息越具体，岗位画像与匹配诊断越准确。JD 可以粘贴，也可以给链接。
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {settingsInfo?.mockMode ? (
                <span className="chip text-amber">
                  <Sparkles size={11} /> 演示模式
                </span>
              ) : (
                <span className={`chip ${settingsInfo?.llmReady ? 'text-accent' : 'text-danger'}`}>
                  {settingsInfo === null
                    ? '检查模型配置…'
                    : settingsInfo.llmReady
                      ? '模型已配置'
                      : '模型未配置'}
                </span>
              )}
              <span className={`chip ${settingsInfo?.searchReady ? 'text-accent' : ''}`}>
                <Search size={11} />
                {settingsInfo?.searchReady ? '联网检索已开启' : '联网检索未开启'}
              </span>
            </div>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="company">
                公司（选填，用于联网检索）
              </label>
              <input
                id="company"
                value={company}
                onChange={(event) => setCompany(event.target.value)}
                className="field"
                placeholder="例如：字节跳动"
              />
            </div>
            <div>
              <label className="label" htmlFor="title">
                岗位名称
              </label>
              <input
                id="title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="field"
                placeholder="例如：产品运营实习生"
              />
            </div>
          </div>

          <div className="mt-4">
            <span className="label">岗位方向</span>
            <div className="grid gap-2 sm:grid-cols-3">
              {DIRECTIONS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setDirection(item.value)}
                  className={`rounded-xl border px-3 py-2.5 text-left transition ${
                    direction === item.value
                      ? 'border-accent bg-accent-soft'
                      : 'border-line bg-paper/40 hover:border-line-strong'
                  }`}
                >
                  <span
                    className={`block text-[0.8rem] font-semibold ${
                      direction === item.value ? 'text-accent-deep' : 'text-ink'
                    }`}
                  >
                    {item.label}
                  </span>
                  <span className="mt-0.5 block text-[0.65rem] text-faint">{item.hint}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <span className="label">求职场景</span>
              <div className="flex rounded-xl border border-line bg-paper/40 p-1">
                {SENIORITIES.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setSeniority(item.value)}
                    className={`flex-1 rounded-lg px-3 py-1.5 text-[0.78rem] font-medium transition ${
                      seniority === item.value
                        ? 'bg-card text-ink shadow-sm'
                        : 'text-muted hover:text-ink'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="label" htmlFor="weeks">
                可投入的总准备时间（周）
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="weeks"
                  type="number"
                  min={1}
                  max={16}
                  value={weeks}
                  onChange={(event) =>
                    setWeeks(Math.max(1, Math.min(16, Number(event.target.value) || 1)))
                  }
                  className="field w-24"
                />
                {[2, 4, 6, 8].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setWeeks(value)}
                    className={`rounded-full border px-2.5 py-1 text-[0.7rem] transition ${
                      weeks === value
                        ? 'border-accent text-accent-deep'
                        : 'border-line text-faint hover:border-line-strong'
                    }`}
                  >
                    {value} 周
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4">
            <label className="label" htmlFor="jd">
              岗位 JD（建议粘贴完整文本）
            </label>
            <textarea
              id="jd"
              value={jd}
              onChange={(event) => setJd(event.target.value)}
              rows={6}
              className="field scroll-thin resize-y text-[0.82rem] leading-6"
              placeholder="粘贴招聘页面上的岗位职责、任职要求、加分项……"
            />
          </div>

          <div className="mt-3">
            <label className="label flex items-center gap-1.5" htmlFor="jd-url">
              <Link2 size={12} /> 或者填写 JD 链接（可选，抓取失败时请改为粘贴）
            </label>
            <input
              id="jd-url"
              value={jdUrl}
              onChange={(event) => setJdUrl(event.target.value)}
              className="field"
              placeholder="https://..."
            />
          </div>

          <div className="mt-5 flex items-center justify-between gap-3">
            <button type="button" onClick={() => setStep(0)} className="btn btn-ghost">
              <ArrowLeft size={15} />
              上一步
            </button>
            <div className="flex items-center gap-3">
              <p className="max-w-xs text-right text-[0.74rem] text-danger">{notice}</p>
              <button type="button" onClick={nextFromJob} className="btn btn-primary">
                下一步
                <ArrowRight size={15} />
              </button>
            </div>
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="card mt-5 p-6 fade-up">
          <div className="flex items-center gap-2">
            <Target size={17} className="text-accent" />
            <h2 className="text-[1rem] font-semibold text-ink">确认并启动</h2>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {[
              ['简历', `${resumeText.length} 字符${fileName ? ` · ${fileName}` : ''}`],
              ['目标', `${company.trim() || '未填公司'} · ${title.trim() || '未填岗位'}`],
              ['方向 / 场景', `${DIRECTION_LABELS[direction]} · ${SENIORITY_LABELS[seniority]}`],
              ['准备时间', `${weeks} 周`],
              ['JD', jd.trim() ? `${jd.trim().length} 字符` : jdUrl.trim() ? '将抓取链接' : '未提供（基于岗位名称推断）'],
              ['联网检索', settingsInfo?.mockMode ? '演示模式' : settingsInfo?.searchReady ? '已开启' : '未配置，将跳过'],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-line bg-paper/40 px-4 py-3">
                <p className="font-mono text-[0.6rem] uppercase tracking-widest text-faint">
                  {label}
                </p>
                <p className="mt-1 text-[0.8rem] leading-6 text-ink">{value}</p>
              </div>
            ))}
          </div>

          {settingsInfo && !settingsInfo.mockMode && !settingsInfo.llmReady && (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-danger/25 bg-danger-soft px-4 py-3">
              <Info size={14} className="mt-0.5 shrink-0 text-danger" />
              <p className="text-[0.75rem] leading-6 text-danger">
                尚未配置模型 API Key。请先到 <Link href="/settings" className="underline">设置</Link>{' '}
                填写，或在设置中开启演示模式。
              </p>
            </div>
          )}

          {settingsInfo?.mockMode && (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber/25 bg-amber-soft px-4 py-3">
              <Sparkles size={14} className="mt-0.5 shrink-0 text-amber" />
              <p className="text-[0.75rem] leading-6 text-amber">
                当前为演示模式：会走完整流程与界面，但简历、报告与项目方案均为示例数据，不会调用模型。
              </p>
            </div>
          )}

          <div className="mt-5 flex items-start gap-2 rounded-lg bg-paper/70 px-3 py-2.5">
            <FileUp size={14} className="mt-0.5 shrink-0 text-faint" />
            <p className="text-[0.7rem] leading-5 text-faint">
              分析通常需要 1–3 分钟。期间可看到每个 Agent 的实时状态；完成后会自动跳转到报告页。
            </p>
          </div>

          <div className="mt-5 flex items-center justify-between gap-3">
            <button type="button" onClick={() => setStep(1)} className="btn btn-ghost">
              <ArrowLeft size={15} />
              上一步
            </button>
            <button type="button" onClick={() => void startAnalysis()} className="btn btn-primary">
              <Sparkles size={15} />
              启动分析
            </button>
          </div>
        </section>
      )}

      <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-[0.7rem] text-faint">
        <FileText size={12} /> 报告会保存在本机 data/ 目录，随时可在工作台回看。
      </p>
    </div>
  );
}
