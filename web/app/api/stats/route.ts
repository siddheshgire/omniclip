import { NextResponse } from 'next/server';
import { getAllClips } from '@/lib/db';

export async function GET() {
  try {
    const clips = getAllClips();
    const totalClips = clips.length;
    const totalWords = clips.reduce((acc, c) => acc + (c.wordCount || 0), 0);
    const readingTimeMins = clips.reduce((acc, c) => acc + (c.readTimeMins || 1), 0);
    const timeSavedMins = Math.round(readingTimeMins * 0.7); // 70% time saved via AI summaries

    // Extract unique tags and frequency
    const tagCount: Record<string, number> = {};
    clips.forEach(c => {
      c.tags.forEach(t => {
        tagCount[t] = (tagCount[t] || 0) + 1;
      });
    });

    const topTags = Object.entries(tagCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([tag, count]) => ({ tag, count }));

    return NextResponse.json({
      success: true,
      stats: {
        totalClips,
        totalWords,
        readingTimeMins,
        timeSavedMins,
        uniqueTagsCount: Object.keys(tagCount).length,
        topTags
      }
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
