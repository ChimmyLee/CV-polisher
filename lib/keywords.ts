import type { Direction, JobKeyword, KeywordCoverage, KeywordHit, RoleFamily, Seniority } from './types';

export const ROLE_LABELS: Record<RoleFamily, string> = {
  backend: '后端开发',
  frontend: '前端开发',
  client: '客户端开发',
  algorithm: '算法工程师',
  data: '数据 / 数据分析',
  product: '产品经理',
  operations: '产品 / 用户运营',
  design: '设计',
  test: '测试开发',
  other: '通用',
};

export const DIRECTION_LABELS: Record<Direction, string> = {
  tech: '技术研发',
  algorithm: '算法与数据',
  product: '产品与运营',
  design: '设计',
  other: '其他',
};

export const SENIORITY_LABELS: Record<Seniority, string> = {
  intern: '实习',
  campus: '校招',
  social: '社招',
  other: '不限',
};

export const ROUTE_LABELS = {
  polish: '简历润色',
  project: '项目补齐',
  both: '润色 + 补项目',
} as const;

interface RoleKeywordSeed {
  term: string;
  weight: number;
  aliases?: string[];
}

const BANK: Record<RoleFamily, RoleKeywordSeed[]> = {
  backend: [
    { term: 'Java', weight: 3, aliases: ['Java SE', 'JVM'] },
    { term: 'Go', weight: 3, aliases: ['Golang'] },
    { term: 'Python', weight: 2 },
    { term: 'C++', weight: 2, aliases: ['CPP'] },
    { term: 'MySQL', weight: 3, aliases: ['关系型数据库'] },
    { term: 'Redis', weight: 3, aliases: ['缓存'] },
    { term: 'Kafka', weight: 2, aliases: ['消息队列', 'MQ'] },
    { term: 'RabbitMQ', weight: 2 },
    { term: '微服务', weight: 2, aliases: ['Microservices'] },
    { term: '分布式', weight: 3, aliases: ['分布式系统'] },
    { term: '高并发', weight: 3, aliases: ['大流量', '高吞吐'] },
    { term: 'Docker', weight: 2, aliases: ['容器化'] },
    { term: 'Kubernetes', weight: 2, aliases: ['K8s'] },
    { term: 'Linux', weight: 2 },
    { term: 'Spring Boot', weight: 2, aliases: ['Spring'] },
    { term: 'gRPC', weight: 2 },
    { term: 'RESTful', weight: 1, aliases: ['REST API'] },
    { term: '性能优化', weight: 2, aliases: ['性能调优'] },
    { term: '数据库', weight: 2 },
    { term: '计算机网络', weight: 2, aliases: ['网络协议', 'TCP/IP'] },
    { term: '操作系统', weight: 2 },
    { term: '数据结构与算法', weight: 2, aliases: ['数据结构', '算法基础'] },
    { term: '负载均衡', weight: 1 },
    { term: '单元测试', weight: 1, aliases: ['自动化测试'] },
    { term: 'CI/CD', weight: 1, aliases: ['持续集成'] },
    { term: 'Hadoop', weight: 1 },
    { term: 'Elasticsearch', weight: 1, aliases: ['ES'] },
    { term: 'MyBatis', weight: 1 },
    { term: 'Netty', weight: 2 },
  ],
  frontend: [
    { term: 'JavaScript', weight: 3, aliases: ['JS'] },
    { term: 'TypeScript', weight: 3, aliases: ['TS'] },
    { term: 'React', weight: 3, aliases: ['React.js', 'ReactJS'] },
    { term: 'Vue', weight: 3, aliases: ['Vue.js', 'Vue3'] },
    { term: 'Angular', weight: 1 },
    { term: 'HTML', weight: 2, aliases: ['HTML5'] },
    { term: 'CSS', weight: 2, aliases: ['CSS3'] },
    { term: 'Webpack', weight: 2 },
    { term: 'Vite', weight: 2 },
    { term: 'Node.js', weight: 2, aliases: ['NodeJS', 'Node'] },
    { term: '小程序', weight: 2, aliases: ['微信小程序'] },
    { term: '跨端', weight: 2, aliases: ['跨平台'] },
    { term: '性能优化', weight: 3, aliases: ['首屏优化', '性能调优'] },
    { term: '响应式', weight: 1, aliases: ['响应式布局'] },
    { term: '组件化', weight: 2, aliases: ['组件库'] },
    { term: '前端工程化', weight: 2 },
    { term: '浏览器', weight: 1, aliases: ['浏览器原理'] },
    { term: 'HTTP', weight: 2, aliases: ['HTTP协议'] },
    { term: 'WebSocket', weight: 1 },
    { term: '可视化', weight: 2, aliases: ['数据可视化'] },
    { term: 'ECharts', weight: 1 },
    { term: '工程化', weight: 1 },
    { term: 'Flutter', weight: 1 },
    { term: 'React Native', weight: 1, aliases: ['RN'] },
  ],
  client: [
    { term: 'Android', weight: 3 },
    { term: 'iOS', weight: 3 },
    { term: 'Swift', weight: 2 },
    { term: 'Kotlin', weight: 2 },
    { term: 'Java', weight: 2 },
    { term: 'Objective-C', weight: 1, aliases: ['OC'] },
    { term: 'Flutter', weight: 2 },
    { term: 'React Native', weight: 2, aliases: ['RN'] },
    { term: '性能优化', weight: 3 },
    { term: '内存管理', weight: 2 },
    { term: '网络编程', weight: 2 },
    { term: '组件化', weight: 2 },
    { term: '稳定性', weight: 2, aliases: ['Crash 治理'] },
    { term: '音视频', weight: 1 },
    { term: '跨端', weight: 2 },
  ],
  algorithm: [
    { term: 'Python', weight: 3 },
    { term: 'PyTorch', weight: 3, aliases: ['Torch'] },
    { term: 'TensorFlow', weight: 2, aliases: ['TF'] },
    { term: '机器学习', weight: 3, aliases: ['Machine Learning', 'ML'] },
    { term: '深度学习', weight: 3, aliases: ['Deep Learning', 'DL'] },
    { term: 'NLP', weight: 3, aliases: ['自然语言处理'] },
    { term: '计算机视觉', weight: 2, aliases: ['CV'] },
    { term: '推荐系统', weight: 3, aliases: ['推荐算法'] },
    { term: '搜索', weight: 2, aliases: ['搜索算法'] },
    { term: '大模型', weight: 3, aliases: ['LLM', '大语言模型'] },
    { term: 'RAG', weight: 2, aliases: ['检索增强'] },
    { term: 'Transformer', weight: 2 },
    { term: '强化学习', weight: 2, aliases: ['RL'] },
    { term: '特征工程', weight: 2 },
    { term: '模型训练', weight: 2, aliases: ['训练'] },
    { term: '模型部署', weight: 2, aliases: ['推理优化', '部署'] },
    { term: '论文', weight: 2, aliases: ['Paper'] },
    { term: '顶会', weight: 2, aliases: ['CVPR', 'NeurIPS', 'ICML', 'ACL'] },
    { term: '数据挖掘', weight: 2 },
    { term: '排序', weight: 2, aliases: ['Ranking'] },
    { term: '召回', weight: 2, aliases: ['Recall'] },
    { term: '多模态', weight: 2 },
    { term: 'AIGC', weight: 2 },
    { term: 'LangChain', weight: 1 },
    { term: '向量数据库', weight: 1 },
    { term: 'SQL', weight: 2 },
    { term: 'Spark', weight: 1 },
  ],
  data: [
    { term: 'SQL', weight: 3 },
    { term: 'Python', weight: 3 },
    { term: 'Hive', weight: 2 },
    { term: 'Spark', weight: 2 },
    { term: 'Flink', weight: 2 },
    { term: '数据仓库', weight: 3, aliases: ['数仓'] },
    { term: '数据建模', weight: 2 },
    { term: 'ETL', weight: 2 },
    { term: 'AB实验', weight: 3, aliases: ['A/B 测试', 'AB 实验', 'A/B测试'] },
    { term: '指标体系', weight: 3 },
    { term: '数据分析', weight: 3 },
    { term: '用户画像', weight: 2 },
    { term: '实时计算', weight: 2 },
    { term: 'Tableau', weight: 1 },
    { term: 'Power BI', weight: 1, aliases: ['PowerBI'] },
    { term: '统计学', weight: 2, aliases: ['统计'] },
    { term: '因果推断', weight: 2 },
    { term: '数据可视化', weight: 1 },
    { term: 'Excel', weight: 1 },
  ],
  product: [
    { term: '需求分析', weight: 3, aliases: ['需求调研'] },
    { term: 'PRD', weight: 3, aliases: ['产品需求文档'] },
    { term: '用户调研', weight: 3, aliases: ['用户访谈', '用户研究'] },
    { term: '竞品分析', weight: 2 },
    { term: '数据分析', weight: 3 },
    { term: '产品设计', weight: 2 },
    { term: '原型', weight: 2, aliases: ['原型图', 'Axure'] },
    { term: '项目管理', weight: 2 },
    { term: '增长', weight: 3, aliases: ['用户增长'] },
    { term: '转化率', weight: 3, aliases: ['转化'] },
    { term: '留存', weight: 3, aliases: ['留存率'] },
    { term: 'AB实验', weight: 2, aliases: ['A/B 测试', 'AB 实验'] },
    { term: '用户旅程', weight: 2 },
    { term: '商业化', weight: 2 },
    { term: '策略', weight: 2 },
    { term: 'Figma', weight: 1 },
    { term: 'Axure', weight: 1 },
    { term: '指标', weight: 2, aliases: ['北极星指标'] },
    { term: 'SQL', weight: 2 },
    { term: '用户需求', weight: 2 },
    { term: '产品规划', weight: 2 },
    { term: '版本迭代', weight: 2, aliases: ['迭代'] },
    { term: '用户反馈', weight: 2 },
    { term: '运营策略', weight: 2 },
  ],
  operations: [
    { term: '用户运营', weight: 3 },
    { term: '内容运营', weight: 3 },
    { term: '活动运营', weight: 3 },
    { term: '社群运营', weight: 2, aliases: ['社群'] },
    { term: '增长', weight: 3, aliases: ['用户增长'] },
    { term: '转化', weight: 3, aliases: ['转化率'] },
    { term: '留存', weight: 3, aliases: ['留存率'] },
    { term: '拉新', weight: 3, aliases: ['获客'] },
    { term: 'GMV', weight: 2 },
    { term: '用户生命周期', weight: 2 },
    { term: '数据分析', weight: 3 },
    { term: '文案', weight: 2, aliases: ['文案策划'] },
    { term: '策划', weight: 2, aliases: ['活动策划'] },
    { term: '私域', weight: 2 },
    { term: '投放', weight: 2, aliases: ['广告投放'] },
    { term: 'ROI', weight: 2 },
    { term: '渠道', weight: 2 },
    { term: '用户分层', weight: 2 },
    { term: 'SOP', weight: 1 },
    { term: '用户反馈', weight: 2 },
    { term: '增长实验', weight: 2 },
    { term: '内容策划', weight: 2 },
  ],
  design: [
    { term: 'Figma', weight: 3 },
    { term: 'Sketch', weight: 2 },
    { term: '交互设计', weight: 3 },
    { term: '视觉设计', weight: 3 },
    { term: '用户体验', weight: 3, aliases: ['UX'] },
    { term: '设计规范', weight: 2, aliases: ['Design System'] },
    { term: '原型', weight: 2 },
    { term: '动效', weight: 2 },
    { term: '作品集', weight: 3 },
    { term: '用户研究', weight: 2 },
    { term: 'UI', weight: 2 },
    { term: '品牌设计', weight: 1 },
  ],
  test: [
    { term: '测试用例', weight: 3 },
    { term: '自动化测试', weight: 3 },
    { term: 'Selenium', weight: 2 },
    { term: '接口测试', weight: 3 },
    { term: '性能测试', weight: 2 },
    { term: 'JMeter', weight: 2 },
    { term: 'Python', weight: 2 },
    { term: '缺陷管理', weight: 2, aliases: ['Bug 管理'] },
    { term: '质量保障', weight: 3 },
    { term: '持续集成', weight: 1, aliases: ['CI/CD'] },
    { term: '白盒测试', weight: 1 },
    { term: '测试开发', weight: 3 },
  ],
  other: [
    { term: '沟通', weight: 2, aliases: ['沟通协作'] },
    { term: '协作', weight: 2, aliases: ['团队协作'] },
    { term: '项目管理', weight: 2 },
    { term: '数据分析', weight: 2 },
    { term: '英语', weight: 2, aliases: ['CET-6', 'CET6', '六级'] },
    { term: '学习能力', weight: 1 },
    { term: '抗压', weight: 1 },
  ],
};

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function hasTerm(haystack: string, needle: string): boolean {
  const term = needle.trim();
  if (!term) return false;

  if (/[一-鿿]/.test(term)) {
    return haystack.includes(term);
  }

  const escaped = escapeRegex(term);
  try {
    const re = new RegExp(`(?<![a-z0-9])${escaped}(?![a-z0-9])`, 'i');
    return re.test(haystack);
  } catch {
    return haystack.toLowerCase().includes(term.toLowerCase());
  }
}

