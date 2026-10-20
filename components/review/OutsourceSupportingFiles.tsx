'use client';

import { useRef, useState } from 'react';
import { Paperclip, X } from 'lucide-react';
import { addOutsourceSupportingFiles, removeOutsourceSupportingFile, type OutsourceSupportingFile } from '@/services/AgentsService';

export function OutsourceSupportingFiles({ runId, files, editable, busy, onBusyChange, onChanged, onOpen }: {
  runId: number; files: OutsourceSupportingFile[]; editable: boolean; busy: boolean;
  onBusyChange: (busy: boolean) => void; onChanged: () => Promise<void>;
  onOpen: (file: OutsourceSupportingFile) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  async function change(task: () => Promise<unknown>) {
    if (busy || !editable) return;
    setError('');onBusyChange(true);
    try { await task();await onChanged(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not update supporting attachments.'); }
    finally { onBusyChange(false); }
  }
  return <div className="rounded-lg border border-[#E2E7E9] p-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="text-[12.5px] font-semibold text-[#3C4C53]">Other attachments</span>
      <input ref={input} aria-label="Upload supporting files" type="file" multiple className="hidden"
        accept=".pdf,.png,.jpg,.jpeg,.webp,.xls,.xlsx,.xlsm,.csv,.doc,.docx,.txt,.ppt,.pptx"
        disabled={busy || !editable} onChange={event => {
          const selected=Array.from(event.target.files || []);event.target.value='';
          if (!selected.length) return;
          if (files.length+selected.length>10) {setError('Keep at most 10 supporting files.');return;}
          if (selected.some(file=>!file.size) || selected.reduce((sum,file)=>sum+file.size,0)>20*1024*1024) {
            setError('Choose non-empty files, up to 20 MB combined.');return;
          }
          void change(()=>addOutsourceSupportingFiles(runId,selected,files.map(file=>file.file_key)));
        }} />
      <button type="button" disabled={busy || !editable} onClick={()=>input.current?.click()}
        className="inline-flex items-center gap-2 rounded-lg border border-[#BCD8E2] px-3 py-1.5 text-[12.5px] font-semibold text-[#1C6C87] disabled:opacity-50">
        <Paperclip className="h-3.5 w-3.5" /> Add files
      </button>
    </div>
    <p className="mt-2 text-xs text-[#5E6E75]">Attach slips or company documents before sending. Up to 10 extra files; 20 MB including the PO.</p>
    {files.length>0 && <ul className="mt-2 space-y-1.5">{files.map(file=><li key={file.file_key} className="flex items-center gap-2 rounded border border-[#E2E7E9] bg-white px-2 py-1.5">
      <Paperclip className="h-3 w-3 shrink-0 text-[#5E6E75]" />
      <button type="button" disabled={busy} onClick={()=>onOpen(file)} className="min-w-0 flex-1 break-all text-left text-xs text-[#1C6C87] underline">{file.filename}</button>
      <span className="shrink-0 text-[11px] text-[#5E6E75]">{Math.max(1,Math.ceil(file.size/1024))} KB</span>
      {editable && <button type="button" aria-label={`Remove ${file.filename}`} disabled={busy}
        onClick={()=>void change(()=>removeOutsourceSupportingFile(runId,file.file_key,files.map(item=>item.file_key)))}
        className="rounded p-1 text-[#5E6E75] hover:bg-[#F5F7F7] disabled:opacity-50"><X className="h-3.5 w-3.5" /></button>}
    </li>)}</ul>}
    {error && <p role="alert" className="mt-2 text-xs text-red-700">{error}</p>}
  </div>;
}
