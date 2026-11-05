import { AnalyzeRequestSchema } from '@/lib/schemas';
import { runAnalysis } from '@/lib/pipeline';
import type { PipelineEvent } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: '请求体不是合法 JSON' }, { status: 400 });
  }

  const parsed = AnalyzeRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? '请求参数不合法' },
      { status: 400 },
    );
  }

  const input = parsed.data;
  if (!input.title.trim() && !input.jd.trim() && !input.jdUrl.trim()) {
    return Response.json(
      { error: '请至少填写岗位名称、JD 文本或 JD 链接中的一项' },
      { status: 400 },
    );
  }

  const encoder = new TextEncoder();
  let heartbeat: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: PipelineEvent) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          // 客户端可能已断开
        }
      };

      heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': ping\n\n'));
        } catch {
          // 忽略
        }
      }, 15_000);

      try {
        const report = await runAnalysis(input, emit, request.signal);
        emit({ type: 'final', reportId: report.id });
      } catch (error) {
        emit({
          type: 'error',
          message: error instanceof Error ? error.message : '分析失败，请稍后重试',
        });
      } finally {
        if (heartbeat) clearInterval(heartbeat);
        try {
          controller.close();
        } catch {
          // 已关闭
        }
      }
    },
    cancel() {
      if (heartbeat) clearInterval(heartbeat);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
