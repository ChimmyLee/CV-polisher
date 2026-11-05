import { getSettings } from './store';
import type { SearchSettings } from './types';

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

const TIMEOUT_MS = 25_000;

async function searchBocha(query: string, apiKey: string): Promise<SearchResult[]> {
  const response = await fetch('https://api.bochaai.com/v1/web-search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      query,
      summary: true,
      count: 8,
      page: 1,
      freshness: 'oneYear',
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`博查检索失败（${response.status}）`);
  }
  const json = (await response.json()) as {
    data?: { webPages?: { value?: Array<Record<string, unknown>> } };
    webPages?: { value?: Array<Record<string, unknown>> };
  };
  const pages = json.data?.webPages?.value ?? json.webPages?.value ?? [];
  return pages
    .map((page) => ({
      title: String(page.name ?? page.title ?? ''),
      url: String(page.url ?? ''),
      snippet: String(page.summary ?? page.snippet ?? ''),
    }))
    .filter((item) => item.url);
}

async function searchTavily(query: string, apiKey: string): Promise<SearchResult[]> {
  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      search_depth: 'basic',
      max_results: 8,
      include_answer: false,
      include_raw_content: false,
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`Tavily 检索失败（${response.status}）`);
  }
  const json = (await response.json()) as {
    results?: Array<{ title?: string; url?: string; content?: string }>;
  };
  return (json.results ?? [])
    .map((item) => ({
      title: item.title ?? '',
      url: item.url ?? '',
      snippet: item.content ?? '',
    }))
    .filter((item) => item.url);
}

async function searchSerper(query: string, apiKey: string): Promise<SearchResult[]> {
  const response = await fetch('https://google.serper.dev/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': apiKey,
    },
    body: JSON.stringify({ q: query, num: 8, gl: 'cn', hl: 'zh-cn' }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`Serper 检索失败（${response.status}）`);
  }
  const json = (await response.json()) as {
    organic?: Array<{ title?: string; link?: string; snippet?: string }>;
  };
  return (json.organic ?? [])
    .map((item) => ({
      title: item.title ?? '',
      url: item.link ?? '',
      snippet: item.snippet ?? '',
    }))
    .filter((item) => item.url);
}

export async function searchWeb(
  query: string,
  override?: SearchSettings,
): Promise<SearchResult[]> {
  const settings = override ?? (await getSettings()).search;
  if (settings.provider === 'none' || !settings.apiKey) {
    throw new Error('未配置联网检索服务');
  }
  switch (settings.provider) {
    case 'bocha':
      return searchBocha(query, settings.apiKey);
    case 'tavily':
      return searchTavily(query, settings.apiKey);
    case 'serper':
      return searchSerper(query, settings.apiKey);
    default:
      throw new Error(`未知的检索服务：${settings.provider}`);
  }
}

function isPublicHttpUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    const host = url.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host === '0.0.0.0' ||
      host === '::1' ||
      host === '[::1]' ||
      host.endsWith('.local') ||
      host.endsWith('.internal')
    ) {
      return false;
    }
    if (/^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host)) {
      return false;
    }
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return false;
    if (/^169\.254\./.test(host)) return false;
    return true;
  } catch {
    return false;
  }
}

function decodeEntities(text: string): string {
  const named: Record<string, string> = {
    '&nbsp;': ' ',
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'",
    '&middot;': '·',
    '&mdash;': '—',
    '&ndash;': '–',
  };
  let result = text;
  for (const [entity, value] of Object.entries(named)) {
    result = result.split(entity).join(value);
  }
  result = result.replace(/&#(\d+);/g, (_, code) => {
    const point = Number(code);
    return Number.isFinite(point) && point >= 0 && point <= 0x10ffff
      ? String.fromCodePoint(point)
      : '';
  });
  result = result.replace(/&#x([0-9a-f]+);/gi, (_, code) => {
    const point = parseInt(code, 16);
    return Number.isFinite(point) && point >= 0 && point <= 0x10ffff
      ? String.fromCodePoint(point)
      : '';
  });
  return result;
}

export function htmlToText(html: string): string {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr|\/section)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n\n')
    .trim();
  return decodeEntities(text);
}

/** 抓取公开网页正文，用于补充 JD 或检索材料。 */
export async function fetchPageText(url: string): Promise<string> {
  if (!isPublicHttpUrl(url)) {
    throw new Error('链接格式不受支持（仅允许公开的 http/https 地址）');
  }
  const response = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    },
    signal: AbortSignal.timeout(15_000),
    redirect: 'follow',
  });
  if (!response.ok) {
    throw new Error(`网页抓取失败（${response.status}）`);
  }
  const contentType = response.headers.get('content-type') ?? '';
  if (!/text\/html|text\/plain|application\/xhtml/i.test(contentType)) {
    throw new Error('该链接不是网页文本，无法解析');
  }
  const html = await response.text();
  const text = htmlToText(html);
  if (text.length < 40) {
    throw new Error('网页正文为空或需要登录后才能查看');
  }
  return text.slice(0, 20_000);
}

export async function testSearchConnection(
  search: SearchSettings,
): Promise<{ ok: boolean; message: string }> {
  if (search.provider === 'none' || !search.apiKey) {
    return { ok: false, message: '请选择检索服务并填写 API Key' };
  }
  try {
    const results = await searchWeb('互联网 校招 岗位 JD', search);
    return {
      ok: true,
      message: `连接成功，返回 ${results.length} 条结果`,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : '检索服务连接失败',
    };
  }
}
