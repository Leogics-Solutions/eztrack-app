'use client';

import { AppLayout } from '@/components/layout';
import { useRouter } from 'next/router';
import { useMemo, useState } from 'react';
import {
  ArrowLeft, Bot, BrainCircuit, Check, ChevronRight, FileUp, FolderOpen,
  LoaderCircle, Mail, MessageCircle, Sparkles, Workflow, Wrench,
} from 'lucide-react';
import {
  createAgent, previewAgentDesign,
  type Agent, type AgentChannel, type AgentDesignPreview,
} from '@/services/AgentsService';

type ChannelType = 'whatsapp_group' | 'email' | 'google_drive' | 'upload' | 'mcp';

const CHANNELS: Array<{
  id: ChannelType;
  title: string;
  description: string;
  refLabel?: string;
  refPlaceholder?: string;
  icon: typeof MessageCircle;
  ready?: boolean;
}> = [
  {
    id: 'whatsapp_group', title: 'WhatsApp', description: 'Capture documents and messages from a group or chat.',
    refLabel: 'Group or chat reference', refPlaceholder: 'e.g. 1203630xxxxxxxxx@g.us', icon: MessageCircle,
  },
  {
    id: 'email', title: 'Email inbox', description: 'Watch a connected mailbox for documents and requests.',
    refLabel: 'Inbox or routing address', refPlaceholder: 'e.g. po@company.com', icon: Mail,
  },
  {
    id: 'google_drive', title: 'Google Drive', description: 'Process files placed in a connected Drive folder.',
    refLabel: 'Folder URL or ID', refPlaceholder: 'Paste a shared folder URL or ID', icon: FolderOpen,
  },
  {
    id: 'upload', title: 'Manual upload', description: 'Let your team drop documents into Smartdok when needed.',
    icon: FileUp, ready: true,
  },
  {
    id: 'mcp', title: 'Other connector', description: 'Describe a future MCP, API, or internal-system connection.',
    refLabel: 'Connector or source', refPlaceholder: 'e.g. SharePoint / CRM / custom MCP', icon: Wrench,
  },
];

const EXAMPLE_BRIEF = 'Read incoming purchase orders, extract the customer, products, quantities and currency. Translate Chinese item names to English, match them to our SKU catalogue, calculate MYR values from the supplied forex formula, then prepare a delivery order and invoice for finance to approve before sending.';

