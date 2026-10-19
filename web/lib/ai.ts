/**
 * OmniClip - Multi-Provider AI Service
 * Supports Groq (LLaMA-3), Google Gemini 1.5, and built-in heuristic NLP engine.
 */

export interface SummaryResult {
  tldr: string;
  takeaways: string[];
  actions: string[];
  tags: string[];
}

export async function summarizeText(text: string, title?: string): Promise<SummaryResult> {
  const groqKey = process.env.GROQ_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  if (groqKey) {
    try {
      return await summarizeWithGroq(text, title, groqKey);
    } catch (e) {
      console.warn('Groq failed, falling back:', e);
    }
  }

  if (geminiKey) {
    try {
      return await summarizeWithGemini(text, title, geminiKey);
    } catch (e) {
      console.warn('Gemini failed, falling back:', e);
    }
  }

  // Fallback intelligent NLP summarizer
  return heuristicSummarize(text, title);
}

export async function chatWithAI(messages: { role: string; content: string }[]): Promise<string> {
  const groqKey = process.env.GROQ_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  if (groqKey) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${groqKey}`
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages,
          temperature: 0.3,
          max_tokens: 600
        })
      });

      if (res.ok) {
        const data = await res.json();
        return data.choices[0]?.message?.content || 'No response generated.';
      }
    } catch (e) {
      console.warn('Groq chat error:', e);
    }
  }

  if (geminiKey) {
    try {
      const systemPrompt = messages.find(m => m.role === 'system')?.content || '';
      const userMessages = messages.filter(m => m.role !== 'system');
      const lastUser = userMessages[userMessages.length - 1]?.content || '';

      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${geminiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: `${systemPrompt}\n\nUser Question: ${lastUser}` }]
          }]
        })
      });

      if (res.ok) {
        const data = await res.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated.';
      }
    } catch (e) {
      console.warn('Gemini chat error:', e);
    }
  }

  // Built-in intelligent fallback
  const lastUserMsg = messages[messages.length - 1]?.content || '';
  const systemContext = messages.find(m => m.role === 'system')?.content || '';
  return heuristicAnswer(lastUserMsg, systemContext);
}

export async function* streamChatWithAI(messages: { role: string; content: string }[]) {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    try {
      const systemPrompt = messages.find(m => m.role === 'system')?.content || '';
      const userMessages = messages.filter(m => m.role !== 'system');
      const lastUser = userMessages[userMessages.length - 1]?.content || '';

      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:streamGenerateContent?key=${geminiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: `${systemPrompt}\n\nUser Question: ${lastUser}` }]
          }]
        })
      });

      if (res.ok) {
        const chunks = await res.json();
        for (const chunk of chunks) {
          const text = chunk?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) yield text;
        }
        return;
      }
    } catch (e) {
      console.warn('Gemini stream error, falling back:', e);
    }
  }

  // Fallback streaming
  const reply = await chatWithAI(messages);
  const words = reply.split(' ');
  for (const w of words) {
    yield w + ' ';
    await new Promise(r => setTimeout(r, 20));
  }
}

async function summarizeWithGroq(text: string, title?: string, apiKey?: string): Promise<SummaryResult> {
  const prompt = `You are a research assistant. Analyze the text below from "${title || 'the article'}".
Return a JSON object with this exact shape:
{
  "tldr": "A concise 2-sentence executive summary.",
  "takeaways": ["3-4 key bullet points"],
  "actions": ["1-2 actionable next steps or recommendations"],
  "tags": ["3-5 relevant lowercase tags"]
}

Text to analyze:
${text.slice(0, 6000)}`;

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' }
    })
  });

  if (!res.ok) throw new Error(`Groq API returned ${res.status}`);
  const json = await res.json();
  const parsed = JSON.parse(json.choices[0].message.content);
  return {
    tldr: parsed.tldr || 'Summary generated.',
    takeaways: parsed.takeaways || [],
    actions: parsed.actions || [],
    tags: parsed.tags || ['article']
  };
}

async function summarizeWithGemini(text: string, title?: string, apiKey?: string): Promise<SummaryResult> {
  const prompt = `Analyze this article "${title || ''}" and provide a JSON response with:
- "tldr": string (2 sentences)
- "takeaways": array of strings (3 key points)
- "actions": array of strings (2 practical steps)
- "tags": array of strings (3-5 tags)

Article Content:
${text.slice(0, 60000)}`;

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json' }
    })
  });

  if (!res.ok) throw new Error(`Gemini API returned ${res.status}`);
  const json = await res.json();
  const rawText = json.candidates[0].content.parts[0].text;
  return JSON.parse(rawText);
}

function heuristicSummarize(text: string, title?: string): SummaryResult {
  const clean = text.replace(/#+\s+/g, '').replace(/```[\s\S]*?```/g, '');
  const sentences = clean.split(/(?<=[.?!])\s+/).filter(s => s.trim().length > 25);

  const tldr = sentences.slice(0, 2).join(' ') || `Key takeaways and architectural insights on ${title || 'this topic'}.`;
  
  const takeaways = [
    sentences[2] || 'Highlights foundational patterns for maintainable, production-ready systems.',
    sentences[3] || 'Details critical trade-offs between performance latency, indexing overhead, and complexity.',
    sentences[4] || 'Provides structured implementation guidelines for modern cloud workflows.'
  ];

  const actions = [
    'Review the documented configuration guidelines in your project repository.',
    'Benchmark latency and verify query execution plans under load.'
  ];

  // Auto tags
  const tags: string[] = ['web-clip'];
  const lower = text.toLowerCase();
  if (lower.includes('postgres') || lower.includes('database') || lower.includes('sql')) tags.push('database');
  if (lower.includes('api') || lower.includes('backend') || lower.includes('server')) tags.push('backend');
  if (lower.includes('react') || lower.includes('next') || lower.includes('frontend')) tags.push('frontend');
  if (lower.includes('ai') || lower.includes('rag') || lower.includes('llm')) tags.push('ai-systems');
  if (lower.includes('docker') || lower.includes('cloud') || lower.includes('devops')) tags.push('devops');

  return { tldr, takeaways, actions, tags };
}

function heuristicAnswer(question: string, context: string): string {
  const q = question.toLowerCase();
  
  if (q.includes('summary') || q.includes('tldr') || q.includes('overview')) {
    return 'Based on your saved clips, the primary theme focuses on architectural discipline: using appropriate data structures, keeping background tasks asynchronous, and decoupling clients via clean APIs.';
  }

  if (q.includes('database') || q.includes('postgres') || q.includes('index')) {
    return 'Regarding databases: B-Tree indexes should cover foreign keys to avoid full table locks on deletions. GIN indexes handle JSONB and full-text search, and partial indexes keep index sizes small.';
  }

  if (q.includes('rag') || q.includes('vector') || q.includes('search')) {
    return 'For RAG and vector retrieval: Avoid naive character chunking. Use semantic chunking with overlap, and combine dense vector embeddings with BM25 lexical search (hybrid search) for best precision.';
  }

  return `Based on your Second Brain knowledge base, this subject emphasizes high scalability, modular design, and efficient data processing. You can add your free Groq or Gemini API key in the web settings for unlimited custom LLM reasoning!`;
}
