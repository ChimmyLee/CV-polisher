import type {
  AnalyzeInput,
  Experience,
  GapAnalysis,
  JobProfile,
  KeywordCoverage,
  PolishEdit,
  PolishResult,
  ProjectIdea,
  ProjectPlan,
  ProjectWeek,
  QualityReview,
  ResearchBrief,
  ResumeProfile,
  RoleFamily,
} from './types';
import { computeKeywordCoverage, libraryKeywordsFor, ROLE_LABELS } from './keywords';
import { assembleResumeMarkdown } from './resume';
import { resumeLengthStats } from './fact-guard';
import { computeWeightedScore } from './routing';

export const MOCK_NOTE = '演示模式：以下为示例数据，未调用真实模型，也未进行真实联网检索。';

/* --------------------------------- 示例简历 -------------------------------- */

export function mockResumeProfile(): ResumeProfile {
  const education: Experience[] = [
    {
      id: 'edu-1',
      title: '本科 · 信息管理与信息系统',
      org: '华东理工大学',
      period: '2023.09 - 2027.06',
      bullets: [
        { id: 'edu-1-1', text: 'GPA 3.7/4.0，专业前 15%' },
        { id: 'edu-1-2', text: '主修课程：数据库原理、统计学、Python 程序设计、市场营销' },
      ],
    },
  ];
  const internships: Experience[] = [
    {
      id: 'int-1',
      title: '产品运营实习生',
      org: '星野科技',
      period: '2025.06 - 2025.09',
      bullets: [
        { id: 'int-1-1', text: '负责社区内容选题与发布' },
        { id: 'int-1-2', text: '参与用户调研，整理访谈记录' },
        { id: 'int-1-3', text: '协助策划开学季活动，跟进活动执行' },
      ],
    },
  ];
  const projects: Experience[] = [
    {
      id: 'prj-1',
      title: '校园二手交易平台',
      org: '课程项目',
      period: '2025.03 - 2025.05',
      bullets: [
        { id: 'prj-1-1', text: '担任运营负责人，策划开学季交易活动' },
        { id: 'prj-1-2', text: '使用 Excel 统计交易数据并输出周报' },
      ],
    },
    {
      id: 'prj-2',
      title: '短视频用户留存调研',
      org: '个人项目',
      period: '2025.09 - 2025.10',
      bullets: [
        { id: 'prj-2-1', text: '设计问卷并回收 120 份有效样本' },
        { id: 'prj-2-2', text: '撰写留存影响因素分析报告' },
      ],
    },
  ];

  const rawText = [
    '林晓',
    '华东理工大学 信息管理与信息系统 本科 2027.06',
    'lin.xiao@example.com',
    ...education.flatMap((e) => [e.title, ...e.bullets.map((b) => b.text)]),
    ...internships.flatMap((e) => [e.title, ...e.bullets.map((b) => b.text)]),
    ...projects.flatMap((e) => [e.title, ...e.bullets.map((b) => b.text)]),
    'SQL、Excel、Python（基础）、Figma、用户调研、文案写作',
    '校三等奖学金、互联网+校级二等奖',
  ].join('\n');

  return {
    basic: {
      name: '林晓',
      school: '华东理工大学',
      major: '信息管理与信息系统',
      degree: '本科',
      graduation: '2027.06',
      contact: 'lin.xiao@example.com',
    },
    education,
    internships,
    projects,
    skills: ['SQL', 'Excel', 'Python（基础）', 'Figma', '用户调研', '文案写作'],
    awards: ['校三等奖学金', '互联网+校级二等奖'],
    selfEvaluation: '对用户运营有热情，学习能力强。',
    rawText,
  };
}

/* --------------------------------- 示例岗位 -------------------------------- */

function familyFor(input: AnalyzeInput): RoleFamily {
  if (input.direction === 'tech') return 'backend';
  if (input.direction === 'algorithm') return 'algorithm';
  if (input.direction === 'design') return 'design';
  if (input.direction === 'product') {
    return /运营/.test(input.title) ? 'operations' : 'product';
  }
  return 'other';
}

const ROLE_COPY: Record<
  RoleFamily,
  { must: string[]; nice: string[]; resp: string[]; hidden: string[]; summary: string }
