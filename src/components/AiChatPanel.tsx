'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Bot, User, RefreshCw, Sparkles, X, ChevronDown, TrendingUp } from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────────
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  contextTickers?: string[];
  loading?: boolean;
}

// ─── Simple markdown renderer ──────────────────────────────────────────────────
function MarkdownText({ text }: { text: string }) {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith('## ')) {
      elements.push(<h3 key={i} className="text-sm font-bold text-slate-100 mt-3 mb-1">{line.slice(3)}</h3>);
    } else if (line.startsWith('### ')) {
      elements.push(<h4 key={i} className="text-xs font-bold text-slate-200 mt-2 mb-0.5">{line.slice(4)}</h4>);
    } else if (line.startsWith('- ') || line.startsWith('• ')) {
      elements.push(
        <div key={i} className="flex gap-2 text-sm text-slate-300 leading-relaxed">
          <span className="text-slate-500 shrink-0 mt-0.5">•</span>
          <span>{renderInline(line.slice(2))}</span>
        </div>
      );
    } else if (/^\d+\.\s/.test(line)) {
      const num = line.match(/^(\d+)\.\s/)?.[1];
      elements.push(
        <div key={i} className="flex gap-2 text-sm text-slate-300 leading-relaxed">
          <span className="text-slate-500 shrink-0 font-mono text-xs mt-0.5">{num}.</span>
          <span>{renderInline(line.replace(/^\d+\.\s/, ''))}</span>
        </div>
      );
    } else if (line.startsWith('---')) {
      elements.push(<hr key={i} className="border-slate-700 my-2" />);
    } else if (line.trim() === '') {
      elements.push(<div key={i} className="h-1.5" />);
    } else {
      elements.push(
        <p key={i} className="text-sm text-slate-300 leading-relaxed">{renderInline(line)}</p>
      );
    }
    i++;
  }
  return <div className="space-y-0.5">{elements}</div>;
}

function renderInline(text: string): React.ReactNode {
  // Bold: **text**
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="text-slate-100 font-semibold">{part.slice(2, -2)}</strong>;
    }
    // Inline code: `text`
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={i} className="bg-slate-700 px-1 rounded text-xs font-mono text-blue-300">{part.slice(1, -1)}</code>;
    }
    // Color numbers with % or VNĐ
    return <span key={i}>{part}</span>;
  });
}

// ─── Quick prompt suggestions ──────────────────────────────────────────────────
const QUICK_PROMPTS = [
  { label: 'Phân tích kỹ thuật', template: (t: string) => `Phân tích kỹ thuật ${t} cho tôi ngay lúc này` },
  { label: 'Nên mua hay bán?',   template: (t: string) => `${t} hiện tại nên mua hay bán?` },
  { label: 'Vùng support/resist', template: (t: string) => `Vùng hỗ trợ và kháng cự quan trọng của ${t}?` },
  { label: 'Xu hướng ngắn hạn',  template: (t: string) => `Xu hướng ngắn hạn của ${t} như thế nào?` },
];

const GENERAL_PROMPTS = [
  'Thị trường VN hôm nay như thế nào?',
  'Ngành nào đang dẫn dắt thị trường?',
  'Chiến lược giao dịch trong thị trường sideway?',
  'RSI quá bán có nghĩa là gì?',
];

// ─── Context badge ─────────────────────────────────────────────────────────────
function ContextBadge({ tickers }: { tickers: string[] }) {
  return (
    <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mt-1.5 flex-wrap">
      <Sparkles size={10} className="text-blue-400" />
      <span>Đã tải live data:</span>
      {tickers.map(t => (
        <span key={t} className="px-1.5 py-0.5 bg-blue-500/15 border border-blue-500/30 text-blue-300 rounded-full font-mono font-bold">{t}</span>
      ))}
    </div>
  );
}

