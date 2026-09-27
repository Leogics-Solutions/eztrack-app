/** Customer identity errors alone require choosing/creating a customer.
 * A tax-group or connection failure must retain its own recovery path. */
export function requiresOrderCustomerSelection(input: {
  outsourced: boolean; identityChanged: boolean; status?: string;
  delivery?: { status?: string; error_code?: string; customer_proposal?: unknown };
  hasProposal: boolean;
}): boolean {
  if (input.outsourced || input.identityChanged || input.status !== 'DRAFT_GENERATED' || input.hasProposal) return false;
  return input.delivery?.status === 'needs_customer_approval'
    || (input.delivery?.status === 'failed'
      && ['SQL_CUSTOMER_NOT_FOUND', 'SQL_CUSTOMER_REQUIRED'].includes(input.delivery?.error_code || ''));
}