> = {
  backend: {
    must: ['本科及以上在读，计算机相关专业', '熟练掌握 Java/Go/Python 至少一门', '了解数据库、网络与操作系统基础'],
    nice: ['有高并发或分布式项目经验', '有开源项目或技术博客'],
    resp: ['参与后端服务设计与开发', '优化接口性能与系统稳定性', '参与线上问题排查与技术方案评审'],
    hidden: ['有可展示的工程项目', '能讲清技术选型与权衡'],
    summary: '业务后端开发方向，重视工程基础与项目深度',
  },
  frontend: {
    must: ['本科及以上在读，计算机相关专业', '扎实的 JavaScript/TypeScript 基础', '熟悉 React 或 Vue'],
    nice: ['有性能优化经验', '有跨端或可视化项目'],
    resp: ['负责业务前端页面开发', '参与组件库与工程化建设', '优化页面性能与交互体验'],
    hidden: ['有线上可访问的作品', '关注用户体验细节'],
    summary: '业务前端开发方向，重视工程化与用户体验',
  },
  client: {
    must: ['本科及以上在读，计算机相关专业', '熟悉 Android/iOS 至少一个平台', '掌握一门客户端开发语言'],
    nice: ['有 Flutter/React Native 经验', '有性能优化或稳定性治理经验'],
    resp: ['负责客户端功能开发与维护', '参与性能优化与崩溃治理', '与产品、设计协作交付'],
    hidden: ['有可展示的 App 或 Demo'],
    summary: '客户端开发方向，重视工程能力与用户体验',
  },
  algorithm: {
    must: ['本科及以上在读，计算机/数学/统计相关专业', '扎实的机器学习与深度学习基础', '熟练使用 Python 与 PyTorch'],
    nice: ['有论文、竞赛或开源项目', '有大模型/RAG 实践经验'],
    resp: ['参与算法模型训练与评估', '跟进业务指标并迭代模型', '参与数据处理与特征工程'],
    hidden: ['有可复现的项目与评估结果', '能讲清 baseline 与改进点'],
    summary: '算法工程方向，重视建模能力与实验素养',
  },
  data: {
    must: ['本科及以上在读，统计/数学/计算机相关专业', '熟练使用 SQL 与 Python', '掌握基础统计与实验方法'],
    nice: ['有 AB 实验或指标体系搭建经验', '有数据可视化作品'],
    resp: ['负责业务数据分析与指标体系维护', '支持 AB 实验设计与评估', '输出分析报告与策略建议'],
    hidden: ['对业务问题敏感', '能独立完成分析闭环'],
    summary: '数据分析方向，重视业务理解与实验能力',
  },
  product: {
    must: ['本科及以上在读，2027 届优先', '每周到岗 4 天以上，连续实习 3 个月', '具备用户调研与数据分析能力'],
    nice: ['有内容社区或工具类产品实习经历', '能独立撰写 PRD'],
    resp: ['负责产品需求分析与方案设计', '跟进版本迭代与跨团队协作', '通过数据与用户反馈优化产品'],
    hidden: ['有相关实习经历', '对目标行业有真实使用体验'],
    summary: '产品经理方向，重视需求洞察与落地能力',
  },
  operations: {
    must: ['本科及以上在读，2027 届优先', '每周到岗 4 天以上，连续实习 3 个月', '具备内容判断力与基础数据分析能力'],
    nice: ['有内容社区实习经历', '有活动策划或增长实验经验'],
    resp: ['负责内容选题、活动策划与用户运营', '跟踪核心指标并复盘迭代', '参与用户调研与竞品分析'],
    hidden: ['有相关实习经历', '对内容社区有长期观察'],
    summary: '内容社区方向的产品运营实习岗',
  },
  design: {
    must: ['本科及以上在读，设计相关专业', '熟练使用 Figma', '有完整作品集'],
    nice: ['有互联网产品设计实习经历', '具备交互与视觉双重能力'],
    resp: ['负责产品界面与交互设计', '参与设计规范建设', '与产品、研发协作落地'],
    hidden: ['作品集能体现思考过程'],
    summary: '产品设计方向，重视作品集与用户体验',
  },
  test: {
    must: ['本科及以上在读，计算机相关专业', '掌握测试理论与用例设计方法', '会使用 Python 或 Java'],
    nice: ['有自动化测试经验', '了解性能测试'],
    resp: ['负责测试用例设计与执行', '参与自动化测试建设', '跟进缺陷修复与质量复盘'],
    hidden: ['细心、有质量意识'],
    summary: '测试开发方向，重视质量保障与自动化能力',
  },
  other: {
    must: ['本科及以上在读', '具备良好的沟通与协作能力', '有较强的学习能力'],
    nice: ['有相关实习或项目经历'],
    resp: ['参与业务日常执行', '支持团队项目推进', '完成数据整理与复盘'],
    hidden: ['稳定性与主动性'],
    summary: '互联网业务通用岗位',
  },
};

export function mockJobProfile(input: AnalyzeInput): JobProfile {
  const family = familyFor(input);
  const copy = ROLE_COPY[family];
  const seniority =
    input.seniority === 'intern' ? 'intern' : input.seniority === 'campus' ? 'campus' : 'social';
  return {
    company: input.company.trim() || '星海科技',
    title: input.title.trim() || `${ROLE_LABELS[family]}（实习）`,
    roleFamily: family,
    seniority,
    mustHave: copy.must,
    niceToHave: copy.nice,
    responsibilities: copy.resp,
    keywords: libraryKeywordsFor(family, ''),
    hiddenRequirements: copy.hidden,
    summary: copy.summary,
  };
}

