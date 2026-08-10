'use client';

import { AppLayout } from '@/components/layout';
import { useOrganization } from '@/lib/OrganizationContext';
import {
  deleteKnowledgeSource,
  downloadKnowledgeSource,
  listKnowledgeSources,
  uploadKnowledgeSource,
  type KnowledgeListResponse,
  type KnowledgeReferenceType,
  type KnowledgeSource,
} from '@/services/KnowledgeBaseService';
import {
  BookOpen,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
  LoaderCircle,
  Plus,
  Search,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react';
import { DragEvent, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';

const EMPTY: KnowledgeListResponse = { items: [], total: 0, stored: 0, pending: 0, failed: 0 };
const MAX_SIZE = 10 * 1024 * 1024;
const ALLOWED = ['pdf', 'xlsx', 'xls', 'xlsm', 'csv', 'docx', 'txt', 'html', 'png', 'jpg', 'jpeg'];

const REFERENCE_TYPES: Array<{ value: KnowledgeReferenceType; label: string; help: string }> = [
  { value: 'CUSTOMER_MASTER', label: 'Customer master', help: 'Customer codes, names, terms and identifiers' },
  { value: 'PRODUCT_CATALOGUE', label: 'Product / SKU catalogue', help: 'Internal items, descriptions and units' },
  { value: 'ITEM_ALIASES', label: 'Customer item aliases', help: 'Customer descriptions mapped to internal SKUs' },
  { value: 'PRICE_LIST', label: 'Price list', help: 'Standard or customer-specific selling prices' },
  { value: 'TAX_CODES', label: 'Tax codes', help: 'Tax rules and accounting tax codes' },
  { value: 'POLICY', label: 'Policy or instructions', help: 'Company policies, SOPs and approval guidance' },
  { value: 'BUSINESS_ENTITY_REGISTRY', label: 'Business entity registry', help: 'Issuing companies, aliases, internal/outsource routing and provider instructions' },
  { value: 'DOCUMENT_TEMPLATE', label: 'DO / invoice template', help: 'A company-specific customer document template used after accounting posting' },
  { value: 'OTHER', label: 'Other reference', help: 'Another source that helps Smartdok understand work' },
];

const STATUS_STYLE: Record<string, string> = {
  STORED: 'border-emerald-300 bg-emerald-100 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
  PENDING_UPLOAD: 'border-blue-300 bg-blue-100 text-blue-900 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200',
  FAILED: 'border-red-300 bg-red-100 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-200',
};

function typeLabel(value: string) {
  return REFERENCE_TYPES.find((type) => type.value === value)?.label || value.replaceAll('_', ' ').toLowerCase();
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function validateFile(file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  if (!ALLOWED.includes(extension)) return `Unsupported file type. Use ${ALLOWED.join(', ')}.`;
  if (file.size > MAX_SIZE) return 'File is larger than 10 MB.';
  if (file.size === 0) return 'The selected file is empty.';
  return null;
}

export default function KnowledgeBasePage() {
  const { selectedOrganizationId } = useOrganization();
  const inputRef = useRef<HTMLInputElement>(null);
  const [data, setData] = useState<KnowledgeListResponse>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [referenceType, setReferenceType] = useState<KnowledgeReferenceType>('PRODUCT_CATALOGUE');
  const [entityName, setEntityName] = useState('');
  const [documentType, setDocumentType] = useState<'DELIVERY_ORDER' | 'SALES_INVOICE' | 'QUOTATION'>('SALES_INVOICE');
  const [templateVariant, setTemplateVariant] = useState('Default');
  const [templateRenderMode, setTemplateRenderMode] = useState<'REFERENCE_EXAMPLE' | 'BACKGROUND'>('REFERENCE_EXAMPLE');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = async () => {
    const result = await listKnowledgeSources();
    setData(result);
    setLoading(false);
  };

  useEffect(() => {
    let current = true;
    listKnowledgeSources()
      .then((result) => {
        if (!current) return;
        setData(result);
        setError(null);
      })
      .catch((reason) => {
        if (current) setError(reason instanceof Error ? reason.message : 'Could not load the Knowledge Base.');
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => { current = false; };
  }, [selectedOrganizationId]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return data.items.filter((item) => {
      if (typeFilter !== 'ALL' && item.reference_type !== typeFilter) return false;
      if (!query) return true;
      return [item.title, item.description || '', item.original_filename, typeLabel(item.reference_type)]
        .some((value) => value.toLowerCase().includes(query));
    });
  }, [data.items, search, typeFilter]);
  const entityOptions = useMemo(() => Array.from(new Set(
    data.items
      .filter((source) => source.status === 'STORED' && source.reference_type === 'BUSINESS_ENTITY_REGISTRY')
      .flatMap((source) => source.metadata_json?.entities || [])
      .filter((entity) => entity.role === 'ISSUER' && typeof entity.legal_name === 'string')
      .map((entity) => String(entity.legal_name)),
  )).sort(), [data.items]);

  const selectFile = (nextFile: File) => {
    const problem = validateFile(nextFile);
    if (problem) {
      setError(problem);
      return;
    }
    setFile(nextFile);
    if (!title.trim()) setTitle(nextFile.name.replace(/\.[^.]+$/, ''));
    setError(null);
  };

  const drop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    const nextFile = event.dataTransfer.files[0];
    if (nextFile) selectFile(nextFile);
  };

  const upload = async () => {
    if (!file) {
      setError('Choose a reference file first.');
      return;
    }
    if (referenceType === 'DOCUMENT_TEMPLATE' && !entityName.trim()) {
      setError('Enter the legal company that uses this template.');
      return;
    }
    setUploading(true);
    setError(null);
    setNotice(null);
    try {
      await uploadKnowledgeSource({ file, title, description, referenceType, entityName, documentType, templateVariant, templateRenderMode });
      await refresh();
      setFile(null);
      setTitle('');
      setDescription('');
      setEntityName('');
      setShowUpload(false);
      setNotice('Knowledge source uploaded and stored for this company.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not upload this source.');
    } finally {
      setUploading(false);
    }
  };

  const remove = async (source: KnowledgeSource) => {
    if (!window.confirm(`Delete "${source.title}" from this company's Knowledge Base?`)) return;
    setDeletingId(source.id);
    setError(null);
    try {
      await deleteKnowledgeSource(source.id);
      await refresh();
      setNotice('Knowledge source deleted.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not delete this source.');
    } finally {
      setDeletingId(null);
    }
  };

  const download = async (source: KnowledgeSource) => {
    try {
      const url = await downloadKnowledgeSource(source.id);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not download this source.');
    }
  };

  return (
    <AppLayout pageName="Knowledge Base">
      <div className="space-y-6">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-1 text-xs font-bold uppercase tracking-[0.18em] text-cyan-800 dark:text-cyan-300">Company reference data</p>
            <h1 className="text-2xl font-bold text-[var(--foreground)]">Knowledge Base</h1>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--muted-foreground)]">Upload reference data, business-entity routing and company document templates used by your automations.</p>
          </div>
          <button type="button" onClick={() => setShowUpload((value) => !value)} className="inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-cyan-800">
            {showUpload ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />} {showUpload ? 'Close upload' : 'Add knowledge'}
          </button>
        </header>

        {error && <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm font-medium text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-200">{error}</div>}
        {notice && <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm font-medium text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">{notice}</div>}

        {showUpload && (
          <section className="rounded-2xl border border-cyan-300 bg-cyan-50/70 p-5 dark:border-cyan-800 dark:bg-cyan-950/30 sm:p-6">
            <div className="mb-5"><h2 className="text-lg font-semibold text-slate-950 dark:text-white">Add a reference source</h2><p className="mt-1 text-sm text-slate-700 dark:text-slate-300">Tell Smartdok what the file represents. Entity registries are processed into routing records; templates remain linked to their issuing company.</p></div>
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]">
              <div onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={drop} onClick={() => inputRef.current?.click()} className={`flex min-h-52 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition ${dragging ? 'border-cyan-700 bg-cyan-100 dark:bg-cyan-900' : 'border-slate-400 bg-white hover:border-cyan-600 dark:border-slate-600 dark:bg-slate-950'}`}>
                <input ref={inputRef} type="file" accept=".pdf,.xlsx,.xls,.xlsm,.csv,.docx,.txt,.html,.htm,.png,.jpg,.jpeg,.webp" className="hidden" onChange={(event) => { const nextFile = event.target.files?.[0]; if (nextFile) selectFile(nextFile); }} />
                {file ? <><FileSpreadsheet className="h-10 w-10 text-cyan-700 dark:text-cyan-300" /><p className="mt-3 font-semibold text-slate-950 dark:text-white">{file.name}</p><p className="mt-1 text-sm text-slate-700 dark:text-slate-300">{formatSize(file.size)} · Click to replace</p></> : <><UploadCloud className="h-10 w-10 text-cyan-700 dark:text-cyan-300" /><p className="mt-3 font-semibold text-slate-950 dark:text-white">Drop a reference file here</p><p className="mt-1 text-sm text-slate-700 dark:text-slate-300">or click to choose a file</p></>}
              </div>
              <div className="space-y-4">
                <label className="block text-sm font-semibold text-slate-950 dark:text-white">What does this file contain?<select value={referenceType} onChange={(event) => setReferenceType(event.target.value as KnowledgeReferenceType)} className="mt-2 w-full rounded-lg border border-slate-400 bg-white px-3 py-2.5 text-sm text-slate-950 outline-none focus:border-cyan-700 dark:border-slate-600 dark:bg-slate-950 dark:text-white">{REFERENCE_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select><span className="mt-1.5 block text-xs font-normal text-slate-700 dark:text-slate-300">{REFERENCE_TYPES.find((type) => type.value === referenceType)?.help}</span></label>
                {referenceType === 'DOCUMENT_TEMPLATE' && <div className="grid gap-3 rounded-xl border border-cyan-300 bg-white p-4 dark:border-cyan-800 dark:bg-slate-950"><p className="text-xs leading-5 text-slate-700 dark:text-slate-300">Completed examples teach Smartdok the company&apos;s expected format. Only files explicitly marked as blank backgrounds are drawn behind generated data.</p><label className="block text-sm font-semibold text-slate-950 dark:text-white">Issuing company<select value={entityName} onChange={(event) => setEntityName(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-400 bg-white px-3 py-2.5 text-sm text-slate-950 dark:border-slate-600 dark:bg-slate-950 dark:text-white"><option value="">Select from Business Entity Registry</option>{entityOptions.map((name) => <option key={name} value={name}>{name}</option>)}</select>{entityOptions.length === 0 && <span className="mt-1 block text-xs font-normal text-amber-800 dark:text-amber-200">Upload a Business Entity Registry first.</span>}</label><label className="block text-sm font-semibold text-slate-950 dark:text-white">Document type<select value={documentType} onChange={(event) => setDocumentType(event.target.value as 'DELIVERY_ORDER' | 'SALES_INVOICE' | 'QUOTATION')} className="mt-2 w-full rounded-lg border border-slate-400 bg-white px-3 py-2.5 text-sm text-slate-950 dark:border-slate-600 dark:bg-slate-950 dark:text-white"><option value="DELIVERY_ORDER">Delivery Order</option><option value="SALES_INVOICE">Sales Invoice</option><option value="QUOTATION">Quotation</option></select></label><label className="block text-sm font-semibold text-slate-950 dark:text-white">Template usage<select value={templateRenderMode} onChange={(event) => setTemplateRenderMode(event.target.value as 'REFERENCE_EXAMPLE' | 'BACKGROUND')} className="mt-2 w-full rounded-lg border border-slate-400 bg-white px-3 py-2.5 text-sm text-slate-950 dark:border-slate-600 dark:bg-slate-950 dark:text-white"><option value="REFERENCE_EXAMPLE">Completed reference example</option><option value="BACKGROUND">Blank printable background</option></select></label><label className="block text-sm font-semibold text-slate-950 dark:text-white">Variant<input value={templateVariant} onChange={(event) => setTemplateVariant(event.target.value)} placeholder="Default" className="mt-2 w-full rounded-lg border border-slate-400 bg-white px-3 py-2.5 text-sm text-slate-950 dark:border-slate-600 dark:bg-slate-950 dark:text-white" /></label></div>}
                <label className="block text-sm font-semibold text-slate-950 dark:text-white">Source name<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Example: 2026 customer selling price" className="mt-2 w-full rounded-lg border border-slate-400 bg-white px-3 py-2.5 text-sm text-slate-950 outline-none placeholder:text-slate-500 focus:border-cyan-700 dark:border-slate-600 dark:bg-slate-950 dark:text-white dark:placeholder:text-slate-400" /></label>
                <label className="block text-sm font-semibold text-slate-950 dark:text-white">How should it be used?<textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} placeholder="Example: Use for ABC customer orders from August 2026 onward." className="mt-2 w-full rounded-lg border border-slate-400 bg-white p-3 text-sm text-slate-950 outline-none placeholder:text-slate-500 focus:border-cyan-700 dark:border-slate-600 dark:bg-slate-950 dark:text-white dark:placeholder:text-slate-400" /></label>
                <button type="button" onClick={() => void upload()} disabled={!file || uploading} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-cyan-800 disabled:cursor-not-allowed disabled:bg-slate-400 disabled:text-white">
                  {uploading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />} {uploading ? 'Uploading…' : 'Upload source'}
                </button>
              </div>
            </div>
          </section>
        )}

        <div className="grid gap-3 sm:grid-cols-3">
          <Metric label="All sources" value={data.total} icon={BookOpen} />
          <Metric label="Stored" value={data.stored} icon={CheckCircle2} tone="emerald" />
          <Metric label="Needs attention" value={data.pending + data.failed} icon={UploadCloud} tone="blue" />
        </div>

        <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)]">
          <div className="flex flex-col gap-3 border-b border-[var(--border)] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div><h2 className="font-semibold text-[var(--foreground)]">Company knowledge</h2><p className="mt-1 text-xs text-[var(--muted-foreground)]">Separate from transactional Documents and scoped to the selected company.</p></div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <label className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600 dark:text-slate-300" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search sources" className="w-full rounded-lg border border-[var(--border)] bg-transparent py-2 pl-9 pr-3 text-sm outline-none focus:border-cyan-700 sm:w-56" /></label>
              <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-cyan-700"><option value="ALL">All reference types</option>{REFERENCE_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select>
            </div>
          </div>

          {loading ? <div className="p-12 text-center text-sm text-[var(--muted-foreground)]"><LoaderCircle className="mx-auto mb-2 h-5 w-5 animate-spin" />Loading knowledge…</div> : filtered.length === 0 ? <div className="p-12 text-center"><BookOpen className="mx-auto h-9 w-9 text-slate-500" /><h3 className="mt-3 font-semibold text-[var(--foreground)]">{data.total === 0 ? 'No company knowledge yet' : 'No matching sources'}</h3><p className="mt-1 text-sm text-[var(--muted-foreground)]">{data.total === 0 ? 'Add a catalogue, price list, customer master or policy to begin.' : 'Try another search or reference type.'}</p></div> : <div className="divide-y divide-[var(--border)]">{filtered.map((source) => <SourceRow key={source.id} source={source} deleting={deletingId === source.id} onDelete={() => void remove(source)} onDownload={() => void download(source)} />)}</div>}
        </section>

        <div className="rounded-xl border border-blue-300 bg-blue-50 p-4 text-sm leading-6 text-blue-950 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-100"><span className="font-semibold">How automations use this:</span> business-entity workbooks are converted into deterministic company aliases and internal/outsource routing. Templates are linked to a specific issuing company and document type. Other reference files remain available to the workflow as labeled company knowledge.</div>
      </div>
    </AppLayout>
  );
}

function Metric({ label, value, icon: Icon, tone = 'cyan' }: { label: string; value: number; icon: typeof BookOpen; tone?: 'cyan' | 'emerald' | 'blue' }) {
  const color = tone === 'emerald' ? 'text-emerald-700 dark:text-emerald-300' : tone === 'blue' ? 'text-blue-700 dark:text-blue-300' : 'text-cyan-700 dark:text-cyan-300';
  return <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4"><div className="flex items-center justify-between"><p className="text-sm font-medium text-[var(--muted-foreground)]">{label}</p><Icon className={`h-5 w-5 ${color}`} /></div><p className="mt-2 text-2xl font-bold text-[var(--foreground)]">{value}</p></div>;
}

function SourceRow({ source, deleting, onDelete, onDownload }: { source: KnowledgeSource; deleting: boolean; onDelete: () => void; onDownload: () => void }) {
  const isSpreadsheet = /\.(xlsx|xls|csv)$/i.test(source.original_filename);
  const Icon = isSpreadsheet ? FileSpreadsheet : FileText;
  const entityCount = Number(source.metadata_json?.summary?.entity_count || source.metadata_json?.entities?.length || 0);
  const binding = source.reference_type === 'DOCUMENT_TEMPLATE' ? [source.metadata_json?.entity_name, source.metadata_json?.document_type?.replaceAll('_', ' ').toLowerCase()].filter(Boolean).join(' · ') : '';
  return <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-200"><Icon className="h-5 w-5" /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><Link href={`/knowledge-base/${source.id}`} className="font-semibold text-[var(--foreground)] hover:text-cyan-700 hover:underline dark:hover:text-cyan-300">{source.title}</Link><span className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${STATUS_STYLE[source.status] || STATUS_STYLE.PENDING_UPLOAD}`}>{source.status.replaceAll('_', ' ').toLowerCase()}</span></div><p className="mt-1 truncate text-sm text-[var(--muted-foreground)]">{source.description || 'No usage instructions provided.'}</p><div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs font-medium text-slate-700 dark:text-slate-300"><span>{typeLabel(source.reference_type)}</span>{entityCount > 0 && <span>{entityCount} business entities</span>}{binding && <span>{binding}</span>}<span>{source.original_filename}</span><span>{formatSize(source.size_bytes)}</span></div></div><div className="flex gap-2 sm:justify-end"><Link href={`/knowledge-base/${source.id}`} className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500 px-3 py-2 text-xs font-semibold text-cyan-800 hover:bg-cyan-50 dark:text-cyan-200 dark:hover:bg-cyan-950">View details</Link><button type="button" onClick={onDownload} disabled={source.status !== 'STORED'} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-400 px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100 disabled:opacity-40 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800"><Download className="h-3.5 w-3.5" /> Download</button><button type="button" onClick={onDelete} disabled={deleting} className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950">{deleting ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />} Delete</button></div></div>;
}
