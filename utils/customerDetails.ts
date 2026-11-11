import type { CustomerForm, CustomerDetailsImport } from '../services/CustomerMasterService';

export function customerFormatWarnings(form: CustomerForm): string[] {
  const warnings: string[] = [];
  const malaysia = ['', 'MY', 'MALAYSIA'].includes(form.country.trim().toUpperCase());
  const reg = form.registration_no.trim(); const postcode = form.postcode.trim(); const tin = form.tin.trim();
  if (malaysia && reg && !/^\d{12}$/.test(reg)) warnings.push('New registration number should contain 12 digits; confirm it against the customer details.');
  if (malaysia && postcode && !/^\d{5}$/.test(postcode)) warnings.push('Malaysian postcode should contain exactly 5 digits, including any leading zero.');
  if (tin && malaysia) {
    const match = /^([A-Z]{1,2})(\d+)$/.exec(tin);
    const prefixes = ['IG', 'EI', 'C', 'CS', 'D', 'F', 'FA', 'PT', 'TA', 'TC', 'TN', 'TR', 'TP', 'J', 'LE', 'E', 'TF'];
    if (!match || !prefixes.includes(match[1]) || tin.length > 14) warnings.push('Check the TIN prefix and numeric format (maximum 14 characters).');
    else if (!['IG', 'EI'].includes(match[1]) && (match[2].startsWith('0') || !match[2].endsWith('0'))) warnings.push('Check the non-individual TIN: no leading zero after its prefix, and it should end in 0.');
  }
  return warnings;
}


export function mergeCustomerDetails(current: CustomerForm | undefined, imported: CustomerDetailsImport): CustomerForm {
  const next = { ...(current || imported.prefill), address_lines: [...(current || imported.prefill).address_lines] };
  const allowed = !imported.identity_review?.required && (imported.identity_review?.confirmed ||
    ['MATCHED', 'MATCHED_PARTIAL'].includes(imported.customer_details?.status || ''));
  if (allowed) {
    for (const [key, value] of Object.entries(imported.customer_details?.fields || {})) {
      if (key in next && value && (!Array.isArray(value) || value.some(Boolean))) Object.assign(next, { [key]: value });
    }
  }
  return next;
}