export function mockGap(profile: ResumeProfile, job: JobProfile): GapAnalysis {
  const coverage = computeKeywordCoverage(profile.rawText, job.keywords);
  const keywordScore = Math.round(coverage.rate * 100);
  const dimensions = { hard: 78, relevance: 62, keywords: keywordScore, quantification: 45, expression: 60 };
  const score = computeWeightedScore(dimensions);
  return {
    score,
    dimensions,
    gaps: [
      {
        item: '经历描述以职责罗列为主，缺少可验证的结果',
        severity: 'high',
        suggestion: '为每段经历补充 1-2 个真实指标（参与人数、转化率、阅读量、耗时下降等），没有数据的地方先标记待补充。',
      },
      {
        item: '与岗位高权重关键词的对应关系不明显',
        severity: 'medium',
        suggestion: '梳理岗位关键词，把已有经历中能对应的部分前置，并用行业标准术语表达。',
      },
      {
        item: '部分 bullet 缺少方法与细节，面试难以追问',
        severity: 'medium',
        suggestion: '每条 bullet 补充"怎么做"：使用的工具、策略、分析框架或技术方案。',
      },
    ],
    keywordCoverage: coverage,
    route: 'both',
    routeReason:
      '你有内容运营与用户调研的可迁移经历，可以先通过润色把已有经历对齐岗位；但量化结果和高权重关键词覆盖不足，同时缺少一段能体现数据驱动增长的项目，因此建议「润色 + 补一个桥接项目」。',
    hasRelevantExperience: true,
    relevanceReason:
      '星野科技的产品运营实习与校园二手交易平台项目，和岗位的内容运营、活动策划、用户调研职责存在直接对应；但项目深度与数据结果不足。',
  };
}

export function mockResearch(job: JobProfile): ResearchBrief {
  return {
    enabled: true,
    error: MOCK_NOTE,
    companyOverview: `${job.company} 是互联网行业的代表企业之一（示例数据）。真实分析时，这里会基于公开招聘信息、业务报道与面经，整理公司业务线、目标岗位所属团队与近期动态，并附来源链接。`,
    roleInsight: `该岗位的核心考察点通常包括：${job.keywords
      .slice(0, 5)
      .map((k) => k.term)
      .join('、')}。除 JD 明示要求外，面试中常会追问一次具体 project 的决策过程与量化结果。`,
    interviewProcess:
      '典型流程为：简历筛选 → 业务一面（经历深挖 + 基础能力）→ 业务二面（场景题/案例分析）→ HR 面。示例数据仅用于展示结构，真实流程以检索结果为准。',
    recentNews: [],
    applicationTips: [
      '简历中优先呈现与岗位关键词直接对应的经历，并把结果量化。',
      '准备一个 2 分钟版本的项目讲述，覆盖背景、目标、动作、结果与复盘。',
      '投递前确认岗位的到岗时间与实习时长要求，避免在硬性条件上被筛掉。',
    ],
    sources: [],
    searchedAt: new Date().toISOString(),
  };
}

/* --------------------------------- 示例润色 -------------------------------- */

