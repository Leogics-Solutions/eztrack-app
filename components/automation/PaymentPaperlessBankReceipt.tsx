type Row = Record<string, any>;

function exactSaved(data: Row, slip: Row, saved: Row) {
  const company = data.payment_company || {};
  const identity = saved.identity || {};
  return saved.purpose === 'HUMAN_APPROVAL_ONLY' && saved.accepted_by_user_id && saved.accepted_at &&
    identity.sql_connection_id === company.sql_connection_id && identity.company_key === company.company_key &&
    identity.customer_code === data.customer_code && Number(identity.amount) === Number(slip.amount) &&
    identity.currency === slip.currency && identity.payment_method_code === slip.payment_method_code &&
    identity.payment_date === slip.payment_date && identity.source_message_reference === slip.bank_reference &&
    JSON.stringify(identity.invoice_numbers || []) === JSON.stringify((data.requested_invoices || []).map((i: Row) => String(i.invoice_number || '')).sort());
}

/** Save-only request; the server independently qualifies and stamps acceptance. */
export default function PaymentPaperlessBankReceipt({ data, editable, onChange }: {
  data: Row; editable: boolean; onChange: (request: Row) => void;
}) {
  const slips = data.payment_slips || [];
  const slip = slips[0] || {};
  const lifecycle = data.payment_lifecycle || data.source?.context?.payment_lifecycle || {};
  const fence = lifecycle.slip_update_confirmation || {};
  if (slips.length !== 1 || slip.instrument_type !== 'IBG' || slip.evidence_status !== 'PENDING_SLIP' ||
    slip.reference_source !== 'CHANNEL_MESSAGE' || !String(slip.bank_reference || '').startsWith('MESSAGE:') ||
    slip.payment_direction !== 'INBOUND_RECEIVABLE' || slip.receipt_status !== 'CONFIRMED_RECEIVED' ||
    slip.currency !== 'MYR' || (data.source?.files || []).length || lifecycle.funds_status !== 'CONFIRMED_RECEIVED' ||
    (fence.required && !fence.satisfied) || (!fence.required && lifecycle.status_code === 'RECEIVED_PENDING_SLIP')) return null;
  const request = data.bank_receipt_without_slip_request || {};
  const saved = data.review_override?.bank_receipt_without_slip || {};
  const accepted = exactSaved(data, slip, saved);
  const checked = request.requested === true;
  const sqlReady = data.sql_preview?.status === 'ready';
  const requestValue = { ...request, receipt_date: slip.payment_date || '',
    receipt_date_source: request.receipt_date_source || 'BANK_STATEMENT' };
  const change = (key: string, value: unknown) => onChange({ ...requestValue, [key]: value,
    requested: false, bank_verified_received: false, bank_date_verified: false,
    receiving_bank_verified: false, only_this_receipt: false, manual_approval_only: false });
  const complete = sqlReady && data.customer_code && slip.payment_method_code &&
    (data.requested_invoices || []).length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(requestValue.receipt_date) &&
    /^\d{6,20}$/.test(request.receiving_account || '') &&
    ['receipt_date_evidence', 'receiving_bank_evidence', 'reason'].every(k => String(request[k] || '').trim().length >= 12) &&
    String(request.evidence_reference || '').trim().length >= 6;
  const inputClass = 'mt-1 w-full rounded border border-[var(--border)] bg-[var(--background)] p-2 text-sm disabled:opacity-60';
  return <section className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-slate-900">
    <h3 className="font-semibold">无 slip 的 IBG：银行记录人工确认</h3>
    <p className="mt-1 text-sm">只适用于 Finance 已确认收到、确实没有 slip 的单笔 IBG。原本要求补 slip 的付款、图片遗失／损坏及身份冲突，仍须先处理原始证据。</p>
    <p className="mt-2 text-sm">{data.customer || '客户未确认'} · MYR {Number(slip.amount || 0).toFixed(2)} · {(data.requested_invoices || []).map((i: Row) => i.invoice_number).join(', ')}<br />
      当前收款／OR 日期：<strong>{slip.payment_date || '未填写'}</strong> · SQL method：<strong>{slip.payment_method_code || '未选择'}</strong></p>
    {accepted && <p role="status" className="mt-3 rounded bg-emerald-100 p-2 text-sm text-emerald-900">已保存此笔银行证据的人工确认。仍须通过当前 SQL／查重／日期及发票核对，再由授权人员 Approve；不会自动开 OR。</p>}
    {!sqlReady && <p role="alert" className="mt-3 text-sm font-semibold text-amber-900">先恢复并重试正常 SQL check。失败或旧的 SQL 结果不能确认收款 method；不能只依公司默认银行放行。</p>}
    <p className="mt-2 text-sm">请先在上方收款／OR 日期栏填写<strong>实际银行入账日</strong>，再记录以下依据。Finance 回复的日期不等于已核实的银行入账日。</p>
    <div className="mt-3 grid gap-3 md:grid-cols-2">
      <label className="text-sm font-medium">入账日期依据
        <select aria-label="Paperless receipt date evidence source" disabled={!editable} value={requestValue.receipt_date_source} onChange={e => change('receipt_date_source', e.target.value)} className={inputClass}>
          <option value="BANK_STATEMENT">银行流水／银行记录</option><option value="FINANCE_EXPLICIT_RECEIPT_DATE">原 Finance 讯息明确注明入账日期</option><option value="REVIEWER_CONFIRMED_BANK_DATE">审核人已核实银行入账日</option>
        </select>
      </label>
      <label className="text-sm font-medium">实际收款银行账号（须符合已选 SQL method）
        <input aria-label="Paperless receiving bank account" disabled={!editable} value={request.receiving_account || ''} onChange={e => change('receiving_account', e.target.value)} inputMode="numeric" maxLength={20} className={inputClass}/>
      </label>
      <label className="text-sm font-medium">日期核对详情（写明实际 YYYY-MM-DD 入账日）
        <textarea aria-label="Paperless receipt date evidence" disabled={!editable} value={request.receipt_date_evidence || ''} onChange={e => change('receipt_date_evidence', e.target.value)} maxLength={2000} className={inputClass}/>
      </label>
      <label className="text-sm font-medium">收款银行／账号核对详情
        <textarea aria-label="Paperless receiving bank evidence" disabled={!editable} value={request.receiving_bank_evidence || ''} onChange={e => change('receiving_bank_evidence', e.target.value)} maxLength={2000} className={inputClass}/>
      </label>
      <label className="text-sm font-medium">可追溯的银行记录／证据参考
        <input aria-label="Paperless bank evidence reference" disabled={!editable} value={request.evidence_reference || ''} onChange={e => change('evidence_reference', e.target.value)} maxLength={1000} className={inputClass}/>
      </label>
      <label className="text-sm font-medium">这笔 IBG 没有 slip 的处理说明
        <textarea aria-label="Paperless receipt review reason" disabled={!editable} value={request.reason || ''} onChange={e => change('reason', e.target.value)} maxLength={2000} className={inputClass}/>
      </label>
    </div>
    <label className="mt-4 flex items-start gap-2 text-sm font-medium">
      <input aria-label="Request paperless IBG bank evidence confirmation" type="checkbox" disabled={!editable || !complete} checked={checked}
        onChange={e => onChange({ ...requestValue, requested: e.target.checked,
          bank_verified_received: e.target.checked, bank_date_verified: e.target.checked,
          receiving_bank_verified: e.target.checked, only_this_receipt: e.target.checked, manual_approval_only: e.target.checked })}/>
      我已亲自核对实际到账、银行入账日及收款账号；以上证据只适用于这笔付款。按 Save 只保存人工审核依据，不会 Approve、自动开 OR 或核销。
    </label>
  </section>;
}
