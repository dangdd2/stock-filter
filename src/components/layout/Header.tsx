import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Activity, BarChart2, MessageSquare, PieChart, UserSearch, Columns2,
  SlidersHorizontal, Map as MapIcon, Bell, Waves, Layers, GitFork,
  LayoutGrid, History, MoreVertical, ChevronDown, HelpCircle, Newspaper,
} from 'lucide-react';

export type ActiveTab =
  | 'watchlist' | 'history' | 'heatmap' | 'screener' | 'alerts' | 'multicharts'
  | 'patterns' | 'mtf' | 'correlation' | 'compare' | 'sector' | 'aichat'
  | 'insider' | 'smartmoney' | 'earnings' | 'news';

interface Props {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  unreadAlerts: number;
  signalHistoryCount: number;
}

export default function Header({ activeTab, setActiveTab, unreadAlerts, signalHistoryCount }: Props) {
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!moreMenuOpen) return;
    const onClickOutside = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setMoreMenuOpen(false);
      }
    };
    const onEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') setMoreMenuOpen(false); };
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onEscape);
    };
  }, [moreMenuOpen]);

  const primaryTabs = [
    { id: 'watchlist'   as ActiveTab, label: 'Watchlist',  icon: <BarChart2 size={13}/>,      cls: 'blue'    },
    { id: 'news'       as ActiveTab, label: 'Tin Tức',   icon: <Newspaper size={13}/>,    cls: 'blue'    },
    { id: 'aichat'     as ActiveTab, label: 'AI Chat',   icon: <MessageSquare size={13}/>, cls: 'emerald' },
    { id: 'sector'      as ActiveTab, label: 'Ngành',      icon: <PieChart size={13}/>,       cls: 'orange'  },
    { id: 'insider'     as ActiveTab, label: 'Insider',    icon: <UserSearch size={13}/>,     cls: 'rose'    },
    { id: 'earnings'    as ActiveTab, label: 'Earnings',   icon: <BarChart2 size={13}/>,      cls: 'teal'    },
    { id: 'compare'     as ActiveTab, label: 'So sánh',    icon: <Columns2 size={13}/>,       cls: 'sky'     },
    { id: 'screener'    as ActiveTab, label: 'Screener',   icon: <SlidersHorizontal size={13}/>, cls: 'amber' },
    { id: 'heatmap'     as ActiveTab, label: 'Heatmap',    icon: <MapIcon size={13}/>,        cls: 'emerald' },
    { id: 'alerts'      as ActiveTab, label: 'Alerts',     icon: <Bell size={13}/>,           cls: 'amber',  badge: unreadAlerts || undefined },
  ];

  const moreTabs = [
    { id: 'smartmoney'  as ActiveTab, label: 'Smart Money', icon: <Waves size={13}/>,            cls: 'cyan'    },
    { id: 'mtf'         as ActiveTab, label: 'MTF',          icon: <Layers size={13}/>,            cls: 'indigo'  },
    { id: 'correlation' as ActiveTab, label: 'Correlation',  icon: <GitFork size={13}/>,           cls: 'teal'    },
    { id: 'multicharts' as ActiveTab, label: 'Multi Chart',  icon: <LayoutGrid size={13}/>,        cls: 'cyan'    },
    { id: 'patterns'    as ActiveTab, label: 'Patterns',     icon: <SlidersHorizontal size={13}/>, cls: 'violet'  },
    { id: 'history'     as ActiveTab, label: 'Lịch sử',      icon: <History size={13}/>,           cls: 'violet', badge: signalHistoryCount },
  ];
  const activeInMore = moreTabs.find(t => t.id === activeTab);

  return (
    <header className="bg-slate-800 border-b border-slate-700 py-4 px-6 sticky top-0 z-10 flex justify-between items-center shadow-md">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-500/20 text-blue-400 rounded-lg"><Activity size={24}/></div>
        <div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">Stock AI</h1>
          <p className="text-xs text-slate-400">Custom Watchlists & Technical Indicators</p>
        </div>
      </div>
      <div className="flex items-center gap-1 flex-wrap">
        {primaryTabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors whitespace-nowrap border ${
              activeTab === tab.id
                ? `bg-${tab.cls}-500/20 text-${tab.cls}-300 border-${tab.cls}-500/30 font-semibold`
                : 'text-slate-400 hover:bg-slate-700 border-transparent'
            }`}>
            {tab.icon} {tab.label}
            {tab.badge ? <span className={`px-1.5 py-0.5 bg-${tab.cls}-500/30 text-${tab.cls}-300 rounded-full text-[10px] font-bold leading-none`}>{tab.badge}</span> : null}
          </button>
        ))}

        <div className="relative" ref={moreMenuRef}>
          <button
            onClick={() => setMoreMenuOpen(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors whitespace-nowrap border ${
              activeInMore
                ? `bg-${activeInMore.cls}-500/20 text-${activeInMore.cls}-300 border-${activeInMore.cls}-500/30 font-semibold`
                : moreMenuOpen
                  ? 'text-slate-200 bg-slate-700 border-slate-600'
                  : 'text-slate-400 hover:bg-slate-700 border-transparent'
            }`}
          >
            {activeInMore ? <>{activeInMore.icon} {activeInMore.label}</> : <><MoreVertical size={13}/> Thêm</>}
            <ChevronDown size={11} className={`transition-transform ${moreMenuOpen ? 'rotate-180' : ''}`} />
          </button>
          {moreMenuOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-48 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 py-1.5">
              {moreTabs.map(tab => (
                <button key={tab.id} onClick={() => { setActiveTab(tab.id); setMoreMenuOpen(false); }}
                  className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs transition-colors ${
                    activeTab === tab.id
                      ? `bg-${tab.cls}-500/20 text-${tab.cls}-300 font-semibold`
                      : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  }`}>
                  {tab.icon} {tab.label}
                  {tab.badge ? <span className="ml-auto px-1.5 py-0.5 bg-slate-700 text-slate-300 rounded-full text-[10px] font-bold">{tab.badge}</span> : null}
                </button>
              ))}
            </div>
          )}
        </div>

        <Link href="/guide" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-slate-500 hover:bg-slate-700 hover:text-slate-300 transition-colors border border-transparent whitespace-nowrap">
          <HelpCircle size={13}/> Guide
        </Link>
      </div>
    </header>
  );
}
