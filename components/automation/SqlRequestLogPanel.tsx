import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useOrganization } from '@/lib/OrganizationContext';
import { exportSqlRequestLog, getSqlRequestLog, type SqlRequestLog } from '@/services/AgentsService';
import { malaysiaToday, sqlRequestLogTime, type SqlRequestLogFilters } from '@/utils/sqlRequestLog';
import { sqlQueueStage, sqlQueueState, sqlQueueType } from '@/utils/sqlQueueView';

const states = ['RUNNING', 'QUEUED', 'SCHEDULED', 'NEEDS_ATTENTION', 'PENDING', 'SUCCESS', 'FAILED', 'INTERRUPTED'];
const control = 'rounded border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm';

export function SqlRequestLogPanel() {
  const { selectedOrganizationId } = useOrganization();
  const [draft, setDraft] = useState<SqlRequestLogFilters>({});
  const [filters, setFilters] = useState<SqlRequestLogFilters>({});
  const [offset, setOffset] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const [snapshot, setSnapshot] = useState<SqlRequestLog | null>(null);
  const [error, setError] = useState('');
  const [exportError, setExportError] = useState('');
  const [exporting, setExporting] = useState(false);
  const generation = useRef(0);
  const exportController = useRef<AbortController | null>(null);
  const previousOrganization = useRef(selectedOrganizationId);
  useEffect(() => {
    if (previousOrganization.current === selectedOrganizationId) return;
    previousOrganization.current = selectedOrganizationId;
    setOffset(0); setDraft({}); setFilters({});
  }, [selectedOrganizationId]);
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    generation.current += 1;
    exportController.current?.abort(); setExporting(false); setExportError('');
    setSnapshot(null); setError('');
    const poll = async () => {
      try {
        const result = await getSqlRequestLog(filters, offset, controller.signal);
        if (!stopped) { setSnapshot(result); setError(''); }
      } catch (err) {
        if (!stopped) setError(err instanceof Error ? err.message : 'Could not load SQL requests / 未能读取 SQL 请求。');
      }
      if (!stopped) timer = setTimeout(() => { if (!document.hidden) void poll(); else timer = setTimeout(poll, 15000); }, 15000);
    };
    void poll();
    return () => { stopped = true; controller.abort(); exportController.current?.abort(); clearTimeout(timer); };
  }, [filters, offset, refresh, selectedOrganizationId]);
  function apply(next = draft) {
    if (next.date_from && next.date_to && next.date_from > next.date_to) {
      setError('Start date must be on or before end date / 开始日期不能迟于结束日期。'); return;
    }
    setOffset(0); setFilters({ ...next });
  }
  async function download() {
    const token = generation.current;
    const controller = new AbortController(); exportController.current = controller;
    setExporting(true); setExportError('');
    try {
      const blob = await exportSqlRequestLog(filters, controller.signal);
      if (generation.current !== token || controller.signal.aborted) return;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url; anchor.download = `sql-request-log-${malaysiaToday()}.csv`;
      document.body.appendChild(anchor); anchor.click(); anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      if (generation.current === token && !controller.signal.aborted) setExportError(err instanceof Error ? err.message : 'Export failed / 导出失败。');
    } finally { if (generation.current === token) setExporting(false); }
  }
  return <section aria-labelledby="sql-request-log-title" className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-5">
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div><h2 id="sql-request-log-title" className="text-lg font-semibold">SQL request log / SQL 请求总日志</h2>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">All workspace Reviews: payment checks, ORs and DO / Invoice requests. / 汇总本工作区所有 Review 的付款查询、OR 与 DO／Invoice 请求。</p></div>
      <div className="flex gap-2"><button type="button" className={control} onClick={() => setRefresh(value => value + 1)}>Refresh / 刷新</button>
        <button type="button" className={`${control} disabled:opacity-50`} disabled={exporting || !snapshot} onClick={() => void download()}>{exporting ? 'Exporting… / 导出中…' : 'Export CSV / 导出 CSV'}</button></div>
    </div>
    <form className="mb-4 flex flex-wrap items-end gap-3" onSubmit={event => { event.preventDefault(); apply(); }}>
      <label className="text-sm">From / 开始日期<input className={`${control} mt-1 block`} type="date" value={draft.date_from || ''} onChange={event => setDraft({ ...draft, date_from: event.target.value })} /></label>
      <label className="text-sm">To / 结束日期<input className={`${control} mt-1 block`} type="date" value={draft.date_to || ''} onChange={event => setDraft({ ...draft, date_to: event.target.value })} /></label>
      <label className="text-sm">Company / 公司<select className={`${control} mt-1 block max-w-64`} value={draft.company || ''} onChange={event => setDraft({ ...draft, company: event.target.value })}><option value="">All companies / 全部公司</option>{snapshot?.companies.map(company => <option key={company} value={company}>{company}</option>)}</select></label>
      <label className="text-sm">State / 状态<select className={`${control} mt-1 block`} value={draft.state || ''} onChange={event => setDraft({ ...draft, state: event.target.value })}><option value="">All states / 全部状态</option>{states.map(state => <option key={state} value={state}>{state === 'PENDING' ? 'Pending / 待处理' : sqlQueueState(state)}</option>)}</select></label>
      <label className="text-sm">Request / 请求<select className={`${control} mt-1 block`} value={draft.job_type || ''} onChange={event => setDraft({ ...draft, job_type: event.target.value })}><option value="">All requests / 全部请求</option><option value="payment_sql_preview">Payment SQL check / 付款查询</option><option value="payment_submit">OR / Payment / 收款核销</option><option value="order_batch">DO &amp; Invoice / 开单请求</option></select></label>
      <button className={control} type="submit">Filter / 筛选</button>
      <button className={control} type="button" onClick={() => { const today = malaysiaToday(); const next = { ...draft, date_from: today, date_to: today }; setDraft(next); apply(next); }}>Today / 今天</button>
      <button className={control} type="button" onClick={() => { setDraft({}); apply({}); }}>Reset / 重置</button>
    </form>
    <p className="mb-3 text-xs text-[var(--muted-foreground)]">Dates use submission time in Malaysia (GMT+8). CSV includes every matching request across all pages and can be opened in Excel. / 日期按马来西亚提交时间筛选，CSV 导出全部筛选结果，可用 Excel 打开。</p>
    {error && <p role="alert" className="mb-3 text-sm text-red-600">{error} {snapshot && 'Showing the last retrieved data / 以下为上次读取的资料。'}</p>}
    {exportError && <p role="alert" className="mb-3 text-sm text-red-600">{exportError}</p>}
    {!snapshot && !error && <p role="status">Loading SQL requests… / 正在读取 SQL 请求…</p>}
    {snapshot && <>
      <p className="mb-2 text-sm">Workspace active requests / 本工作区当前请求： {['RUNNING','QUEUED','SCHEDULED','NEEDS_ATTENTION'].map((state, index) => <span key={state}>{index > 0 && ' · '}{sqlQueueState(state)}: <b>{snapshot.active_counts[state as keyof typeof snapshot.active_counts]}</b></span>)}</p>
      <p className="mb-3 text-xs text-[var(--muted-foreground)]">Updated / 更新：{sqlRequestLogTime(snapshot.updated_at)} · Refreshes every 15 seconds / 每15秒更新。 Queue position follows the shared SQL queue; filters do not change it. / 顺位按共享 SQL 队列计算，筛选不会改变顺位。</p>
      <div className="overflow-x-auto"><table className="w-full min-w-[1040px] text-left text-sm"><thead><tr className="border-b border-[var(--border)]">
        {['Position / 顺位','Request / 请求','Review · Company / 公司','Customer / 客户','Submitted account / 提交账号','State / 状态','Time (MYT) / 时间'].map(title => <th key={title} className="p-2">{title}</th>)}
      </tr></thead><tbody className="divide-y divide-[var(--border)]">{snapshot.items.map(item => <tr key={item.id}>
        <td className="p-2 align-top font-semibold">{item.queue_position ?? (item.state === 'RUNNING' ? '▶' : '—')}</td>
        <td className="p-2 align-top">{item.delivery_only ? 'Confirmation recovery / 恢复通知' : sqlQueueType(item)}{(item.set_count || 0) > 1 && <p className="mt-1 text-xs">{item.set_count} Reviews / 份</p>}<p className="mt-1 max-w-40 break-all text-xs text-[var(--muted-foreground)]">{item.id}</p></td>
        <td className="p-2 align-top"><div className="flex max-w-60 flex-wrap gap-2">{item.review_ids?.map(id => <Link key={id} href={`/review/${id}`} className="underline">#{id}</Link>)}</div><p className="mt-1 max-w-64">{item.company || 'Not identified / 尚未识别'}</p></td>
        <td className="p-2 align-top"><p className="max-w-56">{item.customer || 'Not identified / 尚未识别'}</p>{item.reviews.length > 1 && <details className="mt-1 text-xs"><summary className="cursor-pointer">Per Review / 各份资料</summary>{item.reviews.map(review => <p key={review.id} className="mt-1">#{review.id} · {review.company || '—'} → {review.customer || '—'}</p>)}</details>}</td>
        <td className="p-2 align-top">{item.automatic && <p className="font-medium">Automatic / 自动任务</p>}<p>{item.submitted_by}</p><p className="mt-1 text-xs text-[var(--muted-foreground)]">{item.submitted_email}</p></td>
        <td className="p-2 align-top"><p className={item.state === 'FAILED' || item.state === 'NEEDS_ATTENTION' ? 'font-medium text-red-600' : ''}>{item.state === 'PENDING' ? 'Pending / 待处理' : sqlQueueState(item.state)}</p>{item.stage && <p className="mt-1 text-xs">{sqlQueueStage(item.stage)}</p>}{item.sql_status && <p className="mt-1 text-xs">SQL: {item.sql_status}</p>}{item.error_message && <p className="mt-1 max-w-72 break-words text-xs text-red-600">{item.error_message}</p>}</td>
        <td className="whitespace-nowrap p-2 align-top"><p>{sqlRequestLogTime(item.submitted_at)}</p>{item.started_at && <p className="mt-1 text-xs">Started / 开始: {sqlRequestLogTime(item.started_at)}</p>}{item.completed_at && <p className="mt-1 text-xs">Finished / 结束: {sqlRequestLogTime(item.completed_at)}</p>}{item.state === 'SCHEDULED' && <p className="mt-1 text-xs">Scheduled / 排定: {sqlRequestLogTime(item.scheduled_for)}</p>}</td>
      </tr>)}</tbody></table>{snapshot.items.length === 0 && <p className="p-4 text-sm">No matching SQL requests / 没有符合筛选条件的 SQL 请求。</p>}</div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm"><span>{snapshot.items.length ? `${offset + 1}–${offset + snapshot.items.length}` : '0'} / {snapshot.total} requests / 请求</span><div className="flex gap-2"><button type="button" className={`${control} disabled:opacity-50`} disabled={offset === 0} onClick={() => setOffset(0)}>First / 第一页</button><button type="button" className={`${control} disabled:opacity-50`} disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 50))}>Previous / 上一页</button><button type="button" className={`${control} disabled:opacity-50`} disabled={!snapshot.has_more} onClick={() => setOffset(offset + 50)}>Next / 下一页</button></div></div>
    </>}
  </section>;
}
