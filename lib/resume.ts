import type { Experience, PolishEdit, ResumeProfile } from './types';

export interface ResumeEntry {
  title: string;
  meta?: string;
  bullets: string[];
}

export interface ResumeSection {
  heading: string;
  entries: ResumeEntry[];
}

export interface ResumeDoc {
  name: string;
  contactLine: string;
  sections: ResumeSection[];
}

function isAccepted(edit: PolishEdit, acceptedIds?: string[]): boolean {
  if (edit.reverted) return false;
  if (acceptedIds === undefined) return true;
  return acceptedIds.includes(edit.id);
}

function buildEditMap(
  edits: PolishEdit[],
  targetType: PolishEdit['targetType'],
  acceptedIds?: string[],
): Map<string, PolishEdit> {
  const map = new Map<string, PolishEdit>();
  for (const edit of edits) {
    if (edit.targetType !== targetType) continue;
    if (!isAccepted(edit, acceptedIds)) continue;
    if (!edit.rewritten?.trim()) continue;
    const key = edit.targetId ?? targetType;
    if (!map.has(key)) map.set(key, edit);
  }
  return map;
}

function entryFromExperience(
  experience: Experience,
  bulletEdits: Map<string, PolishEdit>,
): ResumeEntry {
  const bullets = experience.bullets
    .map((bullet) => bulletEdits.get(bullet.id)?.rewritten?.trim() || bullet.text)
    .filter(Boolean);
  const meta = [experience.org, experience.period].filter(Boolean).join(' ｜ ');
  return {
    title: experience.title || experience.org || '经历',
    meta: meta || undefined,
    bullets,
  };
}

export function buildResumeDoc(
  profile: ResumeProfile,
  edits: PolishEdit[] = [],
  acceptedIds?: string[],
): ResumeDoc {
  const bulletEdits = buildEditMap(edits, 'bullet', acceptedIds);
  const summaryEdit = edits.find(
    (edit) => edit.targetType === 'summary' && isAccepted(edit, acceptedIds),
  );
  const skillsEdit = edits.find(
    (edit) => edit.targetType === 'skills' && isAccepted(edit, acceptedIds),
  );

  const sections: ResumeSection[] = [];

  if (profile.education.length > 0) {
    sections.push({
      heading: '教育经历',
      entries: profile.education.map((item) => entryFromExperience(item, bulletEdits)),
    });
  }
  if (profile.internships.length > 0) {
    sections.push({
      heading: '实习经历',
      entries: profile.internships.map((item) => entryFromExperience(item, bulletEdits)),
    });
  }
  if (profile.projects.length > 0) {
    sections.push({
      heading: '项目经历',
      entries: profile.projects.map((item) => entryFromExperience(item, bulletEdits)),
    });
  }

  const skillsText = skillsEdit?.rewritten?.trim() || profile.skills.join('、');
  if (skillsText) {
    sections.push({
      heading: '专业技能',
      entries: [{ title: '', bullets: [skillsText] }],
    });
  }

  if (profile.awards.length > 0) {
    sections.push({
      heading: '荣誉奖项',
      entries: [{ title: '', bullets: profile.awards }],
    });
  }

  const selfEvaluation = summaryEdit?.rewritten?.trim() || profile.selfEvaluation?.trim();
  if (selfEvaluation) {
    sections.push({
      heading: '自我评价',
      entries: [{ title: '', bullets: [selfEvaluation] }],
    });
  }

  const basic = profile.basic;
  const contactLine = [
    basic.school,
    basic.major,
    basic.degree,
    basic.graduation,
    basic.contact,
  ]
    .filter(Boolean)
    .join(' ｜ ');

  return {
    name: basic.name?.trim() || '个人简历',
    contactLine,
    sections,
  };
}

export function resumeDocToMarkdown(doc: ResumeDoc): string {
  const lines: string[] = [`# ${doc.name}`];
  if (doc.contactLine) lines.push(doc.contactLine);

  for (const section of doc.sections) {
    lines.push('', `## ${section.heading}`);
    for (const entry of section.entries) {
      const heading = entry.title
        ? `**${entry.title}**${entry.meta ? ` ｜ ${entry.meta}` : ''}`
        : entry.meta ?? '';
      if (heading) lines.push(heading);
      for (const bullet of entry.bullets) {
        lines.push(`- ${bullet}`);
      }
    }
  }

  return lines.join('\n').trim();
}

export function assembleResumeMarkdown(
  profile: ResumeProfile,
  edits: PolishEdit[] = [],
  acceptedIds?: string[],
): string {
  return resumeDocToMarkdown(buildResumeDoc(profile, edits, acceptedIds));
}
