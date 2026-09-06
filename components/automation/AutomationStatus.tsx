import { ChevronDown } from 'lucide-react';
import { useSyncExternalStore, type CSSProperties } from 'react';

export type ApprovalDestination = 'SQL' | 'EMAIL' | 'WHATSAPP';

export interface AutomationStatusDefinition {
  key: string;
  label: string;
  color: string;
  meaning: string;
}

const RECEIVED_PROCESSING: AutomationStatusDefinition = {
  key: 'RECEIVED_PROCESSING',
  label: 'Received / Processing',
  color: '#9CA3AF',
  meaning: 'System is extracting; no action needed.',
};

const NEEDS_REVIEW: AutomationStatusDefinition = {
  key: 'NEEDS_REVIEW',
  label: 'Needs Review',
  color: '#F59E0B',
  meaning: 'Human needs to open it and fill in or confirm fields.',
};

const WAITING_FOR_INSTRUCTION: AutomationStatusDefinition = {
  key: 'WAITING_FOR_INSTRUCTION',
  label: 'Waiting for instruction / 待补文字资料',
  color: '#D97706',
  meaning: 'The payment image is safely received. Send the related payment or invoice details in the same chat to continue.',
};

const AI_VERIFYING: AutomationStatusDefinition = {
  key: 'AI_VERIFYING',
  label: 'AI Verifying',
  color: '#F97316',
  meaning: "System is checking the supplier's INV/DO against the original PO.",
};

const VERIFICATION_FAILED: AutomationStatusDefinition = {
  key: 'VERIFICATION_FAILED',
  label: 'Verification Failed',
  color: '#EF4444',
  meaning: 'A mismatch was found; human review is required before sending.',
};

const VERIFICATION_PASSED: AutomationStatusDefinition = {
  key: 'VERIFICATION_PASSED',
  label: 'Verification Passed',
  color: '#84CC16',
  meaning: 'Supplier documents match the PO and await approval to send to the customer.',
};

const PENDING_SQL: AutomationStatusDefinition = {
  key: 'PENDING_SQL',
  label: 'Pending Approval — Push to SQL',
  color: '#8B5CF6',
  meaning: 'Data reviewed; awaiting approval to write into SQL Accounting.',
};

const PENDING_EMAIL: AutomationStatusDefinition = {
  key: 'PENDING_EMAIL',
  label: 'Pending Approval — Send Email',
  color: '#3B82F6',
  meaning: 'Awaiting approval to send via Email.',
};

const PENDING_WHATSAPP: AutomationStatusDefinition = {
  key: 'PENDING_WHATSAPP',
  label: 'Pending Approval — Send WhatsApp',
  color: '#06B6D4',
  meaning: 'Awaiting approval to send via WhatsApp.',
};

const COMPLETED: AutomationStatusDefinition = {
  key: 'COMPLETED',
  label: 'Completed',
  color: '#22C55E',
  meaning: 'All required SQL, Email, and WhatsApp actions are done.',
};

const FAILED: AutomationStatusDefinition = {
  key: 'FAILED',
  label: 'Failed / Error',
  color: '#EF4444',
  meaning: 'Needs human intervention and must not remain silently stuck.',
};

const MISSING_FILE: AutomationStatusDefinition = {
  key: 'MISSING_FILE',
  label: 'File download failed',
  color: '#EF4444',
  meaning: 'WhatsApp supplied the message details, but the file must be uploaded manually.',
};

const EXCLUDED: AutomationStatusDefinition = {
  key: 'EXCLUDED',
  label: 'Excluded by AI',
  color: '#64748B',
  meaning: 'AI determined this item is outside the selected workflow; it remains in the audit record.',
};

const HIDDEN: AutomationStatusDefinition = {
  key: 'HIDDEN',
  label: 'Hidden',
  color: '#64748B',
  meaning: 'A user hid this Inbox item. It can be restored from Completed.',
};

export const AUTOMATION_STATUS_LEGEND = [
  RECEIVED_PROCESSING,
  WAITING_FOR_INSTRUCTION,
  NEEDS_REVIEW,
  AI_VERIFYING,
  VERIFICATION_FAILED,
  VERIFICATION_PASSED,
  PENDING_SQL,
  PENDING_EMAIL,
  PENDING_WHATSAPP,
  COMPLETED,
  FAILED,
];

export function resolveAutomationStatus(
  rawStatus?: string | null,
  destination: ApprovalDestination = 'SQL',
): AutomationStatusDefinition {
  const status = String(rawStatus || '').trim().toUpperCase();
  if (status === 'WAITING_FOR_INSTRUCTION') return WAITING_FOR_INSTRUCTION;
  if (status === 'AI_VERIFYING') return AI_VERIFYING;
  if (status === 'VERIFICATION_FAILED') return VERIFICATION_FAILED;
  if (status === 'VERIFICATION_PASSED') return VERIFICATION_PASSED;
  if (status === 'INCOMPLETE') return MISSING_FILE;
  if (status === 'FILTERED') return EXCLUDED;
  if (status === 'IGNORED') return HIDDEN;
  if (['FAILED', 'OUTPUT_FAILED', 'DELIVERY_PENDING', 'REJECTED', 'ERROR'].includes(status)) return FAILED;
  if (status.includes('FAILED') || status.includes('ERROR')) return FAILED;
  if (['COMPLETED', 'APPROVED', 'POSTED', 'CREATED', 'SENT', 'DELIVERED'].includes(status)) return COMPLETED;
  if (status === 'DRAFT_GENERATED') {
    if (destination === 'EMAIL') return PENDING_EMAIL;
    if (destination === 'WHATSAPP') return PENDING_WHATSAPP;
    return PENDING_SQL;
  }
  if (['PENDING_REVIEW', 'EXTERNAL_DOCUMENTS_RECEIVED', 'REPLY_RECEIVED', 'DOCUMENTS_COMPLETE', 'SUCCESS', 'TO_REVIEW'].includes(status)) return NEEDS_REVIEW;
  if (status === 'WAITING_EXTERNAL_DOCUMENTS') {
    return {
      ...RECEIVED_PROCESSING,
      meaning: `Request sent via ${destination === 'SQL' ? 'the external channel' : destination === 'EMAIL' ? 'Email' : 'WhatsApp'}; waiting for the provider reply. No action is needed yet.`,
    };
  }
  return RECEIVED_PROCESSING;
}

