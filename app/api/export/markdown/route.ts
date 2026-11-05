import { z } from 'zod';
import { reportToMarkdown } from '@/lib/report-markdown';
import { assembleResumeMarkdown } from '@/lib/resume';
import { getReport } from '@/lib/store';

export const runtime = 'nodejs';

const BodySchema = z.object({
  reportId: z.string().min(1),
  acceptedEditIds: z.array(z.string()).optional(),
  kind: z.enum(['report', 'resume']).default('report'),
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

  const markdown =
    parsed.data.kind === 'resume'
      ? report.polish
        ? assembleResumeMarkdown(report.resume, report.polish.edits, parsed.data.acceptedEditIds)
        : assembleResumeMarkdown(report.resume, [])
      : reportToMarkdown(report, parsed.data.acceptedEditIds);

  return new Response(markdown, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': `attachment; filename="${
        parsed.data.kind === 'resume' ? 'resume' : 'report'
      }.md"`,
      'Cache-Control': 'no-store',
    },
  });
}
