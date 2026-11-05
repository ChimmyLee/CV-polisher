/**
 * 端到端冒烟测试（mock 模式，无需 API Key）
 *
 * 流程：
 * 1. 启动生产服务器（next start）
 * 2. 写设置：开启 mock 模式
 * 3. 调用 /api/analyze（SSE），拿到 reportId
 * 4. 验证报告页、报告 JSON、DOCX / Markdown 导出、文件解析、历史记录、删除
 * 5. 恢复原有设置文件，关闭服务器
 *
 * 用法：npm run build:smoke（需先 npm run build）
 */
import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const PORT = Number(process.env.SMOKE_PORT ?? 3123);
const BASE = `http://127.0.0.1:${PORT}`;
const DATA_DIR = path.join(ROOT, 'data');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const NEXT_BIN = path.join(ROOT, 'node_modules', 'next', 'dist', 'bin', 'next');

const SAMPLE_RESUME = `林晓
华东理工大学 信息管理与信息系统 本科 2027.06
lin.xiao@example.com

教育经历
2023.09-2027.06 华东理工大学 信息管理与信息系统
GPA 3.7/4.0，专业前 15%

实习经历
2025.06-2025.09 星野科技 产品运营实习生
- 负责社区内容选题与发布
- 参与用户调研，整理访谈记录
- 协助策划开学季活动，跟进活动执行

项目经历
2025.03-2025.05 校园二手交易平台 运营负责人
- 策划开学季交易活动
- 使用 Excel 统计交易数据并输出周报

技能
SQL、Excel、Python（基础）、Figma、用户调研、文案写作
`;

const SAMPLE_JD = `岗位职责：
1. 负责社区内容选题、活动策划与用户运营；
2. 跟踪核心指标并复盘迭代；
3. 参与用户调研与竞品分析。
任职要求：
1. 本科及以上在读，2027 届优先；
2. 每周到岗 4 天以上，连续实习 3 个月；
3. 具备内容判断力与基础数据分析能力。`;

let settingsBackup = null;
try {
  settingsBackup = await fs.readFile(SETTINGS_FILE, 'utf8');
} catch {
  settingsBackup = null;
}

const env = {
  ...process.env,
  NEXT_TELEMETRY_DISABLED: '1',
  HTTP_PROXY: '',
  HTTPS_PROXY: '',
  http_proxy: '',
  https_proxy: '',
};

const server = spawn(
  process.execPath,
  [NEXT_BIN, 'start', '-H', '127.0.0.1', '-p', String(PORT)],
  { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] },
);

let serverLogs = '';
server.stdout.on('data', (chunk) => {
  serverLogs += chunk.toString();
});
server.stderr.on('data', (chunk) => {
  serverLogs += chunk.toString();
});

const results = [];

function check(name, condition, detail = '') {
  results.push({ name, ok: Boolean(condition) });
  if (!condition) {
    throw new Error(`${name} 失败${detail ? `：${detail}` : ''}`);
  }
}

async function request(url, options = {}, timeoutMs = 60_000) {
  return fetch(url, { ...options, signal: AbortSignal.timeout(timeoutMs) });
}

async function waitForServer() {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const response = await request(`${BASE}/`, {}, 5_000);
      if (response.ok) return;
    } catch {
      // 继续等待
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('服务器未在 30 秒内启动');
}