function displayName(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function NewAgentPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [brief, setBrief] = useState('');
  const [selectedChannels, setSelectedChannels] = useState<ChannelType[]>(['upload']);
  const [channelRefs, setChannelRefs] = useState<Partial<Record<ChannelType, string>>>({});
  const [preview, setPreview] = useState<AgentDesignPreview | null>(null);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const channels = useMemo(() => selectedChannels.map((channelType) => ({
    channel_type: channelType,
    channel_ref: channelRefs[channelType]?.trim() || null,
    is_active: true,
  })), [selectedChannels, channelRefs]);

  const clearPreview = () => { if (preview) setPreview(null); };

  const toggleChannel = (channel: ChannelType) => {
    clearPreview();
    setSelectedChannels((current) => (
      current.includes(channel) ? current.filter((item) => item !== channel) : [...current, channel]
    ));
  };

  const generatePreview = async () => {
    if (brief.trim().length < 8) {
      setError('Tell us what this agent should do before generating a plan.');
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      const draft = await previewAgentDesign({ name, description, instructions: brief, channels });
      setPreview(draft);
    } catch (e) {
      setError((e as Error)?.message || 'We could not generate the agent plan. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const create = async () => {
    if (!name.trim()) { setError('Please give the agent a name.'); return; }
    if (!preview) { setError('Generate and review the agent plan before creating it.'); return; }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || preview.summary,
        instructions: brief.trim(),
        record_type: preview.record_type || 'document',
        extraction_profile: preview.extraction_profile || null,
        skills: preview.skills,
        approval_required: preview.approval_required,
        is_active: true,
        channels: channels as AgentChannel[],
        outputs: preview.recommended_outputs.map((output, index) => ({
          output_type: output, sort_order: index, is_active: true,
        })),
      } as Partial<Agent>;
      const agent = await createAgent(payload);
      router.push(`/agents/${agent.id}`);
    } catch (e) {
      setError((e as Error)?.message || 'Failed to create agent.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout pageName="Create Agent">
      <div className="mx-auto max-w-7xl pb-8">
        <button onClick={() => router.push('/agents')} className="mb-6 flex items-center gap-1.5 text-sm text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]">
          <ArrowLeft className="h-4 w-4" /> All agents
        </button>

        <section className="relative overflow-hidden rounded-3xl border border-cyan-400/20 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.14),transparent_36%),radial-gradient(circle_at_20%_100%,rgba(99,102,241,0.14),transparent_30%),var(--card)] px-6 py-8 shadow-[0_24px_80px_-40px_rgba(14,116,144,0.7)] sm:px-9">
          <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-cyan-400/10 blur-3xl" />
          <div className="relative max-w-3xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-500/25 bg-cyan-500/10 px-3 py-1 text-xs font-medium tracking-wide text-cyan-700 dark:text-cyan-300">
              <Sparkles className="h-3.5 w-3.5" /> SMARTDOK AGENT STUDIO
            </div>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Describe the outcome. We’ll design the workflow.</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted-foreground)] sm:text-base">
              Start with the business work you want automated. Smartdok will draft the capabilities, approval path and outputs for you to review before the agent is created.
            </p>
          </div>
        </section>

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm sm:p-7">
            <div className="mb-6 flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--primary)] text-white"><Bot className="h-5 w-5" /></span>
              <div><h2 className="font-semibold">Agent identity</h2><p className="text-sm text-[var(--muted-foreground)]">Give your team a clear name and context.</p></div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium">Name
                <input value={name} onChange={(e) => { setName(e.target.value); clearPreview(); }} placeholder="e.g. Purchase Order Operations"
                  className="mt-2 w-full rounded-xl border border-[var(--border)] bg-transparent px-3.5 py-2.5 font-normal outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10" />
              </label>
              <label className="block text-sm font-medium">Description <span className="font-normal text-[var(--muted-foreground)]">(optional)</span>
                <input value={description} onChange={(e) => { setDescription(e.target.value); clearPreview(); }} placeholder="What this agent is for"
                  className="mt-2 w-full rounded-xl border border-[var(--border)] bg-transparent px-3.5 py-2.5 font-normal outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10" />
              </label>
            </div>

            <div className="mt-7 border-t border-[var(--border)] pt-6">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div><h2 className="font-semibold">What should this agent be able to do?</h2><p className="mt-1 text-sm text-[var(--muted-foreground)]">Use normal business language. You don’t need to choose technical skills.</p></div>
                <BrainCircuit className="mt-0.5 h-5 w-5 shrink-0 text-cyan-600 dark:text-cyan-400" />
              </div>
              <textarea value={brief} onChange={(e) => { setBrief(e.target.value); clearPreview(); }} rows={7}
                placeholder="For example: Read purchase orders from our mailbox, identify the customer and line items, match products to our catalogue, and prepare a draft for finance approval."
                className="w-full resize-y rounded-xl border border-[var(--border)] bg-transparent px-3.5 py-3 text-sm leading-6 outline-none transition placeholder:text-[var(--muted-foreground)] focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10" />
              <button type="button" onClick={() => { setBrief(EXAMPLE_BRIEF); clearPreview(); }} className="mt-2 text-xs font-medium text-cyan-700 hover:text-cyan-800 dark:text-cyan-300 dark:hover:text-cyan-200">Use a purchase-order example</button>
            </div>

            <div className="mt-7 border-t border-[var(--border)] pt-6">
              <div className="mb-4"><h2 className="font-semibold">Input channels</h2><p className="mt-1 text-sm text-[var(--muted-foreground)]">Choose every place this agent can receive work. Connections are configured separately and can be added later.</p></div>
              <div className="grid gap-3 sm:grid-cols-2">
                {CHANNELS.map((channel) => {
                  const Icon = channel.icon;
                  const selected = selectedChannels.includes(channel.id);
                  return (
                    <div key={channel.id} className={`rounded-xl border p-3.5 transition ${selected ? 'border-cyan-500 bg-cyan-500/5 shadow-[0_0_0_3px_rgba(6,182,212,0.07)]' : 'border-[var(--border)] hover:border-cyan-500/50'}`}>
                      <button type="button" onClick={() => toggleChannel(channel.id)} className="flex w-full items-start gap-3 text-left">
                        <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${selected ? 'bg-cyan-600 text-white' : 'bg-[var(--muted)] text-[var(--muted-foreground)]'}`}><Icon className="h-4 w-4" /></span>
                        <span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-2 font-medium"><span>{channel.title}</span>{selected && <Check className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />}</span><span className="mt-0.5 block text-xs leading-5 text-[var(--muted-foreground)]">{channel.description}</span></span>
                      </button>
                      {selected && channel.refLabel && (
                        <input value={channelRefs[channel.id] || ''} onChange={(e) => { setChannelRefs((refs) => ({ ...refs, [channel.id]: e.target.value })); clearPreview(); }} placeholder={channel.refPlaceholder}
                          aria-label={channel.refLabel} className="mt-3 w-full rounded-lg border border-[var(--border)] bg-transparent px-2.5 py-2 text-xs outline-none focus:border-cyan-500" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {error && <p className="mt-5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700 dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-300">{error}</p>}
            <button onClick={generatePreview} disabled={generating} className="mt-7 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 px-5 py-3 text-sm font-medium text-white shadow-lg shadow-cyan-800/20 transition hover:from-cyan-500 hover:to-blue-500 disabled:cursor-not-allowed disabled:opacity-60">
              {generating ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {generating ? 'Designing your agent…' : 'Generate agent plan'}
            </button>
          </section>

          <aside className="h-fit overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-sm xl:sticky xl:top-6">
            <div className="border-b border-[var(--border)] bg-[linear-gradient(135deg,rgba(6,182,212,0.10),rgba(99,102,241,0.08))] p-5">
              <div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-950 text-cyan-300 dark:bg-cyan-300 dark:text-slate-950"><Workflow className="h-5 w-5" /></span><div><h2 className="font-semibold">Agent plan</h2><p className="text-xs text-[var(--muted-foreground)]">AI-generated, then reviewed by you.</p></div></div>
            </div>
            {!preview ? (
              <div className="p-6 text-center"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--muted)]"><Sparkles className="h-6 w-6 text-[var(--muted-foreground)]" /></div><h3 className="mt-4 font-medium">Your plan will appear here</h3><p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">Describe the work and select its sources. The preview will show exactly what the agent is proposed to do before it is created.</p></div>
            ) : (
              <div className="p-5">
                <p className="text-sm leading-6 text-[var(--muted-foreground)]">{preview.summary}</p>
                <div className="mt-5"><p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Capabilities</p><div className="mt-3 space-y-3">{preview.capabilities.map((capability) => <div key={`${capability.skill}-${capability.title}`} className="rounded-xl border border-[var(--border)] p-3"><div className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-cyan-600 dark:text-cyan-400" /><div><p className="text-sm font-medium">{capability.title}</p><p className="mt-1 text-xs leading-5 text-[var(--muted-foreground)]">{capability.description}</p></div></div></div>)}</div></div>
                <div className="mt-5"><p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Workflow</p><ol className="mt-3 space-y-2">{preview.workflow.map((step, index) => <li key={`${index}-${step}`} className="flex gap-2.5 text-sm"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cyan-500/10 text-xs font-semibold text-cyan-700 dark:text-cyan-300">{index + 1}</span><span className="pt-0.5 text-[var(--muted-foreground)]">{step}</span></li>)}</ol></div>
                <div className="mt-5 flex flex-wrap gap-1.5">{preview.recommended_outputs.map((output) => <span key={output} className="rounded-full border border-indigo-400/25 bg-indigo-500/10 px-2.5 py-1 text-xs text-indigo-700 dark:text-indigo-300">{displayName(output)}</span>)}</div>
                <div className="mt-5 rounded-xl border border-amber-300/40 bg-amber-400/10 p-3 text-xs leading-5 text-amber-800 dark:text-amber-200"><strong>Human approval:</strong> {preview.approval_required ? 'required before the agent sends, posts, or changes data.' : 'not required by this draft.'}</div>
                <button onClick={create} disabled={saving} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-3 text-sm font-medium text-white transition hover:bg-[var(--primary-hover)] disabled:opacity-60">
                  {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <><span>Create this agent</span><ChevronRight className="h-4 w-4" /></>}
                </button>
                <p className="mt-2 text-center text-xs text-[var(--muted-foreground)]">Edit the brief or channels to regenerate this plan.</p>
              </div>
            )}
          </aside>
        </div>
      </div>
    </AppLayout>
  );
}
