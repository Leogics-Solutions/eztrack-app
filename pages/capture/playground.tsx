'use client';

import { CaptureShell } from '@/components/capture/CaptureShell';
import { AppLayout } from '@/components/layout';
import { useOrganization } from '@/lib/OrganizationContext';
import {
  runCapturePlayground,
  type CapturePlaygroundResult,
  type ChannelInstructionSource,
} from '@/services/CaptureService';
import { FlaskConical, UploadCloud } from 'lucide-react';
import { useEffect, useState } from 'react';

const SOURCES: Array<{ value: ChannelInstructionSource; label: string }> = [
  { value: 'UPLOAD', label: 'Upload' },
  { value: 'INBOUND_EMAIL', label: 'Inbound email' },
  { value: 'GMAIL', label: 'Gmail' },
  { value: 'WHATSAPP', label: 'WhatsApp' },
  { value: 'DRIVE', label: 'Google Drive' },
  { value: 'TELEGRAM', label: 'Telegram' },
];

export default function CapturePlaygroundPage() {
  const { selectedOrganizationId } = useOrganization();
  const [input, setInput] = useState({
    sender: '',
    subject: '',
    body: '',
    filename: '',
    source_type: 'GMAIL' as ChannelInstructionSource,
  });
  const [attachment, setAttachment] = useState<File | null>(null);
  const [runAi, setRunAi] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<CapturePlaygroundResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setResult(null);
    setError(null);
  }, [selectedOrganizationId]);

  const runTest = async () => {
    setRunning(true);
    setResult(null);
    setError(null);
    try {
      const response = await runCapturePlayground({
        ...input,
        filename: attachment?.name || input.filename,
        run_ai: runAi,
        attachment,
      });
      setResult(response);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Playground test failed.');
    } finally {
      setRunning(false);
    }
  };

  return (
    <AppLayout pageName="Capture playground">
      <CaptureShell
        title="Rules & AI playground"
        description="Test saved routing rules and layered AI instructions without creating a Capture Inbox item or invoice."
      >
        {error && (
          <div className="rounded-xl border border-red-300/60 bg-red-50 p-4 text-sm text-red-900 dark:bg-red-950/30 dark:text-red-100">
            {error}
          </div>
        )}

        <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)]">
          <div className="border-b border-[var(--border)] p-5">
            <div className="flex items-center gap-2">
              <FlaskConical className="h-5 w-5 text-cyan-600" />
              <h2 className="font-semibold">Sample input</h2>
            </div>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              Message metadata tests the complete rule chain. An optional attachment can also test real extraction.
            </p>
          </div>

          <div className="space-y-5 p-5">
            <div className="rounded-xl border border-amber-300/60 bg-amber-50 p-3 text-xs leading-5 text-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
              This uses the last saved Rules & AI configuration. Rule-only tests are free. Real AI extraction uses page quota but creates no inbox item or invoice.
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1">
                <span className="text-xs font-medium text-[var(--muted-foreground)]">Input channel</span>
                <select
                  value={input.source_type}
                  onChange={(event) => setInput((current) => ({
                    ...current,
                    source_type: event.target.value as ChannelInstructionSource,
                  }))}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm"
                >
                  {SOURCES.map((source) => (
                    <option key={source.value} value={source.value}>{source.label}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-[var(--muted-foreground)]">Sender</span>
                <input
                  value={input.sender}
                  onChange={(event) => setInput((current) => ({ ...current, sender: event.target.value }))}
                  placeholder="noreply@example.com"
                  className="w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-[var(--muted-foreground)]">Subject or file title</span>
                <input
                  value={input.subject}
                  onChange={(event) => setInput((current) => ({ ...current, subject: event.target.value }))}
                  placeholder="Purchase Order 1001"
                  className="w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-[var(--muted-foreground)]">Filename for metadata-only testing</span>
                <input
                  value={input.filename}
                  onChange={(event) => setInput((current) => ({ ...current, filename: event.target.value }))}
                  disabled={Boolean(attachment)}
                  placeholder="po-1001.pdf"
                  className="w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm disabled:opacity-50"
                />
              </label>
              <label className="space-y-1 sm:col-span-2">
                <span className="text-xs font-medium text-[var(--muted-foreground)]">Message preview or caption</span>
                <textarea
                  value={input.body}
                  onChange={(event) => setInput((current) => ({ ...current, body: event.target.value }))}
                  placeholder="Paste representative message content here."
                  rows={4}
                  className="w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
                />
              </label>
            </div>

            <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border)] p-5 text-center hover:bg-[var(--muted)]">
              <UploadCloud className="h-6 w-6 text-cyan-600" />
              <span className="mt-2 text-sm font-medium">
                {attachment ? attachment.name : 'Attach a PDF or image (optional)'}
              </span>
              <span className="mt-1 text-xs text-[var(--muted-foreground)]">
                PDF, PNG, JPG or JPEG · maximum 10MB
              </span>
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                className="sr-only"
                onChange={(event) => setAttachment(event.target.files?.[0] || null)}
              />
            </label>

            <div className="flex flex-col gap-3 rounded-xl bg-[var(--muted)] p-4 sm:flex-row sm:items-center sm:justify-between">
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={runAi}
                  onChange={(event) => setRunAi(event.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-[var(--border)] text-cyan-600"
                />
                <span>
                  <span className="font-medium">Run AI extraction</span>
                  <span className="block text-xs text-[var(--muted-foreground)]">
                    Runs only after an ACCEPT decision and uses page quota.
                  </span>
                </span>
              </label>
              <button
                type="button"
                onClick={() => void runTest()}
                disabled={running || (runAi && !attachment)}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-700 disabled:opacity-50"
              >
                <FlaskConical className={`h-4 w-4 ${running ? 'animate-pulse' : ''}`} />
                {running ? 'Running playground…' : runAi ? 'Test rules + AI' : 'Test rules & instructions'}
              </button>
            </div>
          </div>
        </section>

        {result && (
          <section className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                result.decision.action === 'ACCEPT'
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
                  : 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200'
              }`}>
                {result.decision.action}
              </span>
              <p className="text-sm">{result.decision.reason}</p>
            </div>
            <p className="text-sm text-[var(--muted-foreground)]">{result.explanation}</p>

            <div className="grid gap-3 lg:grid-cols-2">
              <div className="rounded-lg bg-[var(--muted)] p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                  Effective instructions
                </p>
                <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap font-sans text-xs leading-5">
                  {result.effective_instructions || 'No instructions applied.'}
                </pre>
              </div>
              <div className="rounded-lg bg-[var(--muted)] p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                  Execution
                </p>
                <dl className="mt-2 space-y-1 text-xs">
                  <div className="flex justify-between gap-3"><dt>AI called</dt><dd className="font-medium">{result.ai_ran ? 'Yes' : 'No'}</dd></div>
                  <div className="flex justify-between gap-3"><dt>Pages charged</dt><dd className="font-medium">{result.pages_charged}</dd></div>
                  <div className="flex justify-between gap-3"><dt>Attachment</dt><dd className="truncate font-medium">{result.attachment?.filename || 'None'}</dd></div>
                </dl>
              </div>
            </div>

            {result.extraction && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                  Extraction preview
                </p>
                <pre className="mt-2 max-h-[32rem] overflow-auto rounded-lg bg-zinc-950 p-4 text-xs leading-5 text-zinc-100">
                  {JSON.stringify(result.extraction, null, 2)}
                </pre>
              </div>
            )}
          </section>
        )}
      </CaptureShell>
    </AppLayout>
  );
}
