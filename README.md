# CV Polisher

面向互联网校招 / 实习的**简历打磨 Agent 工作台**。上传简历、填入目标岗位，主控 Agent 完成岗位意图识别与匹配度诊断，再按需调度简历润色、项目规划、联网检索三个子 Agent，产出可执行的定制简历与补齐方案。


---

## 功能

- **岗位意图识别**：从 JD 中抽取硬性要求、加分项、职责、隐性偏好与带权重关键词；缺失 JD 时基于岗位名称推断并明确标注。
- **匹配度诊断**：5 个维度加权评分（硬性条件 / 经历相关性 / 关键词覆盖 / 成果量化 / 表达质量），输出差距清单与「润色 / 补项目 / 两者都做」的混合路由。
- **简历润色 Agent**：逐条 before / after 改写，STAR 结构、关键词自然融入；缺失数据用 `[待补充]` 占位，不编造事实。
- **事实护栏**：规则校验新增数字 + 模型校验新增实体，违规改写自动回退。
- **项目规划 Agent**：三档项目（1–2 周 / 3–4 周 / 6–8 周），含 JD 关键词映射、按周任务、验收标准、量化口径与简历 bullet 模板。
- **联网检索 Agent**：博查 / Tavily / Serper 可插拔；生成岗位作战情报并附来源链接；未配置时优雅降级。
- **报告与导出**：总览、简历优化、项目方案、公司情报、关键词 5 个视图；逐条采纳/忽略；导出完整报告 Markdown 与最终简历 DOCX（中文排版）。
- **演示模式**：无需任何 API Key，完整体验流程与界面（数据为示例）。
- **本地优先**：报告与设置存于本机 `data/`，API Key 仅服务端读取，不上传第三方。

---

## 技术栈

| 层 | 选型 |
|---|---|
| 框架 | Next.js 15（App Router）+ React 19 + TypeScript |
| 样式 | Tailwind CSS 4 + CSS 变量 |
| 模型 | `openai` SDK，兼容任意 OpenAI Chat Completions 端点 |
| 检索 | Bocha / Tavily / Serper 适配器 |
| 文件解析 | `unpdf`（PDF）、`mammoth`（DOCX） |
| 校验 | `zod` |
| 导出 | `docx` |
| 存储 | 本地 JSON 文件（无数据库） |

---

## 快速开始

要求：Node.js ≥ 20。

### 1. 安装

```powershell
cd "CV polisher"
npm install --no-audit --no-fund
```

> 国内网络如果安装较慢，可先执行 `npm config set registry https://registry.npmmirror.com`。
> 如果终端里设置了不可用的 `HTTP_PROXY` / `HTTPS_PROXY`，见文末「常见问题」。

### 2. 启动与关闭

#### 开发模式（日常使用）

```powershell
cd "CV polisher"
npm run dev
```

看到 `Ready` 后打开 <http://localhost:3000>。修改代码会自动热更新，使用期间保持这个终端运行。

停止：在运行 `npm run dev` 的终端按 `Ctrl + C`。

#### 生产模式（更稳定）

```powershell
cd "CV polisher"
npm run build
npm start
```

打开同一地址。停止同样按 `Ctrl + C`。

> 不要同时运行 `npm run dev` 和 `npm start`，两者会抢占同一个端口（默认 3000）。

#### 修改端口 / 端口被占用

```powershell
npm run dev -- -p 3001
# 或
npm start -- -p 3001
```

如果找不到是哪个终端在运行，可以用 PowerShell 按端口结束进程：

```powershell
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

把 `<PID>` 换成 `netstat` 输出最后一列的数字；改过端口就把 `:3000` 换成对应端口。

### 3. 配置（只需做一次）

启动后打开 <http://localhost:3000/settings>：

1. **大模型**：点预设（DeepSeek / Kimi / 通义 / GLM），或手动填写 `Base URL`、`模型名`、`API Key` → 点「测试连接」→「保存设置」。
2. **联网检索**（可选）：选择博查 / Tavily / Serper，填写 Key →「测试检索」→ 保存。不配置也能完成分析，只是没有公司情报。
3. **演示模式**：没有 Key 时打开，可完整体验流程；内容会明确标注为示例数据。

#### 推荐模型端点

| 服务 | Base URL | 模型示例 |
|---|---|---|
| DeepSeek | `https://api.deepseek.com/v1` | `deepseek-chat` |
| Kimi | `https://api.moonshot.cn/v1` | `moonshot-v1-32k` |
| 通义千问 | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `qwen-plus` |
| GLM | `https://open.bigmodel.cn/api/paas/v4` | `glm-4-plus` |