function matchesKeyword(text: string, keyword: JobKeyword): string | undefined {
  if (hasTerm(text, keyword.term)) return keyword.term;
  for (const alias of keyword.aliases ?? []) {
    if (hasTerm(text, alias)) return alias;
  }
  return undefined;
}

function normalizeTerm(term: string): string {
  return term.trim().toLowerCase().replace(/\s+/g, '');
}

function clampWeight(value: number, fallback = 2): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(3, Math.max(1, Math.round(value)));
}

export function mergeKeywords(primary: JobKeyword[], extra: JobKeyword[]): JobKeyword[] {
  const map = new Map<string, JobKeyword>();
  for (const keyword of [...primary, ...extra]) {
    const term = keyword.term?.trim();
    if (!term) continue;
    const key = normalizeTerm(term);
    const weight = clampWeight(keyword.weight);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        term,
        weight,
        aliases: keyword.aliases?.filter(Boolean),
      });
    } else {
      existing.weight = Math.max(existing.weight, weight);
      const aliases = new Set([...(existing.aliases ?? []), ...(keyword.aliases ?? [])]);
      existing.aliases = [...aliases].filter((a) => normalizeTerm(a) !== key);
    }
  }
  return [...map.values()].sort((a, b) => b.weight - a.weight).slice(0, 30);
}

