import { NextRequest, NextResponse } from 'next/server';
import { getAllClips, saveClip, searchClips } from '@/lib/db';
import { summarizeText } from '@/lib/ai';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q') || '';
    const tag = searchParams.get('tag') || undefined;

    const clips = searchClips(query, tag);
    return NextResponse.json({ success: true, count: clips.length, clips });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body.title && !body.url && !body.content) {
      return NextResponse.json({ success: false, error: 'Missing clip data' }, { status: 400 });
    }

    // If summary is missing and content is substantial, auto-summarize
    let summary = body.summary;
    let tags = body.tags || [];

    if (!summary && body.content && body.content.length > 300) {
      try {
        const aiResult = await summarizeText(body.content, body.title);
        summary = aiResult.tldr;
        if (tags.length === 0 && aiResult.tags?.length) {
          tags = aiResult.tags;
        }
      } catch (e) {
        console.warn('Auto-summarization failed on clip ingest:', e);
      }
    }

    const saved = saveClip({
      ...body,
      summary,
      tags: tags.length ? tags : ['web-clip']
    });

    return NextResponse.json({ success: true, clip: saved }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
