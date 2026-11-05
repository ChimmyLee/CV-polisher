'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, FlaskConical, Info, Loader2, PlugZap, Save, Sparkles, XCircle } from 'lucide-react';
import type { PublicSettings, SearchProvider } from '@/lib/types';

const PRESETS = [
  { name: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
  { name: 'Kimi', baseUrl: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-32k' },
  { name: '通义千问', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus' },
  { name: 'GLM', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4-plus' },
];

interface TestResult {
  type: 'llm' | 'search';
  ok: boolean;
  message: string;
}

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [info, setInfo] = useState<PublicSettings | null>(null);

  const [baseUrl, setBaseUrl] = useState('https://api.deepseek.com/v1');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('deepseek-chat');
  const [temperature, setTemperature] = useState(0.3);

  const [provider, setProvider] = useState<SearchProvider>('none');
  const [searchKey, setSearchKey] = useState('');

  const [mockMode, setMockMode] = useState(false);
  const [testing, setTesting] = useState<'llm' | 'search' | null>(null);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  async function loadSettings() {
    try {
      const response = await fetch('/api/settings', { cache: 'no-store' });
      const data = (await response.json()) as PublicSettings;
      if (!response.ok || !data?.llm) {
        throw new Error('读取设置失败');
      }
      setInfo(data);
      setBaseUrl(data.llm.baseUrl);
      setModel(data.llm.model);
      setTemperature(data.llm.temperature);
      setProvider(data.search.provider);
      setMockMode(data.mockMode);
    } catch {
      setToast({ kind: 'err', text: '读取设置失败，请刷新页面重试。' });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSettings();
  }, []);

  function buildPayload(overrides?: { apiKey?: string; searchKey?: string; mockMode?: boolean }) {
    return {
      llm: {
        baseUrl,
        apiKey: overrides?.apiKey ?? apiKey,
        model,
        temperature,
      },
      search: {
        provider,
        apiKey: overrides?.searchKey ?? searchKey,
      },
      mockMode: overrides?.mockMode ?? mockMode,
    };
  }

  async function save(overrides?: { apiKey?: string; searchKey?: string; mockMode?: boolean }) {
    setSaving(true);
    setToast(null);
    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload(overrides)),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error ?? '保存失败');
      }
      setInfo(data.settings);
      setApiKey('');
      setSearchKey('');
      setToast({ kind: 'ok', text: '设置已保存到本机。' });
    } catch (error) {
      setToast({ kind: 'err', text: error instanceof Error ? error.message : '保存失败' });
    } finally {
      setSaving(false);
    }
  }

  async function test(type: 'llm' | 'search') {
    setTesting(type);
    setTestResult(null);
    try {
      const body =
        type === 'llm'
          ? { type, llm: { baseUrl, apiKey, model, temperature } }
          : { type, search: { provider, apiKey: searchKey } };
      const response = await fetch('/api/settings/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      setTestResult({
        type,
        ok: Boolean(data.ok),
        message: data.message ?? data.error ?? '测试完成',
      });
    } catch {
      setTestResult({ type, ok: false, message: '测试请求失败，请检查网络。' });
    } finally {
      setTesting(null);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl py-16 text-center">
        <Loader2 size={22} className="mx-auto animate-spin text-accent" />
        <p className="mt-3 text-[0.8rem] text-muted">读取设置…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Settings</p>
          <h1 className="section-title mt-1.5">模型与检索设置</h1>
          <p className="mt-2 text-[0.84rem] text-muted">
            支持任意 OpenAI 兼容接口。Key 只保存在本机服务端，不会回传浏览器。
          </p>
        </div>
        <button type="button" onClick={() => void save()} disabled={saving} className="btn btn-primary">
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          {saving ? '保存中…' : '保存设置'}
        </button>
      </div>

      {toast && (
        <div
          className={`mt-4 flex items-center gap-2 rounded-xl border px-4 py-3 text-[0.78rem] ${
            toast.kind === 'ok'
              ? 'border-accent/25 bg-accent-soft text-accent-deep'
              : 'border-danger/25 bg-danger-soft text-danger'
          }`}
        >
          {toast.kind === 'ok' ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
          {toast.text}
        </div>
      )}

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
        <div className="space-y-5">
          {/* LLM */}
          <section className="card p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-[0.98rem] font-semibold text-ink">大模型</h2>
                <p className="mt-1 text-[0.75rem] text-muted">
                  用于简历解析、岗位分析、润色与项目规划。推荐 DeepSeek / Kimi / 通义 / GLM。
                </p>
              </div>
              <span className={`chip ${info?.llm.hasApiKey ? 'text-accent' : 'text-danger'}`}>
                {info?.llm.hasApiKey ? `已保存 ${info.llm.apiKeyMasked}` : '未配置 Key'}
              </span>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => {
                    setBaseUrl(preset.baseUrl);
                    setModel(preset.model);
                  }}
                  className={`rounded-full border px-3 py-1 text-[0.7rem] transition ${
                    baseUrl === preset.baseUrl && model === preset.model
                      ? 'border-accent bg-accent-soft text-accent-deep'
                      : 'border-line text-muted hover:border-line-strong'
                  }`}
                >
                  {preset.name}
                </button>
              ))}
            </div>

            <div className="mt-4 space-y-3.5">
              <div>
                <label className="label" htmlFor="base-url">
                  Base URL
                </label>
                <input
                  id="base-url"
                  value={baseUrl}
                  onChange={(event) => setBaseUrl(event.target.value)}
                  className="field font-mono text-[0.8rem]"
                  placeholder="https://api.deepseek.com/v1"
                />
              </div>
              <div>
                <label className="label" htmlFor="api-key">
                  API Key
                </label>
                <div className="flex gap-2">
                  <input
                    id="api-key"
                    type="password"
                    value={apiKey}
                    onChange={(event) => setApiKey(event.target.value)}
                    className="field font-mono text-[0.8rem]"
                    placeholder={
                      info?.llm.hasApiKey ? `已保存（${info.llm.apiKeyMasked}），留空保持不变` : 'sk-...'
                    }
                  />
                  {info?.llm.hasApiKey && (
                    <button
                      type="button"
                      onClick={() => void save({ apiKey: '__CLEAR__' })}
                      className="btn btn-ghost btn-sm shrink-0"
                    >
                      清除
                    </button>
                  )}
                </div>
              </div>
              <div className="grid gap-3.5 sm:grid-cols-[1fr_1fr]">
                <div>
                  <label className="label" htmlFor="model">
                    模型名
                  </label>
                  <input
                    id="model"
                    value={model}
                    onChange={(event) => setModel(event.target.value)}
                    className="field font-mono text-[0.8rem]"
                    placeholder="deepseek-chat"
                  />
                </div>
                <div>
                  <label className="label" htmlFor="temperature">
                    温度：{temperature.toFixed(2)}
                  </label>
                  <input
                    id="temperature"
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={temperature}
                    onChange={(event) => setTemperature(Number(event.target.value))}
                    className="mt-2 w-full accent-[var(--color-accent)]"
                  />
                  <p className="mt-1 text-[0.65rem] text-faint">越低越稳定，建议 0.2–0.4。</p>
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-4">
              <button
                type="button"
                onClick={() => void test('llm')}
                disabled={testing !== null}
                className="btn btn-soft btn-sm"
              >
                {testing === 'llm' ? <Loader2 size={13} className="animate-spin" /> : <PlugZap size={13} />}
                测试连接
              </button>
              {testResult?.type === 'llm' && (
                <span
                  className={`flex items-center gap-1 text-[0.72rem] ${
                    testResult.ok ? 'text-accent' : 'text-danger'
                  }`}
                >
                  {testResult.ok ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
                  {testResult.message}
                </span>
              )}
            </div>
          </section>

          {/* Search */}
          <section className="card p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-[0.98rem] font-semibold text-ink">联网检索</h2>
                <p className="mt-1 text-[0.75rem] text-muted">
                  用于补充公司业务、岗位面经与近期动态。未配置时流程仍可完成，只是缺少情报部分。
                </p>
              </div>
              <span className={`chip ${info?.search.hasApiKey && provider !== 'none' ? 'text-accent' : ''}`}>
                {provider === 'none'
                  ? '已关闭'
                  : info?.search.hasApiKey
                    ? `已保存 ${info.search.apiKeyMasked}`
                    : '未配置 Key'}
              </span>
            </div>

            <div className="mt-4 grid gap-3.5 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="provider">
                  检索服务
                </label>
                <select
                  id="provider"
                  value={provider}
                  onChange={(event) => setProvider(event.target.value as SearchProvider)}
                  className="field"
                >
                  <option value="none">关闭（仅用 JD 与模型知识）</option>
                  <option value="bocha">博查 Bocha（中文，推荐）</option>
                  <option value="tavily">Tavily</option>
                  <option value="serper">Serper（Google）</option>
                </select>
              </div>
              <div>
                <label className="label" htmlFor="search-key">
                  Search API Key
                </label>
                <div className="flex gap-2">
                  <input
                    id="search-key"
                    type="password"
                    value={searchKey}
                    onChange={(event) => setSearchKey(event.target.value)}
                    className="field font-mono text-[0.8rem]"
                    placeholder={
                      info?.search.hasApiKey
                        ? `已保存（${info.search.apiKeyMasked}），留空保持不变`
                        : '填写检索服务 Key'
                    }
                  />
                  {info?.search.hasApiKey && (
                    <button
                      type="button"
                      onClick={() => void save({ searchKey: '__CLEAR__' })}
                      className="btn btn-ghost btn-sm shrink-0"
                    >
                      清除
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-4">
              <button
                type="button"
                onClick={() => void test('search')}
                disabled={testing !== null || provider === 'none'}
                className="btn btn-soft btn-sm"
              >
                {testing === 'search' ? <Loader2 size={13} className="animate-spin" /> : <PlugZap size={13} />}
                测试检索
              </button>
              {testResult?.type === 'search' && (
                <span
                  className={`flex items-center gap-1 text-[0.72rem] ${
                    testResult.ok ? 'text-accent' : 'text-danger'
                  }`}
                >
                  {testResult.ok ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
                  {testResult.message}
                </span>
              )}
            </div>
          </section>
        </div>

        <div className="space-y-5">
          <section className="card p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <FlaskConical size={16} className="text-amber" />
                <h2 className="text-[0.9rem] font-semibold text-ink">演示模式</h2>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={mockMode}
                aria-label="演示模式"
                onClick={() => {
                  const next = !mockMode;
                  setMockMode(next);
                  void save({ mockMode: next });
                }}
                className={`relative h-6 w-11 rounded-full transition ${
                  mockMode ? 'bg-accent' : 'bg-line-strong'
                }`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
                    mockMode ? 'left-[22px]' : 'left-0.5'
                  }`}
                />
              </button>
            </div>
            <p className="mt-3 text-[0.74rem] leading-6 text-muted">
              开启后无需任何 Key，即可走通完整流程与界面。所有内容为示例数据，会在界面上明确标注。
              关闭后使用上方配置的真实模型。开关会立即保存。
            </p>
          </section>

          <section className="card p-5">
            <div className="flex items-center gap-2">
              <Info size={15} className="text-accent" />
              <h2 className="text-[0.9rem] font-semibold text-ink">说明</h2>
            </div>
            <ul className="mt-3 space-y-2.5 text-[0.72rem] leading-6 text-muted">
              <li>· 所有配置保存在本机 <code className="font-mono text-[0.68rem]">data/settings.json</code>，已被 gitignore。</li>
              <li>· Key 仅服务端读取，接口返回的是掩码；请勿把本应用暴露到公网。</li>
              <li>· 模型需支持 OpenAI Chat Completions 与 JSON 输出；不支持 <code>response_format</code> 时会自动降级重试。</li>
              <li>· 检索结果为公开网络信息，报告中会附来源，请自行判断时效与准确性。</li>
            </ul>
          </section>

          <section className="rounded-2xl border border-accent/20 bg-accent-soft p-5">
            <div className="flex items-center gap-2 text-accent-deep">
              <Sparkles size={15} />
              <p className="text-[0.82rem] font-semibold">第一次使用？</p>
            </div>
            <p className="mt-2 text-[0.72rem] leading-6 text-accent-deep/80">
              不想先申请 Key，可以打开演示模式，直接到工作台新建一次分析，完整体验报告结构与导出。
            </p>
            <Link href="/analyze" className="btn btn-soft btn-sm mt-3">
              去新建分析
            </Link>
          </section>
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <button type="button" onClick={() => void save()} disabled={saving} className="btn btn-primary">
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          保存设置
        </button>
      </div>
    </div>
  );
}
