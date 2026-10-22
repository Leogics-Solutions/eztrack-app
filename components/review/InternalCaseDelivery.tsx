import Link from 'next/link';
import type { InternalCaseDeliverySummary } from '@/services/AgentsService';

export function InternalCaseDelivery({ state: value }: { state?: unknown }) {
  if (!value || typeof value !== 'object' || !('total' in value) || !('status' in value)
    || typeof value.total !== 'number' || typeof value.status !== 'string') return null;
  const state = value as InternalCaseDeliverySummary;
  const sent = state.status === 'sent';
  return <section aria-label="Internal case ZIP delivery" className={`mt-4 rounded-lg border p-4 text-sm ${sent ? 'border-emerald-300 bg-emerald-50 text-emerald-950' : 'border-amber-300 bg-amber-50 text-amber-950'}`}>
    <h3 className="font-semibold">{sent ? 'Case ZIP delivered / 整批 ZIP 已发送' : 'One ZIP after every set is ready / 全部完成后统一发 ZIP'}</h3>
    <p className="mt-1">{state.ready_count ?? state.total} / {state.total} sets have saved SQL documents and PDFs. {sent ? 'All sets share one delivery; no need to resend.' : 'Completed sets are held until every set from this issuer is ready.'}</p>
    {state.filename && <p className="mt-2 break-all font-mono text-xs">{state.filename}</p>}
    {!sent && !!state.blockers?.length && <ul className="mt-3 space-y-2">
      {state.blockers.map((item, index) => <li key={`${item.run_id ?? 'source'}:${index}`}>
        {item.run_id ? <Link className="font-semibold underline" href={`/agents/runs/${item.run_id}`}>{item.set_index ? `Set ${item.set_index} · ` : ''}Review #{item.run_id}</Link> : <strong>Source grouping</strong>}
        {item.label && <span> · {item.label}</span>} — {item.reason}
      </li>)}
    </ul>}
    {!sent && state.note && <p className="mt-2 whitespace-pre-wrap">{state.note}</p>}
    {!sent && <p className="mt-3">Resolve the blocked set above. When its SQL posting and PDFs finish, the whole case is sent together. 已成功的套数不用重推。</p>}
  </section>;
}
