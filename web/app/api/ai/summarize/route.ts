import { NextRequest, NextResponse } from 'next/server';
import { summarizeText } from '@/lib/ai';

export async function POST(req: NextRequest) {
  try {
    const { text, title } = await req.json();

    if (!text || text.trim().length === 0) {
      return NextResponse.json({ success: false, error: 'No text provided to summarize' }, { status: 400 });
    }

    const result = await summarizeText(text, title);
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
