import {useState} from 'react';
import {AgentRun,resolvePayment,linkPaymentCase,analyzePaymentEvidence} from '@/services/AgentsService';

export function PaymentResolutionActions({run,busy,act}:{run:AgentRun;busy:boolean;act:(fn:()=>Promise<AgentRun>,message?:string)=>Promise<void>}) {
  const [action,setAction]=useState('MARK_EXTERNAL');
  const [reason,setReason]=useState('');
  const [orNo,setOrNo]=useState('');
  const [caseId,setCaseId]=useState('');
  const [funds,setFunds]=useState('UNCONFIRMED');
  const [task,setTask]=useState('MISSING_INVOICE');
  const [assignee,setAssignee]=useState('');
  const [due,setDue]=useState('');
  const data=(run.corrected_data||run.extracted_data||{}) as Record<string,unknown>;
  const resolution=(run.output_refs?.payment_resolution||{}) as {status?:string;reason?:string;or_no?:string;sql_verified?:boolean};
  const tasks=(data.payment_tasks||[]) as Array<{kind:string;status:string;due_at?:string;assignee?:string;reason?:string}>;
  const closed=['EXTERNALLY_HANDLED','REJECTED','COMPLETED','MERGED','DELIVERY_PENDING'].includes(run.status);
  return <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 space-y-3">
    <h2 className="font-semibold">处理结果与待办 / Resolution & follow-up</h2>
    {Boolean(run.output_refs?.linked_evidence_needs_review)&&!closed&&<div className="rounded border border-amber-300 bg-amber-50 p-3 text-amber-950"><p>补充 Case 已关联。请重新分析已关联资料并核对金额、单号；关联本身不会自动核销。</p><button type="button" disabled={busy||run.status==='EXTRACTING'} onClick={()=>void act(()=>analyzePaymentEvidence(run.id))} className="underline">分析已关联资料 / Analyze linked evidence</button></div>}
    {resolution.status&&<p>{resolution.status==='EXTERNALLY_HANDLED'?'已由 PIC 在系统外处理，禁止重复创建 OR；SQL OR 尚待核实。':`已排除：${resolution.status}`} {resolution.or_no&&`OR: ${resolution.or_no}`} {resolution.reason}</p>}
    {tasks.map((t,i)=><div key={i} className="rounded border p-2 text-sm">{t.status} · {t.kind} · {t.assignee||'PIC'} {t.due_at&&new Date(t.due_at).toLocaleString()}<p>{t.reason}</p></div>)}
    {!closed&&<form className="space-y-3" onSubmit={e=>{e.preventDefault();void act(()=>action==='LINK_CASE'?linkPaymentCase(run.id,Number(caseId.replace(/^PAY-/i,'')),reason):resolvePayment(run.id,{action,reason,or_no:orNo||undefined,funds_status:action==='CORRECT_RECEIPT'?funds:undefined,task_kind:['FOLLOW_UP','RESOLVE_TASK'].includes(action)?task:undefined,assignee:assignee||undefined,due_at:action==='FOLLOW_UP'&&due?new Date(due).toISOString():undefined}));}}>
      <select aria-label="Payment action" value={action} onChange={e=>setAction(e.target.value)} className="border rounded p-2 w-full">
        <option value="MARK_EXTERNAL">PIC 已手工核销 / Handled externally</option><option value="IGNORE">忽略 / Noise</option><option value="PAYABLE">这是应付 / Payable</option><option value="CORRECT_RECEIPT">更正收款确认</option><option value="LINK_CASE">关联已有 PAY Case</option><option value="FOLLOW_UP">建立待办 / Follow-up</option><option value="RESOLVE_TASK">完成待办</option>
      </select>
      {action==='MARK_EXTERNAL'&&<input aria-label="Existing OR number" placeholder="已有 OR 号码（可稍后核实）" value={orNo} onChange={e=>setOrNo(e.target.value)} className="border rounded p-2 w-full"/>}
      {action==='LINK_CASE'&&<input required aria-label="Source case" placeholder="补充资料的 Case，例如 PAY-00201" value={caseId} onChange={e=>setCaseId(e.target.value)} className="border rounded p-2 w-full"/>}
      {action==='CORRECT_RECEIPT'&&<select aria-label="Correct receipt status" value={funds} onChange={e=>setFunds(e.target.value)} className="border rounded p-2 w-full"><option value="UNCONFIRMED">需重新核实</option><option value="NOT_RECEIVED">尚未收到款</option><option value="CONFIRMED_RECEIVED">已确认收到款（凭证另外检查）</option></select>}
      {['FOLLOW_UP','RESOLVE_TASK'].includes(action)&&<select aria-label="Task type" value={task} onChange={e=>setTask(e.target.value)} className="border rounded p-2 w-full"><option value="MISSING_CUSTOMER">Identify paying customer</option><option value="MISSING_INVOICE">请 PIC 补 invoice 单号</option><option value="MISSING_SLIP">补付款 slip</option><option value="CHECK_RECEIPT">核实是否到账</option><option value="VERIFY_EXISTING_OR">核对已有 OR</option></select>}
      {action==='FOLLOW_UP'&&<div className="flex gap-2"><input required aria-label="Responsible PIC" placeholder="负责 PIC" value={assignee} onChange={e=>setAssignee(e.target.value)} className="border rounded p-2"/><input required aria-label="Due time" type="datetime-local" value={due} onChange={e=>setDue(e.target.value)} className="border rounded p-2"/></div>}
      <textarea required maxLength={2000} aria-label="Reason" placeholder="处理原因／更正说明（保留记录）" value={reason} onChange={e=>setReason(e.target.value)} className="border rounded p-2 w-full"/>
      <p className="text-xs text-[var(--muted-foreground)]">此操作只更新审核记录，不会创建 OR 或发送群消息。待办会保留在系统内。</p>
      <button disabled={busy||!reason.trim()} className="rounded bg-cyan-700 text-white px-4 py-2 disabled:opacity-50">保存处理结果</button>
    </form>}
  </section>;
}
