'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FileText, Plus, Settings2 } from 'lucide-react';

const NAV = [
  { href: '/', label: '工作台', icon: FileText },
  { href: '/analyze', label: '新建分析', icon: Plus },
  { href: '/settings', label: '设置', icon: Settings2 },
];

export function AppHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-paper/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5 sm:px-8">
        <Link href="/" className="group flex items-baseline gap-2.5">
          <span className="font-serif text-[1.35rem] font-semibold tracking-tight text-ink">
            CV Polisher
          </span>
          <span className="hidden font-mono text-[0.62rem] uppercase tracking-[0.2em] text-faint sm:inline">
            resume atelier
          </span>
        </Link>

        <nav className="flex items-center gap-1 rounded-full border border-line bg-card/70 p-1">
          {NAV.map((item) => {
            const active =
              item.href === '/'
                ? pathname === '/'
                : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.8rem] font-medium transition ${
                  active
                    ? 'bg-accent text-white shadow-sm'
                    : 'text-muted hover:bg-accent-soft hover:text-accent-deep'
                }`}
              >
                <Icon size={14} strokeWidth={2} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