export function mockPolish(profile: ResumeProfile, job: JobProfile): PolishResult {
  const edits: PolishEdit[] = [
    {
      id: 'e1',
      targetType: 'bullet',
      targetId: 'int-1-1',
      section: '实习经历 · 星野科技 · 产品运营实习生',
      original: '负责社区内容选题与发布',
      rewritten:
        '基于用户分层设计内容选题矩阵，周均稳定更新 [待补充：篇数] 篇，带动社区互动量提升 [待补充：百分比]',
      rationale: '补充了选题方法与更新频次，把职责改写成"方法 + 结果"结构，对应 JD 的内容运营关键词。',
      keywordsAdded: ['内容运营', '用户分层'],
      needsUserInput: ['每周实际发布篇数', '互动量提升的真实百分比或绝对值'],
      risk: 'medium',
    },
    {
      id: 'e2',
      targetType: 'bullet',
      targetId: 'int-1-2',
      section: '实习经历 · 星野科技 · 产品运营实习生',
      original: '参与用户调研，整理访谈记录',
      rewritten:
        '参与 [待补充：人数] 位目标用户的深访，提炼 [待补充：数量] 条需求假设并输出访谈纪要，推动其中 [待补充：数量] 条进入产品迭代讨论',
      rationale: '把"整理记录"升级为可验证的调研产出，呼应 JD 的用户调研与需求分析要求。',
      keywordsAdded: ['用户调研', '需求分析'],
      needsUserInput: ['实际访谈人数', '提炼的需求数量', '进入迭代讨论的需求数量'],
      risk: 'medium',
    },
    {
      id: 'e3',
      targetType: 'bullet',
      targetId: 'int-1-3',
      section: '实习经历 · 星野科技 · 产品运营实习生',
      original: '协助策划开学季活动，跟进活动执行',
      rewritten:
        '参与开学季活动策划，负责 [待补充：负责模块] 的执行与数据跟踪，活动触达 [待补充：人数] 名用户，参与率 [待补充：百分比]',
      rationale: '补充活动角色分工与结果指标，避免"协助"这种弱表达。',
      keywordsAdded: ['活动运营'],
      needsUserInput: ['具体负责的模块', '活动触达人数', '参与率'],
      risk: 'medium',
    },
    {
      id: 'e4',
      targetType: 'bullet',
      targetId: 'prj-2-1',
      section: '项目经历 · 短视频用户留存调研',
      original: '设计问卷并回收 120 份有效样本',
      rewritten:
        '独立设计留存调研问卷并回收 120 份有效样本，使用 Excel 完成交叉分析，定位 [待补充：数量] 个关键影响因素',
      rationale: '原有的 120 份样本可以保留，补充分析方法与结论，体现数据分析能力。',
      keywordsAdded: ['数据分析', '用户调研'],
      needsUserInput: ['定位出的关键影响因素数量'],
      risk: 'low',
    },
    {
      id: 'e5',
      targetType: 'summary',
      targetId: 'self-evaluation',
      section: '自我评价',
      original: '对用户运营有热情，学习能力强。',
      rewritten:
        '具备内容运营与用户调研的实习基础，能使用 SQL/Excel 完成基础数据分析；希望在产品运营方向持续积累增长实验与复盘能力。',
      rationale: '用具体能力替代空泛的"有热情、学习能力强"，并与目标岗位关键词对齐。',
      keywordsAdded: ['SQL', 'Excel', '增长实验'],
      needsUserInput: [],
      risk: 'low',
    },
    {
      id: 'e6',
      targetType: 'skills',
      targetId: 'skills',
      section: '专业技能',
      original: 'SQL、Excel、Python（基础）、Figma、用户调研、文案写作',
      rewritten:
        '数据分析：SQL、Excel、Python（基础）；用户研究：用户调研、访谈纪要；运营：文案写作、内容策划；设计：Figma',
      rationale: '按能力类别重组技能，便于 HR 快速扫描；未新增任何技能。',
      keywordsAdded: [],
      needsUserInput: [],
      risk: 'low',
    },
  ];

  return {
    edits,
    polishedResume: assembleResumeMarkdown(profile, edits),
    summary:
      '整体思路：把"做了什么"改写成"用什么方法、做出什么结果"，并优先对齐岗位的内容运营、用户调研、数据分析要求。所有缺失数据以占位符标出，需要你补充后再导出正式简历。',
    factGuard: { passed: true, issues: [] },
  };
}

/* --------------------------------- 示例项目 -------------------------------- */

type WeekTemplate = Omit<ProjectWeek, 'week'> & { week?: number };

function weeks(templates: WeekTemplate[]): ProjectWeek[] {
  return templates.map((item, index) => ({ ...item, week: index + 1 }));
}

const PRODUCT_WEEKS = {
  sprint: weeks([
    {
      goal: '锁定一个可验证的真实问题',
      tasks: ['访谈 8-12 名目标用户，整理需求清单', '拆解 2 个竞品的关键路径', '确定一个 2 周内可验证的核心假设'],
      deliverable: '用户访谈纪要 + 一页验证方案',
      acceptance: '能说清目标用户、场景、核心假设与验证指标',
    },
    {
      goal: '完成最小验证并量化结果',
      tasks: ['搭建落地页 / 社群 / 内容矩阵并小范围投放', '记录曝光、点击、参与、留存数据', '复盘并输出结论'],
      deliverable: '实验报告 + 数据记录表',
      acceptance: '至少 1 个核心指标有前后对比或基线数据',
    },
  ]),
  standard: weeks([
    {
      goal: '完成问题定义与用户研究',
      tasks: ['访谈 15-20 名目标用户', '完成竞品功能与增长路径分析', '输出问题陈述与目标指标'],
      deliverable: '研究报告 + 问题陈述',
      acceptance: '问题有数据或访谈证据支撑，指标口径明确',
    },
    {
      goal: '形成方案与可测试原型',
      tasks: ['设计核心流程与运营策略', '用 Figma / 低代码搭建可体验原型', '组织 5 名用户可用性测试'],
      deliverable: '原型 + 测试记录',
      acceptance: '核心任务完成率与主要障碍清晰可量化',
    },
    {
      goal: '上线小流量实验',
      tasks: ['在校园社群 / 小红书 / 公众号落地', '配置数据埋点或记录表', '运行 7-10 天实验'],
      deliverable: '实验上线 + 数据看板',
      acceptance: '实验按计划运行，数据完整可复盘',
    },
    {
      goal: '分析结果并迭代',
      tasks: ['完成漏斗与留存分析', '输出 3 条可执行优化建议', '整理项目复盘与作品集页面'],
      deliverable: '分析报告 + 项目复盘',
      acceptance: '建议能对应到具体数据现象',
    },
  ]),
  advanced: weeks([
    {
      goal: '选定垂直场景并完成桌面研究',
      tasks: ['调研 3 个细分人群', '分析 5 个竞品的定位与增长模型', '确定差异化切入点'],
      deliverable: '机会分析报告',
      acceptance: '有明确的目标人群与差异化理由',
    },
    {
      goal: '完成深度用户研究',
      tasks: ['完成 20-30 名用户访谈与问卷', '建立用户分层与需求优先级', '定义北极星指标与漏斗'],
      deliverable: '用户研究报告 + 指标树',
      acceptance: '需求优先级有数据依据',
    },
    {
      goal: '设计产品与增长方案',
      tasks: ['完成核心流程与信息架构', '设计冷启动内容/活动策略', '搭建可测试原型'],
      deliverable: '方案文档 + 原型',
      acceptance: '方案覆盖获取、激活、留存三个环节',
    },
    {
      goal: '完成产品/内容最小实现',
      tasks: ['搭建小程序 / 社群 / 内容阵地', '配置埋点与数据看板', '招募首批种子用户'],
      deliverable: '可访问的产品或运营阵地',
      acceptance: '真实用户可完成核心任务',
    },
    {
      goal: '运行第一轮增长实验',
      tasks: ['设计 2 个渠道的拉新实验', '跟踪激活与次留', '记录实验偏差'],
      deliverable: '实验一报告',
      acceptance: '获得至少 50 名真实用户数据',
    },
    {
      goal: '运行留存与转化实验',
      tasks: ['设计分层运营策略', '测试 2 套内容/权益方案', '完成队列分析'],
      deliverable: '实验二报告',
      acceptance: '能比较不同策略的留存差异',
    },
    {
      goal: '优化并沉淀方法论',
      tasks: ['迭代策略并复测', '整理增长模型与 SOP', '准备作品集叙事'],
      deliverable: '增长复盘 + 作品集初稿',
      acceptance: '形成可复用的方法与结论',
    },
    {
      goal: '完成展示与复盘',
      tasks: ['完善 GitHub/Notion 作品集', '录制 3 分钟项目讲解', '整理面试可能追问的问题'],
      deliverable: '作品集 + 讲解视频',
      acceptance: '陌生人能在 5 分钟内理解项目价值',
    },
  ]),
};

