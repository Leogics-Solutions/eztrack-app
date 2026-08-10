'use client';

import { AppLayout } from '@/components/layout';
import { useOrganization } from '@/lib/OrganizationContext';
import { createAutomation, deleteAutomation, listAutomations, listAutomationTemplates, type Automation, type AutomationListResponse, type AutomationTemplate, type AutomationTemplateKey } from '@/services/AutomationService';
import { ArrowRight, CheckCircle2, CirclePause, FileInput, LoaderCircle, Plus, Settings2, ShieldCheck, Sparkles, Trash2, Workflow } from 'lucide-react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

const EMPTY: AutomationListResponse = { items: [], total: 0, active: 0, draft: 0, paused: 0 };
const STATUS_STYLE = {
  ACTIVE: 'border-emerald-300 bg-emerald-100 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100',
  DRAFT: 'border-amber-300 bg-amber-100 text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100',
  PAUSED: 'border-slate-400 bg-slate-100 text-slate-950 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100',
};

function sourceSummary(automation: Automation) {
  const sources = automation.config.source.sources;
  return sources.length ? sources.map((source) => source.replaceAll('_', ' ').toLowerCase()).join(', ') : 'Not configured';
}

export default function AutomationsPage() {
  const router = useRouter();
  const { selectedOrganizationId } = useOrganization();
  const [data, setData] = useState<AutomationListResponse>(EMPTY);
  const [templates, setTemplates] = useState<AutomationTemplate[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([listAutomations(), listAutomationTemplates()])
      .then(([automations, availableTemplates]) => { if (active) { setData(automations); setTemplates(availableTemplates); setError(null); } })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : 'Could not load automations.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [selectedOrganizationId]);

  const create = async (templateKey: AutomationTemplateKey) => {
    setCreating(true); setError(null);
    try { const automation = await createAutomation(templateKey); await router.push(`/automations/${automation.id}`); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not create automation.'); setCreating(false); }
  };

  const deleteDraft = async (automation: Automation) => {
    if (!window.confirm(`Delete draft "${automation.name}"? This cannot be undone.`)) return;
    setDeletingId(automation.id);
    try {
      await deleteAutomation(automation.id);
      setData((current) => ({ ...current, items: current.items.filter((item) => item.id !== automation.id), total: Math.max(0, current.total - 1), draft: Math.max(0, current.draft - 1) }));
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not delete automation.'); }
    finally { setDeletingId(null); }
  };

  return <AppLayout pageName="Automations"><div className="space-y-6">
    <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700 dark:text-cyan-300">How Smartdok handles work</p><h1 className="text-2xl font-bold">Automations</h1><p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--muted-foreground)]">Build finance workflows from reusable data contracts, capabilities, checks, approvals and outputs.</p></div><button type="button" onClick={() => setShowTemplates((value) => !value)} className="inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-cyan-800"><Plus className="h-4 w-4" /> New automation</button></header>

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[
      ['All automations', data.total, Workflow, 'text-cyan-600'], ['Active', data.active, CheckCircle2, 'text-emerald-600'], ['Draft', data.draft, Settings2, 'text-amber-600'], ['Paused', data.paused, CirclePause, 'text-slate-500'],
    ].map(([label, value, icon, color]) => { const Icon = icon as typeof Workflow; return <div key={String(label)} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4"><div className="flex items-center justify-between"><p className="text-sm text-[var(--muted-foreground)]">{String(label)}</p><Icon className={`h-5 w-5 ${color}`} /></div><p className="mt-2 text-2xl font-bold">{String(value)}</p></div>; })}</div>

    {(showTemplates || (!loading && data.total === 0)) && <section className="rounded-2xl border border-cyan-400/25 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.12),transparent_32%),var(--card)] p-6"><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-cyan-700 dark:text-cyan-300"><Sparkles className="h-4 w-4" /> Choose a finance workflow</div><h2 className="mt-2 text-xl font-semibold">Start with a working template</h2><p className="mt-1 text-sm text-[var(--muted-foreground)]">Templates provide a safe starting contract. Every field, check, approval and output remains editable.</p><div className="mt-5 grid gap-4 lg:grid-cols-2">{templates.map((template) => <article key={template.key} className="flex flex-col rounded-xl border border-[var(--border)] bg-[var(--card)] p-5"><div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-700 dark:text-cyan-300">{template.key === 'payment_knock_off' ? <ShieldCheck className="h-5 w-5" /> : <FileInput className="h-5 w-5" />}</span><div><h3 className="font-semibold">{template.name}</h3><p className="mt-1 text-sm leading-6 text-[var(--muted-foreground)]">{template.description}</p></div></div><div className="mt-4 flex flex-wrap gap-2 text-xs text-[var(--muted-foreground)]"><span className="rounded-md bg-[var(--muted)] px-2 py-1">{template.config.data_contract.fields.length} fields</span><span className="rounded-md bg-[var(--muted)] px-2 py-1">{template.config.validations.length} checks</span><span className="rounded-md bg-[var(--muted)] px-2 py-1">{template.config.approval.gates.length} approval gates</span></div><button type="button" onClick={() => void create(template.key)} disabled={creating} className="mt-5 inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-cyan-800 disabled:opacity-50">{creating ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null} Use this template <ArrowRight className="h-4 w-4" /></button></article>)}</div></section>}

    {error && <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-100">{error}</div>}
    <section><div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">Your automations</h2><p className="text-xs text-[var(--muted-foreground)]">Scoped to the selected company</p></div>{loading ? <div className="rounded-xl border border-[var(--border)] p-10 text-center text-sm text-[var(--muted-foreground)]">Loading automations…</div> : data.items.length === 0 ? <div className="rounded-xl border border-dashed border-[var(--border)] p-10 text-center text-sm text-[var(--muted-foreground)]">Choose a workflow template above.</div> : <div className="grid gap-4 lg:grid-cols-2">{data.items.map((automation) => <article key={automation.id} className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] hover:border-cyan-400"><button type="button" onClick={() => void router.push(`/automations/${automation.id}`)} className="w-full p-5 text-left"><div className="flex items-start justify-between gap-4"><div><p className="font-semibold">{automation.name}</p><p className="mt-1 line-clamp-2 text-sm leading-6 text-[var(--muted-foreground)]">{automation.description}</p></div><span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${STATUS_STYLE[automation.status]}`}>{automation.status.toLowerCase()}</span></div><div className="mt-4 flex flex-wrap gap-2 text-xs text-[var(--muted-foreground)]"><span className="rounded-md bg-[var(--muted)] px-2 py-1">{automation.template_key === 'payment_knock_off' ? 'Payment knock-off' : 'PO to invoice'}</span><span className="rounded-md bg-[var(--muted)] px-2 py-1">Sources: {sourceSummary(automation)}</span><span className="rounded-md bg-[var(--muted)] px-2 py-1">{automation.config.validations.filter((item) => item.enabled).length} active checks</span></div></button>{automation.status === 'DRAFT' && <div className="flex justify-end border-t border-[var(--border)] px-4 py-2"><button type="button" onClick={() => void deleteDraft(automation)} disabled={deletingId === automation.id} className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-500/10 disabled:opacity-50">{deletingId === automation.id ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />} Delete draft</button></div>}</article>)}</div>}</section>
  </div></AppLayout>;
}
