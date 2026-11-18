type PaymentSnapshot = {
  status?: string;
  error_message?: string | null;
  corrected_data?: unknown;
  extracted_data?: unknown;
  output_refs?: unknown;
  review_schema?: { template_key?: string | null } | null;
};

export function currentPaymentError(previous: string | null, run: PaymentSnapshot): string | null {
  if (!previous || run.review_schema?.template_key !== 'payment_knock_off' || run.error_message) return previous;
  if (!/Finance previously marked PENDING SLIP|A matching payment is being admitted or stopped/i.test(previous)) return previous;
  const refs = (run.output_refs || {}) as Record<string, unknown>;
  if (refs.payment_submit_interrupted || refs.payment_submit_active || refs.payment_manual_handoff || refs.payment_resolution) return previous;
  if (run.status === 'COMPLETED') return null;
  if (refs.payment_post_attempts || refs.sql_account_payment) return previous;
  const data = (run.corrected_data || run.extracted_data || {}) as Record<string, unknown>;
  const state = (data.payment_state || {}) as { ready_to_post?: boolean; blockers?: unknown[] };
  return state.ready_to_post === true && !(state.blockers || []).length ? null : previous;
}
