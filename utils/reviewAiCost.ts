export function formatAiCost(value: string): string {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) return 'Unavailable';
  if (amount === 0) return 'USD $0.0000';
  if (amount < 0.0001) return '< USD $0.0001';
  return `USD $${amount.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}`;
}

export function aiStageLabel(stage: string): string {
  if (/discover_workbook/.test(stage)) return 'Shared workbook discovery';
  if (/excel/.test(stage)) return 'Spreadsheet extraction';
  if (/select_customer/.test(stage)) return 'Customer matching';
  if (/payment_message_intent/.test(stage)) return 'Payment message interpretation';
  if (/receiving_account/.test(stage)) return 'Receiving account check';
  if (/payment_business_decision/.test(stage)) return 'Payment interpretation';
  if (/payment_ai/.test(stage)) return 'Payment extraction';
  if (/image_ai|document_ai/.test(stage)) return 'Document extraction';
  if (/capture/.test(stage)) return 'Message classification';
  if (/translation/.test(stage)) return 'Description translation';
  if (/design/.test(stage)) return 'Workflow interpretation';
  return 'AI processing';
}
