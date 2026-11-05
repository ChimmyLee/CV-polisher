'use client';

import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-xl py-24 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-danger-soft text-danger">
        <AlertTriangle size={22} />
      </div>
      <h1 className="mt-5 font-serif text-2xl font-semibold text-ink">页面出了点问题</h1>
      <p className="mt-2 text-[0.82rem] leading-6 text-muted">
        {error.message || '未知错误。可以重试，或返回工作台重新发起分析。'}
      </p>
      <div className="mt-6 flex justify-center gap-3">
        <button type="button" onClick={reset} className="btn btn-primary">
          重试
        </button>
        <Link href="/" className="btn btn-ghost">
          返回工作台
        </Link>
      </div>
    </div>
  );
}
