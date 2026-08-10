'use client';

import { AppLayout } from '@/components/layout';
import { downloadKnowledgeSource, getKnowledgeSource, type KnowledgeSource } from '@/services/KnowledgeBaseService';
import { ArrowLeft, Building2, Database, Download, FileText, LoaderCircle, Search } from 'lucide-react';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';

type EntityProfile = {
  key?: string;
  legal_name?: string;
  aliases?: string[];
  role?: string;
  fulfilment_mode?: string;
  outsource_provider?: string;
  outbound_channel?: string;
  email_to?: string[];
  email_cc?: string[];
};

const human = (value?: string | null) => value ? value.replaceAll('_', ' ').toLowerCase() : '—';
const size = (bytes: number) => bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

export default function KnowledgeSourceDetailPage() {
  const router = useRouter();
  const id = Number(router.query.id);
  const [source, setSource] = useState<KnowledgeSource | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [route, setRoute] = useState('ALL');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!Number.isInteger(id) || id <= 0) return;
    let active = true;
    setLoading(true);
    getKnowledgeSource(id)
      .then((result) => {
        if (!active) return;
        setSource(result);
        setError(null);
        if (result.reference_type === 'DOCUMENT_TEMPLATE' && result.status === 'STORED') {
          downloadKnowledgeSource(id).then((url) => active && setPreviewUrl(url)).catch(() => undefined);
        }
      })
      .catch((reason) => active && setError(reason instanceof Error ? reason.message : 'Could not load this knowledge source.'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [id]);

  const entities = useMemo(() => (source?.metadata_json?.entities || []) as EntityProfile[], [source]);
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return entities.filter((entity) => {
      if (route !== 'ALL' && entity.fulfilment_mode !== route) return false;
      return !query || [entity.legal_name, ...(entity.aliases || []), entity.outsource_provider]
        .some((value) => String(value || '').toLowerCase().includes(query));
    });
  }, [entities, route, search]);

  const download = async () => {
    if (!source) return;
    try {
      window.open(await downloadKnowledgeSource(source.id), '_blank', 'noopener,noreferrer');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not download this source.');
    }
  };

  return <AppLayout pageName="Knowledge detail">
    <button type="button" onClick={() => router.push('/knowledge-base')} className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-slate-700 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white"><ArrowLeft className="h-4 w-4" /> Back to Knowledge Base</button>
    {loading && <div className="p-12 text-center text-sm text-[var(--muted-foreground)]"><LoaderCircle className="mx-auto mb-2 h-5 w-5 animate-spin" />Loading company knowledge…</div>}
    {error && <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm font-medium text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-200">{error}</div>}
    {source && <div className="space-y-5">
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-200">{source.reference_type === 'BUSINESS_ENTITY_REGISTRY' ? <Building2 className="h-5 w-5" /> : <FileText className="h-5 w-5" />}</div><div><p className="text-xs font-bold uppercase tracking-[0.15em] text-cyan-800 dark:text-cyan-300">{human(source.reference_type)}</p><h1 className="mt-1 text-2xl font-bold text-[var(--foreground)]">{source.title}</h1><p className="mt-2 max-w-3xl text-sm text-[var(--muted-foreground)]">{source.description || 'No usage instructions provided.'}</p></div></div>
          <button type="button" onClick={() => void download()} disabled={source.status !== 'STORED'} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-400 px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-100 disabled:opacity-40 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800"><Download className="h-4 w-4" /> Download original</button>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Fact label="Status" value={human(source.status)} /><Fact label="Original file" value={source.original_filename} /><Fact label="File size" value={size(source.size_bytes)} /><Fact label="Storage" value="Organization-isolated company knowledge" /></div>
      </section>

      {source.reference_type === 'BUSINESS_ENTITY_REGISTRY' && <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)]">
        <div className="border-b border-[var(--border)] p-4 sm:p-5"><div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between"><div><h2 className="font-semibold text-[var(--foreground)]">Business entities</h2><p className="mt-1 text-sm text-[var(--muted-foreground)]">{entities.length} aliases and routing profiles extracted from the workbook. These records are used by automations; they are not hard-coded.</p></div><div className="flex flex-col gap-2 sm:flex-row"><label className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search company or alias" className="w-full rounded-lg border border-[var(--border)] bg-transparent py-2 pl-9 pr-3 text-sm sm:w-64" /></label><select value={route} onChange={(event) => setRoute(event.target.value)} className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--foreground)]"><option value="ALL">All routes</option><option value="INTERNAL">Internal</option><option value="OUTSOURCED">Outsourced</option></select></div></div></div>
        <div className="max-h-[620px] overflow-auto"><table className="w-full min-w-[880px] text-sm"><thead className="sticky top-0 z-10 bg-slate-100 text-left text-slate-700 dark:bg-slate-900 dark:text-slate-200"><tr><th className="px-4 py-3">Company</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Route</th><th className="px-4 py-3">Provider / channel</th><th className="px-4 py-3">Aliases</th></tr></thead><tbody>{filtered.map((entity, index) => <tr key={`${entity.key || entity.legal_name}-${index}`} className="border-t border-[var(--border)] align-top"><td className="px-4 py-3 font-semibold text-[var(--foreground)]">{entity.legal_name || 'Unnamed entity'}</td><td className="px-4 py-3">{human(entity.role)}</td><td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${entity.fulfilment_mode === 'OUTSOURCED' ? 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100' : 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100'}`}>{human(entity.fulfilment_mode)}</span></td><td className="px-4 py-3"><span className="block">{entity.outsource_provider || 'Default accounting connection'}</span>{entity.outbound_channel && <span className="mt-1 block text-xs text-[var(--muted-foreground)]">{human(entity.outbound_channel)} {[...(entity.email_to || []), ...(entity.email_cc || [])].join(', ')}</span>}</td><td className="max-w-sm px-4 py-3 text-xs text-[var(--muted-foreground)]">{(entity.aliases || []).join(' · ') || '—'}</td></tr>)}</tbody></table>{filtered.length === 0 && <p className="p-10 text-center text-sm text-[var(--muted-foreground)]">No matching company profiles.</p>}</div>
      </section>}

      {source.reference_type === 'DOCUMENT_TEMPLATE' && <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5"><div className="flex items-start gap-3"><Database className="mt-0.5 h-5 w-5 text-cyan-700" /><div><h2 className="font-semibold">Template binding</h2><p className="mt-1 text-sm text-[var(--muted-foreground)]">This is company knowledge. The file is selected only after the automation resolves the matching issuing company.</p></div></div><div className="mt-4 grid gap-3 sm:grid-cols-4"><Fact label="Issuing company" value={source.metadata_json?.entity_name || 'Not configured'} /><Fact label="Document type" value={human(source.metadata_json?.document_type)} /><Fact label="Variant" value={source.metadata_json?.variant || 'Default'} /><Fact label="Usage" value={human(source.metadata_json?.render_mode)} /></div>{previewUrl && source.content_type?.startsWith('image/') && <img src={previewUrl} alt={`Preview of ${source.title}`} className="mt-5 max-h-[720px] w-full rounded-xl border border-[var(--border)] bg-white object-contain" />}{previewUrl && source.content_type === 'application/pdf' && <iframe src={previewUrl} title={`Preview of ${source.title}`} className="mt-5 h-[720px] w-full rounded-xl border border-[var(--border)] bg-white" />}</section>}
    </div>}
  </AppLayout>;
}

function Fact({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-slate-100 p-3 dark:bg-slate-900"><p className="text-xs font-semibold text-slate-600 dark:text-slate-300">{label}</p><p className="mt-1 break-words text-sm font-medium text-slate-950 dark:text-white">{value}</p></div>;
}
