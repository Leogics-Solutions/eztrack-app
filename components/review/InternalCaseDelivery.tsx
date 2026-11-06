import Link from 'next/link';
import type { InternalCaseDeliverySummary } from '@/services/AgentsService';

export function InternalCaseDelivery({ state: value }: { state?: unknown }) {
  if (!value || typeof value !== 'object' || !('total' in value) || !('status' in value)
    || typeof value.total !== 'number' || typeof value.status !== 'string') return null;
  const state = value as InternalCaseDeliverySummary;
  const sent = state.status === 'sent';
  const manual = state.status === 'manually_fulfilled';
  const terminal = sent || manual;
  return <section aria-label="Internal case ZIP delivery" className={`mt-4 rounded-lg border p-4 text-sm ${terminal ? 'border-emerald-300 bg-emerald-50 text-emerald-950' : 'border-amber-300 bg-amber-50 text-amber-950'}`}>
    <h3 className="font-semibold">{manual ? 'Staff handled and delivered / 员工已处理及交付' : sent ? 'Case ZIP delivered / 整批 ZIP 已发送' : 'One ZIP after every set is ready / 全部完成后统一发 ZIP'}</h3>
    {manual ? <p className="mt-1">Staff reported manual customer delivery for {state.total} sets. Automatic resend is disabled. 员工确认已交付，禁止自动重发；这不是系统自动发送记录。</p> : <p className="mt-1">{state.ready_count ?? state.total} / {state.total} sets have saved SQL documents and PDFs. {sent ? 'All sets share one delivery; no need to resend.' : 'Completed sets are held until every set from this issuer is ready.'}</p>}
    {state.filename && <p className="mt-2 break-all font-mono text-xs">{state.filename}</p>}
    {!terminal && !!state.blockers?.length && <ul className="mt-3 space-y-2">
      {state.blockers.map((item, index) => <li key={`${item.run_id ?? 'source'}:${index}`}>
        {item.run_id ? <Link className="font-semibold underline" href={`/agents/runs/${item.run_id}`}>{item.set_index ? `Set ${item.set_index} · ` : ''}Review #{item.run_id}</Link> : <strong>Source grouping</strong>}
        {item.label && <span> · {item.label}</span>} — {item.reason}
      </li>)}
    </ul>}
    {!sent && state.note && <p className="mt-2 whitespace-pre-wrap">{state.note}</p>}
    {!terminal && <p className="mt-3">Resolve the specific document/PDF issue above before delivery. Existing SQL documents must not be posted again. 请先核对金额或 PDF 问题；已开单的套数不要重新开单。</p>}
  </section>;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

export function OrderDeliveryError({ message, status, outputRefs }: { message?: string | null; status: string; outputRefs?: unknown }) {
  if (!message || status === 'MANUALLY_CLOSED') return null;
  const refs = record(outputRefs);
  const sql = record(refs.sql_account);
  if (refs.manual_order_closure) return null;
  const hasDocuments = Boolean(record(sql.delivery_order).document_no || record(sql.invoice).document_no);
  const precision = sql.error_code === 'SQL_QUANTITY_PRECISION_LOSS' || sql.error_code === 'SQL_QUANTITY_PRECISION_POLICY_INVALID';
  const title = precision ? 'Pre-submission quantity check failed / 提交前数量精度检查未通过'
    : hasDocuments ? 'SQL documents exist; PDF/delivery needs attention / SQL 已有单据，文件生成或发送待处理'
    : 'Order requires attention / 订单需要处理';
  return <section role="alert" className="mt-3 rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-950">
    <h3 className="font-semibold">{title}</h3>
    <p className="mt-2 whitespace-pre-wrap">{message}</p>
    {hasDocuments && <p className="mt-2">Do not create or push these SQL documents again. Reconcile the named issue first. 不要重新开单或重推 SQL，请先处理上面的具体问题。</p>}
    {precision && <p className="mt-2">No SQL accounting request was sent. The original quantity and amount are retained. 未发送 SQL 开单请求，原数量与金额保留。</p>}
  </section>;
}
