"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { type Watchlist, MASTER_ID } from '@/types';

const STORAGE_KEY = 'vn_stock_watchlists';

export function useWatchlists() {
  const [watchlists,        setWatchlists]        = useState<Watchlist[]>([]);
  const [activeWatchlistId, setActiveWatchlistId] = useState<string>('');
  const [newTicker,         setNewTicker]         = useState('');
  const [showManageModal,   setShowManageModal]   = useState(false);
  const [manageWatchlists,  setManageWatchlists]  = useState<Watchlist[]>([]);
  const [renamingId,        setRenamingId]        = useState<string | null>(null);
  const [renamingValue,     setRenamingValue]     = useState('');
  const [dragIndex,         setDragIndex]         = useState<number | null>(null);
  const [dragOverIndex,     setDragOverIndex]     = useState<number | null>(null);
  const preventFetch = useRef(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    let lists: Watchlist[] = [];
    if (saved) { try { lists = JSON.parse(saved) as Watchlist[]; } catch { /* ignore */ } }
    if (!lists.find(w => w.id === MASTER_ID))
      lists = [{ id: MASTER_ID, name: 'All Tickers', tickers: [] }, ...lists];
    if (lists.length === 1)
      lists = [...lists, { id: 'default', name: 'Main Watchlist', tickers: ['ACB','SHB','VCB','TCB','VPB','MBB','STB'] }];
    setWatchlists(lists);
    setActiveWatchlistId(lists[0].id);
  }, []);

  useEffect(() => {
    if (watchlists.length > 0) localStorage.setItem(STORAGE_KEY, JSON.stringify(watchlists));
  }, [watchlists]);

  const activeWatchlist = useMemo(() => watchlists.find(w => w.id === activeWatchlistId), [watchlists, activeWatchlistId]);
  const masterWatchlist = useMemo(() => watchlists.find(w => w.id === MASTER_ID), [watchlists]);

  const addTicker = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTicker.trim() || !activeWatchlist) return;
    if (activeWatchlist.id === MASTER_ID) return; // MASTER is derived via Sync, not directly editable
    const toAdd = newTicker.split(',').map(t => t.trim().toUpperCase()).filter(t => t && !activeWatchlist.tickers.includes(t));
    if (!toAdd.length) { setNewTicker(''); return; }
    setWatchlists(prev => prev.map(w => w.id === activeWatchlistId ? { ...w, tickers: [...w.tickers, ...toAdd] } : w));
    setNewTicker('');
  };

  const removeTicker = useCallback((ticker: string) => {
    setWatchlists(prev => prev.map(w => w.id === activeWatchlistId ? { ...w, tickers: w.tickers.filter(t => t !== ticker) } : w));
  }, [activeWatchlistId]);

  const reorderTickers = useCallback((fromIdx: number, toIdx: number, visible: string[]) => {
    if (!activeWatchlist) return;
    const reordered = [...visible];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    const hidden = activeWatchlist.tickers.filter(t => !visible.includes(t));
    preventFetch.current = true;
    setWatchlists(prev => prev.map(w => w.id === activeWatchlistId ? { ...w, tickers: [...reordered, ...hidden] } : w));
  }, [activeWatchlist, activeWatchlistId]);

  const createWatchlist = useCallback(() => {
    const id = Date.now().toString();
    const updated = [...watchlists, { id, name: 'New Watchlist', tickers: [] }];
    setWatchlists(updated);
    setActiveWatchlistId(id);
    setManageWatchlists(updated);
    setRenamingId(id);
    setRenamingValue('New Watchlist');
    setShowManageModal(true);
  }, [watchlists]);

  const syncMasterWatchlist = useCallback(() => {
    const all = Array.from(new Set(watchlists.filter(w => w.id !== MASTER_ID).flatMap(w => w.tickers)));
    setWatchlists(prev => prev.map(w => w.id === MASTER_ID ? { ...w, tickers: all } : w));
  }, [watchlists]);

  const openManageModal = useCallback(() => { setManageWatchlists([...watchlists]); setRenamingId(null); setShowManageModal(true); }, [watchlists]);

  const commitRename = useCallback(() => {
    if (!renamingId) return;
    const trimmed = renamingValue.trim();
    if (trimmed) setManageWatchlists(prev => prev.map(w => w.id === renamingId ? { ...w, name: trimmed } : w));
    setRenamingId(null);
  }, [renamingId, renamingValue]);

  const saveManageModal = useCallback(() => { commitRename(); setWatchlists(manageWatchlists); setShowManageModal(false); }, [commitRename, manageWatchlists]);

  const handleModalDragStart = (i: number) => setDragIndex(i);
  const handleModalDragOver  = (e: React.DragEvent, i: number) => { e.preventDefault(); setDragOverIndex(i); };
  const handleModalDragEnd   = () => { setDragIndex(null); setDragOverIndex(null); };
  const handleModalDrop      = (toIdx: number) => {
    if (dragIndex === null || dragIndex === toIdx) { handleModalDragEnd(); return; }
    const r = [...manageWatchlists]; const [m] = r.splice(dragIndex, 1); r.splice(toIdx, 0, m);
    setManageWatchlists(r); handleModalDragEnd();
  };

  return {
    watchlists, setWatchlists, activeWatchlistId, setActiveWatchlistId,
    activeWatchlist, masterWatchlist, newTicker, setNewTicker, preventFetch,
    addTicker, removeTicker, reorderTickers, createWatchlist, syncMasterWatchlist,
    showManageModal, setShowManageModal, manageWatchlists, setManageWatchlists,
    renamingId, setRenamingId, renamingValue, setRenamingValue,
    dragIndex, dragOverIndex,
    openManageModal, commitRename, saveManageModal,
    handleModalDragStart, handleModalDragOver, handleModalDragEnd, handleModalDrop,
  };
}

export type UseWatchlistsReturn = ReturnType<typeof useWatchlists>;
