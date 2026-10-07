import type { SqlQueueItem } from '../services/AgentsService';
export function sqlQueueType(item: SqlQueueItem): string {
  if (item.restricted) return 'Other workspace request / 其他工作区请求';
  if (item.job_type === 'payment_sql_preview') return 'Payment SQL check / 付款查询';
  if (item.job_type === 'payment_submit') return 'OR / Payment knock-off';
  return item.action === 'PREPARE' ? 'Prepare DO & Invoice / 准备单据' : 'Post DO & Invoice / 开单过账';
}
export function sqlQueueState(state: string): string {
  return ({RUNNING:'Processing / 正在处理',QUEUED:'Queued / 排队中',SCHEDULED:'Scheduled / 等待批次',
    NEEDS_ATTENTION:'Needs attention / 需检查',SUCCESS:'Completed / 已处理',FAILED:'Failed / 失败',
    INTERRUPTED:'Interrupted / 已中断'} as Record<string,string>)[state] || state;
}
export function sqlQueueTime(value?: string | null): string {
  if (!value || !Number.isFinite(Date.parse(value))) return '—';
  return new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Kuala_Lumpur',day:'2-digit',month:'2-digit',
    hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date(value));
}
export function sqlQueueStage(value?: string | null): string {
  if (!value) return '';
  const rows=value.match(/^prepared_(delivery_order|invoice)_lines_(\d+)_of_(\d+)$/);
  if (rows) return `${rows[1]==='delivery_order'?'DO':'Invoice'}: ${rows[2]} / ${rows[3]} rows prepared`;
  return value.replace(/_/g,' ');
}
