'use client';
import {useEffect,useRef,useState} from 'react';
import {AppLayout} from '@/components/layout';
import {useOrganization} from '@/lib/OrganizationContext';
import {studio,studioPreview,type FormatTemplate,type FormatProposal} from '@/services/TemplateStudioService';

export default function TemplateStudio(){
  const {selectedOrganizationId}=useOrganization();
  const [items,setItems]=useState<FormatTemplate[]>([]),[selected,setSelected]=useState<number>(),[canApply,setCanApply]=useState(false);
  const [message,setMessage]=useState(''),[sample,setSample]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
  const [active,setActive]=useState<string>(),[url,setUrl]=useState(''),[checked,setChecked]=useState(false);
  const generation=useRef(0), previewUrl=useRef('');
  const template=items.find(t=>t.id===selected),proposal=template?.proposals.find(p=>p.id===active);
  function clearPreview(){if(previewUrl.current)URL.revokeObjectURL(previewUrl.current);previewUrl.current='';setUrl('');setChecked(false);}
  async function refresh(epoch=generation.current){const result=await studio<{items:FormatTemplate[];can_apply:boolean}>();if(epoch===generation.current){setItems(result.items);setCanApply(result.can_apply);}}
  useEffect(()=>{const epoch=++generation.current;clearPreview();setItems([]);setSelected(undefined);setActive(undefined);setNotice('');setError('');refresh(epoch).catch(e=>{if(epoch===generation.current)setError(e.message);});return()=>{generation.current++;if(previewUrl.current)URL.revokeObjectURL(previewUrl.current);};},[selectedOrganizationId]);
  async function execute(work:()=>Promise<void>){setBusy(true);setError('');try{await work();}catch(e){setError(e instanceof Error?e.message:'操作未完成。');}finally{setBusy(false);}}
  async function send(){if(!template||!message.trim())return;const source=template.id,base=template.hash,epoch=generation.current;clearPreview();await execute(async()=>{const result=await studio<{proposal_id?:string;explanation:string}>(`/${source}/proposals`,{message,expected_hash:base});if(epoch!==generation.current)return;setNotice(result.explanation);setMessage('');await refresh(epoch);setActive(result.proposal_id);});}
  async function preview(){if(!template||!proposal||!/^\d+$/.test(sample))return;const source=template.id,pid=proposal.id,epoch=generation.current;clearPreview();await execute(async()=>{await studio(`/${source}/proposals/${pid}/preview`,{run_id:Number(sample)});const blob=await studioPreview(source,pid);if(epoch!==generation.current)return;const href=URL.createObjectURL(blob);previewUrl.current=href;setUrl(href);await refresh(epoch);});}
  async function confirm(){if(!template||!proposal||!checked||!proposal.preview_hash||!url)return;const source=template.id,epoch=generation.current;await execute(async()=>{await studio(`/${source}/proposals/${proposal.id}/confirm`,{expected_hash:template.hash,preview_hash:proposal.preview_hash,confirmed:true});if(epoch!==generation.current)return;clearPreview();setActive(undefined);setNotice('格式已保存为新版本，将用于之后生成的 PDF。已发送的文件不会自动重发。');await refresh(epoch);});}
  async function rollback(version:number){if(!template)return;const source=template.id,epoch=generation.current;clearPreview();await execute(async()=>{const result=await studio<{proposal_id:string;explanation:string}>(`/${source}/rollback`,{version,expected_hash:template.hash});if(epoch!==generation.current)return;await refresh(epoch);setActive(result.proposal_id);setNotice(result.explanation);});}
  return <AppLayout pageName="格式聊天室"><div className="mx-auto max-w-6xl space-y-5 p-5">
    <header><h1 className="text-2xl font-semibold">PDF 格式聊天室</h1><p className="mt-2 text-sm text-[var(--muted-foreground)]">选择公司及模板，描述格式修改，预览后确认保存。支持字号、栏宽、换行、行距、对齐和单价显示小数位。</p></header>
    <p className="rounded-xl border p-4 text-sm">金额、数量、客户、银行账号及 SQL 过账资料请在对应资料页面处理。这里的预览使用已有 Review，保存格式不会开单或重发文件。</p>
    <label className="block text-sm font-medium">公司 / 单据 / 银行版本<select disabled={busy} className="mt-2 block w-full rounded-lg border bg-[var(--background)] p-3" value={selected||''} onChange={e=>{generation.current++;clearPreview();setSelected(Number(e.target.value)||undefined);setActive(undefined);setNotice('');setError('');}}><option value="">请选择模板</option>{items.map(t=><option key={t.id} value={t.id}>{t.entity} · {t.document_type} · {t.variant||'Default'} · v{t.version}</option>)}</select></label>
    {error&&<p role="alert" className="rounded-lg bg-red-50 p-4 text-red-800">{error}</p>}
    {notice&&<p role="status" className="whitespace-pre-wrap rounded-lg bg-cyan-50 p-4 text-cyan-950">{notice}</p>}
    {template&&<div className="grid gap-5 lg:grid-cols-2"><section className="space-y-4 rounded-xl border p-4"><h2 className="font-semibold">描述想改的格式</h2>
      <div className="max-h-72 space-y-3 overflow-auto">{template.proposals.slice(-10).map(p=><article key={p.id} className="rounded-lg border p-3 text-sm"><p className="font-medium">{p.message}</p><p className="mt-2 whitespace-pre-wrap">{p.explanation}</p>{p.applied_version!==undefined?<p className="mt-2 text-emerald-700">已保存 · v{p.applied_version}</p>:<button disabled={busy} className="mt-2 underline" onClick={()=>{clearPreview();setActive(p.id);setNotice(p.explanation);}}>查看建议</button>}</article>)}</div>
      <textarea aria-label="格式修改要求" className="min-h-28 w-full rounded-lg border bg-[var(--background)] p-3" disabled={busy} maxLength={2000} value={message} onChange={e=>setMessage(e.target.value)} placeholder="例如：描述栏字号改成 10，单价显示两位小数"/>
      <button disabled={busy||!message.trim()} onClick={()=>void send()} className="rounded-lg bg-cyan-800 px-4 py-2 text-white disabled:opacity-50">{busy?'处理中…':'生成格式建议'}</button>
      {proposal&&proposal.applied_version===undefined&&<section className="space-y-3 border-t pt-4"><h3 className="font-semibold">预览本次修改</h3><ul className="list-inside list-disc text-sm">{proposal.changes.map((c,i)=><li key={i}>{c.source} · {c.property} → {c.value}</li>)}</ul>
        <label className="block text-sm">使用此模板的 Review 编号<input aria-label="预览 Review 编号" value={sample} onChange={e=>{clearPreview();setSample(e.target.value);}} inputMode="numeric" className="mt-1 block w-full rounded-lg border bg-[var(--background)] p-2" placeholder="例如 2761"/></label>
        <button disabled={busy||!/^\d+$/.test(sample)} onClick={()=>void preview()} className="rounded-lg border px-4 py-2 disabled:opacity-50">生成 PDF 预览</button>
        {url&&<><label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={checked} onChange={e=>setChecked(e.target.checked)}/>我已查看本次 PDF，确认保存到这个公司、单据和银行版本的模板。</label><button disabled={busy||!checked||!canApply} onClick={()=>void confirm()} className="rounded-lg bg-emerald-800 px-4 py-2 text-white disabled:opacity-50">确认保存新版本</button></>}
        {!canApply&&<p className="text-sm text-amber-800">你可以生成建议和预览；保存及还原需要公司管理员确认。</p>}
      </section>}
    </section><section className="space-y-4"><div className="min-h-80 rounded-xl border p-3">{url?<><a href={url} target="_blank" rel="noreferrer" className="mb-2 block text-sm underline">打开 PDF 预览</a><iframe title="本次格式 PDF 预览" src={url} className="h-[650px] w-full bg-white"/></>:<p className="p-6 text-sm text-[var(--muted-foreground)]">格式建议不会立即生效。生成 PDF 后，在这里检查排版。</p>}</div><section className="rounded-xl border p-4"><h2 className="font-semibold">版本记录</h2>{!template.history.length&&<p className="mt-2 text-sm">当前为原始模板，首次保存时会保留原版本。</p>}{[...template.history].reverse().map(v=><div key={v.version} className="mt-3 border-t pt-3 text-sm"><p>v{v.version} · {v.at?.slice(0,16).replace('T',' ')} UTC · 用户 #{v.actor_id}</p><p className="my-1">{v.reason}</p>{canApply&&v.version!==template.version&&<button disabled={busy} className="underline" onClick={()=>void rollback(v.version)}>准备还原并预览</button>}</div>)}</section></section></div>}
  </div></AppLayout>;
}
