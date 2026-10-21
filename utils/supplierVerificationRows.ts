type Check = { code?: string; category?: string; label?: string; status?: string; expected?: unknown; actual?: unknown; line?: number | null; original_evidence?: string; returned_evidence?: string; reason?: string };
type Verification = { documents?: Array<{ filename?: string; document_number?: string; checks?: Check[] }>; original_source_comparisons?: Array<{ filename?: string; checks?: Check[]; reason?: string }> };

const LABELS: Record<string, string> = { DOCUMENT_DATE:'Date', DESCRIPTION:'Description', QUANTITY:'Quantity', UNIT_PRICE:'Unit price', GRAND_TOTAL:'Amount', ROUNDING_AMOUNT:'Rounding amount' };

export function supplierVerificationRows(verification?: Verification) {
  const rows = [];
  for (const [documentIndex, document] of (verification?.documents || []).entries()) {
    for (const [checkIndex, check] of (document.checks || []).entries()) {
      rows.push({ key:`document-${documentIndex}-${checkIndex}`, document:document.document_number || document.filename || 'Returned file',
        label:`${LABELS[check.code || ''] || check.label || check.code || 'Check'}${check.line ? ` · line ${check.line}` : ''}`,
        expected:check.expected, actual:check.actual, match:['PASSED','NOT_APPLICABLE'].includes(check.status || ''),
        status:check.status || 'FAILED', systemError:check.code === 'VERIFICATION_SYSTEM_ERROR', note:undefined as string | undefined });
    }
  }
  for (const [fileIndex, file] of (verification?.original_source_comparisons || []).entries()) {
    const checks = file.checks?.length ? file.checks : [{ category:'ORIGINAL_SOURCE', status:'FAILED', reason:file.reason || 'Original source comparison unavailable.' }];
    for (const [checkIndex, check] of checks.entries()) {
      rows.push({ key:`source-${fileIndex}-${checkIndex}`, document:file.filename || 'Original PO',
        label:`Original PO · ${(check.category || 'Evidence').replaceAll('_',' ').toLowerCase()}`,
        expected:check.original_evidence, actual:check.returned_evidence,
        match:['PASSED','NOT_APPLICABLE'].includes(check.status || ''), status:check.status || 'FAILED', systemError:!file.checks?.length, note:check.reason });
    }
  }
  return rows;
}
