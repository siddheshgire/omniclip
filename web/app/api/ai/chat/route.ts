import { NextRequest, NextResponse } from 'next/server';
import { chatWithAI, streamChatWithAI } from '@/lib/ai';
import { getAllClips } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const { messages, queryAllBrain, stream: shouldStream } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ success: false, error: 'Invalid messages payload' }, { status: 400 });
    }

    let conversation = [...messages];

    // If queryAllBrain is true, inject context from the user's saved clips (RAG)
    if (queryAllBrain) {
      const clips = getAllClips().slice(0, 8); // Top recent clips
      const clipsSummary = clips.map((c, i) => 
        `[Clip ${i + 1}] Title: "${c.title}" | Tags: ${c.tags.join(', ')} | Summary: ${c.summary || c.content.slice(0, 300)}`
      ).join('\n\n');

      conversation.unshift({
        role: 'system',
        content: `You are OmniClip, a world-class AI Second Brain assistant.
Always format your response with clean, scannable markdown:
- Use clean paragraph breaks (\n\n) between different points.
- Use bullet points (* or -) on separate lines for lists.
- Highlight key terms in **bold**.
- If introducing an article or clip, place it on its own line.
- Never concatenate bullet points together on the same line.

User's Saved Knowledge Base:
${clipsSummary}`
      });
    }

    // Real-time SSE streaming
    if (shouldStream) {
      const encoder = new TextEncoder();
      const customReadable = new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of streamChatWithAI(conversation)) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`));
            }
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();
          } catch (err: any) {
            controller.error(err);
          }
        }
      });

      return new Response(customReadable, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    const reply = await chatWithAI(conversation);
    return NextResponse.json({ success: true, reply });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
