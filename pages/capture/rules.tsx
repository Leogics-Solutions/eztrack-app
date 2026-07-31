'use client';

import { CaptureShell } from '@/components/capture/CaptureShell';
import { AppLayout } from '@/components/layout';
import { useOrganization } from '@/lib/OrganizationContext';
import {
  getCaptureConfiguration,
  updateCaptureConfiguration,
  type CaptureAction,
  type CaptureConfiguration,
  type CaptureRule,
  type CaptureRuleField,
  type CaptureRuleOperator,
  type CaptureSource,
  type ChannelInstructionSource,
} from '@/services/CaptureService';
import {
  Bot,
  CheckCircle2,
  GripVertical,
  Plus,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

const SOURCES: Array<{ value: CaptureSource; label: string }> = [
  { value: 'ALL', label: 'All channels' },
  { value: 'UPLOAD', label: 'Upload' },
  { value: 'INBOUND_EMAIL', label: 'Inbound email' },
  { value: 'GMAIL', label: 'Gmail' },
  { value: 'WHATSAPP', label: 'WhatsApp' },
  { value: 'DRIVE', label: 'Google Drive' },
  { value: 'TELEGRAM', label: 'Telegram' },
];

const FIELDS: Array<{ value: CaptureRuleField; label: string }> = [
  { value: 'sender', label: 'Sender' },
  { value: 'subject', label: 'Subject / file title' },
  { value: 'body', label: 'Message preview' },
  { value: 'filename', label: 'Attachment filename' },
  { value: 'source_type', label: 'Source type' },
];

const OPERATORS: Array<{ value: CaptureRuleOperator; label: string }> = [
  { value: 'contains', label: 'contains' },
  { value: 'not_contains', label: 'does not contain' },
  { value: 'equals', label: 'equals' },
  { value: 'starts_with', label: 'starts with' },
  { value: 'ends_with', label: 'ends with' },
];

function newRule(index: number): CaptureRule {
  const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `rule-${Date.now()}-${index}`;
  return {
    id,
    name: `New rule ${index + 1}`,
    source_type: 'ALL',
    field: 'subject',
    operator: 'contains',
    value: '',
    action: 'FILTER',
    priority: (index + 1) * 100,
    is_active: true,
  };
}

function combineInstructionLayers(globalText: string, channelText: string): string {
  const globalInstructions = globalText.replaceAll('\0', '').trim();
  const channelInstructions = channelText.replaceAll('\0', '').trim();
  if (!globalInstructions) return channelInstructions.slice(0, 4000);
  if (!channelInstructions) return globalInstructions.slice(0, 4000);
  const separator = '\n\nCHANNEL-SPECIFIC GUIDANCE:\n';
  const available = 4000 - separator.length;
  const globalBudget = Math.floor(available / 2);
  return (
    globalInstructions.slice(0, globalBudget)
    + separator
    + channelInstructions.slice(0, available - globalBudget)
  );
}

export default function CaptureRulesPage() {
  const { selectedOrganizationId } = useOrganization();
  const [configuration, setConfiguration] = useState<CaptureConfiguration | null>(null);
  const [rules, setRules] = useState<CaptureRule[]>([]);
  const [defaultAction, setDefaultAction] = useState<CaptureAction>('ACCEPT');
  const [instructions, setInstructions] = useState('');
  const [channelInstructions, setChannelInstructions] = useState<
    Partial<Record<ChannelInstructionSource, string>>
  >({});
  const [instructionScope, setInstructionScope] = useState<CaptureSource>('ALL');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<'rules' | 'instructions' | null>(null);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const current = await getCaptureConfiguration();
      setConfiguration(current);
      setRules(current.rules || []);
      setDefaultAction(current.default_action);
      setInstructions(current.processing_instructions || '');
      setChannelInstructions(current.channel_processing_instructions || {});
      setNotice(null);
    } catch (reason) {
      setNotice({ type: 'error', message: reason instanceof Error ? reason.message : 'Could not load capture rules.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, selectedOrganizationId]);

  const updateRule = (id: string, patch: Partial<CaptureRule>) => {
    setRules((current) => current.map((rule) => rule.id === id ? { ...rule, ...patch } : rule));
  };

  const addRule = () => {
    const rule = newRule(rules.length);
    setRules((current) => [...current, rule]);
  };

  const saveRules = async () => {
    const incomplete = rules.some((rule) => !rule.name.trim() || !rule.value.trim());
    if (incomplete) {
      setNotice({ type: 'error', message: 'Every rule needs a name and comparison value before saving.' });
      return;
    }
    setSaving('rules');
    try {
      const updated = await updateCaptureConfiguration({
        default_action: defaultAction,
        rules: rules.map((rule, index) => ({ ...rule, priority: (index + 1) * 100 })),
      });
      setConfiguration(updated);
      setRules(updated.rules);
      setNotice({ type: 'success', message: 'Pre-AI filtering rules saved.' });
    } catch (reason) {
      setNotice({ type: 'error', message: reason instanceof Error ? reason.message : 'Could not save rules.' });
    } finally {
      setSaving(null);
    }
  };

  const saveInstructions = async () => {
    setSaving('instructions');
    try {
      const updated = await updateCaptureConfiguration({
        processing_instructions: instructions,
        channel_processing_instructions: channelInstructions,
      });
      setConfiguration(updated);
      setInstructions(updated.processing_instructions);
      setChannelInstructions(updated.channel_processing_instructions || {});
      setNotice({ type: 'success', message: `Processing instructions saved as version ${updated.instruction_version}.` });
    } catch (reason) {
      setNotice({ type: 'error', message: reason instanceof Error ? reason.message : 'Could not save instructions.' });
    } finally {
      setSaving(null);
    }
  };

  const selectedInstructions = instructionScope === 'ALL'
    ? instructions
    : channelInstructions[instructionScope as ChannelInstructionSource] || '';
  const selectedChannelLabel = SOURCES.find(
    (source) => source.value === instructionScope
  )?.label || instructionScope;
  const effectivePreview = instructionScope === 'ALL'
    ? instructions.trim().slice(0, 4000)
    : combineInstructionLayers(instructions, selectedInstructions);

  return (
    <AppLayout pageName="Capture rules">
      <CaptureShell
        title="Rules & AI instructions"
        description="Use deterministic rules to reject noise before any AI call, then guide extraction only for accepted documents."
      >
        {notice && (
          <div className={`rounded-xl border p-4 text-sm ${notice.type === 'success' ? 'border-emerald-300/60 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100' : 'border-red-300/60 bg-red-50 text-red-900 dark:bg-red-950/30 dark:text-red-100'}`}>
            {notice.message}
          </div>
        )}

        <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)]">
          <div className="flex flex-col gap-4 border-b border-[var(--border)] p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-violet-600" /><h2 className="font-semibold">Pre-AI filtering rules</h2></div>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">Rules run in priority order. Each rule can target one input channel or All channels, and the first match decides whether the item proceeds.</p>
            </div>
            <button type="button" onClick={addRule} className="inline-flex items-center justify-center gap-2 rounded-lg border border-cyan-500/40 px-3 py-2 text-sm font-medium text-cyan-700 hover:bg-cyan-500/10 dark:text-cyan-300"><Plus className="h-4 w-4" /> Add rule</button>
          </div>

          <div className="p-5">
            <div className="mb-5 flex flex-col gap-2 rounded-xl bg-[var(--muted)] p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium">When no rule matches</p>
                <p className="text-xs text-[var(--muted-foreground)]">Accept is safer during setup; filter is cheaper but can hide genuine work.</p>
              </div>
              <select value={defaultAction} onChange={(event) => setDefaultAction(event.target.value as CaptureAction)} className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm">
                <option value="ACCEPT">Accept for processing</option>
                <option value="FILTER">Filter without AI</option>
              </select>
            </div>

            {loading ? (
              <p className="py-8 text-center text-sm text-[var(--muted-foreground)]">Loading rules…</p>
            ) : rules.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[var(--border)] p-8 text-center">
                <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500" />
                <p className="mt-2 font-medium">No custom rules yet</p>
                <p className="mt-1 text-sm text-[var(--muted-foreground)]">Unmatched items currently follow the default action above.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {rules.map((rule, index) => (
                  <div key={rule.id} className="rounded-xl border border-[var(--border)] p-4">
                    <div className="flex items-start gap-3">
                      <GripVertical className="mt-2 h-5 w-5 shrink-0 text-[var(--muted-foreground)]" />
                      <div className="min-w-0 flex-1 space-y-3">
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <input value={rule.name} onChange={(event) => updateRule(rule.id, { name: event.target.value })} aria-label={`Rule ${index + 1} name`} className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm font-medium outline-none focus:border-cyan-500" />
                          <select value={rule.action} onChange={(event) => updateRule(rule.id, { action: event.target.value as CaptureAction })} className={`rounded-lg border px-3 py-2 text-sm font-medium ${rule.action === 'FILTER' ? 'border-violet-300 bg-violet-50 text-violet-800 dark:bg-violet-950 dark:text-violet-200' : 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'}`}>
                            <option value="FILTER">Filter — no AI</option>
                            <option value="ACCEPT">Accept — process</option>
                          </select>
                          <label className="inline-flex items-center gap-2 rounded-lg px-2 text-xs text-[var(--muted-foreground)]"><input type="checkbox" checked={rule.is_active} onChange={(event) => updateRule(rule.id, { is_active: event.target.checked })} /> Active</label>
                          <button type="button" onClick={() => setRules((current) => current.filter((item) => item.id !== rule.id))} className="rounded-lg p-2 text-red-600 hover:bg-red-500/10" aria-label={`Delete ${rule.name}`}><Trash2 className="h-4 w-4" /></button>
                        </div>
                        <div className="grid gap-2 md:grid-cols-[160px_190px_170px_minmax(180px,1fr)]">
                          <select value={rule.source_type} onChange={(event) => updateRule(rule.id, { source_type: event.target.value as CaptureSource })} className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm">
                            {SOURCES.map((source) => <option key={source.value} value={source.value}>{source.label}</option>)}
                          </select>
                          <select value={rule.field} onChange={(event) => updateRule(rule.id, { field: event.target.value as CaptureRuleField })} className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm">
                            {FIELDS.map((field) => <option key={field.value} value={field.value}>{field.label}</option>)}
                          </select>
                          <select value={rule.operator} onChange={(event) => updateRule(rule.id, { operator: event.target.value as CaptureRuleOperator })} className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm">
                            {OPERATORS.map((operator) => <option key={operator.value} value={operator.value}>{operator.label}</option>)}
                          </select>
                          <input value={rule.value} onChange={(event) => updateRule(rule.id, { value: event.target.value })} placeholder="newsletter, noreply, purchase order…" className="rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm outline-none focus:border-cyan-500" />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-5 flex justify-end">
              <button type="button" onClick={() => void saveRules()} disabled={loading || saving !== null} className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-700 disabled:opacity-50"><Save className="h-4 w-4" /> {saving === 'rules' ? 'Saving…' : 'Save filtering rules'}</button>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)]">
          <div className="border-b border-[var(--border)] p-5">
            <div className="flex items-center gap-2"><Bot className="h-5 w-5 text-cyan-600" /><h2 className="font-semibold">AI processing instructions</h2></div>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">Global guidance is always applied first. Optional channel guidance is then added for that source. Version {configuration?.instruction_version || 1}.</p>
          </div>
          <div className="p-5">
            <div className="mb-4 grid gap-3 md:grid-cols-3">
              {[
                { icon: ShieldCheck, title: 'Safety stays fixed', text: 'Company instructions cannot override platform safety or financial validation.' },
                { icon: Sparkles, title: 'Tell AI what to notice', text: 'Describe aliases, mandatory fields, unusual layouts and customer-specific terminology.' },
                { icon: Bot, title: 'Evidence is not instruction', text: 'Text inside incoming messages and documents remains untrusted source evidence.' },
              ].map((item) => {
                const Icon = item.icon;
                return <div key={item.title} className="rounded-xl bg-[var(--muted)] p-4"><Icon className="h-5 w-5 text-cyan-600" /><p className="mt-2 text-sm font-medium">{item.title}</p><p className="mt-1 text-xs leading-5 text-[var(--muted-foreground)]">{item.text}</p></div>;
              })}
            </div>
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium">{instructionScope === 'ALL' ? 'Global instructions' : `${selectedChannelLabel} instructions`}</p>
                <p className="text-xs text-[var(--muted-foreground)]">{instructionScope === 'ALL' ? 'Applied to every accepted document.' : `Added after Global instructions only for ${selectedChannelLabel}.`}</p>
              </div>
              <select value={instructionScope} onChange={(event) => setInstructionScope(event.target.value as CaptureSource)} className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm">
                {SOURCES.map((source) => <option key={source.value} value={source.value}>{source.value === 'ALL' ? 'Global · All channels' : source.label}</option>)}
              </select>
            </div>
            <textarea
              value={selectedInstructions}
              onChange={(event) => {
                if (instructionScope === 'ALL') {
                  setInstructions(event.target.value);
                } else {
                  const source = instructionScope as ChannelInstructionSource;
                  setChannelInstructions((current) => ({ ...current, [source]: event.target.value }));
                }
              }}
              maxLength={4000}
              rows={9}
              placeholder={instructionScope === 'ALL'
                ? 'Examples:\n- Never invent missing values.\n- PO number may appear as Customer Order Ref.\n- Delivery date is mandatory; flag it when missing.'
                : `Examples for ${selectedChannelLabel}:\n- Documents from this channel are normally purchase orders.\n- Use the file title as supporting context for the PO reference.`}
              className="w-full rounded-xl border border-[var(--border)] bg-transparent p-4 text-sm leading-6 outline-none focus:border-cyan-500"
            />
            <div className="mt-3 rounded-xl bg-[var(--muted)] p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">Effective instruction preview</p>
              <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap font-sans text-xs leading-5">{effectivePreview || 'No AI processing instructions configured for this scope.'}</pre>
              {instructions.trim() && instructionScope !== 'ALL' && !selectedInstructions.trim() && (
                <p className="mt-2 text-xs text-[var(--muted-foreground)]">This channel currently inherits Global instructions only.</p>
              )}
            </div>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-[var(--muted-foreground)]">{selectedInstructions.length.toLocaleString()} / 4,000 characters · Effective prompt is capped at 4,000 characters.</p>
              <button type="button" onClick={() => void saveInstructions()} disabled={loading || saving !== null} className="inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-700 disabled:opacity-50"><Save className="h-4 w-4" /> {saving === 'instructions' ? 'Saving…' : 'Save all instruction layers'}</button>
            </div>
          </div>
        </section>
      </CaptureShell>
    </AppLayout>
  );
}
