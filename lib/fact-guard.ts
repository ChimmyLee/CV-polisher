import type { PolishEdit, ResumeProfile } from './types';

const NUMBER_RE = /\d+(?:\.\d+)?%?/g;
const PLACEHOLDER_RE = /\[待补充[^\]]*\]/g;

export function extractNumbers(text: string): string[] {
  return text.match(NUMBER_RE) ?? [];
}

function normalizeNumber(value: string): string {
  return value.trim();
}

/** 找出改写文本中、原简历里不存在的数字（排除 [待补充] 占位）。 */
export function findUnsupportedNumbers(originalText: string, rewritten: string): string[] {
  const stripped = rewritten.replace(PLACEHOLDER_RE, ' ');
  const originalSet = new Set(extractNumbers(originalText).map(normalizeNumber));
  const unsupported = new Set<string>();
  for (const number of extractNumbers(stripped)) {
    if (!originalSet.has(normalizeNumber(number))) unsupported.add(number);
  }
  return [...unsupported];
}

export function collectBullets(profile: ResumeProfile): Map<string, string> {
  const map = new Map<string, string>();
  for (const group of [profile.education, profile.internships, profile.projects]) {
    for (const experience of group) {
      for (const bullet of experience.bullets) {
        map.set(bullet.id, bullet.text);
      }
    }
  }
  return map;
}

export interface GuardResult {
  edits: PolishEdit[];
  issues: string[];
}

/**
 * 确定性事实护栏：确保改写只引用原简历中存在的数字；
 * 找不到对应原文条目的改写直接回退。
 */
export function guardEdits(edits: PolishEdit[], profile: ResumeProfile): GuardResult {
  const bullets = collectBullets(profile);
  const issues: string[] = [];

  const guarded = edits.map((edit) => {
    const next: PolishEdit = { ...edit };
    const rewritten = edit.rewritten?.trim() ?? '';
    const sectionLabel = edit.section || '简历内容';

    if (!rewritten) {
      next.reverted = true;
      next.guardNote = '改写为空，已回退为原文';
      issues.push(`${sectionLabel}：改写为空，已回退`);
      return next;
    }

    if (edit.targetType === 'bullet') {
      const actual = edit.targetId ? bullets.get(edit.targetId) : undefined;
      if (!actual) {
        next.reverted = true;
        next.guardNote = '未找到对应的原文条目，已回退';
        issues.push(`${sectionLabel}：未找到对应原文条目（${edit.targetId ?? '无 ID'}），已回退`);
        return next;
      }
      next.original = actual;
    }

    const unsupported = findUnsupportedNumbers(profile.rawText, rewritten);
    if (unsupported.length > 0) {
      next.reverted = true;
      next.guardNote = `新增了原文没有的数字：${unsupported.join('、')}，已回退`;
      issues.push(`${sectionLabel}：新增数字 ${unsupported.join('、')}，已回退`);
      return next;
    }

    return next;
  });

  return { edits: guarded, issues };
}

/** 统计简历的字符数与 bullet 数，用于一页纸检查。 */
export function resumeLengthStats(markdown: string): { characters: number; bullets: number } {
  const withoutHeadings = markdown
    .split('\n')
    .filter((line) => !line.trim().startsWith('#'))
    .join('\n');
  const characters = withoutHeadings.replace(/\s/g, '').length;
  const bullets = markdown
    .split('\n')
    .filter((line) => /^\s*[-*•]\s+/.test(line)).length;
  return { characters, bullets };
}
