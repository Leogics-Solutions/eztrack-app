import { useState } from 'react';
import { previewReservedDo, type ReservedDoPreview } from '@/services/AgentsService';

export function ReservedDoReview({ runId, documentNo, invoiceNo, customerCode, disabled, onConfirm }: {
  runId: number; documentNo: string; invoiceNo: string; customerCode: string; disabled: boolean;
  onConfirm: (token: string) => Promise<unknown>;
}) {
  const [preview, setPreview] = useState<ReservedDoPreview | null>(null);
  const [requestedNo, setRequestedNo] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const inspect = async () => {
    setBusy(true); setError(''); setPreview(null); setConfirmed(false);
    try { setRequestedNo(documentNo); setPreview(await previewReservedDo(runId, documentNo)); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };
  const snapshot = requestedNo === documentNo ? preview?.snapshot : null;
  const eligible = snapshot?.found && !snapshot.truncated && !snapshot.cancelled && !snapshot.linked_invoice
    && snapshot.document?.customer_code === customerCode;
  return <div className="mt-3">
    <button type="button" disabled={disabled || busy || !documentNo} onClick={() => void inspect()}
      className="rounded border border-cyan-700 px-3 py-2 text-sm disabled:opacity-50">{busy ? 'Checking SQL...' : 'Inspect existing / reserved DO'}</button>
    {error && <p role="alert" className="mt-2 text-red-700">{error}</p>}
    {snapshot && <section className="mt-3 rounded border border-amber-400 bg-white p-3 text-slate-900">
      {!snapshot.found ? <p>No existing DO found under this number. The normal approval will create it.</p> : <>
        <h3 className="font-semibold">Existing DO {snapshot.document?.document_no}</h3>
        <p>{snapshot.document?.customer_name} ({snapshot.document?.customer_code}) · {snapshot.document?.document_date} · RM {snapshot.document?.document_amount}</p>
        <div className="max-h-80 overflow-auto"><table className="mt-2 w-full text-left text-xs"><thead><tr><th>Current description</th><th>Item</th><th>Qty</th><th>UOM</th><th>Price</th><th>Amount</th></tr></thead>
          <tbody>{snapshot.lines.map((line, i) => <tr key={i} className="border-t"><td className="whitespace-pre-wrap py-2">{line.description}{line.more_description ? `\n${line.more_description}` : ''}</td><td>{line.item_code || '—'}</td><td>{line.qty}</td><td>{line.uom || '—'}</td><td>{line.unit_price}</td><td>{line.amount}</td></tr>)}</tbody></table></div>
        {!snapshot.lines.length && <p className="mt-2">This DO currently has no detail lines.</p>}
        {eligible ? <>
          <p className="mt-3">On posting, the current DO details will be replaced with this Review’s lines, date and prices, then Invoice {invoiceNo} will be created. Check both the existing details above and the proposed lines in this Review.</p>
          <label className="mt-2 flex gap-2"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />I checked the existing DO and confirm updating it from this Review.</label>
          <button type="button" disabled={!confirmed || disabled || busy || !invoiceNo} className="mt-2 rounded bg-amber-700 px-3 py-2 text-white disabled:opacity-50" onClick={async () => {
            if (!preview) return;
            setBusy(true);
            try { await onConfirm(preview.confirmation); setPreview(null); }
            catch (e) { setError((e as Error).message); }
            finally { setBusy(false); }
          }}>Record update confirmation</button>
          <p className="mt-2 text-xs">This records confirmation only. SQL changes occur when the order is approved and posted. If SQL contents change first, a fresh confirmation is required.</p>
        </> : <p className="mt-2 text-red-700">This DO cannot be updated here. Check the customer, cancellation, linked Invoice or incomplete preview.</p>}
      </>}
    </section>}
  </div>;
}
