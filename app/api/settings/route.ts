import { SettingsInputSchema } from '@/lib/schemas';
import { getSettings, saveSettings, toPublicSettings } from '@/lib/store';
import type { Settings } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const settings = await getSettings();
  return Response.json(toPublicSettings(settings));
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: '请求体不是合法 JSON' }, { status: 400 });
  }

  const parsed = SettingsInputSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? '设置参数不合法' },
      { status: 400 },
    );
  }

  const current = await getSettings();
  const incoming = parsed.data;

  const resolveKey = (next: string, previous: string): string => {
    if (next === '__CLEAR__') return '';
    if (!next || next.includes('•')) return previous;
    return next.trim();
  };

  const next: Settings = {
    llm: {
      baseUrl: incoming.llm.baseUrl.trim(),
      apiKey: resolveKey(incoming.llm.apiKey, current.llm.apiKey),
      model: incoming.llm.model.trim(),
      temperature: incoming.llm.temperature,
    },
    search: {
      provider: incoming.search.provider,
      apiKey: resolveKey(incoming.search.apiKey, current.search.apiKey),
    },
    mockMode: incoming.mockMode,
  };

  await saveSettings(next);
  return Response.json({ ok: true, settings: toPublicSettings(next) });
}
