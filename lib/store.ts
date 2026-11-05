import { promises as fs } from 'fs';
import path from 'path';
import type {
  PublicSettings,
  Report,
  ReportSummary,
  SearchProvider,
  Settings,
} from './types';

const DATA_DIR = path.join(process.cwd(), 'data');
const REPORTS_DIR = path.join(DATA_DIR, 'reports');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

function envSettings(): Settings {
  const provider = (process.env.SEARCH_PROVIDER ?? 'none') as SearchProvider;
  const allowed: SearchProvider[] = ['bocha', 'tavily', 'serper', 'none'];
  return {
    llm: {
      baseUrl: process.env.LLM_BASE_URL ?? 'https://api.deepseek.com/v1',
      apiKey: process.env.LLM_API_KEY ?? '',
      model: process.env.LLM_MODEL ?? 'deepseek-chat',
      temperature: Number(process.env.LLM_TEMPERATURE ?? 0.3) || 0.3,
    },
    search: {
      provider: allowed.includes(provider) ? provider : 'none',
      apiKey: process.env.SEARCH_API_KEY ?? '',
    },
    mockMode: process.env.MOCK_MODE === '1',
  };
}

async function ensureDirs() {
  await fs.mkdir(REPORTS_DIR, { recursive: true });
}

export async function getSettings(): Promise<Settings> {
  const defaults = envSettings();
  try {
    const raw = await fs.readFile(SETTINGS_FILE, 'utf8');
    const stored = JSON.parse(raw) as Partial<Settings>;
    return {
      llm: {
        baseUrl: stored.llm?.baseUrl || defaults.llm.baseUrl,
        apiKey: stored.llm?.apiKey || defaults.llm.apiKey,
        model: stored.llm?.model || defaults.llm.model,
        temperature:
          typeof stored.llm?.temperature === 'number'
            ? stored.llm.temperature
            : defaults.llm.temperature,
      },
      search: {
        provider: stored.search?.provider ?? defaults.search.provider,
        apiKey: stored.search?.apiKey || defaults.search.apiKey,
      },
      mockMode:
        typeof stored.mockMode === 'boolean' ? stored.mockMode : defaults.mockMode,
    };
  } catch {
    return defaults;
  }
}

export async function saveSettings(settings: Settings): Promise<Settings> {
  await ensureDirs();
  await fs.writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf8');
  return settings;
}

export function maskKey(key: string): string {
  if (!key) return '';
  if (key.length <= 8) return '••••••••';
  return `••••••${key.slice(-4)}`;
}

export function toPublicSettings(settings: Settings): PublicSettings {
  return {
    llm: {
      baseUrl: settings.llm.baseUrl,
      model: settings.llm.model,
      temperature: settings.llm.temperature,
      apiKeyMasked: maskKey(settings.llm.apiKey),
      hasApiKey: Boolean(settings.llm.apiKey),
    },
    search: {
      provider: settings.search.provider,
      apiKeyMasked: maskKey(settings.search.apiKey),
      hasApiKey: Boolean(settings.search.apiKey),
    },
    mockMode: settings.mockMode,
  };
}

const ID_RE = /^[a-zA-Z0-9-]+$/;

export async function saveReport(report: Report): Promise<void> {
  if (!ID_RE.test(report.id)) throw new Error('非法报告 ID');
  await ensureDirs();
  const file = path.join(REPORTS_DIR, `${report.id}.json`);
  await fs.writeFile(file, JSON.stringify(report, null, 2), 'utf8');
}

export async function getReport(id: string): Promise<Report | null> {
  if (!ID_RE.test(id)) return null;
  try {
    const raw = await fs.readFile(path.join(REPORTS_DIR, `${id}.json`), 'utf8');
    return JSON.parse(raw) as Report;
  } catch {
    return null;
  }
}

export async function deleteReport(id: string): Promise<boolean> {
  if (!ID_RE.test(id)) return false;
  try {
    await fs.unlink(path.join(REPORTS_DIR, `${id}.json`));
    return true;
  } catch {
    return false;
  }
}

export async function listReports(): Promise<ReportSummary[]> {
  try {
    await ensureDirs();
    const files = (await fs.readdir(REPORTS_DIR)).filter((f) => f.endsWith('.json'));
    const summaries: ReportSummary[] = [];
    for (const file of files) {
      try {
        const raw = await fs.readFile(path.join(REPORTS_DIR, file), 'utf8');
        const report = JSON.parse(raw) as Report;
        summaries.push({
          id: report.id,
          createdAt: report.createdAt,
          company: report.job.company || '目标公司',
          title: report.job.title || '目标岗位',
          score: report.gap.score,
          route: report.gap.route,
          mock: report.meta?.mock ?? false,
        });
      } catch {
        // 跳过损坏的报告文件
      }
    }
    return summaries.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  } catch {
    return [];
  }
}