// ─── Single message bubble ─────────────────────────────────────────────────────
function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${isUser ? 'bg-blue-500/20 border border-blue-500/30' : 'bg-emerald-500/15 border border-emerald-500/30'}`}>
        {isUser ? <User size={13} className="text-blue-300" /> : <Bot size={13} className="text-emerald-300" />}
      </div>

      {/* Content */}
      <div className={`flex flex-col max-w-[82%] ${isUser ? 'items-end' : 'items-start'}`}>
        <div className={`px-3.5 py-2.5 rounded-2xl ${isUser
          ? 'bg-blue-500/20 border border-blue-500/30 text-slate-200'
          : 'bg-slate-800/70 border border-slate-700/60'
        }`}>
          {msg.loading ? (
            <div className="flex items-center gap-2 text-slate-400 text-sm">
              <RefreshCw size={12} className="animate-spin" />
              <span>Đang phân tích...</span>
            </div>
          ) : isUser ? (
            <p className="text-sm">{msg.content}</p>
          ) : (
            <MarkdownText text={msg.content} />
          )}
        </div>
        {msg.contextTickers && msg.contextTickers.length > 0 && (
          <ContextBadge tickers={msg.contextTickers} />
        )}
      </div>
    </div>
  );
}

// ─── Main Panel ────────────────────────────────────────────────────────────────
interface Props {
  watchlistTickers: string[];
  activeTicker?: string;
}

export default function AiChatPanel({ watchlistTickers, activeTicker }: Props) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Xin chào! Tôi là AI phân tích chứng khoán với **dữ liệu thực (live)**.\n\nHỏi tôi về bất kỳ mã nào — ví dụ **"Phân tích VNM cho tôi"** — tôi sẽ tự động tải giá, RSI, MACD, tin tức mới nhất và phân tích ngay.\n\nHoặc hỏi về thị trường, chiến lược, chỉ số kỹ thuật...',
    },
  ]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [selectedTicker, setSelectedTicker] = useState(activeTicker ?? '');
  const [showSuggestions, setShowSuggestions] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Update selectedTicker when activeTicker changes
  useEffect(() => {
    if (activeTicker) setSelectedTicker(activeTicker);
  }, [activeTicker]);

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isStreaming) return;

    setShowSuggestions(false);
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: trimmed };
    const assistantId = `${Date.now()}-ai`;
    const loadingMsg: Message = { id: assistantId, role: 'assistant', content: '', loading: true };

    setMessages(prev => [...prev, userMsg, loadingMsg]);
    setInput('');
    setIsStreaming(true);

    // Build history for API (exclude welcome + loading)
    const history = [...messages.filter(m => m.id !== 'welcome'), userMsg]
      .map(m => ({ role: m.role, content: m.content }));

    try {
      abortRef.current = new AbortController();
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history, watchlistTickers }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';
      let contextTickers: string[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);
          if (data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'context') {
              contextTickers = parsed.tickers;
            } else if (parsed.type === 'token') {
              accumulated += parsed.content;
              setMessages(prev => prev.map(m =>
                m.id === assistantId
                  ? { ...m, content: accumulated, loading: false, contextTickers }
                  : m
              ));
            }
          } catch { /* skip malformed */ }
        }
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      setMessages(prev => prev.map(m =>
        m.id === assistantId
          ? { ...m, content: '⚠ Lỗi kết nối. Vui lòng thử lại.', loading: false }
          : m
      ));
    } finally {
      setIsStreaming(false);
    }
  }, [messages, isStreaming, watchlistTickers]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const clearChat = () => {
    setMessages([{
      id: 'welcome',
      role: 'assistant',
      content: 'Chat đã được xóa. Hỏi tôi về bất kỳ mã cổ phiếu nào!',
    }]);
    setShowSuggestions(true);
  };

  const stopStream = () => {
    abortRef.current?.abort();
    setIsStreaming(false);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)] min-h-[520px] max-h-[780px]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/60 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500/30 to-emerald-500/20 border border-blue-500/30 flex items-center justify-center">
            <Bot size={15} className="text-blue-300" />
          </div>
          <div>
            <div className="text-sm font-bold text-slate-100">AI Chat — Live Context</div>
            <div className="text-[10px] text-slate-500">Tự động inject giá + chỉ số kỹ thuật + tin tức</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Live indicator */}
          <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] text-emerald-400 font-medium">LIVE DATA</span>
          </div>
          <button onClick={clearChat} className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-slate-700 rounded-lg transition-colors" title="Xóa chat">
            <X size={13} />
          </button>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map(msg => <MessageBubble key={msg.id} msg={msg} />)}

        {/* Quick prompts */}
        {showSuggestions && (
          <div className="space-y-3 mt-2">
            {/* Ticker-specific prompts */}
            {(selectedTicker || watchlistTickers.length > 0) && (
              <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-3 space-y-2">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp size={11} className="text-blue-400" />
                  <span className="text-[11px] text-slate-500 font-medium">Gợi ý cho mã cụ thể</span>
                  {/* Ticker selector */}
                  <div className="ml-auto flex items-center gap-1">
                    <span className="text-[10px] text-slate-600">Mã:</span>
                    <div className="relative">
                      <select
                        value={selectedTicker}
                        onChange={e => setSelectedTicker(e.target.value)}
                        className="appearance-none bg-slate-700 border border-slate-600 text-slate-300 text-[11px] font-mono px-2 py-0.5 pr-5 rounded focus:outline-none"
                      >
                        <option value="">Chọn mã</option>
                        {watchlistTickers.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <ChevronDown size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_PROMPTS.map(({ label, template }) => (
                    <button
                      key={label}
                      onClick={() => sendMessage(template(selectedTicker || watchlistTickers[0] || 'VNM'))}
                      disabled={isStreaming}
                      className="px-2.5 py-1.5 bg-slate-700/60 hover:bg-blue-500/20 text-slate-400 hover:text-blue-300 border border-slate-600/50 hover:border-blue-500/40 rounded-lg text-[11px] transition-all disabled:opacity-40"
                    >
                      {label} {selectedTicker ? <span className="font-mono font-bold">{selectedTicker}</span> : ''}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {/* General prompts */}
            <div className="flex flex-wrap gap-1.5">
              {GENERAL_PROMPTS.map(p => (
                <button key={p} onClick={() => sendMessage(p)} disabled={isStreaming}
                  className="px-2.5 py-1.5 bg-slate-800/60 hover:bg-slate-700 text-slate-500 hover:text-slate-300 border border-slate-700/50 rounded-lg text-[11px] transition-all disabled:opacity-40">
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="shrink-0 px-4 py-3 border-t border-slate-700/60 bg-slate-900/40">
        {/* Input row */}
        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Hỏi về mã cổ phiếu, thị trường, chiến lược... (Enter để gửi, Shift+Enter xuống dòng)"
              rows={2}
              className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-600 rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/60 resize-none leading-relaxed"
              disabled={isStreaming}
            />
          </div>
          <div className="flex flex-col gap-1.5 shrink-0">
            {isStreaming ? (
              <button onClick={stopStream}
                className="p-2.5 bg-rose-500/20 text-rose-300 border border-rose-500/40 rounded-xl hover:bg-rose-500/30 transition-colors">
                <X size={16} />
              </button>
            ) : (
              <button onClick={() => sendMessage(input)} disabled={!input.trim()}
                className="p-2.5 bg-blue-500/25 text-blue-300 border border-blue-500/40 rounded-xl hover:bg-blue-500/35 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                <Send size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Hint */}
        <div className="flex items-center gap-2 mt-2">
          <Sparkles size={10} className="text-blue-400 shrink-0" />
          <p className="text-[10px] text-slate-600">
            Nhắc đến mã (VD: <span className="text-slate-500 font-mono">VNM, FPT, HPG</span>) → AI tự động tải giá + chỉ số kỹ thuật + tin tức realtime
          </p>
        </div>
      </div>
    </div>
  );
}
