import { BASE_URL } from './config';
import { getScopedHeaders } from './apiHelpers';

export interface AiCostSummary {
  estimated_cost_usd: string;
  shared_source_estimated_cost_usd: string;
  unknown_cost_calls: number;
  provider_calls: number;
  reused_calls: number;
  errors: number;
  input_tokens: number;
  cached_input_tokens: number;
  cache_write_tokens: number;
  output_tokens: number;
  reasoning_tokens: number;
  repeated_provider_calls: number;
}
export interface AiCostStage extends AiCostSummary { stage: string; model: string }
export interface ReviewAiCostReport {
  review_id: number;
  currency: 'USD';
  estimated: true;
  tracking_started_on: string;
  fetched_at: string;
  status: 'available' | 'partial' | 'no_data' | 'unavailable';
  summary: AiCostSummary | null;
  stages: AiCostStage[];
}

export async function getReviewAiCost(runId: number, signal: AbortSignal): Promise<ReviewAiCostReport> {
  const response = await fetch(`${BASE_URL}/agents/runs/${runId}/ai-cost`, {
    headers: getScopedHeaders(), signal, cache: 'no-store',
  });
  if (!response.ok) throw new Error('AI costs could not be loaded.');
  const report: ReviewAiCostReport = await response.json();
  if (report.review_id !== runId) throw new Error('AI cost review mismatch.');
  return report;
}
