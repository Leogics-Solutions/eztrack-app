import type { OutsourcedCase, OutsourcedCaseState, OutsourcedSet } from '../services/AgentsService';

export interface OutsourcedWorkItem {
  caseId: number;
  instruction?: string;
  sourceFilename?: string;
  set: OutsourcedSet;
  sets: OutsourcedSet[];
  state: OutsourcedCaseState;
}

export function caseRows(cases: OutsourcedCase[]): OutsourcedWorkItem[] {
  const priorities = ['VERIFICATION_FAILED', 'FAILED', 'OUTPUT_FAILED', 'EXTERNAL_DOCUMENTS_RECEIVED',
    'AI_VERIFYING', 'PENDING_REVIEW', 'DRAFT_GENERATED', 'DELIVERY_PENDING', 'VERIFICATION_PASSED', 'WAITING_EXTERNAL_DOCUMENTS'];
  return cases.filter(source => source.sets.length > 0).map(source => {
    const sets = [...source.sets].sort((a,b) => a.run_id-b.run_id).map((set,index) => ({...set,set_index:index+1,set_count:source.sets.length}));
    const active = sets.filter(set => !set.delivered && set.status !== 'COMPLETED');
    const rank = (set: OutsourcedSet) => priorities.includes(set.status) ? priorities.indexOf(set.status) : priorities.length;
    const representative = active.reduce<OutsourcedSet | undefined>((chosen,set) => !chosen || rank(set)<rank(chosen) ? set : chosen,undefined) || sets[0];
    const set = {...representative,status:active.length ? representative.status : 'COMPLETED'};
    const state: OutsourcedCaseState = !active.length ? 'COMPLETED'
      : ['DRAFT_GENERATED','EXTERNAL_DOCUMENTS_RECEIVED','VERIFICATION_FAILED','VERIFICATION_PASSED','PENDING_REVIEW','FAILED','OUTPUT_FAILED','DELIVERY_PENDING'].includes(set.status) ? 'ACTION' : 'WAITING';
    return {caseId:source.case_id,instruction:source.instruction,sourceFilename:source.source_filename,set,sets,state};
  });
}

export function caseAmount(item: OutsourcedWorkItem): string {
  if (item.sets.some(set => set.amount == null || !Number.isFinite(set.amount))) return 'Amount needs confirmation';
  if (item.sets.some(set => !set.currency)) return 'Currency needs confirmation';
  const totals = new Map<string,number>();
  for (const set of item.sets) {
    const raw=set.currency!.trim().toUpperCase(); const currency=raw==='RM' ? 'MYR' : raw;
    totals.set(currency,(totals.get(currency)||0)+set.amount!);
  }
  return [...totals].map(([currency,amount]) => `${currency==='MYR' ? 'RM' : currency} ${amount.toLocaleString('en-MY',{minimumFractionDigits:2,maximumFractionDigits:2})}`).join(' + ');
}

export function caseTitle(item: OutsourcedWorkItem) {
  const issuers = new Set(item.sets.map(set => set.issuing_company?.trim()).filter(Boolean));
  const issuer = issuers.size > 1 ? 'Multiple issuing companies' : item.set.issuing_company?.trim() || 'Issuing company needs confirmation';
  const customers = new Set(item.sets.map(set => set.customer?.trim()).filter(Boolean));
  const customer = customers.size > 1 ? 'Multiple customers' : item.set.customer?.trim() || 'Customer needs confirmation';
  return `${issuer} → ${customer}${item.sets.length > 1 ? ` · ${item.sets.length} sets` : ''}`;
}
