import { sstSaveBlocker } from '@/utils/orderSstValidation';
import { useEffect, useState } from 'react';
import { getOrderSST, saveOrderSST, type AgentRun, type OrderSSTState } from '@/services/AgentsService';

export function OrderSSTConfirmation({run, disabled, onSaved, onState}: {run:AgentRun;disabled:boolean;onSaved:(run:AgentRun)=>void;onState?:(state:OrderSSTState|null)=>void}) {
  const [state,setState]=useState<OrderSSTState|null>(null);
  const [status,setStatus]=useState('UNVERIFIED');
  const [checkedOn,setCheckedOn]=useState(new Date().toLocaleDateString('en-CA'));
  const [note,setNote]=useState('');const [confirmed,setConfirmed]=useState(false);
  const [remember,setRemember]=useState(false);const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');const [notice,setNotice]=useState('');
  const identityData=run.corrected_data || run.extracted_data;
  const identityKey=JSON.stringify([run.id, identityData?.customer, identityData?.customer_code, identityData?.issuing_entity, identityData?.customer_registration_numbers, run.output_refs?.customer_sst_confirmation]);
  const blocker=sstSaveBlocker(disabled,busy,note,checkedOn,status,confirmed);
  useEffect(()=>{let active=true;setState(null);onState?.(null);
    getOrderSST(run.id).then(s=>{if(active){setState(s);onState?.(s);setStatus(s.status);setNote(s.confirmation?.note||s.suggestion?.confirmation.note||'');setCheckedOn(s.confirmation?.checked_on||new Date().toLocaleDateString('en-CA'));setConfirmed(false);setRemember(false);setError('');}}).catch(e=>{if(active)setError(e.message);});
    return()=>{active=false;};
  },[identityKey,onState,run.id]);
  async function save(){if(!state)return;setBusy(true);setError('');
    try{const updated=await saveOrderSST(run.id,{status,checked_on:checkedOn,note,confirmed,remember,expected_identity:state.identity});onSaved(updated);
      const fresh=await getOrderSST(run.id);setState(fresh);onState?.(fresh);setStatus(fresh.status);
      setNotice('已保存 SST 确认，金额已更新。请核对含税总额后，再由你提交开单。');
    }catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  async function applyPreviousDecision(){if(!state?.suggestion)return;setBusy(true);setError('');
    try{const suggestion=state.suggestion;const updated=await saveOrderSST(run.id,{status:suggestion.status,checked_on:suggestion.confirmation.checked_on,note:`沿用 Review #${suggestion.run_id} 的客户 SST 核查依据：${suggestion.confirmation.note}`,confirmed:true,remember:false,expected_identity:state.identity});onSaved(updated);
      const fresh=await getOrderSST(run.id);setState(fresh);onState?.(fresh);setStatus(fresh.status);setNotice('已确认沿用上次 SST 处理，并更新本单金额；尚未提交开单。');
    }catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  if(state&&!state.applicable)return null;
  return <section className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-slate-900 dark:bg-slate-900 dark:text-slate-100">
    <h3 className="font-semibold">客户 Group J / SST 人工确认</h3>
    <p className="mt-1">先到 <a href="https://sst01.customs.gov.my/account/inquiry" target="_blank" rel="noopener noreferrer" className="underline">MySST 查询客户注册状态</a>，再确认本单如何处理 SST。</p>
    {state&&<><p className="mt-2 font-medium">{state.status==='GROUP_J'?'已确认 Group J · 本单不加 SST':state.status==='NOT_GROUP_J'?`已确认非 Group J · 按配置加 SST ${state.rate}%`:'待查询 / 未确认'}{state.source==='SAVED_CUSTOMER'?'（来自已保存的客户记录）':''}</p>
    {state.confirmation&&<p className="mt-1 text-xs">上次核查：{state.confirmation.checked_on} · 确认人 ID {state.confirmation.confirmed_by_user_id} · {state.confirmation.note}</p>}
    {state.suggestion&&<div className="mt-3 rounded border border-cyan-300 bg-cyan-50 p-3 text-slate-900"><p>同一开票公司与客户的上次确认：Review #{state.suggestion.run_id} · {state.suggestion.status==='NOT_GROUP_J'?`非 Group J，加 SST ${state.configured_rate}%`:'Group J，不加 SST'}。</p><p className="mt-1 text-xs">核查日期：{state.suggestion.confirmation.checked_on} · {state.suggestion.confirmation.note}。请核对本单是否仍适用。</p><button type="button" disabled={disabled||busy} onClick={()=>void applyPreviousDecision()} className="mt-2 rounded bg-cyan-800 px-3 py-2 text-white disabled:opacity-50">确认本单沿用上次 SST 处理</button></div>}
    {state.summary&&<dl aria-label="SST amount summary" className="mt-3 grid grid-cols-2 gap-1 rounded bg-white p-3 text-slate-900"><dt>小计</dt><dd>RM {state.summary.subtotal_myr.toFixed(2)}</dd><dt>SST {state.summary.sst_rate}%{!state.ready?'（待确认）':''}</dt><dd>RM {state.summary.sst_amount_myr.toFixed(2)}</dd><dt className="font-semibold">含税总额 / Grand total</dt><dd className="font-semibold">RM {state.summary.grand_total_myr.toFixed(2)}</dd></dl>}
    <div className="mt-3 grid gap-3 md:grid-cols-2">
      <label>本次确认结果<select aria-label="SST confirmation result" value={status} onChange={e=>{setStatus(e.target.value);setConfirmed(false);}} disabled={disabled||busy} className="mt-1 block w-full rounded border p-2 dark:bg-slate-800">
        <option value="UNVERIFIED">待查询 / 暂不确认</option><option value="GROUP_J">已确认 Group J，本单不加 SST</option><option value="NOT_GROUP_J">非 Group J，按公司配置加 SST ({state.configured_rate}%)</option>
      </select></label>
      <label>核查日期<input aria-label="SST check date" type="date" value={checkedOn} onChange={e=>setCheckedOn(e.target.value)} disabled={disabled||busy} className="mt-1 block w-full rounded border p-2 dark:bg-slate-800"/></label>
    </div>
    <label className="mt-3 block">核查依据 / 备注（必填）<input aria-label="SST verification reference" required value={note} onChange={e=>setNote(e.target.value)} placeholder="例如：查询的公司注册号、MySST 查询结果" disabled={disabled||busy} className="mt-1 block w-full rounded border p-2 dark:bg-slate-800"/></label>
    <label className="mt-3 flex gap-2"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)} disabled={disabled||busy}/>我已核对客户身份，并确认本单适用以上 SST 处理。</label>
    <label className="mt-2 flex gap-2"><input type="checkbox" checked={remember} onChange={e=>setRemember(e.target.checked)} disabled={disabled||busy||!state.can_remember}/>记住此客户，供同一开票公司的以后订单使用。</label>
    {!state.can_remember&&<p className="mt-1 text-xs">新客户可先保存本单确认；保存客户 SQL code 或公司注册号后，才能记住供以后使用。</p>}
    {disabled&&<p className="mt-2 text-xs">请先保存客户 / 开票公司修改；已开票的单据不能修改 SST。</p>}
    {blocker&&<p role="status" className="mt-2 text-sm text-amber-800">{blocker}</p>}
    <button type="button" onClick={()=>void save()} disabled={!!blocker} className="mt-3 rounded bg-cyan-800 px-4 py-2 text-white disabled:opacity-50">{busy?'Saving…':'保存 SST 确认'}</button></>}
    {!state&&!error&&<p className="mt-2">Loading SST confirmation…</p>}{error&&<p role="alert" className="mt-2 text-red-700">{error}</p>}{notice&&<p className="mt-2">{notice}</p>}
  </section>;
}
