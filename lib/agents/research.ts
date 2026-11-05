import { chatJSON } from '../llm';
import { fetchPageText, searchWeb, type SearchResult } from '../search';
import { getSettings } from '../store';
import { mockResearch } from '../mock';
import { ResearchLlmSchema, ResearchQueriesSchema } from '../schemas';
import { DIRECTION_LABELS, SENIORITY_LABELS } from '../keywords';
import type { AnalyzeInput, JobProfile, ResearchBrief, ResearchSource } from '../types';
import { RESEARCH_QUERY_SYSTEM, RESEARCH_SYNTH_SYSTEM } from '@/prompts/research';
import type { AgentContext } from './orchestrator';

const SKIP_HOSTS = new Set([
  'zhihu.com',
  'www.zhihu.com',
  'xiaohongshu.com',
  'www.xiaohongshu.com',
  'weibo.com',
  'www.weibo.com',
  'douyin.com',
  'www.douyin.com',
  'login.taobao.com',
]);

export function emptyResearch(error: string): ResearchBrief {
  return {
    enabled: false,
    error,
    companyOverview: '',
    roleInsight: '',
    interviewProcess: '',
    recentNews: [],
    applicationTips: [],
    sources: [],
  };
}

function fallbackQueries(job: JobProfile, input: AnalyzeInput): string[] {
  const company = job.company.trim();
  if (!company || company === '目标公司') return [];
  const seniority = SENIORITY_LABELS[job.seniority] ?? '校招';
  return [
    `${company} ${job.title} 岗位要求 ${seniority}`,
    `${company} ${job.title} 面经 面试流程`,
    `${company} 业务 最新 动态 2026`,
    `${company} ${seniority} 培养 转正 时间`,
  ];
}

function sanitizeQueries(queries: string[], job: JobProfile): string[] {
  const company = job.company.trim();
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of queries) {
    let query = raw
      .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, ' ')
      .replace(/1[3-9]\d{9}/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (query.length < 4 || query.length > 60) continue;
    if (company && company !== '目标公司' && !query.includes(company)) {
      query = `${company} ${query}`;
    }
    const normalized = query.toLowerCase();
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(query);
    if (result.length >= 5) break;
  }
  return result;
}

function dedupeResults(results: SearchResult[]): SearchResult[] {
  const seen = new Set<string>();
  const unique: SearchResult[] = [];
  for (const item of results) {
    if (!item.url) continue;
    let key = item.url;
    try {
      const url = new URL(item.url);
      key = `${url.hostname}${url.pathname}`.replace(/\/$/, '');
    } catch {
      // 保留原始 URL 作为 key
    }
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }
  return unique;
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return '';
  }
}

