'use client';

import { AppLayout } from '@/components/layout';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import {
  ArrowLeft, Check, ChevronRight, Database, LoaderCircle, MessageCircle, Pencil, Plus,
  RefreshCw, Sparkles, Trash2, Unplug, Workflow,
} from 'lucide-react';
import {
  addChannel, addOutput, deleteAgent, deleteChannel, deleteOutput, getAgent,
  connectWhatsApp, disconnectWhatsApp, getWhatsAppConnection, previewAgentDesign,
  updateAgent, updateChannel, updateOutput, type Agent, type AgentChannel, type AgentDesignPreview, type AgentOutput, type WhatsAppConnection,
} from '@/services/AgentsService';
import { createSqlAccountConnection, listSqlAccountConnections, testSqlAccountConnection, updateSqlAccountConnection, type SqlAccountConnection, type SqlAccountConnectionPayload } from '@/services/SqlAccountService';

type ChannelType = 'whatsapp_group' | 'email' | 'google_drive' | 'upload' | 'mcp';
type DraftChannel = Pick<AgentChannel, 'channel_type' | 'channel_ref' | 'is_active'> & { id?: number };

const CHANNEL_OPTIONS: Array<{ value: ChannelType; label: string; placeholder: string }> = [
  { value: 'whatsapp_group', label: 'WhatsApp', placeholder: 'Group JID, e.g. 120363…@g.us' },
  { value: 'email', label: 'Email inbox', placeholder: 'Mailbox or routing address' },
  { value: 'google_drive', label: 'Google Drive', placeholder: 'Folder URL or ID' },
  { value: 'upload', label: 'Manual upload', placeholder: 'No reference required' },
  { value: 'mcp', label: 'Other connector', placeholder: 'MCP, API, SharePoint, CRM…' },
];

function labelForChannel(type: string) {
  return CHANNEL_OPTIONS.find((option) => option.value === type)?.label || type.replaceAll('_', ' ');
}

