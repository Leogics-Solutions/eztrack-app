'use client';

import { useCallback, useEffect, useState } from 'react';
import { isWorkstreamKey, type WorkstreamKey } from './workstreams';

/**
 * Remember which workflow the user is working in.
 *
 * Someone processing purchase orders all morning should not have to reselect
 * that workflow on every visit. The choice is restored after hydration rather
 * than during render, so the server and client markup still agree.
 */
export function useStickyWorkstream(
  storageKey: string,
): [WorkstreamKey, (value: WorkstreamKey) => void, boolean] {
  const [workstream, setWorkstreamState] = useState<WorkstreamKey>('ALL');
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (isWorkstreamKey(saved)) setWorkstreamState(saved);
    } catch {
      // A blocked or full storage must never stop the page from loading.
    }
    setRestored(true);
  }, [storageKey]);

  const setWorkstream = useCallback(
    (value: WorkstreamKey) => {
      setWorkstreamState(value);
      try {
        window.localStorage.setItem(storageKey, value);
      } catch {
        // Preference is best-effort; the current selection still applies.
      }
    },
    [storageKey],
  );

  return [workstream, setWorkstream, restored];
}
