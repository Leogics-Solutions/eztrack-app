import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getSqlQueue, type SqlQueueSnapshot, type SqlQueueItem } from '@/services/AgentsService';
import { sqlQueueType, sqlQueueState, sqlQueueTime, sqlQueueStage } from '@/utils/sqlQueueView';

export function SqlQueuePanel({runId}: {runId: number}) {
  const [open,setOpen]=useState(false);
  const [snapshot,setSnapshot]=useState<SqlQueueSnapshot | null>(null);
  const [error,setError]=useState('');
  const [offset,setOffset]=useState(0);
  const [refresh,setRefresh]=useState(0);
  useEffect(()=>{
    if (!open) return;
    let stopped=false;
    let timer: ReturnType<typeof setTimeout>;
    const controller=new AbortController();
    const poll=async()=>{
      try {
        const result=await getSqlQueue(offset,controller.signal);
        if (stopped) return;
        setSnapshot(result);setError('');
      } catch { if (!stopped) setError('Could not refresh the queue. Showing the last retrieved snapshot. / 未能更新队列，以下可能是旧资料。'); }
      if (!stopped) timer=setTimeout(poll,5000);
    };
    void poll();
    return ()=>{stopped=true;controller.abort();clearTimeout(timer);};
  },[open,offset,refresh,runId]);
  function rows(items: SqlQueueItem[]) {
    return items.map((item,index)=><tr key={item.id || `restricted-${index}`} className={item.review_ids?.includes(runId)?'bg-cyan-100/70 dark:bg-cyan-900/40':''}>
      <td className="p-2 align-top"><b>{item.queue_position ?? '—'}</b><p>{sqlQueueState(item.state)}</p>{item.stage && <p className="mt-1 text-xs">{sqlQueueStage(item.stage)}</p>}</td>
      <td className="p-2 align-top">{sqlQueueType(item)}{(item.set_count || 0)>1 && <p className="text-xs">{item.set_count} sets / 份</p>}</td>
      <td className="p-2 align-top">{item.restricted?'Private / 隐私':item.review_ids?.length?<div className="flex max-w-64 flex-wrap gap-2">{item.review_ids.map(id=><Link key={id} href={`/review/${id}`} className="underline">#{id}{id===item.current_review_id?' ▶':''}{id===runId?' (this Review)':''}</Link>)}</div>:'Review unavailable'}{item.company && <p className="mt-1 text-xs">{item.company}</p>}{item.customer && <p className="text-xs">→ {item.customer}</p>}</td>
      <td className="p-2 align-top">{item.restricted?'—':<>{item.automatic && <p className="font-medium">Automatic / 自动任务</p>}{item.submitted_by || 'Unknown'}</>}</td>
      <td className="p-2 align-top whitespace-nowrap">{sqlQueueTime(item.submitted_at)}{item.started_at && <p className="text-xs">Started / 开始: {sqlQueueTime(item.started_at)}</p>}{item.state==='SCHEDULED' && <p className="text-xs">Earliest / 最早: {sqlQueueTime(item.scheduled_for)}</p>}{item.completed_at && <p className="text-xs">Finished / 结束: {sqlQueueTime(item.completed_at)}</p>}</td>
    </tr>);
  }
  function table(items: SqlQueueItem[]) {
    return <div className="overflow-x-auto"><table className="w-full min-w-[740px] text-left text-sm"><thead><tr className="border-b"><th className="p-2">Position / State<br/>顺位／状态</th><th className="p-2">Request / 请求</th><th className="p-2">Review / 公司</th><th className="p-2">Submitted by<br/>提交账号</th><th className="p-2">Time (Malaysia)<br/>马来西亚时间</th></tr></thead><tbody className="divide-y">{rows(items)}</tbody></table></div>;
  }
  return <details className="my-3 rounded border border-cyan-300 bg-[var(--card)] p-3" onToggle={event=>setOpen(event.currentTarget.open)}>
    <summary className="cursor-pointer text-sm font-semibold">View SQL queue & recent requests / 查看 SQL 队列及最近记录</summary>
    {open && <div className="mt-3 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm"><p>Orders, ORs and payment checks share this queue. One request may contain multiple sets. / 订单、OR 与付款查询共用队列，一笔请求可包含多份。</p><button type="button" className="rounded border px-3 py-1" onClick={()=>setRefresh(value=>value+1)}>Refresh / 刷新</button></div>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {!snapshot && !error && <p role="status">Loading queue / 正在读取队列…</p>}
      {snapshot && <><p className="text-sm">Processing / 处理中: <b>{snapshot.running_count}</b> · Queued / 排队中: <b>{snapshot.queued_count}</b> · Scheduled / 等批次: <b>{snapshot.scheduled_count}</b>{snapshot.attention_count>0 && <> · Needs attention / 需检查: <b>{snapshot.attention_count}</b></>}</p><p className="text-xs">Updated / 更新: {sqlQueueTime(snapshot.updated_at)} · Refreshes every 5 seconds while open. / 展开时每5秒更新。</p>
        {snapshot.items.length?table(snapshot.items):<p className="text-sm">{snapshot.total_active?'No requests on this page. Return to the first page. / 请返回第一页。':'No active SQL requests / 当前没有 SQL 排队请求。'}</p>}
        {(offset>0 || snapshot.has_more) && <div className="flex items-center gap-3 text-sm"><button type="button" disabled={offset===0} className="rounded border px-2 py-1 disabled:opacity-50" onClick={()=>{setSnapshot(null);setOffset(Math.max(0,offset-50));}}>Previous / 上一页</button><span>{offset+1}–{Math.min(offset+50,snapshot.total_active)} / {snapshot.total_active}</span><button type="button" disabled={!snapshot.has_more} className="rounded border px-2 py-1 disabled:opacity-50" onClick={()=>{setSnapshot(null);setOffset(offset+50);}}>Next / 下一页</button></div>}
        <h4 className="text-sm font-semibold">Recent processing results / 最近处理结果（最多20笔）</h4>{snapshot.recent.length?table(snapshot.recent):<p className="text-sm">No recent results / 暂无最近记录。</p>}
      </>}
    </div>}
  </details>;
}
