'use client';

import { AppLayout } from '@/components/layout';
import { useLanguage } from '@/lib/i18n';
import { useOrganization } from '@/lib/OrganizationContext';
import { useCallback, useEffect, useState, type MouseEvent } from 'react';
import { useRouter } from 'next/router';
import { Upload, FileSpreadsheet, ArrowLeft, Pencil, Trash2, LoaderCircle } from 'lucide-react';
import {
  getAgent, listRuns, uploadRun, deleteRun,
  type Agent, type AgentRunListItem,
} from '@/services/AgentsService';

const STATUS_STYLES: Record<string, string> = {
  RECEIVED: 'bg-slate-100 text-slate-700',
  EXTRACTING: 'bg-amber-100 text-amber-800',
  PENDING_REVIEW: 'bg-blue-100 text-blue-800',
  DRAFT_GENERATED: 'bg-indigo-100 text-indigo-800',
  COMPLETED: 'bg-green-100 text-green-800',
  FAILED: 'bg-red-100 text-red-800',
  REJECTED: 'bg-red-100 text-red-800',
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`text-xs rounded-full px-2 py-0.5 ${STATUS_STYLES[status] || 'bg-[var(--muted)] text-[var(--muted-foreground)]'}`}>
      {status.replace('_', ' ').toLowerCase()}
    </span>
  );
}

