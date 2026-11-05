import { testLLMConnection } from '@/lib/llm';
import { testSearchConnection } from '@/lib/search';
import { TestConnectionSchema } from '@/lib/schemas';
import { getSettings } from '@/lib/store';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: '请求体不是合法 JSON' }, { status: 400 });
  }

  const parsed = TestConnectionSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? '参数不合法' },
      { status: 400 },
    );
  }

  const current = await getSettings();
  const { type } = parsed.data;

  if (type === 'llm') {
    const llm = parsed.data.llm
      ? {
          baseUrl: parsed.data.llm.baseUrl,
          model: parsed.data.llm.model,
          temperature: parsed.data.llm.temperature,
          apiKey:
            parsed.data.llm.apiKey && !parsed.data.llm.apiKey.includes('•')
              ? parsed.data.llm.apiKey
              : current.llm.apiKey,
        }
      : current.llm;
    const result = await testLLMConnection(llm);
    return Response.json(result);
  }

  const search = parsed.data.search
    ? {
        provider: parsed.data.search.provider,
        apiKey:
          parsed.data.search.apiKey && !parsed.data.search.apiKey.includes('•')
            ? parsed.data.search.apiKey
            : current.search.apiKey,
      }
    : current.search;
  const result = await testSearchConnection(search);
  return Response.json(result);
}
