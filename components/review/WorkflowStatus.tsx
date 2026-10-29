import Link from 'next/link';

type Notice = {code?:string; title?:string; message?:string; file_count?:number;
  matches?:Array<{run_id:number;invoice_no?:string;delivery_order_no?:string;status?:string}>};
export function WorkflowStatus({refs}: {refs?:Record<string,unknown>|null}) {
  const status=refs?.support_status as Notice|undefined;
  const evidence=refs?.evidence_status as Notice|undefined;
  if(!status&&!evidence)return null;
  return <div className="my-4 space-y-3" aria-live="polite">
    {[status,evidence].filter(Boolean).map((item,i)=><section key={i} className={`rounded-xl border p-4 text-sm ${item?.code==='SQL_SAVED'?'border-emerald-300 bg-emerald-50 text-emerald-950':'border-amber-300 bg-amber-50 text-amber-950'}`}>
      <p className="font-semibold">{item?.title}{item?.file_count?` · ${item.file_count} 份文件`:''}</p>
      <p className="mt-1">{item?.message}</p>
      {item?.matches?.map(m=><Link key={m.run_id} href={`/agents/runs/${m.run_id}`} className="mt-2 block underline">Review #{m.run_id} · {m.delivery_order_no||m.invoice_no||'原请求待对账'}{m.invoice_no&&m.delivery_order_no?` / ${m.invoice_no}`:''}</Link>)}
    </section>)}
  </div>;
}
