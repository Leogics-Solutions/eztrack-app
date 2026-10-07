import { SqlQueuePanel } from './SqlQueuePanel';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  getOrderBatch, startOrderBatch, previewOrderBatchEmail, sendOrderBatchEmail,
  assignOrderBatchFiles, getRunFile, type OrderBatchJob, type AgentRunData,
  getSqlDispatchPolicy,
} from '@/services/AgentsService';
import { sqlQueueNotice } from '@/utils/sqlQueueNotice';

type Reply = { anchor_run_id: number; files: { file_key: string; filename?: string }[] };
type Props = {
  runId: number; total: number; outsourced: boolean; editable: boolean;
  getCorrectedData?: () => AgentRunData;
  onRefresh: () => void; reply?: Reply; selectedFiles?: string[];
};

export function OrderBatchActions({ runId, total, outsourced, editable, onRefresh, reply, selectedFiles, getCorrectedData }: Props) {
  const [job, setJob] = useState<OrderBatchJob | null>(null);
  const [preview, setPreview] = useState<OrderBatchJob | null>(null);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [checked, setChecked] = useState<string[]>(selectedFiles || []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [batchMinutes, setBatchMinutes] = useState(0);
  const [dispatchMode, setDispatchMode] = useState<'AUTO' | 'IMMEDIATE' | 'BATCH'>('AUTO');
  const refresh = useRef(onRefresh);
  refresh.current = onRefresh;
  const running = job?.status === 'PENDING' || job?.status === 'RUNNING';
  const lineProgress = job?.result.progress?.stage.match(/^prepared_(delivery_order|invoice)_lines_(\d+)_of_(\d+)$/);
  const stageLabels: Record<string, string> = {
    saving_delivery_order: 'Saving Delivery Order in SQL', delivery_order_save_returned: 'Delivery Order saved; preparing Invoice',
    saving_invoice: 'Saving Invoice in SQL', saving_transferred_invoice: 'Saving Invoice in SQL',
    invoice_save_returned: 'Invoice saved', transferred_invoice_save_returned: 'Invoice saved',
  };
  useEffect(() => {
    let active = true;
    getSqlDispatchPolicy().then(p => { if (active) {
      setBatchMinutes(p.batch_interval_minutes);
      setDispatchMode(p.batch_interval_minutes > 0 ? 'BATCH' : 'AUTO');
    } }).catch(() => {});
    return () => { active = false; };
  }, []);
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    let wasRunning = false;
    const poll = async () => {
      let keepPolling = running;
      try {
        const result = await getOrderBatch(runId);
        if (stopped) return;
        setError('');
        setJob(result);
        const active = result?.status === 'PENDING' || result?.status === 'RUNNING';
        keepPolling = active;
        if (wasRunning && !active) refresh.current();
        wasRunning = active;
      } catch (e) { keepPolling = true; if (!stopped) setError('Connection interrupted. The background task may still be running; reconnecting to check its result.'); }
      if (!stopped && keepPolling) timer = setTimeout(poll, 3000);
    };
    poll();
    return () => { stopped = true; clearTimeout(timer); };
  }, [runId, running]);

  async function act(task: () => Promise<void>) {
    setBusy(true); setError('');
    try { await task(); } catch (e) {
      const message = e instanceof Error ? e.message : 'The action could not be completed.';
      setError(message);
      if (!outsourced && /failed to fetch|networkerror|load failed|network request failed/i.test(message)) {
        // A lost POST response is not proof that the durable submission failed.
        try {
          const saved = await getOrderBatch(runId);
          if (saved) { setJob(saved); refresh.current(); }
        } catch { /* Retain the error; reload checks the original saved task. */ }
        setError('Connection interrupted. Check the saved task below or refresh this page before retrying; the SQL result may still be pending.');
      }
    }
    finally { setBusy(false); }
  }
  const button = 'rounded border px-3 py-2 text-sm font-medium disabled:opacity-50';
  return <section className="my-4 rounded-lg border border-cyan-300 bg-cyan-50/50 p-4 dark:bg-cyan-950/20">
    <h3 className="font-semibold">{outsourced ? 'Supplier request' : 'Order processing'} · {total} set{total === 1 ? '' : 's'}</h3>
    <p className="my-2 text-sm">{outsourced ? 'Uses saved details for every set. Save corrections first.' : 'Submit saves the current set and prepares and posts the order in the background. Save any changes to other sets first.'} Each set keeps its own Review number.</p>
    {error && <p role="alert" className="my-2 text-sm text-red-700">{error}</p>}
    {running && <p role="status" className="my-2 text-sm">Processing in the background, one set at a time. You can leave this page and return to check progress.</p>}
    {running && <div role="status" className="my-2 rounded border border-cyan-300 p-3 text-sm">
      {job?.status === 'PENDING' && <p>{sqlQueueNotice(job)}</p>}
      <p>{lineProgress ? `${lineProgress[1] === 'delivery_order' ? 'Delivery Order' : 'Invoice'}: ${lineProgress[2]} / ${lineProgress[3]} rows prepared` : stageLabels[job?.result.progress?.stage || ''] || job?.result.progress?.stage || 'Queued — waiting to start'}</p>
      {lineProgress && <><progress className="w-full" value={Number(lineProgress[2])} max={Number(lineProgress[3])} aria-label="SQL document rows prepared" /><p>Rows are prepared in SQL. Posting completes only after SQL confirms Save.</p></>}
      {job?.result.progress?.total_lines != null && <p>{job.result.progress.total_lines} order lines submitted. Completion is confirmed after SQL returns.</p>}
      {job?.started_at && <p>Started {new Date(job.started_at).toLocaleTimeString()} · elapsed {Math.max(0, Math.floor((Date.now() - Date.parse(job.started_at)) / 60_000))} min</p>}
      <p>{job?.result.items?.length || 0} / {job?.total_orders || total} sets processed</p>
      {job?.result.progress?.updated_at && <p>Last update: {new Date(job.result.progress.updated_at).toLocaleTimeString()}</p>}
    </div>}
    {!outsourced && <SqlQueuePanel runId={runId} />}
    {editable && <div className="flex flex-wrap gap-2">
      {outsourced ? <button className={button} disabled={busy || running} onClick={() => act(async () => {
        const p = await previewOrderBatchEmail(runId); setPreview(p);
        setSubject(p.preview?.subject || ''); setBody(p.preview?.body || '');
      })}>Preview one email for all sets</button> : <button className={`${button} bg-[var(--primary)] text-white`} disabled={busy || running} onClick={() => act(async () => {
        setJob(await startOrderBatch(runId, 'SUBMIT', false, getCorrectedData?.(), total > 1 ? dispatchMode : 'AUTO'));
        refresh.current();
      })}>{busy ? 'Submitting…' : total > 1 ? `Submit all ${total} sets to SQL / 提交全部 ${total} 份` : 'Submit to SQL / 提交到 SQL'}</button>}
    </div>}
    {!outsourced && editable && <p className="mt-2 text-sm">One submission authorizes preparation and SQL posting. No separate Approve click is needed. Each set must pass validation; existing SQL documents are retained. 点击即提交准备及过账，无需再按 Approve。</p>}
    {!outsourced && total > 1 && <p className="mt-2 text-sm">SQL processes queued sets one at a time. A blocked set shows its own error; you can leave this page and return to check the results.</p>}
    {!outsourced && editable && batchMinutes > 0 && total > 1 && <label className="mt-2 block text-sm">Processing time
        <select aria-label="SQL processing time" value={dispatchMode} disabled={busy || running} onChange={e => setDispatchMode(e.target.value as typeof dispatchMode)} className="ml-2 rounded border bg-[var(--card)] p-2">
          <option value="BATCH">Next batch (every {batchMinutes} minutes)</option>
          <option value="IMMEDIATE">Urgent — join the ready queue now</option>
        </select>
        <p className="mt-1">Immediate processing still waits for current SQL work. It does not start a second SDK session.</p>
      </label>}
    {preview?.preview && <div className="mt-3 space-y-3 rounded border bg-[var(--card)] p-3 text-sm">
      <p><strong>{preview.preview.set_count} sets:</strong> {preview.preview.run_ids.map(id => `#${id}`).join(', ')}</p>
      <p><strong>To:</strong> {preview.preview.route.to.join(', ')}{preview.preview.route.cc.length > 0 && <><br /><strong>Cc:</strong> {preview.preview.route.cc.join(', ')}</>}</p>
      {preview.preview.route.test_mode && <p className="text-amber-800">Test delivery is enabled. Only the test recipients above will receive this email.</p>}
      <label className="block">Subject<input aria-label="Combined email subject" value={subject} maxLength={800} onChange={e => setSubject(e.target.value)} className="mt-1 w-full rounded border bg-transparent p-2" /></label>
      <label className="block">Message<textarea aria-label="Combined email message" value={body} maxLength={50000} rows={12} onChange={e => setBody(e.target.value)} className="mt-1 w-full rounded border bg-transparent p-2" /></label>
      <p><strong>Attachments:</strong> {preview.preview.files.map(f => f.filename).join(', ') || 'No attachments — instructions are included in the message.'}</p>
      <p>A tracking reference will be added to the subject so replies reach these Reviews.</p>
      <div className="flex gap-2"><button className={`${button} bg-[var(--primary)] text-white`} disabled={busy || running || !subject.trim() || !body.trim()} onClick={() => act(async () => {
        setJob(await sendOrderBatchEmail(runId, preview.id, subject, body)); setPreview(null); refresh.current();
      })}>Approve and send one email</button><button className={button} onClick={() => setPreview(null)}>Close preview</button></div>
    </div>}
    {job && <div className="mt-3 text-sm"><p className="font-medium">{job.action === 'PREPARE' ? 'Preparation' : job.action === 'EMAIL' ? 'Combined email' : 'SQL submission'}: {job.status}</p>
      {!outsourced && job.action === 'PREPARE' && job.status === 'SUCCESS' && <p>Preparation is complete. Use Submit to SQL above to post; no separate Approve step is required.</p>}
      {!outsourced && job.status === 'FAILED' && <div className="my-2">
        <p>Retry checks the original SQL outcome first. Existing documents are retained; an uncertain posting is held for reconciliation.</p>
        <button className={button} disabled={busy} onClick={() => act(async () => {
          setJob(await startOrderBatch(runId, job.action === 'SUBMIT' ? 'SUBMIT' : job.action === 'PREPARE' ? 'PREPARE' : 'APPROVE', job.total_orders === 1));
          refresh.current();
        })}>Check result and safely resume</button>
      </div>}
      {job.error && <p className="text-red-700">{job.error}</p>}
      <ul className="mt-2 space-y-1">{job.result.items?.map(item => <li key={item.run_id}><Link className="underline" href={`/review/${item.run_id}`}>#{item.run_id}</Link> · {item.status} — {item.message}</li>)}</ul>
    </div>}
    {reply && reply.files.length > 0 && <div className="mt-4 border-t pt-3 text-sm">
      <p className="font-semibold">Supplier reply — select documents for Review #{runId}</p>
      <p className="my-2">Choose this set’s DO/Invoice, save the selection, then verify the supplier documents. Other sets keep their own selection.</p>
      {reply.files.map(file => <div className="my-2 flex items-center gap-2" key={file.file_key}>
        <input aria-label={`Select ${file.filename || file.file_key}`} type="checkbox" checked={checked.includes(file.file_key)} onChange={e => setChecked(c => e.target.checked ? [...c, file.file_key] : c.filter(k => k !== file.file_key))} />
        <button className="underline" onClick={() => act(async () => { const blob = await getRunFile(reply.anchor_run_id, file.file_key); const url = URL.createObjectURL(blob); window.open(url, '_blank', 'noopener'); setTimeout(() => URL.revokeObjectURL(url), 60000); })}>{file.filename || file.file_key}</button>
      </div>)}
      <button className={button} disabled={busy || running || checked.length === 0} onClick={() => act(async () => { await assignOrderBatchFiles(runId, checked); refresh.current(); })}>Save files for this set</button>
    </div>}
  </section>;
}
