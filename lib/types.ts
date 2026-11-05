export type RoleFamily =
  | 'backend'
  | 'frontend'
  | 'client'
  | 'algorithm'
  | 'data'
  | 'product'
  | 'operations'
  | 'design'
  | 'test'
  | 'other';

export type Seniority = 'intern' | 'campus' | 'social' | 'other';

export type Direction = 'tech' | 'algorithm' | 'product' | 'design' | 'other';

export type SearchProvider = 'bocha' | 'tavily' | 'serper' | 'none';

export type RouteType = 'polish' | 'project' | 'both';

export type AgentId =
  | 'parse'
  | 'job'
  | 'diagnose'
  | 'research'
  | 'polish'
  | 'planner'
  | 'review';

/* ---------------------------------- 简历 ---------------------------------- */

export interface BasicInfo {
  name?: string;
  school?: string;
  major?: string;
  degree?: string;
  graduation?: string;
  contact?: string;
}

export interface Bullet {
  id: string;
  text: string;
}

export interface Experience {
  id: string;
  title: string;
  org?: string;
  period?: string;
  bullets: Bullet[];
}

export interface ResumeProfile {
  basic: BasicInfo;
  education: Experience[];
  internships: Experience[];
  projects: Experience[];
  skills: string[];
  awards: string[];
  selfEvaluation?: string;
  rawText: string;
}

/* ---------------------------------- 岗位 ---------------------------------- */

export interface JobKeyword {
  term: string;
  weight: number; // 0-3
  aliases?: string[];
}

export interface JobProfile {
  company: string;
  title: string;
  roleFamily: RoleFamily;
  seniority: Seniority;
  mustHave: string[];
  niceToHave: string[];
  responsibilities: string[];
  keywords: JobKeyword[];
  hiddenRequirements: string[];
  summary: string;
}

/* ---------------------------------- 诊断 ---------------------------------- */

export interface KeywordHit {
  term: string;
  weight: number;
  matchedVia?: string;
}

export interface KeywordCoverage {
  total: number;
  covered: KeywordHit[];
  missing: KeywordHit[];
  rate: number; // 0-1（按权重）
}

export interface DimensionScores {
  hard: number;
  relevance: number;
  keywords: number;
  quantification: number;
  expression: number;
}

export interface GapItem {
  item: string;
  severity: 'high' | 'medium' | 'low';
  suggestion: string;
}

export interface GapAnalysis {
  score: number;
  dimensions: DimensionScores;
  gaps: GapItem[];
  keywordCoverage: KeywordCoverage;
  route: RouteType;
  routeReason: string;
  hasRelevantExperience: boolean;
  relevanceReason: string;
}

/* --------------------------------- 联网检索 -------------------------------- */

export interface ResearchSource {
  id: number;
  title: string;
  url: string;
  snippet?: string;
}

export interface ResearchBrief {
  enabled: boolean;
  error?: string;
  companyOverview: string;
  roleInsight: string;
  interviewProcess: string;
  recentNews: string[];
  applicationTips: string[];
  sources: ResearchSource[];
  searchedAt?: string;
}

/* ---------------------------------- 润色 ---------------------------------- */

export interface PolishEdit {
  id: string;
  targetType: 'bullet' | 'summary' | 'skills';
  targetId?: string;
  section: string;
  original: string;
  rewritten: string;
  rationale: string;
  keywordsAdded: string[];
  needsUserInput: string[];
  risk: 'low' | 'medium' | 'high';
  reverted?: boolean;
  guardNote?: string;
}

export interface PolishResult {
  edits: PolishEdit[];
  polishedResume: string;
  summary: string;
  factGuard: {
    passed: boolean;
    issues: string[];
  };
}

/* ---------------------------------- 项目 ---------------------------------- */

export interface ProjectWeek {
  week: number;
  goal: string;
  tasks: string[];
  deliverable: string;
  acceptance: string;
}

export interface ProjectMapping {
  keyword: string;
  how: string;
}

export interface ProjectFeature {
  name: string;
  required: boolean;
}

export interface ProjectResource {
  title: string;
  url?: string;
}

export interface ProjectIdea {
  tier: 'sprint' | 'standard' | 'advanced';
  name: string;
  valueProposition: string;
  jdMapping: ProjectMapping[];
  stack: string[];
  prerequisites: string[];
  features: ProjectFeature[];
  weeks: ProjectWeek[];
  metrics: string[];
  resumeBullets: string[];
  showcase: string;
  resources: ProjectResource[];
  pitfalls: string;
}

export interface ProjectPlan {
  projects: ProjectIdea[];
  recommendation: string;
}

/* ---------------------------------- 审核 ---------------------------------- */

export interface QualityReview {
  passed: boolean;
  issues: string[];
  keywordCoverageBefore: number;
  keywordCoverageAfter: number;
  lengthCheck: {
    characters: number;
    bullets: number;
    overOnePage: boolean;
  };
  nextActions: string[];
}

/* ---------------------------------- 报告 ---------------------------------- */

export interface AnalyzeInput {
  resumeText: string;
  company: string;
  title: string;
  direction: Direction;
  seniority: Seniority;
  jd: string;
  jdUrl: string;
  weeks: number;
}

export interface Report {
  id: string;
  createdAt: string;
  resume: ResumeProfile;
  job: JobProfile;
  gap: GapAnalysis;
  research: ResearchBrief;
  polish?: PolishResult;
  project?: ProjectPlan;
  review: QualityReview;
  warnings: string[];
  meta: {
    model: string;
    durationMs: number;
    searchEnabled: boolean;
    mock: boolean;
  };
}

export interface ReportSummary {
  id: string;
  createdAt: string;
  company: string;
  title: string;
  score: number;
  route: RouteType;
  mock: boolean;
}

/* ---------------------------------- 设置 ---------------------------------- */

export interface LLMSettings {
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature: number;
}

export interface SearchSettings {
  provider: SearchProvider;
  apiKey: string;
}

export interface Settings {
  llm: LLMSettings;
  search: SearchSettings;
  mockMode: boolean;
}

export interface PublicSettings {
  llm: {
    baseUrl: string;
    model: string;
    temperature: number;
    apiKeyMasked: string;
    hasApiKey: boolean;
  };
  search: {
    provider: SearchProvider;
    apiKeyMasked: string;
    hasApiKey: boolean;
  };
  mockMode: boolean;
}

/* -------------------------------- 流程事件 -------------------------------- */

export type PipelineEvent =
  | { type: 'stage'; stage: string; label: string }
  | { type: 'agent_start'; agent: AgentId; label: string }
  | { type: 'agent_log'; agent: AgentId; message: string }
  | { type: 'agent_done'; agent: AgentId; summary: string }
  | { type: 'agent_skip'; agent: AgentId; reason: string }
  | { type: 'agent_error'; agent: AgentId; message: string }
  | { type: 'warning'; message: string }
  | { type: 'error'; message: string }
  | { type: 'final'; reportId: string };