/**
 * 从岗位词库中提取 JD 中出现的词；若 JD 缺失，则返回该岗位方向的代表性词。
 */
export function libraryKeywordsFor(family: RoleFamily, jdText: string): JobKeyword[] {
  const bank = BANK[family] ?? BANK.other;
  const text = jdText.trim();
  if (!text) {
    return bank.slice(0, 14).map((seed) => ({
      term: seed.term,
      weight: seed.weight,
      aliases: seed.aliases,
    }));
  }
  return bank
    .filter((seed) => {
      if (hasTerm(text, seed.term)) return true;
      return (seed.aliases ?? []).some((alias) => hasTerm(text, alias));
    })
    .map((seed) => ({ term: seed.term, weight: seed.weight, aliases: seed.aliases }));
}

export function computeKeywordCoverage(
  resumeText: string,
  keywords: JobKeyword[],
): KeywordCoverage {
  const seen = new Set<string>();
  const unique = keywords.filter((keyword) => {
    const key = normalizeTerm(keyword.term);
    if (!keyword.term || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  let totalWeight = 0;
  let coveredWeight = 0;
  const covered: KeywordHit[] = [];
  const missing: KeywordHit[] = [];

  for (const keyword of unique) {
    const weight = Number.isFinite(keyword.weight)
      ? Math.max(1, Math.min(3, Math.round(keyword.weight)))
      : 1;
    totalWeight += weight;
    const via = matchesKeyword(resumeText, keyword);
    if (via) {
      coveredWeight += weight;
      covered.push({ term: keyword.term, weight, matchedVia: via === keyword.term ? undefined : via });
    } else {
      missing.push({ term: keyword.term, weight });
    }
  }

  covered.sort((a, b) => b.weight - a.weight);
  missing.sort((a, b) => b.weight - a.weight);

  return {
    total: unique.length,
    covered,
    missing,
    rate: totalWeight === 0 ? 0 : coveredWeight / totalWeight,
  };
}

export function keywordRatioToPercent(rate: number): number {
  return Math.round(Math.max(0, Math.min(1, rate)) * 100);
}
