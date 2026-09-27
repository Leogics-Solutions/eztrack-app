import {useCallback,useEffect,useState} from 'react';
import Link from 'next/link';
import {AppLayout} from '@/components/layout';
import {useOrganization} from '@/lib/OrganizationContext';
import {listPaymentFollowUps,resolvePayment,updatePaymentCaseTask,PaymentFollowUp} from '@/services/AgentsService';

const labels:Record<string,string>={MISSING_CUSTOMER:'Identify paying customer',CHECK_RECEIPT:'核实到账',MISSING_INVOICE:'补 invoice 单号',MISSING_SLIP:'补付款 slip',VERIFY_EXISTING_OR:'核对已有 OR'};
export default function PaymentFollowUps() {
  const {selectedOrganizationId}=useOrganization();
  const [items,setItems]=useState<PaymentFollowUp[]>([]);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const [selected,setSelected]=useState<PaymentFollowUp|null>(null);
  const [reason,setReason]=useState('');
  const [assignee,setAssignee]=useState('');
  const [due,setDue]=useState('');
  const load=useCallback(async()=>{setBusy(true);setError('');try{setItems((await listPaymentFollowUps()).items);}catch(e){setError(e instanceof Error?e.message:'Could not load follow-ups');}finally{setBusy(false);}},[]);
  useEffect(()=>{setSelected(null);void load();},[load,selectedOrganizationId]);
  async function save(action:string) {
    if(!selected)return;
    setBusy(true);setError('');
    try {
      const body={action,reason,task_kind:selected.kind,assignee,due_at:action==='FOLLOW_UP'?new Date(due).toISOString():undefined};
      if(selected.run_id)await resolvePayment(selected.run_id,body);
      else if(selected.case_id)await updatePaymentCaseTask(selected.case_id,body);
      setSelected(null);await load();
    }catch(e){setError(e instanceof Error?e.message:'Could not save follow-up');}finally{setBusy(false);}
  }
  return <AppLayout pageName="Payment follow-ups"><div className="space-y-5">
    <Link href="/review" className="text-cyan-700">← Back to Review</Link>
    <h1 className="text-2xl font-semibold">付款待办 / Payment follow-ups</h1>
    <p>等待补资料、核实到账或核对已有 OR。普通待办只保留在系统内；明确标为自动引用追问的项目会按排程发群消息，不会创建 OR。</p>
    <button disabled={busy} onClick={()=>void load()} className="border rounded px-4 py-2">{busy?'Loading…':'Refresh'}</button>
    {error&&<p role="alert" className="text-red-700">{error}</p>}
    {!busy&&!items.length&&<p>No open follow-ups.</p>}
    <div className="space-y-3">{items.map((item,i)=><article key={`${item.run_id||item.case_id}-${item.kind}-${i}`} className="border rounded-xl p-4 space-y-2">
      <p className="font-semibold">{labels[item.kind]||item.kind} · {item.run_id?<Link className="text-cyan-700 underline" href={`/agents/runs/${item.run_id}`}>Review #{item.run_id}</Link>:`PAY-${String(item.case_id).padStart(5,'0')}`}</p>
      <p>{item.reason}</p><p className="text-sm">PIC: {item.assignee||'待指定'} · Due: {item.due_at?new Date(item.due_at).toLocaleString():'待安排'}</p>
      {item.delivery_mode==='NATIVE_QUOTE'&&<p className="text-sm text-cyan-700">自动原生引用追问 · 每 {item.interval_hours||24} 小时 · {item.schedule_status||'scheduled'} · 客户确认后自动停止</p>}
      {item.kind==='VERIFY_EXISTING_OR'?<p className="text-sm">已报告人工处理，SQL OR 尚待核对。不能仅以“完成待办”代替 OR 验证。</p>:<button className="text-cyan-700 underline" onClick={()=>{setSelected(item);setReason('');setAssignee(item.assignee||'');setDue('');}}>安排 / 完成待办</button>}
    </article>)}</div>
    {selected&&<form className="border rounded-xl p-4 space-y-3" onSubmit={e=>{e.preventDefault();void save('FOLLOW_UP');}}>
      <p className="font-semibold">{labels[selected.kind]} · {selected.run_id?`Review #${selected.run_id}`:`PAY-${selected.case_id}`}</p>
      <input aria-label="PIC" required value={assignee} onChange={e=>setAssignee(e.target.value)} placeholder="负责 PIC" className="border rounded p-2 mr-3"/>
      <input aria-label="Due date" required type="datetime-local" value={due} onChange={e=>setDue(e.target.value)} className="border rounded p-2"/>
      <textarea aria-label="Reason" required value={reason} onChange={e=>setReason(e.target.value)} placeholder="安排／处理说明" className="border rounded p-2 w-full"/>
      <div className="flex gap-3"><button disabled={busy} className="border rounded px-3 py-2">保存安排</button><button type="button" disabled={busy||!reason.trim()} onClick={()=>void save('RESOLVE_TASK')} className="border rounded px-3 py-2">标记待办完成</button><button type="button" onClick={()=>setSelected(null)}>取消</button></div>
    </form>}
  </div></AppLayout>;
}
