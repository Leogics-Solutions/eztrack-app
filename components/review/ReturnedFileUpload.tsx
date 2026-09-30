import { useState } from 'react';
import { Paperclip, X } from 'lucide-react';
import { addReturnedDocuments } from '@/services/AgentsService';
import { returnedFilesError } from '@/utils/returnedAttachments';

export function ReturnedFileUpload({ runId, fileKeys, disabled, onSaved, onBusy }: {
  runId: number; fileKeys: string[]; disabled: boolean; onSaved: () => Promise<unknown>; onBusy: (value: boolean) => void;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const save = async () => {
    const problem = returnedFilesError(files, fileKeys.length);
    if (problem) { setError(problem); return; }
    setUploading(true); onBusy(true); setError('');
    try {
      await addReturnedDocuments(runId, files, fileKeys);
      setFiles([]);
      await onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : 'Upload failed. Check the attachment list before retrying.'); }
    finally { setUploading(false); onBusy(false); }
  };
  return <div className="border-t border-[#EDF1F2] px-4 py-3 text-sm">
    <p className="text-xs text-[#5E6E75]">These returned files will be sent after verification and your approval. Adding or removing a file requires a fresh check; nothing is sent now.</p>
    <label className={`mt-3 inline-flex items-center gap-2 rounded-lg border border-[#DCE3E5] bg-white px-3 py-2 font-medium ${disabled ? 'opacity-50' : 'cursor-pointer'}`}>
      <Paperclip className="h-4 w-4" /> Add returned files
      <input aria-label="Add returned files" type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.webp" className="sr-only" disabled={disabled || uploading} onChange={event => {
        const next = [...files, ...Array.from(event.target.files || [])];
        event.target.value = '';
        const problem = returnedFilesError(next, fileKeys.length);
        if (problem) setError(problem); else { setFiles(next); setError(''); }
      }} />
    </label>
    <span className="ml-3 text-xs text-[#5E6E75]">PDF / images · 25 MB each · up to 10 per upload</span>
    {files.length > 0 && <div className="mt-3 space-y-2">
      <p className="text-xs font-semibold">Selected, not uploaded ({files.length})</p>
      {files.map((file, index) => <div key={`${file.name}-${index}`} className="flex items-center gap-2 rounded border px-3 py-2">
        <span className="min-w-0 flex-1 break-all">{file.name}</span><span className="text-xs text-[#5E6E75]">{(file.size / 1024).toFixed(0)} KB</span>
        <button type="button" disabled={disabled || uploading} aria-label={`Remove selected ${file.name}`} onClick={() => setFiles(files.filter((_, i) => i !== index))}><X className="h-4 w-4" /></button>
      </div>)}
      <button type="button" disabled={disabled || uploading} onClick={() => void save()} className="rounded-lg bg-[#1C6C87] px-4 py-2 font-semibold text-white disabled:opacity-50">{uploading ? 'Uploading…' : `Upload ${files.length} file${files.length === 1 ? '' : 's'}`}</button>
    </div>}
    {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
  </div>;
}
