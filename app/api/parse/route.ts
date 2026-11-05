import { parseUploadedFile } from '@/lib/parse-file';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get('file');
    if (!file || typeof file === 'string') {
      return Response.json({ error: '未收到文件' }, { status: 400 });
    }

    const parsed = await parseUploadedFile(file as File);
    return Response.json(parsed);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : '文件解析失败' },
      { status: 400 },
    );
  }
}
