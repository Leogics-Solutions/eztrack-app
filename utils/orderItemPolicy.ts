import type { AgentRunData } from '../services/AgentsService';

export type OrderItemPolicyMode = 'COMPANY_DEFAULT' | 'FOLLOW_PO_FREE_TEXT';

export function canChangeOrderItemPolicy(approved: boolean, sqlStatus: string | undefined, hasPostingIntent: boolean): boolean {
  return !hasPostingIntent && sqlStatus !== 'created' && (!approved || sqlStatus === 'needs_item_approval');
}

export function orderItemPolicyMode(data: AgentRunData | null | undefined, runId: number): OrderItemPolicyMode {
  const policy = data?.sql_order_item_policy;
  return policy?.mode === 'FOLLOW_PO_FREE_TEXT' && policy.confirmed === true
    && policy.approval_source === 'human_review_instruction'
    && Boolean(policy.connection_id)
    && policy.connection_id === data?.issuing_entity?.sql_connection_id
    && (policy.review_id == null || policy.review_id === runId)
    ? 'FOLLOW_PO_FREE_TEXT' : 'COMPANY_DEFAULT';
}