export default function EditAgentPage() {
  const router = useRouter();
  const agentId = Number(router.query.id);
  const [agent, setAgent] = useState<Agent | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [brief, setBrief] = useState('');
  const [channels, setChannels] = useState<DraftChannel[]>([]);
  const [preview, setPreview] = useState<AgentDesignPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [whatsApp, setWhatsApp] = useState<WhatsAppConnection | null>(null);
  const [whatsAppLoading, setWhatsAppLoading] = useState(false);
  const [whatsAppError, setWhatsAppError] = useState<string | null>(null);
  const [sqlConnections, setSqlConnections] = useState<SqlAccountConnection[]>([]);
  const [sqlEnabled, setSqlEnabled] = useState(false);
  const [sqlConnectionId, setSqlConnectionId] = useState<number | ''>('');
  const [sqlApiUrl, setSqlApiUrl] = useState('');
  const [sqlDiscountCode, setSqlDiscountCode] = useState('');
  const [sqlTesting, setSqlTesting] = useState(false);
  const [sqlTestMessage, setSqlTestMessage] = useState<string | null>(null);
  const [sqlAdding, setSqlAdding] = useState(false);
  const [sqlCreating, setSqlCreating] = useState(false);
  const [sqlNewName, setSqlNewName] = useState('');
  const [sqlNewApiUrl, setSqlNewApiUrl] = useState('');
  const [sqlNewApiKey, setSqlNewApiKey] = useState('');
  // Written on demand: the API never returns a key, so rotating one means
  // re-entering it rather than editing a value we could have shown back.
  const [sqlRotateKey, setSqlRotateKey] = useState('');
  const [separateItemCode, setSeparateItemCode] = useState(false);

  useEffect(() => {
    if (!agentId) return;
    Promise.all([getAgent(agentId), listSqlAccountConnections()]).then(([result, connectionResult]) => {
      setAgent(result);
      setName(result.name);
      setDescription(result.description || '');
      setBrief(result.instructions || '');
      setChannels(result.channels.map((channel) => ({
        id: channel.id, channel_type: channel.channel_type,
        channel_ref: channel.channel_ref || null, is_active: channel.is_active,
      })));
      setSeparateItemCode(Boolean((result.config as { separate_item_code?: boolean } | null)?.separate_item_code));
      setSqlConnections(connectionResult.connections);
      const sqlOutput = result.outputs.find((output) => output.output_type === 'sql_account');
      const configuredId = Number(sqlOutput?.config?.connection_id);
      setSqlEnabled(Boolean(sqlOutput?.is_active));
      const selectedId = Number.isFinite(configuredId) && configuredId > 0 ? configuredId : (connectionResult.connections.find((connection) => connection.is_active)?.id || '');
      setSqlConnectionId(selectedId);
      const selected = connectionResult.connections.find((connection) => connection.id === selectedId);
      setSqlApiUrl(selected?.api_url || '');
      setSqlDiscountCode(String((selected?.config as { discount_item_code?: string } | null)?.discount_item_code || ''));
    }).catch((reason) => setError(reason?.message || 'Could not load this agent.'))
      .finally(() => setLoading(false));
  }, [agentId]);

  const requiresNewPlan = useMemo(
    () => !!agent && brief.trim() !== (agent.instructions || '').trim(),
    [agent, brief],
  );

  const refreshWhatsApp = useCallback(async () => {
    if (!agentId) return;
    try {
      const connection = await getWhatsAppConnection(agentId);
      setWhatsApp(connection);
      setWhatsAppError(null);
    } catch (reason) {
      setWhatsAppError((reason as Error)?.message || 'WhatsApp bridge is unavailable.');
    }
  }, [agentId]);

  useEffect(() => {
    if (!agent?.channels.some((channel) => channel.channel_type === 'whatsapp_group')) return;
    refreshWhatsApp();
  }, [agent, refreshWhatsApp]);

  useEffect(() => {
    if (!['connecting', 'awaiting_qr_scan', 'reconnecting'].includes(whatsApp?.status || '')) return;
    const timer = window.setInterval(refreshWhatsApp, 3000);
    return () => window.clearInterval(timer);
  }, [whatsApp?.status, refreshWhatsApp]);

  const invalidatePlan = () => { if (preview) setPreview(null); };
  const updateDraftChannel = (index: number, patch: Partial<DraftChannel>) => {
    invalidatePlan();
    setChannels((items) => items.map((channel, itemIndex) => itemIndex === index ? { ...channel, ...patch } : channel));
  };
  const removeChannel = (index: number) => {
    invalidatePlan();
    setChannels((items) => items.filter((_, itemIndex) => itemIndex !== index));
  };

  const generatePlan = async () => {
    if (brief.trim().length < 8) { setError('Describe what this agent should do before generating a plan.'); return; }
    setGenerating(true); setError(null);
    try {
      setPreview(await previewAgentDesign({ name, description, instructions: brief, channels }));
    } catch (reason) {
      setError((reason as Error)?.message || 'We could not generate a new plan.');
    } finally { setGenerating(false); }
  };

  const save = async () => {
    if (!agent || !name.trim()) { setError('Please give the agent a name.'); return; }
    if (requiresNewPlan && !preview) { setError('Regenerate and review the agent plan after changing its brief.'); return; }
    if (sqlEnabled && !sqlConnectionId) { setError('Choose an active SQL Account connection before enabling SQL output.'); return; }
    if (sqlEnabled && !sqlApiUrl.trim()) { setError('Enter the SDK Live API URL before enabling SQL output.'); return; }
    setSaving(true); setError(null);
    try {
      const basicUpdate: Partial<Agent> = {
        name: name.trim(), description: description.trim() || null, instructions: brief.trim() || null,
        approval_required: preview?.approval_required ?? agent.approval_required,
        config: { ...(agent.config || {}), separate_item_code: separateItemCode },
        ...(preview ? {
          skills: preview.skills,
          record_type: preview.record_type || agent.record_type,
          extraction_profile: preview.extraction_profile || null,
        } : {}),
      };
      await updateAgent(agent.id, basicUpdate);

      const selectedConnection = sqlConnections.find((connection) => connection.id === sqlConnectionId);
      if (sqlEnabled && selectedConnection) {
        const connectionPatch: SqlAccountConnectionPayload = {};
        if (sqlApiUrl.trim() !== (selectedConnection.api_url || '').trim()) connectionPatch.api_url = sqlApiUrl.trim().replace(/\/$/, '');
        if (sqlRotateKey.trim()) connectionPatch.api_key = sqlRotateKey.trim();
        const savedDiscount = String((selectedConnection.config as { discount_item_code?: string } | null)?.discount_item_code || '');
        if (sqlDiscountCode.trim() !== savedDiscount) {
          connectionPatch.config = { ...(selectedConnection.config || {}), discount_item_code: sqlDiscountCode.trim() || null };
        }
        if (Object.keys(connectionPatch).length > 0) {
          const updatedConnection = await updateSqlAccountConnection(selectedConnection.id, connectionPatch);
          setSqlConnections((connections) => connections.map((connection) => connection.id === updatedConnection.id ? updatedConnection : connection));
          setSqlRotateKey('');
        }
      }

      const remainingIds = new Set(channels.flatMap((channel) => channel.id ? [channel.id] : []));
      await Promise.all(agent.channels.filter((channel) => !remainingIds.has(channel.id)).map((channel) => deleteChannel(agent.id, channel.id)));
      await Promise.all(channels.map((channel) => {
        const payload = { channel_type: channel.channel_type, channel_ref: channel.channel_ref || null, is_active: channel.is_active };
        return channel.id ? updateChannel(agent.id, channel.id, payload) : addChannel(agent.id, payload);
      }));

      // Output adapters are generated as a reviewed plan. Replace them only when
      // the user explicitly regenerated that plan; otherwise existing adapters
      // (and their stored configuration) are preserved.
      let savedOutputs: AgentOutput[] = agent.outputs;
      if (preview) {
        await Promise.all(agent.outputs.map((output) => deleteOutput(agent.id, output.id)));
        savedOutputs = await Promise.all(preview.recommended_outputs.map((output, index) => addOutput(agent.id, {
          output_type: output, sort_order: index, is_active: true,
        })));
      }

      // SQL Account is an explicit, reviewable destination. It intentionally
      // survives plan regeneration and stores only the connection ID, never a
      // credential. The backend resolves customer/item master data at approval.
      const sqlOutput = savedOutputs.find((output) => output.output_type === 'sql_account');
      if (sqlEnabled) {
        const sqlPayload = { output_type: 'sql_account', config: { connection_id: Number(sqlConnectionId) }, is_active: true };
        if (sqlOutput) await updateOutput(agent.id, sqlOutput.id, sqlPayload);
        else await addOutput(agent.id, { ...sqlPayload, sort_order: savedOutputs.length });
      } else if (sqlOutput) {
        await updateOutput(agent.id, sqlOutput.id, { is_active: false });
      }
      router.push(`/agents/${agent.id}`);
    } catch (reason) {
      setError((reason as Error)?.message || 'Could not save the agent configuration.');
    } finally { setSaving(false); }
  };

  const removeAgent = async () => {
    if (!agent || confirmText !== agent.name) return;
    setDeleting(true); setError(null);
    try {
      await deleteAgent(agent.id);
      router.push('/agents');
    } catch (reason) {
      setError((reason as Error)?.message || 'Could not delete this agent.');
      setDeleting(false);
    }
  };

  const startWhatsAppConnect = async () => {
    if (!agent) return;
    setWhatsAppLoading(true); setWhatsAppError(null);
    try { setWhatsApp(await connectWhatsApp(agent.id)); }
    catch (reason) { setWhatsAppError((reason as Error)?.message || 'Could not start WhatsApp pairing.'); }
    finally { setWhatsAppLoading(false); }
  };

  const stopWhatsAppConnect = async () => {
    if (!agent) return;
    setWhatsAppLoading(true); setWhatsAppError(null);
    try { setWhatsApp(await disconnectWhatsApp(agent.id)); }
    catch (reason) { setWhatsAppError((reason as Error)?.message || 'Could not disconnect the WhatsApp bot.'); }
    finally { setWhatsAppLoading(false); }
  };

  const testSqlConnection = async () => {
    if (!sqlConnectionId) return;
    setSqlTesting(true); setSqlTestMessage(null);
    try {
      const selectedConnection = sqlConnections.find((connection) => connection.id === sqlConnectionId);
      if (selectedConnection && sqlRotateKey.trim()) {
        await updateSqlAccountConnection(selectedConnection.id, { api_key: sqlRotateKey.trim() });
        setSqlRotateKey('');
      }
      if (selectedConnection && sqlApiUrl.trim() !== (selectedConnection.api_url || '').trim()) {
        const updatedConnection = await updateSqlAccountConnection(selectedConnection.id, { api_url: sqlApiUrl.trim().replace(/\/$/, '') });
        setSqlConnections((connections) => connections.map((connection) => connection.id === updatedConnection.id ? updatedConnection : connection));
      }
      const result = await testSqlAccountConnection(Number(sqlConnectionId));
      setSqlTestMessage(`${result.status === 'success' ? 'Connected' : 'Could not connect'}: ${result.message}`);
    } catch (reason) {
      setSqlTestMessage((reason as Error)?.message || 'Could not test the SQL Account connection.');
    } finally { setSqlTesting(false); }
  };

  // SDK Live pushes require mode 'sdk_call' plus URL and key, so creation always
  // sets all three. A staging-default connection would pass a test and then fail
  // every approval push.
  const createSqlConnection = async () => {
    if (!sqlNewApiUrl.trim() || !sqlNewApiKey.trim()) { setSqlTestMessage('Enter both the SDK Live API URL and connector key.'); return; }
    setSqlCreating(true); setSqlTestMessage(null);
    try {
      const created = await createSqlAccountConnection({
        name: sqlNewName.trim() || 'SQL Account SDK Live',
        mode: 'sdk_call',
        api_url: sqlNewApiUrl.trim().replace(/\/$/, ''),
        api_key: sqlNewApiKey.trim(),
      });
      setSqlConnections((connections) => [created, ...connections]);
      setSqlConnectionId(created.id);
      setSqlApiUrl(created.api_url || '');
      setSqlAdding(false);
      setSqlNewName(''); setSqlNewApiUrl(''); setSqlNewApiKey('');
      setSqlTestMessage('Connection saved. Test it to confirm the connector is reachable.');
    } catch (reason) {
      setSqlTestMessage((reason as Error)?.message || 'Could not create the SQL Account connection.');
    } finally { setSqlCreating(false); }
  };

  return (
    <AppLayout pageName={agent ? `Edit ${agent.name}` : 'Edit agent'}>
      <div className="mx-auto max-w-5xl pb-10">
        <button onClick={() => router.push(agentId ? `/agents/${agentId}` : '/agents')} className="mb-6 flex items-center gap-1.5 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]"><ArrowLeft className="h-4 w-4" /> Back to agent</button>
        {loading && <p className="text-sm text-[var(--muted-foreground)]">Loading configuration…</p>}
        {agent && <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm sm:p-7">
            <div className="flex items-start gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-600 text-white"><Pencil className="h-5 w-5" /></span><div><h1 className="text-2xl font-semibold">Edit agent configuration</h1><p className="mt-1 text-sm text-[var(--muted-foreground)]">Update the business brief, sources, and reviewed automation plan.</p></div></div>
            <div className="mt-7 grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-medium">Name<input value={name} onChange={(event) => { setName(event.target.value); invalidatePlan(); }} className="mt-2 w-full rounded-xl border border-[var(--border)] bg-transparent px-3 py-2.5 font-normal outline-none focus:border-cyan-500" /></label>
              <label className="text-sm font-medium">Description<input value={description} onChange={(event) => { setDescription(event.target.value); invalidatePlan(); }} className="mt-2 w-full rounded-xl border border-[var(--border)] bg-transparent px-3 py-2.5 font-normal outline-none focus:border-cyan-500" /></label>
            </div>
            <label className="mt-6 block text-sm font-medium">What should this agent be able to do?<textarea value={brief} onChange={(event) => { setBrief(event.target.value); invalidatePlan(); }} rows={7} placeholder="Describe the business outcome in plain language" className="mt-2 w-full rounded-xl border border-[var(--border)] bg-transparent px-3 py-3 font-normal leading-6 outline-none focus:border-cyan-500" /></label>

            <div className="mt-7 border-t border-[var(--border)] pt-6"><div className="flex items-start justify-between gap-4"><div><h2 className="font-semibold">Input channels</h2><p className="mt-1 text-sm text-[var(--muted-foreground)]">Add, change, or remove the sources this agent listens to.</p></div><button type="button" onClick={() => { invalidatePlan(); setChannels((items) => [...items, { channel_type: 'email', channel_ref: null, is_active: true }]); }} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-cyan-500/40 px-3 py-2 text-xs font-medium text-cyan-700 hover:bg-cyan-500/10 dark:text-cyan-300"><Plus className="h-3.5 w-3.5" /> Add source</button></div>
              <div className="mt-4 space-y-3">{channels.map((channel, index) => <div key={channel.id || `new-${index}`} className="grid gap-2 rounded-xl border border-[var(--border)] p-3 sm:grid-cols-[160px_1fr_auto]"><select value={channel.channel_type} onChange={(event) => updateDraftChannel(index, { channel_type: event.target.value, channel_ref: null })} className="rounded-lg border border-[var(--border)] bg-transparent px-2.5 py-2 text-sm"><option value={channel.channel_type}>{labelForChannel(channel.channel_type)}</option>{CHANNEL_OPTIONS.filter((option) => option.value !== channel.channel_type).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><input value={channel.channel_ref || ''} onChange={(event) => updateDraftChannel(index, { channel_ref: event.target.value || null })} placeholder={CHANNEL_OPTIONS.find((option) => option.value === channel.channel_type)?.placeholder || 'Channel reference'} className="rounded-lg border border-[var(--border)] bg-transparent px-2.5 py-2 text-sm outline-none focus:border-cyan-500" /><button type="button" onClick={() => removeChannel(index)} className="inline-flex items-center justify-center rounded-lg px-2 py-2 text-red-600 hover:bg-red-500/10" aria-label={`Remove ${labelForChannel(channel.channel_type)}`}><Trash2 className="h-4 w-4" /></button></div>)}{channels.length === 0 && <p className="rounded-xl border border-dashed border-[var(--border)] p-4 text-sm text-[var(--muted-foreground)]">No input sources configured. Add at least one source before activating this agent.</p>}</div>
            </div>
            <section className="mt-7 border-t border-[var(--border)] pt-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div><h2 className="font-semibold">Document layout</h2><p className="mt-1 max-w-xl text-sm leading-6 text-[var(--muted-foreground)]">By default the item code is folded into each line’s description. Enable this for customers who want ITEM CODE as its own column on the DO/Invoice.</p></div>
                <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium"><input type="checkbox" checked={separateItemCode} onChange={(event) => setSeparateItemCode(event.target.checked)} className="h-4 w-4 accent-cyan-600" /> Separate item code column</label>
              </div>
            </section>
            <section className="mt-7 border-t border-[var(--border)] pt-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-violet-700 dark:text-violet-300"><Database className="h-4.5 w-4.5" /></span>
                  <div><h2 className="font-semibold">SQL Account output</h2><p className="mt-1 max-w-xl text-sm leading-6 text-[var(--muted-foreground)]">After approval, create the Delivery Order and Sales Invoice in your on-premise SQL Account through SDK Live.</p></div>
                </div>
                <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium"><input type="checkbox" checked={sqlEnabled} onChange={(event) => { setSqlEnabled(event.target.checked); setSqlTestMessage(null); }} className="h-4 w-4 accent-violet-600" /> Enable SQL push</label>
              </div>
              {sqlEnabled && <div className="mt-4 rounded-xl border border-violet-500/25 bg-violet-500/5 p-4">
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end">
                  <label className="text-sm font-medium">Connection<select value={sqlConnectionId} onChange={(event) => { const id = event.target.value ? Number(event.target.value) : ''; setSqlConnectionId(id); const picked = sqlConnections.find((connection) => connection.id === id); setSqlApiUrl(picked?.api_url || ''); setSqlDiscountCode(String((picked?.config as { discount_item_code?: string } | null)?.discount_item_code || '')); setSqlTestMessage(null); }} className="mt-2 block w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 font-normal outline-none focus:border-violet-500"><option value="">Select SQL Account connection</option>{sqlConnections.filter((connection) => connection.is_active).map((connection) => <option key={connection.id} value={connection.id}>{connection.name || `SQL Account connection #${connection.id}`} ({connection.mode})</option>)}</select></label>
                  <button type="button" onClick={() => { setSqlAdding((adding) => !adding); setSqlTestMessage(null); }} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-violet-500/40 px-3.5 text-sm font-medium text-violet-700 hover:bg-violet-500/10 dark:text-violet-300"><Plus className="h-4 w-4" />{sqlAdding ? 'Cancel' : 'Add connection'}</button>
                  <button type="button" disabled={!sqlConnectionId || !sqlApiUrl.trim() || sqlTesting || sqlAdding} onClick={testSqlConnection} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-violet-500/40 px-3.5 text-sm font-medium text-violet-700 hover:bg-violet-500/10 disabled:opacity-50 dark:text-violet-300">{sqlTesting && <LoaderCircle className="h-4 w-4 animate-spin" />}{sqlTesting ? 'Testing…' : 'Test connection'}</button>
                </div>
                {sqlAdding ? <div className="mt-3 grid gap-3 rounded-lg border border-violet-500/25 bg-[var(--card)] p-3">
                  <label className="text-sm font-medium">Name<input value={sqlNewName} onChange={(event) => setSqlNewName(event.target.value)} placeholder="SQL Account SDK Live" className="mt-2 block w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2.5 font-normal outline-none focus:border-violet-500" /></label>
                  <label className="text-sm font-medium">SDK Live API URL<input type="url" value={sqlNewApiUrl} onChange={(event) => setSqlNewApiUrl(event.target.value)} placeholder="https://sqlsdk.ngrok.app" className="mt-2 block w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2.5 font-normal outline-none focus:border-violet-500" /></label>
                  <label className="text-sm font-medium">Connector key<input type="password" autoComplete="new-password" value={sqlNewApiKey} onChange={(event) => setSqlNewApiKey(event.target.value)} placeholder="X-SQLAccount-Connector-Key value" className="mt-2 block w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2.5 font-normal outline-none focus:border-violet-500" /><span className="mt-1.5 block text-xs font-normal text-[var(--muted-foreground)]">Stored write-only and never shown again. It must match the key your SDK Live connector expects.</span></label>
                  <div><button type="button" disabled={sqlCreating || !sqlNewApiUrl.trim() || !sqlNewApiKey.trim()} onClick={createSqlConnection} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-violet-600 px-3.5 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50">{sqlCreating && <LoaderCircle className="h-4 w-4 animate-spin" />}{sqlCreating ? 'Saving…' : 'Save connection'}</button></div>
                </div> : sqlConnectionId ? <>
                  <label className="mt-3 block text-sm font-medium">SDK Live API URL<input type="url" value={sqlApiUrl} onChange={(event) => { setSqlApiUrl(event.target.value); setSqlTestMessage(null); }} placeholder="http://127.0.0.1:8787" className="mt-2 block w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 font-normal outline-none focus:border-violet-500" /></label>
                  <label className="mt-3 block text-sm font-medium">Connector key<input type="password" autoComplete="new-password" value={sqlRotateKey} onChange={(event) => { setSqlRotateKey(event.target.value); setSqlTestMessage(null); }} placeholder="Leave blank to keep the saved key" className="mt-2 block w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 font-normal outline-none focus:border-violet-500" /></label>
                  <label className="mt-3 block text-sm font-medium">Discount item code<input value={sqlDiscountCode} onChange={(event) => { setSqlDiscountCode(event.target.value); setSqlTestMessage(null); }} placeholder="e.g. DISCOUNT (leave blank if unused)" className="mt-2 block w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 font-normal outline-none focus:border-violet-500" /><span className="mt-1.5 block text-xs font-normal text-[var(--muted-foreground)]">SQL Account stock/service code used to post a discount/deduction line (e.g. “Deduct −1,143.96”). Set it so the SQL invoice total matches; leave blank to skip discounts and apply them in SQL Account.</span></label>
                </> : null}
                {!sqlAdding && sqlConnections.filter((connection) => connection.is_active).length === 0 && <p className="mt-3 text-sm text-amber-700 dark:text-amber-300">No active SQL Account connection yet. Choose “Add connection” and enter your SDK Live URL and connector key.</p>}
                {sqlTestMessage && <p className={`mt-3 text-sm ${/^(Connected:|Connection saved)/.test(sqlTestMessage) ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}`}>{sqlTestMessage}</p>}
                <p className="mt-3 text-xs leading-5 text-[var(--muted-foreground)]">This URL is called by the Smartdok backend, not by your browser. Use <code>http://127.0.0.1:8787</code> only when the backend and connector run on the same Windows machine; otherwise use the connector machine’s reachable LAN URL. Smartdok will look up the customer and stock item in SQL Account at approval time.</p>
              </div>}
            </section>
            {error && <p className="mt-5 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">{error}</p>}
            <div className="mt-7 flex flex-wrap gap-3"><button type="button" onClick={generatePlan} disabled={generating} className="inline-flex items-center gap-2 rounded-xl border border-cyan-500/40 px-4 py-2.5 text-sm font-medium text-cyan-700 hover:bg-cyan-500/10 disabled:opacity-60 dark:text-cyan-300">{generating ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}{generating ? 'Generating…' : 'Regenerate agent plan'}</button><button type="button" onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-medium text-white hover:bg-[var(--primary-hover)] disabled:opacity-60">{saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}Save changes</button></div>
          </section>

          <aside className="space-y-6 lg:sticky lg:top-6 lg:h-fit">{agent.channels.some((channel) => channel.channel_type === 'whatsapp_group') && <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-sm"><div className="border-b border-[var(--border)] bg-emerald-500/5 p-5"><div className="flex items-center gap-2"><MessageCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-300" /><div><h2 className="font-semibold">WhatsApp bot</h2><p className="text-xs text-[var(--muted-foreground)]">Pair the dedicated business number for this agent.</p></div></div></div><div className="p-5">{whatsAppError ? <div><p className="rounded-xl border border-amber-300/50 bg-amber-400/10 p-3 text-sm leading-6 text-amber-900 dark:text-amber-100">{whatsAppError}</p><p className="mt-3 text-xs leading-5 text-[var(--muted-foreground)]">The bridge service must be configured and running before a QR code can be shown. See <code>whatsapp-bridge/README.md</code>.</p></div> : <>{whatsApp?.status === 'connected' ? <div className="rounded-xl border border-emerald-300/40 bg-emerald-500/10 p-3 text-sm text-emerald-800 dark:text-emerald-200"><div className="flex items-center gap-2 font-medium"><Check className="h-4 w-4" /> Connected</div><p className="mt-1 text-xs">{whatsApp.phone_number ? `Bot number: +${whatsApp.phone_number}` : 'Dedicated bot account linked.'}</p><p className="mt-1 break-all text-xs">Listening to {whatsApp.group_jid}</p></div> : whatsApp?.qr_data_url ? <div><p className="text-sm leading-6 text-[var(--muted-foreground)]">On the dedicated WhatsApp Business phone, open <strong>Settings → Linked devices → Link a device</strong>, then scan this QR code.</p><img src={whatsApp.qr_data_url} alt="WhatsApp pairing QR code" className="mx-auto mt-4 w-64 rounded-xl border border-[var(--border)] bg-white p-2" /><p className="mt-3 text-center text-xs text-[var(--muted-foreground)]">This code refreshes automatically. Do not share it.</p></div> : <div><p className="text-sm leading-6 text-[var(--muted-foreground)]">Use a real dedicated WhatsApp Business number. Clicking connect creates a QR code; the phone owner scans it directly here.</p>{whatsApp?.last_error && <p className="mt-3 rounded-lg bg-red-500/10 p-2 text-xs text-red-700 dark:text-red-300">{whatsApp.last_error}</p>}</div>}<div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={startWhatsAppConnect} disabled={whatsAppLoading || whatsApp?.status === 'connected'} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50">{whatsAppLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}{whatsApp?.status === 'connected' ? 'Bot connected' : 'Connect WhatsApp bot'}</button><button type="button" onClick={refreshWhatsApp} disabled={whatsAppLoading} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-2 text-sm hover:bg-[var(--hover-bg)]"><RefreshCw className="h-3.5 w-3.5" /> Refresh</button>{whatsApp?.status === 'connected' && <button type="button" onClick={stopWhatsAppConnect} disabled={whatsAppLoading} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-2 text-sm text-red-600 hover:bg-red-500/10"><Unplug className="h-3.5 w-3.5" /> Disconnect</button>}</div></>}</div></section>}<section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-sm"><div className="border-b border-[var(--border)] bg-cyan-500/5 p-5"><div className="flex items-center gap-2"><Workflow className="h-5 w-5 text-cyan-600 dark:text-cyan-300" /><h2 className="font-semibold">Reviewed plan</h2></div></div>{preview ? <div className="p-5"><p className="text-sm leading-6 text-[var(--muted-foreground)]">{preview.summary}</p><div className="mt-4 space-y-3">{preview.capabilities.map((capability) => <div key={`${capability.skill}-${capability.title}`} className="rounded-xl border border-[var(--border)] p-3"><p className="text-sm font-medium">{capability.title}</p><p className="mt-1 text-xs leading-5 text-[var(--muted-foreground)]">{capability.description}</p></div>)}</div><div className="mt-4 rounded-xl bg-amber-400/10 p-3 text-xs text-amber-800 dark:text-amber-200"><strong>Approval:</strong> {preview.approval_required ? 'required before any output runs.' : 'not required by this plan.'}</div></div> : <div className="p-5 text-sm leading-6 text-[var(--muted-foreground)]">Keep the current plan, or regenerate it after changing the brief. Regenerating updates the agent’s capabilities and output adapters when you save.</div>}</section>
            <section className="rounded-2xl border border-red-200 bg-red-50/60 p-5 dark:border-red-900/70 dark:bg-red-950/15"><h2 className="flex items-center gap-2 font-semibold text-red-800 dark:text-red-200"><Trash2 className="h-4 w-4" /> Danger zone</h2><p className="mt-2 text-sm leading-6 text-red-700/80 dark:text-red-300/80">Deleting this agent removes its configuration and cannot be undone.</p><label className="mt-4 block text-xs font-medium text-red-800 dark:text-red-200">Type <strong>{agent.name}</strong> to confirm<input value={confirmText} onChange={(event) => setConfirmText(event.target.value)} className="mt-2 w-full rounded-lg border border-red-200 bg-white/80 px-2.5 py-2 text-sm text-[var(--foreground)] outline-none dark:border-red-900 dark:bg-[var(--card)]" /></label><button type="button" onClick={removeAgent} disabled={deleting || confirmText !== agent.name} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-red-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50">{deleting && <LoaderCircle className="h-4 w-4 animate-spin" />}Delete agent<ChevronRight className="h-4 w-4" /></button></section>
          </aside>
        </div>}
      </div>
    </AppLayout>
  );
}