const TECH_WEEKS = {
  sprint: weeks([
    {
      goal: '完成核心链路设计与实现',
      tasks: ['拆解 3 个核心接口与数据模型', '实现最小可用版本', '补齐基础测试'],
      deliverable: '可运行的 MVP 仓库',
      acceptance: '核心接口可调用，测试通过',
    },
    {
      goal: '完成压测与文档',
      tasks: ['用 JMeter/wrk 做基准压测', '记录 QPS、P99、错误率', '完善 README 与架构图'],
      deliverable: '压测报告 + 开源仓库',
      acceptance: '有可复现的压测命令与结果',
    },
  ]),
  standard: weeks([
    {
      goal: '需求拆解与架构设计',
      tasks: ['明确核心功能与非功能指标', '完成接口与数据模型设计', '调研 1-2 个关键技术点'],
      deliverable: '设计文档 + 技术选型说明',
      acceptance: '能讲清每个选型的取舍',
    },
    {
      goal: '实现核心功能',
      tasks: ['完成主要业务链路', '接入数据库与缓存', '编写单元测试'],
      deliverable: '可运行的核心版本',
      acceptance: '核心用例全部通过',
    },
    {
      goal: '稳定性与性能优化',
      tasks: ['补充限流、降级与异常处理', '定位并优化一个性能瓶颈', '接入日志与指标'],
      deliverable: '优化记录 + 监控面板',
      acceptance: '有明确的优化前后对比数据',
    },
    {
      goal: '压测、部署与展示',
      tasks: ['完成压测并记录指标', '编写 Docker 部署脚本', '完善 README 与架构图'],
      deliverable: '可部署仓库 + 压测报告',
      acceptance: '他人可按文档一键启动',
    },
  ]),
  advanced: weeks([
    { goal: '需求与架构设计', tasks: ['拆解业务与容量目标', '完成整体架构与数据模型', '识别关键技术风险'], deliverable: '架构设计文档', acceptance: '架构能支撑目标 QPS 与数据量' },
    { goal: '核心服务开发', tasks: ['实现核心业务链路', '接入数据库与缓存', '补齐单元测试'], deliverable: '核心服务可运行', acceptance: '核心用例通过' },
    { goal: '存储与一致性', tasks: ['设计分库分表或索引方案', '处理缓存一致性', '补充幂等与重试'], deliverable: '存储方案与代码', acceptance: '数据一致性测试通过' },
    { goal: '高并发与限流', tasks: ['实现限流与熔断', '优化热点路径', '完成并发测试'], deliverable: '高并发优化记录', acceptance: '目标并发下错误率可控' },
    { goal: '可观测性建设', tasks: ['接入日志、指标与链路追踪', '配置告警规则', '编写故障演练脚本'], deliverable: '监控与告警配置', acceptance: '能定位一次模拟故障' },
    { goal: '压测与性能优化', tasks: ['完成全链路压测', '定位 P99 瓶颈', '优化并复测'], deliverable: '压测与优化报告', acceptance: 'P99 有明确下降' },
    { goal: '部署与工程化', tasks: ['编写 CI/CD 流程', '容器化部署', '补充集成测试'], deliverable: '部署流水线', acceptance: '提交代码可自动构建部署' },
    { goal: '文档与展示', tasks: ['完善 README 与架构图', '录制演示视频', '整理面试讲述稿'], deliverable: '开源仓库 + 演示', acceptance: '陌生人可按文档跑通' },
  ]),
};

