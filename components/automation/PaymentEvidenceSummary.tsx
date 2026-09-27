import {useState} from 'react';
import {getRunFile} from '@/services/AgentsService';

type EvidenceMessage = {
  capture_event_id?: number;
  filenames?: string[];
  attachment_association?: {case_id?: number; run_id?: number; status?: string; reason?: string | null};
  ai_analysis?: {
    customer_name?: string | null;
    amount?: number | null;
    currency?: string | null;
    invoice_numbers?: string[];
    bank_references?: string[];
    evidence_summary?: string;
  };
};

export function PaymentEvidenceSummary({messages,archivedReceipts,runId}: {messages?: EvidenceMessage[]; archivedReceipts?: Array<{file_key:string;filename?:string}>;runId?:number}) {
  const [downloadError,setDownloadError]=useState('');
  async function download(file:{file_key:string;filename?:string}) {
    if(!runId)return;
    try {setDownloadError('');const blob=await getRunFile(runId,file.file_key);const url=URL.createObjectURL(blob);
      const anchor=document.createElement('a');anchor.href=url;anchor.download=file.filename||'receipt.pdf';anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    } catch(e){setDownloadError(e instanceof Error?e.message:'Receipt download failed');}
  }
  const evidence = (messages || []).filter(m => {
    const a = m.ai_analysis;
    return a && (a.customer_name || a.amount != null || a.invoice_numbers?.length || a.bank_references?.length);
  });
  return <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
    <h2 className="font-semibold">Detected payment details / 已识别付款资料</h2>
    {!!archivedReceipts?.length && <div className="my-3 rounded border p-3"><p className="font-semibold">Archived official receipts / 已归档收据</p>
      {archivedReceipts.map(file=><button key={file.file_key} type="button" className="mt-2 block text-cyan-700 underline" onClick={()=>void download(file)}>{file.filename||'Receipt PDF'}</button>)}
      {downloadError&&<p role="alert" className="text-red-700">{downloadError}</p>}</div>}
    <p className="mt-2 text-sm text-[var(--muted-foreground)]">These details are available before Finance confirms receipt. Check them against the original files. Multiple rows may describe the same payment; amounts are not added together.</p>
    <p className="mt-1 text-sm text-[var(--muted-foreground)]">资料已收到不代表款项已确认到账。以下按来源显示，同笔付款的重复消息不会相加。</p>
    {!evidence.length ? <p className="mt-3 text-sm">No payment details identified yet / 暂未识别到付款资料，请查看原始文件。</p> :
      <div className="mt-4 space-y-4">{evidence.map((m, i) => {
        const a = m.ai_analysis!;
        return <article key={m.capture_event_id ?? i} className="rounded-lg border border-[var(--border)] p-4 text-sm">
          <p className="font-semibold">{m.filenames?.join(', ') || 'Message / 文字消息'}</p>
          {m.attachment_association && <p className="mt-2 text-sm">
            {m.attachment_association.status === 'PENDING' ? 'Association pending / 待确认关联' :
              m.attachment_association.status === 'ARCHIVED_RECEIPT' ? 'Receipt archived / 回执已归档' : 'Linked / 已关联'}
            {' · Review #'}{m.attachment_association.run_id}
            {m.attachment_association.reason && <span className="block text-[var(--muted-foreground)]">{m.attachment_association.reason}</span>}
          </p>}
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
            <div><dt className="text-[var(--muted-foreground)]">Payer / message name · 付款方／消息名称</dt><dd>{a.customer_name || 'Not identified / 未识别'}</dd></div>
            <div><dt className="text-[var(--muted-foreground)]">Amount / 金额</dt><dd>{a.amount == null ? 'Not identified / 未识别' : `${a.currency || ''} ${Number(a.amount).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}`}</dd></div>
            <div><dt className="text-[var(--muted-foreground)]">Invoice / 发票号码</dt><dd>{a.invoice_numbers?.join(', ') || 'Not identified / 未识别'}</dd></div>
            <div><dt className="text-[var(--muted-foreground)]">Bank reference / 银行参考号</dt><dd>{a.bank_references?.join(', ') || 'Not identified / 未识别'}</dd></div>
          </dl>
          {a.evidence_summary && <p className="mt-3 whitespace-pre-wrap text-[var(--muted-foreground)]">{a.evidence_summary}</p>}
        </article>;
      })}</div>}
  </section>;
}
