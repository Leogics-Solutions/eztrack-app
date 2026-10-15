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
  return cases.flatMap((source) => {
    const groups = new Map<string, OutsourcedSet[]>();
    for (const set of source.sets) {
      const key = set.route_key || JSON.stringify([set.issuing_company, set.customer, set.currency, set.outbound_channel, set.test_mode]);
      groups.set(key, [...(groups.get(key) || []), set]);
    }
    return [...groups.values()].map((sets) => {
      const state: OutsourcedCaseState = sets.every((set) => set.delivered || set.status === 'COMPLETED')
        ? 'COMPLETED' : sets.some((set) => set.state === 'ACTION' || ['DRAFT_GENERATED', 'EXTERNAL_DOCUMENTS_RECEIVED', 'VERIFICATION_FAILED', 'VERIFICATION_PASSED', 'PENDING_REVIEW', 'FAILED', 'OUTPUT_FAILED'].includes(set.status))
          ? 'ACTION' : 'WAITING';
      const set = sets.find((value) => !value.delivered && value.status !== 'COMPLETED') || sets[0];
      return { caseId: source.case_id, instruction: source.instruction, sourceFilename: source.source_filename, set, sets, state };
    });
  });
}

export function caseTitle(item: OutsourcedWorkItem) {
  const issuer = item.set.issuing_company?.trim() || 'Issuing company needs confirmation';
  const customer = item.set.customer?.trim() || 'Customer needs confirmation';
  return `${issuer} → ${customer}${item.sets.length > 1 ? ` · ${item.sets.length} sets` : ''}`;
}