const ALGO_WEEKS = {
  sprint: weeks([
    { goal: '数据准备与 baseline', tasks: ['选定公开数据集并完成清洗', '实现一个简单 baseline', '确定评估指标'], deliverable: '数据脚本 + baseline 结果', acceptance: '指标可复现' },
    { goal: '模型改进与评估', tasks: ['尝试 2 个改进点', '完成对比实验', '输出实验报告'], deliverable: '实验报告 + 代码', acceptance: '改进点有指标对比' },
  ]),
  standard: weeks([
    { goal: '数据与问题定义', tasks: ['完成数据清洗与探索性分析', '划分训练/验证/测试集', '明确评估指标与 baseline'], deliverable: '数据报告 + baseline', acceptance: '数据无泄漏，指标可复现' },
    { goal: '模型实现', tasks: ['实现主模型', '完成训练与调参', '记录实验配置'], deliverable: '训练代码 + 模型权重', acceptance: '测试集指标达到预期' },
    { goal: '改进与消融', tasks: ['设计 2-3 组消融实验', '分析误差来源', '优化关键模块'], deliverable: '消融实验表', acceptance: '能解释每个改进的贡献' },
    { goal: '评估、可视化与展示', tasks: ['完成错误案例分析', '制作结果可视化', '完善 README 与报告'], deliverable: '完整项目仓库', acceptance: '他人可复现实验' },
  ]),
  advanced: weeks([
    { goal: '文献调研与问题定义', tasks: ['阅读 5 篇相关论文', '确定任务与评估协议', '整理 baseline 列表'], deliverable: '文献综述', acceptance: '明确研究缺口与方案' },
    { goal: '数据工程', tasks: ['构建数据 pipeline', '完成清洗与增强', '检查数据泄漏'], deliverable: '可复用数据脚本', acceptance: '数据质量报告通过' },
    { goal: 'Baseline 复现', tasks: ['复现 2 个 baseline', '统一评估流程', '记录差异'], deliverable: 'baseline 结果表', acceptance: '结果与论文差距可解释' },
    { goal: '主模型实现', tasks: ['实现核心方法', '完成训练调优', '记录实验管理'], deliverable: '主模型代码', acceptance: '指标超过 baseline' },
    { goal: '消融与误差分析', tasks: ['设计消融实验', '分析错误样本', '定位失败模式'], deliverable: '分析报告', acceptance: '每个模块贡献清晰' },
    { goal: '效率与部署', tasks: ['优化推理速度', '完成模型导出/服务化', '测试端到端延迟'], deliverable: '可调用推理服务', acceptance: '延迟满足设定目标' },
    { goal: '对比与写作', tasks: ['补齐对比实验', '撰写技术报告', '整理图表'], deliverable: '技术报告初稿', acceptance: '结论有充分实验支撑' },
    { goal: '展示与面试准备', tasks: ['完善 GitHub 与 README', '录制讲解视频', '准备 10 个追问'], deliverable: '作品集 + 讲解', acceptance: '能清晰解释技术选择' },
  ]),
};

function projectIdea(
  tier: ProjectIdea['tier'],
  job: JobProfile,
  name: string,
  valueProposition: string,
  stack: string[],
  features: string[],
  metrics: string[],
  bullets: string[],
  weekSet: ProjectWeek[],
  showcase: string,
  pitfalls: string,
): ProjectIdea {
  return {
    tier,
    name,
    valueProposition,
    jdMapping: job.keywords.slice(0, 4).map((keyword) => ({
      keyword: keyword.term,
      how: `在项目中通过 ${keyword.term} 相关的具体任务产出可验证结果，写进简历时对应 JD 的该项要求`,
    })),
    stack,
    prerequisites: ['基础工具使用能力', '每周可投入 6-10 小时'],
    features: features.map((item) => ({ name: item, required: true })),
    weeks: weekSet,
    metrics,
    resumeBullets: bullets,
    showcase,
    resources: [
      { title: '项目复盘模板与面试讲述框架（可自行整理）' },
      { title: 'GitHub README 优秀案例：搜索 "awesome readme"' },
    ],
    pitfalls,
  };
}

