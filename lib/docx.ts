import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  Paragraph,
  TextRun,
} from 'docx';
import type { PolishEdit, ResumeProfile } from './types';
import { buildResumeDoc } from './resume';

const FONT = {
  ascii: 'Microsoft YaHei',
  eastAsia: '微软雅黑',
  hAnsi: 'Microsoft YaHei',
};

const PLACEHOLDER_RE = /\[待补充[^\]]*\]/g;

function bulletRuns(text: string): TextRun[] {
  const runs: TextRun[] = [];
  let lastIndex = 0;
  for (const match of text.matchAll(PLACEHOLDER_RE)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      runs.push(
        new TextRun({
          text: text.slice(lastIndex, index),
          font: FONT,
          size: 20,
        }),
      );
    }
    runs.push(
      new TextRun({
        text: match[0],
        font: FONT,
        size: 20,
        color: 'A86419',
      }),
    );
    lastIndex = index + match[0].length;
  }
  if (lastIndex < text.length) {
    runs.push(
      new TextRun({
        text: text.slice(lastIndex),
        font: FONT,
        size: 20,
      }),
    );
  }
  if (runs.length === 0) {
    runs.push(new TextRun({ text, font: FONT, size: 20 }));
  }
  return runs;
}

export async function buildResumeDocx(
  profile: ResumeProfile,
  edits: PolishEdit[],
  acceptedEditIds?: string[],
): Promise<Uint8Array> {
  const doc = buildResumeDoc(profile, edits, acceptedEditIds);
  const children: Paragraph[] = [];

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
      children: [
        new TextRun({
          text: doc.name,
          bold: true,
          size: 36,
          font: FONT,
          color: '1C1B17',
        }),
      ],
    }),
  );

  if (doc.contactLine) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 180 },
        children: [
          new TextRun({
            text: doc.contactLine,
            size: 19,
            font: FONT,
            color: '6F6A60',
          }),
        ],
      }),
    );
  }

  for (const section of doc.sections) {
    children.push(
      new Paragraph({
        spacing: { before: 200, after: 80 },
        border: {
          bottom: {
            color: 'CFC5B1',
            style: BorderStyle.SINGLE,
            size: 6,
            space: 2,
          },
        },
        children: [
          new TextRun({
            text: section.heading,
            bold: true,
            size: 22,
            font: FONT,
            color: '1F6A55',
          }),
        ],
      }),
    );

    for (const entry of section.entries) {
      if (entry.title) {
        const runs: TextRun[] = [
          new TextRun({ text: entry.title, bold: true, size: 21, font: FONT }),
        ];
        if (entry.meta) {
          runs.push(
            new TextRun({
              text: ` ｜ ${entry.meta}`,
              size: 19,
              font: FONT,
              color: '6F6A60',
            }),
          );
        }
        children.push(new Paragraph({ spacing: { before: 80, after: 30 }, children: runs }));
      }

      for (const bullet of entry.bullets) {
        children.push(
          new Paragraph({
            spacing: { after: 30 },
            indent: { left: 240, hanging: 140 },
            children: bulletRuns(`• ${bullet}`),
          }),
        );
      }
    }
  }

  const document = new Document({
    creator: 'CV Polisher',
    title: `${profile.basic.name ?? '个人'}的简历`,
    description: '由 CV Polisher 生成',
    styles: {
      default: {
        document: {
          run: { font: FONT, size: 20 },
          paragraph: { spacing: { line: 300 } },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 720, bottom: 720, left: 720, right: 720 },
          },
        },
        children,
      },
    ],
  });

  const buffer = await Packer.toBuffer(document);
  return new Uint8Array(buffer);
}
