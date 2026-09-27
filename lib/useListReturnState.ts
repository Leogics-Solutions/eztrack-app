'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/** Restore a list only after hydration and within the selected organization. */
export function useListReturnState<T extends object>(key: string | null, initial: T, loading: boolean) {
  const [value, setValue] = useState(initial);
  const [restoredKey, setRestoredKey] = useState<string | null>(null);
  const initialValue = useRef(initial);
  const scroll = useRef<number | null>(null);
  const lastScroll = useRef(0);
  useEffect(() => {
    if (!key) return;
    let next = initialValue.current;
    try {
      const saved = JSON.parse(sessionStorage.getItem(key) || 'null');
      if (saved?.value && typeof saved.value === 'object') next = { ...next, ...saved.value };
      scroll.current = Number.isFinite(saved?.scroll) ? saved.scroll : null;
      lastScroll.current = scroll.current || 0;
    } catch { /* Storage is optional. */ }
    setValue(next);
    setRestoredKey(key);
  }, [key]);
  useEffect(() => {
    if (!key || restoredKey !== key) return;
    const container = document.querySelector('main');
    const save = () => {
      try { sessionStorage.setItem(key, JSON.stringify({ value, scroll: lastScroll.current })); } catch { /* optional */ }
    };
    const onScroll = () => { lastScroll.current = container ? container.scrollTop : window.scrollY; save(); };
    const target = container || window;
    target.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('pagehide', save);
    return () => { save(); target.removeEventListener('scroll', onScroll); window.removeEventListener('pagehide', save); };
  }, [key, restoredKey, value]);
  useEffect(() => {
    if (loading || !key || restoredKey !== key || scroll.current === null) return;
    const y = scroll.current;
    const frame = requestAnimationFrame(() => {
      const container = document.querySelector('main');
      if (container) container.scrollTop = y;
      else window.scrollTo(0, y);
      lastScroll.current = y;
      scroll.current = null;
    });
    return () => cancelAnimationFrame(frame);
  }, [key, restoredKey, loading]);
  const update = useCallback(<K extends keyof T>(field: K, next: T[K] | ((previous: T[K]) => T[K])) => {
    setValue(previous => ({ ...previous, [field]: typeof next === 'function' ? (next as (old: T[K]) => T[K])(previous[field]) : next }));
  }, []);
  return { value, update, restored: Boolean(key && restoredKey === key) };
}
