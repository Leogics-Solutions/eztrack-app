'use client';

import { AppLayout } from '@/components/layout';
import { useOrganization } from '@/lib/OrganizationContext';
import {
  connectWhatsApp,
  createWhatsAppConnection,
  deleteWhatsAppConnection,
  disconnectWhatsApp,
  getWhatsAppConnection,
  listWhatsAppConnections,
  listWhatsAppGroups,
  type WhatsAppConnection,
  type WhatsAppGroup,
} from '@/services/WhatsAppService';
import { ArrowLeft, CheckCircle2, LoaderCircle, MessageCircle, Plus, RefreshCw, Search, Trash2, Unplug, Users } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

export default function WhatsAppIntegrationsPage() {
  const { selectedOrganizationId } = useOrganization();
  const [connections, setConnections] = useState<WhatsAppConnection[]>([]);
  const [groups, setGroups] = useState<Record<number, WhatsAppGroup[]>>({});
  const [groupSearch, setGroupSearch] = useState<Record<number, string>>({});
  const [name, setName] = useState('Maincell WhatsApp');
  const [busy, setBusy] = useState<number | 'create' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setConnections(await listWhatsAppConnections()); setError(null); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not load WhatsApp connections.'); }
  }, []);

  useEffect(() => { void load(); }, [load, selectedOrganizationId]);

  useEffect(() => {
    const pairing = connections.filter((item) => ['connecting', 'awaiting_qr_scan', 'reconnecting'].includes(item.status));
    if (!pairing.length) return;
    const timer = window.setInterval(async () => {
      const updates = await Promise.all(pairing.map((item) => getWhatsAppConnection(item.id).catch(() => item)));
      setConnections((current) => current.map((item) => updates.find((update) => update.id === item.id) || item));
    }, 2500);
    return () => window.clearInterval(timer);
  }, [connections]);

  const create = async () => {
    if (!name.trim()) return;
    setBusy('create'); setError(null);
    try {
      const created = await createWhatsAppConnection(name.trim());
      setConnections((current) => [...current, created]);
      setName('');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not create connection.'); }
    finally { setBusy(null); }
  };

  const act = async (id: number, action: () => Promise<WhatsAppConnection>) => {
    setBusy(id); setError(null);
    try {
      const updated = await action();
      setConnections((current) => current.map((item) => item.id === id ? updated : item));
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'WhatsApp action failed.'); }
    finally { setBusy(null); }
  };

  const loadGroups = async (id: number) => {
    setBusy(id); setError(null);
    try {
      const availableGroups = await listWhatsAppGroups(id);
      setGroups((current) => ({ ...current, [id]: availableGroups }));
    }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not load groups.'); }
    finally { setBusy(null); }
  };

  const remove = async (connection: WhatsAppConnection) => {
    if (connection.in_use) return;
    if (!window.confirm(`Remove ${connection.name}? The saved WhatsApp session will remain on the private runner.`)) return;
    setBusy(connection.id); setError(null);
    try {
      await deleteWhatsAppConnection(connection.id);
      setConnections((current) => current.filter((item) => item.id !== connection.id));
      setGroups((current) => {
        const next = { ...current };
        delete next[connection.id];
        return next;
      });
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not remove WhatsApp connection.'); }
    finally { setBusy(null); }
  };

  return <AppLayout pageName="WhatsApp connections">
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <Link href="/integrations" className="inline-flex items-center gap-1 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]"><ArrowLeft className="h-4 w-4" /> Integrations</Link>
        <h1 className="mt-4 text-2xl font-bold">WhatsApp connections</h1>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--muted-foreground)]">Pair company-owned WhatsApp accounts here once. Automations then choose one or more groups from these reusable connections.</p>
      </header>

      {error && <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100">{error}</div>}

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
        <h2 className="font-semibold">Add WhatsApp account</h2>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Example: Maincell operations phone" className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-transparent px-3 py-2.5 text-sm" />
          <button type="button" onClick={() => void create()} disabled={busy === 'create' || !name.trim()} className="inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy === 'create' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add connection</button>
        </div>
      </section>

      <div className="space-y-4">
        {connections.map((connection) => <article key={connection.id} className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"><MessageCircle className="h-5 w-5" /></span><div><h2 className="font-semibold">{connection.name}</h2><p className="mt-1 text-xs text-[var(--muted-foreground)]">{connection.phone_number ? `+${connection.phone_number}` : 'Not paired yet'} · Connection #{connection.id}</p></div></div>
            <span className={`w-fit rounded-full border px-2.5 py-1 text-xs font-semibold ${connection.status === 'connected' ? 'border-emerald-300 bg-emerald-100 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100' : 'border-amber-300 bg-amber-100 text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100'}`}>{connection.status.replaceAll('_', ' ')}</span>
          </div>
          {connection.last_error && <p className="mt-3 rounded-lg bg-red-500/10 p-3 text-xs text-red-800 dark:text-red-200">{connection.last_error}</p>}
          {connection.in_use && <p className="mt-3 rounded-lg bg-cyan-500/10 p-3 text-xs text-cyan-900 dark:text-cyan-100">Assigned to: {connection.automation_names.join(', ')}. Remove its automation channel binding before deleting this connection.</p>}
          {connection.qr_data_url && <div className="mt-4 rounded-xl border border-[var(--border)] bg-white p-4 text-center text-slate-950"><Image src={connection.qr_data_url} alt="WhatsApp pairing QR code" width={256} height={256} unoptimized className="mx-auto" /><p className="mt-2 text-sm font-semibold">Scan from WhatsApp → Linked devices</p></div>}
          <div className="mt-4 flex flex-wrap gap-2">
            {connection.status !== 'connected' && <button type="button" onClick={() => void act(connection.id, () => connectWhatsApp(connection.id))} disabled={busy === connection.id} className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"><MessageCircle className="h-4 w-4" /> Connect account</button>}
            <button type="button" onClick={() => void act(connection.id, () => getWhatsAppConnection(connection.id))} disabled={busy === connection.id} className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-semibold"><RefreshCw className={`h-4 w-4 ${busy === connection.id ? 'animate-spin' : ''}`} /> Refresh</button>
            {connection.status === 'connected' && <button type="button" onClick={() => void loadGroups(connection.id)} disabled={busy === connection.id} className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-semibold"><Users className="h-4 w-4" /> View groups</button>}
            {connection.status === 'connected' && <button type="button" onClick={() => void act(connection.id, () => disconnectWhatsApp(connection.id))} disabled={busy === connection.id} className="inline-flex items-center gap-2 rounded-lg border border-red-300 px-3 py-2 text-sm font-semibold text-red-700 dark:text-red-300"><Unplug className="h-4 w-4" /> Disconnect</button>}
            <button type="button" onClick={() => void remove(connection)} disabled={busy === connection.id || connection.in_use} title={connection.in_use ? `Used by ${connection.automation_names.join(', ')}` : 'Remove connection'} className="inline-flex items-center gap-2 rounded-lg border border-red-300 px-3 py-2 text-sm font-semibold text-red-700 disabled:cursor-not-allowed disabled:opacity-50 dark:text-red-300"><Trash2 className="h-4 w-4" /> {connection.in_use ? 'Used by automation' : 'Remove'}</button>
          </div>
          {groups[connection.id] && (() => {
            const query = (groupSearch[connection.id] || '').trim().toLowerCase();
            const filteredGroups = groups[connection.id].filter((group) => !query || group.name.toLowerCase().includes(query) || group.jid.toLowerCase().includes(query));
            return <div className="mt-4 rounded-xl bg-[var(--muted)] p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm font-semibold">Available groups ({filteredGroups.length} of {groups[connection.id].length})</p><label className="relative block sm:w-72"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" /><input value={groupSearch[connection.id] || ''} onChange={(event) => setGroupSearch((current) => ({ ...current, [connection.id]: event.target.value }))} placeholder="Search groups" className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] py-2 pl-9 pr-3 text-sm outline-none focus:border-cyan-500" /></label></div>
              <div className="mt-3 max-h-80 overflow-y-auto overscroll-contain pr-1"><div className="grid gap-2 sm:grid-cols-2">{filteredGroups.map((group) => <div key={group.jid} className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-3 text-sm"><div className="flex items-center gap-2 font-medium"><CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" /><span className="min-w-0 break-words">{group.name}</span></div><p className="mt-1 text-xs text-[var(--muted-foreground)]">{group.participant_count} members</p></div>)}</div>{!filteredGroups.length && <p className="py-8 text-center text-sm text-[var(--muted-foreground)]">No groups match “{groupSearch[connection.id]}”.</p>}</div>
            </div>;
          })()}
        </article>)}
        {!connections.length && <div className="rounded-2xl border border-dashed border-[var(--border)] p-10 text-center text-sm text-[var(--muted-foreground)]">No WhatsApp account connected for this company.</div>}
      </div>
    </div>
  </AppLayout>;
}
