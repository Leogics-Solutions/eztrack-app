import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDownToLine, ArrowRight, CheckCircle2, ChevronLeft, ChevronRight, Circle, ClipboardList, FileCheck2, FilePlus2, FileText, Layers3, ListChecks, Loader2, Monitor, Plus, RefreshCw, Search, ShieldCheck, Trash2, TriangleAlert, X } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { useOrganization } from '@/lib/OrganizationContext';
import { MahaSSTService as api, SSTError, type AttachmentKind, type SSTAudit, type SSTCase, type SSTCaseInput, type SSTLine, type SSTWorkspace } from '@/services/MahaSSTService';
import styles from '@/styles/maha.module.css';

const blankCase = (): SSTCaseInput => ({ customer_name: '', po_reference: '', appointment_reference: '', schedule: 'C3', notes: '', lines: [] });
const blankLine = (): SSTLine => ({ description: '', quantity: '', uom: 'KG', unit_price: null, autocount_code: '', origin: 'unconfirmed', customs_code: '' });
const money = (value: number) => new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR' }).format(value);
const date = (value: string) => new Intl.DateTimeFormat('en-MY', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kuala_Lumpur' }).format(new Date(value.endsWith('Z') || /[+-]\d\d:\d\d$/.test(value) ? value : `${value}Z`));
const message = (error: unknown) => error instanceof Error ? error.message : 'Something went wrong. Please try again.';

function Workspace({ org }: { org: number }) {
  const router = useRouter();
  const tab = router.query.view === 'setup' ? 'setup' : router.query.view === 'activity' ? 'activity' : 'cases';
  const [workspace, setWorkspace] = useState<SSTWorkspace | null>(null);
  const [cases, setCases] = useState<SSTCase[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [audit, setAudit] = useState<SSTAudit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [editor, setEditor] = useState<SSTCase | 'new' | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    Promise.all([api.workspace(org, controller.signal), api.cases(org, offset, controller.signal), api.audit(org, controller.signal)])
      .then(([ws, result, events]) => { if (!controller.signal.aborted) { setWorkspace(ws); setCases(result.items); setTotal(result.total); setAudit(events.items); } })
      .catch((e) => { if (!controller.signal.aborted) { setWorkspace(null); setCases([]); setError(message(e)); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [org, offset, retry]);

  const reload = useCallback(() => setRetry((v) => v + 1), []);
  const filtered = cases.filter((c) => (filter === 'all' || c.schedule === filter) && `${c.customer_name} ${c.po_reference} ${c.appointment_reference}`.toLowerCase().includes(search.toLowerCase()));
  const caseCountLabel = offset === 0 && total <= 100 ? '' : 'on this page';

  return <div className={styles.workspace}>
    <div className={styles.eyebrow}><span className={styles.liveDot} /> MAHA CHEMICALS <span className={styles.divider}>/</span> SST WORKSPACE</div>
    <div className={styles.headingRow}>
      <div><h1>C3 / C4 declarations</h1><p className={styles.subtitle}>From customer purchase order to a reviewed MySST declaration.</p></div>
      <div className={styles.actions}><button className={styles.secondary} onClick={reload} disabled={loading} aria-label="Refresh workspace"><RefreshCw size={16} className={loading ? styles.spin : ''} /> Refresh</button><button className={styles.primary} disabled={!workspace?.can_edit || loading} onClick={() => setEditor('new')}><Plus size={17} /> New case</button></div>
    </div>
    {success && <div className={styles.success} role="status"><CheckCircle2 size={17} />{success}<button aria-label="Dismiss notification" onClick={() => setSuccess('')}><X size={16} /></button></div>}
    <div className={styles.summary}>
      {[{ label: 'Total cases', value: workspace ? total : '—', icon: Layers3, foot: 'In this company workspace' }, { label: 'Needs review', value: workspace ? cases.length : '—', icon: ListChecks, foot: caseCountLabel || 'Source and line checks' }, { label: 'C3 cases', value: workspace ? cases.filter((c) => c.schedule === 'C3').length : '—', icon: FileText, foot: caseCountLabel || 'Schedule C · Item 3' }, { label: 'Workstation', value: 'Pending', icon: Monitor, foot: 'AutoCount connection required' }].map(({ label, value, icon: Icon, foot }) => <div className={styles.stat} key={label}><div className={styles.statLabel}>{label}<Icon size={17} /></div><strong>{value}</strong><span>{foot}</span></div>)}
    </div>
    <div className={styles.tabs} role="navigation" aria-label="Maha workspace sections">{[['cases', 'Cases'], ['setup', 'Workspace setup'], ['activity', 'Activity']].map(([key, label]) => <Link href={key === 'cases' ? '/maha' : `/maha?view=${key}`} shallow className={tab === key ? styles.activeTab : ''} key={key}>{label}{key === 'cases' && workspace && <span>{total}</span>}</Link>)}<span className={styles.companyLabel}><ShieldCheck size={14} /> {workspace?.company_name || 'Company access required'}</span></div>
    {loading ? <div className={styles.empty} role="status"><Loader2 className={styles.spin} /><h2>Loading your workspace</h2><p>Checking company access and loading saved cases.</p></div>
      : error ? <div className={styles.empty} role="alert"><TriangleAlert size={32} /><h2>Workspace setup is pending</h2><p>{error}</p><p>Choose the Maha company in the company selector. If access is not enabled, your Smartdok administrator needs to finish enrollment.</p><button className={styles.secondary} onClick={reload}>Try again</button></div>
      : tab === 'setup' ? <Setup workspace={workspace!} />
      : tab === 'activity' ? <section className={styles.panel}><div className={styles.panelHeading}><h2>Workspace activity</h2><span>Latest 100 events · Malaysia time</span></div>{audit.length ? audit.map((event) => <div className={styles.auditRow} key={event.id}><span className={styles.auditIcon}><FileCheck2 size={16} /></span><div><strong>{event.action.replaceAll('_', ' ')}</strong><p>{event.detail}</p><span>Operator #{event.user_id} · {date(event.created_at)}</span></div></div>) : <div className={styles.empty}><ClipboardList size={32} /><h2>No activity yet</h2><p>Case creation, edits and document uploads will appear here.</p></div>}</section>
      : <section className={styles.panel}>
        <div className={styles.tableTools}><div><h2>Declaration cases</h2><p>Review source documents, product matches and quantities in one place.</p></div><div className={styles.filters}><div className={styles.search}><Search size={16} /><input aria-label="Search cases on this page" placeholder="Search this page…" value={search} onChange={(e) => setSearch(e.target.value)} /></div><select aria-label="Filter schedule" value={filter} onChange={(e) => setFilter(e.target.value)}><option value="all">All schedules</option><option>C3</option><option>C4</option></select></div></div>
        {filtered.length ? <div className={styles.tableScroll}><table className={styles.caseTable}><thead><tr><th>Customer / purchase order</th><th>Schedule</th><th>Appointment reference</th><th>Lines</th><th>Review status</th><th>Updated</th><th><span className={styles.srOnly}>Open case</span></th></tr></thead><tbody>{filtered.map((c) => <tr key={c.id}><td><button className={styles.caseLink} onClick={() => setEditor(c)}>{c.customer_name}</button><span className={styles.tableSub}>{c.po_reference}</span></td><td><span className={styles.schedule}>{c.schedule}</span></td><td className={styles.mono}>{c.appointment_reference || 'Awaiting confirmation'}</td><td>{c.lines.length}</td><td><span className={styles.reviewBadge}><Circle size={7} fill="currentColor" /> Needs review</span></td><td className={styles.date}>{date(c.updated_at)}</td><td><button className={styles.iconButton} aria-label={`Open ${c.po_reference}`} onClick={() => setEditor(c)}><ArrowRight size={17} /></button></td></tr>)}</tbody></table></div> : <div className={styles.empty}><span className={styles.emptyIcon}><FilePlus2 size={30} /></span><h2>{cases.length ? 'No matching cases' : 'Your next declaration starts here'}</h2><p>{cases.length ? 'Try another customer, PO reference or schedule.' : 'Create a case, attach the purchase order and appointment letter, then review each product line.'}</p>{!cases.length && workspace?.can_edit && <button className={styles.primary} onClick={() => setEditor('new')}><Plus size={16} /> Create first case</button>}</div>}
        <div className={styles.tableFooter}><span>{total ? `${offset + 1}–${Math.min(offset + 100, total)} of ${total} cases` : '0 cases'} · Saved to Smartdok</span><div><button disabled={offset === 0} onClick={() => setOffset((v) => Math.max(0, v - 100))} aria-label="Previous cases"><ChevronLeft size={16} /></button><button disabled={offset + 100 >= total} onClick={() => setOffset((v) => v + 100)} aria-label="Next cases"><ChevronRight size={16} /></button></div></div>
      </section>}
    <div className={styles.workflowStrip}><span className={styles.workflowIcon}><ShieldCheck size={20} /></span><div><strong>Maha stays in control of submission</strong><p>Review the prepared declaration before your authorised operator submits it in MySST.</p></div><Link href="/maha?view=setup" shallow>View setup <ArrowRight size={14} /></Link></div>
    {editor && <CaseEditor key={typeof editor === 'string' ? editor : editor.id} org={org} initial={editor === 'new' ? null : editor} canEdit={!!workspace?.can_edit} onClose={() => setEditor(null)} onSaved={(c) => { setEditor(c); setSuccess('Case saved to Smartdok.'); reload(); }} />}
  </div>;
}

function Setup({ workspace }: { workspace: SSTWorkspace }) {
  const steps = [
    { title: 'Company workspace', body: `${workspace.company_name} · Access follows your existing Smartdok company membership.`, complete: true, icon: ShieldCheck },
    { title: 'Case intake & source documents', body: 'Create cases, attach PDF purchase orders and appointment letters, and review the source line details.', complete: true, icon: FileText },
    { title: 'AutoCount workstation', body: 'Confirm the local AutoCount version, API / SDK module, company database and a dedicated Windows workstation. Connect with Maha’s IT or AutoCount partner.', complete: false, icon: Monitor },
    { title: 'Product matching & UOM rules', body: 'Validate customer product names against AutoCount items. Approve pack conversions and Local / Import classifications before using them for preparation.', complete: false, icon: Layers3 },
    { title: 'MySST preparation', body: 'Validate C3 fields and browser access on the workstation. Maha’s authorised operator performs the final submission.', complete: false, icon: FileCheck2 },
    { title: 'C4 validation & POC review', body: 'Walk through C4 and evaluate the agreed cases with Samantha before signing off the POC.', complete: false, icon: ListChecks },
  ];
  return <section className={styles.panel}><div className={styles.panelHeading}><div><h2>Workspace setup</h2><p>Complete these steps to prepare the first live declaration.</p></div><span>2 of 6 steps ready</span></div><div className={styles.setupGrid}>{steps.map(({ title, body, complete, icon: Icon }, i) => <div className={styles.setupCard} key={title}><span className={complete ? styles.completeIcon : styles.pendingIcon}><Icon size={22} /></span><div className={styles.setupTitle}><span>0{i + 1}</span>{complete ? <span className={styles.readyBadge}><CheckCircle2 size={12} /> Available</span> : <span className={styles.pendingBadge}>Pending</span>}</div><h3>{title}</h3><p>{body}</p></div>)}</div></section>;
}

function CaseEditor({ org, initial, canEdit, onClose, onSaved }: { org: number; initial: SSTCase | null; canEdit: boolean; onClose: () => void; onSaved: (c: SSTCase) => void }) {
  const editorRef = useRef<HTMLElement>(null);
  const [form, setForm] = useState<SSTCaseInput>(() => initial ? { customer_name: initial.customer_name, po_reference: initial.po_reference, appointment_reference: initial.appointment_reference, schedule: initial.schedule, notes: initial.notes, lines: initial.lines } : blankCase());
  const [saved, setSaved] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [closing, setClosing] = useState(false);
  const [kind, setKind] = useState<AttachmentKind>('purchase_order');
  const update = (changes: Partial<SSTCaseInput>) => { setForm((p) => ({ ...p, ...changes })); setDirty(true); };
  const line = (index: number, changes: Partial<SSTLine>) => update({ lines: form.lines.map((l, i) => i === index ? { ...l, ...changes } : l) });
  const close = () => dirty ? setClosing(true) : onClose();
  useEffect(() => { const listener = (e: BeforeUnloadEvent) => { if (dirty) e.preventDefault(); }; window.addEventListener('beforeunload', listener); return () => window.removeEventListener('beforeunload', listener); }, [dirty]);
  useEffect(() => { const previous = document.activeElement as HTMLElement | null; document.getElementById('sst-customer')?.focus(); return () => previous?.focus(); }, []);
  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setError('');
    try { const c = saved ? await api.save(org, saved.id, form, saved.revision) : await api.create(org, form); setSaved(c); setDirty(false); onSaved(c); }
    catch (e) { setError(message(e)); setConflict(e instanceof SSTError && e.status === 409); }
    finally { setBusy(false); }
  };
  const reload = async () => {
    if (!saved) return; setBusy(true);
    try { const c = await api.case(org, saved.id); setSaved(c); setForm({ customer_name: c.customer_name, po_reference: c.po_reference, appointment_reference: c.appointment_reference, schedule: c.schedule, notes: c.notes, lines: c.lines }); setDirty(false); setConflict(false); setError(''); }
    catch (e) { setError(message(e)); } finally { setBusy(false); }
  };
  const upload = async (file?: File) => {
    if (!file || !saved) return;
    if (file.size > 20 * 1024 * 1024 || !file.name.toLowerCase().endsWith('.pdf')) { setError('Choose a PDF no larger than 20 MB.'); return; }
    setBusy(true); setError('');
    try { await api.attach(org, saved.id, kind, file); const c = await api.case(org, saved.id); setSaved(c); onSaved(c); }
    catch (e) { setError(message(e)); } finally { setBusy(false); }
  };
  const download = async (id: string) => {
    if (!saved) return;
    try { const result = await api.download(org, saved.id, id); const url = new URL(result.url, window.location.origin); if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Invalid download address'); window.open(url.toString(), '_blank', 'noopener,noreferrer'); }
    catch (e) { setError(message(e)); }
  };
  const total = form.lines.reduce((sum, l) => sum + Number(l.quantity || 0) * Number(l.unit_price || 0), 0);
  return <div className={styles.overlay} onKeyDown={(e) => {
    if (e.key === 'Escape' && !busy) close();
    if (e.key === 'Tab') {
      const controls = Array.from(editorRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href]') || []).filter((el) => el.offsetParent !== null);
      const first = controls[0], last = controls[controls.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
    }
  }}><section ref={editorRef} role="dialog" aria-modal="true" aria-labelledby="sst-editor-title" className={styles.editor}>
    <div className={styles.editorHeader}><div><span className={styles.eyebrow}>{saved ? `CASE · REVISION ${saved.revision}` : 'NEW DECLARATION CASE'}</span><h2 id="sst-editor-title">{saved ? saved.po_reference : 'Create a new case'}</h2></div><button disabled={busy} className={styles.iconButton} aria-label="Close case" onClick={close}><X size={20} /></button></div>
    {closing && <div className={styles.warning} role="alert"><span>You have unsaved changes.</span><button className={styles.secondary} onClick={() => setClosing(false)}>Keep editing</button><button className={styles.secondary} onClick={onClose}>Discard changes</button></div>}
    <form onSubmit={save} className={styles.editorForm}>
      <div className={styles.editorBody}>
        {error && <div className={styles.error} role="alert">{error}{conflict && <button type="button" className={styles.secondary} onClick={reload}>Reload saved version</button>}</div>}
        <fieldset disabled={!canEdit || busy || conflict} className={styles.fieldset}><div className={styles.formGrid}>
          <label className={styles.wide}>Customer name<input id="sst-customer" required maxLength={240} value={form.customer_name} onChange={(e) => update({ customer_name: e.target.value })} placeholder="Customer as shown on the purchase order" /></label>
          <label>Purchase order reference<input required maxLength={120} value={form.po_reference} onChange={(e) => update({ po_reference: e.target.value })} placeholder="e.g. PO-16389" /></label>
          <label>Schedule<select value={form.schedule} onChange={(e) => update({ schedule: e.target.value as 'C3' | 'C4' })}><option value="C3">Schedule C · Item 3 (C3)</option><option value="C4">Schedule C · Item 4 (C4) — validation pending</option></select></label>
          <label className={styles.wide}>Appointment reference<input maxLength={120} value={form.appointment_reference} onChange={(e) => update({ appointment_reference: e.target.value })} placeholder="Use the appointment reference inside the letter" /><small>Confirm the appointment number, rather than the letter’s correspondence reference.</small></label>
        </div></fieldset>
        <div className={styles.sectionTitle}><div><h3>Source documents</h3><p>Keep the original PO and appointment letter with this case.</p></div></div>
        {saved ? <><div className={styles.documentList}>{saved.attachments.map((a) => <div className={styles.document} key={a.id}><FileText size={18} /><div><strong>{a.filename}</strong><span>{a.kind.replaceAll('_', ' ')} · {(a.size / 1024).toFixed(0)} KB</span></div><button type="button" aria-label={`Download ${a.filename}`} className={styles.iconButton} onClick={() => download(a.id)}><ArrowDownToLine size={16} /></button></div>)}</div>{canEdit && <div className={styles.upload}><select aria-label="Document type" value={kind} disabled={busy} onChange={(e) => setKind(e.target.value as AttachmentKind)}><option value="purchase_order">Purchase order</option><option value="appointment_letter">Appointment letter</option><option value="certificate">Resulting certificate</option></select><label className={styles.secondary}>Attach PDF<input aria-label="Attach PDF" type="file" accept="application/pdf,.pdf" disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; void upload(f); }} /></label><span>PDF · Up to 20 MB · Stored in Smartdok</span></div>}</> : <div className={styles.documentHint}><FileText size={18} /> Save the case first to attach its source documents.</div>}
        <div className={styles.sectionTitle}><div><h3>Purchase order lines</h3><p>Enter original quantities and UOM exactly. Keep pack size separate from quantity.</p></div><button type="button" className={styles.secondary} disabled={!canEdit || busy || conflict || form.lines.length >= 250} onClick={() => update({ lines: [...form.lines, blankLine()] })}><Plus size={15} /> Add line</button></div>
        <fieldset disabled={!canEdit || busy || conflict} className={styles.fieldset}>{form.lines.length ? form.lines.map((l, i) => <div className={styles.lineCard} key={i}><div className={styles.lineHeading}><span>LINE {String(i + 1).padStart(2, '0')}</span><button type="button" className={styles.iconButton} aria-label={`Remove line ${i + 1}`} onClick={() => update({ lines: form.lines.filter((_, n) => n !== i) })}><Trash2 size={15} /></button></div><div className={styles.lineGrid}>
          <label className={styles.description}>Product description<input aria-label={`Line ${i + 1} description`} maxLength={1000} required value={l.description} onChange={(e) => line(i, { description: e.target.value })} /></label>
          <label>Quantity<input aria-label={`Line ${i + 1} quantity`} type="number" min="0.000001" max="9999999999" step="0.000001" required value={l.quantity} onChange={(e) => line(i, { quantity: e.target.value })} /></label>
          <label>Source UOM<input aria-label={`Line ${i + 1} UOM`} required maxLength={40} value={l.uom} onChange={(e) => line(i, { uom: e.target.value })} /></label>
          <label>Unit price (RM)<input aria-label={`Line ${i + 1} unit price`} type="number" min="0" max="9999999999" step="0.000001" value={l.unit_price ?? ''} onChange={(e) => line(i, { unit_price: e.target.value || null })} /></label>
          <label>AutoCount item code<input maxLength={240} value={l.autocount_code} onChange={(e) => line(i, { autocount_code: e.target.value })} placeholder="Unmatched" /></label>
          <label>Origin<select value={l.origin} onChange={(e) => line(i, { origin: e.target.value as SSTLine['origin'] })}><option value="unconfirmed">Unconfirmed</option><option value="local">Local</option><option value="import">Import</option></select></label>
          <label>Customs code<input maxLength={40} value={l.customs_code} onChange={(e) => line(i, { customs_code: e.target.value })} placeholder="To confirm" /></label>
        </div></div>) : <div className={styles.documentHint}><Layers3 size={18} /> Add product lines from the source PO.</div>}</fieldset>
        {form.lines.length > 0 && <div className={styles.total}><span>Calculated line total <small>{form.lines.some((l) => l.unit_price === null) ? '· Some unit prices are missing' : '· Compare with the original PO'}</small></span><strong>{money(total)}</strong></div>}
        <fieldset disabled={!canEdit || busy || conflict} className={styles.fieldset}><label className={styles.noteLabel}>Decision notes<textarea rows={3} maxLength={10000} value={form.notes} onChange={(e) => update({ notes: e.target.value })} placeholder="Explain any product mismatch, pack conversion or exception for the reviewer." /></label></fieldset>
        {saved && <div className={styles.reviewChecks}><h3><ListChecks size={17} /> Review checklist {dirty && <small>· based on last saved version</small>}</h3>{saved.checks.map((c) => <p key={c.code}><Circle size={9} />{c.message}</p>)}</div>}
      </div>
      <div className={styles.editorFooter}><span>{saved ? 'Saved in Smartdok · Company access protected' : 'New case · No MySST submission'}</span><div><button type="button" className={styles.secondary} disabled={busy} onClick={close}>Close</button>{canEdit && <button type="submit" className={styles.primary} disabled={busy || conflict}>{busy && <Loader2 size={15} className={styles.spin} />}{saved ? 'Save changes' : 'Create case'}</button>}</div></div>
    </form>
  </section></div>;
}

export default function MahaPage() {
  const { selectedOrganizationId, isLoading } = useOrganization();
  return <ProtectedRoute><Head><title>Maha C3/C4 Workspace | Smartdok.ai</title><meta name="robots" content="noindex,nofollow" /></Head><AppLayout pageName="Maha C3/C4">{isLoading ? <p>Loading company access…</p> : selectedOrganizationId ? <Workspace key={selectedOrganizationId} org={selectedOrganizationId} /> : <div className={styles.workspace}><div className={styles.empty}><ShieldCheck size={32} /><h1>Select the Maha company</h1><p>Use the company selector to open the C3/C4 workspace with your existing Smartdok account.</p></div></div>}</AppLayout></ProtectedRoute>;
}