> 模型需支持 Chat Completions；若服务不支持 `response_format: json_object`，应用会自动降级重试。
> 规划类输出较长，建议使用上下文与输出上限较大的模型。

#### 联网检索

在设置页选择并填写 Key：

- **博查 Bocha**：中文结果质量好，适合国内岗位与公司信息。
- **Tavily**：英文与通用网页。
- **Serper**：Google 结果。

不配置也能完整跑通流程，只是报告缺少「公司情报」。

#### 使用环境变量（可选）

```powershell
# PowerShell
Copy-Item .env.example .env.local

# Git Bash / macOS / Linux
cp .env.example .env.local
```

```env
LLM_BASE_URL=https://api.deepseek.com/v1
LLM_API_KEY=sk-...
LLM_MODEL=deepseek-chat
SEARCH_PROVIDER=bocha
SEARCH_API_KEY=...
MOCK_MODE=0
```

环境变量作为默认值；设置页保存到 `data/settings.json` 的配置优先。

---

## Agent 架构

```
输入（简历 + 岗位 + JD）
        │
        ▼
┌───────────────────────────────┐
│ 主控 Agent                    │
│ 1 简历解析 → ResumeProfile    │
│ 2 岗位意图 → JobProfile       │
│ 3 匹配诊断 → GapAnalysis      │
│ 4 混合路由 → polish/project/both│
└──────────────┬────────────────┘
               │  并行
     ┌─────────┼──────────────┐
     ▼         ▼              ▼
 Research   Polish        Planner
 情报检索   逐条改写      梯度项目
     └─────────┼──────────────┘
               ▼
        质量审核（事实护栏 + 长度 + 关键词）
               ▼
        报告 / 导出
```

核心实现：

- `lib/pipeline.ts`：流水线编排与 SSE 事件。
- `lib/agents/orchestrator.ts`：解析、岗位分析、诊断、路由、审核。
- `lib/agents/polish.ts`、`planner.ts`、`research.ts`：三个子 Agent。
- `lib/keywords.ts`：岗位关键词库 / 同义词 / 加权覆盖率（确定性规则）。
- `lib/fact-guard.ts`：数字与实体事实校验。
- `prompts/*.ts`：各 Agent 的 system prompt，与业务逻辑分离。

### 路由规则

- 有相关经历且关键词加权覆盖 ≥ 45% → `polish`
- 无相关经历或覆盖 < 20% → `project`
- 其余 → `both`

阈值见 `lib/routing.ts`，有单元测试覆盖。

---

## 目录结构

```
app/
  page.tsx                  工作台 / 历史
  analyze/page.tsx          三步输入向导 + 实时 Agent 时间线
  report/[id]/page.tsx      报告页
  settings/page.tsx         模型 / 检索 / 演示模式
  api/
    analyze/route.ts        主编排（SSE）
    parse/route.ts          文件解析
    settings/route.ts       读写设置
    settings/test/route.ts  连接测试
    history/route.ts        历史列表 / 删除
    export/docx/route.ts    DOCX 导出
    export/markdown/route.ts
components/
  report/                   报告 5 个 Tab + 导出
lib/
  agents/                   4 个 Agent
  llm.ts                    OpenAI 兼容客户端 + JSON 重试
  search.ts                 检索适配器 + 网页正文抓取
  keywords.ts               关键词库与覆盖率
  fact-guard.ts             事实护栏
  resume.ts                 简历拼装（Markdown / DOCX 共用）
  store.ts                  本地存储
  mock.ts                   演示数据
  pipeline.ts               流水线
prompts/                    各 Agent 提示词
data/                      运行时生成（gitignore）
```

---

## 测试与构建

