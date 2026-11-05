import { getReport } from '@/lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const report = await getReport(id);
  if (!report) {
    return Response.json({ error: '报告不存在' }, { status: 404 });
  }
  return Response.json(report);
}
