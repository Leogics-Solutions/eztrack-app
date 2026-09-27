import { useState } from 'react';
import { selectUnresolvedForCreation } from '@/utils/sqlItemBatch';
import type { SqlAccountStockItemChoice, SqlAccountStockItemProposal } from '@/services/AgentsService';

type Draft = SqlAccountStockItemProposal & { action: '' | SqlAccountStockItemChoice['action'] };

export function SqlItemResolution({ items, busy, onApply, onCheck }: {
  items: SqlAccountStockItemProposal[];
  busy: boolean;
  onApply: (items: SqlAccountStockItemChoice[]) => Promise<void>;
  onCheck: () => Promise<void>;
}) {
  const [drafts, setDrafts] = useState<Draft[]>(() => items.map(item => ({ ...item, action: '' })));
  const [page, setPage] = useState(0);
  const selected = drafts.filter(item => item.action);
  const invalid = selected.some(item => !item.code.trim() || item.description.trim().length < 2 ||
    (item.action === 'create_new' && !/^[A-Za-z0-9_/-]{2,20}$/.test(item.code.trim())));
  const update = (index: number, change: Partial<Draft>) => setDrafts(previous => previous.map(
    item => item.source_index === index ? { ...item, ...change } : item));
  if (!items.length) return null;
  return <section className="rounded-lg border border-violet-500/30 bg-violet-500/5 p-5">
    <h2 className="font-semibold">Resolve {items.length} unmatched SQL items</h2>
    <p className="mt-1 text-sm text-[var(--muted-foreground)]">Choose existing SQL codes or approve new items across all pages. The system processes 25 lines at a time and stops on an error, keeping completed results. DO/Invoice approval remains a separate step.</p>
    <button className="mt-3 rounded border px-3 py-2 text-sm disabled:opacity-50" disabled={busy} onClick={onCheck}>Check SQL matches first</button>
    <div className="mt-3 flex flex-wrap gap-2">
      <button type="button" disabled={busy} className="rounded border px-3 py-2 text-sm" onClick={() => setDrafts(previous => selectUnresolvedForCreation(previous) as Draft[])}>Select all unresolved for creation ({drafts.filter(item => !item.action).length})</button>
      <button type="button" disabled={busy} className="rounded border px-3 py-2 text-sm" onClick={() => setDrafts(previous => previous.map(item => ({ ...item, action: '' })))}>Clear selections</button>
    </div>
    <p className="mt-2 text-sm">Selection alone creates nothing. Review the codes and descriptions, then apply. Blank stock UOM uses the SQL company default; it does not add a unit to the source document.</p>
    <p className="mt-2 text-sm">Repeated codes share one stock item using the first selected description and stock UOM. Original order descriptions and amounts stay unchanged.</p>
    <div className="my-3 flex items-center gap-3 text-sm">
      <button disabled={busy || page === 0} onClick={() => setPage(page - 1)}>Previous</button>
      <span>Page {page + 1} / {Math.ceil(items.length / 25)}</span>
      <button disabled={busy || (page + 1) * 25 >= items.length} onClick={() => setPage(page + 1)}>Next</button>
      <span>{selected.length} selected</span>
    </div>
    <div className="space-y-3">{drafts.slice(page * 25, (page + 1) * 25).map(item => <div key={item.source_index} className="rounded border border-[var(--border)] p-3">
      <p className="mb-2 text-sm font-medium">Line {item.source_index + 1}: {items.find(source => source.source_index === item.source_index)?.code}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-sm">Decision<select aria-label={`Line ${item.source_index + 1} decision`} className="mt-1 w-full rounded border p-2 text-black" disabled={busy} value={item.action} onChange={event => update(item.source_index, { action: event.target.value as Draft['action'] })}>
          <option value="">Leave unresolved</option><option value="match_existing">Match existing SQL item</option><option value="create_new">Create new SQL item</option>
        </select></label>
        <label className="text-sm">SQL item code<input className="mt-1 w-full rounded border p-2 text-black" disabled={busy} maxLength={item.action === 'create_new' ? 20 : 100} value={item.code} onChange={event => update(item.source_index, { code: event.target.value })} /></label>
        <label className="text-sm">New item description<input className="mt-1 w-full rounded border p-2 text-black" disabled={busy || item.action !== 'create_new'} maxLength={500} value={item.description} onChange={event => update(item.source_index, { description: event.target.value })} /></label>
        <label className="text-sm">Stock UOM override (optional)<input className="mt-1 w-full rounded border p-2 text-black" disabled={busy || item.action !== 'create_new'} maxLength={30} placeholder="Use SQL company default" value={item.uom || ''} onChange={event => update(item.source_index, { uom: event.target.value })} /></label>
      </div>
    </div>)}</div>
    <p className="mt-3 text-sm">{new Set(selected.filter(item => item.action === 'create_new').map(item => item.code.trim().toLowerCase())).size} unique stock codes selected for creation. Exact existing codes with the same details are reused; conflicting details stop the batch.</p>
    <button className="mt-3 rounded bg-violet-600 px-4 py-2 text-white disabled:opacity-50" disabled={busy || !selected.length || invalid} onClick={() => onApply(selected.map(item => ({ ...item, action: item.action as SqlAccountStockItemChoice['action'], code: item.code.trim(), description: item.description.trim(), uom: item.uom?.trim() })))}>Apply selected item choices ({selected.length})</button>
    {invalid && <p className="mt-2 text-sm">Check the selected item codes and descriptions.</p>}
  </section>;
}
