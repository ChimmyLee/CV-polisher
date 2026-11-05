import { deleteReport, listReports } from '@/lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json({ reports: await listReports() });
}

export async function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return Response.json({ error: '缺少 id' }, { status: 400 });
  const ok = await deleteReport(id);
  return Response.json({ ok });
}
