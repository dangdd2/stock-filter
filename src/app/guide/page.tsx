"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { Activity, Search, X, ChevronRight, BookOpen, ArrowLeft, Menu } from 'lucide-react';
import { GUIDE_SECTIONS } from '@/components/guide/guideData';
import { BlockRenderer } from '@/components/guide/GuideBlocks';

export default function GuidePage() {
  const [activeId,    setActiveId]    = useState('quickstart-intro');
  const [searchQuery, setSearchQuery] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // ── Scroll spy ───────────────────────────────────────────
  useEffect(() => {
    observerRef.current?.disconnect();
    const ids: string[] = [];
    GUIDE_SECTIONS.forEach(s => s.subsections.forEach(sub => ids.push(sub.id)));

    const obs = new IntersectionObserver(
      entries => {
        const visible = entries
          .filter(e => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveId(visible[0].target.id);
      },
      { rootMargin: '-20% 0px -70% 0px', threshold: 0 },
    );
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) obs.observe(el);
    });
    observerRef.current = obs;
    return () => obs.disconnect();
  }, []);

  const scrollTo = useCallback((id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setSidebarOpen(false);
  }, []);

  // ── Search filter ────────────────────────────────────────
  const q = searchQuery.toLowerCase().trim();
  const filteredSections = q
    ? GUIDE_SECTIONS.map(s => ({
        ...s,
        subsections: s.subsections.filter(
          sub => sub.title.toLowerCase().includes(q) ||
            sub.content.some(b => {
              if (b.type === 'paragraph') return b.text.toLowerCase().includes(q);
              if (b.type === 'table') return b.rows.some(r => r.some(c => c.toLowerCase().includes(q)));
              return false;
            }),
        ),
      })).filter(s => s.subsections.length > 0)
    : GUIDE_SECTIONS;

  // ── Sidebar ──────────────────────────────────────────────
  const Sidebar = () => (
    <nav className="flex flex-col h-full">
      {/* Search */}
      <div className="p-4 border-b border-slate-700">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Tìm kiếm..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-8 pr-8 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Nav links */}
      <div className="flex-1 overflow-y-auto py-3 px-2">
        {filteredSections.map(section => (
          <div key={section.id} className="mb-1">
            {/* Section header */}
            <div className="flex items-center gap-2 px-3 py-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-widest">
              <span>{section.emoji}</span>
              <span>{section.title}</span>
            </div>
            {/* Subsections */}
            {section.subsections.map(sub => {
              const isActive = activeId === sub.id;
              return (
                <button
                  key={sub.id}
                  onClick={() => scrollTo(sub.id)}
                  className={`w-full text-left flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors ${
                    isActive
                      ? 'bg-blue-500/15 text-blue-300 font-semibold'
                      : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-200'
                  }`}
                >
                  {isActive && <ChevronRight size={11} className="text-blue-400 shrink-0" />}
                  {!isActive && <span className="w-[11px] shrink-0" />}
                  {sub.title}
                </button>
              );
            })}
          </div>
        ))}
        {filteredSections.length === 0 && (
          <p className="text-center text-slate-600 text-xs py-8">Không tìm thấy kết quả</p>
        )}
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans">

      {/* ── Top nav ── */}
      <header className="bg-slate-800 border-b border-slate-700 sticky top-0 z-30 flex items-center gap-4 px-6 py-3 shadow-md">
        {/* Mobile hamburger */}
        <button
          onClick={() => setSidebarOpen(v => !v)}
          className="lg:hidden p-1.5 text-slate-400 hover:text-slate-200 transition-colors"
        >
          <Menu size={20} />
        </button>

        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <div className="p-1.5 bg-blue-500/20 text-blue-400 rounded-lg">
            <Activity size={20} />
          </div>
          <div>
            <span className="font-bold text-base bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">Stock AI</span>
            <span className="text-slate-500 text-xs ml-2">/ Hướng dẫn</span>
          </div>
        </Link>

        <Link href="/" className="ml-auto flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors">
          <ArrowLeft size={13} /> Về ứng dụng
        </Link>
      </header>

      <div className="flex relative">

        {/* ── Sidebar desktop ── */}
        <aside className="hidden lg:flex flex-col w-64 shrink-0 sticky top-[57px] h-[calc(100vh-57px)] bg-slate-800/60 border-r border-slate-700 overflow-hidden">
          <Sidebar />
        </aside>

        {/* ── Sidebar mobile overlay ── */}
        {sidebarOpen && (
          <div className="lg:hidden fixed inset-0 z-40 flex">
            <div className="w-72 bg-slate-800 border-r border-slate-700 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
                <span className="font-semibold text-sm flex items-center gap-2">
                  <BookOpen size={14} className="text-blue-400" /> Nội dung
                </span>
                <button onClick={() => setSidebarOpen(false)} className="text-slate-500 hover:text-slate-200">
                  <X size={18} />
                </button>
              </div>
              <div className="flex-1 overflow-hidden"><Sidebar /></div>
            </div>
            <div className="flex-1 bg-black/40" onClick={() => setSidebarOpen(false)} />
          </div>
        )}

        {/* ── Main content ── */}
        <main ref={contentRef} className="flex-1 min-w-0 px-6 lg:px-12 py-10 max-w-4xl">

          {/* Hero */}
          <div className="mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-full text-xs text-blue-400 font-medium mb-4">
              <BookOpen size={12} /> Hướng dẫn sử dụng
            </div>
            <h1 className="text-3xl font-extrabold text-slate-100 mb-3 leading-tight">
              Hướng dẫn sử dụng<br />
              <span className="bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">Stock AI</span>
            </h1>
            <p className="text-slate-400 text-base leading-relaxed max-w-xl">
              Công cụ phân tích kỹ thuật chứng khoán Việt Nam — từ cơ bản đến nâng cao.
              Học cách sử dụng watchlist, đọc tín hiệu, chạy screener, và khai thác AI Analysis hiệu quả nhất.
            </p>

            {/* Quick links */}
            <div className="flex flex-wrap gap-2 mt-6">
              {GUIDE_SECTIONS.map(s => (
                <button
                  key={s.id}
                  onClick={() => scrollTo(s.subsections[0].id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-full text-xs text-slate-300 hover:bg-slate-700 hover:border-slate-600 transition-colors"
                >
                  <span>{s.emoji}</span> {s.title}
                </button>
              ))}
            </div>
          </div>

          {/* Sections */}
          {(searchQuery ? filteredSections : GUIDE_SECTIONS).map(section => (
            <div key={section.id} className="mb-16">
              {/* Section title */}
              <div className="flex items-center gap-3 mb-8 pb-3 border-b border-slate-700">
                <span className="text-3xl">{section.emoji}</span>
                <h2 className="text-xl font-bold text-slate-100">{section.title}</h2>
              </div>

              {/* Subsections */}
              {section.subsections.map(sub => (
                <div key={sub.id} id={sub.id} className="mb-10 scroll-mt-24">
                  <h3 className="text-base font-bold text-slate-200 mb-4 flex items-center gap-2">
                    <span className="w-1 h-5 bg-blue-500 rounded-full shrink-0" />
                    {sub.title}
                  </h3>
                  <div className="pl-3">
                    {sub.content.map((block, i) => (
                      <BlockRenderer key={i} block={block} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}

          {/* Footer */}
          <div className="border-t border-slate-700 pt-8 mt-8 text-center">
            <p className="text-slate-500 text-sm mb-4">Còn câu hỏi? Dùng AI Analysis trong app để được tư vấn theo từng cổ phiếu cụ thể.</p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-500 hover:to-emerald-500 text-white text-sm font-semibold rounded-xl transition-all shadow-lg"
            >
              <Activity size={15} /> Mở Stock AI
            </Link>
          </div>
        </main>
      </div>
    </div>
  );
}
