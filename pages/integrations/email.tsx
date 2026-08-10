'use client';

import { AppLayout } from '@/components/layout';
import { useOrganization } from '@/lib/OrganizationContext';
import {
  createEmailConnection,
  deleteEmailConnection,
  listEmailConnections,
  syncEmailConnection,
  testEmailConnection,
  updateEmailConnection,
  type EmailConnection,
  type EmailConnectionInput,
} from '@/services/EmailConnectionService';
import { ArrowLeft, CheckCircle2, Inbox, LoaderCircle, Mail, Pencil, Plus, RefreshCw, Send, Server, Trash2, X } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

const yahooDefaults: EmailConnectionInput = {
  name: 'Outsourced fulfilment mailbox', provider: 'YAHOO', email_address: '', username: '', password: '',
  imap_host: 'imap.mail.yahoo.com', imap_port: 993, imap_security: 'SSL_TLS', imap_folder: 'INBOX',
  smtp_host: 'smtp.mail.yahoo.com', smtp_port: 465, smtp_security: 'SSL_TLS', poll_interval_minutes: 5,
};

export default function EmailConnectionsPage() {
  const { selectedOrganizationId } = useOrganization();
  const [items, setItems] = useState<EmailConnection[]>([]);
  const [form, setForm] = useState<EmailConnectionInput>(yahooDefaults);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<EmailConnection | null>(null);
  const [advanced, setAdvanced] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState<EmailConnection | null>(null);

  const load = useCallback(async () => {
    setBusy('load');
    try { setItems(await listEmailConnections()); setError(null); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not load email connections.'); }
    finally { setBusy(null); }
  }, []);

  useEffect(() => { void load(); }, [load, selectedOrganizationId]);

  const save = async () => {
    setBusy(editing ? `update-${editing.id}` : 'create'); setError(null); setNotice(null);
    try {
      const payload = { ...form, username: form.username || form.email_address };
      if (editing) {
        const { password, ...settings } = payload;
        const updated = await updateEmailConnection(editing.id, password ? payload : settings);
        setItems((current) => current.map((item) => item.id === updated.id ? updated : item));
      } else {
        const created = await createEmailConnection(payload);
        setItems((current) => [...current, created]);
      }
      setShowForm(false); setEditing(null); setForm(yahooDefaults);
      setNotice(`Mailbox ${editing ? 'updated' : 'saved'}. Test the connection before using it in an automation.`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not create connection.'); }
    finally { setBusy(null); }
  };

  const openCreate = () => { setEditing(null); setForm(yahooDefaults); setAdvanced(false); setShowForm(true); };
  const openEdit = (item: EmailConnection) => {
    setEditing(item);
    setForm({
      name: item.name,
      provider: item.provider === 'YAHOO' ? 'YAHOO' : 'CUSTOM',
      email_address: item.email_address,
      username: item.username,
      password: '',
      imap_host: item.imap_host,
      imap_port: item.imap_port,
      imap_security: item.imap_security,
      imap_folder: item.imap_folder,
      smtp_host: item.smtp_host,
      smtp_port: item.smtp_port,
      smtp_security: item.smtp_security,
      poll_interval_minutes: item.poll_interval_minutes,
    });
    setAdvanced(true);
    setShowForm(true);
  };

  const act = async (key: string, action: () => Promise<void>) => {
    setBusy(key); setError(null); setNotice(null);
    try { await action(); await load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Email connection action failed.'); }
    finally { setBusy(null); }
  };

  return <AppLayout pageName="Email integrations"><div className="space-y-6">
    <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div><Link href="/integrations" className="inline-flex items-center gap-1.5 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]"><ArrowLeft className="h-4 w-4" /> Integrations</Link><p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700 dark:text-cyan-300">Reusable connection</p><h1 className="mt-1 text-2xl font-bold">Email mailboxes</h1><p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--muted-foreground)]">Send external work requests and monitor replies in the same thread. Yahoo is a preset; any IMAP/SMTP mailbox can use the same framework.</p></div>
      <button type="button" onClick={openCreate} className="inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-cyan-800"><Plus className="h-4 w-4" /> Add mailbox</button>
    </header>

    {error && <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm font-medium text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100">{error}</div>}
    {notice && <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm font-medium text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100">{notice}</div>}

    <div className="grid gap-4 xl:grid-cols-2">
      {items.map((item) => <article key={item.id} className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-200"><Mail className="h-5 w-5" /></span><span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${item.last_test_status === 'success' ? 'border-emerald-300 bg-emerald-100 text-emerald-900' : 'border-amber-300 bg-amber-100 text-amber-950'}`}>{item.last_test_status === 'success' ? 'Connected' : 'Not tested'}</span></div>
        <h2 className="mt-4 font-semibold">{item.name}</h2><p className="mt-1 text-sm text-[var(--muted-foreground)]">{item.email_address} · {item.provider}</p>
        <div className="mt-4 grid gap-2 text-xs sm:grid-cols-2"><div className="rounded-lg bg-[var(--muted)] p-3"><span className="flex items-center gap-1.5 font-semibold"><Inbox className="h-3.5 w-3.5" /> Incoming</span><span className="mt-1 block text-[var(--muted-foreground)]">{item.imap_host}:{item.imap_port}/{item.imap_folder}</span></div><div className="rounded-lg bg-[var(--muted)] p-3"><span className="flex items-center gap-1.5 font-semibold"><Send className="h-3.5 w-3.5" /> Outgoing</span><span className="mt-1 block text-[var(--muted-foreground)]">{item.smtp_host}:{item.smtp_port}</span></div></div>
        {item.last_test_message && <p className={`mt-3 rounded-lg p-3 text-xs leading-5 ${item.last_test_status === 'success' ? 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100' : 'bg-amber-50 text-amber-950 dark:bg-amber-950 dark:text-amber-100'}`}>{item.last_test_message}</p>}
        {item.last_sync_error && <p className="mt-3 rounded-lg bg-red-50 p-3 text-xs text-red-900 dark:bg-red-950 dark:text-red-100">Last reply check: {item.last_sync_error}</p>}
        <div className="mt-4 flex flex-wrap gap-2"><button type="button" disabled={busy !== null} onClick={() => void act(`test-${item.id}`, async () => { const result = await testEmailConnection(item.id); setNotice(result.message); })} className="inline-flex items-center gap-2 rounded-lg bg-cyan-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy === `test-${item.id}` ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Test connection</button><button type="button" disabled={busy !== null} onClick={() => void act(`sync-${item.id}`, async () => { const result = await syncEmailConnection(item.id); setNotice(`Checked ${result.checked} messages; matched ${result.matched} replies and stored ${result.attachments} attachments.`); })} className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-semibold hover:bg-[var(--muted)] disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${busy === `sync-${item.id}` ? 'animate-spin' : ''}`} /> Check replies</button><button type="button" onClick={() => openEdit(item)} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-semibold hover:bg-[var(--muted)]"><Pencil className="h-4 w-4" /> Edit</button><button type="button" onClick={() => setConfirmingDelete(item)} className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950"><Trash2 className="h-4 w-4" /> Remove</button></div>
      </article>)}
    </div>
    {!items.length && busy !== 'load' && <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--card)] p-12 text-center"><Server className="mx-auto h-8 w-8 text-[var(--muted-foreground)]" /><h2 className="mt-3 font-semibold">No connected mailbox</h2><p className="mt-1 text-sm text-[var(--muted-foreground)]">Add the Yahoo mailbox used to communicate with external fulfilment teams.</p></div>}

    {showForm && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4" role="dialog" aria-modal="true"><div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-xl"><div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-semibold">{editing ? 'Edit email mailbox' : 'Connect an email mailbox'}</h2><p className="mt-1 text-sm text-[var(--muted-foreground)]">For Yahoo, use an app password instead of the normal account password. {editing ? 'Leave it blank to keep the existing app password.' : ''}</p></div><button type="button" onClick={() => { setShowForm(false); setEditing(null); }} className="rounded-lg p-2 hover:bg-[var(--muted)]"><X className="h-4 w-4" /></button></div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold">Connection name<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="mt-1 w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2.5 font-normal" /></label><label className="text-sm font-semibold">Provider<select value={form.provider} onChange={(event) => { const provider = event.target.value as 'YAHOO' | 'CUSTOM'; setForm(provider === 'YAHOO' ? { ...yahooDefaults, name: form.name, email_address: form.email_address, username: form.username, password: form.password } : { ...form, provider }); }} className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 font-normal"><option value="YAHOO">Yahoo Mail</option><option value="CUSTOM">Custom IMAP/SMTP</option></select></label><label className="text-sm font-semibold">Email address<input type="email" value={form.email_address} onChange={(event) => setForm({ ...form, email_address: event.target.value, username: form.username || event.target.value })} className="mt-1 w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2.5 font-normal" /></label><label className="text-sm font-semibold">App password<input type="password" autoComplete="new-password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} className="mt-1 w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2.5 font-normal" /></label></div>
      <button type="button" onClick={() => setAdvanced((value) => !value)} className="mt-4 text-sm font-semibold text-cyan-700 dark:text-cyan-300">{advanced ? 'Hide server settings' : 'Show server settings'}</button>
      {advanced && <div className="mt-3 grid gap-4 rounded-xl bg-[var(--muted)] p-4 sm:grid-cols-2"><Field label="IMAP host" value={form.imap_host} onChange={(value) => setForm({ ...form, imap_host: value })} /><NumberField label="IMAP port" value={form.imap_port} onChange={(value) => setForm({ ...form, imap_port: value })} /><Field label="IMAP folder" value={form.imap_folder} onChange={(value) => setForm({ ...form, imap_folder: value })} /><Field label="SMTP host" value={form.smtp_host} onChange={(value) => setForm({ ...form, smtp_host: value })} /><NumberField label="SMTP port" value={form.smtp_port} onChange={(value) => setForm({ ...form, smtp_port: value })} /><NumberField label="Check replies every (minutes)" value={form.poll_interval_minutes} onChange={(value) => setForm({ ...form, poll_interval_minutes: value })} /></div>}
      <div className="mt-6 flex justify-end gap-2"><button type="button" onClick={() => { setShowForm(false); setEditing(null); }} className="rounded-lg border border-[var(--border)] px-4 py-2.5 text-sm font-semibold">Cancel</button><button type="button" disabled={busy !== null || !form.name.trim() || !form.email_address.trim() || (!editing && !form.password)} onClick={() => void save()} className="inline-flex items-center gap-2 rounded-lg bg-cyan-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{(busy === 'create' || busy === `update-${editing?.id}`) && <LoaderCircle className="h-4 w-4 animate-spin" />} {editing ? 'Update mailbox' : 'Save mailbox'}</button></div>
    </div></div>}

    {confirmingDelete && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4" role="dialog" aria-modal="true"><div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-xl"><h2 className="text-lg font-semibold">Remove mailbox?</h2><p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">Automations using <strong>{confirmingDelete.name}</strong> will stop sending requests and checking replies until another mailbox is selected.</p><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setConfirmingDelete(null)} className="rounded-lg border border-[var(--border)] px-4 py-2.5 text-sm font-semibold">Cancel</button><button type="button" onClick={() => void act(`delete-${confirmingDelete.id}`, async () => { await deleteEmailConnection(confirmingDelete.id); setConfirmingDelete(null); setNotice('Mailbox removed.'); })} className="rounded-lg bg-red-700 px-4 py-2.5 text-sm font-semibold text-white">Remove</button></div></div></div>}
  </div></AppLayout>;
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="text-xs font-semibold">{label}<input value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 font-normal" /></label>; }
function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) { return <label className="text-xs font-semibold">{label}<input type="number" min="1" value={value} onChange={(event) => onChange(Number(event.target.value))} className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 font-normal" /></label>; }
