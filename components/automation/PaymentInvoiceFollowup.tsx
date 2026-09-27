type Followup = { status?: string; next_due_at?: string; detail?: string; sent_count?: number };

export function PaymentInvoiceFollowup({ followup, acknowledgementSent }: { followup?: Followup; acknowledgementSent: boolean }) {
  if (!followup?.next_due_at) return null;
  const resolved = followup.status === 'resolved';
  return <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 text-sm">
    <h3 className="font-semibold">Pending invoice follow-up</h3>
    <p className="mt-1">{resolved ? 'Invoice received. Further invoice reminders have stopped.' : !acknowledgementSent ? 'Waiting for the OR confirmation to reach the source group before starting 24-hour reminders.' : 'A reminder will be sent to the original group every 24 hours until the invoice number is provided.'}</p>
    {!resolved && acknowledgementSent && <p className="mt-1 text-[var(--muted-foreground)]">Next scheduled check: {new Date(followup.next_due_at).toLocaleString()}</p>}
    {followup.status === 'failed' && <p className="mt-2 text-amber-700">Reminder pending: {followup.detail || 'Delivery has not been confirmed.'}</p>}
  </section>;
}
