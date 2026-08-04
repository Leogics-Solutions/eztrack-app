'use client';

import { AppLayout } from '@/components/layout';
import { useOrganization } from '@/lib/OrganizationContext';
import {
  activateAutomation,
  deleteAutomation,
  getAutomation,
  pauseAutomation,
  updateAutomation,
  type Automation,
  type AutomationConfig,
} from '@/services/AutomationService';
import {
  ArrowLeft,
  Bot,
  Check,
  CheckCircle2,
  Database,
  FileSearch,
  FlaskConical,
  LoaderCircle,
  MessageCircle,
  Pause,
  Play,
  Save,
  ShieldCheck,
  Trash2,
  Upload,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';

type SectionKey = 'source' | 'read' | 'knowledge' | 'checks' | 'approval' | 'output' | 'test';

const SECTIONS: Array<{ key: SectionKey; label: string; description: string; icon: typeof Upload }> = [
  { key: 'source', label: 'Source', description: 'Where orders arrive', icon: MessageCircle },
  { key: 'read', label: 'Read', description: 'Fields Smartdok extracts', icon: FileSearch },
  { key: 'knowledge', label: 'Knowledge', description: 'Company reference data', icon: Database },
  { key: 'checks', label: 'Checks', description: 'Business validation', icon: ShieldCheck },
  { key: 'approval', label: 'Approval', description: 'Human control', icon: CheckCircle2 },
  { key: 'output', label: 'Output', description: 'Accounting or ERP actions', icon: Bot },
  { key: 'test', label: 'Test', description: 'Try before activation', icon: FlaskConical },
];

const SOURCE_OPTIONS = [
  { value: 'UPLOAD', label: 'Web & mobile upload', detail: 'Available now' },
  { value: 'GMAIL', label: 'Gmail', detail: 'Uses a connected Capture mailbox' },
  { value: 'WHATSAPP', label: 'WhatsApp Business', detail: 'Managed setup by Smartdok' },
  { value: 'DRIVE', label: 'Google Drive', detail: 'Uses a connected watched folder' },
];

const READ_FIELDS = [
  ['customer', 'Customer'],
  ['po_number', 'PO number'],
  ['order_date', 'Order date'],
  ['delivery_address', 'Delivery address'],
  ['line_items', 'Line items'],
  ['quantity', 'Quantity'],
  ['unit', 'Unit of measure'],
  ['requested_delivery_date', 'Requested delivery date'],
  ['currency', 'Currency'],
];

const KNOWLEDGE_TYPES = [
  ['CUSTOMER_MASTER', 'Customer master'],
  ['PRODUCT_CATALOGUE', 'Product/SKU catalogue'],
  ['ITEM_ALIASES', 'Customer item aliases'],
  ['PRICE_LIST', 'Price list'],
  ['TAX_CODES', 'Tax codes'],
];

const CHECKS = [
  ['customer_match', 'Customer must be recognized'],
  ['item_match', 'Every item must match an internal SKU'],
  ['duplicate_po', 'Flag duplicate PO numbers'],
  ['price_check', 'Use and validate the selected price list'],
  ['tax_totals', 'Recalculate tax and totals'],
  ['stock_check', 'Check stock availability (managed connection)'],
  ['credit_limit_check', 'Check customer credit limit (managed connection)'],
];

function toggleList(values: string[], value: string) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

export default function AutomationSetupPage() {
  const router = useRouter();
  const { selectedOrganizationId } = useOrganization();
  const automationId = Number(router.query.id);
  const [automation, setAutomation] = useState<Automation | null>(null);
  const [config, setConfig] = useState<AutomationConfig | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [section, setSection] = useState<SectionKey>('source');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activating, setActivating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!Number.isFinite(automationId) || automationId <= 0) return;
    let active = true;
    setLoading(true);
    getAutomation(automationId)
      .then((result) => {
        if (!active) return;
        setAutomation(result);
        setConfig(result.config);
        setName(result.name);
        setDescription(result.description || '');
        setError(null);
      })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : 'Could not load this automation.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [automationId, selectedOrganizationId]);

  const readiness = useMemo(() => {
    if (!config) return { complete: 0, total: 6 };
    const checks = [
      config.source.sources.length > 0,
      config.read.required_fields.length > 0,
      config.knowledge.required_types.length > 0,
      Object.values(config.checks).some(Boolean),
      Boolean(config.approval.mode),
      Boolean(config.output.destination && (config.output.create_delivery_order || config.output.create_sales_invoice)),
    ];
    return { complete: checks.filter(Boolean).length, total: checks.length };
  }, [config]);

  const save = async () => {
    if (!automation || !config || !name.trim()) return null;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const saved = await updateAutomation(automation.id, {
        name: name.trim(),
        description: description.trim() || undefined,
        approval_required: config.approval.mode === 'REVIEW_BEFORE_CREATE',
        instructions: config.read.instructions || '',
        config,
      });
      setAutomation(saved);
      setConfig(saved.config);
      setNotice('Draft saved.');
      return saved;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save the automation.');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const activate = async () => {
    if (!automation) return;
    setActivating(true);
    setError(null);
    setNotice(null);
    try {
      const saved = await save();
      if (!saved) return;
      const active = await activateAutomation(automation.id);
      setAutomation(active);
      setConfig(active.config);
      setNotice('Automation activated. New matching items can now use this configuration.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not activate the automation.');
    } finally {
      setActivating(false);
    }
  };

  const pause = async () => {
    if (!automation) return;
    setActivating(true);
    try {
      const paused = await pauseAutomation(automation.id);
      setAutomation(paused);
      setConfig(paused.config);
      setNotice('Automation paused. Existing Inbox items are unchanged.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not pause the automation.');
    } finally {
      setActivating(false);
    }
  };

  const deleteDraft = async () => {
    if (!automation || automation.status !== 'DRAFT') return;
    if (!window.confirm(`Delete draft "${automation.name}"? This cannot be undone.`)) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteAutomation(automation.id);
      await router.push('/automations');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not delete the automation.');
      setDeleting(false);
    }
  };

  if (loading) {
    return <AppLayout pageName="Automation setup"><div className="p-12 text-center text-sm text-[var(--muted-foreground)]">Loading automation…</div></AppLayout>;
  }

  if (!automation || !config) {
    return <AppLayout pageName="Automation setup"><div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">{error || 'Automation not found.'}</div></AppLayout>;
  }

  return (
    <AppLayout pageName="Automation setup">
      <div className="space-y-6">
        <header>
          <Link href="/automations" className="inline-flex items-center gap-1.5 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
            <ArrowLeft className="h-4 w-4" /> Automations
          </Link>
          <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${automation.status === 'ACTIVE' ? 'border-emerald-300 bg-emerald-100 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100' : automation.status === 'PAUSED' ? 'border-slate-400 bg-slate-100 text-slate-950 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100' : 'border-amber-300 bg-amber-100 text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100'}`}>
                  {automation.status.toLowerCase()}
                </span>
                <span className="text-xs text-[var(--muted-foreground)]">Order to invoice · V1</span>
              </div>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="mt-2 w-full max-w-3xl bg-transparent text-2xl font-bold outline-none"
                aria-label="Automation name"
              />
              <input
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Describe what this automation does"
                className="mt-1 w-full max-w-4xl bg-transparent text-sm text-[var(--muted-foreground)] outline-none"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {automation.status === 'DRAFT' && (
                <button type="button" onClick={() => void deleteDraft()} disabled={deleting || saving || activating} className="inline-flex items-center gap-2 rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-500/10 disabled:opacity-50">
                  {deleting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Delete draft
                </button>
              )}
              <button type="button" onClick={() => void save()} disabled={saving || activating} className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium hover:bg-[var(--muted)] disabled:opacity-50">
                {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save draft
              </button>
              {automation.status === 'ACTIVE' ? (
                <button type="button" onClick={() => void pause()} disabled={activating} className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-50">
                  <Pause className="h-4 w-4" /> Pause
                </button>
              ) : (
                <button type="button" onClick={() => void activate()} disabled={activating || readiness.complete < readiness.total} className="inline-flex items-center gap-2 rounded-lg bg-cyan-700 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-800 disabled:cursor-not-allowed disabled:opacity-50">
                  {activating ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} Activate
                </button>
              )}
            </div>
          </div>
        </header>

        {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">{error}</div>}
        {notice && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">{notice}</div>}

        <div className="grid gap-6 xl:grid-cols-[260px_minmax(0,1fr)_300px]">
          <nav className="h-fit space-y-1 rounded-xl border border-[var(--border)] bg-[var(--card)] p-2 xl:sticky xl:top-6" aria-label="Automation setup sections">
            {SECTIONS.map((item, index) => {
              const Icon = item.icon;
              const active = section === item.key;
              return (
                <button key={item.key} type="button" onClick={() => setSection(item.key)} className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition ${active ? 'bg-cyan-700 text-white' : 'hover:bg-[var(--muted)]'}`}>
                  <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${active ? 'bg-white/15' : 'bg-[var(--muted)]'}`}><Icon className="h-4 w-4" /></span>
                  <span className="min-w-0 flex-1"><span className="block text-sm font-medium">{index + 1}. {item.label}</span><span className={`block truncate text-xs ${active ? 'text-cyan-50' : 'text-[var(--muted-foreground)]'}`}>{item.description}</span></span>
                </button>
              );
            })}
          </nav>

          <main className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 sm:p-6">
            {section === 'source' && (
              <SetupSection title="Where should orders arrive?" description="Select every channel that may start this automation.">
                <div className="grid gap-3 sm:grid-cols-2">
                  {SOURCE_OPTIONS.map((option) => {
                    const selected = config.source.sources.includes(option.value);
                    return <ChoiceCard key={option.value} selected={selected} title={option.label} detail={option.detail} onClick={() => setConfig({ ...config, source: { ...config.source, sources: toggleList(config.source.sources, option.value) } })} />;
                  })}
                </div>
                <Link href="/capture/channels" className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-cyan-700 hover:underline dark:text-cyan-300">Manage channel connections <ArrowLeft className="h-3.5 w-3.5 rotate-180" /></Link>
              </SetupSection>
            )}

            {section === 'read' && (
              <SetupSection title="What should Smartdok read?" description="Required fields are held for review when they cannot be read confidently.">
                <div className="grid gap-2 sm:grid-cols-2">
                  {READ_FIELDS.map(([value, label]) => <ToggleRow key={value} checked={config.read.required_fields.includes(value)} label={label} onChange={() => setConfig({ ...config, read: { ...config.read, required_fields: toggleList(config.read.required_fields, value) } })} />)}
                </div>
                <label className="mt-5 block text-sm font-medium">Special reading instructions
                  <textarea value={config.read.instructions || ''} onChange={(event) => setConfig({ ...config, read: { ...config.read, instructions: event.target.value } })} rows={4} placeholder="Example: Customer item descriptions may be in Chinese. Preserve the original text before mapping." className="mt-2 w-full rounded-xl border border-[var(--border)] bg-transparent p-3 text-sm leading-6 outline-none focus:border-cyan-500" />
                </label>
              </SetupSection>
            )}

            {section === 'knowledge' && (
              <SetupSection title="What company knowledge should it use?" description="Choose the reference datasets required to understand and reconstruct the order.">
                <div className="space-y-2">
                  {KNOWLEDGE_TYPES.map(([value, label]) => <ToggleRow key={value} checked={config.knowledge.required_types.includes(value)} label={label} onChange={() => setConfig({ ...config, knowledge: { ...config.knowledge, required_types: toggleList(config.knowledge.required_types, value) } })} />)}
                </div>
                <label className="mt-5 block text-sm font-medium">Knowledge notes
                  <textarea value={config.knowledge.notes || ''} onChange={(event) => setConfig({ ...config, knowledge: { ...config.knowledge, notes: event.target.value } })} rows={3} placeholder="Example: Use the 2026 selling price sheet. Customer-specific prices take priority." className="mt-2 w-full rounded-xl border border-[var(--border)] bg-transparent p-3 text-sm leading-6 outline-none focus:border-cyan-500" />
                </label>
                <div className="mt-4 flex flex-col gap-3 rounded-xl border border-blue-300 bg-blue-50 p-4 text-blue-950 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-100 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold">Manage these sources in Knowledge Base</p><p className="mt-1 text-xs leading-5 text-blue-900 dark:text-blue-200">Upload and label the company files this automation will depend on.</p></div><Link href="/knowledge-base" className="inline-flex shrink-0 items-center justify-center rounded-lg bg-blue-800 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-900 dark:bg-blue-600 dark:hover:bg-blue-500">Open Knowledge Base</Link></div>
              </SetupSection>
            )}

            {section === 'checks' && (
              <SetupSection title="What should Smartdok check?" description="These are explicit business checks—not hidden AI decisions.">
                <div className="space-y-2">
                  {CHECKS.map(([value, label]) => <ToggleRow key={value} checked={Boolean(config.checks[value])} label={label} onChange={() => setConfig({ ...config, checks: { ...config.checks, [value]: !config.checks[value] } })} />)}
                </div>
              </SetupSection>
            )}

            {section === 'approval' && (
              <SetupSection title="When should a person approve?" description="V1 keeps a person in control before finance documents are created.">
                <div className="space-y-3">
                  <ChoiceCard selected={config.approval.mode === 'REVIEW_BEFORE_CREATE'} title="Review before creating" detail="A person confirms the order, DO and invoice before anything is pushed." onClick={() => setConfig({ ...config, approval: { mode: 'REVIEW_BEFORE_CREATE' } })} />
                  <ChoiceCard selected={config.approval.mode === 'AUTO_CREATE_DRAFTS'} title="Automatically create drafts" detail="Only create drafts in the connected system when every required match and check passes." onClick={() => setConfig({ ...config, approval: { mode: 'AUTO_CREATE_DRAFTS' } })} />
                </div>
              </SetupSection>
            )}

            {section === 'output' && (
              <SetupSection title="What should happen after approval?" description="Prepare documents for the accounting or ERP system connected to this company.">
                <div className="rounded-xl border border-cyan-300/50 bg-cyan-500/5 p-4">
                  <div className="flex items-center justify-between gap-3"><div><p className="font-medium">Connected accounting or ERP system</p><p className="mt-1 text-xs text-[var(--muted-foreground)]">The destination is configured for each company and automation.</p></div><span className="rounded-full border border-amber-300 bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">setup required</span></div>
                </div>
                <div className="mt-4 space-y-2">
                  <ToggleRow checked={config.output.create_delivery_order} label="Create Delivery Order draft" onChange={() => setConfig({ ...config, output: { ...config.output, create_delivery_order: !config.output.create_delivery_order } })} />
                  <ToggleRow checked={config.output.create_sales_invoice} label="Create Sales Invoice draft" onChange={() => setConfig({ ...config, output: { ...config.output, create_sales_invoice: !config.output.create_sales_invoice } })} />
                  <ToggleRow checked={config.output.attach_source_po} label="Attach or reference the original PO" onChange={() => setConfig({ ...config, output: { ...config.output, attach_source_po: !config.output.attach_source_po } })} />
                </div>
              </SetupSection>
            )}

            {section === 'test' && (
              <SetupSection title="Test before activation" description="Use a real sample without creating an accounting document.">
                <div className="rounded-xl border border-dashed border-[var(--border)] p-7 text-center">
                  <FlaskConical className="mx-auto h-9 w-9 text-cyan-600" />
                  <h3 className="mt-3 font-medium">Run a safe document test</h3>
                  <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[var(--muted-foreground)]">The current Capture Playground can test classification and extraction. End-to-end automation simulation will be connected in the next slice.</p>
                  <Link href="/capture/playground" className="mt-4 inline-flex items-center gap-2 rounded-lg bg-cyan-700 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-800"><FlaskConical className="h-4 w-4" /> Open Playground</Link>
                </div>
              </SetupSection>
            )}
          </main>

          <aside className="h-fit space-y-4 rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 xl:sticky xl:top-6">
            <div>
              <div className="flex items-center justify-between"><p className="font-semibold">Setup readiness</p><span className="text-sm font-semibold text-cyan-700">{readiness.complete}/{readiness.total}</span></div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--muted)]"><div className="h-full rounded-full bg-cyan-600 transition-all" style={{ width: `${(readiness.complete / readiness.total) * 100}%` }} /></div>
            </div>
            <div className="border-t border-[var(--border)] pt-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Run summary</p>
              <ol className="mt-3 space-y-3 text-sm">
                {['Receive customer PO', 'Read customer and order lines', 'Match company knowledge', 'Run business checks', config.approval.mode === 'REVIEW_BEFORE_CREATE' ? 'Wait for approval' : 'Create drafts when checks pass', 'Create DO and invoice in connected system'].map((value, index) => (
                  <li key={value} className="flex gap-2"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cyan-500/10 text-xs font-semibold text-cyan-700">{index + 1}</span><span className="pt-0.5 text-[var(--muted-foreground)]">{value}</span></li>
                ))}
              </ol>
            </div>
            <div className="rounded-lg bg-[var(--muted)] p-3 text-xs leading-5 text-[var(--muted-foreground)]">
              <span className="font-medium text-[var(--foreground)]">Activation:</span> saves this version for future matching items. Existing Inbox items are not changed.
            </div>
          </aside>
        </div>
      </div>
    </AppLayout>
  );
}

function SetupSection({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <div><div className="mb-5"><h2 className="text-lg font-semibold">{title}</h2><p className="mt-1 text-sm leading-6 text-[var(--muted-foreground)]">{description}</p></div>{children}</div>;
}

function ChoiceCard({ selected, title, detail, onClick }: { selected: boolean; title: string; detail: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left transition ${selected ? 'border-cyan-500 bg-cyan-500/5 ring-1 ring-cyan-500/20' : 'border-[var(--border)] hover:border-cyan-400'}`}><span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${selected ? 'border-cyan-600 bg-cyan-600 text-white' : 'border-[var(--border)]'}`}>{selected && <Check className="h-3.5 w-3.5" />}</span><span><span className="block text-sm font-medium">{title}</span><span className="mt-1 block text-xs leading-5 text-[var(--muted-foreground)]">{detail}</span></span></button>;
}

function ToggleRow({ checked, label, onChange }: { checked: boolean; label: string; onChange: () => void }) {
  return <label className="flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-[var(--border)] px-3.5 py-3 text-sm"><span>{label}</span><input type="checkbox" checked={checked} onChange={onChange} className="h-4 w-4 rounded accent-cyan-600" /></label>;
}
