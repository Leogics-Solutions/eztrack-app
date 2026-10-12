'use client';

import { useEffect, useState } from 'react';
import { getReviewAiCost, type ReviewAiCostReport } from '@/services/ReviewAiCostService';
import { aiStageLabel, formatAiCost } from '@/utils/reviewAiCost';

export function ReviewAiCost({ runId, refreshKey }: { runId: number; refreshKey?: string }) {
  const [result, setResult] = useState<{ key: string; report?: ReviewAiCostReport; error?: boolean } | null>(null);
  const [refresh, setRefresh] = useState(0);
  const requestKey = `${runId}:${refreshKey || ''}:${refresh}`;
  const loading = result?.key !== requestKey;
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    getReviewAiCost(runId, controller.signal).then((report) => {
      if (active) setResult({ key: requestKey, report });
    }).catch(() => {
      if (active) setResult({ key: requestKey, error: true });
    });
    return () => { active = false; controller.abort(); };
  }, [runId, requestKey]);

  // Never display the previous review's total while navigating between sets.
  const report = result?.key === requestKey ? result.report : undefined;
  const failed = result?.key === requestKey && (result.error || report?.status === 'unavailable');
  const summary = report?.summary;
  const count = (n: number) => n.toLocaleString('en-US');
  return <section aria-label={`AI cost for review ${runId}`} className="mb-4 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 text-[var(--foreground)]">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="text-sm font-semibold">AI cost / AI 费用 <span className="font-normal text-[var(--muted-foreground)]">· estimated · USD</span></h2>
        <p role="status" className="mt-1 text-sm">
          {failed ? 'AI cost is temporarily unavailable.' : summary ? <>
            <b>{formatAiCost(summary.estimated_cost_usd)}</b>{report?.status === 'partial' ? ' known cost · partial estimate' : ' total tracked cost'}
            <span className="ml-2 text-[var(--muted-foreground)]">{count(summary.provider_calls)} AI calls · {count(summary.reused_calls)} reused results</span>
          </> : report?.status === 'no_data' ? 'No tracked AI calls yet.' : 'Loading AI cost…'}
        </p>
      </div>
      <button type="button" disabled={loading} onClick={() => setRefresh((value) => value + 1)} className="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs disabled:opacity-50">{loading ? 'Loading…' : 'Refresh cost'}</button>
    </div>
    {report?.status === 'no_data' && <p className="mt-2 text-xs text-[var(--muted-foreground)]">Tracking began 12 October 2026. Earlier AI usage is not included.</p>}
    {summary && <details className="mt-3">
      <summary className="cursor-pointer text-xs font-medium">View cost breakdown / 查看费用明细</summary>
      {summary.unknown_cost_calls > 0 && <p className="mt-3 text-xs text-amber-700 dark:text-amber-300">{count(summary.unknown_cost_calls)} call(s) have no confirmed cost. The total includes known estimates only.</p>}
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead><tr className="border-b border-[var(--border)]"><th className="py-2 pr-3">Step / Model</th><th className="px-2">AI calls</th><th className="px-2">Reused</th><th className="px-2">Input tokens</th><th className="px-2">Cache read</th><th className="px-2">Cache write</th><th className="px-2">Output tokens</th><th className="py-2 pl-3 text-right">Estimated cost</th></tr></thead>
          <tbody>{report.stages.map((stage) => <tr key={`${stage.stage}:${stage.model}`} className="border-b border-[var(--border)]">
            <td className="py-2 pr-3"><p>{aiStageLabel(stage.stage)}</p><p className="mt-1 text-[var(--muted-foreground)]">{stage.model}</p></td>
            <td className="px-2">{count(stage.provider_calls)}</td><td className="px-2">{count(stage.reused_calls)}</td><td className="px-2">{count(stage.input_tokens)}</td><td className="px-2">{count(stage.cached_input_tokens)}</td><td className="px-2">{count(stage.cache_write_tokens)}</td><td className="px-2">{count(stage.output_tokens)}</td>
            <td className="py-2 pl-3 text-right whitespace-nowrap">{formatAiCost(stage.estimated_cost_usd)}{stage.unknown_cost_calls > 0 ? ' + unknown' : ''}</td>
          </tr>)}</tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-[var(--muted-foreground)]">Repeated requests: {count(summary.repeated_provider_calls)} · Failed calls: {count(summary.errors)}. Reasoning tokens are included in output tokens.</p>
      {Number(summary.shared_source_estimated_cost_usd) > 0 && <p className="mt-2 text-xs text-[var(--muted-foreground)]">Includes {formatAiCost(summary.shared_source_estimated_cost_usd)} for shared source discovery, charged once to this review.</p>}
      <p className="mt-2 text-xs text-[var(--muted-foreground)]">Tracked calls since 12 October 2026, including retries. Estimates exclude unreported usage, tool fees and any provider surcharges. Intake costs recorded before a review exists are not assigned to this total.</p>
    </details>}
  </section>;
}