export function mockProjectPlan(job: JobProfile, input: AnalyzeInput): ProjectPlan {
  const isTech = ['backend', 'frontend', 'client', 'test'].includes(job.roleFamily);
  const isAlgo = ['algorithm', 'data'].includes(job.roleFamily);

  if (isTech) {
    return {
      projects: [
        projectIdea(
          'sprint',
          job,
          '高可用短链服务 MVP',
          '两周内做出一个有缓存、有限流、可压测的后端项目',
          ['Go 或 Java', 'Redis', 'MySQL', 'Docker'],
          ['短链生成与跳转', 'Redis 缓存', '基础限流', '压测脚本'],
          ['单机 QPS ≥ 1000', 'P99 延迟 < 50ms', '缓存命中率 ≥ 80%'],
          [
            '实现短链服务 MVP，使用 Redis 缓存热点链接，在 [待补充：机器配置] 下单机压测达到 [待补充] QPS，P99 延迟 [待补充] ms',
          ],
          TECH_WEEKS.sprint,
          'GitHub 仓库 + 压测报告 + 架构图',
          '不要只做 CRUD：一定要有压测数据与优化前后对比，否则无法体现工程能力。',
        ),
        projectIdea(
          'standard',
          job,
          '带监控与限流的短链平台',
          '四周完成一个可部署、可观测、能讲清技术取舍的后端项目',
          ['Go 或 Java', 'MySQL', 'Redis', 'Docker', 'Prometheus'],
          ['短链生成与跳转', '缓存与一致性处理', '限流与降级', '指标监控', '压测与优化'],
          ['目标 QPS 下有压测曲线', '缓存命中率与 P99 可视化', '故障演练记录'],
          [
            '设计并实现短链平台，通过 [待补充：缓存策略] 将 P99 从 [待补充] ms 降至 [待补充] ms，支撑 [待补充] QPS',
          ],
          TECH_WEEKS.standard,
          'GitHub 仓库 + 在线 Demo + 压测报告',
          '避免堆技术名词；每个组件都要能解释"为什么需要它"。',
        ),
        projectIdea(
          'advanced',
          job,
          '分布式任务调度平台',
          '八周完成一个具备高可用、可观测与故障恢复能力的分布式系统',
          ['Go 或 Java', 'MySQL', 'Redis', '消息队列', 'Docker', 'Prometheus'],
          ['任务编排', ' worker 注册与心跳', '失败重试与幂等', '限流熔断', '监控告警', '故障演练'],
          ['调度成功率 ≥ 99.9%', '故障恢复时间 < 30s', '支持 [待补充] 个并发任务'],
          [
            '设计分布式任务调度平台，通过 [待补充：方案] 将调度成功率提升至 [待补充]%，故障恢复时间从 [待补充] 降至 [待补充]',
          ],
          TECH_WEEKS.advanced,
          '开源仓库 + 架构文档 + 演示视频',
          '不要过度设计；先跑通最小闭环，再逐步加可靠性能力。',
        ),
      ],
      recommendation: isAlgo
        ? '优先做标准版，既有工程链路又能产出评估结果。'
        : '时间紧先做速成版拿到可写进简历的项目；有 4 周建议做标准版，性价比最高。',
    };
  }

  if (isAlgo) {
    return {
      projects: [
        projectIdea(
          'sprint',
          job,
          '公开数据集的文本分类 Baseline + 改进',
          '两周内完成一个可复现、有指标对比的算法项目',
          ['Python', 'PyTorch', 'scikit-learn'],
          ['数据清洗', 'Baseline 模型', '改进实验', '评估报告'],
          ['测试集 F1 ≥ [待补充]', '相对 baseline 提升 ≥ [待补充]%'],
          [
            '在 [待补充：数据集] 上完成文本分类任务，通过 [待补充：方法] 将 F1 从 [待补充] 提升至 [待补充]，超过 baseline [待补充]%',
          ],
          ALGO_WEEKS.sprint,
          'GitHub 仓库 + 实验报告',
          '不要只调包；要能解释数据、指标与误差分析。',
        ),
        projectIdea(
          'standard',
          job,
          'RAG 垂直知识问答系统',
          '四周完成检索、生成、评估闭环，体现大模型工程能力',
          ['Python', 'PyTorch/Transformers', '向量数据库', 'FastAPI'],
          ['文档解析与切分', '向量检索', '生成与引用', '评测集与指标', '错误分析'],
          ['检索 Recall@5 ≥ [待补充]', '答案准确率 ≥ [待补充]', '端到端延迟 < [待补充]s'],
          [
            '构建 RAG 问答系统，通过 [待补充：检索/重排策略] 将 Recall@5 提升至 [待补充]%，回答准确率达到 [待补充]%',
          ],
          ALGO_WEEKS.standard,
          'GitHub 仓库 + Demo + 评测报告',
          '避免只做 Demo：一定要自建评测集，并做失败案例分析。',
        ),
        projectIdea(
          'advanced',
          job,
          '多路召回与排序的推荐系统',
          '八周完成从数据到线上服务的完整推荐链路',
          ['Python', 'PyTorch', 'Spark', '向量检索', 'FastAPI'],
          ['数据 pipeline', '多路召回', '排序模型', '离线评估', '在线服务', '消融实验'],
          ['Recall@K 提升 [待补充]%', 'NDCG 提升 [待补充]%', '推理延迟 < [待补充]ms'],
          [
            '设计多路召回与排序系统，通过 [待补充：模型/特征] 将 NDCG@10 提升 [待补充]%，离线评估覆盖 [待补充] 万用户',
          ],
          ALGO_WEEKS.advanced,
          '开源仓库 + 技术报告 + 服务 Demo',
          '不要追求模型复杂度；先把数据、评估和服务链路做扎实。',
        ),
      ],
      recommendation: '优先做标准版 RAG 项目：周期可控、可量化、与当前大模型岗位高度相关。',
    };
  }

  const company = job.company || input.company || '目标公司';
  return {
    projects: [
      projectIdea(
        'sprint',
        job,
        '校园内容社区冷启动实验',
        '两周内完成一次真实的拉新-激活-留存验证',
        ['问卷工具', 'Excel / SQL', 'Figma（可选）'],
        ['用户访谈', '内容选题矩阵', '小范围投放', '数据记录与复盘'],
        ['触达用户数', '激活率', '7 日留存率', '内容互动率'],
        [
          '面向 [待补充：人群] 完成一次内容社区冷启动实验，通过 [待补充：策略] 触达 [待补充] 名用户，7 日留存达到 [待补充]%',
        ],
        PRODUCT_WEEKS.sprint,
        '实验报告 + 数据看板 + 复盘文档',
        '避免"没有真实用户"：可以从校园社群、小红书或社团合作获取种子用户。',
      ),
      projectIdea(
        'standard',
        job,
        '数据驱动的校园产品增长实验',
        '四周完成从用户研究到增长实验的完整闭环',
        ['问卷星/飞书表单', 'SQL / Excel', 'Figma / 低代码', '数据看板'],
        ['用户研究', '竞品分析', '原型设计', '小流量实验', '数据分析与复盘'],
        ['样本量 ≥ 100', '核心转化率提升', '留存对比', '实验结论可复述'],
        [
          '针对 [待补充：场景] 设计并上线增长实验，通过 [待补充：策略] 将 [待补充：指标] 从 [待补充] 提升至 [待补充]，样本量 [待补充]',
        ],
        PRODUCT_WEEKS.standard,
        '作品集页面 + 实验报告 + 原型链接',
        '不要只写"参与"：要明确你负责的决策、执行与结果。',
      ),
      projectIdea(
        'advanced',
        job,
        '垂直社区冷启动与留存体系',
        '八周完成一个可展示的增长案例，形成完整方法论',
        ['Figma / 低代码', 'SQL', '数据分析工具', '内容平台'],
        ['机会分析', '用户研究', '内容与活动策略', '拉新实验', '留存实验', '增长复盘'],
        ['种子用户数', '次留/7 日留存', '内容供给量', '增长实验显著性'],
        [
          '从 0 到 1 搭建 [待补充：主题] 社区，通过 [待补充：策略] 获取 [待补充] 名种子用户，7 日留存达到 [待补充]%',
        ],
        PRODUCT_WEEKS.advanced,
        'Notion/GitHub 作品集 + 3 分钟讲解视频',
        '周期长，务必每周留出复盘时间；不要等到最后才整理数据。',
      ),
    ],
    recommendation: `优先做标准版「数据驱动的校园产品增长实验」：周期 4 周可控，能同时覆盖 ${company} 该岗位看重的用户研究、数据分析与活动运营能力。`,
  };
}

