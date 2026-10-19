import fs from 'fs';
import path from 'path';

export interface Clip {
  id: string;
  title: string;
  url: string;
  domain: string;
  favicon?: string;
  content: string;
  tags: string[];
  note?: string;
  summary?: string;
  wordCount?: number;
  readTimeMins?: number;
  createdAt: string;
  isFavorite?: boolean;
  embedding?: number[];
}

const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'clips.json');

// Initial seed clips so user has a rich experience immediately on startup
const INITIAL_CLIPS: Clip[] = [
  {
    id: 'clip-1',
    title: 'PostgreSQL Indexing: The Definitive Guide to B-Tree, GIN, and GiST',
    url: 'https://postgres.org/docs/indexing-deep-dive',
    domain: 'postgres.org',
    favicon: 'https://www.google.com/s2/favicons?domain=postgres.org&sz=64',
    content: `# PostgreSQL Indexing Deep Dive\n\nWhen scaling relational databases, proper indexing is often the single highest leverage performance optimization. B-Trees excel at range queries and equality comparisons. GIN (Generalized Inverted Index) is unmatched for full-text search and JSONB containment queries.\n\n### Key Rules:\n1. Index foreign keys to avoid full table locks on cascade deletions.\n2. Use partial indexes (WHERE condition) to keep indexes compact.\n3. Monitor pg_stat_user_indexes for dead/unused index bloat.`,
    tags: ['database', 'postgres', 'backend', 'system-design'],
    note: 'Essential reference for tuning queries and designing multi-tenant schemas.',
    summary: 'Comprehensive breakdown of PostgreSQL index types: B-Tree for equality/ranges, GIN for JSONB and full-text search, and tips for partial indexing to reduce bloat.',
    wordCount: 1450,
    readTimeMins: 7,
    createdAt: new Date(Date.now() - 3600000 * 4).toISOString(),
    isFavorite: true
  },
  {
    id: 'clip-2',
    title: 'Building Modern Chrome Extensions with Manifest V3 and Side Panel API',
    url: 'https://developer.chrome.com/docs/extensions/mv3/side-panel',
    domain: 'developer.chrome.com',
    favicon: 'https://www.google.com/s2/favicons?domain=developer.chrome.com&sz=64',
    content: `# Manifest V3 & The Chrome Side Panel API\n\nManifest V3 shifts background pages to ephemeral service workers and introduces dedicated side panels via chrome.sidePanel. This enables continuous contextual interactions alongside the user's active browsing session.\n\n### Architectural Insights:\n- Use storage.sync for small user preferences (<100KB).\n- Offload heavy DOM parsing to content scripts.\n- Keep service workers stateless to handle background lifecycle suspensions.`,
    tags: ['frontend', 'chrome-extension', 'architecture'],
    note: 'Guide used to architect OmniClip companion extension.',
    summary: 'Covers Chrome MV3 side panel lifecycle, background service worker constraints, and cross-context message passing patterns.',
    wordCount: 890,
    readTimeMins: 4,
    createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
    isFavorite: true
  },
  {
    id: 'clip-3',
    title: 'Retrieval-Augmented Generation (RAG): Chunking Strategies & Vector Search',
    url: 'https://arxiv.org/abs/2312.rag-advances',
    domain: 'arxiv.org',
    favicon: 'https://www.google.com/s2/favicons?domain=arxiv.org&sz=64',
    content: `# Effective RAG Architecture\n\nNaively chunking documents by character count destroys semantic coherence. Modern RAG pipelines implement recursive character splitting with overlap or sentence window retrieval. Pairing vector cosine distance with reciprocal rank fusion (RRF) delivers the highest retrieval accuracy.`,
    tags: ['ai', 'rag', 'vector-search', 'embeddings'],
    note: 'Must read before setting up our pgvector search pipeline.',
    summary: 'Explains why semantic chunking and hybrid search (BM25 + Dense Vectors) outperform naive text chunking in LLM document retrieval systems.',
    wordCount: 2100,
    readTimeMins: 10,
    createdAt: new Date(Date.now() - 3600000 * 72).toISOString(),
    isFavorite: false
  }
];

function ensureDataFile(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, JSON.stringify(INITIAL_CLIPS, null, 2), 'utf-8');
    }
  } catch (e) {
    console.error('Failed to initialize data file:', e);
  }
}

export function getAllClips(): Clip[] {
  ensureDataFile();
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    return INITIAL_CLIPS;
  }
}

export function getClipById(id: string): Clip | null {
  const clips = getAllClips();
  return clips.find(c => c.id === id) || null;
}

export function saveClip(clipData: Partial<Clip>): Clip {
  const clips = getAllClips();
  const words = clipData.content ? clipData.content.split(/\s+/).filter(Boolean).length : 0;

  const newClip: Clip = {
    id: clipData.id || `clip-${Date.now()}`,
    title: clipData.title || 'Untitled Clip',
    url: clipData.url || '',
    domain: clipData.domain || (clipData.url ? new URL(clipData.url).hostname : 'web'),
    favicon: clipData.favicon || `https://www.google.com/s2/favicons?domain=${clipData.domain || 'web'}&sz=64`,
    content: clipData.content || '',
    tags: clipData.tags || ['general'],
    note: clipData.note || '',
    summary: clipData.summary || '',
    wordCount: clipData.wordCount || words,
    readTimeMins: Math.max(1, Math.ceil(words / 200)),
    createdAt: clipData.createdAt || new Date().toISOString(),
    isFavorite: clipData.isFavorite || false
  };

  // Upsert
  const index = clips.findIndex(c => c.id === newClip.id);
  if (index >= 0) {
    clips[index] = { ...clips[index], ...newClip };
  } else {
    clips.unshift(newClip);
  }

  try {
    ensureDataFile();
    fs.writeFileSync(DATA_FILE, JSON.stringify(clips, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving clip to disk:', err);
  }

  return newClip;
}

export function deleteClip(id: string): boolean {
  const clips = getAllClips();
  const filtered = clips.filter(c => c.id !== id);
  if (filtered.length !== clips.length) {
    ensureDataFile();
    fs.writeFileSync(DATA_FILE, JSON.stringify(filtered, null, 2), 'utf-8');
    return true;
  }
  return false;
}

export function toggleFavorite(id: string): Clip | null {
  const clips = getAllClips();
  const clip = clips.find(c => c.id === id);
  if (clip) {
    clip.isFavorite = !clip.isFavorite;
    ensureDataFile();
    fs.writeFileSync(DATA_FILE, JSON.stringify(clips, null, 2), 'utf-8');
    return clip;
  }
  return null;
}

export function searchClips(query: string, tag?: string): Clip[] {
  let clips = getAllClips();

  if (tag && tag !== 'all') {
    clips = clips.filter(c => c.tags.map(t => t.toLowerCase()).includes(tag.toLowerCase()));
  }

  if (!query || !query.trim()) {
    return clips;
  }

  const q = query.toLowerCase().trim();
  return clips.filter(c => 
    c.title.toLowerCase().includes(q) ||
    c.content.toLowerCase().includes(q) ||
    (c.summary && c.summary.toLowerCase().includes(q)) ||
    (c.note && c.note.toLowerCase().includes(q)) ||
    c.tags.some(t => t.toLowerCase().includes(q))
  );
}
