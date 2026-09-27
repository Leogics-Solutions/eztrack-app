// Process one bounded request at a time; never replay an uncertain write.
export function selectUnresolvedForCreation<T extends { code: string; description: string; uom?: string | null; action: string }>(items: T[]): T[] {
  const masters = new Map<string, T>();
  for (const item of items) if (item.action === 'create_new' && !masters.has(item.code.trim().toLowerCase())) masters.set(item.code.trim().toLowerCase(), item);
  return items.map(item => {
    if (item.action) return item;
    const key = item.code.trim().toLowerCase();
    const master = masters.get(key) || item;
    masters.set(key, master);
    return { ...item, description: master.description, uom: master.uom, action: 'create_new' };
  });
}

export async function applySqlItemBatches<T, R extends { updated_at?: string | null; error_message?: string | null }>(
  items: T[], initial: R, apply: (batch: T[], version: string) => Promise<R>,
  progress: (completed: number, total: number) => void,
): Promise<R> {
  let current = initial;
  for (let offset = 0; offset < items.length; offset += 25) {
    if (!current.updated_at) throw new Error('Refresh the review before applying item choices.');
    if (current.error_message && offset > 0) return current;
    const batch = items.slice(offset, offset + 25);
    progress(offset, items.length);
    current = await apply(batch, current.updated_at);
    if (current.error_message) return current;
    progress(offset + batch.length, items.length);
  }
  return current;
}
