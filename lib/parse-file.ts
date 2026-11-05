import { extractText, getDocumentProxy } from 'unpdf';

const MAX_BYTES = 10 * 1024 * 1024;
const MAX_CHARS = 30_000;

export interface ParsedUpload {
  text: string;
  fileName: string;
  kind: 'pdf' | 'docx' | 'text';
}

function cleanText(text: string): string {
  return text
    .replace(/\u0000/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function parsePdf(buffer: ArrayBuffer): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const result = await extractText(pdf, { mergePages: true });
  const text = Array.isArray(result.text) ? result.text.join('\n') : result.text;
  return cleanText(text ?? '');
}

async function parseDocx(buffer: ArrayBuffer): Promise<string> {
  // @ts-ignore mammoth 是 CJS 包，且不随包提供 TypeScript 类型
  const module = await import('mammoth');
  // @ts-ignore 兼顾有/无类型声明的两种打包形态
  const mammoth = (module.default ?? module) as {
    extractRawText: (input: { buffer: Buffer }) => Promise<{ value: string }>;
  };
  const result = await mammoth.extractRawText({ buffer: Buffer.from(buffer) });
  return cleanText(result.value ?? '');
}

export async function parseUploadedFile(file: File): Promise<ParsedUpload> {
  if (file.size === 0) {
    throw new Error('文件为空');
  }
  if (file.size > MAX_BYTES) {
    throw new Error('文件超过 10MB，请压缩后重试');
  }

  const name = file.name.toLowerCase();
  const buffer = await file.arrayBuffer();
  let text = '';
  let kind: ParsedUpload['kind'] = 'text';

  if (name.endsWith('.pdf')) {
    kind = 'pdf';
    try {
      text = await parsePdf(buffer);
    } catch (error) {
      throw new Error(
        `PDF 解析失败：${error instanceof Error ? error.message : '未知错误'}。请尝试粘贴文本，或上传可复制文字的 PDF。`,
      );
    }
  } else if (name.endsWith('.docx')) {
    kind = 'docx';
    try {
      text = await parseDocx(buffer);
    } catch (error) {
      throw new Error(
        `DOCX 解析失败：${error instanceof Error ? error.message : '未知错误'}。请尝试粘贴文本。`,
      );
    }
  } else if (name.endsWith('.txt') || name.endsWith('.md') || name.endsWith('.markdown')) {
    kind = 'text';
    text = cleanText(Buffer.from(buffer).toString('utf8'));
  } else {
    throw new Error('仅支持 PDF / DOCX / TXT / MD 文件');
  }

  if (text.length < 30) {
    throw new Error(
      '未能从文件中提取到足够的文字。若是扫描版 PDF 或图片，请粘贴文本后继续（v1 暂不支持 OCR）。',
    );
  }

  return {
    text: text.slice(0, MAX_CHARS),
    fileName: file.name,
    kind,
  };
}