export default function AgentDetailPage() {
  const { t } = useLanguage();
  const { selectedOrganizationId } = useOrganization();
  const router = useRouter();
  const agentId = Number(router.query.id);

  const [agent, setAgent] = useState<Agent | null>(null);
  const [runs, setRuns] = useState<AgentRunListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    if (!agentId) return;
    setLoading(true);
    try {
      const [a, r] = await Promise.all([getAgent(agentId), listRuns({ agentId, pageSize: 100 })]);
      setAgent(a);
      setRuns(r.runs);
      setError(null);
    } catch (e) {
      setError((e as Error)?.message || 'Failed to load agent');
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => { refresh(); }, [refresh, selectedOrganizationId]);

  const onUpload = async () => {
    if (!file) return;
    setUploading(true);
    try {
      const run = await uploadRun(agentId, file, caption);
      setFile(null);
      setCaption('');
      router.push(`/agents/runs/${run.id}`);
    } catch (e) {
      alert((e as Error)?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const onDelete = async (run: AgentRunListItem, event: MouseEvent) => {
    event.stopPropagation();  // the row itself opens the run
    const label = run.source_filename ? `"${run.source_filename}"` : `PO #${run.id}`;
    // A COMPLETED run has already produced its DO + Invoice and fired the
    // configured outputs. Deleting drops Smartdok's record only; anything
    // delivered to WhatsApp or SQL Account stays where it was sent.
    const sent = run.status === 'COMPLETED'
      ? '\n\nThis PO is completed. Its Delivery Order and Invoice may already have been sent to WhatsApp or posted to SQL Account — deleting removes the Smartdok record only, and will not retract them.'
      : '';
    if (!window.confirm(`Delete ${label} (PO #${run.id})? This cannot be undone.${sent}`)) return;
    setDeletingId(run.id);
    try {
      await deleteRun(run.id);
      setRuns((previous) => previous.filter((item) => item.id !== run.id));
    } catch (e) {
      alert((e as Error)?.message || 'Could not delete this PO.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <AppLayout pageName={agent?.name || t.nav.agents}>
      <button onClick={() => router.push('/agents')} className="mb-4 text-sm text-[var(--muted-foreground)] flex items-center gap-1 hover:text-[var(--foreground)]">
        <ArrowLeft className="h-4 w-4" /> All agents
      </button>

      {loading && <p className="text-[var(--muted-foreground)]">Loading…</p>}
      {error && <p className="text-red-600">{error}</p>}

      {agent && (
        <div className="space-y-6">
          {/* Config summary */}
          <div className="bg-white dark:bg-[var(--card)] rounded-lg shadow-sm border border-[var(--border)] p-6">
            <div className="flex justify-between items-start gap-4">
              <div>
                <h2 className="text-xl font-bold m-0">{agent.name}</h2>
                {agent.description && <p className="mt-1 text-sm text-[var(--muted-foreground)]">{agent.description}</p>}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => router.push(`/agents/${agent.id}/edit`)} className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] px-3 py-1.5 text-sm hover:bg-[var(--hover-bg)]"><Pencil className="h-3.5 w-3.5" /> Edit configuration</button>
                <StatusBadge status={agent.is_active ? 'COMPLETED' : 'RECEIVED'} />
              </div>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-3 text-sm">
              <div>
                <div className="text-[var(--muted-foreground)] mb-1">Input channels</div>
                <div className="flex flex-wrap gap-1">
                  {agent.channels.map((c) => (
                    <span key={c.id} className="rounded-full px-2 py-0.5 bg-[var(--muted)]">{c.channel_type}{c.channel_ref ? `: ${c.channel_ref}` : ''}</span>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-[var(--muted-foreground)] mb-1">Capabilities</div>
                <div className="flex flex-wrap gap-1">
                  {(agent.skills || []).map((s) => <span key={s} className="rounded-full px-2 py-0.5 bg-[var(--muted)]">{s}</span>)}
                </div>
              </div>
              <div>
                <div className="text-[var(--muted-foreground)] mb-1">Outputs</div>
                <div className="flex flex-wrap gap-1">
                  {agent.outputs.map((o) => <span key={o.id} className="rounded-full px-2 py-0.5 bg-[var(--muted)]">{o.output_type}</span>)}
                </div>
              </div>
            </div>
          </div>

          {/* Manual upload (drives the flow without the WhatsApp bridge) */}
          <div className="bg-white dark:bg-[var(--card)] rounded-lg shadow-sm border border-[var(--border)] p-6">
            <h3 className="font-semibold mb-2 flex items-center gap-2"><Upload className="h-4 w-4" /> Capture a PO (manual)</h3>
            <p className="text-sm text-[var(--muted-foreground)] mb-3">Upload a PO Excel/PDF and paste the WhatsApp caption (with the conversion formula) to simulate a group message.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                type="file"
                accept=".xls,.xlsx,.pdf,.png,.jpg,.jpeg"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="text-sm"
              />
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="e.g. YDKC-E-SCM * COMPANY SDN BHD&#10;INV DATE 01/07/2026&#10;RMB 399,600 / 1.622 + RM70 = RM 246,432.50"
                rows={3}
                className="rounded-md border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
              />
            </div>
            <button
              onClick={onUpload}
              disabled={!file || uploading}
              className="mt-3 px-4 py-2 bg-[var(--primary)] text-white rounded-md hover:bg-[var(--primary-hover)] disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              <FileSpreadsheet className="h-4 w-4" /> {uploading ? 'Processing…' : 'Capture & Extract'}
            </button>
          </div>

          {/* Captured runs */}
          <div className="bg-white dark:bg-[var(--card)] rounded-lg shadow-sm border border-[var(--border)]">
            <div className="p-4 border-b border-[var(--border)] font-semibold">Captured POs ({runs.length})</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[var(--muted-foreground)]">
                    <th className="px-4 py-2">#</th>
                    <th className="px-4 py-2">Source</th>
                    <th className="px-4 py-2">File</th>
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2">Received</th>
                    <th className="px-4 py-2 w-px"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((r) => (
                    <tr
                      key={r.id}
                      onClick={() => router.push(`/agents/runs/${r.id}`)}
                      className="border-t border-[var(--border)] cursor-pointer hover:bg-[var(--hover-bg)]"
                    >
                      <td className="px-4 py-2">{r.id}</td>
                      <td className="px-4 py-2">{r.source_channel}</td>
                      <td className="px-4 py-2">{r.source_filename || '—'}{r.revision ? <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">REV R{r.revision}</span> : null}{r.po_label ? <span className="ml-2 rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-medium text-sky-800 dark:bg-sky-950/40 dark:text-sky-300">PO {r.po_label}</span> : null}</td>
                      <td className="px-4 py-2"><StatusBadge status={r.status} /></td>
                      <td className="px-4 py-2">{r.received_at ? new Date(r.received_at).toLocaleString() : '—'}</td>
                      <td className="px-4 py-2">
                        <button
                          type="button"
                          onClick={(event) => onDelete(r, event)}
                          disabled={deletingId !== null}
                          aria-label={`Delete PO #${r.id}`}
                          title="Delete this PO"
                          className="rounded p-1.5 text-[var(--muted-foreground)] hover:bg-red-50 hover:text-red-700 disabled:opacity-40 dark:hover:bg-red-950/30 dark:hover:text-red-300"
                        >
                          {deletingId === r.id ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {runs.length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-6 text-center text-[var(--muted-foreground)]">No POs captured yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
