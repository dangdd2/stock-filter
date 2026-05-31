"use client";

import { X, GripVertical, Trash2, Save } from 'lucide-react';
import { type Watchlist, MASTER_ID } from '@/types';

interface Props {
  show: boolean;
  manageWatchlists: Watchlist[];
  setManageWatchlists: (v: Watchlist[]) => void;
  activeWatchlistId: string;
  setActiveWatchlistId: (id: string) => void;
  renamingId: string | null;
  setRenamingId: (id: string | null) => void;
  renamingValue: string;
  setRenamingValue: (v: string) => void;
  dragIndex: number | null;
  dragOverIndex: number | null;
  commitRename: () => void;
  saveManageModal: () => void;
  handleModalDragStart: (i: number) => void;
  handleModalDragOver: (e: React.DragEvent, i: number) => void;
  handleModalDrop: (i: number) => void;
  handleModalDragEnd: () => void;
}

export default function ManageModal({
  show, manageWatchlists, setManageWatchlists,
  activeWatchlistId, setActiveWatchlistId,
  renamingId, setRenamingId, renamingValue, setRenamingValue,
  dragIndex, dragOverIndex,
  commitRename, saveManageModal,
  handleModalDragStart, handleModalDragOver, handleModalDrop, handleModalDragEnd,
}: Props) {
  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) saveManageModal(); }}
    >
      <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md mx-4 flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700 shrink-0">
          <h2 className="font-semibold text-slate-100 text-sm">Manage Watchlists</h2>
          <button onClick={saveManageModal} className="text-slate-400 hover:text-slate-200 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-3 overflow-y-auto flex-1">
          <p className="text-xs text-slate-500 mb-3">Drag to reorder · Double-click name to rename · ★ always pinned at top</p>
          <ul className="space-y-1">
            {manageWatchlists.map((w, idx) => {
              const isMaster    = w.id === MASTER_ID;
              const isRenaming  = renamingId === w.id;
              const nonMasterCount = manageWatchlists.filter(x => x.id !== MASTER_ID).length;
              return (
                <li
                  key={w.id}
                  draggable={!isMaster}
                  onDragStart={() => !isMaster && handleModalDragStart(idx)}
                  onDragOver={(e) => !isMaster && handleModalDragOver(e, idx)}
                  onDrop={() => !isMaster && handleModalDrop(idx)}
                  onDragEnd={handleModalDragEnd}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg border transition-colors select-none ${
                    isMaster ? 'border-slate-700/30 bg-slate-900/20 opacity-60 cursor-default'
                    : dragOverIndex === idx && dragIndex !== idx ? 'border-blue-500 bg-blue-500/10 cursor-grab'
                    : dragIndex === idx ? 'border-slate-600 bg-slate-700/40 opacity-50 cursor-grabbing'
                    : 'border-slate-700/50 bg-slate-900/40 hover:bg-slate-700/30 cursor-grab'
                  }`}
                >
                  <GripVertical size={14} className={`shrink-0 ${isMaster ? 'text-slate-700' : 'text-slate-500'}`} />
                  {isRenaming ? (
                    <input autoFocus type="text" value={renamingValue}
                      onChange={e => setRenamingValue(e.target.value)}
                      onBlur={commitRename}
                      onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setRenamingId(null); }}
                      className="flex-1 bg-slate-900 border border-blue-500 rounded px-2 py-0.5 text-sm outline-none"
                    />
                  ) : (
                    <span
                      className={`flex-1 text-sm font-medium ${isMaster ? 'text-slate-400' : 'text-slate-200 hover:text-blue-300 cursor-text'}`}
                      onDoubleClick={() => { if (!isMaster) { setRenamingId(w.id); setRenamingValue(w.name); } }}
                      title={isMaster ? undefined : 'Double-click to rename'}
                    >
                      {isMaster ? `★ ${w.name}` : w.name}
                    </span>
                  )}
                  <span className="text-[10px] text-slate-500 shrink-0">{isMaster ? '' : `${w.tickers.length} tickers`}</span>
                  {!isMaster && (
                    <button
                      onClick={() => {
                        if (nonMasterCount <= 1) return;
                        const updated = manageWatchlists.filter(x => x.id !== w.id);
                        setManageWatchlists(updated);
                        if (activeWatchlistId === w.id) setActiveWatchlistId(updated.find(x => x.id !== MASTER_ID)?.id ?? updated[0].id);
                      }}
                      disabled={nonMasterCount <= 1}
                      className="text-slate-500 hover:text-rose-400 transition-colors p-0.5 rounded disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        <div className="px-5 py-4 border-t border-slate-700 flex justify-end shrink-0">
          <button onClick={saveManageModal}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded-lg transition-colors font-medium">
            <Save size={13} /> Save
          </button>
        </div>
      </div>
    </div>
  );
}