/* --------------------------------- 示例审核 -------------------------------- */

export function mockReview(
  profile: ResumeProfile,
  polish: PolishResult | undefined,
  gap: GapAnalysis,
  job: JobProfile,
): QualityReview {
  const polished = polish?.polishedResume ?? profile.rawText;
  const afterCoverage = computeKeywordCoverage(polished, job.keywords);
  const stats = resumeLengthStats(polished);
  const overOnePage = stats.characters > 1800 || stats.bullets > 20;
  return {
    passed: true,
    issues: overOnePage ? ['简历长度偏长，建议压缩到一页（约 1200-1600 字）'] : [],
    keywordCoverageBefore: gap.keywordCoverage.rate,
    keywordCoverageAfter: afterCoverage.rate,
    lengthCheck: {
      characters: stats.characters,
      bullets: stats.bullets,
      overOnePage,
    },
    nextActions: [
      '补充改写中标记为 [待补充] 的真实数据，再导出正式简历。',
      '按目标岗位调整经历顺序，把最相关的实习放在最前。',
      '完成项目方案中的速成版或标准版，并把可量化结果写回简历。',
      '投递前用一页纸检查：联系方式、教育时间、岗位关键词是否齐全。',
    ],
  };
}

export function mockCoverageFor(profile: ResumeProfile, job: JobProfile): KeywordCoverage {
  return computeKeywordCoverage(profile.rawText, job.keywords);
}