```bash
npm test             # 关键词覆盖、事实护栏、路由规则、简历拼装（29 个单元测试）
npm run build        # 生产构建 + TypeScript 检查
npm run build:smoke  # 端到端冒烟：启动生产服务器，mock 模式走通分析 → 报告 → 导出 → 上传 → 历史
npm start            # 以生产模式启动（需先 build）
```

`build:smoke` 会临时开启 mock 模式、在 3123 端口启动服务器、生成并删除一份测试报告，结束后恢复原有设置。

> 本项目使用 **Vitest**（不是 Jest）。不要用 `jest` 或 VSCode 的 Jest 扩展运行这些测试文件。

---

## 数据与隐私

- 简历文本、报告与设置只写入本机 `data/`；`data/` 已加入 `.gitignore`。
- 上传文件解析后不保留原始文件。
- API Key 只存服务端，设置接口返回掩码；前端不会拿到明文。
- 联网检索会去除查询中的邮箱与手机号；只访问公开网页。
- **本应用面向本地单用户使用，未做账号与鉴权。不要直接部署到公网。**

---

## 已知限制

- 扫描版 PDF / 图片简历暂不支持 OCR，请粘贴文本或上传可复制文字的 PDF。
- DOCX 导出使用微软雅黑，未安装该字体的系统会回退到默认中文字体。
- 检索结果的时效性与准确性取决于搜索服务；报告会附来源，请以官方招聘信息为准。
- 模型输出仍可能有偏差；所有改写都应与原文对照后人工确认，`[待补充]` 占位必须填真实数据。
- 当前界面以桌面端为主，移动端可用但未针对小屏优化。

## 常见问题

**`npm install` 返回 404 / `CONNECT tunnel failed`**
当前终端可能设置了不可用的 `HTTP_PROXY` / `HTTPS_PROXY`。临时绕过：

```bash
# Git Bash / macOS / Linux
HTTP_PROXY= HTTPS_PROXY= npm install

# PowerShell
$env:HTTP_PROXY=""; $env:HTTPS_PROXY=""; npm install
```

也可以检查 `npm config get proxy` 与 `npm config get https-proxy`。若代理变量无法清除，可直接指定 registry 域名绕过：

```bash
npm install --no-audit --no-fund --noproxy=registry.npmmirror.com,cdn.npmmirror.com
```

**构建时报 `Jest worker encountered ... child process exceptions, exceeding retry limit`**
这不是本项目的 Jest 测试报错——`npm test` 用的是 **Vitest**，项目里没有 Jest。该提示来自 Next.js 构建时内部的 `jest-worker`（TypeScript 类型检查工作线程），通常由 `.next` 缓存被占用、同时开了多个 dev/build 进程、内存不足或杀毒软件锁文件引起。

处理顺序：

1. 关闭所有正在运行的 `npm run dev` / `npm start` 终端；
2. 删除 `.next` 后重试：
   ```powershell
   Remove-Item -Recurse -Force .next
   npm run build
   ```
3. 仍然失败时提高 Node 内存后重试：
   ```powershell
   $env:NODE_OPTIONS="--max-old-space-size=4096"
   npm run build
   ```
4. 如果你是在 VSCode 的测试面板看到 Jest 报错：通常是装了 Jest 扩展并在自动跑 `*.test.ts`。本项目的测试文件是 Vitest，请在终端运行 `npm test`；或在 VSCode 中禁用 Jest 扩展、改用 Vitest 扩展。

**模型调用失败（404 / 401 / 429）**
到「设置」确认 Base URL 是否包含正确的路径（例如 DeepSeek 需要 `/v1`）、模型名是否存在、账户是否有额度。可先用「测试连接」。

**联网检索没有结果**
确认检索服务 Key 与额度；部分站点会拦截服务端抓取，但搜索摘要仍会保留在来源中。也可以不配置检索，直接粘贴 JD。

**PDF 提取不到文字**
多为扫描件或图片型 PDF。v1 不做 OCR，请粘贴文本，或换一份可复制文字的 PDF。


---

## Roadmap

- 扫描 PDF OCR、英文简历
- 多 JD 对比与一岗一版管理
- 面试题预测与模拟面试
- 简历在线编辑与模板库
- 多轮迭代（改完简历后重新评分）