export async function runResearch(params: {
  job: JobProfile;
  input: AnalyzeInput;
  ctx: AgentContext;
  onLog?: (message: string) => void;
}): Promise<ResearchBrief> {
  const { job, input, ctx, onLog } = params;

  if (ctx.mock) return mockResearch(job);

  const settings = await getSettings();
  if (settings.search.provider === 'none' || !settings.search.apiKey) {
    return emptyResearch(
      '未配置联网检索服务。到「设置」中选择 Bocha / Tavily / Serper 并填写 API Key 后，可获得公司业务、面经与近期动态情报。',
    );
  }
  if (!job.company || job.company === '目标公司') {
    return emptyResearch('未提供公司名称，已跳过联网检索。填写目标公司后可获得岗位情报。');
  }

  let queries: string[] = [];
  try {
    onLog?.('正在生成检索计划…');
    const raw = await chatJSON({
      system: RESEARCH_QUERY_SYSTEM,
      user: `公司：${job.company}
岗位：${job.title}
方向：${DIRECTION_LABELS[input.direction]}
场景：${SENIORITY_LABELS[job.seniority]}
JD / 职责摘要：
${(input.jd || job.responsibilities.join('；')).slice(0, 3000)}`,
      schema: ResearchQueriesSchema,
      temperature: 0.4,
      maxTokens: 600,
      signal: ctx.signal,
    });
    queries = raw.queries;
  } catch {
    onLog?.('检索词生成失败，使用默认检索计划。');
  }

  queries = sanitizeQueries(queries, job);
  if (queries.length === 0) {
    queries = fallbackQueries(job, input);
  }
  if (queries.length === 0) {
    return emptyResearch('无法生成有效检索词，请补充公司名称。');
  }

  onLog?.(`检索计划：${queries.join('；')}`);

  const settled = await Promise.allSettled(queries.map((query) => searchWeb(query)));
  const rawResults: SearchResult[] = [];
  settled.forEach((item, index) => {
    if (item.status === 'fulfilled') {
      rawResults.push(...item.value);
      onLog?.(`「${queries[index]}」返回 ${item.value.length} 条结果`);
    } else {
      onLog?.(`「${queries[index]}」检索失败：${item.reason instanceof Error ? item.reason.message : '未知错误'}`);
    }
  });

  const results = dedupeResults(rawResults).slice(0, 10);
  if (results.length === 0) {
    return {
      ...emptyResearch('未检索到公开结果。可能是检索服务额度不足、网络受限或关键词过于具体。'),
      enabled: true,
      searchedAt: new Date().toISOString(),
    };
  }

  onLog?.(`共获得 ${results.length} 条去重结果，正在提取重点页面…`);

  const excerpts = new Map<number, string>();
  const pageCandidates = results
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => {
      const host = hostOf(item.url);
      return host && !SKIP_HOSTS.has(host);
    })
    .slice(0, 2);

  for (const { item, index } of pageCandidates) {
    try {
      const text = await fetchPageText(item.url);
      if (text) {
        excerpts.set(index + 1, text.slice(0, 5000));
        onLog?.(`已读取：${item.title.slice(0, 30) || item.url}`);
      }
    } catch {
      // 单个页面抓取失败不影响整体
    }
  }

  const sources: ResearchSource[] = results.map((item, index) => ({
    id: index + 1,
    title: item.title || item.url,
    url: item.url,
    snippet: item.snippet.slice(0, 240),
  }));

  const context = results
    .map((item, index) => {
      const id = index + 1;
      const excerpt = excerpts.get(id);
      return `[${id}] ${item.title}
URL: ${item.url}
摘要: ${item.snippet.slice(0, 500)}
${excerpt ? `正文节选: ${excerpt}` : ''}`;
    })
    .join('\n\n')
    .slice(0, 14_000);

  try {
    const raw = await chatJSON({
      system: RESEARCH_SYNTH_SYSTEM,
      user: `【目标岗位】
${job.company} · ${job.title}
方向：${DIRECTION_LABELS[input.direction]}
场景：${SENIORITY_LABELS[job.seniority]}
岗位画像：${job.summary}
JD / 职责摘要：${(input.jd || job.responsibilities.join('；')).slice(0, 2000)}

【检索时间】${new Date().toISOString().slice(0, 10)}

【公开检索结果】
${context}`,
      schema: ResearchLlmSchema,
      temperature: 0.3,
      maxTokens: 3500,
      signal: ctx.signal,
    });

    return {
      enabled: true,
      companyOverview: raw.companyOverview,
      roleInsight: raw.roleInsight,
      interviewProcess: raw.interviewProcess,
      recentNews: raw.recentNews.filter(Boolean).slice(0, 5),
      applicationTips: raw.applicationTips.filter(Boolean).slice(0, 5),
      sources,
      searchedAt: new Date().toISOString(),
    };
  } catch (error) {
    return {
      enabled: true,
      error: `检索已完成，但自动综述失败：${error instanceof Error ? error.message : '未知错误'}。以下保留原始来源，可供手动参考。`,
      companyOverview: '',
      roleInsight: '',
      interviewProcess: '',
      recentNews: [],
      applicationTips: [],
      sources,
      searchedAt: new Date().toISOString(),
    };
  }
}
