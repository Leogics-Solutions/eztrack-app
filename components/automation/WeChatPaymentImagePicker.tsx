import { useState } from 'react';
import { attachWeChatPaymentImage, listWeChatPaymentImages, type AgentRun, type WeChatPaymentImage } from '@/services/AgentsService';
import { getCaptureAttachmentPreview } from '@/services/CaptureService';

export default function WeChatPaymentImagePicker({ runId, initialDay, busy, onAttach }: {
  runId: number;
  initialDay: string;
  busy: boolean;
  onAttach: (attach: () => Promise<AgentRun>) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [day, setDay] = useState(initialDay);
  const [items, setItems] = useState<WeChatPaymentImage[] | null>(null);
  const [next, setNext] = useState<number | null>(null);
  const [preview, setPreview] = useState<{ image: WeChatPaymentImage; url: string } | null>(null);
  const [loadedToken, setLoadedToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [attached, setAttached] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const showPage = async (beforeId?: number) => {
    setLoading(true);
    setError(null);
    setPreview(null);
    try {
      const page = await listWeChatPaymentImages(runId, day, beforeId);
      setItems(previous => beforeId ? [...(previous || []), ...page.items] : page.items);
      setNext(page.next_before_id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load retained WeChat images.');
    } finally {
      setLoading(false);
    }
  };

  const showImage = async (image: WeChatPaymentImage) => {
    setLoading(true);
    setError(null);
    setPreview(null);
    try {
      const file = await getCaptureAttachmentPreview(image.capture_event_id, image.attachment_index);
      setPreview({ image, url: file.preview_url });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Original image unavailable.');
    } finally {
      setLoading(false);
    }
  };

  const attachPreview = async () => {
    if (!preview || loadedToken !== preview.image.source_token) return;
    const { image } = preview;
    setLoading(true);
    try {
      if (await onAttach(() => attachWeChatPaymentImage(runId, image))) {
        setAttached(true);
        setItems(previous => (previous || []).filter(item => item.source_token !== image.source_token));
        setPreview(null);
      }
    } finally {
      setLoading(false);
    }
  };

  return <section className="mt-4 border-t border-cyan-200 pt-3">
    <button type="button" disabled={loading || busy} onClick={() => setOpen(!open)}
      className="rounded border border-cyan-700 px-3 py-2 text-sm font-semibold">
      {open ? 'Close WeChat image picker' : 'Choose retained WeChat image'}
    </button>
    {open && <div className="mt-3 space-y-3">
      <p className="text-sm">Browse original images retained from this payment's WeChat group.</p>
      <form className="flex flex-wrap items-end gap-2" onSubmit={event => { event.preventDefault(); void showPage(); }}>
        <label className="text-sm">Group message date
          <input className="ml-2 rounded border bg-white p-2 text-black" type="date" value={day}
            required disabled={loading || busy} onChange={event => {
              setDay(event.target.value); setItems(null); setNext(null); setPreview(null); setError(null);
            }} />
        </label>
        <button className="rounded bg-cyan-700 px-3 py-2 text-sm text-white disabled:opacity-50" type="submit"
          disabled={!day || loading || busy}>Find images</button>
      </form>
      {attached && <p role="status" className="text-sm font-medium">Image attached. Reanalyse the linked evidence and check the result before approving.</p>}
      {error && <p role="alert" className="text-sm text-red-800">{error}</p>}
      {loading && <p role="status" className="text-sm">Working…</p>}
      {items?.length === 0 && <p className="text-sm">No retained images in these results. Upload a copy if the original download failed.</p>}
      {items && items.length > 0 && <ul className="max-h-60 space-y-2 overflow-auto">
        {items.map(item => <li key={item.source_token} className="flex flex-wrap items-center justify-between gap-2 border-b border-cyan-100 py-2">
          <div className="min-w-0 break-all text-sm">
            <p className="font-semibold">{item.filename}</p>
            <p>{item.received_at.slice(11, 19)} MYT{item.sender ? ` · ${item.sender}` : ''}</p>
          </div>
          <button type="button" disabled={loading || busy} className="rounded border border-cyan-700 px-2 py-1 text-sm"
            onClick={() => void showImage(item)}>Preview image</button>
        </li>)}
      </ul>}
      {next && <button type="button" disabled={busy || loading} className="rounded border border-cyan-700 px-2 py-1 text-sm"
        onClick={() => void showPage(next)}>Load older messages</button>}
      {preview && <div className="space-y-2 rounded border border-cyan-300 p-3">
        {/* The Capture API provides a short-lived, organization-scoped preview URL. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img key={preview.image.source_token} alt={preview.image.filename} src={preview.url}
          className="max-h-80 max-w-full object-contain"
          onLoad={() => setLoadedToken(preview.image.source_token)}
          onError={() => { setLoadedToken(null); setError('The retained original could not be opened. Try Preview image again.'); }} />
        <button type="button" disabled={loading || busy || loadedToken !== preview.image.source_token} className="rounded bg-cyan-700 px-3 py-2 text-sm text-white disabled:opacity-50"
          onClick={() => void attachPreview()}>Attach to this payment</button>
      </div>}
    </div>}
  </section>;
}
