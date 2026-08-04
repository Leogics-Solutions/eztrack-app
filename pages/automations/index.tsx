'use client';

import { AppLayout } from '@/components/layout';
import { useOrganization } from '@/lib/OrganizationContext';
import {
  createOrderAutomation,
  deleteAutomation,
  listAutomations,
  type Automation,
  type AutomationListResponse,
} from '@/services/AutomationService';
import {
  ArrowRight,
  CheckCircle2,
  CirclePause,
  FileInput,
  LoaderCircle,
  MessageCircle,
  Plus,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trash2,
  Workflow,
} from 'lucide-react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

const EMPTY: AutomationListResponse = { items: [], total: 0, active: 0, draft: 0, paused: 0 };

const STATUS_STYLE = {
  ACTIVE: 'border border-emerald-300 bg-emerald-100 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100',
  DRAFT: 'border border-amber-300 bg-amber-100 text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100',
  PAUSED: 'border border-slate-400 bg-slate-100 text-slate-950 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100',
};

function sourceSummary(automation: Automation) {
  const sources = automation.config?.source?.sources || [];
  if (sources.length === 0) return 'No source configured';
  return sources.map((source) => source.replaceAll('_', ' ').toLowerCase()).join(', ');
}

export default function AutomationsPage() {
  const router = useRouter();
  const { selectedOrganizationId } = useOrganization();
  const [data, setData] = useState<AutomationListResponse>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    listAutomations()
      .then((result) => {
        if (!active) return;
        setData(result);
        setError(null);
      })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : 'Could not load automations.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [selectedOrganizationId]);

  const createV1Automation = async () => {
    setCreating(true);
    setError(null);
    try {
      const automation = await createOrderAutomation();
      await router.push(`/automations/${automation.id}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not create the automation.');
      setCreating(false);
    }
  };

  const deleteDraft = async (automation: Automation) => {
    if (!window.confirm(`Delete draft "${automation.name}"? This cannot be undone.`)) return;
    setDeletingId(automation.id);
    setError(null);
    try {
      await deleteAutomation(automation.id);
      setData((current) => ({
        ...current,
        items: current.items.filter((item) => item.id !== automation.id),
        total: Math.max(0, current.total - 1),
        draft: Math.max(0, current.draft - 1),
      }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not delete the automation.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <AppLayout pageName="Automations">
      <div className="space-y-6">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700 dark:text-cyan-300">
              How Smartdok handles work
            </p>
            <h1 className="text-2xl font-bold">Automations</h1>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--muted-foreground)]">
              Configure where documents arrive, what Smartdok checks, who approves, and where approved results go.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void createV1Automation()}
            disabled={creating}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-cyan-800 disabled:opacity-50"
          >
            {creating ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {creating ? 'Creating…' : 'New automation'}
          </button>
        </header>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: 'All automations', value: data.total, icon: Workflow, color: 'text-cyan-600' },
            { label: 'Active', value: data.active, icon: CheckCircle2, color: 'text-emerald-600' },
            { label: 'Draft', value: data.draft, icon: Settings2, color: 'text-amber-600' },
            { label: 'Paused', value: data.paused, icon: CirclePause, color: 'text-slate-500' },
          ].map((metric) => {
            const Icon = metric.icon;
            return (
              <div key={metric.label} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-[var(--muted-foreground)]">{metric.label}</p>
                  <Icon className={`h-5 w-5 ${metric.color}`} />
                </div>
                <p className="mt-2 text-2xl font-bold">{metric.value}</p>
              </div>
            );
          })}
        </div>

        <section className="overflow-hidden rounded-2xl border border-cyan-400/25 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.12),transparent_32%),var(--card)]">
          <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-700 dark:text-cyan-300">
                <Sparkles className="h-3.5 w-3.5" /> V1 RECOMMENDED TEMPLATE
              </div>
              <h2 className="mt-4 text-xl font-semibold">Customer PO → Delivery Order + Sales Invoice</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted-foreground)]">
                Receive a customer PO from upload, Gmail or managed WhatsApp, match it against company knowledge, check the order, request approval, and create drafts in the company&apos;s connected accounting or ERP system.
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-2 text-xs font-medium">
                {[
                  ['Receive', MessageCircle],
                  ['Read & match', FileInput],
                  ['Check', ShieldCheck],
                  ['Approve', CheckCircle2],
                  ['Create in system', ArrowRight],
                ].map(([label, icon], index) => {
                  const Icon = icon as typeof Workflow;
                  return (
                    <div key={label as string} className="flex items-center gap-2">
                      {index > 0 && <ArrowRight className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />}
                      <span className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--card)] px-2.5 py-1.5">
                        <Icon className="h-3.5 w-3.5 text-cyan-600" /> {label as string}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
            {data.total === 0 && (
              <button
                type="button"
                onClick={() => void createV1Automation()}
                disabled={creating}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-700 bg-cyan-700 px-5 py-3 text-sm font-semibold text-white hover:bg-cyan-800 disabled:opacity-50"
              >
                Set up this automation <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </section>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
            {error}
          </div>
        )}

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Your automations</h2>
            {!loading && <p className="text-xs text-[var(--muted-foreground)]">Scoped to the selected company</p>}
          </div>
          {loading ? (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-10 text-center text-sm text-[var(--muted-foreground)]">
              Loading automations…
            </div>
          ) : data.items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--border)] p-10 text-center">
              <Workflow className="mx-auto h-9 w-9 text-[var(--muted-foreground)]" />
              <h3 className="mt-3 font-medium">No automation configured yet</h3>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">Start with the recommended order-to-invoice template above.</p>
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {data.items.map((automation) => (
                <div key={automation.id} className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] transition hover:border-cyan-400 hover:shadow-sm">
                  <button type="button" onClick={() => void router.push(`/automations/${automation.id}`)} className="w-full p-5 text-left">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-semibold">{automation.name}</p>
                        <p className="mt-1 line-clamp-2 text-sm leading-6 text-[var(--muted-foreground)]">{automation.description}</p>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLE[automation.status]}`}>
                        {automation.status.toLowerCase()}
                      </span>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2 text-xs text-[var(--muted-foreground)]">
                      <span className="rounded-md bg-[var(--muted)] px-2 py-1">Sources: {sourceSummary(automation)}</span>
                      <span className="rounded-md bg-[var(--muted)] px-2 py-1">Approval: {automation.approval_required ? 'required' : 'automatic drafts'}</span>
                      <span className="rounded-md bg-[var(--muted)] px-2 py-1">Output: Connected accounting / ERP</span>
                    </div>
                  </button>
                  {automation.status === 'DRAFT' && (
                    <div className="flex justify-end border-t border-[var(--border)] px-4 py-2">
                      <button type="button" onClick={() => void deleteDraft(automation)} disabled={deletingId === automation.id} className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-500/10 disabled:opacity-50">
                        {deletingId === automation.id ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />} Delete draft
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </AppLayout>
  );
}
