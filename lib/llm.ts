import OpenAI from 'openai';
import type { z } from 'zod';
import { getSettings } from './store';
import type { LLMSettings } from './types';

export class LLMError extends Error {
  cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'LLMError';
    this.cause = cause;
  }
}

export interface ChatJsonOptions<T> {
  system: string;
  user: string;
  schema: z.ZodType<T, any, any>;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

export function extractJson(text: string): unknown {
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    // 继续尝试从文本中截取 JSON
  }

  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
    } catch {
      // 继续尝试数组
    }
  }

  const firstBracket = cleaned.indexOf('[');
  const lastBracket = cleaned.lastIndexOf(']');
  if (firstBracket !== -1 && lastBracket > firstBracket) {
    try {
      return JSON.parse(cleaned.slice(firstBracket, lastBracket + 1));
    } catch {
      // 放弃
    }
  }

  throw new Error('模型未返回合法 JSON');
}

/**
 * 部分兼容模型会把缺失字段输出为 null；schema 里 null 不等于“缺省”，
 * 统一剔除 null，让 optional/default 生效。
 */
export function stripNulls(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.filter((item) => item !== null).map(stripNulls);
  }
  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (item === null) continue;
      result[key] = stripNulls(item);
    }
    return result;
  }
  return value;
}

function errorStatus(error: unknown): number | undefined {
  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as { status?: unknown }).status;
    return typeof status === 'number' ? status : undefined;
  }
  return undefined;
}

function errorMessage(error: unknown): string {
  if (!error) return '未知错误';
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function friendlyApiError(error: unknown): LLMError {
  const status = errorStatus(error);
  const message = errorMessage(error);
  if (status === 401 || status === 403) {
    return new LLMError('API Key 无效或没有访问权限，请到「设置」检查。', error);
  }
  if (status === 404) {
    return new LLMError('模型名或 Base URL 不正确（404），请到「设置」检查。', error);
  }
  if (status === 429) {
    return new LLMError('请求过于频繁或额度不足（429），请稍后重试。', error);
  }
  if (/timeout|timed out|abort/i.test(message)) {
    return new LLMError('模型响应超时，请检查网络或稍后重试。', error);
  }
  if (/fetch failed|ENOTFOUND|ECONNREFUSED|network/i.test(message)) {
    return new LLMError('无法连接到模型服务，请检查 Base URL 与网络。', error);
  }
  return new LLMError(`模型调用失败：${message.slice(0, 240)}`, error);
}

export async function chatJSONWithConfig<T>(
  llm: LLMSettings,
  options: ChatJsonOptions<T>,
): Promise<T> {
  if (!llm.apiKey) {
    throw new LLMError('尚未配置大模型 API Key。请到「设置」填写，或在设置中开启演示模式。');
  }

  const client = new OpenAI({
    apiKey: llm.apiKey,
    baseURL: llm.baseUrl,
    timeout: (options.maxTokens ?? 4096) > 5000 ? 240_000 : 120_000,
    maxRetries: 0,
  });

  let jsonMode = true;
  let feedback = '';
  let lastError: unknown;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    let content = '';

    try {
      const completion = await client.chat.completions.create(
        {
          model: llm.model,
          temperature: options.temperature ?? llm.temperature,
          max_tokens: options.maxTokens ?? 4096,
          messages: [
            { role: 'system', content: options.system },
            { role: 'user', content: options.user + feedback },
          ],
          ...(jsonMode ? { response_format: { type: 'json_object' as const } } : {}),
        },
        { signal: options.signal },
      );
      content = completion.choices[0]?.message?.content ?? '';
    } catch (error) {
      lastError = error;
      const status = errorStatus(error);
      // 部分 OpenAI 兼容服务不支持 response_format，降级重试一次
      if (status === 400 && jsonMode) {
        jsonMode = false;
        feedback = '\n\n请直接输出合法 JSON，不要使用 Markdown 代码块，也不要添加解释文字。';
        continue;
      }
      throw friendlyApiError(error);
    }

    try {
      const data = stripNulls(extractJson(content));
      const parsed = options.schema.safeParse(data);
      if (!parsed.success) {
        const issues = parsed.error.issues
          .slice(0, 6)
          .map((issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`)
          .join('；');
        throw new Error(`输出结构不符合要求（${issues}）`);
      }
      return parsed.data;
    } catch (error) {
      lastError = error;
      jsonMode = false;
      feedback = `\n\n上一次输出不合规：${errorMessage(error)}。请严格按照要求重新输出纯 JSON，不要任何解释文字或 Markdown。`;
    }
  }

  throw new LLMError(
    `模型多次未能返回合规结果：${errorMessage(lastError).slice(0, 300)}`,
    lastError,
  );
}

export async function chatJSON<T>(options: ChatJsonOptions<T>): Promise<T> {
  const settings = await getSettings();
  return chatJSONWithConfig(settings.llm, options);
}

export async function testLLMConnection(
  llm: LLMSettings,
): Promise<{ ok: boolean; message: string }> {
  if (!llm.apiKey) {
    return { ok: false, message: '请填写 API Key' };
  }
  try {
    const client = new OpenAI({
      apiKey: llm.apiKey,
      baseURL: llm.baseUrl,
      timeout: 30_000,
      maxRetries: 0,
    });

    const send = async (jsonMode: boolean) => {
      const completion = await client.chat.completions.create({
        model: llm.model,
        temperature: 0,
        max_tokens: 24,
        messages: [
          {
            role: 'user',
            content: '只输出 JSON：{"ok": true}',
          },
        ],
        ...(jsonMode ? { response_format: { type: 'json_object' as const } } : {}),
      });
      return completion.choices[0]?.message?.content ?? '';
    };

    let text = '';
    try {
      text = await send(true);
    } catch (error) {
      // 部分兼容端点不支持 response_format，降级重试一次
      if (errorStatus(error) === 400) {
        text = await send(false);
      } else {
        throw error;
      }
    }

    const data = extractJson(text) as { ok?: boolean } | null;
    if (data && data.ok === true) {
      return { ok: true, message: `连接成功，模型：${llm.model}` };
    }
    return { ok: true, message: `已连通，但返回格式异常：${text.slice(0, 60)}` };
  } catch (error) {
    return { ok: false, message: friendlyApiError(error).message };
  }
}
