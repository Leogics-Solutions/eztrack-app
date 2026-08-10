'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, LoaderCircle, MessageCircle, Plus, RefreshCw, Search, Send, Trash2, Unplug, Users } from 'lucide-react';
import { AppLayout } from '@/components/layout';
import { useOrganization } from '@/lib/OrganizationContext';
import { connectWeChat, createWeChatConnection, deleteWeChatConnection, disconnectWeChat, getWeChatConnection, listWeChatConnections, listWeChatGroups, sendWeChatTestMessage, type WeChatConnection, type WeChatGroup } from '@/services/WeChatService';

export default function WeChatIntegrationsPage() {
  const { selectedOrganizationId } = useOrganization();
  const [connections, setConnections] = useState<WeChatConnection[]>([]);
  const [groups, setGroups] = useState<Record<number, WeChatGroup[]>>({});
  const [search, setSearch] = useState<Record<number, string>>({});
  const [name, setName] = useState('Payment WeChat');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setConnections(await listWeChatConnections()); setError(null); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not load WeChat connections.'); }
  }, []);
  useEffect(() => { void load(); }, [load, selectedOrganizationId]);

  async function create(event: FormEvent) {
    event.preventDefault(); setBusy('create'); setError(null);
    try { await createWeChatConnection(name.trim()); setName('Payment WeChat'); await load(); setNotice('Connection added. Start the local WeChat runner, then connect it here.'); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not create connection.'); }
    finally { setBusy(null); }
  }
  async function act(id: number, label: string, action: () => Promise<unknown>) {
    setBusy(`${label}-${id}`); setError(null); setNotice(null);
    try { await action(); await load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'WeChat action failed.'); }
    finally { setBusy(null); }
  }
  async function loadGroups(id: number) {
    await act(id, 'groups', async () => { const items = await listWeChatGroups(id); setGroups((current) => ({ ...current, [id]: items })); });
  }

  return <AppLayout pageName="WeChat connections"><div className="mx-auto max-w-5xl space-y-6">
    <header><Link href="/integrations" className="inline-flex items-center gap-1 text-sm text-[var(--muted-foreground)]"><ArrowLeft className="h-4 w-4" /> Integrations</Link><h1 className="mt-4 text-2xl font-bold">Personal WeChat connections</h1><p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--muted-foreground)]">Connect the pinned Windows WeChat runner once, then choose monitored groups from each payment automation. This unofficial bridge is version-sensitive.</p></header>
    {error && <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-900">{error}</div>}
    {notice && <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900">{notice}</div>}
    <form onSubmit={create} className="flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 sm:flex-row sm:items-end"><label className="flex-1 text-xs font-semibold">Connection name<input required value={name} onChange={(event) => setName(event.target.value)} className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-sm" /></label><button disabled={busy === 'create'} className="inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><Plus className="h-4 w-4" /> Add connection</button></form>
    <div className="space-y-4">{connections.map((connection) => <ConnectionCard key={connection.id} connection={connection} groups={groups[connection.id]} query={search[connection.id] || ''} busy={busy} setQuery={(value) => setSearch((current) => ({ ...current, [connection.id]: value }))} onRefresh={() => void act(connection.id, 'refresh', () => getWeChatConnection(connection.id))} onConnect={() => void act(connection.id, 'connect', () => connectWeChat(connection.id))} onDisconnect={() => void act(connection.id, 'disconnect', () => disconnectWeChat(connection.id))} onGroups={() => void loadGroups(connection.id)} onTest={(group) => void act(connection.id, 'test', async () => { await sendWeChatTestMessage(connection.id, group.id); setNotice(`Test message sent to ${group.name}.`); })} onDelete={() => void act(connection.id, 'delete', () => deleteWeChatConnection(connection.id))} />)}{!connections.length && <div className="rounded-xl border border-dashed border-[var(--border)] p-10 text-center text-sm text-[var(--muted-foreground)]">No WeChat connection configured.</div>}</div>
  </div></AppLayout>;
}

function ConnectionCard({ connection, groups, query, busy, setQuery, onRefresh, onConnect, onDisconnect, onGroups, onTest, onDelete }: { connection: WeChatConnection; groups?: WeChatGroup[]; query: string; busy: string | null; setQuery: (value: string) => void; onRefresh: () => void; onConnect: () => void; onDisconnect: () => void; onGroups: () => void; onTest: (group: WeChatGroup) => void; onDelete: () => void }) {
  const visible = useMemo(() => (groups || []).filter((group) => !query || `${group.name} ${group.id}`.toLowerCase().includes(query.toLowerCase())), [groups, query]);
  const connected = connection.status === 'connected';
  return <article className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><MessageCircle className="h-5 w-5 text-cyan-700" /><h2 className="font-semibold">{connection.name}</h2><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${connected ? 'bg-emerald-100 text-emerald-900' : 'bg-amber-100 text-amber-950'}`}>{connection.status}</span></div><p className="mt-1 text-xs text-[var(--muted-foreground)]">{connection.display_name || connection.account_id || `Connection #${connection.id}`} {connection.client_version ? `· client ${connection.client_version}` : ''}</p></div><div className="flex flex-wrap gap-2">{!connected ? <button onClick={onConnect} disabled={Boolean(busy)} className="rounded-lg bg-cyan-700 px-3 py-2 text-xs font-semibold text-white">Connect</button> : <button onClick={onDisconnect} disabled={Boolean(busy)} className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-semibold"><Unplug className="h-3.5 w-3.5" /> Disconnect</button>}<button onClick={onRefresh} disabled={Boolean(busy)} className="rounded-lg border border-[var(--border)] p-2"><RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} /></button><button onClick={onDelete} disabled={Boolean(busy)} className="rounded-lg border border-red-300 p-2 text-red-700"><Trash2 className="h-4 w-4" /></button></div></div>{connection.last_error && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-900">{connection.last_error}</p>}
    <div className="mt-4"><button onClick={onGroups} disabled={!connected || Boolean(busy)} className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-semibold disabled:opacity-50">{busy === `groups-${connection.id}` ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />} View groups</button>{groups && <><label className="relative mt-3 block"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search group name or ID" className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] py-2.5 pl-9 pr-3 text-sm" /></label><div className="mt-2 max-h-72 overflow-y-auto rounded-lg border border-[var(--border)]">{visible.map((group) => <div key={group.id} className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-3 py-2.5 last:border-0"><div><p className="text-sm font-medium">{group.name}</p><p className="text-xs text-[var(--muted-foreground)]">{group.member_count} members · {group.id}</p></div><button onClick={() => onTest(group)} className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] px-2.5 py-1.5 text-xs font-semibold"><Send className="h-3.5 w-3.5" /> Test</button></div>)}{!visible.length && <p className="p-5 text-center text-sm text-[var(--muted-foreground)]">No matching groups.</p>}</div></>}</div>
  </article>;
}
