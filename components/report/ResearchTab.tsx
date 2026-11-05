'use client';

import Link from 'next/link';
import {
  AlertTriangle,
  CalendarClock,
  ExternalLink,
  Globe2,
  Info,
  Search,
  Sparkles,
} from 'lucide-react';
import { Markdown } from '@/components/Markdown';
import type { Report } from '@/lib/types';
import { safeExternalUrl } from '@/lib/url';

function ProseSection({ title, body }: { title: string; body: string }) {
  if (!body.trim()) return null;
  return (
    <section className="card p-5">
      <h3 className="text-[0.88rem] font-semibold text-ink">{title}</h3>
      <div className="mt-2">
        <Markdown>{body}</Markdown>
      </div>
    </section>
  );
}

export function ResearchTab({ report }: { report: Report }) {
  const research = report.research;

  if (!research.enabled) {
    return (
      <div className="rounded-2xl border border-dashed border-line-strong bg-card/40 px-6 py-16 text-center">
        <Globe2 size={24} className="mx-auto text-faint" />
        <p className="mt-3 text-[0.92rem] font-medium text-ink">本次未启用联网检索</p>
        <p className="mx-auto mt-1.5 max-w-lg text-[0.78rem] leading-6 text-muted">
          {research.error || '配置检索服务后，可获得公司业务、岗位面经与近期动态。'}
        </p>
        <Link href="/settings" className="btn btn-soft mt-5">
          <Search size={14} />
          配置检索服务
        </Link>
      </div>
    );
  }

  const hasContent = Boolean(
    research.companyOverview ||
      research.roleInsight ||
      research.interviewProcess ||
      research.recentNews.length > 0 ||
      research.applicationTips.length > 0,
  );

  return (
    <div className="space-y-5">
      {research.error && (
        <div className="flex items-start gap-2 rounded-xl border border-amber/25 bg-amber-soft px-4 py-3">
          <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber" />
          <p className="text-[0.76rem] leading-6 text-amber">{research.error}</p>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="chip">
            <Globe2 size={11} /> 公开网络信息
          </span>
          <span className="chip">
            <Search size={11} /> {research.sources.length} 条来源
          </span>
          {research.searchedAt && (
            <span className="chip" suppressHydrationWarning>
              <CalendarClock size={11} /> 检索于{' '}
              {new Date(research.searchedAt).toLocaleString('zh-CN', {
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          )}
        </div>
        <p className="flex items-center gap-1 text-[0.68rem] text-faint">
          <Info size={11} /> 请以官方招聘信息为准
        </p>
      </div>

      {!hasContent && research.sources.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line-strong bg-card/40 px-6 py-14 text-center">
          <Sparkles size={22} className="mx-auto text-faint" />
          <p className="mt-3 text-[0.88rem] font-medium text-ink">没有检索到可用的公开信息</p>
          <p className="mt-1 text-[0.75rem] text-muted">
            可以补充更具体的公司名或岗位名后重新分析，或直接参考 JD 与项目方案。
          </p>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4">
            {!hasContent && (
              <div className="rounded-xl border border-amber/25 bg-amber-soft px-4 py-3">
                <p className="text-[0.76rem] leading-6 text-amber">
                  自动综述不可用。右侧保留了本次检索到的原始来源，可逐条查看；也可以补充更具体的
                  JD 或公司信息后重新分析。
                </p>
              </div>
            )}
            <ProseSection title="公司 / 业务概况" body={research.companyOverview} />
            <ProseSection title="岗位真实画像" body={research.roleInsight} />
            <ProseSection title="面试流程与考察点" body={research.interviewProcess} />

            {research.recentNews.length > 0 && (
              <section className="card p-5">
                <h3 className="text-[0.88rem] font-semibold text-ink">近期动态</h3>
                <ul className="mt-2.5 space-y-2">
                  {research.recentNews.map((news, index) => (
                    <li key={index} className="flex gap-2 text-[0.76rem] leading-6 text-muted">
                      <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-accent" />
                      {news}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {research.applicationTips.length > 0 && (
              <section className="card p-5">
                <h3 className="text-[0.88rem] font-semibold text-ink">投递与面试建议</h3>
                <ol className="mt-2.5 space-y-2">
                  {research.applicationTips.map((tip, index) => (
                    <li key={index} className="flex gap-2 text-[0.76rem] leading-6 text-muted">
                      <span className="font-mono text-[0.62rem] text-accent">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      {tip}
                    </li>
                  ))}
                </ol>
              </section>
            )}
          </div>

          <section className="card h-fit p-5 lg:sticky lg:top-36">
            <div className="flex items-center gap-2">
              <ExternalLink size={14} className="text-accent" />
              <h3 className="text-[0.88rem] font-semibold text-ink">来源</h3>
            </div>
            {research.sources.length === 0 ? (
              <p className="mt-2 text-[0.72rem] leading-6 text-muted">
                本次未返回可引用的来源链接。
              </p>
            ) : (
              <ol className="mt-3 space-y-3">
                {research.sources.map((source) => {
                  const href = safeExternalUrl(source.url);
                  return (
                    <li key={source.id} className="flex gap-2.5">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-soft font-mono text-[0.58rem] font-semibold text-accent-deep">
                        {source.id}
                      </span>
                      <div className="min-w-0">
                        {href ? (
                          <a
                            href={href}
                            target="_blank"
                            rel="noreferrer"
                            className="line-clamp-2 text-[0.74rem] font-medium leading-5 text-ink hover:text-accent hover:underline"
                          >
                            {source.title}
                          </a>
                        ) : (
                          <p className="line-clamp-2 text-[0.74rem] font-medium leading-5 text-ink">
                            {source.title}
                          </p>
                        )}
                        <p className="mt-0.5 truncate font-mono text-[0.6rem] text-faint">
                          {source.url}
                        </p>
                        {source.snippet && (
                          <p className="mt-1 line-clamp-2 text-[0.68rem] leading-5 text-muted">
                            {source.snippet}
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
            <p className="mt-4 border-t border-line pt-3 text-[0.65rem] leading-5 text-faint">
              检索结果仅用于求职准备参考；请勿用于任何侵犯第三方权益的用途。
            </p>
          </section>
        </div>
      )}
    </div>
  );
}
