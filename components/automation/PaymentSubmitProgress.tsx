import { SqlQueuePanel } from './SqlQueuePanel';
import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Clock3, LoaderCircle, AlertTriangle } from 'lucide-react';
import { paymentSubmitStatus, type PaymentSubmitJob } from '@/services/AgentsService';
import { paymentSubmitProgress } from '@/utils/paymentSubmitProgress';
import { sqlQueueNotice } from '@/utils/sqlQueueNotice';

export function PaymentSubmitProgress({ runId, jobId, onFinished }: {
  runId: number; jobId: string; onFinished: () => void;
}) {
  const [job, setJob] = useState<PaymentSubmitJob>({ status: 'PENDING' });
  const [reconnecting, setReconnecting] = useState(false);
  const [now, setNow] = useState(Date.now());
  const callback = useRef(onFinished);
  callback.current = onFinished;
  useEffect(() => {
    if (!jobId) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    setJob({ status: 'PENDING' });
    const poll = async () => {
      try {
        const result = await paymentSubmitStatus(runId);
        if (!active) return;
        setReconnecting(false);
        setJob(result);
        if (['PENDING', 'RUNNING'].includes(result.status)) timer = setTimeout(poll, 2000);
        else callback.current();
      } catch {
        if (active) { setReconnecting(true); timer = setTimeout(poll, 3000); }
      }
    };
    void poll();
    const clock = setInterval(() => setNow(Date.now()), 1000);
    return () => { active = false; clearTimeout(timer); clearInterval(clock); };
  }, [runId, jobId]);
  if (!jobId) return null;
  const { running, steps } = paymentSubmitProgress(job);
  const elapsed = job.created_at ? Math.max(0, Math.floor((now - Date.parse(job.created_at)) / 1000)) : 0;
  return <section role="status" aria-live="polite" className="rounded-xl border border-cyan-300 bg-cyan-50 p-4 text-cyan-950">
    <div className="flex items-center gap-2 font-semibold">
      {running ? <LoaderCircle className="h-5 w-5 animate-spin" /> : job.status === 'SUCCESS' ? <CheckCircle2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
      {running ? 'Payment processing in the background' : job.status === 'SUCCESS' ? 'Payment completed' : 'Payment needs attention'}
      {running && <span className="ml-auto text-sm">{Math.floor(elapsed / 60)}m {elapsed % 60}s elapsed</span>}
    </div>
    {job.status === 'PENDING' && <p className="mt-2 text-sm">{sqlQueueNotice(job, now)}</p>}
    <ol className="my-3 grid gap-2 sm:grid-cols-3">{steps.map(step => <li key={step.key} className={`flex items-center gap-2 rounded-lg border p-3 text-sm ${step.state === 'active' ? 'border-cyan-600 bg-white font-semibold' : ''}`}>
      {step.state === 'done' ? <CheckCircle2 className="h-4 w-4 text-emerald-700" /> : step.state === 'active' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : step.state === 'stopped' ? <AlertTriangle className="h-4 w-4 text-amber-700" /> : <Clock3 className="h-4 w-4" />}
      {step.label}
    </li>)}</ol>
    <p className="text-sm">{reconnecting ? 'Reconnecting to progress updates. The task may still be running; do not submit again.' : job.error_message || job.result?.detail || 'Waiting for background processing.'}</p>
    {running && <p className="mt-2 text-sm">You can leave this page and return. SQL and message delivery may take time; progress updates automatically.</p>}
    <SqlQueuePanel runId={runId} />
  </section>;
}
