import { notFound } from 'next/navigation';
import { ReportClient } from '@/components/report/ReportClient';
import { getReport } from '@/lib/store';

export const dynamic = 'force-dynamic';

export default async function ReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const report = await getReport(id);
  if (!report) notFound();

  return <ReportClient report={report} />;
}
