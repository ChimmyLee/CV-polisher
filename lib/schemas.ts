import { z } from 'zod';

/* ---------------------------------- 简历 ---------------------------------- */

export const ExperienceSchema = z.object({
  title: z.string().default(''),
  org: z.string().optional(),
  period: z.string().optional(),
  bullets: z
    .array(
      z.object({
        text: z.string().default(''),
      }),
    )
    .default([]),
});

export const ResumeProfileSchema = z.object({
  basic: z
    .object({
      name: z.string().optional(),
      school: z.string().optional(),
      major: z.string().optional(),
      degree: z.string().optional(),
      graduation: z.string().optional(),
      contact: z.string().optional(),
    })
    .default({}),
  education: z.array(ExperienceSchema).default([]),
  internships: z.array(ExperienceSchema).default([]),
  projects: z.array(ExperienceSchema).default([]),
  skills: z.array(z.string()).default([]),
  awards: z.array(z.string()).default([]),
  selfEvaluation: z.string().optional(),
});

export type ResumeProfileRaw = z.infer<typeof ResumeProfileSchema>;

/* ---------------------------------- 岗位 ---------------------------------- */

export const RoleFamilySchema = z
  .enum([
    'backend',
    'frontend',
    'client',
    'algorithm',
    'data',
    'product',
    'operations',
    'design',
    'test',
    'other',
  ])
  .catch('other');

export const SenioritySchema = z
  .enum(['intern', 'campus', 'social', 'other'])
  .catch('other');

export const JobProfileSchema = z.object({
  company: z.string().default(''),
  title: z.string().default(''),
  roleFamily: RoleFamilySchema,
  seniority: SenioritySchema,
  mustHave: z.array(z.string()).default([]),
  niceToHave: z.array(z.string()).default([]),
  responsibilities: z.array(z.string()).default([]),
  keywords: z
    .array(
      z.object({
        term: z.string().default(''),
        weight: z.coerce.number().min(0).max(3).default(2),
        aliases: z.array(z.string()).default([]),
      }),
    )
    .default([]),
  hiddenRequirements: z.array(z.string()).default([]),
  summary: z.string().default(''),
});

/* ---------------------------------- 诊断 ---------------------------------- */

export const GapLlmSchema = z.object({
  dimensions: z.object({
    hard: z.coerce.number().min(0).max(100).default(60),
    relevance: z.coerce.number().min(0).max(100).default(60),
    quantification: z.coerce.number().min(0).max(100).default(50),
    expression: z.coerce.number().min(0).max(100).default(60),
  }),
  hasRelevantExperience: z.boolean().default(false),
  relevanceReason: z.string().default(''),
  gaps: z
    .array(
      z.object({
        item: z.string().default(''),
        severity: z.enum(['high', 'medium', 'low']).catch('medium'),
        suggestion: z.string().default(''),
      }),
    )
    .default([]),
});

/* ---------------------------------- 润色 ---------------------------------- */

export const PolishLlmSchema = z.object({
  edits: z
    .array(
      z.object({
        targetType: z.enum(['bullet', 'summary', 'skills']).catch('bullet'),
        targetId: z.coerce.string().optional(),
        section: z.string().default(''),
        original: z.string().default(''),
        rewritten: z.string().default(''),
        rationale: z.string().default(''),
        keywordsAdded: z.array(z.string()).default([]),
        needsUserInput: z.array(z.string()).default([]),
        risk: z.enum(['low', 'medium', 'high']).catch('medium'),
      }),
    )
    .default([]),
  summary: z.string().default(''),
});

export const FactGuardLlmSchema = z.object({
  passed: z.boolean().default(true),
  issues: z
    .array(
      z.object({
        targetId: z.coerce.string().optional(),
        problem: z.string().default(''),
      }),
    )
    .default([]),
});

/* -------------------------------- 项目规划 -------------------------------- */

export const ProjectWeekSchema = z.object({
  week: z.coerce.number().default(1),
  goal: z.string().default(''),
  tasks: z.array(z.string()).default([]),
  deliverable: z.string().default(''),
  acceptance: z.string().default(''),
});

export const ProjectIdeaSchema = z.object({
  tier: z.enum(['sprint', 'standard', 'advanced']).catch('standard'),
  name: z.string().default(''),
  valueProposition: z.string().default(''),
  jdMapping: z
    .array(
      z.object({
        keyword: z.string().default(''),
        how: z.string().default(''),
      }),
    )
    .default([]),
  stack: z.array(z.string()).default([]),
  prerequisites: z.array(z.string()).default([]),
  features: z
    .array(
      z.object({
        name: z.string().default(''),
        required: z.boolean().catch(true),
      }),
    )
    .default([]),
  weeks: z.array(ProjectWeekSchema).default([]),
  metrics: z.array(z.string()).default([]),
  resumeBullets: z.array(z.string()).default([]),
  showcase: z.string().default(''),
  resources: z
    .array(
      z.object({
        title: z.string().default(''),
        url: z.string().optional(),
      }),
    )
    .default([]),
  pitfalls: z.string().default(''),
});

export const ProjectPlanSchema = z.object({
  projects: z.array(ProjectIdeaSchema).default([]),
  recommendation: z.string().default(''),
});

/* ---------------------------------- 检索 ---------------------------------- */

export const ResearchQueriesSchema = z.object({
  queries: z.array(z.string()).default([]),
});

export const ResearchLlmSchema = z.object({
  companyOverview: z.string().default(''),
  roleInsight: z.string().default(''),
  interviewProcess: z.string().default(''),
  recentNews: z.array(z.string()).default([]),
  applicationTips: z.array(z.string()).default([]),
});

/* ---------------------------------- 审核 ---------------------------------- */

export const ReviewLlmSchema = z.object({
  passed: z.boolean().default(true),
  issues: z.array(z.string()).default([]),
  nextActions: z.array(z.string()).default([]),
});

/* ---------------------------------- 入参 ---------------------------------- */

export const AnalyzeRequestSchema = z.object({
  resumeText: z
    .string()
    .min(50, '简历内容过短，至少 50 个字符')
    .max(50_000, '简历内容过长，请精简到 5 万字符以内'),
  company: z.string().max(100, '公司名称过长').default(''),
  title: z.string().max(120, '岗位名称过长').default(''),
  direction: z.enum(['tech', 'algorithm', 'product', 'design', 'other']).default('other'),
  seniority: z.enum(['intern', 'campus', 'social']).default('campus'),
  jd: z.string().max(30_000, 'JD 过长，请精简到 3 万字符以内').default(''),
  jdUrl: z.string().max(2_000, 'JD 链接过长').default(''),
  weeks: z.coerce.number().min(1).max(16).default(4),
});

export const SettingsInputSchema = z.object({
  llm: z.object({
    baseUrl: z.string().url('Base URL 必须是合法地址'),
    apiKey: z.string().default(''),
    model: z.string().min(1),
    temperature: z.coerce.number().min(0).max(2).default(0.3),
  }),
  search: z.object({
    provider: z.enum(['bocha', 'tavily', 'serper', 'none']).default('none'),
    apiKey: z.string().default(''),
  }),
  mockMode: z.boolean().default(false),
});

export const TestConnectionSchema = z.object({
  type: z.enum(['llm', 'search']),
  llm: SettingsInputSchema.shape.llm.optional(),
  search: SettingsInputSchema.shape.search.optional(),
});