export function inferApprovalDestination(
  data?: Record<string, unknown> | null,
  templateKey?: string | null,
): ApprovalDestination {
  if (String(templateKey || '').toLowerCase() === 'payment_knock_off') return 'SQL';
  const issuer = data?.issuing_entity && typeof data.issuing_entity === 'object'
    ? data.issuing_entity as Record<string, unknown>
    : {};
  const route = String(data?.fulfilment_route || issuer.fulfilment_mode || issuer.route || '').toUpperCase();
  if (route !== 'OUTSOURCED') return 'SQL';
  return String(issuer.outbound_channel || '').toUpperCase() === 'WHATSAPP' ? 'WHATSAPP' : 'EMAIL';
}

function badgeStyle(color: string): CSSProperties {
  return {
    borderColor: color,
    color,
    backgroundColor: `${color}18`,
  };
}

export function AutomationStatusBadge({
  status,
  destination = 'SQL',
  showMeaning = false,
}: {
  status?: string | null;
  destination?: ApprovalDestination;
  showMeaning?: boolean;
}) {
  const definition = resolveAutomationStatus(status, destination);
  return (
    <div className={showMeaning ? 'space-y-1' : undefined}>
      <span
        className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold"
        style={badgeStyle(definition.color)}
        title={definition.meaning}
      >
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: definition.color }} />
        {definition.label}
      </span>
      {showMeaning && <p className="text-xs text-[var(--muted-foreground)]">{definition.meaning}</p>}
    </div>
  );
}

const STATUS_GUIDE_STORAGE_KEY = 'smartdok.review.status-guide-expanded';
const STATUS_GUIDE_EVENT = 'smartdok-status-guide-change';

function subscribeStatusGuide(callback: () => void) {
  window.addEventListener('storage', callback);
  window.addEventListener(STATUS_GUIDE_EVENT, callback);
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener(STATUS_GUIDE_EVENT, callback);
  };
}

function statusGuideSnapshot() {
  return window.localStorage.getItem(STATUS_GUIDE_STORAGE_KEY) === 'true';
}

export function AutomationStatusLegend({
  selectedStatus = 'ALL',
  statusCounts = {},
  onStatusSelect,
}: {
  selectedStatus?: string;
  statusCounts?: Record<string, number>;
  onStatusSelect?: (status: string) => void;
}) {
  const expanded = useSyncExternalStore(subscribeStatusGuide, statusGuideSnapshot, () => false);

  const toggleExpanded = () => {
    window.localStorage.setItem(STATUS_GUIDE_STORAGE_KEY, String(!expanded));
    window.dispatchEvent(new Event(STATUS_GUIDE_EVENT));
  };

  const activeDefinition = AUTOMATION_STATUS_LEGEND.find((item) => item.key === selectedStatus);

  return (
    <section className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)]">
      <button type="button" aria-expanded={expanded} onClick={toggleExpanded} className="flex w-full items-center justify-between gap-4 p-4 text-left hover:bg-[var(--muted)]/40">
        <span>
          <span className="flex flex-wrap items-center gap-2 text-sm font-semibold text-[var(--foreground)]">
            Status guide
            {activeDefinition && (
              <span className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs" style={badgeStyle(activeDefinition.color)}>
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: activeDefinition.color }} />
                Filtering: {activeDefinition.label}
              </span>
            )}
          </span>
          <span className="mt-1 block text-xs text-[var(--muted-foreground)]">The same colours and meanings are used in Inbox, Review, and automation runs.</span>
        </span>
        <span className="flex shrink-0 items-center gap-2 text-xs font-semibold text-[var(--muted-foreground)]">
          {expanded ? 'Hide guide' : 'Show guide'}
          <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </span>
      </button>
      {expanded && (
        <div className="grid gap-2 border-t border-[var(--border)] p-4 md:grid-cols-2 xl:grid-cols-3">
          {AUTOMATION_STATUS_LEGEND.map((definition) => {
            const selected = selectedStatus === definition.key;
            return (
              <button
                key={definition.key}
                type="button"
                aria-pressed={selected}
                onClick={() => onStatusSelect?.(selected ? 'ALL' : definition.key)}
                className={`rounded-lg border p-3 text-left transition ${selected ? 'ring-2 ring-cyan-500/50' : 'border-[var(--border)] hover:bg-[var(--muted)]/40'} ${onStatusSelect ? '' : 'cursor-default'}`}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold" style={badgeStyle(definition.color)}>
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: definition.color }} />
                    {definition.label}
                  </span>
                  <span className="rounded-full bg-[var(--muted)] px-2 py-0.5 text-xs font-bold text-[var(--foreground)]">{statusCounts[definition.key] || 0}</span>
                </span>
                <span className="mt-2 block text-xs leading-5 text-[var(--muted-foreground)]">{definition.meaning}</span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