function parseSse(text) {
  return text
    .split('\n\n')
    .map((block) =>
      block
        .split('\n')
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trim())
        .join('\n'),
    )
    .filter(Boolean)
    .map((data) => {
      try {
        return JSON.parse(data);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

try {
  await waitForServer();

  const home = await request(`${BASE}/`);
  const homeHtml = await home.text();
  check('GET / 返回页面', home.ok && homeHtml.includes('CV Polisher'), String(home.status));

  const saveSettings = await request(`${BASE}/api/settings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      llm: {
        baseUrl: 'https://api.deepseek.com/v1',
        apiKey: '',
        model: 'deepseek-chat',
        temperature: 0.3,
      },
      search: { provider: 'none', apiKey: '' },
      mockMode: true,
    }),
  });
  const settingsJson = await saveSettings.json();
  check('开启演示模式', saveSettings.ok && settingsJson.settings?.mockMode === true);

  const analyze = await request(
    `${BASE}/api/analyze`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        resumeText: SAMPLE_RESUME,
        company: '字节跳动',
        title: '产品运营实习生',
        direction: 'product',
        seniority: 'intern',
        jd: SAMPLE_JD,
        jdUrl: '',
        weeks: 4,
      }),
    },
    90_000,
  );
  const sseText = await analyze.text();
  check('POST /api/analyze 返回 SSE', analyze.ok, String(analyze.status));

  const events = parseSse(sseText);
  const finalEvent = events.find((event) => event.type === 'final');
  check('收到 final 事件', Boolean(finalEvent?.reportId), sseText.slice(0, 300));
  check(
    '没有 error 事件',
    !events.some((event) => event.type === 'error'),
    JSON.stringify(events.filter((event) => event.type === 'error')),
  );
  check('收到 agent_done 事件', events.some((event) => event.type === 'agent_done'));

  const reportId = finalEvent.reportId;

  const reportPage = await request(`${BASE}/report/${reportId}`);
  const reportHtml = await reportPage.text();
  check(
    '报告页可打开',
    reportPage.ok && reportHtml.includes('产品运营实习生'),
    String(reportPage.status),
  );

  const reportResponse = await request(`${BASE}/api/reports/${reportId}`);
  const report = await reportResponse.json();
  check('报告包含润色结果', Boolean(report.polish?.edits?.length));
  check('报告包含项目方案', Boolean(report.project?.projects?.length));
  check('报告包含 mock 情报', report.research?.enabled === true);
  check('事实护栏通过', report.polish?.factGuard?.passed === true);

  const acceptedEditIds = (report.polish?.edits ?? [])
    .filter((edit) => !edit.reverted)
    .map((edit) => edit.id);

  const docx = await request(`${BASE}/api/export/docx`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reportId, acceptedEditIds }),
  });
  check('DOCX 导出状态', docx.ok, String(docx.status));
  check(
    'DOCX Content-Type',
    (docx.headers.get('content-type') ?? '').includes('wordprocessingml'),
  );
  const docxBuffer = await docx.arrayBuffer();
  check('DOCX 文件非空', docxBuffer.byteLength > 5_000, String(docxBuffer.byteLength));

  const markdown = await request(`${BASE}/api/export/markdown`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reportId, kind: 'report' }),
  });
  const markdownText = await markdown.text();
  check('Markdown 导出状态', markdown.ok, String(markdown.status));
  check(
    'Markdown 包含完整章节',
    markdownText.includes('匹配度诊断') &&
      markdownText.includes('项目补齐方案') &&
      markdownText.includes('最终简历'),
  );

  const form = new FormData();
  form.append('file', new File([SAMPLE_RESUME], 'resume.txt', { type: 'text/plain' }));
  const parseResponse = await request(`${BASE}/api/parse`, { method: 'POST', body: form });
  const parsed = await parseResponse.json();
  check(
    'TXT 文件上传解析',
    parseResponse.ok && typeof parsed.text === 'string' && parsed.text.length > 30,
    JSON.stringify(parsed).slice(0, 200),
  );

  // 把刚导出的 DOCX 再上传解析，验证 mammoth 解析链路
  const docxForm = new FormData();
  docxForm.append(
    'file',
    new File([docxBuffer], 'resume.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    }),
  );
  const docxParseResponse = await request(`${BASE}/api/parse`, {
    method: 'POST',
    body: docxForm,
  });
  const docxParsed = await docxParseResponse.json();
  check(
    'DOCX 上传解析',
    docxParseResponse.ok &&
      typeof docxParsed.text === 'string' &&
      (docxParsed.text.includes('林晓') || docxParsed.text.includes('星野科技')),
    JSON.stringify(docxParsed).slice(0, 300),
  );

  const history = await (await request(`${BASE}/api/history`)).json();
  check(
    '历史记录包含报告',
    Array.isArray(history.reports) && history.reports.some((item) => item.id === reportId),
  );

  const deleted = await request(`${BASE}/api/history?id=${encodeURIComponent(reportId)}`, {
    method: 'DELETE',
  });
  const deletedJson = await deleted.json();
  check('删除报告', deleted.ok && deletedJson.ok === true);

  console.log('\nSMOKE OK');
  for (const result of results) console.log(`  ✓ ${result.name}`);
} catch (error) {
  console.error(`\nSMOKE FAILED: ${error instanceof Error ? error.message : error}`);
  console.error('--- server logs ---');
  console.error(serverLogs.slice(-5000));
  process.exitCode = 1;
} finally {
  server.kill('SIGTERM');
  await new Promise((resolve) => setTimeout(resolve, 600));
  if (!server.killed) {
    server.kill('SIGKILL');
  }

  if (settingsBackup !== null) {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(SETTINGS_FILE, settingsBackup, 'utf8');
  } else {
    await fs.unlink(SETTINGS_FILE).catch(() => {});
  }

  // 清理开发过程中产生的临时文件（如果存在）
  await fs.unlink(path.join(ROOT, 'tmp-write-test.txt')).catch(() => {});
}
