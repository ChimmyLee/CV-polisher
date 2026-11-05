import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { AppHeader } from '@/components/AppHeader';

export const metadata: Metadata = {
  title: 'CV Polisher — 简历打磨工作台',
  description:
    '面向互联网校招与实习的简历打磨 Agent：岗位意图识别、匹配度诊断、简历润色、项目规划与公司情报。',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen font-sans text-ink antialiased">
        <AppHeader />
        <main className="mx-auto w-full max-w-6xl px-5 pb-24 pt-7 sm:px-8">{children}</main>
      </body>
    </html>
  );
}
