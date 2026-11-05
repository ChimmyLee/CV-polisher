import { z } from 'zod';
import { buildResumeDocx } from '@/lib/docx';
import { getReport } from '@/lib/store';

export const runtime = 'nodejs';

const BodySchema = z.object({
  reportId: z.string().min(1),
  acceptedEditIds: z.array(z.string()).optional(),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: '请求体不是合法 JSON' }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: '参数不合法' }, { status: 400 });
  }

  const report = await getReport(parsed.data.reportId);
  if (!report) {
    return Response.json({ error: '报告不存在' }, { status: 404 });
  }

  const edits = report.polish?.edits ?? [];
  try {
    const file = await buildResumeDocx(report.resume, edits, parsed.data.acceptedEditIds);
    const body = file.buffer.slice(
      file.byteOffset,
      file.byteOffset + file.byteLength,
    ) as ArrayBuffer;

    return new Response(body, {
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': 'attachment; filename="resume.docx"',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'DOCX 生成失败' },
      { status: 500 },
    );
  }
}
