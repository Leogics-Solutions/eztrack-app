import {useState} from 'react';
import {AgentRun,resolvePayment,linkPaymentCase,analyzePaymentEvidence,stopPaymentForManualHandoff,attestPaymentManualHandoff} from '@/services/AgentsService';

export function PaymentResolutionActions({run,busy,act}:{run:AgentRun;busy:boolean;act:(fn:()=>Promise<AgentRun>,message?:string)=>Promise<void>}) {
  const [action,setAction]=useState('MARK_EXTERNAL');
  const [related,setRelated]=useState('');
  const [stopReason,setStopReason]=useState('');
  const [pic,setPic]=useState('');
  const [nativeNote,setNativeNote]=useState('');
  const [attestChecks,setAttestChecks]=useState([false,false,false,false]);
  const [stopConfirmed,setStopConfirmed]=useState(false);
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
  const handoff=(run.output_refs?.payment_manual_handoff||{}) as {id?:string;status?:string;reason?:string;run_ids?:number[];manual_SQL_permission?:boolean;human_attestation_available?:boolean;group_scope_fingerprints?:Record<string,string>;pic_name?:string};
  const held=['STOPPED_AWAITING_NATIVE_CHECK','MANUAL_READY','HUMAN_ATTESTED_MANUAL_HANDOFF','OR_REPORTED_UNVERIFIED','RECONCILIATION_REQUIRED'].includes(handoff.status||'');
  const closed=['EXTERNALLY_HANDLED','REJECTED','COMPLETED','MERGED','DELIVERY_PENDING'].includes(run.status);
  return <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 space-y-3">
    <h2 className="font-semibold">处理结果与待办 / Resolution & follow-up</h2>
    {Boolean(run.output_refs?.linked_evidence_needs_review)&&!closed&&!held&&<div className="rounded border border-amber-300 bg-amber-50 p-3 text-amber-950"><p>补充 Case 已关联。请重新分析已关联资料并核对金额、单号；关联本身不会自动核销。</p><button type="button" disabled={busy||run.status==='EXTRACTING'} onClick={()=>void act(()=>analyzePaymentEvidence(run.id))} className="underline">分析已关联资料 / Analyze linked evidence</button></div>}
    {!closed&&!held&&<div className="space-y-2 rounded border border-amber-400 p-3">
      <h3 className="font-semibold">准备人手处理前，先停止系统处理 / Stop before manual handling</h3>
      <p className="text-sm">停止只暂停系统，不代表已核销，也不代表可以立即在 SQL 开 OR。仍须先核实没有原 OR 或在途/未知结果，并收到系统的人工处理许可。</p>
      <input aria-label="Related Review IDs" value={related} onChange={e=>setRelated(e.target.value)} placeholder="关联 Review 编号，逗号分隔；不确定勿猜" className="w-full rounded border p-2"/>
      <textarea required maxLength={2000} aria-label="Manual handoff reason" value={stopReason} onChange={e=>setStopReason(e.target.value)} placeholder="停止原因及负责人 PIC；只暂停系统，等待核实" className="w-full rounded border p-2"/>
      <label className="block text-sm"><input type="checkbox" checked={stopConfirmed} onChange={e=>setStopConfirmed(e.target.checked)} disabled={busy}/> 我确认先停止上述 Review 的自动处理，并等待 SQL 核实后才人手开单。</label>
      <button type="button" disabled={busy||!stopConfirmed||!stopReason.trim()||!run.updated_at||!/^\s*(?:[1-9]\d*(?:\s*,\s*[1-9]\d*)*)?\s*$/.test(related)} onClick={()=>void act(()=>stopPaymentForManualHandoff(run.id,run.updated_at!,stopReason,related.split(',').map(v=>Number(v.trim())).filter(Boolean)))} className="rounded border px-3 py-2 disabled:opacity-50">停止自动处理，等待人工核实 / Stop automatic handling</button>
    </div>}
    {held&&<div role="status" className="space-y-2 rounded border border-amber-500 bg-amber-50 p-3 text-amber-950">
      <h3 className="font-semibold">已停止系统自动处理 / Automatic handling stopped</h3>
      <p>关联 Review：{handoff.run_ids?.join(', ')}。{handoff.reason}</p>
      <p>{handoff.status==='RECONCILIATION_REQUIRED'?'关联 Review 已报人手 OR，所有关联人工开单许可已停止。先核对这笔 OR 涵盖哪些实际付款和核销；本 Review 并未被视为已完成，请勿再开另一张 OR。':handoff.status==='HUMAN_ATTESTED_MANUAL_HANDOFF'?`PIC ${handoff.pic_name||''} 已自行核对并接手；这是人工声明，系统没有证明 SQL 无重复。系统继续禁止自动开单。`:handoff.status==='MANUAL_READY'?'已记录本笔完整 SQL 核实；只由指定 PIC 处理一次，完成后记录实际 OR 和核销。系统仍保持停止。':handoff.status==='OR_REPORTED_UNVERIFIED'?'已报人手 OR，禁止自动重复开单；SQL 实际结果仍待独立核实。':'SQL 尚未证明没有原 OR 或在途结果。现在不要人手开 OR；停止记录本身不是开单许可。'}</p>
    </div>}
    {resolution.status&&<p>{resolution.status==='EXTERNALLY_HANDLED'?'已由 PIC 在系统外处理，禁止重复创建 OR；SQL OR 尚待核实。':`已排除：${resolution.status}`} {resolution.or_no&&`OR: ${resolution.or_no}`} {resolution.reason}</p>}
    {!closed&&handoff.status==='STOPPED_AWAITING_NATIVE_CHECK'&&<form className="space-y-3 rounded border border-amber-500 p-3" onSubmit={e=>{e.preventDefault();void act(()=>attestPaymentManualHandoff(run.id,{
      handoff_id:handoff.id,expected_run_ids:handoff.run_ids,expected_scope_fingerprints:handoff.group_scope_fingerprints,
      pic_name:pic,native_check_note:nativeNote,checked_native_company_customer_date_amount_reference:attestChecks[0],
      checked_no_existing_OR_or_allocation:attestChecks[1],checked_bank_credit_received:attestChecks[2],one_PIC_will_handle_once_and_record_OR:attestChecks[3],
    }));}}>
      <h3 className="font-semibold">PIC 自行在 SQL 核对后接手 / Human-attested manual handling</h3>
      <p className="text-sm">连接器离线时，可由授权 PIC 自己在 SQL／银行记录核对。系统只记录人工声明，不会声称已查询 SQL 或证明无重复；所有关联 Review 继续禁止自动开单。已存在、已尝试或未知结果的付款不适用。</p>
      {!handoff.human_attestation_available&&<p role="alert">缺少客户 Code、明确日期/金额或稳定的原始交易身份；先核对资料，不能在这里授予人工接手。</p>}
      <input required aria-label="Designated manual PIC" value={pic} onChange={e=>setPic(e.target.value)} placeholder="唯一负责人 PIC 姓名" className="w-full rounded border p-2"/>
      <textarea required minLength={20} maxLength={2000} aria-label="Native SQL manual check details" value={nativeNote} onChange={e=>setNativeNote(e.target.value)} placeholder="具体写明在 SQL 核对的公司、客户 Code、到账日期、金额、银行参考及查重结果" className="w-full rounded border p-2"/>
      {['我已在正确 SQL 公司核对客户 Code、日期、金额及银行参考／原始凭证。','我已核对没有原 OR、已有核销或在途／未知结果；如果找到原 OR，就不再开新 OR。','我已核对银行实际到账；不会把待批准／未清算凭证当成到账。','只有指定 PIC 处理一次，完成后马上在本 Review 记录实际 OR 及 allocation；不会再按 Approve。'].map((label,i)=><label key={i} className="block text-sm"><input type="checkbox" aria-label={`Manual attestation ${i+1}`} disabled={busy||!handoff.human_attestation_available} checked={attestChecks[i]} onChange={e=>setAttestChecks(values=>values.map((value,n)=>n===i?e.target.checked:value))}/>{label}</label>)}
      <button disabled={busy||!handoff.human_attestation_available||!pic.trim()||nativeNote.trim().length<20||!attestChecks.every(Boolean)} className="rounded border px-3 py-2 disabled:opacity-50">记录 PIC 已自行核对并接手 / Record human-attested handoff</button>
    </form>}
    {!closed&&['MANUAL_READY','HUMAN_ATTESTED_MANUAL_HANDOFF'].includes(handoff.status||'')&&<form className="space-y-2" onSubmit={e=>{e.preventDefault();void act(()=>resolvePayment(run.id,{action:'MARK_EXTERNAL',reason,or_no:orNo}));}}>
      <h3 className="font-semibold">完成后记录实际人工 OR / Record the actual manual OR</h3>
      <input required aria-label="Manual OR saved after handoff" value={orNo} onChange={e=>setOrNo(e.target.value)} placeholder="完整 OR 单号；实际已保存才填写" className="w-full rounded border p-2"/>
      <textarea required maxLength={2000} aria-label="Manual result details" value={reason} onChange={e=>setReason(e.target.value)} placeholder="公司、客户、金额、日期、已核销单号/金额及 PIC" className="w-full rounded border p-2"/>
      <button disabled={busy||!orNo.trim()||!reason.trim()} className="rounded border px-3 py-2 disabled:opacity-50">记录已人手处理，保持禁止重复开 OR</button>
      <p className="text-sm">此报告不会创建 OR，也不是 SQL 核实证明。后续须核对原 OR 及 allocation；不要再次按 Approve。</p>
    </form>}
    {tasks.map((t,i)=><div key={i} className="rounded border p-2 text-sm">{t.status} · {t.kind} · {t.assignee||'PIC'} {t.due_at&&new Date(t.due_at).toLocaleString()}<p>{t.reason}</p></div>)}
    {!closed&&!held&&<form className="space-y-3" onSubmit={e=>{e.preventDefault();void act(()=>action==='LINK_CASE'?linkPaymentCase(run.id,Number(caseId.replace(/^PAY-/i,'')),reason):resolvePayment(run.id,{action,reason,or_no:orNo||undefined,funds_status:action==='CORRECT_RECEIPT'?funds:undefined,task_kind:['FOLLOW_UP','RESOLVE_TASK'].includes(action)?task:undefined,assignee:assignee||undefined,due_at:action==='FOLLOW_UP'&&due?new Date(due).toISOString():undefined}));}}>
      <select aria-label="Payment action" value={action} onChange={e=>setAction(e.target.value)} className="border rounded p-2 w-full">
        <option value="MARK_EXTERNAL">PIC 已手工核销 / Handled externally</option>{!held&&<><option value="IGNORE">忽略 / Noise</option><option value="PAYABLE">这是应付 / Payable</option><option value="CORRECT_RECEIPT">更正收款确认</option><option value="LINK_CASE">关联已有 PAY Case</option><option value="FOLLOW_UP">建立待办 / Follow-up</option><option value="RESOLVE_TASK">完成待办</option></>}
      </select>
      {action==='MARK_EXTERNAL'&&<input aria-label="Existing OR number" required placeholder="实际已保存的完整 OR 单号；不能填写计划或预计" value={orNo} onChange={e=>setOrNo(e.target.value)} className="border rounded p-2 w-full"/>}
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
