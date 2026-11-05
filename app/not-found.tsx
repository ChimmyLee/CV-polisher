import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl py-24 text-center">
      <p className="eyebrow">404</p>
      <h1 className="mt-3 font-serif text-2xl font-semibold text-ink">没有找到这份报告</h1>
      <p className="mt-2 text-[0.82rem] leading-6 text-muted">
        报告可能已被删除，或链接不完整。回到工作台重新发起一次分析即可。
      </p>
      <Link href="/" className="btn btn-primary mt-6">
        返回工作台
      </Link>
    </div>
  );
}
