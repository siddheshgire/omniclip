'use client';

import React, { useState, useEffect } from 'react';
import { 
  Bookmark, 
  Search, 
  Sparkles, 
  Plus, 
  ExternalLink, 
  Trash2, 
  Star, 
  Clock, 
  BookOpen, 
  Share2, 
  Tag, 
  Sliders, 
  MessageSquare, 
  Puzzle, 
  Check, 
  Copy, 
  X,
  FileText,
  Compass,
  Zap,
  TrendingUp,
  Brain,
  Download
} from 'lucide-react';
import { Clip } from '@/lib/db';
import FormattedMessage from '@/components/FormattedMessage';

export default function Dashboard() {
  const [clips, setClips] = useState<Clip[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'favorites'>('all');
  const [activeTag, setActiveTag] = useState<string>('all');
  
  // Modals & Drawers
  const [selectedClip, setSelectedClip] = useState<Clip | null>(null);
  const [isBrainDrawerOpen, setIsBrainDrawerOpen] = useState(false);
  const [isPairModalOpen, setIsPairModalOpen] = useState(false);
  const [isNewClipModalOpen, setIsNewClipModalOpen] = useState(false);
  
  // Toast notifications
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Chat with Second Brain
  const [brainMessages, setBrainMessages] = useState<{ role: string; content: string }[]>([
    { role: 'assistant', content: 'Welcome to your Second Brain! I can search and synthesize answers across all your clipped articles, papers, and notes. Ask me anything.' }
  ]);
  const [brainInput, setBrainInput] = useState('');
  const [brainLoading, setBrainLoading] = useState(false);

  // New clip form state
  const [newTitle, setNewTitle] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newTags, setNewTags] = useState('research, article');
  const [creatingClip, setCreatingClip] = useState(false);

  // Fetch clips from API
  const fetchClips = async () => {
    try {
      setLoading(true);
      const url = new URL('/api/clips', window.location.origin);
      if (searchQuery) url.searchParams.set('q', searchQuery);
      if (activeTag !== 'all') url.searchParams.set('tag', activeTag);

      const res = await fetch(url.toString());
      const data = await res.json();
      if (data.success) {
        setClips(data.clips);
      }
    } catch (e) {
      console.error('Failed to load clips:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClips();
  }, [searchQuery, activeTag]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // Toggle favorite
  const handleToggleFavorite = async (clipId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/clips/${clipId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggleFavorite' })
      });
      if (res.ok) {
        setClips(clips.map(c => c.id === clipId ? { ...c, isFavorite: !c.isFavorite } : c));
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Delete clip
  const handleDeleteClip = async (clipId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this clip?')) return;
    try {
      const res = await fetch(`/api/clips/${clipId}`, { method: 'DELETE' });
      if (res.ok) {
        setClips(clips.filter(c => c.id !== clipId));
        if (selectedClip?.id === clipId) setSelectedClip(null);
        showToast('Clip removed from Second Brain');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Copy Markdown
  const handleCopyMarkdown = (clip: Clip, e: React.MouseEvent) => {
    e.stopPropagation();
    const md = `# ${clip.title}\nSource: ${clip.url}\n\n${clip.summary ? `> **Summary:** ${clip.summary}\n\n` : ''}${clip.content}`;
    navigator.clipboard.writeText(md);
    showToast('Copied Markdown to clipboard!');
  };

  // Export to Obsidian (.md)
  const handleExportObsidian = (clip: Clip) => {
    const frontmatter = `---
title: "${clip.title.replace(/"/g, '\\"')}"
source: "${clip.url}"
domain: "${clip.domain}"
tags: [${clip.tags.map(t => `"${t}"`).join(', ')}]
created_at: "${clip.createdAt}"
read_time: "${clip.readTimeMins || 2}m"
---

# ${clip.title}

${clip.summary ? `> [!NOTE] AI Summary\n> ${clip.summary}\n\n` : ''}
${clip.note ? `### Personal Notes\n${clip.note}\n\n` : ''}
---

${clip.content}
`;

    const blob = new Blob([frontmatter], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${clip.title.slice(0, 40).replace(/[^a-zA-Z0-9_-]/g, '_')}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('Exported Markdown file for Obsidian!');
  };

  // Send query to Second Brain (RAG) with real-time SSE streaming
  const handleSendBrainChat = async () => {
    if (!brainInput.trim() || brainLoading) return;
    const userText = brainInput.trim();
    setBrainInput('');

    const newMsgs = [...brainMessages, { role: 'user', content: userText }];
    setBrainMessages([...newMsgs, { role: 'assistant', content: '' }]);
    setBrainLoading(true);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMsgs,
          queryAllBrain: true,
          stream: true
        })
      });

      if (!res.ok) throw new Error('API error: ' + res.status);

      if (res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let accumulated = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const textChunk = decoder.decode(value, { stream: true });
          const lines = textChunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const dataStr = line.replace('data: ', '').trim();
              if (dataStr === '[DONE]') break;
              try {
                const parsed = JSON.parse(dataStr);
                if (parsed.text) {
                  accumulated += parsed.text;
                  setBrainMessages([...newMsgs, { role: 'assistant', content: accumulated }]);
                }
              } catch (e) {}
            }
          }
        }
      }
    } catch (err: any) {
      setBrainMessages(prev => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last && last.role === 'assistant' && !last.content) {
          last.content = 'Connection error. Check API configuration or try again.';
        }
        return updated;
      });
    } finally {
      setBrainLoading(false);
    }
  };

  // Handle manual clip creation
  const handleCreateClip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) return;

    setCreatingClip(true);
    try {
      const res = await fetch('/api/clips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle,
          url: newUrl || 'https://omniclip.local/manual',
          content: newContent,
          tags: newTags.split(',').map(t => t.trim()).filter(Boolean)
        })
      });
      if (res.ok) {
        await fetchClips();
        setIsNewClipModalOpen(false);
        setNewTitle('');
        setNewUrl('');
        setNewContent('');
        showToast('Clip saved to your Second Brain!');
      }
    } catch (e) {
      alert('Error creating clip');
    } finally {
      setCreatingClip(false);
    }
  };

  // Extract all unique tags
  const allTags = Array.from(new Set(clips.flatMap(c => c.tags || [])));
  const displayedClips = clips.filter(c => {
    if (activeFilter === 'favorites') return c.isFavorite;
    return true;
  });

  return (
    <div className="flex h-screen overflow-hidden bg-[#090a0f] text-gray-200">
      
      {/* SIDEBAR */}
      <aside className="w-64 border-r border-[#1e2230] bg-[#0c0d14] flex flex-col justify-between shrink-0">
        <div>
          {/* Brand Logo */}
          <div className="p-5 flex items-center justify-between border-b border-[#1e2230]">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <Bookmark className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-base tracking-tight text-white flex items-center gap-1.5">
                  OmniClip
                  <span className="text-[10px] uppercase font-semibold tracking-wider bg-indigo-500/20 text-indigo-400 px-1.5 py-0.5 rounded border border-indigo-500/30">v1.0</span>
                </h1>
                <p className="text-xs text-gray-400">AI Second Brain</p>
              </div>
            </div>
          </div>

          {/* Quick Nav */}
          <div className="p-3 space-y-1">
            <button
              onClick={() => { setActiveFilter('all'); setActiveTag('all'); }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition ${
                activeFilter === 'all' && activeTag === 'all'
                  ? 'bg-indigo-600/15 text-indigo-400 border border-indigo-500/20'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/40'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <BookOpen className="w-4 h-4" />
                <span>All Clips</span>
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-800/60 text-gray-400">{clips.length}</span>
            </button>

            <button
              onClick={() => setActiveFilter('favorites')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition ${
                activeFilter === 'favorites'
                  ? 'bg-indigo-600/15 text-indigo-400 border border-indigo-500/20'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/40'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Star className="w-4 h-4" />
                <span>Starred</span>
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-800/60 text-gray-400">
                {clips.filter(c => c.isFavorite).length}
              </span>
            </button>
          </div>

          {/* Tag Filter Section */}
          <div className="px-4 py-3 border-t border-[#1e2230]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Tags</span>
              <span className="text-[11px] text-gray-400">{allTags.length}</span>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto pr-1">
              <button
                onClick={() => setActiveTag('all')}
                className={`text-xs px-2 py-1 rounded-md transition ${
                  activeTag === 'all'
                    ? 'bg-indigo-500 text-white font-medium'
                    : 'bg-[#181b26] text-gray-400 hover:text-gray-200'
                }`}
              >
                #all
              </button>
              {allTags.map(tag => (
                <button
                  key={tag}
                  onClick={() => setActiveTag(tag)}
                  className={`text-xs px-2 py-1 rounded-md transition ${
                    activeTag === tag
                      ? 'bg-indigo-500 text-white font-medium'
                      : 'bg-[#181b26] text-gray-400 hover:text-gray-200'
                  }`}
                >
                  #{tag}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar Footer Stats & Companion Link */}
        <div className="p-3 border-t border-[#1e2230] space-y-2">
          <div className="p-3 rounded-xl bg-[#141722] border border-[#232734] space-y-1">
            <div className="flex items-center gap-2 text-indigo-400 text-xs font-semibold">
              <Zap className="w-3.5 h-3.5" />
              <span>Browser Extension</span>
            </div>
            <p className="text-[11px] text-gray-400 leading-tight">
              Clip pages with 1-click using the Chrome companion extension.
            </p>
            <button
              onClick={() => setIsPairModalOpen(true)}
              className="mt-2 w-full py-1.5 px-2.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 text-xs font-medium border border-indigo-500/30 flex items-center justify-center gap-1.5 transition"
            >
              <Puzzle className="w-3.5 h-3.5" />
              <span>Pair Extension</span>
            </button>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#090a0f]">
        
        {/* TOP BAR */}
        <header className="h-16 border-b border-[#1e2230] px-6 flex items-center justify-between shrink-0 bg-[#0c0d14]/70 backdrop-blur-md">
          {/* Search Input */}
          <div className="relative w-96">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search concepts, tags, articles (Semantic search)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#141722] border border-[#232734] focus:border-indigo-500 rounded-xl pl-9 pr-12 py-2 text-sm text-gray-200 placeholder-gray-400 focus:outline-none transition"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono text-gray-400 bg-gray-800/80 px-1.5 py-0.5 rounded border border-gray-700">
              ⌘K
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsBrainDrawerOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white text-sm font-semibold shadow-md shadow-indigo-600/25 hover:opacity-95 transition"
            >
              <Brain className="w-4 h-4" />
              <span>Ask Second Brain</span>
            </button>

            <button
              onClick={() => setIsNewClipModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#181b26] hover:bg-[#202534] border border-[#262b3a] text-gray-200 text-sm font-medium transition"
            >
              <Plus className="w-4 h-4" />
              <span>New Clip</span>
            </button>
          </div>
        </header>

        {/* FEED / CLIPS GRID */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-6xl mx-auto space-y-6">
            
            {/* Active Filter Bar */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight">
                  {activeFilter === 'favorites' ? 'Starred Articles' : activeTag !== 'all' ? `Tagged #${activeTag}` : 'Saved Knowledge Base'}
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  Showing {displayedClips.length} {displayedClips.length === 1 ? 'item' : 'items'} in your neural index
                </p>
              </div>

              {/* Stats badges */}
              <div className="flex items-center gap-3 text-xs text-gray-400">
                <span className="flex items-center gap-1.5 bg-[#141722] border border-[#232734] px-3 py-1.5 rounded-lg">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{clips.reduce((acc, c) => acc + (c.wordCount || 0), 0).toLocaleString()} words saved</span>
                </span>
                <span className="flex items-center gap-1.5 bg-[#141722] border border-[#232734] px-3 py-1.5 rounded-lg">
                  <Clock className="w-3.5 h-3.5 text-indigo-400" />
                  <span>~{Math.round(clips.reduce((acc, c) => acc + (c.readTimeMins || 1), 0) * 0.7)} mins saved via AI</span>
                </span>
              </div>
            </div>

            {/* Clips Grid */}
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-48 rounded-2xl bg-[#141722] border border-[#232734] animate-pulse" />
                ))}
              </div>
            ) : displayedClips.length === 0 ? (
              <div className="text-center py-20 border border-dashed border-[#232734] rounded-2xl bg-[#0c0d14]/40">
                <Compass className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                <h3 className="text-base font-semibold text-gray-300">No clips found</h3>
                <p className="text-xs text-gray-400 max-w-sm mx-auto mt-1">
                  Use the OmniClip companion extension to clip articles from the web or click "+ New Clip" above.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {displayedClips.map((clip) => (
                  <div
                    key={clip.id}
                    onClick={() => setSelectedClip(clip)}
                    className="group relative flex flex-col justify-between p-5 rounded-2xl bg-[#11131c] hover:bg-[#151824] border border-[#202434] hover:border-indigo-500/40 transition-all duration-200 shadow-sm cursor-pointer"
                  >
                    <div>
                      {/* Top metadata */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <img
                            src={clip.favicon || `https://www.google.com/s2/favicons?domain=${clip.domain}&sz=64`}
                            alt=""
                            className="w-4 h-4 rounded"
                            onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                          />
                          <span className="text-xs font-medium text-gray-400">{clip.domain}</span>
                        </div>
                        
                        <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition">
                          <button
                            onClick={(e) => handleToggleFavorite(clip.id, e)}
                            className="p-1 rounded-md text-gray-400 hover:text-amber-400 hover:bg-gray-800"
                            title="Favorite"
                          >
                            <Star className={`w-3.5 h-3.5 ${clip.isFavorite ? 'fill-amber-400 text-amber-400' : ''}`} />
                          </button>
                          <button
                            onClick={(e) => handleCopyMarkdown(clip, e)}
                            className="p-1 rounded-md text-gray-400 hover:text-indigo-400 hover:bg-gray-800"
                            title="Copy Markdown"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => handleDeleteClip(clip.id, e)}
                            className="p-1 rounded-md text-gray-400 hover:text-rose-400 hover:bg-gray-800"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Title */}
                      <h3 className="font-semibold text-gray-100 text-base leading-snug line-clamp-2 group-hover:text-indigo-300 transition-colors">
                        {clip.title}
                      </h3>

                      {/* AI Executive Summary or Excerpt */}
                      <p className="text-xs text-gray-400 mt-2 line-clamp-3 leading-relaxed">
                        {clip.summary || clip.content.replace(/#+\s+/g, '').slice(0, 160)}
                      </p>
                    </div>

                    {/* Footer */}
                    <div className="mt-4 pt-3 border-t border-[#1e2230] flex items-center justify-between text-xs">
                      <div className="flex flex-wrap gap-1">
                        {clip.tags.slice(0, 2).map(tag => (
                          <span key={tag} className="px-2 py-0.5 rounded-md bg-[#191d2a] text-gray-400 font-mono text-[11px]">
                            #{tag}
                          </span>
                        ))}
                      </div>
                      <span className="text-gray-400 text-[11px]">
                        {clip.readTimeMins || 2}m read
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* READER MODE MODAL */}
      {selectedClip && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-3xl h-[85vh] bg-[#0d0e15] border border-[#252a3a] rounded-2xl flex flex-col overflow-hidden shadow-2xl">
            {/* Reader Header */}
            <div className="p-4 border-b border-[#1f2433] flex items-center justify-between bg-[#11131c]">
              <div className="flex items-center gap-3">
                <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-400 text-xs font-semibold">
                  Distraction-Free Reader
                </span>
                <a
                  href={selectedClip.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-indigo-300 transition"
                >
                  <span>{selectedClip.domain}</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => handleCopyMarkdown(selectedClip, e)}
                  className="px-2.5 py-1.5 rounded-lg bg-[#1a1e2b] hover:bg-[#232839] text-xs font-medium text-gray-300 flex items-center gap-1.5 transition"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Markdown</span>
                </button>
                <button
                  onClick={() => handleExportObsidian(selectedClip)}
                  className="px-2.5 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-xs font-medium text-indigo-300 border border-indigo-500/30 flex items-center gap-1.5 transition"
                  title="Download formatted .md file with frontmatter for Obsidian / Notion"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export to Obsidian</span>
                </button>
                <button
                  onClick={() => setSelectedClip(null)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Reader Body */}
            <div className="flex-1 overflow-y-auto p-8 max-w-2xl mx-auto w-full">
              <h1 className="text-2xl font-bold text-white mb-2 leading-tight">
                {selectedClip.title}
              </h1>

              <div className="flex items-center gap-3 text-xs text-gray-400 pb-6 mb-6 border-b border-[#1e2333]">
                <span>Saved on {new Date(selectedClip.createdAt).toLocaleDateString()}</span>
                <span>•</span>
                <span>{selectedClip.wordCount || 500} words</span>
                <span>•</span>
                <span>{selectedClip.readTimeMins || 3} min read</span>
              </div>

              {/* AI Summary Highlight */}
              {selectedClip.summary && (
                <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-950/40 via-purple-950/30 to-transparent border border-indigo-500/30 mb-8">
                  <div className="flex items-center gap-2 text-indigo-400 font-semibold text-xs uppercase tracking-wider mb-2">
                    <Sparkles className="w-4 h-4" />
                    <span>AI Executive Summary</span>
                  </div>
                  <p className="text-sm text-gray-300 leading-relaxed">
                    {selectedClip.summary}
                  </p>
                </div>
              )}

              {/* Content Markdown Body */}
              <div className="prose-dark whitespace-pre-wrap text-sm leading-relaxed">
                {selectedClip.content}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ASK SECOND BRAIN DRAWER (RAG CHAT) */}
      {isBrainDrawerOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex justify-end">
          <div className="w-full max-w-md h-full bg-[#0d0e15] border-l border-[#252a3a] flex flex-col shadow-2xl">
            {/* Drawer Header */}
            <div className="p-4 border-b border-[#1f2433] flex items-center justify-between bg-[#11131c]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-600 to-pink-600 flex items-center justify-center">
                  <Brain className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-white">Ask Second Brain</h3>
                  <p className="text-[11px] text-gray-400">RAG multi-document synthesis</p>
                </div>
              </div>
              <button
                onClick={() => setIsBrainDrawerOpen(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Chat History */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {brainMessages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[88%] p-3.5 rounded-2xl text-xs leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-indigo-600 text-white rounded-tr-xs font-medium'
                        : 'bg-[#151824] text-gray-200 border border-[#262c3e] rounded-tl-xs shadow-md'
                    }`}
                  >
                    {msg.role === 'user' ? (
                      <p>{msg.content}</p>
                    ) : (
                      <FormattedMessage content={msg.content} />
                    )}
                  </div>
                </div>
              ))}
              {brainLoading && (
                <div className="flex items-center gap-2 text-xs text-indigo-400 p-2">
                  <Sparkles className="w-4 h-4 animate-spin" />
                  <span>Scanning vector index & synthesizing...</span>
                </div>
              )}
            </div>

            {/* Drawer Input */}
            <div className="p-3 border-t border-[#1f2433] bg-[#11131c]">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Ask across all your saved clips..."
                  value={brainInput}
                  onChange={(e) => setBrainInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSendBrainChat(); }}
                  className="flex-1 bg-[#181b26] border border-[#232736] rounded-xl px-3 py-2 text-xs text-gray-200 placeholder-gray-400 focus:outline-none focus:border-indigo-500"
                />
                <button
                  onClick={handleSendBrainChat}
                  disabled={brainLoading}
                  className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition"
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PAIR EXTENSION MODAL */}
      {isPairModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#0d0e15] border border-[#252a3a] rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-[#1f2433]">
              <div className="flex items-center gap-2.5">
                <Puzzle className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-base text-white">Pair OmniClip Companion Extension</h3>
              </div>
              <button onClick={() => setIsPairModalOpen(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-4 text-xs text-gray-300">
              <div className="p-3 rounded-xl bg-[#141722] border border-[#232734] space-y-2">
                <span className="font-semibold text-white block">Step 1: Open Chrome Extensions</span>
                <p className="text-gray-400">
                  Navigate to <code className="bg-black/50 px-1 py-0.5 rounded text-indigo-300">chrome://extensions</code> and enable <strong>Developer mode</strong> (toggle in top-right).
                </p>
              </div>

              <div className="p-3 rounded-xl bg-[#141722] border border-[#232734] space-y-2">
                <span className="font-semibold text-white block">Step 2: Load Unpacked</span>
                <p className="text-gray-400">
                  Click <strong>Load unpacked</strong> and select the directory:
                </p>
                <div className="p-2 rounded bg-black/60 font-mono text-[11px] text-gray-300 break-all select-all">
                  C:\Users\siddharth\.gemini\antigravity-ide\scratch\omniclip\extension
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[#141722] border border-[#232734] space-y-2">
                <span className="font-semibold text-white block">Step 3: Connect to Cloud API</span>
                <p className="text-gray-400">
                  The extension automatically syncs with this dashboard at <code className="bg-black/50 px-1 py-0.5 rounded text-indigo-300">{typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'}</code>.
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsPairModalOpen(false)}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-semibold text-xs text-white transition"
            >
              Done & Connected
            </button>
          </div>
        </div>
      )}

      {/* NEW CLIP MODAL */}
      {isNewClipModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#0d0e15] border border-[#252a3a] rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-[#1f2433]">
              <h3 className="font-bold text-base text-white">Add New Clip</h3>
              <button onClick={() => setIsNewClipModalOpen(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateClip} className="py-4 space-y-3 text-xs">
              <div>
                <label className="block text-gray-400 font-medium mb-1">Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Designing Event-Driven Architectures"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-[#141722] border border-[#232734] rounded-xl px-3 py-2 text-gray-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-gray-400 font-medium mb-1">Source URL (Optional)</label>
                <input
                  type="url"
                  placeholder="https://example.com/article"
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  className="w-full bg-[#141722] border border-[#232734] rounded-xl px-3 py-2 text-gray-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-gray-400 font-medium mb-1">Tags (comma separated)</label>
                <input
                  type="text"
                  placeholder="architecture, backend, kafka"
                  value={newTags}
                  onChange={(e) => setNewTags(e.target.value)}
                  className="w-full bg-[#141722] border border-[#232734] rounded-xl px-3 py-2 text-gray-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-gray-400 font-medium mb-1">Content (Markdown supported)</label>
                <textarea
                  rows={5}
                  required
                  placeholder="Paste article body or note text..."
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  className="w-full bg-[#141722] border border-[#232734] rounded-xl px-3 py-2 text-gray-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <button
                type="submit"
                disabled={creatingClip}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition"
              >
                {creatingClip ? 'Processing & Saving...' : 'Save to Brain'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* FLOATING TOAST */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#181a24] text-white px-4 py-2.5 rounded-xl border border-indigo-500/40 shadow-xl flex items-center gap-2 text-xs font-medium animate-bounce">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

    </div>
  );
}
