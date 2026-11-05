'use client';

import { useState } from 'react';
import { Download, FileText, Loader2 } from 'lucide-react';
import type { Report } from '@/lib/types';

export function ExportButtons({
  report,
  acceptedEditIds,
}: {
  report: Report;
  acceptedEditIds: string[];
}) {
  const [busy, setBusy] = useState<'docx' | 'md' | null>(null);
  const [error, setError] = useState('');

  const baseName = `${report.job.company || '目标公司'}-${report.job.title || '简历'}`.replace(
    /[\\/:*?"<>|\n\r]/g,
    '-',
  );

  async function download(kind: 'docx' | 'md') {
    setBusy(kind);
    setError('');
    try {
      const response = await fetch(`/api/export/${kind === 'docx' ? 'docx' : 'markdown'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportId: report.id,
          acceptedEditIds,
          ...(kind === 'md' ? { kind: 'report' } : {}),
        }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error ?? '导出失败');
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download =
        kind === 'docx' ? `${baseName}-简历.docx` : `${baseName}-报告.md`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : '导出失败');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={() => void download('md')}
          disabled={busy !== null}
          className="btn btn-ghost btn-sm"
        >
          {busy === 'md' ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} />}
          报告 Markdown
        </button>
        <button
          type="button"
          onClick={() => void download('docx')}
          disabled={busy !== null}
          className="btn btn-primary btn-sm"
        >
          {busy === 'docx' ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
          导出简历 DOCX
        </button>
      </div>
      {error && <p className="text-[0.68rem] text-danger">{error}</p>}
    </div>
  );
}
